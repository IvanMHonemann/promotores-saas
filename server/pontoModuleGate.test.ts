import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveEntitlements, PLAN_FEATURES } from "../shared/entitlements";
import { buildCompanyGroups } from "../client/src/lib/sidebarGroups";
import { buildSetupSteps } from "../client/src/components/SetupChecklist";
import { canManageFieldVisits, TIME_TRACKING_PATHS } from "../client/src/lib/visitAccess";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("módulo ponto desligado — menu e rotas", () => {
  it("remove itens de ponto do menu admin/supervisor e renomeia o grupo", () => {
    const has = (k: string) => k !== "timeTracking";
    const admin = buildCompanyGroups("company_admin", has);
    const titles = admin.groups.map((g) => g.title);
    expect(titles).not.toContain("Equipe e ponto");
    expect(titles).toContain("Equipe");
    const labels = admin.groups.flatMap((g) => g.items.map((i) => i.label));
    for (const forbidden of ["Cartão-ponto", "Espelho de ponto", "Férias", "Ponto: prova legal", "Arquivos históricos"]) {
      expect(labels).not.toContain(forbidden);
    }
    // Check-in/out de visitas permanece (fieldOperations + reports)
    expect(labels).toContain("Check-in / Check-out");
  });

  it("FeatureProtected e menu do promotor cobrem todas as rotas TIME_TRACKING_PATHS", () => {
    const app = src("client/src/App.tsx");
    const nav = src("client/src/components/SidebarNav.tsx");
    for (const path of TIME_TRACKING_PATHS) {
      expect(app, path).toContain(`path="${path}"`);
      expect(app, path).toContain('featureKey="timeTracking"');
    }
    // Links do promotor só entram com hasFeature("timeTracking")
    expect(nav).toContain('hasFeature("timeTracking")');
    expect(nav).toContain("/meus-comprovantes");
    expect(nav).toContain("/meu-espelho");
  });

  it("empresa com override timeTracking=false não recebe o módulo", () => {
    const result = resolveEntitlements({
      planFeatures: [...PLAN_FEATURES.empresarial],
      companyOverrides: { timeTracking: false },
      role: "promoter",
    });
    expect(result.timeTracking).toBe(false);
    expect(result.fieldOperations).toBe(true);
  });
});

describe("check-in de visita sem ponto", () => {
  it("libera visitas quando fieldOperations está on e ponto off", () => {
    expect(canManageFieldVisits({
      hasFieldOperations: true,
      hasTimeTracking: false,
      shiftActive: false,
      shiftLoading: false,
    })).toBe(true);
  });

  it("com ponto ligado, exige jornada ativa", () => {
    expect(canManageFieldVisits({
      hasFieldOperations: true,
      hasTimeTracking: true,
      shiftActive: false,
    })).toBe(false);
    expect(canManageFieldVisits({
      hasFieldOperations: true,
      hasTimeTracking: true,
      shiftActive: true,
    })).toBe(true);
  });

  it("servidor de visitas NÃO exige jornada aberta (só fieldOperations)", () => {
    const routers = src("server/routers.ts");
    // A mutation start usa fieldOperations, sem assert de timeTracking/shift
    expect(routers).toMatch(/start:\s*commercialFeatureProcedure\("fieldOperations"\)/);
    const startBlock = routers.slice(routers.indexOf('start: commercialFeatureProcedure("fieldOperations")'));
    const snippet = startBlock.slice(0, 2500);
    expect(snippet).not.toMatch(/timeTracking|shiftStatus|clock_in_required|jornada/i);
  });

  it("dashboard do promotor usa canManageFieldVisits", () => {
    const dash = src("client/src/pages/promoter/PromoterDashboard.tsx");
    expect(dash).toContain("canManageFieldVisits");
    expect(dash).not.toContain("hasFieldOperations && active && !shift.isLoading");
  });
});

describe("alertas e checklist sem ponto", () => {
  it("alertas de ponto só consultam tRPC com timeTracking liberado", () => {
    expect(src("client/src/components/MissingPunchAlert.tsx")).toContain("hasTimeTracking");
    expect(src("client/src/components/RejectedCorrectionAlert.tsx")).toContain("hasTimeTracking");
  });

  it("checklist não fala em batida quando ponto está off", () => {
    const steps = buildSetupSteps({ stores: 1, promoters: 1, routes: 1, activity: false, hasTimeTracking: false });
    expect(steps.find((s) => s.key === "activity")?.label).toBe("Receber a primeira foto de visita");
    expect(steps.find((s) => s.key === "activity")?.label).not.toMatch(/batida/i);
  });

  it("e-mails de batida faltante respeitam módulo da empresa", () => {
    const maint = src("server/scheduledMaintenance.ts");
    expect(maint).toContain("companyFeatures.timeTracking");
  });

  it("banner de cobrança não depende do módulo de ponto", () => {
    const banner = src("client/src/components/PaymentReminderBanner.tsx");
    expect(banner).not.toMatch(/timeTracking|time_tracking|Punch|jornada/i);
  });
});
