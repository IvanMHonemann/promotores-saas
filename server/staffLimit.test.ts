import { describe, expect, it } from "vitest";
import {
  countBillableStaff,
  effectiveUserLimit,
  parseExtraUsers,
  staffLimitAppliesToRole,
  staffUsageLabel,
  suggestedMonthlyAmount,
  userLimitReachedMessage,
} from "../shared/staffLimit";

const team = [
  { role: "company_admin", active: true },
  { role: "admin", active: true },
  { role: "platform_admin", active: true },
  { role: "promoter", active: true },
  { role: "promoter", active: true },
  { role: "supervisor", active: true },
  { role: "promoter", active: false },
  { role: "supervisor", active: 0 },
  { role: "promoter", active: 1 },
];

describe("contagem de funcionários no limite", () => {
  it("conta só promotores ativos; ignora admin, supervisor, super-admin e inativos", () => {
    // 3 promotores ativos na equipe de exemplo (2 true + 1 com active=1); o supervisor ativo não conta
    expect(countBillableStaff(team)).toBe(3);
    expect(countBillableStaff([])).toBe(0);
    expect(countBillableStaff([{ role: "company_admin", active: true }])).toBe(0);
    expect(countBillableStaff([{ role: "supervisor", active: true }])).toBe(0);
    expect(countBillableStaff([{ role: "promoter", active: true }])).toBe(1);
  });

  it("criar ou reativar supervisor nunca entra na trava do limite", () => {
    expect(staffLimitAppliesToRole("supervisor")).toBe(false);
    expect(staffLimitAppliesToRole("company_admin")).toBe(false);
    expect(staffLimitAppliesToRole("platform_admin")).toBe(false);
    expect(staffLimitAppliesToRole("promoter")).toBe(true);
  });
});

describe("limite efetivo", () => {
  it("soma os inclusos do plano com os extras", () => {
    expect(effectiveUserLimit({ maxUsers: 20, extraUsers: 0 })).toBe(20);
    expect(effectiveUserLimit({ maxUsers: 20, extraUsers: 5 })).toBe(25);
    expect(effectiveUserLimit({ maxUsers: 10, extraUsers: 2 })).toBe(12);
  });

  it("sem maxUsers (plano antigo ilimitado ou sem plano) não impõe teto, mesmo com extras", () => {
    expect(effectiveUserLimit({ maxUsers: null, extraUsers: 5 })).toBeNull();
    expect(effectiveUserLimit({ maxUsers: undefined, extraUsers: 0 })).toBeNull();
  });

  it("trata extras inválidos como zero", () => {
    expect(effectiveUserLimit({ maxUsers: 20, extraUsers: -3 })).toBe(20);
    expect(parseExtraUsers(-1)).toBe(0);
    expect(parseExtraUsers("7")).toBe(7);
    expect(parseExtraUsers("abc")).toBe(0);
  });
});

describe("valor mensal sugerido", () => {
  it("soma o preço do plano com extras vezes o adicional", () => {
    expect(suggestedMonthlyAmount({ planPrice: "199.90", extraUsers: 0, additionalUserPrice: "8.00" })).toBe("199.90");
    expect(suggestedMonthlyAmount({ planPrice: "199.90", extraUsers: 5, additionalUserPrice: "8.00" })).toBe("239.90");
    expect(suggestedMonthlyAmount({ planPrice: "179.90", extraUsers: 2, additionalUserPrice: "8.00" })).toBe("195.90");
    expect(suggestedMonthlyAmount({ planPrice: "350.00", extraUsers: 3, additionalUserPrice: "12.00" })).toBe("386.00");
  });

  it("plano antigo sem adicional não altera o preço-base", () => {
    expect(suggestedMonthlyAmount({ planPrice: "169.90", extraUsers: 4, additionalUserPrice: null })).toBe("169.90");
  });
});

describe("rótulos e mensagem", () => {
  it("mostra o uso no formato combinado com extras", () => {
    expect(staffUsageLabel(18, 20, 0)).toBe("18 de 20 funcionários");
    expect(staffUsageLabel(23, 25, 5)).toBe("23 de 25 funcionários (5 extras)");
    expect(staffUsageLabel(2, null, 0)).toBe("2 funcionários (sem limite)");
  });

  it("explica o bloqueio em português com o limite efetivo", () => {
    expect(userLimitReachedMessage(20)).toBe("Seu plano permite até 20 funcionários. Fale com o suporte para liberar mais.");
    expect(userLimitReachedMessage(25)).toBe("Seu plano permite até 25 funcionários. Fale com o suporte para liberar mais.");
  });
});
