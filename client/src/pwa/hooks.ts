import { useCallback, useEffect, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Phase = "idle" | "prompting" | "progress" | "ready";

type RelatedApp = { platform?: string; url?: string; id?: string };

export type PwaDebugInfo = {
  hasDeferredPrompt: boolean;
  standalone: boolean;
  userAgent: string;
  lastOutcome: string;
  lastError: string;
  isInstalling: boolean;
  justInstalled: boolean;
  alreadyInstalled: boolean;
  swControlled: boolean;
  phase: Phase;
  transitions: string[];
  relatedApps: string;
  relatedAppsApi: string;
};

declare global {
  interface Window {
    __gondupDeferredPrompt?: BeforeInstallPromptEvent | null;
    __gondupPwaDebug?: PwaDebugInfo;
    __gondupInstallBusy?: boolean;
  }
  interface Navigator {
    getInstalledRelatedApps?: () => Promise<RelatedApp[]>;
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
  installStep: string;
  justInstalled: boolean;
  /** Já detectado via getInstalledRelatedApps / standalone */
  alreadyInstalled: boolean;
  isIosDevice: boolean;
  isStandalone: boolean;
  lastOutcome: string;
  lastError: string;
  transitions: string[];
  relatedAppsJson: string;
  relatedAppsApi: "unknown" | "supported" | "unsupported" | "error";
};

const MIN_OVERLAY_MS = 2500;
const RELATED_POLL_MS = 1000;
const RELATED_POLL_TIMEOUT_MS = 60_000;
const FALLBACK_READY_MS = 12_000;
const MAX_TRANSITIONS = 40;

const listeners = new Set<() => void>();
let store: InstallStore = {
  deferredPrompt: typeof window === "undefined" ? null : window.__gondupDeferredPrompt || null,
  phase: "idle",
  installStep: "",
  justInstalled: false,
  alreadyInstalled: false,
  isIosDevice: false,
  isStandalone: typeof window === "undefined" ? false : isStandaloneDisplay(),
  lastOutcome: "",
  lastError: "",
  transitions: [],
  relatedAppsJson: "[]",
  relatedAppsApi: "unknown",
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
  const line = `${new Date().toISOString().slice(11, 23)} ${store.phase}→${to} (${reason})`;
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
    alreadyInstalled: store.alreadyInstalled,
    swControlled: Boolean(navigator.serviceWorker?.controller),
    phase: store.phase,
    transitions: store.transitions,
    relatedApps: store.relatedAppsJson,
    relatedAppsApi: store.relatedAppsApi,
  };
}

let bootstrapped = false;
let readyTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
let progressStartedAt = 0;
let gotAppInstalled = false;
let ourPromptFlow = false;
let readyScheduled = false;

function clearReadyTimer() {
  if (readyTimer) {
    clearTimeout(readyTimer);
    readyTimer = null;
  }
}
function clearPollTimer() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
function clearFallbackTimer() {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
}

async function queryRelatedApps(): Promise<RelatedApp[]> {
  if (typeof navigator === "undefined" || typeof navigator.getInstalledRelatedApps !== "function") {
    patch({ relatedAppsApi: "unsupported", relatedAppsJson: "[]" });
    return [];
  }
  try {
    const apps = await navigator.getInstalledRelatedApps();
    patch({
      relatedAppsApi: "supported",
      relatedAppsJson: JSON.stringify(apps || []),
    });
    return apps || [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logPwa("getInstalledRelatedApps error", msg);
    patch({ relatedAppsApi: "error", lastError: msg, relatedAppsJson: "[]" });
    return [];
  }
}

function isOurWebAppInstalled(apps: RelatedApp[]) {
  return apps.some((a) => {
    if ((a.platform || "").toLowerCase() !== "webapp") return false;
    const url = (a.url || "").toLowerCase();
    return url.includes("gondup.com") && url.includes("manifest");
  });
}

async function refreshAlreadyInstalled(reason: string) {
  if (isStandaloneDisplay()) {
    patch({ alreadyInstalled: true, isStandalone: true });
    logPwa("alreadyInstalled via standalone", reason);
    return true;
  }
  const apps = await queryRelatedApps();
  const yes = isOurWebAppInstalled(apps);
  patch({ alreadyInstalled: yes });
  logPwa("alreadyInstalled check", reason, { yes, apps });
  return yes;
}

/** Idempotente. */
function enterProgress(reason: string) {
  if (store.phase === "progress" || store.phase === "ready") {
    logPwa("enterProgress skipped", store.phase, reason);
    return;
  }
  const transitions = recordTransition("progress", reason);
  progressStartedAt = Date.now();
  readyScheduled = false;
  patch({
    phase: "progress",
    transitions,
    justInstalled: false,
    installStep: "Instalando o GondUp… isso leva alguns segundos.",
  });
  startCompletionWatch();
}

function enterReady(reason: string, message: string) {
  if (store.phase === "ready") {
    logPwa("enterReady skipped", reason);
    return;
  }
  clearReadyTimer();
  clearPollTimer();
  clearFallbackTimer();
  ourPromptFlow = false;
  readyScheduled = false;
  const transitions = recordTransition("ready", reason);
  patch({
    phase: "ready",
    transitions,
    installStep: message,
    justInstalled: true,
    alreadyInstalled: true,
    deferredPrompt: null,
    lastOutcome: "installed",
  });
  window.__gondupDeferredPrompt = null;
}

function scheduleReady(reason: string, message: string) {
  if (store.phase === "ready" || readyScheduled) {
    logPwa("scheduleReady skipped", reason, { readyScheduled, phase: store.phase });
    return;
  }
  readyScheduled = true;
  clearReadyTimer();
  if (store.phase !== "progress") enterProgress(`scheduleReady:${reason}`);
  const elapsed = progressStartedAt ? Date.now() - progressStartedAt : 0;
  const wait = Math.max(0, MIN_OVERLAY_MS - elapsed);
  logPwa("scheduleReady", reason, { elapsed, wait });
  readyTimer = setTimeout(() => {
    readyTimer = null;
    enterReady(reason, message);
  }, wait);
}

function startCompletionWatch() {
  clearPollTimer();
  clearFallbackTimer();

  // Poll real: getInstalledRelatedApps (Android Chrome).
  void (async () => {
    const first = await queryRelatedApps();
    if (store.phase === "progress" && isOurWebAppInstalled(first)) {
      scheduleReady("related-apps-immediate", "Pronto! O GondUp foi instalado.");
      return;
    }
  })();

  pollTimer = setInterval(() => {
    void (async () => {
      if (store.phase !== "progress") {
        clearPollTimer();
        return;
      }
      const apps = await queryRelatedApps();
      if (isOurWebAppInstalled(apps)) {
        clearPollTimer();
        scheduleReady("related-apps-poll", "Pronto! O GondUp foi instalado.");
      }
    })();
  }, RELATED_POLL_MS);

  window.setTimeout(() => clearPollTimer(), RELATED_POLL_TIMEOUT_MS);

  // Fallback se a API não confirmar (ou não existir): após appinstalled + delay honesto.
  fallbackTimer = setTimeout(() => {
    fallbackTimer = null;
    if (store.phase !== "progress") return;
    if (store.relatedAppsApi === "supported" && !gotAppInstalled) {
      // API existe mas ainda não viu o app e nem appinstalled — espera mais via poll até timeout.
      logPwa("fallback timer: still waiting related apps");
      return;
    }
    const msg = gotAppInstalled
      ? "Instalação enviada ao Chrome — quando aparecer o aviso do Chrome, toque em Abrir, ou abra pelo ícone GondUp na tela inicial."
      : "Se o Chrome concluir a instalação, abra pelo ícone GondUp na tela inicial (ou pelo aviso Abrir do Chrome).";
    scheduleReady("fallback-timeout", msg);
  }, FALLBACK_READY_MS);
}

function onUserAccepted(reason: string) {
  logPwa("onUserAccepted", reason, { phase: store.phase, gotAppInstalled });
  enterProgress(reason);
  if (gotAppInstalled) {
    // Ainda precisamos da confirmação real via related apps / fallback — não fecha na hora.
    logPwa("accepted with appinstalled already — waiting related apps / fallback");
  }
}

export function beginNativeInstallFromGesture(): "prompting" | "no-prompt" | "busy" {
  if (store.phase === "progress" || store.phase === "prompting") {
    logPwa("beginNativeInstall: busy", store.phase);
    return "busy";
  }
  if (store.alreadyInstalled || isStandaloneDisplay()) {
    logPwa("beginNativeInstall: already installed");
    patch({ alreadyInstalled: true, lastOutcome: "already-installed" });
    return "no-prompt";
  }
  const promptEvent = store.deferredPrompt || window.__gondupDeferredPrompt || null;
  if (!promptEvent) {
    logPwa("beginNativeInstall: no deferred prompt");
    patch({ lastOutcome: "no-prompt", lastError: "" });
    return "no-prompt";
  }

  gotAppInstalled = false;
  ourPromptFlow = true;
  readyScheduled = false;
  clearReadyTimer();
  clearPollTimer();
  clearFallbackTimer();
  progressStartedAt = 0;

  const transitions = recordTransition("prompting", "beginNativeInstall");
  patch({
    phase: "prompting",
    transitions,
    deferredPrompt: null,
    lastError: "",
    lastOutcome: "prompting",
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
        clearReadyTimer();
        clearPollTimer();
        clearFallbackTimer();
        ourPromptFlow = false;
        if (store.phase === "prompting" || store.phase === "idle") {
          const tr = recordTransition("idle", "dismissed");
          patch({ phase: "idle", transitions: tr, installStep: "" });
        }
        return;
      }
      onUserAccepted("userChoice-accepted");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logPwa("install flow error", msg);
      clearReadyTimer();
      clearPollTimer();
      clearFallbackTimer();
      ourPromptFlow = false;
      if (store.phase !== "progress" && store.phase !== "ready") {
        const tr = recordTransition("idle", "error");
        patch({ phase: "idle", transitions: tr, installStep: "", lastOutcome: "error", lastError: msg });
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
    alreadyInstalled: isStandaloneDisplay(),
  });
  logPwa("bootstrap", { standalone: store.isStandalone });
  void refreshAlreadyInstalled("bootstrap");

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    const bip = event as BeforeInstallPromptEvent;
    window.__gondupDeferredPrompt = bip;
    // Se BIP disparou, em geral ainda não está instalado como WebAPK.
    patch({ deferredPrompt: bip, lastOutcome: store.lastOutcome || "bip-captured", alreadyInstalled: false });
    logPwa("beforeinstallprompt captured");
  });

  window.addEventListener("appinstalled", () => {
    logPwa("appinstalled event", { phase: store.phase, ourPromptFlow });
    gotAppInstalled = true;
    window.__gondupDeferredPrompt = null;
    patch({ deferredPrompt: null });

    if (ourPromptFlow || store.phase === "prompting" || store.phase === "progress") {
      if (store.phase === "progress") {
        // Continua no progresso; related-apps / fallback decidem o ready.
        logPwa("appinstalled while progress — keep overlay, wait real completion");
      } else {
        logPwa("appinstalled while prompting — wait userChoice");
      }
      return;
    }

    // Menu ⋮ do Chrome: mostra progresso e espera related apps / fallback.
    enterProgress("appinstalled-via-browser-menu");
  });

  document.addEventListener("visibilitychange", () => {
    logPwa("visibilitychange", document.visibilityState, { phase: store.phase });
    if (document.visibilityState === "visible") void refreshAlreadyInstalled("visibility");
  });

  syncDebug();
  (window as any).__gondupPwaTest = {
    reset: __testResetInstallSession,
    simulatePrompting: __testSimulatePrompting,
    simulateAccepted: __testSimulateAccepted,
    simulateAppInstalled: __testSimulateAppInstalled,
    simulateRelatedInstalled: __testSimulateRelatedInstalled,
    forceReady: __testForceReady,
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

  const dismissReady = useCallback(() => {
    const tr = recordTransition("idle", "dismiss-ready");
    patch({ phase: "idle", transitions: tr, installStep: "" });
  }, []);

  const isInstalling = snap.phase === "progress";
  const showReady = snap.phase === "ready";
  const showInstallOffer =
    !snap.isStandalone && !snap.alreadyInstalled && !snap.justInstalled && snap.phase === "idle";

  return {
    canInstall: Boolean(snap.deferredPrompt) && showInstallOffer,
    showInstallOffer,
    alreadyInstalled: snap.alreadyInstalled || snap.isStandalone,
    isIosInstallable: snap.isIosDevice && !snap.isStandalone && !snap.alreadyInstalled && snap.phase === "idle",
    isStandalone: snap.isStandalone,
    install,
    beginNativeInstallFromGesture,
    dismissReady,
    /** @deprecated use dismissReady — não abrimos o WebAPK pelo site */
    dismissOpenFallback: dismissReady,
    openApp: dismissReady,
    isInstalling,
    installProgress: 0,
    installStep: snap.installStep,
    showOpenFallback: showReady,
    showReady,
    lastOutcome: snap.lastOutcome,
    phase: snap.phase,
    transitions: snap.transitions,
  };
}

export function __testResetInstallSession() {
  clearReadyTimer();
  clearPollTimer();
  clearFallbackTimer();
  gotAppInstalled = false;
  ourPromptFlow = false;
  readyScheduled = false;
  progressStartedAt = 0;
  patch({
    phase: "idle",
    installStep: "",
    justInstalled: false,
    alreadyInstalled: false,
    lastOutcome: "",
    lastError: "",
    transitions: [],
    relatedAppsJson: "[]",
    relatedAppsApi: "unknown",
  });
}

export function __testSimulatePrompting() {
  ourPromptFlow = true;
  gotAppInstalled = false;
  readyScheduled = false;
  clearReadyTimer();
  clearPollTimer();
  clearFallbackTimer();
  const transitions = recordTransition("prompting", "test-prompting");
  patch({ phase: "prompting", transitions, installStep: "", justInstalled: false });
}

export function __testSimulateAccepted() {
  ourPromptFlow = true;
  onUserAccepted("test-accepted");
}

export function __testSimulateAppInstalled() {
  gotAppInstalled = true;
  if (ourPromptFlow || store.phase === "prompting" || store.phase === "progress") {
    logPwa("test appinstalled during our flow");
    return;
  }
  enterProgress("test-appinstalled-first");
}


export function __testForceReady(message: string) {
  if (store.phase !== "progress") enterProgress("test-force-ready");
  scheduleReady("test-force-ready", message);
}

export function __testSimulateRelatedInstalled() {
  patch({
    relatedAppsApi: "supported",
    relatedAppsJson: JSON.stringify([{ platform: "webapp", url: "https://gondup.com/manifest.json" }]),
    alreadyInstalled: true,
  });
  if (store.phase === "progress") {
    scheduleReady("test-related-installed", "Pronto! O GondUp foi instalado.");
  }
}
