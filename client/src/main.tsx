import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { authFetch } from "@/lib/authFetch";
import App from "./App";
import "./index.css";
import { initClientSentry } from "./sentry";
import { hydrateOfflineCache } from "@/lib/offlineCache";

initClientSentry();

const FORCE_RELOAD_VERSION = "v19";
(window as any).__APP_VERSION = FORCE_RELOAD_VERSION;
if (typeof window !== "undefined" && window.location.pathname === "/plataforma/teste-check-in-out") {
  localStorage.removeItem("promotores-saas-act-as");
  localStorage.removeItem("promotores-saas-auth-user");
}
// Captura o evento de instalação o quanto antes (antes do React montar), senão o botão some.
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    (window as any).__gondupDeferredPrompt = event;
  });
}

if ("serviceWorker" in navigator) {
  // Na primeira visita não existe service worker controlando a página. Quando o novo SW assume
  // (clients.claim), o evento controllerchange dispara, mas NÃO há versão antiga para trocar: recarregar
  // aí refazia o carregamento da página logo após abrir (tela em branco/lenta no primeiro acesso).
  const hadController = Boolean(navigator.serviceWorker.controller);
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.register("/sw.js").then((registration) => {
      void registration.update();
      window.addEventListener("online", () => void registration.update());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
      // App instalado: avisa e espera o usuário. Aba do navegador: aplica em silêncio (próximo reload/controllerchange).
      const announce = (worker: ServiceWorker | null) => {
        if (!worker || !navigator.serviceWorker.controller) return;
        (window as any).__gondupWaitingSW = worker;
        const standalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          Boolean((window.navigator as any).standalone);
        if (standalone) {
          window.dispatchEvent(new Event("gondup:sw-update"));
        } else {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      };
      if (registration.waiting) announce(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed") announce(worker);
        });
      });
    }).catch((error) => console.warn("Service worker não registrado", error));
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || refreshing) return;
      refreshing = true;
      // Não limpa o cache aqui: limpar no meio do reload (ex.: arrastar a tela) deixa tela branca.
      const reload = () => {
        let waited = 0;
        const tick = () => {
          if (((window as any).__gondupUploading || 0) > 0 && waited < 35_000) {
            waited += 500;
            setTimeout(tick, 500);
            return;
          }
          (window as any).location.reload();
        };
        tick();
      };
      reload();
    });
  });
}

// Se um chunk lazy (ex.: LoginPage) falhar ao carregar (deploy novo, rede instável), recarrega uma vez
// em vez de deixar a tela em branco. A trava evita loop de recarregamento.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const KEY = "promotores-saas-chunk-reload";
  const last = Number(sessionStorage.getItem(KEY) || 0);
  if (Date.now() - last < 30_000) return;
  sessionStorage.setItem(KEY, String(Date.now()));
  (window as any).location.reload();
});

// Android/iOS podem restaurar uma página antiga da memória ao voltar no histórico.
// Recarregar nessa situação garante que o usuário receba o deployment atual.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) (window as any).location.reload();
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Evita refetch desnecessário ao montar/focar: dados ficam válidos por 30s
      // e são recarregados automaticamente em mutações via invalidação do tRPC.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch: authFetch,
    }),
  ],
});

// Carrega o cache offline (IndexedDB) antes de montar, com limite de tempo para nunca travar a abertura.
void Promise.race([hydrateOfflineCache(), new Promise((r) => setTimeout(r, 1500))]).finally(() => createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
));
