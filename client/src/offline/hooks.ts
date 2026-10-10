import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { offlineDb, pruneOfflineMutations, saveOnlineSnapshot, type LocalOrderRow, type LocalRecord, type OfflineMutation } from "./localDb";

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
  const launchStarted = useRef(false);

  const openInstalledApp = useCallback(() => {
    if (launchStarted.current) return;
    launchStarted.current = true;
    const appUrl = `${window.location.origin}/?installed=1`;
    try {
      const opened = window.open(appUrl, "_blank");
      if (opened) opened.focus();
    } catch { /* ignore */ }
    // Sai do navegador para a URL do app. No Android o sistema abre o PWA
    // se ele acabou de ser instalado; se não abrir, o usuário vê o aviso.
    window.setTimeout(() => {
      if (!window.matchMedia("(display-mode: standalone)").matches) {
        window.location.assign(appUrl);
      }
    }, 400);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => { event.preventDefault(); setDeferredPrompt(event); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    const installed = () => {
      setInstallProgress(100);
      setInstallStep("Instalação concluída — abrindo…");
      setDeferredPrompt(null);
      window.setTimeout(() => {
        openInstalledApp();
        setIsInstalling(false);
        setInstallStep("");
      }, 350);
    };
    window.addEventListener("appinstalled", installed);
    return () => window.removeEventListener("appinstalled", installed);
  }, [openInstalledApp]);
  const [installStep, setInstallStep] = useState<string>("");

  const install = async () => {
    if (!deferredPrompt || isInstalling) return false;
    launchStarted.current = false;
    setIsInstalling(true);
    setInstallStep("Preparando instalação…");
    setInstallProgress(8);
    await new Promise((resolve) => setTimeout(resolve, 220));
    setInstallProgress(20);
    setInstallStep("Abrindo confirmação do sistema…");
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
      return false;
    }
    setDeferredPrompt(null);
    setInstallStep("Instalando o aplicativo…");
    // Progresso realista até o evento appinstalled (ou timeout de segurança)
    const ticks = [52, 62, 72, 82, 90, 95];
    for (const p of ticks) {
      await new Promise((resolve) => setTimeout(resolve, 280));
      setInstallProgress((cur) => (cur >= 100 ? 100 : Math.max(cur, p)));
      if (launchStarted.current) break;
    }
    if (!launchStarted.current) {
      setInstallProgress(100);
      setInstallStep("Abrindo o aplicativo…");
      await new Promise((resolve) => setTimeout(resolve, 400));
      openInstalledApp();
    }
    setIsInstalling(false);
    setInstallStep("");
    return true;
  };
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isStandaloneApp, setIsStandaloneApp] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent || "";
    const ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as any).standalone);
    setIsIosDevice(ios);
    setIsStandaloneApp(standalone);
  }, []);

  return {
    canInstall: Boolean(deferredPrompt) && !isStandaloneApp,
    /** iPhone/iPad no Safari (não instalado) — precisa do fluxo manual Compartilhar */
    isIosInstallable: isIosDevice && !isStandaloneApp,
    isStandalone: isStandaloneApp,
    install,
    isInstalling,
    installProgress,
    installStep,
  };
}

export function useOfflineSnapshot(remote: {
  tenantKey: string | null;
  clients?: LocalRecord[];
  extinguishers?: LocalRecord[];
  orders?: LocalOrderRow[];
  alerts?: LocalRecord[];
  alertDays?: number;
}) {
  const isOnline = useOnlineStatus();
  const tenantKey = remote.tenantKey;
  const localClients = useLiveQuery(() => tenantKey ? offlineDb.clients.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localExtinguishers = useLiveQuery(() => tenantKey ? offlineDb.extinguishers.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localOrders = useLiveQuery(() => tenantKey ? offlineDb.orders.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalOrderRow[]), [tenantKey], [] as LocalOrderRow[]);
  const localAlerts = useLiveQuery(() => tenantKey ? offlineDb.alerts.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as LocalRecord[]), [tenantKey], [] as LocalRecord[]);
  const localMutations = useLiveQuery(() => tenantKey ? offlineDb.mutations.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as OfflineMutation[]), [tenantKey], [] as OfflineMutation[]);
  const localAlertDays = useLiveQuery(() => tenantKey ? offlineDb.settings.get(`${tenantKey}:alertDays`) : Promise.resolve(undefined), [tenantKey], undefined);

  useEffect(() => {
    if (!isOnline || !tenantKey) return;
    void pruneOfflineMutations(tenantKey);
    if (remote.alertDays) void saveOnlineSnapshot({ tenantKey, alertDays: remote.alertDays });
  }, [isOnline, tenantKey, remote.alertDays]);

  return useMemo(() => {
    const mergePending = (remoteRows: any[] | undefined, localRows: any[], entity: OfflineMutation["entity"], getId: (row: any) => number) => {
      const mutations = localMutations.filter((mutation) => mutation.entity === entity && (mutation.state || "pending") === "pending");
      const written = new Set(mutations.filter((mutation) => mutation.action !== "delete").map((mutation) => Number(mutation.payload?.localId ?? mutation.payload?.id)));
      const deleted = new Set(mutations.filter((mutation) => mutation.action === "delete").map((mutation) => Number(mutation.payload?.id)));
      const merged = (remoteRows || []).filter((row) => !deleted.has(Number(getId(row))) && !deleted.has(Number(row.clientId ?? row.order?.clientId)) && !written.has(Number(getId(row))));
      const remoteIds = new Set(merged.map(getId).map(Number));
      for (const row of localRows) {
        const id = Number(getId(row));
        if (!Number.isFinite(id) || remoteIds.has(id)) continue;
        if (written.has(id) || id < 0) merged.push(row);
      }
      return merged;
    };
    const clients = mergePending(remote.clients, localClients, "client", (row) => row.id);
    const extinguishers = mergePending(remote.extinguishers, localExtinguishers, "extinguisher", (row) => row.id);
    const orders = mergePending(remote.orders, localOrders, "order", (row) => row.order?.id ?? row.id);
    const pick = (merged: any[], local: any[], remoteRows: any[] | undefined) => {
      if (isOnline) return merged;
      const pendingIds = new Set(localMutations.filter((mutation) => (mutation.state || "pending") === "pending").map((mutation) => Number(mutation.payload?.localId ?? mutation.payload?.id)));
      const localClean = local.filter((row) => {
        const id = Number(row.id ?? row.order?.id);
        return id > 0 || pendingIds.has(id);
      });
      if (localClean.length) return localClean;
      return remoteRows || [];
    };
    return {
    isOnline,
    clients: pick(clients, localClients, remote.clients),
    extinguishers: pick(extinguishers, localExtinguishers, remote.extinguishers),
    orders: pick(orders, localOrders, remote.orders),
    alerts: (isOnline && remote.alerts?.length) ? remote.alerts : (localAlerts.length ? localAlerts : (remote.alerts || [])),
    alertDays: (localAlertDays as any)?.value || remote.alertDays || 30,
    };
  }, [isOnline, remote.clients, remote.extinguishers, remote.orders, remote.alerts, remote.alertDays, localClients, localExtinguishers, localOrders, localAlerts, localMutations, localAlertDays]);
}
