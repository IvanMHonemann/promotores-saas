import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ENTITLEMENT_CATALOG } from "../shared/entitlements";

const read = (p: string) => readFileSync(p, "utf8");

describe("ajustes rápidos de UX", () => {
  it("módulos usam termos simples", () => {
    const text = ENTITLEMENT_CATALOG.map((e) => `${e.label} ${e.description}`).join(" ");
    expect(text).not.toMatch(/PWA|Backup|trilha/);
    expect(text).toContain("Funciona sem internet");
  });
  it("supervisor não recebe aviso de batida faltante", () => {
    expect(read("client/src/components/MissingPunchAlert.tsx")).toMatch(/const isField = role === "promoter";/);
  });
  it("Cartão ponto tem o botão de bater ponto", () => {
    expect(read("client/src/pages/promoter/PromoterClockPage.tsx")).toContain("<PunchPanel />");
  });
  it("admin geral não pede GPS na visão geral", () => {
    const s = read("client/src/pages/platform/PlatformDashboard.tsx");
    expect(s).toContain('if (section !== "time") return;');
    expect(s).not.toContain('value: "04"');
  });
});
