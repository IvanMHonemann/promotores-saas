/**
 * Sentry no navegador. Ativo só se VITE_SENTRY_DSN estiver definido no build.
 * Sem dados pessoais: sem usuário/e-mail, sem cookies, URLs sem query string, chaves sensíveis filtradas.
 */
import * as Sentry from "@sentry/react";
import { scrubBreadcrumb, scrubClientEvent } from "./sentryScrub";

export { scrubClientEvent } from "./sentryScrub";

let started = false;

export function initClientSentry(): boolean {
  const dsn = (import.meta.env.VITE_SENTRY_DSN || "").trim();
  if (!dsn || started) return started;
  const rate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.05);
  Sentry.init({
    dsn,
    environment: (import.meta.env.VITE_SENTRY_ENVIRONMENT || "").trim() || import.meta.env.MODE || "production",
    // Plano gratuito: poucas amostras de desempenho (máx. 10%), sem replay de sessão.
    tracesSampleRate: Number.isFinite(rate) ? Math.min(Math.max(rate, 0), 0.1) : 0.05,
    // No SDK v11 o antigo "sendDefaultPii: false" foi substituído por dataCollection.
    dataCollection: { userInfo: false, cookies: false },
    beforeSend(event) {
      return scrubClientEvent(event as any) as typeof event;
    },
    beforeBreadcrumb(crumb) {
      return scrubBreadcrumb(crumb as any) as typeof crumb;
    },
  });
  started = true;
  return true;
}

export function captureClientException(error: unknown) {
  if (!started) return;
  Sentry.captureException(error);
}
