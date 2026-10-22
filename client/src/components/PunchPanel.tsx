import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CalendarDays, CheckCircle2, Coffee, Loader2, LogIn, LogOut, MapPin, Play } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useBusy } from "@/components/BusyOverlay";
import { getCurrentPosition } from "@/pages/promoter/geolocation";
import { enqueue, list as listQueue, remove as removeQueue, isOnline, type QueuedPunch } from "@/lib/offlineQueue";

export type PunchType = "clock_in" | "break_start" | "break_end" | "clock_out";

/** Dia local (AAAA-MM-DD) — o mesmo critério que o servidor usa para decidir a jornada do dia. */
export function localDayKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const eventTime = (event: { deviceTime?: string | Date | null; serverTime?: string | Date | null }) =>
  new Date((event.deviceTime || event.serverTime) as string | Date);

const hhmm = (date: Date) => date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function formatDuration(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}min` : `${m} min`;
}

type Action = { type: PunchType; label: string; hint: string; icon: typeof LogIn; style: string };

const ACTIONS: Record<PunchType, Action> = {
  clock_in: { type: "clock_in", label: "Bater entrada", hint: "Inicia sua jornada de hoje", icon: LogIn, style: "bg-emerald-500 hover:bg-emerald-400 text-white" },
  break_start: { type: "break_start", label: "Iniciar intervalo", hint: "Pausa para descanso ou almoço", icon: Coffee, style: "bg-amber-500 hover:bg-amber-400 text-slate-950" },
  break_end: { type: "break_end", label: "Voltar do intervalo", hint: "Retoma a jornada", icon: Play, style: "bg-sky-500 hover:bg-sky-400 text-white" },
  clock_out: { type: "clock_out", label: "Bater saída", hint: "Encerra a jornada de hoje", icon: LogOut, style: "bg-rose-500 hover:bg-rose-400 text-white" },
};

const STEPS: Array<{ type: PunchType; label: string }> = [
  { type: "clock_in", label: "Entrada" },
  { type: "break_start", label: "Intervalo" },
  { type: "break_end", label: "Retorno" },
  { type: "clock_out", label: "Saída" },
];

/**
 * Ponto eletrônico direto no painel: um toque registra a próxima marcação (com GPS).
 * Histórico completo, localização e pedidos de correção ficam em "Cartão ponto".
 */
export function PunchPanel() {
  const [queue, setQueue] = useState<QueuedPunch[]>([]);
  const refreshQueue = () => setQueue(listQueue());
  useEffect(() => { refreshQueue(); }, []);

  // Sync queue when online
  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return;
      const pending = listQueue();
      if (!pending.length) return;
      for (const item of pending) {
        try {
          await register.mutateAsync({
            eventType: item.eventType,
            timeZone: item.timeZone,
            deviceTime: item.deviceTime,
            latitude: item.latitude,
            longitude: item.longitude,
            accuracy: item.accuracy,
            locationStatus: item.locationStatus as any,
            deviceInfo: item.deviceInfo,
            idempotencyKey: item.idempotencyKey,
          });
          removeQueue(item.id);
        } catch { /* retry next time */ }
      }
      refreshQueue();
      void utils.timeTracking.myHistory.invalidate();
      void utils.timeTracking.shiftStatus.invalidate();
    };
    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, []);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const utils = trpc.useUtils();
  const { run } = useBusy();
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const shift = trpc.timeTracking.shiftStatus.useQuery({ timeZone });
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 30 });
  const register = trpc.timeTracking.registerEvent.useMutation();

  const todayKey = localDayKey(now, timeZone);
  const today = useMemo(() => {
    const serverEvents = (history.data || []).filter((e: any) => localDayKey(eventTime(e), timeZone) === todayKey);
    // Inclui batidas da fila offline para avançar a tela
    const queuedEvents = queue.map((q) => ({
      eventType: q.eventType,
      deviceTime: q.deviceTime,
      serverTime: q.deviceTime,
      id: q.id,
      queued: true,
    })).filter((e) => localDayKey(eventTime(e), timeZone) === todayKey);
    return [...serverEvents, ...queuedEvents].sort((a: any, b: any) => eventTime(a).getTime() - eventTime(b).getTime());
  }, [history.data, queue, timeZone, todayKey]);

  const last = today[today.length - 1] as any;
  const lastType = (last?.eventType as PunchType | undefined) ?? undefined;
  const byType = useMemo(() => {
    const map: Partial<Record<PunchType, any>> = {};
    for (const e of today as any[]) map[e.eventType as PunchType] = e; // a última de cada tipo vale
    return map;
  }, [today]);

  const closed = lastType === "clock_out";
  const onBreak = lastType === "break_start";
  const primary: Action = !lastType || closed ? ACTIONS.clock_in : lastType === "clock_in" ? ACTIONS.break_start : onBreak ? ACTIONS.break_end : ACTIONS.break_start;
  // O servidor permite encerrar sem intervalo e depois de voltar dele.
  const canFinish = lastType === "clock_in" || lastType === "break_end";

  // Tempo trabalhado: entrada → intervalo, e retorno → saída (ou agora, se ainda aberta).
  const workedMs = useMemo(() => {
    const entry = byType.clock_in ? eventTime(byType.clock_in).getTime() : null;
    if (entry == null) return 0;
    const exit = byType.clock_out ? eventTime(byType.clock_out).getTime() : now.getTime();
    const breakStart = byType.break_start ? eventTime(byType.break_start).getTime() : null;
    const breakEnd = byType.break_end ? eventTime(byType.break_end).getTime() : null;
    if (breakStart == null) return Math.max(0, exit - entry);
    let total = Math.max(0, breakStart - entry);
    if (breakEnd != null && breakEnd >= breakStart) total += Math.max(0, exit - breakEnd);
    return total;
  }, [byType, now]);

  const punch = async (action: Action) => {
    if (busy) return;
    if (action.type === "clock_out" && !window.confirm("Encerrar a jornada de hoje? Depois da saída não é possível bater novas marcações no dia.")) return;
    setBusy(true);
    setError("");
    try {
      await run("Registrando ponto...", async ({ setLabel }) => {
        setLabel("Obtendo sua localização...");
        const position = await getCurrentPosition();
        if (position.accuracy > 10000) {
          throw new Error("O GPS informou uma precisão muito baixa. Ative a localização precisa e tente em um local aberto.");
        }
        const payload = {
          eventType: action.type,
          timeZone,
          deviceTime: new Date().toISOString(),
          ...position,
          locationStatus: "success" as const,
          deviceInfo: navigator.userAgent,
          idempotencyKey: `${action.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        };
        if (!isOnline()) {
          enqueue(payload);
          refreshQueue();
          toast.success(`${action.type === "clock_in" ? "Entrada" : action.type === "clock_out" ? "Saída" : action.type === "break_start" ? "Início do intervalo" : "Retorno"} salva offline às ${hhmm(new Date())}.`);
          return;
        }
        setLabel("Registrando ponto...");
        await register.mutateAsync(payload);
      });
      if (isOnline()) {
        toast.success(`${action.type === "clock_in" ? "Entrada" : action.type === "clock_out" ? "Saída" : action.type === "break_start" ? "Início do intervalo" : "Retorno do intervalo"} registrada às ${hhmm(new Date())}.`);
        await Promise.all([utils.timeTracking.myHistory.invalidate(), utils.timeTracking.shiftStatus.invalidate()]);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Não foi possível registrar o ponto.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const loading = shift.isLoading || history.isLoading;
  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const status = closed
    ? { text: "Jornada encerrada", dot: "bg-slate-300", chip: "border-slate-400/30 bg-slate-400/10 text-slate-100" }
    : onBreak
      ? { text: "Em intervalo", dot: "bg-amber-300", chip: "border-amber-300/40 bg-amber-300/15 text-amber-100" }
      : lastType
        ? { text: "Jornada em andamento", dot: "bg-emerald-300", chip: "border-emerald-300/40 bg-emerald-300/15 text-emerald-100" }
        : { text: "Entrada não registrada", dot: "bg-sky-300", chip: "border-sky-300/40 bg-sky-300/15 text-sky-100" };

  return (
    <section aria-label="Ponto eletrônico" className="overflow-hidden rounded-3xl border border-teal-300/30 bg-gradient-to-br from-slate-800 via-slate-900 to-teal-950 shadow-xl shadow-black/30">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium capitalize text-slate-200">{dateLabel}</p>
            <p className="mt-1 flex items-baseline gap-1.5 font-black tabular-nums text-white">
              <span className="text-5xl sm:text-6xl">{hhmm(now)}</span>
              <span className="text-lg font-bold text-teal-300">{String(now.getSeconds()).padStart(2, "0")}</span>
            </p>
          </div>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${status.chip}`}>
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            {status.text}
          </span>
          {queue.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-1 text-xs font-bold text-amber-200">
              {queue.length} pendente{queue.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-5 flex h-16 items-center justify-center gap-2 rounded-2xl bg-white/5 text-sm text-slate-200">
            <Loader2 className="h-4 w-4 animate-spin" /> Consultando sua jornada...
          </div>
        ) : (shift.isError || history.isError) && isOnline() ? (
          <p role="alert" className="mt-5 rounded-2xl border border-rose-300/40 bg-rose-400/15 p-4 text-sm font-semibold text-rose-100">
            Não foi possível consultar sua jornada. Atualize a página e tente novamente.
          </p>
        ) : closed ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
            <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-300" />
            <div>
              <p className="text-base font-bold text-white">Bom descanso! Jornada encerrada às {hhmm(eventTime(last))}.</p>
              <p className="text-sm text-slate-200">Total trabalhado hoje: <strong className="text-white">{formatDuration(workedMs)}</strong></p>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={() => void punch(primary)}
              disabled={busy}
              className={`flex h-16 w-full items-center justify-center gap-3 rounded-2xl text-lg font-black shadow-lg shadow-black/25 transition active:scale-[0.98] disabled:cursor-wait disabled:opacity-80 ${primary.style}`}
            >
              {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <primary.icon className="h-6 w-6" />}
              {busy ? "Aguarde..." : primary.label}
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-slate-300">
              <MapPin className="h-3.5 w-3.5 text-teal-300" /> {primary.hint} · seu GPS será pedido ao tocar
            </p>
            {canFinish && (
              <button
                type="button"
                onClick={() => void punch(ACTIONS.clock_out)}
                disabled={busy}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/50 bg-rose-400/10 text-sm font-bold text-rose-100 transition hover:bg-rose-400/20 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" /> Encerrar jornada
              </button>
            )}
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-xl border border-rose-300/40 bg-rose-400/15 p-3 text-sm font-semibold text-rose-100">{error}</p>}

        <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Marcações de hoje">
          {STEPS.map((step) => {
            const ev = byType[step.type];
            const done = Boolean(ev);
            const isNext = !closed && !done && step.type === primary.type;
            return (
              <li key={step.type} className="text-center">
                <div className={`mx-auto grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-bold ${done ? "border-teal-300 bg-teal-300 text-slate-900" : isNext ? "border-teal-300 text-teal-200" : "border-slate-500 text-slate-400"}`}>
                  {done ? <CheckCircle2 className="h-5 w-5" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                </div>
                <p className={`mt-1.5 text-xs font-semibold ${done || isNext ? "text-white" : "text-slate-400"}`}>{step.label}</p>
                <p className={`text-sm font-bold tabular-nums ${done ? "text-teal-200" : "text-slate-500"}`}>{ev ? hhmm(eventTime(ev)) : "--:--"}</p>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-5 py-3 text-sm sm:px-6">
        <span className="text-slate-200">
          {lastType && !closed ? <>Trabalhado hoje: <strong className="text-white">{formatDuration(workedMs)}</strong></> : "Histórico, localização e correções"}
        </span>
        <Link href="/ponto" className="inline-flex items-center gap-1.5 font-bold text-teal-300 hover:text-teal-200">
          <CalendarDays className="h-4 w-4" /> Cartão ponto
        </Link>
      </div>
    </section>
  );
}
