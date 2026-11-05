/**
 * Integração com MySQL de verdade (opcional): rode com LOCAL_MYSQL_URL=mysql://root@127.0.0.1:PORT/gondup.
 * Sem a variável, o arquivo é ignorado (CI usa o banco de teste próprio).
 */
import { beforeAll, describe, expect, it, vi } from "vitest";

const URL_ = process.env.LOCAL_MYSQL_URL;
vi.mock("mysql2/promise", async (orig) => {
  const m: any = await orig();
  const createPool = (o: any) => m.default.createPool({ ...o, ssl: undefined }); // MySQL local sem TLS
  return { ...m, createPool, default: { ...m.default, createPool } };
});
vi.mock("./entitlements", () => ({ assertMemberFeatureAccess: async () => {} }));
vi.mock("./audit", () => ({ auditFromCtx: async () => {} }));

const run = URL_ ? describe : describe.skip;
run("produtos e validades no MySQL", () => {
  let caller: any; let promoter: any; let other: any; let db: any; let raw: any;
  beforeAll(async () => {
    process.env.EXTERNAL_DATABASE_URL = URL_;
    db = await import("./db");
    const { productsRouter } = await import("./modules/products");
    raw = await db.getDb();
    const { sql } = await import("drizzle-orm");
    const q = (s: string) => raw.execute(sql.raw(s));
    await q("SET FOREIGN_KEY_CHECKS=0");
    for (const t of ["inventory_products", "inventory_product_requests", "store_clients", "promoter_store_assignments", "stores", "member_accounts", "system_settings"]) await q(`DROP TABLE IF EXISTS __x_${t}`).catch(() => {});
    await db.ensureInventoryProductsSchema();
    const { ensureStoreClientsSchema } = await import("./storeClients");
    await ensureStoreClientsSchema(raw);
    const { ensurePromoterStoreAssignmentsTable } = await import("./storeAccess");
    await ensurePromoterStoreAssignmentsTable(raw);
    for (const t of ["inventory_products", "inventory_product_requests", "store_clients", "promoter_store_assignments", "stores", "member_accounts"]) await q(`DELETE FROM ${t}`);
    await q("INSERT INTO stores (id, companyId, name, city, active) VALUES (1, 60001, 'Bistek Centro', 'POA', 1), (2, 60001, 'Loja Velha', 'POA', 0), (3, 60002, 'Outra empresa', 'POA', 1)");
    await q("INSERT INTO member_accounts (id, companyId, userName, email, passwordHash, role) VALUES (7, 60001, 'Ana', 'a@x', 'x', 'promoter'), (8, 60001, 'Bia', 'b@x', 'x', 'promoter')");
    await q("INSERT INTO promoter_store_assignments (companyId, promoterId, storeId) VALUES (60001, 7, 1)");
    await q("INSERT INTO store_clients (id, companyId, storeId, name) VALUES (10, 60001, 1, 'Nestlé'), (11, 60001, 1, 'Aurora')");
    // produto antigo numa loja que foi removida
    await q("INSERT INTO inventory_products (companyId, productCode, description, quantity, expirationDate, price, storeId, createdByMemberId) VALUES (60001, '111', 'Antigo', 3, '2026-01-10', 1.00, 2, 8)");
    const ctx = (role: string, memberAccountId: number | null) => ({ user: { role, name: "T" }, accountId: 60001, memberAccountId, req: { headers: {} }, res: {} });
    caller = productsRouter.createCaller(ctx("company_admin", null) as any);
    promoter = productsRouter.createCaller(ctx("promoter", 7) as any);
    other = productsRouter.createCaller(ctx("promoter", 8) as any);
  }, 60000);

  const base = { productCode: "7891000100103", description: "Leite Ninho", quantity: 5, expirationDate: "2030-01-15", price: "10.00", storeId: 1, storeClientId: 10, lot: "l1" };

  it("soma quantidade no mesmo produto/loja/indústria/lote/validade e não soma duas vezes no reenvio", async () => {
    const a = await promoter.create({ ...base, clientRequestId: "req-aaaaaaaa1" });
    expect(a.merged).toBe(false);
    const b = await promoter.create({ ...base, quantity: 2, clientRequestId: "req-aaaaaaaa2" });
    expect(b.merged).toBe(true);
    expect(b.product.quantity).toBe(7);
    const again = await promoter.create({ ...base, quantity: 2, clientRequestId: "req-aaaaaaaa2" });
    expect(again.duplicate).toBe(true);
    expect(again.product.quantity).toBe(7);
    const otherLot = await promoter.create({ ...base, lot: "L2", clientRequestId: "req-aaaaaaaa3" });
    expect(otherLot.merged).toBe(false);
    expect(a.product.lot).toBe("L1");
    expect(a.product.clientName).toBe("Nestlé");
  });

  it("recusa loja de outra empresa, loja removida e indústria de outra loja", async () => {
    await expect(caller.create({ ...base, storeId: 3, storeClientId: null, clientRequestId: "req-bbbbbbbb1" })).rejects.toThrow(/Loja não encontrada/);
    await expect(caller.create({ ...base, storeId: 2, storeClientId: null, clientRequestId: "req-bbbbbbbb2" })).rejects.toThrow(/removida/);
    await expect(caller.create({ ...base, storeId: null, storeClientId: 10, clientRequestId: "req-bbbbbbbb3" })).rejects.toThrow(/loja antes/);
  });

  it("lista paginada, loja removida e alerta com vencidos", async () => {
    const all = await caller.list({ page: 1, pageSize: 5 });
    expect(all.total).toBe(3);
    const old = all.items.find((p: any) => p.description === "Antigo");
    expect(old.storeActive).toBe(false);
    expect(old.storeName).toBe("Loja Velha");
    const s = await caller.summary();
    expect(s.expired).toBe(1);
    const alert = await caller.list({ expiry: "alert" });
    expect(alert.items.map((p: any) => p.description)).toEqual(["Antigo"]);
    const byIndustry = await caller.list({ clientName: "Nestlé" });
    expect(byIndustry.total).toBe(2);
    const none = await caller.list({ clientName: "__none__" });
    expect(none.total).toBe(1);
    const p2 = await caller.list({ page: 2, pageSize: 5 });
    expect(p2.items.length).toBe(0);
  });

  it("promotor vê só o próprio e lojas atribuídas; não exclui o dos outros", async () => {
    const mine = await other.list({});
    // Bia (8) não tem loja atribuída: vê só o que ela cadastrou.
    expect(mine.items.map((p: any) => p.description)).toEqual(["Antigo"]);
    expect(mine.items[0].canManage).toBe(true);
    const ana = await promoter.list({});
    expect(ana.items.map((p: any) => p.description)).not.toContain("Antigo");
    const id = ana.items.find((p: any) => p.description === "Leite Ninho").id;
    await expect(other.deleteMany({ ids: [id] })).rejects.toThrow(/só pode/);
  });

  it("CSV, janela configurável e lixeira/restauração com campos novos", async () => {
    const csv = await caller.exportCsv({});
    expect(csv.csv).toContain("Nestlé");
    expect(csv.csv).toContain("Loja Velha (loja removida)");
    await caller.setAlertDays({ days: 7 });
    expect((await caller.settings()).alertDays).toBe(7);
    const target = (await promoter.list({ search: "L2" })).items[0];
    await promoter.deleteMany({ ids: [target.id] });
    const trash = await db.listTrash(60001);
    const item = trash.find((t: any) => t.originalId === target.id);
    await db.restoreTrashItem(item.id, 60001);
    const back = (await caller.list({ search: "L2" })).items[0];
    expect(back.lot).toBe("L2");
    expect(back.expirationDate).toBe("2030-01-15");
    expect(back.storeClientId).toBe(10);
    expect((await caller.countByStore({ storeId: 1 })).count).toBe(2);
  });
});
