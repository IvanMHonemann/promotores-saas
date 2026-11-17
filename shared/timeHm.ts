/**
 * Horário HH:MM com qualquer minuto (00–59).
 * Usado no campo de correção de ponto no lugar do input nativo type=time,
 * que em muitos Androids só oferece intervalos de 5 minutos.
 */

/** Mantém só dígitos e formata como HH:MM enquanto a pessoa digita. */
export function formatTimeHmMask(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTimeHm(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Aceita "9:07", "0907", "9 07" etc. e devolve "09:07", ou "" se incompleto/inválido.
 * Minutos 00–59 e horas 00–23.
 */
export function normalizeTimeHm(raw: string): string {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 4);
  if (digits.length < 3) return "";
  const h = digits.length === 3 ? Number(digits.slice(0, 1)) : Number(digits.slice(0, 2));
  const m = digits.length === 3 ? Number(digits.slice(1)) : Number(digits.slice(2));
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + (m || 0);
}

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
