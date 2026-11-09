import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyWaitingUpdate } from "@/components/SwUpdatePrompt";
import { isStandaloneDisplay } from "@/pwa/hooks";

const SEEN_KEY = "gondup_app_version";

async function applyUpdate() {
  // Não apaga caches nem desregistra o service worker: isso destruiria o modo offline e a fila guardada.
  try { localStorage.setItem(SEEN_KEY, (window as any).__APP_VERSION || ""); } catch { /* ignore */ }
  await applyWaitingUpdate();
}

export default function UpdateAvailableBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const current = (window as any).__APP_VERSION as string | undefined;
    if (!current) return;
    let seen = "";
    try { seen = localStorage.getItem(SEEN_KEY) || ""; } catch { /* ignore */ }
    if (!seen) {
      try { localStorage.setItem(SEEN_KEY, current); } catch { /* ignore */ }
      return;
    }
    if (seen !== current) setVisible(true);
  }, []);

  if (!visible || !isStandaloneDisplay()) return null;

  return (
    <div className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-400/40 bg-gradient-to-r from-violet-600/25 to-fuchsia-600/20 p-4 shadow-lg shadow-violet-900/30">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-400 text-slate-950">
        <Download className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-violet-100">Nova versão do aplicativo disponível</p>
        <p className="mt-0.5 text-sm text-violet-200/90">
          Atualize para carregar as últimas correções e melhorias. Você continua logado.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="bg-violet-400 text-slate-950 hover:bg-violet-300" onClick={() => void applyUpdate()}>
            Atualizar agora
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-violet-300/40 text-violet-100 hover:bg-violet-500/20"
            onClick={() => {
              try { localStorage.setItem(SEEN_KEY, (window as any).__APP_VERSION || ""); } catch { /* ignore */ }
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
          try { localStorage.setItem(SEEN_KEY, (window as any).__APP_VERSION || ""); } catch { /* ignore */ }
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
