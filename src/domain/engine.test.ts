import { describe, expect, it } from "vitest";

import { describe as describirAccion, reduce } from "./actions";
import {
  bill,
  billPresupuestoARS,
  billsDelMes,
  conMontoDelMes,
  cuotaRecurrente,
  cuotasRestantes,
  sugerirPrimerMes,
  tieneMontoDelMes,
} from "./bills";
import { mondaysInMonth, weekRangeLabel } from "./dates";
import { emptyData, normalizeData } from "./defaults";
import { computeEngine, consultar, necesidadReservaGastos, planMes } from "./engine";
import { computeMetrics, projectGoal } from "./metrics";
import type { Compra, Corte, Data, GastoEspecial, Ingreso, PagoTarjeta, PaseAlAhorro, Recurrente, Tarjeta } from "./types";

/* ------------------------------- helpers ------------------------------- */

const $ = (pesos: number) => pesos * 100;
let seq = 0;
/** Timestamps crecientes: dentro de una misma fecha, lo creado después queda después. */
const ts = (fecha: string) => {
  const n = seq++;
  return `${fecha}T12:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}.000Z`;
};

function base(settings: Partial<Data["settings"]> = {}): Data {
  const d = emptyData(new Date("2026-10-01T12:00:00"));
  d.settings = { ...d.settings, sueldo: $(2_000_000), ahorroPorcentaje: 20, tipoCambio: 1500, ...settings };
  return d;
}

const corte = (fecha: string, mp: number, extra: Partial<Corte> = {}): Corte => ({
  id: `c-${fecha}`,
  fecha,
  mp: $(mp),
  ahorro: 0,
  efectivo: 0,
  usd: 0,
  tipoCambio: 1500,
  creadoEn: ts(fecha),
  ...extra,
});

const sueldo = (fecha: string, pesos: number): Ingreso => ({
  id: `s-${fecha}`,
  fecha,
  monto: $(pesos),
  tipo: "sueldo",
  creadoEn: ts(fecha),
});

const visa: Tarjeta = { id: "visa", nombre: "Visa", color: "#f00", cierreDia: 10, vencimientoDia: 20, creadoEn: "x" };

const compra = (p: Partial<Compra> & Pick<Compra, "primerMes" | "montoCuota">): Compra => ({
  id: `k-${seq++}`,
  tarjetaId: "visa",
  descripcion: "compra",
  moneda: "ARS",
  cuotas: 1,
  especial: false,
  creadoEn: "x",
  ...p,
});

const pago = (fecha: string, mes: string, pesos: number): PagoTarjeta => ({
  id: `p-${fecha}`,
  tarjetaId: "visa",
  mes,
  fecha,
  montoARS: $(pesos),
  montoUSD: 0,
  tipoCambio: 1500,
  creadoEn: ts(fecha),
});

const pase = (fecha: string, pesos: number): PaseAlAhorro => ({
  id: `a-${fecha}-${pesos}`,
  fecha,
  monto: $(pesos),
  creadoEn: ts(fecha),
});

const especial = (fecha: string, pesos: number): GastoEspecial => ({
  id: `e-${fecha}`,
  fecha,
  monto: $(pesos),
  descripcion: "regalo",
  creadoEn: ts(fecha),
});

/** Octubre 2026 tiene 4 lunes (5, 12, 19, 26). Sueldo 2M, ahorro 20% → libre 1,6M → base 400K/semana. */
function octubre(mps: [string, number][], extra: (d: Data) => void = () => {}): Data {
  const d = base();
  d.ingresos.push(sueldo("2026-10-01", 2_000_000));
  for (const [f, mp] of mps) d.cortes.push(corte(f, mp));
  extra(d);
  return d;
}

/* -------------------------------- fechas -------------------------------- */

