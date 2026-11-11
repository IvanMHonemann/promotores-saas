import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/pwa/hooks";

/** Overlay de instalação no body — independente do botão Baixar / landing / saas-page. */
export function PwaInstallOverlay() {
  const { isInstalling, installStep, showReady, dismissReady, phase } = useInstallPrompt();

  if (typeof document === "undefined") return null;

  const openApp = () => {
    const target = window.location.origin + "/login";
    try {
      const w = window.open(target, "_blank", "noopener,noreferrer");
      if (w) {
        setTimeout(() => { try { w.close(); } catch { /* ignore */ } }, 300);
        dismissReady();
        return;
      }
    } catch { /* ignore */ }
    window.location.href = target;
  };

  // Mostra o overlay imediatamente no clique (prompting) e durante o progresso real.
  const showProgress = phase === "prompting" || phase === "progress" || isInstalling;
  if (!showProgress && !showReady) return null;

  return createPortal(
    <>
      {showProgress && (
        <div data-testid="pwa-install-progress" className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <Loader2 className="h-6 w-6 shrink-0 animate-spin text-teal-400" />
              <div>
                <p className="text-base font-bold leading-snug">
                  {installStep || "Instalando o GondUp… isso leva alguns segundos."}
                </p>
              </div>
            </div>
            {/* Progresso indeterminado — sem % falso */}
            <div className="h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full w-2/5 rounded-full bg-teal-400"
                style={{ animation: "gondup-indeterminate 1.4s ease-in-out infinite" }}
              />
            </div>
            <style>{`@keyframes gondup-indeterminate{0%{transform:translateX(-120%)}50%{transform:translateX(220%)}100%{transform:translateX(-120%)}}`}</style>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">
              O Chrome está preparando o aplicativo no aparelho. Mantemos esta tela até confirmar a instalação (quando possível).
            </p>
          </div>
        </div>
      )}

      {showReady && !showProgress && (
        <div data-testid="pwa-install-ready" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-teal-300/30 bg-slate-900 p-5 text-white shadow-2xl">
            <p className="text-base font-bold">Aplicativo instalado</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Clique em <strong>Abrir App</strong> ou verifique no seu celular.
            </p>
            <Button
              data-testid="pwa-install-open"
              className="mt-4 w-full bg-gradient-to-r from-teal-400 to-emerald-400 font-bold text-slate-950 hover:from-teal-300 hover:to-emerald-300"
              onClick={openApp}
            >
              Abrir App
            </Button>
            <Button data-testid="pwa-install-close" variant="ghost" className="mt-2 w-full text-slate-400 hover:text-white" onClick={() => dismissReady()}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
