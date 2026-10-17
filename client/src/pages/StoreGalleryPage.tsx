import { useMemo, useState } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Camera, Check, ChevronDown, Download, ListChecks, MapPin, MessageCircle, Share2, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { PhotoCapture } from "@/components/PhotoCapture";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useBusy } from "@/components/BusyOverlay";
import { buildZip } from "@/lib/zip";

const SHARE_BATCH_SIZE = 10;
const FETCH_CONCURRENCY = 4;

/** Dispara o download de um arquivo (revoga a URL só depois, senão alguns navegadores cancelam). */
function saveFile(file: Blob, filename: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Executa `worker` sobre `items` com no máximo `limit` chamadas em paralelo, mantendo a ordem. */
async function mapPool<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>, onDone?: (done: number) => void): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
      done += 1;
      onDone?.(done);
    }
  });
  await Promise.all(runners);
  return results;
}


async function getImageFile(photoId: number, name: string, fileBase?: string): Promise<File | null> {
  try {
    // A sessão vai no header (igual ao cliente tRPC em main.tsx); sem isso a API responde 401.
    const headers: Record<string, string> = {};
    const token = typeof localStorage !== "undefined" ? localStorage.getItem("promotores-saas-session-token") : null;
    if (token) {
      headers["x-session-token"] = token;
      headers["Authorization"] = `Bearer ${token}`;
    }
    const res = await fetch(`/api/trpc/storePhotos.getImageData?input=${encodeURIComponent(JSON.stringify({ json: { photoId } }))}`, { headers, credentials: "include" });
    if (!res.ok) return null;
    const data = await res.json();
    // O tRPC deste projeto usa superjson: o payload vem em result.data.json
    const payload = data?.result?.data?.json ?? data?.result?.data;
    const base64 = payload?.base64;
    if (!base64) return null;
    const mime: string = payload?.mime || "image/jpeg";
    const ext = mime.includes("png") ? "png" : "jpg";
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: mime });
    return new File([blob], `${fileBase || `foto-${name || "loja"}`}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}
async function downloadImage(photoId: number, name: string) {
  const file = await getImageFile(photoId, name);
  if (!file) return toast.error("Não foi possível baixar.");
  saveFile(file, file.name);
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


/** Data local no formato AAAA-MM-DD (toISOString usa UTC e, à noite no Brasil, já cai no dia seguinte). */
function localISO(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PERIODS = [
  { id: "all", label: "Todas" },
  { id: "today", label: "Hoje" },
  { id: "7d", label: "7 dias" },
  { id: "30d", label: "30 dias" },
] as const;

function periodRange(id: (typeof PERIODS)[number]["id"]) {
  const now = new Date();
  if (id === "all") return { from: "", to: "" };
  if (id === "today") return { from: localISO(now), to: localISO(now) };
  const back = new Date(now);
  back.setDate(back.getDate() - (id === "7d" ? 6 : 29));
  return { from: localISO(back), to: localISO(now) };
}

function dayLabel(key: string) {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === now.toLocaleDateString("pt-BR")) return "Hoje";
  if (key === yesterday.toLocaleDateString("pt-BR")) return "Ontem";
  return key;
}

function PhotoThumb({ photoId, selected, selectMode, hasGps, time, onToggle, onExpand }: { photoId: number; selected: boolean; selectMode: boolean; hasGps: boolean; time: string; onToggle: () => void; onExpand: (url: string) => void }) {
  const { data, isLoading } = trpc.storePhotos.getImageUrl.useQuery(
    { photoId },
    { staleTime: 50 * 60 * 1000, retry: 1 },
  );
  return (
    <button
      type="button"
      onClick={() => {
        if (selectMode) { onToggle(); return; }
        if (data?.url) onExpand(data.url);
      }}
      aria-label={selectMode ? (selected ? "Desmarcar foto" : "Selecionar foto") : "Abrir foto"}
      aria-pressed={selectMode ? selected : undefined}
      className={`group relative aspect-square overflow-hidden rounded-xl bg-slate-800 ring-2 transition-all focus-visible:outline-none focus-visible:ring-teal-300 ${selected ? "ring-teal-300" : "ring-transparent"}`}
    >
      {isLoading && <div className="absolute inset-0 animate-pulse bg-slate-700" />}
      {!isLoading && !data?.url && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Camera className="h-8 w-8 text-slate-500" />
        </div>
      )}
      {data?.url && <img src={data.url} alt="" loading="lazy" className={`absolute inset-0 h-full w-full object-cover transition-transform duration-200 ${selected ? "scale-[0.92] rounded-lg" : "group-active:scale-[0.98]"}`} />}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-slate-950/85 to-transparent px-2 pb-1.5 pt-6">
        <span className="text-xs font-semibold text-white">{time}</span>
        {hasGps && <MapPin className="h-3.5 w-3.5 text-teal-300" aria-label="Com localização" />}
      </div>
      {selectMode && (
        <span className={`absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full border-2 shadow-md ${selected ? "border-teal-300 bg-teal-300 text-slate-950" : "border-white bg-slate-950/50 text-transparent"}`}>
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </button>
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
  const [ready, setReady] = useState<{ files: File[]; failed: number; sent: number[] } | null>(null);
  const { run } = useBusy();

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

  const selectAll = () => setSelected(new Set(allPhotos.map((p) => p.id)));

  const toggleDay = (ids: number[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const activePeriod = PERIODS.find((opt) => { const r = periodRange(opt.id); return r.from === from && r.to === to; })?.id;
  const withGps = allPhotos.filter((p) => p.latitude != null).length;
  const lightboxPhoto = lightbox ? allPhotos.find((p) => p.id === lightbox.id) : undefined;

  const deleteOne = (photoId: number) => {
    if (!confirm("Excluir esta foto?")) return;
    setLightbox(null);
    void run("Excluindo foto...", () => singleDelete.mutateAsync({ photoId })).catch(() => {});
  };

  const storeLabel = (store?.name || "loja").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "loja";

  /** Baixa as fotos selecionadas (em paralelo, com progresso). Nada é descartado em silêncio: devolve também quantas falharam. */
  const prepareSelectedFiles = (label: string) =>
    run(label, async ({ setProgress }) => {
      const ids = Array.from(selected);
      setProgress(0, `0 de ${ids.length}`);
      const results = await mapPool(
        ids,
        FETCH_CONCURRENCY,
        (id, i) => getImageFile(id, storeLabel, `foto-${storeLabel}-${String(i + 1).padStart(2, "0")}`),
        (done) => setProgress(done / ids.length, `${done} de ${ids.length}`),
      );
      const files = results.filter((f): f is File => !!f);
      return { files, failed: ids.length - files.length };
    });

  const downloadFiles = (files: File[]) =>
    run(files.length > 1 ? "Compactando fotos..." : "Baixando foto...", async ({ setProgress }) => {
      if (files.length === 1) {
        saveFile(files[0], files[0].name);
        return;
      }
      setProgress(null);
      const zip = await buildZip(files);
      saveFile(zip, `fotos-${storeLabel}-${new Date().toISOString().slice(0, 10)}.zip`);
    });

  const shareSelected = async () => {
    if (selected.size === 0) return toast.info("Selecione ao menos uma foto.");
    const { files, failed } = await prepareSelectedFiles("Preparando fotos para compartilhar...");
    if (files.length === 0) return toast.error("Não foi possível obter as imagens.");
    const canShareFiles = typeof navigator.share === "function" && (navigator.canShare?.({ files: files.slice(0, SHARE_BATCH_SIZE) }) ?? true);
    if (!canShareFiles) {
      await downloadFiles(files);
      toast.info("Compartilhamento direto indisponível neste aparelho. Baixei as fotos em um .zip para você enviar manualmente.");
      return;
    }
    // O navegador só abre o compartilhamento a partir de um toque do usuário. Como a preparação das
    // fotos demora, pedimos um novo toque (botão abaixo) em vez de tentar compartilhar "sem gesto".
    setReady({ files, failed, sent: [] });
  };

  const shareBatch = (index: number) => {
    if (!ready) return;
    const batch = ready.files.slice(index * SHARE_BATCH_SIZE, (index + 1) * SHARE_BATCH_SIZE);
    // IMPORTANTE: sem nenhum "await" antes — precisa rodar dentro do toque.
    navigator
      .share({ files: batch, title: `Fotos - ${store?.name || "Loja"}` })
      .then(() => setReady((r) => (r ? { ...r, sent: Array.from(new Set([...r.sent, index])) } : r)))
      .catch((e: any) => {
        if (e?.name === "AbortError") return;
        toast.error("Não foi possível abrir o compartilhamento. Use \"Baixar tudo (.zip)\".");
      });
  };

  const downloadSelected = async () => {
    if (selected.size === 0) return toast.info("Selecione ao menos uma foto.");
    const { files, failed } = await prepareSelectedFiles("Baixando fotos...");
    if (files.length === 0) return toast.error("Não foi possível baixar as imagens.");
    await downloadFiles(files);
    toast.success(`${files.length} foto(s) baixada(s)${files.length > 1 ? " em um arquivo .zip" : ""}.${failed ? ` ${failed} não puderam ser obtidas.` : ""}`);
  };

  const deleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`Excluir ${selected.size} foto(s)? Esta ação pode ser definitiva.`)) return;
    setSelectMode(false);
    void run("Excluindo fotos...", () => bulkDelete.mutateAsync({ photoIds: Array.from(selected) })).catch(() => {});
  };

  const shareOne = async (photoId: number) => {
    const file = await run("Preparando foto...", () => getImageFile(photoId, store?.name || "loja"));
    if (!file) return toast.error("Não foi possível obter a imagem.");
    if (typeof navigator.share === "function" && (navigator.canShare?.({ files: [file] }) ?? true)) {
      try {
        await navigator.share({ files: [file], title: `Foto - ${store?.name || "Loja"}` });
        return;
      } catch (e: any) {
        if (e?.name === "AbortError") return;
      }
    }
    saveFile(file, file.name);
    toast.info("Arquivo baixado. Compartilhe manualmente.");
  };


  return (
    <DashboardLayout
      title={store?.name || "Galeria da loja"}
      description={store ? `${store.city}${store.state ? ` · ${store.state}` : ""}` : "Carregando..."}
      onRefresh={() => void photos.refetch()}
    >
      <div className={`space-y-5 ${selectMode ? "pb-32" : ""}`}>
        <Link href="/lojas" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-300 hover:text-teal-200">
          <ArrowLeft className="h-4 w-4" /> Voltar para Lojas
        </Link>

        <div>
          <h2 className="text-2xl font-black text-white">Fotos da loja</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-teal-400/15 px-2.5 py-1 text-teal-200">{allPhotos.length} foto{allPhotos.length !== 1 ? "s" : ""}</span>
            {withGps > 0 && <span className="rounded-full bg-sky-400/15 px-2.5 py-1 text-sky-200">{withGps} com GPS</span>}
            {activeVisit && <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-emerald-200">Visita em andamento</span>}
          </div>
        </div>

        {store && (
          <PhotoCapture storeId={storeId} storeName={store.name} visitId={activeVisit?.visit?.id} onCaptured={() => void photos.refetch()} />
        )}

        <section className="rounded-2xl border border-white/15 bg-slate-800/70 p-4 shadow-lg shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-white">Período</h3>
            {allPhotos.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                className={selectMode ? "bg-white text-slate-900 hover:bg-slate-200" : "bg-teal-400 text-slate-950 hover:bg-teal-300"}
              >
                {selectMode ? <><X className="mr-1.5 h-4 w-4" /> Cancelar seleção</> : <><ListChecks className="mr-1.5 h-4 w-4" /> Selecionar fotos</>}
              </Button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERIODS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                aria-pressed={activePeriod === opt.id}
                onClick={() => { const r = periodRange(opt.id); setFrom(r.from); setTo(r.to); }}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${activePeriod === opt.id ? "bg-teal-400 text-slate-950" : "bg-slate-700 text-slate-100 hover:bg-slate-600"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <details className="group mt-3" open={!!(from || to) && !activePeriod}>
            <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-slate-200 hover:text-white">
              Escolher datas <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-200">
                De
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert" />
              </label>
              <label className="block text-xs font-semibold text-slate-200">
                Até
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2.5 text-sm text-white [color-scheme:dark] [&::-webkit-calendar-picker-indicator]:invert" />
              </label>
            </div>
          </details>
        </section>

        {photos.isLoading && <p className="text-sm text-slate-200">Carregando fotos...</p>}
        {photos.isError && (
          <p className="rounded-xl border border-rose-300/40 bg-rose-400/15 p-3 text-sm text-rose-100">
            Não foi possível carregar a galeria. Puxe para atualizar ou tente novamente.
          </p>
        )}

        {grouped.map(([day, items]) => {
          const ids = items.map((i) => i.id);
          const allDaySelected = ids.every((id) => selected.has(id));
          return (
            <section key={day}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-white">
                  {dayLabel(day)}
                  <span className="ml-2 text-sm font-medium text-slate-300">{items.length} foto{items.length !== 1 ? "s" : ""}{(items[0] as any).promoterName ? ` · ${(items[0] as any).promoterName}` : ""}</span>
                </h3>
                {selectMode && (
                  <button type="button" onClick={() => toggleDay(ids)} className="text-sm font-semibold text-teal-300 hover:text-teal-200">
                    {allDaySelected ? "Desmarcar dia" : "Selecionar dia"}
                  </button>
                )}
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
          );
        })}

        {!photos.isLoading && !photos.isError && allPhotos.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/25 bg-slate-800/40 p-8 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-teal-400/20 text-teal-300">
              <Camera className="h-6 w-6" />
            </div>
            <p className="mt-4 text-base font-bold text-white">Nenhuma foto neste período</p>
            <p className="mt-1 text-sm text-slate-300">Toque em <span className="font-semibold text-teal-300">Tirar foto</span> para registrar a primeira ou escolha outro período.</p>
          </div>
        )}
      </div>

      {selectMode && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-teal-300/30 bg-slate-900/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2.5 flex items-center justify-between text-sm">
              <span className="font-bold text-white">{selected.size} selecionada{selected.size !== 1 ? "s" : ""}</span>
              <div className="flex gap-4 font-semibold">
                <button type="button" onClick={selectAll} className="text-teal-300 hover:text-teal-200">Selecionar todas</button>
                <button type="button" onClick={() => setSelected(new Set())} className="text-slate-200 hover:text-white">Limpar</button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button className="h-11 bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={shareSelected} disabled={selected.size === 0}>
                <Share2 className="mr-1.5 h-4 w-4" /> Enviar
              </Button>
              <Button className="h-11 bg-slate-600 font-bold text-white hover:bg-slate-500" onClick={downloadSelected} disabled={selected.size === 0}>
                <Download className="mr-1.5 h-4 w-4" /> Baixar
              </Button>
              <Button className="h-11 bg-rose-500 font-bold text-white hover:bg-rose-400" onClick={deleteSelected} disabled={selected.size === 0 || bulkDelete.isPending}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {ready && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/75 p-4 sm:items-center" onClick={() => setReady(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-slate-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-bold text-white">{ready.files.length} foto{ready.files.length !== 1 ? "s" : ""} pronta{ready.files.length !== 1 ? "s" : ""}</p>
                <p className="mt-1 text-sm text-slate-200">
                  Toque para abrir o compartilhamento (WhatsApp e outros apps).
                  {ready.files.length > SHARE_BATCH_SIZE ? ` Enviamos em lotes de ${SHARE_BATCH_SIZE} fotos.` : ""}
                  {ready.failed > 0 ? ` ${ready.failed} foto(s) não puderam ser obtidas.` : ""}
                </p>
              </div>
              <button className="rounded-full bg-slate-700 p-1.5 text-white hover:bg-slate-600" onClick={() => setReady(null)} aria-label="Fechar"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-4 space-y-2">
              {Array.from({ length: Math.ceil(ready.files.length / SHARE_BATCH_SIZE) }, (_, i) => {
                const start = i * SHARE_BATCH_SIZE + 1;
                const end = Math.min((i + 1) * SHARE_BATCH_SIZE, ready.files.length);
                const sent = ready.sent.includes(i);
                return (
                  <Button key={i} className={`h-12 w-full text-base font-bold ${sent ? "bg-slate-600 text-white hover:bg-slate-500" : "bg-green-500 text-white hover:bg-green-400"}`} onClick={() => shareBatch(i)}>
                    {sent ? <Check className="mr-2 h-5 w-5" /> : <MessageCircle className="mr-2 h-5 w-5" />}
                    {sent ? "Enviado — enviar de novo" : ready.files.length > SHARE_BATCH_SIZE ? `Enviar fotos ${start} a ${end}` : "Compartilhar fotos"}
                  </Button>
                );
              })}
              <Button className="h-11 w-full bg-slate-600 font-semibold text-white hover:bg-slate-500" onClick={() => void downloadFiles(ready.files)}>
                <Download className="mr-2 h-4 w-4" /> Baixar tudo (.zip)
              </Button>
            </div>
          </div>
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/15 bg-slate-800 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-slate-950">
              <img src={lightbox.url} alt="" className="max-h-[55vh] w-full object-contain" />
              <button className="absolute right-2 top-2 rounded-full bg-slate-900/85 p-2 text-white hover:bg-slate-700" onClick={() => setLightbox(null)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-base font-bold text-white">{store?.name || "Loja"}</p>
              <p className="mt-0.5 text-sm text-slate-200">
                {lightboxPhoto ? `${new Date(lightboxPhoto.capturedAt).toLocaleDateString("pt-BR")} às ${new Date(lightboxPhoto.capturedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                {(lightboxPhoto as any)?.promoterName ? ` · ${(lightboxPhoto as any).promoterName}` : ""}
              </p>
              <Button className="mt-4 h-12 w-full bg-green-500 text-base font-bold text-white hover:bg-green-400" onClick={() => void shareOne(lightbox.id)}>
                <MessageCircle className="mr-2 h-5 w-5" /> Enviar no WhatsApp
              </Button>
              <div className={`mt-2 grid gap-2 ${lightboxPhoto?.latitude != null ? "grid-cols-3" : "grid-cols-2"}`}>
                <Button className="h-11 bg-slate-600 font-semibold text-white hover:bg-slate-500" onClick={() => void run("Baixando foto...", () => downloadImage(lightbox.id, store?.name || "loja"))}>
                  <Download className="mr-1.5 h-4 w-4" /> Baixar
                </Button>
                {lightboxPhoto?.latitude != null && (
                  <a className="inline-flex h-11 items-center justify-center rounded-md bg-sky-500 text-sm font-semibold text-white hover:bg-sky-400" href={`https://maps.google.com/?q=${lightboxPhoto.latitude},${(lightboxPhoto as any).longitude}`} target="_blank" rel="noreferrer">
                    <MapPin className="mr-1.5 h-4 w-4" /> Mapa
                  </a>
                )}
                <Button className="h-11 bg-rose-500 font-semibold text-white hover:bg-rose-400" onClick={() => deleteOne(lightbox.id)}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
