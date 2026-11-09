/**
 * Módulo "Produtos e validades" (featureKey `products`).
 *
 * - Tudo filtrado por empresa (companyId) no servidor.
 * - Promotor vê os produtos que cadastrou e os das lojas atribuídas a ele; edita/exclui só os próprios.
 *   Administrador e supervisor vêem e mexem em tudo da empresa.
 * - Mesmo produto + loja + indústria + lote + validade: soma a quantidade em vez de criar outra linha.
 * - Cadastro com UUID do aparelho (clientRequestId): reenvio nunca duplica nem soma duas vezes.
 * - Janela de alerta configurável por empresa (padrão 30 dias); "alerta" sempre inclui os vencidos.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sql, type SQL } from "drizzle-orm";
import * as db from "../db";
import { commercialFeatureProcedure, router } from "../_core/trpc";
import { auditFromCtx } from "../audit";
import { assertStoreAccess, ensurePromoterStoreAssignmentsTable, hasFullStoreAccess, scopeMemberId, storeAssignedToPromoter } from "../storeAccess";
import { ensureStoreClientsSchema } from "../storeClients";
import { detectImageMime, guardedStorageDelete, isTenantMediaKey, safeKeySegment } from "../mediaKeys";
import { MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE } from "../../shared/uploadLimits";
import { addDays, todayInZone } from "../../shared/expiry";
import { canManageProduct, isPlausibleExpiry, normalizeAlertDays, normalizeLot, PRODUCTS_ALERT_DAYS_KEY, PRODUCTS_EXPORT_LIMIT, PRODUCTS_PAGE_SIZE, productsCsv } from "../../shared/products";

const rowsOf = (r: any): any[] => (Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? []);
/** O driver do Drizzle devolve DATE como texto "AAAA-MM-DD"; Date (se vier) é meia-noite UTC. */
const isoDate = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10));

export type ProductRow = {
  id: number; companyId: number; productCode: string; description: string; quantity: number; expirationDate: string; price: string;
  storeId: number | null; storeClientId: number | null; lot: string | null; photoKey: string | null; createdByMemberId: number | null;
  createdAt: string; updatedAt: string;
  storeName: string | null; storeActive: boolean | null; clientName: string | null; createdByName: string | null; canManage: boolean;
};

type Ctx = { user: { role: string; name?: string | null }; accountId: number; memberAccountId?: number | null };

async function ready() {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  await db.ensureInventoryProductsSchema();
  await ensureStoreClientsSchema(database);
  await ensurePromoterStoreAssignmentsTable(database as any);
  return database;
}

export async function getProductsAlertDays(companyId: number): Promise<number> {
  try { return normalizeAlertDays(await db.getSetting(PRODUCTS_ALERT_DAYS_KEY, companyId, "30")); } catch { return 30; }
}

export const listFilters = z.object({
  search: z.string().trim().max(100).optional(),
  expiry: z.enum(["all", "expired", "near", "alert", "valid"]).optional(),
  storeId: z.number().int().positive().optional(),
  storeClientId: z.number().int().positive().optional(),
  /** Nome da indústria (agrupa a mesma indústria cadastrada em lojas diferentes). */
  clientName: z.string().trim().max(255).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mine: z.boolean().optional(),
});
export type ListFilters = z.infer<typeof listFilters>;

