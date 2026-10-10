import { CheckCircle2, ClipboardList, Clock3, MapPin } from "lucide-react";
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
  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone });
  const visits = trpc.operations.visits.today.useQuery();
  const utils = trpc.useUtils();
  const rows = visits.data || [];
  const active = shift.data?.active === true;

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
  const canManageVisits = active && !shift.isLoading && !shift.error && !startVisit.isPending && !completeVisit.isPending;
  const shiftStatus = shift.isLoading
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
            <a href="/ponto" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-bold text-[#07111f] transition hover:bg-teal-200">
              <Clock3 className="h-4 w-4" /> Bater ponto
            </a>
            <a href="#roteiro" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.04] px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-white/10">
              <ClipboardList className="h-4 w-4" /> Meu roteiro
            </a>
            <span className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold ${active ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : shift.data?.status === "closed" ? "border-slate-400/30 bg-slate-400/10 text-slate-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
              <span className={`h-2 w-2 rounded-full ${active ? "bg-emerald-300" : shift.data?.status === "closed" ? "bg-slate-300" : "bg-amber-300"}`} />
              {shiftStatus}
            </span>
          </div>
        </section>

        {!shift.isLoading && !active && !shift.error && (
          <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
            {shift.data?.status === "closed"
              ? "Sua jornada foi encerrada. O painel continua disponível para consulta."
              : "Registre sua entrada com GPS em Bater ponto antes de iniciar as visitas."}
          </div>
        )}
        {shift.error && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">Não foi possível consultar o estado da jornada. Tente atualizar o painel.</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Visitas previstas" detail="No roteiro de hoje" value={rows.length} icon={ClipboardList} tone="text-teal-300" />
          <Metric label="Em andamento" detail="Visitas iniciadas" value={inProgress} icon={Clock3} tone="text-amber-300" />
          <Metric label="Concluídas" detail="Finalizadas hoje" value={completed} icon={CheckCircle2} tone="text-emerald-300" />
        </div>

        <section id="roteiro" className="scroll-mt-6">
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
        </section>
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
}: {
  label: string;
  detail: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-gradient-to-br from-slate-900 to-slate-950">
      <CardContent className="flex min-h-[126px] items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.14em] text-slate-300">{label}</p>
          <p className={`mt-2 text-4xl font-black leading-none ${tone}`}>{value}</p>
          <p className="mt-2 text-xs text-slate-400">{detail}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04]">
          <Icon className={`h-5 w-5 ${tone}`} />
        </span>
      </CardContent>
    </Card>
  );
}
