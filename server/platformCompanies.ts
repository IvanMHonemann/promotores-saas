/** Gestão de empresas pelo administrador da plataforma: visão geral, plano/validade, pagamentos, bloqueio, arquivamento e exclusão. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { companies, companySubscriptions, memberAccounts, memberSessions, payments, subscriptionPlans, systemSettings } from "../drizzle/schema.original";
import { MONTHLY_AMOUNT_KEY, BLOCK_AFTER_OVERDUE_KEY, BILLING_DAY_KEY, markCompanyPaid, resolveMonthlyAmount, resolveGraceDays, ensureBillingDay } from "./paymentReminder";
import { EXTRA_USERS_KEY, effectiveUserLimit, parseExtraUsers, staffUsageLabel, suggestedMonthlyAmount } from "../shared/staffLimit";
import { latestAcceptanceByCompany, termsAcceptanceSummary } from "../shared/legalOverview";
import { listLatestLegalAcceptances } from "./legal";
import { getCompanyRegistry } from "./companyRegistry";
import { applyCompanyCascade, canPermanentlyPurge, confirmMatchesCompany, isRetentionBackupKey, purgeLegalWarning, type SchemaColumn } from "../shared/companyPurge";
import { guardedStorageDelete, TENANT_MEDIA_AREAS } from "./mediaKeys";

import { DEFAULT_OVERDUE_GRACE_DAYS } from "./subscriptionAccess";

const BR = "-03:00";
export const endOfDay = (d: string) => new Date(`${d}T23:59:59${BR}`);
export const startOfDay = (d: string) => new Date(`${d}T00:00:00${BR}`);
const addDaysDate = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function database() {
  const d = await db.getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return d;
}

/** Empresa encerrada/arquivada pelo administrador da plataforma (ainda existe no banco). */
export async function getArchivedAt(companyId: number): Promise<string> {
  return (await db.getSetting("archived_at", companyId, "")) || "";
}

/** Impede cobrança, plano ou reativação enquanto a empresa estiver arquivada. Restaurar primeiro. */
export async function assertCompanyNotArchived(companyId: number): Promise<void> {
  const archived = await getArchivedAt(companyId);
  if (archived) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Esta empresa está excluída (arquivada). Restaure-a antes de alterar plano, cobrança ou acesso.",
    });
  }
}


/** @deprecated O bloqueio rígido foi substituído pela cópia final obrigatória. Mantido só para chamadas antigas. */
export function purgeBlockedByTimeClock(_eventCount: number): string | null {
  return null;
}

