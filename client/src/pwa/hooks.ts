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

/** App instalado (tela cheia / home screen), não aba comum do navegador. */
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

const INSTALL_TIMEOUT_MS = 25_000;

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

let launchStarted = false;
let waitingForInstalled: { resolve: (v: "installed" | "timeout") => void; timer: ReturnType<typeof setTimeout> } | null =
  null;
let bootstrapped = false;
let progressTicker: ReturnType<typeof setInterval> | null = null;

function clearProgressTicker() {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
}

function openInstalledApp() {
  if (launchStarted) return;
  launchStarted = true;
  const appUrl = `${window.location.origin}/?installed=1`;
  logPwa("openInstalledApp", appUrl);
  try {
    window.open(appUrl, "_blank")?.focus();
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    if (!isStandaloneDisplay()) window.location.assign(appUrl);
  }, 450);
}

function resolveWait(result: "installed" | "timeout") {
  if (!waitingForInstalled) return;
  clearTimeout(waitingForInstalled.timer);
  const { resolve } = waitingForInstalled;
  waitingForInstalled = null;
  resolve(result);
}

function waitForAppInstalled(): Promise<"installed" | "timeout"> {
  return new Promise((resolve) => {
    if (waitingForInstalled) {
      clearTimeout(waitingForInstalled.timer);
      waitingForInstalled.resolve("timeout");
    }
    const timer = setTimeout(() => {
      waitingForInstalled = null;
      resolve("timeout");
    }, INSTALL_TIMEOUT_MS);
    waitingForInstalled = { timer, resolve };
  });
}

function finishInstalled() {
  clearProgressTicker();
  resolveWait("installed");
  logPwa("appinstalled / finishInstalled");
  patch({
    installProgress: 100,
    installStep: "Instalação concluída — abrindo…",
    deferredPrompt: null,
    justInstalled: true,
    lastOutcome: "installed",
    isInstalling: true,
  });
  window.__gondupDeferredPrompt = null;
  window.setTimeout(() => {
    openInstalledApp();
    window.setTimeout(() => {
      if (!isStandaloneDisplay()) {
        patch({
          isInstalling: false,
          showOpenFallback: true,
          installStep: "Toque para abrir o aplicativo instalado.",
        });
      } else {
        patch({ isInstalling: false, installStep: "", showOpenFallback: false });
      }
    }, 1200);
  }, 350);
}

function startDownloadProgress() {
  clearProgressTicker();
  patch({
    isInstalling: true,
    showOpenFallback: false,
    installStep: "Baixando aplicativo…",
    installProgress: Math.max(store.installProgress, 55),
  });
  progressTicker = setInterval(() => {
    if (!store.isInstalling || store.installProgress >= 92 || store.justInstalled) {
      clearProgressTicker();
      return;
    }
    patch({ installProgress: Math.min(92, store.installProgress + 2) });
  }, 500);
}

/**
 * Deve ser chamado de forma SÍNCRONA no handler de clique.
 * Qualquer await antes de prompt() perde o user-gesture e o Chrome fecha o diálogo na hora.
 * Retorna: "prompting" | "no-prompt" | "busy"
 */
export function beginNativeInstallFromGesture(): "prompting" | "no-prompt" | "busy" {
  if (store.isInstalling) {
    logPwa("beginNativeInstall: busy");
    return "busy";
  }
  const promptEvent = store.deferredPrompt || window.__gondupDeferredPrompt || null;
  if (!promptEvent) {
    logPwa("beginNativeInstall: no deferred prompt");
    patch({ lastOutcome: "no-prompt", lastError: "" });
    return "no-prompt";
  }

  launchStarted = false;
  // Consumir o evento já: BIP só pode ser usado uma vez.
  patch({ deferredPrompt: null, lastError: "", lastOutcome: "prompting" });
  window.__gondupDeferredPrompt = null;

  let promptPromise: Promise<void>;
  try {
    // SÍNCRONO no gesto do usuário — não await antes disto.
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
        // Fecha quieto — sem barra falsa.
        clearProgressTicker();
        patch({ isInstalling: false, installProgress: 0, installStep: "" });
        return;
      }
      startDownloadProgress();
      const result = await waitForAppInstalled();
      clearProgressTicker();
      if (result === "installed" || store.justInstalled || launchStarted) return;
      logPwa("appinstalled timeout — showing open fallback");
      patch({
        installProgress: 100,
        installStep: "A instalação pode continuar em segundo plano.",
        isInstalling: false,
        justInstalled: true,
        showOpenFallback: true,
        lastOutcome: "timeout",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logPwa("install flow error", msg);
      clearProgressTicker();
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
    logPwa("appinstalled event");
    if (waitingForInstalled || store.isInstalling) {
      finishInstalled();
      return;
    }
    // Instalação pelo menu do navegador (sem nosso botão).
    launchStarted = false;
    patch({ justInstalled: true, deferredPrompt: null, lastOutcome: "installed-via-browser" });
    window.__gondupDeferredPrompt = null;
    finishInstalled();
  });

  syncDebug();
}

export function useInstallPrompt() {
  const snap = useSyncExternalStore(subscribe, getStore, getStore);

  useEffect(() => {
    bootstrapInstallListeners();
  }, []);

  /** Preferir beginNativeInstallFromGesture no onClick; este alias mantém compat. */
  const install = useCallback(() => {
    const result = beginNativeInstallFromGesture();
    return result === "prompting";
  }, []);

  const openApp = useCallback(() => {
    launchStarted = false;
    openInstalledApp();
    patch({ showOpenFallback: false, isInstalling: false, installStep: "" });
  }, []);

  const dismissOpenFallback = useCallback(() => {
    patch({ showOpenFallback: false, installStep: "" });
  }, []);

  const showInstallOffer = !snap.isStandalone && !snap.justInstalled;

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
