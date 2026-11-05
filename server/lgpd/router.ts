/**
 * LGPD: aviso ao trabalhador (art. 9º) com registro de ciência e direitos do titular (art. 18):
 * pedido pelo app, exportação completa (ZIP com JSON + resumo em PDF) e anonimização preservando o ponto (art. 16, I).
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
import { companyAdminProcedure, companyBillingProcedure, router } from "../_core/trpc";
import * as db from "../db";
import {
  checklistResponses, evidences, memberAccounts, memberSessions, promoterProfiles, storePhotos, timeCorrectionRequests, timeEvents, vacationSchedules, visitPhotos, visits,
} from "../../drizzle/schema";
import { auditFromCtx, requestMeta } from "../audit";
import { PRIVACY_NOTICE_VERSION, privacyNoticeText } from "../../shared/privacyNotice";
import { sha256 } from "../ponto/repFormat";

let ready: Promise<void> | null = null;
export async function ensureLgpdTables(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS privacy_acknowledgements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      noticeVersion VARCHAR(32) NOT NULL,
      textHash CHAR(64) NOT NULL,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      acknowledgedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX privacy_ack_member_idx (companyId, memberAccountId, noticeVersion)
    )`));
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS lgpd_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      kind VARCHAR(24) NOT NULL,
      message TEXT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolvedAt TIMESTAMP NULL,
      resolvedBy VARCHAR(255) NULL,
      resolution TEXT NULL,
      INDEX lgpd_requests_company_idx (companyId, status)
    )`));
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const noticeHash = () => sha256(privacyNoticeText());
const KIND_LABEL: Record<string, string> = { export: "Cópia dos meus dados", correction: "Correção de dados", anonymize: "Eliminação/anonimização", info: "Dúvida sobre meus dados" };

async function rows(query: SQL): Promise<any[]> {
  const database = await db.getDb();
  if (!database) return [];
  const [r]: any = await database.execute(query);
  return r || [];
}

/** Junta tudo o que o sistema guarda sobre o titular (sem hash de senha nem tokens). */
export async function collectSubjectData(companyId: number, memberId: number) {
  await ensureLgpdTables();
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [account] = await database.select({ id: memberAccounts.id, nome: memberAccounts.userName, email: memberAccounts.email, telefone: memberAccounts.phone, perfil: memberAccounts.role, ativo: memberAccounts.active, criadoEm: memberAccounts.createdAt, atualizadoEm: memberAccounts.updatedAt })
    .from(memberAccounts).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.companyId, companyId))).limit(1);
  if (!account) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado nesta empresa." });
  const laborRaw = await db.getSetting(`labor_profile:${memberId}`, companyId, "");
  const myVisits = await database.select().from(visits).where(and(eq(visits.companyId, companyId), eq(visits.promoterId, memberId)));
  const visitIds = myVisits.map((v) => v.id);
  return {
    geradoEm: new Date().toISOString(),
    observacao: "Exportação dos dados pessoais do titular (LGPD art. 18, II e V). Senhas e tokens de sessão não são exportados.",
    conta: account,
    perfilPromotor: (await database.select().from(promoterProfiles).where(eq(promoterProfiles.memberAccountId, memberId)))[0] ?? null,
    perfilTrabalhista: laborRaw ? JSON.parse(laborRaw) : null,
    marcacoesDePonto: await database.select().from(timeEvents).where(and(eq(timeEvents.companyId, companyId), eq(timeEvents.memberAccountId, memberId))),
    pedidosDeCorrecao: await database.select().from(timeCorrectionRequests).where(and(eq(timeCorrectionRequests.companyId, companyId), eq(timeCorrectionRequests.memberAccountId, memberId))),
    aceitesDoEspelho: await rows(sql`SELECT month, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`).catch(() => []),
    cienciasDoAviso: await rows(sql`SELECT noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    pedidosLgpd: await rows(sql`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    ferias: await database.select().from(vacationSchedules).where(and(eq(vacationSchedules.companyId, companyId), eq(vacationSchedules.memberAccountId, memberId))),
    visitas: myVisits,
    fotosDeVisita: visitIds.length ? await database.select().from(visitPhotos).where(and(eq(visitPhotos.companyId, companyId), inArray(visitPhotos.visitId, visitIds))) : [],
    fotosDeLoja: await database.select().from(storePhotos).where(and(eq(storePhotos.companyId, companyId), eq(storePhotos.promoterId, memberId))),
    evidencias: await database.select().from(evidences).where(and(eq(evidences.companyId, companyId), eq(evidences.promoterId, memberId))),
    checklists: await database.select().from(checklistResponses).where(and(eq(checklistResponses.companyId, companyId), eq(checklistResponses.promoterId, memberId))),
    registrosDeAuditoria: await rows(sql`SELECT action, module, entityType, description, ipAddress, userAgent, createdAt FROM audit_logs WHERE companyId = ${companyId} AND userId = ${memberId} ORDER BY id DESC LIMIT 5000`).catch(() => []),
  };
}

