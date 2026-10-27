import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { stores } from "../drizzle/schema";
import { normalizeStoreIds } from "../shared/stores";

/**
 * Regras de visibilidade de lojas e fotos:
 *  - administrador da empresa (company_admin) vê tudo da empresa;
 *  - promotor vê somente as lojas vinculadas a ele (tabela promoter_stores) e as de visitas ainda abertas
 *    (pendentes/em andamento) atribuídas a ele; promotores não cadastram lojas;
 *  - supervisor vê as lojas que cadastrou e as de visitas abertas atribuídas a ele;
 *  - todo usuário não administrador vê apenas as fotos que ele mesmo tirou.
 * Lojas antigas, sem registro de quem cadastrou, ficam visíveis só ao administrador.
 */

type AccessCtx = {
  user: { role: string };
  accountId: number;
  memberAccountId?: number | null;
};

export function isCompanyAdmin(ctx: AccessCtx): boolean {
  return ctx.user.role === "company_admin";
}

/** Devolve o id do membro a filtrar, ou null para o administrador (sem filtro). */
export function scopeMemberId(ctx: AccessCtx): number | null {
  if (isCompanyAdmin(ctx)) return null;
  if (!ctx.memberAccountId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu usuário não está vinculado a um perfil de campo." });
  }
  return ctx.memberAccountId;
}

let storeOwnersReady: Promise<void> | null = null;
/** Cria sob demanda a tabela que guarda quem cadastrou cada loja (nenhuma migração a cria). */
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
      storeOwnersReady = null; // tenta de novo na próxima chamada
      throw error;
    });
  return storeOwnersReady;
}

let promoterStoresReady: Promise<void> | null = null;
/**
 * Cria sob demanda a tabela de vínculos promotor ↔ loja (mesmo padrão de store_owners: nenhuma migração a cria).
 * Na primeira criação, preserva o que cada promotor já acessava: lojas que ele cadastrou, lojas das suas visitas
 * e lojas dos seus roteiros semanais. Só roda com a tabela vazia, então nunca desfaz vínculos removidos depois.
 */
