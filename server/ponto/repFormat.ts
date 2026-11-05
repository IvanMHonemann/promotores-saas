/**
 * Formatação dos arquivos fiscais do ponto (Portaria MTP 671/2021) e do encadeamento de hash das marcações.
 * Funções puras (sem banco), testáveis isoladamente.
 *
 * Leiautes oficiais (MTE):
 * - AFD: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-fonte-de-dados-afd.pdf
 * - AEJ: https://www.gov.br/trabalho-e-emprego/pt-br/assuntos/inspecao-do-trabalho/fiscalizacao-do-trabalho/leiaute-do-arquivo-eletronico-de-jornada-aej.pdf
 *
 * IMPORTANTE: os arquivos gerados aqui NÃO são assinados. A assinatura (CAdES, arquivo .p7s) exige certificado
 * ICP-Brasil do desenvolvedor, e o número do INPI só existe após o registro do programa. Enquanto isso, o campo
 * do INPI sai com zeros e o arquivo deve ser tratado como relatório de conferência, não como AFD/AEJ oficial.
 */
import { createHash } from "node:crypto";

export const AFD_LAYOUT_VERSION = "003";
export const AEJ_LAYOUT_VERSION = "002";
export const SIGNATURE_PLACEHOLDER = "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S";
/** "02" = browser (navegador de internet), conforme campo 6 do registro tipo 7 do AFD. */
export const COLLECTOR_BROWSER = "02";
export const PTRP_NAME = "GondUp";

export const onlyDigits = (v: string | null | undefined) => String(v ?? "").replace(/\D/g, "");

/** CRC-16/KERMIT (CCITT-TRUE), exigido para AFD de REP-A e REP-P. "123456789" => "2189". */
export function crc16Kermit(text: string): string {
  let crc = 0x0000;
  const bytes = Buffer.from(text, "latin1");
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0x8408 : crc >>> 1;
  }
  // Leiaute oficial: "123456789" => "2189" (valor do CRC em hexadecimal, sem troca de bytes).
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Campo alfanumérico: alinhado à esquerda, completado com espaços, cortado no tamanho. */
export function padA(value: string | null | undefined, size: number): string {
  const clean = String(value ?? "").replace(/[\r\n|]/g, " ").normalize("NFC");
  return clean.slice(0, size).padEnd(size, " ");
}
/** Campo numérico: só dígitos, zeros à esquerda. */
export function padN(value: string | number | null | undefined, size: number): string {
  const digits = onlyDigits(String(value ?? ""));
  return digits.slice(-size).padStart(size, "0");
}

/** Deslocamento do fuso (ex.: "-0300") no instante dado. */
export function tzOffset(date: Date, timeZone: string): string {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date).find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    if (!m) return "+0000";
    return `${m[1]}${m[2]}${m[3] ?? "00"}`;
  } catch {
    return "-0300";
  }
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(date);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { y: p.year, mo: p.month, d: p.day, h: p.hour === "24" ? "00" : p.hour, mi: p.minute };
}

/** Data e hora no formato DH da Portaria: "AAAA-MM-ddThh:mm:00ZZZZZ" (24 caracteres). */
export function formatDH(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:00${tzOffset(date, timeZone)}`;
}
export function formatD(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.y}-${p.mo}-${p.d}`;
}
export function formatHHMM(date: Date, timeZone: string): string {
  const p = localParts(date, timeZone);
  return `${p.h}${p.mi}`;
}

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

// ---------------------------------------------------------------------------------------------
// Marcação original (registro tipo 7 do AFD) e seu hash encadeado
// ---------------------------------------------------------------------------------------------

export type OriginalPunchForHash = {
  nsr: number;
  /** Horário da marcação (o considerado oficial). */
  markedAt: Date;
  /** Horário em que o servidor gravou o registro. */
  recordedAt: Date;
  cpf: string | null | undefined;
  timeZone: string;
  collector?: string;
  offline: boolean;
};

/** Campos 1 a 7 do registro tipo 7, exatamente como saem no AFD. */
export function afdType7Fields(p: OriginalPunchForHash): string {
  return padN(p.nsr, 9) + "7" + formatDH(p.markedAt, p.timeZone) + padN(p.cpf, 12) + formatDH(p.recordedAt, p.timeZone) + (p.collector || COLLECTOR_BROWSER) + (p.offline ? "1" : "0");
}

/**
 * Hash SHA-256 do registro tipo 7: NSR, tipo, data/hora da marcação, CPF, data/hora da gravação, coletor,
 * on-line/off-line e o hash do registro anterior (se existir) — nesta ordem, concatenados.
 */