describe("fechas", () => {
  it("cuenta los lunes de cada mes", () => {
    expect(mondaysInMonth("2026-10")).toEqual(["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
    expect(mondaysInMonth("2026-11")).toHaveLength(5);
  });
  it("arma rangos de semana legibles", () => {
    expect(weekRangeLabel("2026-10-12")).toBe("12 al 18 oct");
    expect(weekRangeLabel("2026-09-28")).toBe("28 sep al 4 oct");
  });
});

/* --------------------------------- plan --------------------------------- */

describe("plan del mes", () => {
  it("separa el ahorro primero y reparte el resto en los lunes del mes", () => {
    const p = planMes(octubre([]), "2026-10");
    expect(p.ahorroDelSueldo).toBe($(400_000));
    expect(p.libre).toBe($(1_600_000));
    expect(p.base).toBe($(400_000));
    expect(p.sueldoEstimado).toBe(false);
  });

  it("usa el sueldo estimado si el del mes no está cargado", () => {
    const p = planMes(base({ sueldo: $(1_000_000) }), "2026-11");
    expect(p.sueldoEstimado).toBe(true);
    expect(p.libre).toBe($(800_000));
    expect(p.base).toBe($(160_000)); // noviembre tiene 5 lunes
  });

  it("resta los resúmenes de tarjeta del mes antes de presupuestar", () => {
    const d = octubre([], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(300_000) }));
    });
    const p = planMes(d, "2026-10");
    expect(p.tarjetas).toBe($(300_000));
    expect(p.base).toBe($(325_000));
  });

  it("si tarjetas + ahorro superan el sueldo, la base queda en 0 y registra el faltante", () => {
    const d = octubre([], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(1_800_000) }));
    });
    const p = planMes(d, "2026-10");
    expect(p.base).toBe(0);
    expect(p.faltante).toBe($(200_000));
  });

  it("aguinaldo: como sueldo, mitad o todo al ahorro", () => {
    const conAguinaldo = (destino: Data["settings"]["aguinaldo"]) => {
      const d = octubre([]);
      d.settings.aguinaldo = destino;
      d.ingresos.push({ id: "ag", fecha: "2026-10-01", monto: $(1_000_000), tipo: "aguinaldo", creadoEn: "x" });
      return planMes(d, "2026-10");
    };
    const pres = conAguinaldo("presupuesto");
    expect(pres.ahorroDelSueldo).toBe($(600_000)); // 20% de 3M
    expect(pres.libre).toBe($(2_400_000));
    const mitad = conAguinaldo("mitad");
    expect(mitad.aguinaldoAhorro).toBe($(500_000));
    expect(mitad.libre).toBe($(2_000_000)); // 2,5M − 20%
    const todo = conAguinaldo("ahorro");
    expect(todo.libre).toBe($(1_600_000));
    expect(todo.ahorroMeta).toBe($(1_400_000));
  });

  it("el sueldo cobrado a fin de mes cuenta para el mes al que corresponde", () => {
    const d = base();
    d.ingresos.push({ ...sueldo("2026-05-29", 1_000_000), mes: "2026-06" });
    expect(planMes(d, "2026-05").sueldoEstimado).toBe(true);
    const jun = planMes(d, "2026-06");
    expect(jun.sueldoEstimado).toBe(false);
    expect(jun.sueldo).toBe($(1_000_000));
  });

  it("modo monto fijo", () => {
    const d = octubre([]);
    d.settings.ahorroModo = "monto";
    d.settings.ahorroMonto = $(500_000);
    expect(planMes(d, "2026-10").base).toBe($(375_000));
  });
});

/* ------------------------------- semanas ------------------------------- */

