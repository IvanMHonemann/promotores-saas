import type { NextFunction, Request, Response } from "express";

/**
 * Proteção contra CSRF para a API: pedidos que alteram dados (POST etc.) só são aceitos quando vêm do
 * próprio site. Navegador sempre informa Origin (ou Sec-Fetch-Site) em pedidos entre sites; chamadas sem
 * esses cabeçalhos (cron, webhook, curl, app nativo) não são pedidos de navegador e passam normalmente.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function firstHeader(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value ?? "").split(",")[0].trim().toLowerCase();
}

export function isAllowedOrigin(
  headers: Record<string, string | string[] | undefined>,
  method: string,
  extraAllowed: string[] = [],
): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const origin = firstHeader(headers.origin);
  if (origin) {
    if (origin === "null") return false;
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return false;
    }
    const hosts = [firstHeader(headers["x-forwarded-host"]), firstHeader(headers.host)].filter(Boolean);
    if (hosts.includes(originHost)) return true;
    return extraAllowed.some((allowed) => {
      try { return new URL(allowed).host.toLowerCase() === originHost; } catch { return false; }
    });
  }
  const site = firstHeader(headers["sec-fetch-site"]);
  if (site === "cross-site") return false;
  return true;
}

export function originGuard(extraAllowed: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    const extras = [...extraAllowed, process.env.APP_PUBLIC_URL ?? ""].filter(Boolean);
    if (isAllowedOrigin(req.headers, req.method, extras)) return next();
    res.status(403).json({ error: "Origem não permitida." });
  };
}
