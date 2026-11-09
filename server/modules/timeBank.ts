/**
 * Banco de horas: carga em lote + saldo do período com a MESMA regra do promotor (Minha conta / tela inicial)
 * e do Espelho de Ponto (buildMirror). Usado por myTimeSummary, timesheetMirror.generate e o banco de horas da equipe.
 */
import { sql } from "drizzle-orm";
import * as db from "../db";
import { buildMirror, type LaborProfile, type MirrorReport } from "../../shared/timesheetMirror";
import { closedPeriodBalance } from "../../shared/timeBank";
import { loadApprovedDayExcuses } from "./correctionExtras";
import { loadAdjustmentsByEvent, loadMemberVacations, loadMirrorEventRows, loadMirrorOptions, toMirrorEvents } from "./mirrorData";

export type MemberReport = { memberId: number; labor: LaborProfile | null; report: MirrorReport; lastEventAt: string | null };

/** Perfis trabalhistas (jornada contratada) da empresa, numa consulta. */
export async function loadLaborProfiles(companyId: number, memberIds: number[]): Promise<Map<number, LaborProfile>> {
  const map = new Map<number, LaborProfile>();
  if (!memberIds.length) return map;
  const database = await db.getDb();
  if (!database) return map;
  const wanted = new Set(memberIds);
  const rows: any[] = ((await database.execute(sql`SELECT settingKey, settingValue FROM system_settings WHERE accountId = ${companyId} AND settingKey LIKE 'labor\\_profile:%'`)) as any)[0];
  for (const r of rows) {
    const id = Number(String(r.settingKey).split(":")[1]);
    if (!wanted.has(id)) continue;
    try { map.set(id, JSON.parse(r.settingValue)); } catch { /* ignora perfil corrompido */ }
  }
  return map;
}

/** Espelho (buildMirror) de cada funcionário no período, com consultas em lote (independe do nº de funcionários). */
export async function buildMemberReports(companyId: number, memberIds: number[], from: string, to: string, timeZone: string): Promise<Map<number, MemberReport>> {
  const out = new Map<number, MemberReport>();
  if (!memberIds.length) return out;
  const eventRows = await loadMirrorEventRows(companyId, memberIds, from, to);
  const eventsByMember = new Map<number, typeof eventRows>();
  for (const r of eventRows) eventsByMember.set(r.memberAccountId, [...(eventsByMember.get(r.memberAccountId) || []), r]);
  const [adjByEvent, laborByMember, excusesByMember, vacationsByMember, options] = await Promise.all([
    loadAdjustmentsByEvent(companyId, memberIds),
    loadLaborProfiles(companyId, memberIds),
    loadApprovedDayExcuses(companyId, memberIds, from, to),
    loadMemberVacations(companyId, memberIds, from, to),
    loadMirrorOptions(companyId),
  ]);
  for (const id of memberIds) {
    const rows = eventsByMember.get(id) || [];
    const labor = laborByMember.get(id) ?? null;
    const report = buildMirror({ events: toMirrorEvents(rows, adjByEvent), from, to, timeZone, labor, excuses: excusesByMember.get(id) || [], vacations: vacationsByMember.get(id) || [], options });
    const last = rows.length ? rows[rows.length - 1] : null;
    out.set(id, { memberId: id, labor, report, lastEventAt: last ? (last.deviceTime || last.serverTime).toISOString() : null });
  }
  return out;
}

export { closedPeriodBalance };