export function assertPermanentPurgeRole(role: string | null | undefined) {
  if (!canPermanentlyPurge(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Só o administrador da plataforma pode excluir uma empresa em caráter permanente." });
  }
}

export async function deleteCompanyMediaFiles(companyId: number): Promise<number> {
  const { storageListKeys, storageDelete } = await import("./storage");
  let filesDeleted = 0;
  for (const area of TENANT_MEDIA_AREAS) {
    const keys = await storageListKeys(`${area}/${companyId}/`);
    for (const k of keys) {
      if (isRetentionBackupKey(k)) continue;
      try { if (await guardedStorageDelete(storageDelete, k, companyId)) filesDeleted++; } catch { /* segue */ }
    }
  }
  return filesDeleted;
}

export { purgeLegalWarning };


export async function listCompaniesOverview() {
  const d = await database();
  await db.ensureAdditionalUserPriceColumn();
  const { ensureCompanyRegistryColumns } = await import("./companyRegistry");
  await ensureCompanyRegistryColumns();
  const [rows, plans, pays, counts, admins, flags, acceptances] = await Promise.all([
    d.select().from(companies).orderBy(companies.name),
    d.select().from(subscriptionPlans),
    d.execute(sql`SELECT companyId, MAX(paymentDate) AS lastPayment, COUNT(*) AS n FROM payments WHERE status IN ('RECEIVED','CONFIRMED','MOCK_APPROVED') GROUP BY companyId`),
    d.execute(sql`SELECT companyId, COUNT(*) AS total, SUM(active) AS ativos, SUM(CASE WHEN active = 1 AND role = 'promoter' THEN 1 ELSE 0 END) AS staff FROM member_accounts GROUP BY companyId`),
    d.execute(sql`SELECT companyId, MIN(email) AS email, MIN(userName) AS name FROM member_accounts WHERE role = 'company_admin' GROUP BY companyId`),
    d.select().from(systemSettings).where(inArray(systemSettings.settingKey, ["blocked_reason", "archived_at", MONTHLY_AMOUNT_KEY, BLOCK_AFTER_OVERDUE_KEY, EXTRA_USERS_KEY, "company_legal_profile"])),
    listLatestLegalAcceptances(),
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const acceptanceBy = latestAcceptanceByCompany(acceptances);
  const map = <T,>(r: any, key = "companyId") => new Map<number, T>(((r as any)[0] as any[]).map((x) => [Number(x[key]), x as T]));
  const payBy = map<any>(pays), countBy = map<any>(counts), adminBy = map<any>(admins);
  const flagBy = new Map<string, string>(flags.map((f: any) => [`${f.accountId}:${f.settingKey}`, f.settingValue]));
  const legacyLegal = (companyId: number) => {
    try { return JSON.parse(flagBy.get(`${companyId}:company_legal_profile`) || "") as { legalName?: string; document?: string; address?: string }; }
    catch { return {}; }
  };
  return rows.map((c) => {
    const plan = c.planId ? planById.get(c.planId) : null;
    const legacy = legacyLegal(c.id);
    const monthlyAmount = flagBy.get(`${c.id}:${MONTHLY_AMOUNT_KEY}`) || (plan?.price != null ? String(plan.price) : null);
    const blockAfter = flagBy.get(`${c.id}:${BLOCK_AFTER_OVERDUE_KEY}`);
    const extraUsers = parseExtraUsers(flagBy.get(`${c.id}:${EXTRA_USERS_KEY}`));
    const planMaxUsers = plan?.maxUsers == null ? null : Number(plan.maxUsers);
    const additionalUserPrice = (plan as any)?.additionalUserPrice != null ? String((plan as any).additionalUserPrice) : null;
    const staffCurrent = Number(countBy.get(c.id)?.staff ?? 0);
    const staffLimit = effectiveUserLimit({ maxUsers: planMaxUsers, extraUsers });
    return {
      id: c.id, name: c.name, active: c.active, createdAt: c.createdAt,
      legalName: (c as any).legalName || legacy.legalName || null,
      taxDocument: (c as any).taxDocument || legacy.document || null,
      addressCity: (c as any).addressCity ?? null,
      addressState: (c as any).addressState ?? null,
      addressStreet: (c as any).addressStreet || legacy.address || null,
      archivedAt: flagBy.get(`${c.id}:archived_at`) ?? null,
      blockedReason: flagBy.get(`${c.id}:blocked_reason`) ?? null,
      planId: c.planId ?? null, planName: plan?.name ?? null, planPrice: plan?.price ?? null,
      monthlyAmount,
      additionalUserPrice,
      planMaxUsers,
      extraUsers,
      staffCurrent,
      staffLimit,
      staffUsageLabel: staffUsageLabel(staffCurrent, staffLimit, extraUsers),
      suggestedMonthlyAmount: plan?.price != null
        ? suggestedMonthlyAmount({ planPrice: plan.price, extraUsers, additionalUserPrice })
        : null,
      blockAfterOverdueDays: blockAfter != null && blockAfter !== "" ? Number(blockAfter) : DEFAULT_OVERDUE_GRACE_DAYS,
      subscriptionStatus: c.subscriptionStatus ?? null,
      startedAt: c.subscriptionStartedAt ?? null, expiresAt: c.subscriptionExpiresAt ?? null, graceUntil: c.gracePeriodEndsAt ?? null,
      lastPayment: payBy.get(c.id)?.lastPayment ?? null, paymentsCount: Number(payBy.get(c.id)?.n ?? 0),
      users: Number(countBy.get(c.id)?.total ?? 0), activeUsers: Number(countBy.get(c.id)?.ativos ?? 0),
      adminEmail: adminBy.get(c.id)?.email ?? null, adminName: adminBy.get(c.id)?.name ?? null,
      ...termsAcceptanceSummary(acceptanceBy.get(c.id)),
    };
  });
}

export async function setCompanyBlocked(companyId: number, blocked: boolean, reason?: string | null) {
  const d = await database();
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  if (!blocked) await assertCompanyNotArchived(companyId);
  await db.updateCompany(companyId, { active: !blocked });
  if (blocked) await db.setSetting("blocked_reason", (reason || "").trim().slice(0, 300) || "Acesso bloqueado pelo administrador da plataforma.", companyId);
  else await d.delete(systemSettings).where(and(eq(systemSettings.accountId, companyId), eq(systemSettings.settingKey, "blocked_reason")));
  if (blocked) {
    // encerra sessões ativas da empresa
    const ids = (await d.select({ id: memberAccounts.id }).from(memberAccounts).where(eq(memberAccounts.companyId, companyId))).map((r) => r.id);
    if (ids.length) await d.delete(memberSessions).where(inArray(memberSessions.memberAccountId, ids));
  }
  return company;
}

/** Define plano, status e validade (datas de calendário, horário de Brasília). Cria a assinatura se não houver. */
export async function setCompanyPlan(input: { companyId: number; planId: number; status: "trial" | "active" | "pending" | "overdue" | "suspended" | "canceled" | "test" | "expired"; startsAt: string; endsAt?: string | null; graceDays?: number; notes?: string | null }) {
  const d = await database();
  const company = await db.getCompanyById(input.companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  await assertCompanyNotArchived(input.companyId);
  const plan = await db.getSubscriptionPlanById(input.planId);
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Plano não encontrado." });
  if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "A validade final não pode ser anterior ao início." });
  const latest = await db.getLatestCompanySubscription(input.companyId);
  if (latest) await db.updateCompanySubscription(latest.id, { planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? latest.notes ?? null });
  else await db.createCompanySubscription({ companyId: input.companyId, planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? null });
  const end = input.endsAt ? endOfDay(input.endsAt) : null;
  await d.update(companies).set({
    planId: input.planId, subscriptionStatus: input.status,
    subscriptionStartedAt: startOfDay(input.startsAt), subscriptionExpiresAt: end,
    // tolerância explícita (padrão 5 dias): acesso até o fim do dia de validade + graceDays
    gracePeriodEndsAt: end ? addDaysDate(end, Math.max(0, input.graceDays ?? DEFAULT_OVERDUE_GRACE_DAYS)) : null,
    // Se a situação for teste, alinha trialEndsAt à validade informada para não ficar um
    // trialEndsAt antigo (ex.: 14 dias da criação) bloqueando antes da data configurada.
    ...((input.status === "trial" || input.status === "test") ? { trialEndsAt: end } : {}),
  } as any).where(eq(companies.id, input.companyId));
  if (input.endsAt) await ensureBillingDay(input.companyId, input.endsAt);
  return { success: true as const };
}

/** Registra pagamento recebido e estende a validade do plano (período pago: de → até). */
export async function registerCompanyPayment(input: { companyId: number; amount: string; paymentDate: string; periodFrom: string; periodTo: string; billingType: "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED"; planId?: number | null; graceDays?: number; note?: string | null }) {
  const company = await db.getCompanyById(input.companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  await assertCompanyNotArchived(input.companyId);
  if (input.periodTo < input.periodFrom) throw new TRPCError({ code: "BAD_REQUEST", message: "O fim do período pago não pode ser anterior ao início." });
  const planId = input.planId ?? company.planId;
  if (!planId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um plano para esta empresa antes de registrar o pagamento." });
  const latest = await db.getLatestCompanySubscription(input.companyId);
  await setCompanyPlan({ companyId: input.companyId, planId, status: "active", startsAt: input.periodFrom, endsAt: input.periodTo, graceDays: input.graceDays ?? DEFAULT_OVERDUE_GRACE_DAYS, notes: input.note ?? latest?.notes ?? null });
  const sub = await db.getLatestCompanySubscription(input.companyId);
  const created = await db.createPaymentRecord({ companyId: input.companyId, subscriptionId: sub?.id ?? null, amount: input.amount, netAmount: input.amount, billingType: input.billingType, status: "RECEIVED", dueDate: input.periodFrom, paymentDate: input.paymentDate });
  // pagamento registrado reativa o acesso, se estava bloqueado por inadimplência
  if (!company.active) await setCompanyBlocked(input.companyId, false);
  return created;
}

export async function listCompanyPayments(companyId: number) {
  return db.listPaymentsForCompany(companyId);
}
export async function deletePayment(id: number, companyId: number) {
  const d = await database();
  const r: any = await d.delete(payments).where(and(eq(payments.id, id), eq(payments.companyId, companyId)));
  if (!r[0]?.affectedRows) throw new TRPCError({ code: "NOT_FOUND", message: "Pagamento não encontrado." });
}

export async function archiveCompany(companyId: number, archived: boolean) {
  const d = await database();
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  if (archived) {
    await setCompanyBlocked(companyId, true, "Empresa excluída pelo administrador da plataforma.");
    await db.setSetting("archived_at", new Date().toISOString(), companyId);
  } else {
    await d.delete(systemSettings).where(and(eq(systemSettings.accountId, companyId), eq(systemSettings.settingKey, "archived_at")));
    await setCompanyBlocked(companyId, false);
  }
  return company;
}

/**
 * Exclusão PERMANENTE e irreversível, inclusive com marcações de ponto.
 * Só o administrador da plataforma. Vale para empresa ativa ou já arquivada.
 * Gera antes a cópia final no prefixo de retenção; se a cópia falhar, nada é apagado.
 * A confirmação exige o nome exato da empresa ou o CNPJ/CPF.
 */
export async function purgeCompanyPermanently(
  companyId: number,
  confirmName: string,
  role: string | null | undefined,
  deps?: {
    getCompany?: (companyId: number) => Promise<{ id: number; name: string; taxDocument?: string | null } | undefined>;
    createBackup?: (companyId: number) => Promise<{ key: string; url: string; fileName: string; bytes?: number; warnings?: string[] }>;
    deleteMedia?: (companyId: number) => Promise<number>;
    runCascade?: () => Promise<Record<string, number>>;
  },
) {
  assertPermanentPurgeRole(role);
  const company = await (deps?.getCompany ?? db.getCompanyById)(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  let taxDocument = (company as any).taxDocument as string | null | undefined;
  if (!deps?.getCompany) {
    try {
      const registry = await getCompanyRegistry(companyId);
      taxDocument = taxDocument || registry.registry.taxDocument || null;
    } catch { /* cadastro pode não existir */ }
  }
  if (!confirmMatchesCompany({ name: company.name, taxDocument }, confirmName)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "O nome ou o CNPJ digitado não confere com o da empresa." });
  }

  const { createCompanyRetentionBackup } = await import("./companyRetentionBackup");
  const createBackup = deps?.createBackup ?? createCompanyRetentionBackup;
  let backup: { key: string; url: string; fileName: string; bytes?: number; warnings?: string[] };
  try {
    backup = await createBackup(companyId);
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Não foi possível gerar a cópia final de segurança. A empresa não foi excluída. ${e instanceof Error ? e.message : ""}`.trim(),
    });
  }
  if (!backup?.key || !isRetentionBackupKey(backup.key, companyId)) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível gerar a cópia final de segurança. A empresa não foi excluída." });
  }

  const deleteMedia = deps?.deleteMedia ?? deleteCompanyMediaFiles;
  let filesDeleted = 0;
  try { filesDeleted = await deleteMedia(companyId); } catch { /* a cópia já está guardada; segue a exclusão do banco */ }

  if (deps?.runCascade) {
    const deleted = await deps.runCascade();
    return { company, deleted, filesDeleted, backup };
  }

  const pool = await db.getPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const conn = await pool.getConnection();
  const deleted: Record<string, number> = {};
  try {
    const [cols]: any = await conn.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`);
    const [memberIdsRows]: any = await conn.query("SELECT id FROM member_accounts WHERE companyId = ?", [companyId]);
    const memberIds: number[] = (memberIdsRows as any[]).map((r: any) => r.id);
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();
    const exec = {
      query: async (sqlText: string, params?: unknown[]) => {
        const [r]: any = await conn.query(sqlText, params as any);
        return { affectedRows: r?.affectedRows || 0 };
      },
    };
    Object.assign(deleted, await applyCompanyCascade(exec, companyId, cols as SchemaColumn[], memberIds));
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => undefined);
    conn.release();
  }
  return { company, deleted, filesDeleted, backup };
}

/** Compatível com o roteador antigo: exige papel de plataforma e a confirmação por nome ou CNPJ. */
export async function purgeCompany(companyId: number, confirmName: string, role: string | null | undefined = "platform_admin") {
  return purgeCompanyPermanently(companyId, confirmName, role);
}


/** Valor mensal negociado + tolerância (dias após vencimento) por empresa. */
export async function setCompanyBilling(input: {
  companyId: number;
  monthlyAmount?: string | null;
  blockAfterOverdueDays?: number | null;
  dueDate?: string | null;
  extraUsers?: number | null;
}) {
  const company = await db.getCompanyById(input.companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  await assertCompanyNotArchived(input.companyId);
  if (input.extraUsers != null) {
    await db.setSetting(EXTRA_USERS_KEY, String(parseExtraUsers(input.extraUsers)), input.companyId);
  }
  if (input.monthlyAmount != null && input.monthlyAmount !== "") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.monthlyAmount) || Number(input.monthlyAmount) <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Valor mensal inválido." });
    }
    await db.setSetting(MONTHLY_AMOUNT_KEY, Number(input.monthlyAmount).toFixed(2), input.companyId);
  }
  if (input.blockAfterOverdueDays != null) {
    const n = Math.max(0, Math.min(60, Math.floor(input.blockAfterOverdueDays)));
    await db.setSetting(BLOCK_AFTER_OVERDUE_KEY, String(n), input.companyId);
    // Alinha gracePeriodEndsAt com a nova tolerância, se houver vencimento.
    if (company.subscriptionExpiresAt) {
      const end = company.subscriptionExpiresAt instanceof Date
        ? company.subscriptionExpiresAt
        : new Date(company.subscriptionExpiresAt as any);
      await db.updateCompanySubscriptionFields(input.companyId, {
        gracePeriodEndsAt: addDaysDate(end, n),
      });
    }
  }
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new TRPCError({ code: "BAD_REQUEST", message: "Data de vencimento inválida." });
    const grace = input.blockAfterOverdueDays != null
      ? Math.max(0, Math.min(60, Math.floor(input.blockAfterOverdueDays)))
      : await resolveGraceDays(input.companyId);
    const end = endOfDay(input.dueDate);
    await db.updateCompanySubscriptionFields(input.companyId, {
      subscriptionExpiresAt: end,
      gracePeriodEndsAt: addDaysDate(end, grace),
    });
    // Âncora do dia de cobrança (ex.: 31) para não perder o dia ao atravessar meses curtos.
    await db.setSetting(BILLING_DAY_KEY, String(Number(input.dueDate.slice(8, 10))), input.companyId);
  }
  return {
    success: true as const,
    monthlyAmount: await resolveMonthlyAmount(input.companyId),
    graceDays: await resolveGraceDays(input.companyId),
    extraUsers: parseExtraUsers(await db.getSetting(EXTRA_USERS_KEY, input.companyId, "0")),
  };
}

export { markCompanyPaid, resolveMonthlyAmount, resolveGraceDays };
