import { describe, expect, it } from "vitest";
import {
  addCalendarMonthsIso,
  calendarDaysUntil,
  nextDueAfterMarkPaid,
  PRE_DUE_REMINDER_DAYS,
} from "./paymentReminder";
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

describe("nextDueAfterMarkPaid — ciclo a partir do vencimento original", () => {
  it("pago em atraso: venceu 10/11, pago 14/11 → próximo 10/12 (não 14/12)", () => {
    expect(nextDueAfterMarkPaid("2026-11-10")).toBe("2026-12-10");
  });

  it("pago antecipado: vence 10/11, pago 05/11 → próximo ainda 10/12", () => {
    expect(nextDueAfterMarkPaid("2026-11-10")).toBe("2026-12-10");
  });

  it("pago no dia: venceu 10/11, pago 10/11 → próximo 10/12", () => {
    expect(nextDueAfterMarkPaid("2026-11-10")).toBe("2026-12-10");
  });

  it("um pagamento atrasa vários meses: avança só +1 mês (ex.: 10/09 → 10/10)", () => {
    expect(nextDueAfterMarkPaid("2026-09-10")).toBe("2026-10-10");
  });

  it("fim de mês: 31/01 → 28/02; com âncora 31, 28/02 → 31/03", () => {
    expect(nextDueAfterMarkPaid("2026-01-31")).toBe("2026-02-28");
    expect(nextDueAfterMarkPaid("2026-02-28", 31)).toBe("2026-03-31");
    expect(addCalendarMonthsIso("2026-02-28", 1, 31)).toBe("2026-03-31");
    // Abril tem 30: âncora 31 → 30/04
    expect(addCalendarMonthsIso("2026-03-31", 1, 31)).toBe("2026-04-30");
    // Volta a 31 em maio
    expect(addCalendarMonthsIso("2026-04-30", 1, 31)).toBe("2026-05-31");
  });

  it("vira o ano: 15/12 → 15/01", () => {
    expect(nextDueAfterMarkPaid("2026-12-15")).toBe("2027-01-15");
  });
});
