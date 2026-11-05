import { describe, expect, it } from "vitest";
import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "net";
import { BODY_TOO_LARGE_MESSAGE, MAX_BODY_SIZE, MAX_PHOTO_BASE64_CHARS, isPayloadTooLargeError, payloadTooLargeBody } from "../shared/uploadLimits";

describe("limites de envio", () => {
  it("foto máxima cabe no limite do corpo (4,5 MB da Vercel)", () => {
    expect(MAX_PHOTO_BASE64_CHARS + 50_000).toBeLessThan(4500 * 1024);
    expect(MAX_BODY_SIZE).toBe("4500kb");
  });
  it("identifica erro de corpo grande e monta resposta no formato tRPC", () => {
    expect(isPayloadTooLargeError({ type: "entity.too.large", status: 413 })).toBe(true);
    expect(isPayloadTooLargeError(new Error("x"))).toBe(false);
    expect(payloadTooLargeBody("storePhotos.uploadAndCreate").error.json.message).toBe(BODY_TOO_LARGE_MESSAGE);
  });
  it("Express responde 413 com mensagem em pt-BR", async () => {
    const app = express();
    app.disable("x-powered-by");
    app.use(express.json({ limit: "1kb" }));
    app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => isPayloadTooLargeError(err) ? res.status(413).json(payloadTooLargeBody()) : next(err));
    app.post("/x", (_req, res) => res.json({ ok: true }));
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;
    try {
      const r = await fetch(`http://127.0.0.1:${port}/x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ a: "x".repeat(5000) }) });
      expect(r.status).toBe(413);
      expect(r.headers.get("x-powered-by")).toBeNull();
      expect((await r.json()).error.json.message).toBe(BODY_TOO_LARGE_MESSAGE);
    } finally { server.close(); }
  });
});