export function summarizeSubjectData(data: Awaited<ReturnType<typeof collectSubjectData>>) {
  const count = (v: unknown) => (Array.isArray(v) ? v.length : v ? 1 : 0);
  return [
    ["Conta de acesso (nome, e-mail, telefone)", count(data.conta), "Execução do contrato"],
    ["Perfil trabalhista (CPF, cargo, admissão, horário)", count(data.perfilTrabalhista), "Obrigação legal"],
    ["Marcações de ponto (hora, fuso, GPS, aparelho)", count(data.marcacoesDePonto), "Obrigação legal — guarda obrigatória"],
    ["Pedidos de correção de ponto", count(data.pedidosDeCorrecao), "Obrigação legal"],
    ["Aceites do espelho de ponto", count(data.aceitesDoEspelho), "Obrigação legal"],
    ["Ciências do aviso de privacidade", count(data.cienciasDoAviso), "Obrigação legal (prova de transparência)"],
    ["Férias", count(data.ferias), "Obrigação legal"],
    ["Visitas (check-in/out com GPS)", count(data.visitas), "Execução do contrato"],
    ["Fotos de visita e de loja (metadados)", count(data.fotosDeVisita) + count(data.fotosDeLoja), "Execução do contrato — apagadas em 60 dias"],
    ["Evidências e checklists", count(data.evidencias) + count(data.checklists), "Execução do contrato"],
    ["Registros de auditoria (ações do titular)", count(data.registrosDeAuditoria), "Legítimo interesse / defesa em processo"],
  ] as Array<[string, number, string]>;
}

async function summaryPdf(data: Awaited<ReturnType<typeof collectSubjectData>>, companyName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const line = (t: string, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t, 180)) { if (y > 280) { doc.addPage(); y = 18; } doc.text(l, 15, y); y += size * 0.5; }
    y += 1.5;
  };
  line("Relatório de dados pessoais do titular (LGPD art. 18)", 14, true);
  line(`Empresa (controladora): ${companyName}`);
  line(`Titular: ${data.conta.nome} — ${data.conta.email}`);
  line(`Gerado em: ${new Date(data.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (horário de Brasília)`);
  y += 3;
  line("Categorias de dados encontradas", 12, true);
  for (const [label, n, basis] of summarizeSubjectData(data)) line(`• ${label}: ${n} registro(s). Base legal: ${basis}.`);
  y += 3;
  line("O arquivo dados.json, no mesmo pacote, contém o conteúdo completo em formato legível por máquina (portabilidade).", 9);
  line("As marcações de ponto não podem ser apagadas: a lei exige guardá-las (CLT art. 74; Portaria MTP 671; prescrição de 5 anos — CF art. 7º, XXIX).", 9);
  return Buffer.from(doc.output("arraybuffer"));
}

export async function buildSubjectExportZip(companyId: number, memberId: number) {
  const data = await collectSubjectData(companyId, memberId);
  const database = await db.getDb();
  const [company]: any = database ? await rows(sql`SELECT name FROM companies WHERE id = ${companyId}`) : [];
  const pdf = await summaryPdf(data, company?.name || "");
  const json = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2);
  const zip = zipSync({
    "LEIA-ME.txt": strToU8("Pacote de dados pessoais (LGPD art. 18).\r\n- resumo.pdf: resumo legível.\r\n- dados.json: todos os dados.\r\nHorários em UTC (ISO 8601).\r\n"),
    "dados.json": strToU8(json),
    "resumo.pdf": new Uint8Array(pdf),
  });
  const safe = data.conta.nome.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `titular-${memberId}`;
  return { fileName: `dados-lgpd-${safe}-${new Date().toISOString().slice(0, 10)}.zip`, buffer: Buffer.from(zip), summary: summarizeSubjectData(data) };
}

/** O que a anonimização faz (exibido ao administrador antes de confirmar). */
export const ANONYMIZE_PLAN = {
  apaga: ["Nome, e-mail e telefone da conta (substituídos por pseudônimo)", "Senha, código de recuperação e sessões (a conta fica inutilizável)", "Código de funcionário", "Fotos de visita e de loja (apagadas na próxima limpeza automática)", "Coordenadas GPS de visitas e evidências", "Observações de visitas e legendas de evidências"],
  mantem: ["Marcações de ponto completas (hora, GPS, NSR, hash) — guarda obrigatória por lei e protegidas contra alteração", "Perfil trabalhista (CPF, cargo, admissão, horário) — necessário para AFD/AEJ e espelho durante o prazo legal", "Pedidos de correção, aceites do espelho, férias e auditoria — prova trabalhista"],
};

