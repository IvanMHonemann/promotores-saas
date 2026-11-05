/**
 * "Ponto com valor de prova": comprovantes, aceite do espelho, AFD/AEJ e verificação de integridade.
 * Ver docs/ponto-prova-legal.md.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { commercialFeatureProcedure, companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { companies, memberAccounts, promoterProfiles, timeEvents } from "../../drizzle/schema";
import { auditFromCtx, requestMeta } from "../audit";
import { buildMirror, type LaborProfile } from "../../shared/timesheetMirror";
import { loadApprovedDayExcuses } from "../modules/correctionExtras";
import { effectiveEventTime, loadAdjustmentsByEvent, loadMemberVacations, loadMirrorEventRows, loadMirrorOptions, toMirrorEvents } from "../modules/mirrorData";
import { ensurePunchLedger, toLedgerRow, DEFAULT_TZ, supersededIds } from "./ledger";
import { buildAej, buildAfd, onlyDigits, sha256, toAejSequence, toLatin1, verifyLedger, formatD, type AejMark, type AejWorker } from "./repFormat";
import { buildReceiptData, buildReceiptPdf, receiptEmailHtml } from "./receipt";
import { sendEmail } from "../email";

const TZ = DEFAULT_TZ;
const monthStr = z.string().regex(/^\d{4}-\d{2}$/);
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Dados do desenvolvedor/INPI vêm do ambiente (preencher após registro no INPI e certificado). */
export function developerInfo() {
  return {
    document: onlyDigits(process.env.GONDUP_DEVELOPER_DOCUMENT || ""),
    name: (process.env.GONDUP_DEVELOPER_NAME || "GondUp").trim(),
    email: (process.env.GONDUP_DEVELOPER_EMAIL || "").trim(),
    inpiNumber: onlyDigits(process.env.GONDUP_INPI_NUMBER || "") || null,
    version: (process.env.GONDUP_PTRP_VERSION || "1.0").trim().slice(0, 8),
  };
}

