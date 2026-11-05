import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSetupSteps } from "../client/src/components/SetupChecklist";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

describe("checklist de implantação", () => {
  it("marca cada passo conforme os dados", () => {
    const steps = buildSetupSteps({ stores: 2, promoters: 0, routes: 0, activity: false });
    expect(steps.map((s) => s.done)).toEqual([true, false, false, false]);
    expect(buildSetupSteps({ stores: 1, promoters: 1, routes: 1, activity: true }).every((s) => s.done)).toBe(true);
  });
  it("sem ponto, o passo de atividade fala só em foto", () => {
    expect(buildSetupSteps({ stores: 0, promoters: 0, routes: 0, activity: false, hasTimeTracking: false }).find((s) => s.key === "activity")?.label).toMatch(/foto/i);
    expect(buildSetupSteps({ stores: 0, promoters: 0, routes: 0, activity: false, hasTimeTracking: false }).find((s) => s.key === "activity")?.label).not.toMatch(/batida/i);
  });
});

describe("confirmações", () => {
  it("nenhuma exclusão usa mais o confirm() do navegador", () => {
    for (const f of ["client/src/pages/ProductsPage.tsx", "client/src/pages/StoreGalleryPage.tsx", "client/src/pages/StoresPage.tsx", "client/src/pages/TrashPage.tsx", "client/src/pages/operations/OperationsDashboard.tsx", "client/src/components/StoreClientsPanel.tsx", "client/src/pages/platform/PlatformCompaniesPage.tsx"]) {
      expect(src(f), f).not.toMatch(/(window\.|[^.\w])confirm\(/);
    }
  });
  it("produtos e fotos oferecem Desfazer", () => {
    expect(src("client/src/pages/ProductsPage.tsx")).toContain("toastWithUndo");
    expect(src("client/src/pages/StoreGalleryPage.tsx")).toContain("toastWithUndo");
  });
});

describe("telas guiadas", () => {
  it("correção pergunta o que aconteceu", () => expect(src("client/src/pages/promoter/PromoterClockPage.tsx")).toContain("O que aconteceu?"));
  it("horário de aviso fica em Configurações do ponto", () => expect(src("client/src/pages/admin/TimesheetPage.tsx")).toContain("Configurações do ponto"));
  it("botões têm 44px no celular", () => expect(src("client/src/components/ui/button.tsx")).toContain('sm: "h-11 sm:h-8'));
});