describe("gasto semanal y arrastre", () => {
  it("mide el gasto con el corte y suma TODO el sobrante a la semana siguiente", () => {
    const e = computeEngine(
      octubre([
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 1_250_000], // gastó 350K de 400K → sobran 50K
        ["2026-10-19", 800_000], // gastó 450K de 450K
      ]),
      "2026-10-20",
    );
    const [s1, s2, s3] = e.semanas;
    expect(s1.gastado).toBe($(350_000));
    expect(s1.diferencia).toBe($(50_000));
    expect(s2.limite).toBe($(450_000));
    expect(s2.gastado).toBe($(450_000));
    expect(s3.estado).toBe("actual");
    expect(s3.limite).toBe($(400_000));
    expect(e.actual?.lunes).toBe("2026-10-19");
  });

  it("el sobrante se sigue acumulando semana a semana", () => {
    const e = computeEngine(
      octubre([
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 1_300_000], // 300K → +100K
        ["2026-10-19", 1_000_000], // 300K de 500K → +200K
      ]),
      "2026-10-19",
    );
    expect(e.actual?.limite).toBe($(600_000));
    expect(e.actual?.acumulado).toBe($(200_000));
  });

  it("pagar la tarjeta NO es gasto: no hay pico en la semana del pago", () => {
    const d = octubre(
      [
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 1_300_000],
        ["2026-10-19", 750_000], // bajó 550K, pero 300K fueron el pago de la Visa
      ],
      (d) => {
        d.tarjetas.push(visa);
        d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(300_000) }));
        d.pagos.push(pago("2026-10-15", "2026-10", 300_000));
      },
    );
    const e = computeEngine(d, "2026-10-19");
    expect(e.semanas[1].gastado).toBe($(250_000));
    expect(e.semanas[1].presupuesto).toBe($(325_000));
  });

  it("si te pasás, el déficit se reparte entre las semanas que quedan del mes", () => {
    const e = computeEngine(
      octubre([
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 900_000], // gastó 700K (300K de más)
        ["2026-10-19", 600_000], // gastó 300K = su límite
        ["2026-10-26", 300_000], // gastó 300K = su límite
      ]),
      "2026-10-26",
    );
    const [, s2, s3, s4] = e.semanas;
    expect(s2.limite).toBe($(300_000)); // 400K − 300K/3
    expect(s3.limite).toBe($(300_000)); // 400K − 200K/2
    expect(s4.limite).toBe($(300_000)); // 400K − 100K/1
    expect(s4.estado).toBe("actual");
  });

  it("un déficit sin recuperar se absorbe al cambiar de mes: noviembre arranca limpio", () => {
    const d = octubre([
      ["2026-10-05", 1_600_000],
      ["2026-10-12", 900_000], // −300K
      ["2026-10-19", 600_000],
      ["2026-10-26", 300_000],
    ]);
    // Semana 26/10–1/11: límite 300K, gastó 400K. Cobra noviembre el lunes 2, antes del corte.
    d.ingresos.push({ ...sueldo("2026-11-02", 2_000_000), creadoEn: "2026-11-02T08:00:00.000Z" });
    d.cortes.push({ ...corte("2026-11-02", 1_900_000), creadoEn: "2026-11-02T09:00:00.000Z" });
    const e = computeEngine(d, "2026-11-02");
    expect(e.semanas.find((s) => s.lunes === "2026-10-26")?.gastado).toBe($(400_000));
    expect(e.deficitAbsorbido["2026-10"]).toBe($(100_000));
    expect(e.actual?.lunes).toBe("2026-11-02");
    expect(e.actual?.arrastre).toBe(0);
    expect(e.actual?.limite).toBe($(320_000)); // 1,6M / 5 lunes
  });

  it("un sobrante sí cruza de mes", () => {
    const d = octubre([
      ["2026-10-05", 1_600_000],
      ["2026-10-12", 1_200_000],
      ["2026-10-19", 800_000],
      ["2026-10-26", 400_000],
      ["2026-11-02", 100_000], // última de octubre: 300K de 400K → +100K
    ]);
    const e = computeEngine(d, "2026-11-02");
    expect(e.actual?.lunes).toBe("2026-11-02");
    expect(e.actual?.limite).toBe($(420_000)); // 320K base nov + 100K
  });

  it("si salteás un lunes, el gasto se reparte parejo entre las dos semanas", () => {
    const e = computeEngine(
      octubre([
        ["2026-10-05", 1_600_000],
        ["2026-10-19", 900_000], // 700K en 14 días
      ]),
      "2026-10-19",
    );
    expect(e.semanas[0].gastado).toBeCloseTo($(350_000), 6);
    expect(e.semanas[1].gastado).toBeCloseTo($(350_000), 6);
  });

  it("semana pasada sin corte queda pendiente y su presupuesto sigue disponible", () => {
    const e = computeEngine(
      octubre([
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 1_200_000],
      ]),
      "2026-10-21",
    );
    expect(e.pendientes).toBe(1);
    expect(e.actual?.lunes).toBe("2026-10-19");
    expect(e.actual?.limite).toBe($(800_000)); // 400K esta semana + 400K de la pendiente
  });

  it("el primer corte a mitad de semana prorratea el presupuesto", () => {
    const e = computeEngine(octubre([["2026-10-13", 1_600_000]]), "2026-10-13");
    expect(e.actual?.cobertura).toBeCloseTo(6 / 7, 10);
    expect(e.actual?.limite).toBeCloseTo($(400_000) * (6 / 7), 6);
  });

  it("los gastos especiales no cuentan para la semana pero sí bajan el ahorro del mes", () => {
    const d = octubre(
      [
        ["2026-10-05", 1_600_000],
        ["2026-10-12", 800_000], // bajó 800K: 500K fueron un regalo especial
      ],
      (d) => d.especiales.push(especial("2026-10-10", 500_000)),
    );
    const e = computeEngine(d, "2026-10-12");
    expect(e.semanas[0].gastado).toBe($(300_000));
    expect(e.resumenes[0].especiales).toBe($(500_000));
  });

  it("los dólares se valúan al mismo tipo de cambio en las dos puntas", () => {
    const d = octubre([], (d) => {
      d.settings.usaDolares = true;
      d.cortes.push(corte("2026-10-05", 1_000_000, { usd: 100_00, tipoCambio: 1500 }));
      d.cortes.push(corte("2026-10-12", 1_000_000, { usd: 100_00, tipoCambio: 1600 }));
    });
    expect(computeEngine(d, "2026-10-12").semanas[0].gastado).toBe(0);
  });

  it("ingreso extra a la semana suma al límite; mandar sobrante al ahorro lo resta", () => {
    const d = octubre([["2026-10-05", 1_600_000]], (d) => {
      d.ingresos.push({ id: "x", fecha: "2026-10-07", monto: $(50_000), tipo: "extra", destino: "semana", creadoEn: "x" });
    });
    expect(computeEngine(d, "2026-10-08").actual?.limite).toBe($(450_000));
    d.sobrantes.push({ id: "s", fecha: "2026-10-08", monto: $(30_000), creadoEn: "x" });
    expect(computeEngine(d, "2026-10-08").actual?.limite).toBe($(420_000));
  });

  it("los movimientos cargados en el mismo flujo del corte quedan antes del corte", () => {
    // Primer corte el martes, después de pagar la tarjeta ese mismo día: no debe contarse en ningún intervalo.
    const d = octubre([], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(300_000) }));
      d.pagos.push({ ...pago("2026-10-13", "2026-10", 300_000), creadoEn: "2026-10-13T10:00:00.000Z" });
      d.cortes.push({ ...corte("2026-10-13", 1_000_000), creadoEn: "2026-10-13T10:00:01.000Z" });
      d.cortes.push(corte("2026-10-19", 800_000));
    });
    const e = computeEngine(d, "2026-10-19");
    expect(e.intervalos[0].pagos).toBe(0);
    expect(e.intervalos[0].gasto).toBe($(200_000));
  });
});

