import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  endOfMonth,
  format,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";

import type { ISODate, ISOMonth } from "./types";

/** Todas las fechas se manejan en hora local; `parseISO("yyyy-MM-dd")` da la medianoche local. */
export const parseDate = (iso: ISODate): Date => parseISO(iso);
export const toISODate = (d: Date): ISODate => format(d, "yyyy-MM-dd");
export const toISOMonth = (d: Date): ISOMonth => format(d, "yyyy-MM");
export const todayISO = (): ISODate => toISODate(new Date());

export const monthOf = (iso: ISODate): ISOMonth => iso.slice(0, 7);

/** Lunes de la semana de `iso` (la semana arranca el lunes). */
export function mondayOf(iso: ISODate): ISODate {
  return toISODate(startOfWeek(parseDate(iso), { weekStartsOn: 1 }));
}

export function addDaysISO(iso: ISODate, n: number): ISODate {
  return toISODate(addDays(parseDate(iso), n));
}

export function addMonthsISO(month: ISOMonth, n: number): ISOMonth {
  return toISOMonth(addMonths(parseISO(`${month}-01`), n));
}

/** Días calendario de `a` a `b` (b − a). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return differenceInCalendarDays(parseDate(b), parseDate(a));
}

export function monthsBetween(a: ISOMonth, b: ISOMonth): number {
  return differenceInCalendarMonths(parseISO(`${b}-01`), parseISO(`${a}-01`));
}

/** Lunes (ISO) que caen dentro del mes. Una semana pertenece al mes de su lunes. */
export function mondaysInMonth(month: ISOMonth): ISODate[] {
  const first = startOfMonth(parseISO(`${month}-01`));
  const last = endOfMonth(first);
  const out: ISODate[] = [];
  let d = startOfWeek(first, { weekStartsOn: 1 });
  if (d < first) d = addDays(d, 7);
  while (d <= last) {
    out.push(toISODate(d));
    d = addDays(d, 7);
  }
  return out;
}

/** Primer día hábil (lunes a viernes) del mes. No contempla feriados. */
export function firstBusinessDay(month: ISOMonth): ISODate {
  let d = parseISO(`${month}-01`);
  while (isWeekend(d)) d = addDays(d, 1);
  return toISODate(d);
}

export function monthRange(from: ISOMonth, to: ISOMonth): ISOMonth[] {
  const out: ISOMonth[] = [];
  for (let m = from; m <= to; m = addMonthsISO(m, 1)) out.push(m);
  return out;
}

/* ---------------------------- Formato en español ---------------------------- */

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "octubre 2026" / "Octubre 2026" */
export function monthLabel(month: ISOMonth, opts: { capital?: boolean; year?: boolean } = {}): string {
  const d = parseISO(`${month}-01`);
  const s = format(d, opts.year === false ? "MMMM" : "MMMM yyyy", { locale: es });
  return opts.capital === false ? s : cap(s);
}

/** "oct" / "oct 26" */
export function monthShort(month: ISOMonth, withYear = false): string {
  const d = parseISO(`${month}-01`);
  return format(d, withYear ? "MMM yy" : "MMM", { locale: es }).replace(".", "");
}

/** "lun 12 oct" */
export function dayLabel(iso: ISODate): string {
  return format(parseDate(iso), "EEE d MMM", { locale: es }).replace(/\./g, "");
}

/** "12 de octubre" */
export function dayLong(iso: ISODate): string {
  return format(parseDate(iso), "d 'de' MMMM", { locale: es });
}

/** Rango de una semana: "12 al 18 oct" / "28 sep al 4 oct" */
export function weekRangeLabel(monday: ISODate): string {
  const a = parseDate(monday);
  const b = addDays(a, 6);
  const sameMonth = a.getMonth() === b.getMonth();
  const left = sameMonth ? format(a, "d") : format(a, "d MMM", { locale: es });
  return `${left} al ${format(b, "d MMM", { locale: es })}`.replace(/\./g, "");
}
