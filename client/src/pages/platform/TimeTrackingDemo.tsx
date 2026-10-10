import { useMemo, useState } from "react";
import { Clock3, LocateFixed, MapPin, Navigation, RotateCcw, Send, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type EventType = "clock_in" | "break_start" | "break_end" | "clock_out";
type Gps = { latitude: number; longitude: number; accuracy: number };
type Punch = { type: EventType; at: Date; gps: Gps };
const labels: Record<EventType, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Fim do intervalo", clock_out: "Saída" };
const next: Record<EventType | "none", EventType[]> = { none: ["clock_in"], clock_in: ["break_start", "clock_out"], break_start: ["break_end"], break_end: ["break_start", "clock_out"], clock_out: ["clock_in"] };

function readGps(): Promise<Gps> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Este navegador não oferece geolocalização."));
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      (error) => reject(new Error(error.code === 1 ? "Permissão de localização negada. Autorize o GPS nas configurações do navegador." : error.code === 3 ? "O GPS demorou para responder. Tente novamente em um local aberto." : "Não foi possível obter sua localização.")),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export default function TimeTrackingDemo() {
  const [events, setEvents] = useState<Punch[]>([]);
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [justification, setJustification] = useState("");
  const last = events[0]?.type ?? "none";
  const available = next[last];
  const status = last === "clock_in" || last === "break_end" ? "Em jornada" : last === "break_start" ? "Em intervalo" : last === "clock_out" ? "Jornada encerrada" : "Aguardando entrada";
  const gpsLabel = gps ? `${gps.latitude.toFixed(6)}, ${gps.longitude.toFixed(6)}` : "Localização ainda não autorizada";
  const punch = async (type: EventType) => {
    setGpsLoading(true);
    try {
      const current = await readGps();
      setGps(current);
      setEvents((existing) => [{ type, at: new Date(), gps: current }, ...existing]);
      toast.success(`${labels[type]} registrada com GPS real`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível obter o GPS"); }
    finally { setGpsLoading(false); }
  };
  const locate = async () => { setGpsLoading(true); try { const current = await readGps(); setGps(current); toast.success("GPS localizado com sucesso"); } catch (error) { toast.error(error instanceof Error ? error.message : "GPS indisponível"); } finally { setGpsLoading(false); } };
  const reset = () => { setEvents([]); setJustification(""); toast.info("Demonstração reiniciada"); };
  const mapUrl = gps ? `https://www.google.com/maps?q=${gps.latitude},${gps.longitude}` : "#";
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[.16em] text-teal-300">Módulo operacional</p><h2 className="text-3xl font-black">Ponto eletrônico</h2><p className="mt-1 text-slate-400">Teste o fluxo completo usando a localização real do seu celular.</p></div><Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-200">GPS real · demonstração</Badge></div><Card className="border-teal-300/20 bg-gradient-to-br from-teal-300/10 to-slate-900"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${gps ? "bg-teal-300 text-slate-950" : "bg-white/10 text-slate-300"}`}><Navigation className="h-5 w-5" /></div><div><p className="font-bold">Localização do dispositivo</p><p className="mt-1 text-sm text-slate-400">{gps ? `Precisão aproximada: ${Math.round(gps.accuracy)} m` : "Obrigatória para registrar uma marcação"}</p>{gps && <p className="mt-1 break-all font-mono text-xs text-teal-200">{gpsLabel}</p>}</div></div><div className="flex flex-wrap gap-2"><Button onClick={() => void locate()} disabled={gpsLoading} className="bg-teal-400 text-slate-950 hover:bg-teal-300"><LocateFixed className="mr-2 h-4 w-4" />{gpsLoading ? "Localizando..." : gps ? "Atualizar GPS" : "Ativar GPS"}</Button>{gps && <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10"><a href={mapUrl} target="_blank" rel="noreferrer"><MapPin className="mr-2 h-4 w-4" />Abrir mapa</a></Button>}</div></CardContent></Card><div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]"><Card className="border-slate-800 bg-slate-900"><CardHeader><div className="flex items-center justify-between"><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-teal-300" /> Jornada de hoje</CardTitle><Button variant="ghost" size="sm" className="text-slate-400 hover:text-white" onClick={reset}><RotateCcw className="mr-1 h-4 w-4" /> Reiniciar</Button></div></CardHeader><CardContent><div className="rounded-2xl border border-white/10 bg-white/[.03] p-5"><p className="text-sm text-slate-400">Status atual</p><p className="mt-1 text-2xl font-black text-teal-300">{status}</p><p className="mt-2 text-sm text-slate-400">Cada ação solicita uma nova posição de alta precisão.</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{(["clock_in", "break_start", "break_end", "clock_out"] as EventType[]).map((type) => <Button key={type} disabled={!available.includes(type) || gpsLoading} onClick={() => void punch(type)} variant={available.includes(type) ? "default" : "outline"} className={available.includes(type) ? "bg-teal-400 text-slate-950 hover:bg-teal-300" : "border-slate-700 text-slate-500"}>{labels[type]}</Button>)}</div><div className="mt-5 flex items-start gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4 text-sm text-slate-300"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-teal-300" /><span>Em produção, a marcação também registra horário do servidor, horário do dispositivo, precisão, dispositivo e chave de idempotência.</span></div></CardContent></Card><Card className="border-slate-800 bg-slate-900"><CardHeader><CardTitle>Histórico de marcações</CardTitle></CardHeader><CardContent>{!events.length ? <p className="text-sm text-slate-400">Ative o GPS e use Entrada para iniciar o fluxo.</p> : <div className="space-y-3">{events.map((event, index) => <div key={`${event.type}-${index}`} className="rounded-xl border border-slate-800 p-3"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{labels[event.type]}</p><span className="text-sm text-slate-400">{event.at.toLocaleTimeString("pt-BR")}</span></div><p className="mt-1 font-mono text-xs text-teal-200">{event.gps.latitude.toFixed(6)}, {event.gps.longitude.toFixed(6)} · ±{Math.round(event.gps.accuracy)}m</p></div>)}</div>}<div className="mt-6 border-t border-slate-800 pt-5"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-teal-300" /> Solicitar correção</p><textarea value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Descreva a justificativa (mínimo de 10 caracteres)" className="mt-3 min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white outline-none focus:border-teal-300" /><Button className="mt-3 w-full bg-white/10 text-white hover:bg-white/20" disabled={justification.trim().length < 10} onClick={() => { toast.success("Solicitação de correção enviada para análise"); setJustification(""); }}><Send className="mr-2 h-4 w-4" /> Enviar solicitação</Button></div></CardContent></Card></div></div>;
}
