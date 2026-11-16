import { describe, expect, it } from "vitest";
import {
  countDaysLabel,
  overdueBarLabel,
  paymentReminderHeadline,
  paymentReminderMessage,
  shortDueDate,
} from "./paymentReminderCopy";

describe("textos do aviso de pagamento", () => {
  it("usa plural correto, sem dia(s)", () => {
    expect(countDaysLabel(0)).toBe("0 dias");
    expect(countDaysLabel(1)).toBe("1 dia");
    expect(countDaysLabel(3)).toBe("3 dias");
    expect(countDaysLabel(-2)).toBe("0 dias");
  });

  it("encurta a data para dia/mês", () => {
    expect(shortDueDate("2026-11-18")).toBe("18/11");
    expect(shortDueDate("18/11/2026")).toBe("18/11");
    expect(shortDueDate("18 de novembro de 2026")).toBe("18/11");
  });

  it("monta o título compacto do pré-vencimento", () => {
    expect(
      paymentReminderHeadline({
        phase: "pre_due",
        amountLabel: "R$ 350,00",
        dueDate: "2026-11-18",
        daysUntilDue: 3,
      }),
    ).toBe("Mensalidade de R$ 350,00 vence em 18/11 (3 dias)");
    expect(
      paymentReminderHeadline({
        phase: "pre_due",
        amountLabel: "R$ 1,00",
        dueDate: "2026-11-16",
        daysUntilDue: 1,
      }),
    ).toBe("Mensalidade de R$ 1,00 vence em 16/11 (1 dia)");
    expect(
      paymentReminderHeadline({
        phase: "pre_due",
        amountLabel: "R$ 350,00",
        dueDate: "2026-11-15",
        daysUntilDue: 0,
      }),
    ).toBe("Mensalidade de R$ 350,00 vence hoje (15/11)");
  });

  it("monta o título de atraso e da barra fixa", () => {
    expect(
      paymentReminderHeadline({
        phase: "overdue",
        amountLabel: "R$ 350,00",
        dueDate: "2026-11-15",
        daysUntilBlock: 2,
      }),
    ).toBe("Mensalidade de R$ 350,00 venceu em 15/11. Bloqueio em 2 dias.");
    expect(
      overdueBarLabel({
        phase: "overdue",
        amountLabel: "R$ 350,00",
        daysUntilBlock: 1,
      }),
    ).toBe("Pagamento em atraso · R$ 350,00 · bloqueio em 1 dia");
    expect(
      paymentReminderHeadline({
        phase: "blocked",
        amountLabel: "R$ 350,00",
        dueDate: "2026-11-10",
      }),
    ).toBe("Mensalidade de R$ 350,00 venceu em 10/11. Acesso bloqueado.");
  });

  it("não usa a forma dia(s) nas mensagens", () => {
    const msg = paymentReminderMessage({
      phase: "overdue",
      amountLabel: "R$ 199,90",
      dueDate: "2026-11-15",
      daysUntilBlock: 3,
    });
    expect(msg).not.toMatch(/dia\(s\)/);
    expect(msg).toContain("3 dias");
  });
});
