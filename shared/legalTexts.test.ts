import { describe, expect, it } from "vitest";
import { LEGAL_EFFECTIVE_DATE, LEGAL_TEXT_VERSION, LEGAL_TEXTS } from "./legalTexts";

const textOf = (kind: "termos" | "privacidade") => LEGAL_TEXTS[kind].flatMap((s) => [s.h, ...s.p]).join("\n");

describe("textos legais 1.0", () => {
  it("traz a versão e as cláusulas comerciais combinadas", () => {
    expect(LEGAL_TEXT_VERSION).toBe("1.0");
    expect(LEGAL_EFFECTIVE_DATE).toBe("2026-11-16");
    const termos = textOf("termos");
    expect(termos).toMatch(/licença de uso do software como serviço \(SaaS\)/i);
    expect(termos).toMatch(/Não há venda do software/);
    expect(termos).toMatch(/GONDUP Ponto/);
    expect(termos).toMatch(/GONDUP Merchandising/);
    expect(termos).toMatch(/GONDUP Completo/);
    expect(termos).toMatch(/20 funcionários/);
    expect(termos).toMatch(/conforme o plano contratado/);
    expect(termos).toMatch(/Pix/);
    expect(termos).toMatch(/IPCA/);
    expect(termos).toMatch(/multa de 2%/);
    expect(termos).toMatch(/juros de 1% ao mês/);
    expect(termos).toMatch(/10 dias/);
    expect(termos).toMatch(/30 dias de antecedência/);
    expect(termos).toMatch(/30 dias para exportar/);
    expect(termos).toMatch(/99%/);
    expect(termos).toMatch(/12 meses/);
    expect(termos).toMatch(/Portaria MTP 671\/2021/);
    expect(termos).toMatch(/Sapiranga\/RS/);
    expect(termos).toMatch(/contato@gondup\.com\.br/);
    expect(termos).toMatch(/\[PREENCHER\]/);
    expect(termos).not.toMatch(/R\$ 350/);
    expect(termos).not.toMatch(/199,90/);
  });

  it("descreve a LGPD com controlador, operador e suboperadores", () => {
    const priv = textOf("privacidade");
    expect(priv).toMatch(/controladora/);
    expect(priv).toMatch(/operador/);
    expect(priv).toMatch(/TiDB Cloud/);
    expect(priv).toMatch(/Cloudflare/);
    expect(priv).toMatch(/Locaweb/);
    expect(priv).toMatch(/Sentry/);
    expect(priv).toMatch(/e-mail transacional/i);
    expect(priv).toMatch(/5 anos/);
    expect(priv).toMatch(/Cookies/);
    expect(priv).toMatch(/contato@gondup\.com\.br/);
    expect(priv).not.toMatch(/Vercel/);
  });
});
