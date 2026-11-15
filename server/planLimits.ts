import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as memberAuth from "./memberAuth";
import { sql, eq } from "drizzle-orm";
import { clients } from "../drizzle/schema.original";
import { ENTITLEMENT_KEYS, type EntitlementKey } from "../shared/entitlements";
import { assertCompanyFeatureAccess, getCompanyEntitlementBase } from "./entitlements";
import {
  EXTRA_USERS_KEY,
  countBillableStaff,
  effectiveUserLimit,
  parseExtraUsers,
  staffLimitAppliesToRole,
  staffUsageLabel,
  suggestedMonthlyAmount,
  userLimitReachedMessage,
} from "../shared/staffLimit";


export type EffectivePlan = {
  id: number | null;
  name: string;
  maxUsers: number | null;
  maxClients: number | null;
  maxExtinguishers: number | null;
  featureKeys: EntitlementKey[];
  features: Record<EntitlementKey, boolean>;
};

/** Visão comercial da empresa; os módulos vêm exclusivamente do catálogo normalizado. */
export async function getEffectivePlan(companyId: number): Promise<EffectivePlan> {
  const base = await getCompanyEntitlementBase(companyId);
  const plan = base.plan as any;
  const features = base.companyFeatures;
  return {
    id: plan?.id == null ? null : Number(plan.id),
    name: String(plan?.name || "Sem plano"),
    maxUsers: plan ? (plan.maxUsers == null ? null : Number(plan.maxUsers)) : 1,
    maxClients: plan ? (plan.maxClients == null ? null : Number(plan.maxClients)) : 1000,
    maxExtinguishers: plan ? (plan.maxExtinguishers == null ? null : Number(plan.maxExtinguishers)) : 3000,
    featureKeys: ENTITLEMENT_KEYS.filter((key) => features[key]),
    features,
  };
}

async function requireModuleAccess(companyId: number, featureKey: EntitlementKey, label?: string) {
  try {
    await assertCompanyFeatureAccess(companyId, featureKey);
  } catch (error) {
    if (error instanceof TRPCError && label) {
      throw new TRPCError({ code: error.code, message: label, cause: error.cause });
    }
    throw error;
  }
  return getEffectivePlan(companyId);
}

async function countClients(companyId: number): Promise<number> {
  const database = await db.getDb();
  if (!database) return 0;
  const rows = await database
    .select({ total: sql<number>`count(*)` })
    .from(clients)
    .where(eq(clients.accountId, companyId));
  return Number(rows[0]?.total || 0);
}

async function countUsers(companyId: number): Promise<number> {
  const list = await memberAuth.listMemberAccounts(companyId);
  return countBillableStaff(Array.isArray(list) ? list : []);
}

export async function resolveExtraUsers(companyId: number): Promise<number> {
  const raw = await db.getSetting(EXTRA_USERS_KEY, companyId, "0");
  return parseExtraUsers(raw);
}

export type StaffUsage = {
  current: number;
  extraUsers: number;
  included: number | null;
  limit: number | null;
  unlimited: boolean;
  planName: string | null;
  planPrice: string | null;
  additionalUserPrice: string | null;
  suggestedMonthlyAmount: string | null;
  label: string;
};

export async function getStaffUsage(companyId: number): Promise<StaffUsage> {
  const resolved = await db.resolveCompanyPlan(companyId);
  const plan = resolved.plan as any;
  const extraUsers = await resolveExtraUsers(companyId);
  const members = await memberAuth.listMemberAccounts(companyId);
  const current = countBillableStaff(Array.isArray(members) ? members : []);
  const included = plan?.maxUsers == null ? null : Number(plan.maxUsers);
  const limit = effectiveUserLimit({ maxUsers: included, extraUsers });
  const additionalUserPrice = plan?.additionalUserPrice != null ? String(plan.additionalUserPrice) : null;
  const planPrice = plan?.price != null ? String(plan.price) : null;
  return {
    current,
    extraUsers,
    included,
    limit,
    unlimited: limit == null,
    planName: plan?.name ? String(plan.name) : null,
    planPrice,
    additionalUserPrice,
    suggestedMonthlyAmount: planPrice != null
      ? suggestedMonthlyAmount({ planPrice, extraUsers, additionalUserPrice })
      : null,
    label: staffUsageLabel(current, limit, extraUsers),
  };
}

export async function assertClientLimit(companyId: number) {
  const plan = await requireModuleAccess(companyId, "clients", "Cadastro de clientes não está disponível no seu plano.");
  if (plan.maxClients == null) return plan;
  const current = await countClients(companyId);
  if (current >= plan.maxClients) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Limite de clientes do plano ${plan.name} atingido (${plan.maxClients}). Faça upgrade para continuar.`,
      cause: { code: "PLAN_LIMIT", resource: "clients", limit: plan.maxClients, current },
    });
  }
  return plan;
}

export async function assertUserLimit(companyId: number, role?: string | null) {
  if (role != null && !staffLimitAppliesToRole(role)) return getStaffUsage(companyId);
  const usage = await getStaffUsage(companyId);
  if (usage.limit == null) return usage;
  if (usage.current >= usage.limit) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: userLimitReachedMessage(usage.limit),
      cause: { code: "PLAN_LIMIT", resource: "users", limit: usage.limit, current: usage.current },
    });
  }
  return usage;
}

export async function assertAlertsFeature(companyId: number) {
  return requireModuleAccess(companyId, "alerts", "Alertas de vencimento não estão disponíveis no seu plano.");
}

export async function assertReportsFeature(companyId: number) {
  return requireModuleAccess(companyId, "reports", "Histórico e auditoria não estão disponíveis no seu plano. Faça upgrade para o Profissional ou Empresarial.");
}

export async function assertBackupFeature(companyId: number) {
  return requireModuleAccess(companyId, "backup", "Backup e restauração não estão disponíveis no seu plano.");
}
