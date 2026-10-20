import { z } from "zod";
import { platformProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { auditFromCtx } from "../audit";
import * as pc from "../platformCompanies";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]);
const id = z.number().int().positive();
const log = (ctx: any, companyId: number, action: string, description: string, data?: unknown) =>
  void auditFromCtx(ctx, { action, module: "platform", entityType: "company", entityId: companyId, entityLabel: String(companyId), description, newData: data as any, companyId: null });

export const platformCompaniesRouter = router({
  overview: platformProcedure.query(() => pc.listCompaniesOverview()),
  rename: platformProcedure.input(z.object({ companyId: id, name: z.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    await db.updateCompany(input.companyId, { name: input.name });
    log(ctx, input.companyId, "update", `Renomeou empresa #${input.companyId} para ${input.name}`);
    return { success: true as const };
  }),
  setBlocked: platformProcedure.input(z.object({ companyId: id, blocked: z.boolean(), reason: z.string().max(300).optional() })).mutation(async ({ ctx, input }) => {
    const c = await pc.setCompanyBlocked(input.companyId, input.blocked, input.reason);
    log(ctx, input.companyId, input.blocked ? "block" : "unblock", `${input.blocked ? "Bloqueou" : "Desbloqueou"} a empresa ${c.name}${input.reason ? `: ${input.reason}` : ""}`);
    return { success: true as const };
  }),
  setPlan: platformProcedure.input(z.object({ companyId: id, planId: id, status, startsAt: dateStr, endsAt: dateStr.nullish(), graceDays: z.number().int().min(0).max(60).optional(), notes: z.string().max(500).nullish() })).mutation(async ({ ctx, input }) => {
    await pc.setCompanyPlan(input);
    log(ctx, input.companyId, "update", `Definiu plano/validade da empresa #${input.companyId}: plano ${input.planId}, ${input.status}, ${input.startsAt} a ${input.endsAt ?? "sem fim"}`, input);
    return { success: true as const };
  }),
  payments: platformProcedure.input(z.object({ companyId: id })).query(({ input }) => pc.listCompanyPayments(input.companyId)),
  registerPayment: platformProcedure.input(z.object({
    companyId: id, amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/), paymentDate: dateStr, periodFrom: dateStr, periodTo: dateStr,
    billingType: z.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]).default("PIX"), planId: id.nullish(), graceDays: z.number().int().min(0).max(60).optional(), note: z.string().max(500).nullish(),
  })).mutation(async ({ ctx, input }) => {
    const r = await pc.registerCompanyPayment(input);
    log(ctx, input.companyId, "payment", `Registrou pagamento de R$ ${input.amount} em ${input.paymentDate}; plano válido de ${input.periodFrom} a ${input.periodTo}`, input);
    return r;
  }),
  deletePayment: platformProcedure.input(z.object({ companyId: id, paymentId: id })).mutation(async ({ ctx, input }) => {
    await pc.deletePayment(input.paymentId, input.companyId);
    log(ctx, input.companyId, "delete", `Excluiu o pagamento #${input.paymentId} da empresa #${input.companyId}`);
    return { success: true as const };
  }),
  /** "Excluir": arquiva e bloqueia (reversível). */
  archive: platformProcedure.input(z.object({ companyId: id, archived: z.boolean() })).mutation(async ({ ctx, input }) => {
    const c = await pc.archiveCompany(input.companyId, input.archived);
    log(ctx, input.companyId, input.archived ? "delete" : "restore", `${input.archived ? "Excluiu (arquivou)" : "Restaurou"} a empresa ${c.name}`);
    return { success: true as const };
  }),
  /** Exclusão definitiva e irreversível; exige o nome da empresa e que ela já esteja excluída. */
  purge: platformProcedure.input(z.object({ companyId: id, confirmName: z.string().min(1) })).mutation(async ({ ctx, input }) => {
    const r = await pc.purgeCompany(input.companyId, input.confirmName);
    log(ctx, input.companyId, "permanent_delete", `Excluiu DEFINITIVAMENTE a empresa ${r.company.name} (#${input.companyId})`, { deleted: r.deleted, filesDeleted: r.filesDeleted });
    return { success: true as const, deleted: r.deleted };
  }),
});
