import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __gondupDeferredPrompt?: BeforeInstallPromptEvent | null;
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
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);
  return isOnline;
}

type InstallStore = {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalling: boolean;
  installProgress: number;
  installStep: string;
  /** Instalação acabou mas o PWA pode não ter aberto sozinho. */
  showOpenFallback: boolean;
  /** appinstalled já disparou nesta sessão (esconde o botão Baixar). */
  justInstalled: boolean;
  isIosDevice: boolean;
  isStandalone: boolean;
};

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
};

function emit() {
  for (const l of listeners) l();
}

function patch(partial: Partial<InstallStore>) {
  store = { ...store, ...partial };
  emit();
}

function getStore() {
  return store;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let launchStarted = false;
let waitingForInstalled: { resolve: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
let bootstrapped = false;

function openInstalledApp() {
  if (launchStarted) return;
  launchStarted = true;
  const appUrl = `${window.location.origin}/?installed=1`;
  try {
    window.open(appUrl, "_blank")?.focus();
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    // No Android/Chrome, navegar para a start_url costuma disparar "Abrir no app".
    if (!isStandaloneDisplay()) {
      window.location.assign(appUrl);
    }
  }, 450);
}

function finishInstalled(opened: boolean) {
  if (waitingForInstalled) {
    clearTimeout(waitingForInstalled.timer);
    waitingForInstalled.resolve();
    waitingForInstalled = null;
  }
  patch({
    installProgress: 100,
    installStep: opened ? "Instalação concluída — abrindo…" : "Instalação concluída",
    deferredPrompt: null,
    justInstalled: true,
    showOpenFallback: !opened,
  });
  window.__gondupDeferredPrompt = null;
  if (opened) {
    window.setTimeout(() => {
      openInstalledApp();
      // Se ainda estivermos na aba do navegador depois de um tempo, oferece Abrir.
      window.setTimeout(() => {
        if (!isStandaloneDisplay()) {
          patch({ isInstalling: false, showOpenFallback: true, installStep: "Toque para abrir o aplicativo instalado." });
        } else {
          patch({ isInstalling: false, installStep: "", showOpenFallback: false });
        }
      }, 1200);
    }, 350);
  } else {
    patch({ isInstalling: false, showOpenFallback: true, installStep: "Toque para abrir o aplicativo instalado." });
  }
}

function waitForAppInstalled(): Promise<"installed" | "timeout"> {
  return new Promise((resolve) => {
    if (waitingForInstalled) {
      clearTimeout(waitingForInstalled.timer);
      waitingForInstalled.resolve();
    }
    const timer = setTimeout(() => {
      waitingForInstalled = null;
      resolve("timeout");
    }, INSTALL_TIMEOUT_MS);
    waitingForInstalled = {
      timer,
      resolve: () => resolve("installed"),
    };
  });
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

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    const bip = event as BeforeInstallPromptEvent;
    window.__gondupDeferredPrompt = bip;
    patch({ deferredPrompt: bip });
  });

  window.addEventListener("appinstalled", () => {
    // Se o fluxo de install() já está esperando, ele resolve e abre.
    if (waitingForInstalled) {
      finishInstalled(true);
      return;
    }
    // Instalação pelo menu do Chrome (sem nosso botão): ainda assim esconde o CTA e tenta abrir.
    launchStarted = false;
    patch({ justInstalled: true, deferredPrompt: null, isInstalling: true, installProgress: 100, installStep: "Instalação concluída — abrindo…" });
    window.__gondupDeferredPrompt = null;
    window.setTimeout(() => finishInstalled(true), 200);
  });
}

async function runNativeInstall(): Promise<boolean> {
  const promptEvent = store.deferredPrompt;
  if (!promptEvent || store.isInstalling) return false;
  launchStarted = false;
  patch({
    isInstalling: true,
    showOpenFallback: false,
    installStep: "Preparando instalação…",
    installProgress: 8,
  });
  await new Promise((r) => setTimeout(r, 220));

  try {
    await promptEvent.prompt();
  } catch {
    patch({
      installStep: "Não foi possível abrir o instalador.",
      installProgress: 0,
      isInstalling: false,
    });
    return false;
  }

  patch({ installProgress: 40, installStep: "Aguardando sua confirmação…" });
  const choice = await promptEvent.userChoice;
  if (choice.outcome !== "accepted") {
    patch({
      installStep: "Instalação cancelada.",
      installProgress: 0,
      isInstalling: false,
      deferredPrompt: null,
    });
    window.__gondupDeferredPrompt = null;
    return false;
  }

  patch({
    deferredPrompt: null,
    installStep: "Baixando aplicativo…",
    installProgress: 55,
  });
  window.__gondupDeferredPrompt = null;

  // Progresso visual enquanto espera o evento real appinstalled.
  const tick = window.setInterval(() => {
    if (!store.isInstalling || store.installProgress >= 92 || store.justInstalled) {
      window.clearInterval(tick);
      return;
    }
    patch({ installProgress: Math.min(92, store.installProgress + 3) });
  }, 400);

  const result = await waitForAppInstalled();
  window.clearInterval(tick);

  if (result === "installed" || store.justInstalled || launchStarted) {
    // finishInstalled já tratou abertura / fallback
    return true;
  }

  // Timeout: Chrome às vezes atrasa/omite appinstalled. Oferece abrir e esconde o baixar.
  patch({
    installProgress: 100,
    installStep: "Se o download terminou, abra o aplicativo.",
    isInstalling: false,
    justInstalled: true,
    showOpenFallback: true,
  });
  // Melhor esforço: tenta abrir mesmo assim (Android costuma aceitar).
  try {
    openInstalledApp();
  } catch {
    /* ignore */
  }
  return true;
}

export function useInstallPrompt() {
  const snap = useSyncExternalStore(subscribe, getStore, getStore);

  useEffect(() => {
    bootstrapInstallListeners();
  }, []);

  const install = useCallback(async () => runNativeInstall(), []);

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
    openApp,
    dismissOpenFallback,
    isInstalling: snap.isInstalling,
    installProgress: snap.installProgress,
    installStep: snap.installStep,
    showOpenFallback: snap.showOpenFallback,
  };
}