/* ------------------------------- consultas ------------------------------- */

describe("consultas", () => {
  it("¿cuánto me queda? descuenta lo gastado desde el último corte", () => {
    const d = octubre([["2026-10-12", 1_200_000]]);
    const e = computeEngine(d, "2026-10-15");
    const r = consultar(d, e, { mp: $(1_050_000), ahorro: 0, efectivo: 0, usd: 0 });
    expect(r?.gasto).toBe($(150_000));
    expect(r?.restante).toBe($(250_000));
  });

  it("necesidad de la reserva de gastos para cubrir el mes", () => {
    const d = octubre([["2026-10-12", 1_000_000]], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(200_000) }));
    });
    const e = computeEngine(d, "2026-10-12");
    // base = (1,6M − 200K)/4 = 350K; quedan esta semana + 2 lunes (19, 26) + tarjeta pendiente 200K
    const r = necesidadReservaGastos(d, e)!;
    expect(r.necesario).toBe($(350_000 * 3 + 200_000));
    expect(r.diferencia).toBe($(1_000_000 - 1_250_000));
  });
});

/* -------------------------- reservas y "Ahorrar" -------------------------- */

describe("reservas y pases al ahorro", () => {
  it("ahorrar no es gasto ni toca el límite: solo mueve los saldos hasta el próximo corte", () => {
    const d = octubre([], (d) => d.cortes.push(corte("2026-10-05", 1_200_000, { ahorro: $(400_000) })));
    const antes = computeEngine(d, "2026-10-07");
    d.pases.push(pase("2026-10-07", 300_000));
    const e = computeEngine(d, "2026-10-07");
    expect(e.actual?.limite).toBe(antes.actual?.limite);
    expect(e.reservas).toEqual({ gastos: $(900_000), ahorro: $(700_000), pasado: $(300_000), especiales: 0, fecha: "2026-10-07" });

    // El lunes el corte trae los saldos reales: gastó 100K (el pase no cuenta) y el corte vuelve a mandar.
    d.cortes.push(corte("2026-10-12", 800_000, { ahorro: $(700_000) }));
    const e2 = computeEngine(d, "2026-10-12");
    expect(e2.intervalos.at(-1)?.gasto).toBe($(100_000));
    expect(e2.reservas).toEqual({ gastos: $(800_000), ahorro: $(700_000), pasado: 0, especiales: 0, fecha: "2026-10-12" });
  });

  it("lo que pasás al ahorro baja lo que sobra en gastos", () => {
    const d = octubre([["2026-10-12", 1_500_000]]);
    // base 400K: quedan esta semana + 2 lunes = 1,2M → sobran 300K
    expect(necesidadReservaGastos(d, computeEngine(d, "2026-10-13"))!.diferencia).toBe($(300_000));
    d.pases.push(pase("2026-10-13", 290_000));
    const r = necesidadReservaGastos(d, computeEngine(d, "2026-10-13"))!;
    expect(r.tenes).toBe($(1_210_000));
    expect(r.diferencia).toBe($(10_000));
    expect(r.paraAhorrar).toBe($(10_000));
  });

  it("sacar del ahorro sube gastos y baja ahorro, sin ser gasto ni tocar el límite: tapa lo que falta", () => {
    const d = octubre([], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(200_000) }));
      d.cortes.push(corte("2026-10-12", 1_000_000, { ahorro: $(500_000) }));
    });
    // base 350K: necesita 3 semanas + la tarjeta = 1,25M → faltan 250K
    const antes = computeEngine(d, "2026-10-13");
    expect(necesidadReservaGastos(d, antes)!.diferencia).toBe($(-250_000));
    expect(necesidadReservaGastos(d, antes)!.paraSacar).toBe($(250_000));
    d.pases.push(pase("2026-10-13", -250_000));
    const e = computeEngine(d, "2026-10-13");
    expect(e.reservas).toEqual({ gastos: $(1_250_000), ahorro: $(250_000), pasado: $(-250_000), especiales: 0, fecha: "2026-10-13" });
    expect(e.actual?.limite).toBe(antes.actual?.limite);
    expect(necesidadReservaGastos(d, e)!.diferencia).toBe(0);

    // El lunes gastó justo el límite (350K): el pase no cuenta como gasto.
    d.cortes.push(corte("2026-10-19", 900_000, { ahorro: $(250_000) }));
    expect(computeEngine(d, "2026-10-19").intervalos.at(-1)?.gasto).toBe($(350_000));
  });

  it("un gasto especial cargado después del corte sale de la reserva de gastos y de lo que sobra", () => {
    const d = octubre([["2026-10-12", 1_500_000]], (d) => d.especiales.push(especial("2026-10-10", 50_000)));
    const antes = computeEngine(d, "2026-10-14");
    expect(necesidadReservaGastos(d, antes)!.diferencia).toBe($(300_000)); // el especial de antes del corte ya está en el saldo
    d.especiales.push(especial("2026-10-14", 300_000));
    const e = computeEngine(d, "2026-10-14");
    expect(e.reservas).toEqual({ gastos: $(1_200_000), ahorro: 0, pasado: 0, especiales: $(300_000), fecha: "2026-10-14" });
    expect(e.actual?.limite).toBe(antes.actual?.limite);
    expect(necesidadReservaGastos(d, e)!.diferencia).toBe(0);
  });

  it("mandar el sobrante al ahorro también mueve los saldos, y lo que sobra en gastos no cambia", () => {
    const d = octubre([
      ["2026-10-05", 1_600_000],
      ["2026-10-12", 1_300_000], // gastó 300K de 400K: 100K de sobrante para esta semana
    ]);
    const antes = necesidadReservaGastos(d, computeEngine(d, "2026-10-13"))!;
    d.sobrantes.push({ id: "s", fecha: "2026-10-13", monto: $(100_000), creadoEn: ts("2026-10-13") });
    const e = computeEngine(d, "2026-10-13");
    expect(e.reservas?.gastos).toBe($(1_200_000));
    expect(e.reservas?.ahorro).toBe($(100_000));
    expect(necesidadReservaGastos(d, e)!.diferencia).toBe(antes.diferencia);
  });

  it("pagar una tarjeta después del corte no cambia lo que sobra hasta el próximo corte", () => {
    const d = octubre([["2026-10-12", 1_000_000]], (d) => {
      d.tarjetas.push(visa);
      d.compras.push(compra({ primerMes: "2026-10", montoCuota: $(200_000) }));
    });
    const antes = necesidadReservaGastos(d, computeEngine(d, "2026-10-14"))!;
    d.pagos.push(pago("2026-10-14", "2026-10", 200_000));
    const r = necesidadReservaGastos(d, computeEngine(d, "2026-10-14"))!;
    expect(r.necesario).toBe(antes.necesario);
    expect(r.diferencia).toBe($(1_000_000 - 1_250_000));
  });

  it("si en el corte ya está el sueldo del mes que viene, lo que sobra es el ahorro de ese mes", () => {
    // Noviembre tiene 5 lunes (2 al 30) → base 1,6M / 5 = 320K. La semana del 30 es de noviembre.
    const d = base();
    d.ingresos.push(sueldo("2026-11-02", 2_000_000));
    d.ingresos.push({ ...sueldo("2026-11-30", 2_000_000), mes: "2026-12" }); // diciembre, cobrado antes del corte
    d.cortes.push(corte("2026-11-30", 2_400_000));
    const r = necesidadReservaGastos(d, computeEngine(d, "2026-11-30"))!;
    // Necesita lo que queda de la semana (320K) + todo diciembre (2M − 20% de ahorro = 1,6M).
    expect(r.mesQueViene).toEqual({ mes: "2026-12", monto: $(1_600_000) });
    expect(r.necesario).toBe($(320_000 + 1_600_000));
    expect(r.diferencia).toBe($(480_000)); // 400K de ahorro de diciembre + 80K que quedó de noviembre
  });

  it("sin reserva de ahorro aparte no hay pases que aplicar", () => {
    const d = octubre([["2026-10-05", 1_600_000]], (d) => (d.settings.usaReservaAhorro = false));
    d.pases.push(pase("2026-10-06", 100_000));
    expect(computeEngine(d, "2026-10-06").reservas).toEqual({ gastos: $(1_600_000), ahorro: 0, pasado: 0, especiales: 0, fecha: "2026-10-05" });
  });
});

