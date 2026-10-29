import { and, eq, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { stores } from "../drizzle/schema";

/**
 * Regras de visibilidade de lojas e fotos:
 *  - administrador e supervisor da empresa vêem todas as lojas da empresa;
 *  - promotor vê apenas as lojas atribuídas a ele (tabela promoter_store_assignments);
 *  - fotos: promotor vê apenas as que ele mesmo tirou; admin/supervisor vêem todas da empresa.
 * Cadastro de lojas: apenas admin e supervisor.
 */

type AccessCtx = {
  user: { role: string };
  accountId: number;
  memberAccountId?: number | null;
  actingAsPlatform?: boolean;
};

export function isCompanyAdmin(ctx: AccessCtx): boolean {
  return ctx.user.role === "company_admin";
}

export function isSupervisor(ctx: AccessCtx): boolean {
  return ctx.user.role === "supervisor";
}

export function hasFullStoreAccess(ctx: AccessCtx): boolean {
  return isCompanyAdmin(ctx) || isSupervisor(ctx);
}

/** Devolve o id do membro a filtrar, ou null para admin/supervisor (sem filtro). */
export function scopeMemberId(ctx: AccessCtx): number | null {
  if (ctx.actingAsPlatform) return null;
  if (hasFullStoreAccess(ctx)) return null;
  if (!ctx.memberAccountId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu usuário não está vinculado a um perfil de campo." });
  }
  return ctx.memberAccountId;
}

let storeOwnersReady: Promise<void> | null = null;
/** Cria sob demanda a tabela que guarda quem cadastrou cada loja. */
export function ensureStoreOwnersTable(db: { execute: (query: string) => Promise<unknown> }): Promise<void> {
  if (storeOwnersReady) return storeOwnersReady;
  storeOwnersReady = db
    .execute(`CREATE TABLE IF NOT EXISTS store_owners (
      storeId int NOT NULL,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (storeId),
      KEY store_owners_company_member_idx (companyId, memberAccountId)
    )`)
    .then(() => undefined)
    .catch((error) => {
      storeOwnersReady = null;
      throw error;
    });
  return storeOwnersReady;
}

let promoterAssignmentsReady: Promise<void> | null = null;
/** Cria sob demanda a tabela de vínculo promotor ↔ lojas (atribuição opcional). */
export function ensurePromoterStoreAssignmentsTable(db: { execute: (query: string) => Promise<unknown> }): Promise<void> {
  if (promoterAssignmentsReady) return promoterAssignmentsReady;
  promoterAssignmentsReady = db
    .execute(`CREATE TABLE IF NOT EXISTS promoter_store_assignments (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      promoterId int NOT NULL,
      storeId int NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY promoter_store_unique (promoterId, storeId),
      KEY promoter_store_company_promoter_idx (companyId, promoterId),
      KEY promoter_store_company_store_idx (companyId, storeId)
    )`)
    .then(() => undefined)
    .catch((error) => {
      promoterAssignmentsReady = null;
      throw error;
    });
  return promoterAssignmentsReady;
}

/** Condição SQL: a loja está atribuída ao promotor. */
export function storeAssignedToPromoter(storeIdColumn: unknown, promoterId: number): SQL {
  return sql`EXISTS (SELECT 1 FROM promoter_store_assignments psa WHERE psa.storeId = ${storeIdColumn} AND psa.promoterId = ${promoterId})`;
}

/** Mantido por compatibilidade; agora a visibilidade do promotor é por atribuição. */
export function storeVisibleToMember(storeIdColumn: unknown, memberId: number): SQL {
  return storeAssignedToPromoter(storeIdColumn, memberId);
}

export async function recordStoreOwner(db: any, input: { storeId: number; companyId: number; memberAccountId: number }) {
  await ensureStoreOwnersTable(db);
  await db.execute(sql`INSERT IGNORE INTO store_owners (storeId, companyId, memberAccountId) VALUES (${input.storeId}, ${input.companyId}, ${input.memberAccountId})`);
}

/** Substitui as lojas atribuídas a um promotor (atribuição opcional). */
export async function setPromoterStoreAssignments(db: any, companyId: number, promoterId: number, storeIds: number[]) {
  await ensurePromoterStoreAssignmentsTable(db);
  const unique = [...new Set(storeIds.filter((id) => Number.isInteger(id) && id > 0))];
  await db.execute(sql`DELETE FROM promoter_store_assignments WHERE companyId = ${companyId} AND promoterId = ${promoterId}`);
  if (unique.length === 0) return;
  // Verifica que as lojas pertencem à empresa
  const valid = await db.execute(sql`SELECT id FROM stores WHERE companyId = ${companyId} AND active = 1 AND id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})`);
  const validIds = (Array.isArray(valid?.[0]) ? valid[0] : Array.isArray(valid) ? valid : valid?.rows ?? []).map((r: any) => Number(r.id));
  if (validIds.length !== unique.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais lojas não pertencem a esta empresa ou estão inativas." });
  }
  for (const storeId of validIds) {
    await db.execute(sql`INSERT IGNORE INTO promoter_store_assignments (companyId, promoterId, storeId) VALUES (${companyId}, ${promoterId}, ${storeId})`);
  }
}

export async function getPromoterStoreAssignments(db: any, companyId: number, promoterId: number): Promise<number[]> {
  await ensurePromoterStoreAssignmentsTable(db);
  const res: any = await db.execute(sql`SELECT storeId FROM promoter_store_assignments WHERE companyId = ${companyId} AND promoterId = ${promoterId}`);
  const rows = Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [];
  return rows.map((r: any) => Number(r.storeId));
}

/** Carrega a loja se o usuário puder vê-la; caso contrário responde "não encontrada". */
export async function assertStoreAccess(db: any, ctx: AccessCtx, storeId: number) {
  const memberId = scopeMemberId(ctx);
  const conditions: SQL[] = [eq(stores.id, storeId), eq(stores.companyId, ctx.accountId)];
  if (memberId !== null) {
    await ensurePromoterStoreAssignmentsTable(db);
    conditions.push(storeAssignedToPromoter(stores.id, memberId));
  }
  const [store] = await db.select().from(stores).where(and(...conditions)).limit(1);
  if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
  return store as typeof stores.$inferSelect;
}

/** Garante que a foto pertence ao usuário (admin/supervisor podem ver qualquer foto da empresa). */
export function assertPhotoAccess(ctx: AccessCtx, photo: { promoterId: number }) {
  const memberId = scopeMemberId(ctx);
  if (memberId !== null && photo.promoterId !== memberId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
  }
}
