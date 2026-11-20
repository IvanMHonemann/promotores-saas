/* GondUp service worker — modo offline.
 * No build, o plugin "pwa-precache" (vite.config.ts) troca __BUILD_ID__ e a lista PRECACHE pelos arquivos do build,
 * então TODAS as telas (inclusive as carregadas sob demanda) abrem sem internet depois do primeiro acesso.
 * Atualização segura: a versão nova fica esperando até o usuário tocar em "Recarregar" (mensagem SKIP_WAITING).
 */
const BUILD_ID = "8a54883148ed";
const PRECACHE = ["/apple-touch-icon.png","/assets/AdminUsersPage-GX7I1vp-.js","/assets/AuditPage-j-oy6dGL.js","/assets/AuthShell-COcMB1pq.js","/assets/BrandLogo-CTulG7I2.js","/assets/CheckInOutPage-CEHGaNa8.js","/assets/Combination-BzVSwFBZ.js","/assets/CompanyAnnouncementsPage-fEtwwGhB.js","/assets/CompanyModulesPage-DekbcuMe.js","/assets/CompanyRegistryPage-BRX6nQD2.js","/assets/DashboardLayout-DJUkrC2j.js","/assets/ForgotPasswordPage-D0AkeLI8.js","/assets/KaTeX_AMS-Regular-BQhdFMY1.woff2","/assets/KaTeX_Caligraphic-Bold-Dq_IR9rO.woff2","/assets/KaTeX_Caligraphic-Regular-Di6jR-x-.woff2","/assets/KaTeX_Fraktur-Bold-CL6g_b3V.woff2","/assets/KaTeX_Fraktur-Regular-CTYiF6lA.woff2","/assets/KaTeX_Main-Bold-Cx986IdX.woff2","/assets/KaTeX_Main-BoldItalic-DxDJ3AOS.woff2","/assets/KaTeX_Main-Italic-NWA7e6Wa.woff2","/assets/KaTeX_Main-Regular-B22Nviop.woff2","/assets/KaTeX_Math-BoldItalic-CZnvNsCZ.woff2","/assets/KaTeX_Math-Italic-t53AETM-.woff2","/assets/KaTeX_SansSerif-Bold-D1sUS0GD.woff2","/assets/KaTeX_SansSerif-Italic-C3H0VqGB.woff2","/assets/KaTeX_SansSerif-Regular-DDBCnlJ7.woff2","/assets/KaTeX_Script-Regular-D3wIWfF6.woff2","/assets/KaTeX_Size1-Regular-mCD8mA8B.woff2","/assets/KaTeX_Size2-Regular-Dy4dx90m.woff2","/assets/KaTeX_Size4-Regular-Dl5lxZxV.woff2","/assets/KaTeX_Typewriter-Regular-CO6r4hn1.woff2","/assets/LandingPage-BGsNC0L3.js","/assets/LegalPage-X8TLa5Uy.js","/assets/LgpdPage-DD8padon.js","/assets/LoginPage-DyaRlncn.js","/assets/MemberRegistryFields-qrC1gBno.js","/assets/MyAccountPage-B3Tuk8jy.js","/assets/MyDataPage-BDMegvpm.js","/assets/MyMirrorPage-0b5QXvgC.js","/assets/MyReceiptsPage-Dwa1UeDb.js","/assets/MyVacationsPage-asLwSDEJ.js","/assets/OperationsDashboard-CAFLSyLm.js","/assets/PasswordInput-p9BYikcT.js","/assets/PaymentReminderBanner-DeoLBUzu.js","/assets/PaymentRequiredPage-BTYywc9X.js","/assets/PlatformAnnouncementsPage-Cx0j8B0u.js","/assets/PlatformAuditPage-CzKQqb-s.js","/assets/PlatformCheckInOutTestPage-Cuof93ks.js","/assets/PlatformCompaniesPage-dB4USzWj.js","/assets/PlatformDashboard-BWy3dC2X.js","/assets/PlatformDashboard-CyAuISp2.css","/assets/PlatformPontoLegalPage-BVjlYDeI.js","/assets/PlatformUsersPage-CZswlJhz.js","/assets/PontoLegalPage-qFfjIiIa.js","/assets/ProductsPage-DSa0J92P.js","/assets/PromoterClockPage-B2om4687.js","/assets/PromoterDashboard-vdQT29mp.js","/assets/PtBrDateFields-CJ49m3WG.js","/assets/PunchPanel-DKKTCo0D.js","/assets/ResetPasswordPage-Cj-elH6m.js","/assets/StoreForm-DtGa-Tdw.js","/assets/StoreGalleryPage-4jwQXB2A.js","/assets/StoresPage-BLIrU6Q3.js","/assets/TeamTimeBankPage-BlJDbBRX.js","/assets/TimeHmField-B1z6L5Km.js","/assets/TimesheetArchivePage-CuY1O2aa.js","/assets/TimesheetMirrorPage-BMehH96u.js","/assets/TimesheetPage-CUjhNHoV.js","/assets/TrashPage-C0KdryVn.js","/assets/VacationLockPage-D9vwa09r.js","/assets/VacationsPage-BoRcIQ5r.js","/assets/VisitCheckIn-B8XnD3nx.js","/assets/activity-UD2D7RkD.js","/assets/badge-DElj-EIT.js","/assets/ban-gPYMxh-U.js","/assets/brDocs-BalaMPXa.js","/assets/chevron-left-C8wBnMOp.js","/assets/chevron-right-LvK9o7Ij.js","/assets/circle-BoDIUq8a.js","/assets/circle-check-DFcpUH__.js","/assets/circle-x-B4gVdq1y.js","/assets/clipboard-check-CYYv6R1n.js","/assets/clock-CkXhrpbX.js","/assets/correctionGroups-Bp80eTYf.js","/assets/dialog-CbngXfyG.js","/assets/download-2ZvUvh32.js","/assets/downloadBase64-CuO_dwF-.js","/assets/ellipsis-vertical-DS_RJEAl.js","/assets/entitlements-CDKnqEkQ.js","/assets/expiry-DoOy2M6u.js","/assets/file-pen-line-DFYAQPO2.js","/assets/geo-DuUB1ej5.js","/assets/geocode-BEqN3CMh.js","/assets/gondup-promo-poster-BF7wa0TI.webp","/assets/image-B8e91ZaB.js","/assets/imageCompress-BSL8tws6.js","/assets/index-BdQq_4o_.js","/assets/index-D-J9cpsb.js","/assets/index-DoSlJwgb.js","/assets/index-uY8mbvMC.css","/assets/input-CWJim-dX.js","/assets/key-round-DXetMGU3.js","/assets/label-Blhflclk.js","/assets/labels-CdP9IQ2R.js","/assets/legalAcceptance-10abB38n.js","/assets/lock-keyhole-DzwANHLR.js","/assets/log-in-DmgqUsvb.js","/assets/log-out-DjbcTybk.js","/assets/message-circle-BIwatUme.js","/assets/minus-DEy_X-F5.js","/assets/mirrorExport-BlwG46ek.js","/assets/pause-B-Jx6Gd-.js","/assets/pencil-B2_kB3oA.js","/assets/photoStamp-JLuS9SZf.js","/assets/play-BITLRgQn.js","/assets/plus-FZtdBwGC.js","/assets/printer-CHN9-QYE.js","/assets/ptBrDate-DRjpN4Me.js","/assets/registryFields-CdaWh0x4.js","/assets/search-DbwkIhBR.js","/assets/select-6sabjNER.js","/assets/send-CTI2hvmm.js","/assets/share-2-Bn91I2h0.js","/assets/shield-check-rPqhdUx9.js","/assets/store-qQSl-SJs.js","/assets/textarea-D5e46H7T.js","/assets/timesheetMirror-B5j5iKwU.js","/assets/tree-palm-Z46IX5aI.js","/assets/trending-up-pLV4S12o.js","/assets/undoTrash-D_lfNP-u.js","/assets/useComposition-CZ1KLca5.js","/assets/useOfflineQuery-DR-7XMj4.js","/assets/user-CJe6JFq3.js","/assets/user-plus-p2D3vp1y.js","/assets/users-WEIIMXW6.js","/assets/zip-B7OiRlKX.js","/favicon.png","/gondup-icon.png","/gondup-lockup.png","/gondup-logo-sm.png","/gondup-logo.png","/gondup-logo.svg","/icon-192.png","/icon-512.png","/icon-maskable-512.png","/manifest.json","/promotores-icon.svg","/robots.txt","/sitemap.xml"];
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
