import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

/**
 * Limite de tentativas de login/recuperação que vale para TODAS as instâncias do servidor.
 * Na Vercel cada instância tem memória própria, então um contador só em memória deixa o atacante
 * tentar de novo a cada instância nova. Aqui o contador fica no banco (tabela criada sob demanda,
 * padrão do projeto) e a memória só entra como reserva se o banco falhar.
 */
export const THROTTLE_LIMIT = 5;
export const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
export const THROTTLE_BLOCK_MS = 15 * 60 * 1000;

type Entry = { failures: number; windowStartedAt: number; blockedUntil: number };
const memory = new Map<string, Entry>();

export function throttleKeyHash(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Regra pura (testável): estado seguinte depois de mais uma falha. */
export function nextEntryAfterFailure(current: Entry | undefined, now: number, limit = THROTTLE_LIMIT): Entry {
  const entry: Entry = !current || now - current.windowStartedAt >= THROTTLE_WINDOW_MS
    ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
    : { ...current, failures: current.failures + 1 };
  if (entry.failures >= limit) entry.blockedUntil = now + THROTTLE_BLOCK_MS;
  return entry;
}

type DbLike = { execute: (query: any) => Promise<any> };
let ensured: Promise<void> | null = null;
let dbGetter: () => Promise<DbLike | null | undefined> = async () => null;

export function configureThrottleDb(getter: () => Promise<DbLike | null | undefined>) {
  dbGetter = getter;
  ensured = null;
}

const rows = (r: any): any[] => (Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? []);

async function table(): Promise<DbLike | null> {
  const db = await dbGetter();
  if (!db) return null;
  if (!ensured) {
    ensured = db.execute(sql.raw(`CREATE TABLE IF NOT EXISTS auth_throttle (
      keyHash char(64) NOT NULL,
      failures int NOT NULL DEFAULT 0,
      windowStartedAt bigint NOT NULL,
      blockedUntil bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (keyHash)
    )`)).then(() => undefined).catch((err) => { ensured = null; throw err; });
  }
  await ensured;
  return db;
}

export async function isThrottled(key: string): Promise<boolean> {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.blockedUntil > now) return true;
  try {
    const db = await table();
    if (!db) return false;
    const found = rows(await db.execute(sql`SELECT blockedUntil FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)} LIMIT 1`));
    return Number(found[0]?.blockedUntil ?? 0) > now;
  } catch (err) {
    console.warn("[auth-throttle] banco indisponível, usando só a memória", (err as Error)?.message);
    return false;
  }
}

export async function registerThrottleFailure(key: string): Promise<void> {
  const now = Date.now();
  memory.set(key, nextEntryAfterFailure(memory.get(key), now));
  if (memory.size > 5000) for (const [k, v] of memory) if (now - v.windowStartedAt >= THROTTLE_WINDOW_MS) memory.delete(k);
  try {
    const db = await table();
    if (!db) return;
    const hash = throttleKeyHash(key);
    const found = rows(await db.execute(sql`SELECT failures, windowStartedAt, blockedUntil FROM auth_throttle WHERE keyHash = ${hash} LIMIT 1`));
    const current = found[0]
      ? { failures: Number(found[0].failures), windowStartedAt: Number(found[0].windowStartedAt), blockedUntil: Number(found[0].blockedUntil) }
      : undefined;
    const next = nextEntryAfterFailure(current, now);
    await db.execute(sql`INSERT INTO auth_throttle (keyHash, failures, windowStartedAt, blockedUntil)
      VALUES (${hash}, ${next.failures}, ${next.windowStartedAt}, ${next.blockedUntil})
      ON DUPLICATE KEY UPDATE failures = VALUES(failures), windowStartedAt = VALUES(windowStartedAt), blockedUntil = VALUES(blockedUntil)`);
  } catch (err) {
    console.warn("[auth-throttle] falha ao gravar tentativa", (err as Error)?.message);
  }
}

export async function clearThrottle(key: string): Promise<void> {
  memory.delete(key);
  try {
    const db = await table();
    if (db) await db.execute(sql`DELETE FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)}`);
  } catch { /* segue: a janela expira sozinha */ }
}

export function __resetThrottleMemoryForTests() {
  memory.clear();
}
