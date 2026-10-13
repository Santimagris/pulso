import { billEspecialARS, billPresupuestoARS, billsDelMes, billTotalARS } from "./bills";
import { addDaysISO, daysBetween, mondayOf, mondaysInMonth, monthOf, monthRange } from "./dates";
import type { Corte, Data, ISODate, ISOMonth, Ingreso } from "./types";

/**
 * MOTOR DE PULSO — cómo se calcula "cuánto podés gastar esta semana".
 *
 * 1. Plan del mes (págate primero):
 *      libre = sueldo (+ aguinaldo si va al presupuesto) − ahorro del mes − resúmenes de tarjeta del mes
 *      base semanal = libre / lunes del mes      (una semana pertenece al mes de su lunes)
 *    Los resúmenes usan el monto pagado si ya los pagaste, o el estimado si no.
 *
 * 2. Gasto del día a día (lo mide el corte, no se carga a mano):
 *      gasto = saldo anterior + ingresos − saldo actual − pagos de tarjeta − gastos especiales
 *    Pagar la tarjeta NO es gasto (ya se contó en el presupuesto del mes): por eso no hay picos.
 *    Si entre dos cortes pasa más de una semana, el gasto se reparte parejo por día.
 *
 * 3. Arrastre:
 *    - Lo que te sobra se suma ENTERO a la semana siguiente (y se sigue acumulando).
 *    - Si te pasás, se descuenta repartido entre las semanas que quedan del mes.
 *    - Al cambiar de mes, un déficit que quedó sin recuperar se absorbe del ahorro:
 *      el mes nuevo arranca limpio. Nunca más un número hundido por meses.
 *
 * El motor es una función pura: se recalcula todo desde los datos en cada render.
 */

export interface MonthPlan {
  mes: ISOMonth;
  sueldo: number;
  sueldoEstimado: boolean;
  aguinaldo: number;
  aguinaldoPresupuesto: number;
  aguinaldoAhorro: number;
  extrasAhorro: number;
  extrasSemana: number;
  /** Ahorro que sale del sueldo (porcentaje o monto fijo). */
  ahorroDelSueldo: number;
  /** Ahorro total esperado del mes: del sueldo + aguinaldo al ahorro + extras al ahorro. */
  ahorroMeta: number;
  /** Resúmenes del mes que salen del presupuesto (sin compras especiales). */
  tarjetas: number;
  tarjetasPendientes: number;
  tarjetasEspeciales: number;
  libre: number;
  lunes: ISODate[];
  base: number;
  /** Si tarjetas + ahorro superan el sueldo, lo que falta (sale del ahorro). */
  faltante: number;
}

export type EstadoSemana = "cerrada" | "actual" | "pendiente";

export interface WeekResult {
  lunes: ISODate;
  mes: ISOMonth;
  /** Presupuesto propio de la semana (base del mes × días cubiertos / 7). */
  presupuesto: number;
  /** Arrastre aplicado al límite: sobrante (+) o cuota de recupero (−). */
  arrastre: number;
  /** Arrastre acumulado antes de la semana. */
  acumulado: number;
  limite: number;
  /** Gasto del día a día de la semana (solo semanas cerradas). */
  gastado: number | null;
  /** Gasto ya conocido de la semana (hasta el último corte). */
  gastadoParcial: number;
  diasConDato: number;
  /** límite − gastado (positivo = te sobró). */
  diferencia: number | null;
  estado: EstadoSemana;
  /** Fracción de la semana dentro del plan (la primera puede ser parcial). */
  cobertura: number;
}

export interface Intervalo {
  desde: Corte;
  hasta: Corte;
  dias: number;
  ingresos: number;
  pagos: number;
  especiales: number;
  gasto: number;
}

export interface MonthSummary {
  mes: ISOMonth;
  plan: MonthPlan;
  ingresos: number;
  gastoSemanal: number;
  semanasCerradas: number;
  semanasTotales: number;
  /** Resúmenes de tarjeta del mes (pagados o estimados), incluidas compras especiales. */
  tarjetasTotal: number;
  especialesDirectos: number;
  especiales: number;
  /** Todo lo que consumiste en el mes: día a día + tarjetas + especiales. */
  consumo: number;
  ahorroReal: number;
  ahorroMeta: number;
  completo: boolean;
  /** Primer mes del plan (arrancó a mitad de mes): no entra en promedios. */
  parcial: boolean;
  deficitAbsorbido: number;
}

