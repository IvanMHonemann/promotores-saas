/** Mensagem e link de WhatsApp para avisar o promotor de batida faltante. Nada é enviado automaticamente. */

export function missingPunchStaffLabel(count: number): string {
  if (count === 1) return "1 funcionário";
  return `${count} funcionários`;
}

/** Só dígitos, com DDI 55 quando o número for brasileiro local (10 ou 11 dígitos). */
export function normalizeWhatsAppPhone(raw: string | null | undefined): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

export function formatMissingPunchDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return day;
}

export function formatMissingPunchTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

export function missingPunchNotifyMessage(input: {
  name: string;
  day: string;
  missing: string;
  lastLabel: string;
  lastTime: string;
}): string {
  const name = String(input.name ?? "").trim() || "promotor";
  const date = formatMissingPunchDay(input.day);
  const time = formatMissingPunchTime(input.lastTime);
  const last = time ? `${input.lastLabel} às ${time}` : input.lastLabel;
  return `Olá, ${name}! Consta falta de batida em ${date}: ${input.missing} (última marcação: ${last}). Por favor, regularize ou solicite a correção no GondUp.`;
}

export function missingPunchWhatsAppUrl(phone: string | null | undefined, message: string): string | null {
  const digits = normalizeWhatsAppPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function cartaoPontoHref(memberId: number, day?: string | null): string {
  const params = new URLSearchParams({ memberId: String(memberId) });
  if (day && /^\d{4}-\d{2}/.test(day)) params.set("month", day.slice(0, 7));
  return `/cartao-ponto?${params.toString()}`;
}
