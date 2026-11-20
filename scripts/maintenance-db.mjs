import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set EXTERNAL_DATABASE_URL or DATABASE_URL before maintenance.");

const argValue = (name) => process.argv.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const retentionDays = Math.max(1, Number(argValue("--retention-days") ?? process.env.BACKUP_RETENTION_DAYS ?? 14));
const backupDir = argValue("--backup-dir") ?? process.env.BACKUP_DIR ?? "backups/daily";
const copyTo = argValue("--copy-to") ?? process.env.BACKUP_COPY_DIR;
const skipBackup = process.argv.includes("--skip-backup");

function runBackup() {
  return new Promise((resolve, reject) => {
    const args = ["scripts/backup-db.mjs", `--retention-days=${retentionDays}`, `--output=${backupDir}/extintores-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`];
    if (copyTo) args.push(`--copy-to=${copyTo}`);
    const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`Backup exited with code ${code}`)));
  });
}

const connection = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
  connectTimeout: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
});
try {
  if (!skipBackup) await runBackup();
  const [trash] = await connection.query("DELETE FROM trash_items WHERE expiresAt <= UTC_TIMESTAMP()");
  const [memberSessions] = await connection.query("DELETE FROM member_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
  const [platformSessions] = await connection.query("DELETE FROM platform_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
  console.log(JSON.stringify({
    ok: true,
    backup: !skipBackup,
    cleaned: {
      trash: trash.affectedRows,
      memberSessions: memberSessions.affectedRows,
      platformSessions: platformSessions.affectedRows,
    },
  }));
} finally {
  await connection.end();
}