export function punchHash(p: OriginalPunchForHash, previousHash: string | null | undefined): string {
  return sha256(afdType7Fields(p) + (previousHash || ""));
}

/**
 * Hash do conteúdo completo da marcação (o hash do AFD não inclui tipo da batida, segundos nem GPS).
 * Qualquer mudança em tipo, horários, funcionário ou localização muda este valor.
 */
export type PunchContent = {
  nsr: number | null;
  memberAccountId: number;
  eventType: string;
  markedAt: Date;
  recordedAt: Date;
  clientTime: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  timeZone: string | null;
  cpf: string | null;
  offline: boolean;
};
const num = (v: number | null | undefined) => (v == null || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(6));
export function punchContentHash(c: PunchContent): string {
  return sha256(["C1", c.nsr ?? "", c.memberAccountId, c.eventType, c.markedAt.toISOString(), c.recordedAt.toISOString(), c.clientTime ? c.clientTime.toISOString() : "", num(c.latitude), num(c.longitude), num(c.accuracy), c.timeZone || "", onlyDigits(c.cpf), c.offline ? 1 : 0].join("|"));
}

// ---------------------------------------------------------------------------------------------
// Tratamentos (inclusão / ajuste / desconsideração) — cadeia própria, também à prova de alteração
// ---------------------------------------------------------------------------------------------

export type TreatmentForHash = {
  id: number | null;
  kind: "inclusion" | "adjustment";
  replacesEventId: number | null;
  memberAccountId: number;
  eventType: string;
  markedAt: Date;
  recordedAt: Date;
  reason: string;
  decidedBy: string;
  correctionRequestId: number | null;
};

export function treatmentHash(t: TreatmentForHash, previousHash: string | null | undefined): string {
  const payload = [
    "T1",
    t.kind,
    t.replacesEventId ?? "",
    t.memberAccountId,
    t.eventType,
    t.markedAt.toISOString(),
    t.recordedAt.toISOString(),
    t.correctionRequestId ?? "",
    t.decidedBy,
    t.reason,
  ].join("|");
  return sha256(payload + (previousHash || ""));
}

// ---------------------------------------------------------------------------------------------
// Verificação de integridade
// ---------------------------------------------------------------------------------------------

export type LedgerRow = {
  id: number;
  origin: string;
  nsr: number | null;
  recordHash: string | null;
  prevHash: string | null;
  memberAccountId: number;
  eventType: string;
  markedAt: Date;
  recordedAt: Date;
  cpf: string | null;
  timeZone: string | null;
  collectorId: string | null;
  offline: boolean;
  replacesEventId: number | null;
  correctionRequestId: number | null;
  recordedByName: string | null;
  reason: string | null;
  contentHash?: string | null;
  clientTime?: Date | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
};

export type IntegrityProblem = { id: number; nsr: number | null; kind: "hash" | "chain" | "gap" | "duplicate" | "unsealed"; message: string };

/**
 * Recalcula as duas cadeias (marcações originais por NSR e tratamentos por id) e aponta qualquer divergência.
 * Linhas antigas sem selo (anteriores a esta versão e ainda não seladas) aparecem como "unsealed".
 */
