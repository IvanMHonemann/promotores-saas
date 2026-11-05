import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
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

export default defineConfig({
  plugins: [react(), tailwindcss(), analyticsPlugin()],
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
  },
  server: {
    host: true,
    hmr: false,
    allowedHosts: ["localhost", "127.0.0.1", ".monkeycode-ai.live"],
    fs: { strict: true, deny: ["**/.*"] },
  },
});