/* ------------------------------- tarjetas ------------------------------- */

describe("fijos con monto por mes (ej: la cuota del Fiat)", () => {
  const fiat = (): Recurrente => ({
    id: "fiat",
    tarjetaId: "visa",
    descripcion: "Plan Fiat",
    moneda: "ARS",
    monto: $(400_000),
    montos: { "2026-10": $(400_000) },
    desdeMes: "2026-10",
    veces: {},
    creadoEn: "x",
  });

  it("usa el monto anotado del mes; si no hay, el último anotado antes; si no, el base", () => {
    const r = { ...fiat(), montos: { "2026-10": $(400_000), "2026-12": $(420_000) } };
    expect(cuotaRecurrente(r, "2026-10")).toBe($(400_000));
    expect(cuotaRecurrente(r, "2026-11")).toBe($(400_000));
    expect(cuotaRecurrente(r, "2026-12")).toBe($(420_000));
    expect(cuotaRecurrente(r, "2027-03")).toBe($(420_000));
    expect(cuotaRecurrente({ ...fiat(), montos: undefined }, "2026-11")).toBe($(400_000));
  });

  it("anotar el monto de un mes no cambia los meses anteriores y actualiza el estimado", () => {
    const r = conMontoDelMes(fiat(), "2026-11", $(412_000));
    expect(cuotaRecurrente(r, "2026-10")).toBe($(400_000));
    expect(cuotaRecurrente(r, "2026-11")).toBe($(412_000));
    expect(cuotaRecurrente(r, "2027-01")).toBe($(412_000));
    expect(r.monto).toBe($(412_000));
    expect(tieneMontoDelMes(r, "2026-11")).toBe(true);
    expect(tieneMontoDelMes(r, "2026-12")).toBe(false);
  });

  it("corregir un mes viejo no pisa el estimado de los que vienen", () => {
    const r = conMontoDelMes(conMontoDelMes(fiat(), "2026-11", $(412_000)), "2026-10", $(401_000));
    expect(cuotaRecurrente(r, "2026-10")).toBe($(401_000));
    expect(r.monto).toBe($(412_000));
  });

  it("borrar el monto de un mes vuelve al estimado", () => {
    const r = conMontoDelMes(conMontoDelMes(fiat(), "2026-11", $(412_000)), "2026-11", null);
    expect(cuotaRecurrente(r, "2026-11")).toBe($(400_000));
    expect(r.monto).toBe($(400_000));
  });

  it("el resumen usa el monto del mes, y con 2 cuotas juntas el presupuesto cuenta una (la de ese mes)", () => {
    const d = base();
    d.tarjetas.push(visa);
    d.recurrentes.push({ ...conMontoDelMes(fiat(), "2026-11", $(412_000)), veces: { "2026-11": 2 } });
    const nov = bill(d, "visa", "2026-11");
    expect(nov.ars).toBe($(824_000));
    expect(billPresupuestoARS(nov, 1500)).toBe($(412_000));
    expect(planMes(d, "2026-12").tarjetas).toBe($(412_000));
  });
});

