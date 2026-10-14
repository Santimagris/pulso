import { normalizeData } from "./defaults";
import { formatARS, formatMoney } from "./money";
import type {
  Compra,
  Corte,
  Data,
  GastoEspecial,
  Ingreso,
  PagoTarjeta,
  PaseAlAhorro,
  Recurrente,
  Settings,
  SobranteAlAhorro,
  Tarjeta,
} from "./types";

/**
 * Toda modificación de datos es una acción serializable. El sync las guarda en cola
 * (localStorage) y las re-aplica sobre la última versión remota si hay conflicto,
 * así que el reducer tiene que ser puro e idempotente (upsert por id).
 */
export type Action =
  | { type: "settings/update"; patch: Partial<Settings> }
  | {
      type: "corte/save";
      corte: Corte;
      ingresos?: Ingreso[];
      pagos?: PagoTarjeta[];
      especiales?: GastoEspecial[];
    }
  | { type: "corte/delete"; id: string }
  | { type: "ingreso/save"; ingreso: Ingreso }
  | { type: "ingreso/delete"; id: string }
  | { type: "tarjeta/save"; tarjeta: Tarjeta }
  | { type: "tarjeta/delete"; id: string }
  | { type: "compra/save"; compra: Compra }
  | { type: "compra/delete"; id: string }
  | { type: "recurrente/save"; recurrente: Recurrente }
  | { type: "recurrente/delete"; id: string }
  | { type: "pago/save"; pago: PagoTarjeta }
  | { type: "pago/delete"; id: string }
  | { type: "especial/save"; especial: GastoEspecial }
  | { type: "especial/delete"; id: string }
  | { type: "sobrante/save"; sobrante: SobranteAlAhorro }
  | { type: "sobrante/delete"; id: string }
  | { type: "pase/save"; pase: PaseAlAhorro }
  | { type: "pase/delete"; id: string }
  | { type: "data/replace"; data: Data };

type WithId = { id: string };

function upsert<T extends WithId>(list: T[], item: T): T[] {
  const i = list.findIndex((x) => x.id === item.id);
  if (i === -1) return [...list, item];
  const next = list.slice();
  next[i] = item;
  return next;
}

const remove = <T extends WithId>(list: T[], id: string): T[] => list.filter((x) => x.id !== id);

const byFecha = <T extends { fecha: string; creadoEn: string }>(a: T, b: T) =>
  a.fecha.localeCompare(b.fecha) || a.creadoEn.localeCompare(b.creadoEn);

/** Orden estable para que los diffs del JSON en GitHub sean legibles. */
function sortData(d: Data): Data {
  return {
    ...d,
    cortes: [...d.cortes].sort(byFecha),
    ingresos: [...d.ingresos].sort(byFecha),
    pagos: [...d.pagos].sort((a, b) => a.mes.localeCompare(b.mes) || a.creadoEn.localeCompare(b.creadoEn)),
    especiales: [...d.especiales].sort(byFecha),
    sobrantes: [...d.sobrantes].sort(byFecha),
    pases: [...d.pases].sort(byFecha),
    compras: [...d.compras].sort(
      (a, b) => a.primerMes.localeCompare(b.primerMes) || a.creadoEn.localeCompare(b.creadoEn),
    ),
  };
}

