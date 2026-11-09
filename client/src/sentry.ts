/**
 * Sentry no navegador. Ativo só se VITE_SENTRY_DSN estiver definido no build.
 */
import * as Sentry from "@sentry/react";

const SENSITIVE = /password|senha|token|authorization|cookie|cpf|cnpj/i;

export function scrubClientEvent<T extends Record<string, any>>(event: T): T {
  const copy: Record<string, any> = { ...event };
  if (copy.request?.headers) {
    for (const key of Object.keys(copy.request.headers)) {
      if (SENSITIVE.test(key)) copy.request.headers[key] = "[Filtered]";
    }
  }
  if (copy.user?.email) copy.user = { ...copy.user, email: "[Filtered]" };
  return copy as T;
}

let started = false;

export function initClientSentry(): boolean {
  const dsn = (import.meta.env.VITE_SENTRY_DSN || "").trim();
  if (!dsn || started) return started;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || "production",
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.05),
    // No SDK v11 o antigo "sendDefaultPii: false" foi substituído por dataCollection.
    dataCollection: { userInfo: false, cookies: false },
    beforeSend(event) {
      return scrubClientEvent(event as any) as typeof event;
    },
  });
  started = true;
  return true;
}

export function captureClientException(error: unknown) {
  if (!started) return;
  Sentry.captureException(error);
}
