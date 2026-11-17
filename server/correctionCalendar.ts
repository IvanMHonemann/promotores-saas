/**
 * Dias do calendário de correção do próprio promotor (só o mês pedido, só a sessão dele).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import * as db from "./db";
import { memberAccounts, promoterProfiles, timeCorrectionRequests } from "../drizzle/schema";
import { getBrazilianHoliday } from "../shared/holidays";
import { looksLikeFullDayExcuse, excuseDay } from "../shared/correctionExcuse";
import type { LaborProfile } from "../shared/timesheetMirror";
import { classifyCorrectionDay, type CorrectionDayMark, type PunchType } from "../shared/correctionCalendar";
import { loadMemberVacations, loadMirrorEventRows, loadMirrorOptions } from "./modules/mirrorData";
import { ensureCorrectionExtras } from "./modules/correctionExtras";

const TZ = "America/Sao_Paulo";

function localParts(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, month: `${p.year}-${p.month}` };
}

function addMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type CorrectionCalendarDay = {
  date: string;
  mark: CorrectionDayMark;
  reason?: string;
  /** Nome do feriado abonado automaticamente (nacional ou facultativo tratado como feriado). */
  holiday?: string | null;
};

export type CorrectionCalendarResult = {
  month: string;
  today: string;
  nowHm: string;
  days: CorrectionCalendarDay[];
  needsCorrectionCount: number;
};

export async function getMyCorrectionCalendarDays(opts: {
  companyId: number;
  memberId: number;
  month: string;
  now?: Date;
}): Promise<CorrectionCalendarResult> {
  const now = localParts(opts.now ?? new Date());
  const month = opts.month;
  const from = `${month}-01`;
  const to = daysInMonth(month).at(-1)!;
  await ensureCorrectionExtras();
  const [events, vacationsMap, options, laborRaw, memberRow, corrections] = await Promise.all([
    loadMirrorEventRows(opts.companyId, [opts.memberId], from, to),
    loadMemberVacations(opts.companyId, [opts.memberId], from, to),
    loadMirrorOptions(opts.companyId),
    db.getSetting(`labor_profile:${opts.memberId}`, opts.companyId, ""),
    loadWorkEnd(opts.companyId, opts.memberId),
    loadMonthCorrections(opts.companyId, opts.memberId, from, to),
  ]);

  let labor: LaborProfile | null = null;
  try { labor = laborRaw ? JSON.parse(laborRaw) as LaborProfile : null; } catch { labor = null; }
  const workdays = labor?.workdays && labor.workdays.length ? new Set(labor.workdays) : null;
  const admission = (labor?.admissionDate || memberRow.admissionDate || "").slice(0, 10);
  const workEndTime = memberRow.workEndTime || memberRow.companyLimit || null;
  const vacations = vacationsMap.get(opts.memberId) || [];

  const punchesByDay = new Map<string, Array<{ type: PunchType; hm: string }>>();
  for (const ev of events as any[]) {
    if (ev.disregard) continue;
    const t = new Date(ev.deviceTime || ev.time || ev.serverTime);
    if (Number.isNaN(t.getTime())) continue;
    const loc = localParts(t);
    if (loc.date < from || loc.date > to) continue;
    const type = (ev.eventType || ev.type) as PunchType;
    if (!type) continue;
    const list = punchesByDay.get(loc.date) || [];
    list.push({ type, hm: loc.hm });
    punchesByDay.set(loc.date, list);
  }
  for (const list of punchesByDay.values()) list.sort((a, b) => a.hm.localeCompare(b.hm));

  const days: CorrectionCalendarDay[] = daysInMonth(month).map((date) => {
    if (admission && date < admission) return { date, mark: "ok" as const };
    const onVacation = vacations.some((v) => date >= v.startDate && date <= v.endDate);
    const rawHoliday = getBrazilianHoliday(date);
    const holiday = rawHoliday && (!rawHoliday.optional || options.optionalHolidaysAsHoliday) ? rawHoliday : null;
    const punches = (punchesByDay.get(date) || []);
    const dayCorrections = corrections.filter((c) => c.day === date);
    const hasPending = dayCorrections.some((c) => c.status === "pending");
    const approvedExcuse = dayCorrections.some((c) => c.status === "approved" && c.excuse);
    const excused = Boolean(holiday || onVacation || approvedExcuse);
    const classified = classifyCorrectionDay({
      date,
      today: now.date,
      punches: punches.map((p) => p.type),
      hasPendingCorrection: hasPending,
      excused,
      autoHoliday: Boolean(holiday),
      isWorkday: workdays ? workdays.has(weekdayOf(date)) : null,
      workEndTime,
      nowHm: now.hm,
      lastPunchHm: punches.at(-1)?.hm ?? null,
    });
    return { date, mark: classified.mark, reason: classified.reason, holiday: holiday?.name ?? null };
  });

  return {
    month,
    today: now.date,
    nowHm: now.hm,
    days,
    needsCorrectionCount: days.filter((d) => d.mark === "needs_correction").length,
  };
}

async function loadWorkEnd(companyId: number, memberId: number): Promise<{ workEndTime: string | null; companyLimit: string | null; admissionDate: string | null }> {
  const database = await db.getDb();
  if (!database) return { workEndTime: null, companyLimit: null, admissionDate: null };
  const [profile] = await database.select({
    workEndTime: promoterProfiles.workEndTime,
  }).from(promoterProfiles).where(and(eq(promoterProfiles.companyId, companyId), eq(promoterProfiles.memberAccountId, memberId))).limit(1);
  const [member] = await database.select({
    admissionDate: memberAccounts.admissionDate,
  }).from(memberAccounts).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.companyId, companyId))).limit(1);
  const companyLimit = (await db.getSetting("auto_clock_out_time", companyId, "")).trim() || null;
  const admission = member?.admissionDate ? String(member.admissionDate).slice(0, 10) : null;
  return { workEndTime: profile?.workEndTime || null, companyLimit, admissionDate: admission };
}

async function loadMonthCorrections(companyId: number, memberId: number, from: string, to: string) {
  const database = await db.getDb();
  if (!database) return [] as Array<{ day: string; status: string; excuse: boolean }>;
  const start = new Date(`${from}T00:00:00-03:00`);
  const end = new Date(`${to}T23:59:59.999-03:00`);
  const rows = await database.select({
    requestedTime: timeCorrectionRequests.requestedTime,
    status: timeCorrectionRequests.status,
    justificationType: timeCorrectionRequests.justificationType,
    justification: timeCorrectionRequests.justification,
    timeEventId: timeCorrectionRequests.timeEventId,
  }).from(timeCorrectionRequests).where(and(
    eq(timeCorrectionRequests.companyId, companyId),
    eq(timeCorrectionRequests.memberAccountId, memberId),
    sql`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
    gte(timeCorrectionRequests.requestedTime, start),
    lte(timeCorrectionRequests.requestedTime, end),
  ));
  return rows.map((r) => ({
    day: excuseDay(r.requestedTime),
    status: String(r.status),
    excuse: looksLikeFullDayExcuse(r),
  }));
}

export { addMonth };
