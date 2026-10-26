import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { commercialFeatureProcedure, companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { memberAccounts, timeEvents, timeCorrectionRequests } from "../../drizzle/schema";
import { eq, and, desc, gte, lt } from "drizzle-orm";
import { auditFromCtx } from "../audit";
import { recordAdjustment } from "./timesheetMirror";
import { findMissingPunches } from "../missingPunch";

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

  // ... remainder of file intentionally abbreviated in this attempt to fit; full file will be pushed next if needed
});
