import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("permissões do aceite dos termos", () => {
  it("só o admin da empresa aceita, e a sessão da plataforma não registra aceite", () => {
    const legal = src("server/legal.ts");
    expect(legal).toContain("companyAdminProcedure");
    expect(legal).toContain("ctx.actingAsPlatform");
    expect(legal).toContain("O aceite deve ser feito pelo administrador da empresa");
    expect(legal).toContain("CREATE TABLE IF NOT EXISTS legal_acceptances");
    expect(legal).toContain("ON DUPLICATE KEY UPDATE");
    expect(legal).not.toContain("companyManagerProcedure");
  });

  it("o modal não bloqueia o uso do app e não aparece para promotor ou supervisor", () => {
    const gate = src("client/src/components/TermsAcceptanceGate.tsx");
    expect(gate).toContain("readActAs");
    expect(gate).toContain("company_admin");
    expect(gate).toContain("sessionStorage");
    expect(gate).toContain("TERMS_SESSION_DISMISS_KEY");
    expect(gate).toContain("Li e aceito os Termos de Uso e a Política de Privacidade");
    expect(gate).toContain("Atualizamos nossos Termos");
    expect(gate).not.toContain("promoter");
  });
});
