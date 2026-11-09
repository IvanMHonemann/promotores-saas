/**
 * Livro de registro do ponto (ARP — armazenamento de registro de ponto), à prova de alteração.
 *
 * Regras (Portaria MTP 671/2021, art. 74 IV e Anexo IX):
 * - Marcação original NUNCA é alterada nem apagada: correção vira um NOVO registro ("tratamento") que aponta para
 *   a original (replacesEventId). Inclusão de batida esquecida também é um registro próprio (origin = "inclusion").
 * - Cada marcação original recebe NSR (Número Sequencial de Registro) por empresa/estabelecimento, sem lacunas,
 *   e o hash SHA-256 do registro tipo 7 do AFD, encadeado com o hash da marcação anterior.
 * - Tratamentos têm cadeia de hash própria. Qualquer alteração direta no banco quebra as cadeias e aparece na
 *   verificação de integridade (verifyLedger).
 *
 * O "estabelecimento" é a empresa (companyId). Empresas com mais de um CNPJ/filial precisam de uma conta por CNPJ.
 */
import { sql, inArray, and, eq } from "drizzle-orm";
import * as db from "../db";
import { timeEvents } from "../../drizzle/schema";
import { COLLECTOR_BROWSER, onlyDigits, punchContentHash, punchHash, treatmentHash, type LedgerRow } from "./repFormat";

type Db = NonNullable<Awaited<ReturnType<typeof db.getDb>>>;
export type DbOrTx = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];

export const DEFAULT_TZ = "America/Sao_Paulo";
export const NEW_SHIFT_MARKER = "[NOVA-JORNADA-MESMO-DIA]";

/** MySQL guarda TIMESTAMP em segundos (e arredonda frações). Truncamos antes de gravar para o hash bater. */
export const truncSec = (d: Date) => new Date(Math.floor(d.getTime() / 1000) * 1000);

let ready: Promise<void> | null = null;

const ALTERS = [
  "ADD COLUMN IF NOT EXISTS nsr BIGINT NULL",
  "ADD COLUMN IF NOT EXISTS recordHash VARCHAR(64) NULL",
  "ADD COLUMN IF NOT EXISTS prevHash VARCHAR(64) NULL",
  "ADD COLUMN IF NOT EXISTS contentHash VARCHAR(64) NULL",
  "ADD COLUMN IF NOT EXISTS timeZone VARCHAR(64) NULL",
  "ADD COLUMN IF NOT EXISTS collectorId VARCHAR(8) NULL",
  "ADD COLUMN IF NOT EXISTS offline TINYINT(1) NOT NULL DEFAULT 0",
  "ADD COLUMN IF NOT EXISTS clientTime TIMESTAMP NULL",
  "ADD COLUMN IF NOT EXISTS workerCpf VARCHAR(14) NULL",
  "ADD COLUMN IF NOT EXISTS origin VARCHAR(16) NOT NULL DEFAULT 'original'",
  "ADD COLUMN IF NOT EXISTS replacesEventId INT NULL",
  "ADD COLUMN IF NOT EXISTS correctionRequestId INT NULL",
  "ADD COLUMN IF NOT EXISTS recordedByMemberId INT NULL",
  "ADD COLUMN IF NOT EXISTS recordedByName VARCHAR(255) NULL",
  "ADD COLUMN IF NOT EXISTS reason TEXT NULL",
  "ADD COLUMN IF NOT EXISTS sealedLegacy TINYINT(1) NOT NULL DEFAULT 0",
];

/** Cria colunas/tabelas do livro de ponto (idempotente; ver drizzle/0026_ponto_prova_legal.sql). */
export async function ensurePunchLedger(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    for (const alter of ALTERS) await database.execute(sql.raw(`ALTER TABLE time_events ${alter}`));
    await database.execute(sql.raw("CREATE UNIQUE INDEX IF NOT EXISTS time_events_company_nsr_unique ON time_events (companyId, nsr)"));
    await database.execute(sql.raw("CREATE INDEX IF NOT EXISTS time_events_replaces_idx ON time_events (companyId, replacesEventId)"));
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS rep_ledger_state (
      companyId INT NOT NULL PRIMARY KEY,
      lastNsr BIGINT NOT NULL DEFAULT 0,
      lastHash VARCHAR(64) NULL,
      lastTreatmentHash VARCHAR(64) NULL,
      initializedAt TIMESTAMP NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`));
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS timesheet_acceptances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      month CHAR(7) NOT NULL,
      decision VARCHAR(16) NOT NULL DEFAULT 'accepted',
      documentHash CHAR(64) NOT NULL,
      summary TEXT NULL,
      comment TEXT NULL,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY timesheet_acceptances_member_idx (companyId, memberAccountId, month),
      KEY timesheet_acceptances_month_idx (companyId, month)
    )`));
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

