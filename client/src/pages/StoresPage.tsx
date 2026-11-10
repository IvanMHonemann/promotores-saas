import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Camera, ChevronRight, MapPin, Pencil, Plus, Search, Store, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useBusy } from "@/components/BusyOverlay";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";
import { listStores } from "@/lib/storeQueue";
import StoreForm from "@/components/StoreForm";
import { useAuth } from "@/_core/hooks/useAuth";
import { confirmAction } from "@/components/ConfirmDialog";

export default function StoresPage() {
  const { user } = useAuth();
  const canCreateStore = user?.role === "company_admin" || user?.role === "supervisor";
  const [search, setSearch] = useState("");
  const online = useOnline();
  const term = search.trim();
  const storesQuery = trpc.storePhotos.listStoresWithStats.useQuery(
    { search: term || undefined },
    { staleTime: 15000 },
  );
  const unlinkedQuery = trpc.storePhotos.countWithoutStore.useQuery(undefined, { staleTime: 15000 });
  // Guarda a lista completa (sem busca) neste aparelho para abrir sem internet.
  useEffect(() => { if (storesQuery.data && !term) cacheSet("stores", storesQuery.data); }, [storesQuery.data, term]);
  const cachedStores = useMemo(() => cacheGet<any[]>("stores"), [storesQuery.data, online]);
  // Sem resposta da rede, usa a lista salva (filtrada pela busca) em vez de ficar carregando.
  const fallback = useMemo(() => (cachedStores || []).filter((s) => !term || String(s.name).toLowerCase().includes(term.toLowerCase())), [cachedStores, term]);
  const [pendingStores, setPendingStores] = useState(() => listStores());
  useEffect(() => { setPendingStores(listStores()); }, [online]);
  const serverList: any[] = storesQuery.data ?? fallback;
  const pendingDisplay = pendingStores
    .filter((s) => !term || s.name.toLowerCase().includes(term.toLowerCase()))
    .map((s) => ({
      id: s.tempId,
      name: s.name,
      city: s.city,
      state: s.state,
      address: s.address,
      photoCount: 0,
      lastActivity: null,
      pending: true,
    }));
  const list: any[] = [...pendingDisplay, ...serverList];
  const usingSaved = !storesQuery.data && Boolean(cachedStores?.length);
  // Offline ou timeout: não mostra loading infinito
  const loading = storesQuery.isLoading && online && !cachedStores;
  const stores = { refetch: storesQuery.refetch, isError: storesQuery.isError && !cachedStores, error: storesQuery.error };

  const { run } = useBusy();
  const utils = trpc.useUtils();
  const [formOpen, setFormOpen] = useState(false);
  const isCompanyAdmin = user?.role === "company_admin";
  const [editingId, setEditingId] = useState<number | null>(null);
  const archiveStore = trpc.operations.stores.archive.useMutation({
    onSuccess: () => { toast.success("Loja removida da lista. Fotos e histórico continuam guardados."); void stores.refetch(); },
    onError: (e) => toast.error(e.message || "Não foi possível remover a loja."),
  });
  const [editingStore, setEditingStore] = useState<any>(null);
  const startEdit = (store: any) => {
    setEditingId(store.id);
    setEditingStore(store);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const confirmArchive = async (store: any) => {
    // Produtos com validade nesta loja não somem: passam a aparecer como "loja removida". Avisa antes.
    let productCount = 0;
    try { productCount = (await utils.products.countByStore.fetch({ storeId: store.id })).count; } catch { /* módulo de produtos desligado */ }
    const productNote = productCount > 0 ? ` ${productCount} produto(s) com validade continuam cadastrados e passam a aparecer como "loja removida" em Produtos e validades.` : "";
    if (!(await confirmAction({ title: `Remover a loja "${store.name}"?`, description: `As fotos e o histórico continuam guardados.${productNote}`, confirmLabel: "Remover loja" }))) return;
    void run("Removendo loja...", () => archiveStore.mutateAsync({ id: store.id })).catch(() => {});
  };
  // Lojas com endereço e sem localização no mapa (o aviso de "longe da loja" no check-in precisa dela).
  const missingCoords = serverList.filter((s: any) => s.address?.trim() && (s.latitude == null || s.longitude == null)).length;
  const geocodeMissing = trpc.operations.stores.geocodeMissing.useMutation({
    onSuccess: (r) => {
      toast.success(r.found ? `Localização encontrada para ${r.found} de ${r.checked} loja(s).` : "Nenhuma loja encontrada no mapa pelo endereço. Informe rua e número (edite a loja) ou cole a localização do Google Maps.");
      void stores.refetch();
    },
    onError: (e) => toast.error(e.message || "Não foi possível buscar a localização agora."),
  });
  const closeForm = () => { setFormOpen(false); setEditingId(null); setEditingStore(null); };
  const onStoreSaved = () => { setPendingStores(listStores()); closeForm(); void stores.refetch(); };

  return (
    <DashboardLayout
      title="Lojas"
      description="Veja as fotos das visitas em cada loja"
      onRefresh={() => void stores.refetch()}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-white">Pontos de venda</h2>
            <p className="text-xs text-slate-400">{list.length} loja{list.length !== 1 ? "s" : ""}</p>
          </div>
          {canCreateStore && !formOpen && (
            <Button size="sm" className="bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={() => setFormOpen(true)}>
              <Plus className="mr-1 h-4 w-4" /> Nova loja
            </Button>
          )}
        </div>

        {isCompanyAdmin && online && missingCoords > 0 && !formOpen && (
          <div data-testid="stores-missing-coords" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300">
            <span>{missingCoords} loja{missingCoords !== 1 ? "s" : ""} sem localização no mapa (usada no aviso de check-in longe da loja).</span>
            <Button size="sm" variant="outline" className="border-white/20 text-white" disabled={geocodeMissing.isPending} onClick={() => void run("Buscando localização pelo endereço...", () => geocodeMissing.mutateAsync()).catch(() => {})}>
              <MapPin className="mr-1 h-4 w-4" /> Buscar pelo endereço
            </Button>
          </div>
        )}

        {canCreateStore && formOpen && (
          <StoreForm key={editingId ?? "new"} editing={editingId ? editingStore : null} onClose={closeForm} onSaved={onStoreSaved} />
        )}

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja pelo nome"
            className="h-11 border-white/15 bg-slate-950/70 pl-10 text-white placeholder:text-slate-500"
          />
        </div>

        {(!online || usingSaved) && (
          <p role="status" className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
            {cachedStores || pendingStores.length
              ? "Sem conexão: mostrando lojas salvas neste aparelho."
              : "Sem conexão. Abra a lista de lojas uma vez com internet para ela ficar disponível offline."}
          </p>
        )}
        {loading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
        {stores.isError && (
          <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
            Não foi possível carregar as lojas. {stores.error?.message || "Tente novamente."}
          </p>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-900/70">
          <Link href="/lojas/none" className="flex items-center gap-3 border-b border-white/10 px-3 py-2.5 transition hover:bg-white/5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-200">
              <Camera className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-white">Fotos sem loja</span>
              <span className="block truncate text-xs text-slate-400">Ver e tirar fotos sem vínculo a uma loja</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/10 px-2 py-0.5 text-xs font-semibold text-amber-200">
              <Camera className="h-3 w-3" />
              {unlinkedQuery.data?.count ?? 0}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
          </Link>

          {list.map((store) => (
            <Link
              key={store.id}
              href={store.pending ? "#" : `/lojas/${store.id}`}
              onClick={store.pending ? (e) => e.preventDefault() : undefined}
              className={`flex items-center gap-3 border-b border-white/5 px-3 py-2.5 transition last:border-b-0 hover:bg-white/5 ${store.pending ? "opacity-70" : ""}`}
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-300/10 text-teal-300">
                <Store className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">{store.name}</span>
                <span className="flex items-center gap-1 truncate text-xs text-slate-400">
                  <MapPin className="h-3 w-3 shrink-0 text-teal-300/70" />
                  {store.city}{store.state ? ` · ${store.state}` : ""}
                  {store.address ? ` · ${store.address}` : ""}
                  {store.pending && " · pendente"}
                </span>
              </span>
              <span title="Fotos registradas" className="inline-flex items-center gap-1 rounded-full bg-teal-300/10 px-2 py-0.5 text-xs font-semibold text-teal-200">
                <Camera className="h-3 w-3" />
                {store.photoCount} foto{store.photoCount === 1 ? "" : "s"}
              </span>
              {canCreateStore && !store.pending && (
                <button type="button" aria-label={`Editar ${store.name}`} title="Editar loja" onClick={(e) => { e.preventDefault(); e.stopPropagation(); startEdit(store); }} className="rounded-full p-1.5 text-slate-300 hover:bg-white/10 hover:text-white">
                  <Pencil className="h-4 w-4" />
                </button>
              )}
              {isCompanyAdmin && !store.pending && (
                <button type="button" aria-label={`Remover ${store.name}`} title="Remover loja" onClick={(e) => { e.preventDefault(); e.stopPropagation(); confirmArchive(store); }} className="rounded-full p-1.5 text-slate-300 hover:bg-rose-400/15 hover:text-rose-200">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </Link>
          ))}
        </div>

        {!loading && !stores.isError && list.length === 0 && online && !usingSaved && (
          <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center">
            <Store className="mx-auto h-7 w-7 text-slate-500" />
            <p className="mt-2 text-sm text-slate-300">Nenhuma loja encontrada.</p>
            <p className="mt-1 text-xs text-slate-400">Cadastre uma loja ou use “Fotos sem loja” para registrar sem vínculo.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
