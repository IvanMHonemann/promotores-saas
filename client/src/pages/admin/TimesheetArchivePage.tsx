import { useState } from "react";
import { Download, FileText, Loader2, Archive } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function TimesheetArchivePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState<number | "">("");
  const [memberId, setMemberId] = useState<number | "">("");

  const promoters = trpc.timesheetMirror.promoters.useQuery(undefined, { staleTime: 30000 });
  const list = trpc.timesheetArchive.list.useQuery({
    year: year || undefined,
    month: month === "" ? undefined : month,
    memberId: memberId === "" ? undefined : memberId,
  }, { staleTime: 10000 });
  const archiveNow = trpc.timesheetArchive.archiveNow.useMutation({
    onSuccess: (r) => { toast.success(`Arquivamento concluído (${r.results.length} itens)`); void list.refetch(); },
    onError: (e) => toast.error(e.message || "Falha ao arquivar"),
  });

  const download = async (id: number) => {
    try {
      const utils = trpc.useUtils();
      const res = await utils.timesheetArchive.downloadUrl.fetch({ id });
      if (res?.url) window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível baixar");
    }
  };

  return (
    <DashboardLayout title="Arquivos históricos" description="Espelhos de ponto dos meses fechados." help="Todo mês o sistema guarda uma cópia do espelho de ponto. Use aqui para consultar ou baixar meses anteriores.">
      <div className="space-y-6">
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Archive className="h-4 w-4 text-teal-300" />Consultar arquivos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs text-slate-400">Ano</label>
                <input type="number" min={2020} max={2100} value={year} onChange={(e) => setYear(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Mês</label>
                <select value={month} onChange={(e) => setMonth(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white">
                  <option value="">Todos</option>
                  {months.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Funcionário</label>
                <select value={memberId} onChange={(e) => setMemberId(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white">
                  <option value="">Todos</option>
                  {(promoters.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <Button variant="outline" className="w-full border-white/20 text-white" onClick={() => void list.refetch()} disabled={list.isFetching}>
                  {list.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Atualizar
                </Button>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <p className="mb-2 text-sm text-slate-300">Arquivar mês fechado manualmente (não arquiva o mês corrente):</p>
              <div className="flex flex-wrap gap-2">
                <input type="number" placeholder="Ano" className="w-24 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white" id="arch-year" defaultValue={year} />
                <select id="arch-month" className="rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-white" defaultValue={Math.max(1, now.getMonth())}>
                  {months.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
                </select>
                <Button size="sm" className="bg-teal-400 text-slate-950" disabled={archiveNow.isPending} onClick={() => {
                  const y = Number((document.getElementById("arch-year") as HTMLInputElement).value);
                  const m = Number((document.getElementById("arch-month") as HTMLSelectElement).value);
                  archiveNow.mutate({ year: y, month: m });
                }}>
                  {archiveNow.isPending ? "Arquivando..." : "Arquivar agora"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader><CardTitle className="text-base">Documentos arquivados</CardTitle></CardHeader>
          <CardContent>
            {list.isLoading && <p className="text-sm text-slate-400">Carregando...</p>}
            {!list.isLoading && !(list.data || []).length && <p className="text-sm text-slate-400">Nenhum arquivo histórico encontrado para os filtros.</p>}
            <div className="space-y-2">
              {(list.data || []).map((item: any) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{item.memberName || `Funcionário #${item.memberAccountId}`}</p>
                    <p className="text-sm text-slate-300">
                      {months[(item.month || 1) - 1]}/{item.year} · v{item.version}
                      {item.sizeBytes ? ` · ${(item.sizeBytes / 1024).toFixed(0)} KB` : ""}
                    </p>
                    <p className="text-xs text-slate-400">
                      {item.status === "ready" ? "Pronto" : item.status === "failed" ? "Falhou" : "Pendente"}
                      {item.generatedAt ? ` · ${new Date(item.generatedAt).toLocaleString("pt-BR")}` : ""}
                      {item.contentHash ? ` · hash ${String(item.contentHash).slice(0, 8)}…` : ""}
                    </p>
                    {item.notes && <p className="mt-1 text-xs text-amber-200">{item.notes}</p>}
                  </div>
                  {item.status === "ready" && item.fileKey && (
                    <Button size="sm" variant="outline" className="border-teal-300/40 text-teal-200" onClick={() => void download(item.id)}>
                      <Download className="mr-1 h-3.5 w-3.5" /> Baixar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-slate-500">
          <FileText className="mr-1 inline h-3.5 w-3.5" />
          Os arquivos são cópias históricas. As marcações originais permanecem no banco de dados e não são substituídas.
        </p>
      </div>
    </DashboardLayout>
  );
}