export function verifyLedger(rows: LedgerRow[]): { ok: boolean; originals: number; treatments: number; problems: IntegrityProblem[]; lastNsr: number } {
  const problems: IntegrityProblem[] = [];
  const originals = rows.filter((r) => r.origin === "original").sort((a, b) => (a.nsr ?? Infinity) - (b.nsr ?? Infinity) || a.id - b.id);
  const treatments = rows.filter((r) => r.origin !== "original").sort((a, b) => a.id - b.id);
  let prev: string | null = null;
  let expectedNsr = 1;
  const seen = new Set<number>();
  for (const r of originals) {
    if (r.nsr == null || !r.recordHash) { problems.push({ id: r.id, nsr: r.nsr, kind: "unsealed", message: "Marcação sem NSR/hash (ainda não selada)." }); continue; }
    if (seen.has(r.nsr)) problems.push({ id: r.id, nsr: r.nsr, kind: "duplicate", message: `NSR ${r.nsr} repetido.` });
    seen.add(r.nsr);
    if (r.nsr !== expectedNsr) problems.push({ id: r.id, nsr: r.nsr, kind: "gap", message: `Sequência quebrada: esperado NSR ${expectedNsr}, encontrado ${r.nsr}.` });
    expectedNsr = r.nsr + 1;
    if ((r.prevHash || null) !== (prev || null)) problems.push({ id: r.id, nsr: r.nsr, kind: "chain", message: `Encadeamento quebrado no NSR ${r.nsr}: o hash anterior gravado não confere.` });
    const recomputed = punchHash({ nsr: r.nsr, markedAt: r.markedAt, recordedAt: r.recordedAt, cpf: r.cpf, timeZone: r.timeZone || "America/Sao_Paulo", collector: r.collectorId || COLLECTOR_BROWSER, offline: r.offline }, r.prevHash);
    if (recomputed !== r.recordHash) problems.push({ id: r.id, nsr: r.nsr, kind: "hash", message: `Conteúdo da marcação NSR ${r.nsr} não confere com o hash gravado (possível alteração).` });
    else if (r.contentHash && punchContentHash({ nsr: r.nsr, memberAccountId: r.memberAccountId, eventType: r.eventType, markedAt: r.markedAt, recordedAt: r.recordedAt, clientTime: r.clientTime ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null, accuracy: r.accuracy ?? null, timeZone: r.timeZone, cpf: r.cpf, offline: r.offline }) !== r.contentHash) {
      problems.push({ id: r.id, nsr: r.nsr, kind: "hash", message: `Tipo, horário ou localização da marcação NSR ${r.nsr} não confere com o selo gravado (possível alteração).` });
    }
    prev = r.recordHash;
  }
  let tPrev: string | null = null;
  for (const t of treatments) {
    if (!t.recordHash) { problems.push({ id: t.id, nsr: null, kind: "unsealed", message: "Tratamento sem hash (ainda não selado)." }); continue; }
    if ((t.prevHash || null) !== (tPrev || null)) problems.push({ id: t.id, nsr: null, kind: "chain", message: `Encadeamento de tratamentos quebrado no registro ${t.id}.` });
    const recomputed = treatmentHash({ id: t.id, kind: t.origin === "inclusion" ? "inclusion" : "adjustment", replacesEventId: t.replacesEventId, memberAccountId: t.memberAccountId, eventType: t.eventType, markedAt: t.markedAt, recordedAt: t.recordedAt, reason: t.reason || "", decidedBy: t.recordedByName || "", correctionRequestId: t.correctionRequestId }, t.prevHash);
    if (recomputed !== t.recordHash) problems.push({ id: t.id, nsr: null, kind: "hash", message: `Tratamento ${t.id} não confere com o hash gravado (possível alteração).` });
    tPrev = t.recordHash;
  }
  const lastNsr = originals.reduce((m, r) => Math.max(m, r.nsr ?? 0), 0);
  return { ok: problems.length === 0, originals: originals.length, treatments: treatments.length, problems, lastNsr };
}

// ---------------------------------------------------------------------------------------------
// AFD
// ---------------------------------------------------------------------------------------------

export type Employer = { document: string; name: string; place?: string | null };
export type Developer = { document: string };

function employerIdType(doc: string) { return onlyDigits(doc).length === 11 ? "2" : "1"; }

export function buildAfd(input: {
  employer: Employer;
  developer: Developer;
  inpiNumber?: string | null;
  from: string; // AAAA-MM-dd
  to: string;
  generatedAt: Date;
  timeZone: string;
  punches: Array<OriginalPunchForHash & { hash: string }>;
}): { content: string; fileName: string; lines: string[] } {
  const tz = input.timeZone;
  const lines: string[] = [];
  const h = "000000000" + "1" + employerIdType(input.employer.document) + padA(onlyDigits(input.employer.document), 14) + padN("", 14) + padA(input.employer.name, 150)
    + padN(input.inpiNumber || "", 17) + input.from + input.to + formatDH(input.generatedAt, tz) + AFD_LAYOUT_VERSION
    + employerIdType(input.developer.document) + padA(onlyDigits(input.developer.document), 14) + padA("", 30);
  lines.push(h + crc16Kermit(h));
  const punches = [...input.punches].sort((a, b) => a.nsr - b.nsr);
  for (const p of punches) lines.push(afdType7Fields(p) + p.hash);
  lines.push("999999999" + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(punches.length, 9) + "9");
  lines.push(padA(SIGNATURE_PLACEHOLDER, 100));
  const fileName = `AFD${onlyDigits(input.inpiNumber || "") || "SEMINPI"}${onlyDigits(input.employer.document) || "SEMCNPJ"}REP_P.txt`;
  return { content: lines.join("\r\n") + "\r\n", fileName, lines };
}

