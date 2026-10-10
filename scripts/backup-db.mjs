import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set EXTERNAL_DATABASE_URL or DATABASE_URL before backing up.");

const argValue = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const schemaOnly = process.argv.includes("--schema-only");
const retentionDays = Math.max(1, Number(argValue("--retention-days") ?? process.env.BACKUP_RETENTION_DAYS ?? 14));
const output = argValue("--output") ?? `backups/extintores-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`;
const copyTo = argValue("--copy-to") ?? process.env.BACKUP_COPY_DIR;

const connection = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
  connectTimeout: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
});

async function removeOldBackups(directory) {
  if (!directory) return 0;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/^extintores-.*\.json$/.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      const stat = await fs.stat(file);
      if (stat.mtimeMs < cutoff) {
        await fs.rm(file);
        await fs.rm(`${file}.sha256`, { force: true });
        removed += 1;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return removed;
}

async function writeBackup(file) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tableNames = tableRows.map((row) => Object.values(row)[0]).filter((name) => name !== "__drizzle_migrations");
  const tables = [];
  for (const tableName of tableNames) {
    const [[definition]] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    const createSql = definition["Create Table"];
    const rows = schemaOnly ? [] : (await connection.query(`SELECT * FROM \`${tableName}\``))[0];
    tables.push({ name: tableName, createSql, rows });
  }
  const backup = { format: 1, generatedAt: new Date().toISOString(), database: "mysql-compatible", schemaOnly, tables };
  const serialized = JSON.stringify(backup, null, 2);
  await fs.writeFile(file, serialized, { mode: 0o600 });
  const checksum = crypto.createHash("sha256").update(serialized).digest("hex");
  await fs.writeFile(`${file}.sha256`, `${checksum}  ${path.basename(file)}\n`, { mode: 0o600 });
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  if (parsed.format !== 1 || !Array.isArray(parsed.tables) || parsed.tables.length !== tables.length) throw new Error("Backup verification failed.");
  return { tables: tables.length, checksum };
}

try {
  const result = await writeBackup(output);
  if (copyTo) {
    const copiedFile = path.join(copyTo, path.basename(output));
    await fs.mkdir(copyTo, { recursive: true, mode: 0o700 });
    await fs.copyFile(output, copiedFile);
    await fs.copyFile(`${output}.sha256`, `${copiedFile}.sha256`);
    await removeOldBackups(copyTo);
  }
  const removed = await removeOldBackups(path.dirname(output));
  console.log(`Backup written to ${output} (${result.tables} tables${schemaOnly ? ", schema only" : " with data"}).`);
  console.log(`SHA-256: ${result.checksum}; retention removed: ${removed}; retention days: ${retentionDays}.`);
} catch (error) {
  console.error(`[Backup] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await connection.end();
}