describe("resúmenes de tarjeta", () => {
  const data = (): Data => {
    const d = base();
    d.tarjetas.push(visa);
    d.compras.push(compra({ id: "zap", descripcion: "Zapatillas", primerMes: "2026-10", montoCuota: $(30_000), cuotas: 3 }));
    d.compras.push(compra({ id: "reg", descripcion: "Regalo", primerMes: "2026-11", montoCuota: $(50_000), especial: true }));
    d.compras.push(compra({ id: "sub", descripcion: "Claude", primerMes: "2026-11", montoCuota: 20_00, moneda: "USD" }));
    const fiat: Recurrente = {
      id: "fiat",
      tarjetaId: "visa",
      descripcion: "Plan auto",
      moneda: "ARS",
      monto: $(400_000),
      desdeMes: "2026-10",
      veces: { "2026-12": 2, "2027-01": 0 },
      creadoEn: "x",
    };
    d.recurrentes.push(fiat);
    return d;
  };

  it("arma las líneas con número de cuota y recurrentes", () => {
    const b = bill(data(), "visa", "2026-11");
    expect(b.lines.map((l) => l.descripcion)).toEqual(["Plan auto", "Regalo", "Zapatillas", "Claude"]);
    expect(b.lines.find((l) => l.refId === "zap")?.cuota).toEqual({ n: 2, de: 3 });
    expect(b.ars).toBe($(480_000));
    expect(b.usd).toBe(20_00);
    expect(b.especialARS).toBe($(50_000));
  });

  it("las compras especiales no salen del presupuesto y el USD se convierte", () => {
    const b = bill(data(), "visa", "2026-11");
    expect(billPresupuestoARS(b, 1500)).toBe($(430_000 + 30_000)); // 480K − 50K especial + US$20×1500
  });

  it("dos cuotas del fijo en un resumen: la caja las muestra, el presupuesto cuenta una por mes", () => {
    const d = data();
    const dic = bill(d, "visa", "2026-12");
    expect(dic.ars).toBe($(830_000));
    expect(dic.lines.find((l) => l.refId === "fiat")?.veces).toBe(2);
    expect(billPresupuestoARS(dic, 1500)).toBe($(430_000));
    // Enero no vino ninguna: igual se presupuesta una.
    const [ene] = billsDelMes(d, "2027-01");
    expect(ene.lines).toHaveLength(0);
    expect(billPresupuestoARS(ene, 1500)).toBe($(400_000));
    expect(planMes(d, "2027-01").tarjetas).toBe($(400_000));
  });

  it("si está pagado, el presupuesto usa lo que realmente salió", () => {
    const d = data();
    d.pagos.push({ ...pago("2026-11-20", "2026-11", 520_000), montoUSD: 20_00 });
    const b = bill(d, "visa", "2026-11");
    expect(b.pagado).toBe(true);
    expect(billPresupuestoARS(b, 1500)).toBe($(520_000 + 30_000 - 50_000));
  });

  it("cuotas restantes", () => {
    const c = compra({ primerMes: "2026-10", montoCuota: 1, cuotas: 6 });
    expect(cuotasRestantes(c, "2026-09")).toBe(6);
    expect(cuotasRestantes(c, "2026-12")).toBe(4);
    expect(cuotasRestantes(c, "2027-05")).toBe(0);
  });

  it("solo lista tarjetas con movimiento en el mes", () => {
    const d = data();
    d.tarjetas.push({ ...visa, id: "mp", nombre: "MP" });
    expect(billsDelMes(d, "2026-11").map((b) => b.tarjetaId)).toEqual(["visa"]);
  });

  it("sugiere el mes de la primera cuota según cierre y vencimiento", () => {
    expect(sugerirPrimerMes({ cierreDia: 10, vencimientoDia: 20 }, "2026-10-05")).toBe("2026-10");
    expect(sugerirPrimerMes({ cierreDia: 10, vencimientoDia: 20 }, "2026-10-15")).toBe("2026-11");
    expect(sugerirPrimerMes({ cierreDia: 25, vencimientoDia: 5 }, "2026-10-20")).toBe("2026-11");
    expect(sugerirPrimerMes({ cierreDia: 25, vencimientoDia: 5 }, "2026-10-27")).toBe("2026-12");
    expect(sugerirPrimerMes(undefined, "2026-10-27")).toBe("2026-11");
  });
});

