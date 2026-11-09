import { useCallback, useEffect, useRef, useState } from "react";

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

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    typeof window === "undefined" ? null : window.__gondupDeferredPrompt || null,
  );
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStep, setInstallStep] = useState("");
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(() => isStandaloneDisplay());
  const launchStarted = useRef(false);

  const openInstalledApp = useCallback(() => {
    if (launchStarted.current) return;
    launchStarted.current = true;
    const appUrl = `${window.location.origin}/?installed=1`;
    try {
      window.open(appUrl, "_blank")?.focus();
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      if (!isStandaloneDisplay()) window.location.assign(appUrl);
    }, 400);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const bip = event as BeforeInstallPromptEvent;
      window.__gondupDeferredPrompt = bip;
      setDeferredPrompt(bip);
    };
    window.addEventListener("beforeinstallprompt", handler);
    if (window.__gondupDeferredPrompt) setDeferredPrompt(window.__gondupDeferredPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  useEffect(() => {
    const installed = () => {
      setInstallProgress(100);
      setInstallStep("Instalação concluída — abrindo…");
      setDeferredPrompt(null);
      window.__gondupDeferredPrompt = null;
      window.setTimeout(() => {
        openInstalledApp();
        setIsInstalling(false);
        setInstallStep("");
      }, 350);
    };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, [openInstalledApp]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    setIsIosDevice(/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsStandaloneApp(isStandaloneDisplay());
  }, []);

  const install = async () => {
    if (!deferredPrompt || isInstalling) return false;
    launchStarted.current = false;
    setIsInstalling(true);
    setInstallStep("Preparando instalação…");
    setInstallProgress(8);
    await new Promise((resolve) => setTimeout(resolve, 220));
    try {
      await deferredPrompt.prompt();
    } catch {
      setInstallStep("Não foi possível abrir o instalador.");
      setInstallProgress(0);
      setIsInstalling(false);
      return false;
    }
    setInstallProgress(40);
    setInstallStep("Aguardando sua confirmação…");
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome !== "accepted") {
      setInstallStep("Instalação cancelada.");
      setInstallProgress(0);
      setIsInstalling(false);
      setDeferredPrompt(null);
      window.__gondupDeferredPrompt = null;
      return false;
    }
    setDeferredPrompt(null);
    window.__gondupDeferredPrompt = null;
    setInstallStep("Instalando o aplicativo…");
    for (const progress of [52, 62, 72, 82, 90, 95]) {
      await new Promise((resolve) => setTimeout(resolve, 180));
      setInstallProgress((current) => Math.max(current, progress));
      if (launchStarted.current) break;
    }
    if (!launchStarted.current) {
      setInstallProgress(100);
      setInstallStep("Abrindo o aplicativo…");
      await new Promise((resolve) => setTimeout(resolve, 300));
      openInstalledApp();
    }
    setIsInstalling(false);
    setInstallStep("");
    return true;
  };

  // Em aba do navegador sempre oferecemos baixar/instalar (nativo ou instruções).
  const showInstallOffer = !isStandaloneApp;

  return {
    canInstall: Boolean(deferredPrompt) && !isStandaloneApp,
    showInstallOffer,
    isIosInstallable: isIosDevice && !isStandaloneApp,
    isStandalone: isStandaloneApp,
    install,
    isInstalling,
    installProgress,
    installStep,
  };
}
