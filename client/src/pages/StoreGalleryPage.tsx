import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Camera, MapPin, Share2, Trash2, FileText, CheckSquare } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoCapture } from "@/components/PhotoCapture";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { jsPDF } from "jspdf";

function groupByDay(photos: Array<{ id: number; capturedAt: Date | string; promoterId: number; latitude: number | null }>) {
  const groups = new Map<string, typeof photos>();
  for (const photo of photos) {
    const day = new Date(photo.capturedAt).toLocaleDateString("pt-BR");
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(photo);
  }
  return Array.from(groups.entries());
}

function PhotoThumb({ photoId, selected, onToggle }: { photoId: number; selected: boolean; onToggle: () => void }) {
  const { data, isLoading } = trpc.storePhotos.getImageUrl.useQuery(
    { photoId },
    { staleTime: 50 * 60 * 1000, retry: 1 },
  );
  return (
    <div className="relative cursor-pointer" onClick={onToggle}>
      {isLoading && <div className="aspect-square animate-pulse bg-slate-800" />}
      {!isLoading && !data?.url && (
        <div className="aspect-square bg-slate-900 flex items-center justify-center text-slate-500">
          <Camera className="h-8 w-8" />
        </div>
      )}
      {data?.url && <img src={data.url} alt="" className="aspect-square w-full object-cover" />}
      {selected && (
        <div className="absolute inset-0 bg-teal-500/30 flex items-center justify-center">
          <CheckSquare className="h-8 w-8 text-white drop-shadow" />
        </div>
      )}
    </div>
  );
}

