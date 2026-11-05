/** Aviso de vencimento + Pix (sem gateway) para o administrador da empresa. */
import * as db from "./db";
import { buildPixBrcode, getDefaultPixConfig } from "@shared/pixBrcode";
import { DEFAULT_OVERDUE_GRACE_DAYS } from "./subscriptionAccess";

export const PRE_DUE_REMINDER_DAYS = [5, 3, 1] as const;
export const MONTHLY_AMOUNT_KEY = "monthly_amount";
export const BLOCK_AFTER_OVERDUE_KEY = "block_after_overdue_days";
export const BILLING_DAY_KEY = "billing_day";

const BR_TZ = "America/Sao_Paulo";

export function todayIsoBR(now = new Date()): string {
  return now.toLocaleDateString("en-CA", { timeZone: BR_TZ });
}

/** Diferença em dias de calendário (due - today) no fuso de Brasília. Negativo = atrasado. */
export function calendarDaysUntil(dueIso: string, todayIso = todayIsoBR()): number {
  const a = Date.parse(`${todayIso}T12:00:00-03:00`);
  const b = Date.parse(`${dueIso}T12:00:00-03:00`);
  return Math.round((b - a) / 86400000);
}

/**
 * Soma meses de calendário. Se o dia âncora não existir no mês destino (ex.: 31 em fevereiro),
 * usa o último dia desse mês — mas o âncora (ex.: 31) é preservado para o mês seguinte.
 */
export function addCalendarMonthsIso(isoDate: string, months: number, anchorDay?: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  const probe = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0)).getUTCDate();
  probe.setUTCDate(Math.min(day, lastDay));
  return probe.toISOString().slice(0, 10);
}

/**
 * Próximo vencimento após "Marcar como pago": sempre vencimento original + 1 mês
 * (dias em atraso ou pagamento antecipado não mudam a âncora). Um pagamento = +1 mês.
 * Ex.: venceu 10/11, pago 14/11 → próximo 10/12; pago 05/11 → também 10/12.
 */
export function nextDueAfterMarkPaid(currentDueIso: string, anchorDay?: number): string {
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31
    ? anchorDay
    : Number(currentDueIso.slice(8, 10));
  return addCalendarMonthsIso(currentDueIso, 1, day);
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: BR_TZ });
}

function moneyLabel(amount: string): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[(m || 1) - 1]}/${y}`;
}


export async function resolveBillingDay(companyId: number, fallbackDueIso?: string | null): Promise<number | null> {
  const raw = (await db.getSetting(BILLING_DAY_KEY, companyId, "")).trim();
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
  if (fallbackDueIso && /^\d{4}-\d{2}-\d{2}/.test(fallbackDueIso)) {
    const day = Number(fallbackDueIso.slice(8, 10));
    if (day >= 1 && day <= 31) return day;
  }
  return null;
}

export async function ensureBillingDay(companyId: number, dueIso: string): Promise<number> {
  const existing = await resolveBillingDay(companyId, null);
  if (existing) return existing;
  const day = Number(dueIso.slice(8, 10));
  const safe = Math.min(31, Math.max(1, day || 1));
  await db.setSetting(BILLING_DAY_KEY, String(safe), companyId);
  return safe;
}

export async function resolveMonthlyAmount(companyId: number): Promise<string | null> {
  const custom = (await db.getSetting(MONTHLY_AMOUNT_KEY, companyId, "")).trim();
  if (custom && /^\d+(\.\d{1,2})?$/.test(custom) && Number(custom) > 0) return Number(custom).toFixed(2);
  const resolved = await db.resolveCompanyPlan(companyId);
  const fromSub = resolved.subscription?.amount ? String(resolved.subscription.amount) : "";
  if (fromSub && Number(fromSub) > 0) return Number(fromSub).toFixed(2);
  const fromPlan = resolved.plan?.price != null ? String(resolved.plan.price) : "";
  if (fromPlan && Number(fromPlan) > 0) return Number(fromPlan).toFixed(2);
  return null;
}

export async function resolveGraceDays(companyId: number): Promise<number> {
  const raw = (await db.getSetting(BLOCK_AFTER_OVERDUE_KEY, companyId, "")).trim();
  if (raw === "") return DEFAULT_OVERDUE_GRACE_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_OVERDUE_GRACE_DAYS;
  return Math.min(60, Math.floor(n));
}

export type PaymentReminderPhase = "none" | "pre_due" | "overdue" | "blocked";

export type PaymentReminder = {
  phase: PaymentReminderPhase;
  show: boolean;
  dismissable: boolean;
  companyId: number;
  companyName: string;
  amount: string | null;
  amountLabel: string | null;
  dueDate: string | null;
  dueDateLabel: string | null;
  daysUntilDue: number | null;
  daysUntilBlock: number | null;
  graceDays: number;
  monthRef: string | null;
  pixPayload: string | null;
  whatsappUrl: string | null;
  whatsappNumber: string;
  message: string;
};

function buildWhatsAppUrl(params: {
  whatsapp: string;
  companyName: string;
  monthRef: string;
  amountLabel: string;
}): string {
  const text = [
    `Olá! Segue o comprovante do pagamento GondUp.`,
    ``,
    `Empresa: ${params.companyName}`,
    `Referência: ${params.monthRef}`,
    `Valor: ${params.amountLabel}`,
    ``,
    `(anexe o comprovante do Pix nesta conversa)`,
  ].join("\n");
  return `https://wa.me/${params.whatsapp}?text=${encodeURIComponent(text)}`;
}

