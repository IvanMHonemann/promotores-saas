import { describe, expect, it } from "vitest";
import { buildCompanyGroups, isItemActive } from "../client/src/lib/sidebarGroups";

const all = () => true;
const labels = (r: ReturnType<typeof buildCompanyGroups>) => r.groups.map((g) => [g.title, g.items.map((i) => i.label)]);

describe("menu lateral da empresa", () => {
  it("administrador vê todos os grupos, sem submenus", () => {
    const r = buildCompanyGroups("company_admin", all);
    expect(labels(r)).toEqual([
      ["Operação", ["Visão geral", "Lojas", "Roteiros", "Check-in / Check-out", "Produtos e validades"]],
      ["Equipe e ponto", ["Promotores e equipe", "Cartão-ponto", "Espelho de ponto", "Férias"]],
      ["Relatórios", ["Auditoria", "Arquivos históricos"]],
    ]);
    expect(r.account.items.map((i) => i.label)).toEqual(["Meus módulos", "Lixeira"]);
  });
  it("supervisor não vê grupos vazios nem itens de admin", () => {
    const r = buildCompanyGroups("supervisor", all);
    expect(r.groups.map((g) => g.title)).toEqual(["Operação", "Equipe e ponto"]);
    expect(r.account.items.map((i) => i.label)).toEqual(["Lixeira"]);
  });
  it("respeita módulos contratados", () => {
    const r = buildCompanyGroups("company_admin", (k) => k === "teamManagement");
    expect(labels(r)).toEqual([["Operação", ["Visão geral", "Produtos e validades"]], ["Equipe e ponto", ["Promotores e equipe"]]]);
  });
  it("detecta item ativo", () => {
    expect(isItemActive("/#roteiros", "/", "#roteiros")).toBe(true);
    expect(isItemActive("/#inicio", "/", "#roteiros")).toBe(false);
    expect(isItemActive("/#inicio", "/", "")).toBe(true);
    expect(isItemActive("/#inicio", "/", "#inicio")).toBe(true);
    expect(isItemActive("/#inicio", "/lojas", "")).toBe(false);
    expect(isItemActive("/lojas", "/lojas/12", "")).toBe(true);
  });
});