export interface EngineResult {
  hoy: ISODate;
  inicio: ISODate | null;
  ultimoCorte: Corte | null;
  meses: Record<ISOMonth, MonthPlan>;
  semanas: WeekResult[];
  actual: WeekResult | null;
  ultimaCerrada: WeekResult | null;
  /** Semanas pasadas que todavía no tienen un corte que las cierre. */
  pendientes: number;
  deficitAbsorbido: Record<ISOMonth, number>;
  intervalos: Intervalo[];
  resumenes: MonthSummary[];
}

/* -------------------------------------------------------------------------- */

const eventKey = (x: { fecha: string; creadoEn: string }) => `${x.fecha}|${x.creadoEn}`;

export const sortedCortes = (data: Data): Corte[] =>
  [...data.cortes].sort((a, b) => eventKey(a).localeCompare(eventKey(b)));

export type Saldos = Pick<Corte, "mp" | "ahorro" | "efectivo" | "usd">;

export const mesDeIngreso = (i: Ingreso): ISOMonth =>
  i.tipo !== "extra" && i.mes ? i.mes : monthOf(i.fecha);

/** Valor total en pesos de un corte (los dólares al tipo de cambio dado). */
export const valorSaldos = (s: Saldos, tc: number): number => s.mp + s.ahorro + s.efectivo + s.usd * tc;

export function planMes(data: Data, mes: ISOMonth): MonthPlan {
  const { settings } = data;
  const tc = settings.tipoCambio;
  // Sueldo y aguinaldo cuentan para el mes al que corresponden (puede caer el último día del mes anterior).
  const ing = data.ingresos.filter((i) => mesDeIngreso(i) === mes);
  const sum = (xs: { monto: number }[]) => xs.reduce((s, x) => s + x.monto, 0);

  const sueldos = ing.filter((i) => i.tipo === "sueldo");
  const sueldoEstimado = sueldos.length === 0;
  const sueldo = sueldoEstimado ? settings.sueldo : sum(sueldos);

  const aguinaldo = sum(ing.filter((i) => i.tipo === "aguinaldo"));
  const aguinaldoAhorro =
    settings.aguinaldo === "ahorro" ? aguinaldo : settings.aguinaldo === "mitad" ? Math.round(aguinaldo / 2) : 0;
  const aguinaldoPresupuesto = aguinaldo - aguinaldoAhorro;

  const extras = ing.filter((i) => i.tipo === "extra");
  const extrasSemana = sum(extras.filter((i) => i.destino === "semana"));
  const extrasAhorro = sum(extras) - extrasSemana;

  const ahorroDelSueldo =
    settings.ahorroModo === "porcentaje"
      ? Math.round(((sueldo + aguinaldoPresupuesto) * settings.ahorroPorcentaje) / 100)
      : settings.ahorroMonto;

  const bills = billsDelMes(data, mes);
  const tarjetas = bills.reduce((s, b) => s + billPresupuestoARS(b, tc), 0);
  const tarjetasPendientes = bills.filter((b) => !b.pagado).reduce((s, b) => s + billPresupuestoARS(b, tc), 0);
  const tarjetasEspeciales = bills.reduce((s, b) => s + billEspecialARS(b, tc), 0);

  const libre = sueldo + aguinaldoPresupuesto - ahorroDelSueldo - tarjetas;
  const lunes = mondaysInMonth(mes);
  return {
    mes,
    sueldo,
    sueldoEstimado,
    aguinaldo,
    aguinaldoPresupuesto,
    aguinaldoAhorro,
    extrasAhorro,
    extrasSemana,
    ahorroDelSueldo,
    ahorroMeta: ahorroDelSueldo + aguinaldoAhorro + extrasAhorro,
    tarjetas,
    tarjetasPendientes,
    tarjetasEspeciales,
    libre,
    lunes,
    base: Math.max(0, libre) / lunes.length,
    faltante: Math.max(0, -libre),
  };
}

/** Movimientos (ingresos, pagos, especiales) con clave en (desdeKey, hastaKey]. */
function flujos(data: Data, desdeKey: string, hastaKey: string | null, tcRef: number) {
  const inRange = (x: { fecha: string; creadoEn: string }) => {
    const k = eventKey(x);
    return k > desdeKey && (hastaKey === null || k <= hastaKey);
  };
  const ingresos = data.ingresos.filter(inRange).reduce((s, i) => s + i.monto, 0);
  const pagos = data.pagos.filter(inRange).reduce((s, p) => s + p.montoARS + p.montoUSD * tcRef, 0);
  const especiales = data.especiales.filter(inRange).reduce((s, e) => s + e.monto, 0);
  return { ingresos, pagos, especiales };
}

