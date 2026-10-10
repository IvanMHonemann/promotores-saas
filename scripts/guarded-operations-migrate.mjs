import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const migrationTables = [
  { name: "brands", columns: ["id", "companyId", "clientId", "name", "notes", "active", "createdAt", "updatedAt"] },
  { name: "retail_chains", columns: ["id", "companyId", "name", "notes", "active", "createdAt", "updatedAt"] },
  { name: "teams", columns: ["id", "companyId", "name", "supervisorId", "notes", "active", "createdAt", "updatedAt"] },
  { name: "stores", columns: ["id", "companyId", "clientId", "brandId", "retailChainId", "name", "code", "address", "city", "state", "cep", "latitude", "longitude", "contactName", "phone", "expectedVisitFrequency", "notes", "active", "createdAt", "updatedAt"] },
  { name: "routes", columns: ["id", "companyId", "name", "date", "promoterId", "teamId", "status", "notes", "createdByUserId", "createdAt", "updatedAt"] },
  { name: "visits", columns: ["id", "companyId", "routeId", "storeId", "promoterId", "plannedStart", "plannedEnd", "actualStart", "actualEnd", "status", "startLatitude", "startLongitude", "startAccuracy", "endLatitude", "endLongitude", "endAccuracy", "distanceMeters", "justification", "notes", "createdAt", "updatedAt"] },
];

const baselineTables = {
  companies: ["id"],
  member_accounts: ["id", "companyId"],
  clients: ["id"],
};

const expectedSha = process.env.RUN_OPERATIONS_MIGRATION_SHA;
if (process.env.VERCEL_ENV !== "production" || !expectedSha || expectedSha === "0") {
  console.log("[operations migration] skipped: guard is not armed for this environment.");
  process.exit(0);
}

const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA;
if (!deployedSha) throw new Error("[operations migration] guard is armed but VERCEL_GIT_COMMIT_SHA is missing.");
if (deployedSha.toLowerCase() !== expectedSha.toLowerCase()) {
  console.log("[operations migration] skipped: commit does not match the authorized SHA.");
  process.exit(0);
}

const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("[operations migration] production database URL is not configured.");

const pool = mysql.createPool({
  uri: databaseUrl,
  ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
  connectionLimit: 1,
  queueLimit: 0,
  connectTimeout: 15000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  waitForConnections: true,
});

async function readSchema() {
  const names = [...Object.keys(baselineTables), ...migrationTables.map((table) => table.name)];
  const placeholders = names.map(() => "?").join(", ");
  const [tableRows] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    names,
  );
  const [columnRows] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    names,
  );
  return {
    tables: new Set(tableRows.map((row) => row.TABLE_NAME)),
    columns: columnRows.reduce((result, row) => {
      const current = result.get(row.TABLE_NAME) || new Set();
      current.add(row.COLUMN_NAME);
      result.set(row.TABLE_NAME, current);
      return result;
    }, new Map()),
  };
}

try {
  const schemaBefore = await readSchema();
  for (const [tableName, requiredColumns] of Object.entries(baselineTables)) {
    const missing = requiredColumns.filter((column) => !schemaBefore.columns.get(tableName)?.has(column));
    if (!schemaBefore.tables.has(tableName) || missing.length) {
      throw new Error(`[operations migration] baseline incompatible: ${tableName} is absent or missing required columns.`);
    }
  }

  for (const table of migrationTables) {
    if (!schemaBefore.tables.has(table.name)) continue;
    const missing = table.columns.filter((column) => !schemaBefore.columns.get(table.name)?.has(column));
    if (missing.length) {
      throw new Error(`[operations migration] existing table ${table.name} is incomplete; no DDL was executed.`);
    }
  }

  const sqlFile = new URL("../drizzle/0013_operations_core.sql", import.meta.url);
  const statements = readFileSync(sqlFile, "utf8")
    .split(/-->\s*statement-breakpoint/)
    .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
  const statementNames = statements.map((statement) => statement.match(/^CREATE TABLE IF NOT EXISTS `([a-z_]+)`/i)?.[1]);
  const expectedNames = migrationTables.map((table) => table.name);
  if (statements.length !== expectedNames.length || statementNames.some((name, index) => name !== expectedNames[index])) {
    throw new Error("[operations migration] SQL contents do not match the approved six-table migration.");
  }
  if (statements.some((statement) => /^\s*(DROP|ALTER|DELETE|TRUNCATE)\b/i.test(statement))) {
    throw new Error("[operations migration] destructive SQL was detected; migration aborted.");
  }

  for (const statement of statements) await pool.query(statement);

  const schemaAfter = await readSchema();
  for (const table of migrationTables) {
    const missing = table.columns.filter((column) => !schemaAfter.columns.get(table.name)?.has(column));
    if (!schemaAfter.tables.has(table.name) || missing.length) {
      throw new Error(`[operations migration] post-check failed for table ${table.name}.`);
    }
  }

  console.log("[operations migration] verified all six operational tables; no existing rows were modified.");
} finally {
  await pool.end();
}
