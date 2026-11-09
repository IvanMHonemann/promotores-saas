/**
 * Conferência do relógio com a Hora Legal Brasileira (NTP.br, Observatório Nacional).
 * A Portaria 671 (Anexo IX) exige que o REP-P registre com no máximo 30 s de diferença.
 *
 * Em serverless (Vercel) não dá para ajustar o relógio da máquina: o sistema MEDE o desvio do servidor
 * e do banco (que carimba a hora oficial das batidas), grava cada medição e avisa o administrador.
 * Tenta SNTP (UDP 123) em a/b/c.ntp.br; se o UDP estiver bloqueado, usa o cabeçalho Date HTTPS de ntp.br (precisão ~1 s).
 */
import dgram from "node:dgram";
import { sql } from "drizzle-orm";
import * as db from "../db";
import { writeAuditLog } from "../audit";

export const NTP_SERVERS = ["a.ntp.br", "b.ntp.br", "c.ntp.br"];
export const MAX_DRIFT_MS = 30_000;
const NTP_EPOCH_OFFSET = 2208988800; // segundos entre 1900 e 1970

export type ClockSample = { source: string; method: "sntp" | "https-date"; offsetMs: number; roundTripMs: number; precisionMs: number };

/** Lê um timestamp NTP (64 bits) e devolve milissegundos Unix. */
export function readNtpTimestamp(buf: Buffer, offset: number): number {
  const seconds = buf.readUInt32BE(offset);
  const fraction = buf.readUInt32BE(offset + 4);
  return (seconds - NTP_EPOCH_OFFSET) * 1000 + Math.round((fraction / 2 ** 32) * 1000);
}

/** Offset clássico do NTP: ((t1 - t0) + (t2 - t3)) / 2. Positivo = relógio local atrasado. */
export function ntpOffset(t0: number, t1: number, t2: number, t3: number) {
  return { offsetMs: Math.round(((t1 - t0) + (t2 - t3)) / 2), roundTripMs: Math.max(0, (t3 - t0) - (t2 - t1)) };
}

export function sntpQuery(host: string, timeoutMs = 2500, now: () => number = Date.now): Promise<ClockSample> {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const packet = Buffer.alloc(48);
    packet[0] = 0x23; // LI=0, VN=4, Mode=3 (cliente)
    let t0 = 0;
    const timer = setTimeout(() => { socket.close(); reject(new Error(`timeout ${host}`)); }, timeoutMs);
    socket.once("error", (e) => { clearTimeout(timer); socket.close(); reject(e); });
    socket.once("message", (msg) => {
      const t3 = now();
      clearTimeout(timer);
      socket.close();
      if (msg.length < 48) return reject(new Error("resposta NTP curta"));
      const t1 = readNtpTimestamp(msg, 32);
      const t2 = readNtpTimestamp(msg, 40);
      const { offsetMs, roundTripMs } = ntpOffset(t0, t1, t2, t3);
      resolve({ source: host, method: "sntp", offsetMs, roundTripMs, precisionMs: Math.max(1, Math.round(roundTripMs / 2)) });
    });
    t0 = now();
    socket.send(packet, 123, host, (err) => { if (err) { clearTimeout(timer); socket.close(); reject(err); } });
  });
}

export async function httpsDateSample(url = "https://ntp.br/", now: () => number = Date.now): Promise<ClockSample> {
  const t0 = now();
  const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4000) });
  const t3 = now();
  const date = res.headers.get("date");
  if (!date) throw new Error("sem cabeçalho Date");
  const server = Date.parse(date) + 500; // Date tem resolução de 1 s: centro do segundo
  return { source: new URL(url).host, method: "https-date", offsetMs: Math.round(server - (t0 + t3) / 2), roundTripMs: t3 - t0, precisionMs: 1000 + Math.round((t3 - t0) / 2) };
}

/** Melhor amostra disponível (menor ida-e-volta). */
export async function sampleLegalTime(): Promise<ClockSample> {
  const results = await Promise.allSettled(NTP_SERVERS.map((h) => sntpQuery(h)));
  const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  if (ok.length) return ok.sort((a, b) => a.roundTripMs - b.roundTripMs)[0];
  return httpsDateSample();
}

