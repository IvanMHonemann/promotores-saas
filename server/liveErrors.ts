/**
 * Painel Erros ao vivo: resumo em português, saúde do sistema e pedido de correção no GitHub.
 */
import fs from "node:fs";
import os from "node:os";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { platformProcedure, router } from "./_core/trpc";
import { storageListKeys } from "./storage";
import { BACKUP_PREFIX } from "./backup";
import {
  applyLiveErrorOverride,
  classifyLiveError,
  extractPlace,
  formatLiveErrorWhen,
  liveErrorsHeadline,
  type LiveErrorCopy,
} from "../shared/liveErrorCopy";
import {
  ensureLiveErrorTables,
  latestCompletedBackupDay,
  listLatestPlatformJobRuns,
  listLiveErrorOverrides,
  upsertLiveErrorOverride,
  type LiveErrorOverrideRow,
} from "./liveErrorStore";

const SENTRY_HOST = (process.env.SENTRY_HOST || "https://sentry.io").replace(/\/$/, "");
const SENTRY_ORG = process.env.SENTRY_ORG || "ivanmh";
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || "gondup";
const GITHUB_REPO = process.env.GITHUB_ISSUES_REPO || "IvanMHonemann/promotores-saas";
const GITHUB_LABEL = "erro-ao-vivo";
const ISSUE_MARKER = (id: string) => `<!-- sentry-issue: ${id} -->`;
const SCHEDULED_JOBS = ["database-backup", "database-maintenance", "archive-timesheets"] as const;
const JOB_LABEL: Record<string, string> = {
  "database-backup": "Backup do banco",
  "database-maintenance": "Manutenção da madrugada",
  "archive-timesheets": "Arquivamento dos espelhos",
};

function sentryToken(): string | null {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  return token || null;
}

function githubToken(): string | null {
  const token = process.env.GITHUB_ISSUES_TOKEN?.trim();
  return token || null;
}

function actorOf(ctx: { user?: { email?: string | null; name?: string | null } | null; platformAdminId?: number | null }): string {
  return ctx.user?.email || ctx.user?.name || (ctx.platformAdminId != null ? `admin-${ctx.platformAdminId}` : "plataforma");
}

async function fetchJson<T>(url: string, init: RequestInit, timeoutMs = 12000): Promise<{ ok: boolean; status: number; body: T | null; text: string }> {
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, { ...init, signal });
  const text = await response.text();
  let body: T | null = null;
  try { body = text ? JSON.parse(text) as T : null; } catch { body = null; }
  return { ok: response.ok, status: response.status, body, text };
}

type SentryIssue = {
  id: string;
  title: string;
  culprit?: string;
  permalink?: string;
  count?: string | number;
  userCount?: number;
  firstSeen?: string;
  lastSeen?: string;
  level?: string;
  status?: string;
  metadata?: { type?: string; value?: string; filename?: string };
  stats?: Record<string, Array<[number, number]>>;
};

function sumSince(buckets: Array<[number, number]> | undefined, sinceMs: number): number {
  if (!buckets?.length) return 0;
  return buckets.reduce((sum, [ts, count]) => {
    const ms = ts > 10_000_000_000 ? ts : ts * 1000;
    return ms >= sinceMs ? sum + Number(count || 0) : sum;
  }, 0);
}

function issueCounts(issue: SentryIssue, now = Date.now()) {
  const allBuckets = Object.values(issue.stats || {}).flat();
  const countAll = Number(issue.count) || 0;
  const count24h = sumSince(allBuckets, now - 24 * 60 * 60 * 1000);
  const count7d = sumSince(allBuckets, now - 7 * 24 * 60 * 60 * 1000);
  const lastSeen = issue.lastSeen ? new Date(issue.lastSeen).getTime() : 0;
  return {
    count24h: count24h || (lastSeen >= now - 24 * 60 * 60 * 1000 ? countAll || 1 : 0),
    count7d: count7d || (lastSeen >= now - 7 * 24 * 60 * 60 * 1000 ? countAll || 1 : count24h),
  };
}

