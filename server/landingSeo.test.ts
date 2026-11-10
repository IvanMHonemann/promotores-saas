import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";

const html = readFileSync("client/index.html", "utf8");
const landing = readFileSync("client/src/pages/LandingPage.tsx", "utf8");

describe("SEO e página inicial", () => {
  it("tem description, canonical, Open Graph e Twitter Card", () => {
    for (const tag of ['name="description"', 'rel="canonical"', 'property="og:title"', 'property="og:image"', 'name="twitter:card"']) expect(html).toContain(tag);
    expect(existsSync("client/public/og-image.png")).toBe(true);
  });
  it("robots.txt e sitemap.xml existem e não são reescritos para o app", () => {
    expect(readFileSync("client/public/robots.txt", "utf8")).toContain("Sitemap:");
    expect(readFileSync("client/public/sitemap.xml", "utf8")).toContain("<urlset");
    const vercel = JSON.parse(readFileSync("vercel.json", "utf8"));
    const spa = vercel.rewrites.find((r: { destination: string }) => r.destination === "/index.html");
    const re = new RegExp(`^${spa.source}$`);
    expect(re.test("/robots.txt")).toBe(false);
    expect(re.test("/sitemap.xml")).toBe(false);
    expect(re.test("/lojas")).toBe(true);
  });
  it("marca padronizada, sem jargão e com FAQ", () => {
    expect(landing).not.toMatch(/GONDUP/);
    expect(landing).not.toContain("multiempresa");
    expect(landing).toContain("Planos sob medida conforme o tamanho da equipe");
    expect(landing).toContain("Exemplo");
  });

  it("tem o vídeo mudo da landing, só carregado sob demanda", () => {
    expect(landing).toContain("<LandingPromoVideo");
    const video = readFileSync("client/src/components/LandingPromoVideo.tsx", "utf8");
    expect(video).toContain("Veja o GondUp em ação");
    expect(video).toContain("muted");
    expect(video).toContain('preload="none"');
    expect(video).toContain("IntersectionObserver");
    expect(video).toContain("prefers-reduced-motion");
    expect(video).toContain("Sem áudio");
    expect(existsSync("client/src/assets/promo/gondup-promo.mp4")).toBe(true);
    expect(existsSync("client/src/assets/promo/gondup-promo.webm")).toBe(true);
    expect(existsSync("client/src/assets/promo/gondup-promo-poster.webp")).toBe(true);
    const maxBytes = 2 * 1024 * 1024;
    expect(statSync("client/src/assets/promo/gondup-promo.mp4").size).toBeLessThan(maxBytes);
    expect(statSync("client/src/assets/promo/gondup-promo.webm").size).toBeLessThan(maxBytes);
  });
});
