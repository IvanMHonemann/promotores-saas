import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { commercialFeatureProcedure, router } from "../_core/trpc";
import { auditFromCtx } from "../audit";
import { assertStoreAccess, scopeMemberId } from "../storeAccess";
import { ensureStoreClientsSchema } from "../storeClients";

const rows = (r: any): any[] => (Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? []);
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : null));

async function loadClient(db: any, companyId: number, storeId: number, id: number) {
  const r = rows(await db.execute(sql`SELECT * FROM store_clients WHERE id = ${id} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`));
  if (!r[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Cliente não encontrado nesta loja." });
  return r[0];
}

export const storeClientsRouter = router({
  /** Clientes de uma loja, com a quantidade de fotos (o promotor conta só as próprias). */
  list: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ storeId: z.number().int().positive(), includeInactive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await assertStoreAccess(db, ctx, input.storeId);
      await ensureStoreClientsSchema(db);
      const memberId = scopeMemberId(ctx);
      const own = memberId !== null ? sql` AND p.promoterId = ${memberId}` : sql``;
      const r = rows(await db.execute(sql`
        SELECT c.id, c.storeId, c.name, c.contactName, c.phone, c.notes, c.active,
          (SELECT COUNT(*) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id AND p.uploadStatus = 'uploaded'${own}) AS photoCount,
          (SELECT MAX(p.capturedAt) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id${own}) AS lastActivity
        FROM store_clients c
        WHERE c.companyId = ${ctx.accountId} AND c.storeId = ${input.storeId}${input.includeInactive ? sql`` : sql` AND c.active = true`}
        ORDER BY c.name ASC`));
      return r.map((c) => ({ ...c, active: Boolean(c.active), photoCount: Number(c.photoCount ?? 0) })) as Array<{ id: number; storeId: number; name: string; contactName: string | null; phone: string | null; notes: string | null; active: boolean; photoCount: number; lastActivity: string | null }>;
    }),

  create: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ storeId: z.number().int().positive(), name: z.string().trim().min(2, "Informe o nome do cliente.").max(255), contactName: text(255), phone: text(50), notes: text(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const store = await assertStoreAccess(db, ctx, input.storeId);
      await ensureStoreClientsSchema(db);
      const dup = rows(await db.execute(sql`SELECT id FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true AND LOWER(name) = ${input.name.toLowerCase()} LIMIT 1`));
      if (dup[0]) throw new TRPCError({ code: "CONFLICT", message: "Esta loja já tem um cliente com esse nome." });
      const res: any = await db.execute(sql`INSERT INTO store_clients (companyId, storeId, name, contactName, phone, notes) VALUES (${ctx.accountId}, ${input.storeId}, ${input.name}, ${input.contactName}, ${input.phone}, ${input.notes})`);
      const id = Number((Array.isArray(res) ? res[0] : res)?.insertId);
      await auditFromCtx(ctx, { action: "create", module: "store_clients", entityType: "store_client", entityId: id, entityLabel: input.name, description: `Cliente ${input.name} cadastrado na loja ${store.name}`, newData: { storeId: input.storeId, name: input.name } });
      return { id };
    }),

  update: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ storeId: z.number().int().positive(), id: z.number().int().positive(), name: z.string().trim().min(2).max(255), contactName: text(255), phone: text(50), notes: text(2000) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const store = await assertStoreAccess(db, ctx, input.storeId);
      await ensureStoreClientsSchema(db);
      const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
      await db.execute(sql`UPDATE store_clients SET name = ${input.name}, contactName = ${input.contactName}, phone = ${input.phone}, notes = ${input.notes} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
      await auditFromCtx(ctx, { action: "update", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: input.name, description: `Cliente ${old.name} atualizado na loja ${store.name}`, oldData: { name: old.name, phone: old.phone }, newData: { name: input.name, phone: input.phone } });
      return { id: input.id };
    }),

  /** Remover = desativar: as fotos já tiradas continuam ligadas ao cliente na galeria. */
  setActive: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ storeId: z.number().int().positive(), id: z.number().int().positive(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const store = await assertStoreAccess(db, ctx, input.storeId);
      await ensureStoreClientsSchema(db);
      const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
      await db.execute(sql`UPDATE store_clients SET active = ${input.active} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
      await auditFromCtx(ctx, { action: input.active ? "update" : "delete", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: old.name, description: `Cliente ${old.name} ${input.active ? "reativado" : "removido"} da loja ${store.name}` });
      return { id: input.id, active: input.active };
    }),
});
