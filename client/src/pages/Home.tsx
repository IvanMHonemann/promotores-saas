import React, { useState, useMemo, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { BrandLogo } from "@/components/BrandLogo";
import { CreditCard, 
  Building2, 
  Flame, 
  FileText, 
  AlertTriangle, 
  Plus, 
  Search, 
  Filter, 
  Printer, 
  Eye, 
  Trash2, 
  Edit, 
  MapPin, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  History,
  Phone, 
  Settings,
  BellRing,
  Download,
  QrCode,
  HardDrive,
  ScrollText,
  ShieldCheck,
  ChevronRight,
  Users,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
  CloudOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ServiceOrderDocument } from "@/components/ServiceOrderDocument";
import { toast } from "sonner";
import { useOfflineSnapshot, useOnlineStatus } from "@/offline/hooks";
import { offlineDb, markOfflineMutationFailed, queueOfflineMutation, saveOnlineSnapshot } from "@/offline/localDb";
import { downloadQrCodePng, openPrintQrLabel, qrCodeImageUrl } from "@/lib/qrcodeUrl";
import { ClientDetailCard } from "./home/ClientDetailCard";
import { ExtinguishersPanel, type ExtinguisherListItem } from "./home/ExtinguishersPanel";
import type { HomeTab } from "./home/types";
import { isOfflineFailure } from "./home/utils";

export default function Home() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const isPlatformAdmin = user?.role === "platform_admin";
  // Escopo offline: empresa (companyId). Fallback para id do membro (legado).
  const tenantKey = user
    ? (isPlatformAdmin
        ? `platform:${user.id}`
        : (user as any).companyId
          ? String((user as any).companyId)
          : user.id < 0
            ? String(Math.abs(user.id))
            : String(user.id))
    : null;
  const isCompanyAdmin = user?.role === "company_admin";
  const mySubQuery = trpc.billing.mySubscription.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
  });
  const profileExtrasQuery = trpc.auth.profileExtras.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
  });
  const headerAvatarUrl = profileExtrasQuery.data?.avatarDataUrl || null;
  const headerInitials = (user?.name || user?.email || "U").trim().slice(0, 2).toUpperCase();
  const currentPlanLabel = mySubQuery.data?.plan?.name
    ? `Plano atual: ${mySubQuery.data.plan.name}`
    : mySubQuery.isLoading
      ? "Carregando plano…"
      : "Sem plano definido";
  const planFeatures = (mySubQuery.data?.plan || mySubQuery.data?.effective || {}) as Record<string, unknown>;
  const hasFeature = (key: string, defaultValue = true) => {
    if (isPlatformAdmin) return true;
    if (mySubQuery.isLoading) return true; // evita esconder menu durante carga
    const v = planFeatures[key];
    if (v === undefined || v === null) return defaultValue;
    return Boolean(v);
  };
  const canManageUsers = (isCompanyAdmin || isPlatformAdmin) && hasFeature("featureUsers", false);
  const canUseBackup = hasFeature("featureBackup", true);
  const canUseAudit = hasFeature("featureReports", false);
  const canUseOffline = hasFeature("featureOfflinePwa", true);
  const [activeTab, setActiveTab] = useState<HomeTab>("dashboard");
  const [selectedCity, setSelectedCity] = useState<string>("TODAS");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [extinguisherFilter, setExtinguisherFilter] = useState<"all" | "active">("all");
  const [alertFilter, setAlertFilter] = useState<"all" | "near" | "expired">("all");
  const [clientPage, setClientPage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [alertPage, setAlertPage] = useState(1);
  const pageSize = 25;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Visualização e Impressão de OS
  const [viewingOrderId, setViewingOrderId] = useState<number | null>(null);
  const suppressOrderPreviewRef = useRef(false);
  const [platformOrderPreview, setPlatformOrderPreview] = useState<any>(null);

  // Modais de Criação
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isExtinguisherModalOpen, setIsExtinguisherModalOpen] = useState(false);
  const [isSyncingOffline, setIsSyncingOffline] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ done: 0, total: 0, failed: 0, pending: 0 });
  const [lastSyncResult, setLastSyncResult] = useState<{ ok: number; failed: number } | null>(null);
  const [syncNonce, setSyncNonce] = useState(0);
  const [editingExtinguisherId, setEditingExtinguisherId] = useState<number | null>(null);
  const [qrExtFromList, setQrExtFromList] = useState<ExtinguisherListItem | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<number | null>(null);
  const [editingClientCompanyId, setEditingClientCompanyId] = useState<number | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editingOrderCompanyId, setEditingOrderCompanyId] = useState<number | null>(null);
  const [returnToOrderAfterClient, setReturnToOrderAfterClient] = useState(false);
  const [returnToOrderAfterExtinguisher, setReturnToOrderAfterExtinguisher] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const platformClientsInput = useMemo(() => selectedCompanyId ? { companyId: selectedCompanyId } : undefined, [selectedCompanyId]);
  const clientPageInput = useMemo(() => ({ page: clientPage, pageSize, city: selectedCity, search: searchQuery }), [clientPage, selectedCity, searchQuery]);
  const platformClientPageInput = useMemo(() => ({ companyId: selectedCompanyId || 0, ...clientPageInput }), [selectedCompanyId, clientPageInput]);
  const orderPageInput = useMemo(() => ({ page: orderPage, pageSize, city: selectedCity, from: fromDate || undefined, to: toDate || undefined }), [orderPage, selectedCity, fromDate, toDate]);
  const platformOrderPageInput = useMemo(() => ({ companyId: selectedCompanyId || 0, ...orderPageInput }), [selectedCompanyId, orderPageInput]);
  const alertPageInput = useMemo(() => ({ page: alertPage, pageSize, filter: alertFilter, city: selectedCity }), [alertPage, alertFilter, selectedCity]);
  const platformDashboardInput = useMemo(() => ({ companyId: selectedCompanyId || 0, city: selectedCity, from: fromDate || undefined, to: toDate || undefined }), [selectedCompanyId, selectedCity, fromDate, toDate]);
  const platformTrashInput = useMemo(() => ({ companyId: selectedCompanyId || 0 }), [selectedCompanyId]);
  const canAccessTrash = isCompanyAdmin || isPlatformAdmin;

  // Seleções para sub-ações
  const [selectedClientIdForExtinguisher, setSelectedClientIdForExtinguisher] = useState<number | null>(null);

  // Queries
  const statsQuery = trpc.dashboard.stats.useQuery(undefined, { enabled: Boolean(tenantKey && !isPlatformAdmin), staleTime: 60_000 });
  const citiesQuery = trpc.clients.cities.useQuery(undefined, { enabled: Boolean(tenantKey && !isPlatformAdmin), staleTime: 120_000 });
  // Lista completa de clientes só quando o select de OS/extintor precisa.
  // O restante da UI online usa paginação; offline usa snapshot.
  const clientsQuery = trpc.clients.list.useQuery(undefined, {
    enabled: Boolean(tenantKey && !isPlatformAdmin && (isExtinguisherModalOpen || isOrderModalOpen)),
    staleTime: 60_000,
  });
  const clientsPageQuery = trpc.clients.page.useQuery(clientPageInput, { enabled: Boolean(tenantKey && !isPlatformAdmin), staleTime: 30_000 });
  const allExtinguishersQuery = trpc.extinguishers.list.useQuery(undefined, { enabled: false });
  const alertsQuery = trpc.extinguishers.alerts.useQuery(undefined, { enabled: false });
  const ordersQuery = trpc.orders.list.useQuery(undefined, { enabled: false });
  const ordersPageQuery = trpc.orders.page.useQuery(orderPageInput, { enabled: Boolean(tenantKey && !isPlatformAdmin), staleTime: 30_000 });
  const alertsPageQuery = trpc.extinguishers.alertsPage.useQuery(alertPageInput, { enabled: Boolean(tenantKey && !isPlatformAdmin), staleTime: 30_000 });
  const offlineSnapshotQuery = trpc.offline.snapshot.useQuery({ page: 1, pageSize: 50 }, { enabled: Boolean(tenantKey && !isPlatformAdmin) });
  const alertDaysQuery = trpc.settings.getAlertDays.useQuery(undefined, { enabled: Boolean(tenantKey && !isPlatformAdmin) });
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const platformStatsQuery = trpc.platform.dashboard.useQuery(platformDashboardInput, { enabled: isPlatformAdmin && Boolean(selectedCompanyId) });
  const platformClientsQuery = trpc.platform.data.clients.useQuery(platformClientsInput, { enabled: isPlatformAdmin && Boolean(selectedCompanyId) });
  const platformClientsPageQuery = trpc.platform.data.clientsPage.useQuery(platformClientPageInput, { enabled: isPlatformAdmin && Boolean(selectedCompanyId) });
  const platformOrdersPageQuery = trpc.platform.data.ordersPage.useQuery(platformOrderPageInput, { enabled: isPlatformAdmin && Boolean(selectedCompanyId) });
  const platformAlertsPageQuery = trpc.platform.data.alertsPage.useQuery({ companyId: selectedCompanyId || 0, page: alertPage, pageSize, filter: alertFilter, city: selectedCity }, { enabled: Boolean(isPlatformAdmin && selectedCompanyId) });
  const trashQuery = trpc.trash.list.useQuery(undefined, { enabled: Boolean(tenantKey && isCompanyAdmin) });
  const platformTrashQuery = trpc.platform.data.trash.list.useQuery(platformTrashInput, { enabled: Boolean(isPlatformAdmin && selectedCompanyId) });
  const visibleTrash = isPlatformAdmin ? (platformTrashQuery.data || []) : (trashQuery.data || []);
  const remoteExtinguishers = useMemo(() => allExtinguishersQuery.data || [], [allExtinguishersQuery.data]);
  const listQrInfoQuery = trpc.extinguishers.qrInfo.useQuery(
    { id: qrExtFromList?.id || 0 },
    { enabled: Boolean(qrExtFromList?.id && !isPlatformAdmin) },
  );
  const orderDetailsQuery = trpc.orders.byId.useQuery(
    { id: viewingOrderId! },
    { enabled: Boolean(tenantKey && viewingOrderId && viewingOrderId > 0 && (typeof navigator === "undefined" || navigator.onLine)) }
  );

  const offline = useOfflineSnapshot({
    tenantKey,
    clients: (isPlatformAdmin ? platformClientsQuery.data : offlineSnapshotQuery.data?.clients) as any,
    extinguishers: (isPlatformAdmin ? undefined : offlineSnapshotQuery.data?.extinguishers) as any,
    orders: (isPlatformAdmin ? undefined : offlineSnapshotQuery.data?.orders) as any,
    alerts: (isPlatformAdmin ? undefined : offlineSnapshotQuery.data?.alerts) as any,
    alertDays: alertDaysQuery.data,
  });
  useEffect(() => {
    if (!tenantKey || !offline.isOnline || isPlatformAdmin) return;
    if (!Array.isArray(clientsQuery.data) || clientsQuery.isFetching) return;
    if (!Array.isArray(ordersQuery.data) || ordersQuery.isFetching) return;
    if (!Array.isArray(allExtinguishersQuery.data) || allExtinguishersQuery.isFetching) return;
    void saveOnlineSnapshot({
      tenantKey,
      clients: clientsQuery.data as any,
      extinguishers: allExtinguishersQuery.data as any,
      orders: ordersQuery.data as any,
      preserveExisting: false,
    });
  }, [tenantKey, offline.isOnline, isPlatformAdmin, clientsQuery.data, clientsQuery.isFetching, ordersQuery.data, ordersQuery.isFetching, allExtinguishersQuery.data, allExtinguishersQuery.isFetching]);

  const offlineMutations = useLiveQuery(
    () => (tenantKey ? offlineDb.mutations.where("tenantKey").equals(tenantKey).toArray() : Promise.resolve([] as any[])),
    [tenantKey],
  );
  const mutationsReady = offlineMutations !== undefined && Array.isArray(offlineMutations);
  const pendingOfflineCount = (offlineMutations || []).filter((m: any) => (m.state || "pending") === "pending").length;
  const failedOfflineCount = (offlineMutations || []).filter((m: any) => m.state === "failed").length;
  const stableClientsRef = useRef<any[]>([]);
  const stableOrdersRef = useRef<any[]>([]);
  const stableExtRef = useRef<any[]>([]);
  const allClients = useMemo(() => {
    if (isPlatformAdmin) {
      return (platformClientsQuery.data || platformClientsPageQuery.data?.items || offline.clients || []) as any[];
    }
    const remoteList = clientsQuery.data;
    if (!offline.isOnline) {
      const local = (offline.clients && offline.clients.length ? offline.clients : stableClientsRef.current) as any[];
      if (local.length) stableClientsRef.current = local;
      return local;
    }
    // Online: só o servidor. Enquanto carrega, mantém o último valor do servidor — nunca o cache local.
    if (Array.isArray(remoteList)) {
      stableClientsRef.current = remoteList as any[];
      return remoteList as any[];
    }
    return stableClientsRef.current;
  }, [
    isPlatformAdmin,
    platformClientsQuery.data,
    platformClientsPageQuery.data?.items,
    clientsQuery.data,
    clientsQuery.isFetching,
    offline.isOnline,
    offline.clients,
    pendingOfflineCount,
    isSyncingOffline,
  ]);
  // Select de cadastro (extintor/OS): sempre todos os clientes disponíveis, sem filtro de cidade
  const selectClients = useMemo(() => allClients, [allClients]);
  const effectiveClients = useMemo(() => allClients.filter((client: any) => selectedCity === "TODAS" || client.city === selectedCity), [allClients, selectedCity]);
  const effectiveCities = useMemo(() => {
    if (!isPlatformAdmin && offline.isOnline && Array.isArray(citiesQuery.data) && citiesQuery.data.length) {
      return [...citiesQuery.data].filter(Boolean).sort();
    }
    return Array.from(new Set(allClients.map((client: any) => client.city).filter(Boolean))).sort();
  }, [isPlatformAdmin, offline.isOnline, citiesQuery.data, allClients]);
  const effectiveExtinguishers = useMemo(() => {
    if (isPlatformAdmin) return offline.extinguishers || [];
    if (!offline.isOnline) {
      const local = (offline.extinguishers && offline.extinguishers.length ? offline.extinguishers : stableExtRef.current) as any[];
      if (local.length) stableExtRef.current = local;
      return local;
    }
    if (Array.isArray(allExtinguishersQuery.data)) {
      stableExtRef.current = remoteExtinguishers;
      return remoteExtinguishers;
    }
    return stableExtRef.current;
  }, [isPlatformAdmin, remoteExtinguishers, allExtinguishersQuery.data, allExtinguishersQuery.isFetching, offline.isOnline, offline.extinguishers, pendingOfflineCount, isSyncingOffline]);
  const effectiveOrders = useMemo(() => {
    if (isPlatformAdmin) return offline.orders || [];
    const remote = ordersQuery.data;
    if (!offline.isOnline) {
      const local = (offline.orders && offline.orders.length ? offline.orders : stableOrdersRef.current) as any[];
      if (local.length) stableOrdersRef.current = local;
      return local;
    }
    if (Array.isArray(remote)) {
      stableOrdersRef.current = remote as any[];
      return remote as any[];
    }
    return stableOrdersRef.current;
  }, [isPlatformAdmin, ordersQuery.data, ordersQuery.isFetching, offline.isOnline, offline.orders, pendingOfflineCount, isSyncingOffline]);
  const effectiveAlerts = useMemo(() => {
    if (!isPlatformAdmin) return offline.isOnline ? (alertsPageQuery.data?.items || alertsQuery.data || []) : (offline.alerts || []);
    const clientsById = new Map((platformClientsQuery.data || []).map((client: any) => [client.id, client]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysAhead = alertDaysQuery.data || 30;
    if (isPlatformAdmin) return platformAlertsPageQuery.data?.items || [];
    return effectiveExtinguishers.map((extinguisher: any) => {
      const expiration = new Date(extinguisher.expirationDate);
      expiration.setHours(0, 0, 0, 0);
      const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000);
      const alertStatus = diffDays < 0 ? "expired" : diffDays <= 15 ? "urgent" : diffDays <= daysAhead ? "warning" : "ok";
      const alertMessage = diffDays < 0 ? `VENCIDO há ${Math.abs(diffDays)} dia(s)!` : diffDays === 0 ? "VENCE HOJE!" : diffDays <= 15 ? `Vence em ${diffDays} dia(s) (Urgente)` : diffDays <= daysAhead ? `Vence em ${diffDays} dia(s) (Alerta prévio)` : "Dentro da validade";
      return {
        extinguisher,
        client: clientsById.get(extinguisher.clientId) || { companyName: "Cliente não encontrado", city: "", phone: "" },
        diffDays,
        alertStatus,
        alertMessage,
        isNearExpiration: diffDays <= daysAhead,
      };
    });
  }, [isPlatformAdmin, offline.alerts, offline.isOnline, alertsPageQuery.data, alertsQuery.data, platformClientsQuery.data, effectiveExtinguishers, alertDaysQuery.data, platformAlertsPageQuery.data]);
  const stableStatsRef = useRef<any>(null);
  const effectiveStats = useMemo(() => {
    const serverStats = isPlatformAdmin ? platformStatsQuery.data : statsQuery.data;
    if (offline.isOnline && serverStats) {
      stableStatsRef.current = serverStats;
      return serverStats;
    }
    if (offline.isOnline && stableStatsRef.current) return stableStatsRef.current;
    return {
      totalClients: effectiveClients.length,
      totalCities: effectiveCities.length,
      totalExtinguishers: effectiveExtinguishers.length,
      nearExpirationCount: effectiveAlerts.filter((item: any) => item.alertStatus === "warning" || item.alertStatus === "urgent").length,
      expiredCount: effectiveAlerts.filter((item: any) => item.alertStatus === "expired").length,
      totalOrders: effectiveOrders.length,
      alertDaysConfig: offline.alertDays || 30,
    };
  }, [offline.isOnline, offline.alertDays, statsQuery.data, platformStatsQuery.data, isPlatformAdmin, effectiveClients.length, effectiveCities.length, effectiveExtinguishers.length, effectiveAlerts, effectiveOrders.length]);
  const offlineOrderDetails = useMemo(() => {
    const row = (offline.orders || []).find((item: any) => item.order?.id === viewingOrderId);
    return row ? { ...row.order, client: row.client, items: row.order.items || [] } : undefined;
  }, [offline.orders, viewingOrderId]);

  // Mutations
  const utils = trpc.useUtils();


  const restoreTrashMutation = trpc.trash.restore.useMutation({
    onSuccess: async () => {
      toast.success("Item restaurado com sucesso!");
      await Promise.all([
        utils.trash.list.invalidate(),
        utils.clients.list.invalidate(),
        utils.extinguishers.alerts.invalidate(),
        utils.orders.list.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  const permanentlyDeleteTrashMutation = trpc.trash.permanentlyDelete.useMutation({
    onSuccess: async () => {
      toast.success("Item excluído permanentemente.");
      await utils.trash.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const platformRestoreTrashMutation = trpc.platform.data.trash.restore.useMutation({
    onSuccess: async (_, input) => {
      toast.success("Item restaurado com sucesso!");
      await Promise.all([
        utils.platform.data.trash.list.invalidate({ companyId: input.companyId }),
        utils.platform.data.clients.invalidate({ companyId: input.companyId }),
        utils.platform.data.extinguishers.invalidate({ companyId: input.companyId }),
        utils.platform.data.orders.invalidate({ companyId: input.companyId }),
      ]);
    },
    onError: (err) => toast.error(err.message),
  });

  const platformPermanentlyDeleteTrashMutation = trpc.platform.data.trash.permanentlyDelete.useMutation({
    onSuccess: async (_, input) => {
      toast.success("Item excluído permanentemente.");
      await utils.platform.data.trash.list.invalidate({ companyId: input.companyId });
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (selectedCompanyId === null && companiesQuery.data?.length) {
      setSelectedCompanyId(companiesQuery.data.find((company) => company.active)?.id ?? companiesQuery.data[0].id);
    }
  }, [companiesQuery.data, selectedCompanyId]);

  useEffect(() => {
    setClientPage(1);
  }, [selectedCity, searchQuery]);

  useEffect(() => {
    setAlertPage(1);
  }, [alertFilter]);

  const createClientMutation = trpc.clients.create.useMutation({
    onSuccess: async (result) => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsClientModalOpen(false);
      const savedClient = {
        ...clientForm,
        id: result.id,
        accountId: Number(tenantKey),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      utils.clients.list.setData(undefined, (current) => [savedClient as any, ...((current || []) as any[]).filter((client) => client.id !== result.id)]);
      await utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
      if (returnToOrderAfterClient) {
        setOrderForm(prev => ({ ...prev, clientId: result.id, responsibleName: clientForm.contactName, responsibleCpf: clientForm.cpf, responsibleBirthDate: clientForm.birthDate }));
        setReturnToOrderAfterClient(false);
        setIsOrderModalOpen(true);
      }
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) {
        const already = await offlineDb.mutations.where("tenantKey").equals(tenantKey || "").filter((m) => m.entity === "client" && m.action === "create" && m.payload?.companyName === input.companyName).count();
        if (!already) {
          const localId = await saveOfflineClient(input);
          await queueOfflineMutation({ tenantKey: tenantKey!, entity: "client", action: "create", payload: { ...input, localId } });
        }
        toast.success("Cliente salvo no dispositivo (offline). Será sincronizado ao reconectar.");
        setIsClientModalOpen(false);
        return;
      }
      toast.error(err.message);
    },
  });

  const platformCreateClientMutation = trpc.platform.data.createClient.useMutation({
    onSuccess: async (result, input) => {
      toast.success("Cliente cadastrado com sucesso!");
      setIsClientModalOpen(false);
      const savedClient = {
        ...input,
        id: result.id,
        accountId: input.companyId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      utils.platform.data.clients.setData({ companyId: input.companyId }, (current) => [savedClient as any, ...((current || []) as any[]).filter((client) => client.id !== result.id)]);
      await utils.platform.data.clients.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateClientMutation = trpc.clients.update.useMutation({
    onSuccess: async () => {
      toast.success("Dados do cliente atualizados!");
      setEditingClientId(null);
      setIsClientModalOpen(false);
      await utils.clients.invalidate();
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline) && tenantKey) {
        try {
          await updateClientOfflineAndQueue(input);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao salvar offline.");
        }
        return;
      }
      toast.error(err.message);
    },
  });

  const deleteClientMutation = trpc.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Cliente excluído!");
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) {
        if (!tenantKey) return;
        const clientRows = (await offlineDb.clients.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id);
        await offlineDb.clients.bulkDelete(clientRows);
        const ext = await offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.clientId === input.id).toArray();
        await offlineDb.extinguishers.bulkDelete(ext.map((item) => item.id));
        const orders = await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((item) => item.order?.clientId === input.id).toArray();
        await offlineDb.orders.bulkDelete(orders.map((item) => item.order.id));
        await queueOfflineMutation({ tenantKey, entity: "client", action: "delete", payload: input });
        toast.success("Cliente removido do dispositivo.");
        return;
      }
      toast.error(err.message);
    },
  });

  const createExtinguisherMutation = trpc.extinguishers.create.useMutation({
    onSuccess: (result, input) => {
      toast.success("Extintor registrado com sucesso!");
      setIsExtinguisherModalOpen(false);
      setEditingExtinguisherId(null);
      utils.extinguishers.invalidate();
      utils.clients.invalidate();
      utils.dashboard.stats.invalidate();
      if (returnToOrderAfterExtinguisher && result?.id) {
        const qty = Number((input as any).stockQuantity) || 1;
        setOrderForm((prev) => ({
          ...prev,
          clientId: prev.clientId || input.clientId,
          items: [...prev.items.filter((item) => item.description.trim()), {
            description: `Extintor ${input.typeModel}${input.capacity ? ` ${input.capacity}` : ""}`,
            quantity: 1,
            unitPrice: "45.00",
            totalPrice: "45.00",
            extinguisherId: result.id,
            stockQuantity: qty,
          }],
        }));
        setReturnToOrderAfterExtinguisher(false);
        setIsOrderModalOpen(true);
      }
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) { const localId = await saveOfflineExtinguisher(input); await queueOfflineMutation({ tenantKey: tenantKey!, entity: "extinguisher", action: "create", payload: { ...input, localId } }); toast.success("Extintor salvo no dispositivo (offline)."); setIsExtinguisherModalOpen(false); return; }
      toast.error(err.message);
    },
  });
  const platformCreateExtinguisherMutation = trpc.platform.data.createExtinguisher.useMutation({
    onSuccess: async () => {
      toast.success("Extintor registrado com sucesso!");
      setIsExtinguisherModalOpen(false);
      if (selectedCompanyId) await utils.platform.data.extinguishers.invalidate({ companyId: selectedCompanyId });
      if (selectedCompanyId) await utils.platform.data.clients.invalidate({ companyId: selectedCompanyId });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteExtinguisherMutation = trpc.extinguishers.delete.useMutation({
    onSuccess: () => {
      toast.success("Extintor removido!");
      utils.extinguishers.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) { if (!tenantKey) return; const ext = (await offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id); const alerts = (await offlineDb.alerts.where("tenantKey").equals(tenantKey).filter((row) => row.id === input.id).toArray()).map((row) => row.id); await offlineDb.extinguishers.bulkDelete(ext); await offlineDb.alerts.bulkDelete(alerts); await queueOfflineMutation({ tenantKey, entity: "extinguisher", action: "delete", payload: input }); toast.success("Extintor removido do dispositivo."); return; }
      toast.error(err.message);
    },
  });

  const updateExtinguisherMutation = trpc.extinguishers.update.useMutation({
    onSuccess: async () => {
      toast.success("Extintor atualizado!");
      setIsExtinguisherModalOpen(false);
      setEditingExtinguisherId(null);
      await Promise.all([utils.extinguishers.invalidate(), utils.clients.invalidate(), utils.dashboard.stats.invalidate()]);
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline) && tenantKey) {
        const current = await offlineDb.extinguishers.get(input.id);
        if (current) await offlineDb.extinguishers.put({ ...current, ...input, tenantKey, updatedAt: new Date().toISOString() });
        await queueOfflineMutation({ tenantKey, entity: "extinguisher", action: "update", payload: input });
        toast.success("Alteração salva no dispositivo (offline).");
        return;
      }
      toast.error(err.message);
    },
  });

  const createOrderMutation = trpc.orders.create.useMutation({
    onSuccess: (res) => {
      toast.success("Ordem de serviço criada com sucesso!");
      setIsOrderModalOpen(false);
      utils.orders.invalidate();
      utils.dashboard.stats.invalidate();
      if (res?.id && !suppressOrderPreviewRef.current) {
        setPlatformOrderPreview(null);
        setViewingOrderId(res.id);
      }
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) {
        const id = offlineId();
        const client = allClients.find((item: any) => item.id === input.clientId);
        const order = { ...input, id, orderNumber: input.orderNumber || Math.abs(id), items: input.items, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        if (!tenantKey) return;
        const localClient = client ? { ...client, tenantKey } : { id: input.clientId, tenantKey, companyName: "Cliente offline", city: "Não informado" };
        await offlineDb.orders.put({ tenantKey, order: { ...order, tenantKey }, client: localClient });
        await queueOfflineMutation({ tenantKey, entity: "order", action: "create", payload: { ...input, localId: id } });
        toast.success("Ordem salva no dispositivo (offline).");
        setIsOrderModalOpen(false);
        setViewingOrderId(id);
        return;
      }
      toast.error(err.message);
    },
  });
  const platformCreateOrderMutation = trpc.platform.data.createOrder.useMutation({
    onSuccess: (result, input) => {
      toast.success("Ordem de serviço criada com sucesso!");
      setIsOrderModalOpen(false);
      if (selectedCompanyId) void utils.platform.data.orders.invalidate({ companyId: selectedCompanyId });
      const client = allClients.find((item: any) => item.id === input.clientId);
      setPlatformOrderPreview({ ...input, id: result.id, orderNumber: result.orderNumber, client, items: input.items });
      setViewingOrderId(result.id);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateOrderMutation = trpc.orders.update.useMutation({
    onSuccess: async (_, input) => {
      toast.success("Ordem de serviço atualizada!");
      setEditingOrderId(null);
      setIsOrderModalOpen(false);
      await utils.orders.invalidate();
      setViewingOrderId(input.id);
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline) && tenantKey) {
        try {
          await updateOrderOfflineAndQueue(input);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao salvar OS offline.");
        }
        return;
      }
      toast.error(err.message);
    },
  });

  const deleteOrderMutation = trpc.orders.delete.useMutation({
    onSuccess: () => {
      toast.success("Ordem de serviço excluída!");
      utils.orders.invalidate();
      utils.dashboard.stats.invalidate();
    },
    onError: async (err, input) => {
      if (isOfflineFailure(err, offline.isOnline)) { if (!tenantKey) return; const orders = (await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((row) => row.order?.id === input.id).toArray()).map((row) => row.order.id); await offlineDb.orders.bulkDelete(orders); await queueOfflineMutation({ tenantKey, entity: "order", action: "delete", payload: input }); toast.success("OS excluída no dispositivo (offline). Será sincronizada ao reconectar."); return; }
      toast.error(err.message);
    },
  });

  const platformDeleteOrderMutation = trpc.platform.data.deleteOrder.useMutation({
    onSuccess: async () => {
      toast.success("Ordem de serviço excluída e enviada para a lixeira!");
      if (selectedCompanyId) await utils.platform.data.orders.invalidate({ companyId: selectedCompanyId });
    },
    onError: (err) => toast.error(err.message),
  });
  const platformDeleteClientMutation = trpc.platform.data.deleteClient.useMutation({
    onSuccess: async () => {
      toast.success("Cliente excluído e enviado para a lixeira!");
      if (selectedCompanyId) await utils.platform.data.clients.invalidate({ companyId: selectedCompanyId });
    },
    onError: (err) => toast.error(err.message),
  });
  const platformUpdateClientMutation = trpc.platform.data.updateClient.useMutation({
    onSuccess: async () => {
      toast.success("Dados do cliente atualizados!");
      setEditingClientId(null);
      setEditingClientCompanyId(null);
      setIsClientModalOpen(false);
      if (selectedCompanyId) await utils.platform.data.clients.invalidate({ companyId: selectedCompanyId });
    },
    onError: (err) => toast.error(err.message),
  });
  const platformUpdateOrderMutation = trpc.platform.data.updateOrder.useMutation({
    onSuccess: async () => {
      toast.success("Ordem de serviço atualizada!");
      setEditingOrderId(null);
      setEditingOrderCompanyId(null);
      setIsOrderModalOpen(false);
      if (selectedCompanyId) await utils.platform.data.orders.invalidate({ companyId: selectedCompanyId });
      setPlatformOrderPreview(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const syncLockRef = useRef(false);
  useEffect(() => {
    if (!offline.isOnline || !tenantKey || isPlatformAdmin) return;
    if (pendingOfflineCount + failedOfflineCount === 0) return;
    const kick = window.setTimeout(() => setSyncNonce((n) => n + 1), 400);
    const timer = window.setInterval(() => setSyncNonce((n) => n + 1), 5000);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [offline.isOnline, tenantKey, isPlatformAdmin, pendingOfflineCount, failedOfflineCount]);

  useEffect(() => {
    if (!offline.isOnline) return;
    let cancelled = false;
    void (async () => {
      if (!tenantKey || syncLockRef.current) return;
      syncLockRef.current = true;
      const rank = (mutation: any) => {
        const actionRank = mutation.action === "create" ? 0 : mutation.action === "update" ? 1 : 2;
        const entityRank = mutation.entity === "client" ? 0 : mutation.entity === "extinguisher" ? 1 : 2;
        return actionRank * 10 + entityRank;
      };
      const queued = (await offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt")).filter((mutation) => (mutation.state || "pending") === "pending" || mutation.state === "failed").sort((a, b) => rank(a) - rank(b));
      const seen = new Set<string>();
      const duplicates: number[] = [];
      const unique = [];
      for (const mutation of queued) {
        if (mutation.entity === "client" && mutation.action === "create") {
          const key = `${String(mutation.payload?.companyName || "").trim().toLowerCase()}|${String(mutation.payload?.city || "").trim().toLowerCase()}|${String(mutation.payload?.phone || "").trim()}`;
          if (seen.has(key)) {
            if (mutation.id) duplicates.push(mutation.id);
            continue;
          }
          seen.add(key);
        }
        unique.push(mutation);
      }
      if (duplicates.length) await offlineDb.mutations.bulkDelete(duplicates);
      queued.splice(0, queued.length, ...unique);
      if (!queued.length) {
        setIsSyncingOffline(false);
        return;
      }
      setIsSyncingOffline(true);
      suppressOrderPreviewRef.current = true;
      setSyncProgress({ done: 0, total: queued.length, failed: 0, pending: queued.length });
      let ok = 0;
      let failed = 0;
      let lastError = "";
      const idMap = new Map<number, number>();
      const clean = (value: any): any => {
        if (value == null) return undefined;
        if (Array.isArray(value)) return value.map((item) => clean(item));
        if (typeof value === "object") {
          const out: any = {};
          for (const [key, item] of Object.entries(value)) {
            if (["localId", "tenantKey", "createdAt", "updatedAt", "accountId", "password", "passwordHash"].includes(key)) continue;
            const next = clean(item);
            if (next !== undefined) out[key] = next;
          }
          return out;
        }
        return value;
      };
      for (const mutation of queued) {
        if (cancelled) return;
        try {
          const raw = mutation.payload || {};
          const payload = clean(raw) || {};
          delete payload.localId;
          delete payload.tenantKey;
          delete payload.createdAt;
          delete payload.updatedAt;
          delete payload.accountId;
          delete payload.companyId;
          if (mutation.action === "create") delete payload.id;
          const asDate = (value: any) => {
            if (value == null || value === "") return undefined;
            const text = String(value);
            return text.length >= 10 ? text.slice(0, 10) : text;
          };
          if (mutation.entity === "client") {
            const picked: any = {
              companyName: String(payload.companyName || "").trim(),
              city: String(payload.city || "").trim(),
              cnpj: payload.cnpj || undefined,
              address: payload.address || undefined,
              cep: payload.cep || undefined,
              phone: payload.phone || undefined,
              contactName: payload.contactName || undefined,
              cpf: payload.cpf || undefined,
              birthDate: asDate(payload.birthDate),
              notes: payload.notes || undefined,
            };
            if (mutation.action !== "create") picked.id = Number(payload.id);
            Object.keys(payload).forEach((key) => delete payload[key]);
            Object.assign(payload, picked);
          }
          if (mutation.entity === "extinguisher" && mutation.action === "create") {
            const picked: any = {
              clientId: Number(payload.clientId),
              typeModel: String(payload.typeModel || "PQS"),
              capacity: payload.capacity || undefined,
              serialNumber: payload.serialNumber || undefined,
              locationInBuilding: payload.locationInBuilding || undefined,
              expirationDate: asDate(payload.expirationDate) || new Date().toISOString().slice(0, 10),
              lastInspectionDate: asDate(payload.lastInspectionDate),
              notes: payload.notes || undefined,
            };
            Object.keys(payload).forEach((key) => delete payload[key]);
            Object.assign(payload, picked);
          }
          if (mutation.entity === "order" && mutation.action === "create") {
            const items = Array.isArray(payload.items) ? payload.items.map((item: any) => ({
              description: String(item.description || "Serviço"),
              quantity: Number(item.quantity) || 1,
              unitPrice: String(item.unitPrice ?? "0.00"),
              totalPrice: String(item.totalPrice ?? "0.00"),
              extinguisherId: Number(item.extinguisherId) || undefined,
            })) : [];
            const picked: any = {
              orderDate: asDate(payload.orderDate) || new Date().toISOString().slice(0, 10),
              clientId: Number(payload.clientId),
              replacedAndDelivered: payload.replacedAndDelivered || "SIM",
              leftReserve: payload.leftReserve || "NÃO",
              reserveDetails: payload.reserveDetails || undefined,
              extinguisherExpiration: asDate(payload.extinguisherExpiration),
              licenseExpiration: asDate(payload.licenseExpiration),
              totalAmount: String(payload.totalAmount ?? "0.00"),
              paymentMethod: payload.paymentMethod || "A VISTA",
              installmentsCount: Number(payload.installmentsCount) || 1,
              installmentDates: payload.installmentDates || undefined,
              responsibleName: payload.responsibleName || undefined,
              responsibleCpf: payload.responsibleCpf || undefined,
              responsibleBirthDate: asDate(payload.responsibleBirthDate),
              observations: payload.observations || undefined,
              items,
            };
            Object.keys(payload).forEach((key) => delete payload[key]);
            Object.assign(payload, picked);
          }

          if (payload.clientId && idMap.has(Number(payload.clientId))) payload.clientId = idMap.get(Number(payload.clientId));
          if (payload.items) payload.items = payload.items.map((item: any) => ({ ...item, extinguisherId: idMap.get(Number(item.extinguisherId)) || item.extinguisherId }));
          if (Number(payload.clientId) < 0) {
            throw new Error("Cliente ainda não sincronizado. O cadastro do cliente será enviado primeiro.");
          }
          if (mutation.action !== "create" && Number(payload.id) < 0 && !idMap.has(Number(payload.id))) {
            if (mutation.id) await offlineDb.mutations.delete(mutation.id);
            continue;
          }
          if (mutation.action === "create") {
            const result = mutation.entity === "client" ? await createClientMutation.mutateAsync(payload) : mutation.entity === "extinguisher" ? await createExtinguisherMutation.mutateAsync(payload) : await createOrderMutation.mutateAsync(payload);
            if (raw.localId && result?.id) idMap.set(Number(raw.localId), result.id);
          } else if (mutation.action === "update") {
            const resolvedId = idMap.get(Number(payload.id)) || Number(payload.id);
            payload.id = resolvedId;
            if (mutation.entity === "client") await updateClientMutation.mutateAsync(payload);
            if (mutation.entity === "extinguisher") await updateExtinguisherMutation.mutateAsync(payload);
            if (mutation.entity === "order") await updateOrderMutation.mutateAsync(payload);
          } else {
            const resolvedId = idMap.get(Number(payload.id)) || Number(payload.id);
            if (resolvedId > 0) {
              if (mutation.entity === "client") await deleteClientMutation.mutateAsync({ id: resolvedId });
              if (mutation.entity === "extinguisher") await deleteExtinguisherMutation.mutateAsync({ id: resolvedId });
              if (mutation.entity === "order") await deleteOrderMutation.mutateAsync({ id: resolvedId });
            }
          }
          if (mutation.id) await offlineDb.mutations.delete(mutation.id);
          ok += 1;
          if (!cancelled) setSyncProgress({ done: ok, total: queued.length, failed, pending: Math.max(queued.length - ok - failed, 0) });
          if (!cancelled && ok % 1 === 0) void utils.dashboard.stats.invalidate();
        } catch (error) {
          failed += 1;
          lastError = error instanceof Error ? error.message : "Falha desconhecida";
          if (mutation.id) await markOfflineMutationFailed(mutation.id, tenantKey, lastError);
          if (!cancelled) setSyncProgress({ done: ok, total: queued.length, failed, pending: Math.max(queued.length - ok - failed, 0) });
          // Continua as demais — um erro não pode travar a fila inteira
        }
      }
      if (!cancelled) {
        setLastSyncResult({ ok, failed });
        setSyncProgress({ done: ok, total: queued.length, failed, pending: Math.max(queued.length - ok - failed, 0) });
        setIsSyncingOffline(false);
        suppressOrderPreviewRef.current = false;
        setViewingOrderId((current) => (current != null && current < 0 ? null : current));
        setPlatformOrderPreview((current: any) => (current?.id < 0 ? null : current));
        if (ok) {
          await Promise.all([utils.clients.invalidate(), utils.extinguishers.invalidate(), utils.orders.invalidate(), utils.dashboard.stats.invalidate()]);
          toast.success(`${ok} operação(ões) offline sincronizada(s).`);
        }
        if (failed) toast.error(lastError ? `Falha ao sincronizar: ${lastError}` : `${failed} operação(ões) não sincronizaram.`);
      }
    })().finally(() => {
      syncLockRef.current = false;
    });
    return () => { cancelled = true; };
  }, [offline.isOnline, tenantKey, syncNonce]);

  const setAlertDaysMutation = trpc.settings.setAlertDays.useMutation({
    onSuccess: () => {
      toast.success("Configuração de alerta atualizada!");
      setIsSettingsModalOpen(false);
      utils.settings.invalidate();
      utils.extinguishers.alerts.invalidate();
      utils.dashboard.stats.invalidate();
    },
  });

  // FORM STATES
  const [clientForm, setClientForm] = useState({
    companyName: "",
    cnpj: "",
    address: "",
    city: "Sapiranga",
    cep: "",
    phone: "",
    contactName: "",
    cpf: "",
    birthDate: "",
    notes: "",
  });

  const [extinguisherForm, setExtinguisherForm] = useState({
    clientId: 0,
    typeModel: "PQS ABC 4kg",
    capacity: "4kg",
    serialNumber: "",
    locationInBuilding: "Estoque",
    expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
    lastInspectionDate: new Date().toISOString().split("T")[0],
    notes: "",
    stockQuantity: 1,
  });

  const [orderForm, setOrderForm] = useState({
    clientId: 0,
    orderDate: new Date().toISOString().split("T")[0],
    replacedAndDelivered: "SIM",
    leftReserve: "NÃO",
    reserveDetails: "",
    extinguisherExpiration: "",
    licenseExpiration: "",
    paymentMethod: "A VISTA",
    installmentsCount: 1,
    installmentDates: "",
    responsibleName: "",
    responsibleCpf: "",
    responsibleBirthDate: "",
    observations: "",
    items: [
      { description: "", quantity: 1, unitPrice: "45.00", totalPrice: "45.00", extinguisherId: 0 },
    ],
  });

  const [configDays, setConfigDays] = useState<number>(30);

  // Atualizar subtotal de itens da OS
  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...orderForm.items];
    (updated[index] as any)[field] = value;
    if (field === "quantity" || field === "unitPrice") {
      const q = Number(updated[index].quantity) || 0;
      const u = Number(updated[index].unitPrice) || 0;
      updated[index].totalPrice = (q * u).toFixed(2);
    }
    setOrderForm({ ...orderForm, items: updated });
  };

  const addItemRow = () => {
    setOrderForm({
      ...orderForm,
      items: [
        ...orderForm.items,
        { description: "", quantity: 1, unitPrice: "45.00", totalPrice: "45.00", extinguisherId: 0 },
      ],
    });
  };

  const removeItemRow = (idx: number) => {
    if (orderForm.items.length <= 1) return;
    setOrderForm({
      ...orderForm,
      items: orderForm.items.filter((_, i) => i !== idx),
    });
  };

  const calculatedTotalOrder = useMemo(() => {
    return orderForm.items
      .reduce((acc, curr) => acc + (Number(curr.totalPrice) || 0), 0)
      .toFixed(2);
  }, [orderForm.items]);

  const openClients = (filter: "all" | "active" = "all") => {
    setExtinguisherFilter(filter);
    setActiveTab("clients");
  };
  const openAlerts = (filter: "all" | "near" | "expired" = "all") => {
    setAlertFilter(filter);
    setActiveTab("alerts");
  };

  // Se estiver visualizando a OS para impressão
  const selectedOrderDetails = (platformOrderPreview?.id === viewingOrderId ? platformOrderPreview : undefined) || orderDetailsQuery.data || offlineOrderDetails;
  if (viewingOrderId && selectedOrderDetails) {
    return (
      <ServiceOrderDocument
        order={selectedOrderDetails}
        client={selectedOrderDetails.client}
        items={selectedOrderDetails.items}
        onBack={() => {
          setViewingOrderId(null);
          setPlatformOrderPreview(null);
        }}
      />
    );
  }

  const offlineId = () => -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
  const saveOfflineClient = async (input: Partial<typeof clientForm> & { companyName: string; city: string }) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const id = offlineId();
    await offlineDb.clients.put({ ...input, id, tenantKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    return id;
  };
  const saveOfflineExtinguisher = async (input: Partial<typeof extinguisherForm> & { clientId: number; typeModel: string; expirationDate: string }) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const id = offlineId();
    const expiration = new Date(`${input.expirationDate}T12:00:00`);
    const days = Math.ceil((expiration.getTime() - new Date().setHours(12, 0, 0, 0)) / 86400000);
    const status = days < 0 ? "expired" : days <= (offline.alertDays || 30) ? "warning" : "ok";
    await offlineDb.extinguishers.put({ ...input, id, tenantKey, status, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await offlineDb.alerts.put({ ...input, id, tenantKey, clientId: input.clientId, expirationDate: input.expirationDate, alertStatus: status === "expired" ? "expired" : status === "warning" ? "warning" : "ok" });
    return id;
  };

  const saveClientOfflineAndQueue = async (input: typeof clientForm) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const name = input.companyName.trim().toLowerCase();
    const city = input.city.trim().toLowerCase();
    const already = await offlineDb.mutations.where("tenantKey").equals(tenantKey).filter((m) => m.entity === "client" && m.action === "create" && String(m.payload?.companyName || "").trim().toLowerCase() === name && String(m.payload?.city || "").trim().toLowerCase() === city && (m.state || "pending") === "pending").count();
    if (already) {
      toast.success("Este cliente já está salvo no aparelho. Não criei outro.");
      setIsClientModalOpen(false);
      return;
    }
    const localId = await saveOfflineClient(input);
    await queueOfflineMutation({ tenantKey, entity: "client", action: "create", payload: { ...input, localId } });
    toast.success(`Cliente ${input.companyName} salvo no aparelho.`);
    setIsClientModalOpen(false);
    if (returnToOrderAfterClient) {
      setOrderForm(prev => ({ ...prev, clientId: localId, responsibleName: input.contactName, responsibleCpf: input.cpf, responsibleBirthDate: input.birthDate }));
      setReturnToOrderAfterClient(false);
      setIsOrderModalOpen(true);
    }
  };

  const saveOrderOfflineAndQueue = async (input: any) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const id = offlineId();
    const client = allClients.find((item: any) => item.id === input.clientId);
    const order = { ...input, id, orderNumber: input.orderNumber || Math.abs(id), items: input.items, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const localClient = client ? { ...client, tenantKey } : { id: input.clientId, tenantKey, companyName: "Cliente offline", city: "Não informado" };
    await offlineDb.orders.put({ tenantKey, order: { ...order, tenantKey }, client: localClient });
    await queueOfflineMutation({ tenantKey, entity: "order", action: "create", payload: { ...input, localId: id } });
    toast.success("Ordem salva no dispositivo (offline). Será sincronizada ao reconectar.");
    setIsOrderModalOpen(false);
    setPlatformOrderPreview({ ...order, client: localClient, items: order.items || [] });
    setViewingOrderId(id);
  };

  const updateClientOfflineAndQueue = async (input: any) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const current = await offlineDb.clients.get(input.id);
    const base = current || allClients.find((c: any) => c.id === input.id) || { id: input.id, companyName: input.companyName, city: input.city };
    await offlineDb.clients.put({ ...base, ...input, tenantKey, updatedAt: new Date().toISOString() });
    await queueOfflineMutation({ tenantKey, entity: "client", action: "update", payload: input });
    toast.success("Alteração do cliente salva no dispositivo (offline).");
    setEditingClientId(null);
    setIsClientModalOpen(false);
  };

  const deleteClientOfflineAndQueue = async (id: number) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const clientRows = (await offlineDb.clients.where("tenantKey").equals(tenantKey).filter((row) => row.id === id).toArray()).map((row) => row.id);
    if (clientRows.length) await offlineDb.clients.bulkDelete(clientRows);
    else {
      // remove from local table if only present in cache-shaped store
      try { await offlineDb.clients.delete(id); } catch { /* ignore */ }
    }
    const ext = await offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.clientId === id).toArray();
    if (ext.length) await offlineDb.extinguishers.bulkDelete(ext.map((item) => item.id));
    const orders = await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((item) => item.order?.clientId === id).toArray();
    if (orders.length) await offlineDb.orders.bulkDelete(orders.map((item) => item.order.id));
    await queueOfflineMutation({ tenantKey, entity: "client", action: "delete", payload: { id } });
    toast.success("Cliente excluído no dispositivo (offline). Será sincronizado ao reconectar.");
  };

  const updateOrderOfflineAndQueue = async (input: any) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const existing = (await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((row) => row.order?.id === input.id).toArray())[0];
    const client = allClients.find((item: any) => item.id === input.clientId) || existing?.client || { id: input.clientId, tenantKey, companyName: "Cliente", city: "—" };
    const order = {
      ...(existing?.order || {}),
      ...input,
      id: input.id,
      items: input.items,
      updatedAt: new Date().toISOString(),
      tenantKey,
    };
    await offlineDb.orders.put({ tenantKey, order, client: { ...client, tenantKey } });
    await queueOfflineMutation({ tenantKey, entity: "order", action: "update", payload: input });
    toast.success("Alteração da OS salva no dispositivo (offline).");
    setIsOrderModalOpen(false);
    setEditingOrderId(null);
    setViewingOrderId(input.id);
  };

  const deleteOrderOfflineAndQueue = async (id: number) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const orders = (await offlineDb.orders.where("tenantKey").equals(tenantKey).filter((row) => row.order?.id === id).toArray()).map((row) => row.order.id);
    if (orders.length) await offlineDb.orders.bulkDelete(orders);
    await queueOfflineMutation({ tenantKey, entity: "order", action: "delete", payload: { id } });
    toast.success("OS excluída no dispositivo (offline). Será sincronizada ao reconectar.");
  };

  const saveExtinguisherOfflineAndQueue = async (input: Partial<typeof extinguisherForm> & { clientId: number; typeModel: string; expirationDate: string }) => {
    if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
    const localId = await saveOfflineExtinguisher(input);
    await queueOfflineMutation({ tenantKey, entity: "extinguisher", action: "create", payload: { ...input, localId } });
    toast.success("Extintor salvo no dispositivo (offline). Será sincronizado ao reconectar.");
    setIsExtinguisherModalOpen(false);
    setEditingExtinguisherId(null);
    return localId;
  };

  // Online: listas usam paginação e filtros no banco. Offline: preserva o snapshot local completo.
  const filteredClients = offline.isOnline && (isPlatformAdmin ? platformClientsPageQuery.data : clientsPageQuery.data)
    ? ((isPlatformAdmin ? platformClientsPageQuery.data : clientsPageQuery.data)?.items || [])
    : (effectiveClients || []).filter(c => {
      const matchSearch = searchQuery === "" || c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) || (c.cnpj && c.cnpj.includes(searchQuery)) || (c.contactName && c.contactName.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchSearch;
    });
  const paginatedOrders = offline.isOnline && (isPlatformAdmin ? platformOrdersPageQuery.data : ordersPageQuery.data)
    ? ((isPlatformAdmin ? platformOrdersPageQuery.data : ordersPageQuery.data)?.items || [])
    : (effectiveOrders || []);
  const onlineAlertPage = isPlatformAdmin ? platformAlertsPageQuery.data : alertsPageQuery.data;
  const visibleAlerts = offline.isOnline && onlineAlertPage
    ? onlineAlertPage.items.filter((item) => {
      if (alertFilter === "all") return true;
      return alertFilter === "expired" ? item.alertStatus === "expired" : item.alertStatus === "urgent" || item.alertStatus === "warning";
    })
    : (effectiveAlerts || []).filter((item) => {
    if (alertFilter === "all") return true;
    return alertFilter === "expired" ? item.alertStatus === "expired" : item.alertStatus === "urgent" || item.alertStatus === "warning";
  });
  const clientPageData = isPlatformAdmin ? platformClientsPageQuery.data : clientsPageQuery.data;
  const orderPageData = isPlatformAdmin ? platformOrdersPageQuery.data : ordersPageQuery.data;
  const alertPageData = onlineAlertPage;
  const openClientEditor = (client: any) => {
    setEditingClientId(client.id);
    setEditingClientCompanyId(client.accountId || selectedCompanyId);
    setClientForm({
      companyName: client.companyName || "",
      cnpj: client.cnpj || "",
      address: client.address || "",
      city: client.city || "",
      cep: client.cep || "",
      phone: client.phone || "",
      contactName: client.contactName || "",
      cpf: client.cpf || "",
      birthDate: client.birthDate || "",
      notes: client.notes || "",
    });
    setIsClientModalOpen(true);
  };

  const openOrderEditor = async (id: number) => {
    try {
      const listedOrder = (paginatedOrders || []).find((entry: any) => entry.order.id === id)?.order;
      const detail: any = isPlatformAdmin
        ? (await utils.platform.data.history.fetch({ companyId: listedOrder?.accountId, clientId: listedOrder?.clientId })).find((entry: any) => entry.order.id === id)
        : await utils.orders.byId.fetch({ id });
      if (!detail) throw new Error("OS não encontrada");
      const order = isPlatformAdmin ? detail.order : detail;
      const orderClient = isPlatformAdmin ? detail.client : detail.client;
      setEditingOrderId(id);
      setEditingOrderCompanyId(order.accountId || selectedCompanyId);
      setOrderForm({
        clientId: order.clientId,
        orderDate: order.orderDate instanceof Date ? order.orderDate.toISOString().slice(0, 10) : String(order.orderDate).slice(0, 10),
        replacedAndDelivered: order.replacedAndDelivered || "SIM",
        leftReserve: order.leftReserve || "NÃO",
        reserveDetails: order.reserveDetails || "",
        extinguisherExpiration: order.extinguisherExpiration || "",
        licenseExpiration: order.licenseExpiration || "",
        paymentMethod: order.paymentMethod || "A VISTA",
        installmentsCount: order.installmentsCount || 1,
        installmentDates: order.installmentDates || "",
        responsibleName: order.responsibleName || orderClient?.contactName || "",
        responsibleCpf: order.responsibleCpf || orderClient?.cpf || "",
        responsibleBirthDate: order.responsibleBirthDate || orderClient?.birthDate || "",
        observations: order.observations || "",
        items: (isPlatformAdmin ? detail.items : detail.items || []).map((item: any) => ({
          description: item.description,
          quantity: Number(item.quantity) || 1,
          unitPrice: String(item.unitPrice || "0.00"),
          totalPrice: String(item.totalPrice || "0.00"),
        })),
      });
      setIsOrderModalOpen(true);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível carregar a OS para edição.");
    }
  };

  const requestOrderDeletion = (order: any) => {
    if (!confirm(`Tem certeza que deseja excluir a OS #${order.orderNumber}? Ela ficará na lixeira por 24 horas.`)) return;
    if (isPlatformAdmin) {
      platformDeleteOrderMutation.mutate({ companyId: order.accountId, id: order.id });
    } else {
      if (!offline.isOnline || !navigator.onLine) {
        void deleteOrderOfflineAndQueue(order.id).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível excluir offline."));
      } else {
        deleteOrderMutation.mutate({ id: order.id });
      }
    }
  };

  const requestClientDeletion = (client: any) => {
    if (!confirm(`Tem certeza que deseja excluir o cliente ${client.companyName}? Todo o histórico dele ficará na lixeira por 24 horas.`)) return;
    if (isPlatformAdmin) {
      platformDeleteClientMutation.mutate({ companyId: client.accountId, id: client.id });
    } else {
      if (!offline.isOnline || !navigator.onLine) {
        void deleteClientOfflineAndQueue(client.id).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível excluir offline."));
      } else {
        deleteClientMutation.mutate({ id: client.id });
      }
    }
  };

  const navigateToSection = (section: HomeTab) => {
    if (section === "clients") setExtinguisherFilter("all");
    if (section === "alerts") setAlertFilter("all");
    setActiveTab(section);
    setIsSidebarOpen(false);
    setIsSidebarOpen(false);
  };

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-slate-50 text-slate-900 flex flex-col">
      {/* CABEÇALHO PRINCIPAL */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:h-16 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
            <Button variant="default" size="sm" className="h-10 gap-1.5 border border-red-400 bg-red-600 px-3 text-white shadow-lg shadow-red-950/40 hover:bg-red-700 lg:hidden" onClick={() => setIsSidebarOpen(true)} aria-label="Abrir menu lateral"><Menu className="h-5 w-5" /><span className="text-xs font-black uppercase tracking-wide">Menu</span></Button>
            <BrandLogo variant="dark" height={56} className="max-w-[260px]" />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
            {!isPlatformAdmin && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-red-500/80 bg-slate-800 text-white ring-offset-slate-900 transition hover:border-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    title="Minha conta"
                    aria-label="Minha conta"
                  >
                    {headerAvatarUrl ? (
                      <img src={headerAvatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-white">{headerInitials}</span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 border-slate-700 bg-slate-900 text-slate-100">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-white">{user.name || "Usuário"}</span>
                      <span className="text-xs text-slate-400">{user.email}</span>
                      <span className="text-[11px] text-slate-500">{currentPlanLabel}</span>
                    </div>
                  </DropdownMenuLabel>
                  {isCompanyAdmin && (
                    <>
                      <DropdownMenuSeparator className="bg-slate-700" />
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-800 focus:text-white" onClick={() => navigate("/minha-assinatura")}>
                        <Building2 className="mr-2 h-4 w-4" /> Minha conta e empresa
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-800 focus:text-white" onClick={() => navigate("/admin/usuarios")}>
                        <Users className="mr-2 h-4 w-4" /> Usuários da empresa
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-800 focus:text-white" onClick={() => navigate("/upgrade")}>
                        <CreditCard className="mr-2 h-4 w-4" /> Upgrade de plano
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer focus:bg-slate-800 focus:text-white" onClick={() => navigate("/pagamentos")}>
                        <CreditCard className="mr-2 h-4 w-4" /> Pagamentos
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem className="cursor-pointer text-red-400 focus:bg-slate-800 focus:text-red-300" onClick={() => logout()}>
                    <LogOut className="mr-2 h-4 w-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" className="px-2 text-slate-300 hover:bg-slate-800 hover:text-white" title="Sair" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
              </Button>
            )}

            {/* Botão Configurar Dias de Alerta — somente administrador da empresa */}
            {isCompanyAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="text-slate-200 border-slate-700 hover:bg-slate-800 gap-1.5"
                onClick={() => {
                  setConfigDays(offline.alertDays || 30);
                  setIsSettingsModalOpen(true);
                }}
              >
                <Settings className="w-4 h-4 text-slate-400" />
                <span className="hidden md:inline">Antecedência Alertas:</span>
                <span className="font-bold text-amber-400">{offline.alertDays || 30} dias</span>
              </Button>
            )}

            {/* Criar Ordem de Serviço Rápida */}
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5 shadow"
              onClick={() => {
                setReturnToOrderAfterClient(false);
                if (effectiveClients && effectiveClients.length > 0) {
                  setOrderForm(prev => ({ ...prev, clientId: effectiveClients[0].id }));
                }
                setIsOrderModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nova Ordem de Serviço</span>
              <span className="sm:hidden">Nova OS</span>
            </Button>
          </div>
        </div>
      </header>

      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      <aside className={`desktop-sidebar fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-slate-950 text-white shadow-2xl lg:top-16 ${isSidebarOpen ? "is-open" : ""}`}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-5">
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.18em] text-red-400">Menu principal</p><div className="mt-2 max-w-[260px]"><BrandLogo variant="dark" height={52} /></div></div>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden" onClick={() => setIsSidebarOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-4">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Navegação</p>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "dashboard" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("dashboard")}><Building2 className="h-4 w-4" /> Visão Geral</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "clients" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("clients")}><MapPin className="h-4 w-4" /> Clientes por Cidade</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "extinguishers" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("extinguishers")}><Flame className="h-4 w-4" /> Extintores</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "alerts" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("alerts")}><BellRing className="h-4 w-4 text-amber-400" /> Alertas de Vencimento {(effectiveStats?.nearExpirationCount || 0) + (effectiveStats?.expiredCount || 0) > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold">{(effectiveStats?.nearExpirationCount || 0) + (effectiveStats?.expiredCount || 0)}</span>}</Button>
          <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "orders" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("orders")}><FileText className="h-4 w-4" /> Ordens de Serviço</Button>
          {isPlatformAdmin && <div className="mb-2 rounded-lg border border-slate-700 bg-slate-900 p-2"><label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Empresa da lixeira</label><Select value={selectedCompanyId ? String(selectedCompanyId) : ""} onValueChange={(value) => setSelectedCompanyId(Number(value))}><SelectTrigger className="h-8 w-full border-slate-700 bg-slate-950 text-xs text-slate-200"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger><SelectContent>{(companiesQuery.data || []).filter((company) => company.active).map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent></Select></div>}
          {canAccessTrash && <Button variant="ghost" className={`w-full justify-start gap-3 ${activeTab === "trash" ? "bg-red-600 text-white hover:bg-red-700" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`} onClick={() => navigateToSection("trash")}><Trash2 className="h-4 w-4" /> Lixeira <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-[10px]">{visibleTrash.length} · 24h</span></Button>}
          <div className="my-4 border-t border-slate-800" />
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">Ações rápidas</p>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setIsClientModalOpen(true); setIsSidebarOpen(false); }}><Plus className="h-4 w-4" /> Cadastrar Cliente</Button>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setReturnToOrderAfterClient(false); setIsOrderModalOpen(true); setIsSidebarOpen(false); }}><FileText className="h-4 w-4" /> Nova Ordem de Serviço</Button>
          {canManageUsers && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/admin/usuarios"); setIsSidebarOpen(false); }}><Users className="h-4 w-4" /> Usuários</Button>}
          {isPlatformAdmin && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/admin/assinaturas"); setIsSidebarOpen(false); }}><CreditCard className="h-4 w-4" /> Assinaturas</Button>}
          {isCompanyAdmin && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white"
              onClick={() => { navigate("/upgrade"); setIsSidebarOpen(false); }}
            >
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="flex min-w-0 flex-col items-start text-left">
                <span>Upgrade de plano</span>
                <span className="truncate text-[11px] font-normal text-slate-400">
                  {currentPlanLabel}
                </span>
              </span>
            </Button>
          )}
          {isCompanyAdmin && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { setConfigDays(offline.alertDays || 30); setIsSettingsModalOpen(true); setIsSidebarOpen(false); }}><Settings className="h-4 w-4" /> Antecedência: {offline.alertDays || 30} dias</Button>}
          {canUseBackup && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/backup"); setIsSidebarOpen(false); }}><HardDrive className="h-4 w-4" /> Backup e Restauração</Button>}
          {isCompanyAdmin && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/auditoria"); setIsSidebarOpen(false); }}><ScrollText className="h-4 w-4" /> Auditoria</Button>}
          {!isPlatformAdmin && canUseOffline && <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => { navigate("/sync-status"); setIsSidebarOpen(false); }}><RefreshCw className="h-4 w-4" /> Status da sincronização</Button>}
        </div>
        <div className="border-t border-slate-800 p-4">
          <div className="mb-3 rounded-lg bg-slate-900 px-3 py-2 text-xs text-slate-400">Cidade selecionada: <strong className="text-slate-200">{selectedCity === "TODAS" ? "Todas" : selectedCity}</strong></div>
          <Select value={selectedCity} onValueChange={(val) => setSelectedCity(val)}><SelectTrigger className="mb-3 w-full border-slate-700 bg-slate-900 text-xs text-slate-200"><SelectValue placeholder="Filtrar cidade" /></SelectTrigger><SelectContent><SelectItem value="TODAS">Todas as Cidades</SelectItem>{(effectiveCities || []).map(city => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent></Select>
          <Button variant="ghost" className="w-full justify-start gap-3 text-slate-300 hover:bg-slate-800 hover:text-white" onClick={() => logout()}><LogOut className="h-4 w-4" /> Sair</Button>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="min-w-0 flex-1 lg:pl-72">
      <div className="hidden border-b border-slate-200 bg-white shadow-sm lg:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            {activeTab !== "dashboard" && <Button variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2 text-slate-600" onClick={() => setActiveTab("dashboard")}><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span></Button>}
            <p className="truncate text-xs font-semibold text-slate-500">{activeTab === "dashboard" ? "Visão Geral" : activeTab === "clients" ? "Clientes por Cidade" : activeTab === "extinguishers" ? "Extintores" : activeTab === "alerts" ? "Alertas de Vencimento" : activeTab === "trash" ? "Lixeira — retenção de 24 horas" : "Ordens de Serviço"}</p>
          </div>
          <span className="text-xs text-slate-400">Use o menu lateral para acessar todas as funções</span>
        </div>
      </div>
      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <main className="mx-auto flex min-w-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
        {activeTab !== "dashboard" && (
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3 lg:hidden">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 border-slate-300 bg-white font-semibold text-slate-700" onClick={() => setActiveTab("dashboard")}>
              <ArrowLeft className="h-4 w-4" />
              Voltar para o painel
            </Button>
          </div>
        )}
        {/* ========================================================
            ABA: DASHBOARD GERAL
        ======================================================== */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {isPlatformAdmin && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Visão do administrador geral</h2>
                    <p className="text-xs text-slate-500">Selecione uma empresa para carregar somente os dados necessários.</p>
                  </div>
                  <Badge variant="outline" className="w-fit text-[10px] text-emerald-700">Consultas agregadas no banco</Badge>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Empresa</label>
                    <Select value={selectedCompanyId ? String(selectedCompanyId) : ""} onValueChange={(value) => { setSelectedCompanyId(Number(value)); setSelectedCity("TODAS"); setClientPage(1); setOrderPage(1); setAlertPage(1); }}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                      <SelectContent>{(companiesQuery.data || []).filter((company) => company.active).map((company) => <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Cidade</label>
                    <Select value={selectedCity} onValueChange={(value) => { setSelectedCity(value); setClientPage(1); setOrderPage(1); }}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Todas as cidades" /></SelectTrigger>
                      <SelectContent><SelectItem value="TODAS">Todas as cidades</SelectItem>{effectiveCities.map((city) => <SelectItem key={city} value={city}>{city}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">OS a partir de</label>
                    <Input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setOrderPage(1); }} className="h-10" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500">OS até</label>
                    <Input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setOrderPage(1); }} className="h-10" />
                  </div>
                </div>
                {(selectedCity !== "TODAS" || fromDate || toDate) && <Button variant="ghost" size="sm" className="mt-3 h-8 px-2 text-xs text-slate-500" onClick={() => { setSelectedCity("TODAS"); setFromDate(""); setToDate(""); setClientPage(1); setOrderPage(1); }}>Limpar filtros</Button>}
              </section>
            )}
            <section className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-200/70">
              <div className="relative px-5 py-6 sm:px-7 sm:py-7">
                <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-red-600/20 blur-2xl" />
                <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">
                      <span className="rounded-full bg-white/10 px-2.5 py-1">Painel operacional</span>
                      <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${offline.isOnline ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${offline.isOnline ? "bg-emerald-400" : "bg-amber-300"}`} /> {offline.isOnline ? "Sistema online" : "Sistema offline"}</span>
                    </div>
                    <h1 className="leading-none max-w-[280px]"><BrandLogo variant="dark" height={52} /></h1>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Acompanhe clientes, validade dos equipamentos e ordens de serviço em um só lugar.</p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button onClick={() => setIsClientModalOpen(true)} className="h-10 gap-2 bg-white text-slate-900 hover:bg-slate-100"><Plus className="h-4 w-4" /> Novo cliente</Button>
                    <Button onClick={() => { setReturnToOrderAfterClient(false); setIsOrderModalOpen(true); }} className="h-10 gap-2 bg-red-600 text-white hover:bg-red-700"><FileText className="h-4 w-4" /> Nova OS</Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 divide-x divide-y divide-white/10 border-t border-white/10 bg-white/[0.04] sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-5">
                <button type="button" aria-label="Visualizar clientes cadastrados" onClick={() => openClients()} onKeyDown={(event) => event.key === "Enter" && openClients()} className="group px-4 py-3.5 text-left transition hover:bg-white/[0.08] focus-visible:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Clientes</p><p className="mt-1 text-xl font-black">{effectiveStats?.totalClients || 0}</p><p className="text-[11px] text-slate-400">{effectiveStats?.totalCities || 0} cidades <span className="ml-1 text-white/40 transition group-hover:text-white">→</span></p></button>
                <button type="button" aria-label="Visualizar extintores ativos" onClick={() => openClients("active")} onKeyDown={(event) => event.key === "Enter" && openClients("active")} className="group px-4 py-3.5 text-left transition hover:bg-white/[0.08] focus-visible:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Extintores</p><p className="mt-1 text-xl font-black text-emerald-300">{effectiveStats?.totalExtinguishers || 0}</p><p className="text-[11px] text-slate-400">na base ativa <span className="ml-1 text-white/40 transition group-hover:text-white">→</span></p></button>
                <button type="button" aria-label="Visualizar extintores próximos do vencimento" onClick={() => openAlerts("near")} onKeyDown={(event) => event.key === "Enter" && openAlerts("near")} className="group px-4 py-3.5 text-left transition hover:bg-white/[0.08] focus-visible:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Próximos do vencimento</p><p className="mt-1 text-xl font-black text-amber-300">{effectiveStats?.nearExpirationCount || 0}</p><p className="text-[11px] text-slate-400">até {effectiveStats?.alertDaysConfig || offline.alertDays || 30} dias <span className="ml-1 text-white/40 transition group-hover:text-white">→</span></p></button>
                <button type="button" aria-label="Visualizar extintores vencidos" onClick={() => openAlerts("expired")} onKeyDown={(event) => event.key === "Enter" && openAlerts("expired")} className="group px-4 py-3.5 text-left transition hover:bg-white/[0.08] focus-visible:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Vencidos</p><p className="mt-1 text-xl font-black text-red-300">{effectiveStats?.expiredCount || 0}</p><p className="text-[11px] text-slate-400">ação necessária <span className="ml-1 text-white/40 transition group-hover:text-white">→</span></p></button>
                <button type="button" aria-label="Visualizar ordens de serviço emitidas" onClick={() => setActiveTab("orders")} onKeyDown={(event) => event.key === "Enter" && setActiveTab("orders")} className="group col-span-2 px-4 py-3.5 text-left transition hover:bg-white/[0.08] focus-visible:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:col-span-1 sm:px-5"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Ordens emitidas</p><p className="mt-1 text-xl font-black text-violet-300">{effectiveStats?.totalOrders || 0}</p><p className="text-[11px] text-slate-400">prontas para impressão <span className="ml-1 text-white/40 transition group-hover:text-white">→</span></p></button>
              </div>
            </section>

            {/* SEÇÃO DE ALERTAS CRÍTICOS (Banner de Aviso com Antecedência) */}
            {((effectiveStats?.nearExpirationCount || 0) > 0 || (effectiveStats?.expiredCount || 0) > 0) && (
              <div className="bg-gradient-to-r from-amber-50 to-red-50 border-2 border-amber-300 rounded-xl p-3 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 bg-amber-500 text-white rounded-lg shadow mt-0.5 shrink-0">
                      <BellRing className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        Atenção aos Prazos de Validade dos Extintores!
                      </h3>
                      <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                        Existem extintores que venceram ou estão a menos de <strong>{effectiveStats?.alertDaysConfig || offline.alertDays || 30} dias</strong> do vencimento.
                        Revise os clientes abaixo e agende a recarga/troca.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1 shrink-0"
                    onClick={() => setActiveTab("alerts")}
                  >
                    Ver Lista Completa
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* STATUS DE SINCRONIZAÇÃO OFFLINE */}
            {!isPlatformAdmin && (
              <div className={`rounded-xl border p-4 shadow-sm ${
                !offline.isOnline
                  ? "border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50"
                  : pendingOfflineCount || failedOfflineCount || isSyncingOffline
                    ? "border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50"
                    : "border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50"
              }`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`rounded-lg p-2 shrink-0 ${
                      !offline.isOnline ? "bg-amber-500 text-white" : isSyncingOffline ? "bg-sky-600 text-white" : failedOfflineCount ? "bg-red-600 text-white" : pendingOfflineCount ? "bg-sky-600 text-white" : "bg-emerald-600 text-white"
                    }`}>
                      {!offline.isOnline ? <WifiOff className="h-5 w-5" /> : isSyncingOffline ? <RefreshCw className="h-5 w-5 animate-spin" /> : pendingOfflineCount || failedOfflineCount ? <CloudOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900">
                        {!offline.isOnline
                          ? "Modo offline — dados salvos neste dispositivo"
                          : isSyncingOffline
                            ? `Sincronizando ${syncProgress.done} de ${Math.max(syncProgress.total, 1)}…`
                            : failedOfflineCount
                              ? `${failedOfflineCount} operação(ões) com falha na sincronização`
                              : pendingOfflineCount
                                ? `${pendingOfflineCount} operação(ões) aguardando envio`
                                : "Tudo sincronizado com o servidor"}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {isSyncingOffline ? (
                          <>
                            Concluídas: <strong>{syncProgress.done}</strong> de <strong>{Math.max(syncProgress.total, 1)}</strong>
                            {" · "}
                            Faltam: <strong>{syncProgress.pending}</strong>
                            {" · "}
                            Falhas: <strong>{syncProgress.failed}</strong>
                            {lastSyncResult?.failed ? ` · ${lastSyncResult.failed} não enviada(s)` : ""}
                          </>
                        ) : !mutationsReady ? (
                          <>Carregando fila de sincronização…</>
                        ) : (
                          <>
                            Pendentes: <strong>{pendingOfflineCount}</strong>
                            {" · "}
                            Falhas: <strong>{failedOfflineCount}</strong>
                            {lastSyncResult ? ` · Última: ${lastSyncResult.ok} concluída(s)` + (lastSyncResult.failed ? `, ${lastSyncResult.failed} falha(s)` : "") : ""}
                            {failedOfflineCount ? ` · Motivo: ${(offlineMutations || []).find((m: any) => m.state === "failed")?.lastError || "erro ao enviar"}` : ""}
                          </>
                        )}
                        {!offline.isOnline ? " · Extintores e OS continuam sendo salvos localmente." : ""}
                      </p>
                    </div>
                  </div>
                  {isSyncingOffline && syncProgress.total > 0 && (
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full bg-sky-600 transition-all duration-300" style={{ width: `${Math.round(((syncProgress.done + syncProgress.failed) / syncProgress.total) * 100)}%` }} />
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full sm:w-auto shrink-0 gap-1.5 font-semibold"
                    onClick={() => navigate("/sync-status")}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Ver sincronização
                  </Button>
                </div>
              </div>
            )}

            {/* CLIENTES SEPARADOS POR CIDADE */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-red-600" />
                    Clientes Cadastrados por Região / Cidade
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Selecione um cliente para gerenciar seus extintores ou emitir uma nova Ordem de Serviço
                  </p>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <Input
                      placeholder="Buscar cliente, CNPJ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-9 text-xs"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 shrink-0"
                    onClick={() => setIsClientModalOpen(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Novo Cliente
                  </Button>
                </div>
              </div>

              {/* LISTA DE CLIENTES AGRUPADOS */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="border border-slate-200 hover:border-red-400 transition-all rounded-lg p-4 bg-white shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="bg-slate-100 text-slate-800 font-bold text-[10px] gap-1">
                          <MapPin className="w-3 h-3 text-red-600" />
                          {client.city}
                        </Badge>
                        <span className="text-[11px] font-mono text-slate-500">
                          {client.cnpj || "Sem CNPJ"}
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mt-2 line-clamp-1 cursor-pointer hover:text-red-700" title="Abrir detalhes e histórico" onClick={() => setActiveTab("clients")}>
                        {client.companyName}
                      </h3>

                      <div className="text-xs text-slate-600 mt-2 space-y-1">
                        <div className="line-clamp-1">
                          📍 {client.address || "Endereço não informado"}
                        </div>
                        {client.phone && (
                          <div className="font-mono text-slate-700">
                            📞 {client.phone}
                          </div>
                        )}
                        {client.contactName && (
                          <div className="text-slate-700">
                            👤 Resp: <span className="font-semibold">{client.contactName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-slate-700 gap-1 h-8"
                        onClick={() => {
                          setSelectedClientIdForExtinguisher(client.id);
                          setExtinguisherForm(prev => ({ ...prev, clientId: client.id }));
                          setIsExtinguisherModalOpen(true);
                        }}
                      >
                        <Flame className="w-3.5 h-3.5 text-red-600" />
                        + Extintor
                      </Button>

                      <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs text-slate-600" onClick={() => openClientEditor(client)}>
                        <Edit className="w-3.5 h-3.5 text-blue-600" /> Editar
                      </Button>

                      <Button
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs gap-1 h-8"
                        onClick={() => {
                          setReturnToOrderAfterClient(false);
                          setOrderForm(prev => ({
                            ...prev,
                            clientId: client.id,
                            responsibleName: client.contactName || "",
                            responsibleCpf: client.cpf || "",
                            responsibleBirthDate: client.birthDate || "",
                          }));
                          setIsOrderModalOpen(true);
                        }}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Criar OS
                      </Button>
                    </div>
                  </div>
                ))}

                {filteredClients.length === 0 && (
                  <div className="col-span-full py-12 text-center text-slate-400">
                    Nenhum cliente encontrado com os filtros selecionados.
                  </div>
                )}
              </div>
              {clientPageData && clientPageData.totalPages > 1 && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Mostrando {filteredClients.length} de {clientPageData.total} clientes</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={clientPage <= 1} onClick={() => setClientPage((page) => page - 1)}>Anterior</Button>
                    <span className="font-semibold text-slate-700">Página {clientPage} de {clientPageData.totalPages}</span>
                    <Button size="sm" variant="outline" disabled={clientPage >= clientPageData.totalPages} onClick={() => setClientPage((page) => page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: CLIENTES POR CIDADE (Visão Detalhada com Extintores)
        ======================================================== */}
        {activeTab === "clients" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Gerenciamento de Clientes & Extintores
                </h2>
                  <p className="text-xs text-slate-500">
                    {extinguisherFilter === "active" ? "Mostrando os extintores ativos cadastrados por empresa e cidade" : "Visualização detalhada dos extintores instalados por empresa e cidade"}
                  </p>
              </div>

              <Button
                className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
                onClick={() => setIsClientModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                Cadastrar Cliente
              </Button>
            </div>

            <div className="space-y-4">
              {filteredClients.map((client) => (
                <ClientDetailCard
                  key={client.id}
                  client={client}
                  extinguisherFilter={extinguisherFilter}
                  onAddExtinguisher={() => {
                    setEditingExtinguisherId(null);
                    setSelectedClientIdForExtinguisher(client.id);
                    setExtinguisherForm(prev => ({ ...prev, clientId: client.id }));
                    setIsExtinguisherModalOpen(true);
                  }}
                  onCreateOrder={() => {
                    setOrderForm(prev => ({
                      ...prev,
                      clientId: client.id,
                      responsibleName: client.contactName || "",
                      responsibleCpf: client.cpf || "",
                      responsibleBirthDate: client.birthDate || "",
                    }));
                    setIsOrderModalOpen(true);
                  }}
                  onEdit={() => openClientEditor(client)}
                  onEditOrder={(id) => void openOrderEditor(id)}
                  onViewOrder={async (id) => {
                    if (isPlatformAdmin) {
                      const rows = await utils.platform.data.history.fetch({ companyId: client.accountId, clientId: client.id });
                      const row = rows.find((entry: any) => entry.order.id === id);
                      if (row) setPlatformOrderPreview({ ...row.order, client: row.client, items: row.items });
                    }
                    setViewingOrderId(id);
                  }}
                  onDelete={() => requestClientDeletion(client)}
                />
              ))}
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: EXTINTORES (lista completa)
        ======================================================== */}
        {activeTab === "extinguishers" && (
          <ExtinguishersPanel
            onCreate={() => {
              setEditingExtinguisherId(null);
              setExtinguisherForm({
                clientId: 0,
                typeModel: "PQS ABC 4kg",
                capacity: "4kg",
                serialNumber: "",
                locationInBuilding: "Recepção",
                expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0],
                lastInspectionDate: new Date().toISOString().split("T")[0],
                notes: "",
                stockQuantity: 1,
              });
              setIsExtinguisherModalOpen(true);
            }}
            onEdit={(ext) => {
              setEditingExtinguisherId(ext.id);
              setExtinguisherForm({
                clientId: ext.clientId,
                typeModel: ext.typeModel || "PQS ABC 4kg",
                capacity: ext.capacity || "",
                serialNumber: ext.serialNumber || "",
                locationInBuilding: ext.locationInBuilding || "",
                expirationDate: ext.expirationDate
                  ? new Date(ext.expirationDate as any).toISOString().split("T")[0]
                  : new Date().toISOString().split("T")[0],
                lastInspectionDate: ext.lastInspectionDate
                  ? new Date(ext.lastInspectionDate as any).toISOString().split("T")[0]
                  : "",
                notes: ext.notes || "",
                stockQuantity: 1,
              });
              setIsExtinguisherModalOpen(true);
            }}
            onDelete={(ext) => {
              const label = ext.serialNumber || ext.typeModel || `#${ext.id}`;
              if (!window.confirm(`Remover o extintor ${label}? Ele irá para a lixeira (24h).`)) return;
              deleteExtinguisherMutation.mutate({ id: ext.id });
            }}
            onOpenQr={(ext) => setQrExtFromList(ext)}
          />
        )}

        {/* ========================================================
            ABA: ALERTAS DE VENCIMENTO (Mensagens com Antecedência)
        ======================================================== */}
        {activeTab === "alerts" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BellRing className="w-5 h-5 text-amber-500" />
                    Alertas de Vencimento de Extintores{alertFilter === "near" ? " — Próximos do vencimento" : alertFilter === "expired" ? " — Vencidos" : ""}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Extintores organizados por urgência. Antecedência configurada para: <strong>{offline.alertDays || 30} dias</strong>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2"><Button variant={alertFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setAlertFilter("all")} className="text-xs">Todos</Button><Button variant="outline" size="sm" onClick={() => setIsSettingsModalOpen(true)} className="gap-1.5 text-xs"><Settings className="w-3.5 h-3.5" /> Ajustar Dias de Antecedência</Button></div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {visibleAlerts.map((item, idx) => {
                  const isExpired = item.alertStatus === "expired";
                  const isUrgent = item.alertStatus === "urgent";

                  return (
                    <div
                      key={idx}
                      className={`py-3.5 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg transition-colors ${
                        isExpired
                          ? "bg-red-50/60"
                          : isUrgent
                          ? "bg-amber-50/60"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg text-white mt-0.5 ${
                            isExpired
                              ? "bg-red-600"
                              : isUrgent
                              ? "bg-amber-600"
                              : "bg-blue-600"
                          }`}
                        >
                          <Flame className="w-4 h-4" />
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">
                              {item.client.companyName}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-white">
                              {item.client.city}
                            </Badge>
                            {item.client.phone && (
                              <span className="text-xs text-slate-500 font-mono">
                                📞 {item.client.phone}
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                            <span>
                              <strong>Modelo:</strong> {item.extinguisher.typeModel} ({item.extinguisher.capacity || "N/I"})
                            </span>
                            {item.extinguisher.locationInBuilding && (
                              <span>
                                <strong>Local:</strong> {item.extinguisher.locationInBuilding}
                              </span>
                            )}
                            {item.extinguisher.serialNumber && (
                              <span className="font-mono">
                                <strong>Selo/Nº:</strong> {item.extinguisher.serialNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                        <div className="text-right">
                          <div
                            className={`text-xs font-black uppercase ${
                              isExpired
                                ? "text-red-700"
                                : isUrgent
                                ? "text-amber-800"
                                : "text-slate-800"
                            }`}
                          >
                            {item.alertMessage}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Vencimento: {new Date(item.extinguisher.expirationDate).toLocaleDateString("pt-BR")}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs gap-1 h-8"
                          onClick={() => {
                            setOrderForm(prev => ({
                              ...prev,
                              clientId: item.client.id,
                              responsibleName: item.client.contactName || "",
                              responsibleCpf: item.client.cpf || "",
                              responsibleBirthDate: item.client.birthDate || "",
                              extinguisherExpiration: new Date(item.extinguisher.expirationDate).toLocaleDateString("pt-BR"),
                              items: [
                                {
                                  description: `Recarga / Manutenção Extintor ${item.extinguisher.typeModel}`,
                                  quantity: 1,
                                  unitPrice: "45.00",
                                  totalPrice: "45.00",
                                  extinguisherId: 0,
                                },
                              ],
                            }));
                            setIsOrderModalOpen(true);
                          }}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          Gerar OS
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {visibleAlerts.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                    {alertFilter === "expired" ? "Nenhum extintor vencido encontrado." : alertFilter === "near" ? "Nenhum extintor próximo do vencimento encontrado." : "Parabéns! Todos os extintores estão dentro da validade e sem alertas pendentes."}
                  </div>
                )}
                {alertPageData && alertPageData.totalPages > 1 && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                    <span className="text-slate-500">Mostrando {visibleAlerts.length} de {alertPageData.total} alertas</span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" disabled={alertPage <= 1} onClick={() => setAlertPage((page) => page - 1)}>Anterior</Button>
                      <span className="font-semibold text-slate-700">Página {alertPage} de {alertPageData.totalPages}</span>
                      <Button size="sm" variant="outline" disabled={alertPage >= alertPageData.totalPages} onClick={() => setAlertPage((page) => page + 1)}>Próxima</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            ABA: ORDENS DE SERVIÇO (Listagem e Impressão)
        ======================================================== */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="break-words text-xl font-bold text-slate-900">
                  Ordens de Serviço Emitidas
                </h2>
                <p className="text-xs text-slate-500">
                  Documentos prontos para impressão e PDF no formato profissional da empresa
                </p>
              </div>

              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white gap-2 font-semibold shadow sm:w-auto"
                onClick={() => {
                  if (effectiveClients && effectiveClients.length > 0) {
                    setOrderForm(prev => ({ ...prev, clientId: effectiveClients[0].id }));
                  }
                  setIsOrderModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Ordem de Serviço
              </Button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="divide-y divide-slate-100 md:hidden">
                {(paginatedOrders || []).map(({ order, client }) => (
                  <article key={order.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-bold text-slate-900">#{String(order.orderNumber).padStart(5, "0")}</p>
                        <p className="mt-1 break-words font-semibold text-slate-900">{client.companyName}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">{client.city}</Badge>
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><dt className="text-slate-400">Data</dt><dd className="font-medium text-slate-700">{new Date(order.orderDate).toLocaleDateString("pt-BR")}</dd></div>
                      <div><dt className="text-slate-400">Pagamento</dt><dd className="break-words font-medium text-slate-700">{order.paymentMethod}</dd></div>
                      <div><dt className="text-slate-400">Criada por</dt><dd className="break-words font-medium text-slate-700">{order.createdByName || "Usuário não registrado"}</dd></div>
                      <div><dt className="text-slate-400">Valor total</dt><dd className="font-mono font-bold text-slate-900">R$ {Number(order.totalAmount).toFixed(2)}</dd></div>
                    </dl>
                    <div className="flex flex-col gap-2 pt-1 min-[420px]:flex-row">
                      <Button variant="outline" size="sm" className="h-9 w-full gap-1 text-xs font-semibold text-slate-800 hover:text-red-700 min-[420px]:flex-1" onClick={() => setViewingOrderId(order.id)}><Printer className="h-3.5 w-3.5 text-red-600" /> Visualizar / Imprimir</Button>
                      <Button variant="outline" size="sm" className="h-9 w-full gap-1 text-xs font-semibold text-slate-800 min-[420px]:flex-1" onClick={() => void openOrderEditor(order.id)}><Edit className="h-3.5 w-3.5 text-blue-600" /> Editar</Button>
                      <Button variant="ghost" size="sm" className="h-9 w-full text-slate-400 hover:text-red-600 min-[420px]:w-9" aria-label={`Excluir OS ${order.orderNumber}`} onClick={() => requestOrderDeletion(order)}><Trash2 className="h-3.5 w-3.5" /><span className="min-[420px]:sr-only">Excluir</span></Button>
                    </div>
                  </article>
                ))}
                {(paginatedOrders || []).length === 0 && <div className="p-8 text-center text-slate-400">Nenhuma ordem de serviço cadastrada ainda.</div>}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider">
                    <th className="p-3">Nº OS</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Cliente / Empresa</th>
                    <th className="p-3">Cidade</th>
                    <th className="p-3">Forma Pagto</th>
                    <th className="p-3 text-right">Valor Total</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(paginatedOrders || []).map(({ order, client }) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-mono font-bold text-slate-900">
                        #{String(order.orderNumber).padStart(5, '0')}
                      </td>
                      <td className="p-3 text-slate-600">
                        {new Date(order.orderDate).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="p-3 font-bold text-slate-900">
                        {client.companyName}
                        <div className="mt-1 text-[10px] font-normal text-slate-500">Criada por: {order.createdByName || "Usuário não registrado"}</div>
                      </td>
                      <td className="p-3 text-slate-600">
                        <Badge variant="outline" className="text-[10px]">
                          {client.city}
                        </Badge>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">
                        {order.paymentMethod}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        R$ {Number(order.totalAmount).toFixed(2)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1 font-semibold text-slate-800 hover:text-red-700"
                            onClick={() => setViewingOrderId(order.id)}
                          >
                            <Printer className="w-3.5 h-3.5 text-red-600" />
                            Visualizar / Imprimir
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1 font-semibold" onClick={() => void openOrderEditor(order.id)}><Edit className="w-3.5 h-3.5 text-blue-600" /> Editar</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                            onClick={() => requestOrderDeletion(order)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {(paginatedOrders || []).length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhuma ordem de serviço cadastrada ainda.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              </div>
              {orderPageData && orderPageData.totalPages > 1 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <span className="text-slate-500">Mostrando {paginatedOrders.length} de {orderPageData.total} ordens</span>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={orderPage <= 1} onClick={() => setOrderPage((page) => page - 1)}>Anterior</Button>
                    <span className="font-semibold text-slate-700">Página {orderPage} de {orderPageData.totalPages}</span>
                    <Button size="sm" variant="outline" disabled={orderPage >= orderPageData.totalPages} onClick={() => setOrderPage((page) => page + 1)}>Próxima</Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "trash" && canAccessTrash && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Lixeira de segurança</h2>
              <p className="text-xs text-slate-500">Itens excluídos ficam armazenados por 24 horas. Restaure para devolver ao sistema ou exclua permanentemente para remover o backup.</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
              {visibleTrash.map((item: any) => {
                const remainingHours = Math.max(0, Math.ceil((new Date(item.expiresAt).getTime() - Date.now()) / 3600000));
                const typeLabel = item.itemType === "client" ? "Cliente e histórico" : item.itemType === "order" ? "Ordem de serviço" : "Extintor";
                return <div key={item.id} className="flex flex-col gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-900">{item.label}</p>
                    <p className="text-xs text-slate-500">{typeLabel} · excluído em {new Date(item.deletedAt).toLocaleString("pt-BR")}</p>
                    <Badge variant="outline" className="mt-2 w-fit border-amber-300 bg-amber-50 text-amber-800">Expira em aproximadamente {remainingHours}h</Badge>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-56 sm:flex-row">
                    <Button
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={restoreTrashMutation.isPending || permanentlyDeleteTrashMutation.isPending || platformRestoreTrashMutation.isPending || platformPermanentlyDeleteTrashMutation.isPending}
                      onClick={() => {
                        if (!confirm(`Restaurar “${item.label}” para o sistema?`)) return;
                        if (isPlatformAdmin && selectedCompanyId) platformRestoreTrashMutation.mutate({ companyId: selectedCompanyId, id: item.id });
                        else restoreTrashMutation.mutate({ id: item.id });
                      }}
                    >
                      <History className="h-4 w-4" /> Restaurar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
                      disabled={restoreTrashMutation.isPending || permanentlyDeleteTrashMutation.isPending || platformRestoreTrashMutation.isPending || platformPermanentlyDeleteTrashMutation.isPending}
                      onClick={() => {
                        if (!confirm(`Excluir “${item.label}” permanentemente? Esta ação não pode ser desfeita.`)) return;
                        if (isPlatformAdmin && selectedCompanyId) platformPermanentlyDeleteTrashMutation.mutate({ companyId: selectedCompanyId, id: item.id });
                        else permanentlyDeleteTrashMutation.mutate({ id: item.id });
                      }}
                    >
                      <Trash2 className="h-4 w-4" /> Excluir definitivamente
                    </Button>
                  </div>
                </div>;
              })}
              {visibleTrash.length === 0 && <div className="p-10 text-center text-sm text-slate-500">A lixeira está vazia para a empresa selecionada.</div>}
            </div>
          </div>
        )}
      </main>

      {/* ========================================================
          MODAL: CADASTRAR NOVO CLIENTE
      ======================================================== */}
      <Dialog open={isClientModalOpen} onOpenChange={(open) => { setIsClientModalOpen(open); if (!open) { setEditingClientId(null); setEditingClientCompanyId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingClientId ? "Editar dados do cliente" : "Cadastrar Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {isPlatformAdmin && (
              <div>
                <label className="font-bold block mb-1">Empresa do sistema / área de acesso *</label>
                <Select value={selectedCompanyId ? String(selectedCompanyId) : ""} onValueChange={(value) => setSelectedCompanyId(Number(value))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione a empresa do sistema" /></SelectTrigger>
                  <SelectContent>
                    {(companiesQuery.data ?? []).filter((company) => company.active).map((company) => (
                      <SelectItem key={company.id} value={String(company.id)}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-slate-500">Define em qual área de membros este cliente será salvo. Não é o cliente atendido.</p>
                {!companiesQuery.data?.some((company) => company.active) && <p className="mt-1 text-red-600">Cadastre uma empresa antes de adicionar clientes.</p>}
              </div>
            )}
            <div>
              <label className="font-bold block mb-1">Nome do cliente / Razão Social *</label>
              <Input
                placeholder="Ex: Mercado Central Ltda (cliente)"
                value={clientForm.companyName}
                onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Cidade *</label>
                <Input
                  placeholder="Ex: Sapiranga"
                  value={clientForm.city}
                  onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">CNPJ</label>
                <Input
                  placeholder="00.000.000/0000-00"
                  value={clientForm.cnpj}
                  onChange={(e) => setClientForm({ ...clientForm, cnpj: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Endereço Completo</label>
              <Input
                placeholder="Rua, Número, Bairro"
                value={clientForm.address}
                onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">CEP</label>
                <Input
                  placeholder="93821-000"
                  value={clientForm.cep}
                  onChange={(e) => setClientForm({ ...clientForm, cep: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Telefone / WhatsApp</label>
                <Input
                  placeholder="(51) 99999-9999"
                  value={clientForm.phone}
                  onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Nome do Proprietário / Responsável</label>
              <Input
                placeholder="Nome completo"
                value={clientForm.contactName}
                onChange={(e) => setClientForm({ ...clientForm, contactName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">CPF do Responsável</label>
                <Input
                  placeholder="000.000.000-00"
                  value={clientForm.cpf}
                  onChange={(e) => setClientForm({ ...clientForm, cpf: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data de Nascimento</label>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={clientForm.birthDate}
                  onChange={(e) => setClientForm({ ...clientForm, birthDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsClientModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                if (!clientForm.companyName || !clientForm.city) {
                  toast.error("Preencha o nome da empresa e a cidade!");
                  return;
                }
                if (editingClientId) {
                  if (isPlatformAdmin) {
                    if (!editingClientCompanyId) { toast.error("Selecione a empresa do cliente."); return; }
                    platformUpdateClientMutation.mutate({ ...clientForm, id: editingClientId, companyId: editingClientCompanyId });
                  } else if (!offline.isOnline || !navigator.onLine) {
                    void updateClientOfflineAndQueue({ ...clientForm, id: editingClientId }).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar offline."));
                  } else {
                    updateClientMutation.mutate({ ...clientForm, id: editingClientId });
                  }
                } else if (isPlatformAdmin) {
                  if (!selectedCompanyId) {
                    toast.error("Selecione a empresa responsável pelo cliente.");
                    return;
                  }
                  platformCreateClientMutation.mutate({ ...clientForm, companyId: selectedCompanyId });
                } else {
                  if (!offline.isOnline || !navigator.onLine) {
                    void saveClientOfflineAndQueue(clientForm).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar o cliente offline."));
                  } else {
                    toast.message("Salvando cliente…");
                    createClientMutation.mutate(clientForm);
                  }
                }
              }}
            >
              {editingClientId ? "Salvar alterações" : "Salvar Cliente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: ADICIONAR EXTINTOR AO CLIENTE
      ======================================================== */}
      <Dialog open={isExtinguisherModalOpen} onOpenChange={(open) => { setIsExtinguisherModalOpen(open); if (!open) setEditingExtinguisherId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingExtinguisherId ? "Editar Extintor" : "Cadastrar Extintor"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-bold block mb-1">Cliente Vinculado</label>
              <Select
                value={extinguisherForm.clientId ? String(extinguisherForm.clientId) : ""}
                onValueChange={(val) => setExtinguisherForm({ ...extinguisherForm, clientId: Number(val) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={clientsQuery.isLoading ? "Carregando clientes…" : "Selecione um cliente"} />
                </SelectTrigger>
                <SelectContent>
                  {(selectClients || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.companyName} ({c.city})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clientsQuery.isLoading && (
                <p className="mt-1 text-[11px] text-slate-500">Carregando clientes…</p>
              )}
              {!clientsQuery.isLoading && (!selectClients || selectClients.length === 0) && (
                <p className="mt-1 text-[11px] text-amber-700">
                  Nenhum cliente encontrado. Cadastre um cliente antes de vincular o extintor.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Modelo do Extintor *</label>
                <Select
                  value={extinguisherForm.typeModel}
                  onValueChange={(val) => setExtinguisherForm({ ...extinguisherForm, typeModel: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PQS ABC 4kg">PQS ABC 4kg</SelectItem>
                    <SelectItem value="PQS ABC 6kg">PQS ABC 6kg</SelectItem>
                    <SelectItem value="PQS BC 4kg">PQS BC 4kg</SelectItem>
                    <SelectItem value="PQS BC 6kg">PQS BC 6kg</SelectItem>
                    <SelectItem value="AP 10L (Água)">AP 10L (Água)</SelectItem>
                    <SelectItem value="CO2 6kg">CO2 6kg</SelectItem>
                    <SelectItem value="CO2 4kg">CO2 4kg</SelectItem>
                    <SelectItem value="Carreta PQS 20kg">Carreta PQS 20kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold block mb-1">Capacidade</label>
                <Input
                  placeholder="Ex: 4kg, 6kg, 10L"
                  value={extinguisherForm.capacity}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, capacity: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold block mb-1">Data de Vencimento *</label>
                <Input
                  type="date"
                  value={extinguisherForm.expirationDate}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, expirationDate: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data da Última Recarga</label>
                <Input
                  type="date"
                  value={extinguisherForm.lastInspectionDate}
                  onChange={(e) => setExtinguisherForm({ ...extinguisherForm, lastInspectionDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="font-bold block mb-1">Localização no Imóvel</label>
              <Input
                placeholder="Ex: Entrada Principal, Cozinha, Corredor 2º Andar"
                value={extinguisherForm.locationInBuilding}
                onChange={(e) => setExtinguisherForm({ ...extinguisherForm, locationInBuilding: e.target.value })}
              />
            </div>

            <div>
              <label className="font-bold block mb-1">Nº Cilindro / Selo Inmetro</label>
              <Input
                placeholder="Ex: 006065/2023"
                value={extinguisherForm.serialNumber}
                onChange={(e) => setExtinguisherForm({ ...extinguisherForm, serialNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="font-bold block mb-1">Quantidade em estoque *</label>
              <Input type="number" min="1" value={extinguisherForm.stockQuantity || 1} onChange={(e) => setExtinguisherForm({ ...extinguisherForm, stockQuantity: Math.max(1, Number(e.target.value) || 1) })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExtinguisherModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={() => {
                if (!extinguisherForm.clientId) {
                  toast.error("Selecione o cliente!");
                  return;
                }
                if (!extinguisherForm.expirationDate) {
                  toast.error("Informe a data de vencimento!");
                  return;
                }
                if (editingExtinguisherId) {
                  const payload = {
                    id: editingExtinguisherId,
                    typeModel: extinguisherForm.typeModel,
                    capacity: extinguisherForm.capacity,
                    serialNumber: extinguisherForm.serialNumber,
                    locationInBuilding: extinguisherForm.locationInBuilding,
                    expirationDate: extinguisherForm.expirationDate,
                    lastInspectionDate: extinguisherForm.lastInspectionDate || undefined,
                    notes: extinguisherForm.notes || undefined,
                  };
                  if (!offline.isOnline || !navigator.onLine) {
                    void (async () => {
                      if (!tenantKey) throw new Error("Não há empresa associada para salvar offline.");
                      const current = await offlineDb.extinguishers.get(payload.id);
                      if (current) await offlineDb.extinguishers.put({ ...current, ...payload, tenantKey, updatedAt: new Date().toISOString() });
                      else await offlineDb.extinguishers.put({ ...payload, tenantKey, clientId: extinguisherForm.clientId, updatedAt: new Date().toISOString() });
                      await queueOfflineMutation({ tenantKey, entity: "extinguisher", action: "update", payload });
                      toast.success("Alteração salva no dispositivo (offline).");
                      setIsExtinguisherModalOpen(false);
                      setEditingExtinguisherId(null);
                    })().catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao salvar offline."));
                  } else {
                    updateExtinguisherMutation.mutate(payload);
                  }
                  return;
                }
                if (isPlatformAdmin) {
                  if (!selectedCompanyId) {
                    toast.error("Selecione a empresa responsável pelo extintor.");
                    return;
                  }
                  platformCreateExtinguisherMutation.mutate({ ...extinguisherForm, companyId: selectedCompanyId });
                } else if (!offline.isOnline || !navigator.onLine) {
                  void saveExtinguisherOfflineAndQueue(extinguisherForm).catch((error) =>
                    toast.error(error instanceof Error ? error.message : "Não foi possível salvar o extintor offline."),
                  );
                } else {
                  createExtinguisherMutation.mutate(extinguisherForm);
                }
              }}
            >
              {editingExtinguisherId ? "Salvar alterações" : "Salvar Extintor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: CRIAR ORDEM DE SERVIÇO COMPLETA
      ======================================================== */}
      <Dialog open={isOrderModalOpen} onOpenChange={(open) => { setIsOrderModalOpen(open); if (!open) { setEditingOrderId(null); setEditingOrderCompanyId(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-red-600" />
              {editingOrderId ? "Editar Ordem de Serviço" : "Criar Ordem de Serviço"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* CABEÇALHO DA OS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <div className="mb-1 flex items-center justify-between gap-2"><label className="font-bold">Cliente *</label><Button type="button" variant="link" className="h-auto p-0 text-[11px] font-bold text-red-600" onClick={() => { setReturnToOrderAfterClient(true); setIsOrderModalOpen(false); setIsClientModalOpen(true); }}><Plus className="mr-1 h-3 w-3" /> Cadastrar cliente</Button></div>
                <div className="flex flex-col gap-2 sm:flex-row"><Select
                  value={orderForm.clientId ? String(orderForm.clientId) : ""}
                  onValueChange={(val) => {
                    const cId = Number(val);
                    const selected = (selectClients || []).find((c: any) => c.id === cId);
                    setOrderForm({
                      ...orderForm,
                      clientId: cId,
                      responsibleName: selected?.contactName || "",
                      responsibleCpf: selected?.cpf || "",
                      responsibleBirthDate: selected?.birthDate || "",
                    });
                  }}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder={clientsQuery.isLoading ? "Carregando clientes…" : "Selecione um cliente já cadastrado"} /></SelectTrigger>
                  <SelectContent>{(selectClients || []).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.companyName} ({c.city})</SelectItem>)}</SelectContent>
                </Select></div>
                {!clientsQuery.isLoading && (!selectClients || selectClients.length === 0) && <p className="mt-1 text-[11px] text-amber-700">Nenhum cliente cadastrado. Clique em “Cadastrar cliente” para continuar.</p>}
              </div>

              <div>
                <label className="font-bold block mb-1">Data da OS *</label>
                <Input
                  type="date"
                  value={orderForm.orderDate}
                  onChange={(e) => setOrderForm({ ...orderForm, orderDate: e.target.value })}
                />
              </div>
            </div>

            {/* TABELA DE SERVIÇOS PRESTADOS */}
            <div className="border border-slate-300 rounded-lg overflow-hidden">
              <div className="bg-slate-200 font-bold px-3 py-1.5 flex justify-between items-center text-slate-800">
                <span>SERVIÇOS PRESTADOS (ITENS DA ORDEM)</span>
                <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={addItemRow}>
                  <Plus className="w-3 h-3" /> Adicionar Linha
                </Button>
              </div>

              <div className="border-b border-slate-200 bg-white px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                Escolha um extintor do estoque. A quantidade da OS baixa o estoque ao salvar. Se não houver estoque, cadastre um extintor e ele entra nesta OS.
              </div>
              {effectiveExtinguishers.filter((ext: any) => Number(ext.stockQuantity ?? 1) > 0).length === 0 && (
                <div className="px-3 py-3">
                  <Button type="button" className="bg-red-600 text-white hover:bg-red-700" onClick={() => {
                    if (!orderForm.clientId) { toast.error("Selecione o cliente da OS antes de cadastrar o extintor."); return; }
                    setExtinguisherForm((prev) => ({ ...prev, clientId: orderForm.clientId, stockQuantity: 1 }));
                    setReturnToOrderAfterExtinguisher(true);
                    setIsOrderModalOpen(false);
                    setIsExtinguisherModalOpen(true);
                  }}>Cadastrar extintor e adicionar na OS</Button>
                </div>
              )}
              <div className="hidden grid-cols-[minmax(0,1fr)_70px_110px_110px_32px] gap-2 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                <span>Descrição do serviço / modelo</span><span className="text-center">Qtd.</span><span className="text-right">Valor unitário</span><span className="text-right">Total calculado</span><span />
              </div>
              <div className="space-y-3 p-3">
                {orderForm.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[minmax(0,1fr)_70px_110px_110px_32px] sm:items-center sm:border-0 sm:bg-transparent sm:p-0">
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Extintor do estoque</label>
                    <select
                      className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-xs"
                      value={String((item as any).extinguisherId || "")}
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        const ext = effectiveExtinguishers.find((row: any) => row.id === id);
                        const updated = [...orderForm.items];
                        const quantity = Number(updated[idx].quantity) || 1;
                        const unit = Number(updated[idx].unitPrice) || 0;
                        updated[idx] = {
                          ...updated[idx],
                          extinguisherId: id,
                          description: ext ? `Extintor ${ext.typeModel}${ext.capacity ? ` ${ext.capacity}` : ""}${ext.serialNumber ? ` · ${ext.serialNumber}` : ""}` : "",
                          quantity,
                          totalPrice: (quantity * unit).toFixed(2),
                        };
                        setOrderForm({ ...orderForm, items: updated });
                      }}
                    >
                      <option value="">Selecione do estoque</option>
                      {effectiveExtinguishers.filter((ext: any) => Number(ext.stockQuantity ?? 1) > 0).map((ext: any) => (
                        <option key={ext.id} value={ext.id}>
                          {ext.typeModel}{ext.capacity ? ` ${ext.capacity}` : ""} · estoque {ext.stockQuantity ?? 1}{ext.serialNumber ? ` · ${ext.serialNumber}` : ""}
                        </option>
                      ))}
                    </select>
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Quantidade de unidades</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Ex.: 1"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                      className="text-xs sm:text-center"
                    />
                    <label className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Preço de cada unidade (R$)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Ex.: 45,00"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                      className="text-xs sm:text-right"
                    />
                    <div className="flex items-center justify-between rounded-md border border-dashed border-slate-300 bg-white px-2 py-2 text-xs font-bold text-slate-900 sm:block sm:border-0 sm:bg-transparent sm:p-0 sm:text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-500 sm:hidden">Total desta linha</span><span className="font-mono">R$ {item.totalPrice}</span>
                    </div>
                    {orderForm.items.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-full p-0 text-red-500 hover:text-red-700 sm:w-8"
                        onClick={() => removeItemRow(idx)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* CAMPOS ESPECÍFICOS DA FICHA ORIGINAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <label className="font-bold block mb-1">Trocado e Entregue?</label>
                <Select
                  value={orderForm.replacedAndDelivered}
                  onValueChange={(val) => setOrderForm({ ...orderForm, replacedAndDelivered: val })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIM">SIM</SelectItem>
                    <SelectItem value="NÃO">NÃO</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-bold block mb-1">Deixou Reserva?</label>
                <div className="flex gap-2">
                  <Select
                    value={orderForm.leftReserve}
                    onValueChange={(val) => setOrderForm({ ...orderForm, leftReserve: val })}
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIM">SIM</SelectItem>
                      <SelectItem value="NÃO">NÃO</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Quais modelos deixados?"
                    value={orderForm.reserveDetails}
                    onChange={(e) => setOrderForm({ ...orderForm, reserveDetails: e.target.value })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold block mb-1">Vencimento do Extintor</label>
                <Input
                  placeholder="Ex: 09/2027"
                  value={orderForm.extinguisherExpiration}
                  onChange={(e) => setOrderForm({ ...orderForm, extinguisherExpiration: e.target.value })}
                />
              </div>

              <div>
                <label className="font-bold block mb-1">Vencimento do Alvará</label>
                <Input
                  placeholder="Ex: 12/2026"
                  value={orderForm.licenseExpiration}
                  onChange={(e) => setOrderForm({ ...orderForm, licenseExpiration: e.target.value })}
                />
              </div>
            </div>

            {/* FORMA DE PAGAMENTO */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800">PAGAMENTO</span>
                <span className="text-base font-black text-slate-900 bg-amber-300 px-2 py-0.5 rounded">
                  Total: R$ {calculatedTotalOrder}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="font-bold block mb-1">Forma de Pagamento</label>
                  <Select
                    value={orderForm.paymentMethod}
                    onValueChange={(val) => setOrderForm({ ...orderForm, paymentMethod: val, ...(val === "A VISTA" || val === "PIX" ? { installmentsCount: 1, installmentDates: "" } : {}) })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A VISTA">À VISTA</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="CREDITO">CRÉDITO</SelectItem>
                      <SelectItem value="PARCELADO">PARCELADO</SelectItem>
                      <SelectItem value="BOLETO">BOLETO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(["CREDITO", "PARCELADO", "BOLETO"] as string[]).includes(orderForm.paymentMethod) && <>
                  <div>
                    <label className="font-bold block mb-1">Nº Parcelas</label>
                    <Input
                      type="number"
                      min={1}
                      value={orderForm.installmentsCount}
                      onChange={(e) => setOrderForm({ ...orderForm, installmentsCount: Number(e.target.value) })}
                    />
                  </div>

                  <div>
                    <label className="font-bold block mb-1">Datas das Parcelas</label>
                    <Input
                      placeholder="Ex: 10/10, 10/11"
                      value={orderForm.installmentDates}
                      onChange={(e) => setOrderForm({ ...orderForm, installmentDates: e.target.value })}
                    />
                  </div>
                </>}
              </div>
            </div>

            {/* DADOS DO RESPONSÁVEL */}
            <div className="grid grid-cols-1 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 sm:grid-cols-3">
              <div>
                <label className="font-bold block mb-1">Nome Responsável</label>
                <Input
                  value={orderForm.responsibleName}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleName: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">CPF Responsável</label>
                <Input
                  value={orderForm.responsibleCpf}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleCpf: e.target.value })}
                />
              </div>
              <div>
                <label className="font-bold block mb-1">Data Nasc.</label>
                <Input
                  value={orderForm.responsibleBirthDate}
                  onChange={(e) => setOrderForm({ ...orderForm, responsibleBirthDate: e.target.value })}
                />
              </div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/40 p-3">
              <label className="mb-1 block font-bold text-slate-800">Observações da Ordem de Serviço</label>
              <Textarea
                rows={4}
                placeholder="Descreva informações adicionais, recomendações ou pendências desta OS."
                value={orderForm.observations}
                onChange={(e) => setOrderForm({ ...orderForm, observations: e.target.value })}
                className="min-h-[110px] resize-y bg-white leading-relaxed"
              />
              <p className="mt-1 text-xs text-slate-500">Esse texto será exibido em uma área própria, com quebra automática de linha, no documento e no PDF da ordem.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOrderModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-semibold gap-1.5"
              onClick={() => {
                if (!orderForm.clientId) {
                  toast.error("Selecione o cliente!");
                  return;
                }
                if (editingOrderId) {
                  if (isPlatformAdmin) {
                    if (!editingOrderCompanyId) { toast.error("Não foi possível identificar a empresa da OS."); return; }
                    platformUpdateOrderMutation.mutate({ ...orderForm, totalAmount: calculatedTotalOrder, id: editingOrderId, companyId: editingOrderCompanyId });
                  } else if (!offline.isOnline || !navigator.onLine) {
                    void updateOrderOfflineAndQueue({ ...orderForm, totalAmount: calculatedTotalOrder, id: editingOrderId }).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar a OS offline."));
                  } else {
                    updateOrderMutation.mutate({ ...orderForm, totalAmount: calculatedTotalOrder, id: editingOrderId });
                  }
                } else if (isPlatformAdmin) {
                  const orderCompanyId = selectedCompanyId ?? effectiveClients.find((client: any) => client.id === orderForm.clientId)?.accountId ?? null;
                  if (!orderCompanyId) {
                    toast.error("Selecione a empresa responsável pela ordem de serviço.");
                    return;
                  }
                  platformCreateOrderMutation.mutate({ ...orderForm, totalAmount: calculatedTotalOrder, companyId: orderCompanyId });
                } else {
                  const payload = { ...orderForm, totalAmount: calculatedTotalOrder };
                  if (!payload.clientId) {
                    toast.error("Selecione o cliente da OS.");
                    return;
                  }
                  if (payload.items.some((item: any) => !item.extinguisherId)) {
                    toast.error("Selecione o extintor do estoque em cada linha da OS.");
                    return;
                  }
                  if (!offline.isOnline || !navigator.onLine) {
                    void saveOrderOfflineAndQueue(payload).catch((error) => toast.error(error instanceof Error ? error.message : "Não foi possível salvar a ordem offline."));
                  } else {
                    toast.message("Salvando OS…");
                    createOrderMutation.mutate(payload);
                  }
                }
              }}
            >
              <Printer className="w-4 h-4" />
              {editingOrderId ? "Salvar alterações e visualizar" : "Salvar & Visualizar Impressão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================
          MODAL: CONFIGURAR ANTECEDÊNCIA DOS ALERTAS
      ======================================================== */}
      <Dialog open={isSettingsModalOpen} onOpenChange={setIsSettingsModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-600" />
              Configurar Alerta de Validade
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs space-y-2">
            <p className="text-slate-600">
              Defina quantos dias de antecedência você deseja receber o alerta antes do extintor vencer:
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={365}
                value={configDays}
                onChange={(e) => setConfigDays(Number(e.target.value))}
                className="w-24 text-center font-bold text-sm"
              />
              <span className="font-bold text-slate-700">dias antes</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Exemplo: 30 dias significa que qualquer extintor que for vencer dentro de 1 mês será destacado em amarelo ou vermelho.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsModalOpen(false)}>
              Fechar
            </Button>
            <Button
              className="bg-slate-900 text-white"
              onClick={() => {
                setAlertDaysMutation.mutate({ days: configDays });
              }}
            >
              Salvar Configuração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

            <Dialog open={qrExtFromList != null} onOpenChange={(open) => !open && setQrExtFromList(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code operacional</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500">
            Este QR é da <strong>sua gestão</strong>: ao escanear, mostra cliente, local, validade e inspeção.
            Não substitui o selo Inmetro do equipamento.
          </p>
          {listQrInfoQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Gerando QR Code…</p>
          ) : listQrInfoQuery.data?.url ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <img
                src={qrCodeImageUrl(listQrInfoQuery.data.url, 280)}
                alt="QR Code operacional"
                className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-2"
              />
              <p className="font-mono text-sm font-bold text-slate-900">
                {qrExtFromList?.serialNumber || qrExtFromList?.typeModel || `#${qrExtFromList?.id}`}
              </p>
              <p className="break-all text-center text-[10px] text-slate-400">{listQrInfoQuery.data.url}</p>
              <div className="flex w-full flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={async () => {
                    try {
                      await downloadQrCodePng(
                        listQrInfoQuery.data!.url,
                        `qr-${qrExtFromList?.serialNumber || qrExtFromList?.id}`,
                      );
                      toast.success("QR Code baixado");
                    } catch {
                      toast.error("Falha ao baixar QR Code");
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1 bg-red-600 text-xs hover:bg-red-700"
                  onClick={() =>
                    openPrintQrLabel({
                      url: listQrInfoQuery.data!.url,
                      label: qrExtFromList?.serialNumber || qrExtFromList?.typeModel || `EXT #${qrExtFromList?.id}`,
                      subtitle: "Ficha operacional da empresa",
                    })
                  }
                >
                  <QrCode className="h-3.5 w-3.5" /> Imprimir
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-red-600">Não foi possível gerar o QR Code.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrExtFromList(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </div>
  );
}

/* ========================================================
   COMPONENTE DO CLIENTE COM LISTAGEM DOS EXTINTORES
======================================================== */

