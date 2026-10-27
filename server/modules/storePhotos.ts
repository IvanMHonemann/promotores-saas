import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storePhotos, stores } from "../../drizzle/schema";
import { trashItems } from "../../drizzle/schema.original";
import { ensureTrashTable, getDb } from "../db";
import { commercialFeatureProcedure, router } from "../_core/trpc";
import { checkRateLimit, getClientIp } from "../_core/rateLimit";
import { auditFromCtx } from "../audit";
import { ensureStoreClientsSchema } from "../storeClients";
import { assertPhotoAccess, assertStoreAccess, ensurePromoterStoreAssignmentsTable, scopeMemberId, storeVisibleToMember } from "../storeAccess";

const RETENTION_DAYS = 60;
/** Prazo para restaurar uma foto excluída (igual ao da tela Lixeira: 5 dias). */
const TRASH_DAYS = 5;

/** Move fotos para a lixeira de forma atômica: ou grava na lixeira e remove da galeria, ou não muda nada. */
async function moveStorePhotosToTrash(db: any, accountId: number, photos: Array<typeof storePhotos.$inferSelect>, actor?: { memberId?: number | null; name?: string | null }) {
  if (photos.length === 0) return;
  await ensureTrashTable();
  const storeIds = Array.from(new Set(photos.map((p) => p.storeId)));
  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(and(eq(stores.companyId, accountId), sql`${stores.id} IN (${sql.join(storeIds.map((id) => sql`${id}`), sql`, `)})`));
  const storeName = new Map<number, string>(storeRows.map((r: any) => [r.id, r.name]));
  // O vínculo com o cliente da loja fica fora do schema Drizzle (coluna sob demanda): guarda no snapshot para restaurar.
  const clientOf = new Map<number, number | null>();
  try {
    await ensureStoreClientsSchema(db);
    const res: any = await db.execute(sql`SELECT id, storeClientId FROM store_photos WHERE companyId = ${accountId} AND id IN (${sql.join(photos.map((p) => sql`${p.id}`), sql`, `)})`);
    for (const r of (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])) clientOf.set(Number(r.id), r.storeClientId == null ? null : Number(r.storeClientId));
  } catch { /* sem vínculo: a foto volta sem cliente */ }
  const expiresAt = new Date(Date.now() + TRASH_DAYS * 24 * 60 * 60 * 1000);
  await db.transaction(async (tx: any) => {
    await tx.insert(trashItems).values(
      photos.map((photo) => ({
        accountId,
        deletedByMemberId: actor?.memberId ?? null,
        deletedByName: actor?.name ?? null,
        ownerMemberId: photo.promoterId ?? null,
        itemType: "store_photo",
        originalId: photo.id,
        label: `Foto - ${storeName.get(photo.storeId || 0) || "Loja"} - ${new Date(photo.capturedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`.slice(0, 255),
        snapshot: JSON.stringify({ ...photo, storeClientId: clientOf.get(photo.id) ?? null }),
        expiresAt,
      })),
    );
    await tx.delete(storePhotos).where(and(eq(storePhotos.companyId, accountId), sql`${storePhotos.id} IN (${sql.join(photos.map((p) => sql`${p.id}`), sql`, `)})`));
  });
}

