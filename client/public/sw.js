const CACHE_NAME = "promotores-saas-shell-v4";
const APP_SHELL = ["/", "/manifest.json", "/promotores-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
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
  // APIs sempre usam a rede; nunca reutilizamos respostas antigas da API.
  if (url.pathname.startsWith("/api")) return;

  // Navegações para rotas da SPA sempre vêm do deployment atual. Uma shell
  // antiga pode referenciar um bundle removido e deixar a página totalmente branca.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const shell = await caches.match("/");
        return shell || new Response("Offline", { status: 503, statusText: "Offline" });
      })
    );
    return;
  }

  // Network-first para HTML, JS, CSS e demais arquivos: online, sempre revalida
  // o deployment atual; o cache permanece apenas como fallback offline.
  event.respondWith(
    fetch(request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok) {
          const cacheKey = request.mode === "navigate" ? "/" : request;
          void caches.open(CACHE_NAME).then((cache) => cache.put(cacheKey, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        return new Response("Offline", { status: 503, statusText: "Offline" });
      })
  );
});
