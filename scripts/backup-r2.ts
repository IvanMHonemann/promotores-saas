/**
 * Backup completo para o R2 (passos até concluir + retenção).
 * Uso: pnpm backup:r2
 */
import "dotenv/config";
import mysql from "mysql2/promise";
import { runFullBackup } from "../server/backup";

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
  console.error("Defina EXTERNAL_DATABASE_URL ou DATABASE_URL.");
  process.exit(1);
}

const connection = await mysql.createConnection({
  uri: url,
  ssl: { rejectUnauthorized: true },
  connectTimeout: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000)),
});

try {
  const result = await runFullBackup(connection, {
    budgetMs: Number(process.env.BACKUP_BUDGET_MS || 120000),
  });
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  if (!result.backup?.complete) process.exitCode = 2;
} catch (error) {
  console.error("[backup:r2] FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await connection.end();
}