async function ensureStorePhotosTable(db: any) {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS store_photos (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      storeId int,
      promoterId int NOT NULL,
      visitId int,
      capturedAt timestamp NOT NULL,
      latitude double,
      longitude double,
      accuracy double,
      locationStatus enum('success','permission_denied','unavailable','timeout','error') DEFAULT 'unavailable',
      fileKey varchar(512) NOT NULL,
      thumbnailKey varchar(512),
      mimeType varchar(100),
      fileSize int,
      idempotencyKey varchar(64),
      uploadStatus enum('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
      expiresAt timestamp NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
      KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
      KEY store_photos_company_promoter_idx (companyId,promoterId),
      KEY store_photos_expires_idx (expiresAt),
      UNIQUE KEY store_photos_company_idempotency_unique (companyId,idempotencyKey)
    )`);
  } catch (e) {
    console.warn("[storePhotos] ensure table", e);
  }
  // Garante que storeId pode ser nulo (fotos sem loja)
  try {
    await db.execute(`ALTER TABLE store_photos MODIFY storeId int NULL`);
  } catch (e) {
    // já está nulo ou erro ignorável
  }
}

/** Confere que o cliente pertence à loja/empresa e grava o vínculo da foto (coluna criada sob demanda). */
async function assertStoreClient(db: any, companyId: number, storeId: number, storeClientId: number) {
  await ensureStoreClientsSchema(db);
  const res: any = await db.execute(sql`SELECT id, active FROM store_clients WHERE id = ${storeClientId} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`);
  const r = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0];
  if (!r) throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente não encontrado nesta loja." });
  if (!r.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Este cliente foi removido da loja." });
}
async function linkPhotoToClient(db: any, companyId: number, photoId: number, storeClientId: number) {
  await db.execute(sql`UPDATE store_photos SET storeClientId = ${storeClientId} WHERE id = ${photoId} AND companyId = ${companyId}`);
}

export const storePhotosRouter = router({
  /** Lista lojas com contagem de fotos e última atividade. */
  listStoresWithStats: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ search: z.string().optional(), city: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await ensureStorePhotosTable(db);
      const memberId = scopeMemberId(ctx); // null = administrador (vê tudo)

      const conditions: any[] = [eq(stores.companyId, ctx.accountId), eq(stores.active, true)];
      if (memberId !== null) {
        await ensurePromoterStoreAssignmentsTable(db);
        conditions.push(storeVisibleToMember(stores.id, memberId));
      }
      // Não administrador conta e mostra só as próprias fotos.
      const ownPhotos = memberId !== null ? sql` AND store_photos.promoterId = ${memberId}` : sql``;
      if (input?.search) {
        conditions.push(sql`${stores.name} LIKE ${`%${input.search}%`}`);
      }
      if (input?.city) {
        conditions.push(eq(stores.city, input.city));
      }

      try {
        const rows = await db
          .select({
            id: stores.id,
            name: stores.name,
            city: stores.city,
            state: stores.state,
            address: stores.address,
            photoCount: sql<number>`(SELECT COUNT(*) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND store_photos.uploadStatus = 'uploaded'${ownPhotos})`,
            lastActivity: sql<string | null>`(SELECT MAX(capturedAt) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId}${ownPhotos})`,
          })
          .from(stores)
          .where(and(...conditions))
          .orderBy(desc(stores.updatedAt));
        return rows;
      } catch (err: any) {
        // Se a tabela store_photos ainda não existe, lista só as lojas.
        if (String(err?.message || "").includes("store_photos") || err?.code === "ER_NO_SUCH_TABLE") {
          const rows = await db
            .select({ id: stores.id, name: stores.name, city: stores.city, state: stores.state, address: stores.address })
            .from(stores)
            .where(and(...conditions))
            .orderBy(desc(stores.updatedAt));
          return rows.map((r) => ({ ...r, photoCount: 0, lastActivity: null }));
        }
        throw err;
      }
    }),

  /** Lista fotos de uma loja, agrupáveis por data no cliente. */
  listByStore: commercialFeatureProcedure("fieldOperations")
    .input(z.object({
      storeId: z.number().int().positive().optional().nullable(),
      from: z.string().optional(),
      to: z.string().optional(),
      promoterId: z.number().int().positive().optional(),
      storeClientId: z.number().int().positive().optional(),
      withoutClient: z.boolean().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      await ensureStorePhotosTable(db);
      await ensureStoreClientsSchema(db);
      const memberId = scopeMemberId(ctx);

      const conditions: any[] = [eq(storePhotos.companyId, ctx.accountId)];
      if (input.storeId) {
        await assertStoreAccess(db, ctx, input.storeId);
        conditions.push(eq(storePhotos.storeId, input.storeId));
      } else {
        // Fotos sem loja vinculada
        conditions.push(sql`store_photos.storeId IS NULL`);
      }
      if (input.storeClientId) conditions.push(sql`store_photos.storeClientId = ${input.storeClientId}`);
      else if (input.withoutClient) conditions.push(sql`store_photos.storeClientId IS NULL`);
      // Não administrador só enxerga as próprias fotos
      if (memberId !== null) conditions.push(eq(storePhotos.promoterId, memberId));
      if (input.from) conditions.push(gte(storePhotos.capturedAt, new Date(input.from)));
      if (input.to) conditions.push(lte(storePhotos.capturedAt, new Date(input.to)));
      if (memberId === null && input.promoterId) conditions.push(eq(storePhotos.promoterId, input.promoterId));

      const photos = await db
        .select({
          id: storePhotos.id,
          companyId: storePhotos.companyId,
          storeId: storePhotos.storeId,
          promoterId: storePhotos.promoterId,
          visitId: storePhotos.visitId,
          capturedAt: storePhotos.capturedAt,
          latitude: storePhotos.latitude,
          longitude: storePhotos.longitude,
          accuracy: storePhotos.accuracy,
          locationStatus: storePhotos.locationStatus,
          fileKey: storePhotos.fileKey,
          thumbnailKey: storePhotos.thumbnailKey,
          mimeType: storePhotos.mimeType,
          fileSize: storePhotos.fileSize,
          uploadStatus: storePhotos.uploadStatus,
          expiresAt: storePhotos.expiresAt,
          storeClientId: sql<number | null>`store_photos.storeClientId`,
          clientName: sql<string | null>`(SELECT name FROM store_clients WHERE store_clients.id = store_photos.storeClientId AND store_clients.companyId = ${ctx.accountId})`,
          promoterName: sql<string>`(SELECT userName FROM member_accounts WHERE member_accounts.id = store_photos.promoterId AND member_accounts.companyId = ${ctx.accountId})`,
        })
        .from(storePhotos)
        .where(and(...conditions))
        .orderBy(desc(storePhotos.capturedAt));

      return photos;
    }),

  /** Cria registro de foto com idempotência. Upload do arquivo é feito separadamente. */
  create: commercialFeatureProcedure("fieldOperations")
    .input(z.object({
      storeId: z.number().int().positive().optional().nullable(),
      visitId: z.number().int().positive().optional(),
      capturedAt: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracy: z.number().optional(),
      locationStatus: z.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
      fileKey: z.string().min(1),
      thumbnailKey: z.string().optional(),
      mimeType: z.string().optional(),
      fileSize: z.number().int().optional(),
      storeClientId: z.number().int().positive().optional(),
      idempotencyKey: z.string().min(8).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
      if (!limit.ok) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      let storeName = "Sem loja vinculada";
      if (input.storeId) {
        const store = await assertStoreAccess(db, ctx, input.storeId);
        storeName = store.name;
        if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
      } else if (input.storeClientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente só pode ser vinculado quando há loja selecionada." });
      }

      // Idempotência
      const [existing] = await db
        .select()
        .from(storePhotos)
        .where(and(eq(storePhotos.companyId, ctx.accountId), eq(storePhotos.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing) return existing;

      const capturedAt = new Date(input.capturedAt);
      const expiresAt = new Date(capturedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const [result] = await db.insert(storePhotos).values({
        companyId: ctx.accountId,
        storeId: input.storeId ?? null,
        promoterId: ctx.memberAccountId!,
        visitId: input.visitId ?? null,
        capturedAt,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        accuracy: input.accuracy ?? null,
        locationStatus: input.locationStatus ?? "unavailable",
        fileKey: input.fileKey,
        thumbnailKey: input.thumbnailKey ?? null,
        mimeType: input.mimeType ?? null,
        fileSize: input.fileSize ?? null,
        idempotencyKey: input.idempotencyKey,
        uploadStatus: "uploaded",
        expiresAt,
      });

      const photoId = Number((result as any).insertId);
      if (input.storeClientId) await linkPhotoToClient(db, ctx.accountId, photoId, input.storeClientId);

      await auditFromCtx(ctx, {
        action: "create",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photoId,
        entityLabel: storeName,
        description: `Foto registrada ${input.storeId ? "na loja " + storeName : "sem loja vinculada"}`,
        newData: { storeId: input.storeId ?? null, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude) },
      });

      return { id: photoId, expiresAt };
    }),

  /** Recebe imagem em base64, faz upload no storage e cria o registro (com idempotência). */
  uploadAndCreate: commercialFeatureProcedure("fieldOperations")
    .input(z.object({
      storeId: z.number().int().positive().optional().nullable(),
      visitId: z.number().int().positive().optional(),
      capturedAt: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracy: z.number().optional(),
      locationStatus: z.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
      imageBase64: z.string().min(100),
      mimeType: z.string().default("image/jpeg"),
      storeClientId: z.number().int().positive().optional(),
      idempotencyKey: z.string().min(8).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
      if (!limit.ok) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
      }
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      let storeName = "Sem loja vinculada";
      if (input.storeId) {
        const store = await assertStoreAccess(db, ctx, input.storeId);
        storeName = store.name;
        if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
      } else if (input.storeClientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cliente só pode ser vinculado quando há loja selecionada." });
      }

      // Idempotência
      const [existing] = await db
        .select()
        .from(storePhotos)
        .where(and(eq(storePhotos.companyId, ctx.accountId), eq(storePhotos.idempotencyKey, input.idempotencyKey)))
        .limit(1);
      if (existing) return { id: existing.id, alreadyExists: true };

      const { storagePut } = await import("../storage");
      const buffer = Buffer.from(input.imageBase64, "base64");
      const ext = input.mimeType.includes("png") ? "png" : "jpg";
      const relKey = `store-photos/${ctx.accountId}/${input.storeId}/${input.idempotencyKey}.${ext}`;

      let fileKey: string;
      try {
        const uploaded = await storagePut(relKey, buffer, input.mimeType);
        fileKey = uploaded.key;
      } catch (err) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar a imagem. Verifique a configuração de armazenamento." });
      }

      const capturedAt = new Date(input.capturedAt);
      const expiresAt = new Date(capturedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const [result] = await db.insert(storePhotos).values({
        companyId: ctx.accountId,
        storeId: input.storeId ?? null,
        promoterId: ctx.memberAccountId!,
        visitId: input.visitId ?? null,
        capturedAt,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        accuracy: input.accuracy ?? null,
        locationStatus: input.locationStatus ?? "unavailable",
        fileKey,
        mimeType: input.mimeType,
        fileSize: buffer.length,
        idempotencyKey: input.idempotencyKey,
        uploadStatus: "uploaded",
        expiresAt,
      });

      const photoId = Number((result as any).insertId);
      if (input.storeClientId) await linkPhotoToClient(db, ctx.accountId, photoId, input.storeClientId);

      await auditFromCtx(ctx, {
        action: "create",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photoId,
        entityLabel: storeName,
        description: `Foto registrada ${input.storeId ? "na loja " + storeName : "sem loja vinculada"}`,
        newData: { storeId: input.storeId ?? null, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude), fileSize: buffer.length },
      });

      return { id: photoId, expiresAt, alreadyExists: false };
    }),

  /** Retorna URL assinada temporária para visualizar uma foto. */
  getImageUrl: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ photoId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [photo] = await db
        .select()
        .from(storePhotos)
        .where(and(eq(storePhotos.id, input.photoId), eq(storePhotos.companyId, ctx.accountId)))
        .limit(1);
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
      assertPhotoAccess(ctx, photo);

      const { storageGetSignedUrl } = await import("../storage");
      const url = await storageGetSignedUrl(photo.fileKey);
      return { url, expiresIn: 3600 };
    }),

  /** Retorna a imagem como base64 para compartilhamento sem CORS. */
  getImageData: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ photoId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const [photo] = await db.select().from(storePhotos).where(and(eq(storePhotos.id, input.photoId), eq(storePhotos.companyId, ctx.accountId))).limit(1);
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });
      assertPhotoAccess(ctx, photo);
      const { storageRead } = await import("../storage");
      try {
        const image = await storageRead(photo.fileKey);
        return { base64: image.data.toString("base64"), mime: image.contentType || photo.mimeType || "image/jpeg" };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível obter a imagem armazenada." });
      }
    }),

  /** Exclui uma foto (com auditoria). */
  delete: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ photoId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [photo] = await db
        .select()
        .from(storePhotos)
        .where(and(eq(storePhotos.id, input.photoId), eq(storePhotos.companyId, ctx.accountId)))
        .limit(1);
      if (!photo) throw new TRPCError({ code: "NOT_FOUND", message: "Foto não encontrada." });

      // Só o administrador da empresa pode excluir fotos de outros usuários
      if (scopeMemberId(ctx) !== null && photo.promoterId !== ctx.memberAccountId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode excluir suas próprias fotos." });
      }

      // Vai para a lixeira (restaurável por 5 dias) em vez de ser apagada de vez.
      try {
        await moveStorePhotosToTrash(db, ctx.accountId, [photo], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      } catch (error) {
        console.error("[storePhotos.delete] falha ao enviar para a lixeira", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível enviar a foto para a lixeira." });
      }

      await auditFromCtx(ctx, {
        action: "delete",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photo.id,
        entityLabel: `Foto #${photo.id}`,
        description: "Foto enviada para a lixeira",
        oldData: { storeId: photo.storeId, capturedAt: photo.capturedAt },
      });

      return { ok: true };
    }),

  /** Exclui várias fotos de uma vez. */
  bulkDelete: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ photoIds: z.array(z.number().int().positive()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const photos = await db
        .select()
        .from(storePhotos)
        .where(and(eq(storePhotos.companyId, ctx.accountId), sql`${storePhotos.id} IN (${sql.join(input.photoIds.map(id => sql`${id}`), sql`, `)})`));

      if (photos.length === 0) return { deleted: 0 };

      // Só o administrador exclui fotos de outros usuários; para os demais, as de terceiros são ignoradas.
      const memberId = scopeMemberId(ctx);
      const allowed = photos.filter((photo) => memberId === null || photo.promoterId === memberId);
      if (allowed.length === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode excluir suas próprias fotos." });
      try {
        await moveStorePhotosToTrash(db, ctx.accountId, allowed, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      } catch (error) {
        console.error("[storePhotos.bulkDelete] falha ao enviar para a lixeira", error);
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível enviar as fotos para a lixeira." });
      }
      const deleted = allowed.length;

      await auditFromCtx(ctx, {
        action: "delete",
        module: "store_photos",
        entityType: "store_photo",
        description: `${deleted} foto(s) enviada(s) para a lixeira em massa`,
        newData: { count: deleted },
      });

      return { deleted };
    }),

  /** Move fotos já tiradas para um cliente da mesma loja (ou tira o vínculo com `storeClientId: null`). */
  assignClient: commercialFeatureProcedure("fieldOperations")
    .input(z.object({
      storeId: z.number().int().positive().optional().nullable(),
      photoIds: z.array(z.number().int().positive()).min(1).max(200),
      storeClientId: z.number().int().positive().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const store = input.storeId != null ? await assertStoreAccess(db, ctx, input.storeId) : null;
      await ensureStorePhotosTable(db);
      await ensureStoreClientsSchema(db);
      let clientName = "Sem cliente";
      if (input.storeClientId && input.storeId != null) {
        await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        const res: any = await db.execute(sql`SELECT name FROM store_clients WHERE id = ${input.storeClientId} AND companyId = ${ctx.accountId} LIMIT 1`);
        clientName = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0]?.name ?? clientName;
      }
      // Só fotos desta loja/empresa; quem não é administrador move apenas as próprias.
      const memberId = scopeMemberId(ctx);
      const owner = memberId !== null ? sql` AND promoterId = ${memberId}` : sql``;
      const ids = sql.join(input.photoIds.map((id) => sql`${id}`), sql`, `);
      const res: any = await db.execute(sql`UPDATE store_photos SET storeClientId = ${input.storeClientId} WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND id IN (${ids})${owner}`);
      const moved = Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0);
      if (moved === 0) throw new TRPCError({ code: "FORBIDDEN", message: "Nenhuma das fotos selecionadas pôde ser movida (só é possível mover as suas próprias fotos desta loja)." });
      await auditFromCtx(ctx, {
        action: "update",
        module: "store_photos",
        entityType: "store_photo",
        description: `${moved} foto(s) da loja ${store?.name || "Sem loja"} movida(s) para: ${clientName}`,
        newData: { storeId: input.storeId ?? null, storeClientId: input.storeClientId, count: moved },
      });
      return { moved };
    }),
});


/** Exclui fotos expiradas (retenção de 60 dias). Chamado pela rotina agendada. */
export async function expireOldStorePhotos(): Promise<{ deleted: number; errors: number }> {
  const db = await getDb();
  if (!db) return { deleted: 0, errors: 0 };

  const now = new Date();
  const expired = await db
    .select()
    .from(storePhotos)
    .where(lte(storePhotos.expiresAt, now))
    .limit(200);

  if (expired.length === 0) return { deleted: 0, errors: 0 };

  const { storageDelete } = await import("../storage");
  let deleted = 0;
  let errors = 0;

  for (const photo of expired) {
    try {
      if (photo.fileKey) await storageDelete(photo.fileKey);
      if (photo.thumbnailKey) await storageDelete(photo.thumbnailKey);
      await db.delete(storePhotos).where(eq(storePhotos.id, photo.id));
      deleted++;
    } catch {
      errors++;
    }
  }

  return { deleted, errors };
}
