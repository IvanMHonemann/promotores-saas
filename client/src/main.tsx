import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { isOnline, markServerReachable, markServerUnreachable } from "@/lib/connectivity";
import "./index.css";

const FORCE_RELOAD_VERSION = "v13";
// Tempo máximo de uma chamada à API. Sem isso, com sinal fraco (navigator.onLine
// ainda true) as telas ficavam em "carregando" para sempre.
const API_TIMEOUT_MS = 8000;
// Uploads de foto são maiores: dá mais tempo.
const API_UPLOAD_TIMEOUT_MS = 45000;
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
      // Não apaga o cache aqui: o novo service worker já removeu as versões antigas
      // e acabou de salvar o app para uso offline. Apagar tudo deixava o app sem
      // cópia offline logo após cada atualização.
      (window as any).location.reload();
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
      // Offline: não tenta 3x seguidas (cada tentativa esperaria o timeout).
      retry: (failureCount) => isOnline() && failureCount < 2,
      networkMode: "always",
    },
    mutations: { networkMode: "always" },
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
        const isUpload = String(typeof input === "string" ? input : (input as any)?.url ?? "").includes("uploadAndCreate");
        const timeoutMs = isUpload ? API_UPLOAD_TIMEOUT_MS : API_TIMEOUT_MS;
        // Sem rede no aparelho: falha na hora, sem esperar o timeout.
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          return Promise.reject(new TypeError("Sem conexão"));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(new DOMException("Tempo esgotado", "TimeoutError")), timeoutMs);
        const outer = init?.signal;
        if (outer) {
          if (outer.aborted) controller.abort(outer.reason);
          else outer.addEventListener("abort", () => controller.abort(outer.reason), { once: true });
        }
        return globalThis
          .fetch(input, { ...(init ?? {}), headers, credentials: "include", signal: controller.signal })
          .then((response) => {
            markServerReachable();
            return response;
          })
          .catch((error) => {
            // Falha de rede ou tempo esgotado (não cancelamento pedido pela tela).
            if (!outer?.aborted) markServerUnreachable();
            throw error;
          })
          .finally(() => clearTimeout(timer));
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
