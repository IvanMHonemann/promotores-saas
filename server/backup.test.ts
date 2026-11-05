import { describe, expect, it, vi } from "vitest";
import { daysToPurge, purgeOldR2Backups, retentionDaysFromEnv, BACKUP_PREFIX, runBackupStep } from "./backup";
import { scrubObject, scrubValue, isSentryEnabled } from "./sentry";

describe("backup retention", () => {
  it("retém 14 dias por padrão", () => {
    expect(retentionDaysFromEnv({})).toBe(14);
    expect(retentionDaysFromEnv({ BACKUP_RETENTION_DAYS: "7" })).toBe(7);
  });

  it("purge só dias mais antigos que keepDays", () => {
    const keys = [
      `${BACKUP_PREFIX}/2026-10-01/a.jsonl.gz`,
      `${BACKUP_PREFIX}/2026-10-20/_manifest.json`,
      `${BACKUP_PREFIX}/2026-11-01/_manifest.json`,
      `${BACKUP_PREFIX}/2026-11-05/t.00000.jsonl.gz`,
      "photos/other.png",
    ];
    const now = new Date("2026-11-05T12:00:00Z");
    const purge = daysToPurge(keys, 14, now);
    expect(purge).toEqual(["2026-10-01", "2026-10-20"]);
    expect(purge).not.toContain("2026-11-01");
    expect(purge).not.toContain("2026-11-05");
  });

  it("purgeOldR2Backups apaga só chaves dos dias antigos", async () => {
    const keys = [
      `${BACKUP_PREFIX}/2026-01-01/x.gz`,
      `${BACKUP_PREFIX}/2026-11-05/y.gz`,
    ];
    const deleted: string[] = [];
    const result = await purgeOldR2Backups({
      keepDays: 14,
      now: new Date("2026-11-05T12:00:00Z"),
      listKeys: async () => keys,
      deleteMany: async (ks) => {
        deleted.push(...ks);
        return ks.length;
      },
    });
    expect(result.purgedDays).toEqual(["2026-01-01"]);
    expect(deleted).toEqual([`${BACKUP_PREFIX}/2026-01-01/x.gz`]);
    expect(result.deletedObjects).toBe(1);
  });

  it("runBackupStep é no-op sem storage", async () => {
    const fakeConn = {
      query: vi.fn(),
    } as any;
    const result = await runBackupStep(fakeConn, { budgetMs: 1000 });
    expect(result.skipped).toBe(true);
    expect((result as any).reason).toBe("storage_not_configured");
    expect(fakeConn.query).not.toHaveBeenCalled();
  });
});

describe("sentry scrub", () => {
  it("desligado sem DSN", () => {
    expect(isSentryEnabled({})).toBe(false);
    expect(isSentryEnabled({ SENTRY_DSN: "  " })).toBe(false);
    expect(isSentryEnabled({ SENTRY_DSN: "https://example.ingest.sentry.io/1" })).toBe(true);
  });

  it("filtra senha e token", () => {
    expect(scrubValue("password", "segredo123")).toBe("[Filtered]");
    expect(scrubValue("senha", "x")).toBe("[Filtered]");
    expect(scrubValue("authorization", "Bearer abc")).toBe("[Filtered]");
    expect(scrubValue("name", "Ivan")).toBe("Ivan");
    const scrubbed = scrubObject({
      password: "abc",
      user: { email: "a@b.com", token: "xyz" },
      ok: 1,
    }) as any;
    expect(scrubbed.password).toBe("[Filtered]");
    expect(scrubbed.user.token).toBe("[Filtered]");
    expect(scrubbed.ok).toBe(1);
  });
});
