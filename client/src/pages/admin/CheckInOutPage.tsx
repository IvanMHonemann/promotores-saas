import { useState } from "react";
import { MapPin, Clock, Camera, User, ImageOff } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";

const fmt = (iso: string | Date | null) => iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

function PhotoThumb({ photoId, label }: { photoId: number; label: string }) {
  const { data, isLoading } = trpc.storePhotos.getImageUrl.useQuery(
    { photoId },
    { staleTime: 50 * 60 * 1000, retry: 1 },
  );
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      {isLoading ? (
        <div className="flex h-28 w-28 items-center justify-center rounded-lg bg-slate-800 animate-pulse">
          <Camera className="h-6 w-6 text-slate-500" />
        </div>
      ) : data?.url ? (
        <a href={data.url} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={data.url}
            alt={label}
            className="h-28 w-28 rounded-lg object-cover ring-1 ring-white/10 hover:ring-teal-300/50 transition"
          />
        </a>
      ) : (
        <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg bg-slate-800 text-slate-500">
          <ImageOff className="h-5 w-5" />
          <span className="mt-1 text-[10px]">Indisponível</span>
        </div>
      )}
    </div>
  );
}

function VisitPhotos({ storeId, visitId, startTime, endTime }: { storeId: number; visitId: number; startTime?: string | Date | null; endTime?: string | Date | null }) {
  const day = startTime ? new Date(startTime).toISOString().slice(0, 10) : endTime ? new Date(endTime).toISOString().slice(0, 10) : undefined;
  const photos = trpc.storePhotos.listByStore.useQuery(
    { storeId, from: day, to: day },
    { enabled: Boolean(storeId && day), staleTime: 30000 },
  );

  const list = photos.data || [];
  const byVisit = list.filter((p) => p.visitId === visitId);
  const others = list.filter((p) => !p.visitId || p.visitId !== visitId);

  // Prefer photos linked to the visit; otherwise pick the closest in time to check-in / check-out.
  const pickClosest = (target: string | Date | null | undefined) => {
    if (!target || others.length === 0) return null;
    const t = new Date(target).getTime();
    let best = others[0];
    let bestDiff = Math.abs(new Date(best.capturedAt).getTime() - t);
    for (const p of others.slice(1)) {
      const d = Math.abs(new Date(p.capturedAt).getTime() - t);
      if (d < bestDiff) {
        best = p;
        bestDiff = d;
      }
    }
    // Only accept if within 15 minutes
    return bestDiff < 15 * 60 * 1000 ? best : null;
  };

  const checkinPhoto = byVisit.find((p) => startTime && Math.abs(new Date(p.capturedAt).getTime() - new Date(startTime).getTime()) < 15 * 60 * 1000) || pickClosest(startTime);
  const checkoutPhoto = byVisit.find((p) => endTime && Math.abs(new Date(p.capturedAt).getTime() - new Date(endTime).getTime()) < 15 * 60 * 1000) || pickClosest(endTime);

  if (photos.isLoading) return <p className="text-xs text-slate-400">Carregando fotos...</p>;
  if (!checkinPhoto && !checkoutPhoto) return <p className="text-xs text-slate-500">Nenhuma foto de fachada encontrada para esta visita.</p>;

  return (
    <div className="flex flex-wrap gap-4 pt-2">
      {checkinPhoto && <PhotoThumb photoId={checkinPhoto.id} label="Foto do check-in" />}
      {checkoutPhoto && checkoutPhoto.id !== checkinPhoto?.id && <PhotoThumb photoId={checkoutPhoto.id} label="Foto do check-out" />}
    </div>
  );
}

export default function CheckInOutPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const visits = trpc.operations.visits.list.useQuery({ date }, { staleTime: 30000 });
  const promoters = trpc.operations.promoters.list.useQuery(undefined, { staleTime: 60000 });
  const promoterName = (id: number) => promoters.data?.find((p) => p.id === id)?.userName || "Promotor";

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
                  <User className="h-4 w-4 text-teal-300" /> {promoterName(visit.promoterId)}
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

                <VisitPhotos
                  storeId={store.id}
                  visitId={visit.id}
                  startTime={visit.actualStart}
                  endTime={visit.actualEnd}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
