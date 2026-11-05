import { useEffect, useMemo, useState } from "react";
import { daysUntil, todayInZone } from "@shared/expiry";
import { AlertTriangle, Bell, Check, CheckCircle2, Clock3, ClipboardList, Loader2, MapPin, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useOfflineQuery } from "@/lib/useOfflineQuery";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { fullDayExcuseLabel, inferFullDayExcuseType, looksLikeFullDayExcuse } from "@shared/correctionExcuse";
import { confirmAction } from "@/components/ConfirmDialog";
import SetupChecklist, { AttentionCard, buildSetupSteps } from "@/components/SetupChecklist";

type Section = "overview" | "routes" | "visits";
type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";
type CompanyPresenceEntry = {
  promoterId: number;
  promoterName: string;
  employeeCode?: string | null;
  clockInTime: Date;
  lastEventType: EventType;
  lastEventTime: Date;
  active: boolean;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
};

const eventLabels: Record<string, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};
const sectionFromHash = (): Section => window.location.hash === "#roteiros" ? "routes" : window.location.hash === "#visitas" ? "visits" : "overview";

export default function OperationsDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [section, setSection] = useState<Section>(() => typeof window === "undefined" ? "overview" : sectionFromHash());
  const [reviewNotes, setReviewNotes] = useState<Record<number, string>>({});
  const { user } = useAuth();
  const isCompanyAdmin = user?.role === "company_admin";
  const isSupervisor = user?.role === "supervisor";
  const access = trpc.entitlements.mine.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  const hasFieldOperations = Boolean(access.data?.effective?.fieldOperations);
  const hasProducts = Boolean(access.data?.effective?.products);
  const hasVisitCheckIn = Boolean(access.data?.effective?.visitCheckIn);
  const hasTimeTracking = Boolean(access.data?.effective?.timeTracking);
  const stores = trpc.operations.stores.list.useQuery(undefined, { enabled: hasFieldOperations });
  const routes = trpc.operations.routes.list.useQuery(undefined, { enabled: hasFieldOperations });
  const weeklyQuery = trpc.operations.routes.weekly.useQuery(undefined, { enabled: hasFieldOperations && isCompanyAdmin });
  const weekly = useOfflineQuery(weeklyQuery, "routes-weekly");
  const promoters = trpc.operations.promoters.list.useQuery(undefined, { enabled: hasFieldOperations && isCompanyAdmin });
  const visits = trpc.operations.visits.list.useQuery({ date: today }, { enabled: hasFieldOperations });
  const storesWithStats = trpc.storePhotos.listStoresWithStats.useQuery(undefined, { enabled: hasFieldOperations, staleTime: 30000 });
  const alertsQuery = trpc.inventoryAlerts.useQuery(undefined, { enabled: hasProducts, staleTime: 60000 });
  const presence = trpc.timeTracking.companyToday.useQuery({ timeZone }, { enabled: isCompanyAdmin && hasTimeTracking });
  const corrections = trpc.timeTracking.correctionRequests.pending.useQuery(undefined, { enabled: isCompanyAdmin && hasTimeTracking });
  const utils = trpc.useUtils();
  const [editingRoute, setEditingRoute] = useState<any>(null);
  const updateRoute = trpc.operations.routes.update.useMutation({
    onSuccess: () => { toast.success("Roteiro atualizado."); setEditingRoute(null); void utils.operations.routes.list.invalidate(); },
    onError: (e) => toast.error(e.message || "Não foi possível atualizar."),
  });
  const deleteRoute = trpc.operations.routes.delete.useMutation({
    onSuccess: () => { toast.success("Roteiro excluído."); void utils.operations.routes.list.invalidate(); },
    onError: (e) => toast.error(e.message || "Não foi possível excluir."),
  });
  const saveWeekly = trpc.operations.routes.saveWeekly.useMutation({
    onSuccess: async () => {
      toast.success("Roteiro semanal salvo.");
      await utils.operations.routes.weekly.invalidate();
      await utils.operations.routes.list.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível salvar o roteiro semanal."),
  });
  const [storeName, setStoreName] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  const review = trpc.timeTracking.correctionRequests.review.useMutation({
    onSuccess: (_, variables) => {
      if ((variables as any).__batch) return;
      toast.success(variables.status === "approved" ? "Correção aprovada e aplicada ao ponto." : "Pedido de correção recusado.");
      void utils.timeTracking.correctionRequests.pending.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível analisar o pedido de correção."),
  });
  const reviewMany = trpc.timeTracking.correctionRequests.reviewMany.useMutation({
    onSuccess: (data, variables) => {
      toast.success(variables.status === "approved" ? `${data.count} horário(s) aprovados juntos.` : `${data.count} horário(s) recusados.`);
      void utils.timeTracking.correctionRequests.pending.invalidate();
    },
    onError: () => toast.error("Não foi possível analisar o pedido de correção."),
  });
  const createStore = trpc.operations.stores.create.useMutation({
    onSuccess: () => {
      toast.success("Loja cadastrada.");
      setStoreName("");
      setStoreCity("");
      setStoreAddress("");
      void utils.operations.stores.list.invalidate();
    },
    onError: () => toast.error("Não foi possível cadastrar a loja. Confira os dados e tente novamente."),
  });
  const metrics = useMemo(() => {
    const rows = visits.data || [];
    const completed = rows.filter((row) => row.visit.status === "completed").length;
    const inProgress = rows.filter((row) => row.visit.status === "in_progress").length;
    const pending = rows.length - completed - inProgress;
    const storesList = storesWithStats.data || [];
    const totalPhotos = storesList.reduce((sum: number, s: any) => sum + (Number(s.photoCount) || 0), 0);
    const expiring = (alertsQuery.data || []).length;
    return {
      total: rows.length,
      completed,
      inProgress,
      pending,
      storeCount: storesList.length,
      totalPhotos,
      expiring,
    };
  }, [visits.data, storesWithStats.data, alertsQuery.data]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const approve = (id: number, status: "approved" | "rejected") => review.mutate({ id, status, reviewNotes: reviewNotes[id]?.trim() || undefined });
  const [approving, setApproving] = useState(false);
  const approveMany = async (ids: number[], status: "approved" | "rejected") => {
    const notes = reviewNotes[ids[0]]?.trim() || undefined;
    setApproving(true);
    try {
      for (const id of ids) {
        await review.mutateAsync({ id, status, reviewNotes: notes, __batch: true } as any);
      }
      toast.success(status === "approved" ? `${ids.length} horários aprovados.` : `${ids.length} horários recusados.`);
      void utils.timeTracking.correctionRequests.pending.invalidate();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível analisar o pedido.");
    } finally {
      setApproving(false);
    }
  };
  const visibleSection = !hasFieldOperations ? "overview" : section === "visits" && !hasVisitCheckIn ? "overview" : section;
  const title = visibleSection === "routes" ? (isCompanyAdmin ? "Lojas" : "Roteiros") : visibleSection === "visits" ? "Visitas" : isCompanyAdmin ? "Central da empresa" : isSupervisor ? "Painel do supervisor" : "Operação de campo";
  const description = visibleSection === "routes"
    ? isCompanyAdmin ? "Cadastre lojas e consulte as rotas distribuídas. A programação semanal fica no cadastro de cada promotor." : "Consulte as rotas distribuídas para a equipe."
    : visibleSection === "visits"
      ? "Acompanhe a execução das visitas planejadas."
      : isCompanyAdmin
        ? "Resumo da operação, presença da equipe e pendências da sua empresa."
        : "Resumo da operação de campo e desempenho da equipe.";

  return (
    <DashboardLayout title={title} description={description} onRefresh={() => window.location.reload()}>
      {visibleSection === "overview" && (
        <Overview
          hasProducts={hasProducts}
          isSupervisor={isSupervisor}
          setupSteps={buildSetupSteps({ stores: (stores.data || []).length, promoters: (promoters.data || []).length, routes: (routes.data || []).length, activity: metrics.totalPhotos > 0 || (hasTimeTracking && (presence.data || []).length > 0) || (hasVisitCheckIn && metrics.completed > 0), hasTimeTracking, hasVisitCheckIn })}
          setupReady={!stores.isLoading && !promoters.isLoading && !routes.isLoading && !storesWithStats.isLoading}
          accessLoading={access.isLoading}
          isPromoter={user?.role === "promoter"}
          todayVisits={visits.data || []}
          metrics={metrics}
          visitsFailed={visits.isError}
          hasFieldOperations={hasFieldOperations}
          hasVisitCheckIn={hasVisitCheckIn}
          hasTimeTracking={hasTimeTracking}
          presence={presence.data || []}
          presenceLoading={presence.isLoading}
          presenceFailed={presence.isError}
          timeZone={timeZone}
          corrections={corrections.data}
          isCompanyAdmin={isCompanyAdmin}
          reviewNotes={reviewNotes}
          setReviewNotes={setReviewNotes}
          approve={approve}
          approveMany={approveMany}
          reviewPending={review.isPending || approving}
          alerts={alertsQuery.data || []}
          alertsLoading={alertsQuery.isLoading}
          alertsError={alertsQuery.isError}
        />
      )}
      {visibleSection === "routes" && (
        <RoutesModule weekly={weekly.data || []} promoters={promoters.data || []} saveWeekly={saveWeekly}
          editingRoute={editingRoute} setEditingRoute={setEditingRoute} updateRoute={updateRoute} deleteRoute={deleteRoute}
          isCompanyAdmin={isCompanyAdmin}
          stores={stores.data || []}
          storesLoading={stores.isLoading}
          storesFailed={stores.isError}
          storeName={storeName}
          setStoreName={setStoreName}
          storeCity={storeCity}
          setStoreCity={setStoreCity}
          storeAddress={storeAddress}
          setStoreAddress={setStoreAddress}
          createStore={createStore}
          routes={routes.data || []}
          routesLoading={routes.isLoading}
          routesFailed={routes.isError}
        />
      )}
      {visibleSection === "visits" && <VisitsModule visits={visits.data || []} metrics={metrics} loading={visits.isLoading} failed={visits.isError} />}
    </DashboardLayout>
  );
}

function Overview({ hasProducts = false, isSupervisor = false, setupSteps = [], setupReady = false, accessLoading = false, isPromoter, todayVisits = [], metrics, visitsFailed, hasFieldOperations, hasVisitCheckIn, hasTimeTracking, presence = [], presenceLoading, presenceFailed, timeZone, corrections, isCompanyAdmin, reviewNotes, setReviewNotes, approve, approveMany, reviewPending, alerts = [], alertsLoading, alertsError }: any) {
  const activePromoters = presence.filter((entry: CompanyPresenceEntry) => entry.active).length;
  return (
    <div className="space-y-6">
      {isPromoter && hasFieldOperations && <Card id="roteiro" className="border-teal-300/30 bg-teal-300/5"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><ClipboardList className="text-teal-300" />Meu roteiro de hoje</CardTitle></CardHeader><CardContent className="space-y-2">{visitsFailed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar o roteiro de hoje.</p>}{!visitsFailed && !todayVisits.length && <p className="text-sm text-slate-300">Você não tem visitas programadas para hoje.</p>}{todayVisits.map(({ visit, store }: any, index: number) => <div key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3"><div><p className="text-xs font-semibold text-teal-300">Parada {index + 1}</p><p className="font-bold text-white">{store.name}</p><p className="text-sm text-slate-300">{store.city}{store.address ? ` · ${store.address}` : ""}</p></div>{hasVisitCheckIn && <Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge>}</div>)}</CardContent></Card>}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-300">Visão geral</p>
        <h2 className="mt-2 text-2xl font-black sm:text-4xl">Operação de campo</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{hasTimeTracking ? "Acompanhe a jornada da equipe, organize roteiros e veja a execução das visitas em um só lugar." : "Organize roteiros e veja a execução das visitas em um só lugar."}</p>
      </div>
      {isCompanyAdmin && hasFieldOperations && setupReady && <SetupChecklist steps={setupSteps} />}
      {isSupervisor && hasFieldOperations && <AttentionCard pendingVisits={hasVisitCheckIn ? metrics.pending : 0} expiring={metrics.expiring} />}

      {accessLoading && <div role="status" className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Carregando módulos da empresa...</div>}
      {hasFieldOperations && <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
        {hasTimeTracking && <Metric label="Em atendimento" value={activePromoters} icon={Users} tone="text-emerald-300" hint="Com ponto aberto" href={isCompanyAdmin && hasVisitCheckIn ? "/check-in-out" : undefined} />}
        <Metric label="Visitas hoje" value={metrics.total} icon={ClipboardList} tone="text-teal-300" hint="Planejadas" href={hasVisitCheckIn ? "#visitas" : "#roteiros"} />
        <Metric label="Lojas" value={metrics.storeCount} icon={MapPin} tone="text-sky-300" hint="Cadastradas" href="/lojas" />
        {hasProducts && <Metric label="Validades" value={metrics.expiring} icon={AlertTriangle} tone="text-amber-300" hint="Vencidos e a vencer" href="/produtos" />}
      </div>}
      {!accessLoading && !hasFieldOperations && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">Roteiros, lojas e visitas não estão liberados para esta empresa. Peça ao administrador da plataforma para liberar o módulo de operação de campo.</div>}
      {hasFieldOperations && visitsFailed && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">Não foi possível carregar os indicadores de visitas. Atualize o painel e tente novamente.</p>}

      {hasProducts && (
        <section className="rounded-2xl border-2 border-amber-400/40 bg-amber-400/10 p-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-300" /> Alertas de validade
            {metrics.expiring > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">{metrics.expiring}</span>}
          </h3>
          {alertsLoading && <p className="mt-3 text-sm text-amber-100/70">Carregando produtos...</p>}
          {alertsError && <p className="mt-3 text-sm text-rose-200">Não foi possível carregar os alertas de validade.</p>}
          {!alertsLoading && !alertsError && metrics.expiring === 0 && (
            <p className="mt-3 text-sm text-amber-100/70">Nenhum produto vencido ou perto do vencimento.</p>
          )}
          <div className="mt-3 space-y-2">
            {(alerts || []).slice(0, 5).map((item: any) => {
              // Validade é data de calendário: compara com "hoje" no fuso de Brasília (sem erro de fuso/horário).
              const days = item.expirationDate ? daysUntil(String(item.expirationDate).slice(0, 10), todayInZone()) : null;
              return (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-amber-300/20 bg-slate-950/60 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.description || item.productCode || "Produto"}</p>
                    <p className="text-xs text-slate-400">{item.productCode || ""}</p>
                  </div>
                  <span className="rounded-lg bg-amber-400/20 px-2 py-1 text-xs font-bold text-amber-200">
                    {days == null ? "—" : days < 0 ? "Vencido" : days === 0 ? "Hoje" : `${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {isCompanyAdmin && hasTimeTracking && <PresenceCard entries={presence} loading={presenceLoading} failed={presenceFailed} timeZone={timeZone} />}

      {hasFieldOperations && <div className="grid gap-3 sm:grid-cols-2">
        {isCompanyAdmin && <a href="/admin/usuarios" className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-5 transition hover:bg-teal-300/15">
          <p className="font-bold text-white">Promotores</p>
          <p className="mt-1 text-sm text-slate-300">Editar matrícula, jornada e programação semanal.</p>
        </a>}
        {!isCompanyAdmin && <a href="#roteiros" className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-5 transition hover:bg-teal-300/15">
          <p className="font-bold text-white">Roteiros</p>
          <p className="mt-1 text-sm text-slate-300">Consultar roteiros programados.</p>
        </a>}
        {hasVisitCheckIn && <a href="#visitas" className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 transition hover:border-teal-300/30">
          <p className="font-bold text-white">Visitas</p>
          <p className="mt-1 text-sm text-slate-300">Acompanhar status das visitas planejadas.</p>
        </a>}
      </div>}

      {isCompanyAdmin && hasTimeTracking && <CorrectionCard corrections={corrections} reviewNotes={reviewNotes} setReviewNotes={setReviewNotes} approve={approve} approveMany={approveMany} reviewPending={reviewPending} />}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, hint, href, className = "" }: { label: string; value: number; icon: LucideIcon; tone: string; hint: string; href?: string; className?: string }) {
  const Tag = href ? "a" : "div";
  return (
    <Tag href={href} className={`block min-h-[96px] bg-[#0b1021] p-3 transition hover:bg-white/[.06] active:bg-white/10 sm:min-h-[108px] sm:p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-300">{label}</p>
          <p className={`mt-1 text-3xl font-black leading-none ${tone}`}>{value}</p>
          <p className="mt-2 text-xs text-slate-400">{hint} <span aria-hidden="true">→</span></p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[.04]">
          <Icon className={`h-4 w-4 ${tone}`} />
        </span>
      </div>
    </Tag>
  );
}

function PresenceCard({ entries, loading, failed, timeZone }: { entries: CompanyPresenceEntry[]; loading: boolean; failed: boolean; timeZone: string }) {
  const formatTime = (value: Date) => new Date(value).toLocaleTimeString("pt-BR", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-white"><Users className="h-5 w-5 text-teal-300" /> Promotores com entrada hoje</CardTitle>
          {!loading && !failed && <Badge variant="outline" className="border-teal-300/30 text-teal-200">{entries.length} no total</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-slate-300">Carregando registros de entrada...</p>}
        {failed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar a presença. Atualize o painel e tente novamente.</p>}
        {!loading && !failed && entries.length === 0 && <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-300">Nenhum promotor registrou entrada hoje.</p>}
        {entries.map((entry) => (
          <div key={entry.promoterId} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-bold text-slate-100">{entry.promoterName}</p>
                <p className="mt-1 text-xs text-slate-400">{entry.employeeCode ? `Matrícula ${entry.employeeCode}` : `Promotor #${entry.promoterId}`}</p>
              </div>
              <Badge variant="outline" className={entry.active ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200" : "border-slate-400/30 text-slate-300"}>
                {entry.active ? "Em atendimento" : entry.lastEventType === "break_start" ? "Em intervalo" : "Fora"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-white/[.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Entrada</p>
                <p className="mt-1 text-base font-bold text-slate-100">{formatTime(entry.clockInTime)}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[.03] p-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Última marcação</p>
                <p className="mt-1 text-sm font-semibold text-slate-200">{eventLabels[entry.lastEventType]} · {formatTime(entry.lastEventTime)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-300">
              <MapPin className="h-4 w-4 shrink-0 text-teal-300" />
              {entry.latitude != null && entry.longitude != null ? (
                <>
                  <span>{entry.latitude.toFixed(5)}, {entry.longitude.toFixed(5)}{entry.accuracy != null ? ` · precisão ±${Math.round(entry.accuracy)} m` : ""}</span>
                  <a className="font-semibold text-teal-200 underline-offset-4 hover:underline" href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`} target="_blank" rel="noreferrer">Abrir mapa</a>
                </>
              ) : <span>Localização não disponível para esta entrada</span>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CorrectionCard({ corrections = [], reviewNotes, setReviewNotes, approve, approveMany, reviewPending }: any) {
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const groups = new Map<string, any[]>();
  for (const item of corrections) {
    const req = item.request;
    const key = `${req.memberAccountId}:${dayKey(req.requestedTime)}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  const grouped = [...groups.values()];
  return (
    <Card className="border-amber-300/30 bg-amber-300/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="text-amber-300" /> Notificações de correção <Badge className="bg-amber-500 text-slate-950">{grouped.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!grouped.length && <p className="text-sm text-slate-300">Nenhum pedido de correção pendente.</p>}
        {grouped.map((items) => {
          const first = items[0];
          const { request, employee } = first;
          const ids = items.map((item: any) => item.request.id);
          const photo = items.find((item: any) => item.attachmentUrl);
          const day = new Date(request.requestedTime).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          return (
            <div key={ids.join("-")} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-100">{employee?.userName || `Promotor #${request.memberAccountId}`}</p>
                  <p className="mt-1 text-xs text-slate-400">{looksLikeFullDayExcuse(request) ? `${fullDayExcuseLabel(inferFullDayExcuseType(request))} · dia inteiro` : items.length > 1 ? `${items.length} horários` : "1 horário"} · {day}</p>
                </div>
                <Badge variant="outline" className="border-amber-300/40 text-amber-200">Pendente</Badge>
              </div>
              <div className="mt-3 space-y-1">
                {looksLikeFullDayExcuse(request) ? (
                  <p className="text-sm text-slate-200">Abono do dia — sem horários</p>
                ) : items
                  .slice()
                  .sort((a: any, b: any) => new Date(a.request.requestedTime).getTime() - new Date(b.request.requestedTime).getTime())
                  .map((item: any) => (
                    <p key={item.request.id} className="text-sm text-slate-200">
                      {eventLabels[item.request.requestedType] || "Batida"} · {new Date(item.request.requestedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {!item.request.timeEventId && <span className="ml-2 text-xs text-teal-300">inclusão</span>}
                    </p>
                  ))}
              </div>
              {request.justification && <p className="mt-3 text-sm text-slate-300">Justificativa: {request.justification}</p>}
              {photo?.attachmentUrl && (
                <a href={photo.attachmentUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block">
                  <img src={photo.attachmentUrl} alt="Comprovante anexado" className="h-24 w-24 rounded-lg border border-white/15 object-cover" />
                  <span className="mt-1 block text-xs text-amber-200">Abrir comprovante</span>
                </a>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Input
                  placeholder="Observação (opcional)"
                  value={reviewNotes[ids[0]] || ""}
                  onChange={(e) => setReviewNotes((prev: any) => ({ ...prev, [ids[0]]: e.target.value }))}
                  className="max-w-xs"
                />
                <Button type="button" size="sm" className="cursor-pointer bg-teal-400 text-slate-950 hover:bg-teal-300" onClick={() => {
                  if (ids.length > 1 && approveMany) void approveMany(ids, "approved");
                  else ids.forEach((id: number) => approve(id, "approved"));
                }} disabled={reviewPending}>{reviewPending ? "Aguarde..." : "Aprovar"}</Button>
                <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={() => {
                  if (ids.length > 1 && approveMany) void approveMany(ids, "rejected");
                  else ids.forEach((id: number) => approve(id, "rejected"));
                }} disabled={reviewPending}>{reviewPending ? "Aguarde..." : "Recusar"}</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function RoutesModule({ weekly, promoters, saveWeekly, editingRoute, setEditingRoute, updateRoute, deleteRoute, isCompanyAdmin, stores, storesLoading, storesFailed, storeName, setStoreName, storeCity, setStoreCity, storeAddress, setStoreAddress, createStore, routes, routesLoading, routesFailed }: any) {
  return (
    <div className="space-y-6">
      {isCompanyAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-white">Cadastrar loja</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>Nome</Label><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Nome da loja" /></div>
              <div><Label>Cidade</Label><Input value={storeCity} onChange={(e) => setStoreCity(e.target.value)} placeholder="Cidade" /></div>
            </div>
            <div><Label>Endereço</Label><Input value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} placeholder="Endereço completo" /></div>
            <Button onClick={() => createStore.mutate({ name: storeName, city: storeCity, address: storeAddress })} disabled={!storeName.trim() || createStore.isPending}>Cadastrar loja</Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader><CardTitle className="text-white">Lojas cadastradas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {storesLoading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
          {storesFailed && <p className="text-sm text-rose-200">Não foi possível carregar as lojas.</p>}
          {!storesLoading && !storesFailed && !stores.length && <p className="text-sm text-slate-300">Nenhuma loja cadastrada.</p>}
          {stores.map((store: any) => (
            <div key={store.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <p className="font-bold text-slate-100">{store.name}</p>
              <p className="text-sm text-slate-300">{store.city}{store.address ? ` · ${store.address}` : ""}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-white">Roteiros</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {routesLoading && <p className="text-sm text-slate-300">Carregando roteiros...</p>}
          {routesFailed && <p className="text-sm text-rose-200">Não foi possível carregar os roteiros.</p>}
          {!routesLoading && !routesFailed && !routes.length && <p className="text-sm text-slate-300">Nenhum roteiro encontrado.</p>}
          {routes.map((route: any) => (
            <div key={route.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-100">{route.name}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditingRoute(route)}>Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => navigator.share?.({ title: route.name, text: `Roteiro: ${route.name}` }).catch(() => toast.info("Compartilhamento não disponível"))}>Compartilhar</Button>
                  <Button size="sm" variant="outline" className="text-rose-300" onClick={async () => { if (await confirmAction({ title: "Excluir este roteiro?", description: "O promotor deixa de ver estas visitas na agenda.", confirmLabel: "Excluir roteiro" })) deleteRoute.mutate({ id: route.id }); }}>Excluir</Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function VisitsModule({ visits = [], metrics, loading, failed }: any) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-teal-950/30 p-5 sm:p-7">
        <h2 className="text-2xl font-black">Acompanhamento de visitas</h2>
        <p className="mt-2 text-sm text-slate-300">Veja o andamento das visitas planejadas para hoje.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Total" value={metrics.total} icon={ClipboardList} tone="text-teal-300" hint="Planejadas para hoje" />
        <Metric label="Concluídas" value={metrics.completed} icon={CheckCircle2} tone="text-emerald-300" hint="Finalizadas" />
        <Metric label="Em andamento" value={metrics.inProgress} icon={Clock3} tone="text-amber-300" hint="Em execução" />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-white">Visitas de hoje</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {loading && <p className="text-sm text-slate-300">Carregando visitas...</p>}
          {failed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar as visitas. Atualize o painel e tente novamente.</p>}
          {!loading && !failed && !visits.length && <p className="text-sm text-slate-300">Nenhuma visita encontrada.</p>}
          {visits.map(({ visit, store }: any) => (
            <div key={visit.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <div><p className="font-bold text-slate-100">{store.name}</p><p className="text-sm text-slate-300">{store.city} · Promotor #{visit.promoterId}</p></div>
              <Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