/** CPF do funcionário (perfil trabalhista do espelho), só dígitos, ou null. */
export async function loadWorkerCpf(companyId: number, memberId: number): Promise<string | null> {
  try {
    const raw = await db.getSetting(`labor_profile:${memberId}`, companyId, "");
    if (!raw) return null;
    const cpf = onlyDigits(JSON.parse(raw)?.cpf);
    return cpf.length === 11 ? cpf : null;
  } catch {
    return null;
  }
}

type LedgerState = { lastNsr: number; lastHash: string | null; lastTreatmentHash: string | null };

/** Trava a linha de estado da empresa (SELECT ... FOR UPDATE) e sela o histórico antigo na primeira vez. */
async function lockState(tx: DbOrTx, companyId: number): Promise<LedgerState> {
  await tx.execute(sql`INSERT IGNORE INTO rep_ledger_state (companyId, lastNsr) VALUES (${companyId}, 0)`);
  const [rows]: any = await tx.execute(sql`SELECT lastNsr, lastHash, lastTreatmentHash, initializedAt FROM rep_ledger_state WHERE companyId = ${companyId} FOR UPDATE`);
  const row = rows?.[0] ?? {};
  let state: LedgerState = { lastNsr: Number(row.lastNsr ?? 0), lastHash: row.lastHash ?? null, lastTreatmentHash: row.lastTreatmentHash ?? null };
  if (!row.initializedAt) {
    state = await sealLegacy(tx, companyId, state);
    await tx.execute(sql`UPDATE rep_ledger_state SET lastNsr = ${state.lastNsr}, lastHash = ${state.lastHash}, lastTreatmentHash = ${state.lastTreatmentHash}, initializedAt = UTC_TIMESTAMP() WHERE companyId = ${companyId}`);
  }
  return state;
}

const LEGACY_INCLUSION = /^Batida incluída via solicitação aprovada/;

/**
 * Sela, uma única vez, as marcações gravadas antes desta versão (sem NSR/hash), na ordem de gravação.
 * Não muda tipo, horário nem localização: só preenche NSR, hash e marca sealedLegacy = 1.
 * O selo prova que o registro não mudou DEPOIS do selo; o que aconteceu antes (ex.: ajustes antigos que
 * sobrescreviam a batida) continua descrito nas observações e em time_event_adjustments.
 */
