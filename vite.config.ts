import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { defineConfig, loadEnv, type Plugin } from "vite";

/** Injeta o script de analytics só quando as variáveis existem (senão a URL ficava com %VITE_ANALYTICS_ENDPOINT% literal). */
function analyticsPlugin(): Plugin {
  let endpoint = "";
  let websiteId = "";
  return {
    name: "optional-analytics-script",
    configResolved(config) {
      const env = loadEnv(config.mode, config.envDir || process.cwd(), "VITE_");
      endpoint = (process.env.VITE_ANALYTICS_ENDPOINT || env.VITE_ANALYTICS_ENDPOINT || "").trim().replace(/\/+$/, "");
      websiteId = (process.env.VITE_ANALYTICS_WEBSITE_ID || env.VITE_ANALYTICS_WEBSITE_ID || "").trim();
    },
    transformIndexHtml() {
      if (!endpoint || !websiteId) return [];
      return [{ tag: "script", attrs: { defer: true, src: `${endpoint}/umami`, "data-website-id": websiteId }, injectTo: "body" as const }];
    },
  };
}

/**
 * Modo offline: depois do build, grava no sw.js a lista de arquivos do app (precache) e um id da versão.
 * Assim o service worker salva todas as telas no primeiro acesso, e cada deploy vira uma versão nova do SW.
 */
function pwaPrecachePlugin(): Plugin {
  let outDir = "";
  return {
    name: "pwa-precache",
    apply: "build",
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const swPath = path.join(outDir, "sw.js");
      if (!fs.existsSync(swPath)) return;
      // Só o que as telas do app usam: parte da entrada e segue imports estáticos e as telas carregadas sob demanda
      // (import() do nosso código). Pacotes pesados carregados sob demanda por bibliotecas (realce de código,
      // diagramas) ficam de fora e são salvos só se forem usados.
      const manifestPath = path.join(outDir, ".vite", "manifest.json");
      const manifest: Record<string, { file: string; imports?: string[]; dynamicImports?: string[]; css?: string[]; assets?: string[]; isEntry?: boolean }> = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, "utf8")) : {};
      const set = new Set<string>();
      const seen = new Set<string>();
      const visit = (key: string) => {
        if (seen.has(key) || !manifest[key]) return;
        seen.add(key);
        const m = manifest[key];
        set.add("/" + m.file);
        for (const c of m.css || []) set.add("/" + c);
        for (const asset of m.assets || []) if (!/\.(ttf|woff)$/.test(asset)) set.add("/" + asset);
        for (const i of m.imports || []) visit(i);
        if (!key.includes("node_modules") && !key.startsWith("_")) for (const d of m.dynamicImports || []) visit(d);
      };
      for (const [key, m] of Object.entries(manifest)) if (m.isEntry) visit(key);
      // Ícones e arquivos pequenos da pasta public (manifest, logos).
      for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
        if (!entry.isFile()) continue;
        const rel = "/" + entry.name;
        if (rel === "/sw.js" || rel === "/index.html" || rel === "/limpar.html" || rel === "/manus-routes.json" || rel.startsWith("/.") || rel.startsWith("/landing") || rel === "/og-image.png") continue;
        if (fs.statSync(path.join(outDir, entry.name)).size > 300_000) continue;
        set.add(rel);
      }
      const files = [...set].filter((f) => !f.endsWith(".map"));
      files.sort();
      const hash = crypto.createHash("sha256").update(files.join("\n")).update(fs.readFileSync(path.join(outDir, "index.html"))).digest("hex").slice(0, 12);
      const sw = fs.readFileSync(swPath, "utf8").replace('const BUILD_ID = "__BUILD_ID__"', `const BUILD_ID = "${hash}"`).replace("/*__PRECACHE__*/[]", JSON.stringify(files));
      fs.writeFileSync(swPath, sw);
      console.log(`[pwa-precache] ${files.length} arquivos no precache, versão ${hash}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), analyticsPlugin(), pwaPrecachePlugin()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Usado pelo plugin pwa-precache para saber quais arquivos cada tela precisa.
    manifest: true,
  },
  server: {
    host: true,
    hmr: false,
    allowedHosts: ["localhost", "127.0.0.1", ".monkeycode-ai.live"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
