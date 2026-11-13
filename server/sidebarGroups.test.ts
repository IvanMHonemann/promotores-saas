import { describe, expect, it } from "vitest";
import { buildCompanyGroups, buildPromoterNav, isItemActive } from "../client/src/lib/sidebarGroups";

const all = () => true;
const labels = (r: ReturnType<typeof buildCompanyGroups>) => r.groups.map((g) => [g.title, g.items.map((i) => i.label)]);

describe("menu lateral da empresa", () => {
  it("administrador vê todos os grupos, sem submenus", () => {
    const r = buildCompanyGroups("company_admin", all);
    expect(labels(r)).toEqual([
      ["Operação", ["Visão geral", "Lojas", "Roteiros", "Check-in / Check-out", "Produtos e validades"]],
      ["Equipe e ponto", ["Promotores e equipe", "Cartão-ponto", "Banco de horas", "Espelho de ponto", "Férias"]],
      ["Relatórios", ["Auditoria", "Ponto: prova legal", "Arquivos históricos"]],
    ]);
    expect(r.account.items.map((i) => i.label)).toEqual(["LGPD e privacidade", "Meus módulos", "Lixeira"]);
  });
  it("supervisor não vê grupos vazios nem itens de admin", () => {
    const r = buildCompanyGroups("supervisor", all);
    expect(r.groups.map((g) => g.title)).toEqual(["Operação", "Equipe e ponto"]);
    expect(r.account.items.map((i) => i.label)).toEqual(["Lixeira"]);
  });
  it("respeita módulos contratados", () => {
    const r = buildCompanyGroups("company_admin", (k) => k === "teamManagement");
    expect(labels(r)).toEqual([["Operação", ["Visão geral"]], ["Equipe", ["Promotores e equipe"]]]);
    const withProducts = buildCompanyGroups("company_admin", (k) => k === "teamManagement" || k === "products");
    expect(labels(withProducts)[0]).toEqual(["Operação", ["Visão geral", "Produtos e validades"]]);
  });
  it("sem ponto: some itens de ponto e o grupo vira Equipe", () => {
    const r = buildCompanyGroups("company_admin", (k) => k !== "timeTracking");
    const flat = r.groups.flatMap((g) => g.items.map((i) => i.href));
    expect(flat).not.toContain("/cartao-ponto");
    expect(flat).not.toContain("/espelho-ponto");
    expect(flat).not.toContain("/ponto-legal");
    expect(flat).not.toContain("/ferias");
    expect(r.groups.find((g) => g.id === "equipe")?.title).toBe("Equipe");
  });
  it("detecta item ativo", () => {
    expect(isItemActive("/#roteiros", "/", "#roteiros")).toBe(true);
    expect(isItemActive("/#inicio", "/", "#roteiros")).toBe(false);
    expect(isItemActive("/#inicio", "/", "")).toBe(true);
    expect(isItemActive("/#inicio", "/", "#inicio")).toBe(true);
    expect(isItemActive("/#inicio", "/lojas", "")).toBe(false);
    expect(isItemActive("/lojas", "/lojas/12", "")).toBe(true);
    expect(isItemActive("/ponto", "/ponto", "")).toBe(true);
    expect(isItemActive("/ponto", "/ponto", "#correcoes")).toBe(false);
    expect(isItemActive("/ponto#correcoes", "/ponto", "#correcoes")).toBe(true);
    expect(isItemActive("/ponto#correcoes", "/ponto", "")).toBe(false);
    expect(isItemActive("/", "/", "")).toBe(true);
    expect(isItemActive("/", "/", "#roteiro")).toBe(false);
    expect(isItemActive("/#roteiro", "/", "#roteiro")).toBe(true);
  });
});

describe("menu lateral do promotor", () => {
  const all = () => true;
  const labelsOf = (items: ReturnType<typeof buildPromoterNav>) => items.map((i) => i.label);
  const ponto = (items: ReturnType<typeof buildPromoterNav>) => items.find((i) => i.label === "Cartão ponto");

  it("agrupa as funções de ponto no dropdown Cartão ponto e mantém o restante na ordem", () => {
    const items = buildPromoterNav(all);
    expect(labelsOf(items)).toEqual([
      "Painel inicial",
      "Produtos e validades",
      "Cartão ponto",
      "Minhas férias",
      "Meus dados (LGPD)",
      "Lojas",
      "Meu roteiro",
      "Lixeira",
    ]);
    expect(ponto(items)?.children?.map((c) => [c.label, c.href])).toEqual([
      ["Cartão ponto", "/ponto"],
      ["Correções de ponto", "/ponto#correcoes"],
      ["Meus comprovantes", "/meus-comprovantes"],
      ["Meu espelho do mês", "/meu-espelho"],
    ]);
  });

  it("sem ponto, some o dropdown e Minhas férias", () => {
    const items = buildPromoterNav((k) => k !== "timeTracking");
    expect(labelsOf(items)).toEqual([
      "Painel inicial",
      "Produtos e validades",
      "Meus dados (LGPD)",
      "Lojas",
      "Meu roteiro",
      "Lixeira",
    ]);
    expect(items.some((i) => i.children?.length)).toBe(false);
  });

  it("sem produtos, some Produtos e validades", () => {
    const items = buildPromoterNav((k) => k === "timeTracking");
    expect(labelsOf(items)).not.toContain("Produtos e validades");
    expect(ponto(items)?.children).toHaveLength(4);
  });
});
