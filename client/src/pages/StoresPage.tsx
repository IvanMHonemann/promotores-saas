import { useState } from "react";
import { Link } from "wouter";
import { Camera, MapPin, Search, Store } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function StoresPage() {
  const [search, setSearch] = useState("");
  const stores = trpc.storePhotos.listStoresWithStats.useQuery(
    { search: search.trim() || undefined },
    { staleTime: 15000 },
  );

  const list = stores.data || [];

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

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar loja pelo nome"
            className="h-12 border-white/15 bg-slate-950/70 pl-10 text-white placeholder:text-slate-500"
          />
        </div>

        {stores.isLoading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
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

        {!stores.isLoading && !stores.isError && list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center">
            <Store className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-3 text-sm text-slate-300">Nenhuma loja encontrada.</p>
            <p className="mt-1 text-xs text-slate-500">Cadastre lojas na empresa para começar a registrar fotos.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