export async function getPaymentReminder(companyId: number, now = new Date()): Promise<PaymentReminder> {
  const company = await db.getCompanyById(companyId);
  const pix = getDefaultPixConfig();
  const empty: PaymentReminder = {
    phase: "none",
    show: false,
    dismissable: true,
    companyId,
    companyName: company?.name ?? "",
    amount: null,
    amountLabel: null,
    dueDate: null,
    dueDateLabel: null,
    daysUntilDue: null,
    daysUntilBlock: null,
    graceDays: DEFAULT_OVERDUE_GRACE_DAYS,
    monthRef: null,
    pixPayload: null,
    whatsappUrl: null,
    whatsappNumber: pix.whatsapp,
    message: "",
  };
  if (!company) return empty;

  const dueDate = toIsoDate(company.subscriptionExpiresAt);
  const graceDays = await resolveGraceDays(companyId);
  const amount = await resolveMonthlyAmount(companyId);
  const today = todayIsoBR(now);

  // Sem data de validade: nada a cobrar automaticamente (empresa de teste / sem plano).
  if (!dueDate) return { ...empty, companyName: company.name, graceDays, amount, amountLabel: amount ? moneyLabel(amount) : null };

  const daysUntilDue = calendarDaysUntil(dueDate, today);
  const daysUntilBlock = daysUntilDue + graceDays;
  const amountLabel = amount ? moneyLabel(amount) : null;
  const dueDateLabel = new Date(`${dueDate}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: BR_TZ });
  const monthRef = monthLabel(dueDate);

  let pixPayload: string | null = null;
  if (amount) {
    try {
      pixPayload = buildPixBrcode({
        key: pix.key,
        name: pix.name,
        city: pix.city,
        amount,
        description: `GONDUP ${monthRef}`.slice(0, 25),
        txid: `GONDUP${companyId}${dueDate.replace(/-/g, "").slice(2)}`.slice(0, 25),
      });
    } catch {
      pixPayload = null;
    }
  }

  const whatsappUrl = amountLabel
    ? buildWhatsAppUrl({ whatsapp: pix.whatsapp, companyName: company.name, monthRef, amountLabel })
    : `https://wa.me/${pix.whatsapp}`;

  const base = {
    companyId,
    companyName: company.name,
    amount,
    amountLabel,
    dueDate,
    dueDateLabel,
    daysUntilDue,
    daysUntilBlock,
    graceDays,
    monthRef,
    pixPayload,
    whatsappUrl,
    whatsappNumber: pix.whatsapp,
  };

  if (daysUntilDue < -graceDays) {
    return {
      ...base,
      phase: "blocked",
      show: true,
      dismissable: false,
      message: `O acesso da empresa está bloqueado por falta de pagamento. Venceu em ${dueDateLabel}. Regularize via Pix ou WhatsApp.`,
    };
  }

  if (daysUntilDue < 0) {
    const left = Math.max(0, daysUntilBlock);
    return {
      ...base,
      phase: "overdue",
      show: true,
      dismissable: false,
      message: `Pagamento em atraso desde ${dueDateLabel}. O acesso será bloqueado em ${left} dia(s). Pague via Pix ou envie o comprovante no WhatsApp.`,
    };
  }

  if ((PRE_DUE_REMINDER_DAYS as readonly number[]).includes(daysUntilDue)) {
    return {
      ...base,
      phase: "pre_due",
      show: true,
      dismissable: true,
      message: `O pagamento de ${amountLabel ?? "sua mensalidade"} vence em ${daysUntilDue} dia(s) (${dueDateLabel}).`,
    };
  }

  return { ...base, phase: "none", show: false, dismissable: true, message: "" };
}

/**
 * Marca como pago: registra o Pix e avança a validade em exatamente 1 mês a partir do
 * vencimento original (não da data do pagamento). Dias em atraso ou pagamento antecipado
 * não “empurram” o ciclo — o cliente não ganha dias extras por pagar atrasado.
 */
export async function markCompanyPaid(input: {
  companyId: number;
  amount?: string | null;
  paymentDate?: string;
  graceDays?: number;
  note?: string | null;
}) {
  const { registerCompanyPayment } = await import("./platformCompanies");
  const company = await db.getCompanyById(input.companyId);
  if (!company) throw new Error("Empresa não encontrada.");
  const today = todayIsoBR();
  const amount = (input.amount && /^\d+(\.\d{1,2})?$/.test(input.amount) ? Number(input.amount).toFixed(2) : null)
    || (await resolveMonthlyAmount(input.companyId));
  if (!amount) throw new Error("Informe o valor mensal da empresa antes de marcar como pago.");

  const currentDue = toIsoDate(company.subscriptionExpiresAt);
  if (!currentDue) throw new Error("Defina o vencimento da empresa antes de marcar como pago.");

  const anchor = await ensureBillingDay(input.companyId, currentDue);
  // Sempre original + 1 mês (um pagamento = um mês), independentemente de atraso ou antecipação.
  const periodTo = nextDueAfterMarkPaid(currentDue, anchor);
  const periodFrom = currentDue;

  const grace = input.graceDays ?? (await resolveGraceDays(input.companyId));
  return registerCompanyPayment({
    companyId: input.companyId,
    amount,
    paymentDate: input.paymentDate || today,
    periodFrom,
    periodTo,
    billingType: "PIX",
    planId: company.planId,
    graceDays: grace,
    note: input.note ?? "Marcado como pago (Pix manual).",
  });
}
