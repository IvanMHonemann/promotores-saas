import { describe, expect, it } from "vitest";
import { NO_STORE_LABEL, NO_STORE_ROUTE_KEY, canManageStores, normalizeStoreIds, planStoreAssignments } from "../shared/stores";

describe("canManageStores", () => {
  it("permite somente administrador e supervisor da empresa", () => {
    expect(canManageStores("company_admin")).toBe(true);
    expect(canManageStores("supervisor")).toBe(true);
    expect(canManageStores("promoter")).toBe(false);
    expect(canManageStores("platform_admin")).toBe(false);
    expect(canManageStores("oauth_user")).toBe(false);
    expect(canManageStores(undefined)).toBe(false);
    expect(canManageStores(null)).toBe(false);
  });
});

describe("normalizeStoreIds", () => {
  it("remove repetidos e valores inválidos mantendo a ordem", () => {
    expect(normalizeStoreIds([3, 1, 3, 2, 1])).toEqual([3, 1, 2]);
    expect(normalizeStoreIds([0, -1, 1.5, Number.NaN, 4])).toEqual([4]);
    expect(normalizeStoreIds(undefined)).toEqual([]);
    expect(normalizeStoreIds(null)).toEqual([]);
  });
});

describe("planStoreAssignments", () => {
  it("não mexe nos vínculos quando a lista não foi enviada e não há roteiro", () => {
    expect(planStoreAssignments(undefined)).toEqual({ mode: "keep", storeIds: [] });
    expect(planStoreAssignments(undefined, [])).toEqual({ mode: "keep", storeIds: [] });
  });

  it("só acrescenta as lojas do roteiro quando a lista não foi enviada", () => {
    expect(planStoreAssignments(undefined, [5, 5, 6])).toEqual({ mode: "add", storeIds: [5, 6] });
  });

  it("lista vazia remove todas as lojas (vínculo é opcional)", () => {
    expect(planStoreAssignments([])).toEqual({ mode: "replace", storeIds: [] });
  });

  it("substitui pela lista informada e inclui as lojas do roteiro", () => {
    expect(planStoreAssignments([1, 2, 2], [2, 3])).toEqual({ mode: "replace", storeIds: [1, 2, 3] });
  });
});

describe("fotos sem loja", () => {
  it("usa o nome e a rota combinados", () => {
    expect(NO_STORE_LABEL).toBe("Sem loja vinculada");
    expect(NO_STORE_ROUTE_KEY).toBe("sem-loja");
  });
});
