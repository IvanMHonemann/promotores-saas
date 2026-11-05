/**
 * Backup lógico em partes, retomável e com orçamento de tempo (cabe em função serverless).
 * - Cada tabela vira arquivos .jsonl.gz de até CHUNK_ROWS linhas (nada de JSON gigante em memória).
 * - O progresso fica em backup_progress: se o tempo acabar, a próxima chamada continua de onde parou.
 * - Ao concluir todas as tabelas grava _manifest.json (contagens + SHA-256 de cada parte) e _schema.sql.gz.
 * - Após concluir, remove pastas de dias além de BACKUP_RETENTION_DAYS (padrão 14) no prefixo backups/database/.
 * - Sem S3/R2 configurado: no-op (não falha), para ficar inativo até a migração.
 */
import crypto from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
import type { Connection } from "mysql2/promise";
import {
  isStorageConfigured,
  storageDeleteMany,
  storageListKeys,
  storagePutExact as defaultPut,
} from "./storage";

const gzip = promisify(zlib.gzip);
const CHUNK_ROWS = Number(process.env.BACKUP_CHUNK_ROWS || 5000);
const SKIP_TABLES = new Set(["__drizzle_migrations", "member_sessions", "platform_sessions", "backup_progress"]);
export const BACKUP_PREFIX = "backups/database";

export function backupDayPrefix(day: string): string {
  return `${BACKUP_PREFIX}/${day}`;
}

export function retentionDaysFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  return Math.max(1, Number(env.BACKUP_RETENTION_DAYS || 14));
}

/** Extrai os dias YYYY-MM-DD presentes nas chaves e devolve os que devem ser apagados (mais antigos que keepDays). */
export function daysToPurge(keys: string[], keepDays: number, now = new Date()): string[] {
  const days = new Set<string>();
  const re = new RegExp(`^${BACKUP_PREFIX}/(\\d{4}-\\d{2}-\\d{2})/`);
  for (const key of keys) {
    const m = key.match(re);
    if (m) days.add(m[1]);
  }
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - keepDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return [...days].filter((d) => d < cutoffStr).sort();
}

export async function ensureBackupProgressTable(c: Connection) {
  await c.query(`CREATE TABLE IF NOT EXISTS backup_progress (
    day varchar(10) NOT NULL,
    tableName varchar(64) NOT NULL,
    cursorValue varchar(64) NULL,
    part int NOT NULL DEFAULT 0,
    rowsDone int NOT NULL DEFAULT 0,
    done tinyint NOT NULL DEFAULT 0,
    files text NULL,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (day, tableName)
  )`);
}

const jsonReplacer = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

export type BackupPut = (key: string, data: Buffer, type: string) => Promise<{ key: string; url: string }>;