/** WHERE comum (empresa + escopo do promotor + filtros). Exportado para teste. */
export function buildWhere(ctx: Ctx, f: ListFilters, today: string, alertDays: number): SQL {
  const parts: SQL[] = [sql`ip.companyId = ${ctx.accountId}`];
  const memberId = hasFullStoreAccess(ctx as any) ? null : (ctx.memberAccountId ?? -1);
  if (memberId !== null) parts.push(sql`(ip.createdByMemberId = ${memberId} OR (ip.storeId IS NOT NULL AND ${storeAssignedToPromoter(sql`ip.storeId`, memberId)}))`);
  if (f.mine && ctx.memberAccountId) parts.push(sql`ip.createdByMemberId = ${ctx.memberAccountId}`);
  const search = f.search?.trim();
  if (search) {
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    parts.push(sql`(LOWER(ip.productCode) LIKE ${pattern} OR LOWER(ip.description) LIKE ${pattern} OR LOWER(COALESCE(ip.lot, '')) LIKE ${pattern})`);
  }
  const limit = addDays(today, alertDays);
  if (f.expiry === "expired") parts.push(sql`ip.expirationDate < ${today}`);
  if (f.expiry === "near") parts.push(sql`ip.expirationDate >= ${today} AND ip.expirationDate <= ${limit}`);
  if (f.expiry === "alert") parts.push(sql`ip.expirationDate <= ${limit}`);
  if (f.expiry === "valid") parts.push(sql`ip.expirationDate > ${limit}`);
  if (f.storeId) parts.push(sql`ip.storeId = ${f.storeId}`);
  if (f.storeClientId) parts.push(sql`ip.storeClientId = ${f.storeClientId}`);
  if (f.clientName) parts.push(f.clientName === "__none__" ? sql`c.name IS NULL` : sql`c.name = ${f.clientName}`);
  if (f.from) parts.push(sql`ip.expirationDate >= ${f.from}`);
  if (f.to) parts.push(sql`ip.expirationDate <= ${f.to}`);
  return sql.join(parts, sql` AND `);
}

const FROM = sql`FROM inventory_products ip
  LEFT JOIN stores s ON s.id = ip.storeId AND s.companyId = ip.companyId
  LEFT JOIN store_clients c ON c.id = ip.storeClientId AND c.companyId = ip.companyId
  LEFT JOIN member_accounts m ON m.id = ip.createdByMemberId AND m.companyId = ip.companyId`;
const COLUMNS = sql`ip.id, ip.companyId, ip.productCode, ip.description, ip.quantity, ip.expirationDate, ip.price, ip.storeId, ip.storeClientId, ip.lot, ip.photoKey,
  ip.createdByMemberId, ip.createdAt, ip.updatedAt, s.name AS storeName, s.active AS storeActive, c.name AS clientName, m.userName AS createdByName`;

function mapRow(ctx: Ctx, r: any): ProductRow {
  return {
    ...r,
    id: Number(r.id), companyId: Number(r.companyId), quantity: Number(r.quantity ?? 0), price: String(r.price ?? "0.00"),
    expirationDate: isoDate(r.expirationDate),
    storeId: r.storeId == null ? null : Number(r.storeId), storeClientId: r.storeClientId == null ? null : Number(r.storeClientId),
    createdByMemberId: r.createdByMemberId == null ? null : Number(r.createdByMemberId),
    storeActive: r.storeActive == null ? null : Boolean(Number(r.storeActive)),
    canManage: canManageProduct(ctx.user.role, ctx.memberAccountId, r.createdByMemberId == null ? null : Number(r.createdByMemberId)),
  };
}

export async function queryProducts(ctx: Ctx, f: ListFilters, opts: { limit: number; offset?: number }) {
  const database = await ready();
  const today = todayInZone();
  const alertDays = await getProductsAlertDays(ctx.accountId);
  const where = buildWhere(ctx, f, today, alertDays);
  const items = rowsOf(await database.execute(sql`SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY ip.expirationDate ASC, ip.description ASC, ip.id ASC LIMIT ${opts.limit} OFFSET ${opts.offset ?? 0}`)).map((r) => mapRow(ctx, r));
  return { items, today, alertDays, where, database };
}

async function loadOne(ctx: Ctx, id: number): Promise<ProductRow | null> {
  const database = await ready();
  const r = rowsOf(await database.execute(sql`SELECT ${COLUMNS} ${FROM} WHERE ip.id = ${id} AND ip.companyId = ${ctx.accountId} LIMIT 1`))[0];
  return r ? mapRow(ctx, r) : null;
}

