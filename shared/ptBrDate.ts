/** Nomes de mês em português, sem depender da localidade do navegador ou do ICU. */
export const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

export function capitalizePt(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** "2026-11" → "novembro de 2026". */
export function formatMonthYearPT(ym: string, capitalized = false): string {
  const [y, m] = ym.split("-").map(Number);
  const name = MESES_PT[m - 1];
  if (!y || !name) return ym;
  const label = `${name} de ${y}`;
  return capitalized ? capitalizePt(label) : label;
}

/** "2026-11-15" → "15/11/2026". */
export function formatDatePT(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** "15/11/2026" ou "15112026" → "2026-11-15", ou null se inválido. */
export function parseDatePT(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Aplica máscara dd/mm/aaaa enquanto a pessoa digita. */
export function maskDatePT(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
