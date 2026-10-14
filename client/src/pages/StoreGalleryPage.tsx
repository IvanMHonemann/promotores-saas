import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Camera, MapPin } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoCapture } from "@/components/PhotoCapture";
import { trpc } from "@/lib/trpc";

function groupByDay(photos: Array<{ id: number; capturedAt: Date | string; promoterId: number; latitude: number | null }>) {
  const groups = new Map<string, typeof photos>();
  for (const photo of photos) {
    const day = new Date(photo.capturedAt).toLocaleDateString("pt-BR");
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(photo);
  }
  return Array.from(groups.entries());
}

function PhotoThumb({ photoId }: { photoId: number }) {
  const { data, isLoading } = trpc.storePhotos.getImageUrl.useQuery(
    { photoId },
    { staleTime: 50 * 60 * 1000, retry: 1 },
  );
  if (isLoading) return <div className="aspect-square animate-pulse bg-slate-800" />;
  if (!data?.url) return <div className="aspect-square bg-slate-900 flex items-center justify-center text-slate-500"><Camera className="h-8 w-8" /></div>;
  return <img src={data.url} alt="" className="aspect-square w-full object-cover" />;
}

export default function StoreGalleryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = Number(params.storeId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const stores = trpc.storePhotos.listStoresWithStats.useQuery(undefined, { staleTime: 30000 });
  const store = stores.data?.find((s) => s.id === storeId);

  const photos = trpc.storePhotos.listByStore.useQuery(
    {
      storeId,
      from: from || undefined,
      to: to || undefined,
    },
    { enabled: Number.isFinite(storeId) && storeId > 0, staleTime: 10000 },
  );

  const grouped = useMemo(() => groupByDay(photos.data || []), [photos.data]);

  return (
    <DashboardLayout
      title={store?.name || "Galeria da loja"}
      description={store ? `${store.city}${store.state ? ` · ${store.state}` : ""}` : "Carregando..."}
      onRefresh={() => void photos.refetch()}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/lojas">
            <Button variant="outline" className="border-white/15 text-slate-200">
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
          </Link>
          {store && (
            <PhotoCapture
              storeId={storeId}
              storeName={store.name}
              onCaptured={() => void photos.refetch()}
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-white"
          />
        </div>

        {photos.isLoading && <p className="text-sm text-slate-300">Carregando fotos...</p>}
        {photos.isError && (
          <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
            Não foi possível carregar a galeria.
          </p>
        )}

        {grouped.map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-teal-300">{day}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((photo) => (
                <Card key={photo.id} className="overflow-hidden border-white/10 bg-slate-950/40">
                  <PhotoThumb photoId={photo.id} />
                  <CardContent className="space-y-1 p-2">
                    <p className="text-xs text-slate-300">
                      {new Date(photo.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                    <div className="flex items-center gap-1">
                      {photo.latitude != null ? (
                        <Badge variant="outline" className="h-5 border-emerald-300/40 text-[10px] text-emerald-200">
                          <MapPin className="mr-0.5 h-3 w-3" /> GPS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 text-[10px] text-slate-400">
                          Sem GPS
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {!photos.isLoading && !photos.isError && (photos.data || []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300">
            Nenhuma foto registrada nesta loja no período.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
