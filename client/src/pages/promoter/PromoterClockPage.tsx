import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Plus, Send, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { LocationLabel } from "./geolocation";
import { localDayKey } from "@/components/PunchPanel";

type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";

const labels: Record<EventType, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};

const allTypes: EventType[] = ["clock_in", "break_start", "break_end", "clock_out"];

export default function PromoterClockPage() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = localDayKey(new Date(), timeZone);
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<"correct" | "add">("correct");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedMissingType, setSelectedMissingType] = useState<EventType | "">("");
  const [requestedTime, setRequestedTime] = useState("");
  const [justification, setJustification] = useState("");
  const utils = trpc.useUtils();
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 100, date: selectedDate });
  const missingPunch = trpc.timeTracking.myMissingPunch.useQuery(undefined, { staleTime: 60000 });
  const corrections = trpc.timeTracking.myCorrections.useQuery();

  const missingTypes = useMemo(() => {
    const events = history.data ?? [];
    if (!events.length) return ["clock_in"] as EventType[];
    const types = events.map((e) => e.eventType as EventType);
    const hasIn = types.includes("clock_in");
    const hasOut = types.includes("clock_out");
    const starts = types.filter((t) => t === "break_start").length;
    const ends = types.filter((t) => t === "break_end").length;
    const openBreak = starts > ends;
    const result: EventType[] = [];
    if (!hasIn) result.push("clock_in");
    if (openBreak) result.push("break_end");
    if (hasIn && !hasOut && !openBreak) result.push("clock_out");
    if (hasIn && !openBreak && !result.includes("break_start")) result.push("break_start");
    if (hasIn && openBreak && !result.includes("break_end")) result.push("break_end");
    return result.length ? result : allTypes;
  }, [history.data]);

  const correction = trpc.timeTracking.requestCorrection.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado ao administrador da empresa");
      setSelectedEventId("");
      setSelectedMissingType("");
      setRequestedTime("");
      setJustification("");
      void utils.timeTracking.myCorrections.invalidate();
      void utils.timeTracking.myHistory.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível enviar o pedido"),
  });

  const submitCorrection = (event: React.FormEvent) => {
    event.preventDefault();
    if (!requestedTime || justification.trim().length < 10) return;
    const isoTime = new Date(`${selectedDate}T${requestedTime}:00`).toISOString();

    if (mode === "correct") {
      const eventId = Number(selectedEventId);
      if (!eventId) return;
      const original = history.data?.find((item) => item.id === eventId);
      if (!original) return;
      correction.mutate({
        timeEventId: eventId,
        requestedType: original.eventType as EventType,
        requestedTime: isoTime,
        justification: justification.trim(),
      });
    } else {
      if (!selectedMissingType) return;
      correction.mutate({
        timeEventId: null,
        requestedType: selectedMissingType,
        requestedTime: isoTime,
        justification: justification.trim(),
      });
    }
  };

  useEffect(() => {
    const sectionId = decodeURIComponent(window.location.hash.slice(1));
    if (!sectionId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const selectedEvent = history.data?.find((item) => String(item.id) === selectedEventId);

  return (
    <DashboardLayout title="Cartão ponto" description="Histórico, localização e pedidos de correção.">
      <div className="space-y-4">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Voltar ao painel inicial para bater o ponto
        </Link>

        <div id="historico" className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <CalendarDays className="h-5 w-5 text-teal-300" /> Calendário, horários e localização
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="history-date" className="text-sm font-semibold text-slate-200">Dia para visualizar</label>
                <input
                  id="history-date"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setSelectedEventId("");
                    setSelectedMissingType("");
                  }}
                  className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100"
                />
              </div>
              {missingPunch.data && (
                <div className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4">
                  <p className="font-bold text-amber-100">Batida faltante detectada</p>
                  <p className="mt-1 text-sm text-amber-200">
                    Última marcação: {missingPunch.data.lastLabel} em {new Date(missingPunch.data.lastTime).toLocaleString("pt-BR")}.
                    Falta registrar: {missingPunch.data.missing}.
                  </p>
                  <a href="#correcoes" className="mt-2 inline-block text-sm font-semibold text-amber-300 underline">Solicitar correção ou inclusão ao supervisor</a>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {history.isLoading && <p className="text-sm text-slate-300">Carregando marcações...</p>}
                {!history.isLoading && !history.data?.length && <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-300">Nenhuma marcação neste dia.</p>}
                {history.data?.map((event) => (
                  <div key={event.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-slate-100">{labels[event.eventType as EventType]}</p>
                        <p className="text-sm text-slate-300">Horário: {new Date(event.deviceTime || event.serverTime).toLocaleTimeString("pt-BR")}</p>
                      </div>
                      <Badge variant="outline" className="w-fit border-emerald-300 bg-emerald-50 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Registrado
                      </Badge>
                    </div>
                    <p className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
                      <LocationLabel latitude={event.latitude} longitude={event.longitude} />
                    </p>
                    {event.notes?.includes("Ajuste aprovado") && <p className="mt-2 text-xs font-semibold text-emerald-300">Ajuste administrativo registrado neste ponto.</p>}
                    {event.notes?.includes("incluída via solicitação") && <p className="mt-2 text-xs font-semibold text-teal-300">Batida incluída por solicitação aprovada.</p>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div id="correcoes" className="scroll-mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ShieldCheck className="h-5 w-5 text-teal-300" /> Pedir correção ou inclusão de ponto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex gap-2">
                <Button type="button" variant={mode === "correct" ? "default" : "outline"} size="sm" onClick={() => setMode("correct")}>
                  Corrigir batida existente
                </Button>
                <Button type="button" variant={mode === "add" ? "default" : "outline"} size="sm" onClick={() => setMode("add")}>
                  <Plus className="mr-1 h-4 w-4" /> Incluir batida esquecida
                </Button>
              </div>

              <form onSubmit={submitCorrection} className="space-y-4">
                {mode === "correct" ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-semibold text-slate-200">
                        Marcação
                        <input
                          required
                          readOnly
                          value={selectedEvent ? `${labels[selectedEvent.eventType as EventType]} · ${new Date(selectedEvent.deviceTime || selectedEvent.serverTime).toLocaleTimeString("pt-BR")}` : ""}
                          className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100 placeholder:text-slate-400"
                          placeholder="Toque em uma marcação abaixo"
                        />
                      </label>
                      <label className="space-y-2 text-sm font-semibold text-slate-200">
                        Horário correto
                        <input
                          required
                          type="time"
                          value={requestedTime}
                          onChange={(event) => setRequestedTime(event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {history.data?.map((event) => (
                        <Button
                          key={event.id}
                          type="button"
                          variant={selectedEventId === String(event.id) ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedEventId(String(event.id))}
                        >
                          {labels[event.eventType as EventType]} · {new Date(event.deviceTime || event.serverTime).toLocaleTimeString("pt-BR")}
                        </Button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2 text-sm font-semibold text-slate-200">
                        Tipo da batida faltante
                        <select
                          required
                          value={selectedMissingType}
                          onChange={(e) => setSelectedMissingType(e.target.value as EventType)}
                          className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100"
                        >
                          <option value="">Selecione...</option>
                          {missingTypes.map((t) => (
                            <option key={t} value={t}>{labels[t]}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-sm font-semibold text-slate-200">
                        Horário da batida
                        <input
                          required
                          type="time"
                          value={requestedTime}
                          onChange={(event) => setRequestedTime(event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100"
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-400">
                      Batidas sugeridas com base no dia selecionado. O supervisor irá analisar e aprovar a inclusão.
                    </p>
                  </>
                )}

                <textarea
                  required
                  minLength={10}
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  placeholder={mode === "add" ? "Explique por que a batida foi esquecida (mínimo de 10 caracteres)" : "Explique o motivo da correção (mínimo de 10 caracteres)"}
                  className="min-h-24 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-400"
                />
                <Button
                  type="submit"
                  disabled={
                    correction.isPending ||
                    !requestedTime ||
                    justification.trim().length < 10 ||
                    (mode === "correct" && !selectedEventId) ||
                    (mode === "add" && !selectedMissingType)
                  }
                  className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200 disabled:opacity-100 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  <Send className="mr-2 h-4 w-4" /> {correction.isPending ? "Enviando..." : mode === "add" ? "Enviar pedido de inclusão" : "Enviar pedido ao administrador"}
                </Button>
              </form>

              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 font-bold text-slate-100">Meus pedidos recentes</p>
                <div className="space-y-2">
                  {!corrections.data?.length && <p className="text-sm text-slate-300">Nenhum pedido enviado.</p>}
                  {corrections.data?.map(({ request }) => (
                    <div key={request.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">
                          {labels[request.requestedType as EventType] ?? request.requestedType} · {new Date(request.requestedTime).toLocaleString("pt-BR")}
                          {!request.timeEventId && <span className="ml-2 text-xs text-teal-300">(inclusão)</span>}
                        </span>
                        <Badge variant="outline" className={request.status === "approved" ? "border-emerald-300 text-emerald-300" : request.status === "rejected" ? "border-red-300 text-red-300" : "border-amber-300 text-amber-300"}>
                          {request.status === "approved" ? "Aprovado" : request.status === "rejected" ? "Recusado" : "Pendente"}
                        </Badge>
                      </div>
                      <p className="mt-1 text-slate-300">{request.justification}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