// ---------------------------------------------------------------------------------------------
// AEJ
// ---------------------------------------------------------------------------------------------

export type AejMark = {
  markedAt: Date;
  /** "E" entrada, "S" saída, "D" desconsiderada. */
  tpMarc: "E" | "S" | "D";
  seq: number;
  /** "O" original do REP, "I" incluída manualmente. */
  fonte: "O" | "I";
  motivo?: string | null;
};

export type AejWorker = {
  cpf: string;
  name: string;
  contract: { code: string; dailyMinutes: number; pairs: Array<[string, string]> } | null;
  marks: AejMark[];
  matEsocial?: string | null;
};

/**
 * Converte as batidas de um dia (entrada/intervalo/retorno/saída) em pares entrada/saída do AEJ.
 * clock_in e break_end = "E"; break_start e clock_out = "S". O nº do par sobe a cada entrada.
 */
export function toAejSequence<T extends { type: string; time: Date }>(dayMarks: T[]): Array<T & { tpMarc: "E" | "S"; seq: number }> {
  let seq = 0;
  return [...dayMarks].sort((a, b) => a.time.getTime() - b.time.getTime()).map((m) => {
    const entry = m.type === "clock_in" || m.type === "break_end";
    if (entry || seq === 0) seq += 1;
    return { ...m, tpMarc: entry ? "E" as const : "S" as const, seq };
  });
}

export function buildAej(input: {
  employer: Employer;
  inpiNumber?: string | null;
  from: string;
  to: string;
  generatedAt: Date;
  timeZone: string;
  ptrp: { version: string; developerDocument: string; developerName: string; developerEmail: string };
  workers: AejWorker[];
}): { content: string; fileName: string; lines: string[] } {
  const tz = input.timeZone;
  const doc = onlyDigits(input.employer.document);
  const clean = (v: string | null | undefined, max: number) => String(v ?? "").replace(/[\r\n|]/g, " ").trim().slice(0, max);
  const lines: string[] = [];
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  const push = (type: number, fields: Array<string | number>) => { lines.push(fields.join("|")); counts[type - 1] += 1; };
  push(1, ["01", employerIdType(doc), doc, "", "", clean(input.employer.name, 150), input.from, input.to, formatDH(input.generatedAt, tz), AEJ_LAYOUT_VERSION]);
  push(2, ["02", 1, 3, padN(input.inpiNumber || "", 17)]);
  const contracts = new Map<string, NonNullable<AejWorker["contract"]>>();
  input.workers.forEach((w) => { if (w.contract) contracts.set(w.contract.code, w.contract); });
  input.workers.forEach((w, i) => push(3, ["03", i + 1, padN(w.cpf, 11), clean(w.name, 150)]));
  for (const c of contracts.values()) push(4, ["04", clean(c.code, 30), Math.max(0, Math.round(c.dailyMinutes)), ...c.pairs.flat()]);
  input.workers.forEach((w, i) => {
    for (const m of w.marks) {
      const firstEntry = m.tpMarc === "E" && m.seq === 1;
      const motivo = m.tpMarc === "D" || m.fonte === "I" ? clean(m.motivo || "Tratamento aprovado pelo empregador", 150) : "";
      push(5, ["05", i + 1, formatDH(m.markedAt, tz), m.fonte === "O" ? 1 : "", m.tpMarc, String(m.seq).padStart(3, "0"), m.fonte, firstEntry && w.contract ? clean(w.contract.code, 30) : "", motivo]);
    }
  });
  input.workers.forEach((w, i) => { if (w.matEsocial) push(6, ["06", i + 1, clean(w.matEsocial, 30)]); });
  push(8, ["08", PTRP_NAME, clean(input.ptrp.version, 8), employerIdType(input.ptrp.developerDocument), onlyDigits(input.ptrp.developerDocument), clean(input.ptrp.developerName, 150), clean(input.ptrp.developerEmail, 50)]);
  lines.push(["99", ...counts].join("|"));
  lines.push(padA(SIGNATURE_PLACEHOLDER, 100));
  return { content: lines.join("\r\n") + "\r\n", fileName: `AEJ_${doc || "SEMCNPJ"}_${input.from}_${input.to}.txt`, lines };
}

/** Converte texto para ISO 8859-1 (exigido pelos leiautes). Caracteres fora da tabela viram "?". */
export function toLatin1(text: string): Buffer {
  return Buffer.from(text.replace(/[^\x00-\xff]/g, "?"), "latin1");
}
