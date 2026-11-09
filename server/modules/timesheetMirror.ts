import { isValidCpf, isValidCpfOrCnpj } from "@shared/brDocs";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { companies, memberAccounts, promoterProfiles, timeEvents } from "../../drizzle/schema";
import { auditFromCtx } from "../audit";
import { buildMirror, type LaborProfile, type MirrorEvent } from "../../shared/timesheetMirror";
import { loadApprovedDayExcuses } from "./correctionExtras";
import { loadAdjustmentsByEvent, loadMemberVacations, loadMirrorEventRows, loadMirrorOptions, OPTIONAL_HOLIDAYS_SETTING, toMirrorEvents } from "./mirrorData";
import { readTimeAlert } from "../../shared/punchTime";
import { buildMemberReports } from "./timeBank";
import { closedPeriodBalance, monthBounds } from "../../shared/timeBank";

const TZ = "America/Sao_Paulo";
const monthStr = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mês inválido (use AAAA-MM).");
function todayIn(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

let adjustmentsReady: Promise<void> | null = null;
/** Tabela que preserva o valor ORIGINAL de cada marcação ajustada (nenhuma migração a cria; ver drizzle/0022). */
export async function ensureAdjustmentsTable(): Promise<void> {
  if (adjustmentsReady) return adjustmentsReady;
  adjustmentsReady = (async () => {
    const database = await db.getDb();
    if (!database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS time_event_adjustments (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      timeEventId int NOT NULL,
      correctionRequestId int NULL,
      memberAccountId int NOT NULL,
      originalType varchar(20) NOT NULL,
      originalTime timestamp NOT NULL,
      correctedType varchar(20) NOT NULL,
      correctedTime timestamp NOT NULL,
      justification text NOT NULL,
      reviewedByMemberId int NULL,
      reviewedByName varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY time_event_adj_event_idx (companyId, timeEventId),
      KEY time_event_adj_member_idx (companyId, memberAccountId)
    )`);
  })().catch((e) => { adjustmentsReady = null; throw e; });
  return adjustmentsReady;
}

export async function recordAdjustment(a: { companyId: number; timeEventId: number; correctionRequestId: number; memberAccountId: number; originalType: string; originalTime: Date; correctedType: string; correctedTime: Date; justification: string; reviewedByMemberId?: number | null; reviewedByName?: string | null }) {
  await ensureAdjustmentsTable();
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  await database.execute(sql`INSERT INTO time_event_adjustments
    (companyId, timeEventId, correctionRequestId, memberAccountId, originalType, originalTime, correctedType, correctedTime, justification, reviewedByMemberId, reviewedByName)
    VALUES (${a.companyId}, ${a.timeEventId}, ${a.correctionRequestId}, ${a.memberAccountId}, ${a.originalType}, ${a.originalTime}, ${a.correctedType}, ${a.correctedTime}, ${a.justification}, ${a.reviewedByMemberId ?? null}, ${a.reviewedByName ?? null})`);
}

const legalSchema = z.object({
  legalName: z.string().trim().max(200).optional().default(""),
  document: z.string().trim().max(32).optional().default("").refine((v) => !v || isValidCpfOrCnpj(v), "CNPJ/CPF inválido: confira os números."), // CNPJ/CPF do empregador
  establishment: z.string().trim().max(200).optional().default(""),
  address: z.string().trim().max(300).optional().default(""),
});
const laborSchema = z.object({
  jobTitle: z.string().trim().max(120).nullish(),
  admissionDate: dateStr.nullish(),
  cpf: z.string().trim().max(14).nullish().refine((v) => !v || isValidCpf(v), "CPF inválido: confira os números."),
  pis: z.string().trim().max(20).nullish(),
  /** Horário contratual: pares entrada/saída, ex.: [["08:00","12:00"],["13:00","17:00"]]. */
  schedule: z.array(z.tuple([hm, hm])).max(4).nullish(),
  dailyMinutes: z.number().int().min(0).max(1440).nullish(),
  intervalMinutes: z.number().int().min(0).max(600).nullish(),
  workdays: z.array(z.number().int().min(0).max(6)).max(7).nullish(),
  nightEnabled: z.boolean().optional(),
  nightStart: hm.optional(),
  nightEnd: hm.optional(),
});

async function readJson<T>(key: string, companyId: number): Promise<T | null> {
  const raw = await db.getSetting(key, companyId, "");
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function companyMembers(companyId: number, memberIds?: number[]) {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const where = [eq(memberAccounts.companyId, companyId)];
  if (memberIds?.length) where.push(inArray(memberAccounts.id, memberIds));
  const rows = await database.select({ id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role, active: memberAccounts.active, employeeCode: promoterProfiles.employeeCode })
    .from(memberAccounts).leftJoin(promoterProfiles, eq(promoterProfiles.memberAccountId, memberAccounts.id)).where(and(...where));
  return rows.filter((r) => r.role !== "company_admin");
}

export const timesheetMirrorRouter = router({
  /** Promotores da empresa + perfil trabalhista configurado (ou null). */
  promoters: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const members = await companyMembers(ctx.accountId);
    const out = [];
    for (const m of members) out.push({ ...m, labor: await readJson<LaborProfile>(`labor_profile:${m.id}`, ctx.accountId) });
    return out;
  }),
  getCompanyProfile: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const database = await db.getDb();
    const company = database ? (await database.select({ name: companies.name }).from(companies).where(eq(companies.id, ctx.accountId)).limit(1))[0] : null;
    const legal = await readJson<z.infer<typeof legalSchema>>("company_legal_profile", ctx.accountId);
    return { name: company?.name ?? "", legal: legal ?? { legalName: "", document: "", establishment: "", address: "" } };
  }),
  saveCompanyProfile: companyAdminFeatureProcedure("timeTracking").input(legalSchema).mutation(async ({ ctx, input }) => {
    await db.setSetting("company_legal_profile", JSON.stringify(input), ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "company_legal_profile", description: "Atualizou dados de identificação da empresa para o espelho de ponto", newData: input });
    return { success: true as const };
  }),
  /** Configuração do espelho: tratar Carnaval/Corpus Christi (ponto facultativo) como feriado abonado? */
  getMirrorOptions: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => loadMirrorOptions(ctx.accountId)),
  saveMirrorOptions: companyAdminFeatureProcedure("timeTracking").input(z.object({ optionalHolidaysAsHoliday: z.boolean() })).mutation(async ({ ctx, input }) => {
    await db.setSetting(OPTIONAL_HOLIDAYS_SETTING, input.optionalHolidaysAsHoliday ? "1" : "0", ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "mirror_options", description: `Carnaval/Corpus Christi ${input.optionalHolidaysAsHoliday ? "passam a ser abonados como feriado" : "deixam de ser abonados automaticamente"} no espelho de ponto`, newData: input });
    return { success: true as const };
  }),
  saveLaborProfile: companyAdminFeatureProcedure("timeTracking").input(z.object({ memberId: z.number().int().positive(), profile: laborSchema })).mutation(async ({ ctx, input }) => {
    const [member] = await companyMembers(ctx.accountId, [input.memberId]);
    if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado." });
    await db.setSetting(`labor_profile:${input.memberId}`, JSON.stringify(input.profile), ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "labor_profile", entityId: input.memberId, entityLabel: member.name, description: `Atualizou perfil trabalhista de ${member.name}`, newData: input.profile });
    return { success: true as const };
  }),

  /** Gera os dados do espelho. Somente leitura; registra a emissão na auditoria. */
  generate: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ memberIds: z.array(z.number().int().positive()).max(500).optional(), from: dateStr, to: dateStr }))
    .query(async ({ ctx, input }) => {
      if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual à final." });
      const spanDays = (Date.parse(input.to) - Date.parse(input.from)) / 86400000 + 1;
      if (spanDays > 366) throw new TRPCError({ code: "BAD_REQUEST", message: "O período máximo é de 366 dias." });
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      await ensureAdjustmentsTable();
      const members = await companyMembers(ctx.accountId, input.memberIds);
      if (input.memberIds?.length && members.length !== new Set(input.memberIds).size) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado nesta empresa." });
      const company = (await database.select({ name: companies.name }).from(companies).where(eq(companies.id, ctx.accountId)).limit(1))[0];
      const legal = await readJson<z.infer<typeof legalSchema>>("company_legal_profile", ctx.accountId);
      // Consultas em lote (4 no total, independentes do nº de funcionários) em vez de 3+ por funcionário.
      const memberIds = members.map((m) => m.id);
      // Consultas em lote via buildMemberReports (mesma regra do banco de horas); filtra pelo horário efetivo
      // (deviceTime, senão serverTime): batida offline sincronizada depois não some do mês.
      const reports = await buildMemberReports(ctx.accountId, memberIds, input.from, input.to, TZ);
      const results = members.map((m) => {
        const r = reports.get(m.id)!;
        return { member: { id: m.id, name: m.name, role: m.role, employeeCode: m.employeeCode ?? null }, labor: r.labor ? { ...r.labor } : null, report: r.report };
      });
      void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "timesheet_mirror", description: `Gerou espelho de ponto ${input.from} a ${input.to} (${results.length} funcionário(s))`, newData: { from: input.from, to: input.to, memberIds: results.map((r) => r.member.id) } });
      return { company: { name: company?.name ?? "", legal: legal ?? null }, generatedAt: new Date().toISOString(), timeZone: TZ, results };
    }),

  /**
   * Banco de horas da equipe (administrador da empresa): saldo do mês de cada funcionário, com a mesma regra do
   * promotor (closedPeriodBalance) e do espelho (buildMirror). Sempre restrito à empresa da sessão.
   */
  teamTimeBank: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ month: monthStr }))
    .query(async ({ ctx, input }) => {
      const { from, to } = monthBounds(input.month);
      const today = todayIn(TZ);
      const members = await companyMembers(ctx.accountId);
      const reports = await buildMemberReports(ctx.accountId, members.map((m) => m.id), from, to, TZ);
      const rows = members.map((m) => {
        const r = reports.get(m.id)!;
        return { id: m.id, name: m.name, active: Boolean(m.active), employeeCode: m.employeeCode ?? null, lastEventAt: r.lastEventAt, ...closedPeriodBalance(r.report, r.labor, today) };
      }).filter((r) => r.active || r.daysTracked > 0);
      return { month: input.month, from, to, generatedAt: new Date().toISOString(), rows };
    }),

  /** Detalhe diário do banco de horas de UM funcionário da empresa (previsto x trabalhado, extra/débito). */
  memberTimeBank: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ memberId: z.number().int().positive(), month: monthStr }))
    .query(async ({ ctx, input }) => {
      const [member] = await companyMembers(ctx.accountId, [input.memberId]);
      if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado nesta empresa." });
      const { from, to } = monthBounds(input.month);
      const r = (await buildMemberReports(ctx.accountId, [member.id], from, to, TZ)).get(member.id)!;
      const days = r.report.days.map((d) => ({ date: d.date, weekday: d.weekday, workedMinutes: d.workedMinutes, expectedMinutes: d.expectedMinutes, diffMinutes: d.diffMinutes, marks: d.marks.map((m) => ({ type: m.type, label: m.label, time: m.time, kind: m.kind })), issues: d.issues, holiday: d.holiday ?? null, excuse: d.excuse?.label ?? null, vacation: Boolean(d.vacation) }));
      return { member: { id: member.id, name: member.name, employeeCode: member.employeeCode ?? null }, month: input.month, lastEventAt: r.lastEventAt, balance: closedPeriodBalance(r.report, r.labor, todayIn(TZ)), days, notes: r.report.notes };
    }),

  /** Registra no log de auditoria que o espelho foi exportado/impresso/compartilhado. */
  logExport: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ kind: z.enum(["pdf", "xlsx", "print", "whatsapp"]), from: dateStr, to: dateStr, count: z.number().int().min(1).max(500) }))
    .mutation(async ({ ctx, input }) => {
      void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "timesheet_mirror", description: `Exportou espelho de ponto (${input.kind}) ${input.from} a ${input.to}, ${input.count} funcionário(s)`, newData: input });
      return { success: true as const };
    }),
});
