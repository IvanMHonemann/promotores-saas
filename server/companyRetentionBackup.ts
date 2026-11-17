/**
 * Cópia final de uma empresa antes da exclusão permanente.
 * Gera um ZIP (AFD, AEJ se possível, espelhos, dados da empresa e dos funcionários) e grava no R2
 * sob o prefixo de retenção. Se o envio falhar, a exclusão não deve seguir.
 */
import { zipSync, strToU8 } from "fflate";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import * as db from "./db";
import { memberAccounts, promoterProfiles, timeEvents } from "../drizzle/schema";
import { getLegalSnapshotForCompany } from "./companyRegistry";
import { buildAej, buildAfd, formatD, onlyDigits, toAejSequence, type AejMark, type AejWorker } from "./ponto/repFormat";
import { developerInfo } from "./ponto/router";
import { activeDisregards, DEFAULT_TZ, ensurePunchLedger } from "./ponto/ledger";
import { buildMirror, todayInTimeZone, type LaborProfile, type MirrorEvent } from "../shared/timesheetMirror";
import { loadApprovedDayExcuses } from "./modules/correctionExtras";
import { loadDayTreatments } from "./modules/dayTreatments";
import { effectiveEventTime, loadAdjustmentsByEvent, loadMemberVacations, loadMirrorEventRows, loadMirrorOptions, toMirrorEvents } from "./modules/mirrorData";
import { buildMirrorPdfBuffer } from "./modules/timesheetArchive";
import { retentionBackupKey, stripSensitiveFields } from "../shared/companyPurge";
import { storagePutExact } from "./storage";

const TZ = DEFAULT_TZ;

async function readJson<T>(key: string, companyId: number): Promise<T | null> {
  const raw = await db.getSetting(key, companyId, "");
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}

async function employerOf(companyId: number) {
  const snap = await getLegalSnapshotForCompany(companyId);
  const document = onlyDigits(snap.legal.document) || null;
  return { name: (snap.legal.legalName || snap.name || "").trim(), document, workplace: (snap.legal.establishment || snap.legal.address || "").trim() || null, snapshot: snap };
}

function isoStamp(now: Date) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}

function safeName(value: string, fallback: string) {
  return value.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || fallback;
}

async function dumpScopedTables(companyId: number): Promise<{ tables: Record<string, unknown[]>; warnings: string[] }> {
  const warnings: string[] = [];
  const tables: Record<string, unknown[]> = {};
  const pool = await db.getPool();
  if (!pool) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const conn = await pool.getConnection();
  try {
    const [cols]: any = await conn.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`,
    );
    const seen = new Set<string>();
    for (const { t, c } of cols as Array<{ t: string; c: string }>) {
      if (!t || !c || !/^[A-Za-z0-9_]+$/.test(t) || !/^[A-Za-z0-9_]+$/.test(c)) continue;
      if (t === "member_sessions") continue;
      const key = `${t}.${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const [rows]: any = await conn.query(`SELECT * FROM \`${t}\` WHERE \`${c}\` = ?`, [companyId]);
        const cleaned = (rows as any[]).map((r) => stripSensitiveFields(r));
        tables[t] = (tables[t] || []).concat(cleaned);
      } catch (e) {
        warnings.push(`Não foi possível incluir a tabela ${t}: ${e instanceof Error ? e.message : "erro"}.`);
      }
    }
    const [companyRows]: any = await conn.query("SELECT * FROM companies WHERE id = ?", [companyId]);
    tables.companies = (companyRows as any[]).map((r) => stripSensitiveFields(r));
  } finally {
    conn.release();
  }
  return { tables, warnings };
}

async function dateRangeForCompany(companyId: number): Promise<{ from: string; to: string } | null> {
  const database = await db.getDb();
  if (!database) return null;
  const rows = await database.select({
    serverTime: timeEvents.serverTime,
    deviceTime: timeEvents.deviceTime,
    timeZone: timeEvents.timeZone,
  }).from(timeEvents).where(eq(timeEvents.companyId, companyId)).orderBy(asc(effectiveEventTime)).limit(500000);
  if (!rows.length) return null;
  let from = "9999-99-99";
  let to = "0000-00-00";
  for (const r of rows) {
    const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ);
    if (d < from) from = d;
    if (d > to) to = d;
  }
  if (from > to) return null;
  return { from, to };
}

