import { describe, expect, it } from "vitest";
import { forceUtc } from "./forceUtc";

describe("forceUtc", () => {
  it("força UTC mesmo quando o ambiente define outro fuso", () => {
    const env: NodeJS.ProcessEnv = { TZ: "America/Sao_Paulo" };
    forceUtc(env);
    expect(env.TZ).toBe("UTC");
  });

  it("faz datas sem fuso vindas do banco serem lidas como UTC", () => {
    process.env.TZ = "America/Sao_Paulo";
    forceUtc();
    expect(new Date("2026-11-09 20:14:03").toISOString()).toBe("2026-11-09T20:14:03.000Z");
  });

  it("é o primeiro import dos dois entrypoints", async () => {
    const fs = await import("node:fs");
    for (const f of ["server/_core/index.ts", "server/vercel-entry.ts"]) {
      const first = fs.readFileSync(f, "utf8").split("\n").find((l: string) => l.startsWith("import "));
      expect(first, f).toMatch(/forceUtc/);
    }
  });
});
