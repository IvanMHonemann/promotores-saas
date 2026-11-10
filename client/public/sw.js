/* GondUp service worker — modo offline.
 * No build, o plugin "pwa-precache" (vite.config.ts) troca __BUILD_ID__ e a lista PRECACHE pelos arquivos do build,
 * então TODAS as telas (inclusive as carregadas sob demanda) abrem sem internet depois do primeiro acesso.
 * Atualização segura: a versão nova fica esperando até o usuário tocar em "Recarregar" (mensagem SKIP_WAITING).
 */
const BUILD_ID = "__BUILD_ID__";
const PRECACHE = /*__PRECACHE__*/[];
const SHELL_CACHE = "gondup-shell-" + BUILD_ID;
const RUNTIME_CACHE = "gondup-runtime-v1";
const NAV_TIMEOUT_MS = 4000;

const OFFLINE_HTML = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GondUp</title></head><body style="margin:0;background:#07111f;color:#fff;font-family:system-ui;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;padding:24px"><div><p style="font-size:18px;margin:0 0 8px">Sem internet e o app ainda não foi salvo neste aparelho.</p><p style="color:#94a3b8;margin:0 0 16px">Abra o GondUp uma vez com internet para usar offline.</p><button onclick="location.reload()" style="background:#5eead4;color:#042f2e;border:0;border-radius:10px;padding:12px 18px;font-weight:700">Tentar de novo</button></div></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Uma falha isolada (ex.: imagem grande) não impede a instalação.
    // Arquivos de /assets/ têm o hash do conteúdo no nome (nunca mudam): se a versão anterior já os salvou,
    // reaproveita a cópia em vez de baixar tudo de novo a cada atualização (só os arquivos novos vão à rede).
    await Promise.allSettled(["/", ...PRECACHE].map(async (url) => {
      if (url.startsWith("/assets/")) {
        const saved = await caches.match(url);
        if (saved && saved.ok) return cache.put(url, saved);
      }
      return cache.add(new Request(url, { cache: "reload" }));
    }));
    // Primeira instalação (nenhuma versão ativa): assume já. Atualização: espera o usuário aceitar.
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data && event.data.type === "GET_VERSION" && event.ports && event.ports[0]) event.ports[0].postMessage({ buildId: BUILD_ID });
});

async function putRuntime(request, response) {
  try { const cache = await caches.open(RUNTIME_CACHE); await cache.put(request, response); } catch (e) { /* sem espaço */ }
}

function timeout(ms) { return new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)); }

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;
  if (url.pathname === "/reset" || url.pathname === "/clean" || url.pathname === "/limpar.html") return;

  // Navegação (qualquer rota do app): rede primeiro com limite de tempo; sem rede, a tela salva.
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await Promise.race([fetch(request, { cache: "no-store" }), timeout(NAV_TIMEOUT_MS)]);
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((c) => c.put("/", copy)).catch(() => undefined);
          return response;
        }
        throw new Error("bad navigation response");
      } catch (e) {
        const shell = (await caches.match("/", { cacheName: SHELL_CACHE })) || (await caches.match("/"));
        return shell || new Response(OFFLINE_HTML, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
    return;
  }

  // Arquivos com hash (/assets/*): imutáveis, cache primeiro.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.ok) putRuntime(request, response.clone());
        return response;
      } catch (e) {
        return new Response("", { status: 503 });
      }
    })());
    return;
  }

  // Demais arquivos estáticos (ícones, manifest, logos): usa o salvo e atualiza em segundo plano.
  if (/\.(png|svg|ico|webp|jpg|jpeg|json|woff2?|css|js)$/.test(url.pathname) && url.pathname !== "/sw.js") {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      const network = fetch(request).then((response) => {
        if (response && response.ok) putRuntime(request, response.clone());
        return response;
      }).catch(() => undefined);
      return cached || (await network) || new Response("", { status: 503 });
    })());
  }
});
