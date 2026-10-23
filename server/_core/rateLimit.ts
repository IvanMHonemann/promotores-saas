/**
 * Rate limiter simples em memória.
 * Em serverless (Vercel), cada instância tem seu próprio contador.
 * Para proteção compartilhada, usar Redis ou TiDB.
 */

type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();

const LIMITS: Record<string, { max: number; windowMs: number }> = {
  login: { max: 5, windowMs: 60_000 },       // 5 tentativas por minuto
  api: { max: 100, windowMs: 60_000 },       // 100 req/min geral
  upload: { max: 10, windowMs: 60_000 },     // 10 uploads/min
};

export function checkRateLimit(key: string, bucket = "api"): { ok: boolean; remaining: number; resetAt: number } {
  const limit = LIMITS[bucket] || LIMITS.api;
  const now = Date.now();
  const fullKey = `${bucket}:${key}`;

  let entry = buckets.get(fullKey);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + limit.windowMs };
    buckets.set(fullKey, entry);
  }

  entry.count++;

  // Limpeza periódica
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }

  return {
    ok: entry.count <= limit.max,
    remaining: Math.max(0, limit.max - entry.count),
    resetAt: entry.resetAt,
  };
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
