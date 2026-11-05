import { describe, expect, it } from "vitest";
import { addCalendarMonthsIso, calendarDaysUntil, PRE_DUE_REMINDER_DAYS } from "./paymentReminder";
import { DEFAULT_OVERDUE_GRACE_DAYS } from "./subscriptionAccess";

describe("paymentReminder helpers", () => {
  it("calcula dias de calendário até o vencimento", () => {
    expect(calendarDaysUntil("2026-11-10", "2026-11-05")).toBe(5);
    expect(calendarDaysUntil("2026-11-08", "2026-11-05")).toBe(3);
    expect(calendarDaysUntil("2026-11-06", "2026-11-05")).toBe(1);
    expect(calendarDaysUntil("2026-11-05", "2026-11-05")).toBe(0);
    expect(calendarDaysUntil("2026-11-01", "2026-11-05")).toBe(-4);
  });

  it("lembretes pré-vencimento são 5, 3 e 1", () => {
    expect([...PRE_DUE_REMINDER_DAYS]).toEqual([5, 3, 1]);
  });

  it("tolerância padrão após vencimento é 5 dias", () => {
    expect(DEFAULT_OVERDUE_GRACE_DAYS).toBe(5);
  });

  it("avança um mês respeitando fim do mês", () => {
    expect(addCalendarMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonthsIso("2026-11-05", 1)).toBe("2026-12-05");
    expect(addCalendarMonthsIso("2026-12-15", 1)).toBe("2027-01-15");
  });
});
