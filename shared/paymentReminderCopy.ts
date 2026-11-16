/** Textos curtos do aviso de pagamento: plural correto e data no formato 18/11. */

export function countDaysLabel(days: number): string {
  const n = Math.max(0, Math.trunc(Number.isFinite(days) ? days : 0));
  return n === 1 ? "1 dia" : `${n} dias`;
}

/** "2026-11-18", "18/11/2026" ou "18 de novembro de 2026" → "18/11". */
export function shortDueDate(input: string | null | undefined): string {
  if (!input) return "";
  const s = String(input).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(s);
  if (br) return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}`;
  const long = /^(\d{1,2})\s+de\s+([a-zç]+)/i.exec(s);
  if (long) {
    const months: Record<string, string> = {
      janeiro: "01",
      fevereiro: "02",
      março: "03",
      marco: "03",
      abril: "04",
      maio: "05",
      junho: "06",
      julho: "07",
      agosto: "08",
      setembro: "09",
      outubro: "10",
      novembro: "11",
      dezembro: "12",
    };
    const mm = months[long[2].toLowerCase()];
    if (mm) return `${long[1].padStart(2, "0")}/${mm}`;
  }
  return s;
}

export type PaymentReminderCopyInput = {
  phase: "pre_due" | "overdue" | "blocked" | "none" | string;
  amountLabel?: string | null;
  dueDate?: string | null;
  dueDateLabel?: string | null;
  daysUntilDue?: number | null;
  daysUntilBlock?: number | null;
};

function amountPhrase(amountLabel?: string | null): string {
  return amountLabel ? `Mensalidade de ${amountLabel}` : "A mensalidade";
}

export function paymentReminderHeadline(r: PaymentReminderCopyInput): string {
  const when = shortDueDate(r.dueDate || r.dueDateLabel);
  const withOf = amountPhrase(r.amountLabel);
  if (r.phase === "blocked") {
    return when ? `${withOf} venceu em ${when}. Acesso bloqueado.` : `${withOf} venceu. Acesso bloqueado.`;
  }
  if (r.phase === "overdue") {
    const left = Math.max(0, r.daysUntilBlock ?? 0);
    const due = when ? ` venceu em ${when}` : " venceu";
    if (left === 0) return `${withOf}${due}. Bloqueio hoje.`;
    return `${withOf}${due}. Bloqueio em ${countDaysLabel(left)}.`;
  }
  const days = r.daysUntilDue ?? 0;
  if (days <= 0) {
    return when ? `${withOf} vence hoje (${when})` : `${withOf} vence hoje`;
  }
  if (when) return `${withOf} vence em ${when} (${countDaysLabel(days)})`;
  return `${withOf} vence em ${countDaysLabel(days)}`;
}

export function overdueBarLabel(r: PaymentReminderCopyInput): string {
  const amount = r.amountLabel ?? "mensalidade";
  const left = Math.max(0, r.daysUntilBlock ?? 0);
  if (left === 0) return `Pagamento em atraso · ${amount} · bloqueio hoje`;
  return `Pagamento em atraso · ${amount} · bloqueio em ${countDaysLabel(left)}`;
}

export function paymentReminderMessage(r: PaymentReminderCopyInput): string {
  const headline = paymentReminderHeadline(r);
  if (r.phase === "blocked") return `${headline} Regularize via Pix ou WhatsApp.`;
  if (r.phase === "overdue") return `${headline} Pague via Pix ou envie o comprovante no WhatsApp.`;
  return headline;
}
