const CACHE_NAME = "promotores-saas-shell-v18";

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GondUp</title></head><body style="margin:0;background:#07111f;color:#fff;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div><p style="font-size:18px;margin:0 0 8px">Não foi possível carregar o app.</p><p style="color:#94a3b8;margin:0 0 16px">Puxe de novo ou toque no botão.</p><button onclick="location.reload()" style="background:#5eead4;color:#042f2e;border:0;border-radius:10px;padding:12px 18px;font-weight:700">Tentar de novo</button></div></body></html>`;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname === "/reset" || url.pathname === "/login" || url.pathname === "/clean") return;

  // Pull-to-refresh e navegação: rede primeiro. Nunca devolve cache quebrado.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request, { cache: "no-store" });
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", clone)).catch(() => undefined);
          return response;
        }
        throw new Error("bad navigation response");
      } catch {
        const shell = await caches.match("/");
        if (shell) return shell;
        return new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css") || url.pathname.includes("/assets/")) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          return response;
        }
        const cached = await caches.match(request);
        return cached || response;
      } catch {
        const cached = await caches.match(request);
        return cached || new Response("", { status: 503 });
      }
    })());
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
