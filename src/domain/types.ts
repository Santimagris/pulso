/**
 * Modelo de datos de Pulso. Todo lo que se persiste vive en un único documento
 * (`Data`) guardado como `data.json` en un repo privado de GitHub.
 *
 * Montos: SIEMPRE enteros en unidad mínima (centavos de peso o de dólar).
 * Fechas: `yyyy-MM-dd` (ISODate) y meses `yyyy-MM` (ISOMonth), en hora local.
 */

export type Moneda = "ARS" | "USD";
export type ISODate = string;
export type ISOMonth = string;

export type ModoAhorro = "porcentaje" | "monto";
/** Qué pasa con el aguinaldo: entra como un sueldo más, mitad al ahorro, o todo al ahorro. */
export type DestinoAguinaldo = "presupuesto" | "mitad" | "ahorro";

export interface Meta {
  nombre: string;
  moneda: Moneda;
  monto: number;
  /** Fecha objetivo opcional. Sin fecha, Pulso estima cuándo llegás. */
  fecha?: ISODate;
}

export interface Settings {
  /** Sueldo estimado; se usa para los meses en que todavía no cargaste el sueldo real. */
  sueldo: number;
  ahorroModo: ModoAhorro;
  /** 0–100, se aplica sobre el sueldo del mes. */
  ahorroPorcentaje: number;
  /** Monto fijo mensual (centavos) cuando el modo es "monto". */
  ahorroMonto: number;
  aguinaldo: DestinoAguinaldo;
  /** Pesos por dólar (con decimales), para convertir cuotas y saldos en USD. */
  tipoCambio: number;
  tipoCambioActualizado?: string;
  /** Muestra el campo "Reserva de ahorro" en el corte (ahorro separado del gasto). */
  usaReservaAhorro: boolean;
  /** Muestra el campo "Dólares" en el corte. */
  usaDolares: boolean;
  meta: Meta | null;
}

/** Foto de cuánta plata tenés. Se hace una vez por semana (los lunes). */
export interface Corte {
  id: string;
  fecha: ISODate;
  /** Mercado Pago / cuenta con la que gastás (incluida su reserva de gastos). */
  mp: number;
  /** De `mp`, lo que está en la reserva de gastos (si se anotó aparte; el resto es la cuenta). */
  mpReserva?: number;
  /** Reserva aparte para el ahorro (0 si no la usás). */
  ahorro: number;
  efectivo: number;
  /** Dólares que tenés, en centavos de dólar. */
  usd: number;
  /** Tipo de cambio al momento del corte (valúa los dólares). */
  tipoCambio: number;
  nota?: string;
  creadoEn: string;
}

export type TipoIngreso = "sueldo" | "aguinaldo" | "extra";

export interface Ingreso {
  id: string;
  fecha: ISODate;
  monto: number;
  tipo: TipoIngreso;
  /** Mes al que corresponde (sueldo/aguinaldo). Ej: el sueldo de junio cobrado el 31 de mayo. */
  mes?: ISOMonth;
  /** Solo para "extra": va al ahorro (default) o se suma a la semana. */
  destino?: "ahorro" | "semana";
  nota?: string;
  creadoEn: string;
}

export interface Tarjeta {
  id: string;
  nombre: string;
  color: string;
  /** Día aproximado de cierre del resumen (1–31). */
  cierreDia?: number;
  /** Día aproximado de vencimiento (1–31). */
  vencimientoDia?: number;
  archivada?: boolean;
  creadoEn: string;
}

/** Compra con tarjeta, en 1 o más cuotas fijas. */
export interface Compra {
  id: string;
  tarjetaId: string;
  descripcion: string;
  moneda: Moneda;
  montoCuota: number;
  cuotas: number;
  /** Mes en que se paga la primera cuota (`yyyy-MM`). */
  primerMes: ISOMonth;
  /** Gasto especial: sale del ahorro, no del límite semanal. */
  especial: boolean;
  creadoEn: string;
}

/** Cargo fijo que llega todos los meses a una tarjeta (plan del auto, Spotify…). */
export interface Recurrente {
  id: string;
  tarjetaId: string;
  descripcion: string;
  moneda: Moneda;
  /** Último monto conocido de UNA cuota: es el estimado para los meses sin monto anotado. */
  monto: number;
  /**
   * Monto real de una cuota en meses puntuales (ej: el Fiat de cada mes).
   * Un mes sin monto anotado usa el del último mes anotado antes; si no hay, `monto`.
   */
  montos?: Record<ISOMonth, number>;
  desdeMes: ISOMonth;
  /** Último mes inclusive; sin valor = indefinido. */
  hastaMes?: ISOMonth;
  /**
   * Cuántas veces vino en un resumen puntual (0, 1, 2…). Ej: dos cuotas del plan juntas.
   * Solo cambia la caja de ese mes: el presupuesto siempre cuenta 1 por mes, así un
   * corrimiento de fechas de la tarjeta no te hunde un mes y te infla el siguiente.
   */
  veces: Record<ISOMonth, number>;
  creadoEn: string;
}

/** Pago del resumen de una tarjeta para un mes. Cancela deuda: NO es gasto. */
export interface PagoTarjeta {
  id: string;
  tarjetaId: string;
  mes: ISOMonth;
  fecha: ISODate;
  montoARS: number;
  montoUSD: number;
  tipoCambio: number;
  creadoEn: string;
}

/** Gasto grande o puntual (regalo, viaje…) pagado sin tarjeta: sale del ahorro. */
export interface GastoEspecial {
  id: string;
  fecha: ISODate;
  monto: number;
  descripcion: string;
  creadoEn: string;
}

/** Sobrante de la semana que mandaste al ahorro (deja de estar disponible para gastar). */
export interface SobranteAlAhorro {
  id: string;
  fecha: ISODate;
  monto: number;
  creadoEn: string;
}

/**
 * Plata que moviste entre la reserva de gastos y la de ahorro ("Ahorrar" / "Sacar del ahorro").
 * No es gasto ni toca el límite (el corte mide el total, que no cambia): solo mueve los saldos que
 * se muestran hasta el próximo corte, que vuelve a ser la verdad.
 */
export interface PaseAlAhorro {
  id: string;
  fecha: ISODate;
  /** Positivo: de gastos al ahorro. Negativo: del ahorro a gastos. */
  monto: number;
  creadoEn: string;
}

export interface Data {
  version: 1;
  creadoEn: string;
  settings: Settings;
  cortes: Corte[];
  ingresos: Ingreso[];
  tarjetas: Tarjeta[];
  compras: Compra[];
  recurrentes: Recurrente[];
  pagos: PagoTarjeta[];
  especiales: GastoEspecial[];
  sobrantes: SobranteAlAhorro[];
  pases: PaseAlAhorro[];
}