export function ensurePromoterStoresTable(db: { execute: (query: any) => Promise<unknown> }): Promise<void> {
  if (promoterStoresReady) return promoterStoresReady;
  promoterStoresReady = (async () => {
    await ensureStoreOwnersTable(db);
    await db.execute(`CREATE TABLE IF NOT EXISTS promoter_stores (
      companyId int NOT NULL,
      promoterId int NOT NULL,
      storeId int NOT NULL,
      createdByMemberId int NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (promoterId, storeId),
      KEY promoter_stores_company_store_idx (companyId, storeId)
    )`);
    const existing = rowsOf(await db.execute(`SELECT 1 AS n FROM promoter_stores LIMIT 1`));
    if (existing.length) return;
    await db.execute(`INSERT IGNORE INTO promoter_stores (companyId, promoterId, storeId)
      SELECT x.companyId, x.promoterId, x.storeId FROM (
        SELECT so.companyId AS companyId, so.memberAccountId AS promoterId, so.storeId AS storeId
          FROM store_owners so
          JOIN member_accounts m ON m.id = so.memberAccountId AND m.companyId = so.companyId AND m.role = 'promoter'
        UNION
        SELECT v.companyId, v.promoterId, v.storeId
          FROM visits v
          JOIN member_accounts m ON m.id = v.promoterId AND m.companyId = v.companyId AND m.role = 'promoter'
      ) x
      JOIN stores s ON s.id = x.storeId AND s.companyId = x.companyId`);
    // Roteiros semanais guardam as lojas em JSON; a tabela pode não existir em bancos sem roteiros.
    let schedules: any[] = [];
    try {
      schedules = rowsOf(await db.execute(`SELECT companyId, promoterId, storeIds FROM weekly_route_schedules WHERE active = true`));
    } catch (error: any) {
      if (error?.code !== "ER_NO_SUCH_TABLE" && !String(error?.message || "").includes("weekly_route_schedules")) throw error;
    }
    for (const schedule of schedules) {
      const ids = normalizeStoreIds(typeof schedule.storeIds === "string" ? JSON.parse(schedule.storeIds) : schedule.storeIds);
      if (!ids.length) continue;
      await db.execute(sql`INSERT IGNORE INTO promoter_stores (companyId, promoterId, storeId)
        SELECT s.companyId, ${Number(schedule.promoterId)}, s.id FROM stores s
        WHERE s.companyId = ${Number(schedule.companyId)} AND s.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
    }
  })().catch((error) => {
    promoterStoresReady = null; // tenta de novo na próxima chamada
    throw error;
  });
  return promoterStoresReady;
}

/** Garante as tabelas que definem quem enxerga cada loja. */
export async function ensureStoreAccessSchema(db: { execute: (query: any) => Promise<unknown> }): Promise<void> {
  await ensureStoreOwnersTable(db);
  await ensurePromoterStoresTable(db);
}

function rowsOf(res: any): any[] {
  return Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [];
}

/**
 * Condição SQL: a loja é visível ao membro (não administrador).
 *  - vinculada ao promotor (promoter_stores);
 *  - cadastrada por ele, quando não é promotor (supervisor);
 *  - está em uma visita ainda aberta atribuída a ele (hoje ou futura), para não travar o roteiro em andamento.
 */
export function storeVisibleToMember(storeIdColumn: unknown, memberId: number): SQL {
  return sql`(EXISTS (SELECT 1 FROM promoter_stores ps WHERE ps.storeId = ${storeIdColumn} AND ps.promoterId = ${memberId})
    OR EXISTS (SELECT 1 FROM store_owners so JOIN member_accounts mo ON mo.id = so.memberAccountId
      WHERE so.storeId = ${storeIdColumn} AND so.memberAccountId = ${memberId} AND mo.role <> 'promoter')
    OR EXISTS (SELECT 1 FROM visits vv WHERE vv.storeId = ${storeIdColumn} AND vv.promoterId = ${memberId}
      AND vv.status IN ('pending', 'in_progress')
      AND (vv.routeId IS NULL OR EXISTS (SELECT 1 FROM routes rr WHERE rr.id = vv.routeId AND rr.date >= DATE_SUB(UTC_DATE(), INTERVAL 1 DAY)))))`;
}

export async function recordStoreOwner(db: any, input: { storeId: number; companyId: number; memberAccountId: number }) {
  await ensureStoreOwnersTable(db);
  await db.execute(sql`INSERT IGNORE INTO store_owners (storeId, companyId, memberAccountId) VALUES (${input.storeId}, ${input.companyId}, ${input.memberAccountId})`);
}

/** Lojas ativas da empresa; lança erro (mapeado para 400 nas rotas) se alguma não pertencer à empresa ou estiver inativa. */
export async function assertStoresInCompany(db: any, companyId: number, storeIds: ReadonlyArray<number>): Promise<number[]> {
  const ids = normalizeStoreIds(storeIds);
  if (!ids.length) return [];
  const rows = await db.select({ id: stores.id }).from(stores)
    .where(and(inArray(stores.id, ids), eq(stores.companyId, companyId), eq(stores.active, true)));
  if (rows.length !== ids.length) throw new Error("Uma ou mais lojas não pertencem a esta empresa ou estão inativas.");
  return ids;
}

/** Ids das lojas vinculadas ao promotor. */
export async function listPromoterStoreIds(db: any, companyId: number, promoterId: number): Promise<number[]> {
  await ensurePromoterStoresTable(db);
  const res = await db.execute(sql`SELECT storeId FROM promoter_stores WHERE companyId = ${companyId} AND promoterId = ${promoterId} ORDER BY storeId`);
  return rowsOf(res).map((row) => Number(row.storeId));
}

/** Todos os vínculos da empresa (usado pelo administrador na tela de promotores). */
export async function listPromoterStoreLinks(db: any, companyId: number): Promise<Array<{ promoterId: number; storeId: number }>> {
  await ensurePromoterStoresTable(db);
  const res = await db.execute(sql`SELECT promoterId, storeId FROM promoter_stores WHERE companyId = ${companyId} ORDER BY promoterId, storeId`);
  return rowsOf(res).map((row) => ({ promoterId: Number(row.promoterId), storeId: Number(row.storeId) }));
}

/** Acrescenta vínculos (idempotente). `db` pode ser uma transação. As lojas já devem ter sido validadas. */
export async function addPromoterStores(db: any, input: { companyId: number; promoterId: number; storeIds: ReadonlyArray<number>; createdByMemberId?: number | null }) {
  const ids = normalizeStoreIds(input.storeIds);
  if (!ids.length) return;
  const by = input.createdByMemberId ?? null;
  await db.execute(sql`INSERT IGNORE INTO promoter_stores (companyId, promoterId, storeId, createdByMemberId) VALUES ${sql.join(
    ids.map((id) => sql`(${input.companyId}, ${input.promoterId}, ${id}, ${by})`),
    sql`, `,
  )}`);
}

/** Substitui a lista de lojas do promotor: acrescenta as novas e remove as que saíram. `db` pode ser uma transação. */
export async function replacePromoterStores(db: any, input: { companyId: number; promoterId: number; storeIds: ReadonlyArray<number>; createdByMemberId?: number | null }) {
  const ids = normalizeStoreIds(input.storeIds);
  if (ids.length) {
    await db.execute(sql`DELETE FROM promoter_stores WHERE companyId = ${input.companyId} AND promoterId = ${input.promoterId} AND storeId NOT IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  } else {
    await db.execute(sql`DELETE FROM promoter_stores WHERE companyId = ${input.companyId} AND promoterId = ${input.promoterId}`);
  }
  await addPromoterStores(db, { ...input, storeIds: ids });
}

/** Carrega a loja se o usuário puder vê-la; caso contrário responde "não encontrada" (sem revelar que existe). */
export async function assertStoreAccess(db: any, ctx: AccessCtx, storeId: number) {
  const memberId = scopeMemberId(ctx);
  const conditions: SQL[] = [eq(stores.id, storeId), eq(stores.companyId, ctx.accountId)];
  if (memberId !== null) {
    await ensureStoreAccessSchema(db);
    conditions.push(storeVisibleToMember(stores.id, memberId));
  }
  const [store] = await db.select().from(stores).where(and(...conditions)).limit(1);
  if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });
  return store as typeof stores.$inferSelect;
}

/** Garante que a foto pertence ao usuário (administrador pode ver qualquer foto da empresa). */
export function assertPhotoAccess(ctx: AccessCtx, photo: { promoterId: number }) {
  const memberId = scopeMemberId(ctx);
  if (memberId !== null && photo.promoterId !== memberId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
  }
}
