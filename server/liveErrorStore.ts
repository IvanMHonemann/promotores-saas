/**
 * Tabelas do painel Erros ao vivo: marcações locais e histórico das rotinas agendadas.
 */
import { sql } from "drizzle-orm";
import * as db from "./db";

let ready: Promise<void> | null = null;

export async function ensureLiveErrorTables(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS live_error_overrides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sentryIssueId VARCHAR(64) NOT NULL,
      classification VARCHAR(16) NOT NULL,
      githubIssueNumber INT NULL,
      githubIssueUrl VARCHAR(255) NULL,
      sentryIgnored TINYINT NOT NULL DEFAULT 0,
      updatedBy VARCHAR(255) NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY live_error_overrides_issue (sentryIssueId)
    )`));
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS platform_job_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job VARCHAR(64) NOT NULL,
      ok TINYINT NOT NULL,
      summary VARCHAR(500) NULL,
      startedAt TIMESTAMP NOT NULL,
      finishedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY platform_job_runs_job_finished (job, finishedAt)
    )`));
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

async function queryRows(query: ReturnType<typeof sql>): Promise<any[]> {
  const database = await db.getDb();
  if (!database) return [];
  const [rows]: any = await database.execute(query);
  return Array.isArray(rows) ? rows : [];
}

export type LiveErrorOverrideRow = {
  sentryIssueId: string;
  classification: "expected" | "needs_fix";
  githubIssueNumber: number | null;
  githubIssueUrl: string | null;
  sentryIgnored: boolean;
  updatedBy: string | null;
  updatedAt: Date | string | null;
};

export async function listLiveErrorOverrides(): Promise<LiveErrorOverrideRow[]> {
  await ensureLiveErrorTables();
  const rows = await queryRows(sql`
    SELECT sentryIssueId, classification, githubIssueNumber, githubIssueUrl, sentryIgnored, updatedBy, updatedAt
    FROM live_error_overrides
  `).catch(() => []);
  return rows.map((row) => ({
    sentryIssueId: String(row.sentryIssueId),
    classification: row.classification === "needs_fix" ? "needs_fix" : "expected",
    githubIssueNumber: row.githubIssueNumber != null ? Number(row.githubIssueNumber) : null,
    githubIssueUrl: row.githubIssueUrl ? String(row.githubIssueUrl) : null,
    sentryIgnored: Number(row.sentryIgnored) === 1,
    updatedBy: row.updatedBy ? String(row.updatedBy) : null,
    updatedAt: row.updatedAt ?? null,
  }));
}

export async function upsertLiveErrorOverride(input: {
  sentryIssueId: string;
  classification: "expected" | "needs_fix";
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  sentryIgnored?: boolean | null;
  updatedBy?: string | null;
}): Promise<void> {
  await ensureLiveErrorTables();
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  await database.execute(sql`
    INSERT INTO live_error_overrides (
      sentryIssueId, classification, githubIssueNumber, githubIssueUrl, sentryIgnored, updatedBy, updatedAt
    ) VALUES (
      ${input.sentryIssueId},
      ${input.classification},
      ${input.githubIssueNumber ?? null},
      ${input.githubIssueUrl ?? null},
      ${input.sentryIgnored ? 1 : 0},
      ${input.updatedBy ?? null},
      UTC_TIMESTAMP()
    )
    ON DUPLICATE KEY UPDATE
      classification = VALUES(classification),
      githubIssueNumber = COALESCE(VALUES(githubIssueNumber), githubIssueNumber),
      githubIssueUrl = COALESCE(VALUES(githubIssueUrl), githubIssueUrl),
      sentryIgnored = VALUES(sentryIgnored),
      updatedBy = VALUES(updatedBy),
      updatedAt = UTC_TIMESTAMP()
  `);
}

export async function recordPlatformJobRun(input: {
  job: string;
  ok: boolean;
  summary?: string | null;
  startedAt: Date;
  finishedAt?: Date;
}): Promise<void> {
  try {
    await ensureLiveErrorTables();
    const database = await db.getDb();
    if (!database) return;
    const summary = (input.summary || "").slice(0, 500) || null;
    const started = input.startedAt.toISOString().slice(0, 19).replace("T", " ");
    const finished = (input.finishedAt ?? new Date()).toISOString().slice(0, 19).replace("T", " ");
    await database.execute(sql`
      INSERT INTO platform_job_runs (job, ok, summary, startedAt, finishedAt)
      VALUES (${input.job}, ${input.ok ? 1 : 0}, ${summary}, ${started}, ${finished})
    `);
  } catch (error) {
    console.warn("[live-errors] não foi possível registrar a rotina", input.job, error);
  }
}

export type PlatformJobRunRow = {
  job: string;
  ok: boolean;
  summary: string | null;
  startedAt: Date | string;
  finishedAt: Date | string;
};

export async function listLatestPlatformJobRuns(jobs: string[]): Promise<PlatformJobRunRow[]> {
  await ensureLiveErrorTables();
  if (jobs.length === 0) return [];
  const rows = await queryRows(sql`
    SELECT job, ok, summary, startedAt, finishedAt
    FROM platform_job_runs
    ORDER BY id DESC
    LIMIT 80
  `).catch(() => []);
  const wanted = new Set(jobs);
  const latest: PlatformJobRunRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const job = String(row.job);
    if (!wanted.has(job) || seen.has(job)) continue;
    seen.add(job);
    latest.push({
      job,
      ok: Number(row.ok) === 1,
      summary: row.summary ? String(row.summary) : null,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    });
  }
  return latest;
}

export async function latestCompletedBackupDay(): Promise<string | null> {
  await ensureLiveErrorTables();
  const database = await db.getDb();
  if (!database) return null;
  try {
    const [rows]: any = await database.execute(sql.raw(
      "SELECT day FROM backup_progress WHERE tableName = '_manifest' AND done = 1 ORDER BY day DESC LIMIT 1",
    ));
    const day = rows?.[0]?.day;
    return day ? String(day) : null;
  } catch {
    return null;
  }
}
