import mysql from "mysql2/promise";
import { readFileSync } from "node:fs";

const branchName = "feat/plan-entitlements-per-user";
const expectedSha = process.env.RUN_ENTITLEMENTS_MIGRATION_SHA;
const deployedSha = process.env.VERCEL_GIT_COMMIT_SHA;

if (process.env.VERCEL_ENV !== "preview" || !expectedSha || expectedSha === "0") {
  console.log("[entitlements migration] skipped: preview guard is not armed.");
  process.exit(0);
}
if (process.env.VERCEL_GIT_COMMIT_REF !== branchName || !deployedSha || deployedSha.toLowerCase() !== expectedSha.toLowerCase()) {
  console.log("[entitlements migration] skipped: branch or commit does not match the one-time approval guard.");
  process.exit(0);
}

const databaseUrl = process.env.EXTERNAL_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("[entitlements migration] configured database URL is unavailable.");

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

const baselineTables = {
  subscription_plans: [
    "id", "name", "featureDashboard", "featureClients", "featureExtinguishers",
    "featureServiceOrders", "featureAlerts", "featureReports", "featureUsers",
    "featureBackup", "featureOfflinePwa",
  ],
  companies: ["id"],
  member_accounts: ["id"],
  platform_admins: ["id"],
};
const entitlementTables = [
  { name: "subscription_plan_features", columns: ["id", "planId", "featureKey", "enabled"] },
  { name: "company_feature_overrides", columns: ["id", "companyId", "featureKey", "enabled"] },
  { name: "member_feature_permissions", columns: ["id", "memberAccountId", "featureKey", "mode"] },
];
const expectedPlanAccess = { start: 0, profissional: 1, empresarial: 1 };

async function readTableColumns(names) {
  const placeholders = names.map(() => "?").join(", ");
  const [tableRows] = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    names,
  );
  const [columnRows] = await pool.query(
    `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${placeholders})`,
    names,
  );
  const tables = new Set(tableRows.map((row) => row.TABLE_NAME));
  const columns = new Map();
  for (const row of columnRows) {
    const current = columns.get(row.TABLE_NAME) || new Set();
    current.add(row.COLUMN_NAME);
    columns.set(row.TABLE_NAME, current);
  }
  return { tables, columns };
}

async function readNamedPlans() {
  const [rows] = await pool.query(
    "SELECT id, LOWER(TRIM(name)) AS planName FROM subscription_plans WHERE LOWER(TRIM(name)) IN ('start', 'profissional', 'empresarial')",
  );
  return rows;
}

async function verifyPlanMatrix() {
  const planRows = await readNamedPlans();
  const foundNames = new Set(planRows.map((row) => row.planName));
  if (Object.keys(expectedPlanAccess).some((name) => !foundNames.has(name))) return false;

  const [rows] = await pool.query(
    `SELECT LOWER(TRIM(p.name)) AS planName, f.enabled
       FROM subscription_plans p
       LEFT JOIN subscription_plan_features f ON f.planId = p.id AND f.featureKey = 'timeTracking'
      WHERE LOWER(TRIM(p.name)) IN ('start', 'profissional', 'empresarial')`,
  );
  return rows.length === planRows.length && rows.every((row) =>
    row.enabled !== null && Number(row.enabled) === expectedPlanAccess[row.planName],
  );
}

try {
  const baseline = await readTableColumns(Object.keys(baselineTables));
  for (const [tableName, requiredColumns] of Object.entries(baselineTables)) {
    const missing = requiredColumns.filter((column) => !baseline.columns.get(tableName)?.has(column));
    if (!baseline.tables.has(tableName) || missing.length) {
      throw new Error("[entitlements migration] database schema does not match the Promotores SaaS baseline; no DDL executed.");
    }
  }
  const namedPlans = await readNamedPlans();
  const foundNames = new Set(namedPlans.map((row) => row.planName));
  if (Object.keys(expectedPlanAccess).some((name) => !foundNames.has(name))) {
    throw new Error("[entitlements migration] one or more expected plans are absent; no DDL executed.");
  }

  const existing = await readTableColumns(entitlementTables.map((table) => table.name));
  const existingCount = entitlementTables.filter((table) => existing.tables.has(table.name)).length;
  if (existingCount === entitlementTables.length) {
    for (const table of entitlementTables) {
      const missing = table.columns.filter((column) => !existing.columns.get(table.name)?.has(column));
      if (missing.length) throw new Error("[entitlements migration] existing entitlement table is incomplete; no SQL executed.");
    }
    if (!(await verifyPlanMatrix())) {
      throw new Error("[entitlements migration] entitlement tables exist but the expected time-tracking matrix is not present; no SQL executed.");
    }
    console.log("[entitlements migration] already applied and verified; no SQL changes made.");
  } else if (existingCount > 0) {
    throw new Error("[entitlements migration] partial entitlement schema detected; no SQL executed.");
  } else {
    const sqlFile = new URL("../drizzle/0014_entitlements.sql", import.meta.url);
    const statements = readFileSync(sqlFile, "utf8")
      .split(/-->\s*statement-breakpoint/)
      .map((statement) => statement.replace(/^\s*--.*$/gm, "").trim())
      .filter(Boolean);
    const tableNames = statements.slice(0, 3).map((statement) =>
      statement.match(/^CREATE TABLE IF NOT EXISTS `([a-z_]+)`/i)?.[1],
    );
    const expectedTables = entitlementTables.map((table) => table.name);
    if (statements.length !== 5 || tableNames.some((name, index) => name !== expectedTables[index])) {
      throw new Error("[entitlements migration] SQL does not match the reviewed five-statement migration.");
    }
    if (statements.some((statement) => /^\s*(DROP|ALTER|DELETE|TRUNCATE)\b/im.test(statement))) {
      throw new Error("[entitlements migration] destructive SQL detected; migration aborted.");
    }

    for (const statement of statements) await pool.query(statement);

    const after = await readTableColumns(entitlementTables.map((table) => table.name));
    for (const table of entitlementTables) {
      const missing = table.columns.filter((column) => !after.columns.get(table.name)?.has(column));
      if (!after.tables.has(table.name) || missing.length) {
        throw new Error("[entitlements migration] post-check failed for an entitlement table.");
      }
    }
    if (!(await verifyPlanMatrix())) {
      throw new Error("[entitlements migration] post-check failed: the Start/Profissional/Empresarial time-tracking matrix is incorrect.");
    }
    console.log("[entitlements migration] applied and verified: Start timeTracking=0; Profissional=1; Empresarial=1.");
  }
} catch (error) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  const message = error instanceof Error ? error.message : "unknown failure";
  const safeMessage = message.replace(/(?:mysql|mariadb):\/\/\S+/gi, "[database URL redacted]").replace(/password\s*[:=]\s*\S+/gi, "password=[redacted]");
  console.error(`[entitlements migration] halted (${code}): ${safeMessage}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