export type ClockCheck = {
  checkedAt: string; source: string; method: string; precisionMs: number;
  serverOffsetMs: number; databaseOffsetMs: number | null; worstMs: number; ok: boolean; error?: string;
};

async function ensureClockTable() {
  const database = await db.getDb();
  if (!database || typeof (database as any).execute !== "function") return null;
  await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS clock_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checkedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(64) NOT NULL,
    method VARCHAR(16) NOT NULL,
    precisionMs INT NOT NULL,
    serverOffsetMs INT NOT NULL,
    databaseOffsetMs INT NULL,
    ok TINYINT(1) NOT NULL,
    error VARCHAR(255) NULL,
    INDEX clock_checks_checked_idx (checkedAt)
  )`));
  return database;
}

/** Mede, grava e audita. Nunca lança: falha de rede vira registro com erro. */
export async function runClockCheck(trigger: "agendado" | "manual" = "agendado"): Promise<ClockCheck> {
  const database = await ensureClockTable();
  const checkedAt = new Date().toISOString();
  let result: ClockCheck;
  try {
    const sample = await sampleLegalTime();
    let databaseOffsetMs: number | null = null;
    if (database) {
      const before = Date.now();
      const [rows]: any = await database.execute(sql`SELECT UNIX_TIMESTAMP(UTC_TIMESTAMP(3)) * 1000 AS ms`);
      const after = Date.now();
      const dbMs = Number(rows?.[0]?.ms);
      // hora do banco comparada com a hora legal (servidor + offset medido)
      if (Number.isFinite(dbMs)) databaseOffsetMs = Math.round((before + after) / 2 + sample.offsetMs - dbMs);
    }
    const worstMs = Math.max(Math.abs(sample.offsetMs), Math.abs(databaseOffsetMs ?? 0));
    result = { checkedAt, source: sample.source, method: sample.method, precisionMs: sample.precisionMs, serverOffsetMs: sample.offsetMs, databaseOffsetMs, worstMs, ok: worstMs <= MAX_DRIFT_MS };
  } catch (e: any) {
    result = { checkedAt, source: "-", method: "-", precisionMs: 0, serverOffsetMs: 0, databaseOffsetMs: null, worstMs: 0, ok: false, error: String(e?.message || e).slice(0, 200) };
  }
  let previousOk: boolean | null = null;
  if (database) {
    try {
      const [prev]: any = await database.execute(sql`SELECT ok FROM clock_checks WHERE error IS NULL ORDER BY id DESC LIMIT 1`);
      previousOk = prev?.[0] ? Boolean(Number(prev[0].ok)) : null;
      await database.execute(sql`INSERT INTO clock_checks (source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error)
        VALUES (${result.source}, ${result.method}, ${result.precisionMs}, ${result.serverOffsetMs}, ${result.databaseOffsetMs}, ${result.ok ? 1 : 0}, ${result.error ?? null})`);
    } catch (e) { console.warn("[clock] falha ao gravar", e); }
  }
  const changed = !result.error && previousOk !== null && previousOk !== result.ok;
  const description = result.error
    ? `Conferência do relógio (${trigger}) falhou: ${result.error}`
    : `${changed ? (result.ok ? "AJUSTE: relógio voltou ao limite" : "ALERTA: relógio fora do limite") : "Conferência do relógio"} (${trigger}) — servidor ${result.serverOffsetMs} ms, banco ${result.databaseOffsetMs ?? "?"} ms vs ${result.source} (${result.method})`;
  void writeAuditLog({ companyId: null, action: result.ok ? "read" : "security", module: "time_tracking", entityType: "clock_check", description, newData: result } as any);
  return result;
}

export async function latestClockChecks(limit = 10) {
  const database = await ensureClockTable();
  if (!database) return [];
  const [rows]: any = await database.execute(sql`SELECT checkedAt, source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error FROM clock_checks ORDER BY id DESC LIMIT ${limit}`);
  return (rows || []).map((r: any) => ({ ...r, ok: Boolean(Number(r.ok)) }));
}
