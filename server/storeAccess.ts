import { and, eq, sql, type SQL } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { stores } from "../drizzle/schema";

/**
 * Regras de visibilidade de lojas e fotos:
 *  - administrador da empresa (company_admin) vê tudo da empresa;
 *  - qualquer outro usuário vê apenas as lojas que ele cadastrou ou que estão em visitas/roteiros
 *    atribuídos a ele, e apenas as fotos que ele mesmo tirou.
 * Lojas antigas, sem registro de quem cadastrou, ficam visíveis só ao administrador (e a quem as tem em roteiro).
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

/** Condição SQL: a loja foi cadastrada pelo membro ou está em uma visita atribuída a ele. */
export function storeVisibleToMember(storeIdColumn: unknown, memberId: number): SQL {
  return sql`(EXISTS (SELECT 1 FROM store_owners so WHERE so.storeId = ${storeIdColumn} AND so.memberAccountId = ${memberId})
    OR EXISTS (SELECT 1 FROM visits vv WHERE vv.storeId = ${storeIdColumn} AND vv.promoterId = ${memberId}))`;
}

export async function recordStoreOwner(db: any, input: { storeId: number; companyId: number; memberAccountId: number }) {
  await ensureStoreOwnersTable(db);
  await db.execute(sql`INSERT IGNORE INTO store_owners (storeId, companyId, memberAccountId) VALUES (${input.storeId}, ${input.companyId}, ${input.memberAccountId})`);
}

/** Carrega a loja se o usuário puder vê-la; caso contrário responde "não encontrada" (sem revelar que existe). */
export async function assertStoreAccess(db: any, ctx: AccessCtx, storeId: number) {
  const memberId = scopeMemberId(ctx);
  const conditions: SQL[] = [eq(stores.id, storeId), eq(stores.companyId, ctx.accountId)];
  if (memberId !== null) {
    await ensureStoreOwnersTable(db);
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
