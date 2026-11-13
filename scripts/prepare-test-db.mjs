import mysql from "mysql2/promise";

const sourceUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
const targetUrl = process.env.TEST_DATABASE_URL;
if (!sourceUrl || !targetUrl) throw new Error("Set EXTERNAL_DATABASE_URL and TEST_DATABASE_URL.");
const source = new URL(sourceUrl);
const target = new URL(targetUrl);
const database = target.pathname.replace(/^\//, "");
if (!database || database === "test" || database === "sys") throw new Error("TEST_DATABASE_URL must target a dedicated non-production database.");
const quote = (value) => `\`${String(value).replaceAll("`", "``")}\``;

const sourceConnection = await mysql.createConnection({ uri: source.toString(), ssl: { rejectUnauthorized: true } });
await sourceConnection.query(`CREATE DATABASE IF NOT EXISTS ${quote(database)}`);
const [sourceTables] = await sourceConnection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
const tableNames = sourceTables.map((row) => Object.values(row)[0]).filter((name) => name !== "__drizzle_migrations");
const definitions = [];
for (const tableName of tableNames) {
  const [[definition]] = await sourceConnection.query(`SHOW CREATE TABLE ${quote(tableName)}`);
  definitions.push({ name: tableName, sql: definition["Create Table"] });
}
await sourceConnection.end();

const targetConnection = await mysql.createConnection({ uri: target.toString(), ssl: { rejectUnauthorized: true } });
try {
  const insertRows = async (table, rows) => {
    for (const row of rows) await targetConnection.query(`INSERT INTO ${quote(table)} SET ?`, row);
  };
  const [existing] = await targetConnection.query("SHOW TABLES");
  if (existing.length && process.env.ALLOW_TEST_DB_RESET !== "true") throw new Error("TEST_DATABASE_URL already has tables. Set ALLOW_TEST_DB_RESET=true only for the dedicated CI database.");
  await targetConnection.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of definitions) {
    await targetConnection.query(`CREATE TABLE IF NOT EXISTS ${quote(table.name)} ${table.sql.slice(table.sql.indexOf("("))}`);
    if (existing.length) await targetConnection.query(`TRUNCATE TABLE ${quote(table.name)}`);
  }
  const now = new Date();
  const date = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const timestamp = now.toISOString().slice(0, 19).replace("T", " ");
  await insertRows("companies", [
    { id: 1, name: "Empresa CI A", active: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: 30001, name: "Empresa CI B", active: 1, createdAt: timestamp, updatedAt: timestamp },
  ]);
  await insertRows("clients", [
    { id: 1, accountId: 1, companyName: "Cliente CI A", city: "Sapiranga", createdAt: timestamp, updatedAt: timestamp },
    { id: 30001, accountId: 30001, companyName: "Cliente CI B", city: "Curitiba", createdAt: timestamp, updatedAt: timestamp },
  ]);
  await insertRows("extinguishers", [
    { id: 1, accountId: 1, clientId: 1, typeModel: "PQS CI A", capacity: "6kg", serialNumber: "CI-A-001", locationInBuilding: "Recepção", expirationDate: date(10), lastInspectionDate: date(-20), status: "warning", createdAt: timestamp, updatedAt: timestamp },
    { id: 30001, accountId: 30001, clientId: 30001, typeModel: "PQS CI B", capacity: "6kg", serialNumber: "CI-B-001", locationInBuilding: "Recepção", expirationDate: date(20), lastInspectionDate: date(-20), status: "warning", createdAt: timestamp, updatedAt: timestamp },
  ]);
  await insertRows("service_orders", [
    { id: 1, accountId: 1, orderNumber: 1, orderDate: date(-1), createdByName: "Teste A", clientId: 1, replacedAndDelivered: "SIM", leftReserve: "NÃO", totalAmount: "120.00", paymentMethod: "A VISTA", installmentsCount: 1, responsibleName: "Responsável A", observations: "Fixture CI A", createdAt: timestamp, updatedAt: timestamp },
    { id: 30001, accountId: 30001, orderNumber: 1, orderDate: date(-2), createdByName: "Teste B", clientId: 30001, replacedAndDelivered: "SIM", leftReserve: "NÃO", totalAmount: "130.00", paymentMethod: "A VISTA", installmentsCount: 1, responsibleName: "Responsável B", observations: "Fixture CI B", createdAt: timestamp, updatedAt: timestamp },
  ]);
  await insertRows("service_order_items", [
    { id: 1, serviceOrderId: 1, description: "Manutenção CI A", quantity: 1, unitPrice: "120.00", totalPrice: "120.00", createdAt: timestamp },
    { id: 30001, serviceOrderId: 30001, description: "Manutenção CI B", quantity: 1, unitPrice: "130.00", totalPrice: "130.00", createdAt: timestamp },
  ]);
  await insertRows("member_accounts", [
    { id: 1, companyId: 1, userName: "Admin CI A", email: "ci-a@example.test", passwordHash: "scrypt:test:test", role: "company_admin", active: 1, createdAt: timestamp, updatedAt: timestamp },
    { id: 30001, companyId: 30001, userName: "Admin CI B", email: "ci-b@example.test", passwordHash: "scrypt:test:test", role: "company_admin", active: 1, createdAt: timestamp, updatedAt: timestamp },
  ]);
  await targetConnection.query("SET FOREIGN_KEY_CHECKS=1");
  console.log(JSON.stringify({ ok: true, database, tables: definitions.length, fixtures: { companies: 2, clients: 2, extinguishers: 2, orders: 2, items: 2 } }));
} finally {
  await targetConnection.query("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
  await targetConnection.end();
}
