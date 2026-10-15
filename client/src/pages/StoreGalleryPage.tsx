import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Camera, MapPin, Share2, Trash2, FileText, CheckSquare, X, Pencil, MessageCircle, Download, Calendar } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PhotoCapture } from "@/components/PhotoCapture";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { jsPDF } from "jspdf";


async function shareImage(url: string, name: string) {
  try {
    const blob = await fetch(url).then((r) => r.blob());
    const file = new File([blob], `foto-${name || "loja"}.jpg`, { type: blob.type || "image/jpeg" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Foto - ${name}` });
      return;
    }
  } catch (e: any) {
    if (e?.name === "AbortError") return;
  }
  // Fallback: baixa a imagem
  const a = document.createElement("a");
  a.href = url;
  a.download = `foto-${name || "loja"}.jpg`;
  a.click();
}

function groupByDay(photos: Array<{ id: number; capturedAt: Date | string; promoterId: number; latitude: number | null }>) {
  const groups = new Map<string, typeof photos>();
  for (const photo of photos) {
    const day = new Date(photo.capturedAt).toLocaleDateString("pt-BR");
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(photo);
  }
  return Array.from(groups.entries());
}

function PhotoThumb({ photoId, selected, selectMode, hasGps, time, onToggle, onExpand }: { photoId: number; selected: boolean; selectMode: boolean; hasGps: boolean; time: string; onToggle: () => void; onExpand: (url: string) => void }) {
  const { data, isLoading } = trpc.storePhotos.getImageUrl.useQuery(
    { photoId },
    { staleTime: 50 * 60 * 1000, retry: 1 },
  );
  return (
    <div className="relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-slate-800" onClick={() => data?.url && onExpand(data.url)}>
      {isLoading && <div className="absolute inset-0 animate-pulse bg-slate-800" />}
      {!isLoading && !data?.url && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500">
          <Camera className="h-8 w-8 text-white/40" />
        </div>
      )}
      {data?.url && <img src={data.url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {hasGps && (
        <div className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white shadow">
          <MapPin className="h-3.5 w-3.5" />
        </div>
      )}
      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{time}</span>
      {selectMode && (
        <button
          type="button"
          className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 shadow ${selected ? "border-white bg-blue-500 text-white" : "border-white/80 bg-black/40 text-white"}`}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          aria-label={selected ? "Desmarcar" : "Selecionar"}
        >
          {selected && <CheckSquare className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}


function WhatsAppButton({ photoId, storeName }: { photoId: number; storeName?: string }) {
  const { data } = trpc.storePhotos.getImageUrl.useQuery({ photoId }, { staleTime: 50 * 60 * 1000, retry: 1 });
  return (
    <Button size="sm" variant="ghost" className="h-7 px-2" title="WhatsApp" onClick={() => data?.url && shareImage(data.url, storeName || "loja")}>
      <MessageCircle className="h-3.5 w-3.5 text-emerald-300" />
    </Button>
  );
}

export default function StoreGalleryPage() {
  const params = useParams<{ storeId: string }>();
  const storeId = Number(params.storeId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [lightbox, setLightbox] = useState<{ id: number; url: string } | null>(null);

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
  const singleDelete = trpc.storePhotos.delete.useMutation({
    onSuccess: () => {
      toast.success("Foto excluída.");
      void photos.refetch();
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

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
        <Link href="/lojas" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Voltar para Lojas
        </Link>

        <div>
          <h2 className="text-2xl font-black text-white">Fotos da loja</h2>
          <p className="mt-1 text-sm text-slate-400">
            {store?.name || "Loja"} · Registre fotos e gere o relatório da visita.
          </p>
          {activeVisit && (
            <Badge variant="outline" className="mt-2 border-emerald-300/40 text-emerald-200">Visita em andamento</Badge>
          )}
        </div>

        {store && (
          <PhotoCapture storeId={storeId} storeName={store.name} visitId={activeVisit?.visit?.id} onCaptured={() => void photos.refetch()} />
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 border-white/15 text-slate-200" onClick={() => setSelectMode((v) => !v)}>
            <CheckSquare className="mr-1.5 h-4 w-4" /> {selectMode ? "Cancelar" : "Selecionar"}
          </Button>
          <Button variant="outline" className="h-11 border-white/15 text-slate-200" onClick={generateReport}>
            <FileText className="mr-1.5 h-4 w-4" /> Relatório
          </Button>
        </div>

        {selectMode && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-3">
            <Button size="sm" variant="outline" className="border-white/15 text-slate-200" onClick={selectToday}>Hoje</Button>
            <Button size="sm" variant="outline" className="border-white/15 text-slate-200" onClick={selectPeriod}>Todas</Button>
            <Button size="sm" variant="outline" className="border-white/15 text-slate-200" onClick={() => setSelected(new Set())}>Limpar</Button>
            <span className="text-xs text-slate-400">{selected.size} selecionada(s)</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" className="bg-teal-400 text-slate-950" onClick={shareSelected} disabled={selected.size === 0}>
                <Share2 className="mr-1 h-3.5 w-3.5" /> Compartilhar
              </Button>
              <Button size="sm" variant="outline" className="border-rose-300/40 text-rose-200" onClick={deleteSelected} disabled={selected.size === 0 || bulkDelete.isPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-white">Período das fotos</p>
          <p className="mt-1 text-xs text-slate-400">Escolha as datas ou deixe em branco para ver todas.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { id: "all", label: "Todas" },
              { id: "today", label: "Hoje" },
              { id: "7d", label: "7 dias" },
              { id: "30d", label: "30 dias" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  const now = new Date();
                  const iso = (d: Date) => d.toISOString().slice(0, 10);
                  if (opt.id === "all") { setFrom(""); setTo(""); }
                  else if (opt.id === "today") { setFrom(iso(now)); setTo(iso(now)); }
                  else if (opt.id === "7d") { const d = new Date(now); d.setDate(d.getDate() - 6); setFrom(iso(d)); setTo(iso(now)); }
                  else if (opt.id === "30d") { const d = new Date(now); d.setDate(d.getDate() - 29); setFrom(iso(d)); setTo(iso(now)); }
                }}
                className="rounded-full border border-white/15 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-teal-300/40 hover:text-white"
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-xs font-medium text-slate-300">
              De
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
            <label className="block text-xs font-medium text-slate-300">
              Até
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950 px-3 py-2.5 text-sm text-white [color-scheme:dark]" />
            </label>
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
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">{day}</h2>
              <span className="text-xs text-slate-400">{items.length} foto{items.length !== 1 ? "s" : ""}{(items[0] as any).promoterName ? ` · ${(items[0] as any).promoterName}` : ""}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {items.map((photo) => (
                <PhotoThumb
                  key={photo.id}
                  photoId={photo.id}
                  selected={selected.has(photo.id)}
                  selectMode={selectMode}
                  hasGps={photo.latitude != null}
                  time={new Date(photo.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  onToggle={() => toggle(photo.id)}
                  onExpand={(url) => setLightbox({ id: photo.id, url })}
                />
              ))}
            </div>
          </section>
        ))}

        {!photos.isLoading && !photos.isError && allPhotos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-300/10 text-teal-300">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-semibold text-white">Nenhuma foto neste período</p>
            <p className="mt-1 text-sm text-slate-400">
              Toque em <span className="font-semibold text-teal-300">Tirar foto</span> para registrar a primeira, ou mude o período acima.
            </p>
          </div>
        )}
      </div>

      {lightbox && (() => {
        const photo = allPhotos.find((p) => p.id === lightbox.id);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-3 sm:items-center" onClick={() => setLightbox(null)}>
            <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs text-slate-400">Ao tocar em uma foto</p>
                <button className="text-white" onClick={() => setLightbox(null)}><X className="h-5 w-5" /></button>
              </div>
              <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-800">
                <img src={lightbox.url} alt="" className="h-full w-full object-cover" />
                {photo?.latitude != null && (
                  <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-white">
                    <MapPin className="h-4 w-4" />
                  </div>
                )}
              </div>
              <div className="mt-3 flex items-start justify-between">
                <div>
                  <p className="font-semibold text-white">{store?.name || "Loja"}</p>
                  <p className="text-xs text-slate-400">
                    {photo ? new Date(photo.capturedAt).toLocaleDateString("pt-BR") : ""} · {photo ? new Date(photo.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}{(photo as any)?.promoterName ? ` · ${(photo as any).promoterName}` : ""}
                  </p>
                </div>
              </div>
              <Button className="mt-3 h-11 w-full bg-green-500 text-base font-bold text-white hover:bg-green-400" onClick={() => shareImage(lightbox.url, store?.name || "loja")}>
                <MessageCircle className="mr-2 h-5 w-5" /> Enviar no WhatsApp
              </Button>
              <div className="mt-3 flex justify-around border-t border-white/10 pt-3 text-[10px] text-slate-300">
                <button className="flex flex-col items-center gap-1" onClick={() => { setLightbox(null); singleDelete.mutate({ photoId: lightbox.id }); setTimeout(() => document.querySelector<HTMLInputElement>('input[type=file]')?.click(), 300); }}>
                  <Pencil className="h-5 w-5 text-white" /><span>Editar</span>
                </button>
                {photo?.latitude != null && (
                  <a className="flex flex-col items-center gap-1" href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`} target="_blank" rel="noreferrer">
                    <MapPin className="h-5 w-5 text-white" /><span>Mapa</span>
                  </a>
                )}
                <a className="flex flex-col items-center gap-1" href={lightbox.url} download>
                  <Download className="h-5 w-5 text-white" /><span>Baixar</span>
                </a>
                <button className="flex flex-col items-center gap-1 text-rose-300" onClick={() => { singleDelete.mutate({ photoId: lightbox.id }); setLightbox(null); }}>
                  <Trash2 className="h-5 w-5" /><span>Excluir</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </DashboardLayout>
  );
}