async function fetchSentryIssues(query: string): Promise<SentryIssue[]> {
  const token = sentryToken();
  if (!token) return [];
  const url = new URL(`${SENTRY_HOST}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`);
  url.searchParams.set("query", query);
  url.searchParams.set("statsPeriod", "14d");
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "freq");
  const result = await fetchJson<SentryIssue[]>(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!result.ok || !Array.isArray(result.body)) {
    throw new Error(`Sentry HTTP ${result.status}`);
  }
  return result.body;
}

async function fetchSentryIssue(id: string): Promise<SentryIssue | null> {
  const token = sentryToken();
  if (!token) return null;
  const result = await fetchJson<SentryIssue>(`${SENTRY_HOST}/api/0/issues/${encodeURIComponent(id)}/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  return result.ok && result.body?.id ? result.body : null;
}

async function setSentryIssueStatus(id: string, status: "ignored" | "unresolved"): Promise<boolean> {
  const token = sentryToken();
  if (!token) return false;
  const result = await fetchJson(`${SENTRY_HOST}/api/0/issues/${encodeURIComponent(id)}/`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return result.ok;
}

export type LiveErrorCard = LiveErrorCopy & {
  id: string;
  sentryIds: string[];
  count24h: number;
  count7d: number;
  userCount: number;
  firstSeen: string | null;
  lastSeen: string | null;
  firstSeenLabel: string;
  lastSeenLabel: string;
  sentryUrl: string | null;
  originalTitle: string;
  technical: string;
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  markedNormal: boolean;
  grouped: boolean;
};

function technicalDetails(issue: SentryIssue): string {
  return [
    issue.title,
    issue.metadata?.type && issue.metadata?.value ? `${issue.metadata.type}: ${issue.metadata.value}` : issue.metadata?.value,
    issue.culprit ? `Origem: ${issue.culprit}` : null,
    issue.permalink,
  ].filter(Boolean).join("\n");
}

function toCard(issue: SentryIssue, override: LiveErrorOverrideRow | undefined, now = Date.now()): LiveErrorCard {
  const counts = issueCounts(issue, now);
  const raw = classifyLiveError({
    title: issue.title,
    culprit: issue.culprit,
    metadataType: issue.metadata?.type,
    metadataValue: issue.metadata?.value,
    level: issue.level,
    transaction: issue.culprit,
    count24h: counts.count24h,
    count7d: counts.count7d,
    userCount: Number(issue.userCount) || 0,
  });
  const copy = applyLiveErrorOverride(raw, override?.classification);
  return {
    ...copy,
    id: String(issue.id),
    sentryIds: [String(issue.id)],
    count24h: counts.count24h,
    count7d: counts.count7d,
    userCount: Number(issue.userCount) || 0,
    firstSeen: issue.firstSeen ?? null,
    lastSeen: issue.lastSeen ?? null,
    firstSeenLabel: formatLiveErrorWhen(issue.firstSeen),
    lastSeenLabel: formatLiveErrorWhen(issue.lastSeen),
    sentryUrl: issue.permalink ?? null,
    originalTitle: issue.title,
    technical: technicalDetails(issue),
    githubIssueUrl: override?.githubIssueUrl ?? null,
    githubIssueNumber: override?.githubIssueNumber ?? null,
    markedNormal: override?.classification === "expected",
    grouped: false,
  };
}

function groupServiceWorkerNoise(cards: LiveErrorCard[]): LiveErrorCard[] {
  const noise = cards.filter((card) => card.isServiceWorkerNoise && card.action === "expected");
  const rest = cards.filter((card) => !(card.isServiceWorkerNoise && card.action === "expected"));
  if (noise.length <= 1) return cards;
  const first = noise[0];
  const lastSeen = noise.map((card) => card.lastSeen).filter(Boolean).sort().at(-1) ?? first.lastSeen;
  const firstSeen = noise.map((card) => card.firstSeen).filter(Boolean).sort()[0] ?? first.firstSeen;
  rest.unshift({
    ...first,
    id: "sw-noise",
    sentryIds: noise.flatMap((card) => card.sentryIds),
    count24h: noise.reduce((sum, card) => sum + card.count24h, 0),
    count7d: noise.reduce((sum, card) => sum + card.count7d, 0),
    userCount: Math.max(...noise.map((card) => card.userCount)),
    firstSeen,
    lastSeen,
    firstSeenLabel: formatLiveErrorWhen(firstSeen),
    lastSeenLabel: formatLiveErrorWhen(lastSeen),
    originalTitle: noise.map((card) => card.originalTitle).join("\n"),
    technical: noise.map((card) => card.technical).join("\n\n"),
    grouped: true,
    githubIssueUrl: null,
    githubIssueNumber: null,
    markedNormal: false,
    place: "Várias telas",
  });
  return rest;
}

async function loadErrorCards(): Promise<{
  sentryConfigured: boolean;
  sentryError: string | null;
  cards: LiveErrorCard[];
}> {
  const configured = Boolean(sentryToken());
  if (!configured) return { sentryConfigured: false, sentryError: null, cards: [] };
  try {
    const [unresolved, ignored, overrides] = await Promise.all([
      fetchSentryIssues("is:unresolved lastSeen:-7d"),
      fetchSentryIssues("is:ignored lastSeen:-7d").catch(() => [] as SentryIssue[]),
      listLiveErrorOverrides(),
    ]);
    const byId = new Map<string, SentryIssue>();
    for (const issue of [...unresolved, ...ignored]) byId.set(String(issue.id), issue);
    const overrideById = new Map(overrides.map((row) => [row.sentryIssueId, row]));
    const cards = [...byId.values()].map((issue) => {
      const override = overrideById.get(String(issue.id));
      const card = toCard(issue, override);
      if (issue.status === "ignored" && !override) {
        return { ...card, action: "expected" as const, severity: "leve" as const, actionReason: "Este erro já foi ignorado no Sentry.", markedNormal: true };
      }
      return card;
    });
    cards.sort((a, b) => {
      if (a.action !== b.action) return a.action === "needs_fix" ? -1 : 1;
      const sev = { grave: 0, atencao: 1, leve: 2 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return b.count24h - a.count24h;
    });
    return { sentryConfigured: true, sentryError: null, cards: groupServiceWorkerNoise(cards) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    console.warn("[live-errors] Sentry:", message);
    return { sentryConfigured: true, sentryError: "Não foi possível ler os erros no Sentry agora. Tente atualizar em instantes.", cards: [] };
  }
}

function readCgroupMemory(): { usedBytes: number; limitBytes: number | null } | null {
  try {
    const used = Number(fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
    if (!Number.isFinite(used)) return null;
    const raw = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
    const limit = raw === "max" ? null : Number(raw);
    return { usedBytes: used, limitBytes: Number.isFinite(limit as number) ? limit : null };
  } catch {
    return null;
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2).toLocaleString("pt-BR")} MB`;
  return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`;
}

function firstExistingFile(paths: string[]): string | null {
  for (const file of paths) {
    try {
      if (fs.existsSync(file)) return file;
    } catch { /* ignore */ }
  }
  return null;
}

function readVersion() {
  const shaFromEnv = process.env.BUILD_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const shaFile = firstExistingFile(["/app/BUILD_SHA", "/app/runtime/deployed-sha", "/opt/gondup/.deployed-sha"]);
  let sha = shaFromEnv;
  if (!sha && shaFile) {
    try { sha = fs.readFileSync(shaFile, "utf8").trim(); } catch { /* ignore */ }
  }
  const timeFromEnv = process.env.BUILD_TIME?.trim() || process.env.VERCEL_DEPLOYMENT_CREATED_AT?.trim() || "";
  let deployedAt: string | null = timeFromEnv || null;
  if (!deployedAt && shaFile) {
    try { deployedAt = fs.statSync(shaFile).mtime.toISOString(); } catch { /* ignore */ }
  }
  const statusFile = firstExistingFile(["/app/runtime/deploy-status.json", "/opt/gondup/runtime/deploy-status.json"]);
  if (statusFile) {
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, "utf8")) as { sha?: string; deployedAt?: string };
      if (!sha && status.sha) sha = status.sha;
      if (status.deployedAt) deployedAt = status.deployedAt;
    } catch { /* ignore */ }
  }
  return {
    sha: sha || null,
    shortSha: sha ? sha.slice(0, 7) : null,
    deployedAt,
    deployedAtLabel: deployedAt ? formatLiveErrorWhen(deployedAt) : null,
    available: Boolean(sha),
  };
}

function readMemory() {
  const cgroup = readCgroupMemory();
  const total = cgroup?.limitBytes || os.totalmem();
  const used = cgroup?.usedBytes ?? (os.totalmem() - os.freemem());
  const free = Math.max(0, total - used);
  const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
  return {
    usedBytes: used,
    totalBytes: total,
    freeBytes: free,
    usedPercent,
    usedLabel: formatBytes(used),
    totalLabel: formatBytes(total),
    source: "visto pelo aplicativo",
  };
}

function readDisk() {
  try {
    const stats = (fs as typeof fs & { statfsSync?: (path: string) => { bsize: number; blocks: number; bavail: number } }).statfsSync?.("/");
    if (!stats) return { available: false as const, message: "Não foi possível ler o espaço em disco deste aplicativo." };
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bavail;
    const used = Math.max(0, total - free);
    const usedPercent = total > 0 ? Math.round((used / total) * 100) : 0;
    return {
      available: true as const,
      usedBytes: used,
      totalBytes: total,
      freeBytes: free,
      usedPercent,
      usedLabel: formatBytes(used),
      totalLabel: formatBytes(total),
      freeLabel: formatBytes(free),
      source: "visto pelo aplicativo",
    };
  } catch {
    return { available: false as const, message: "Não foi possível ler o espaço em disco deste aplicativo." };
  }
}

async function readBackup() {
  const day = await latestCompletedBackupDay();
  let objectCount = 0;
  if (day) {
    try {
      const keys = await storageListKeys(`${BACKUP_PREFIX}/${day}`);
      objectCount = keys.length;
    } catch {
      objectCount = 0;
    }
  }
  if (!day) {
    return {
      ok: false as const,
      day: null,
      dayLabel: null,
      fresh: false,
      message: "Ainda não há um backup concluído registrado no aplicativo.",
      objectCount: 0,
    };
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(yesterdayDate);
  const fresh = day === today || day === yesterday;
  const [year, month, rest] = day.split("-");
  const dayLabel = `${rest}/${month}/${year}`;
  return {
    ok: fresh,
    day,
    dayLabel,
    fresh,
    objectCount,
    message: fresh
      ? `Backup de ${dayLabel} concluído${objectCount ? ` (${objectCount} arquivos no armazenamento)` : ""}.`
      : `O último backup concluído é de ${dayLabel}, fora das últimas 24 horas.`,
  };
}

async function readJobs() {
  const rows = await listLatestPlatformJobRuns([...SCHEDULED_JOBS]);
  const byJob = new Map(rows.map((row) => [row.job, row]));
  return SCHEDULED_JOBS.map((job) => {
    const row = byJob.get(job);
    if (!row) {
      return {
        job,
        label: JOB_LABEL[job],
        ok: null as boolean | null,
        summary: "Ainda não há registro neste aplicativo. A próxima rotina da madrugada passa a aparecer aqui.",
        finishedAt: null as string | null,
        finishedAtLabel: null as string | null,
      };
    }
    return {
      job,
      label: JOB_LABEL[job],
      ok: row.ok,
      summary: row.summary || (row.ok ? "Concluída com sucesso." : "A rotina falhou."),
      finishedAt: row.finishedAt ? new Date(row.finishedAt).toISOString() : null,
      finishedAtLabel: formatLiveErrorWhen(row.finishedAt),
    };
  });
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gondup-live-errors",
  };
}

async function findOpenGithubIssue(sentryIssueId: string): Promise<{ number: number; url: string } | null> {
  const token = githubToken();
  if (!token) return null;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&labels=${encodeURIComponent(GITHUB_LABEL)}&per_page=50`;
  const result = await fetchJson<Array<{ number: number; html_url: string; body?: string | null }>>(url, { headers: githubHeaders(token) });
  if (!result.ok || !Array.isArray(result.body)) return null;
  const marker = ISSUE_MARKER(sentryIssueId);
  const found = result.body.find((issue) => (issue.body || "").includes(marker));
  if (!found) return null;
  return { number: found.number, url: found.html_url };
}

async function ensureGithubLabel(token: string): Promise<void> {
  const result = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/labels/${encodeURIComponent(GITHUB_LABEL)}`, { headers: githubHeaders(token) });
  if (result.ok) return;
  await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/labels`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name: GITHUB_LABEL, color: "B45309", description: "Erro ao vivo no painel do GondUp" }),
  }).catch(() => undefined);
}

