import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { storagePut } from "./storage";

function backupDirectory() {
  return process.env.BACKUP_DIR || "/tmp/gestao-extintores-backups/daily";
}

async function pruneBackups(directory: string, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 86400000;
  let removed = 0;
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^extintores-.*\.json$/.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if ((await fs.stat(file)).mtimeMs < cutoff) {
        await fs.rm(file);
        await fs.rm(`${file}.sha256`, { force: true });
        removed += 1;
      }
    }
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  return removed;
}

export async function runScheduledMaintenance() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is not configured.");
  const directory = backupDirectory();
  const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14));
  const connection = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNames = (tableRows as any[]).map((row: any) => Object.values(row)[0]).filter((name: any) => name !== "__drizzle_migrations");
    const tables = [];
    for (const tableName of tableNames) {
      const [[definition]]: any = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      tables.push({ name: tableName, createSql: definition["Create Table"], rows });
    }
    const backup = { format: 1, generatedAt: new Date().toISOString(), database: "mysql-compatible", schemaOnly: false, tables };
    const serialized = JSON.stringify(backup, null, 2);
    const file = path.join(directory, `extintores-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`);
    await fs.writeFile(file, serialized, { mode: 0o600 });
    const checksum = crypto.createHash("sha256").update(serialized).digest("hex");
    await fs.writeFile(`${file}.sha256`, `${checksum}  ${path.basename(file)}\n`, { mode: 0o600 });
    const objectPrefix = `backups/database/${new Date().toISOString().slice(0, 10)}`;
    const stored = await storagePut(`${objectPrefix}/${path.basename(file)}`, serialized, "application/json");
    await storagePut(`${objectPrefix}/${path.basename(file)}.sha256`, `${checksum}  ${path.basename(file)}\n`, "text/plain");
    const [trash] = await connection.query("DELETE FROM trash_items WHERE expiresAt <= UTC_TIMESTAMP()");
    const [memberSessions] = await connection.query("DELETE FROM member_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    const [platformSessions] = await connection.query("DELETE FROM platform_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    const removed = await pruneBackups(directory, retentionDays);
    return { file, storageKey: stored.key, tables: tables.length, checksum, removed, cleaned: { trash: (trash as any).affectedRows, memberSessions: (memberSessions as any).affectedRows, platformSessions: (platformSessions as any).affectedRows } };
  } finally {
    await connection.end();
  }
}


/** Envia e-mails de alerta de validade por empresa (admins ativos). */
export async function runExpirationEmailAlerts(daysAhead = 30) {
  const { getDb } = await import("./db");
  const dbmod = await import("./db");
  const emailService = await import("./email");
  const schema = await import("../drizzle/schema");
  const { eq, and } = await import("drizzle-orm");

  const database = await getDb();
  if (!database) return { companies: 0, emails: 0 };

  const companies = await database
    .select({ id: schema.companies.id, name: schema.companies.name })
    .from(schema.companies)
    .where(eq(schema.companies.active, true));

  let emails = 0;
  for (const company of companies) {
    const alerts = await dbmod.getExpiringExtinguishers(daysAhead, company.id);
    const actionable = alerts.filter((a: any) => a.alertStatus === "expired" || a.alertStatus === "urgent" || a.alertStatus === "warning");
    if (!actionable.length) continue;

    const admins = await database
      .select({
        email: schema.memberAccounts.email,
        userName: schema.memberAccounts.userName,
      })
      .from(schema.memberAccounts)
      .where(
        and(
          eq(schema.memberAccounts.companyId, company.id),
          eq(schema.memberAccounts.active, true),
          eq(schema.memberAccounts.role, "company_admin"),
        ),
      );

    if (!admins.length) continue;

    const items = actionable.map((a: any) => ({
      clientName: a.client?.companyName || "Cliente",
      type: a.extinguisher?.type || a.extinguisher?.extinguisherType || undefined,
      capacity: a.extinguisher?.capacity || undefined,
      expirationDate: String(a.extinguisher?.expirationDate || ""),
      alertMessage: a.alertMessage || "",
    }));

    for (const admin of admins) {
      if (!admin.email) continue;
      const res = await emailService.emailExtinguisherAlerts({
        to: admin.email,
        companyName: company.name,
        userName: admin.userName || admin.email,
        items,
      });
      if (res.ok) emails += 1;
    }
  }
  return { companies: companies.length, emails };
}
