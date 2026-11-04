export const FULL_DAY_EXCUSE_TYPES = ["holiday", "day_off", "medical_certificate"] as const;
export type FullDayExcuseType = (typeof FULL_DAY_EXCUSE_TYPES)[number];

export const FULL_DAY_EXCUSE_LABELS: Record<FullDayExcuseType, string> = {
  holiday: "Feriado",
  day_off: "Folga",
  medical_certificate: "Atestado médico",
};

export function isFullDayExcuseType(value: string | null | undefined): value is FullDayExcuseType {
  return value === "holiday" || value === "day_off" || value === "medical_certificate";
}

export function inferFullDayExcuseType(row: { justificationType?: string | null; justification?: string | null }): FullDayExcuseType | null {
  if (isFullDayExcuseType(row.justificationType)) return row.justificationType;
  const text = String(row.justification || "").toLowerCase();
  if (/\batestado\b/.test(text)) return "medical_certificate";
  if (/\bferiado\b/.test(text)) return "holiday";
  if (/\bfolga\b/.test(text)) return "day_off";
  return null;
}

/** Pedidos antigos podem ter o tipo só no texto da justificativa. */
export function looksLikeFullDayExcuse(row: { justificationType?: string | null; justification?: string | null; timeEventId?: number | null }): boolean {
  if (isFullDayExcuseType(row.justificationType)) return true;
  return !row.timeEventId && inferFullDayExcuseType(row) != null;
}

export function fullDayExcuseLabel(value: string | null | undefined): string {
  return isFullDayExcuseType(value) ? FULL_DAY_EXCUSE_LABELS[value] : "Abono";
}

export function excuseDay(isoOrDate: Date | string, timeZone = "America/Sao_Paulo"): string {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export function noonInSaoPaulo(date: string): Date {
  return new Date(`${date}T12:00:00-03:00`);
}
