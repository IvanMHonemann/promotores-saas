import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storePhotos, stores } from "../../drizzle/schema";
import { trashItems } from "../../drizzle/schema.original";
import { getDb } from "../db";
import { commercialFeatureProcedure, router } from "../_core/trpc";
import { auditFromCtx } from "../audit";

const RETENTION_DAYS = 65;

async function ensureStorePhotosTable(db: any) {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS store_photos (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      storeId int NOT NULL,
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
      KEY store_photos_company_promoter_idx (companyId,promoterId),
      KEY store_photos_expires_idx (expiresAt),
      UNIQUE KEY store_photos_company_idempotency_unique (companyId,idempotencyKey)
    )`);
  } catch (e) {
    console.warn("[storePhotos] ensure table", e);
  }
}

export const storePhotosRouter = router({
  /** Lista lojas com contagem de fotos e última atividade. */
  listStoresWithStats: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ search: z.string().optional(), city: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      await ensureStorePhotosTable(db);

      const conditions = [eq(stores.companyId, ctx.accountId), eq(stores.active, true)];
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
            photoCount: sql<number>`(SELECT COUNT(*) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND store_photos.uploadStatus = 'uploaded')`,
            lastActivity: sql<string | null>`(SELECT MAX(capturedAt) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId})`,
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
      storeId: z.number().int().positive(),
      from: z.string().optional(),
      to: z.string().optional(),
      promoterId: z.number().int().positive().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      // Garante que a loja pertence à empresa
      const [store] = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.companyId, ctx.accountId))).limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });

      const conditions = [eq(storePhotos.companyId, ctx.accountId), eq(storePhotos.storeId, input.storeId)];
      if (input.from) conditions.push(gte(storePhotos.capturedAt, new Date(input.from)));
      if (input.to) conditions.push(lte(storePhotos.capturedAt, new Date(input.to)));
      if (input.promoterId) conditions.push(eq(storePhotos.promoterId, input.promoterId));

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
      storeId: z.number().int().positive(),
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
      idempotencyKey: z.string().min(8).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [store] = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.companyId, ctx.accountId))).limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });

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
        storeId: input.storeId,
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

      await auditFromCtx(ctx, {
        action: "create",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photoId,
        entityLabel: store.name,
        description: `Foto registrada na loja ${store.name}`,
        newData: { storeId: input.storeId, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude) },
      });

      return { id: photoId, expiresAt };
    }),

  /** Recebe imagem em base64, faz upload no storage e cria o registro (com idempotência). */
  uploadAndCreate: commercialFeatureProcedure("fieldOperations")
    .input(z.object({
      storeId: z.number().int().positive(),
      visitId: z.number().int().positive().optional(),
      capturedAt: z.string(),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      accuracy: z.number().optional(),
      locationStatus: z.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
      imageBase64: z.string().min(100),
      mimeType: z.string().default("image/jpeg"),
      idempotencyKey: z.string().min(8).max(64),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const [store] = await db.select().from(stores).where(and(eq(stores.id, input.storeId), eq(stores.companyId, ctx.accountId))).limit(1);
      if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja não encontrada." });

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
        storeId: input.storeId,
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

      await auditFromCtx(ctx, {
        action: "create",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photoId,
        entityLabel: store.name,
        description: `Foto registrada na loja ${store.name}`,
        newData: { storeId: input.storeId, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude), fileSize: buffer.length },
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

      const { storageGetSignedUrl } = await import("../storage");
      const url = await storageGetSignedUrl(photo.fileKey);
      return { url, expiresIn: 3600 };
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

      // Promotor só pode excluir as próprias; admin/supervisor podem excluir da empresa
      if (ctx.user.role === "promoter" && photo.promoterId !== ctx.memberAccountId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode excluir suas próprias fotos." });
      }

      // Soft-delete: move to trash instead of hard delete
      const expiresAt = new Date(Date.now() + 65 * 24 * 60 * 60 * 1000);
      await db.insert(trashItems).values({
        accountId: ctx.accountId,
        itemType: "store_photo",
        originalId: photo.id,
        label: `Foto #${photo.id}`,
        snapshot: JSON.stringify(photo),
        expiresAt,
      });
      await db.delete(storePhotos).where(eq(storePhotos.id, photo.id));

      await auditFromCtx(ctx, {
        action: "delete",
        module: "store_photos",
        entityType: "store_photo",
        entityId: photo.id,
        entityLabel: `Foto #${photo.id}`,
        description: "Foto excluída manualmente",
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

      const { storageDelete } = await import("../storage");
      let deleted = 0;
      for (const photo of photos) {
        if (ctx.user.role === "promoter" && photo.promoterId !== ctx.memberAccountId) continue;
        if (photo.fileKey) await storageDelete(photo.fileKey);
        if (photo.thumbnailKey) await storageDelete(photo.thumbnailKey);
        await db.delete(storePhotos).where(eq(storePhotos.id, photo.id));
        deleted++;
      }

      await auditFromCtx(ctx, {
        action: "delete",
        module: "store_photos",
        entityType: "store_photo",
        description: `${deleted} foto(s) excluída(s) em massa`,
        newData: { count: deleted },
      });

      return { deleted };
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
