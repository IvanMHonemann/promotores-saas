/* GondUp service worker — modo offline.
 * No build, o plugin "pwa-precache" (vite.config.ts) troca __BUILD_ID__ e a lista PRECACHE pelos arquivos do build,
 * então TODAS as telas (inclusive as carregadas sob demanda) abrem sem internet depois do primeiro acesso.
 * Atualização segura: a versão nova fica esperando até o usuário tocar em "Recarregar" (mensagem SKIP_WAITING).
 */
const BUILD_ID = "d7309afc3777";
const PRECACHE = ["/apple-touch-icon.png","/assets/AdminUsersPage-DxAyz6n6.js","/assets/AuditPage-Bpac_D1Y.js","/assets/AuthShell-CK5FBYMS.js","/assets/BrandLogo-CszUrK7c.js","/assets/CheckInOutPage-D2BT9MFP.js","/assets/Combination-B4kqTkkh.js","/assets/CompanyModulesPage-BXdSP1NE.js","/assets/DashboardLayout-CuL7jMXb.js","/assets/ForgotPasswordPage-D2sc8SrM.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","/assets/LandingPage-4qDgXkDG.js","/assets/LegalPage-BddJyBUr.js","/assets/LgpdPage-BpGFffAF.js","/assets/LoginPage-DuO21IuR.js","/assets/MyAccountPage-CnUZkmss.js","/assets/MyDataPage-D8QrO8RF.js","/assets/MyMirrorPage-BtBgo3nY.js","/assets/MyReceiptsPage-DOL9uHjO.js","/assets/MyVacationsPage-1IKzAzp1.js","/assets/OperationsDashboard-Cee5fqa1.js","/assets/PasswordInput-9q2dyWLR.js","/assets/PaymentReminderBanner-D1_HaI9B.js","/assets/PaymentRequiredPage-Dj4KjZtP.js","/assets/PlatformAuditPage-x9VLY3m4.js","/assets/PlatformCheckInOutTestPage-B_65AvR4.js","/assets/PlatformCompaniesPage-BgePJRET.js","/assets/PlatformDashboard-CiFTQX_L.js","/assets/PlatformDashboard-CyAuISp2.css","/assets/PlatformPontoLegalPage-5H2V-XrG.js","/assets/PlatformUsersPage-COzgUIBU.js","/assets/PontoLegalPage-TqyiH2h_.js","/assets/ProductsPage-DBMxk7tX.js","/assets/PromoterClockPage-_y7MrBs0.js","/assets/PromoterDashboard-BJ93l7hn.js","/assets/PunchPanel-C5q24V0I.js","/assets/ResetPasswordPage-BOYd2T4j.js","/assets/StoreForm-Cm_wS41T.js","/assets/StoreGalleryPage-BPZmGlTY.js","/assets/StoresPage-DvVn9wff.js","/assets/TeamTimeBankPage-BGSY_IVH.js","/assets/TimesheetArchivePage-vHSmgtSC.js","/assets/TimesheetMirrorPage-C9OiNtAi.js","/assets/TimesheetPage-CT9bJChQ.js","/assets/TrashPage-lVCY4ODb.js","/assets/VacationsPage-Ce7tUE2D.js","/assets/VisitCheckIn-D1LUs-5V.js","/assets/activity-BkvVzLoo.js","/assets/badge-Bxm8QV0M.js","/assets/ban-IqfngNz8.js","/assets/chevron-left-BAAS5Pre.js","/assets/chevron-right-DkSCUN-e.js","/assets/circle-DaRRA5OB.js","/assets/circle-check-CzhJhP6p.js","/assets/circle-x-WurG5vKC.js","/assets/clipboard-check-D5b8pWsh.js","/assets/clock-BuHLByTV.js","/assets/correctionGroups-Bp80eTYf.js","/assets/dialog-B3f2VknQ.js","/assets/download-vdwAIUiH.js","/assets/downloadBase64-CuO_dwF-.js","/assets/ellipsis-vertical-BN_TQGTi.js","/assets/entitlements-BfNfSW62.js","/assets/expiry-DoOy2M6u.js","/assets/file-pen-line-Duodur4l.js","/assets/file-text-XB_js9lX.js","/assets/geo-DuUB1ej5.js","/assets/geocode-YxkbSOzR.js","/assets/gondup-promo-poster-BF7wa0TI.webp","/assets/image-DjMdJT0L.js","/assets/imageCompress-gICoTnOH.js","/assets/index-BdQq_4o_.js","/assets/index-BhWUXBna.js","/assets/index-DoSlJwgb.js","/assets/index-_JyWio1r.css","/assets/input-4tmkNXPI.js","/assets/key-round-CLRPKgXD.js","/assets/label-Bcdogqf4.js","/assets/labels-CdP9IQ2R.js","/assets/lock-keyhole-rnGYn7CX.js","/assets/log-in-Bu6cmcdu.js","/assets/message-circle-LF3wWO3P.js","/assets/minus-CtS_iFBU.js","/assets/mirrorExport-CxukyNJ0.js","/assets/pencil-DXqVP2V8.js","/assets/photoStamp-VasWdsoP.js","/assets/play-C0EXtUfp.js","/assets/plus-C3E8NOmF.js","/assets/printer-pbxiuKWo.js","/assets/search-CNMdxzHl.js","/assets/select-DABogDf8.js","/assets/send-DNeCt2vT.js","/assets/share-2-DXrEp_hI.js","/assets/shield-check-DOBvGVUa.js","/assets/store-ziCRce87.js","/assets/textarea-Du266CzY.js","/assets/trending-up-CzSZb4jk.js","/assets/undoTrash-Chweqnyp.js","/assets/useComposition-DiOF8ObE.js","/assets/useOfflineQuery-BY142yVt.js","/assets/user-CAu7074i.js","/assets/users-xQi9mY5h.js","/assets/zip-B7OiRlKX.js","/favicon.png","/gondup-icon.png","/gondup-lockup.png","/gondup-logo-sm.png","/gondup-logo.png","/gondup-logo.svg","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/manifest.json","/promotores-icon.svg","/robots.txt","/sitemap.xml"];
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
