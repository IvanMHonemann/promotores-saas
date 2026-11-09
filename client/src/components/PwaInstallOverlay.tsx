import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/pwa/hooks";

/** Overlay de instalação no body — independente do botão Baixar / landing / saas-page. */
export function PwaInstallOverlay() {
  const { isInstalling, installStep, showReady, dismissReady } = useInstallPrompt();

  if (typeof document === "undefined") return null;
  if (!isInstalling && !showReady) return null;

  return createPortal(
    <>
      {isInstalling && (
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

      {showReady && !isInstalling && (
        <div data-testid="pwa-install-ready" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-teal-300/30 bg-slate-900 p-5 text-white shadow-2xl">
            <p className="text-base font-bold">Aplicativo instalado</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              {installStep || "Pronto! O GondUp foi instalado."}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-teal-100">
              Toque no ícone <strong>GondUp</strong> na sua tela inicial (ou em <strong>Abrir</strong> no aviso do Chrome).
            </p>
            <p className="mt-2 text-xs text-slate-400">
              O site no navegador não consegue abrir o app instalado sozinho — isso é limitação do Chrome no Android.
            </p>
            <Button data-testid="pwa-install-close" className="mt-4 w-full bg-teal-400 text-slate-950 hover:bg-teal-300" onClick={() => dismissReady()}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
