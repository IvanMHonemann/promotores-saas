import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { commercialProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { timeEvents, timeCorrectionRequests } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { auditFromCtx } from "../audit";

const timeEventType = z.enum(["clock_in", "break_start", "break_end", "clock_out"]);
type TimeEventType = z.infer<typeof timeEventType>;

function isValidTransition(last: TimeEventType | undefined, next: TimeEventType) {
  if (!last) return next === "clock_in";
  const transitions: Record<TimeEventType, TimeEventType[]> = {
    clock_in: ["break_start", "clock_out"],
    break_start: ["break_end"],
    break_end: ["break_start", "clock_out"],
    clock_out: ["clock_in"],
  };
  return transitions[last].includes(next);
}

export const timeTrackingRouter = router({
  registerEvent: commercialProcedure
    .input(z.object({
      eventType: timeEventType,
      deviceTime: z.string().datetime().optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().finite().nonnegative().max(10000),
      locationStatus: z.literal("success"),
      locationError: z.string().optional(),
      deviceInfo: z.string().optional(),
      idempotencyKey: z.string().min(1).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || !Number.isFinite(input.accuracy) || input.locationStatus !== "success") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O ponto só pode ser registrado após obter uma localização GPS válida." });
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      if (input.idempotencyKey) {
        const existing = await database.select().from(timeEvents)
          .where(eq(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
        if (existing[0]) return existing[0];
      }

      const lastEvents = await database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId)))
        .orderBy(desc(timeEvents.serverTime)).limit(1);
      const lastType = lastEvents[0]?.eventType as TimeEventType | undefined;
      if (!isValidTransition(lastType, input.eventType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sequência de marcação inválida. Confira o último evento do ponto." });
      }

      const result = await database.insert(timeEvents).values({
        companyId,
        memberAccountId: memberId,
        eventType: input.eventType,
        deviceTime: input.deviceTime ? new Date(input.deviceTime) : null,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        locationStatus: input.locationStatus || "success",
        locationError: input.locationError,
        deviceInfo: input.deviceInfo,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
        synced: true,
      });
      const insertedRows = await database.select().from(timeEvents).where(eq(timeEvents.id, Number((result as any)[0]?.insertId))).limit(1);
      const inserted = insertedRows[0];
      if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível recuperar a marcação criada." });

      await auditFromCtx(ctx, {
        action: "create",
        module: "time_tracking",
        entityType: "time_event",
        entityId: inserted.id,
        description: `Marcação de ponto: ${input.eventType}`,
      });
      return inserted;
    }),

  myHistory: commercialProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) return [];
      const database = await db.getDb();
      if (!database) return [];
      return database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId)))
        .orderBy(desc(timeEvents.serverTime))
        .limit(input?.limit || 50);
    }),

  requestCorrection: commercialProcedure
    .input(z.object({
      timeEventId: z.number().optional(),
      requestedType: timeEventType,
      requestedTime: z.string().datetime(),
      justification: z.string().min(10),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const result = await database.insert(timeCorrectionRequests).values({
        companyId,
        memberAccountId: memberId,
        timeEventId: input.timeEventId,
        requestedType: input.requestedType,
        requestedTime: new Date(input.requestedTime),
        justification: input.justification,
        status: "pending",
      });
      const insertedRows = await database.select().from(timeCorrectionRequests).where(eq(timeCorrectionRequests.id, Number((result as any)[0]?.insertId))).limit(1);
      const inserted = insertedRows[0];
      if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível recuperar a solicitação criada." });
      await auditFromCtx(ctx, {
        action: "create",
        module: "time_tracking",
        entityType: "correction_request",
        entityId: inserted.id,
        description: "Solicitação de correção de ponto",
      });
      return inserted;
    }),
});
