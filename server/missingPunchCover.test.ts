import { describe, expect, it } from "vitest";
import { excuseDay } from "../shared/correctionExcuse";

describe("cobertura do alerta de batida faltante", () => {
  it("pedido de inclusão no mesmo dia SP cobre o alerta daquele dia", () => {
    // Entrada 07:00 SP = 10:00Z
    const requested = "2026-11-02T10:00:00.000Z";
    const alertDay = "2026-11-02";
    expect(excuseDay(requested)).toBe(alertDay);
    const dayStart = new Date(`${alertDay}T00:00:00-03:00`);
    const dayEnd = new Date(`${alertDay}T23:59:59.999-03:00`);
    const t = new Date(requested).getTime();
    expect(t).toBeGreaterThanOrEqual(dayStart.getTime());
    expect(t).toBeLessThanOrEqual(dayEnd.getTime());
  });

  it("pedido de outro dia não cobre", () => {
    expect(excuseDay("2026-11-02T10:00:00.000Z")).not.toBe("2026-11-09");
  });
});