async function loadManageable(ctx: Ctx, id: number): Promise<ProductRow> {
  const row = await loadOne(ctx, id);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Produto não encontrado." });
  if (!row.canManage) throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode alterar ou excluir produtos que você mesmo cadastrou." });
  return row;
}

/** Loja precisa ser visível ao usuário; indústria precisa ser dessa loja e estar ativa. */
async function validatePlace(ctx: Ctx, storeId: number | null | undefined, storeClientId: number | null | undefined) {
  const database = await ready();
  if (!storeId) {
    if (storeClientId) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha a loja antes da marca/cliente." });
    return { storeId: null, storeClientId: null };
  }
  const store = await assertStoreAccess(database, ctx as any, storeId);
  if (!store.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Essa loja foi removida. Escolha outra loja." });
  if (storeClientId) {
    const c = rowsOf(await database.execute(sql`SELECT id FROM store_clients WHERE id = ${storeClientId} AND companyId = ${ctx.accountId} AND storeId = ${storeId} AND active = true LIMIT 1`))[0];
    if (!c) throw new TRPCError({ code: "BAD_REQUEST", message: "Marca/cliente não encontrada nesta loja." });
  }
  return { storeId, storeClientId: storeClientId ?? null };
}

async function uploadLabelPhoto(companyId: number, base64: string, requestId: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const mime = detectImageMime(buffer);
  if (!mime) throw new TRPCError({ code: "BAD_REQUEST", message: "A foto precisa ser uma imagem (JPG, PNG ou WebP)." });
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const { storagePut } = await import("../storage");
  try {
    const { key } = await storagePut(`product-photos/${companyId}/${safeKeySegment(requestId)}.${ext}`, buffer, mime);
    return key;
  } catch {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar a foto da etiqueta agora. Tente sem a foto ou mais tarde." });
  }
}

async function deleteLabelPhoto(companyId: number, key: string | null | undefined) {
  if (!key) return;
  const { storageDelete } = await import("../storage");
  await guardedStorageDelete(storageDelete, key, companyId).catch(() => false);
}

const productFields = {
  productCode: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(0).max(1_000_000),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isPlausibleExpiry, "Data de validade inválida."),
  price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  storeId: z.number().int().positive().nullish(),
  storeClientId: z.number().int().positive().nullish(),
  lot: z.string().trim().max(64).nullish(),
  photoBase64: z.string().min(100).max(MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE).optional(),
};

const nullSafe = (col: string, v: unknown) => (v == null ? sql.raw(`${col} IS NULL`) : sql`${sql.raw(col)} = ${v}`);

