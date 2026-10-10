import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const TARGET_TABLES = ["time_events", "time_correction_requests"];
const REQUIRED_BASE_TABLES = ["companies", "member_accounts"];
const EXPECTED_COLUMNS = {
  time_events: [
    "id",
    "companyId",
    "memberAccountId",
    "eventType",
    "serverTime",
    "deviceTime",
    "latitude",
    "longitude",
    "accuracy",
    "locationStatus",
    "locationError",
    "deviceInfo",
    "idempotencyKey",
    "synced",
    "notes",
    "createdAt",
  ],
  time_correction_requests: [
    "id",
    "companyId",
    "memberAccountId",
    "timeEventId",
    "requestedType",
    "requestedTime",
    "justification",
    "status",
    "reviewedByUserId",
    "reviewNotes",
    "reviewedAt",
    "createdAt",
  ],
};

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

async function inspectDatabase(connection) {
  const [tableRows] = await connection.query(
    "SELECT TABLE_NAME AS tableName FROM information_schema.tables WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?, ?, ?)",
    [...REQUIRED_BASE_TABLES, ...TARGET_TABLES, "__drizzle_migrations"],
  );
  const tableNames = new Set(tableRows.map((row) => String(row.tableName).toLowerCase()));
  const missingBase = REQUIRED_BASE_TABLES.filter((table) => !tableNames.has(table));
  if (missingBase.length) {
    throw new Error(`Banco não reconhecido: tabelas-base ausentes (${missingBase.join(", ")}).`);
  }

  const [columnRows] = await connection.query(
    "SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM information_schema.columns WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?, ?)",
    TARGET_TABLES,
  );
  const columnsByTable = new Map(TARGET_TABLES.map((table) => [table, new Set()]));
  for (const row of columnRows) {
    columnsByTable.get(String(row.tableName).toLowerCase())?.add(String(row.columnName));
  }

  for (const table of TARGET_TABLES) {
    if (!tableNames.has(table)) continue;
    const missing = EXPECTED_COLUMNS[table].filter((column) => !columnsByTable.get(table).has(column));
    if (missing.length) {
      throw new Error(`Tabela ${table} existente não corresponde ao schema esperado; faltam colunas necessárias.`);
    }
  }

  let latestMigration = null;
  if (tableNames.has("__drizzle_migrations")) {
    const [historyRows] = await connection.query(
      "SELECT created_at AS createdAt FROM `__drizzle_migrations` ORDER BY created_at DESC LIMIT 1",
    );
    if (historyRows.length) latestMigration = Number(historyRows[0].createdAt);
  }

  return {
    tableNames,
    columnsByTable,
    latestMigration,
    targetsComplete: TARGET_TABLES.every((table) => tableNames.has(table)),
  };
}

function isSafeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "";
  if (/mysql:\/\/|password|passwd|token|secret|@/i.test(message)) {
    return error?.code ? `erro ${error.code}` : "falha de conexão ou migração";
  }
  return message || (error?.code ? `erro ${error.code}` : "falha de conexão ou migração");
}

try {
  const connection = await mysql.createConnection(connectionOptions());
  try {
    const before = await inspectDatabase(connection);
    if (before.latestMigration !== null && before.latestMigration >= 1791667915456) {
      if (!before.targetsComplete) {
        throw new Error("Histórico aponta 0012 aplicada, mas as duas tabelas esperadas não existem.");
      }
      console.log("[time-tracking-migration] Migração 0012 já registrada; tabelas confirmadas.");
    } else if (before.targetsComplete) {
      console.log("[time-tracking-migration] As duas tabelas e as colunas esperadas já existem.");
    } else {
      if (before.latestMigration === null) {
        console.log("[time-tracking-migration] Histórico Drizzle ausente; somente o SQL 0012 será executado.");
      } else {
        console.log("[time-tracking-migration] Histórico existente; somente o SQL 0012 será executado.");
      }

      const migrationPath = fileURLToPath(new URL("../drizzle/0012_time_tracking.sql", import.meta.url));
      const migrationSource = await readFile(migrationPath, "utf8");
      const statements = migrationSource
        .split("--> statement-breakpoint")
        .map((statement) =>
          statement
            .split(/\r?\n/)
            .filter((line) => !line.trimStart().startsWith("--"))
            .join("\n")
            .trim(),
        )
        .filter(Boolean);

      if (
        statements.length !== 2 ||
        !statements[0].startsWith("CREATE TABLE IF NOT EXISTS `time_events`") ||
        !statements[1].startsWith("CREATE TABLE IF NOT EXISTS `time_correction_requests`")
      ) {
        throw new Error("O arquivo 0012 não corresponde às duas tabelas aditivas esperadas; nenhuma alteração executada.");
      }

      for (const statement of statements) {
        await connection.query(statement);
      }

      const after = await inspectDatabase(connection);
      if (!after.targetsComplete) {
        throw new Error("Verificação pós-migração não encontrou as duas tabelas.");
      }
      console.log("[time-tracking-migration] SQL 0012 aplicado e as duas tabelas verificadas.");
    }
  } finally {
    await connection.end();
  }
} catch (error) {
  console.error(`[time-tracking-migration] Interrompida: ${isSafeErrorMessage(error)}`);
  process.exit(1);
}