/**
 * Gasto del día a día desde `desde` hasta un saldo (`hasta`) con clave `hastaKey`.
 * Los dólares se valúan al mismo tipo de cambio en las dos puntas para que
 * una suba del dólar no aparezca como "gasto negativo".
 */
export function gastoEntre(data: Data, desde: Corte, hasta: Saldos, hastaKey: string | null, tcRef: number) {
  const f = flujos(data, eventKey(desde), hastaKey, tcRef);
  const gasto = valorSaldos(desde, tcRef) + f.ingresos - valorSaldos(hasta, tcRef) - f.pagos - f.especiales;
  return { ...f, gasto };
}

export function computeEngine(data: Data, hoy: ISODate): EngineResult {
  const cortes = sortedCortes(data);
  const meses: Record<ISOMonth, MonthPlan> = {};
  const getPlan = (mes: ISOMonth) => (meses[mes] ??= planMes(data, mes));

  if (cortes.length === 0) {
    getPlan(monthOf(hoy));
    return {
      hoy,
      inicio: null,
      ultimoCorte: null,
      meses,
      semanas: [],
      actual: null,
      ultimaCerrada: null,
      pendientes: 0,
      deficitAbsorbido: {},
      intervalos: [],
      resumenes: [],
    };
  }

  const inicio = cortes[0].fecha;
  const ultimo = cortes[cortes.length - 1];
  const ref = ultimo.fecha > hoy ? ultimo.fecha : hoy;

  // Gasto de cada intervalo entre cortes; se reparte parejo por día cuando cruza semanas.
  const intervalos: Intervalo[] = [];
  for (let i = 1; i < cortes.length; i++) {
    const a = cortes[i - 1];
    const b = cortes[i];
    const dias = Math.max(1, daysBetween(a.fecha, b.fecha));
    const r = gastoEntre(data, a, b, eventKey(b), b.tipoCambio || data.settings.tipoCambio);
    intervalos.push({ desde: a, hasta: b, dias, ...r });
  }
  const sumDiario = (desde: ISODate, hastaExcl: ISODate) => {
    let s = 0;
    for (const iv of intervalos) {
      const a = iv.desde.fecha > desde ? iv.desde.fecha : desde;
      const b = iv.hasta.fecha < hastaExcl ? iv.hasta.fecha : hastaExcl;
      if (b <= a) continue;
      const overlap = daysBetween(a, b);
      // Exacto cuando el intervalo entra entero (evita errores de redondeo de dividir por día).
      s += overlap === iv.dias ? iv.gasto : (iv.gasto * overlap) / iv.dias;
    }
    return s;
  };

  // Inyecciones al arrastre: ingresos extra "a la semana" (+) y sobrantes mandados al ahorro (−).
  const inyecciones = (desde: ISODate, hastaExcl: ISODate) => {
    const enRango = (f: string) => f >= desde && f < hastaExcl && f >= inicio;
    const extras = data.ingresos
      .filter((i) => i.tipo === "extra" && i.destino === "semana" && enRango(i.fecha))
      .reduce((s, i) => s + i.monto, 0);
    const sobrantes = data.sobrantes.filter((x) => enRango(x.fecha)).reduce((s, x) => s + x.monto, 0);
    return extras - sobrantes;
  };

  const semanas: WeekResult[] = [];
  const deficitAbsorbido: Record<ISOMonth, number> = {};
  const lunesRef = mondayOf(ref);
  let carry = 0;
  let prevMes: ISOMonth | null = null;

  for (let w = mondayOf(inicio); w <= lunesRef; w = addDaysISO(w, 7)) {
    const mes = monthOf(w);
    if (prevMes !== null && mes !== prevMes && carry < 0) {
      deficitAbsorbido[prevMes] = (deficitAbsorbido[prevMes] ?? 0) - carry;
      carry = 0;
    }
    prevMes = mes;

    const plan = getPlan(mes);
    const fin = addDaysISO(w, 7);
    const desde = w < inicio ? inicio : w;
    const cobertura = daysBetween(desde, fin) / 7;
    const presupuesto = plan.base * cobertura;

    carry += inyecciones(w, fin);
    const acumulado = carry;
    const lunesRestantes = Math.max(1, plan.lunes.filter((l) => l >= w).length);
    const arrastre = carry >= 0 ? carry : carry / lunesRestantes;
    const limite = presupuesto + arrastre;

    const base = { lunes: w, mes, presupuesto, arrastre, acumulado, limite, cobertura };
    if (ultimo.fecha >= fin) {
      const gastado = sumDiario(desde, fin);
      carry += presupuesto - gastado;
      semanas.push({
        ...base,
        gastado,
        gastadoParcial: gastado,
        diasConDato: daysBetween(desde, fin),
        diferencia: limite - gastado,
        estado: "cerrada",
      });
    } else {
      const conDato = ultimo.fecha > desde;
      const gastadoParcial = conDato ? sumDiario(desde, ultimo.fecha) : 0;
      const diasConDato = conDato ? daysBetween(desde, ultimo.fecha) : 0;
      const esActual = w === lunesRef;
      if (!esActual) carry += presupuesto - gastadoParcial;
      semanas.push({
        ...base,
        gastado: null,
        gastadoParcial,
        diasConDato,
        diferencia: null,
        estado: esActual ? "actual" : "pendiente",
      });
    }
  }

  const actual = semanas.find((s) => s.estado === "actual") ?? null;
  const cerradas = semanas.filter((s) => s.estado === "cerrada");

  // Resúmenes mensuales.
  const tc = data.settings.tipoCambio;
  const primerLunes = mondayOf(inicio);
  const mesInicio = monthOf(primerLunes);
  const resumenes: MonthSummary[] = monthRange(mesInicio, monthOf(lunesRef)).map((mes) => {
    const plan = getPlan(mes);
    const deMes = semanas.filter((s) => s.mes === mes);
    const cerr = deMes.filter((s) => s.estado === "cerrada");
    const gastoSemanal = cerr.reduce((s, x) => s + (x.gastado ?? 0), 0);
    const bills = billsDelMes(data, mes);
    const tarjetasTotal = bills.reduce((s, b) => s + billTotalARS(b, tc), 0);
    const especialesDirectos = data.especiales
      .filter((e) => monthOf(e.fecha) === mes && e.fecha >= inicio)
      .reduce((s, e) => s + e.monto, 0);
    const ingresos =
      plan.sueldo +
      plan.aguinaldo +
      data.ingresos.filter((i) => i.tipo === "extra" && monthOf(i.fecha) === mes).reduce((s, i) => s + i.monto, 0);
    const consumo = gastoSemanal + tarjetasTotal + especialesDirectos;
    const semanasTotales = plan.lunes.filter((l) => l >= primerLunes).length;
    return {
      mes,
      plan,
      ingresos,
      gastoSemanal,
      semanasCerradas: cerr.length,
      semanasTotales,
      tarjetasTotal,
      especialesDirectos,
      especiales: especialesDirectos + plan.tarjetasEspeciales,
      consumo,
      ahorroReal: ingresos - consumo,
      ahorroMeta: plan.ahorroMeta,
      completo: semanasTotales > 0 && cerr.length === semanasTotales,
      parcial: mes === mesInicio && (primerLunes > plan.lunes[0] || inicio > primerLunes),
      deficitAbsorbido: deficitAbsorbido[mes] ?? 0,
    };
  });

  return {
    hoy,
    inicio,
    ultimoCorte: ultimo,
    meses,
    semanas,
    actual,
    ultimaCerrada: cerradas.at(-1) ?? null,
    pendientes: semanas.filter((s) => s.estado === "pendiente").length,
    deficitAbsorbido,
    intervalos,
    resumenes,
  };
}

