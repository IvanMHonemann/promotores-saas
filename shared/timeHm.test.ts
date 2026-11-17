import { describe, expect, it } from "vitest";
import { formatTimeHmMask, isValidTimeHm, normalizeTimeHm, MINUTE_OPTIONS } from "./timeHm";

describe("máscara e validação de horário (minuto a minuto)", () => {
  it("formata dígitos como HH:MM", () => {
    expect(formatTimeHmMask("2")).toBe("2");
    expect(formatTimeHmMask("23")).toBe("23");
    expect(formatTimeHmMask("234")).toBe("23:4");
    expect(formatTimeHmMask("2347")).toBe("23:47");
    expect(formatTimeHmMask("23:47")).toBe("23:47");
    expect(formatTimeHmMask("234759")).toBe("23:47");
  });

  it("aceita qualquer minuto de 00 a 59, inclusive os que o relógio nativo esconde (01, 02, 03, 04, 47…)", () => {
    expect(MINUTE_OPTIONS).toHaveLength(60);
    expect(MINUTE_OPTIONS[0]).toBe("00");
    expect(MINUTE_OPTIONS[47]).toBe("47");
    expect(MINUTE_OPTIONS[59]).toBe("59");
    expect(normalizeTimeHm("23:47")).toBe("23:47");
    expect(normalizeTimeHm("2347")).toBe("23:47");
    expect(normalizeTimeHm("9:07")).toBe("09:07");
    expect(normalizeTimeHm("907")).toBe("09:07");
    expect(isValidTimeHm("08:01")).toBe(true);
    expect(isValidTimeHm("08:05")).toBe(true);
    expect(isValidTimeHm("23:59")).toBe(true);
  });

  it("rejeita hora ou minuto inválidos", () => {
    expect(normalizeTimeHm("24:00")).toBe("");
    expect(normalizeTimeHm("12:60")).toBe("");
    expect(normalizeTimeHm("12")).toBe("");
    expect(isValidTimeHm("12:60")).toBe(false);
    expect(isValidTimeHm("7:30")).toBe(false);
  });
});
