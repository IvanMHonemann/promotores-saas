import { useState } from "react";
import { Link } from "wouter";
import { Camera, MapPin, Search } from "lucide-react";
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

  return (
    <DashboardLayout
      title="Lojas"
      description="Galeria de evidências fotográficas por ponto de venda"
      onRefresh={() => void stores.refetch()}
    >
      <div className="space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome da loja"
            className="border-white/15 bg-slate-950/60 pl-9 text-white"
          />
        </div>

        {stores.isLoading && <p className="text-sm text-slate-300">Carregando lojas...</p>}
        {stores.isError && (
          <p className="rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm text-rose-100">
            Não foi possível carregar as lojas. {stores.error?.message || ""}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(stores.data || []).map((store) => (
            <Link key={store.id} href={`/lojas/${store.id}`}>
              <Card className="h-full cursor-pointer border-white/10 bg-slate-950/40 transition hover:border-teal-300/40 hover:bg-slate-900/60">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-white">{store.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-300">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-teal-300" />
                        {store.city}
                        {store.state ? ` · ${store.state}` : ""}
                      </p>
                      {store.address && (
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">{store.address}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="shrink-0 border-teal-300/30 text-teal-200">
                      <Camera className="mr-1 h-3 w-3" />
                      {store.photoCount}
                    </Badge>
                  </div>
                  {store.lastActivity && (
                    <p className="text-xs text-slate-400">
                      Última foto: {new Date(store.lastActivity).toLocaleString("pt-BR")}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {!stores.isLoading && !stores.isError && (stores.data || []).length === 0 && (
          <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-slate-300">
            Nenhuma loja encontrada.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
