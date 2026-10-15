import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, MapPin } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { getCurrentPosition } from "./geolocation";

const visitStatus: Record<string, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  completed: "Concluída",
};

export default function PromoterDashboard() {
  const { user } = useAuth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const todayParts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const today = `${todayParts.find((part) => part.type === "year")?.value}-${todayParts.find((part) => part.type === "month")?.value}-${todayParts.find((part) => part.type === "day")?.value}`;
  const access = trpc.entitlements.mine.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  const hasTimeTracking = Boolean(access.data?.effective.timeTracking);
  const hasFieldOperations = Boolean(access.data?.effective.fieldOperations);
  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone }, { enabled: hasTimeTracking });
  const visits = trpc.operations.visits.today.useQuery({ date: today }, { enabled: hasFieldOperations });
  const utils = trpc.useUtils();
  const rows = hasFieldOperations ? visits.data || [] : [];
  const hasAlerts = user?.features?.includes("alerts") ?? true;
  const alerts = trpc.extinguishers.alerts.useQuery({ daysAhead: 30 }, { enabled: hasAlerts, staleTime: 60000 });
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 20, date: today }, { enabled: hasTimeTracking });
  const stores = trpc.storePhotos.listStoresWithStats.useQuery(undefined, { enabled: hasFieldOperations, staleTime: 30000 });
  const photosToday = (stores.data || []).reduce((sum: number, s: any) => sum + (s.photoCount || 0), 0);
  const punchesToday = (history.data || []).length;
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
  const shiftStatus = !hasTimeTracking
    ? "Ponto não liberado para esta empresa"
    : shift.isLoading
    ? "Verificando jornada..."
    : shift.error
      ? "Não foi possível verificar a jornada"
      : active
        ? "Jornada ativa"
        : shift.data?.status === "closed"
          ? "Jornada encerrada"
          : "Entrada ainda não registrada";

  return (
    <DashboardLayout
      title="Painel inicial"
      description="Resumo da sua jornada e das visitas planejadas para hoje."
      onRefresh={() => window.location.reload()}
    >
      <div className="space-y-5">
        <section className="rounded-3xl border border-teal-300/20 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[.18em] text-teal-300">Visão geral</p>
          <h2 className="mt-2 text-2xl font-black sm:text-4xl">Olá, {firstName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Acompanhe sua jornada e o roteiro do dia por aqui. As marcações de entrada, intervalo e saída ficam na seção de ponto.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {hasTimeTracking && <a href="/ponto" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#07111f] transition hover:bg-teal-200">
              <Clock3 className="h-4 w-4" /> Bater ponto
            </a>}
            {hasFieldOperations && <a href="#roteiro" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
              <ClipboardList className="h-4 w-4" /> Meu roteiro
            </a>}
            {hasTimeTracking && <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${active ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : shift.data?.status === "closed" ? "border-slate-400/30 bg-slate-400/10 text-slate-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
              <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-300" : shift.data?.status === "closed" ? "bg-slate-300" : "bg-amber-300"}`} />
              {shiftStatus}
            </span>}
          </div>
        </section>

        {!hasTimeTracking && <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">O ponto eletrônico e o GPS estão disponíveis nos planos Profissional e Empresarial. Peça ao administrador da empresa para revisar o plano.</div>}
        {hasTimeTracking && !shift.isLoading && !active && !shift.error && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            {shift.data?.status === "closed"
              ? "Sua jornada foi encerrada. O painel continua disponível para consulta."
              : "Registre sua entrada com GPS em Bater ponto antes de iniciar as visitas."}
          </div>
        )}
        {hasTimeTracking && shift.error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">Não foi possível consultar o estado da jornada. Tente atualizar o painel.</div>}

        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 shadow-xl shadow-slate-950/20">
          <Metric label="Marcações" detail="Ponto de hoje" value={punchesToday} icon={Clock3} tone="text-teal-300" />
          <Metric label="Fotos" detail="Registradas" value={photosToday} icon={ClipboardList} tone="text-sky-300" />
          <Metric label="A vencer" detail="Próx. 30 dias" value={expiringCount} icon={AlertTriangle} tone="text-amber-300" />
        </div>

        {hasAlerts && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" /> Alertas de validade
            </h3>
            {alerts.isLoading && <p className="mt-2 text-sm text-slate-400">Carregando...</p>}
            {alerts.isError && <p className="mt-2 text-sm text-rose-200">Não foi possível carregar os alertas.</p>}
            {!alerts.isLoading && !alerts.isError && (alerts.data || []).length === 0 && (
              <p className="mt-2 text-sm text-slate-400">Nenhum produto perto do vencimento.</p>
            )}
            <div className="mt-3 space-y-2">
              {(alerts.data || []).slice(0, 5).map((item: any) => (
                <div key={item.extinguisher?.id || item.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{item.extinguisher?.typeModel || item.typeModel || "Produto"}</p>
                    <p className="text-xs text-slate-400">{item.client?.name || ""}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-200">
                    {item.extinguisher?.expirationDate ? new Date(item.extinguisher.expirationDate).toLocaleDateString("pt-BR") : ""}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

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
                    <Button className="mt-3 w-full" onClick={() => void actOnVisit(visit.id, "start")} disabled={!canManageVisits}>
                      {startVisit.isPending ? "Iniciando..." : "Iniciar visita com GPS"}
                    </Button>
                  )}
                  {visit.status === "in_progress" && (
                    <Button className="mt-3 w-full" onClick={() => void actOnVisit(visit.id, "complete")} disabled={!canManageVisits}>
                      {completeVisit.isPending ? "Concluindo..." : "Concluir visita"}
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>}
      </div>
    </DashboardLayout>
  );
}

function Metric({
  label,
  detail,
  value,
  icon: Icon,
  tone,
  className = "",
}: {
  label: string;
  detail: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  className?: string;
}) {
  return (
    <div className={`min-h-[142px] bg-[#0b1021] p-4 sm:min-h-[160px] sm:p-6 ${className}`}>
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
    </div>
  );
}
