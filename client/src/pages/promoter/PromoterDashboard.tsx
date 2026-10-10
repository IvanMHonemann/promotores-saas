import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function currentPosition() {
  return new Promise<{ latitude?: number; longitude?: number; accuracy?: number }>((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}

export default function PromoterDashboard() {
  const [loading, setLoading] = useState(false);
  const utils = trpc.useUtils();
  const history = trpc.timeTracking.myHistory.useQuery({ limit: 20 });
  const visits = trpc.operations.visits.today.useQuery();
  const register = trpc.timeTracking.registerEvent.useMutation({
    onSuccess: () => { toast.success("Marcação registrada"); utils.timeTracking.myHistory.invalidate(); },
    onError: (err) => toast.error(err.message || "Erro ao registrar"),
  });
  const startVisit = trpc.operations.visits.start.useMutation({
    onSuccess: () => { toast.success("Visita iniciada"); utils.operations.visits.today.invalidate(); },
    onError: (err) => toast.error(err.message || "Não foi possível iniciar a visita"),
  });
  const completeVisit = trpc.operations.visits.complete.useMutation({
    onSuccess: () => { toast.success("Visita concluída"); utils.operations.visits.today.invalidate(); },
    onError: (err) => toast.error(err.message || "Não foi possível concluir a visita"),
  });

  const handlePunch = async (eventType: "clock_in" | "break_start" | "break_end" | "clock_out") => {
    setLoading(true);
    try {
      const position = await currentPosition();
      await register.mutateAsync({
        eventType,
        deviceTime: new Date().toISOString(),
        ...position,
        locationStatus: position.latitude === undefined ? "unavailable" : "success",
        deviceInfo: navigator.userAgent,
        idempotencyKey: `${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
    } finally { setLoading(false); }
  };

  const actOnVisit = async (id: number, action: "start" | "complete") => {
    const position = await currentPosition();
    if (action === "start") await startVisit.mutateAsync({ id, ...position });
    else await completeVisit.mutateAsync({ id, ...position });
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-5">
        <header><p className="text-sm font-semibold text-red-600">Operação de campo</p><h1 className="text-2xl font-black">Meu dia</h1><p className="text-sm text-slate-500">Controle seu ponto e acompanhe o roteiro de hoje.</p></header>
        <Card><CardHeader><CardTitle>Meu ponto</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 gap-3"><Button onClick={() => handlePunch("clock_in")} disabled={loading}>Entrada</Button><Button onClick={() => handlePunch("break_start")} disabled={loading} variant="outline">Início intervalo</Button><Button onClick={() => handlePunch("break_end")} disabled={loading} variant="outline">Fim intervalo</Button><Button onClick={() => handlePunch("clock_out")} disabled={loading}>Saída</Button></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Roteiro de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{visits.isLoading && <p className="text-sm text-slate-500">Carregando visitas...</p>}{!visits.isLoading && !visits.data?.length && <p className="text-sm text-slate-500">Nenhuma visita planejada para hoje.</p>}{visits.data?.map(({ visit, store }) => <div key={visit.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{store.name}</p><p className="text-sm text-slate-500">{store.address || store.city}{store.state ? ` — ${store.state}` : ""}</p></div><Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge></div>{visit.status === "pending" && <Button className="mt-3 w-full" onClick={() => actOnVisit(visit.id, "start")}>Iniciar visita</Button>}{visit.status === "in_progress" && <Button className="mt-3 w-full" onClick={() => actOnVisit(visit.id, "complete")}>Concluir visita</Button>}</div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle>Últimas marcações</CardTitle></CardHeader><CardContent>{history.isLoading && <p>Carregando...</p>}{history.data?.length === 0 && <p className="text-sm text-slate-500">Nenhuma marcação ainda.</p>}<ul className="space-y-2 text-sm">{history.data?.map((ev: any) => <li key={ev.id} className="flex justify-between border-b pb-1"><span>{ev.eventType}</span><span>{new Date(ev.serverTime).toLocaleString("pt-BR")}</span></li>)}</ul></CardContent></Card>
      </div>
    </main>
  );
}