async function sealLegacy(tx: DbOrTx, companyId: number, state: LedgerState): Promise<LedgerState> {
  const [rows]: any = await tx.execute(sql`SELECT id, memberAccountId, eventType, serverTime, deviceTime, latitude, longitude, accuracy, notes FROM time_events WHERE companyId = ${companyId} AND recordHash IS NULL ORDER BY id`);
  if (!rows?.length) return state;
  const cpfCache = new Map<number, string | null>();
  let { lastNsr, lastHash, lastTreatmentHash } = state;
  for (const r of rows as any[]) {
    const memberId = Number(r.memberAccountId);
    if (!cpfCache.has(memberId)) cpfCache.set(memberId, await loadWorkerCpf(companyId, memberId));
    const cpf = cpfCache.get(memberId) ?? null;
    const recordedAt = new Date(r.serverTime);
    const markedAt = new Date(r.deviceTime || r.serverTime);
    const offline = /\[MARCACAO-OFFLINE\]/.test(String(r.notes || ""));
    if (LEGACY_INCLUSION.test(String(r.notes || ""))) {
      const reason = String(r.notes || "").slice(0, 2000);
      const hash = treatmentHash({ id: Number(r.id), kind: "inclusion", replacesEventId: null, memberAccountId: memberId, eventType: r.eventType, markedAt, recordedAt, reason, decidedBy: "", correctionRequestId: null }, lastTreatmentHash);
      await tx.execute(sql`UPDATE time_events SET origin = 'inclusion', reason = ${reason}, recordHash = ${hash}, prevHash = ${lastTreatmentHash}, timeZone = ${DEFAULT_TZ}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
      lastTreatmentHash = hash;
      continue;
    }
    const nsr = lastNsr + 1;
    const p = { nsr, markedAt, recordedAt, cpf, timeZone: DEFAULT_TZ, collector: COLLECTOR_BROWSER, offline };
    const hash = punchHash(p, lastHash);
    const content = punchContentHash({ nsr, memberAccountId: memberId, eventType: r.eventType, markedAt, recordedAt, clientTime: null, latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy, timeZone: DEFAULT_TZ, cpf, offline });
    await tx.execute(sql`UPDATE time_events SET nsr = ${nsr}, recordHash = ${hash}, prevHash = ${lastHash}, contentHash = ${content}, timeZone = ${DEFAULT_TZ}, collectorId = ${COLLECTOR_BROWSER}, offline = ${offline ? 1 : 0}, workerCpf = ${cpf}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
    lastNsr = nsr;
    lastHash = hash;
  }
  return { lastNsr, lastHash, lastTreatmentHash };
}

export type OriginalPunchInput = {
  companyId: number;
  memberAccountId: number;
  eventType: "clock_in" | "break_start" | "break_end" | "clock_out";
  /** Horário oficial decidido por resolvePunchTime; null = vale o horário de gravação do servidor. */
  deviceTimeToStore: Date | null;
  /** Horário informado pelo aparelho, sempre guardado (mesmo quando divergente). */
  clientTime: Date | null;
  latitude: number;
  longitude: number;
  accuracy: number;
  locationStatus: "success";
  locationError?: string | null;
  deviceInfo?: string | null;
  idempotencyKey?: string | null;
  notes?: string | null;
  timeZone: string;
  offline: boolean;
};

/** Grava uma marcação original com NSR e hash encadeado, numa transação. Devolve o id. */
export async function appendOriginalPunch(input: OriginalPunchInput): Promise<number> {
  await ensurePunchLedger();
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const cpf = await loadWorkerCpf(input.companyId, input.memberAccountId);
  return database.transaction(async (tx) => {
    const state = await lockState(tx, input.companyId);
    const nsr = state.lastNsr + 1;
    const recordedAt = truncSec(new Date());
    const deviceTime = input.deviceTimeToStore ? truncSec(input.deviceTimeToStore) : null;
    const markedAt = deviceTime ?? recordedAt;
    const clientTime = input.clientTime ? truncSec(input.clientTime) : null;
    const tz = validTimeZone(input.timeZone);
    const hash = punchHash({ nsr, markedAt, recordedAt, cpf, timeZone: tz, collector: COLLECTOR_BROWSER, offline: input.offline }, state.lastHash);
    const content = punchContentHash({ nsr, memberAccountId: input.memberAccountId, eventType: input.eventType, markedAt, recordedAt, clientTime, latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy, timeZone: tz, cpf, offline: input.offline });
    const result: any = await tx.insert(timeEvents).values({
      companyId: input.companyId,
      memberAccountId: input.memberAccountId,
      eventType: input.eventType,
      serverTime: recordedAt,
      deviceTime,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      locationStatus: input.locationStatus,
      locationError: input.locationError ?? null,
      deviceInfo: input.deviceInfo ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      notes: input.notes ?? null,
      synced: true,
      nsr,
      recordHash: hash,
      prevHash: state.lastHash,
      contentHash: content,
      timeZone: tz,
      collectorId: COLLECTOR_BROWSER,
      offline: input.offline,
      clientTime,
      workerCpf: cpf,
      origin: "original",
    });
    await tx.execute(sql`UPDATE rep_ledger_state SET lastNsr = ${nsr}, lastHash = ${hash} WHERE companyId = ${input.companyId}`);
    return Number(result?.[0]?.insertId);
  });
}

export type TreatmentInput = {
  companyId: number;
  memberAccountId: number;
  kind: "inclusion" | "adjustment";
  replacesEventId: number | null;
  eventType: "clock_in" | "break_start" | "break_end" | "clock_out";
  markedAt: Date;
  reason: string;
  correctionRequestId: number | null;
  decidedByMemberId: number | null;
  decidedByName: string;
  notes?: string | null;
  timeZone?: string;
};

/**
 * Grava um tratamento (inclusão ou ajuste aprovado) como registro NOVO. A marcação original permanece intacta e
 * passa a ser "desconsiderada" no cálculo porque existe um tratamento apontando para ela.
 * Deve ser chamado dentro da transação que aprova a solicitação.
 */
export async function appendTreatment(tx: DbOrTx, input: TreatmentInput): Promise<number> {
  const state = await lockState(tx, input.companyId);
  const recordedAt = truncSec(new Date());
  const markedAt = truncSec(input.markedAt);
  const reason = input.reason.slice(0, 2000);
  const hash = treatmentHash({ id: null, kind: input.kind, replacesEventId: input.replacesEventId, memberAccountId: input.memberAccountId, eventType: input.eventType, markedAt, recordedAt, reason, decidedBy: input.decidedByName, correctionRequestId: input.correctionRequestId }, state.lastTreatmentHash);
  const result: any = await tx.insert(timeEvents).values({
    companyId: input.companyId,
    memberAccountId: input.memberAccountId,
    eventType: input.eventType,
    serverTime: recordedAt,
    deviceTime: markedAt,
    notes: input.notes ?? null,
    synced: true,
    locationStatus: "unavailable",
    origin: input.kind,
    replacesEventId: input.replacesEventId,
    correctionRequestId: input.correctionRequestId,
    recordedByMemberId: input.decidedByMemberId,
    recordedByName: input.decidedByName,
    reason,
    recordHash: hash,
    prevHash: state.lastTreatmentHash,
    timeZone: validTimeZone(input.timeZone || DEFAULT_TZ),
  });
  await tx.execute(sql`UPDATE rep_ledger_state SET lastTreatmentHash = ${hash} WHERE companyId = ${input.companyId}`);
  return Number(result?.[0]?.insertId);
}

export function validTimeZone(tz: string | null | undefined): string {
  const value = String(tz || "").trim();
  if (!value) return DEFAULT_TZ;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }); return value.slice(0, 64); } catch { return DEFAULT_TZ; }
}

