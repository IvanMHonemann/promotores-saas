import { describe, expect, it, vi, afterEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { buildAiBranchName, runPersistentGemini } from "./aiGithubService";

describe("cobrança manual: sem autoativação de plano", () => {
  const procedures = Object.keys((appRouter as any)._def.procedures);

  it("não expõe mockCheckout / mockCheckoutOpen em nenhum router", () => {
    expect(procedures.filter((name) => /mockCheckout/i.test(name))).toEqual([]);
  });

  it("billing só expõe consultas (nenhuma mutation de ativação)", () => {
    const billing = procedures.filter((name) => name.startsWith("billing."));
    expect(billing.sort()).toEqual(["billing.access", "billing.mySubscription", "billing.payments", "billing.plans"]);
    for (const name of billing) expect((appRouter as any)._def.procedures[name]._def.type).toBe("query");
  });

  it("db não exporta applyMockCheckout", () => {
    expect((db as any).applyMockCheckout).toBeUndefined();
  });

  it("o registro de pagamento continua restrito ao administrador da plataforma", () => {
    const registerPayment = procedures.filter((name) => /registerPayment/i.test(name));
    expect(registerPayment.length).toBeGreaterThan(0);
    for (const name of registerPayment) expect(name.startsWith("billing.")).toBe(false);
  });
});

describe("IA de suporte nunca grava na branch principal", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("gera nome de branch fora da main", () => {
    const name = buildAiBranchName(new Date("2026-11-05T12:00:00Z"));
    expect(name).toMatch(/^ai\/suporte-20261105120000-[a-z0-9]+$/);
  });

  it("cria branch + PR e nunca faz PATCH em refs/heads/main", async () => {
    vi.stubEnv("GITHUB_TOKEN", "t");
    vi.stubEnv("GEMINI_API_KEY", "k");
    const calls: Array<{ url: string; method: string; body?: any }> = [];
    const fetchMock = vi.fn(async (input: any, init: any = {}) => {
      const url = String(input);
      const method = init.method || "GET";
      calls.push({ url, method, body: init.body ? safeParse(init.body) : undefined });
      const json = (data: any) => ({ ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data });
      if (url.includes("generativelanguage.googleapis.com") && url.includes(":generateContent")) {
        return json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ reply: "ok", changes: [{ path: "client/src/index.css", content: "body{}", reason: "teste" }] }) }] } }] });
      }
      if (url.includes("generativelanguage.googleapis.com")) return json({ models: [] });
      if (url.includes("/git/ref/heads/")) return json({ object: { sha: "base" } });
      if (url.includes("/contents/")) return json({ sha: "s", content: Buffer.from("x").toString("base64"), encoding: "base64" });
      if (url.includes("/git/commits/base")) return json({ tree: { sha: "tree0" } });
      if (url.endsWith("/git/blobs")) return json({ sha: "blob" });
      if (url.endsWith("/git/trees")) return json({ sha: "tree1" });
      if (url.endsWith("/git/commits")) return json({ sha: "commit1" });
      if (url.endsWith("/git/refs")) return json({});
      if (url.endsWith("/pulls")) return json({ html_url: "https://github.com/o/r/pull/1" });
      return { ok: false, status: 404, text: async () => "{}", json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const result: any = await runPersistentGemini("altere o css do site");

    expect(result.changed).toBe(true);
    expect(result.pullRequestUrl).toBe("https://github.com/o/r/pull/1");
    const github = calls.filter((c) => c.url.startsWith("https://api.github.com"));
    expect(github.filter((c) => c.method === "PATCH")).toEqual([]);
    const refCreate = github.find((c) => c.method === "POST" && c.url.endsWith("/git/refs"));
    expect(refCreate?.body.ref).toMatch(/^refs\/heads\/ai\//);
    expect(refCreate?.body.ref).not.toBe("refs/heads/main");
    const pr = github.find((c) => c.method === "POST" && c.url.endsWith("/pulls"));
    expect(pr?.body.base).toBe("main");
    expect(pr?.body.head).toMatch(/^ai\//);
  });
});

function safeParse(value: string) {
  try { return JSON.parse(value); } catch { return undefined; }
}
