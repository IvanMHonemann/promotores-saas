import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, Clock3, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet, isOnline } from "@/lib/offlineCache";
import { useOfflineQuery } from "@/lib/useOfflineQuery";
import { VisitCheckIn } from "@/components/VisitCheckIn";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { getCurrentPosition } from "./geolocation";
import { PunchPanel, localDayKey } from "@/components/PunchPanel";

const visitStatus: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export default function PromoterDashboard() {
  const [checkIn, setCheckIn] = useState<{ action: "start" | "complete"; visitId: number; storeId: number; storeName: string } | null>(null);
  const { user } = useAuth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const todayParts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = `${todayParts.find((part) => part.type === "year")?.value}-${todayParts.find((part) => part.type === "month")?.value}-${todayParts.find((part) => part.type === "day")?.value}`;
  const accessQuery = trpc.entitlements.mine.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  const cachedAccess = cacheGet<any>("entitlements");
  if (accessQuery.data) cacheSet("entitlements", accessQuery.data);
  const access = { ...accessQuery, data: accessQuery.data ?? (!isOnline() ? cachedAccess : undefined) };
  const hasTimeTracking = Boolean(access.data?.effective.timeTracking);
  const hasFieldOperations = Boolean(access.data?.effective.fieldOperations);
  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone }, { enabled: hasTimeTracking });
  const visitsQuery = trpc.operations.visits.today.useQuery({ date: today }, { enabled: hasFieldOperations, staleTime: 0, refetchOnWindowFocus: true });
  useEffect(() => {
    if (visitsQuery.data) cacheSet(`visits-today-${today}`, visitsQuery.data);
  }, [visitsQuery.data, today]);
  const cachedVisits = cacheGet<any[]>(`visits-today-${today}`);
  const visits = {
    ...visitsQuery,
    data: visitsQuery.data ?? (!isOnline() ? cachedVisits : undefined),
    isLoading: visitsQuery.isLoading && isOnline() && !cachedVisits,
    error: visitsQuery.error && !cachedVisits ? visitsQuery.error : null,
  };
  const utils = trpc.useUtils();
  const rows = hasFieldOperations ? visits.data || [] : [];
  const alertsQuery = trpc.inventoryAlerts.useQuery({ daysAhead: 30 }, { staleTime: 60000 });
  const alerts = useOfflineQuery(alertsQuery, "alerts");
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 30 }, { enabled: hasTimeTracking });
  const storesQuery = trpc.storePhotos.listStoresWithStats.useQuery(undefined, { enabled: hasFieldOperations, staleTime: 30000 });
  if (storesQuery.data) cacheSet("stores", storesQuery.data);
  const stores = useOfflineQuery(storesQuery, "stores");
  const photosToday = (stores.data || []).reduce((sum: number, s: any) => sum + (s.photoCount || 0), 0);
  const storeCount = (stores.data || []).length;
  const punchesToday = (history.data || []).filter((e: any) => localDayKey(new Date(e.deviceTime || e.serverTime), timeZone) === today).length;
  const expiringCount = (alerts.data || []).length;
  const active = hasTimeTracking && shift.data?.active === true;

  const startVisit = trpc.operations.visits.start.useMutation({
    onSuccess: () => {
      toast.success("Visita iniciada");
      void utils.operations.visits.today.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível iniciar a visita"),
  });
  const completeVisit = trpc.operations.visits.complete.useMutation({
    onSuccess: () => {
      toast.success("Visita concluída");
      void utils.operations.visits.today.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível concluir a visita"),
  });

  const actOnVisit = async (id: number, action: "start" | "complete") => {
    try {
      const position = await getCurrentPosition();
      if (action === "start") await startVisit.mutateAsync({ id, ...position });
      else await completeVisit.mutateAsync({ id, ...position });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Autorize o GPS para continuar.");
    }
  };

  const firstName = user?.name?.trim().split(/\s+/)[0] || "promotor";
  const completed = rows.filter(({ visit }) => visit.status === "completed").length;
  const inProgress = rows.filter(({ visit }) => visit.status === "in_progress").length;
  const canManageVisits = hasFieldOperations && active && !shift.isLoading && !shift.error && !startVisit.isPending && !completeVisit.isPending;
  return (
    <DashboardLayout
      title="Painel inicial"
      description="Ponto, roteiro e alertas do dia."
      onRefresh={() => window.location.reload()}
    >
      <div className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white sm:text-3xl">Olá, {firstName}</h2>
            <p className="mt-1 text-sm text-slate-200">Bata o ponto aqui e siga para o seu roteiro de hoje.</p>
          </div>
          {hasFieldOperations && <a href="#roteiro" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15">
            <ClipboardList className="h-4 w-4 text-teal-300" /> Meu roteiro
          </a>}
        </header>

        {hasTimeTracking && <PunchPanel />}

        {!hasTimeTracking && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">O ponto eletrônico e o GPS estão disponíveis nos planos Profissional e Empresarial. Peça ao administrador da empresa para revisar o plano.</div>}
        {hasFieldOperations && hasTimeTracking && !shift.isLoading && !active && !shift.error && (
          <div className="rounded-2xl border border-amber-300/40 bg-amber-300/15 p-4 text-sm font-medium text-amber-50">
            {shift.data?.status === "closed"
              ? "Sua jornada foi encerrada. O roteiro continua disponível para consulta."
              : "Bata a entrada no ponto, acima, para iniciar as visitas."}
          </div>
        )}

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-xl shadow-slate-950/20 sm:grid-cols-4">
          <Metric label="Lojas" detail="Cadastradas" value={storeCount} icon={MapPin} tone="text-teal-300" href="/lojas" />
          <Metric label="Marcações" detail="Ponto de hoje" value={punchesToday} icon={Clock3} tone="text-sky-300" href="/ponto" />
          <Metric label="Fotos" detail="Registradas" value={photosToday} icon={ClipboardList} tone="text-emerald-300" href="/lojas" />
          <Metric label="A vencer" detail="Próx. 30 dias" value={expiringCount} icon={AlertTriangle} tone="text-amber-300" href="/produtos" />
        </div>

        <section className="rounded-2xl border-2 border-amber-400/40 bg-amber-400/10 p-4">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-100">
            <AlertTriangle className="h-5 w-5 text-amber-300" /> Alertas de validade
            {expiringCount > 0 && <span className="ml-auto rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-950">{expiringCount}</span>}
          </h3>
          {alerts.isLoading && <p className="mt-3 text-sm text-amber-100/70">Carregando produtos...</p>}
          {alerts.isError && <p className="mt-3 text-sm text-rose-200">Não foi possível carregar. Verifique se o módulo de alertas está ativo.</p>}
          {!alerts.isLoading && !alerts.isError && expiringCount === 0 && (
            <p className="mt-3 text-sm text-amber-100/70">Nenhum produto perto do vencimento nos próximos 30 dias.</p>
          )}
          <div className="mt-3 space-y-2">
            {(alerts.data || []).slice(0, 5).map((item: any) => {
              const exp = item.expirationDate ? new Date(item.expirationDate) : null;
              const days = exp ? Math.ceil((exp.getTime() - Date.now()) / 86400000) : null;
              return (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-amber-300/20 bg-slate-950/60 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-white">{item.description || item.productCode || "Produto"}</p>
                    <p className="text-xs text-slate-400">{item.productCode || ""}</p>
                  </div>
                  <span className="rounded-lg bg-amber-400/20 px-2 py-1 text-xs font-bold text-amber-200">
                    {days == null ? "—" : days < 0 ? "Vencido" : `${days}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {!hasFieldOperations && <div className="rounded-2xl border border-slate-400/25 bg-slate-400/10 p-4 text-sm text-slate-200">Roteiros e visitas estão disponíveis nos planos Profissional e Empresarial.</div>}
        {hasFieldOperations && <section id="roteiro" className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ClipboardList className="h-5 w-5 text-teal-300" /> Meu roteiro de hoje
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visits.isLoading && <p className="text-sm text-slate-300">Carregando visitas...</p>}
              {visits.error && <p className="text-sm font-semibold text-rose-200">Não foi possível carregar o roteiro. Tente atualizar o painel.</p>}
              {!visits.isLoading && !visits.error && !rows.length && <p className="text-sm text-slate-300">Nenhuma visita planejada para hoje.</p>}
              {!isOnline() && rows.length > 0 && <p className="text-xs text-amber-200">Roteiro salvo neste aparelho (offline).</p>}
              {rows.map(({ visit, store }) => (
                <div key={visit.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-100">{store.name}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-300">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                        {store.address || store.city}{store.state ? ` — ${store.state}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-white/20 text-slate-200">{visitStatus[visit.status] || visit.status}</Badge>
                  </div>
                  {visit.status === "pending" && (
                    <Button className="mt-3 w-full" onClick={() => setCheckIn({ action: "start", visitId: visit.id, storeId: store.id, storeName: store.name })} disabled={!canManageVisits}>
                      Check-in (foto da fachada)
                    </Button>
                  )}
                  {visit.status === "in_progress" && (
                    <>
                      <VisitTimer startTime={visit.actualStart} />
                      <Button className="mt-3 w-full" onClick={() => setCheckIn({ action: "complete", visitId: visit.id, storeId: store.id, storeName: store.name })} disabled={!canManageVisits}>
                        Check-out (foto da fachada)
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>}
      </div>
      {checkIn && (
        <VisitCheckIn
          {...checkIn}
          onDone={() => { setCheckIn(null); void visits.refetch(); }}
          onCancel={() => setCheckIn(null)}
        />
      )}
    </DashboardLayout>
  );
}

function Metric({
  label,
  detail,
  value,
  icon: Icon,
  tone,
  href,
  className = "",
}: {
  label: string;
  detail: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  href?: string;
  className?: string;
}) {
  const Tag = href ? "a" : "div";
  return (
    <Tag href={href} className={`block min-h-[142px] bg-[#0b1021] p-4 transition hover:bg-white/5 sm:min-h-[160px] sm:p-6 ${className}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col self-stretch">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-slate-300 sm:text-xs sm:tracking-[.14em]">{label}</p>
          <p className={`mt-2 text-4xl font-black leading-none ${tone}`}>{value}</p>
          <p className="mt-auto pt-2 text-xs text-slate-400 sm:text-sm">{detail} <span aria-hidden="true">→</span></p>
        </div>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[.04] sm:h-10 sm:w-10">
          <Icon className={`h-4 w-4 ${tone} sm:h-5 sm:w-5`} />
        </span>
      </div>
    </Tag>
  );
}

function VisitTimer({ startTime }: { startTime: string | Date | null }) {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startTime) return;
    const start = new Date(startTime).getTime();
    const tick = () => {
      const diff = Date.now() - start;
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startTime]);
  if (!startTime) return null;
  return (
    <p className="mt-2 text-sm font-semibold text-amber-300">
      Tempo na loja: {elapsed}
    </p>
  );
}
