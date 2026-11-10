import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileCheck2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { downloadBase64, fmtDateTimeSP } from "@/lib/downloadBase64";

const LABEL: Record<string, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo", clock_out: "Saída" };
const ORIGIN: Record<string, string> = { original: "Marcação original", adjustment: "Ajuste aprovado", inclusion: "Inclusão aprovada" };

/** Comprovantes de batida do próprio funcionário. */
export default function MyReceiptsPage() {
  const [days, setDays] = useState(30);
  const list = trpc.pontoLegal.myReceipts.useQuery({ days });
  const pdf = trpc.pontoLegal.receiptPdf.useMutation();
  const email = trpc.pontoLegal.emailReceipt.useMutation();

  const baixar = async (id: number) => {
    try {
      const r = await pdf.mutateAsync({ eventId: id });
      downloadBase64(r.base64, r.fileName, "application/pdf");
    } catch (e: any) { toast.error(e?.message || "Não foi possível gerar o PDF."); }
  };
  const enviar = async (id: number) => {
    try {
      const r = await email.mutateAsync({ eventId: id });
      r.sent ? toast.success(r.message) : toast.warning(r.message);
    } catch (e: any) { toast.error(e?.message || "Não foi possível enviar."); }
  };

  return (
    <DashboardLayout title="Meus comprovantes de ponto" description="Cada batida gera um comprovante com número em sequência e um código de segurança.">
      <div className="space-y-4">
        <Card className="border-teal-300/30 bg-teal-950/40 text-white">
          <CardContent className="flex gap-3 p-4 text-sm text-teal-50">
            <ShieldCheck className="h-5 w-5 shrink-0 text-teal-300" />
            <p>
              O comprovante prova que você registrou o ponto naquele horário. Ele traz o <b>número da batida</b>{" "}
              e um <b>código de segurança</b>: se alguém mudasse o registro depois, o código deixaria de conferir. Guarde os que achar importantes —
              o PDF pode ser baixado a qualquer momento nesta tela.
            </p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-4 w-4 text-teal-300" />Suas marcações</CardTitle>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1 text-sm" aria-label="Período">
              <option value={2}>Últimas 48 horas</option>
              <option value={7}>Últimos 7 dias</option>
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {list.isLoading && <p className="text-slate-400">Carregando...</p>}
            {(list.data || []).map((r: any) => (
              <div key={r.id} className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 ${r.superseded ? "border-amber-300/30 bg-amber-400/5" : "border-white/10"}`}>
                <div className="min-w-0">
                  <p className="font-semibold">{LABEL[r.eventType] || r.eventType} · {fmtDateTimeSP(r.markedAt)}</p>
                  <p className="text-xs text-slate-400">
                    {r.nsr ? `Nº ${String(r.nsr).padStart(9, "0")}` : ORIGIN[r.origin] || ""}
                    {r.offline ? " · feita offline" : ""}
                    {r.superseded ? " · substituída por ajuste aprovado (a original continua guardada)" : ""}
                  </p>
                  {r.recordHash && <p className="truncate font-mono text-[10px] text-slate-500">cód. {r.recordHash.slice(0, 16)}…</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" disabled={pdf.isPending} onClick={() => void baixar(r.id)}><Download className="mr-1 h-4 w-4" />PDF</Button>
                  <Button size="sm" variant="outline" disabled={email.isPending} onClick={() => void enviar(r.id)}><Mail className="mr-1 h-4 w-4" />E-mail</Button>
                </div>
              </div>
            ))}
            {list.data && !list.data.length && <p className="text-slate-400">Nenhuma marcação no período.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