/** Ids de marcações que foram substituídas por um tratamento (ajuste) e, portanto, não contam no cálculo. */
export async function supersededIds(companyId: number, ids: number[]): Promise<Set<number>> {
  const out = new Set<number>();
  if (!ids.length) return out;
  await ensurePunchLedger();
  const database = await db.getDb();
  if (!database) return out;
  for (let i = 0; i < ids.length; i += 1000) {
    const chunk = ids.slice(i, i + 1000);
    const rows = await database.select({ id: timeEvents.replacesEventId }).from(timeEvents)
      .where(and(eq(timeEvents.companyId, companyId), inArray(timeEvents.replacesEventId, chunk)));
    for (const r of rows) if (r.id != null) out.add(Number(r.id));
  }
  return out;
}

/* ---------- Batida desconsiderada (tratamento sem apagar a original) ---------- */
/**
 * O administrador pode DESCONSIDERAR uma batida (ex.: inclusão repetida), com justificativa obrigatória.
 * Nada é apagado: a marcação continua em time_events (e no AFD, se original); a decisão fica em
 * time_event_disregards (quem, quando, por quê). "Reconsiderar" preenche revertedAt — o histórico permanece.
 * Batida desconsiderada não entra em colunas, pareamento nem cálculo do espelho; aparece só em Ocorrências.
 */
export type Disregard = { id: number; reason: string; decidedByName: string | null; createdAt: string };

