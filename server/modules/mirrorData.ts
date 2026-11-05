/**
 * Carga de dados compartilhada pelo Espelho de Ponto (tela/PDF), arquivamento mensal e demais usos do buildMirror.
 * Mantém numa só função: janela de busca das marcações, férias programadas e configuração de feriados.
 */
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import * as db from "../db";
import { timeEvents, vacationSchedules } from "../../drizzle/schema";
import type { MirrorOptions, VacationRange } from "../../shared/timesheetMirror";

/** Horário efetivo da marcação — o MESMO usado no cálculo do espelho (deviceTime, senão serverTime). */
export const effectiveEventTime = sql`COALESCE(${timeEvents.deviceTime}, ${timeEvents.serverTime})`;

/** Janela com folga para turnos que cruzam a meia-noite; o corte por dia local é feito no cálculo. */
export function mirrorWindow(from: string, to: string) {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 3600000),
    end: new Date(Date.parse(`${to}T00:00:00Z`) + 60 * 3600000),
  };
}

/**
 * Marcações da janela, filtradas pelo horário EFETIVO (coalesce(deviceTime, serverTime)) — a mesma base do cálculo.
 * Antes filtrava por serverTime e calculava por deviceTime, e batidas offline sincronizadas dias depois sumiam do mês.
 */
export async function loadMirrorEventRows(companyId: number, memberIds: number[], from: string, to: string) {
  if (!memberIds.length) return [];
  const database = await db.getDb();
  if (!database) return [];
  const { start, end } = mirrorWindow(from, to);
  return database.select().from(timeEvents)
    .where(and(eq(timeEvents.companyId, companyId), inArray(timeEvents.memberAccountId, memberIds), gte(effectiveEventTime, start), lt(effectiveEventTime, end)))
    .orderBy(effectiveEventTime);
}

/** Férias programadas (status "scheduled") que tocam o período, por funcionário. Falha na tabela = sem férias (não derruba o espelho). */
export async function loadMemberVacations(companyId: number, memberIds: number[], from: string, to: string): Promise<Map<number, VacationRange[]>> {
  const map = new Map<number, VacationRange[]>();
  if (!memberIds.length) return map;
  try {
    const { ensureVacationSchedulesTable } = await import("./vacations");
    await ensureVacationSchedulesTable();
    const database = await db.getDb();
    if (!database) return map;
    const rows = await database.select({ memberAccountId: vacationSchedules.memberAccountId, startDate: vacationSchedules.startDate, endDate: vacationSchedules.endDate })
      .from(vacationSchedules)
      .where(and(eq(vacationSchedules.companyId, companyId), eq(vacationSchedules.status, "scheduled"), inArray(vacationSchedules.memberAccountId, memberIds)));
    for (const r of rows) {
      const startDate = dateOnly(r.startDate), endDate = dateOnly(r.endDate);
      if (!startDate || !endDate || endDate < from || startDate > to) continue;
      map.set(r.memberAccountId, [...(map.get(r.memberAccountId) || []), { startDate, endDate }]);
    }
  } catch (error) {
    console.warn("[mirror] não foi possível carregar férias", error);
  }
  return map;
}

function dateOnly(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export const OPTIONAL_HOLIDAYS_SETTING = "mirror_optional_holidays_as_holiday";

/** Configuração da empresa para o espelho (feriados facultativos). Padrão: não abonar Carnaval/Corpus Christi. */
export async function loadMirrorOptions(companyId: number): Promise<MirrorOptions> {
  const raw = await db.getSetting(OPTIONAL_HOLIDAYS_SETTING, companyId, "");
  return { optionalHolidaysAsHoliday: raw === "1" || raw === "true" };
}
