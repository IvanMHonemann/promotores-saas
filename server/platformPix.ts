/**
 * Pix de cobrança gerado pelo administrador da plataforma, a partir do plano da empresa.
 * Não marca como pago e não altera a validade.
 */
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { payments } from "../drizzle/schema.original";
import { buildPixBrcode, getDefaultPixConfig } from "@shared/pixBrcode";
import {
  moneyLabelBr,
  pixChargeWhatsAppMessage,
  pixChargeWhatsAppUrl,
  quotePixCharge,
  type PixChargeQuote,
} from "@shared/platformPixQuote";
import { EXTRA_USERS_KEY, parseExtraUsers } from "@shared/staffLimit";
import * as db from "./db";
import { MONTHLY_AMOUNT_KEY } from "./paymentReminder";

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function parseAmount(raw: string): string {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe um valor maior que zero." });
  return n.toFixed(2);
}

export async function getCompanyPixQuote(companyId: number): Promise<PixChargeQuote & { companyId: number }> {
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  const resolved = await db.resolveCompanyPlan(companyId);
  const extraRaw = await db.getSetting(EXTRA_USERS_KEY, companyId, "0");
  const negotiated = (await db.getSetting(MONTHLY_AMOUNT_KEY, companyId, "")).trim();
  const quote = quotePixCharge({
    companyName: company.name,
    planName: resolved.plan?.name ?? null,
    planPrice: resolved.plan?.price != null ? String(resolved.plan.price) : null,
    extraUsers: parseExtraUsers(extraRaw),
    additionalUserPrice: (resolved.plan as any)?.additionalUserPrice != null ? String((resolved.plan as any).additionalUserPrice) : null,
    negotiatedAmount: negotiated || null,
    dueDate: toIsoDate(company.subscriptionExpiresAt),
  });
  return { ...quote, companyId };
}

export type GeneratedCompanyPix = {
  companyId: number;
  companyName: string;
  amount: string;
  amountLabel: string;
  dueDate: string | null;
  dueDateLabel: string | null;
  monthRef: string | null;
  quote: PixChargeQuote;
  pixPayload: string;
  whatsappUrl: string;
  message: string;
  paymentId: number | null;
  paymentReused: boolean;
  recordedAsPending: boolean;
};

export async function generateCompanyPix(companyId: number, amountOverride?: string | null): Promise<GeneratedCompanyPix> {
  const quote = await getCompanyPixQuote(companyId);
  const amount = parseAmount(amountOverride || quote.defaultAmount || "");
  const amountLabel = moneyLabelBr(amount);
  const pix = getDefaultPixConfig();
  const monthKey = (quote.dueDate || new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })).replace(/-/g, "");
  const pixPayload = buildPixBrcode({
    key: pix.key,
    name: pix.name,
    city: pix.city,
    amount,
    description: `GONDUP ${quote.monthRef || quote.companyName}`.slice(0, 25),
    txid: `GONDUP${companyId}${monthKey.slice(2)}`.slice(0, 25),
  });
  const message = pixChargeWhatsAppMessage({
    companyName: quote.companyName,
    monthRef: quote.monthRef,
    dueDateLabel: quote.dueDateLabel,
    amountLabel,
    pixPayload,
  });
  const whatsappUrl = pixChargeWhatsAppUrl(message);

  let paymentId: number | null = null;
  let paymentReused = false;
  let recordedAsPending = false;
  if (quote.dueDate) {
    const recorded = await upsertPendingPixCharge({
      companyId,
      amount,
      dueDate: quote.dueDate,
    });
    paymentId = recorded.id;
    paymentReused = recorded.reused;
    recordedAsPending = true;
  }

  return {
    companyId,
    companyName: quote.companyName,
    amount,
    amountLabel,
    dueDate: quote.dueDate,
    dueDateLabel: quote.dueDateLabel,
    monthRef: quote.monthRef,
    quote,
    pixPayload,
    whatsappUrl,
    message,
    paymentId,
    paymentReused,
    recordedAsPending,
  };
}

/** Grava ou atualiza uma cobrança PENDING. Não altera plano, validade nem marca como pago. */
export async function upsertPendingPixCharge(input: { companyId: number; amount: string; dueDate: string }): Promise<{ id: number; reused: boolean }> {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const sub = await db.getLatestCompanySubscription(input.companyId);
  const existing = (await database.select().from(payments).where(and(
    eq(payments.companyId, input.companyId),
    eq(payments.status, "PENDING"),
    eq(payments.billingType, "PIX"),
    eq(payments.dueDate, input.dueDate as any),
  )).limit(1))[0];
  if (existing) {
    await database.update(payments).set({
      amount: input.amount,
      netAmount: input.amount,
      subscriptionId: sub?.id ?? existing.subscriptionId,
    } as any).where(eq(payments.id, existing.id));
    return { id: existing.id, reused: true };
  }
  const created = await db.createPaymentRecord({
    companyId: input.companyId,
    subscriptionId: sub?.id ?? null,
    amount: input.amount,
    netAmount: input.amount,
    billingType: "PIX",
    status: "PENDING",
    dueDate: input.dueDate,
    paymentDate: null,
  });
  return { id: created.id, reused: false };
}
