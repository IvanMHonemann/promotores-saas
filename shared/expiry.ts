/** Regras de validade de produtos (datas de calendário, fuso de Brasília). */
export type ExpiryStatus = "expired" | "near" | "valid";
export const NEAR_EXPIRY_DAYS = 30;

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayInZone(now: Date = new Date(), timeZone = "America/Sao_Paulo"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(iso: string, days: number): string {
  return new Date((dayNumber(iso) + days) * 86400000).toISOString().slice(0, 10);
}

export function daysUntil(expirationDate: string, today: string): number {
  return dayNumber(expirationDate) - dayNumber(today);
}

export function expiryStatus(expirationDate: string, today: string, nearDays = NEAR_EXPIRY_DAYS): ExpiryStatus {
  const diff = daysUntil(expirationDate, today);
  if (diff < 0) return "expired";
  if (diff <= nearDays) return "near";
  return "valid";
}
