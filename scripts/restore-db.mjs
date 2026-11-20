import fs from "node:fs/promises";
import mysql from "mysql2/promise";

const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set EXTERNAL_DATABASE_URL or DATABASE_URL before restoring.");
const input = process.argv.find(arg => arg.startsWith("--input="))?.slice("--input=".length);
const replace = process.argv.includes("--replace");
if (!input) throw new Error("Usage: pnpm restore:db -- --input=backups/file.json [--replace]");
if (replace && process.env.ALLOW_DESTRUCTIVE_RESTORE !== "true") {
  throw new Error("Destructive restore requires ALLOW_DESTRUCTIVE_RESTORE=true as an extra guard.");
}

const backup = JSON.parse(await fs.readFile(input, "utf8"));
if (backup.format !== 1 || !Array.isArray(backup.tables)) throw new Error("Unsupported backup format.");
const connection = await mysql.createConnection(url);
const quote = value => `\`${String(value).replaceAll("`", "``")}\``;
try {
  await connection.query("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [...backup.tables].reverse()) {
    if (replace) await connection.query(`DROP TABLE IF EXISTS ${quote(table.name)}`);
  }
  for (const table of backup.tables) {
    await connection.query(table.createSql);
    for (const row of table.rows ?? []) {
      await connection.query(`INSERT INTO ${quote(table.name)} SET ?`, row);
    }
  }
  await connection.query("SET FOREIGN_KEY_CHECKS=1");
  console.log(`Restored ${backup.tables.length} tables from ${input}.`);
} finally {
  await connection.query("SET FOREIGN_KEY_CHECKS=1").catch(() => {});
  await connection.end();
}
