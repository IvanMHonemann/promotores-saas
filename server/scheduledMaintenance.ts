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
    let expiredPhotos = { deleted: 0, errors: 0 };
    try {
      const { expireOldStorePhotos } = await import("./modules/storePhotos");
      expiredPhotos = await expireOldStorePhotos();
    } catch (e) {
      console.warn("[maintenance] expire photos failed", e);
    }
    return { file, storageKey: stored.key, tables: tables.length, checksum, removed, cleaned: { trash: (trash as any).affectedRows, memberSessions: (memberSessions as any).affectedRows, platformSessions: (platformSessions as any).affectedRows }, expiredPhotos };
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
    const productAlerts = await dbmod.getExpiringInventoryProducts(company.id, 30);
    const productAdmins = await database
      .select({ email: schema.memberAccounts.email, userName: schema.memberAccounts.userName })
      .from(schema.memberAccounts)
      .where(and(eq(schema.memberAccounts.companyId, company.id), eq(schema.memberAccounts.active, true), eq(schema.memberAccounts.role, "company_admin")));
    if (productAlerts.length && productAdmins.length) {
      const productItems = productAlerts.map((product: any) => ({
        productCode: product.productCode, description: product.description, quantity: product.quantity,
        expirationDate: new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${product.expirationDate instanceof Date ? product.expirationDate.toISOString().slice(0, 10) : String(product.expirationDate).slice(0, 10)}T00:00:00Z`)), price: product.price,
      }));
      for (const admin of productAdmins) {
        if (!admin.email) continue;
        const result = await emailService.emailProductExpirationAlerts({ to: admin.email, companyName: company.name, userName: admin.userName || admin.email, items: productItems });
        if (result.ok) emails += 1;
      }
    }
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


/** Fecha jornadas abertas de dias anteriores e avisa o admin da empresa. */
export async function runAutoClockOut() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return { closed: 0, notified: 0 };
  const connection = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
  let closed = 0;
  let notified = 0;
  try {
    // Fecha jornadas abertas: de dia anterior OU cujo horário de saída configurado já passou hoje
    const [rows]: any = await connection.query(`
      SELECT te.companyId, te.memberAccountId, te.eventType, te.serverTime,
             ma.userName, ma.email, c.name AS companyName,
             pp.workEndTime
      FROM time_events te
      INNER JOIN member_accounts ma ON ma.id = te.memberAccountId
      INNER JOIN companies c ON c.id = te.companyId
      LEFT JOIN promoter_profiles pp ON pp.memberAccountId = te.memberAccountId
      WHERE te.id IN (
        SELECT MAX(id) FROM time_events GROUP BY memberAccountId, companyId
      )
      AND te.eventType != 'clock_out'
      AND (
        DATE(te.serverTime) < CURDATE()
        OR (pp.workEndTime IS NOT NULL AND TIME(NOW()) >= pp.workEndTime AND DATE(te.serverTime) = CURDATE())
      )
    `);
    for (const row of rows || []) {
      const reason = row.workEndTime && new Date(row.serverTime).toDateString() === new Date().toDateString()
        ? `Saída automática: horário configurado ${row.workEndTime}`
        : 'Saída automática: jornada aberta de dia anterior';
      await connection.query(
        `INSERT INTO time_events (companyId, memberAccountId, eventType, notes, synced)
         VALUES (?, ?, 'clock_out', ?, 1)`,
        [row.companyId, row.memberAccountId, reason]
      );
      closed += 1;
      // Avisa admins da empresa
      const [admins]: any = await connection.query(
        `SELECT email, userName FROM member_accounts WHERE companyId = ? AND role = 'company_admin' AND active = 1 AND email IS NOT NULL`,
        [row.companyId]
      );
      for (const admin of admins || []) {
        try {
          const { emailService } = await import("./email");
          if (emailService?.send) {
            await emailService.send({
              to: admin.email,
              subject: `Saída automática: ${row.userName}`,
              text: `A jornada de ${row.userName} (${row.companyName}) foi encerrada automaticamente por estar aberta de um dia anterior.`,
            });
            notified += 1;
          }
        } catch { /* email optional */ }
      }
    }
  } finally {
    await connection.end();
  }
  return { closed, notified };
}


/** Exclui fotos expiradas (60 dias) do storage e do banco. Alerta se o consumo estiver alto. */
export async function runPhotoMaintenance() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return { deleted: 0, alerted: 0 };
  const connection = await mysql.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 10000 });
  let deleted = 0;
  let alerted = 0;
  const PHOTO_LIMIT = Number(process.env.PHOTO_STORAGE_ALERT_COUNT || 5000);
  try {
    // Fotos expiradas
    const [expired]: any = await connection.query(
      `SELECT id, fileKey, thumbnailKey FROM store_photos WHERE expiresAt <= UTC_TIMESTAMP() LIMIT 200`
    );
    const { storageDelete } = await import("./storage");
    for (const photo of expired || []) {
      try {
        if (photo.fileKey) await storageDelete(photo.fileKey);
        if (photo.thumbnailKey) await storageDelete(photo.thumbnailKey);
      } catch { /* storage optional */ }
      await connection.query(`DELETE FROM store_photos WHERE id = ?`, [photo.id]);
      deleted += 1;
    }
    // Alerta de consumo por empresa
    const [counts]: any = await connection.query(
      `SELECT companyId, COUNT(*) AS total FROM store_photos GROUP BY companyId HAVING total >= ?`,
      [PHOTO_LIMIT]
    );
    for (const row of counts || []) {
      const [admins]: any = await connection.query(
        `SELECT email FROM member_accounts WHERE companyId = ? AND role = 'company_admin' AND active = 1 AND email IS NOT NULL`,
        [row.companyId]
      );
      for (const admin of admins || []) {
        try {
          const { emailService } = await import("./email");
          if (emailService?.send) {
            await emailService.send({
              to: admin.email,
              subject: "Alerta de consumo de fotos",
              text: `Sua empresa possui ${row.total} fotos armazenadas. O limite de alerta é ${PHOTO_LIMIT}. Considere revisar ou aumentar o plano.`,
            });
            alerted += 1;
          }
        } catch { /* optional */ }
      }
    }
  } finally {
    await connection.end();
  }
  return { deleted, alerted };
}