export function reduce(data: Data, action: Action): Data {
  switch (action.type) {
    case "settings/update":
      return { ...data, settings: { ...data.settings, ...action.patch } };

    case "corte/save": {
      // Un corte por fecha: guardar en una fecha ocupada reemplaza al anterior.
      const cortes = upsert(
        data.cortes.filter((c) => c.fecha !== action.corte.fecha || c.id === action.corte.id),
        action.corte,
      );
      let next: Data = { ...data, cortes };
      for (const ing of action.ingresos ?? []) next = { ...next, ingresos: upsert(next.ingresos, ing) };
      for (const p of action.pagos ?? []) next = { ...next, pagos: upsert(next.pagos, p) };
      for (const e of action.especiales ?? []) next = { ...next, especiales: upsert(next.especiales, e) };
      return sortData(next);
    }
    case "corte/delete":
      return { ...data, cortes: remove(data.cortes, action.id) };

    case "ingreso/save":
      return sortData({ ...data, ingresos: upsert(data.ingresos, action.ingreso) });
    case "ingreso/delete":
      return { ...data, ingresos: remove(data.ingresos, action.id) };

    case "tarjeta/save":
      return { ...data, tarjetas: upsert(data.tarjetas, action.tarjeta) };
    case "tarjeta/delete": {
      const enUso =
        data.compras.some((c) => c.tarjetaId === action.id) ||
        data.recurrentes.some((r) => r.tarjetaId === action.id) ||
        data.pagos.some((p) => p.tarjetaId === action.id);
      if (enUso) {
        return {
          ...data,
          tarjetas: data.tarjetas.map((t) => (t.id === action.id ? { ...t, archivada: true } : t)),
        };
      }
      return { ...data, tarjetas: remove(data.tarjetas, action.id) };
    }

    case "compra/save":
      return sortData({ ...data, compras: upsert(data.compras, action.compra) });
    case "compra/delete":
      return { ...data, compras: remove(data.compras, action.id) };

    case "recurrente/save":
      return { ...data, recurrentes: upsert(data.recurrentes, action.recurrente) };
    case "recurrente/delete":
      return { ...data, recurrentes: remove(data.recurrentes, action.id) };

    case "pago/save":
      return sortData({ ...data, pagos: upsert(data.pagos, action.pago) });
    case "pago/delete":
      return { ...data, pagos: remove(data.pagos, action.id) };

    case "especial/save":
      return sortData({ ...data, especiales: upsert(data.especiales, action.especial) });
    case "especial/delete":
      return { ...data, especiales: remove(data.especiales, action.id) };

    case "sobrante/save":
      return sortData({ ...data, sobrantes: upsert(data.sobrantes, action.sobrante) });
    case "sobrante/delete":
      return { ...data, sobrantes: remove(data.sobrantes, action.id) };

    case "pase/save":
      return sortData({ ...data, pases: upsert(data.pases, action.pase) });
    case "pase/delete":
      return { ...data, pases: remove(data.pases, action.id) };

    case "data/replace":
      return normalizeData(action.data);
  }
}

export const reduceAll = (data: Data, actions: Action[]): Data => actions.reduce(reduce, data);

const fechaCorta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Mensaje de commit legible para cada acción. */
export function describe(action: Action): string {
  switch (action.type) {
    case "settings/update":
      return "Ajustes actualizados";
    case "corte/save": {
      const c = action.corte;
      const extras = [
        action.ingresos?.length ? `${action.ingresos.length} ingreso(s)` : "",
        action.pagos?.length ? `${action.pagos.length} pago(s) de tarjeta` : "",
        action.especiales?.length ? `${action.especiales.length} especial(es)` : "",
      ].filter(Boolean);
      return `Corte ${fechaCorta(c.fecha)}: ${formatARS(c.mp + c.ahorro + c.efectivo)}${extras.length ? ` (+ ${extras.join(", ")})` : ""}`;
    }
    case "corte/delete":
      return "Corte eliminado";
    case "ingreso/save":
      return `Ingreso ${fechaCorta(action.ingreso.fecha)}: ${formatARS(action.ingreso.monto)}`;
    case "ingreso/delete":
      return "Ingreso eliminado";
    case "tarjeta/save":
      return `Tarjeta: ${action.tarjeta.nombre}`;
    case "tarjeta/delete":
      return "Tarjeta eliminada";
    case "compra/save": {
      const c = action.compra;
      return `Compra: ${c.descripcion} (${c.cuotas} × ${formatMoney(c.montoCuota, c.moneda)})`;
    }
    case "compra/delete":
      return "Compra eliminada";
    case "recurrente/save":
      return `Fijo: ${action.recurrente.descripcion}`;
    case "recurrente/delete":
      return "Fijo eliminado";
    case "pago/save":
      return `Pago de tarjeta ${action.pago.mes}: ${formatARS(action.pago.montoARS)}`;
    case "pago/delete":
      return "Pago de tarjeta eliminado";
    case "especial/save":
      return `Gasto especial: ${action.especial.descripcion} ${formatARS(action.especial.monto)}`;
    case "especial/delete":
      return "Gasto especial eliminado";
    case "sobrante/save":
      return `Sobrante al ahorro: ${formatARS(action.sobrante.monto)}`;
    case "sobrante/delete":
      return "Sobrante al ahorro eliminado";
    case "pase/save":
      return action.pase.monto >= 0
        ? `Ahorro: ${formatARS(action.pase.monto)} de gastos a la reserva de ahorro`
        : `Sacar del ahorro: ${formatARS(-action.pase.monto)} a la reserva de gastos`;
    case "pase/delete":
      return "Pase entre reservas eliminado";
    case "data/replace":
      return "Datos importados";
  }
}