export async function anonymizeSubject(companyId: number, memberId: number) {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const [m] = await database.select({ id: memberAccounts.id, role: memberAccounts.role }).from(memberAccounts).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.companyId, companyId))).limit(1);
  if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado nesta empresa." });
  if (m.role === "company_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível anonimizar um administrador da empresa." });
  const pseudonym = `Titular anonimizado #${memberId}`;
  await database.update(memberAccounts).set({
    userName: pseudonym, email: `anonimizado+${companyId}-${memberId}@invalid.gondup`, phone: null, active: false,
    passwordHash: `!anonimizado:${randomBytes(24).toString("hex")}`, recoveryCodeHash: null,
  }).where(and(eq(memberAccounts.id, memberId), eq(memberAccounts.companyId, companyId)));
  await database.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberId));
  await database.update(promoterProfiles).set({ employeeCode: null }).where(eq(promoterProfiles.memberAccountId, memberId));
  const now = new Date();
  await database.update(storePhotos).set({ expiresAt: now }).where(and(eq(storePhotos.companyId, companyId), eq(storePhotos.promoterId, memberId)));
  const myVisits = await database.select({ id: visits.id }).from(visits).where(and(eq(visits.companyId, companyId), eq(visits.promoterId, memberId)));
  if (myVisits.length) {
    const ids = myVisits.map((v) => v.id);
    await database.update(visitPhotos).set({ expiresAt: now }).where(and(eq(visitPhotos.companyId, companyId), inArray(visitPhotos.visitId, ids)));
    await database.update(visits).set({ startLatitude: null, startLongitude: null, endLatitude: null, endLongitude: null, notes: null } as any).where(and(eq(visits.companyId, companyId), inArray(visits.id, ids)));
  }
  await database.update(evidences).set({ latitude: null, longitude: null, caption: null }).where(and(eq(evidences.companyId, companyId), eq(evidences.promoterId, memberId)));
  return { pseudonym };
}

const kindSchema = z.enum(["export", "correction", "anonymize", "info"]);