export default function StoreGalleryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = Number(params.storeId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const stores = trpc.storePhotos.listStoresWithStats.useQuery(undefined, { staleTime: 30000 });
  const store = stores.data?.find((s) => s.id === storeId);

  const today = new Date().toISOString().slice(0, 10);
  const visits = trpc.operations.visits.list.useQuery({ date: today }, { staleTime: 15000 });
  const activeVisit = visits.data?.find((v: any) => v.visit?.status === "in_progress" && v.store?.id === storeId);

  const photos = trpc.storePhotos.listByStore.useQuery(
    { storeId, from: from || undefined, to: to || undefined },
    { enabled: Number.isFinite(storeId) && storeId > 0, staleTime: 10000 },
  );

  const utils = trpc.useUtils();
  const bulkDelete = trpc.storePhotos.bulkDelete.useMutation({
    onSuccess: (res) => {
      toast.success(`${res.deleted} foto(s) excluída(s).`);
      setSelected(new Set());
      void photos.refetch();
    },
    onError: () => toast.error("Não foi possível excluir as fotos."),
  });

  const grouped = useMemo(() => groupByDay(photos.data || []), [photos.data]);
  const allPhotos = photos.data || [];

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectToday = () => {
    const today = new Date().toLocaleDateString("pt-BR");
    const ids = allPhotos.filter((p) => new Date(p.capturedAt).toLocaleDateString("pt-BR") === today).map((p) => p.id);
    setSelected(new Set(ids));
    setSelectMode(true);
  };

  const selectPeriod = () => {
    setSelected(new Set(allPhotos.map((p) => p.id)));
    setSelectMode(true);
  };

  const shareSelected = async () => {
    if (selected.size === 0) return toast.info("Selecione ao menos uma foto.");
    const ids = Array.from(selected);
    // Busca URLs e tenta Web Share API com arquivos
    const urls: string[] = [];
    for (const id of ids.slice(0, 10)) {
      try {
        const res = await utils.storePhotos.getImageUrl.fetch({ photoId: id });
        if (res?.url) urls.push(res.url);
      } catch { /* ignore */ }
    }
    if (urls.length === 0) return toast.error("Não foi possível obter as imagens para compartilhar.");

    if (navigator.share && navigator.canShare) {
      try {
        const files: File[] = [];
        for (const url of urls) {
          const blob = await fetch(url).then((r) => r.blob());
          files.push(new File([blob], `foto-${Date.now()}.jpg`, { type: "image/jpeg" }));
        }
        if (navigator.canShare({ files })) {
          await navigator.share({ files, title: `Fotos - ${store?.name || "Loja"}` });
          toast.success("Compartilhamento iniciado.");
          return;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    // Fallback: abre a primeira ou orienta download
    toast.info("Seu navegador não permite compartilhar vários arquivos de uma vez. Baixando a primeira.");
    const a = document.createElement("a");
    a.href = urls[0];
    a.download = `foto-${store?.name || "loja"}.jpg`;
    a.click();
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} foto(s)? Esta ação pode ser definitiva.`)) return;
    bulkDelete.mutate({ photoIds: Array.from(selected) });
  };

  const generateReport = async () => {
    if (allPhotos.length === 0) return toast.info("Nenhuma foto no período para o relatório.");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    doc.setFontSize(16);
    doc.text(`Relatório fotográfico - ${store?.name || "Loja"}`, 14, 18);
    doc.setFontSize(10);
    doc.text(`${store?.city || ""}${store?.state ? " · " + store.state : ""}`, 14, 26);
    doc.text(`Período: ${from || "início"} a ${to || "hoje"} · ${allPhotos.length} foto(s)`, 14, 32);

    let y = 42;
    for (const photo of allPhotos.slice(0, 12)) {
      try {
        const res = await utils.storePhotos.getImageUrl.fetch({ photoId: photo.id });
        if (res?.url) {
          const blob = await fetch(res.url).then((r) => r.blob());
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          if (y > 250) { doc.addPage(); y = 18; }
          doc.addImage(dataUrl, "JPEG", 14, y, 80, 60);
          doc.setFontSize(8);
          doc.text(
            `${new Date(photo.capturedAt).toLocaleString("pt-BR")} ${photo.latitude ? "· GPS" : ""}`,
            100,
            y + 10,
          );
          y += 70;
        }
      } catch { /* skip image */ }
    }
    doc.save(`relatorio-${store?.name || "loja"}.pdf`);
    toast.success("Relatório gerado.");
  };

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
            <PhotoCapture storeId={storeId} storeName={store.name} visitId={activeVisit?.visit?.id} onCaptured={() => void photos.refetch()} />
          )}
          {activeVisit && (
            <Badge variant="outline" className="border-emerald-300/40 text-emerald-200">
              Vinculada à visita em andamento
            </Badge>
          )}
          <Button variant="outline" className="border-white/15" onClick={() => setSelectMode((v) => !v)}>
            <CheckSquare className="mr-1 h-4 w-4" /> {selectMode ? "Cancelar seleção" : "Selecionar"}
          </Button>
        </div>

        {selectMode && (
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <Button size="sm" variant="outline" className="border-white/15" onClick={selectToday}>Hoje</Button>
            <Button size="sm" variant="outline" className="border-white/15" onClick={selectPeriod}>Todo o período</Button>
            <Button size="sm" variant="outline" className="border-white/15" onClick={() => setSelected(new Set())}>Limpar</Button>
            <span className="self-center text-xs text-slate-400">{selected.size} selecionada(s)</span>
            <Button size="sm" className="bg-teal-500 text-slate-950" onClick={shareSelected} disabled={selected.size === 0}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Compartilhar
            </Button>
            <Button size="sm" variant="outline" className="border-rose-300/40 text-rose-200" onClick={deleteSelected} disabled={selected.size === 0 || bulkDelete.isPending}>
              <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
          <p className="mb-3 text-sm font-semibold text-white">Filtrar fotos por período</p>
          <p className="mb-3 text-xs text-slate-400">Escolha uma data inicial e uma data final para ver só as fotos desse intervalo. Deixe em branco para ver todas.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-xs text-slate-300">
              De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            <label className="block text-xs text-slate-300">
              Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white" />
            </label>
            <Button size="sm" variant="outline" className="border-white/15 text-slate-200" onClick={() => { setFrom(""); setTo(""); }}>
              Limpar filtro
            </Button>
            <Button size="sm" variant="outline" className="border-white/15 text-slate-200" onClick={generateReport}>
              <FileText className="mr-1 h-4 w-4" /> Gerar relatório
            </Button>
          </div>
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
                  <PhotoThumb
                    photoId={photo.id}
                    selected={selected.has(photo.id)}
                    onToggle={() => selectMode && toggle(photo.id)}
                  />
                  <CardContent className="space-y-1 p-2">
                    <p className="text-xs text-slate-300">
                      {new Date(photo.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      {(photo as any).promoterName ? ` · ${(photo as any).promoterName}` : ""}
                    </p>
                    <div className="flex items-center gap-1">
                      {photo.latitude != null ? (
                        <Badge variant="outline" className="h-5 border-emerald-300/40 text-[10px] text-emerald-200">
                          <MapPin className="mr-0.5 h-3 w-3" /> GPS
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="h-5 text-[10px] text-slate-400">Sem GPS</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {!photos.isLoading && !photos.isError && allPhotos.length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300">
            Nenhuma foto registrada nesta loja no período.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
