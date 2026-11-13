import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MySqlDialect } from "drizzle-orm/mysql-core";

const state = vi.hoisted(() => ({ rows: [] as any[], executed: [] as string[], deleted: [] as number[][], featureAllowed: true }));
vi.mock("./db", () => ({
  getDb: async () => ({
    execute: async (q: any) => {
      const text = typeof q === "string" ? q : new (require("drizzle-orm/mysql-core").MySqlDialect)().sqlToQuery(q).sql;
      state.executed.push(text);
      if (/FROM inventory_products ip/.test(text)) return [state.rows];
      return [[]];
    },
  }),
  ensureInventoryProductsSchema: async () => {},
  getSetting: async () => "15",
  setSetting: async () => {},
  listOperationalStores: async () => [],
  deleteInventoryProducts: async (_c: number, ids: number[]) => { state.deleted.push(ids); return { deleted: ids.length }; },
}));
vi.mock("./entitlements", () => ({
  assertMemberFeatureAccess: async () => { if (!state.featureAllowed) throw Object.assign(new Error("O módulo “products” não está habilitado"), { code: "FORBIDDEN" }); },
}));
vi.mock("./audit", () => ({ auditFromCtx: async () => {} }));

import { productsRouter, buildWhere, inventoryAlertsFor } from "./modules/products";
import { canManageProduct, formatDateBR, groupByIndustry, isPastDate, isPlausibleExpiry, normalizeAlertDays, normalizeLot, productsCsv, situationLabel, storeLabel } from "../shared/products";
import { PLAN_FEATURES, resolveEntitlements, ENTITLEMENT_CATALOG } from "../shared/entitlements";
import { isDeletableMediaKey, isTenantMediaKey } from "./mediaKeys";
import { buildCompanyGroups } from "../client/src/lib/sidebarGroups";

const src = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const toSql = (q: any) => new MySqlDialect().sqlToQuery(q);
const ctxOf = (role: string, memberAccountId: number | null = 7) => ({ user: { role, name: "T" }, accountId: 60001, memberAccountId, req: { headers: {} } as any, res: {} as any } as any);
const row = (over: Partial<any> = {}) => ({ id: 1, companyId: 60001, productCode: "789", description: "Leite", quantity: 2, expirationDate: "2026-11-20", price: "5.00", storeId: null, storeClientId: null, lot: null, photoKey: null, createdByMemberId: 7, storeName: null, storeActive: null, clientName: null, createdByName: "Ana", ...over });

beforeEach(() => { state.rows = []; state.executed = []; state.deleted = []; state.featureAllowed = true; });

