import { todayInZone } from "./expiry";

/** AAAA-MM-DD → DD/MM/AAAA, sem deslocar o dia por fuso. */
export function formatBrDate(iso: string): string {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * O período é inclusivo nas duas pontas, no calendário civil informado
 * (use o de America/Sao_Paulo). No dia seguinte ao término, já está liberado.
 */
export function isOnVacationDay(todayYmd: string, startDate: string, endDate: string): boolean {
  const t = todayYmd.slice(0, 10);
  const a = startDate.slice(0, 10);
  const b = endDate.slice(0, 10);
  if (![t, a, b].every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) return false;
  return t >= a && t <= b;
}

export type VacationRange = { startDate: string; endDate: string; status?: string | null };

export function findActiveVacation<T extends VacationRange>(todayYmd: string, rows: T[]): T | null {
  for (const row of rows) {
    if (row.status && row.status !== "scheduled") continue;
    if (isOnVacationDay(todayYmd, row.startDate, row.endDate)) return row;
  }
  return null;
}

/** Conveniência: "hoje" no fuso informado (padrão America/Sao_Paulo). */
export function findActiveVacationAt<T extends VacationRange>(now: Date, rows: T[], timeZone = "America/Sao_Paulo"): T | null {
  return findActiveVacation(todayInZone(now, timeZone), rows);
}

export function vacationBlockMessage(startDate: string, endDate: string): string {
  return `Você está de férias de ${formatBrDate(startDate)} a ${formatBrDate(endDate)}. O aplicativo é liberado no dia seguinte ao término.`;
}
