import type { Moneda } from "./types";

/**
 * Montos en unidad mínima (centavos). Parse/format SOLO en los bordes (inputs y pantalla).
 * Los pesos se muestran sin decimales: con la inflación, los centavos no dicen nada.
 */

const MINUS = "−";
const intAR = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const usdAR = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const oneDecimalAR = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

/** "$1.234.567" · "−$12.345" · con `signed`: "+$12.345" */
export function formatARS(centavos: number, opts: { signed?: boolean } = {}): string {
  const pesos = Math.round(centavos / 100);
  const abs = intAR.format(Math.abs(pesos));
  if (pesos < 0) return `${MINUS}$${abs}`;
  if (opts.signed && pesos > 0) return `+$${abs}`;
  return `$${abs}`;
}

/** "US$840" · "US$3,99" */
export function formatUSD(cents: number, opts: { signed?: boolean } = {}): string {
  const v = cents / 100;
  const abs = usdAR.format(Math.abs(v));
  if (v < 0) return `${MINUS}US$${abs}`;
  if (opts.signed && v > 0) return `+US$${abs}`;
  return `US$${abs}`;
}

export function formatMoney(amount: number, moneda: Moneda, opts: { signed?: boolean } = {}): string {
  return moneda === "USD" ? formatUSD(amount, opts) : formatARS(amount, opts);
}

/** Compacto para ejes y chips: "$0" · "$950" · "$186K" · "$1,2M" */
export function formatARSCompact(centavos: number): string {
  const pesos = Math.round(centavos / 100);
  const sign = pesos < 0 ? MINUS : "";
  const a = Math.abs(pesos);
  if (a >= 1_000_000) return `${sign}$${oneDecimalAR.format(a / 1_000_000)}M`;
  if (a >= 10_000) return `${sign}$${intAR.format(Math.round(a / 1000))}K`;
  if (a >= 1_000) return `${sign}$${oneDecimalAR.format(a / 1000)}K`;
  return `${sign}$${intAR.format(a)}`;
}

/** Convierte USD (centavos de dólar) a centavos de peso. */
export function usdToARS(usdCents: number, tipoCambio: number): number {
  return usdCents * tipoCambio;
}

export function toARS(amount: number, moneda: Moneda, tipoCambio: number): number {
  return moneda === "USD" ? usdToARS(amount, tipoCambio) : amount;
}

/**
 * Parsea lo que escribe el usuario a centavos.
 * - ARS: solo pesos enteros; ignora puntos/espacios ("1.234.567" → 123456700).
 * - USD: acepta decimales con coma o punto ("3,99" / "3.99" / "1.250,50").
 */
export function parseAmount(text: string, moneda: Moneda): number | null {
  const t = text.replace(/[\s$]|US/gi, "");
  if (t === "") return null;
  if (moneda === "ARS") {
    const digits = t.split(",")[0].replace(/\./g, "");
    if (!/^\d+$/.test(digits)) return null;
    return Number(digits) * 100;
  }
  let normalized: string;
  if (/^\d+\.\d{1,2}$/.test(t)) normalized = t;
  else normalized = t.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

/** Texto para un input a partir de centavos: "1.234.567" (ARS) · "3,99" (USD). */
export function amountToInput(amount: number, moneda: Moneda): string {
  if (moneda === "ARS") return intAR.format(Math.round(amount / 100));
  return usdAR.format(amount / 100);
}

/**
 * Reformatea en vivo lo que se está tipeando, preservando decimales parciales en USD.
 * "1234567" → "1.234.567" · USD "1250,5" → "1.250,5"
 */
export function formatTyping(raw: string, moneda: Moneda): string {
  if (moneda === "ARS") {
    const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    return digits === "" ? "" : intAR.format(Number(digits));
  }
  const cleaned = raw.replace(/[^\d.,]/g, "");
  const sepIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));
  const hasDecimal = sepIndex >= 0 && cleaned.length - sepIndex - 1 <= 2;
  const intPart = (hasDecimal ? cleaned.slice(0, sepIndex) : cleaned).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  const decPart = hasDecimal ? cleaned.slice(sepIndex + 1).replace(/\D/g, "") : "";
  const intFormatted = intPart === "" ? (hasDecimal ? "0" : "") : intAR.format(Number(intPart));
  return hasDecimal ? `${intFormatted},${decPart}` : intFormatted;
}

export function formatPercent(ratio: number, opts: { signed?: boolean } = {}): string {
  const v = Math.round(ratio * 100);
  if (v < 0) return `${MINUS}${Math.abs(v)}%`;
  if (opts.signed && v > 0) return `+${v}%`;
  return `${v}%`;
}
