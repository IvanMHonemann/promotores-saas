import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, FileSignature } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { currentMonthSP, fmtDateTimeSP, fmtMinutes } from "@/lib/downloadBase64";

const brDate = (iso: string) => iso.split("-").reverse().join("/");
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Espelho do mês para o funcionário conferir e confirmar (ou contestar) eletronicamente. */
export default function MyMirrorPage() {
  const [month, setMonth] = useState(currentMonthSP(-1));
  const [comment, setComment] = useState("");
  const [read, setRead] = useState(false);
  const utils = trpc.useUtils();
  const q = trpc.pontoLegal.myMirror.useQuery({ month });
  const accept = trpc.pontoLegal.acceptMirror.useMutation();
  const data = q.data;

  const decide = async (decision: "accepted" | "contested") => {
    if (!data) return;
    try {
      await accept.mutateAsync({ month, documentHash: data.documentHash, decision, comment: comment.trim() || undefined });
      toast.success(decision === "accepted" ? "Espelho confirmado. Obrigado!" : "Contestação registrada. O gestor será avisado pelo painel.");
      setComment("");
      await utils.pontoLegal.myMirror.invalidate();
    } catch (e: any) { toast.error(e?.message || "Não foi possível registrar."); }
  };

  const acc = data?.acceptance;
  return (
    <DashboardLayout title="Meu espelho de ponto" description="Confira suas marcações do mês e confirme que estão corretas.">
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-white">
          <label htmlFor="mes" className="text-sm">Mês:</label>
          <input id="mes" type="month" value={month} max={currentMonthSP()} onChange={(e) => { setMonth(e.target.value); setRead(false); }} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1 text-sm" />
        </div>
        {q.isLoading && <p className="text-slate-400">Carregando...</p>}
        {q.error && <p className="text-rose-300">{q.error.message}</p>}
        {data && (
          <>
            {acc && (
              <Card className={acc.stillValid ? "border-emerald-300/40 bg-emerald-950/40 text-white" : "border-amber-300/40 bg-amber-950/40 text-white"}>
                <CardContent className="flex gap-3 p-4 text-sm">
                  {acc.stillValid ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <AlertTriangle className="h-5 w-5 text-amber-300" />}
                  <p>
                    Você {acc.decision === "accepted" ? "confirmou" : "contestou"} este espelho em {fmtDateTimeSP(acc.acceptedAt)} (horário de Brasília).
                    {!acc.stillValid && " Depois disso houve mudança (nova marcação ou correção aprovada). Confira de novo e confirme a versão atual."}
                    {acc.comment ? ` Seu comentário: “${acc.comment}”.` : ""}
                  </p>
                </CardContent>
              </Card>
            )}
            <Card className="border-white/10 bg-slate-900/70 text-white">
              <CardHeader><CardTitle className="text-base">{data.employer.name || "Empresa"} · {data.worker.name}</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Trabalhado</p><p className="font-bold">{fmtMinutes(data.report.totals.workedMinutes)}</p></div>
                  <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Previsto</p><p className="font-bold">{fmtMinutes(data.report.totals.expectedMinutes)}</p></div>
                  <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Saldo</p><p className="font-bold">{fmtMinutes(data.report.totals.balanceMinutes)}</p></div>
                  <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Marcações ajustadas</p><p className="font-bold">{data.report.totals.adjustedMarks}</p></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-slate-400"><tr><th className="p-1">Dia</th><th className="p-1">Marcações</th><th className="p-1">Trabalhado</th><th className="p-1">Observações</th></tr></thead>
                    <tbody>
                      {data.report.days.map((d: any) => (
                        <tr key={d.date} className="border-t border-white/5 align-top">
                          <td className="p-1 font-semibold">{brDate(d.date)}</td>
                          <td className="p-1">
                            {d.marks.map((m: any, i: number) => (
                              <span key={i} className={`mr-2 inline-block ${m.kind === "adjusted" ? "text-amber-200" : ""}`} title={m.originalTime ? `Original: ${hhmm(m.originalTime)} — ${m.justification || ""}` : undefined}>
                                {m.label.split(" ")[0]} {hhmm(m.time)}{m.kind === "adjusted" ? "*" : ""}
                              </span>
                            ))}
                          </td>
                          <td className="p-1">{fmtMinutes(d.workedMinutes)}</td>
                          <td className="p-1 text-slate-300">{[d.holiday, d.excuse?.label, d.vacation ? "Férias" : null, ...(d.issues || [])].filter(Boolean).join(" · ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-400">* Horário ajustado por correção aprovada. Passe o dedo/mouse para ver o horário original — ele nunca é apagado.</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-slate-900/70 text-white">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4 text-teal-300" />Confirmar ou contestar</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-slate-300">
                  Ao confirmar, guardamos a data e hora, o endereço IP, o aparelho usado e um código (hash) que identifica exatamente
                  esta versão do espelho. Se algo estiver errado, conteste e explique — e peça a correção em “Cartão ponto”.
                </p>
                <label className="flex items-start gap-2"><input type="checkbox" checked={read} onChange={(e) => setRead(e.target.checked)} className="mt-1" />Li todas as marcações do mês acima.</label>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Comentário (obrigatório para contestar)" className="h-20 w-full rounded-md border border-white/20 bg-slate-800 p-2" />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!read || accept.isPending} onClick={() => void decide("accepted")}>Confirmo que está correto</Button>
                  <Button variant="outline" disabled={!read || accept.isPending || comment.trim().length < 5} onClick={() => void decide("contested")}>Contestar</Button>
                </div>
                <p className="break-all font-mono text-[10px] text-slate-500">Código do documento: {data.documentHash}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
