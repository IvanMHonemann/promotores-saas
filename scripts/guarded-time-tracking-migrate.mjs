import mysql from "mysql2/promise";
import { spawnSync } from "node:child_process";

const BASELINE_MIGRATION = 1791168000000; // 0010_extinguisher_public_token
const TARGET_MIGRATION = 1791667915456; // 0012_time_tracking
const REQUIRED_BASE_TABLES = ["companies", "member_accounts"];
const TARGET_TABLES = ["time_events", "time_correction_requests"];

if (
  process.env.VERCEL_ENV !== "production" ||
  process.env.RUN_TIME_TRACKING_MIGRATION !== "1"
) {
  console.log("[time-tracking-migration] Ignorada fora da execução autorizada de produção.");
  process.exit(0);
}

function connectionOptions() {
  const rawUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("EXTERNAL_DATABASE_URL/DATABASE_URL ausente.");

  const url = new URL(rawUrl);
  if (url.protocol !== "mysql:") throw new Error("A URL do banco não usa o protocolo MySQL.");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("O nome do banco não foi definido na URL.");

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: { rejectUnauthorized: true },
    connectTimeout: 15_000,
  };
}

async function inspectDatabase() {
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const [tableRows] = await connection.query(
      "SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?)",
      [...REQUIRED_BASE_TABLES, ...TARGET_TABLES, "__drizzle_migrations"],
    );
    const tableNames = new Set(tableRows.map((row) => String(row.tableName).toLowerCase()));
    const missingBase = REQUIRED_BASE_TABLES.filter((table) => !tableNames.has(table));
    if (missingBase.length) {
      throw new Error(`Banco não reconhecido: tabelas-base ausentes (${missingBase.join(", ")}).`);
    }
    if (!tableNames.has("__drizzle_migrations")) {
      throw new Error("Histórico do Drizzle ausente; migração interrompida sem alterações.");
    }

    const [historyRows] = await connection.query(
      "SELECT created_at AS createdAt FROM `__drizzle_migrations` ORDER BY created_at DESC LIMIT 1",
    );
    if (!historyRows.length) {
      throw new Error("Histórico do Drizzle vazio; migração interrompida sem alterações.");
    }
    const latestMigration = Number(historyRows[0].createdAt);
    if (!Number.isFinite(latestMigration) || latestMigration < BASELINE_MIGRATION) {
      throw new Error("Histórico anterior à migração-base 0010; migração interrompida sem alterações.");
    }

    const existingTargets = TARGET_TABLES.filter((table) => tableNames.has(table));
    const targetsComplete = existingTargets.length === TARGET_TABLES.length;
    if (latestMigration >= TARGET_MIGRATION && !targetsComplete) {
      throw new Error("Histórico aponta migração aplicada, mas as tabelas esperadas não existem.");
    }

    return { latestMigration, targetsComplete };
  } finally {
    await connection.end();
  }
}

function isSafeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";
  if (/mysql:\/\/|password|passwd|token|secret|@/i.test(message)) {
    return error?.code ? `erro ${error.code}` : "falha de conexão ou migração";
  }
  return message || (error?.code ? `erro ${error.code}` : "falha de conexão ou migração");
}

try {
  const before = await inspectDatabase();
  if (before.latestMigration >= TARGET_MIGRATION) {
    console.log("[time-tracking-migration] Já aplicada; tabelas confirmadas.");
    process.exit(0);
  }

  console.log("[time-tracking-migration] Baseline válida; executando Drizzle 0012.");
  const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const after = await inspectDatabase();
  if (after.latestMigration < TARGET_MIGRATION || !after.targetsComplete) {
    throw new Error("Verificação pós-migração não confirmou o registro e as duas tabelas.");
  }
  console.log("[time-tracking-migration] Migração 0012 aplicada e verificada.");
} catch (error) {
  console.error(`[time-tracking-migration] Interrompida: ${isSafeErrorMessage(error)}`);
  process.exit(1);
}
