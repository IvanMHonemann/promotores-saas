import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Clock3, MapPin, Send, ShieldCheck } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { getCurrentPosition, LocationLabel } from "./geolocation";

type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";

const labels: Record<EventType, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};

function ClockGate({
  timeZone,
  onPunch,
  loading = false,
  closed = false,
  error,
}: {
  timeZone: string;
  onPunch?: () => void;
  loading?: boolean;
  closed?: boolean;
  error?: string;
}) {
  return (
    <main className="saas-page flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-8 text-white">
      <div className="w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-300">Promotores SaaS</p>
          <h1 className="mt-2 text-3xl font-black">Ponto eletrônico</h1>
          <p className="mt-2 text-slate-300">Registre sua jornada com GPS nesta área. Após a marcação, você volta ao painel inicial.</p>
        </div>
        <Card className="border-teal-300/25 bg-gradient-to-br from-slate-900 to-teal-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl text-white">
              <Clock3 className="h-7 w-7 text-teal-300" />
              {closed ? "Jornada encerrada" : "Bata sua entrada"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-slate-200">
              {closed
                ? "Sua saída já foi registrada hoje. O painel inicial continua disponível para consulta."
                : "Confirme sua localização para registrar a entrada e iniciar as atividades do dia."}
            </p>
            <div className="rounded-xl border border-white/10 bg-white/[.04] p-4 text-sm text-slate-300">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-teal-300" />
                <span>O GPS será solicitado pelo navegador quando você tocar no botão abaixo.</span>
              </div>
              <p className="mt-2 text-xs text-slate-400">Fuso horário detectado: <strong className="text-slate-200">{timeZone}</strong></p>
            </div>
            {error && <p className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-3 text-sm font-semibold text-rose-200">{error}</p>}
            {loading && <p className="text-sm text-slate-300">Consultando sua jornada...</p>}
            {!closed && onPunch && (
              <Button onClick={onPunch} disabled={loading} className="h-12 w-full bg-teal-300 text-base font-bold text-slate-950 hover:bg-teal-200">
                {loading ? "Obtendo localização..." : "Permitir GPS e bater entrada"}
              </Button>
            )}
            <a href="/" className="block text-center text-sm font-semibold text-teal-200 underline-offset-4 hover:underline">Voltar ao painel inicial</a>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function PromoterClockPage() {
  const [, navigate] = useLocation();
  const today = new Date().toISOString().slice(0, 10);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [selectedDate, setSelectedDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [punchError, setPunchError] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [requestedTime, setRequestedTime] = useState("");
  const [justification, setJustification] = useState("");
  const utils = trpc.useUtils();
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 100, date: selectedDate });
  const corrections = trpc.timeTracking.myCorrections.useQuery();
  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone });

  const register = trpc.timeTracking.registerEvent.useMutation({
    onSuccess: () => {
      setPunchError("");
      toast.success("Marcação registrada. Voltando ao painel inicial.");
      void utils.timeTracking.myHistory.invalidate();
      void utils.timeTracking.shiftStatus.invalidate();
    },
  });

  const correction = trpc.timeTracking.requestCorrection.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado ao administrador da empresa");
      setSelectedEventId("");
      setRequestedTime("");
      setJustification("");
      void utils.timeTracking.myCorrections.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível enviar o pedido"),
  });

  const handlePunch = async (eventType: EventType) => {
    setLoading(true);
    setPunchError("");
    try {
      const position = await getCurrentPosition();
      if (position.accuracy > 10000) {
        throw new Error("O GPS informou uma precisão muito baixa. Ative a localização precisa e tente em um local aberto.");
      }
      await register.mutateAsync({
        eventType,
        timeZone,
        deviceTime: new Date().toISOString(),
        ...position,
        locationStatus: "success",
        deviceInfo: navigator.userAgent,
        idempotencyKey: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      navigate("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível registrar o ponto.";
      setPunchError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const submitCorrection = (event: React.FormEvent) => {
    event.preventDefault();
    const eventId = Number(selectedEventId);
    if (!eventId || !requestedTime || justification.trim().length < 10) return;
    const original = history.data?.find((item) => item.id === eventId);
    if (!original) return;
    correction.mutate({
      timeEventId: eventId,
      requestedType: original.eventType as EventType,
      requestedTime: new Date(`${selectedDate}T${requestedTime}:00`).toISOString(),
      justification: justification.trim(),
    });
  };

  useEffect(() => {
    if (!shift.data?.active) return;
    const sectionId = decodeURIComponent(window.location.hash.slice(1));
    if (!sectionId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [shift.data?.active]);

  if (shift.isLoading) return <ClockGate timeZone={timeZone} loading />;
  if (!shift.data?.active) {
    return (
      <ClockGate
        timeZone={shift.data?.timeZone || timeZone}
        error={punchError || shift.error?.message}
        closed={shift.data?.status === "closed"}
        onPunch={() => void handlePunch("clock_in")}
        loading={loading}
      />
    );
  }

  const events = history.data || [];
  const byType = Object.fromEntries(events.map((e: any) => [e.eventType, e]));
  const nextEvent: EventType = !byType.clock_in ? "clock_in" : !byType.break_start ? "break_start" : !byType.break_end ? "break_end" : "clock_out";
  const nextLabel: Record<EventType, string> = {
    clock_in: "Bater entrada",
    break_start: "Iniciar intervalo",
    break_end: "Encerrar intervalo",
    clock_out: "Bater saída",
  };
  const now = new Date();
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();
  const entryTime = byType.clock_in ? new Date(byType.clock_in.deviceTime || byType.clock_in.serverTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : null;

  return (
    <DashboardLayout title="Ponto" description="">
      <div className="space-y-4">
        <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>{dateStr}</span>
            <span className="flex items-center gap-1.5 text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Online</span>
          </div>
          <p className="mt-3 text-5xl font-black tracking-tight text-white">{timeStr}</p>
          <div className="mt-3 flex items-center gap-2">
            <Badge className="bg-teal-400/15 text-teal-200">Jornada em andamento</Badge>
            {entryTime && <span className="text-sm text-slate-400">Entrada às {entryTime}</span>}
          </div>
        </div>

        <Button onClick={() => void handlePunch(nextEvent)} disabled={loading || register.isPending} className="h-14 w-full rounded-2xl bg-teal-400 text-lg font-bold text-slate-950 hover:bg-teal-300">
          <Clock className="mr-2 h-5 w-5" /> {loading ? "Registrando..." : nextLabel[nextEvent]}
        </Button>
        <p className="text-center text-xs text-slate-500">Próxima marcação: {nextLabel[nextEvent].toLowerCase()}</p>
        {punchError && <p className="rounded-xl border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">{punchError}</p>}

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="mb-4 text-sm font-semibold text-white">Marcações de hoje</p>
          <div className="space-y-0">
            {(["clock_in", "break_start", "break_end", "clock_out"] as EventType[]).map((type, i, arr) => {
              const ev = byType[type];
              const done = Boolean(ev);
              const isNext = type === nextEvent;
              const time = ev ? new Date(ev.deviceTime || ev.serverTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "--:--";
              return (
                <div key={type} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`grid h-6 w-6 place-items-center rounded-full border-2 ${done ? "border-teal-400 bg-teal-400 text-slate-950" : isNext ? "border-teal-400 text-teal-300" : "border-slate-600 text-slate-500"}`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                    </div>
                    {i < arr.length - 1 && <div className={`h-8 w-0.5 ${done ? "bg-teal-400/50" : "bg-slate-700"}`} />}
                  </div>
                  <div className="flex flex-1 items-start justify-between pb-2">
                    <div>
                      <p className={`text-sm font-semibold ${done || isNext ? "text-white" : "text-slate-500"}`}>{labels[type]}</p>
                      <p className="text-xs text-slate-500">{done ? "Registrada no aparelho" : isNext ? "Próxima marcação" : "Aguardando"}</p>
                    </div>
                    <span className={`text-sm font-semibold ${done ? "text-teal-300" : "text-slate-600"}`}>{time}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Se esquecer de bater a saída, ela é registrada automaticamente às 18:00.</span>
        </div>

        <a href="#correcao" className="block text-center text-sm font-semibold text-teal-300 hover:underline">Solicitar correção de horário →</a>

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
                  onChange={(event) = className="[color-scheme:dark]"> setSelectedDate(event.target.value)}
                  className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100"
                />
              </div>
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
                <ShieldCheck className="h-5 w-5 text-teal-300" /> Pedir correção de ponto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitCorrection} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-slate-200">
                    Marcação
                    <input
                      required
                      type="number"
                      value={selectedEventId}
                      onChange={(event) => setSelectedEventId(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100 placeholder:text-slate-400"
                      placeholder="Selecione uma marcação abaixo"
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
                <textarea
                  required
                  minLength={10}
                  value={justification}
                  onChange={(event) => setJustification(event.target.value)}
                  placeholder="Explique o motivo da correção (mínimo de 10 caracteres)"
                  className="min-h-24 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-400"
                />
                <Button
                  type="submit"
                  disabled={correction.isPending || !selectedEventId || !requestedTime || justification.trim().length < 10}
                  className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200 disabled:opacity-100 disabled:bg-slate-700 disabled:text-slate-400"
                >
                  <Send className="mr-2 h-4 w-4" /> {correction.isPending ? "Enviando..." : "Enviar pedido ao administrador"}
                </Button>
              </form>
              <div className="mt-6 border-t border-white/10 pt-4">
                <p className="mb-3 font-bold text-slate-100">Meus pedidos recentes</p>
                <div className="space-y-2">
                  {!corrections.data?.length && <p className="text-sm text-slate-300">Nenhum pedido enviado.</p>}
                  {corrections.data?.map(({ request }) => (
                    <div key={request.id} className="rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100">{request.requestedTime.toLocaleString("pt-BR")}</span>
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
