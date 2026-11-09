import { useCallback, useEffect, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaDebugInfo = {
  hasDeferredPrompt: boolean;
  standalone: boolean;
  userAgent: string;
  lastOutcome: string;
  lastError: string;
  isInstalling: boolean;
  justInstalled: boolean;
  swControlled: boolean;
};

declare global {
  interface Window {
    __gondupDeferredPrompt?: BeforeInstallPromptEvent | null;
    __gondupPwaDebug?: PwaDebugInfo;
  }
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as { standalone?: boolean }).standalone)
  );
}

export function useOnlineStatus() {
  const get = () => (typeof navigator === "undefined" ? true : navigator.onLine);
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("online", onStoreChange);
      window.addEventListener("offline", onStoreChange);
      return () => {
        window.removeEventListener("online", onStoreChange);
        window.removeEventListener("offline", onStoreChange);
      };
    },
    get,
    () => true,
  );
}

type InstallStore = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalling: boolean;
  installProgress: number;
  installStep: string;
  showOpenFallback: boolean;
  justInstalled: boolean;
  isIosDevice: boolean;
  isStandalone: boolean;
  lastOutcome: string;
  lastError: string;
};

/** Tempo mínimo da barra após o aceite (WebAPK demora segundos para mintar). */
const MIN_OVERLAY_MS = 5500;
const INSTALL_TIMEOUT_MS = 20_000;

const listeners = new Set<() => void>();
let store: InstallStore = {
  deferredPrompt: typeof window === "undefined" ? null : window.__gondupDeferredPrompt || null,
  isInstalling: false,
  installProgress: 0,
  installStep: "",
  showOpenFallback: false,
  justInstalled: false,
  isIosDevice: false,
  isStandalone: typeof window === "undefined" ? false : isStandaloneDisplay(),
  lastOutcome: "",
  lastError: "",
};

function emit() {
  for (const l of listeners) l();
}

function patch(partial: Partial<InstallStore>) {
  store = { ...store, ...partial };
  syncDebug();
  emit();
}