let disregardsReady: Promise<void> | null = null;
export async function ensureDisregardsTable(): Promise<void> {
  if (disregardsReady) return disregardsReady;
  disregardsReady = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS time_event_disregards (
      id INT AUTO_INCREMENT NOT NULL,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      timeEventId INT NOT NULL,
      reason TEXT NOT NULL,
      decidedByMemberId INT NULL,
      decidedByName VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revertedAt TIMESTAMP NULL,
      revertedByMemberId INT NULL,
      revertedByName VARCHAR(255) NULL,
      revertReason TEXT NULL,
      PRIMARY KEY (id),
      KEY time_event_disregards_event_idx (companyId, timeEventId),
      KEY time_event_disregards_member_idx (companyId, memberAccountId)
    )`));
  })().catch((e) => { disregardsReady = null; throw e; });
  return disregardsReady;
}

/** Desconsiderações ATIVAS (não revertidas) das marcações informadas. Falha na tabela = nenhuma (não derruba telas). */
export async function activeDisregards(companyId: number, ids: number[]): Promise<Map<number, Disregard>> {
  const out = new Map<number, Disregard>();
  if (!ids.length) return out;
  try {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return out;
    await ensureDisregardsTable();
    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      const res: any = await database.execute(sql`SELECT id, timeEventId, reason, decidedByName, createdAt FROM time_event_disregards WHERE companyId = ${companyId} AND revertedAt IS NULL AND timeEventId IN (${sql.join(chunk.map((id) => sql`${id}`), sql`, `)}) ORDER BY id`);
      const rows: any[] = Array.isArray(res?.[0]) ? res[0] : [];
      for (const r of rows) out.set(Number(r.timeEventId), { id: Number(r.id), reason: String(r.reason || ""), decidedByName: r.decidedByName ?? null, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "" });
    }
  } catch (error) {
    console.warn("[ponto] desconsiderações indisponíveis", error);
  }
  return out;
}

/**
 * Remove das linhas as marcações substituídas por ajuste (a original continua no banco e no AFD) e as desconsideradas.
 * Com keepDisregarded, as desconsideradas continuam na lista marcadas com `disregard` (telas e espelho as exibem à parte).
 */
export async function effectiveRows<T extends { id: number; companyId: number }>(rows: T[]): Promise<T[]>;
export async function effectiveRows<T extends { id: number; companyId: number }>(rows: T[], opts: { keepDisregarded: true }): Promise<Array<T & { disregard: Disregard | null }>>;
export async function effectiveRows<T extends { id: number; companyId: number }>(rows: T[], opts?: { keepDisregarded?: boolean }): Promise<any[]> {
  if (!rows.length) return rows;
  const companyId = rows[0].companyId;
  const gone = await supersededIds(companyId, rows.map((r) => r.id));
  const kept = gone.size ? rows.filter((r) => !gone.has(r.id)) : rows;
  const dis = await activeDisregards(companyId, kept.map((r) => r.id));
  if (opts?.keepDisregarded) return kept.map((r) => ({ ...r, disregard: dis.get(r.id) ?? null }));
  return dis.size ? kept.filter((r) => !dis.has(r.id)) : kept;
}

/** Converte linha do banco no formato da verificação de integridade. */
export function toLedgerRow(r: any): LedgerRow {
  return {
    id: Number(r.id), origin: String(r.origin || "original"), nsr: r.nsr == null ? null : Number(r.nsr), recordHash: r.recordHash ?? null, prevHash: r.prevHash ?? null,
    memberAccountId: Number(r.memberAccountId), eventType: String(r.eventType), markedAt: new Date(r.deviceTime || r.serverTime), recordedAt: new Date(r.serverTime),
    cpf: r.workerCpf ?? null, timeZone: r.timeZone ?? null, collectorId: r.collectorId ?? null, offline: Boolean(Number(r.offline ?? 0)),
    replacesEventId: r.replacesEventId == null ? null : Number(r.replacesEventId), correctionRequestId: r.correctionRequestId == null ? null : Number(r.correctionRequestId),
    recordedByName: r.recordedByName ?? null, reason: r.reason ?? null, contentHash: r.contentHash ?? null, clientTime: r.clientTime ? new Date(r.clientTime) : null,
    latitude: r.latitude == null ? null : Number(r.latitude), longitude: r.longitude == null ? null : Number(r.longitude), accuracy: r.accuracy == null ? null : Number(r.accuracy),
  };
}
