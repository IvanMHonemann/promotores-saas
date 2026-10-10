import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

describe("external database connection", () => {
  it("connects to the configured existing database with a read-only query", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    const result = await db!.execute(sql`SELECT 1 AS connected`);
    expect(result).toBeTruthy();
  }, 15_000);
});
