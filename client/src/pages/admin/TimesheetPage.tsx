import { useMemo, useState } from "react";
import { Calendar, Check, Clock, Users, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const labels: Record<string, string> = { clock_in: "Entrada", break_start: "Intervalo", break_end: "Retorno", clock_out: "Saída" };

export default function TimesheetPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const utils = trpc.useUtils();
  const promoters = trpc.operations.promoters.list.useQuery(undefined, { staleTime: 30000 });
  const corrections = trpc.timeTracking.correctionRequests.pending.useQuery(undefined, { staleTime: 15000 });
  const history = trpc.timeTracking.companyHistory.useQuery({ memberId: selectedId!, month }, { enabled: Boolean(selectedId), staleTime: 10000 });
  const review = trpc.timeTracking.correctionRequests.review.useMutation({
    onSuccess: () => { toast.success("Solicitação analisada."); void corrections.refetch(); },
    onError: (e) => toast.error(e.message || "Não foi possível analisar."),
  });
  const selected = promoters.data?.find((p: any) => p.id === selectedId);

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of history.data || []) {
      const day = new Date(ev.deviceTime || ev.serverTime).toISOString().slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ev);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [history.data]);

  return (
    <DashboardLayout title="Cartão-ponto" description="Consulte a jornada dos promotores e as solicitações de correção.">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-teal-300" />Promotores</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(promoters.data || []).map((p: any) => (
                <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${selectedId === p.id ? "bg-teal-400 text-slate-950" : "bg-slate-950/40 text-slate-200 hover:bg-slate-950/60"}`}>
                  {p.userName}
                </button>
              ))}
              {!promoters.data?.length && <p className="text-sm text-slate-400">Nenhum promotor cadastrado.</p>}
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calendar className="h-4 w-4 text-teal-300" />Mês</CardTitle></CardHeader>
            <CardContent>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white [color-scheme:dark]" />
              {selected && <p className="mt-3 text-sm text-slate-300">Selecionado: <span className="font-semibold text-white">{selected.userName}</span></p>}
            </CardContent>
          </Card>
        </div>

        {selectedId && (
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader><CardTitle className="text-base">Marcações de {month}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
              {!history.isLoading && byDay.length === 0 && <p className="text-sm text-slate-400">Nenhuma marcação neste mês.</p>}
              {byDay.map(([day, events]) => (
                <div key={day} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-teal-300">{new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                  <div className="space-y-1">
                    {events.map((ev: any) => (
                      <div key={ev.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-200">{labels[ev.eventType] || ev.eventType}</span>
                        <span className="text-slate-400">
                          {new Date(ev.deviceTime || ev.serverTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {ev.notes?.includes("automática") && <span className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-200">Auto</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-amber-300/25 bg-amber-300/5 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-amber-300" />Solicitações de correção</CardTitle></CardHeader>
          <CardContent>
            {(corrections.data || []).length === 0 && <p className="text-sm text-slate-400">Nenhuma solicitação pendente.</p>}
            {(corrections.data || []).map((item: any) => (
              <div key={item.request.id} className="mb-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
                <p className="font-semibold text-white">{item.employee?.userName || "Promotor"}</p>
                <p className="text-slate-300">{item.request.justification}</p>
                <p className="text-xs text-slate-400">Solicitado: {new Date(item.request.createdAt).toLocaleString("pt-BR")}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-400" disabled={review.isPending} onClick={() => review.mutate({ id: item.request.id, status: "approved" })}>
                    <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" className="border-rose-300/40 text-rose-200" disabled={review.isPending} onClick={() => review.mutate({ id: item.request.id, status: "rejected" })}>
                    <X className="mr-1 h-3.5 w-3.5" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
