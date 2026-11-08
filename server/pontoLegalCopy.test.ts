import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { isCompanyActionableWarning, simplifyExportWarning, simplifyIntegrityProblem } from "../client/src/lib/pontoLegalCopy";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const FORBIDDEN_IN_COMPANY_UI = [
  "GONDUP_DEVELOPER",
  "SHA-256",
  "hash SHA",
  "ICP-Brasil",
  ".p7s",
  "REP-P",
  "art. 91",
  "Portaria 671",
  "INPI",
  "NSR e cadeia",
  "hash SHA-256 encadeado",
];

describe("ponto legal — cópia para a empresa", () => {
  it("página da empresa não mostra pendências do dono nem jargão técnico", () => {
    const page = src("client/src/pages/admin/PontoLegalPage.tsx");
    for (const bad of FORBIDDEN_IN_COMPANY_UI) {
      expect(page, bad).not.toContain(bad);
    }
    expect(page).toContain("número em sequência");
    expect(page).toContain("lacre de segurança");
    expect(page).toContain("nunca apagam");
    expect(page).toContain("Conferir se os registros estão intactos");
    expect(page).toContain("arquivo oficial de batidas");
    expect(page).not.toContain("Verificar integridade");
    expect(page).not.toContain("GONDUP_");
  });

  it("status da empresa não devolve INPI/desenvolvedor/assinatura", () => {
    const router = src("server/ponto/router.ts");
    const companyStatus = router.slice(router.indexOf("/** Situação para a empresa"), router.indexOf("platformStatus"));
    expect(companyStatus).toContain("employerAddress");
    expect(companyStatus).toContain("workersMissingCpf");
    expect(companyStatus).not.toContain("inpiNumber");
    expect(companyStatus).not.toContain("developerDocument");
    expect(companyStatus).not.toContain("GONDUP_");
  });

  it("plataforma tem tela própria com pendências do dono", () => {
    const plat = src("client/src/pages/platform/PlatformPontoLegalPage.tsx");
    expect(plat).toContain("INPI");
    expect(plat).toContain("GONDUP_DEVELOPER_DOCUMENT");
    expect(plat).toContain("ICP-Brasil");
    expect(src("client/src/App.tsx")).toContain("/plataforma/ponto-legal");
    expect(src("client/src/components/SidebarNav.tsx")).toContain("/plataforma/ponto-legal");
  });

  it("avisos de exportação filtrados e simplificados", () => {
    expect(isCompanyActionableWarning("Arquivo sem assinatura digital (.p7s): ICP-Brasil")).toBe(false);
    expect(isCompanyActionableWarning("Sem número de registro no INPI")).toBe(false);
    expect(isCompanyActionableWarning("Falta o CNPJ da empresa")).toBe(true);
    expect(simplifyExportWarning("Há funcionários sem jornada contratual configurada (registro 04)")).toMatch(/horário de trabalho/i);
  });

  it("problemas de integridade em linguagem simples", () => {
    expect(simplifyIntegrityProblem({ kind: "hash", nsr: 3 })).toMatch(/batida nº 3/i);
    expect(simplifyIntegrityProblem({ kind: "chain", nsr: 2 })).toMatch(/lacre/i);
    expect(simplifyIntegrityProblem({ kind: "gap", nsr: 5 })).not.toMatch(/NSR/);
  });

  it("comprovante e espelho não empurram INPI/ICP/SHA para o cliente", () => {
    const receipt = src("server/ponto/receipt.ts");
    expect(receipt).not.toContain("Assinatura digital ICP-Brasil pendente");
    expect(receipt).not.toContain("Registro do programa no INPI ainda não concluído");
    expect(receipt).toContain("Número da batida");
    expect(receipt).toContain("Código de segurança da batida");
    const disclaimer = src("client/src/lib/mirrorExport.ts");
    expect(disclaimer).not.toMatch(/INPI|ICP-Brasil|REP-P/);
    const my = src("client/src/pages/promoter/MyReceiptsPage.tsx");
    expect(my).not.toContain("código hash");
    expect(my).not.toMatch(/\bNSR\b/);
  });

  it("export AFD/AEJ não devolve avisos de INPI/ICP para a empresa", () => {
    const router = src("server/ponto/router.ts");
    const afdBlock = router.slice(router.indexOf("exportAfd:"), router.indexOf("exportAej:"));
    expect(afdBlock).not.toContain("INPI");
    expect(afdBlock).not.toContain("ICP-Brasil");
    expect(afdBlock).not.toContain(".p7s");
    const aejWarn = router.slice(router.indexOf("exportAej:"), router.indexOf("exportAej:") + 3500);
    expect(aejWarn).not.toContain("ICP-Brasil");
    expect(aejWarn).not.toContain(".p7s");
  });
});
