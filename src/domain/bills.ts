import { addMonthsISO, monthOf, monthsBetween, parseDate } from "./dates";
import type { Compra, Data, ISODate, ISOMonth, Moneda, PagoTarjeta, Recurrente, Tarjeta } from "./types";

/**
 * Resumen de tarjeta = lo que se paga en un mes para una tarjeta.
 * Se arma con las cuotas de las compras + los cargos fijos (recurrentes) de ese mes.
 */

export interface BillLine {
  kind: "compra" | "recurrente";
  refId: string;
  descripcion: string;
  moneda: Moneda;
  monto: number;
  /** Cuota n de `de` (solo compras). */
  cuota?: { n: number; de: number };
  especial: boolean;
  /** Recurrente: cuántas veces vino en este resumen (1 si no se ajustó). */
  veces?: number;
}

export interface Bill {
  tarjetaId: string;
  mes: ISOMonth;
  lines: BillLine[];
  ars: number;
  usd: number;
  especialARS: number;
  especialUSD: number;
  pagos: PagoTarjeta[];
  pagado: boolean;
  pagadoARS: number;
  pagadoUSD: number;
  /** Pagos convertidos a pesos con el tipo de cambio de cada pago. */
  pagadoEquivARS: number;
  /**
   * Corrimiento de los fijos en este resumen: Σ cuota del mes × (veces − 1).
   * Positivo si vinieron cuotas de más (2 juntas), negativo si no vino ninguna.
   */
  corrimientoARS: number;
  corrimientoUSD: number;
}

export function ultimoMes(c: Pick<Compra, "primerMes" | "cuotas">): ISOMonth {
  return addMonthsISO(c.primerMes, Math.max(0, c.cuotas - 1));
}

/** Índice de cuota (1-based) que cae en `mes`, o null. */
export function cuotaEnMes(c: Pick<Compra, "primerMes" | "cuotas">, mes: ISOMonth): number | null {
  const k = monthsBetween(c.primerMes, mes);
  return k >= 0 && k < c.cuotas ? k + 1 : null;
}

/** Cuotas que faltan pagar contando `desdeMes` inclusive. */
export function cuotasRestantes(c: Pick<Compra, "primerMes" | "cuotas">, desdeMes: ISOMonth): number {
  const k = monthsBetween(c.primerMes, desdeMes);
  if (k <= 0) return c.cuotas;
  return Math.max(0, c.cuotas - k);
}

export function recurrenteActivo(r: Recurrente, mes: ISOMonth): boolean {
  return r.desdeMes <= mes && (!r.hastaMes || mes <= r.hastaMes);
}

export function vecesRecurrente(r: Recurrente, mes: ISOMonth): number {
  const v = r.veces?.[mes];
  return typeof v === "number" && v >= 0 ? v : 1;
}

/**
 * Monto de UNA cuota del fijo en `mes`: el anotado para ese mes; si no hay, el del último mes
 * anotado antes (es la mejor estimación); si no hay ninguno, el monto base.
 */
export function cuotaRecurrente(r: Recurrente, mes: ISOMonth): number {
  const montos = r.montos ?? {};
  if (typeof montos[mes] === "number") return montos[mes];
  let previo: ISOMonth | null = null;
  for (const m of Object.keys(montos)) if (m < mes && (previo === null || m > previo)) previo = m;
  return previo !== null ? montos[previo] : r.monto;
}

/** El monto de ese mes está anotado (no es estimado). */
export const tieneMontoDelMes = (r: Recurrente, mes: ISOMonth): boolean => typeof r.montos?.[mes] === "number";

/**
 * Anota (o borra, con null) el monto real de una cuota en un mes. Los demás meses no cambian;
 * el monto base pasa a ser el del último mes anotado (estimado para lo que viene).
 */
export function conMontoDelMes(r: Recurrente, mes: ISOMonth, monto: number | null): Recurrente {
  const montos = { ...(r.montos ?? {}) };
  if (monto == null) delete montos[mes];
  else montos[mes] = monto;
  const ultimo = Object.keys(montos).sort().at(-1);
  return { ...r, montos, monto: ultimo ? montos[ultimo] : r.monto };
}

export function billLines(data: Data, tarjetaId: string, mes: ISOMonth): BillLine[] {
  const lines: BillLine[] = [];
  for (const r of data.recurrentes) {
    if (r.tarjetaId !== tarjetaId || !recurrenteActivo(r, mes)) continue;
    const veces = vecesRecurrente(r, mes);
    const cuota = cuotaRecurrente(r, mes);
    if (veces === 0 || cuota <= 0) continue;
    lines.push({
      kind: "recurrente",
      refId: r.id,
      descripcion: r.descripcion,
      moneda: r.moneda,
      monto: cuota * veces,
      especial: false,
      veces,
    });
  }
  for (const c of data.compras) {
    if (c.tarjetaId !== tarjetaId) continue;
    const n = cuotaEnMes(c, mes);
    if (n == null) continue;
    lines.push({
      kind: "compra",
      refId: c.id,
      descripcion: c.descripcion,
      moneda: c.moneda,
      monto: c.montoCuota,
      cuota: { n, de: c.cuotas },
      especial: c.especial,
    });
  }
  lines.sort((a, b) => (a.kind === b.kind ? b.monto - a.monto : a.kind === "recurrente" ? -1 : 1));
  return lines;
}

