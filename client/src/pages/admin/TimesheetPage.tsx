import { useState } from "react";
import { Calendar, Clock, Users } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";

export default function TimesheetPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const promoters = trpc.operations.promoters.list.useQuery(undefined, { staleTime: 30000 });
  const corrections = trpc.timeTracking.correctionRequests.pending.useQuery(undefined, { staleTime: 15000 });
  const selected = promoters.data?.find((p: any) => p.id === selectedId);

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

        <Card className="border-amber-300/25 bg-amber-300/5 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-amber-300" />Solicitações de correção</CardTitle></CardHeader>
          <CardContent>
            {(corrections.data || []).length === 0 && <p className="text-sm text-slate-400">Nenhuma solicitação pendente.</p>}
            {(corrections.data || []).map((item: any) => (
              <div key={item.request.id} className="mb-2 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
                <p className="font-semibold text-white">{item.employee?.userName || "Promotor"}</p>
                <p className="text-slate-300">{item.request.justification}</p>
                <p className="text-xs text-slate-400">Solicitado: {new Date(item.request.createdAt).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
