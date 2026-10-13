import { addMonthsISO, monthOf, monthsBetween } from "./dates";
import { valorSaldos, type EngineResult, type MonthSummary } from "./engine";
import type { Data, ISOMonth, Meta } from "./types";

export interface Metrics {
  /** Promedio de gasto del día a día de las últimas 4 semanas cerradas (normalizado a semana completa). */
  promedio4: number | null;
  /** Promedio de consumo mensual (día a día + tarjetas + especiales) de los meses completos. */
  promedioMensual: number | null;
  mesesConDatos: number;
  /** Variación del consumo del último mes completo vs el anterior. */
  vsMesAnterior: number | null;
  ultimoMesCompleto: MonthSummary | null;
  /** Todo lo que tenés según el último corte (dólares al tipo de cambio actual). */
  totalTenes: number | null;
  /** Reserva de ahorro + dólares (si usás reserva aparte). */
  ahorroAcumulado: number | null;
  usdTenes: number;
}

export const mesesComparables = (e: EngineResult): MonthSummary[] =>
  e.resumenes.filter((r) => r.completo && !r.parcial);

export function computeMetrics(data: Data, e: EngineResult): Metrics {
  const tc = data.settings.tipoCambio;
  const cerradas = e.semanas.filter((s) => s.estado === "cerrada" && s.gastado != null);
  const ult4 = cerradas.slice(-4);
  const promedio4 = ult4.length
    ? ult4.reduce((s, w) => s + (w.gastado ?? 0) / Math.max(w.cobertura, 1 / 7), 0) / ult4.length
    : null;

  const completos = mesesComparables(e);
  const promedioMensual = completos.length
    ? completos.reduce((s, m) => s + m.consumo, 0) / completos.length
    : null;
  const [prev, last] = completos.slice(-2);
  const vsMesAnterior = prev && last && prev.consumo > 0 ? (last.consumo - prev.consumo) / prev.consumo : null;

  const u = e.ultimoCorte;
  return {
    promedio4,
    promedioMensual,
    mesesConDatos: completos.length,
    vsMesAnterior,
    ultimoMesCompleto: completos.at(-1) ?? null,
    totalTenes: u ? valorSaldos(u, tc) : null,
    ahorroAcumulado: u && data.settings.usaReservaAhorro ? u.ahorro + u.usd * tc : null,
    usdTenes: u?.usd ?? 0,
  };
}

export interface GoalProjection {
  meta: Meta;
  actual: number;
  faltante: number;
  progreso: number;
  /** Ahorro mensual que se usa para proyectar, en la moneda de la meta. */
  ritmoMensual: number;
  ritmoFuente: "historial" | "plan";
  mesEstimado: ISOMonth | null;
  mesesEstimados: number | null;
  /** Si la meta tiene fecha: cuánto hay que ahorrar por mes para llegar. */
  requeridoMensual: number | null;
  mesesHastaFecha: number | null;
  /** Equivalente en pesos del requerido (metas en dólares). */
  requeridoMensualARS: number | null;
}

/** Proyección de la meta con el ritmo real de ahorro (o el del plan si todavía no hay historia). */
export function projectGoal(data: Data, e: EngineResult, m: Metrics, mesActual: ISOMonth): GoalProjection | null {
  const meta = data.settings.meta;
  if (!meta || meta.monto <= 0) return null;
  const tc = data.settings.tipoCambio;

  const actualARS = m.ahorroAcumulado ?? m.totalTenes ?? 0;
  const actual = meta.moneda === "USD" ? m.usdTenes : actualARS;
  const faltante = Math.max(0, meta.monto - actual);

  const historial = mesesComparables(e).slice(-3);
  const ritmoARS = historial.length
    ? historial.reduce((s, r) => s + r.ahorroReal, 0) / historial.length
    : (e.meses[mesActual]?.ahorroMeta ?? 0);
  const ritmoMensual = meta.moneda === "USD" ? ritmoARS / tc : ritmoARS;

  const mesesEstimados = faltante === 0 ? 0 : ritmoMensual > 0 ? Math.ceil(faltante / ritmoMensual) : null;
  let requeridoMensual: number | null = null;
  let mesesHastaFecha: number | null = null;
  if (meta.fecha) {
    mesesHastaFecha = Math.max(1, monthsBetween(mesActual, monthOf(meta.fecha)) + 1);
    requeridoMensual = faltante / mesesHastaFecha;
  }
  return {
    meta,
    actual,
    faltante,
    progreso: Math.min(1, actual / meta.monto),
    ritmoMensual,
    ritmoFuente: historial.length ? "historial" : "plan",
    mesesEstimados,
    mesEstimado: mesesEstimados == null ? null : addMonthsISO(mesActual, mesesEstimados),
    requeridoMensual,
    mesesHastaFecha,
    requeridoMensualARS: requeridoMensual != null && meta.moneda === "USD" ? requeridoMensual * tc : null,
  };
}