describe("regras puras de produtos e validades", () => {
  it("janela de alerta configurável com padrão 30", () => {
    expect(normalizeAlertDays("7")).toBe(7);
    expect(normalizeAlertDays("0")).toBe(30);
    expect(normalizeAlertDays("abc")).toBe(30);
    expect(normalizeAlertDays(999)).toBe(30);
  });
  it("promotor só gerencia o que cadastrou; admin e supervisor tudo", () => {
    expect(canManageProduct("company_admin", null, 3)).toBe(true);
    expect(canManageProduct("supervisor", 9, 3)).toBe(true);
    expect(canManageProduct("promoter", 3, 3)).toBe(true);
    expect(canManageProduct("promoter", 4, 3)).toBe(false);
    expect(canManageProduct("promoter", 4, null)).toBe(false);
  });
  it("datas de calendário sem fuso: dd/mm/aaaa, passado e datas inválidas", () => {
    expect(formatDateBR("2026-03-01")).toBe("01/03/2026");
    expect(isPastDate("2026-11-04", "2026-11-05")).toBe(true);
    expect(isPastDate("2026-11-05", "2026-11-05")).toBe(false);
    expect(isPlausibleExpiry("2026-02-30")).toBe(false);
    expect(isPlausibleExpiry("0202-11-05")).toBe(false);
    expect(isPlausibleExpiry("2027-02-28")).toBe(true);
    expect(situationLabel("2026-11-05", "2026-11-05", 30)).toBe("Vence hoje");
    expect(situationLabel("2026-11-04", "2026-11-05", 30)).toBe("Vencido");
    expect(situationLabel("2026-11-20", "2026-11-05", 7)).toBe("Em dia");
  });
  it("lote normalizado e loja removida", () => {
    expect(normalizeLot("  l12 ")).toBe("L12");
    expect(normalizeLot("")).toBeNull();
    expect(storeLabel({ storeId: 5, storeName: null })).toBe("Loja removida");
    expect(storeLabel({ storeId: 5, storeName: "Bistek", storeActive: false })).toBe("Bistek (loja removida)");
    expect(storeLabel({ storeId: null })).toBe("Sem loja");
  });
  it("CSV neutraliza fórmulas e usa ; com BOM", () => {
    const csv = productsCsv([{ productCode: "=HYPERLINK(\"x\")", description: "+cmd", quantity: 1, expirationDate: "2026-11-01", price: "2.5", clientName: "@Nestlé", storeId: null }], "2026-11-05", 30);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"'+cmd"`);
    expect(csv).toContain(`"'@Nestlé"`);
    expect(csv).toContain(`"01/11/2026";"Vencido";"2,50"`);
  });
  it("agrupa por marca/cliente com 'Sem marca/cliente' por último", () => {
    expect(groupByIndustry([{ clientName: null }, { clientName: "Ypê" }, { clientName: "Aurora" }]).map((g) => g.name)).toEqual(["Aurora", "Ypê", "Sem marca/cliente"]);
  });
});

describe("módulo por empresa", () => {
  it("está no catálogo, em todos os planos e liberado por padrão para os 3 perfis", () => {
    expect(ENTITLEMENT_CATALOG.some((m) => m.key === "products")).toBe(true);
    for (const plan of Object.values(PLAN_FEATURES)) expect(plan).toContain("products");
    for (const role of ["company_admin", "supervisor", "promoter"] as const) {
      expect(resolveEntitlements({ planFeatures: [...PLAN_FEATURES.start], role }).products).toBe(true);
      expect(resolveEntitlements({ planFeatures: [...PLAN_FEATURES.start], role, companyOverrides: { products: false } }).products).toBe(false);
    }
  });
  it("ligado/desligado independente de ponto e check-in", () => {
    const r = resolveEntitlements({ planFeatures: [...PLAN_FEATURES.empresarial], role: "promoter", companyOverrides: { timeTracking: false, fieldOperations: false } });
    expect(r.products).toBe(true);
  });
  it("menu e rota respeitam o módulo", () => {
    const off = buildCompanyGroups("company_admin", (k) => k !== "products").groups.flatMap((g) => g.items.map((i) => i.href));
    expect(off).not.toContain("/produtos");
    expect(src("client/src/App.tsx")).toContain('<Route path="/produtos"><CommercialProtected><FeatureProtected featureKey="products">');
    expect(src("client/src/lib/sidebarGroups.ts")).toContain('hasFeature("products") ? [{ href: "/produtos"');
  });
  it("todas as rotas do servidor exigem o módulo products", () => {
    const full = src("server/modules/products.ts");
    const code = full.slice(full.indexOf("export const productsRouter = router({"), full.indexOf("\n});", full.indexOf("export const productsRouter")));
    const procs = code.match(/^ {2}\w+: \w+(\("[a-zA-Z]+"\))?/gm) || [];
    expect(procs.length).toBeGreaterThan(10);
    for (const p of procs) expect(p, p).toContain('commercialFeatureProcedure("products")');
    expect(src("server/routers.ts")).toContain("products: productsRouter,");
  });
  it("painéis recebem lista vazia quando o módulo está desligado", async () => {
    state.featureAllowed = false;
    expect(await inventoryAlertsFor(ctxOf("promoter"))).toEqual([]);
  });
  it("migração 0031 com número único e default ON", () => {
    const m = src("drizzle/0031_products_module_validades.sql");
    expect(m).toContain("'products', 1");
    expect(m).toContain("storeClientId");
  });
});

describe("escopo e filtros no servidor", () => {
  it("sempre filtra pela empresa; promotor só vê o próprio ou lojas atribuídas", () => {
    const admin = toSql(buildWhere(ctxOf("company_admin"), {}, "2026-11-05", 30));
    expect(admin.sql).toContain("ip.companyId = ?");
    expect(admin.params).toContain(60001);
    expect(admin.sql).not.toContain("createdByMemberId");
    const promoter = toSql(buildWhere(ctxOf("promoter", 7), {}, "2026-11-05", 30));
    expect(promoter.sql).toContain("ip.createdByMemberId = ?");
    expect(promoter.sql).toContain("promoter_store_assignments");
  });
  it("'alerta' inclui vencidos (sem limite inferior) e usa a janela da empresa", () => {
    const q = toSql(buildWhere(ctxOf("company_admin"), { expiry: "alert" }, "2026-11-05", 7));
    expect(q.sql).toContain("ip.expirationDate <= ?");
    expect(q.sql).not.toContain("ip.expirationDate >= ?");
    expect(q.params).toContain("2026-11-12");
  });
  it("lista paginada devolve total e marca o que o usuário pode alterar", async () => {
    state.rows = [row({ createdByMemberId: 7 }), row({ id: 2, createdByMemberId: 8 })];
    const r = await productsRouter.createCaller(ctxOf("promoter", 7)).list({ page: 2, pageSize: 10 });
    expect(r.items.map((i) => i.canManage)).toEqual([true, false]);
    expect(r.alertDays).toBe(15);
    expect(state.executed.some((s) => /LIMIT \? OFFSET \?/.test(s))).toBe(true);
  });
});

describe("permissões de edição/exclusão (servidor)", () => {
  it("promotor não exclui produto de outro promotor", async () => {
    state.rows = [row({ createdByMemberId: 99 })];
    await expect(productsRouter.createCaller(ctxOf("promoter", 7)).deleteMany({ ids: [1] })).rejects.toThrow(/só pode alterar ou excluir produtos que você mesmo cadastrou/);
    expect(state.deleted).toEqual([]);
  });
  it("promotor exclui o próprio; supervisor exclui de qualquer um", async () => {
    state.rows = [row({ createdByMemberId: 7 })];
    await productsRouter.createCaller(ctxOf("promoter", 7)).deleteMany({ ids: [1] });
    state.rows = [row({ createdByMemberId: 99 })];
    await productsRouter.createCaller(ctxOf("supervisor", 3)).delete({ id: 1 });
    expect(state.deleted).toEqual([[1], [1]]);
  });
  it("promotor não edita produto de outro", async () => {
    state.rows = [row({ createdByMemberId: 99 })];
    await expect(productsRouter.createCaller(ctxOf("promoter", 7)).update({ id: 1, productCode: "789", description: "X", quantity: 1, expirationDate: "2026-12-01", price: "1.00" })).rejects.toThrow(/só pode alterar/);
  });
  it("só o administrador muda o prazo do alerta", async () => {
    await expect(productsRouter.createCaller(ctxOf("supervisor")).setAlertDays({ days: 7 })).rejects.toThrow(/administrador/);
    await expect(productsRouter.createCaller(ctxOf("company_admin")).setAlertDays({ days: 7 })).resolves.toEqual({ alertDays: 7 });
  });
  it("validade impossível é recusada", async () => {
    await expect(productsRouter.createCaller(ctxOf("company_admin")).create({ clientRequestId: "abcdefgh12", productCode: "789", description: "X", quantity: 1, expirationDate: "2026-02-30", price: "1.00" })).rejects.toThrow();
  });
});

describe("fotos da etiqueta no R2", () => {
  it("chaves product-photos da empresa são válidas e apagáveis; de outra empresa não", () => {
    expect(isTenantMediaKey("product-photos/60001/abc.jpg", 60001, ["product-photos"])).toBe(true);
    expect(isDeletableMediaKey("product-photos/60001/abc.jpg", 60001)).toBe(true);
    expect(isDeletableMediaKey("product-photos/2/abc.jpg", 60001)).toBe(false);
    expect(isDeletableMediaKey("backups/database/x", 60001)).toBe(false);
  });
});