export const lgpdRouter = router({
  /** Aviso ao trabalhador: precisa mostrar? (só para promotores) */
  noticeStatus: companyBillingProcedure.query(async ({ ctx }) => {
    const base = { version: PRIVACY_NOTICE_VERSION, required: false, acknowledgedAt: null as string | null };
    if (ctx.user?.role !== "promoter" || !ctx.memberAccountId || ctx.actingAsPlatform) return base;
    await ensureLgpdTables();
    const r = await rows(sql`SELECT acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} AND noticeVersion = ${PRIVACY_NOTICE_VERSION} ORDER BY id DESC LIMIT 1`);
    return { ...base, required: !r.length, acknowledgedAt: r[0]?.acknowledgedAt ?? null };
  }),

  acknowledgeNotice: companyBillingProcedure.input(z.object({ version: z.string().max(32) })).mutation(async ({ ctx, input }) => {
    if (!ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
    if (input.version !== PRIVACY_NOTICE_VERSION) throw new TRPCError({ code: "CONFLICT", message: "O aviso foi atualizado. Recarregue a página para ler a versão nova." });
    await ensureLgpdTables();
    const meta = requestMeta(ctx);
    const hash = noticeHash();
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    await database.execute(sql`INSERT INTO privacy_acknowledgements (companyId, memberAccountId, noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt)
      VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${PRIVACY_NOTICE_VERSION}, ${hash}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
    void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "privacy_notice", entityId: ctx.memberAccountId, description: `Ciência do aviso de privacidade versão ${PRIVACY_NOTICE_VERSION} (hash ${hash.slice(0, 12)}…)`, newData: { version: PRIVACY_NOTICE_VERSION, textHash: hash } } as any);
    return { success: true as const };
  }),

  /** Titular: abrir pedido (art. 18). */
  createRequest: companyBillingProcedure.input(z.object({ kind: kindSchema, message: z.string().trim().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    if (!ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
    await ensureLgpdTables();
    const meta = requestMeta(ctx);
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    await database.execute(sql`INSERT INTO lgpd_requests (companyId, memberAccountId, kind, message, ipAddress, userAgent) VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.kind}, ${input.message || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null})`);
    void auditFromCtx(ctx, { action: "create", module: "lgpd", entityType: "lgpd_request", entityId: ctx.memberAccountId, description: `Pedido do titular (LGPD): ${KIND_LABEL[input.kind]}` } as any);
    return { success: true as const };
  }),

  myRequests: companyBillingProcedure.query(async ({ ctx }) => {
    if (!ctx.memberAccountId) return [];
    await ensureLgpdTables();
    return rows(sql`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} ORDER BY id DESC LIMIT 50`);
  }),

  /** Titular baixa a própria cópia (mesmo pacote do administrador). */
  exportMine: companyBillingProcedure.mutation(async ({ ctx }) => {
    if (!ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário de empresa não identificado." });
    const z = await buildSubjectExportZip(ctx.accountId!, ctx.memberAccountId);
    void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: ctx.memberAccountId, description: "Titular baixou cópia dos próprios dados (LGPD art. 18)" } as any);
    return { fileName: z.fileName, base64: z.buffer.toString("base64") };
  }),

  // ------------------------------------------------------------- administrador
  requests: companyAdminProcedure.input(z.object({ status: z.enum(["open", "all"]).default("open") }).optional()).query(async ({ ctx, input }) => {
    await ensureLgpdTables();
    const companyId = Number(ctx.accountId);
    return rows(sql`SELECT r.id, r.memberAccountId, m.userName AS name, r.kind, r.message, r.status, r.createdAt, r.resolvedAt, r.resolvedBy, r.resolution
      FROM lgpd_requests r LEFT JOIN member_accounts m ON m.id = r.memberAccountId WHERE r.companyId = ${companyId} ${input?.status === "all" ? sql`` : sql`AND r.status = 'open'`} ORDER BY r.id DESC LIMIT 200`);
  }),

  acknowledgements: companyAdminProcedure.query(async ({ ctx }) => {
    await ensureLgpdTables();
    return rows(sql`SELECT m.id AS memberId, m.userName AS name, m.active, MAX(CASE WHEN a.noticeVersion = ${PRIVACY_NOTICE_VERSION} THEN a.acknowledgedAt END) AS acknowledgedAt
      FROM member_accounts m LEFT JOIN privacy_acknowledgements a ON a.memberAccountId = m.id AND a.companyId = m.companyId
      WHERE m.companyId = ${Number(ctx.accountId)} AND m.role = 'promoter' GROUP BY m.id, m.userName, m.active ORDER BY m.userName`);
  }),

  plan: companyAdminProcedure.query(() => ANONYMIZE_PLAN),

  exportMember: companyAdminProcedure.input(z.object({ memberId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const companyId = Number(ctx.accountId);
    const z = await buildSubjectExportZip(companyId, input.memberId);
    void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: input.memberId, description: "Exportou todos os dados pessoais de um titular (LGPD art. 18)" } as any);
    return { fileName: z.fileName, base64: z.buffer.toString("base64"), summary: z.summary };
  }),

  anonymizeMember: companyAdminProcedure.input(z.object({ memberId: z.number().int().positive(), confirm: z.literal("ANONIMIZAR"), requestId: z.number().int().positive().optional(), reason: z.string().trim().min(5).max(500) })).mutation(async ({ ctx, input }) => {
    const companyId = Number(ctx.accountId);
    await ensureLgpdTables();
    const { pseudonym } = await anonymizeSubject(companyId, input.memberId);
    if (input.requestId) {
      const database = await db.getDb();
      await database?.execute(sql`UPDATE lgpd_requests SET status = 'done', resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${`Anonimizado: ${input.reason}`} WHERE id = ${input.requestId} AND companyId = ${companyId}`);
    }
    void auditFromCtx(ctx, { action: "delete", module: "lgpd", entityType: "subject_anonymization", entityId: input.memberId, entityLabel: pseudonym, description: `Anonimizou dados pessoais do titular #${input.memberId} (ponto preservado por obrigação legal). Motivo: ${input.reason}`, newData: { plan: ANONYMIZE_PLAN, requestId: input.requestId ?? null } } as any);
    return { success: true as const, pseudonym };
  }),

  resolveRequest: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["done", "rejected"]), resolution: z.string().trim().min(3).max(2000) })).mutation(async ({ ctx, input }) => {
    await ensureLgpdTables();
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    await database.execute(sql`UPDATE lgpd_requests SET status = ${input.status}, resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${input.resolution} WHERE id = ${input.id} AND companyId = ${Number(ctx.accountId)}`);
    void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "lgpd_request", entityId: input.id, description: `Pedido LGPD #${input.id} ${input.status === "done" ? "atendido" : "recusado"}: ${input.resolution}` } as any);
    return { success: true as const };
  }),
});
