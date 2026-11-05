import crypto from "node:crypto";

/**
 * Autenticação dos endpoints /api/scheduled/*.
 * Aceita SCHEDULE_SECRET (agendadores externos / GitHub Actions) ou CRON_SECRET (Vercel Cron, que envia
 * "Authorization: Bearer <CRON_SECRET>" em requisições GET). Comparação em tempo constante.
 */
export function timingSafeTokenEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

type HeaderBag = { headers: Record<string, string | string[] | undefined> };

export function isScheduleRequestAuthorized(req: HeaderBag, env: NodeJS.ProcessEnv = process.env): boolean {
  const authorization = req.headers.authorization;
  const bearer = typeof authorization === "string" ? authorization.replace(/^Bearer\s+/i, "") : "";
  const header = req.headers["x-schedule-secret"];
  const supplied = bearer || (typeof header === "string" ? header : "");
  if (!supplied) return false;
  const secrets = [env.SCHEDULE_SECRET, env.CRON_SECRET].filter((v): v is string => Boolean(v));
  // avalia todos (sem curto-circuito) para não vazar qual segredo está configurado
  return secrets.map((secret) => timingSafeTokenEqual(secret, supplied)).some(Boolean);
}
