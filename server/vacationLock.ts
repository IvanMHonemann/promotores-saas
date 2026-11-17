import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { vacationSchedules } from "../drizzle/schema";
import { todayInZone } from "@shared/expiry";
import { isOnVacationDay, vacationBlockMessage } from "@shared/vacationLock";
import * as db from "./db";

function asDateStr(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function dbDate(value: string): Date {
  return value as unknown as Date;
}

export type ActiveVacation = { startDate: string; endDate: string };

export async function findActiveVacationForMember(
  companyId: number,
  memberAccountId: number,
  now: Date = new Date(),
): Promise<ActiveVacation | null> {
  try {
    const { ensureVacationSchedulesTable } = await import("./modules/vacations");
    await ensureVacationSchedulesTable();
    const database = await db.getDb();
    if (!database) return null;
    const today = todayInZone(now);
    const rows = await database
      .select({
        startDate: vacationSchedules.startDate,
        endDate: vacationSchedules.endDate,
      })
      .from(vacationSchedules)
      .where(and(
        eq(vacationSchedules.companyId, companyId),
        eq(vacationSchedules.memberAccountId, memberAccountId),
        eq(vacationSchedules.status, "scheduled"),
        lte(vacationSchedules.startDate, dbDate(today)),
        gte(vacationSchedules.endDate, dbDate(today)),
      ))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const startDate = asDateStr(row.startDate);
    const endDate = asDateStr(row.endDate);
    if (!isOnVacationDay(today, startDate, endDate)) return null;
    return { startDate, endDate };
  } catch {
    // Mock de teste ou falha pontual do banco: não inventa bloqueio.
    return null;
  }
}

type VacationCtx = {
  user?: { role?: string } | null;
  accountId?: number | null;
  memberAccountId?: number | null;
  actingAsPlatform?: boolean;
};

/** Só o papel promotor é barrado. Admin, supervisor e admin da plataforma passam. */
export async function assertPromoterNotOnVacation(ctx: VacationCtx): Promise<void> {
  if (ctx.actingAsPlatform) return;
  if (ctx.user?.role !== "promoter") return;
  if (!ctx.accountId || !ctx.memberAccountId) return;
  const active = await findActiveVacationForMember(ctx.accountId, ctx.memberAccountId);
  if (!active) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: vacationBlockMessage(active.startDate, active.endDate),
    cause: { code: "VACATION_BLOCKED", startDate: active.startDate, endDate: active.endDate },
  });
}
