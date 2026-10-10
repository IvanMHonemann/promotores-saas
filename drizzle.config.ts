import { defineConfig } from "drizzle-kit";

const connectionString = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("EXTERNAL_DATABASE_URL or DATABASE_URL is required to run drizzle commands");
}

const connectionUrl = new URL(connectionString);
if (connectionUrl.protocol !== "mysql:") {
  throw new Error("EXTERNAL_DATABASE_URL must use the mysql:// protocol");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: connectionUrl.hostname,
    port: Number(connectionUrl.port || 3306),
    user: decodeURIComponent(connectionUrl.username),
    password: decodeURIComponent(connectionUrl.password),
    database: decodeURIComponent(connectionUrl.pathname.replace(/^\//, "")),
    ssl: { rejectUnauthorized: true },
  },
});
