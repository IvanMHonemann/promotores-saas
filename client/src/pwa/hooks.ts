import { useCallback, useEffect, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Phase = "idle" | "prompting" | "progress" | "ready";

export type PwaDebugInfo = {
  hasDeferredPrompt: boolean;
  standalone: boolean;
  userAgent: string;
  lastOutcome: string;
  lastError: string;
  isInstalling: boolean;
  justInstalled: boolean;
  swControlled: boolean;
  phase: Phase;
  transitions: string[];
};

declare global {
  interface Window {
    __gondupDeferredPrompt?: BeforeInstallPromptEvent | null;
    __gondupPwaDebug?: PwaDebugInfo;
    __gondupInstallBusy?: boolean;
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
  phase: Phase;
  installProgress: number;
  installStep: string;
  justInstalled: boolean;
  isIosDevice: boolean;
  isStandalone: boolean;
  lastOutcome: string;
  lastError: string;
  transitions: string[];
};

const MIN_OVERLAY_MS = 5500;
const INSTALL_TIMEOUT_MS = 25_000;
const MAX_TRANSITIONS = 40;

const listeners = new Set<() => void>();
let store: InstallStore = {
  deferredPrompt: typeof window === "undefined" ? null : window.__gondupDeferredPrompt || null,
  phase: "idle",
  installProgress: 0,
  installStep: "",
  justInstalled: false,
  isIosDevice: false,
  isStandalone: typeof window === "undefined" ? false : isStandaloneDisplay(),
  lastOutcome: "",
  lastError: "",
  transitions: [],
};

function emit() {
  for (const l of listeners) l();
}

function patch(partial: Partial<InstallStore>) {
  store = { ...store, ...partial };
  if (typeof window !== "undefined") {
    window.__gondupInstallBusy = store.phase === "prompting" || store.phase === "progress";
  }
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

function recordTransition(to: Phase, reason: string) {
  const from = store.phase;
  const line = `${new Date().toISOString().slice(11, 23)} ${from}→${to} (${reason})`;
  const transitions = [...store.transitions, line].slice(-MAX_TRANSITIONS);
  logPwa("transition", line);
  return transitions;
}

function syncDebug() {
  if (typeof window === "undefined") return;
  window.__gondupPwaDebug = {
    hasDeferredPrompt: Boolean(store.deferredPrompt || window.__gondupDeferredPrompt),
    standalone: store.isStandalone || isStandaloneDisplay(),
    userAgent: navigator.userAgent || "",
    lastOutcome: store.lastOutcome,
    lastError: store.lastError,
    isInstalling: store.phase === "progress",
    justInstalled: store.justInstalled,
    swControlled: Boolean(navigator.serviceWorker?.controller),
    phase: store.phase,
    transitions: store.transitions,
  };
}

let bootstrapped = false;
let progressTicker: ReturnType<typeof setInterval> | null = null;
let readyTimer: ReturnType<typeof setTimeout> | null = null;
let progressStartedAt = 0;
let gotAppInstalled = false;
/** true entre prompt() e o fim do fluxo iniciado pelo nosso botão */
let ourPromptFlow = false;

function clearProgressTicker() {
  if (progressTicker) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
}

function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
}

function appStartUrl() {
  return `${window.location.origin}/?installed=1&utm_source=pwa_install`;
}

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

/** Idempotente: se já estamos em progress, não reinicia nem zera a barra. */
function enterProgress(reason: string) {
  if (store.phase === "progress" || store.phase === "ready") {
    logPwa("enterProgress skipped (already", store.phase, ")", reason);
    return;
  }
  const transitions = recordTransition("progress", reason);
  progressStartedAt = Date.now();
  clearProgressTicker();
  patch({
    phase: "progress",
    transitions,
    justInstalled: false,
    installStep: "Baixando aplicativo…",
    installProgress: 18,
  });
  progressTicker = setInterval(() => {
    if (store.phase !== "progress") {
      clearProgressTicker();
      return;
    }
    const elapsed = Date.now() - progressStartedAt;
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
      step = gotAppInstalled ? "Quase pronto…" : "Finalizando instalação…";
    }
    patch({ installProgress: progress, installStep: step });
  }, 280);
}

function enterReady(reason: string) {
  if (store.phase === "ready") {
    logPwa("enterReady skipped", reason);
    return;
  }
  clearProgressTicker();
  clearReadyTimer();
  ourPromptFlow = false;
  const transitions = recordTransition("ready", reason);
  patch({
    phase: "ready",
    transitions,
    installProgress: 100,
    installStep: "Pronto! O GondUp foi instalado na tela inicial.",
    justInstalled: true,
    deferredPrompt: null,
    lastOutcome: "installed",
  });
  window.__gondupDeferredPrompt = null;
  window.setTimeout(() => {
    if (!isStandaloneDisplay()) tryOpenInstalledApp("auto-after-overlay");
  }, 400);
}

/**
 * Agenda ready só uma vez; respeita MIN_OVERLAY_MS desde o início do progress.
 * Nunca volta para idle no meio.
 */
function scheduleReady(reason: string) {
  if (store.phase === "ready") return;
  if (readyTimer) {
    logPwa("scheduleReady already pending", reason);
    return;
  }
  if (store.phase !== "progress") {
    enterProgress(`scheduleReady-needed-progress:${reason}`);
  }
  const elapsed = progressStartedAt ? Date.now() - progressStartedAt : 0;
  const wait = Math.max(0, MIN_OVERLAY_MS - elapsed);
  logPwa("scheduleReady", reason, { elapsed, wait, gotAppInstalled });
  readyTimer = setTimeout(() => {
    readyTimer = null;
    clearProgressTicker();
    patch({ installProgress: 100, installStep: "Pronto!" });
    window.setTimeout(() => enterReady(`after-min-overlay:${reason}`), 700);
  }, wait);
}

let waitInstalledTimer: ReturnType<typeof setTimeout> | null = null;

function clearWaitInstalledTimer() {
  if (waitInstalledTimer) {
    clearTimeout(waitInstalledTimer);
    waitInstalledTimer = null;
  }
}

function onUserAccepted(reason: string) {
  logPwa("onUserAccepted", reason, { phase: store.phase, gotAppInstalled });
  enterProgress(reason);
  if (gotAppInstalled) {
    clearWaitInstalledTimer();
    scheduleReady("accepted-and-appinstalled");
    return;
  }
  if (!waitInstalledTimer && !readyTimer) {
    waitInstalledTimer = setTimeout(() => {
      waitInstalledTimer = null;
      scheduleReady("timeout-waiting-appinstalled");
    }, INSTALL_TIMEOUT_MS);
  }
}

export function beginNativeInstallFromGesture(): "prompting" | "no-prompt" | "busy" {
  if (store.phase === "progress" || store.phase === "prompting") {
    logPwa("beginNativeInstall: busy", store.phase);
    return "busy";
  }
  const promptEvent = store.deferredPrompt || window.__gondupDeferredPrompt || null;
  if (!promptEvent) {
    logPwa("beginNativeInstall: no deferred prompt");
    patch({ lastOutcome: "no-prompt", lastError: "" });
    return "no-prompt";
  }

  gotAppInstalled = false;
  ourPromptFlow = true;
  clearProgressTicker();
  clearReadyTimer();
  clearWaitInstalledTimer();
  progressStartedAt = 0;

  const transitions = recordTransition("prompting", "beginNativeInstall");
  patch({
    phase: "prompting",
    transitions,
    deferredPrompt: null,
    lastError: "",
    lastOutcome: "prompting",
    installProgress: 0,
    installStep: "",
  });
  window.__gondupDeferredPrompt = null;

  let promptPromise: Promise<void>;
  try {
    promptPromise = promptEvent.prompt();
    logPwa("prompt() called synchronously");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logPwa("prompt() threw", msg);
    ourPromptFlow = false;
    const tr = recordTransition("idle", "prompt-error");
    patch({ phase: "idle", transitions: tr, lastOutcome: "prompt-error", lastError: msg });
    return "no-prompt";
  }

  void (async () => {
    try {
      await promptPromise;
      const choice = await promptEvent.userChoice;
      logPwa("userChoice", choice.outcome, { phase: store.phase, gotAppInstalled });
      patch({ lastOutcome: choice.outcome });
      if (choice.outcome !== "accepted") {
        clearProgressTicker();
        clearReadyTimer();
        clearWaitInstalledTimer();
        ourPromptFlow = false;
        // Se appinstalled já colocou progress (não deveria no nosso fluxo), não derruba.
        if (store.phase === "prompting" || store.phase === "idle") {
          const tr = recordTransition("idle", "dismissed");
          patch({ phase: "idle", transitions: tr, installProgress: 0, installStep: "" });
        }
        return;
      }
      onUserAccepted("userChoice-accepted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logPwa("install flow error", msg);
      clearProgressTicker();
      clearReadyTimer();
      clearWaitInstalledTimer();
      ourPromptFlow = false;
      if (store.phase !== "progress" && store.phase !== "ready") {
        const tr = recordTransition("idle", "error");
        patch({ phase: "idle", transitions: tr, installProgress: 0, installStep: "", lastOutcome: "error", lastError: msg });
      }
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
  logPwa("bootstrap", { hasPrompt: Boolean(store.deferredPrompt), standalone: store.isStandalone });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    const bip = event as BeforeInstallPromptEvent;
    window.__gondupDeferredPrompt = bip;
    patch({ deferredPrompt: bip, lastOutcome: store.lastOutcome || "bip-captured" });
    logPwa("beforeinstallprompt captured");
  });

  window.addEventListener("appinstalled", () => {
    logPwa("appinstalled event", { phase: store.phase, ourPromptFlow, gotAppInstalled });
    gotAppInstalled = true;
    window.__gondupDeferredPrompt = null;
    patch({ deferredPrompt: null });

    if (ourPromptFlow || store.phase === "prompting" || store.phase === "progress") {
      // Fluxo do nosso botão: NÃO reinicia a barra. Só marca e agenda ready se já estamos em progress.
      // Se ainda estamos em prompting (userChoice pendente), espera o aceite para enterProgress.
      if (store.phase === "progress") {
        clearWaitInstalledTimer();
        scheduleReady("appinstalled-while-progress");
      } else {
        logPwa("appinstalled while prompting — wait for userChoice to start/keep overlay");
      }
      return;
    }

    // Instalação só pelo menu ⋮ do Chrome (sem nosso prompt): aí sim mostra a barra.
    enterProgress("appinstalled-via-browser-menu");
    scheduleReady("appinstalled-via-browser-menu");
  });

  // visibilitychange: não esconde a barra (Chrome Android esconde a aba no diálogo/WebAPK).
  document.addEventListener("visibilitychange", () => {
    logPwa("visibilitychange", document.visibilityState, { phase: store.phase });
  });

  syncDebug();
  (window as any).__gondupPwaTest = {
    reset: __testResetInstallSession,
    simulatePrompting: __testSimulatePrompting,
    simulateAccepted: __testSimulateAccepted,
    simulateAppInstalled: __testSimulateAppInstalled,
    getPhase: () => store.phase,
    getTransitions: () => store.transitions.slice(),
  };
}

export function useInstallPrompt() {
  const snap = useSyncExternalStore(subscribe, getStore, getStore);

  useEffect(() => {
    bootstrapInstallListeners();
  }, []);

  const install = useCallback(() => beginNativeInstallFromGesture() === "prompting", []);

  const openApp = useCallback(() => {
    tryOpenInstalledApp("user-tap-abrir");
    const tr = recordTransition("idle", "open-app-dismiss");
    patch({ phase: "idle", transitions: tr, installStep: "" });
  }, []);

  const dismissOpenFallback = useCallback(() => {
    const tr = recordTransition("idle", "dismiss-ready");
    patch({ phase: "idle", transitions: tr, installStep: "" });
  }, []);

  const isInstalling = snap.phase === "progress";
  const showOpenFallback = snap.phase === "ready";
  const showInstallOffer =
    !snap.isStandalone && !snap.justInstalled && snap.phase === "idle";

  return {
    canInstall: Boolean(snap.deferredPrompt) && !snap.isStandalone && snap.phase === "idle",
    showInstallOffer,
    isIosInstallable: snap.isIosDevice && !snap.isStandalone && snap.phase === "idle",
    isStandalone: snap.isStandalone,
    install,
    beginNativeInstallFromGesture,
    openApp,
    dismissOpenFallback,
    isInstalling,
    installProgress: snap.installProgress,
    installStep: snap.installStep,
    showOpenFallback,
    lastOutcome: snap.lastOutcome,
    phase: snap.phase,
    transitions: snap.transitions,
  };
}


export function __testSimulatePrompting() {
  ourPromptFlow = true;
  gotAppInstalled = false;
  clearProgressTicker();
  clearReadyTimer();
  clearWaitInstalledTimer();
  const transitions = recordTransition("prompting", "test-prompting");
  patch({ phase: "prompting", transitions, installProgress: 0, installStep: "", justInstalled: false });
}

export function __testResetInstallSession() {
  clearProgressTicker();
  clearReadyTimer();
  clearWaitInstalledTimer();
  gotAppInstalled = false;
  ourPromptFlow = false;
  progressStartedAt = 0;
  patch({
    phase: "idle",
    installProgress: 0,
    installStep: "",
    justInstalled: false,
    lastOutcome: "",
    lastError: "",
    transitions: [],
  });
}

export function __testSimulateAccepted() {
  ourPromptFlow = true;
  onUserAccepted("test-accepted");
}

export function __testSimulateAppInstalled() {
  gotAppInstalled = true;
  if (ourPromptFlow || store.phase === "prompting" || store.phase === "progress") {
    if (store.phase === "progress") scheduleReady("test-appinstalled-while-progress");
    else logPwa("test appinstalled while prompting — wait accepted");
    return;
  }
  enterProgress("test-appinstalled-first");
  scheduleReady("test-appinstalled-first");
}

