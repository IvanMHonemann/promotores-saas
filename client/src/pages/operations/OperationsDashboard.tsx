import { useEffect, useMemo, useState } from "react";
import { Bell, Check, CheckCircle2, Clock3, ClipboardList, MapPin, Users, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";

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
  const hasFieldOperations = Boolean(access.data?.effective.fieldOperations);
  const hasTimeTracking = Boolean(access.data?.effective.timeTracking);
  const stores = trpc.operations.stores.list.useQuery(undefined, { enabled: hasFieldOperations });
  const routes = trpc.operations.routes.list.useQuery({ date: today }, { enabled: hasFieldOperations });
  const visits = trpc.operations.visits.list.useQuery({ date: today }, { enabled: hasFieldOperations });
  const presence = trpc.timeTracking.companyToday.useQuery({ timeZone }, { enabled: isCompanyAdmin && hasTimeTracking });
  const corrections = trpc.timeTracking.correctionRequests.pending.useQuery(undefined, { enabled: isCompanyAdmin && hasTimeTracking });
  const utils = trpc.useUtils();
  const [storeName, setStoreName] = useState("");
  const [storeCity, setStoreCity] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  const review = trpc.timeTracking.correctionRequests.review.useMutation({
    onSuccess: (_, variables) => {
      toast.success(variables.status === "approved" ? "Correção aprovada e aplicada ao ponto." : "Pedido de correção recusado.");
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
    return {
      total: rows.length,
      completed: rows.filter((row) => row.visit.status === "completed").length,
      inProgress: rows.filter((row) => row.visit.status === "in_progress").length,
    };
  }, [visits.data]);

  useEffect(() => {
    const onHash = () => setSection(sectionFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const approve = (id: number, status: "approved" | "rejected") => review.mutate({ id, status, reviewNotes: reviewNotes[id]?.trim() || undefined });
  const visibleSection = hasFieldOperations ? section : "overview";
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
          isPromoter={user?.role === "promoter"}
          todayVisits={visits.data || []}
          metrics={metrics}
          visitsFailed={visits.isError}
          hasFieldOperations={hasFieldOperations}
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
          reviewPending={review.isPending}
        />
      )}
      {visibleSection === "routes" && (
        <RoutesModule
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

function Overview({ isPromoter, todayVisits = [], metrics, visitsFailed, hasFieldOperations, hasTimeTracking, presence = [], presenceLoading, presenceFailed, timeZone, corrections, isCompanyAdmin, reviewNotes, setReviewNotes, approve, reviewPending }: any) {
  const activePromoters = presence.filter((entry: CompanyPresenceEntry) => entry.active).length;
  return (
    <div className="space-y-6">
      {isPromoter && hasFieldOperations && <Card id="roteiro" className="border-teal-300/30 bg-teal-300/5"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><ClipboardList className="text-teal-300" />Meu roteiro de hoje</CardTitle></CardHeader><CardContent className="space-y-2">{visitsFailed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar o roteiro de hoje.</p>}{!visitsFailed && !todayVisits.length && <p className="text-sm text-slate-300">Você não tem visitas programadas para hoje.</p>}{todayVisits.map(({ visit, store }: any, index: number) => <div key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-3"><div><p className="text-xs font-semibold text-teal-300">Parada {index + 1}</p><p className="font-bold text-white">{store.name}</p><p className="text-sm text-slate-300">{store.city}{store.address ? ` · ${store.address}` : ""}</p></div><Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge></div>)}</CardContent></Card>}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-300">Visão geral</p>
        <h2 className="mt-2 text-2xl font-black sm:text-4xl">Operação de campo</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Acompanhe a jornada da equipe, organize roteiros e veja a execução das visitas em um só lugar.</p>
      </div>

      {hasFieldOperations && <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-xl shadow-slate-950/20">
        {isCompanyAdmin && hasTimeTracking && <Metric label="Promotores em jornada" value={activePromoters} icon={Users} tone="text-emerald-300" hint="Entrada registrada hoje" />}
        <Metric label="Visitas planejadas" value={metrics.total} icon={ClipboardList} tone="text-teal-300" hint="Roteiro de hoje" />
        <Metric label="Concluídas" value={metrics.completed} icon={CheckCircle2} tone="text-emerald-300" hint="Finalizadas hoje" />
        <Metric className={isCompanyAdmin && hasTimeTracking ? "" : "col-span-2"} label="Em andamento" value={metrics.inProgress} icon={Clock3} tone="text-amber-300" hint="Em execução" />
      </div>}
      {!hasFieldOperations && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">Roteiros, lojas e visitas não estão liberados para esta empresa. O módulo de operação de campo está disponível nos planos Profissional e Empresarial.</div>}
      {hasFieldOperations && visitsFailed && <p role="alert" className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">Não foi possível carregar os indicadores de visitas. Atualize o painel e tente novamente.</p>}

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
        <a href="#visitas" className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 transition hover:border-teal-300/30">
          <p className="font-bold text-white">Visitas</p>
          <p className="mt-1 text-sm text-slate-300">Acompanhar status das visitas planejadas.</p>
        </a>
      </div>}

      {isCompanyAdmin && hasTimeTracking && <CorrectionCard corrections={corrections} reviewNotes={reviewNotes} setReviewNotes={setReviewNotes} approve={approve} reviewPending={reviewPending} />}
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, hint, className = "" }: { label: string; value: number; icon: LucideIcon; tone: string; hint: string; className?: string }) {
  return (
    <div className={`min-h-[142px] bg-[#0b1021] p-4 sm:min-h-[160px] sm:p-6 ${className}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col self-stretch">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-300 sm:text-xs sm:tracking-[.14em]">{label}</p>
          <p className={`mt-2 text-4xl font-black leading-none ${tone}`}>{value}</p>
          <p className="mt-auto pt-2 text-xs text-slate-400 sm:text-sm">{hint} <span aria-hidden="true">→</span></p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[.04] sm:h-10 sm:w-10">
          <Icon className={`h-4 w-4 ${tone} sm:h-5 sm:w-5`} />
        </span>
      </div>
    </div>
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
                {entry.active ? "Em jornada" : "Jornada encerrada"}
              </Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/5 bg-white/[.03] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Entrada</p>
                <p className="mt-1 text-base font-bold text-slate-100">{formatTime(entry.clockInTime)}</p>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[.03] p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Última marcação</p>
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

function CorrectionCard({ corrections = [], reviewNotes, setReviewNotes, approve, reviewPending }: any) {
  return (
    <Card className="border-amber-300/30 bg-amber-300/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bell className="text-amber-300" /> Notificações de correção <Badge className="bg-amber-500 text-slate-950">{corrections.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!corrections.length && <p className="text-sm text-slate-300">Nenhum pedido de correção pendente.</p>}
        {corrections.map(({ request, event, employee }: any) => (
          <div key={request.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <p className="font-bold text-white">{employee.userName} · {eventLabels[request.requestedType]}</p>
            <p className="mt-1 text-sm text-slate-300">{request.justification}</p>
            <textarea value={reviewNotes[request.id] || ""} onChange={(event) => setReviewNotes((old: any) => ({ ...old, [request.id]: event.target.value }))} placeholder="Observação (opcional)" className="mt-3 min-h-16 w-full rounded-lg border border-white/15 bg-slate-950/60 p-2 text-sm text-white" />
            <div className="mt-2 flex gap-2">
              <Button onClick={() => approve(request.id, "approved")} disabled={reviewPending} className="bg-emerald-500 text-slate-950"><Check className="mr-1 h-4 w-4" />Aprovar</Button>
              <Button onClick={() => approve(request.id, "rejected")} disabled={reviewPending} variant="outline" className="border-red-300/50 text-red-200"><X className="mr-1 h-4 w-4" />Recusar</Button>
            </div>
            {event?.latitude != null && <p className="mt-2 flex items-center gap-1 text-xs text-slate-300"><MapPin className="h-3.5 w-3.5" />GPS registrado</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RoutesModule(props: any) {
  const {
    isCompanyAdmin, stores = [], storesLoading, storesFailed, storeName, setStoreName, storeCity, setStoreCity,
    storeAddress, setStoreAddress, createStore, routes = [], routesLoading, routesFailed,
  } = props;
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-teal-950/30 p-5 sm:p-7">
        <h2 className="text-2xl font-black">Lojas e roteiros de hoje</h2>
        <p className="mt-2 text-sm text-slate-300">Cadastre pontos de venda e consulte as rotas distribuídas. A programação semanal é definida no cadastro de cada promotor.</p>
      </div>
      {isCompanyAdmin && <>
        <Card>
          <CardHeader><CardTitle className="text-white">Cadastrar loja</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div><Label>Nome</Label><Input value={storeName} onChange={(event) => setStoreName(event.target.value)} placeholder="Mercado Central" className="mt-1" /></div>
            <div><Label>Cidade</Label><Input value={storeCity} onChange={(event) => setStoreCity(event.target.value)} placeholder="Cidade" className="mt-1" /></div>
            <div><Label>Endereço</Label><Input value={storeAddress} onChange={(event) => setStoreAddress(event.target.value)} placeholder="Rua e número" className="mt-1" /></div>
            <Button disabled={createStore.isPending || !storeName.trim() || !storeCity.trim()} onClick={() => createStore.mutate({ name: storeName.trim(), city: storeCity.trim(), address: storeAddress.trim() || undefined })} className="bg-teal-300 text-slate-950 hover:bg-teal-200 sm:col-span-3 sm:justify-self-end">
              {createStore.isPending ? "Salvando..." : "Cadastrar loja"}
            </Button>
            {createStore.error && <p role="alert" className="text-sm font-semibold text-rose-200 sm:col-span-3">Não foi possível cadastrar a loja. Confira a conexão e tente novamente.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-white">Lojas cadastradas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {storesLoading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
            {storesFailed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar as lojas.</p>}
            {!storesLoading && !storesFailed && !stores.length && <p className="text-sm text-slate-300">Nenhuma loja cadastrada.</p>}
            {stores.map((store: any) => <div key={store.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3"><p className="font-semibold text-white">{store.name}</p><p className="text-sm text-slate-300">{store.address ? `${store.address} · ` : ""}{store.city}{store.state ? ` — ${store.state}` : ""}</p></div>)}
          </CardContent>
        </Card>
      </>}
      {!isCompanyAdmin && <p className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-slate-300">A programação semanal é configurada no cadastro de cada promotor. Aqui você pode consultar as rotas distribuídas.</p>}
      <Card>
        <CardHeader><CardTitle className="text-white">Roteiros de hoje</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {routesLoading && <p className="text-sm text-slate-300">Carregando roteiros...</p>}
          {routesFailed && <p role="alert" className="text-sm text-rose-200">Não foi possível carregar os roteiros. Atualize o painel e tente novamente.</p>}
          {!routesLoading && !routesFailed && !routes.length && <p className="text-sm text-slate-300">Nenhum roteiro para hoje.</p>}
          {routes.map((route: any) => <div key={route.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 p-4"><div><p className="font-bold text-slate-100">{route.name}</p><p className="text-sm text-slate-300">Promotor #{route.promoterId}</p></div><Badge variant="outline">{route.status}</Badge></div>)}
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
