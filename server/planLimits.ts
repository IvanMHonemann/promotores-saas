import { TRPCError } from "@trpc/server";
import * as db from "./db";
import * as memberAuth from "./memberAuth";
import { sql, eq } from "drizzle-orm";
import { clients, extinguishers } from "../drizzle/schema.original";

export type PlanFeatureKey =
  | "featureDashboard"
  | "featureClients"
  | "featureExtinguishers"
  | "featureServiceOrders"
  | "featureAlerts"
  | "featureReports"
  | "featureUsers"
  | "featureBackup"
  | "featureOfflinePwa";

export type EffectivePlan = {
  id: number | null;
  name: string;
  maxUsers: number | null;
  maxClients: number | null;
  maxExtinguishers: number | null;
  featureDashboard: boolean;
  featureClients: boolean;
  featureExtinguishers: boolean;
  featureServiceOrders: boolean;
  featureAlerts: boolean;
  featureReports: boolean;
  featureUsers: boolean;
  featureBackup: boolean;
  featureOfflinePwa: boolean;
};

/** Plano efetivo da empresa. Sem plano cadastrado = só recursos básicos (equivalente Start). */
export async function getEffectivePlan(companyId: number): Promise<EffectivePlan> {
  const resolved = await db.resolveCompanyPlan(companyId);
  const plan = resolved.plan as any;
  if (!plan) {
    return {
      id: null,
      name: "Sem plano",
      maxUsers: 1,
      maxClients: 1000,
      maxExtinguishers: 3000,
      featureDashboard: true,
      featureClients: true,
      featureExtinguishers: true,
      featureServiceOrders: true,
      featureAlerts: true,
      featureReports: false,
      featureUsers: false,
      featureBackup: true,
      featureOfflinePwa: true,
    };
  }
  return {
    id: Number(plan.id) || null,
    name: String(plan.name || "Plano"),
    maxUsers: plan.maxUsers == null ? null : Number(plan.maxUsers),
    maxClients: plan.maxClients == null ? null : Number(plan.maxClients),
    maxExtinguishers: plan.maxExtinguishers == null ? null : Number(plan.maxExtinguishers),
    featureDashboard: Boolean(plan.featureDashboard),
    featureClients: Boolean(plan.featureClients),
    featureExtinguishers: Boolean(plan.featureExtinguishers),
    featureServiceOrders: Boolean(plan.featureServiceOrders),
    featureAlerts: Boolean(plan.featureAlerts),
    featureReports: Boolean(plan.featureReports),
    featureUsers: Boolean(plan.featureUsers),
    featureBackup: Boolean(plan.featureBackup),
    featureOfflinePwa: Boolean(plan.featureOfflinePwa),
  };
}

export async function requirePlanFeature(companyId: number, feature: PlanFeatureKey, label?: string) {
  const plan = await getEffectivePlan(companyId);
  if (!plan[feature]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        label ||
        `Seu plano (${plan.name}) não inclui este recurso. Faça upgrade ou fale com o suporte.`,
      cause: { code: "PLAN_FEATURE_BLOCKED", feature, planId: plan.id, planName: plan.name },
    });
  }
  return plan;
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

async function countExtinguishers(companyId: number): Promise<number> {
  const database = await db.getDb();
  if (!database) return 0;
  const rows = await database
    .select({ total: sql<number>`count(*)` })
    .from(extinguishers)
    .where(eq(extinguishers.accountId, companyId));
  return Number(rows[0]?.total || 0);
}

async function countUsers(companyId: number): Promise<number> {
  const list = await memberAuth.listMemberAccounts(companyId);
  return Array.isArray(list) ? list.length : 0;
}

export async function assertClientLimit(companyId: number) {
  const plan = await requirePlanFeature(companyId, "featureClients", "Cadastro de clientes não está disponível no seu plano.");
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

export async function assertExtinguisherLimit(companyId: number) {
  const plan = await requirePlanFeature(
    companyId,
    "featureExtinguishers",
    "Cadastro de extintores não está disponível no seu plano.",
  );
  if (plan.maxExtinguishers == null) return plan;
  const current = await countExtinguishers(companyId);
  if (current >= plan.maxExtinguishers) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Limite de extintores do plano ${plan.name} atingido (${plan.maxExtinguishers}). Faça upgrade para continuar.`,
      cause: { code: "PLAN_LIMIT", resource: "extinguishers", limit: plan.maxExtinguishers, current },
    });
  }
  return plan;
}

export async function assertUserLimit(companyId: number) {
  // O cadastro deve ser independente das tabelas legadas de billing. A
  // quantidade de usuários pode ser limitada posteriormente por uma regra
  // própria do novo produto, sem bloquear a criação por uma query de plano.
  void companyId;
  return { id: null, name: "Operação", maxUsers: null };
}

export async function assertServiceOrderFeature(companyId: number) {
  return requirePlanFeature(
    companyId,
    "featureServiceOrders",
    "Ordens de serviço não estão disponíveis no seu plano.",
  );
}

export async function assertAlertsFeature(companyId: number) {
  return requirePlanFeature(companyId, "featureAlerts", "Alertas de vencimento não estão disponíveis no seu plano.");
}

export async function assertReportsFeature(companyId: number) {
  return requirePlanFeature(
    companyId,
    "featureReports",
    "Histórico e auditoria não estão disponíveis no seu plano. Faça upgrade para o Profissional ou Empresarial.",
  );
}

export async function assertBackupFeature(companyId: number) {
  return requirePlanFeature(companyId, "featureBackup", "Backup e restauração não estão disponíveis no seu plano.");
}