export const productsRouter = router({
  settings: commercialFeatureProcedure("products").query(async ({ ctx }) => ({ alertDays: await getProductsAlertDays(ctx.accountId) })),
  setAlertDays: commercialFeatureProcedure("products").input(z.object({ days: z.number().int().min(1).max(180) })).mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "company_admin") throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador pode mudar o prazo de alerta." });
    await db.setSetting(PRODUCTS_ALERT_DAYS_KEY, String(input.days), ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "products", entityType: "settings", description: `Alerta de validade: ${input.days} dias antes`, newData: input });
    return { alertDays: input.days };
  }),

  /** Lojas ativas visíveis ao usuário (não depende do módulo de lojas/roteiros estar ligado). */
  stores: commercialFeatureProcedure("products").query(async ({ ctx }) => {
    await ready();
    return (await db.listOperationalStores(ctx.accountId, undefined, scopeMemberId(ctx))).map((s: any) => ({ id: s.id, name: s.name, city: s.city }));
  }),
  /** Indústrias (clientes) ativas de uma loja. */
  storeClients: commercialFeatureProcedure("products").input(z.object({ storeId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const database = await ready();
    await assertStoreAccess(database, ctx, input.storeId);
    return rowsOf(await database.execute(sql`SELECT id, name FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true ORDER BY name`)).map((r) => ({ id: Number(r.id), name: String(r.name) }));
  }),
  /** Nomes de indústria usados nos produtos visíveis (filtro e agrupamento do relatório). */
  industries: commercialFeatureProcedure("products").query(async ({ ctx }) => {
    const database = await ready();
    const where = buildWhere(ctx, {}, todayInZone(), 30);
    return rowsOf(await database.execute(sql`SELECT DISTINCT c.name AS name ${FROM} WHERE ${where} AND c.name IS NOT NULL ORDER BY c.name LIMIT 500`)).map((r) => String(r.name));
  }),

  lookupByCode: commercialFeatureProcedure("products").input(z.object({ code: z.string().trim().min(6).max(64) })).query(async ({ ctx, input }) => {
    const { lookupProductByCode } = await import("../productLookup");
    return lookupProductByCode(ctx.accountId, input.code);
  }),

  /** Lista paginada e filtrada no servidor. */
  list: commercialFeatureProcedure("products").input(listFilters.extend({ page: z.number().int().min(1).max(10_000).optional(), pageSize: z.number().int().min(5).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
    const f = input ?? {};
    const pageSize = f.pageSize ?? PRODUCTS_PAGE_SIZE;
    const page = f.page ?? 1;
    const { items, alertDays, where, database, today } = await queryProducts(ctx, f, { limit: pageSize, offset: (page - 1) * pageSize });
    const total = Number(rowsOf(await database.execute(sql`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`))[0]?.n ?? 0);
    return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), alertDays, today };
  }),

  /** Contagem do alerta: vencidos + que vencem dentro da janela da empresa. */
  summary: commercialFeatureProcedure("products").query(async ({ ctx }) => {
    const database = await ready();
    const today = todayInZone();
    const alertDays = await getProductsAlertDays(ctx.accountId);
    const where = buildWhere(ctx, {}, today, alertDays);
    const r = rowsOf(await database.execute(sql`SELECT
      SUM(CASE WHEN ip.expirationDate < ${today} THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN ip.expirationDate >= ${today} AND ip.expirationDate <= ${addDays(today, alertDays)} THEN 1 ELSE 0 END) AS near,
      COUNT(*) AS total ${FROM} WHERE ${where}`))[0] ?? {};
    return { expired: Number(r.expired ?? 0), near: Number(r.near ?? 0), total: Number(r.total ?? 0), alertDays, today };
  }),

  /** Linhas para relatório impresso / compartilhado (padrão: vencidos + a vencer). */
  report: commercialFeatureProcedure("products").input(listFilters.optional()).query(async ({ ctx, input }) => {
    const { items, alertDays, today } = await queryProducts(ctx, { expiry: "alert", ...(input ?? {}) }, { limit: 5000 });
    return { items, alertDays, today, truncated: items.length >= 5000 };
  }),

  /** CSV (até 10 mil linhas) com os mesmos filtros da tela. */
  exportCsv: commercialFeatureProcedure("products").input(listFilters.optional()).mutation(async ({ ctx, input }) => {
    const { items, alertDays, today } = await queryProducts(ctx, input ?? {}, { limit: PRODUCTS_EXPORT_LIMIT });
    void auditFromCtx(ctx, { action: "export", module: "products", entityType: "product_csv", description: `Exportou ${items.length} produto(s) em CSV`, newData: input ?? {} });
    return { filename: `produtos-validades-${today}.csv`, csv: productsCsv(items, today, alertDays), count: items.length, truncated: items.length >= PRODUCTS_EXPORT_LIMIT };
  }),

  photoUrl: commercialFeatureProcedure("products").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const database = await ready();
    const where = buildWhere(ctx, {}, todayInZone(), 30); // respeita o escopo do promotor
    const row = rowsOf(await database.execute(sql`SELECT ip.photoKey ${FROM} WHERE ${where} AND ip.id = ${input.id} LIMIT 1`))[0];
    if (!row?.photoKey || !isTenantMediaKey(row.photoKey, ctx.accountId, ["product-photos"])) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
    const { storageGetSignedUrl } = await import("../storage");
    return { url: await storageGetSignedUrl(String(row.photoKey)) };
  }),

  /** Quantos produtos ainda apontam para a loja (aviso antes de remover a loja). */
  countByStore: commercialFeatureProcedure("products").input(z.object({ storeId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const database = await ready();
    return { count: Number(rowsOf(await database.execute(sql`SELECT COUNT(*) AS n FROM inventory_products WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId}`))[0]?.n ?? 0) };
  }),

  create: commercialFeatureProcedure("products").input(z.object({ ...productFields, clientRequestId: z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/) })).mutation(async ({ ctx, input }) => {
    const database = await ready();
    const prior = rowsOf(await database.execute(sql`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
    if (prior) return { product: await loadOne(ctx, Number(prior.productId)), merged: Boolean(Number(prior.merged)), duplicate: true };

    const place = await validatePlace(ctx, input.storeId, input.storeClientId);
    const lot = normalizeLot(input.lot);
    const key = { productCode: input.productCode, expirationDate: input.expirationDate, ...place, lot };
    const photoKey = input.photoBase64 ? await uploadLabelPhoto(ctx.accountId, input.photoBase64, input.clientRequestId) : null;

    let result: { id: number; merged: boolean; previousQuantity?: number; photoUnused?: boolean };
    try {
      result = await database.transaction(async (tx: any) => {
        const existing = rowsOf(await tx.execute(sql`SELECT id, quantity, price, photoKey FROM inventory_products
          WHERE companyId = ${ctx.accountId} AND productCode = ${key.productCode} AND expirationDate = ${key.expirationDate}
            AND ${nullSafe("storeId", key.storeId)} AND ${nullSafe("storeClientId", key.storeClientId)} AND ${nullSafe("lot", key.lot)}
          ORDER BY id ASC LIMIT 1 FOR UPDATE`))[0];
        let out: { id: number; merged: boolean; previousQuantity?: number; photoUnused?: boolean };
        if (existing) {
          const keepPrice = Number(existing.price) > 0 ? existing.price : input.price;
          const usePhoto = photoKey && !existing.photoKey;
          await tx.execute(sql`UPDATE inventory_products SET quantity = quantity + ${input.quantity}, price = ${keepPrice}${usePhoto ? sql`, photoKey = ${photoKey}` : sql``} WHERE id = ${existing.id} AND companyId = ${ctx.accountId}`);
          out = { id: Number(existing.id), merged: true, previousQuantity: Number(existing.quantity), photoUnused: Boolean(photoKey && !usePhoto) };
        } else {
          const ins: any = await tx.execute(sql`INSERT INTO inventory_products (companyId, productCode, description, quantity, expirationDate, price, storeId, storeClientId, lot, photoKey, createdByMemberId)
            VALUES (${ctx.accountId}, ${key.productCode}, ${input.description}, ${input.quantity}, ${key.expirationDate}, ${input.price}, ${key.storeId}, ${key.storeClientId}, ${key.lot}, ${photoKey}, ${ctx.memberAccountId ?? null})`);
          out = { id: Number(ins?.[0]?.insertId ?? ins?.insertId), merged: false };
        }
        await tx.execute(sql`INSERT INTO inventory_product_requests (companyId, clientRequestId, productId, merged) VALUES (${ctx.accountId}, ${input.clientRequestId}, ${out.id}, ${out.merged})`);
        return out;
      });
    } catch (error: any) {
      await deleteLabelPhoto(ctx.accountId, photoKey);
      // Corrida com o mesmo clientRequestId (toque duplo em duas abas): devolve o que já foi gravado.
      if (/duplicate/i.test(String(error?.message ?? error?.cause?.message ?? ""))) {
        const p = rowsOf(await database.execute(sql`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
        if (p) return { product: await loadOne(ctx, Number(p.productId)), merged: Boolean(Number(p.merged)), duplicate: true };
      }
      throw error;
    }
    if (result.photoUnused) await deleteLabelPhoto(ctx.accountId, photoKey);
    const product = await loadOne(ctx, result.id);
    const { photoBase64: _omit, ...logged } = input;
    void auditFromCtx(ctx, result.merged
      ? { action: "update", module: "products", entityType: "product", entityId: result.id, entityLabel: input.description, description: `Somou ${input.quantity} un. ao produto: ${input.description} (antes ${result.previousQuantity})`, newData: logged }
      : { action: "create", module: "products", entityType: "product", entityId: result.id, entityLabel: input.description, description: `Cadastrou produto: ${input.description}`, newData: logged });
    return { product, merged: result.merged, duplicate: false };
  }),

  update: commercialFeatureProcedure("products").input(z.object({ ...productFields, id: z.number().int().positive(), removePhoto: z.boolean().optional() })).mutation(async ({ ctx, input }) => {
    const before = await loadManageable(ctx, input.id);
    // Loja removida: permite salvar sem trocar a loja (o vínculo antigo continua), mas não vincular a uma loja removida nova.
    const sameStore = input.storeId != null && input.storeId === before.storeId && input.storeClientId === before.storeClientId;
    const place = sameStore ? { storeId: before.storeId, storeClientId: before.storeClientId } : await validatePlace(ctx, input.storeId, input.storeClientId);
    const database = await ready();
    let photoKey = before.photoKey;
    if (input.photoBase64) photoKey = await uploadLabelPhoto(ctx.accountId, input.photoBase64, `${input.id}-${Date.now()}`);
    else if (input.removePhoto) photoKey = null;
    await database.execute(sql`UPDATE inventory_products SET productCode = ${input.productCode}, description = ${input.description}, quantity = ${input.quantity}, expirationDate = ${input.expirationDate}, price = ${input.price},
      storeId = ${place.storeId}, storeClientId = ${place.storeClientId}, lot = ${normalizeLot(input.lot)}, photoKey = ${photoKey} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
    if (before.photoKey && before.photoKey !== photoKey) await deleteLabelPhoto(ctx.accountId, before.photoKey);
    const product = await loadOne(ctx, input.id);
    const { photoBase64: _omit, ...logged } = input;
    void auditFromCtx(ctx, { action: "update", module: "products", entityType: "product", entityId: input.id, entityLabel: input.description, description: `Alterou produto: ${input.description}`, oldData: before, newData: logged });
    return product;
  }),

  deleteMany: commercialFeatureProcedure("products").input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
    const ids = [...new Set(input.ids)];
    for (const id of ids) await loadManageable(ctx, id); // promotor: só os próprios
    const result = await db.deleteInventoryProducts(ctx.accountId, ids, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
    void auditFromCtx(ctx, { action: "delete", module: "products", entityType: ids.length === 1 ? "product" : "product_bulk", entityId: ids.length === 1 ? ids[0] : undefined, entityLabel: `${result.deleted} produto(s)`, description: `Enviou ${result.deleted} produto(s) à lixeira`, newData: { productIds: ids } });
    return result;
  }),
  delete: commercialFeatureProcedure("products").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await loadManageable(ctx, input.id);
    return db.deleteInventoryProducts(ctx.accountId, [input.id], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
  }),

  /** Compatibilidade com telas antigas: vencidos + a vencer na janela da empresa. */
  alertsSimple: commercialFeatureProcedure("products").query(async ({ ctx }) => (await queryProducts(ctx, { expiry: "alert" }, { limit: 200 })).items),
});

/** Alertas para os painéis: nunca derruba o painel se o módulo estiver desligado (devolve lista vazia). */
export async function inventoryAlertsFor(ctx: Ctx & { actingAsPlatform?: boolean }): Promise<ProductRow[]> {
  try {
    if (!ctx.actingAsPlatform) {
      const { assertMemberFeatureAccess } = await import("../entitlements");
      await assertMemberFeatureAccess({ companyId: ctx.accountId, memberAccountId: ctx.memberAccountId ?? null, role: ctx.user.role as any, featureKey: "products" });
    }
  } catch { return []; }
  return (await queryProducts(ctx, { expiry: "alert" }, { limit: 200 })).items;
}
