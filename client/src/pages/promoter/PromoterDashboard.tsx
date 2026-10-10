import { useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, ClipboardList, Clock3, MapPin, Send, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";
const labels: Record<EventType, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Fim do intervalo", clock_out: "Saída" };

function currentPosition() {
  return new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Este navegador não oferece GPS."));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => reject(new Error("Autorize o GPS para registrar o ponto.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

function LocationLabel({ latitude, longitude }: { latitude: number | null; longitude: number | null }) {
  const [label, setLabel] = useState("Consultando endereço...");
  useEffect(() => {
    if (latitude == null || longitude == null) { setLabel("Localização não informada"); return; }
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=18&accept-language=pt-BR`)
      .then((response) => response.json()).then((data: { display_name?: string }) => setLabel(data.display_name || "Endereço não identificado"))
      .catch(() => setLabel("Endereço indisponível"));
  }, [latitude, longitude]);
  return <span>{label}</span>;
}

function ClockGate({ timeZone, onPunch, loading = false, closed = false }: { timeZone: string; onPunch?: () => void; loading?: boolean; closed?: boolean }) {
  return <div className="mx-auto max-w-xl"><Card className="border-teal-300/25 bg-gradient-to-br from-slate-900 to-teal-950/30"><CardHeader><CardTitle className="flex items-center gap-3 text-2xl text-white"><Clock3 className="h-7 w-7 text-teal-300" /> {closed ? "Jornada encerrada" : "Entrada obrigatória"}</CardTitle></CardHeader><CardContent className="space-y-5"><p className="text-slate-200">{closed ? "Sua saída já foi registrada hoje. O aplicativo será liberado novamente no próximo dia, após uma nova entrada." : "Para acessar o painel, roteiros e visitas, primeiro registre sua entrada com localização GPS válida."}</p><div className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300"><div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-teal-300" /><span>O GPS será solicitado no momento da batida.</span></div><p className="mt-2 text-xs text-slate-400">Fuso horário detectado: <strong className="text-slate-200">{timeZone}</strong></p></div>{!closed && <Button onClick={onPunch} disabled={loading} className="h-12 w-full bg-teal-300 text-base font-bold text-slate-950 hover:bg-teal-200">{loading ? "Obtendo localização..." : "Permitir GPS e bater entrada"}</Button>}</CardContent></Card></div>;
}

export default function PromoterDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [justification, setJustification] = useState("");
  const utils = trpc.useUtils();
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 100, date: selectedDate });
  const corrections = trpc.timeTracking.myCorrections.useQuery();
  const visits = trpc.operations.visits.today.useQuery();
  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone });
  const register = trpc.timeTracking.registerEvent.useMutation({ onSuccess: () => { toast.success("Marcação registrada"); utils.timeTracking.myHistory.invalidate(); utils.timeTracking.shiftStatus.invalidate(); }, onError: (err) => toast.error(err.message || "Erro ao registrar") });
  const correction = trpc.timeTracking.requestCorrection.useMutation({ onSuccess: () => { toast.success("Pedido enviado ao administrador da empresa"); setSelectedEventId(""); setRequestedTime(""); setJustification(""); utils.timeTracking.myCorrections.invalidate(); }, onError: (err) => toast.error(err.message || "Não foi possível enviar o pedido") });
  const startVisit = trpc.operations.visits.start.useMutation({ onSuccess: () => { toast.success("Visita iniciada"); utils.operations.visits.today.invalidate(); }, onError: (err) => toast.error(err.message || "Não foi possível iniciar a visita") });
  const completeVisit = trpc.operations.visits.complete.useMutation({ onSuccess: () => { toast.success("Visita concluída"); utils.operations.visits.today.invalidate(); }, onError: (err) => toast.error(err.message || "Não foi possível concluir a visita") });

  const handlePunch = async (eventType: EventType) => {
    setLoading(true);
    try { const position = await currentPosition(); await register.mutateAsync({ eventType, timeZone, deviceTime: new Date().toISOString(), ...position, locationStatus: "success", deviceInfo: navigator.userAgent, idempotencyKey: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Autorize o GPS para registrar o ponto."); }
    finally { setLoading(false); }
  };
  const actOnVisit = async (id: number, action: "start" | "complete") => { try { const position = await currentPosition(); if (action === "start") await startVisit.mutateAsync({ id, ...position }); else await completeVisit.mutateAsync({ id, ...position }); } catch (error) { toast.error(error instanceof Error ? error.message : "Autorize o GPS para continuar."); } };
  const submitCorrection = (event: React.FormEvent) => { event.preventDefault(); const eventId = Number(selectedEventId); if (!eventId || !requestedTime || justification.trim().length < 10) return; const original = history.data?.find((item) => item.id === eventId); if (!original) return; correction.mutate({ timeEventId: eventId, requestedType: original.eventType as EventType, requestedTime: new Date(`${selectedDate}T${requestedTime}:00`).toISOString(), justification: justification.trim() }); };

  if (shift.isLoading) return <DashboardLayout title="Ponto obrigatório" description="Verificando a jornada e o fuso horário do dispositivo."><ClockGate timeZone={timeZone} loading /></DashboardLayout>;
  if (!shift.data?.active) return <DashboardLayout title="Bata o ponto para continuar" description="O painel e o roteiro ficam disponíveis somente durante uma jornada ativa."><ClockGate timeZone={shift.data?.timeZone || timeZone} closed={shift.data?.status === "closed"} onPunch={() => handlePunch("clock_in")} loading={loading} /></DashboardLayout>;

  return <DashboardLayout title="Meu ponto, GPS e roteiro" description="Registre sua jornada, consulte o histórico e execute suas visitas.">
    <div id="ponto"><Card><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-teal-300" /> Registrar ponto e GPS</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3"><Button onClick={() => handlePunch("clock_in")} disabled={loading}>Entrada</Button><Button onClick={() => handlePunch("break_start")} disabled={loading} variant="outline">Início intervalo</Button><Button onClick={() => handlePunch("break_end")} disabled={loading} variant="outline">Fim intervalo</Button><Button onClick={() => handlePunch("clock_out")} disabled={loading}>Saída</Button></div><p className="mt-3 text-xs text-slate-300">Cada marcação exige localização GPS válida e registra o endereço do aparelho.</p></CardContent></Card></div>
    <div id="historico"><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-teal-300" /> Calendário, horários e localização</CardTitle></CardHeader><CardContent><div className="flex flex-col gap-2 sm:flex-row sm:items-center"><label htmlFor="history-date" className="text-sm font-semibold">Dia para visualizar</label><input id="history-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" /></div><div className="mt-4 space-y-3">{history.isLoading && <p className="text-sm text-slate-300">Carregando marcações...</p>}{!history.isLoading && !history.data?.length && <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-300">Nenhuma marcação neste dia.</p>}{history.data?.map((event) => <div key={event.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-900">{labels[event.eventType as EventType]}</p><p className="text-sm text-slate-600">Horário: {new Date(event.deviceTime || event.serverTime).toLocaleTimeString("pt-BR")}</p></div><Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-emerald-700"><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Registrado</Badge></div><p className="mt-3 flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" /><LocationLabel latitude={event.latitude} longitude={event.longitude} /></p>{event.notes?.includes("Ajuste aprovado") && <p className="mt-2 text-xs font-semibold text-emerald-700">Ajuste administrativo registrado neste ponto.</p>}</div>)}</div></CardContent></Card></div>
    <div id="correcoes"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-teal-300" /> Pedir correção de ponto</CardTitle></CardHeader><CardContent><form onSubmit={submitCorrection} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold">Marcação<input required type="number" value={selectedEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" placeholder="Selecione uma marcação abaixo" /></label><label className="space-y-2 text-sm font-semibold">Horário correto<input required type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-normal" /></label></div><div className="flex flex-wrap gap-2">{history.data?.map((event) => <Button key={event.id} type="button" variant={selectedEventId === String(event.id) ? "default" : "outline"} size="sm" onClick={() => setSelectedEventId(String(event.id))}>{labels[event.eventType as EventType]} · {new Date(event.deviceTime || event.serverTime).toLocaleTimeString("pt-BR")}</Button>)}</div><textarea required minLength={10} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Explique o motivo da correção (mínimo de 10 caracteres)" className="min-h-24 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 placeholder:text-slate-500" /><Button type="submit" disabled={correction.isPending || !selectedEventId || !requestedTime || justification.trim().length < 10} className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200 disabled:opacity-100 disabled:bg-slate-300 disabled:text-slate-600"><Send className="mr-2 h-4 w-4" /> {correction.isPending ? "Enviando..." : "Enviar pedido ao administrador"}</Button></form><div className="mt-6 border-t border-slate-200 pt-4"><p className="mb-3 font-bold text-slate-900">Meus pedidos recentes</p><div className="space-y-2">{!corrections.data?.length && <p className="text-sm text-slate-300">Nenhum pedido enviado.</p>}{corrections.data?.map(({ request }) => <div key={request.id} className="rounded-lg border border-slate-200 p-3 text-sm"><div className="flex items-center justify-between gap-2"><span className="font-semibold text-slate-900">{request.requestedTime.toLocaleString("pt-BR")}</span><Badge variant="outline" className={request.status === "approved" ? "border-emerald-300 text-emerald-700" : request.status === "rejected" ? "border-red-300 text-red-700" : "border-amber-300 text-amber-700"}>{request.status === "approved" ? "Aprovado" : request.status === "rejected" ? "Recusado" : "Pendente"}</Badge></div><p className="mt-1 text-slate-600">{request.justification}</p></div>)}</div></div></CardContent></Card></div>
    <div id="roteiro"><Card><CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-teal-300" /> Meu roteiro de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{!visits.data?.length && <p className="text-sm text-slate-300">Nenhuma visita planejada para hoje.</p>}{visits.data?.map(({ visit, store }) => <div key={visit.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{store.name}</p><p className="text-sm text-slate-500">{store.address || store.city}{store.state ? ` — ${store.state}` : ""}</p></div><Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge></div>{visit.status === "pending" && <Button className="mt-3 w-full" onClick={() => actOnVisit(visit.id, "start")}>Iniciar visita com GPS</Button>}{visit.status === "in_progress" && <Button className="mt-3 w-full" onClick={() => actOnVisit(visit.id, "complete")}>Concluir visita</Button>}</div>)}</CardContent></Card></div>
  </DashboardLayout>;
}
