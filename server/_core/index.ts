import "dotenv/config";
import express, { type Express } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { runScheduledMaintenance } from "../scheduledMaintenance";
import { notifyOwner } from "./notification";
import crypto from "node:crypto";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** Build the Express app (shared by local server and Vercel serverless). */
export async function createApp(): Promise<Express> {
  const app = express();
  // Required behind reverse proxies so req.protocol and secure cookies work on HTTPS.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  
  app.post("/api/webhooks/asaas", express.json(), async (req, res) => {
    try {
      const token = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if (token && headerToken && token !== headerToken) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }
      const body = req.body || {};
      const eventId = String(body.id || body.eventId || body.payment?.id || `${body.event || "evt"}_${Date.now()}`);
      const event = String(body.event || body.type || "UNKNOWN");
      const recorded = await (await import("../db")).recordPaymentEvent({
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

app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const configuredSecret = process.env.SCHEDULE_SECRET;
      const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-schedule-secret"];
      if (!configuredSecret || typeof suppliedSecret !== "string" || suppliedSecret.length !== configuredSecret.length || !crypto.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const result = await runScheduledMaintenance();
      return res.json({ ok: true, result });
    } catch (error) {
      console.error("[Maintenance] Scheduled backup failed:", error);
      await notifyOwner({ title: "Falha no backup diário", content: "O backup automático e a limpeza programada falharam. Verifique os logs do projeto e o armazenamento persistente configurado." }).catch(() => undefined);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}

async function startServer() {
  const app = await createApp();
  const server = createServer(app);

  if (process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER === "true") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

// Local / Docker: start HTTP server. Vercel imports createApp() instead.
const isVercel = Boolean(process.env.VERCEL);
if (!isVercel) {
  startServer().catch(console.error);
}
