/**
 * Restaura um backup formato 2 (jsonl.gz + _manifest.json) do R2 ou de uma pasta local.
 *
 * Pasta local (arquivos já baixados do prefixo backups/database/YYYY-MM-DD/):
 *   ALLOW_DESTRUCTIVE_RESTORE=true pnpm restore:r2 -- --dir=./backups/database/2026-11-05 --replace
 *
 * Direto do R2:
 *   ALLOW_DESTRUCTIVE_RESTORE=true pnpm restore:r2 -- --day=2026-11-05 --replace
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import mysql from "mysql2/promise";
import { BACKUP_PREFIX } from "../server/backup";
import { isStorageConfigured, storageRead } from "../server/storage";

const gunzip = promisify(zlib.gunzip);
const arg = (name: string) => process.argv.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const dirArg = arg("--dir");
const dayArg = arg("--day");
const replace = process.argv.includes("--replace");

if (!dirArg && !dayArg) {
  console.error("Uso: pnpm restore:r2 -- --dir=pasta OU --day=YYYY-MM-DD [--replace]");
  process.exit(1);
}
if (replace && process.env.ALLOW_DESTRUCTIVE_RESTORE !== "true") {
  console.error("Restauração destrutiva exige ALLOW_DESTRUCTIVE_RESTORE=true.");
  process.exit(1);
}

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Defina EXTERNAL_DATABASE_URL ou DATABASE_URL.");
  process.exit(1);
}

type Manifest = {
  format: number;
  day: string;
  tables: { name: string; rows: number; files: { key: string; rows: number }[] }[];
};

async function readFileFromDir(fileName: string): Promise<Buffer> {
  return fs.readFile(path.join(dirArg!, fileName));
}

async function loadManifest(): Promise<Manifest> {
  if (dirArg) {
    return JSON.parse(await fs.readFile(path.join(dirArg, "_manifest.json"), "utf8"));
  }
  if (!isStorageConfigured()) throw new Error("Storage R2/S3 não configurado.");
  const { data } = await storageRead(`${BACKUP_PREFIX}/${dayArg}/_manifest.json`);
  return JSON.parse(data.toString("utf8"));
}

async function loadSchemaSql(): Promise<string | null> {
  try {
    const gz = dirArg
      ? await readFileFromDir("_schema.sql.gz")
      : (await storageRead(`${BACKUP_PREFIX}/${dayArg}/_schema.sql.gz`)).data;
    return (await gunzip(gz)).toString("utf8");
  } catch {
    return null;
  }
}

async function readJsonlGz(key: string): Promise<Record<string, unknown>[]> {
  const buf = dirArg ? await readFileFromDir(path.basename(key)) : (await storageRead(key)).data;
  const text = (await gunzip(buf)).toString("utf8");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

const manifest = await loadManifest();
if (manifest.format !== 2) {
  console.error("Backup não é formato 2 (R2 jsonl). Use pnpm restore:db para o JSON local (formato 1).");
  process.exit(1);
}

const connection = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
  connectTimeout: 15000,
  multipleStatements: true,
});
const quote = (v: string) => `\`${String(v).replaceAll("`", "``")}\``;

try {
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  const schema = await loadSchemaSql();
  if (replace && schema) {
    for (const table of [...manifest.tables].reverse()) {
      await connection.query(`DROP TABLE IF EXISTS ${quote(table.name)}`);
    }
    await connection.query(schema);
  } else if (schema) {
    for (const stmt of schema
      .split(/;\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      try {
        await connection.query(stmt.endsWith(";") ? stmt : `${stmt};`);
      } catch (e: any) {
        if (e?.code !== "ER_TABLE_EXISTS_ERROR") throw e;
      }
    }
  }

  let inserted = 0;
  for (const table of manifest.tables) {
    if (replace) await connection.query(`DELETE FROM ${quote(table.name)}`);
    for (const file of table.files || []) {
      const rows = await readJsonlGz(file.key);
      for (const row of rows) {
        await connection.query(`INSERT INTO ${quote(table.name)} SET ?`, row);
        inserted += 1;
      }
    }
    console.log(`Tabela ${table.name}: ${table.rows} linhas esperadas.`);
  }
  await connection.query("SET FOREIGN_KEY_CHECKS=1");
  console.log(`Restauração concluída. Inserções: ${inserted}. Dia: ${manifest.day}`);
} catch (error) {
  console.error("[restore:r2] FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await connection.query("SET FOREIGN_KEY_CHECKS=1").catch(() => undefined);
  await connection.end();
}
