import type { Data, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  sueldo: 0,
  ahorroModo: "porcentaje",
  ahorroPorcentaje: 20,
  ahorroMonto: 0,
  aguinaldo: "presupuesto",
  tipoCambio: 1500,
  usaReservaAhorro: true,
  usaDolares: false,
  meta: null,
};

export function emptyData(now = new Date()): Data {
  return {
    version: 1,
    creadoEn: now.toISOString(),
    settings: { ...DEFAULT_SETTINGS },
    cortes: [],
    ingresos: [],
    tarjetas: [],
    compras: [],
    recurrentes: [],
    pagos: [],
    especiales: [],
    sobrantes: [],
    pases: [],
  };
}

/** Completa campos faltantes de un documento persistido (tolerante a versiones viejas o ediciones a mano). */
export function normalizeData(raw: unknown): Data {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<Data>;
  const arr = <T,>(v: T[] | undefined): T[] => (Array.isArray(v) ? v : []);
  return {
    // Campos que agregue una versión más nueva de la app se conservan al guardar.
    ...o,
    version: 1,
    creadoEn: typeof o.creadoEn === "string" ? o.creadoEn : base.creadoEn,
    settings: { ...DEFAULT_SETTINGS, ...(o.settings ?? {}) },
    cortes: arr(o.cortes),
    ingresos: arr(o.ingresos),
    tarjetas: arr(o.tarjetas),
    compras: arr(o.compras),
    recurrentes: arr(o.recurrentes).map((r) => ({ ...r, veces: r.veces ?? {}, montos: r.montos ?? {} })),
    pagos: arr(o.pagos),
    especiales: arr(o.especiales),
    sobrantes: arr(o.sobrantes),
    pases: arr(o.pases),
  };
}

/** Colores para identificar tarjetas (chips). */
export const CARD_COLORS = ["#ef4444", "#38bdf8", "#a78bfa", "#f59e0b", "#34d399", "#f472b6", "#94a3b8"] as const;

export const CARD_SUGGESTIONS = [
  { nombre: "Visa Santander", color: "#ef4444" },
  { nombre: "Mercado Pago", color: "#38bdf8" },
  { nombre: "Bancor", color: "#a78bfa" },
] as const;
