import * as db from "./db";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "pending"
  | "overdue"
  | "suspended"
  | "canceled"
  | "test"
  | "expired";

export type AccessDecision = {
  allowed: boolean;
  status: SubscriptionStatus | "none";
  reason?: string;
  graceUntil?: Date | null;
  expiresAt?: Date | null;
};

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Verifica se a empresa pode usar o sistema comercial.
 * PLATFORM_ADMIN não passa por aqui (não tem companyId).
 */
export async function checkSubscriptionAccess(companyId: number): Promise<AccessDecision> {
  const company = await db.getCompanyById(companyId);
  if (!company) {
    return { allowed: false, status: "none", reason: "Empresa não encontrada." };
  }

  // Prefer denormalized company fields; fall back to latest subscription
  let status = (company.subscriptionStatus as SubscriptionStatus | null) || null;
  let expiresAt = parseDate(company.subscriptionExpiresAt);
  let trialEndsAt = parseDate(company.trialEndsAt);
  let graceUntil = parseDate(company.gracePeriodEndsAt);

  if (!status) {
    const sub = await db.getLatestCompanySubscription(companyId);
    if (!sub) {
      // Sem assinatura: libera trial implícito de 14 dias a partir da criação da empresa
      const created = parseDate(company.createdAt) || new Date();
      const implicitTrialEnd = new Date(created.getTime() + 14 * 24 * 3600 * 1000);
      if (new Date() <= implicitTrialEnd) {
        return { allowed: true, status: "trial", expiresAt: implicitTrialEnd, reason: "Período de teste implícito." };
      }
      return { allowed: false, status: "none", reason: "Nenhuma assinatura ativa. Regularize o plano." };
    }
    status = sub.status as SubscriptionStatus;
    expiresAt = parseDate(sub.currentPeriodEnd) || parseDate(sub.endsAt);
    trialEndsAt = parseDate(sub.trialEndsAt);
    graceUntil = parseDate(sub.gracePeriodEndsAt);
  }

  const now = new Date();

  switch (status) {
    case "trial":
    case "test": {
      const end = trialEndsAt || expiresAt;
      if (end && now > end) {
        return { allowed: false, status, expiresAt: end, reason: "Período de teste encerrado." };
      }
      return { allowed: true, status, expiresAt: end };
    }
    case "active":
      if (expiresAt && now > expiresAt) {
        // tolerância de 3 dias se não houver grace explícito
        const grace = graceUntil || new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1000);
        if (now <= grace) {
          return { allowed: true, status: "overdue", expiresAt, graceUntil: grace, reason: "Período de tolerância." };
        }
        return { allowed: false, status: "overdue", expiresAt, graceUntil: grace, reason: "Assinatura vencida." };
      }
      return { allowed: true, status, expiresAt };
    case "pending":
      // permite uso enquanto pendente (aguardando pagamento inicial)
      return { allowed: true, status, expiresAt, reason: "Pagamento pendente." };
    case "overdue": {
      const grace = graceUntil || (expiresAt ? new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1000) : null);
      if (grace && now <= grace) {
        return { allowed: true, status, expiresAt, graceUntil: grace, reason: "Período de tolerância." };
      }
      return { allowed: false, status, expiresAt, graceUntil: grace, reason: "Pagamento em atraso. Regularize a assinatura." };
    }
    case "suspended":
      return { allowed: false, status, expiresAt, reason: "Assinatura suspensa." };
    case "canceled":
    case "expired":
      if (expiresAt && now <= expiresAt) {
        return { allowed: true, status, expiresAt, reason: "Acesso até o fim do período já pago." };
      }
      return { allowed: false, status, expiresAt, reason: "Assinatura cancelada ou expirada." };
    default:
      return { allowed: false, status: "none", reason: "Status de assinatura desconhecido." };
  }
}
