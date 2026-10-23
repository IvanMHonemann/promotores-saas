import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { Camera, MapPin, Plus, Search, Store, X } from "lucide-react";
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

export default function StoresPage() {
  const [search, setSearch] = useState("");
  const online = useOnline();
  const term = search.trim();
  const storesQuery = trpc.storePhotos.listStoresWithStats.useQuery(
    { search: term || undefined },
    { staleTime: 15000 },
  );
  // Guarda a lista completa (sem busca) neste aparelho para abrir sem internet.
  useEffect(() => { if (storesQuery.data && !term) cacheSet("stores", storesQuery.data); }, [storesQuery.data, term]);
  const cachedStores = useMemo(() => cacheGet<any[]>("stores"), [storesQuery.data, online]);
  // Sem resposta da rede, usa a lista salva (filtrada pela busca) em vez de ficar carregando.
  const fallback = useMemo(() => (cachedStores || []).filter((s) => !term || String(s.name).toLowerCase().includes(term.toLowerCase())), [cachedStores, term]);
  const list: any[] = storesQuery.data ?? fallback;
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!storesQuery.isLoading) { setTimedOut(false); return; }
    const t = window.setTimeout(() => setTimedOut(true), 7000);
    return () => window.clearTimeout(t);
  }, [storesQuery.isLoading]);
  const usingSaved = !storesQuery.data && Boolean(cachedStores);
  const loading = storesQuery.isLoading && online && !timedOut && !cachedStores;
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
    void run("Cadastrando loja...", () =>
      createStore.mutateAsync({ name, city, state: state || undefined, address: form.address.trim() || undefined }),
    ).catch(() => {});
  };

  return (
    <DashboardLayout
      title="Lojas"
      description="Veja as evidências fotográficas de cada ponto de venda"
      onRefresh={() => void stores.refetch()}
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-300/10 text-teal-300">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-300">Evidências de campo</p>
              <h2 className="mt-0.5 text-xl font-black text-white">Pontos de venda</h2>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Toque em uma loja para ver as fotos, filtrar por período e compartilhar.
          </p>
        </div>

        {formOpen ? (
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
        ) : (
          <Button className="h-11 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-5 w-5" /> Cadastrar loja
          </Button>
        )}

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja pelo nome"
            className="h-12 border-white/15 bg-slate-950/70 pl-10 text-white placeholder:text-slate-500"
          />
        </div>

        {(!online || usingSaved) && (
          <p role="status" className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-100">
            {cachedStores ? "Sem conexão com o servidor: mostrando as lojas salvas neste aparelho. Cadastros e fotos novas exigem internet." : "Sem conexão. Abra a lista de lojas uma vez com internet para ela ficar disponível offline."}
          </p>
        )}
        {loading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
        {stores.isError && (
          <p className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
            Não foi possível carregar as lojas. {stores.error?.message || "Tente novamente."}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((store) => (
            <Link key={store.id} href={`/lojas/${store.id}`}>
              <Card className="h-full cursor-pointer border-white/10 bg-slate-900/70 transition hover:-translate-y-0.5 hover:border-teal-300/40 hover:bg-slate-900">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-bold text-white">{store.name}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-300">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-300" />
                        {store.city}{store.state ? ` · ${store.state}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-teal-300/30 bg-teal-300/5 text-teal-200">
                      <Camera className="mr-1 h-3 w-3" />
                      {store.photoCount}
                    </Badge>
                  </div>
                  {store.address && (
                    <p className="line-clamp-2 text-xs leading-5 text-slate-400">{store.address}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {store.lastActivity
                      ? `Última foto em ${new Date(store.lastActivity).toLocaleDateString("pt-BR")}`
                      : "Nenhuma foto ainda"}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {!loading && !stores.isError && list.length === 0 && online && !usingSaved && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <Store className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm text-slate-300">Nenhuma loja encontrada.</p>
            <p className="mt-1 text-xs text-slate-400">Cadastre uma loja para começar a registrar fotos. Você vê as lojas que cadastrou e as dos seus roteiros.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
