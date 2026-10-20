/** Gestão de empresas pelo administrador da plataforma: visão geral, plano/validade, pagamentos, bloqueio, arquivamento e exclusão. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { companies, companySubscriptions, memberAccounts, memberSessions, payments, subscriptionPlans, systemSettings } from "../drizzle/schema.original";

const BR = "-03:00";
export const endOfDay = (d: string) => new Date(`${d}T23:59:59${BR}`);
export const startOfDay = (d: string) => new Date(`${d}T00:00:00${BR}`);
const addDaysDate = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

async function database() {
  const d = await db.getDb();
  if (!d) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  return d;
}

export async function listCompaniesOverview() {
  const d = await database();
  const [rows, plans, pays, counts, admins, flags] = await Promise.all([
    d.select().from(companies).orderBy(companies.name),
    d.select().from(subscriptionPlans),
    d.execute(sql`SELECT companyId, MAX(paymentDate) AS lastPayment, COUNT(*) AS n FROM payments WHERE status IN ('RECEIVED','CONFIRMED','MOCK_APPROVED') GROUP BY companyId`),
    d.execute(sql`SELECT companyId, COUNT(*) AS total, SUM(active) AS ativos FROM member_accounts GROUP BY companyId`),
    d.execute(sql`SELECT companyId, MIN(email) AS email, MIN(userName) AS name FROM member_accounts WHERE role = 'company_admin' GROUP BY companyId`),
    d.select().from(systemSettings).where(inArray(systemSettings.settingKey, ["blocked_reason", "archived_at"])),
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const map = <T,>(r: any, key = "companyId") => new Map<number, T>(((r as any)[0] as any[]).map((x) => [Number(x[key]), x as T]));
  const payBy = map<any>(pays), countBy = map<any>(counts), adminBy = map<any>(admins);
  const flagBy = new Map<string, string>(flags.map((f: any) => [`${f.accountId}:${f.settingKey}`, f.settingValue]));
  return rows.map((c) => {
    const plan = c.planId ? planById.get(c.planId) : null;
    return {
      id: c.id, name: c.name, active: c.active, createdAt: c.createdAt,
      archivedAt: flagBy.get(`${c.id}:archived_at`) ?? null,
      blockedReason: flagBy.get(`${c.id}:blocked_reason`) ?? null,
      planId: c.planId ?? null, planName: plan?.name ?? null, planPrice: plan?.price ?? null,
      subscriptionStatus: c.subscriptionStatus ?? null,
      startedAt: c.subscriptionStartedAt ?? null, expiresAt: c.subscriptionExpiresAt ?? null, graceUntil: c.gracePeriodEndsAt ?? null,
      lastPayment: payBy.get(c.id)?.lastPayment ?? null, paymentsCount: Number(payBy.get(c.id)?.n ?? 0),
      users: Number(countBy.get(c.id)?.total ?? 0), activeUsers: Number(countBy.get(c.id)?.ativos ?? 0),
      adminEmail: adminBy.get(c.id)?.email ?? null, adminName: adminBy.get(c.id)?.name ?? null,
    };
  });
}

export async function setCompanyBlocked(companyId: number, blocked: boolean, reason?: string | null) {
  const d = await database();
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
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
    // tolerância explícita (padrão 0 dia): acesso até o fim do dia de validade + graceDays
    gracePeriodEndsAt: end ? addDaysDate(end, Math.max(0, input.graceDays ?? 0)) : null,
  } as any).where(eq(companies.id, input.companyId));
  return { success: true as const };
}

/** Registra pagamento recebido e estende a validade do plano (período pago: de → até). */
export async function registerCompanyPayment(input: { companyId: number; amount: string; paymentDate: string; periodFrom: string; periodTo: string; billingType: "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED"; planId?: number | null; graceDays?: number; note?: string | null }) {
  const company = await db.getCompanyById(input.companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  if (input.periodTo < input.periodFrom) throw new TRPCError({ code: "BAD_REQUEST", message: "O fim do período pago não pode ser anterior ao início." });
  const planId = input.planId ?? company.planId;
  if (!planId) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um plano para esta empresa antes de registrar o pagamento." });
  const latest = await db.getLatestCompanySubscription(input.companyId);
  await setCompanyPlan({ companyId: input.companyId, planId, status: "active", startsAt: input.periodFrom, endsAt: input.periodTo, graceDays: input.graceDays ?? 0, notes: input.note ?? latest?.notes ?? null });
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
 * Exclusão DEFINITIVA e irreversível: apaga todos os dados da empresa (todas as tabelas com companyId/accountId),
 * as sessões, e os arquivos de fotos do armazenamento. Só para empresas já arquivadas.
 */
export async function purgeCompany(companyId: number, confirmName: string) {
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  if (company.name.trim() !== confirmName.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "O nome digitado não confere com o da empresa." });
  const archived = await db.getSetting("archived_at", companyId, "");
  if (!archived) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Exclua (arquive) a empresa primeiro; a exclusão definitiva só vale para empresas já excluídas." });

  // arquivos de fotos (a lixeira também guarda chaves)
  let filesDeleted = 0;
  try {
    const d = await database();
    const [photoRows]: any = await d.execute(sql`SELECT fileKey, thumbnailKey FROM store_photos WHERE companyId = ${companyId}`);
    const { storageDelete } = await import("./storage");
    for (const p of photoRows as any[]) { for (const k of [p.fileKey, p.thumbnailKey]) if (k) { try { await storageDelete(k); filesDeleted++; } catch { /* segue */ } } }
  } catch { /* tabela pode não existir */ }

  const pool = await db.getPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const conn = await pool.getConnection();
  const deleted: Record<string, number> = {};
  try {
    const [cols]: any = await conn.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`);
    const [memberIdsRows]: any = await conn.query("SELECT id FROM member_accounts WHERE companyId = ?", [companyId]);
    const memberIds: number[] = memberIdsRows.map((r: any) => r.id);
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();
    if (memberIds.length) { const [r]: any = await conn.query("DELETE FROM member_sessions WHERE memberAccountId IN (?)", [memberIds]); deleted.member_sessions = r.affectedRows; }
    const skip = new Set(["companies"]);
    for (const { t, c } of cols as Array<{ t: string; c: string }>) {
      if (skip.has(t) || !/^[A-Za-z0-9_]+$/.test(t)) continue;
      const [r]: any = await conn.query(`DELETE FROM \`${t}\` WHERE \`${c}\` = ?`, [companyId]);
      if (r.affectedRows) deleted[t] = (deleted[t] ?? 0) + r.affectedRows;
    }
    const [r]: any = await conn.query("DELETE FROM companies WHERE id = ?", [companyId]);
    deleted.companies = r.affectedRows;
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => undefined);
    throw e;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => undefined);
    conn.release();
  }
  return { company, deleted, filesDeleted };
}
