import { useMemo, useState } from "react";
import { Ban, Calendar, Check, Clock, RotateCcw, Users, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { fullDayExcuseLabel, inferFullDayExcuseType, looksLikeFullDayExcuse } from "@shared/correctionExcuse";

const labels: Record<string, string> = { clock_in: "Entrada", break_start: "Intervalo", break_end: "Retorno", clock_out: "Saída" };

export default function TimesheetPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [autoTime, setAutoTime] = useState("");
  const autoSetting = trpc.settings.getAutoClockOut.useQuery(undefined, { staleTime: 60000 });
  const setAuto = trpc.settings.setAutoClockOut.useMutation({ onSuccess: () => toast.success("Horário salvo.") });
  const utils = trpc.useUtils();
  const promoters = trpc.operations.promoters.list.useQuery(undefined, { staleTime: 30000 });
  const corrections = trpc.timeTracking.correctionRequests.pending.useQuery(undefined, { staleTime: 15000 });
  const history = trpc.timeTracking.companyHistory.useQuery({ memberId: selectedId!, month }, { enabled: Boolean(selectedId), staleTime: 10000 });
  const excuses = trpc.timeTracking.companyApprovedExcuses.useQuery({ memberId: selectedId!, month }, { enabled: Boolean(selectedId), staleTime: 10000 });
  const reviewMany = trpc.timeTracking.correctionRequests.reviewMany.useMutation({
    onSuccess: (data) => { toast.success(`${data.count} horário(s) analisados juntos.`); void corrections.refetch(); },
    onError: (e) => toast.error(e.message || "Não foi possível analisar."),
  });
  const review = trpc.timeTracking.correctionRequests.review.useMutation({
    onSuccess: () => { toast.success("Solicitação analisada."); void corrections.refetch(); },
    onError: (e) => toast.error(e.message || "Não foi possível analisar."),
  });
  const selected = promoters.data?.find((p: any) => p.id === selectedId);
  // Desconsiderar / reconsiderar batida (o registro original nunca é apagado).
  const [disregardTarget, setDisregardTarget] = useState<{ ev: any; mode: "disregard" | "reconsider" } | null>(null);
  const [disregardReason, setDisregardReason] = useState("");
  const afterDisregard = (msg: string) => { toast.success(msg); setDisregardTarget(null); setDisregardReason(""); void history.refetch(); void utils.timesheetMirror.generate.invalidate(); };
  const disregard = trpc.timeTracking.disregardEvent.useMutation({ onSuccess: () => afterDisregard("Batida desconsiderada. Ela não conta mais no espelho."), onError: (e) => toast.error(e.message || "Não foi possível desconsiderar.") });
  const reconsider = trpc.timeTracking.reconsiderEvent.useMutation({ onSuccess: () => afterDisregard("Batida reconsiderada. Ela volta a contar no espelho."), onError: (e) => toast.error(e.message || "Não foi possível reconsiderar.") });
  const fmtTime = (ev: any) => new Date(ev.deviceTime || ev.serverTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of history.data || []) {
      const day = new Date(ev.deviceTime || ev.serverTime).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
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
              {!history.isLoading && byDay.length === 0 && !excuses.data?.length && <p className="text-sm text-slate-400">Nenhuma marcação neste mês.</p>}
              {(excuses.data || []).filter((item) => !byDay.some(([day]) => day === item.date)).map((item) => (
                <div key={`excuse-${item.date}`} className="rounded-lg border border-teal-300/20 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold text-teal-300">{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                  <p className="mt-1 text-sm text-slate-200">{fullDayExcuseLabel(item.type)} — dia abonado{item.justification ? ` · ${item.justification}` : ""}</p>
                </div>
              ))}
              {byDay.map(([day, events]) => {
                  let mins = 0;
                  let start: Date | null = null;
                  for (const ev of events) {
                    if (ev.disregard) continue;
                    const t = new Date(ev.deviceTime || ev.serverTime);
                    if (ev.eventType === "clock_in" || ev.eventType === "break_end") start = t;
                    if ((ev.eventType === "break_start" || ev.eventType === "clock_out") && start) {
                      mins += Math.max(0, Math.round((t.getTime() - start.getTime()) / 60000));
                      start = null;
                    }
                  }
                  const hours = Math.floor(mins / 60);
                  const rem = mins % 60;
                  return (
                <div key={day} className="rounded-lg border border-white/10 bg-slate-950/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-teal-300">{new Date(day + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</p>
                    {mins > 0 && <span className="text-xs text-slate-400">{hours}h{rem.toString().padStart(2, "0")}</span>}
                    {(excuses.data || []).some((item) => item.date === day) && <span className="text-xs text-teal-300">{fullDayExcuseLabel((excuses.data || []).find((item) => item.date === day)?.type)} — abonado</span>}
                  </div>
                  <div className="space-y-1">
                    {events.map((ev: any) => (
                      <div key={ev.id} className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm ${ev.disregard ? "opacity-60" : ""}`}>
                        <span className={ev.disregard ? "text-slate-400 line-through" : "text-slate-200"}>
                          {labels[ev.eventType] || ev.eventType}
                          {ev.origin === "inclusion" && <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-xs text-slate-300 no-underline">Incluída</span>}
                          {ev.disregard && <span className="ml-2 inline-block rounded bg-slate-500/30 px-1.5 py-0.5 text-xs text-slate-200" title={`Motivo: ${ev.disregard.reason}${ev.disregard.decidedByName ? ` (por ${ev.disregard.decidedByName})` : ""}`}>Desconsiderada</span>}
                        </span>
                        <span className="flex items-center text-slate-400">
                          <span className={ev.disregard ? "line-through" : ""}>{fmtTime(ev)}</span>
                          {ev.notes?.includes("automática") && <span className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-200">Auto</span>}
                          {(ev.offline || ev.notes?.includes("[MARCACAO-OFFLINE]")) && <span title={`Registrado offline. Recebido pelo servidor às ${new Date(ev.serverTime).toLocaleString("pt-BR")}`} className="ml-2 rounded bg-sky-400/20 px-1.5 py-0.5 text-xs text-sky-200">Registrado offline</span>}
                          {ev.notes?.includes("[ALERTA-RELOGIO]") && <span title="Possível alteração do relógio do aparelho. Confira com o promotor." className="ml-2 rounded bg-rose-400/20 px-1.5 py-0.5 text-xs text-rose-200">Relógio suspeito</span>}
                          {ev.notes?.includes("[SEQUENCIA-OFFLINE]") && <span title="Marcação offline fora da sequência esperada" className="ml-2 rounded bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-200">Fora de sequência</span>}
                          {ev.disregard ? (
                            <button type="button" onClick={() => { setDisregardReason(""); setDisregardTarget({ ev, mode: "reconsider" }); }} className="ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-teal-300/40 px-2 text-xs font-semibold text-teal-200 hover:bg-teal-400/10" aria-label={`Reconsiderar ${labels[ev.eventType] || "batida"} das ${fmtTime(ev)}`}>
                              <RotateCcw className="h-3.5 w-3.5" /> Reconsiderar
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setDisregardReason(""); setDisregardTarget({ ev, mode: "disregard" }); }} className="ml-2 inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/15 px-2 text-xs text-slate-300 hover:bg-white/5" aria-label={`Desconsiderar ${labels[ev.eventType] || "batida"} das ${fmtTime(ev)}`}>
                              <Ban className="h-3.5 w-3.5" /> Desconsiderar
                            </button>
                          )}
                        </span>
                        {ev.disregard && <p className="w-full text-xs text-slate-400">Motivo: {ev.disregard.reason}{ev.disregard.decidedByName ? ` (por ${ev.disregard.decidedByName})` : ""}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );})}
            </CardContent>
          </Card>
        )}

        <Card className="border-amber-300/25 bg-amber-300/5 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4 text-amber-300" />Solicitações de correção</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const labels: Record<string, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Fim do intervalo", clock_out: "Saída" };
              const dayKey = (iso: string | Date) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
              const groups = new Map<string, any[]>();
              for (const item of corrections.data || []) {
                const key = `${item.request.memberAccountId}:${dayKey(item.request.requestedTime)}`;
                const list = groups.get(key) || [];
                list.push(item);
                groups.set(key, list);
              }
              const grouped = [...groups.values()];
              if (!grouped.length) return <p className="text-sm text-slate-400">Nenhuma solicitação pendente.</p>;
              return grouped.map((items) => {
                const first = items[0];
                const ids = items.map((item: any) => item.request.id);
                const photo = items.find((item: any) => item.attachmentUrl);
                const day = new Date(first.request.requestedTime).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
                return (
                  <div key={ids.join("-")} className="mb-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
                    <p className="font-semibold text-white">{first.employee?.userName || "Promotor"}</p>
                    <p className="text-xs text-teal-300">{looksLikeFullDayExcuse(first.request) ? `${fullDayExcuseLabel(inferFullDayExcuseType(first.request))} · dia inteiro` : (({normal:"Correção normal", other:"Outro"} as any)[first.request.justificationType] || "Correção normal")} · {day}</p>
                    <div className="mt-2 space-y-1">
                      {looksLikeFullDayExcuse(first.request) ? (
                        <p className="text-slate-200">Abono do dia — sem horários</p>
                      ) : items.slice().sort((a: any, b: any) => new Date(a.request.requestedTime).getTime() - new Date(b.request.requestedTime).getTime()).map((item: any) => (
                        <p key={item.request.id} className="text-slate-200">{labels[item.request.requestedType] || "Batida"} · {new Date(item.request.requestedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                      ))}
                    </div>
                    <p className="mt-2 text-slate-300">{first.request.justification}</p>
                    {photo?.attachmentUrl && (
                      <a href={photo.attachmentUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                        <img src={photo.attachmentUrl} alt="Comprovante anexado" className="h-24 w-24 rounded-lg border border-white/15 object-cover" />
                        <span className="mt-1 block text-xs text-amber-200">Abrir comprovante</span>
                      </a>
                    )}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" className="bg-emerald-500 text-white hover:bg-emerald-400" disabled={review.isPending || reviewMany.isPending} onClick={() => ids.length > 1 ? reviewMany.mutate({ ids, status: "approved" }) : review.mutate({ id: ids[0], status: "approved" })}>
                        <Check className="mr-1 h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button size="sm" variant="outline" className="border-rose-300/40 text-rose-200" disabled={review.isPending || reviewMany.isPending} onClick={() => ids.length > 1 ? reviewMany.mutate({ ids, status: "rejected" }) : review.mutate({ id: ids[0], status: "rejected" })}>
                        <X className="mr-1 h-3.5 w-3.5" /> Recusar
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>
        <Dialog open={Boolean(disregardTarget)} onOpenChange={(open) => { if (!open) setDisregardTarget(null); }}>
          <DialogContent className="max-w-md border-white/10 bg-slate-900 text-white">
            <DialogHeader>
              <DialogTitle>{disregardTarget?.mode === "reconsider" ? "Reconsiderar batida" : "Desconsiderar batida"}</DialogTitle>
              <DialogDescription className="text-slate-300">
                {disregardTarget && `${labels[disregardTarget.ev.eventType] || "Batida"} das ${fmtTime(disregardTarget.ev)} — ${new Date(disregardTarget.ev.deviceTime || disregardTarget.ev.serverTime).toLocaleDateString("pt-BR")}`}
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-slate-300">
              {disregardTarget?.mode === "reconsider"
                ? "A batida volta a contar no espelho e no cálculo de horas. O histórico da desconsideração fica guardado."
                : "A batida não é apagada: o registro original fica guardado. Ela só deixa de contar no espelho e no cálculo de horas, e aparece em Ocorrências com o motivo."}
            </p>
            <textarea value={disregardReason} onChange={(e) => setDisregardReason(e.target.value)} maxLength={500} placeholder={disregardTarget?.mode === "reconsider" ? "Motivo (opcional)" : "Justificativa (obrigatória). Ex.: batida incluída em duplicidade"} className="min-h-24 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-400" />
            {disregardTarget?.mode === "disregard" && disregardReason.trim().length > 0 && disregardReason.trim().length < 5 && <p className="text-xs text-amber-300">Escreva pelo menos 5 caracteres.</p>}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" className="h-11 border-white/15" onClick={() => setDisregardTarget(null)}>Cancelar</Button>
              {disregardTarget?.mode === "reconsider" ? (
                <Button className="h-11 bg-teal-400 text-slate-950" disabled={reconsider.isPending} onClick={() => reconsider.mutate({ eventId: disregardTarget.ev.id, reason: disregardReason.trim() || undefined })}>Reconsiderar</Button>
              ) : (
                <Button className="h-11 bg-rose-500 text-white hover:bg-rose-400" disabled={disregard.isPending || disregardReason.trim().length < 5} onClick={() => disregardTarget && disregard.mutate({ eventId: disregardTarget.ev.id, reason: disregardReason.trim() })}>Desconsiderar</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Configuração (separada da consulta): horário de aviso de batida faltante. */}
        <details className="group rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-white">
          <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
            Configurações do ponto
            <span className="text-sm font-normal text-teal-300 group-open:hidden">Abrir</span>
          </summary>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="auto-time" className="text-sm font-semibold text-white">Avisar se o promotor não encerrar a jornada até:</label>
              <p className="mt-0.5 text-sm text-slate-300">Depois desse horário, o promotor e o administrador recebem um aviso. Nenhuma batida é criada automaticamente.</p>
              <input id="auto-time" type="time" value={autoTime || autoSetting.data || ""} onChange={(e) => setAutoTime(e.target.value)} className="mt-2 block h-11 rounded-lg border border-white/15 bg-slate-950 px-3 text-white [color-scheme:dark]" />
            </div>
            <Button className="h-11 bg-teal-400 text-slate-950" disabled={setAuto.isPending} onClick={() => setAuto.mutate({ time: autoTime || autoSetting.data || "" })}>Salvar</Button>
          </div>
        </details>
      </div>
    </DashboardLayout>
  );
}
