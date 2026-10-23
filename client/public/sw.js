const CACHE_NAME = "promotores-saas-shell-v13";
// Navegação com sinal fraco: depois deste tempo usa o app salvo no aparelho.
const NAVIGATE_TIMEOUT_MS = 4000;

/** Baixa a página inicial e os JS/CSS que ela usa, para o app abrir sem internet. */
async function precacheShell() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch("/", { cache: "no-store" });
  if (!response.ok) return;
  const html = await response.clone().text();
  await cache.put("/", response);
  const assets = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)).map((m) => m[1]);
  await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheShell().catch(() => undefined).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (error) => { clearTimeout(timer); reject(error); });
  });
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname === "/healthz") return;
  if (url.pathname === "/reset" || url.pathname === "/login" || url.pathname === "/clean") return;

  // Navegações: rede primeiro (com tempo limite), fallback para o app salvo.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const network = fetch(request, { cache: "no-store" }).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", clone));
        }
        return response;
      });
      try {
        return await withTimeout(network, NAVIGATE_TIMEOUT_MS);
      } catch {
        const shell = await caches.match("/");
        if (shell) return shell;
        // Sem cópia salva: espera a rede mesmo.
        try { return await network; } catch { return new Response("Offline", { status: 503 }); }
      }
    })());
    return;
  }

  // Assets com hash no nome (/assets/...) nunca mudam: cache primeiro.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      }))
    );
    return;
  }

  // Outros JS/CSS/imagens do app: rede primeiro, cache como fallback.
  if (/\.(js|css|png|svg|json|ico|webp)$/.test(url.pathname)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || new Response("", { status: 503 });
        })
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