/* -------------------------------------------------------------------------- */
/*  Consultas derivadas                                                        */
/* -------------------------------------------------------------------------- */

/** "¿Cuánto me queda?": gasto desde el último corte con los saldos de ahora (no guarda nada). */
export function consultar(data: Data, engine: EngineResult, saldos: Saldos) {
  const ultimo = engine.ultimoCorte;
  const actual = engine.actual;
  if (!ultimo || !actual) return null;
  const tc = data.settings.tipoCambio;
  const r = gastoEntre(data, ultimo, saldos, null, tc);
  const restante = actual.limite - actual.gastadoParcial - r.gasto;
  return { ...r, gastoSemana: actual.gastadoParcial + r.gasto, restante, limite: actual.limite };
}

/** Plata que la reserva de gastos necesita para lo que queda del mes (a la fecha del último corte). */
export function necesidadReservaGastos(engine: EngineResult) {
  const ultimo = engine.ultimoCorte;
  const actual = engine.actual;
  if (!ultimo || !actual) return null;
  const plan = engine.meses[actual.mes];
  const restoSemana = Math.max(0, actual.limite - actual.gastadoParcial);
  const semanasQueFaltan = plan.lunes.filter((l) => l > actual.lunes).length * plan.base;
  const necesario = plan.tarjetasPendientes + restoSemana + semanasQueFaltan;
  const tenes = ultimo.mp + ultimo.efectivo;
  return { necesario, tenes, diferencia: tenes - necesario };
}
