import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ENTITLEMENT_KEYS, PLAN_FEATURES, resolveEntitlements } from "../shared/entitlements";
import { buildCompanyGroups } from "../client/src/lib/sidebarGroups";
import { buildSetupSteps } from "../client/src/components/SetupChecklist";
import { canManageFieldVisits, VISIT_CHECKIN_PATHS } from "../client/src/lib/visitAccess";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("módulo visitCheckIn", () => {
  it("existe no catálogo e nos planos profissional/empresarial, não no start", () => {
    expect(ENTITLEMENT_KEYS).toContain("visitCheckIn");
    expect(PLAN_FEATURES.start).not.toContain("visitCheckIn");
    expect(PLAN_FEATURES.profissional).toContain("visitCheckIn");
    expect(PLAN_FEATURES.empresarial).toContain("visitCheckIn");
    expect(PLAN_FEATURES.profissional).toContain("fieldOperations");
  });

  it("combinações ponto × check-in", () => {
    const base = { planFeatures: [...PLAN_FEATURES.empresarial] as const, role: "promoter" as const };
    expect(resolveEntitlements({ ...base, companyOverrides: { timeTracking: false, visitCheckIn: true } })).toMatchObject({
      timeTracking: false, visitCheckIn: true, fieldOperations: true,
    });
    expect(resolveEntitlements({ ...base, companyOverrides: { timeTracking: true, visitCheckIn: false } })).toMatchObject({
      timeTracking: true, visitCheckIn: false, fieldOperations: true,
    });
    expect(resolveEntitlements({ ...base, companyOverrides: { timeTracking: false, visitCheckIn: false } })).toMatchObject({
      timeTracking: false, visitCheckIn: false, fieldOperations: true,
    });
  });

  it("sem visitCheckIn: menu some e canManageFieldVisits bloqueia", () => {
    const admin = buildCompanyGroups("company_admin", (k) => k !== "visitCheckIn");
    expect(admin.groups.flatMap((g) => g.items.map((i) => i.href))).not.toContain("/check-in-out");
    expect(admin.groups.flatMap((g) => g.items.map((i) => i.label))).toContain("Lojas");
    expect(canManageFieldVisits({
      hasFieldOperations: true, hasVisitCheckIn: false, hasTimeTracking: false, shiftActive: false,
    })).toBe(false);
  });

  it("rotas e procedures de execução usam visitCheckIn; fotos/roteiro ficam em fieldOperations", () => {
    const app = src("client/src/App.tsx");
    for (const path of VISIT_CHECKIN_PATHS) {
      const line = app.split("\n").find((l) => l.includes(`path="${path}"`));
      expect(line, path).toBeTruthy();
      expect(line!).toContain('featureKey="visitCheckIn"');
    }
    const routers = src("server/routers.ts");
    expect(routers).toMatch(/start:\s*commercialFeatureProcedure\("visitCheckIn"\)/);
    expect(routers).toMatch(/complete:\s*commercialFeatureProcedure\("visitCheckIn"\)/);
    expect(routers).toMatch(/today:\s*commercialFeatureProcedure\("fieldOperations"\)/);
    expect(src("server/modules/storePhotos.ts")).toContain('commercialFeatureProcedure("fieldOperations")');
  });

  it("checklist sem check-in aponta para fotos de loja", () => {
    const step = buildSetupSteps({
      stores: 0, promoters: 0, routes: 0, activity: false, hasTimeTracking: false, hasVisitCheckIn: false,
    }).find((s) => s.key === "activity");
    expect(step?.label).toBe("Receber a primeira foto de loja");
    expect(step?.href).toBe("/lojas");
  });

  it("migração e boot fazem backfill default ON", () => {
    expect(src("drizzle/0030_visit_checkin_module.sql")).toContain("visitCheckIn");
    expect(src("drizzle/0030_visit_checkin_module.sql")).toContain("fieldOperations");
    expect(src("server/db.ts")).toContain("ensureVisitCheckInFeature");
    expect(src("server/entitlements.ts")).toContain("ensureVisitCheckInFeature");
    expect(src("docs/visit-checkin-module.md")).toContain("visitCheckIn");
  });
});