type LegalProfile = { legalName?: string; document?: string; establishment?: string; address?: string };
async function readJson<T>(key: string, companyId: number): Promise<T | null> {
  const raw = await db.getSetting(key, companyId, "");
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function employerOf(companyId: number) {
  const database = await db.getDb();
  const company = database ? (await database.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0] : null;
  const legal = await readJson<LegalProfile>("company_legal_profile", companyId);
  const document = onlyDigits(legal?.document) || null;
  return { name: (legal?.legalName || company?.name || "").trim(), document, workplace: (legal?.establishment || legal?.address || "").trim() || null };
}

const isAdminRole = (ctx: any) => ["company_admin", "supervisor"].includes(String(ctx.user?.role || ""));

async function loadReceipt(ctx: any, eventId: number) {
  await ensurePunchLedger();
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const row = (await database.select().from(timeEvents).where(and(eq(timeEvents.id, eventId), eq(timeEvents.companyId, ctx.accountId))).limit(1))[0];
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Marcação não encontrada." });
  if (row.memberAccountId !== ctx.memberAccountId && !isAdminRole(ctx)) throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode ver os seus comprovantes." });
  const member = (await database.select({ name: memberAccounts.userName, email: memberAccounts.email }).from(memberAccounts).where(eq(memberAccounts.id, row.memberAccountId)).limit(1))[0];
  const employer = await employerOf(ctx.accountId);
  const data = buildReceiptData({
    event: { id: row.id, nsr: row.nsr ?? null, eventType: row.eventType, serverTime: row.serverTime, deviceTime: row.deviceTime, timeZone: row.timeZone, recordHash: row.recordHash, contentHash: row.contentHash, workerCpf: row.workerCpf, latitude: row.latitude, longitude: row.longitude, accuracy: row.accuracy, offline: Boolean(row.offline), origin: row.origin || "original", sealedLegacy: Boolean(row.sealedLegacy) },
    employer, workerName: member?.name ?? "", inpiNumber: developerInfo().inpiNumber,
  });
  return { data, memberEmail: member?.email ?? null };
}

/** Espelho mensal de um funcionário + hash do documento (o que ele aceita). */
export async function memberMonthMirror(companyId: number, memberId: number, month: string) {
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}`;
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const member = (await database.select({ id: memberAccounts.id, name: memberAccounts.userName, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts).leftJoin(promoterProfiles, eq(promoterProfiles.memberAccountId, memberAccounts.id)).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.companyId, companyId))).limit(1))[0];
  if (!member) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado." });
  const rows = await loadMirrorEventRows(companyId, [memberId], from, to);
  const adj = await loadAdjustmentsByEvent(companyId, [memberId]);
  const labor = await readJson<LaborProfile>(`labor_profile:${memberId}`, companyId);
  const excuses = (await loadApprovedDayExcuses(companyId, [memberId], from, to)).get(memberId) || [];
  const vacations = (await loadMemberVacations(companyId, [memberId], from, to)).get(memberId) || [];
  const options = await loadMirrorOptions(companyId);
  const report = buildMirror({ events: toMirrorEvents(rows, adj), from, to, timeZone: TZ, labor, excuses, vacations, options });
  const employer = await employerOf(companyId);
  const document = {
    v: 1, month, employer: { name: employer.name, document: employer.document },
    worker: { id: member.id, name: member.name, cpf: onlyDigits(labor?.cpf) || null, jobTitle: labor?.jobTitle ?? null, admissionDate: labor?.admissionDate ?? null },
    days: report.days.map((d) => ({ date: d.date, marks: d.marks.map((m) => [m.type, m.time, m.kind, m.originalTime ?? null]), worked: d.workedMinutes, expected: d.expectedMinutes, issues: d.issues })),
    totals: report.totals,
  };
  return { member, employer, labor, report, from, to, documentHash: sha256(JSON.stringify(document)) };
}

async function latestAcceptances(companyId: number, month: string, memberIds?: number[]) {
  await ensurePunchLedger();
  const database = await db.getDb();
  if (!database) return new Map<number, any>();
  const filter = memberIds?.length ? sql` AND memberAccountId IN (${sql.join(memberIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  const [rows]: any = await database.execute(sql`SELECT id, memberAccountId, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND month = ${month}${filter} ORDER BY id DESC`);
  const map = new Map<number, any>();
  for (const r of rows as any[]) if (!map.has(Number(r.memberAccountId))) map.set(Number(r.memberAccountId), r);
  return map;
}

function rangeUtc(from: string, to: string) {
  return { start: new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 3600000), end: new Date(Date.parse(`${to}T00:00:00Z`) + 39 * 3600000) };
}

function fileResponse(content: string, fileName: string) {
  return { fileName, base64: toLatin1(content).toString("base64"), mimeType: "text/plain;charset=iso-8859-1" };
}

export const pontoLegalRouter = router({
  /** Situação do sistema para a tela do administrador (o que já está pronto e o que depende do Ivan/advogado). */
  status: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const dev = developerInfo();
    const employer = await employerOf(ctx.accountId);
    return {
      employerDocument: Boolean(employer.document),
      employerName: employer.name,
      inpiNumber: dev.inpiNumber,
      developerDocument: Boolean(dev.document),
      signature: false,
      emailEnabled: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_WEBHOOK_URL),
    };
  }),

  /** Comprovantes do próprio funcionário (padrão: últimos 30 dias; a Portaria exige ao menos as últimas 48 h). */
  myReceipts: commercialFeatureProcedure("timeTracking")
    .input(z.object({ days: z.number().int().min(1).max(90).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.accountId || !ctx.memberAccountId) return [];
      await ensurePunchLedger();
      const database = await db.getDb();
      if (!database) return [];
      const since = new Date(Date.now() - (input?.days ?? 30) * 86400000);
      const rows = await database.select({ id: timeEvents.id, nsr: timeEvents.nsr, eventType: timeEvents.eventType, serverTime: timeEvents.serverTime, deviceTime: timeEvents.deviceTime, recordHash: timeEvents.recordHash, origin: timeEvents.origin, timeZone: timeEvents.timeZone, offline: timeEvents.offline })
        .from(timeEvents)
        .where(and(eq(timeEvents.companyId, ctx.accountId), eq(timeEvents.memberAccountId, ctx.memberAccountId), gte(timeEvents.serverTime, since)))
        .orderBy(desc(timeEvents.serverTime)).limit(500);
      const gone = await supersededIds(ctx.accountId, rows.map((r) => r.id));
      return rows.map((r) => ({ ...r, markedAt: r.deviceTime || r.serverTime, superseded: gone.has(r.id) }));
    }),

  receipt: commercialFeatureProcedure("timeTracking")
    .input(z.object({ eventId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => (await loadReceipt(ctx, input.eventId)).data),

  receiptPdf: commercialFeatureProcedure("timeTracking")
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { data } = await loadReceipt(ctx, input.eventId);
      const pdf = await buildReceiptPdf(data);
      void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Baixou comprovante de ponto (NSR ${data.nsr ?? "-"})` } as any);
      return { fileName: `comprovante-ponto-NSR${String(data.nsr ?? input.eventId).padStart(9, "0")}.pdf`, base64: pdf.toString("base64") };
    }),

  emailReceipt: commercialFeatureProcedure("timeTracking")
    .input(z.object({ eventId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { data, memberEmail } = await loadReceipt(ctx, input.eventId);
      if (!memberEmail) return { sent: false as const, message: "Seu cadastro não tem e-mail. Peça ao administrador para incluir." };
      if (!process.env.RESEND_API_KEY && !process.env.EMAIL_WEBHOOK_URL) return { sent: false as const, message: "Envio de e-mail não está ativado neste ambiente. Baixe o PDF." };
      const result = await sendEmail({ to: memberEmail, subject: `Comprovante de ponto — ${data.eventLabel} ${data.markedLocal}`, html: receiptEmailHtml(data) });
      void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Comprovante de ponto enviado por e-mail (NSR ${data.nsr ?? "-"})${result.ok ? "" : " — falhou"}` } as any);
      return result.ok ? { sent: true as const, message: `Comprovante enviado para ${memberEmail}.` } : { sent: false as const, message: "Não foi possível enviar o e-mail agora. Baixe o PDF." };
    }),

  // ------------------------------------------------------------------ aceite do espelho
  myMirror: commercialFeatureProcedure("timeTracking")
    .input(z.object({ month: monthStr }))
    .query(async ({ ctx, input }) => {
      if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
      const acc = (await latestAcceptances(ctx.accountId, input.month, [ctx.memberAccountId])).get(ctx.memberAccountId) ?? null;
      return {
        month: input.month, from: m.from, to: m.to, timeZone: TZ, report: m.report, documentHash: m.documentHash,
        employer: m.employer, worker: { name: m.member.name, cpf: m.labor?.cpf ?? null, jobTitle: m.labor?.jobTitle ?? null, admissionDate: m.labor?.admissionDate ?? null },
        acceptance: acc ? { decision: acc.decision, acceptedAt: acc.acceptedAt, documentHash: acc.documentHash, comment: acc.comment, stillValid: acc.documentHash === m.documentHash } : null,
      };
    }),

  acceptMirror: commercialFeatureProcedure("timeTracking")
    .input(z.object({ month: monthStr, documentHash: z.string().regex(/^[a-f0-9]{64}$/), decision: z.enum(["accepted", "contested"]), comment: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
      if (input.decision === "contested" && (input.comment || "").length < 5) throw new TRPCError({ code: "BAD_REQUEST", message: "Explique o que está errado (pelo menos 5 caracteres)." });
      const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
      if (m.documentHash !== input.documentHash) throw new TRPCError({ code: "CONFLICT", message: "O espelho mudou enquanto você lia (nova marcação ou correção). Confira de novo antes de confirmar." });
      const meta = requestMeta(ctx);
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const summary = JSON.stringify({ totals: m.report.totals, days: m.report.days.length });
      await database.execute(sql`INSERT INTO timesheet_acceptances (companyId, memberAccountId, month, decision, documentHash, summary, comment, ipAddress, userAgent, acceptedAt)
        VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.month}, ${input.decision}, ${m.documentHash}, ${summary}, ${input.comment || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
      void auditFromCtx(ctx, { action: input.decision === "accepted" ? "update" : "security", module: "time_tracking", entityType: "timesheet_acceptance", entityId: ctx.memberAccountId, description: `${input.decision === "accepted" ? "Funcionário confirmou" : "Funcionário contestou"} o espelho de ${input.month} (hash ${m.documentHash.slice(0, 12)}…)`, newData: { month: input.month, documentHash: m.documentHash, comment: input.comment || null } } as any);
      return { success: true as const, documentHash: m.documentHash };
    }),

  mirrorAcceptances: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ month: monthStr }))
    .query(async ({ ctx, input }) => {
      const database = await db.getDb();
      if (!database) return [];
      const members = (await database.select({ id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role, active: memberAccounts.active }).from(memberAccounts).where(eq(memberAccounts.companyId, ctx.accountId)))
        .filter((m) => m.role !== "company_admin");
      const acc = await latestAcceptances(ctx.accountId, input.month, members.map((m) => m.id));
      const out = [];
      for (const m of members) {
        const a = acc.get(m.id);
        let currentHash: string | null = null;
        if (a) { try { currentHash = (await memberMonthMirror(ctx.accountId, m.id, input.month)).documentHash; } catch { currentHash = null; } }
        if (!a && !m.active) continue;
        out.push({ memberId: m.id, name: m.name, active: m.active, acceptance: a ? { decision: a.decision, acceptedAt: a.acceptedAt, documentHash: a.documentHash, comment: a.comment, ipAddress: a.ipAddress, userAgent: a.userAgent, changedAfter: currentHash != null && currentHash !== a.documentHash } : null });
      }
      return out.sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
    }),

  // ------------------------------------------------------------------ integridade
  verifyIntegrity: companyAdminFeatureProcedure("timeTracking").mutation(async ({ ctx }) => {
    await ensurePunchLedger();
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const rows = await database.select().from(timeEvents).where(eq(timeEvents.companyId, ctx.accountId)).orderBy(asc(timeEvents.id));
    const result = verifyLedger(rows.map(toLedgerRow));
    const [stateRows]: any = await database.execute(sql`SELECT lastNsr, lastHash, initializedAt FROM rep_ledger_state WHERE companyId = ${ctx.accountId}`);
    const state = stateRows?.[0] ?? null;
    const stateMismatch = state && Number(state.lastNsr) !== result.lastNsr;
    const legacy = rows.filter((r) => r.sealedLegacy).length;
    void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "integrity_check", description: `Verificação de integridade do ponto: ${result.ok && !stateMismatch ? "OK" : `${result.problems.length} problema(s)`}` } as any);
    return {
      ok: result.ok && !stateMismatch,
      checkedAt: new Date().toISOString(),
      originals: result.originals,
      treatments: result.treatments,
      lastNsr: result.lastNsr,
      sealedLegacy: legacy,
      sealedAt: state?.initializedAt ?? null,
      problems: [
        ...(stateMismatch ? [{ id: 0, nsr: null, kind: "gap", message: `Último NSR registrado (${state.lastNsr}) difere do último encontrado (${result.lastNsr}): pode ter havido exclusão.` }] : []),
        ...result.problems,
      ].slice(0, 100),
      totalProblems: result.problems.length + (stateMismatch ? 1 : 0),
    };
  }),

  // ------------------------------------------------------------------ AFD / AEJ
  exportAfd: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ from: dateStr, to: dateStr }))
    .mutation(async ({ ctx, input }) => {
      if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual à final." });
      await ensurePunchLedger();
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const { start, end } = rangeUtc(input.from, input.to);
      const rows = (await database.select().from(timeEvents)
        .where(and(eq(timeEvents.companyId, ctx.accountId), eq(timeEvents.origin, "original"), gte(effectiveEventTime, start), lt(effectiveEventTime, end)))
        .orderBy(asc(timeEvents.nsr)))
        .filter((r) => r.nsr != null && r.recordHash)
        .filter((r) => { const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ); return d >= input.from && d <= input.to; });
      const employer = await employerOf(ctx.accountId);
      const dev = developerInfo();
      const afd = buildAfd({
        employer: { document: employer.document || "", name: employer.name },
        developer: { document: dev.document },
        inpiNumber: dev.inpiNumber, from: input.from, to: input.to, generatedAt: new Date(), timeZone: TZ,
        punches: rows.map((r) => ({ nsr: Number(r.nsr), markedAt: r.deviceTime || r.serverTime, recordedAt: r.serverTime, cpf: r.workerCpf, timeZone: r.timeZone || TZ, collector: r.collectorId || "02", offline: Boolean(r.offline), hash: r.recordHash! })),
      });
      const warnings = [
        ...(!employer.document ? ["CNPJ/CPF da empresa não cadastrado (Espelho de ponto > Dados da empresa)."] : []),
        ...(rows.some((r) => !r.workerCpf) ? [`${rows.filter((r) => !r.workerCpf).length} marcação(ões) sem CPF do funcionário (cadastre no perfil trabalhista; vale para as próximas).`] : []),
        ...(!dev.inpiNumber ? ["Sem número de registro no INPI: campo preenchido com zeros."] : []),
        "Arquivo sem assinatura digital (.p7s): depende do certificado ICP-Brasil do desenvolvedor.",
      ];
      void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "afd", description: `Gerou AFD ${input.from} a ${input.to} (${rows.length} marcações)`, newData: { from: input.from, to: input.to, count: rows.length } } as any);
      return { ...fileResponse(afd.content, afd.fileName), count: rows.length, warnings };
    }),

  exportAej: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ from: dateStr, to: dateStr }))
    .mutation(async ({ ctx, input }) => {
      if (input.from > input.to) throw new TRPCError({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual à final." });
      await ensurePunchLedger();
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const members = (await database.select({ id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role }).from(memberAccounts).where(eq(memberAccounts.companyId, ctx.accountId)))
        .filter((m) => m.role !== "company_admin");
      const ids = members.map((m) => m.id);
      const { start, end } = rangeUtc(input.from, input.to);
      const all = ids.length ? await database.select().from(timeEvents)
        .where(and(eq(timeEvents.companyId, ctx.accountId), inArray(timeEvents.memberAccountId, ids), gte(effectiveEventTime, start), lt(effectiveEventTime, end)))
        .orderBy(asc(effectiveEventTime)) : [];
      const inPeriod = all.filter((r) => { const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ); return d >= input.from && d <= input.to; });
      const replacedBy = new Map<number, (typeof all)[number]>();
      for (const r of all) if (r.replacesEventId) replacedBy.set(r.replacesEventId, r);
      const workers: AejWorker[] = [];
      const missingCpf: string[] = [];
      for (const m of members) {
        const mine = inPeriod.filter((r) => r.memberAccountId === m.id);
        if (!mine.length) continue;
        const labor = await readJson<LaborProfile>(`labor_profile:${m.id}`, ctx.accountId);
        const cpf = onlyDigits(labor?.cpf);
        if (cpf.length !== 11) missingCpf.push(m.name);
        const effective = mine.filter((r) => !replacedBy.has(r.id));
        const byDay = new Map<string, typeof effective>();
        for (const r of effective) { const d = formatD(r.deviceTime || r.serverTime, TZ); byDay.set(d, [...(byDay.get(d) || []), r]); }
        const marks: AejMark[] = [];
        for (const [, dayRows] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          for (const s of toAejSequence(dayRows.map((r) => ({ type: r.eventType, time: r.deviceTime || r.serverTime, row: r })))) {
            marks.push({ markedAt: s.time, tpMarc: s.tpMarc, seq: s.seq, fonte: s.row.origin === "original" ? "O" : "I", motivo: s.row.origin === "original" ? null : s.row.reason });
          }
        }
        for (const r of mine.filter((x) => replacedBy.has(x.id))) {
          const by = replacedBy.get(r.id)!;
          marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Substituída por ajuste aprovado por ${by.recordedByName || "administrador"}: ${by.reason || ""}` });
        }
        marks.sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime());
        const daily = Number(labor?.dailyMinutes || 0);
        workers.push({ cpf, name: m.name, marks, contract: daily > 0 ? { code: `J${daily}`, dailyMinutes: daily, pairs: [] } : null });
      }
      const employer = await employerOf(ctx.accountId);
      const dev = developerInfo();
      const aej = buildAej({ employer: { document: employer.document || "", name: employer.name }, inpiNumber: dev.inpiNumber, from: input.from, to: input.to, generatedAt: new Date(), timeZone: TZ,
        ptrp: { version: dev.version, developerDocument: dev.document, developerName: dev.name, developerEmail: dev.email }, workers });
      const warnings = [
        ...(!employer.document ? ["CNPJ/CPF da empresa não cadastrado."] : []),
        ...(missingCpf.length ? [`Sem CPF no perfil trabalhista: ${missingCpf.slice(0, 10).join(", ")}${missingCpf.length > 10 ? "…" : ""}.`] : []),
        ...(workers.some((w) => !w.contract) ? ["Há funcionários sem jornada contratual configurada (registro 04 obrigatório na primeira entrada)."] : []),
        "Horário contratual sai só com a duração (os horários de entrada/saída previstos ainda não são cadastrados no sistema).",
        "Arquivo sem assinatura digital (.p7s): depende do certificado ICP-Brasil.",
      ];
      void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "aej", description: `Gerou AEJ ${input.from} a ${input.to} (${workers.length} funcionário(s))`, newData: { from: input.from, to: input.to } } as any);
      return { ...fileResponse(aej.content, aej.fileName), count: workers.length, warnings };
    }),
});
