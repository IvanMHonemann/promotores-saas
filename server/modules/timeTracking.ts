import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { commercialFeatureProcedure, companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { memberAccounts, timeEvents, timeCorrectionRequests } from "../../drizzle/schema";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import { auditFromCtx } from "../audit";
import { recordAdjustment } from "./timesheetMirror";
import { findMissingPunches } from "../missingPunch";
import { buildMirror, type LaborProfile, type MirrorEvent } from "../../shared/timesheetMirror";

const timeEventType = z.enum(["clock_in", "break_start", "break_end", "clock_out"]);
type TimeEventType = z.infer<typeof timeEventType>;

function localDay(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

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
  shiftStatus: commercialFeatureProcedure("timeTracking")
    .input(z.object({ timeZone: z.string().min(1).default("UTC") }).optional())
    .query(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      const timeZone = input?.timeZone || "UTC";
      if (!companyId || !memberId) return { status: "clock_in_required" as const, active: false, timeZone, localDate: localDay(new Date(), timeZone) };
      const database = await db.getDb();
      if (!database) return { status: "clock_in_required" as const, active: false, timeZone, localDate: localDay(new Date(), timeZone) };
      const today = localDay(new Date(), timeZone);
      const events = await database.select().from(timeEvents).where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId))).orderBy(desc(timeEvents.serverTime)).limit(100);
      const todayEvents = events.filter((event) => localDay(event.deviceTime || event.serverTime, timeZone) === today);
      const last = todayEvents[0];
      const active = Boolean(last && last.eventType !== "clock_out");
      return { status: active ? "active" as const : last?.eventType === "clock_out" ? "closed" as const : "clock_in_required" as const, active, timeZone, localDate: today, lastEvent: last?.eventType || null };
    }),

  companyToday: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ timeZone: z.string().min(1).max(128).default("UTC") }).optional())
    .query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) return [];
      const timeZone = input?.timeZone || "UTC";
      const today = localDay(new Date(), timeZone);
      const since = new Date(Date.now() - 36 * 60 * 60 * 1000);
      const rows = await database.select({
        promoterId: memberAccounts.id,
        promoterName: memberAccounts.userName,
        eventType: timeEvents.eventType,
        serverTime: timeEvents.serverTime,
        deviceTime: timeEvents.deviceTime,
        latitude: timeEvents.latitude,
        longitude: timeEvents.longitude,
        accuracy: timeEvents.accuracy,
      })
        .from(timeEvents)
        .innerJoin(memberAccounts, and(
          eq(timeEvents.memberAccountId, memberAccounts.id),
          eq(memberAccounts.companyId, ctx.accountId),
        ))
        .where(and(
          eq(timeEvents.companyId, ctx.accountId),
          eq(memberAccounts.role, "promoter"),
          gte(timeEvents.serverTime, since),
        ))
        .orderBy(desc(timeEvents.serverTime))
        .limit(5000);

      const eventsByPromoter = new Map<number, typeof rows>();
      for (const row of rows) {
        if (localDay(row.deviceTime || row.serverTime, timeZone) !== today) continue;
        const promoterEvents = eventsByPromoter.get(row.promoterId) || [];
        promoterEvents.push(row);
        eventsByPromoter.set(row.promoterId, promoterEvents);
      }

      const presence = [];
      for (const [promoterId, promoterEvents] of eventsByPromoter) {
        const chronological = [...promoterEvents].sort((a, b) => a.serverTime.getTime() - b.serverTime.getTime());
        const entry = chronological.find((event) => event.eventType === "clock_in");
        const last = chronological[chronological.length - 1];
        if (!entry || !last) continue;
        presence.push({
          promoterId,
          promoterName: entry.promoterName,
          clockInTime: entry.deviceTime || entry.serverTime,
          lastEventType: last.eventType,
          lastEventTime: last.deviceTime || last.serverTime,
          active: last.eventType === "clock_in" || last.eventType === "break_end",
          latitude: entry.latitude,
          longitude: entry.longitude,
          accuracy: entry.accuracy,
        });
      }

      return presence.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
    }),

  registerEvent: commercialFeatureProcedure("timeTracking")
    .input(z.object({
      eventType: timeEventType,
      deviceTime: z.string().datetime().optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().finite().nonnegative().max(10000),
      locationStatus: z.literal("success"),
      locationError: z.string().optional(),
      deviceInfo: z.string().optional(),
      idempotencyKey: z.string().min(1).max(64).optional(),
      timeZone: z.string().min(1),
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
        if (existing[0]) {
          if (Number(existing[0].companyId) !== companyId || Number(existing[0].memberAccountId) !== memberId) {
            throw new TRPCError({ code: "CONFLICT", message: "Esta chave de idempotência não pode ser reutilizada nesta sessão." });
          }
          return existing[0];
        }
      }

      const today = localDay(new Date(), input.timeZone);
      const recent = await database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId)))
        .orderBy(desc(timeEvents.serverTime)).limit(100);
      const todayEvents = recent.filter((event) => localDay(event.deviceTime || event.serverTime, input.timeZone) === today);
      const lastToday = todayEvents[0]?.eventType as TimeEventType | undefined;
      if (input.eventType === "clock_in" && lastToday === "clock_out") throw new TRPCError({ code: "BAD_REQUEST", message: "A jornada de hoje já foi encerrada. O próximo acesso será liberado no próximo dia." });
      if (input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) throw new TRPCError({ code: "BAD_REQUEST", message: "Bata a entrada antes de registrar este evento." });
      if (!isValidTransition(lastToday, input.eventType)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sequência de marcação inválida. Confira o último evento do ponto." });
      }

      let result: any;
      try {
        result = await database.insert(timeEvents).values({
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
      } catch (error: any) {
        const duplicate = error?.code === "ER_DUP_ENTRY" || /duplicate entry/i.test(String(error?.message ?? ""));
        if (!duplicate || !input.idempotencyKey) throw error;
        const existing = await database.select().from(timeEvents)
          .where(eq(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
        if (existing[0] && Number(existing[0].companyId) === companyId && Number(existing[0].memberAccountId) === memberId) {
          return existing[0];
        }
        throw new TRPCError({ code: "CONFLICT", message: "Esta chave de idempotência não pode ser reutilizada nesta sessão." });
      }
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

  companyHistory: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ memberId: z.number().int().positive(), month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) return [];
      const [year, mon] = input.month.split("-").map(Number);
      const start = new Date(Date.UTC(year, mon - 1, 1));
      const end = new Date(Date.UTC(year, mon, 1));
      return database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, input.memberId), eq(timeEvents.companyId, ctx.accountId), gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end)))
        .orderBy(timeEvents.serverTime);
    }),

  myMissingPunch: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    if (!ctx.accountId || !ctx.memberAccountId) return null;
    return (await findMissingPunches({ companyId: ctx.accountId, memberId: ctx.memberAccountId }))[0] ?? null;
  }),

  companyMissingPunches: companyAdminFeatureProcedure("timeTracking").query(({ ctx }) => findMissingPunches({ companyId: ctx.accountId })),

  myHistory: commercialFeatureProcedure("timeTracking")
    .input(z.object({ limit: z.number().min(1).max(100).default(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) return [];
      const database = await db.getDb();
      if (!database) return [];
      const conditions = [eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId)];
      if (input?.date) {
        const start = new Date(`${input.date}T00:00:00.000Z`);
        const end = new Date(start.getTime() + 86400000);
        conditions.push(gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end));
      }
      return database.select().from(timeEvents)
        .where(and(...conditions))
        .orderBy(desc(timeEvents.serverTime))
        .limit(input?.limit || 100);
    }),

  myTimeSummary: commercialFeatureProcedure("timeTracking")
    .input(z.object({ timeZone: z.string().min(1).max(128).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const empty = {
        periodLabel: "Mês atual",
        daysTracked: 0,
        workedMinutes: 0,
        expectedMinutes: 0,
        balanceMinutes: 0,
        overtimeMinutes: 0,
        deficitMinutes: 0,
        openShift: false,
        configured: false,
      };
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) return empty;
      const database = await db.getDb();
      if (!database) return empty;

      const timeZone = input?.timeZone || "America/Sao_Paulo";
      const today = localDay(new Date(), timeZone);
      const [year, month] = today.split("-").map(Number);
      const from = `${today.slice(0, 7)}-01`;
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const to = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;

      // Folga para turnos que cruzam meia-noite; o corte por dia local é feito no cálculo.
      const start = new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 3600000);
      const end = new Date(Date.parse(`${to}T00:00:00Z`) + 60 * 3600000);
      const rows = await database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId), gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end)))
        .orderBy(timeEvents.serverTime);

      const events: MirrorEvent[] = rows.map((row) => ({
        id: row.id,
        type: row.eventType,
        time: (row.deviceTime || row.serverTime).toISOString(),
        receivedAt: row.serverTime.toISOString(),
        synced: row.synced,
        notes: row.notes,
      }));

      let labor: LaborProfile | null = null;
      try {
        const raw = await db.getSetting(`labor_profile:${memberId}`, companyId, "");
        if (raw) labor = JSON.parse(raw) as LaborProfile;
      } catch { labor = null; }

      const report = buildMirror({ events, from, to, timeZone, labor });
      const configured = Boolean(labor?.dailyMinutes && labor.dailyMinutes > 0 && labor.workdays?.length);
      const openToday = report.days.find((day) => day.date === today && day.issues.some((issue) => issue.startsWith("Jornada incompleta")));

      // Saldo do mês só com dias fechados: jornada aberta de hoje não gera extra nem débito.
      let workedMinutes = report.totals.workedMinutes;
      let expectedMinutes = report.totals.expectedMinutes ?? 0;
      let overtimeMinutes = report.totals.overtimeMinutes ?? 0;
      let deficitMinutes = report.totals.deficitMinutes ?? 0;
      let balanceMinutes = report.totals.balanceMinutes ?? 0;
      if (openToday) {
        const todayWorked = openToday.workedMinutes;
        const todayExpected = openToday.expectedMinutes ?? 0;
        const todayDiff = openToday.diffMinutes ?? 0;
        workedMinutes = Math.max(0, workedMinutes - todayWorked);
        expectedMinutes = Math.max(0, expectedMinutes - todayExpected);
        if (todayDiff > 0) overtimeMinutes = Math.max(0, overtimeMinutes - todayDiff);
        if (todayDiff < 0) deficitMinutes = Math.max(0, deficitMinutes + todayDiff);
        balanceMinutes -= todayDiff;
      }

      const periodLabel = new Date(`${from}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone });
      return {
        periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
        daysTracked: report.totals.daysWithMarks,
        workedMinutes,
        expectedMinutes: configured ? expectedMinutes : 0,
        balanceMinutes: configured ? balanceMinutes : 0,
        overtimeMinutes: configured ? overtimeMinutes : 0,
        deficitMinutes: configured ? deficitMinutes : 0,
        openShift: Boolean(openToday),
        configured,
      };
    }),

  myCorrections: commercialFeatureProcedure("timeTracking")
    .query(async ({ ctx }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) return [];
      const database = await db.getDb();
      if (!database) return [];
      return database.select({ request: timeCorrectionRequests, event: timeEvents })
        .from(timeCorrectionRequests)
        .leftJoin(timeEvents, eq(timeCorrectionRequests.timeEventId, timeEvents.id))
        .where(and(eq(timeCorrectionRequests.companyId, companyId), eq(timeCorrectionRequests.memberAccountId, memberId)))
        .orderBy(desc(timeCorrectionRequests.createdAt));
    }),

  requestCorrection: commercialFeatureProcedure("timeTracking")
    .input(z.object({
      timeEventId: z.number().int().positive().optional().nullable(),
      requestedType: timeEventType,
      requestedTime: z.string().datetime(),
      justification: z.string().min(5),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });

      let timeEventId: number | null = null;
      if (input.timeEventId) {
        const event = await database.select().from(timeEvents).where(and(eq(timeEvents.id, input.timeEventId), eq(timeEvents.companyId, companyId), eq(timeEvents.memberAccountId, memberId))).limit(1);
        if (!event[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Marcação não encontrada para este funcionário." });
        timeEventId = input.timeEventId;
      }

      const result = await database.insert(timeCorrectionRequests).values({
        companyId,
        memberAccountId: memberId,
        timeEventId,
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
        description: timeEventId ? "Solicitação de correção de ponto" : "Solicitação de inclusão de batida faltante",
      });
      return inserted;
    }),

  correctionRequests: router({
    pending: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
      const database = await db.getDb();
      if (!database) return [];
      return database.select({
        request: timeCorrectionRequests,
        event: timeEvents,
        employee: { userName: memberAccounts.userName },
      })
        .from(timeCorrectionRequests)
        .innerJoin(memberAccounts, eq(timeCorrectionRequests.memberAccountId, memberAccounts.id))
        .leftJoin(timeEvents, eq(timeCorrectionRequests.timeEventId, timeEvents.id))
        .where(and(eq(timeCorrectionRequests.companyId, ctx.accountId), eq(timeCorrectionRequests.status, "pending")))
        .orderBy(desc(timeCorrectionRequests.createdAt));
    }),

    review: companyAdminFeatureProcedure("timeTracking")
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), reviewNotes: z.string().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        const rows = await database.select().from(timeCorrectionRequests).where(and(eq(timeCorrectionRequests.id, input.id), eq(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
        const request = rows[0];
        if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Solicitação de correção não encontrada." });
        if (request.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta solicitação já foi analisada." });

        if (input.status === "approved") {
          if (request.timeEventId) {
            const event = (await database.select().from(timeEvents).where(and(eq(timeEvents.id, request.timeEventId), eq(timeEvents.companyId, ctx.accountId))).limit(1))[0];
            if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "A marcação original não foi encontrada." });
            const previous = `${event.eventType} em ${(event.deviceTime || event.serverTime).toISOString()}`;
            const note = `Ajuste aprovado em ${new Date().toISOString()} pelo administrador. Antes: ${previous}. Motivo do funcionário: ${request.justification}`;
            await recordAdjustment({ companyId: ctx.accountId, timeEventId: event.id, correctionRequestId: request.id, memberAccountId: event.memberAccountId, originalType: event.eventType, originalTime: event.deviceTime || event.serverTime, correctedType: request.requestedType, correctedTime: request.requestedTime, justification: request.justification, reviewedByMemberId: ctx.memberAccountId ?? null, reviewedByName: ctx.user?.name ?? null });
            await database.update(timeEvents).set({ eventType: request.requestedType, deviceTime: request.requestedTime, notes: `${event.notes ? `${event.notes}\n` : ""}${note}` }).where(eq(timeEvents.id, event.id));
          } else {
            const note = `Batida incluída via solicitação aprovada em ${new Date().toISOString()}. Motivo: ${request.justification}`;
            const insertResult = await database.insert(timeEvents).values({
              companyId: request.companyId,
              memberAccountId: request.memberAccountId,
              eventType: request.requestedType,
              deviceTime: request.requestedTime,
              serverTime: new Date(),
              notes: note,
              synced: true,
              locationStatus: "unavailable",
            });
            const newEventId = Number((insertResult as any)[0]?.insertId);
            if (newEventId) {
              await recordAdjustment({
                companyId: ctx.accountId,
                timeEventId: newEventId,
                correctionRequestId: request.id,
                memberAccountId: request.memberAccountId,
                originalType: "missing",
                originalTime: request.requestedTime,
                correctedType: request.requestedType,
                correctedTime: request.requestedTime,
                justification: request.justification,
                reviewedByMemberId: ctx.memberAccountId ?? null,
                reviewedByName: ctx.user?.name ?? null,
              });
            }
          }
        }

        await database.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: new Date(), reviewNotes: input.reviewNotes || null }).where(eq(timeCorrectionRequests.id, request.id));
        await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicitação de correção ${input.status === "approved" ? "aprovada" : "rejeitada"}${!request.timeEventId ? " (inclusão de batida)" : ""}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
        return { success: true as const };
      }),
  }),
});