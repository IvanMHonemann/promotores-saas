/**
 * Detecção de batida de ponto faltante. NÃO cria marcações: apenas identifica jornadas abertas
 * (última marcação diferente de saída) para alertar o promotor (corrigir) e o administrador.
 * Jornada aberta = de dia anterior, ou do dia atual com horário limite configurado já passado.
 */
import { inArray, sql } from "drizzle-orm";
import * as db from "./db";
import { memberAccounts, promoterProfiles } from "../drizzle/schema";

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
  // Só a ÚLTIMA marcação de cada funcionário (nos últimos 14 dias), em uma consulta; depois dados de membros em lote.
  const since = new Date(Date.now() - 14 * 86400000);
  const filters = [sql`te.serverTime >= ${since}`];
  if (opts.companyId) filters.push(sql`te.companyId = ${opts.companyId}`);
  if (opts.memberId) filters.push(sql`te.memberAccountId = ${opts.memberId}`);
  const where = sql.join(filters, sql` AND `);
  const [raw]: any = await database.execute(sql`
    SELECT te.id, te.companyId, te.memberAccountId, te.eventType, te.serverTime, te.deviceTime
    FROM time_events te
    JOIN (SELECT memberAccountId, MAX(id) AS maxId FROM time_events te WHERE ${where} GROUP BY memberAccountId) lastev ON lastev.maxId = te.id
    WHERE te.eventType <> 'clock_out'`);
  const open: Array<{ companyId: number; memberAccountId: number; eventType: string; t: Date }> = (raw as any[]).map((r) => ({ companyId: Number(r.companyId), memberAccountId: Number(r.memberAccountId), eventType: String(r.eventType), t: new Date(r.deviceTime || r.serverTime) }));
  if (!open.length) return [];
  const ids = open.map((o) => o.memberAccountId);
  const members = await database.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, name: memberAccounts.userName, email: memberAccounts.email, active: memberAccounts.active }).from(memberAccounts).where(inArray(memberAccounts.id, ids));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const profiles = await database.select({ id: promoterProfiles.memberAccountId, end: promoterProfiles.workEndTime }).from(promoterProfiles).where(inArray(promoterProfiles.memberAccountId, ids));
  const endByMember = new Map(profiles.map((p) => [p.id, p.end]));
  const companyIds = [...new Set(open.map((o) => o.companyId))];
  const [settingRows]: any = await database.execute(sql`SELECT accountId, settingValue FROM system_settings WHERE settingKey = 'auto_clock_out_time' AND accountId IN (${sql.join(companyIds.map((c) => sql`${c}`), sql`, `)})`);
  const limitByCompany = new Map<number, string>((settingRows as any[]).map((r) => [Number(r.accountId), String(r.settingValue)]));
  const now = local(new Date());
  const out: MissingPunch[] = [];
  for (const e of open) {
    const member = memberById.get(e.memberAccountId);
    if (!member?.active || member.companyId !== e.companyId) continue;
    const lt = local(e.t);
    let reason: MissingPunch["reason"] | null = null;
    if (lt.date < now.date) reason = "previous_day";
    else {
      const limit = endByMember.get(e.memberAccountId) || limitByCompany.get(e.companyId) || "";
      if (limit && now.hm >= limit) reason = "past_end_time";
    }
    if (!reason) continue;
    out.push({ memberId: e.memberAccountId, companyId: e.companyId, name: member.name, email: member.email, lastType: e.eventType, lastLabel: LABEL[e.eventType] ?? e.eventType, missing: NEXT[e.eventType] ?? "Saída", lastTime: e.t.toISOString(), day: lt.date, reason });
  }
  return out;
}
