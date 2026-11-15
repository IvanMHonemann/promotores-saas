import { ENTITLEMENT_KEYS, type EntitlementKey } from "./entitlements";

/** Nomes dos planos comerciais atuais, em minúsculas, para casar com o banco. */
export const COMMERCIAL_PLAN_NAME_KEYS = ["gondup ponto", "gondup merchandising", "gondup completo"] as const;

/** Planos antigos que devem ficar inativos e fora de novas escolhas. Nunca apagar. */
export const LEGACY_PLAN_NAME_KEYS = ["start", "profissional", "empresarial", "basico", "básico", "ilimitado"] as const;

export type CommercialPlanCatalogItem = {
  name: string;
  description: string;
  price: string;
  billingCycle: "monthly";
  /** Inclusos no valor mensal; o adicional é cobrado manualmente, sem trava no cadastro. */
  includedUsers: number;
  additionalUserPrice: string;
  featureKeys: readonly EntitlementKey[];
};

const PONTO_FEATURES: readonly EntitlementKey[] = [
  "dashboard",
  "timeTracking",
  "teamManagement",
  "reports",
  "backup",
  "offline",
];

const MERCHANDISING_FEATURES: readonly EntitlementKey[] = [
  "dashboard",
  "clients",
  "pointsOfSale",
  "alerts",
  "fieldOperations",
  "visitCheckIn",
  "products",
  "reports",
  "teamManagement",
  "backup",
  "offline",
];

export const COMMERCIAL_PLANS: readonly CommercialPlanCatalogItem[] = [
  {
    name: "GONDUP Ponto",
    description: "Até 20 funcionários. Adicional de R$ 8,00 por funcionário. Registro de ponto com GPS, correções, comprovantes e espelho do mês.",
    price: "199.90",
    billingCycle: "monthly",
    includedUsers: 20,
    additionalUserPrice: "8.00",
    featureKeys: PONTO_FEATURES,
  },
  {
    name: "GONDUP Merchandising",
    description: "Até 20 promotores. Adicional de R$ 8,00 por promotor. Check-in/check-out com GPS, fotos, validades e alertas.",
    price: "179.90",
    billingCycle: "monthly",
    includedUsers: 20,
    additionalUserPrice: "8.00",
    featureKeys: MERCHANDISING_FEATURES,
  },
  {
    name: "GONDUP Completo",
    description: "Até 20 funcionários. Adicional de R$ 12,00 por funcionário. GONDUP Ponto + GONDUP Merchandising, os dois planos em um só.",
    price: "350.00",
    billingCycle: "monthly",
    includedUsers: 20,
    additionalUserPrice: "12.00",
    featureKeys: [...ENTITLEMENT_KEYS],
  },
];

export function planNameKey(name: string): string {
  return String(name ?? "").toLowerCase().trim();
}

export function isOfficialCommercialPlanName(name: string): boolean {
  return (COMMERCIAL_PLAN_NAME_KEYS as readonly string[]).includes(planNameKey(name));
}

export function isLegacyPlanName(name: string): boolean {
  return (LEGACY_PLAN_NAME_KEYS as readonly string[]).includes(planNameKey(name));
}

/** Planos ativos entram na lista; o plano atual da empresa permanece visível mesmo inativo. */
export function isSelectablePlan(plan: { id: number; active?: boolean | number | null }, currentPlanId?: number | null): boolean {
  if (plan.active === false || plan.active === 0) {
    return currentPlanId != null && Number(plan.id) === Number(currentPlanId);
  }
  return true;
}

export function planSelectLabel(plan: { name: string; price: unknown; billingCycle?: string | null; active?: boolean | number | null }): string {
  const cycle = plan.billingCycle === "yearly" ? "ano" : "mês";
  const money = Number(plan.price ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const inactive = plan.active === false || plan.active === 0 ? " (inativo)" : "";
  return `${plan.name} — ${money}/${cycle}${inactive}`;
}

/** Soma meses de calendário, usando o último dia do mês quando o dia âncora não existe. */
export function addCalendarMonthsIso(isoDate: string, months: number, anchorDay?: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  const probe = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0)).getUTCDate();
  probe.setUTCDate(Math.min(day, lastDay));
  return probe.toISOString().slice(0, 10);
}

/**
 * Período do pagamento registrado na tela unificada:
 * começa em hoje ou no vencimento atual, o que for maior, e vai até +1 mês.
 */
export function nextPaidPeriod(currentDueIso: string | null | undefined, todayIso: string): { periodFrom: string; periodTo: string } {
  const due = currentDueIso && /^\d{4}-\d{2}-\d{2}$/.test(currentDueIso) ? currentDueIso : null;
  const periodFrom = due && due > todayIso ? due : todayIso;
  return { periodFrom, periodTo: addCalendarMonthsIso(periodFrom, 1) };
}