/* ------------------------------ resúmenes ------------------------------ */

describe("resumen mensual y métricas", () => {
  function dosMeses(): Data {
    const d = octubre([
      ["2026-10-05", 1_600_000],
      ["2026-10-12", 1_250_000],
      ["2026-10-19", 900_000],
      ["2026-10-26", 550_000],
    ]);
    d.ingresos.push(sueldo("2026-11-02", 2_000_000));
    d.cortes.push(corte("2026-11-02", 200_000 + 2_000_000)); // última de octubre: 350K
    d.cortes.push(corte("2026-11-09", 1_900_000));
    d.cortes.push(corte("2026-11-16", 1_600_000));
    d.cortes.push(corte("2026-11-23", 1_300_000));
    d.cortes.push(corte("2026-11-30", 1_000_000));
    d.cortes.push(corte("2026-12-07", 700_000));
    return d;
  }

  it("calcula consumo y ahorro real de los meses completos", () => {
    const e = computeEngine(dosMeses(), "2026-12-07");
    const [oct, nov] = e.resumenes;
    expect(oct.completo).toBe(true);
    expect(oct.parcial).toBe(false);
    expect(oct.consumo).toBe($(1_400_000));
    expect(oct.ahorroReal).toBe($(600_000));
    expect(nov.completo).toBe(true);
    expect(nov.consumo).toBe($(1_500_000));
  });

  it("promedios y variación contra el mes anterior", () => {
    const d = dosMeses();
    const e = computeEngine(d, "2026-12-07");
    const m = computeMetrics(d, e);
    expect(m.promedio4).toBe($(300_000));
    expect(m.promedioMensual).toBe($(1_450_000));
    expect(m.vsMesAnterior).toBeCloseTo(100_000 / 1_400_000, 10);
  });

  it("el primer mes arrancado a mitad de mes es parcial y no entra en promedios", () => {
    const e = computeEngine(octubre([["2026-10-13", 1_600_000], ["2026-10-19", 1_300_000]]), "2026-10-19");
    expect(e.resumenes[0].parcial).toBe(true);
  });

  it("proyecta la meta en dólares: cuánto comprar por mes", () => {
    const d = dosMeses();
    d.settings.meta = { nombre: "Dólares", moneda: "USD", monto: 2000_00, fecha: "2027-03-31" };
    const e = computeEngine(d, "2026-12-07");
    const g = projectGoal(d, e, computeMetrics(d, e), "2026-12")!;
    expect(g.faltante).toBe(2000_00);
    expect(g.mesesHastaFecha).toBe(4);
    expect(g.requeridoMensual).toBe(500_00);
    expect(g.requeridoMensualARS).toBe($(750_000));
    expect(g.ritmoFuente).toBe("historial");
  });
});

