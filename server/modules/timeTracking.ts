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

/** Retorna os tipos de batida que podem ser adicionados (esquecidas) com base na sequência do dia. */
function getMissingEventTypes(events: { eventType: string }[]): TimeEventType[] {
  if (!events.length) return ["clock_in"];
  const types = events.map((e) => e.eventType as TimeEventType);
  const hasClockIn = types.includes("clock_in");
  const hasClockOut = types.includes("clock_out");
  const openBreak = types.filter((t) => t === "break_start").length > types.filter((t) => t === "break_end").length;
  const missing: TimeEventType[] = [];
  if (!hasClockIn) missing.push("clock_in");
  if (openBreak) missing.push("break_end");
  if (hasClockIn && !hasClockOut && !openBreak) missing.push("clock_out");
  if (hasClockIn && !openBreak) missing.push("break_start");
  return [...new Set(missing)];
}

export const timeTrackingRouter = router({
  // ... (full content continues below in the real call)
});
