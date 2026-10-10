import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function OperationsDashboard() {
  const today = new Date().toISOString().slice(0, 10);
  const stores = trpc.operations.stores.list.useQuery();
  const routes = trpc.operations.routes.list.useQuery({ date: today });
  const visits = trpc.operations.visits.list.useQuery({ date: today });
  const metrics = useMemo(() => {
    const rows = visits.data || [];
    return { total: rows.length, completed: rows.filter((row) => row.visit.status === "completed").length, inProgress: rows.filter((row) => row.visit.status === "in_progress").length };
  }, [visits.data]);

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-600">Promotores SaaS</p><h1 className="text-3xl font-black tracking-tight">Operação de campo</h1><p className="mt-1 text-slate-500">Acompanhe lojas, roteiros e visitas em um único painel.</p></div><Button variant="outline" onClick={() => window.location.reload()}>Atualizar dados</Button></header>
        <section className="grid gap-4 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Visitas de hoje</p><p className="mt-2 text-3xl font-black">{metrics.total}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Concluídas</p><p className="mt-2 text-3xl font-black text-emerald-600">{metrics.completed}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-sm text-slate-500">Em andamento</p><p className="mt-2 text-3xl font-black text-amber-600">{metrics.inProgress}</p></CardContent></Card></section>
        <section className="grid gap-5 lg:grid-cols-[1fr_1.4fr]"><Card><CardHeader><CardTitle>Roteiros de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{routes.isLoading && <p className="text-sm text-slate-500">Carregando...</p>}{!routes.isLoading && !routes.data?.length && <p className="text-sm text-slate-500">Nenhum roteiro planejado para hoje.</p>}{routes.data?.map((route) => <div key={route.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><p className="font-bold">{route.name}</p><Badge variant="outline">{route.status}</Badge></div><p className="mt-1 text-sm text-slate-500">Promotor #{route.promoterId}</p></div>)}</CardContent></Card><Card><CardHeader><CardTitle>Visitas de hoje</CardTitle></CardHeader><CardContent className="space-y-3">{visits.isLoading && <p className="text-sm text-slate-500">Carregando...</p>}{!visits.isLoading && !visits.data?.length && <p className="text-sm text-slate-500">Nenhuma visita encontrada.</p>}{visits.data?.map(({ visit, store }) => <div key={visit.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-bold">{store.name}</p><p className="text-sm text-slate-500">{store.city} · Promotor #{visit.promoterId}</p></div><Badge variant="outline">{visit.status === "in_progress" ? "Em andamento" : visit.status === "completed" ? "Concluída" : "Pendente"}</Badge></div>)}</CardContent></Card></section>
        <Card><CardHeader><CardTitle>Lojas cadastradas</CardTitle></CardHeader><CardContent><p className="text-3xl font-black">{stores.data?.length ?? 0}</p><p className="text-sm text-slate-500">pontos de venda ativos nesta empresa</p></CardContent></Card>
      </div>
    </main>
  );
}