function getStore() {
  return store;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function logPwa(...args: unknown[]) {
  try {
    console.info("[gondup-pwa]", ...args);
  } catch {
    /* ignore */
  }
}

function syncDebug() {
  if (typeof window === "undefined") return;
  window.__gondupPwaDebug = {
    hasDeferredPrompt: Boolean(store.deferredPrompt || window.__gondupDeferredPrompt),
    standalone: store.isStandalone || isStandaloneDisplay(),
    userAgent: navigator.userAgent || "",
    lastOutcome: store.lastOutcome,
    lastError: store.lastError,
    isInstalling: store.isInstalling,
    justInstalled: store.justInstalled,
    swControlled: Boolean(navigator.serviceWorker?.controller),
  };
}

let bootstrapped = false;
let progressTicker: ReturnType<typeof setInterval> | null = null;
let completeTimer: ReturnType<typeof setTimeout> | null = null;

/** Sessão do fluxo iniciado pelo nosso botão (aceite → barra → pronto). */
let session = {
  /** Usuário aceitou o diálogo nativo (ou vamos mostrar progresso mesmo assim). */
  accepted: false,
  /** Evento appinstalled já chegou (no Android dispara no aceite, antes do WebAPK). */
  gotAppInstalled: false,
  /** Timestamp do aceite — barra fica pelo menos MIN_OVERLAY_MS. */
  acceptedAt: 0,
  completing: false,
};

function clearProgressTicker() {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
}

function clearCompleteTimer() {
  if (completeTimer) {
    clearTimeout(completeTimer);
    completeTimer = null;
  }
}

function appStartUrl() {
  return `${window.location.origin}/?installed=1&utm_source=pwa_install`;
}

/**
 * Melhor esforço para abrir o WebAPK. No Chrome Android a página NÃO consegue
 * forçar o app instalado; window.open/_blank com gesto do usuário é o que mais
 * ajuda (link capture). Evitamos location.assign — só recarrega a aba do Chrome.
 * @see https://web.dev/learn/pwa/detection
 */
function tryOpenInstalledApp(reason: string) {
  const appUrl = appStartUrl();
  logPwa("tryOpenInstalledApp", reason, appUrl);
  try {
    const win = window.open(appUrl, "_blank", "noopener,noreferrer");
    if (win) {
      try {
        win.focus();
      } catch {
        /* ignore */
      }
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

function startProgressStages() {
  clearProgressTicker();
  patch({
    isInstalling: true,
    showOpenFallback: false,
    justInstalled: false,
    installStep: "Baixando aplicativo…",
    installProgress: 18,
  });
  const started = Date.now();
  progressTicker = setInterval(() => {
    if (!store.isInstalling) {
      clearProgressTicker();
      return;
    }
    const elapsed = Date.now() - started;
    let progress = store.installProgress;
    let step = store.installStep;
    if (elapsed < 1800) {
      progress = Math.min(45, progress + 4);
      step = "Baixando aplicativo…";
    } else if (elapsed < 4000) {
      progress = Math.min(78, Math.max(progress, 48) + 3);
      step = "Instalando no aparelho…";
    } else {
      progress = Math.min(94, Math.max(progress, 80) + 1);
      step = session.gotAppInstalled ? "Quase pronto…" : "Finalizando instalação…";
    }
    patch({ installProgress: progress, installStep: step });
  }, 280);
}

function showReadyUi() {
  clearProgressTicker();
  session.completing = false;
  session.accepted = false;
  patch({
    isInstalling: false,
    installProgress: 100,
    installStep: "Pronto! O GondUp foi instalado na tela inicial.",
    justInstalled: true,
    showOpenFallback: true,
    deferredPrompt: null,
    lastOutcome: "installed",
  });
  window.__gondupDeferredPrompt = null;
  // Tentativa automática (sem gesto costuma falhar no Android — o botão Abrir é o caminho certo).
  window.setTimeout(() => {
    if (!isStandaloneDisplay()) tryOpenInstalledApp("auto-after-overlay");
  }, 400);
}

/**
 * Completa a UI só depois do tempo mínimo da barra, mesmo se appinstalled
 * já tiver disparado no aceite (comportamento do Chrome Android).
 */
function scheduleReadyUi(reason: string) {
  if (session.completing) return;
  session.completing = true; // impede agendar de novo; o ticker continua até o timeout
  clearCompleteTimer();
  const elapsed = session.acceptedAt ? Date.now() - session.acceptedAt : 0;
  const wait = Math.max(0, MIN_OVERLAY_MS - elapsed);
  logPwa("scheduleReadyUi", reason, { elapsed, wait, gotAppInstalled: session.gotAppInstalled });
  completeTimer = setTimeout(() => {
    completeTimer = null;
    clearProgressTicker();
    patch({
      installProgress: 100,
      installStep: "Pronto!",
      isInstalling: true,
    });
    // Um instante em "Pronto!" e depois o botão Abrir.
    window.setTimeout(() => showReadyUi(), 700);
  }, wait);
}

function onAcceptedInstall() {
  session.accepted = true;
  session.acceptedAt = Date.now();
  session.completing = false;
  logPwa("accepted — starting overlay", { alreadyInstalledEvent: session.gotAppInstalled });
  startProgressStages();
  // Se appinstalled já veio (comum no Android), ainda assim mostra a barra o mínimo.
  if (session.gotAppInstalled) {
    scheduleReadyUi("appinstalled-already-fired");
    return;
  }
  // Senão espera o evento ou timeout.
  clearCompleteTimer();
  completeTimer = setTimeout(() => {
    completeTimer = null;
    scheduleReadyUi("timeout-waiting-appinstalled");
  }, INSTALL_TIMEOUT_MS);
}

/**
 * Deve ser chamado de forma SÍNCRONA no handler de clique.
 */
export function beginNativeInstallFromGesture(): "prompting" | "no-prompt" | "busy" {
  if (store.isInstalling && session.accepted) {
    logPwa("beginNativeInstall: busy");
    return "busy";
  }
  const promptEvent = store.deferredPrompt || window.__gondupDeferredPrompt || null;
  if (!promptEvent) {
    logPwa("beginNativeInstall: no deferred prompt");
    patch({ lastOutcome: "no-prompt", lastError: "" });
    return "no-prompt";
  }

  session = { accepted: false, gotAppInstalled: false, acceptedAt: 0, completing: false };
  clearProgressTicker();
  clearCompleteTimer();

  patch({ deferredPrompt: null, lastError: "", lastOutcome: "prompting", showOpenFallback: false });
  window.__gondupDeferredPrompt = null;

  let promptPromise: Promise<void>;
  try {
    promptPromise = promptEvent.prompt();
    logPwa("prompt() called synchronously");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logPwa("prompt() threw", msg);
    patch({ lastOutcome: "prompt-error", lastError: msg, isInstalling: false, installProgress: 0 });
    return "no-prompt";
  }

  void (async () => {
    try {
      await promptPromise;
      const choice = await promptEvent.userChoice;
      logPwa("userChoice", choice.outcome);
      patch({ lastOutcome: choice.outcome });
      if (choice.outcome !== "accepted") {
        clearProgressTicker();
        clearCompleteTimer();
        session.accepted = false;
        patch({ isInstalling: false, installProgress: 0, installStep: "" });
        return;
      }
      onAcceptedInstall();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logPwa("install flow error", msg);
      clearProgressTicker();
      clearCompleteTimer();
      session.accepted = false;
      patch({
        isInstalling: false,
        installProgress: 0,
        installStep: "",
        lastOutcome: "error",
        lastError: msg,
      });
    }
  })();

  return "prompting";
}

function bootstrapInstallListeners() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  const ua = window.navigator.userAgent || "";
  patch({
    isIosDevice: /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    isStandalone: isStandaloneDisplay(),
    deferredPrompt: window.__gondupDeferredPrompt || null,
  });
  logPwa("bootstrap", { hasPrompt: Boolean(store.deferredPrompt), standalone: store.isStandalone, ua: ua.slice(0, 80) });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    const bip = event as BeforeInstallPromptEvent;
    window.__gondupDeferredPrompt = bip;
    patch({ deferredPrompt: bip, lastOutcome: store.lastOutcome || "bip-captured" });
    logPwa("beforeinstallprompt captured");
  });

  window.addEventListener("appinstalled", () => {
    logPwa("appinstalled event", { accepted: session.accepted, isInstalling: store.isInstalling });
    session.gotAppInstalled = true;
    window.__gondupDeferredPrompt = null;
    patch({ deferredPrompt: null });

    if (session.accepted) {
      // Barra já (ou vai) aparecer — só marca e completa após o mínimo.
      scheduleReadyUi("appinstalled-during-overlay");
      return;
    }

    // Instalação pelo menu ⋮ do Chrome (sem nosso botão): mostra barra curta + Abrir.
    session.accepted = true;
    session.acceptedAt = Date.now();
    startProgressStages();
    scheduleReadyUi("appinstalled-via-browser-menu");
  });

  syncDebug();
  (window as any).__gondupPwaTest = {
    reset: __testResetInstallSession,
    simulateAccepted: __testSimulateAccepted,
    simulateAppInstalled: __testSimulateAppInstalled,
  };
}

export function useInstallPrompt() {
  const snap = useSyncExternalStore(subscribe, getStore, getStore);

  useEffect(() => {
    bootstrapInstallListeners();
  }, []);

  const install = useCallback(() => beginNativeInstallFromGesture() === "prompting", []);

  const openApp = useCallback(() => {
    // Gesto do usuário: melhor chance de o Android abrir o WebAPK.
    tryOpenInstalledApp("user-tap-abrir");
    patch({ showOpenFallback: false, isInstalling: false, installStep: "" });
  }, []);

  const dismissOpenFallback = useCallback(() => {
    patch({ showOpenFallback: false, installStep: "" });
  }, []);

  const showInstallOffer = !snap.isStandalone && !snap.justInstalled && !snap.isInstalling && !snap.showOpenFallback;

  return {
    canInstall: Boolean(snap.deferredPrompt) && !snap.isStandalone && !snap.justInstalled,
    showInstallOffer,
    isIosInstallable: snap.isIosDevice && !snap.isStandalone && !snap.justInstalled,
    isStandalone: snap.isStandalone,
    install,
    beginNativeInstallFromGesture,
    openApp,
    dismissOpenFallback,
    isInstalling: snap.isInstalling,
    installProgress: snap.installProgress,
    installStep: snap.installStep,
    showOpenFallback: snap.showOpenFallback,
    lastOutcome: snap.lastOutcome,
  };
}

/** Só para testes headless: simula aceite + appinstalled em ordens diferentes. */
export function __testResetInstallSession() {
  session = { accepted: false, gotAppInstalled: false, acceptedAt: 0, completing: false };
  clearProgressTicker();
  clearCompleteTimer();
  patch({
    isInstalling: false,
    installProgress: 0,
    installStep: "",
    showOpenFallback: false,
    justInstalled: false,
    lastOutcome: "",
    lastError: "",
  });
}

export function __testSimulateAccepted() {
  onAcceptedInstall();
}

export function __testSimulateAppInstalled() {
  session.gotAppInstalled = true;
  if (session.accepted) scheduleReadyUi("test-appinstalled");
  else {
    session.accepted = true;
    session.acceptedAt = Date.now();
    startProgressStages();
    scheduleReadyUi("test-appinstalled-first");
  }
}
