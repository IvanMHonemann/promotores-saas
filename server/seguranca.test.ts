import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { neutralizeCsvFormula } from "../shared/csv";
import { isAllowedOrigin } from "./_core/originGuard";
import { __resetThrottleMemoryForTests, clearThrottle, isThrottled, nextEntryAfterFailure, registerThrottleFailure, THROTTLE_BLOCK_MS, THROTTLE_WINDOW_MS } from "./authThrottle";
import { detectImageMime, guardedStorageDelete, isDeletableMediaKey, isTenantMediaKey, safeKeySegment } from "./mediaKeys";

describe("chaves de arquivos (R2) por empresa", () => {
  it("aceita só chaves da própria empresa", () => {
    expect(isTenantMediaKey("store-photos/7/12/abc123_ab12cd34.jpg", 7)).toBe(true);
    expect(isTenantMediaKey("store-photos/8/12/abc123_ab12cd34.jpg", 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/70/12/a.jpg", 7)).toBe(false);
  });

  it("recusa backups, outras pastas e truques de caminho", () => {
    expect(isTenantMediaKey("backups/database/2026-11-05/member_accounts.00000.jsonl.gz", 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/7/../../backups/database/x.gz", 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/7//x.jpg", 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/7/a b.jpg", 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/7/x.jpg\u0000.png", 7)).toBe(false);
    expect(isTenantMediaKey("", 7)).toBe(false);
    expect(isTenantMediaKey(undefined, 7)).toBe(false);
    expect(isTenantMediaKey("store-photos/7/x.jpg", 0)).toBe(false);
    expect(isTenantMediaKey("corrections/7/1_1.jpg", 7)).toBe(false); // áreas extras só se pedidas
    expect(isTenantMediaKey("corrections/7/1_1.jpg", 7, ["store-photos", "corrections"])).toBe(true);
  });

  it("só permite apagar mídia de empresas (nunca backups)", () => {
    expect(isDeletableMediaKey("store-photos/7/12/x.jpg")).toBe(true);
    expect(isDeletableMediaKey("store-photos/7/12/x.jpg", 7)).toBe(true);
    expect(isDeletableMediaKey("store-photos/7/12/x.jpg", 8)).toBe(false);
    expect(isDeletableMediaKey("corrections/7/1_1.png", 7)).toBe(true);
    expect(isDeletableMediaKey("archives/7/2026/10/3/v1-espelho.pdf", 7)).toBe(true);
    expect(isDeletableMediaKey("backups/database/2026-11-05/_manifest.json")).toBe(false);
    expect(isDeletableMediaKey("store-photos/7/../../backups/database/_manifest.json")).toBe(false);
    expect(isDeletableMediaKey("qualquer-coisa.jpg")).toBe(false);
  });

  it("guardedStorageDelete não chama o storage para chave recusada", async () => {
    const del = vi.fn(async () => true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await guardedStorageDelete(del, "backups/database/2026-11-05/_manifest.json", 7)).toBe(false);
    expect(await guardedStorageDelete(del, "store-photos/8/1/x.jpg", 7)).toBe(false);
    expect(del).not.toHaveBeenCalled();
    expect(await guardedStorageDelete(del, "store-photos/7/1/x.jpg", 7)).toBe(true);
    expect(del).toHaveBeenCalledWith("store-photos/7/1/x.jpg");
    warn.mockRestore();
  });

  it("nenhum código do servidor apaga arquivo sem passar pela trava", () => {
    const root = __dirname;
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { walk(full); continue; }
        if (!full.endsWith(".ts") || full.endsWith(".test.ts")) continue;
        if (["storage.ts", "mediaKeys.ts", "backup.ts"].includes(name)) continue; // storage em si e a retenção do backup (prefixo fixo)
        const lines = readFileSync(full, "utf8").split("\n");
        lines.forEach((line, i) => {
          if (/\bstorageDelete(Many)?\(/.test(line) && !/guardedStorageDelete\(/.test(line) && !/^\s*(\/\/|\*)/.test(line)) offenders.push(`${name}:${i + 1}`);
        });
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });

  it("monta nome de arquivo seguro a partir de texto do cliente", () => {
    expect(safeKeySegment("../../backups/x")).toBe("______backups_x");
    expect(safeKeySegment("visit-12-start-abc")).toBe("visit-12-start-abc");
    expect(safeKeySegment(undefined, "sem-loja")).toBe("sem-loja");
    expect(safeKeySegment("a".repeat(200)).length).toBe(80);
  });

  it("detecta imagem pelo conteúdo", () => {
    expect(detectImageMime(Buffer.from("<html><script>x</script></html>"))).toBeNull();
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("image/jpeg");
  });
});

describe("proteção contra pedidos de outros sites (CSRF)", () => {
  const host = { host: "app.exemplo.com" };
  it("deixa passar leituras e chamadas sem cabeçalho de navegador (cron, webhook)", () => {
    expect(isAllowedOrigin({ ...host, origin: "https://evil.example" }, "GET")).toBe(true);
    expect(isAllowedOrigin(host, "POST")).toBe(true);
  });
  it("aceita POST da própria origem", () => {
    expect(isAllowedOrigin({ ...host, origin: "https://app.exemplo.com" }, "POST")).toBe(true);
    expect(isAllowedOrigin({ host: "interno", "x-forwarded-host": "app.exemplo.com", origin: "https://app.exemplo.com" }, "POST")).toBe(true);
  });
  it("recusa POST de outro site", () => {
    expect(isAllowedOrigin({ ...host, origin: "https://evil.example" }, "POST")).toBe(false);
    expect(isAllowedOrigin({ ...host, origin: "null" }, "POST")).toBe(false);
    expect(isAllowedOrigin({ ...host, origin: "lixo" }, "POST")).toBe(false);
    expect(isAllowedOrigin({ ...host, "sec-fetch-site": "cross-site" }, "POST")).toBe(false);
    expect(isAllowedOrigin({ ...host, origin: "https://app.exemplo.com.evil.example" }, "POST")).toBe(false);
  });
  it("aceita origem extra configurada", () => {
    expect(isAllowedOrigin({ ...host, origin: "https://outro.exemplo.com" }, "POST", ["https://outro.exemplo.com"])).toBe(true);
  });
});

describe("limite de tentativas (login/cadastro/recuperação)", () => {
  beforeEach(() => __resetThrottleMemoryForTests());

  it("bloqueia depois de 5 falhas e libera quando a janela passa", () => {
    let entry = nextEntryAfterFailure(undefined, 1_000);
    for (let i = 0; i < 3; i++) entry = nextEntryAfterFailure(entry, 2_000);
    expect(entry.blockedUntil).toBe(0);
    entry = nextEntryAfterFailure(entry, 3_000);
    expect(entry.failures).toBe(5);
    expect(entry.blockedUntil).toBe(3_000 + THROTTLE_BLOCK_MS);
    const later = nextEntryAfterFailure(entry, 1_000 + THROTTLE_WINDOW_MS + 1);
    expect(later).toEqual({ failures: 1, windowStartedAt: 1_000 + THROTTLE_WINDOW_MS + 1, blockedUntil: 0 });
  });

  it("registra, bloqueia e limpa por chave (sem banco, só memória)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const key = "login:alguem@exemplo.com";
    expect(await isThrottled(key)).toBe(false);
    for (let i = 0; i < 5; i++) await registerThrottleFailure(key);
    expect(await isThrottled(key)).toBe(true);
    expect(await isThrottled("login:outro@exemplo.com")).toBe(false);
    await clearThrottle(key);
    expect(await isThrottled(key)).toBe(false);
    warn.mockRestore();
  });
});

describe("planilhas (CSV)", () => {
  it("neutraliza fórmulas digitadas por usuários", () => {
    expect(neutralizeCsvFormula("=HYPERLINK(\"http://x\")")).toBe("'=HYPERLINK(\"http://x\")");
    expect(neutralizeCsvFormula("+1+1")).toBe("'+1+1");
    expect(neutralizeCsvFormula("-2+3")).toBe("'-2+3");
    expect(neutralizeCsvFormula("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizeCsvFormula("Leite integral")).toBe("Leite integral");
    expect(neutralizeCsvFormula(null)).toBe("");
    expect(neutralizeCsvFormula(10)).toBe("10");
  });
});
