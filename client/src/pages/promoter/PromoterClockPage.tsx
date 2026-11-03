import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Plus, Send, ShieldCheck, X, Camera } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { LocationLabel } from "./geolocation";
import { localDayKey } from "@/components/PunchPanel";

type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";
type JustificationType = "normal" | "holiday" | "day_off" | "medical_certificate" | "other";

const labels: Record<EventType, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};

const justificationLabels: Record<JustificationType, string> = {
  normal: "Correção / inclusão normal",
  holiday: "Feriado",
  day_off: "Folga",
  medical_certificate: "Atestado médico",
  other: "Outro",
};

const order: EventType[] = ["clock_in", "break_start", "break_end", "clock_out"];


/** Comprime a imagem no cliente (máx. 1280px, qualidade 0.72) para armazenamento leve. */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 1280;
      let { width, height } = img;
      if (width > max || height > max) {
        const ratio = Math.min(max / width, max / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("canvas")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("image")); };
    img.src = url;
  });
}


export default function PromoterClockPage() {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = localDayKey(new Date(), timeZone);
  const [selectedDate, setSelectedDate] = useState(today);
  const [mode, setMode] = useState<"add" | "correct">("add");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [correctTime, setCorrectTime] = useState("");
  const [justification, setJustification] = useState("");
  const [justificationType, setJustificationType] = useState<JustificationType>("normal");
  const [missingTimes, setMissingTimes] = useState<Partial<Record<EventType, string>>>({});
  const [hideMissingAlert, setHideMissingAlert] = useState(false);
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const history = trpc.timeTracking.myHistory.useQuery({ limit: 100, date: selectedDate });
  const missingPunch = trpc.timeTracking.myMissingPunch.useQuery(undefined, { staleTime: 60000 });
  const corrections = trpc.timeTracking.myCorrections.useQuery();

  const events = history.data ?? [];
  const typesPresent = new Set(events.map((e) => e.eventType as EventType));

  const missingList = useMemo(() => {
    const result = new Set<EventType>();
    for (const type of order) {
      if (!typesPresent.has(type)) result.add(type);
    }
    const starts = events.filter((e) => e.eventType === "break_start").length;
    const ends = events.filter((e) => e.eventType === "break_end").length;
    if (starts > ends) result.add("break_end");
    return [...result].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }, [events, typesPresent]);

  const correction = trpc.timeTracking.requestCorrection.useMutation({
    onSuccess: () => {
      toast.success("Pedido enviado ao administrador");
      setSelectedEventId("");
      setCorrectTime("");
      setJustification("");
      setMissingTimes({});
      setPhotoBase64(null);
      setJustificationType("normal");
      void utils.timeTracking.myCorrections.invalidate();
      void utils.timeTracking.myHistory.invalidate();
    },
    onError: (error) => toast.error(error.message || "Não foi possível enviar o pedido"),
  });

  const handlePhoto = async (file: File | null) => {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setPhotoBase64(compressed);
    } catch {
      toast.error("Não foi possível processar a foto");
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const reason = justification.trim();
    if (reason.length < 5 && justificationType === "normal") {
      toast.error("Escreva pelo menos 5 caracteres na justificativa");
      return;
    }
    const toSend = missingList.filter((t) => missingTimes[t]);
    if (!toSend.length && justificationType === "normal") {
      toast.error("Informe o horário de pelo menos uma batida faltante");
      return;
    }
    // Para abonos (feriado/folga/atestado) pode não ter horário específico
    const typesToSend = toSend.length ? toSend : ["clock_in" as EventType];
    for (const type of typesToSend) {
      const time = missingTimes[type] || "08:00";
      await correction.mutateAsync({
        timeEventId: null,
        requestedType: type,
        requestedTime: new Date(`${selectedDate}T${time}:00`).toISOString(),
        justification: reason || justificationLabels[justificationType],
        justificationType,
        attachmentBase64: photoBase64 || undefined,
      } as any);
    }
    toast.success(`${typesToSend.length} pedido(s) enviado(s)`);
  };

  const submitCorrect = (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(selectedEventId);
    if (!eventId || !correctTime || (justification.trim().length < 5 && justificationType === "normal")) return;
    const original = events.find((item) => item.id === eventId);
    if (!original) return;
    correction.mutate({
      timeEventId: eventId,
      requestedType: original.eventType as EventType,
      requestedTime: new Date(`${selectedDate}T${correctTime}:00`).toISOString(),
      justification: justification.trim() || justificationLabels[justificationType],
      justificationType,
      attachmentBase64: photoBase64 || undefined,
    } as any);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) setSelectedDate(date);
    const sectionId = decodeURIComponent(window.location.hash.slice(1));
    if (!sectionId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const canSubmitAdd = (missingList.some((t) => missingTimes[t]) || justificationType !== "normal") && (justification.trim().length >= 5 || justificationType !== "normal") && !correction.isPending;

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
                    setMissingTimes({});
                  }}
                  className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100"
                />
              </div>
              {missingPunch.data && !hideMissingAlert && (
                <div className="relative mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 pr-14">
                  <p className="font-bold text-amber-100">Batida faltante detectada</p>
                  <p className="mt-1 text-sm text-amber-200">
                    Última marcação: {missingPunch.data.lastLabel} em {new Date(missingPunch.data.lastTime).toLocaleString("pt-BR")}.
                    Falta registrar: {missingPunch.data.missing}.
                  </p>
                  <button type="button" onClick={() => {
                    const day = (missingPunch.data as any)?.day;
                    if (day) setSelectedDate(day);
                    document.getElementById("correcoes")?.scrollIntoView({ behavior: "smooth" });
                  }} className="mt-2 inline-block text-sm font-semibold text-amber-300 underline">Corrigir agora</button>
                  <button type="button" onClick={() => setHideMissingAlert(true)} aria-label="Fechar alerta" className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-amber-200/40 bg-amber-400/20 text-amber-50 transition hover:bg-amber-400/40">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <div className="mt-4 space-y-3">
                {history.isLoading && <p className="text-sm text-slate-300">Carregando marcações...</p>}
                {!history.isLoading && !events.length && <p className="rounded-xl border border-dashed border-white/15 p-5 text-sm text-slate-300">Nenhuma marcação neste dia.</p>}
                {events.map((event) => (
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
              <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button type="button" variant={mode === "add" ? "default" : "outline"} size="sm" className="w-full" onClick={() => setMode("add")}>
                  <Plus className="mr-1 h-4 w-4" /> Incluir batidas esquecidas
                </Button>
                <Button type="button" variant={mode === "correct" ? "default" : "outline"} size="sm" className="w-full" onClick={() => setMode("correct")}>
                  Corrigir batida existente
                </Button>
              </div>

              <label className="mb-3 block text-sm font-semibold text-slate-200">
                Tipo de justificativa
                <select value={justificationType} onChange={(e) => setJustificationType(e.target.value as JustificationType)} className="mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100">
                  {Object.entries(justificationLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>

              {mode === "add" ? (
                <form onSubmit={submitAdd} className="space-y-4">
                  {missingList.length === 0 && justificationType === "normal" ? (
                    <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-300">Nenhuma batida faltante detectada neste dia.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-200">Batidas faltantes detectadas — informe o horário de cada uma:</p>
                      {missingList.map((type) => (
                        <div key={type} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-center">
                          <span className="min-w-0 flex-1 text-sm font-semibold text-slate-100">{labels[type]}</span>
                          <input type="time" value={missingTimes[type] || ""} onChange={(e) => setMissingTimes((prev) => ({ ...prev, [type]: e.target.value }))} className="h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100 sm:w-36" />
                        </div>
                      ))}
                    </div>
                  )}

                  <textarea required={justificationType === "normal"} minLength={justificationType === "normal" ? 5 : 0} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder={justificationType === "medical_certificate" ? "Detalhes do atestado (opcional se houver foto)" : "Justificativa (mínimo 5 caracteres)"} className="min-h-20 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-400" />

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-200">Comprovante / foto (opcional)</p>
                    <div className="flex gap-2">
                      <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100 hover:bg-slate-900">
                        <Camera className="h-4 w-4" /> Tirar ou escolher foto
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} />
                      </label>
                      {photoBase64 && <span className="self-center text-xs text-emerald-300">Foto anexada</span>}
                    </div>
                  </div>

                  <Button type="submit" disabled={!canSubmitAdd} className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200 disabled:bg-slate-700 disabled:text-slate-400">
                    <Send className="mr-2 h-4 w-4" /> {correction.isPending ? "Enviando..." : "Enviar pedido de inclusão"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={submitCorrect} className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {events.map((event) => (
                      <Button key={event.id} type="button" variant={selectedEventId === String(event.id) ? "default" : "outline"} size="sm" onClick={() => setSelectedEventId(String(event.id))}>
                        {labels[event.eventType as EventType]} · {new Date(event.deviceTime || event.serverTime).toLocaleTimeString("pt-BR")}
                      </Button>
                    ))}
                  </div>
                  <label className="block space-y-2 text-sm font-semibold text-slate-200">
                    Horário correto
                    <input required type="time" value={correctTime} onChange={(e) => setCorrectTime(e.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 font-normal text-slate-100" />
                  </label>
                  <textarea required={justificationType === "normal"} minLength={justificationType === "normal" ? 5 : 0} value={justification} onChange={(e) => setJustification(e.target.value)} placeholder="Motivo da correção" className="min-h-20 w-full rounded-xl border border-white/15 bg-slate-950/60 p-3 text-sm text-slate-100 placeholder:text-slate-400" />

                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-200">Comprovante / foto (opcional)</p>
                    <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100 hover:bg-slate-900">
                      <Camera className="h-4 w-4" /> Tirar ou escolher foto
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0] || null)} />
                    </label>
                    {photoBase64 && <p className="text-xs text-emerald-300">Foto anexada</p>}
                  </div>

                  <Button type="submit" disabled={correction.isPending || !selectedEventId || !correctTime || (justification.trim().length < 5 && justificationType === "normal")} className="w-full bg-teal-300 text-slate-950 hover:bg-teal-200 disabled:bg-slate-700 disabled:text-slate-400">
                    <Send className="mr-2 h-4 w-4" /> {correction.isPending ? "Enviando..." : "Enviar pedido de correção"}
                  </Button>
                </form>
              )}

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