export function bill(data: Data, tarjetaId: string, mes: ISOMonth): Bill {
  const lines = billLines(data, tarjetaId, mes);
  const pagos = data.pagos.filter((p) => p.tarjetaId === tarjetaId && p.mes === mes);
  const sum = (moneda: Moneda, especial?: boolean) =>
    lines
      .filter((l) => l.moneda === moneda && (especial === undefined || l.especial === especial))
      .reduce((s, l) => s + l.monto, 0);
  const corrimiento = (moneda: Moneda) =>
    data.recurrentes
      .filter((r) => r.tarjetaId === tarjetaId && r.moneda === moneda && recurrenteActivo(r, mes))
      .reduce((s, r) => s + cuotaRecurrente(r, mes) * (vecesRecurrente(r, mes) - 1), 0);
  return {
    tarjetaId,
    mes,
    lines,
    ars: sum("ARS"),
    usd: sum("USD"),
    especialARS: sum("ARS", true),
    especialUSD: sum("USD", true),
    pagos,
    pagado: pagos.length > 0,
    pagadoARS: pagos.reduce((s, p) => s + p.montoARS, 0),
    pagadoUSD: pagos.reduce((s, p) => s + p.montoUSD, 0),
    pagadoEquivARS: pagos.reduce((s, p) => s + p.montoARS + p.montoUSD * p.tipoCambio, 0),
    corrimientoARS: corrimiento("ARS"),
    corrimientoUSD: corrimiento("USD"),
  };
}

/** Resúmenes de un mes: tarjetas con cuotas, fijos (aunque ese mes no hayan venido) o pagos. */
export function billsDelMes(data: Data, mes: ISOMonth): Bill[] {
  return data.tarjetas
    .map((t) => bill(data, t.id, mes))
    .filter((b) => b.lines.length > 0 || b.pagos.length > 0 || b.corrimientoARS !== 0 || b.corrimientoUSD !== 0);
}

export const billEstimadoARS = (b: Bill, tc: number): number => b.ars + b.usd * tc;

/** Lo que salió (si está pagado) o lo que se estima que va a salir. */
export const billTotalARS = (b: Bill, tc: number): number =>
  b.pagado ? b.pagadoEquivARS : billEstimadoARS(b, tc);

export const billEspecialARS = (b: Bill, tc: number): number => b.especialARS + b.especialUSD * tc;

/**
 * Parte del resumen que sale del presupuesto del mes: lo pagado (o estimado), sin las compras
 * especiales (salen del ahorro) y con los fijos contados una vez por mes (sin corrimientos).
 */
export const billPresupuestoARS = (b: Bill, tc: number): number =>
  Math.max(0, billTotalARS(b, tc) - billEspecialARS(b, tc) - (b.corrimientoARS + b.corrimientoUSD * tc));

function clampDay(year: number, month0: number, day: number): Date {
  const last = new Date(year, month0 + 1, 0).getDate();
  return new Date(year, month0, Math.min(day, last));
}

/**
 * Mes en que se paga la primera cuota de una compra hecha en `fecha`.
 * Con cierre y vencimiento: la compra entra en el próximo cierre y se paga en el vencimiento siguiente.
 * Sin datos de la tarjeta: el mes siguiente.
 */
export function sugerirPrimerMes(t: Pick<Tarjeta, "cierreDia" | "vencimientoDia"> | undefined, fecha: ISODate): ISOMonth {
  const d = parseDate(fecha);
  if (!t?.cierreDia) return addMonthsISO(monthOf(fecha), 1);
  let cierre = clampDay(d.getFullYear(), d.getMonth(), t.cierreDia);
  if (d > cierre) cierre = clampDay(d.getFullYear(), d.getMonth() + 1, t.cierreDia);
  const venceDia = t.vencimientoDia ?? Math.min(28, t.cierreDia + 10);
  let vence = clampDay(cierre.getFullYear(), cierre.getMonth(), venceDia);
  if (vence <= cierre) vence = clampDay(cierre.getFullYear(), cierre.getMonth() + 1, venceDia);
  return `${vence.getFullYear()}-${String(vence.getMonth() + 1).padStart(2, "0")}`;
}
