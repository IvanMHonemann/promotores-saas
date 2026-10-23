import { useState } from "react";
import { MapPin, Clock, Camera, User } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const fmt = (iso: string | Date | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export default function CheckInOutPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const visits = trpc.operations.visits.list.useQuery({ date }, { staleTime: 30000 });

  return (
    <DashboardLayout title="Check-in / Check-out" description="Horários, localização e fotos das visitas dos promotores.">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-slate-200">Data</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100"
          />
        </div>

        {visits.isLoading && <p className="text-sm text-slate-300">Carregando visitas...</p>}
        {!visits.isLoading && !visits.data?.length && <p className="text-sm text-slate-300">Nenhuma visita nesta data.</p>}

        <div className="space-y-3">
          {visits.data?.map(({ visit, store }) => (
            <Card key={visit.id} className="border-white/10 bg-slate-900/50">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base text-white">
                  <span>{store.name}</span>
                  <Badge variant="outline" className="border-white/20">{visit.status}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="flex items-center gap-2 text-slate-300">
                  <User className="h-4 w-4 text-teal-300" /> "Promotor"
                </p>
                <p className="flex items-center gap-2 text-slate-300">
                  <MapPin className="h-4 w-4 text-teal-300" /> {store.address || store.city}{store.state ? ` — ${store.state}` : ""}
                </p>
                {visit.actualStart && (
                  <p className="flex items-center gap-2 text-emerald-300">
                    <Clock className="h-4 w-4" /> Check-in: {fmt(visit.actualStart)}
                    {visit.startLatitude && ` (${visit.startLatitude.toFixed(4)}, ${visit.startLongitude?.toFixed(4)})`}
                  </p>
                )}
                {visit.actualEnd && (
                  <p className="flex items-center gap-2 text-amber-300">
                    <Clock className="h-4 w-4" /> Check-out: {fmt(visit.actualEnd)}
                    {visit.endLatitude && ` (${visit.endLatitude.toFixed(4)}, ${visit.endLongitude?.toFixed(4)})`}
                  </p>
                )}
                {visit.notes && <p className="text-slate-400">{visit.notes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
