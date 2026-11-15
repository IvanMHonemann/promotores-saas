import { describe, expect, it } from "vitest";
import {
  COMMERCIAL_PLANS,
  addCalendarMonthsIso,
  isLegacyPlanName,
  isOfficialCommercialPlanName,
  isSelectablePlan,
  nextPaidPeriod,
  planSelectLabel,
} from "../shared/commercialPlans";

describe("catálogo comercial", () => {
  it("tem os 3 planos oficiais com preços, limite incluso e adicional", () => {
    const byName = Object.fromEntries(COMMERCIAL_PLANS.map((p) => [p.name, p]));
    expect(Object.keys(byName)).toEqual(["GONDUP Ponto", "GONDUP Merchandising", "GONDUP Completo"]);
    expect(byName["GONDUP Ponto"]).toMatchObject({ price: "199.90", includedUsers: 20, additionalUserPrice: "8.00" });
    expect(byName["GONDUP Merchandising"]).toMatchObject({ price: "179.90", includedUsers: 20, additionalUserPrice: "8.00" });
    expect(byName["GONDUP Completo"]).toMatchObject({ price: "350.00", includedUsers: 20, additionalUserPrice: "12.00" });
    expect(byName["GONDUP Ponto"].featureKeys).toContain("timeTracking");
    expect(byName["GONDUP Ponto"].featureKeys).not.toContain("visitCheckIn");
    expect(byName["GONDUP Merchandising"].featureKeys).toContain("visitCheckIn");
    expect(byName["GONDUP Merchandising"].featureKeys).toContain("products");
    expect(byName["GONDUP Merchandising"].featureKeys).not.toContain("timeTracking");
    expect(byName["GONDUP Completo"].featureKeys).toEqual(expect.arrayContaining([
      "timeTracking", "visitCheckIn", "products", "fieldOperations", "alerts",
    ]));
  });

  it("reconhece planos oficiais e legados pelo nome", () => {
    expect(isOfficialCommercialPlanName("GONDUP Ponto")).toBe(true);
    expect(isOfficialCommercialPlanName("gondup completo")).toBe(true);
    expect(isLegacyPlanName("Empresarial")).toBe(true);
    expect(isLegacyPlanName("Start")).toBe(true);
    expect(isLegacyPlanName("Basico")).toBe(true);
    expect(isLegacyPlanName("Ilimitado")).toBe(true);
    expect(isLegacyPlanName("GONDUP Ponto")).toBe(false);
  });

  it("no dropdown, planos inativos só aparecem se forem o plano atual da empresa", () => {
    const ponto = { id: 10, active: true };
    const empresarial = { id: 3, active: false };
    const start = { id: 1, active: 0 };
    expect(isSelectablePlan(ponto, 3)).toBe(true);
    expect(isSelectablePlan(empresarial, 3)).toBe(true);
    expect(isSelectablePlan(empresarial, 60001)).toBe(false);
    expect(isSelectablePlan(start, null)).toBe(false);
    expect(isSelectablePlan(start, 1)).toBe(true);
  });

  it("formata o rótulo no padrão GONDUP Ponto — R$ 199,90/mês", () => {
    const label = planSelectLabel({ name: "GONDUP Ponto", price: "199.90", billingCycle: "monthly", active: true });
    expect(label).toContain("GONDUP Ponto — ");
    expect(label).toContain("199,90");
    expect(label).toContain("/mês");
    expect(planSelectLabel({ name: "Empresarial", price: "169.90", billingCycle: "monthly", active: false })).toContain("(inativo)");
  });
});

describe("período do pagamento registrado", () => {
  it("se o vencimento está no futuro, começa nele e soma 1 mês", () => {
    expect(nextPaidPeriod("2026-12-30", "2026-11-15")).toEqual({ periodFrom: "2026-12-30", periodTo: "2027-01-30" });
  });

  it("se o vencimento já passou ou não existe, começa hoje e soma 1 mês", () => {
    expect(nextPaidPeriod("2026-10-30", "2026-11-15")).toEqual({ periodFrom: "2026-11-15", periodTo: "2026-12-15" });
    expect(nextPaidPeriod(null, "2026-11-15")).toEqual({ periodFrom: "2026-11-15", periodTo: "2026-12-15" });
    expect(nextPaidPeriod("", "2026-11-15")).toEqual({ periodFrom: "2026-11-15", periodTo: "2026-12-15" });
  });

  it("respeita o último dia do mês ao avançar de 31 para fevereiro", () => {
    expect(addCalendarMonthsIso("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonthsIso("2026-01-31", 2, 31)).toBe("2026-03-31");
  });
});
