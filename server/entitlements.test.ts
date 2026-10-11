import { describe, expect, it } from "vitest";
import { PLAN_FEATURES, resolveEntitlements } from "../shared/entitlements";

describe("resolução de módulos", () => {
  it("mantém a matriz comercial aprovada para os três planos", () => {
    expect(PLAN_FEATURES.start).not.toContain("timeTracking");
    expect(PLAN_FEATURES.start).not.toContain("fieldOperations");
    expect(PLAN_FEATURES.profissional).toContain("timeTracking");
    expect(PLAN_FEATURES.profissional).toContain("teamManagement");
    expect(PLAN_FEATURES.empresarial).toContain("backup");
    expect(PLAN_FEATURES.empresarial).toContain("offline");
  });

  it("não permite que a permissão individual ultrapasse o plano ou uma negação da empresa", () => {
    const result = resolveEntitlements({
      planFeatures: [...PLAN_FEATURES.start],
      companyOverrides: { clients: false, timeTracking: true },
      role: "company_admin",
      memberOverrides: { clients: "allow", timeTracking: "allow" },
    });
    expect(result.clients).toBe(false);
    expect(result.timeTracking).toBe(true);
  });

  it("aplica o teto do papel mesmo quando empresa e membro tentam liberar um módulo", () => {
    const result = resolveEntitlements({
      planFeatures: [...PLAN_FEATURES.empresarial],
      role: "promoter",
      memberOverrides: { clients: "allow", teamManagement: "allow" },
    });
    expect(result.dashboard).toBe(true);
    expect(result.timeTracking).toBe(true);
    expect(result.clients).toBe(false);
    expect(result.teamManagement).toBe(false);
  });

  it("permite exceção da empresa dentro do teto do papel e respeita bloqueio individual", () => {
    const result = resolveEntitlements({
      planFeatures: [...PLAN_FEATURES.start],
      companyOverrides: { fieldOperations: true },
      role: "supervisor",
      memberOverrides: { fieldOperations: "allow", dashboard: "deny" },
    });
    expect(result.fieldOperations).toBe(true);
    expect(result.dashboard).toBe(false);
  });

  it("não concede por padrão módulos fora das permissões padrão de supervisor", () => {
    const result = resolveEntitlements({
      planFeatures: [...PLAN_FEATURES.empresarial],
      role: "supervisor",
    });
    expect(result.teamManagement).toBe(false);
    expect(result.backup).toBe(false);
    expect(result.reports).toBe(false);
  });
});
