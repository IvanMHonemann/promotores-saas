import { z } from "zod";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { storePhotos, stores } from "../../drizzle/schema";
import { getDb } from "../db";
import { commercialFeatureProcedure, router } from "../_core/trpc";
import { auditFromCtx } from "../audit";

const RETENTION_DAYS = 60;

export const storePhotosRouter = router({
  /** Lista lojas com contagem de fotos e última atividade. */
  listStoresWithStats: commercialFeatureProcedure("fieldOperations")
    .input(z.object({ search: z.string().optional(), city: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });

      const conditions = [eq(stores.companyId, ctx.accountId), eq(stores.active, true)];
      if (input?.search) {
        conditions.push(sql`${stores.name} LIKE ${`%${input.search}%`}`);
      }
      if (input?.city) {
        conditions.push(eq(stores.city, input.city));
      }

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
        .select()
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
});
