import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const FORCE_RELOAD_VERSION = "v12";
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    let refreshing = false;
    navigator.serviceWorker.register(`/sw.js?version=${FORCE_RELOAD_VERSION}`).then((registration) => {
      void registration.update();
      window.addEventListener("online", () => void registration.update());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
      });
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) worker.postMessage({ type: "SKIP_WAITING" });
        });
      });
    }).catch((error) => console.warn("Service worker não registrado", error));
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      // Limpa cache antes de recarregar para evitar tela branca
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).finally(() => {
          (window as any).location.reload();
        });
      } else {
        (window as any).location.reload();
      }
    });
  });
}

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
      fetch(input, init) {
        const headers = new Headers(init?.headers || {});
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("promotores-saas-session-token") : null;
        if (token) {
          headers.set("x-session-token", token);
          headers.set("Authorization", `Bearer ${token}`);
        }
        try {
          const actAs = JSON.parse(localStorage.getItem("promotores-saas-act-as") || "null");
          if (actAs?.id) headers.set("x-act-as-company", String(actAs.id));
        } catch { /* sem modo "acessar como empresa" */ }
        return globalThis.fetch(input, { ...(init ?? {}), headers, credentials: "include" });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
