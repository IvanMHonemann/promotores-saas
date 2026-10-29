import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Camera, ChevronRight, MapPin, Plus, Search, Store, X } from "lucide-react";
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
import { enqueueStore, listStores } from "@/lib/storeQueue";
import { useAuth } from "@/_core/hooks/useAuth";

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
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", state: "", address: "" });
  const createStore = trpc.operations.stores.create.useMutation({
    onSuccess: () => {
      toast.success("Loja cadastrada.");
      setForm({ name: "", city: "", state: "", address: "" });
      setFormOpen(false);
      void stores.refetch();
    },
    onError: (e) => toast.error(e.message || "Não foi possível cadastrar a loja."),
  });
  const submitStore = () => {
    const name = form.name.trim();
    const city = form.city.trim();
    const state = form.state.trim().toUpperCase();
    if (name.length < 2) return toast.info("Informe o nome da loja.");
    if (city.length < 2) return toast.info("Informe a cidade.");
    if (state && state.length !== 2) return toast.info("Use a sigla do estado com 2 letras (ex.: SP).");
    const payload = { name, city, state: state || undefined, address: form.address.trim() || undefined };
    if (!online) {
      enqueueStore(payload);
      setPendingStores(listStores());
      toast.success("Loja salva offline. Será cadastrada quando a internet voltar.");
      setForm({ name: "", city: "", state: "", address: "" });
      setFormOpen(false);
      return;
    }
    void run("Cadastrando loja...", () =>
      createStore.mutateAsync(payload),
    ).catch(() => {});
  };

  return (
    <DashboardLayout
      title="Lojas"
      description="Veja as evidências fotográficas de cada ponto de venda"
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

        {canCreateStore && formOpen && (
          <section className="space-y-3 rounded-2xl border border-white/15 bg-slate-800/70 p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Cadastrar loja</h3>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Fechar" className="rounded-full p-1.5 text-slate-200 hover:bg-white/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da loja" className="h-11 border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400" />
            <div className="grid grid-cols-[1fr_5rem] gap-2">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" className="h-11 border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400" />
              <Input value={form.state} maxLength={2} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="UF" className="h-11 border-white/20 bg-slate-950/70 text-center text-white placeholder:text-slate-400" />
            </div>
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Endereço (opcional)" className="h-11 border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400" />
            <Button className="h-11 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={submitStore}>
              Salvar loja
            </Button>
          </section>
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
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-300/10 px-2 py-0.5 text-xs font-semibold text-teal-200">
                <Camera className="h-3 w-3" />
                {store.photoCount}
              </span>
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
