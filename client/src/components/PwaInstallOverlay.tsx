import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/pwa/hooks";

/** Overlay de instalação no body — independente do botão Baixar / landing / saas-page. */
export function PwaInstallOverlay() {
  const {
    isInstalling,
    installProgress,
    installStep,
    showOpenFallback,
    openApp,
    dismissOpenFallback,
  } = useInstallPrompt();

  if (typeof document === "undefined") return null;
  if (!isInstalling && !showOpenFallback) return null;

  return createPortal(
    <>
      {isInstalling && (
        <div data-testid="pwa-install-progress" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
              <div>
                <p className="text-base font-bold">Baixando aplicativo…</p>
                <p className="text-xs text-slate-400">{installStep || "Aguarde…"}</p>
              </div>
            </div>
            <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-teal-400 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(4, installProgress)}%` }}
              />
            </div>
            <p className="text-right text-sm font-semibold text-slate-200">{installProgress}%</p>
            <ol className="mt-4 space-y-1.5 text-xs text-slate-400">
              <li className={installProgress >= 18 ? "text-emerald-400" : ""}>1. Baixando…</li>
              <li className={installProgress >= 48 ? "text-emerald-400" : ""}>2. Instalando…</li>
              <li className={installProgress >= 96 ? "text-emerald-400" : ""}>3. Pronto!</li>
            </ol>
          </div>
        </div>
      )}

      {showOpenFallback && !isInstalling && (
        <div data-testid="pwa-open-fallback" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-teal-300/30 bg-slate-900 p-5 text-white shadow-2xl">
            <p className="text-base font-bold">Aplicativo instalado</p>
            <p className="mt-1 text-sm text-slate-300">
              {installStep || "O GondUp está na sua tela inicial. Toque em Abrir ou no ícone GondUp."}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              No Android o Chrome não abre o app sozinho — use o botão abaixo ou o ícone na tela inicial.
            </p>
            <Button data-testid="pwa-open-app" className="mt-4 w-full bg-teal-400 text-slate-950 hover:bg-teal-300" onClick={() => openApp()}>
              Abrir aplicativo
            </Button>
            <button type="button" className="mt-2 w-full rounded-lg py-2 text-sm text-slate-400 hover:bg-white/5" onClick={() => dismissOpenFallback()}>
              Agora não
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
