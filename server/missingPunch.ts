/**
 * Detecção de batida de ponto faltante. NÃO cria marcações: apenas identifica jornadas abertas
 * (última marcação diferente de saída) para alertar o promotor (corrigir) e o administrador.
 * Jornada aberta = de dia anterior, ou do dia atual com horário limite configurado já passado.
 */
import { and, eq, gte } from "drizzle-orm";
import * as db from "./db";
import { memberAccounts, promoterProfiles, timeEvents } from "../drizzle/schema";

const TZ = "America/Sao_Paulo";
const LABEL: Record<string, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo" };
const NEXT: Record<string, string> = { clock_in: "Saída (ou intervalo)", break_start: "Retorno do intervalo e Saída", break_end: "Saída" };

function local(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}

export type MissingPunch = { memberId: number; companyId: number; name: string; email: string | null; lastType: string; lastLabel: string; missing: string; lastTime: string; day: string; reason: "previous_day" | "past_end_time" };

export async function findMissingPunches(opts: { companyId?: number; memberId?: number } = {}): Promise<MissingPunch[]> {
  const database = await db.getDb();
  if (!database) return [];
  const since = new Date(Date.now() - 14 * 86400000);
  const where = [gte(timeEvents.serverTime, since)];
  if (opts.companyId) where.push(eq(timeEvents.companyId, opts.companyId));
  if (opts.memberId) where.push(eq(timeEvents.memberAccountId, opts.memberId));
  const events = await database.select().from(timeEvents).where(and(...where)).orderBy(timeEvents.serverTime, timeEvents.id);
  const lastByMember = new Map<number, (typeof events)[number]>();
  for (const e of events) lastByMember.set(e.memberAccountId, e);
  const open = [...lastByMember.values()].filter((e) => e.eventType !== "clock_out");
  if (!open.length) return [];
  const now = local(new Date());
  const out: MissingPunch[] = [];
  for (const e of open) {
    const member = (await database.select({ name: memberAccounts.userName, email: memberAccounts.email, active: memberAccounts.active }).from(memberAccounts).where(and(eq(memberAccounts.id, e.memberAccountId), eq(memberAccounts.companyId, e.companyId))).limit(1))[0];
    if (!member?.active) continue;
    const t = e.deviceTime || e.serverTime;
    const lt = local(t);
    let reason: MissingPunch["reason"] | null = null;
    if (lt.date < now.date) reason = "previous_day";
    else {
      const profile = (await database.select({ end: promoterProfiles.workEndTime }).from(promoterProfiles).where(eq(promoterProfiles.memberAccountId, e.memberAccountId)).limit(1))[0];
      const limit = profile?.end || (await db.getSetting("auto_clock_out_time", e.companyId, "")) || "";
      if (limit && now.hm >= limit) reason = "past_end_time";
    }
    if (!reason) continue;
    out.push({ memberId: e.memberAccountId, companyId: e.companyId, name: member.name, email: member.email, lastType: e.eventType, lastLabel: LABEL[e.eventType] ?? e.eventType, missing: NEXT[e.eventType] ?? "Saída", lastTime: t.toISOString(), day: lt.date, reason });
  }
  return out;
}
