/**
 * Arquivamento histórico de espelhos de ponto.
 * Gera PDF mensal, envia ao R2 e grava metadados + hash no TiDB.
 * Não altera time_events nem regras de jornada. Processamento idempotente.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, eq, gte, lt, inArray, sql } from "drizzle-orm";
import { companyAdminFeatureProcedure, router } from "../_core/trpc";
import * as db from "../db";
import { companies, memberAccounts, promoterProfiles, timeEvents } from "../../drizzle/schema";
import { buildMirror, type LaborProfile, type MirrorEvent, MIRROR_HEADERS, mirrorRows, totalsLines, fmtDate } from "../../shared/timesheetMirror";
import { storagePut, storageGetSignedUrl } from "../storage";
import { ensureAdjustmentsTable } from "./timesheetMirror";
import { loadApprovedDayExcuses } from "./correctionExtras";
import { loadMemberVacations, loadMirrorEventRows, loadMirrorOptions } from "./mirrorData";
import { readTimeAlert } from "../../shared/punchTime";

const TZ = "America/Sao_Paulo";
const GRACE_DAYS = 5;

let ready: Promise<void> | null = null;

export async function ensureTimesheetArchivesTable(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database) return;
    await database.execute(sql`CREATE TABLE IF NOT EXISTS timesheet_archives (
      id int AUTO_INCREMENT PRIMARY KEY,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      year smallint NOT NULL,
      month tinyint NOT NULL,
      version int NOT NULL DEFAULT 1,
      fileKey varchar(512) NULL,
      contentHash varchar(64) NULL,
      mimeType varchar(100) NULL DEFAULT 'application/pdf',
      sizeBytes int NULL,
      status enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
      generatedAt timestamp NULL,
      notes text NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY timesheet_archives_unique (companyId, memberAccountId, year, month, version),
      KEY timesheet_archives_company_idx (companyId, year, month)
    )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

async function readJson<T>(key: string, companyId: number): Promise<T | null> {
  const raw = await db.getSetting(key, companyId, "");
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function companyMembers(companyId: number, memberIds?: number[]) {
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const where = [eq(memberAccounts.companyId, companyId)];
  if (memberIds?.length) where.push(inArray(memberAccounts.id, memberIds));
  const rows = await database.select({
    id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role,
    active: memberAccounts.active, employeeCode: promoterProfiles.employeeCode,
  }).from(memberAccounts).leftJoin(promoterProfiles, eq(promoterProfiles.memberAccountId, memberAccounts.id)).where(and(...where));
  return rows.filter((r) => r.role !== "company_admin");
}

async function buildPdfBuffer(opts: {
  companyName: string; memberName: string; employeeCode: string | null;
  from: string; to: string; report: ReturnType<typeof buildMirror>;
}): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 10;
  let y = M;
  doc.setFontSize(16).setFont("helvetica", "bold").text("Espelho de Ponto (arquivo histórico)", M, y + 5);
  y += 10;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Empresa: ${opts.companyName}`, M, y);
  doc.text(`Funcionário: ${opts.memberName}${opts.employeeCode ? ` (${opts.employeeCode})` : ""}`, 150, y);
  y += 5;
  doc.text(`Período: ${fmtDate(opts.from)} a ${fmtDate(opts.to)}`, M, y);
  doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR", { timeZone: TZ })}`, 150, y);
  y += 7;
  doc.setFontSize(7).setFont("helvetica", "bold").setFillColor(226, 232, 240);
  const widths = [18, 9, 22, 22, 22, 22, 16, 14, 14, 14, 14, 16];
  const obsW = W - 2 * M - widths.reduce((a, b) => a + b, 0);
  const cols = [...widths, obsW];
  doc.rect(M, y, W - 2 * M, 6, "F");
  let x = M;
  MIRROR_HEADERS.forEach((h, i) => { doc.text(h, x + 1, y + 4, { maxWidth: cols[i] - 2 }); x += cols[i]; });
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(6.5);
  for (const row of mirrorRows(opts.report)) {
    if (y > H - 15) { doc.addPage("a4", "landscape"); y = M; }
    const lines = row.map((c, i) => doc.splitTextToSize(String(c), cols[i] - 2) as string[]);
    const h = Math.max(...lines.map((l) => l.length), 1) * 3 + 1.5;
    let cx = M;
    doc.setDrawColor(200);
    lines.forEach((l, i) => { doc.rect(cx, y, cols[i], h); doc.text(l, cx + 1, y + 2.8); cx += cols[i]; });
    y += h;
  }
  y += 4;
  doc.setFontSize(8).setFont("helvetica", "bold").text("Totais", M, y); y += 4;
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  for (const [k, v] of totalsLines(opts.report.totals)) {
    if (y > H - 12) { doc.addPage("a4", "landscape"); y = M; }
    doc.text(`${k}: ${v}`, M, y); y += 3.8;
  }
  y += 3;
  doc.setFontSize(7).setTextColor(80);
  doc.text("Documento histórico gerado automaticamente. Não substitui as marcações originais registradas no sistema.", M, y);
  doc.setTextColor(0);
  return Buffer.from(doc.output("arraybuffer"));
}

type ArchiveResult = { companyId: number; memberId: number; year: number; month: number; version: number; skipped: boolean; reason?: string };

export async function archiveClosedMonth(companyId: number, year: number, month: number, memberIds?: number[]): Promise<ArchiveResult[]> {
  await ensureTimesheetArchivesTable();
  await ensureAdjustmentsTable();
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const members = await companyMembers(companyId, memberIds);
  const company = (await database.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).limit(1))[0];
  const ids = members.map((m) => m.id);
  const eventRows = await loadMirrorEventRows(companyId, ids, from, to);
  const byMember = new Map<number, typeof eventRows>();
  for (const r of eventRows) byMember.set(r.memberAccountId, [...(byMember.get(r.memberAccountId) || []), r]);

  const excusesByMember = await loadApprovedDayExcuses(companyId, ids, from, to);
  const vacationsByMember = await loadMemberVacations(companyId, ids, from, to);
  const options = await loadMirrorOptions(companyId);
  const results: ArchiveResult[] = [];
  for (const m of members) {
    try {
      const labor = await readJson<LaborProfile>(`labor_profile:${m.id}`, companyId);
      const events: MirrorEvent[] = (byMember.get(m.id) || []).map((r) => ({
        id: r.id, type: r.eventType, time: (r.deviceTime || r.serverTime).toISOString(),
        receivedAt: r.serverTime.toISOString(), synced: r.synced, notes: r.notes, timeAlert: readTimeAlert(r.notes),
      }));
      const report = buildMirror({ events, from, to, timeZone: TZ, labor, excuses: excusesByMember.get(m.id) || [], vacations: vacationsByMember.get(m.id) || [], options });
      const buf = await buildPdfBuffer({
        companyName: company?.name ?? "", memberName: m.name, employeeCode: m.employeeCode ?? null, from, to, report,
      });
      const hash = createHash("sha256").update(buf).digest("hex");

      const existing: any[] = ((await database.execute(sql`SELECT id, version, contentHash FROM timesheet_archives WHERE companyId = ${companyId} AND memberAccountId = ${m.id} AND year = ${year} AND month = ${month} ORDER BY version DESC LIMIT 1`)) as any)[0] ?? [];
      const last = existing[0];
      if (last && last.contentHash === hash) {
        results.push({ companyId, memberId: m.id, year, month, version: last.version, skipped: true, reason: "hash igual" });
        continue;
      }
      const version = last ? Number(last.version) + 1 : 1;
      const keyBase = `archives/${companyId}/${year}/${String(month).padStart(2, "0")}/${m.id}/v${version}-espelho.pdf`;
      const uploaded = await storagePut(keyBase, buf, "application/pdf");
      await database.execute(sql`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, fileKey, contentHash, mimeType, sizeBytes, status, generatedAt)
        VALUES (${companyId}, ${m.id}, ${year}, ${month}, ${version}, ${uploaded.key}, ${hash}, 'application/pdf', ${buf.length}, 'ready', NOW())`);
      results.push({ companyId, memberId: m.id, year, month, version, skipped: false });
    } catch (err: any) {
      console.warn(`[archive] company=${companyId} member=${m.id} ${year}-${month}`, err);
      try {
        await database.execute(sql`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, status, notes, generatedAt)
          VALUES (${companyId}, ${m.id}, ${year}, ${month}, 1, 'failed', ${String(err?.message || err).slice(0, 500)}, NOW())
          ON DUPLICATE KEY UPDATE status = 'failed', notes = VALUES(notes), generatedAt = NOW()`);
      } catch { /* ignore */ }
      results.push({ companyId, memberId: m.id, year, month, version: 0, skipped: false, reason: String(err?.message || err) });
    }
  }
  return results;
}

