import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { shouldHandleInApp } from "../client/src/lib/spaNavigation";

const here = { origin: "https://gondup.com", pathname: "/" };
const click = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
function a(href: string, attrs: Record<string, string> = {}) {
  return {
    getAttribute: (k: string) => (k === "href" ? href : attrs[k] ?? null),
    hasAttribute: (k: string) => k in attrs,
    dataset: attrs["data-native-nav"] !== undefined ? { nativeNav: "" } : {},
  } as unknown as HTMLAnchorElement;
}

describe("menu sem recarregar a página", () => {
  it("troca de tela sem recarregar nos links internos do menu", () => {
    expect(shouldHandleInApp(a("/lojas"), click, here)?.pathname).toBe("/lojas");
    const u = shouldHandleInApp(a("/ponto?date=2026-11-10#correcoes"), click, here)!;
    expect(u.pathname + u.search + u.hash).toBe("/ponto?date=2026-11-10#correcoes");
    expect(shouldHandleInApp(a("/#roteiros"), click, { ...here, pathname: "/lojas" })?.hash).toBe("#roteiros");
  });
  it("mantém a recarga normal onde ela é necessária", () => {
    expect(shouldHandleInApp(a("https://wa.me/5551"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("//evil.com/x"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/lojas", { target: "_blank" }), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/api/x", {}), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/arquivo.pdf", {}), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/lojas", { download: "" }), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/reset"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/clean"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/plataforma/teste-check-in-out"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/lojas"), { ...click, ctrlKey: true }, here)).toBeNull();
    expect(shouldHandleInApp(a("/lojas"), { ...click, button: 1 }, here)).toBeNull();
    expect(shouldHandleInApp(a("/lojas"), { ...click, defaultPrevented: true }, here)).toBeNull();
    // Mesma tela com outro filtro/âncora: o navegador trata como antes.
    expect(shouldHandleInApp(a("/#roteiro"), click, here)).toBeNull();
    expect(shouldHandleInApp(a("/produtos?loja=3&novo=1"), click, { ...here, pathname: "/produtos" })).toBeNull();
    expect(shouldHandleInApp(a("#roteiro"), click, here)).toBeNull();
  });
});

describe("consultas de fotos sem DDL a cada pedido", () => {
  it("ensureStorePhotosTable roda o CREATE/ALTER uma vez por processo", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "modules/storePhotos.ts"), "utf8");
    expect(src).toMatch(/let storePhotosTableReady: Promise<void> \| null = null;/);
    expect(src).toMatch(/if \(!storePhotosTableReady\)/);
  });
});

describe("atualização do app reaproveita arquivos já salvos", () => {
  it("o service worker não baixa de novo os /assets/ com hash que já estão no aparelho", () => {
    const sw = fs.readFileSync(path.resolve(__dirname, "../client/public/sw.js"), "utf8");
    expect(sw).toMatch(/url\.startsWith\("\/assets\/"\)/);
    expect(sw).toMatch(/caches\.match\(url\)/);
  });
});
