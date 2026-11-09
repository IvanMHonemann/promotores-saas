import { useEffect, useState } from "react";
import { Download, Share, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { beginNativeInstallFromGesture, useInstallPrompt, useOnlineStatus, type PwaDebugInfo } from "@/pwa/hooks";

const IOS_HINT_KEY = "promotores_saas_ios_install_hint_dismissed";

function PwaDebugPanel() {
  const [info, setInfo] = useState<PwaDebugInfo | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("pwadebug") !== "1") return;
    setEnabled(true);
    const tick = () => setInfo(window.__gondupPwaDebug || null);
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, []);
  if (!enabled || !info) return null;
  return (
    <div
      data-testid="pwa-debug-panel"
      className="fixed right-2 top-2 z-[100] max-w-[min(100vw-1rem,22rem)] rounded-xl border border-amber-300/50 bg-slate-950/95 p-3 font-mono text-[10px] leading-relaxed text-amber-100 shadow-xl print:hidden"
    >
      <p className="mb-1 font-bold text-amber-300">PWA debug (?pwadebug=1)</p>
      <p>BIP: {info.hasDeferredPrompt ? "sim" : "não"}</p>
      <p>standalone: {info.standalone ? "sim" : "não"}</p>
      <p>SW controla: {info.swControlled ? "sim" : "não"}</p>
      <p>phase: {info.phase || "—"}</p>
      <p>instalando: {info.isInstalling ? "sim" : "não"}</p>
      <p>já instalou: {info.justInstalled ? "sim" : "não"}</p>
      <p>último outcome: {info.lastOutcome || "—"}</p>
      <p>erro: {info.lastError || "—"}</p>
      <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-all text-amber-200/80">
        {(info.transitions || []).slice(-12).join("\n") || "sem transitions"}
      </p>
      <p className="mt-1 break-all text-amber-200/70">{info.userAgent}</p>
    </div>
  );
}

export function PwaStatusBar() {
  const isOnline = useOnlineStatus();
  const {
    showInstallOffer,
    isInstalling,
    isIosInstallable,
    isStandalone,
    showOpenFallback,
  } = useInstallPrompt();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
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

  /** Chamada síncrona no clique: prompt() precisa do user-gesture do Chrome Android. */
  const onInstallClick = () => {
    const result = beginNativeInstallFromGesture();
    if (result === "prompting" || result === "busy") return;
    if (isIosInstallable) {
      setShowIosGuide(true);
      return;
    }
    setShowAndroidGuide(true);
  };

  return (
    <>
      <PwaDebugPanel />

      <div
        className={`pwa-online-pill fixed bottom-3 left-3 z-30 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow backdrop-blur print:hidden ${
          isOnline ? "border-emerald-400/40 bg-emerald-500/90 text-white" : "border-rose-300/40 bg-rose-500/90 text-white"
        }`}
      >
        {isOnline ? <Wifi className="h-3.5 w-3.5 shrink-0" /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
        <span>{isOnline ? "Online" : "Offline — dados locais"}</span>
      </div>

      {showInstallOffer && !isInstalling && !showOpenFallback && (
        <div className="pwa-install-cta fixed bottom-3 left-3 z-40 print:hidden">
          <Button
            size="sm"
            data-testid="pwa-install-button"
            className="h-9 gap-1.5 rounded-full bg-teal-400 px-3.5 text-xs font-bold text-slate-950 shadow-lg shadow-teal-900/30 hover:bg-teal-300"
            onClick={onInstallClick}
          >
            <Download className="h-4 w-4" /> Baixar aplicativo
          </Button>
        </div>
      )}

      {iosHintVisible && isIosInstallable && (
        <div className="fixed bottom-16 left-3 right-3 z-[70] mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl print:hidden sm:left-3 sm:right-auto">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold">Instalar o GondUp no iPhone</p>
              <p className="mt-1 text-xs text-slate-600">
                No iPhone use o Safari: <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>.
              </p>
            </div>
            <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={dismissIosHint} aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <Button
            size="sm"
            className="mt-3 w-full bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              setShowIosGuide(true);
              dismissIosHint();
            }}
          >
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
                <span>
                  Abra este site no <strong>Safari</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">2</span>
                <span className="flex items-center gap-1">
                  Toque em <Share className="inline h-4 w-4 text-blue-600" /> <strong>Compartilhar</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">3</span>
                <span>
                  Toque em <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">4</span>
                <span>
                  Confirme em <strong>Adicionar</strong>.
                </span>
              </li>
            </ol>
            <Button className="mt-5 w-full bg-red-600 text-white hover:bg-red-700" onClick={() => setShowIosGuide(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}

      {showAndroidGuide && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center print:hidden"
          onClick={() => setShowAndroidGuide(false)}
          data-testid="pwa-install-guide"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-5 text-slate-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Como baixar no Chrome</h2>
              <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100" onClick={() => setShowAndroidGuide(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">1</span>
                <span>
                  No <strong>Chrome</strong>, toque no menu <strong>⋮</strong> (canto superior direito).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">2</span>
                <span>
                  Escolha <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">3</span>
                <span>Confirme e abra o GondUp pelo ícone na tela inicial.</span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-slate-500">Se o botão Baixar não abrir o instalador, use este caminho pelo menu do Chrome.</p>
            <Button className="mt-4 w-full bg-teal-600 text-white hover:bg-teal-700" onClick={() => setShowAndroidGuide(false)}>
              Entendi
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
