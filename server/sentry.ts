/**
 * Monitoramento de erros (Sentry). Ativo só se SENTRY_DSN estiver definido.
 * Sem a variável: no-op (não envia nada), pronto para ativar na migração.
 */
import * as Sentry from "@sentry/node";
import type { ErrorRequestHandler } from "express";

const SENSITIVE_KEYS = /^(password|senha|token|secret|authorization|cookie|credit.?card|cpf|cnpj|ssn)$/i;

export function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.test(key)) return "[Filtered]";
  if (typeof value === "string" && /password|senha|Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value) && value.length > 20) {
    return "[Filtered]";
  }
  return value;
}

export function scrubObject(input: unknown, depth = 0): unknown {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => scrubObject(v, depth + 1));
  if (typeof input !== "object") return input;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = scrubValue(k, scrubObject(v, depth + 1));
  }
  return out;
}

let initialized = false;

export function isSentryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.SENTRY_DSN || "").trim());
}

export function initServerSentry(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = (env.SENTRY_DSN || "").trim();
  if (!dsn || initialized) return initialized;
  try {
    Sentry.init({
      dsn,
      environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV || "production",
      tracesSampleRate: Number(env.SENTRY_TRACES_SAMPLE_RATE || 0.05),
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request) {
          if (event.request.headers) {
            event.request.headers = scrubObject(event.request.headers) as Record<string, string>;
          }
          if (event.request.data) {
            event.request.data = scrubObject(event.request.data);
          }
          if (event.request.query_string && typeof event.request.query_string === "string") {
            event.request.query_string = event.request.query_string.replace(
              /(password|senha|token)=([^&]*)/gi,
              "$1=[Filtered]",
            );
          }
        }
        if (event.extra) event.extra = scrubObject(event.extra) as Record<string, unknown>;
        if (event.user) {
          delete (event.user as { ip_address?: string }).ip_address;
          if ((event.user as { email?: string }).email) {
            (event.user as { email?: string }).email = "[Filtered]";
          }
        }
        return event;
      },
    });
    initialized = true;
    console.log("[sentry] server monitoring enabled");
  } catch (error) {
    console.warn("[sentry] failed to init", error);
  }
  return initialized;
}

/** Middleware Express de erro do Sentry (no-op se não inicializado). */
export function sentryErrorHandler(): ErrorRequestHandler {
  if (!initialized) {
    return (err, _req, _res, next) => next(err);
  }
  return (err, _req, _res, next) => {
    Sentry.captureException(err);
    next(err);
  };
}

export function captureServerException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(scrubObject(context) as Record<string, unknown>);
    Sentry.captureException(error);
  });
}
