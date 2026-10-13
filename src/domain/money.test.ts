import { describe, expect, it } from "vitest";

import { formatARS, formatARSCompact, formatTyping, formatUSD, parseAmount } from "./money";

describe("montos", () => {
  it("formatea pesos sin decimales y con signo", () => {
    expect(formatARS(123456700)).toBe("$1.234.567");
    expect(formatARS(-1234500)).toBe("−$12.345");
    expect(formatARS(1234500, { signed: true })).toBe("+$12.345");
    expect(formatARS(0)).toBe("$0");
  });

  it("formatea dólares", () => {
    expect(formatUSD(84000)).toBe("US$840");
    expect(formatUSD(399)).toBe("US$3,99");
  });

  it("compacta para ejes", () => {
    expect(formatARSCompact(18600000)).toBe("$186K");
    expect(formatARSCompact(124000000)).toBe("$1,2M");
    expect(formatARSCompact(95000)).toBe("$950");
  });

  it("parsea lo que escribe el usuario", () => {
    expect(parseAmount("1.234.567", "ARS")).toBe(123456700);
    expect(parseAmount("$ 1234567", "ARS")).toBe(123456700);
    expect(parseAmount("", "ARS")).toBeNull();
    expect(parseAmount("abc", "ARS")).toBeNull();
    expect(parseAmount("3,99", "USD")).toBe(399);
    expect(parseAmount("3.99", "USD")).toBe(399);
    expect(parseAmount("1.250,50", "USD")).toBe(125050);
    expect(parseAmount("840", "USD")).toBe(84000);
  });

  it("formatea mientras se tipea", () => {
    expect(formatTyping("1234567", "ARS")).toBe("1.234.567");
    expect(formatTyping("0012", "ARS")).toBe("12");
    expect(formatTyping("1250,5", "USD")).toBe("1.250,5");
    expect(formatTyping("1250", "USD")).toBe("1.250");
  });
});
