import express, { type Request, type Response, type NextFunction } from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { runScheduledMaintenance, runMissingPunchAlerts, runPhotoMaintenance } from "./scheduledMaintenance";
import { notifyOwner } from "./_core/notification";
import crypto from "node:crypto";

/** Headers de segurança básicos. */
function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
}

function timingSafeTokenEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const configuredSecret = process.env.SCHEDULE_SECRET;
      const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-schedule-secret"];
      if (!configuredSecret || typeof suppliedSecret !== "string" || !timingSafeTokenEqual(configuredSecret, suppliedSecret)) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const result = await runScheduledMaintenance();
      let missingPunch = null;
      try { missingPunch = await runMissingPunchAlerts(); } catch (e) { console.warn("[missing-punch]", e); }
      let photos = null;
      try { photos = await runPhotoMaintenance(); } catch (e) { console.warn("[photos]", e); }
      return res.json({ ok: true, result, missingPunch, photos });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await notifyOwner({ title: "Falha no backup diário", content: "O backup automático falhou." }).catch(() => undefined);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  
  app.post("/api/webhooks/asaas", express.json(), async (req, res) => {
    try {
      const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if (!configuredToken || !timingSafeTokenEqual(configuredToken, headerToken)) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }
      const body = req.body || {};
      const eventId = String(body.id || body.eventId || body.payment?.id || `${body.event || "evt"}_${Date.now()}`);
      const event = String(body.event || body.type || "UNKNOWN");
      const recorded = await (await import("./db")).recordPaymentEvent({
        eventId,
        event,
        paymentId: body.payment?.id ? undefined : undefined,
        subscriptionId: undefined,
        payload: JSON.stringify(body),
        processed: true,
      });
      if (recorded.duplicate) {
        return res.json({ ok: true, duplicate: true });
      }
      // Future: map Asaas events to subscription status updates
      return res.json({ ok: true, duplicate: false });
    } catch (error) {
      console.error("[Asaas webhook]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });

  app.use("/api/trpc", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
      },
    }));
    app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }
  return app;
}

let appPromise: ReturnType<typeof createApp> | null = null;
export default async function handler(req: any, res: any) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req as any, res as any);
}