/* -------------------------------- reducer -------------------------------- */

describe("reducer", () => {
  it("un corte por fecha y upsert idempotente", () => {
    let d = base();
    const c = corte("2026-10-05", 100);
    d = reduce(d, { type: "corte/save", corte: c });
    d = reduce(d, { type: "corte/save", corte: c });
    d = reduce(d, { type: "corte/save", corte: { ...c, id: "otro", mp: $(5) } });
    expect(d.cortes).toHaveLength(1);
    expect(d.cortes[0].id).toBe("otro");
  });

  it("pases al ahorro: upsert idempotente y se pueden deshacer", () => {
    let d = base();
    const p = pase("2026-10-07", 50_000);
    d = reduce(d, { type: "pase/save", pase: p });
    d = reduce(d, { type: "pase/save", pase: p });
    expect(d.pases).toHaveLength(1);
    d = reduce(d, { type: "pase/delete", id: p.id });
    expect(d.pases).toHaveLength(0);
    expect(describirAccion({ type: "pase/save", pase: p })).toBe("Ahorro: $50.000 de gastos a la reserva de ahorro");
    expect(describirAccion({ type: "pase/save", pase: { ...p, monto: -p.monto } })).toBe("Sacar del ahorro: $50.000 a la reserva de gastos");
  });

  it("datos de antes de los pases se completan, y se conservan campos que esta versión no conoce", () => {
    const d = normalizeData({ ...emptyData(), pases: undefined, algoNuevo: [1] });
    expect(d.pases).toEqual([]);
    expect((d as unknown as { algoNuevo: number[] }).algoNuevo).toEqual([1]);
  });

  it("borrar una tarjeta en uso la archiva", () => {
    let d = base();
    d = reduce(d, { type: "tarjeta/save", tarjeta: visa });
    d = reduce(d, { type: "compra/save", compra: compra({ primerMes: "2026-10", montoCuota: 1 }) });
    d = reduce(d, { type: "tarjeta/delete", id: "visa" });
    expect(d.tarjetas[0].archivada).toBe(true);
  });
});
