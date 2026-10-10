import { useEffect, useState } from "react";
import { Download, Loader2, Share, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt, useOnlineStatus } from "@/offline/hooks";

const IOS_HINT_KEY = "extinfy_ios_install_hint_dismissed";

export function PwaStatusBar() {
  const isOnline = useOnlineStatus();
  const { canInstall, install, isInstalling, installProgress, installStep, isIosInstallable, isStandalone } = useInstallPrompt();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [iosHintVisible, setIosHintVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone) return;
    if (!isIosInstallable) return;
    const dismissed = window.localStorage.getItem(IOS_HINT_KEY);
    if (!dismissed) setIosHintVisible(true);
  }, [isIosInstallable, isStandalone]);

  const dismissIosHint = () => {
    setIosHintVisible(false);
    try {
      window.localStorage.setItem(IOS_HINT_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div
        className={`fixed bottom-3 left-3 z-[70] flex max-w-[min(100vw-1.5rem,22rem)] flex-wrap items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur print:hidden ${
          isOnline ? "border-emerald-200 bg-emerald-50/95 text-emerald-800" : "border-red-200 bg-red-50/95 text-red-800"
        }`}
      >
        {isOnline ? <Wifi className="h-3.5 w-3.5 shrink-0" /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
        <span>{isOnline ? "Online" : "Offline — dados locais"}</span>
        {canInstall && !isInstalling && (
          <Button
            size="sm"
            className="ml-1 h-8 gap-1 rounded-full bg-red-600 px-3 text-xs font-extrabold text-white shadow-md shadow-red-600/30 hover:bg-red-700"
            onClick={() => void install()}
          >
            <Download className="h-3.5 w-3.5" /> Instalar aplicativo
          </Button>
        )}
        {isIosInstallable && !canInstall && (
          <Button
            size="sm"
            className="ml-1 h-8 gap-1 rounded-full bg-red-600 px-3 text-xs font-extrabold text-white shadow-md shadow-red-600/30 hover:bg-red-700"
            onClick={() => setShowIosGuide(true)}
          >
            <Download className="h-3.5 w-3.5" /> Instalar no iPhone
          </Button>
        )}
      </div>

      {/* Overlay de instalação com barra real de progresso */}
      {isInstalling && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/80 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              <div>
                <p className="text-base font-bold">Instalando Extinfy</p>
                <p className="text-xs text-slate-400">{installStep || "Processando…"}</p>
              </div>
            </div>
            <div className="mb-2 h-3 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-red-600 transition-all duration-300 ease-out"
                style={{ width: `${Math.max(4, installProgress)}%` }}
              />
            </div>
            <p className="text-right text-sm font-semibold text-slate-200">{installProgress}%</p>
            <ol className="mt-4 space-y-1.5 text-xs text-slate-400">
              <li className={installProgress >= 8 ? "text-emerald-400" : ""}>1. Preparar instalação</li>
              <li className={installProgress >= 40 ? "text-emerald-400" : ""}>2. Confirmar no sistema</li>
              <li className={installProgress >= 72 ? "text-emerald-400" : ""}>3. Instalar aplicativo</li>
              <li className={installProgress >= 100 ? "text-emerald-400" : ""}>4. Abrir fora do navegador</li>
            </ol>
          </div>
        </div>
      )}

      {iosHintVisible && isIosInstallable && (
        <div className="fixed bottom-16 left-3 right-3 z-[70] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl print:hidden sm:left-3 sm:right-auto">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Instalar o Extinfy no iPhone</p>
              <p className="mt-1 text-xs text-slate-600">
                No iPhone use o Safari: <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
            <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={dismissIosHint} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button size="sm" className="mt-3 w-full bg-red-600 text-white hover:bg-red-700" onClick={() => { setShowIosGuide(true); dismissIosHint(); }}>
            Ver passo a passo
          </Button>
        </div>
      )}

      {showIosGuide && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden" onClick={() => setShowIosGuide(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Como instalar no iPhone</h2>
              <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={() => setShowIosGuide(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">1</span>
                <span>Abra este site no <strong>Safari</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">2</span>
                <span className="flex items-center gap-1">Toque em <Share className="inline h-4 w-4 text-blue-600" /> <strong>Compartilhar</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">3</span>
                <span>Toque em <strong>Adicionar à Tela de Início</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">4</span>
                <span>Confirme em <strong>Adicionar</strong>.</span>
              </li>
            </ol>
            <Button className="mt-5 w-full bg-red-600 text-white hover:bg-red-700" onClick={() => setShowIosGuide(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