function issueBody(card: LiveErrorCard): string {
  return [
    "## Resumo",
    card.title,
    "",
    card.actionReason,
    "",
    `- Tela: ${card.place}`,
    `- Vezes nas últimas 24h: ${card.count24h}`,
    `- Vezes nos últimos 7 dias: ${card.count7d}`,
    `- Usuários afetados: ${card.userCount}`,
    `- Primeira vez: ${card.firstSeenLabel}`,
    `- Última vez: ${card.lastSeenLabel}`,
    card.sentryUrl ? `- Sentry: ${card.sentryUrl}` : "- Sentry: link indisponível",
    "",
    "## Detalhes técnicos",
    "```",
    card.technical,
    "```",
    "",
    "Este chamado foi aberto pelo painel Erros ao vivo. Ele não altera o código automaticamente — é só o pedido de correção.",
    "",
    ISSUE_MARKER(card.id),
  ].join("\n");
}

export const liveErrorsRouter = router({
  overview: platformProcedure.query(async () => {
    await ensureLiveErrorTables();
    const [errors, backup, jobs] = await Promise.all([loadErrorCards(), readBackup(), readJobs()]);
    const needsFix = errors.cards.filter((card) => card.action === "needs_fix");
    const expected = errors.cards.filter((card) => card.action === "expected");
    const needsFix24h = needsFix.filter((card) => card.count24h > 0).length;
    const grave24h = needsFix.filter((card) => card.count24h > 0 && card.severity === "grave").length;
    const expected24h = expected.filter((card) => card.count24h > 0).length;
    return {
      generatedAt: new Date().toISOString(),
      headline: liveErrorsHeadline({ needsFix24h, grave24h, expected24h }),
      needsFix24h,
      grave24h,
      expected24h,
      expectedTotal: expected.length,
      sentry: {
        configured: errors.sentryConfigured,
        error: errors.sentryError,
        pendingMessage: errors.sentryConfigured ? null : "Conexão com o Sentry pendente. Sem o token de leitura, a lista de erros dos usuários não aparece. O restante do painel funciona normalmente.",
      },
      github: {
        configured: Boolean(githubToken()),
        pendingMessage: githubToken() ? null : "Conexão com o GitHub pendente",
      },
      needsFix,
      expected,
      health: {
        backup,
        jobs,
        version: readVersion(),
        memory: readMemory(),
        disk: readDisk(),
        logs: {
          available: false,
          message: "Os erros dos usuários aparecem na lista acima. O arquivo de log do servidor não está acessível de dentro do aplicativo.",
        },
      },
    };
  }),

  requestFix: platformProcedure
    .input(z.object({ sentryIssueId: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (input.sentryIssueId === "sw-noise") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este agrupamento é ruído esperado e não vira pedido de correção." });
      }
      if (!githubToken()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conexão com o GitHub pendente." });
      }
      if (!sentryToken()) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Conexão com o Sentry pendente." });
      }
      await ensureLiveErrorTables();
      const existing = (await listLiveErrorOverrides()).find((row) => row.sentryIssueId === input.sentryIssueId && row.githubIssueUrl);
      if (existing?.githubIssueUrl) {
        const open = await findOpenGithubIssue(input.sentryIssueId);
        if (open || existing.githubIssueUrl) {
          return { alreadyOpen: true as const, url: open?.url || existing.githubIssueUrl, number: open?.number || existing.githubIssueNumber };
        }
      }
      const open = await findOpenGithubIssue(input.sentryIssueId);
      if (open) {
        await upsertLiveErrorOverride({
          sentryIssueId: input.sentryIssueId,
          classification: "needs_fix",
          githubIssueNumber: open.number,
          githubIssueUrl: open.url,
          updatedBy: actorOf(ctx),
        });
        return { alreadyOpen: true as const, url: open.url, number: open.number };
      }
      const issue = await fetchSentryIssue(input.sentryIssueId);
      if (!issue) throw new TRPCError({ code: "NOT_FOUND", message: "Não encontrei esse erro no Sentry." });
      const override = (await listLiveErrorOverrides()).find((row) => row.sentryIssueId === input.sentryIssueId);
      const card = toCard(issue, override);
      const token = githubToken()!;
      await ensureGithubLabel(token);
      const title = `[Erros ao vivo] ${card.title} — ${card.place}`.slice(0, 120);
      const created = await fetchJson<{ number: number; html_url: string }>(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
        method: "POST",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ title, body: issueBody(card), labels: [GITHUB_LABEL] }),
      });
      if (!created.ok || !created.body?.html_url) {
        throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível criar a issue no GitHub agora." });
      }
      await upsertLiveErrorOverride({
        sentryIssueId: input.sentryIssueId,
        classification: "needs_fix",
        githubIssueNumber: created.body.number,
        githubIssueUrl: created.body.html_url,
        updatedBy: actorOf(ctx),
      });
      return { alreadyOpen: false as const, url: created.body.html_url, number: created.body.number };
    }),

  markNormal: platformProcedure
    .input(z.object({ sentryIssueId: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      if (input.sentryIssueId === "sw-noise") {
        return { ok: true as const, sentryIgnored: false };
      }
      await ensureLiveErrorTables();
      const sentryIgnored = await setSentryIssueStatus(input.sentryIssueId, "ignored").catch(() => false);
      await upsertLiveErrorOverride({
        sentryIssueId: input.sentryIssueId,
        classification: "expected",
        sentryIgnored,
        updatedBy: actorOf(ctx),
      });
      return { ok: true as const, sentryIgnored };
    }),

  unmarkNormal: platformProcedure
    .input(z.object({ sentryIssueId: z.string().trim().min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await ensureLiveErrorTables();
      const current = (await listLiveErrorOverrides()).find((row) => row.sentryIssueId === input.sentryIssueId);
      if (current?.sentryIgnored) {
        await setSentryIssueStatus(input.sentryIssueId, "unresolved").catch(() => false);
      }
      await upsertLiveErrorOverride({
        sentryIssueId: input.sentryIssueId,
        classification: "needs_fix",
        sentryIgnored: false,
        githubIssueNumber: current?.githubIssueNumber ?? null,
        githubIssueUrl: current?.githubIssueUrl ?? null,
        updatedBy: actorOf(ctx),
      });
      return { ok: true as const };
    }),
});