function eligibleMonths(now = new Date()): Array<{ year: number; month: number }> {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const out: Array<{ year: number; month: number }> = [];
  if (d >= GRACE_DAYS) {
    out.push(m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 });
  }
  out.push(m <= 2 ? { year: y - 1, month: m === 1 ? 11 : 12 } : { year: y, month: m - 2 });
  return out;
}

export async function runTimesheetArchiveJob(opts?: { companyId?: number; limitCompanies?: number }): Promise<{ processed: number; results: ArchiveResult[] }> {
  await ensureTimesheetArchivesTable();
  const database = await db.getDb();
  if (!database) return { processed: 0, results: [] };
  const months = eligibleMonths();
  const companiesRows = opts?.companyId
    ? await database.select({ id: companies.id }).from(companies).where(eq(companies.id, opts.companyId)).limit(1)
    : await database.select({ id: companies.id }).from(companies).where(eq(companies.active, true)).limit(opts?.limitCompanies ?? 20);
  const all: ArchiveResult[] = [];
  for (const c of companiesRows) {
    for (const { year, month } of months) {
      const r = await archiveClosedMonth(c.id, year, month);
      all.push(...r);
    }
  }
  return { processed: companiesRows.length, results: all };
}

export const timesheetArchiveRouter = router({
  list: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({
      memberId: z.number().int().positive().optional(),
      year: z.number().int().min(2020).max(2100).optional(),
      month: z.number().int().min(1).max(12).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await ensureTimesheetArchivesTable();
      const database = await db.getDb();
      if (!database) return [];
      const conds = [sql`a.companyId = ${ctx.accountId}`];
      if (input?.memberId) conds.push(sql`a.memberAccountId = ${input.memberId}`);
      if (input?.year) conds.push(sql`a.year = ${input.year}`);
      if (input?.month) conds.push(sql`a.month = ${input.month}`);
      const rows: any[] = ((await database.execute(sql`SELECT a.*, m.userName AS memberName
        FROM timesheet_archives a
        LEFT JOIN member_accounts m ON m.id = a.memberAccountId AND m.companyId = a.companyId
        WHERE ${sql.join(conds, sql` AND `)}
        ORDER BY a.year DESC, a.month DESC, a.memberAccountId, a.version DESC
        LIMIT 500`)) as any)[0] ?? [];
      return rows;
    }),

  downloadUrl: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await ensureTimesheetArchivesTable();
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
      const rows: any[] = ((await database.execute(sql`SELECT fileKey, status FROM timesheet_archives WHERE id = ${input.id} AND companyId = ${ctx.accountId} LIMIT 1`)) as any)[0] ?? [];
      const row = rows[0];
      if (!row || row.status !== "ready" || !row.fileKey) throw new TRPCError({ code: "NOT_FOUND", message: "Arquivo não encontrado ou indisponível." });
      const url = await storageGetSignedUrl(row.fileKey);
      return { url };
    }),

  archiveNow: companyAdminFeatureProcedure("timeTracking")
    .input(z.object({ year: z.number().int().min(2020).max(2100), month: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1;
      if (input.year > curY || (input.year === curY && input.month >= curM)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível arquivar o mês corrente ou futuro." });
      }
      const results = await archiveClosedMonth(ctx.accountId, input.year, input.month);
      return { success: true as const, results };
    }),
});
