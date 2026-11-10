/**
 * Limpeza de dados pessoais antes de enviar eventos do navegador ao Sentry.
 * Sem dependência do SDK (testável no Node).
 */
export const SENSITIVE_KEY = /password|senha|token|secret|authorization|cookie|cpf|cnpj|session|email/i;

/** Remove a query string das URLs (as consultas do tRPC levam os dados digitados em ?input=...). */
export function stripQuery(url: unknown): unknown {
  if (typeof url !== "string") return url;
  const i = url.indexOf("?");
  return i >= 0 ? `${url.slice(0, i)}?[Filtered]` : url;
}

export function scrubDeep(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => scrubDeep(v, depth + 1));
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = SENSITIVE_KEY.test(k) ? "[Filtered]" : scrubDeep(v, depth + 1);
  }
  return out;
}

export function scrubClientEvent<T extends Record<string, any>>(event: T): T {
  const copy: Record<string, any> = { ...event };
  if (copy.request) {
    const req = { ...copy.request };
    if (req.headers) req.headers = scrubDeep(req.headers);
    if (req.url) req.url = stripQuery(req.url);
    if (req.query_string) req.query_string = "[Filtered]";
    if (req.cookies) req.cookies = "[Filtered]";
    if (req.data) req.data = scrubDeep(req.data);
    copy.request = req;
  }
  if (copy.user) copy.user = copy.user.id != null ? { id: copy.user.id } : undefined;
  if (copy.extra) copy.extra = scrubDeep(copy.extra);
  if (copy.contexts) copy.contexts = scrubDeep(copy.contexts);
  if (Array.isArray(copy.breadcrumbs)) copy.breadcrumbs = copy.breadcrumbs.map((b: any) => scrubBreadcrumb(b));
  return copy as T;
}

export function scrubBreadcrumb<T extends Record<string, any> | null>(crumb: T): T {
  if (!crumb) return crumb;
  const c: Record<string, any> = { ...crumb };
  if (c.data) {
    const d = scrubDeep(c.data) as Record<string, any>;
    if (d && typeof d === "object") {
      if ("url" in d) d.url = stripQuery(d.url);
      if ("from" in d) d.from = stripQuery(d.from);
      if ("to" in d) d.to = stripQuery(d.to);
    }
    c.data = d;
  }
  // Texto de campos digitados não vem em breadcrumbs de clique, mas a mensagem pode trazer URL com consulta.
  if (typeof c.message === "string") c.message = c.message.replace(/\?[^\s"']*/g, "?[Filtered]");
  return c as T;
}
