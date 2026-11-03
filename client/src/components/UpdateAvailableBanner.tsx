import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "gondup_update_banner_dismissed";

async function applyUpdate() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  window.location.href = "/reset";
}

export default function UpdateAvailableBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;
    const check = async () => {
      try {
        if (!("serviceWorker" in navigator)) return;
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        // Nova versão esperando ou SW diferente do atual
        if (reg.waiting || (reg.installing && navigator.serviceWorker.controller)) {
          if (!cancelled) setVisible(true);
          return;
        }
        // Força checagem
        await reg.update();
        if (reg.waiting) {
          if (!cancelled) setVisible(true);
        }
      } catch {
        /* ignore */
      }
    };
    void check();

    const onController = () => {
      if (!sessionStorage.getItem(DISMISS_KEY)) setVisible(true);
    };
    navigator.serviceWorker?.addEventListener("controllerchange", onController);
    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener("controllerchange", onController);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600/25 to-fuchsia-600/20 p-4 shadow-lg shadow-violet-900/30">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400 text-slate-950">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-violet-100">Nova versão do aplicativo disponível</p>
        <p className="mt-0.5 text-sm text-violet-200/90">
          Atualize para carregar as últimas correções e melhorias. O app será recarregado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-violet-400 text-slate-950 hover:bg-violet-300"
            onClick={() => void applyUpdate()}
          >
            Atualizar agora
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-violet-300/40 text-violet-100 hover:bg-violet-500/20"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, "1");
              setVisible(false);
            }}
          >
            Depois
          </Button>
        </div>
      </div>
      <button
        type="button"
        aria-label="Fechar aviso"
        className="shrink-0 rounded-lg p-1 text-violet-200 hover:bg-white/10"
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
