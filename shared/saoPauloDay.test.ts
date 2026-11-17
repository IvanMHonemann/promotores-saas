import { describe, expect, it } from "vitest";
import { hasPendingSamePunch, isInSaoPauloDay, saoPauloDayRange } from "./saoPauloDay";
import { excuseDay } from "./correctionExcuse";

describe("saoPauloDayRange", () => {
  it("inclui 23:55 de Brasília no dia 16/11, não no dia 17", () => {
    const { start, end } = saoPauloDayRange("2026-11-16");
    expect(start.toISOString()).toBe("2026-11-16T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-17T03:00:00.000Z");
    const included = new Date("2026-11-17T02:55:00.000Z"); // 16/11 23:55 em São Paulo
    const tooEarly = new Date("2026-11-16T02:59:59.000Z"); // 15/11 23:59 em São Paulo
    const nextMidnight = new Date("2026-11-17T03:00:00.000Z"); // 17/11 00:00 em São Paulo
    expect(isInSaoPauloDay(included, "2026-11-16")).toBe(true);
    expect(isInSaoPauloDay(new Date("2026-11-16T03:00:00.000Z"), "2026-11-16")).toBe(true);
    expect(isInSaoPauloDay(tooEarly, "2026-11-16")).toBe(false);
    expect(isInSaoPauloDay(nextMidnight, "2026-11-16")).toBe(false);
    expect(excuseDay(included)).toBe("2026-11-16");
  });

  it("a janela UTC (00:00Z–24:00Z) perde a saída de 23:55", () => {
    const utcStart = new Date("2026-11-16T00:00:00.000Z");
    const utcEnd = new Date("2026-11-17T00:00:00.000Z");
    const exit = new Date("2026-11-17T02:55:00.000Z");
    expect(exit >= utcStart && exit < utcEnd).toBe(false);
    expect(isInSaoPauloDay(exit, "2026-11-16")).toBe(true);
  });
});

describe("hasPendingSamePunch", () => {
  const dayOf = (v: Date | string) => excuseDay(v);
  const row = (over: Record<string, unknown> = {}) => ({
    status: "pending",
    requestedTime: new Date("2026-11-17T02:55:00.000Z"),
    requestedType: "clock_out",
    timeEventId: null,
    isFullDay: false,
    ...over,
  });

  it("não barra um pedido já aprovado — só os pendentes", () => {
    expect(hasPendingSamePunch([row({ status: "approved" })], { day: "2026-11-16", requestedType: "clock_out", timeEventId: null, dayOf })).toBe(false);
    expect(hasPendingSamePunch([row({ status: "pending" })], { day: "2026-11-16", requestedType: "clock_out", timeEventId: null, dayOf })).toBe(true);
  });

  it("só considera a mesma batida (tipo e marcação)", () => {
    expect(hasPendingSamePunch([row()], { day: "2026-11-16", requestedType: "break_end", timeEventId: null, dayOf })).toBe(false);
    expect(hasPendingSamePunch([row({ timeEventId: 10 })], { day: "2026-11-16", requestedType: "clock_out", timeEventId: null, dayOf })).toBe(false);
  });
});
