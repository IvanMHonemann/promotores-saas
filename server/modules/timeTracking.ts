import { detectImageMime } from "../mediaKeys";
import { MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE } from "../../shared/uploadLimits";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { commercialFeatureProcedure, companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { memberAccounts, timeEvents, timeCorrectionRequests } from "../../drizzle/schema";
import { eq, and, desc, gte, lt, lte, inArray, sql } from "drizzle-orm";
import { auditFromCtx } from "../audit";
import { recordAdjustment } from "./timesheetMirror";
async function safeAdjustment(data: Parameters<typeof recordAdjustment>[0]) { try { await recordAdjustment(data); } catch (error) { console.error("adjustment log failed", error); } }
import { findMissingPunches } from "../missingPunch";
import { buildMirror, type LaborProfile, type MirrorEvent } from "../../shared/timesheetMirror";
import { ensureCorrectionExtras, loadApprovedDayExcuses, saveCorrectionAttachment } from "./correctionExtras";
import { storageGetSignedUrl } from "../storage";
import { readTimeAlert, resolvePunchTime, TIME_ALERT_MARKER } from "../../shared/punchTime";
import { loadMemberVacations, loadMirrorEventRows, loadMirrorOptions } from "./mirrorData";
import { excuseDay, fullDayExcuseLabel, isFullDayExcuseType, looksLikeFullDayExcuse, noonInSaoPaulo } from "../../shared/correctionExcuse";
import { punchOrderError } from "@shared/punchOrder";
import { activeDisregards, appendOriginalPunch, appendTreatment, effectiveRows, ensureDisregardsTable, ensurePunchLedger, NEW_SHIFT_MARKER, supersededIds } from "../ponto/ledger";
import { effectiveEventTime } from "./mirrorData";
import { clockEvidenceSchema } from "./offlineSync";
import { assessDeviceClock, clockAlertNote, OFFLINE_SEQUENCE_MARKER, readClockAlert } from "../../shared/offlineClock";

const inFlightCorrections = new Set<string>();

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

type Db = NonNullable<Awaited<ReturnType<typeof db.getDb>>>;
type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
/**
 * Aplica uma solicitação aprovada SEM alterar a marcação original (Portaria 671, art. 74 IV):
 * - correção de batida existente => novo registro "adjustment" que aponta para a original (replacesEventId);
 * - batida esquecida => novo registro "inclusion".
 * A original continua no banco, no AFD e na verificação de integridade; no cálculo ela passa a ser "desconsiderada".
 */
async function applyApprovedCorrection(database: DbOrTx, request: typeof timeCorrectionRequests.$inferSelect, ctx: { accountId: number; memberAccountId?: number | null; user?: { name?: string | null } | null }, opts?: { skipMissing?: boolean }) {
  if (looksLikeFullDayExcuse(request)) return;
  await ensurePunchLedger();
  const decidedByName = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
  if (request.timeEventId) {
    const event = (await database.select().from(timeEvents).where(and(eq(timeEvents.id, request.timeEventId), eq(timeEvents.companyId, ctx.accountId))).limit(1))[0];
    if (!event) {
      if (opts?.skipMissing) return;
      throw new TRPCError({ code: "NOT_FOUND", message: "A marcação original não foi encontrada." });
    }
    const already = await database.select({ id: timeEvents.id }).from(timeEvents).where(and(eq(timeEvents.companyId, ctx.accountId), eq(timeEvents.replacesEventId, event.id))).limit(1);
    if (already[0]) {
      if (opts?.skipMissing) return;
      throw new TRPCError({ code: "CONFLICT", message: "Esta marcação já foi corrigida. Peça a correção sobre a marcação atual." });
    }
    const originalTime = event.deviceTime || event.serverTime;
    const newId = await appendTreatment(database, {
      companyId: ctx.accountId,
      memberAccountId: event.memberAccountId,
      kind: "adjustment",
      replacesEventId: event.id,
      eventType: request.requestedType,
      markedAt: request.requestedTime,
      reason: request.justification,
      correctionRequestId: request.id,
      decidedByMemberId: ctx.memberAccountId ?? null,
      decidedByName,
      notes: `Ajuste aprovado. Original preservada: ${event.eventType} em ${originalTime.toISOString()} (registro #${event.id}${event.nsr ? `, NSR ${event.nsr}` : ""}).`,
      timeZone: event.timeZone || undefined,
    });
    await safeAdjustment({ companyId: ctx.accountId, timeEventId: newId, correctionRequestId: request.id, memberAccountId: event.memberAccountId, originalType: event.eventType, originalTime, correctedType: request.requestedType, correctedTime: request.requestedTime, justification: request.justification, reviewedByMemberId: ctx.memberAccountId ?? null, reviewedByName: ctx.user?.name ?? null });
    return;
  }
  const newEventId = await appendTreatment(database, {
    companyId: request.companyId,
    memberAccountId: request.memberAccountId,
    kind: "inclusion",
    replacesEventId: null,
    eventType: request.requestedType,
    markedAt: request.requestedTime,
    reason: request.justification,
    correctionRequestId: request.id,
    decidedByMemberId: ctx.memberAccountId ?? null,
    decidedByName,
    notes: `Batida incluída por solicitação aprovada (não é marcação original do funcionário).`,
  });
  if (newEventId) {
    await safeAdjustment({
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
      await ensurePunchLedger();
      const events = await effectiveRows(await database.select().from(timeEvents).where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId))).orderBy(desc(effectiveEventTime)).limit(100));
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
      await ensurePunchLedger();
      const rawRows = await database.select({
        id: timeEvents.id,
        companyId: timeEvents.companyId,
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
      const rows = await effectiveRows(rawRows);

      const eventsByPromoter = new Map<number, typeof rows>();
      for (const row of rows) {
        if (localDay(row.deviceTime || row.serverTime, timeZone) !== today) continue;
        const promoterEvents = eventsByPromoter.get(row.promoterId) || [];
        promoterEvents.push(row);
        eventsByPromoter.set(row.promoterId, promoterEvents);
      }

      const presence = [];
      for (const [promoterId, promoterEvents] of eventsByPromoter) {
        const chronological = [...promoterEvents].sort((a, b) => (a.deviceTime || a.serverTime).getTime() - (b.deviceTime || b.serverTime).getTime());
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
      /** true quando a marcação foi guardada sem internet e está sendo sincronizada agora. */
      offline: z.boolean().optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().finite().nonnegative().max(10000),
      locationStatus: z.literal("success"),
      locationError: z.string().optional(),
      deviceInfo: z.string().optional(),
      idempotencyKey: z.string().min(1).max(64).optional(),
      timeZone: z.string().min(1),
      notes: z.string().optional(),
      /** Evidência do relógio do aparelho (âncora com o servidor + tempo monotônico) para marcações offline. */
      clock: clockEvidenceSchema,
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
      await ensurePunchLedger();

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

      // Horário oficial: o do servidor, salvo tolerância de 5 min ou marcação offline legítima (ver shared/punchTime).
      const punchTime = resolvePunchTime({ deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, serverNow: new Date(), offline: input.offline });
      const today = localDay(punchTime.effectiveTime, input.timeZone);
      const recent = await effectiveRows(await database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, memberId), eq(timeEvents.companyId, companyId)))
        .orderBy(desc(effectiveEventTime)).limit(100));
      // Só conta o que aconteceu ATÉ o horário desta marcação: uma batida offline sincronizada depois é validada
      // contra a anterior a ela, não contra a última gravada.
      const effectiveMs = punchTime.effectiveTime.getTime();
      const todayEvents = recent.filter((event) => localDay(event.deviceTime || event.serverTime, input.timeZone) === today && (event.deviceTime || event.serverTime).getTime() <= effectiveMs);
      const lastToday = todayEvents[0]?.eventType as TimeEventType | undefined;
      const isOfflinePunch = punchTime.alert === "offline";
      const clockNote = isOfflinePunch && input.deviceTime ? clockAlertNote(new Date(input.deviceTime), assessDeviceClock(new Date(input.deviceTime), input.clock, new Date())) : null;
      // Portaria 671, art. 74 I: o sistema não pode restringir horários de marcação. Uma nova entrada depois da
      // saída no mesmo dia é aceita e fica sinalizada para o administrador conferir (ex.: dupla pegada, retorno).
      const newShiftSameDay = input.eventType === "clock_in" && lastToday === "clock_out";
      const sequenceOk = !(input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) && isValidTransition(lastToday, input.eventType);
      // Marcação offline já aconteceu no aparelho: recusar faria a batida sumir (Portaria 671 proíbe restringir marcações).
      // Ela é aceita e sinalizada para o gestor conferir.
      const offlineSequenceNote = !sequenceOk && isOfflinePunch ? `${OFFLINE_SEQUENCE_MARKER} Marcação offline fora da sequência esperada (anterior: ${lastToday ?? "nenhuma"}). Conferir com o funcionário.` : null;
      const notesWithAlert = [input.notes, punchTime.note, clockNote, offlineSequenceNote, newShiftSameDay ? `${NEW_SHIFT_MARKER} Nova entrada registrada depois da saída no mesmo dia.` : null].filter(Boolean).join("\n") || undefined;
      if (!sequenceOk && !isOfflinePunch) {
        if (input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) throw new TRPCError({ code: "BAD_REQUEST", message: "Bata a entrada antes de registrar este evento." });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sequência de marcação inválida. Confira o último evento do ponto." });
      }

      let insertedId: number;
      try {
        insertedId = await appendOriginalPunch({
          companyId,
          memberAccountId: memberId,
          eventType: input.eventType,
          deviceTimeToStore: punchTime.deviceTimeToStore,
          clientTime: input.deviceTime ? new Date(input.deviceTime) : null,
          latitude: input.latitude,
          longitude: input.longitude,
          accuracy: input.accuracy,
          locationStatus: "success",
          locationError: input.locationError,
          deviceInfo: input.deviceInfo,
          idempotencyKey: input.idempotencyKey,
          notes: notesWithAlert,
          timeZone: input.timeZone,
          offline: punchTime.alert === "offline",
        });
      } catch (error: any) {
        const duplicate = error?.code === "ER_DUP_ENTRY" || /duplicate entry/i.test(String(error?.message ?? error?.cause?.message ?? ""));
        if (!duplicate || !input.idempotencyKey) throw error;
        const existing = await database.select().from(timeEvents)
          .where(eq(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
        if (existing[0] && Number(existing[0].companyId) === companyId && Number(existing[0].memberAccountId) === memberId) {
          return existing[0];
        }
        throw new TRPCError({ code: "CONFLICT", message: "Esta chave de idempotência não pode ser reutilizada nesta sessão." });
      }
      const insertedRows = await database.select().from(timeEvents).where(eq(timeEvents.id, insertedId)).limit(1);
      const inserted = insertedRows[0];
      if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível recuperar a marcação criada." });

      await auditFromCtx(ctx, {
        action: "create",
        module: "time_tracking",
        entityType: "time_event",
        entityId: inserted.id,
        description: `Marcação de ponto (NSR ${inserted.nsr ?? "?"}): ${input.eventType}${newShiftSameDay ? " — nova entrada após saída no mesmo dia" : ""}${punchTime.alert === "server_time_used" ? ` — ALERTA: ${punchTime.note?.replace(TIME_ALERT_MARKER, "").trim()}` : punchTime.alert === "offline" ? " (feita offline)" : ""}${clockNote ? " — ALERTA: possível alteração do relógio do aparelho" : ""}${offlineSequenceNote ? " — fora de sequência" : ""}`,
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
      await ensurePunchLedger();
      // Desconsideradas continuam na lista (marcadas em `disregard`) para o admin ver e poder reconsiderar.
      return effectiveRows(await database.select().from(timeEvents)
        .where(and(eq(timeEvents.memberAccountId, input.memberId), eq(timeEvents.companyId, ctx.accountId), gte(effectiveEventTime, start), lt(effectiveEventTime, end)))
        .orderBy(effectiveEventTime), { keepDisregarded: true });
    }),

  /**
   * Desconsidera uma batida (ex.: inclusão repetida). Justificativa obrigatória. NÃO apaga nada:
   * a marcação continua no banco/AFD; só deixa de contar no espelho e no cálculo. Pode ser revertida.
   */
  disregardEvent: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ eventId: z.number().int().positive(), reason: z.string().trim().min(5, "Escreva pelo menos 5 caracteres na justificativa.").max(500) }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await ensurePunchLedger();
      await ensureDisregardsTable();
      const event = (await database.select().from(timeEvents).where(and(eq(timeEvents.id, input.eventId), eq(timeEvents.companyId, ctx.accountId))).limit(1))[0];
      if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Marcação não encontrada nesta empresa." });
      if ((await supersededIds(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta marcação já foi substituída por um ajuste. Desconsidere a marcação atual." });
      if ((await activeDisregards(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError({ code: "CONFLICT", message: "Esta batida já está desconsiderada." });
      const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
      await database.execute(sql`INSERT INTO time_event_disregards (companyId, memberAccountId, timeEventId, reason, decidedByMemberId, decidedByName)
        VALUES (${ctx.accountId}, ${event.memberAccountId}, ${event.id}, ${input.reason}, ${ctx.memberAccountId ?? null}, ${by})`);
      const markedAt = (event.deviceTime || event.serverTime).toISOString();
      await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: event.id, description: `Batida desconsiderada (${event.eventType} em ${markedAt}). Motivo: ${input.reason}`, newData: { eventId: event.id, memberAccountId: event.memberAccountId, eventType: event.eventType, markedAt, reason: input.reason, disregarded: true } });
      return { success: true as const };
    }),

  /** Reverte a desconsideração: a batida volta a contar. O registro da desconsideração fica no histórico (revertedAt). */
  reconsiderEvent: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ eventId: z.number().int().positive(), reason: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await ensureDisregardsTable();
      const active = (await activeDisregards(ctx.accountId, [input.eventId])).get(input.eventId);
      if (!active) throw new TRPCError({ code: "NOT_FOUND", message: "Esta batida não está desconsiderada." });
      const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
      await database.execute(sql`UPDATE time_event_disregards SET revertedAt = CURRENT_TIMESTAMP, revertedByMemberId = ${ctx.memberAccountId ?? null}, revertedByName = ${by}, revertReason = ${input.reason || null}
        WHERE id = ${active.id} AND companyId = ${ctx.accountId} AND revertedAt IS NULL`);
      await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: input.eventId, description: `Batida reconsiderada (volta a contar no espelho)${input.reason ? `. Motivo: ${input.reason}` : ""}`, oldData: { disregardReason: active.reason, disregardedBy: active.decidedByName }, newData: { eventId: input.eventId, disregarded: false, reason: input.reason || null } });
      return { success: true as const };
    }),

  companyApprovedExcuses: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ memberId: z.number().int().positive(), month: z.string().regex(/^\d{4}-\d{2}$/) }))
    .query(async ({ ctx, input }) => {
      const from = `${input.month}-01`;
      const [year, mon] = input.month.split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
      const to = `${input.month}-${String(lastDay).padStart(2, "0")}`;
      const map = await loadApprovedDayExcuses(ctx.accountId, [input.memberId], from, to);
      return map.get(input.memberId) || [];
    }),

  myMissingPunch: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    if (!ctx.accountId || !ctx.memberAccountId) return null;
    const found = (await findMissingPunches({ companyId: ctx.accountId, memberId: ctx.memberAccountId }))[0];
    if (!found) return null;
    const database = await db.getDb();
    if (!database) return found;
    // Some se houver pedido pendente ou aprovado para o mesmo dia.
    // Volta a aparecer só se o pedido for recusado (ou não existir).
    const pending = await database.select({
      id: timeCorrectionRequests.id,
      status: timeCorrectionRequests.status,
      requestedTime: timeCorrectionRequests.requestedTime,
    }).from(timeCorrectionRequests)
      .where(and(
        eq(timeCorrectionRequests.companyId, ctx.accountId),
        eq(timeCorrectionRequests.memberAccountId, ctx.memberAccountId),
        sql`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
      ))
      .orderBy(desc(timeCorrectionRequests.createdAt))
      .limit(20);
    const covered = pending.some((row) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row.requestedTime));
      return day === found.day;
    });
    return covered ? null : found;
  }),

  companyMissingPunches: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const found = await findMissingPunches({ companyId: ctx.accountId });
    if (!found.length) return found;
    const database = await db.getDb();
    if (!database) return found;
    const memberIds = [...new Set(found.map((m) => m.memberId))];
    const rows = await database.select({
      memberAccountId: timeCorrectionRequests.memberAccountId,
      requestedTime: timeCorrectionRequests.requestedTime,
    }).from(timeCorrectionRequests)
      .where(and(
        eq(timeCorrectionRequests.companyId, ctx.accountId),
        inArray(timeCorrectionRequests.memberAccountId, memberIds),
        sql`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
      ))
      .orderBy(desc(timeCorrectionRequests.createdAt))
      .limit(500);
    const covered = new Set<string>();
    for (const row of rows) {
      const day = excuseDay(row.requestedTime);
      covered.add(`${row.memberAccountId}:${day}`);
    }
    // Esconde o alerta se houver pedido pendente ou aprovado cobrindo o mesmo dia.
    // Volta a aparecer só se o pedido for recusado (ou não existir).
    return found.filter((m) => !covered.has(`${m.memberId}:${m.day}`));
  }),

  myHistory: commercialFeatureProcedure("timeTracking")
    .input(z.object({ limit: z.number().min(1).max(100).default(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), includeDisregarded: z.boolean().optional() }).optional())
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
        conditions.push(gte(effectiveEventTime, start), lt(effectiveEventTime, end));
      }
      await ensurePunchLedger();
      const rows = await database.select().from(timeEvents)
        .where(and(...conditions))
        .orderBy(desc(effectiveEventTime))
        .limit(input?.limit || 100);
      // Padrão: só batidas que contam. A tela de ponto pede as desconsideradas para mostrá-las riscadas.
      if (input?.includeDisregarded) return effectiveRows(rows, { keepDisregarded: true });
      return (await effectiveRows(rows)).map((r) => ({ ...r, disregard: null }));
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

      const rows = await loadMirrorEventRows(companyId, [memberId], from, to);

      const events: MirrorEvent[] = rows.map((row) => ({
        id: row.id,
        type: row.eventType,
        time: (row.deviceTime || row.serverTime).toISOString(),
        receivedAt: row.serverTime.toISOString(),
        synced: row.synced,
        notes: row.notes,
        timeAlert: readTimeAlert(row.notes),
        offline: Boolean((row as any).offline),
        clockAlert: readClockAlert(row.notes),
        disregarded: row.disregard ? { reason: row.disregard.reason, by: row.disregard.decidedByName, at: row.disregard.createdAt } : null,
      }));

      let labor: LaborProfile | null = null;
      try {
        const raw = await db.getSetting(`labor_profile:${memberId}`, companyId, "");
        if (raw) labor = JSON.parse(raw) as LaborProfile;
      } catch { labor = null; }

      const excusesByMember = await loadApprovedDayExcuses(companyId, [memberId], from, to);
      const vacationsByMember = await loadMemberVacations(companyId, [memberId], from, to);
      const options = await loadMirrorOptions(companyId);
      const report = buildMirror({ events, from, to, timeZone, labor, excuses: excusesByMember.get(memberId) || [], vacations: vacationsByMember.get(memberId) || [], options });
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
      requestedType: timeEventType.optional(),
      requestedTime: z.string().datetime().optional(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      justification: z.string().max(2000).optional(),
      justificationType: z.enum(["normal", "holiday", "day_off", "medical_certificate", "other"]).optional(),
      attachmentBase64: z.string().max(MAX_PHOTO_BASE64_CHARS + 100, PHOTO_TOO_LARGE_MESSAGE).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = ctx.accountId;
      const memberId = ctx.memberAccountId;
      if (!companyId || !memberId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const jType = input.justificationType || "normal";
      const fullDay = isFullDayExcuseType(jType);
      const reason = (input.justification || "").trim() || (fullDay ? fullDayExcuseLabel(jType) : "");
      if (!fullDay && reason.length < 5) throw new TRPCError({ code: "BAD_REQUEST", message: "Escreva pelo menos 5 caracteres na justificativa." });
      if (!fullDay && !input.requestedType) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o tipo de marcação." });
      await ensureCorrectionExtras();

      let timeEventId: number | null = null;
      if (fullDay) {
        timeEventId = null;
      } else if (input.timeEventId) {
        await ensurePunchLedger();
        const event = await database.select().from(timeEvents).where(and(eq(timeEvents.id, input.timeEventId), eq(timeEvents.companyId, companyId), eq(timeEvents.memberAccountId, memberId))).limit(1);
        if (!event[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Marcação não encontrada para este funcionário." });
        timeEventId = input.timeEventId;
      }

      let requestedTime: Date;
      if (fullDay) {
        const day = input.date || (input.requestedTime ? excuseDay(input.requestedTime) : "");
        if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a data do abono." });
        requestedTime = noonInSaoPaulo(day);
      } else {
        if (!input.requestedTime) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o horário da correção." });
        requestedTime = new Date(input.requestedTime);
      }

      if (!fullDay && input.requestedType) {
        const day = excuseDay(requestedTime);
        const start = new Date(`${day}T00:00:00-03:00`), end = new Date(`${day}T23:59:59.999-03:00`);
        await ensurePunchLedger();
        const dayRows = await effectiveRows(await database.select({ id: timeEvents.id, companyId: timeEvents.companyId, type: timeEvents.eventType, deviceTime: timeEvents.deviceTime, serverTime: timeEvents.serverTime }).from(timeEvents)
          .where(and(eq(timeEvents.companyId, companyId), eq(timeEvents.memberAccountId, memberId), gte(effectiveEventTime, start), lte(effectiveEventTime, end))));
        const dayEvents = dayRows.map((r) => ({ id: r.id, type: r.type, time: r.deviceTime || r.serverTime }));
        const orderError = punchOrderError(dayEvents as any, { type: input.requestedType, time: requestedTime, replaceId: timeEventId });
        if (orderError) throw new TRPCError({ code: "BAD_REQUEST", message: orderError });
      }

      // Evita pedidos duplicados por toque duplo / reenvio simultâneo.
      const lockKey = `${companyId}:${memberId}:${excuseDay(requestedTime)}:${fullDay ? "day" : input.requestedType}:${timeEventId ?? ""}`;
      if (inFlightCorrections.has(lockKey)) throw new TRPCError({ code: "CONFLICT", message: "Este pedido já está sendo enviado. Aguarde." });
      inFlightCorrections.add(lockKey);
      try {
      const existing = await database.select({
        id: timeCorrectionRequests.id,
        status: timeCorrectionRequests.status,
        requestedTime: timeCorrectionRequests.requestedTime,
        requestedType: timeCorrectionRequests.requestedType,
        timeEventId: timeCorrectionRequests.timeEventId,
        justificationType: timeCorrectionRequests.justificationType,
        justification: timeCorrectionRequests.justification,
      }).from(timeCorrectionRequests).where(and(
        eq(timeCorrectionRequests.companyId, companyId),
        eq(timeCorrectionRequests.memberAccountId, memberId),
        sql`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
      )).orderBy(desc(timeCorrectionRequests.createdAt)).limit(100);

      if (input.attachmentBase64) {
        const head = Buffer.from(input.attachmentBase64.replace(/^data:[^;]+;base64,/, "").slice(0, 64), "base64");
        if (!detectImageMime(head)) throw new TRPCError({ code: "BAD_REQUEST", message: "O anexo precisa ser uma imagem válida (JPG, PNG ou WebP)." });
      }

      if (fullDay) {
        const day = excuseDay(requestedTime);
        if (existing.some((row) => looksLikeFullDayExcuse(row) && excuseDay(row.requestedTime) === day)) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um abono pendente ou aprovado para este dia." });
        }
      } else {
        const day = excuseDay(requestedTime);
        const samePunch = existing.some((row) =>
          !looksLikeFullDayExcuse(row)
          && excuseDay(row.requestedTime) === day
          && row.requestedType === input.requestedType
          && (row.timeEventId ?? null) === (timeEventId ?? null)
        );
        if (samePunch) {
          throw new TRPCError({ code: "CONFLICT", message: "Já existe um pedido pendente ou aprovado para esta batida neste dia." });
        }
      }

      const result = await database.insert(timeCorrectionRequests).values({
        companyId,
        memberAccountId: memberId,
        timeEventId,
        requestedType: fullDay ? "clock_in" : input.requestedType!,
        requestedTime,
        justification: reason,
        status: "pending",
        justificationType: jType,
      });
      const insertedRows = await database.select().from(timeCorrectionRequests).where(eq(timeCorrectionRequests.id, Number((result as any)[0]?.insertId))).limit(1);
      const inserted = insertedRows[0];
      if (!inserted) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível recuperar a solicitação criada." });

      // Persist type + optional photo (columns created by ensureCorrectionExtras)
      let attachmentKey: string | null = null;
      try {
        if (input.attachmentBase64) {
          attachmentKey = await saveCorrectionAttachment(companyId, inserted.id, input.attachmentBase64);
        }
        if (attachmentKey) {
          await database.execute(sql`UPDATE time_correction_requests SET justificationType = ${jType}, attachmentKey = ${attachmentKey} WHERE id = ${inserted.id}`);
        } else {
          await database.execute(sql`UPDATE time_correction_requests SET justificationType = ${jType} WHERE id = ${inserted.id}`);
        }
      } catch (err) {
        // Do not fail the whole request if extra columns are not ready yet
        console.warn("correction extras persist skipped", err);
      }

      await auditFromCtx(ctx, {
        action: "create",
        module: "time_tracking",
        entityType: "correction_request",
        entityId: inserted.id,
        description: fullDay ? `Solicitação de abono (${fullDayExcuseLabel(jType)})` : timeEventId ? "Solicitação de correção de ponto" : "Solicitação de inclusão de batida faltante",
      });
      return { ...inserted, justificationType: input.justificationType || "normal", attachmentKey };
      } finally { inFlightCorrections.delete(lockKey); }
    }),

  correctionRequests: router({
    pending: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
      const database = await db.getDb();
      if (!database) return [];
      await ensureCorrectionExtras();
      const rows = await database.select({
        request: timeCorrectionRequests,
        event: timeEvents,
        employee: { userName: memberAccounts.userName },
      })
        .from(timeCorrectionRequests)
        .innerJoin(memberAccounts, eq(timeCorrectionRequests.memberAccountId, memberAccounts.id))
        .leftJoin(timeEvents, eq(timeCorrectionRequests.timeEventId, timeEvents.id))
        .where(and(eq(timeCorrectionRequests.companyId, ctx.accountId), eq(timeCorrectionRequests.status, "pending")))
        .orderBy(desc(timeCorrectionRequests.createdAt));
      return Promise.all(rows.map(async (row) => {
        const key = (row.request as any).attachmentKey as string | null;
        let attachmentUrl: string | null = null;
        if (key) {
          try { attachmentUrl = await storageGetSignedUrl(key); } catch { attachmentUrl = null; }
        }
        return { ...row, attachmentUrl };
      }));
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

        // Correção e mudança de status juntas: se uma falhar, nada é gravado (evita batida alterada com solicitação ainda pendente).
        await database.transaction(async (tx) => {
          const claimed: any = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: new Date(), reviewNotes: input.reviewNotes || null }).where(and(eq(timeCorrectionRequests.id, request.id), eq(timeCorrectionRequests.status, "pending")));
          if (Number(claimed?.[0]?.affectedRows ?? 1) === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta solicitação já foi analisada." });
          if (input.status === "approved") await applyApprovedCorrection(tx, request, ctx);
        });
        const excuse = isFullDayExcuseType(request.justificationType);
        await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicitação de correção ${input.status === "approved" ? "aprovada" : "rejeitada"}${excuse ? ` (abono ${fullDayExcuseLabel(request.justificationType)})` : !request.timeEventId ? " (inclusão de batida)" : ""}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
        return { success: true as const };
      }),

    reviewMany: companyAdminFeatureProcedure("timeTracking")
      .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(20), status: z.enum(["approved", "rejected"]), reviewNotes: z.string().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const database = await db.getDb();
        if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
        let done = 0;
        for (const id of input.ids) {
          const rows = await database.select().from(timeCorrectionRequests).where(and(eq(timeCorrectionRequests.id, id), eq(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
          const request = rows[0];
          if (!request || request.status !== "pending") continue;
          const applied = await database.transaction(async (tx) => {
            const claimed: any = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: new Date(), reviewNotes: input.reviewNotes || null }).where(and(eq(timeCorrectionRequests.id, request.id), eq(timeCorrectionRequests.status, "pending")));
            if (Number(claimed?.[0]?.affectedRows ?? 1) === 0) return false;
            if (input.status === "approved") await applyApprovedCorrection(tx, request, ctx, { skipMissing: true });
            return true;
          });
          if (applied) done += 1;
        }
        await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: input.ids[0], description: `${done} solicitação(ões) de correção ${input.status === "approved" ? "aprovadas" : "rejeitadas"} em lote`, newData: { status: input.status, ids: input.ids, reviewNotes: input.reviewNotes || null } });
        return { success: true as const, count: done };
      }),
  }),
});