export async function runBackupStep(
  c: Connection,
  opts: { budgetMs: number; day?: string; put?: BackupPut; skipIfNoStorage?: boolean } = { budgetMs: 18000 },
) {
  if (opts.skipIfNoStorage !== false && !opts.put && !isStorageConfigured()) {
    return {
      day: opts.day ?? new Date().toISOString().slice(0, 10),
      complete: true,
      skipped: true,
      reason: "storage_not_configured" as const,
      tables: 0,
      tablesDone: 0,
      partsWritten: 0,
      bytes: 0,
      manifestKey: null as string | null,
    };
  }

  const started = Date.now();
  const storagePut = opts.put ?? defaultPut;
  const day = opts.day ?? new Date().toISOString().slice(0, 10);
  const prefix = backupDayPrefix(day);
  await ensureBackupProgressTable(c);
  const [tableRows]: any = await c.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables: string[] = tableRows
    .map((r: any) => String(Object.values(r)[0]))
    .filter((n: string) => !SKIP_TABLES.has(n))
    .sort();
  let bytes = 0,
    partsWritten = 0;

  const [marker]: any = await c.query(
    "SELECT 1 FROM backup_progress WHERE day = ? AND tableName = '_manifest' AND done = 1",
    [day],
  );
  if (marker.length) {
    return {
      day,
      complete: true,
      skipped: true,
      tables: tables.length,
      tablesDone: tables.length,
      partsWritten: 0,
      bytes: 0,
      manifestKey: null as string | null,
    };
  }
  const [doneRows]: any = await c.query("SELECT tableName FROM backup_progress WHERE day = ? AND done = 1", [day]);
  const done = new Set<string>(doneRows.map((r: any) => r.tableName));

  for (const table of tables) {
    if (done.has(table)) continue;
    const [progRows]: any = await c.query("SELECT * FROM backup_progress WHERE day = ? AND tableName = ?", [day, table]);
    const prog = progRows[0];
    let part = prog?.part ?? 0,
      rowsDone = prog?.rowsDone ?? 0,
      cursor: string | null = prog?.cursorValue ?? null;
    const files: any[] = prog?.files ? JSON.parse(prog.files) : [];
    const [keys]: any = await c.query(`SHOW KEYS FROM \`${table}\` WHERE Key_name = 'PRIMARY'`);
    const pk: string | null = keys.length === 1 ? keys[0].Column_name : null;
    let finished = false;
    while (Date.now() - started < opts.budgetMs) {
      const [rows]: any = pk
        ? await c.query(
            `SELECT * FROM \`${table}\` ${cursor != null ? `WHERE \`${pk}\` > ?` : ""} ORDER BY \`${pk}\` LIMIT ${CHUNK_ROWS}`,
            cursor != null ? [cursor] : [],
          )
        : await c.query(`SELECT * FROM \`${table}\` ORDER BY 1 LIMIT ${CHUNK_ROWS} OFFSET ${rowsDone}`);
      if (!rows.length) {
        finished = true;
        break;
      }
      const body = await gzip(Buffer.from(rows.map((r: any) => JSON.stringify(r, jsonReplacer)).join("\n") + "\n"));
      const key = `${prefix}/${table}.${String(part).padStart(5, "0")}.jsonl.gz`;
      const stored = await storagePut(key, body, "application/gzip");
      files.push({ key: stored.key, rows: rows.length, sha256: crypto.createHash("sha256").update(body).digest("hex") });
      bytes += body.length;
      partsWritten += 1;
      part += 1;
      rowsDone += rows.length;
      if (pk) cursor = String(rows[rows.length - 1][pk]);
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,0,?)
         ON DUPLICATE KEY UPDATE cursorValue = VALUES(cursorValue), part = VALUES(part), rowsDone = VALUES(rowsDone), files = VALUES(files)`,
        [day, table, cursor, part, rowsDone, JSON.stringify(files)],
      );
      if (rows.length < CHUNK_ROWS) {
        finished = true;
        break;
      }
    }
    if (finished) {
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,1,?)
         ON DUPLICATE KEY UPDATE done = 1, files = VALUES(files), rowsDone = VALUES(rowsDone), part = VALUES(part)`,
        [day, table, cursor, part, rowsDone, JSON.stringify(files)],
      );
      done.add(table);
    } else break;
  }

  const complete = tables.every((t) => done.has(t));
  let manifestKey: string | null = null;
  if (complete) {
    const [all]: any = await c.query(
      "SELECT tableName, rowsDone, files FROM backup_progress WHERE day = ? AND tableName <> '_manifest' ORDER BY tableName",
      [day],
    );
    const ddl: string[] = [];
    for (const t of tables) {
      const [d]: any = await c.query(`SHOW CREATE TABLE \`${t}\``);
      ddl.push(`${d[0]["Create Table"]};`);
    }
    const schema = await gzip(Buffer.from(ddl.join("\n\n")));
    await storagePut(`${prefix}/_schema.sql.gz`, schema, "application/gzip");
    const manifest = {
      format: 2,
      day,
      generatedAt: new Date().toISOString(),
      tables: all.map((r: any) => ({ name: r.tableName, rows: r.rowsDone, files: JSON.parse(r.files || "[]") })),
    };
    const stored = await storagePut(`${prefix}/_manifest.json`, Buffer.from(JSON.stringify(manifest)), "application/json");
    manifestKey = stored.key;
    await c.query("INSERT INTO backup_progress (day, tableName, done) VALUES (?, '_manifest', 1) ON DUPLICATE KEY UPDATE done = 1", [
      day,
    ]);
  }
  return { day, complete, tables: tables.length, tablesDone: done.size, partsWritten, bytes, manifestKey };
}

/** Remove pastas de backup no R2 mais antigas que keepDays (padrão 14). No-op sem storage. */
export async function purgeOldR2Backups(opts: {
  keepDays?: number;
  listKeys?: (prefix: string) => Promise<string[]>;
  deleteMany?: (keys: string[]) => Promise<number>;
  now?: Date;
} = {}) {
  const keepDays = opts.keepDays ?? retentionDaysFromEnv();
  const listKeys = opts.listKeys ?? storageListKeys;
  const deleteMany = opts.deleteMany ?? storageDeleteMany;
  if (!opts.listKeys && !isStorageConfigured()) {
    return { keepDays, purgedDays: [] as string[], deletedObjects: 0, skipped: true as const };
  }
  const keys = await listKeys(`${BACKUP_PREFIX}/`);
  const purge = daysToPurge(keys, keepDays, opts.now);
  let deletedObjects = 0;
  for (const day of purge) {
    const dayKeys = keys.filter((k) => k.startsWith(`${BACKUP_PREFIX}/${day}/`));
    deletedObjects += await deleteMany(dayKeys);
  }
  return { keepDays, purgedDays: purge, deletedObjects, skipped: false as const };
}

/** Roda passos até completar (útil no script manual / host com tempo longo). */
export async function runFullBackup(
  c: Connection,
  opts: { budgetMs?: number; day?: string; put?: BackupPut; maxSteps?: number } = {},
) {
  const budgetMs = opts.budgetMs ?? Number(process.env.BACKUP_BUDGET_MS || 120000);
  const maxSteps = opts.maxSteps ?? 50;
  let last: Awaited<ReturnType<typeof runBackupStep>> | null = null;
  for (let i = 0; i < maxSteps; i++) {
    last = await runBackupStep(c, { budgetMs, day: opts.day, put: opts.put });
    if (last.complete || (last as any).reason === "storage_not_configured") break;
  }
  let retention = null;
  if (last?.complete && (last as any).reason !== "storage_not_configured") {
    retention = await purgeOldR2Backups();
  }
  return { backup: last, retention };
}
