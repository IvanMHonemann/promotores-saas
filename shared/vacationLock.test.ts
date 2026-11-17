import { describe, expect, it } from "vitest";
import { findActiveVacation, findActiveVacationAt, formatBrDate, isOnVacationDay, vacationBlockMessage } from "./vacationLock";

const period = { startDate: "2026-11-07", endDate: "2026-11-17", status: "scheduled" as const };

describe("isOnVacationDay", () => {
  it("bloqueia do primeiro ao último dia, inclusive", () => {
    expect(isOnVacationDay("2026-11-07", period.startDate, period.endDate)).toBe(true);
    expect(isOnVacationDay("2026-11-12", period.startDate, period.endDate)).toBe(true);
    expect(isOnVacationDay("2026-11-17", period.startDate, period.endDate)).toBe(true);
  });

  it("libera no dia seguinte ao término e antes do início", () => {
    expect(isOnVacationDay("2026-11-18", period.startDate, period.endDate)).toBe(false);
    expect(isOnVacationDay("2026-11-06", period.startDate, period.endDate)).toBe(false);
  });
});

describe("findActiveVacationAt", () => {
  it("usa o calendário de São Paulo, não UTC", () => {
    // 18/11 02:00 UTC ainda é 17/11 23:00 em São Paulo.
    const stillThe17th = new Date("2026-11-18T02:00:00.000Z");
    // 18/11 03:00 UTC já é 18/11 00:00 em São Paulo.
    const alreadyThe18th = new Date("2026-11-18T03:00:00.000Z");
    expect(findActiveVacationAt(stillThe17th, [period])).toEqual(period);
    expect(findActiveVacationAt(alreadyThe18th, [period])).toBeNull();
  });

  it("ignora férias canceladas", () => {
    expect(findActiveVacation("2026-11-10", [{ ...period, status: "cancelled" }])).toBeNull();
  });
});

describe("vacationBlockMessage", () => {
  it("escreve as datas em português", () => {
    expect(formatBrDate("2026-11-07")).toBe("07/11/2026");
    expect(vacationBlockMessage(period.startDate, period.endDate)).toBe(
      "Você está de férias de 07/11/2026 a 17/11/2026. O aplicativo é liberado no dia seguinte ao término.",
    );
  });
});
