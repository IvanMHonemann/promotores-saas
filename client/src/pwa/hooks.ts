import { useCallback, useEffect, useRef, useState } from "react";

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const online = () => setIsOnline(true);
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => { window.removeEventListener("online", online); window.removeEventListener("offline", offline); };
  }, []);
  return isOnline;
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStep, setInstallStep] = useState("");
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);
  const launchStarted = useRef(false);

  const openInstalledApp = useCallback(() => {
    if (launchStarted.current) return;
    launchStarted.current = true;
    const appUrl = `${window.location.origin}/?installed=1`;
    try { window.open(appUrl, "_blank")?.focus(); } catch { /* ignore */ }
    window.setTimeout(() => {
      if (!window.matchMedia("(display-mode: standalone)").matches) window.location.assign(appUrl);
    }, 400);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    const installed = () => { setInstallProgress(100); setInstallStep("Instalação concluída — abrindo…"); setDeferredPrompt(null); window.setTimeout(() => { openInstalledApp(); setIsInstalling(false); setInstallStep(""); }, 350); };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, [openInstalledApp]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    setIsIosDevice(/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    setIsStandaloneApp(window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as any).standalone));
  }, []);

  const install = async () => {
    if (!deferredPrompt || isInstalling) return false;
    launchStarted.current = false; setIsInstalling(true); setInstallStep("Preparando instalação…"); setInstallProgress(8);
    await new Promise((resolve) => setTimeout(resolve, 220));
    try { await deferredPrompt.prompt(); } catch { setInstallStep("Não foi possível abrir o instalador."); setInstallProgress(0); setIsInstalling(false); return false; }
    setInstallProgress(40); setInstallStep("Aguardando sua confirmação…");
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome !== "accepted") { setInstallStep("Instalação cancelada."); setInstallProgress(0); setIsInstalling(false); setDeferredPrompt(null); return false; }
    setDeferredPrompt(null); setInstallStep("Instalando o aplicativo…");
    for (const progress of [52, 62, 72, 82, 90, 95]) { await new Promise((resolve) => setTimeout(resolve, 180)); setInstallProgress((current) => Math.max(current, progress)); if (launchStarted.current) break; }
    if (!launchStarted.current) { setInstallProgress(100); setInstallStep("Abrindo o aplicativo…"); await new Promise((resolve) => setTimeout(resolve, 300)); openInstalledApp(); }
    setIsInstalling(false); setInstallStep(""); return true;
  };

  return { canInstall: Boolean(deferredPrompt) && !isStandaloneApp, isIosInstallable: isIosDevice && !isStandaloneApp, isStandalone: isStandaloneApp, install, isInstalling, installProgress, installStep };
}
