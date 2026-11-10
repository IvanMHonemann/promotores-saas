import { useEffect, useRef, useState } from "react";
import { Download, Share, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { beginNativeInstallFromGesture, useInstallPrompt, useOnlineStatus, type PwaDebugInfo } from "@/pwa/hooks";

const IOS_HINT_KEY = "promotores_saas_ios_install_hint_dismissed";
/** Até quando o botão flutuante "Baixar aplicativo" fica oculto (o item do menu continua). */
const INSTALL_PILL_HIDDEN_KEY = "gondup_install_pill_hidden_until";
const INSTALL_PILL_HIDE_MS = 7 * 24 * 60 * 60 * 1000;

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
      <p>related installed: {info.alreadyInstalled ? "sim" : "não"}</p>
      <p>relatedApps API: {info.relatedAppsApi || "—"}</p>
      <p>relatedApps: {info.relatedApps || "[]"}</p>
      <p>último outcome: {info.lastOutcome || "—"}</p>
      <p>erro: {info.lastError || "—"}</p>
      <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-all text-amber-200/80">
        {(info.transitions || []).slice(-12).join("\n") || "sem transitions"}
      </p>
      <p className="mt-1 break-all text-amber-200/70">{info.userAgent}</p>
    </div>
  );
}


/**
 * Esconde o botão flutuante enquanto ele estiver por cima de algo marcado com data-fab-avoid
 * (ex.: a linha Entrada/Intervalo/Retorno/Saída do ponto). Volta assim que a pessoa rola a tela.
 * Não muda nada no fluxo de instalação.
 */
function useCoversProtected(enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [covers, setCovers] = useState(false);
  useEffect(() => {
    if (!enabled) { setCovers(false); return; }
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const a = el.getBoundingClientRect();
      const hit = Array.from(document.querySelectorAll<HTMLElement>("[data-fab-avoid]")).some((n) => {
        const b = n.getBoundingClientRect();
        return b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      });
      setCovers(hit);
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(check); };
    schedule();
    const t = window.setInterval(schedule, 1500); // conteúdo carregado depois (ex.: ponto do dia)
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.clearInterval(t); window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); if (raf) cancelAnimationFrame(raf); };
  }, [enabled]);
  return { ref, covers };
}

export function PwaStatusBar() {
  const isOnline = useOnlineStatus();
  const {
    showInstallOffer,
    alreadyInstalled,
    isInstalling,
    isIosInstallable,
    isStandalone,
    showReady,
  } = useInstallPrompt();
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [pillHidden, setPillHidden] = useState(() => {
    try {
      if (typeof window === "undefined" || new URLSearchParams(window.location.search).get("pwadebug") === "1") return false;
      return Date.now() < Number(window.localStorage.getItem(INSTALL_PILL_HIDDEN_KEY) || 0);
    } catch { return false; }
  });
  const hidePill = () => {
    setPillHidden(true);
    try { window.localStorage.setItem(INSTALL_PILL_HIDDEN_KEY, String(Date.now() + INSTALL_PILL_HIDE_MS)); } catch { /* ignore */ }
  };
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

  const fab = useCoversProtected(showInstallOffer && !isInstalling && !showReady && !pillHidden);

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

      {showInstallOffer && !isInstalling && !showReady && !pillHidden && (
        <div
          ref={fab.ref}
          data-covers-protected={fab.covers ? "true" : undefined}
          className={`pwa-install-cta fixed bottom-3 left-3 z-40 flex items-center gap-1 transition-opacity duration-200 print:hidden ${fab.covers ? "pointer-events-none opacity-0" : "opacity-100"}`}
        >
          <Button
            size="sm"
            data-testid="pwa-install-button"
            className="h-9 gap-1.5 rounded-full bg-teal-400 px-3.5 text-xs font-bold text-slate-950 shadow-lg shadow-teal-900/30 hover:bg-teal-300"
            onClick={onInstallClick}
          >
            <Download className="h-4 w-4" /> Baixar aplicativo
          </Button>
          <button
            type="button"
            data-testid="pwa-install-hide"
            aria-label="Ocultar o botão Baixar aplicativo (continua no menu)"
            title="Ocultar (continua no menu)"
            onClick={hidePill}
            className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-slate-900/90 text-slate-200 shadow-lg hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {alreadyInstalled && !isStandalone && !isInstalling && !showReady && (
        <div
          data-testid="pwa-already-installed"
          className="pwa-install-cta fixed bottom-3 left-3 z-40 max-w-[min(100vw-1.5rem,18rem)] rounded-2xl border border-teal-300/30 bg-slate-900/95 px-3 py-2 text-[11px] font-semibold text-teal-100 shadow-lg print:hidden"
        >
          App já instalado — abra pelo ícone GondUp
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
