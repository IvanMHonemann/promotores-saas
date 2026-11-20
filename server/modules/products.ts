/**
 * Módulo "Produtos e validades" (featureKey `products`).
 *
 * - Tudo filtrado por empresa (companyId) no servidor.
 * - Cada usuário vê e gerencia somente os produtos que ele mesmo cadastrou (createdByMemberId).
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
import { assertStoreAccess, ensurePromoterStoreAssignmentsTable, scopeMemberId } from "../storeAccess";
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

/** WHERE comum (empresa + escopo do usuário + filtros). Exportado para teste. */
export function buildWhere(ctx: Ctx, f: ListFilters, today: string, alertDays: number): SQL {
  const parts: SQL[] = [sql`ip.companyId = ${ctx.accountId}`];
  // Cada usuário (promotor, supervisor ou admin) vê somente os produtos que ele mesmo cadastrou.
  if (ctx.memberAccountId != null) parts.push(sql`ip.createdByMemberId = ${ctx.memberAccountId}`);
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
