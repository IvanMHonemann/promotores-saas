/** Mensagem e WhatsApp para avisar o promotor de batida faltante. Nada é enviado automaticamente. */

export function missingPunchStaffLabel(count: number): string {
  if (count === 1) return "1 funcionário";
  return `${count} funcionários`;
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

/** Link do WhatsApp sem número, para o app pedir que se escolha o contato. */
export function missingPunchWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

export type NotifyPromoterResult = "shared" | "whatsapp";

/**
 * No celular, tenta a folha de compartilhamento (navigator.share) para o supervisor/admin
 * escolher o contato. Se não houver share, ou se falhar, abre o WhatsApp sem número.
 * Cancelar a folha não abre o WhatsApp em seguida.
 */
export async function notifyPromoterMissingPunch(
  message: string,
  deps: {
    share?: (data: { text: string }) => Promise<void>;
    canShare?: boolean;
    openUrl?: (url: string) => void;
  } = {},
): Promise<NotifyPromoterResult> {
  const url = missingPunchWhatsAppUrl(message);
  const share =
    deps.share ??
    (typeof navigator !== "undefined" && typeof navigator.share === "function"
      ? (data: { text: string }) => navigator.share(data)
      : undefined);
  const canShare = deps.canShare ?? Boolean(share);
  if (canShare && share) {
    try {
      await share({ text: message });
      return "shared";
    } catch (error) {
      if (error && typeof error === "object" && "name" in error && (error as { name: string }).name === "AbortError") {
        return "shared";
      }
    }
  }
  const open = deps.openUrl ?? ((href: string) => {
    if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer");
  });
  open(url);
  return "whatsapp";
}

export function cartaoPontoHref(memberId: number, day?: string | null): string {
  const params = new URLSearchParams({ memberId: String(memberId) });
  if (day && /^\d{4}-\d{2}/.test(day)) params.set("month", day.slice(0, 7));
  return `/cartao-ponto?${params.toString()}`;
}