async function buildAfdFile(companyId: number, from: string, to: string, employer: { document: string | null; name: string }) {
  const database = await db.getDb();
  if (!database) return null;
  await ensurePunchLedger();
  const rows = (await database.select().from(timeEvents)
    .where(and(eq(timeEvents.companyId, companyId), eq(timeEvents.origin, "original")))
    .orderBy(asc(timeEvents.nsr)))
    .filter((r) => r.nsr != null && r.recordHash)
    .filter((r) => {
      const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ);
      return d >= from && d <= to;
    });
  const dev = developerInfo();
  return buildAfd({
    employer: { document: employer.document || "", name: employer.name },
    developer: { document: dev.document },
    inpiNumber: dev.inpiNumber, from, to, generatedAt: new Date(), timeZone: TZ,
    punches: rows.map((r) => ({
      nsr: Number(r.nsr), markedAt: r.deviceTime || r.serverTime, recordedAt: r.serverTime,
      cpf: r.workerCpf, timeZone: r.timeZone || TZ, collector: r.collectorId || "02",
      offline: Boolean(r.offline), hash: r.recordHash!,
    })),
  });
}

async function buildAejFile(companyId: number, from: string, to: string, employer: { document: string | null; name: string }) {
  const database = await db.getDb();
  if (!database) return null;
  const members = (await database.select({ id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role }).from(memberAccounts).where(eq(memberAccounts.companyId, companyId)))
    .filter((m) => m.role !== "company_admin");
  const ids = members.map((m) => m.id);
  const all = ids.length ? await database.select().from(timeEvents).where(and(eq(timeEvents.companyId, companyId), inArray(timeEvents.memberAccountId, ids))).orderBy(asc(effectiveEventTime)) : [];
  const inPeriod = all.filter((r) => { const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ); return d >= from && d <= to; });
  const replacedBy = new Map<number, (typeof all)[number]>();
  for (const r of all) if (r.replacesEventId) replacedBy.set(r.replacesEventId, r);
  const disregarded = await activeDisregards(companyId, inPeriod.map((r) => r.id));
  const workers: AejWorker[] = [];
  for (const m of members) {
    const mine = inPeriod.filter((r) => r.memberAccountId === m.id);
    if (!mine.length) continue;
    const labor = await readJson<LaborProfile>(`labor_profile:${m.id}`, companyId);
    const cpf = onlyDigits(labor?.cpf);
    const effective = mine.filter((r) => !replacedBy.has(r.id) && !disregarded.has(r.id));
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
    for (const r of mine.filter((x) => !replacedBy.has(x.id) && disregarded.has(x.id))) {
      const d = disregarded.get(r.id)!;
      marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Desconsiderada por ${d.decidedByName || "administrador"}: ${d.reason}` });
    }
    marks.sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime());
    const sched = (labor?.schedule || []).filter((p) => Array.isArray(p) && p.length === 2);
    const schedMinutes = sched.reduce((t, [a, b]) => {
      const [ah, am] = a.split(":").map(Number);
      const [bh, bm] = b.split(":").map(Number);
      return t + ((bh * 60 + bm - ah * 60 - am + 1440) % 1440);
    }, 0);
    const daily = Number(labor?.dailyMinutes || 0) || schedMinutes;
    const pairs = sched.map(([a, b]) => [a.replace(":", ""), b.replace(":", "")] as [string, string]);
    workers.push({ cpf, name: m.name, marks, contract: daily > 0 ? { code: `J${daily}${pairs.length ? `-${pairs.flat().join("")}` : ""}`, dailyMinutes: daily, pairs } : null });
  }
  const dev = developerInfo();
  return buildAej({
    employer: { document: employer.document || "", name: employer.name },
    inpiNumber: dev.inpiNumber, from, to, generatedAt: new Date(), timeZone: TZ,
    ptrp: { version: dev.version, developerDocument: dev.document, developerName: dev.name, developerEmail: dev.email },
    workers,
  });
}

async function addMirrors(
  files: Record<string, Uint8Array>,
  warnings: string[],
  companyId: number,
  companyName: string,
  range: { from: string; to: string },
) {
  const database = await db.getDb();
  if (!database) return;
  const members = await database.select({
    id: memberAccounts.id, name: memberAccounts.userName, role: memberAccounts.role, employeeCode: promoterProfiles.employeeCode,
  }).from(memberAccounts).leftJoin(promoterProfiles, eq(promoterProfiles.memberAccountId, memberAccounts.id)).where(eq(memberAccounts.companyId, companyId));
  const staff = members.filter((m) => m.role !== "company_admin");
  if (!staff.length) return;
  const ids = staff.map((m) => m.id);
  const eventRows = await loadMirrorEventRows(companyId, ids, range.from, range.to);
  const months = new Set<string>();
  for (const r of eventRows) {
    const d = formatD((r as any).deviceTime || (r as any).serverTime || (r as any).time, (r as any).timeZone || TZ);
    if (d) months.add(d.slice(0, 7));
  }
  // Também cobre o intervalo civil mesmo sem evento (espelho vazio útil para conferência).
  const start = range.from.slice(0, 7);
  const end = range.to.slice(0, 7);
  for (let m = start; m <= end; ) {
    months.add(m);
    const [y, mo] = m.split("-").map(Number);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    m = next;
    if (months.size > 120) break;
  }
  const options = await loadMirrorOptions(companyId);
  const adjByEvent = await loadAdjustmentsByEvent(companyId, ids);
  const today = todayInTimeZone(TZ);
  const sortedMonths = [...months].sort();
  for (const month of sortedMonths) {
    const [year, mon] = month.split("-").map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    const monthEvents = eventRows.filter((r) => {
      const d = formatD((r as any).deviceTime || (r as any).serverTime || (r as any).time, (r as any).timeZone || TZ);
      return d >= from && d <= to;
    });
    if (!monthEvents.length) continue;
    const excusesByMember = await loadApprovedDayExcuses(companyId, ids, from, to);
    const vacationsByMember = await loadMemberVacations(companyId, ids, from, to);
    const treatmentsByMember = await loadDayTreatments(companyId, ids, from, to);
    for (const member of staff) {
      const mine = monthEvents.filter((r) => r.memberAccountId === member.id);
      if (!mine.length) continue;
      try {
        const labor = await readJson<LaborProfile>(`labor_profile:${member.id}`, companyId);
        const events: MirrorEvent[] = toMirrorEvents(mine, adjByEvent);
        const report = buildMirror({
          events, from, to, timeZone: TZ, labor,
          excuses: excusesByMember.get(member.id) || [],
          vacations: vacationsByMember.get(member.id) || [],
          treatments: treatmentsByMember.get(member.id) || [],
          options, today,
        });
        const folder = `espelhos/${safeName(member.name, `membro-${member.id}`)}`;
        files[`${folder}/${month}.json`] = strToU8(JSON.stringify({ memberId: member.id, name: member.name, employeeCode: member.employeeCode ?? null, from, to, report }, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
        try {
          const pdf = await buildMirrorPdfBuffer({
            companyName, memberName: member.name, employeeCode: member.employeeCode ?? null, from, to, report,
          });
          files[`${folder}/${month}.pdf`] = new Uint8Array(pdf);
        } catch (e) {
          warnings.push(`Não foi possível gerar o PDF do espelho de ${member.name} em ${month}: ${e instanceof Error ? e.message : "erro"}.`);
        }
      } catch (e) {
        warnings.push(`Não foi possível gerar o espelho de ${member.name} em ${month}: ${e instanceof Error ? e.message : "erro"}.`);
      }
    }
  }
}

export type RetentionBackupResult = {
  key: string;
  url: string;
  fileName: string;
  bytes: number;
  warnings: string[];
};

export async function createCompanyRetentionBackup(
  companyId: number,
  opts?: { put?: typeof storagePutExact; now?: Date },
): Promise<RetentionBackupResult> {
  const company = await db.getCompanyById(companyId);
  if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
  const warnings: string[] = [];
  const files: Record<string, Uint8Array> = {};
  try {
    const employer = await employerOf(companyId);
    const dumped = await dumpScopedTables(companyId);
    warnings.push(...dumped.warnings);
    files["empresa.json"] = strToU8(JSON.stringify({
      id: companyId,
      name: company.name,
      employer,
      exportedAt: (opts?.now ?? new Date()).toISOString(),
    }, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    files["dados/tabelas.json"] = strToU8(JSON.stringify(dumped.tables, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));

    const range = await dateRangeForCompany(companyId);
    if (range) {
      try {
        const afd = await buildAfdFile(companyId, range.from, range.to, employer);
        if (afd) files[`afd/${afd.fileName}`] = strToU8(afd.content);
      } catch (e) {
        warnings.push(`Não foi possível gerar o AFD: ${e instanceof Error ? e.message : "erro"}. As marcações seguem em dados/tabelas.json.`);
      }
      try {
        const aej = await buildAejFile(companyId, range.from, range.to, employer);
        if (aej) files[`aej/${aej.fileName}`] = strToU8(aej.content);
      } catch (e) {
        warnings.push(`Não foi possível gerar o AEJ: ${e instanceof Error ? e.message : "erro"}.`);
      }
      try {
        await addMirrors(files, warnings, companyId, company.name, range);
      } catch (e) {
        warnings.push(`Não foi possível gerar os espelhos: ${e instanceof Error ? e.message : "erro"}.`);
      }
    } else {
      warnings.push("Não havia marcações de ponto; o ZIP não inclui AFD, AEJ nem espelhos.");
    }
  } catch (e) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Não foi possível gerar a cópia final de segurança. A empresa não foi excluída. ${e instanceof Error ? e.message : ""}`.trim(),
    });
  }

  files["LEIA-ME.txt"] = strToU8([
    "Cópia final da empresa antes da exclusão permanente no GondUp.",
    `Empresa: ${company.name} (#${companyId})`,
    `Gerada em: ${(opts?.now ?? new Date()).toLocaleString("pt-BR", { timeZone: TZ })} (America/Sao_Paulo).`,
    "",
    "Conteúdo:",
    "- empresa.json: identificação e dados cadastrais da empresa;",
    "- dados/tabelas.json: registros ligados à empresa (sem senhas, tokens ou códigos de recuperação);",
    "- afd/: Arquivo Fonte de Dados, quando houver marcações originais;",
    "- aej/: Arquivo Eletrônico de Jornada, quando foi possível gerar;",
    "- espelhos/: cartão-ponto / espelho em JSON e PDF por funcionário e mês.",
    "",
    "As marcações de ponto têm prazo legal de guarda de cerca de 5 anos (Portaria 671 e CLT).",
    "Esta cópia fica no arquivo de retenção e não é apagada com a empresa.",
    warnings.length ? `\nAvisos:\n- ${warnings.join("\n- ")}` : "",
    "",
  ].join("\r\n"));
  if (warnings.length) files["AVISOS.txt"] = strToU8(warnings.join("\r\n") + "\r\n");

  let zip: Uint8Array;
  try {
    zip = zipSync(files);
  } catch (e) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Não foi possível compactar a cópia final de segurança. A empresa não foi excluída. ${e instanceof Error ? e.message : ""}`.trim(),
    });
  }

  const now = opts?.now ?? new Date();
  const fileName = `copia-final-${safeName(company.name, `empresa-${companyId}`)}-${isoStamp(now).slice(0, 8)}.zip`;
  const key = retentionBackupKey(companyId, isoStamp(now), fileName);
  const put = opts?.put ?? storagePutExact;
  try {
    const stored = await put(key, Buffer.from(zip), "application/zip");
    return { key: stored.key || key, url: stored.url, fileName, bytes: zip.byteLength, warnings };
  } catch (e) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Não foi possível guardar a cópia final de segurança. A empresa não foi excluída. ${e instanceof Error ? e.message : ""}`.trim(),
    });
  }
}
