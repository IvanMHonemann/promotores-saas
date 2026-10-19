import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import { storagePut } from "./storage";

function backupDirectory() {
  return process.env.BACKUP_DIR || "/tmp/promotores-saas-backups/daily";
}

async function pruneBackups(directory: string, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 86400000;
  let removed = 0;
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^promotores-saas-.*\.json$/.test(entry.name)) continue;
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
    const file = path.join(directory, `promotores-saas-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`);
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


/**
 * Alerta de batida faltante (NÃO cria marcações). Avisa por e-mail o promotor (para corrigir) e os administradores
 * da empresa, uma vez por funcionário e dia de jornada aberta (deduplicado em system_settings).
 */
export async function runMissingPunchAlerts() {
  const { findMissingPunches } = await import("./missingPunch");
  const dbm = await import("./db");
  const database = await dbm.getDb();
  if (!database) return { found: 0, notified: 0 };
  const { and, eq } = await import("drizzle-orm");
  const { memberAccounts } = await import("../drizzle/schema");
  const { sendEmail } = await import("./email");
  const missing = await findMissingPunches();
  let notified = 0;
  for (const m of missing) {
    const key = `missing_punch_notified:${m.memberId}:${m.day}`;
    if (await dbm.getSetting(key, m.companyId, "")) continue;
    const when = new Date(m.lastTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    const detail = `Última marcação: ${m.lastLabel} em ${when}. Falta registrar: ${m.missing}.`;
    try {
      if (m.email) {
        await sendEmail({ to: m.email, subject: "Falta de batida no cartão ponto", text: `${detail} Abra o app, vá em Cartão ponto > Correções de ponto e solicite a correção com a justificativa.`, html: `<p>${detail}</p><p>Abra o app, vá em <b>Cartão ponto &gt; Correções de ponto</b> e solicite a correção com a justificativa.</p>` });
        notified += 1;
      }
      const admins = await database.select({ email: memberAccounts.email }).from(memberAccounts).where(and(eq(memberAccounts.companyId, m.companyId), eq(memberAccounts.role, "company_admin"), eq(memberAccounts.active, true)));
      for (const admin of admins) {
        if (!admin.email) continue;
        await sendEmail({ to: admin.email, subject: `Falta de batida: ${m.name}`, text: `${m.name}: ${detail}`, html: `<p><b>${m.name}</b>: ${detail}</p><p>O promotor foi avisado para solicitar a correção; você poderá analisá-la em Cartão-ponto.</p>` });
        notified += 1;
      }
      await dbm.setSetting(key, new Date().toISOString(), m.companyId);
    } catch (error) {
      console.warn("[missing-punch] falha ao enviar aviso", error);
    }
  }
  return { found: missing.length, notified };
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
          const { sendEmail } = await import("./email");
          if (sendEmail) {
            await sendEmail({
              to: admin.email,
              subject: "Alerta de consumo de fotos",
              text: `Sua empresa possui ${row.total} fotos armazenadas. O limite de alerta é ${PHOTO_LIMIT}. Considere revisar ou aumentar o plano.`,
              html: `<p>Sua empresa possui ${row.total} fotos armazenadas. O limite de alerta é ${PHOTO_LIMIT}. Considere revisar ou aumentar o plano.</p>`,
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
