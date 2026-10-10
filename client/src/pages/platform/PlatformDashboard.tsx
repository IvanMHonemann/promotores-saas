import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PlatformDashboard() {
  const companies = trpc.platform.companies.list.useQuery();
  const activeCount = companies.data?.filter((company) => company.active).length ?? 0;
  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-400">Promotores SaaS</p><h1 className="text-3xl font-black tracking-tight">Administração geral</h1><p className="mt-1 text-slate-400">Visão central das empresas e da operação da plataforma.</p></div><Button variant="outline" className="border-slate-700 bg-transparent text-white hover:bg-slate-800" onClick={() => window.location.reload()}>Atualizar</Button></header>
        <section className="grid gap-4 sm:grid-cols-3"><Card className="border-slate-800 bg-slate-900"><CardContent className="p-5"><p className="text-sm text-slate-400">Empresas cadastradas</p><p className="mt-2 text-3xl font-black">{companies.data?.length ?? 0}</p></CardContent></Card><Card className="border-slate-800 bg-slate-900"><CardContent className="p-5"><p className="text-sm text-slate-400">Empresas ativas</p><p className="mt-2 text-3xl font-black text-emerald-400">{activeCount}</p></CardContent></Card><Card className="border-slate-800 bg-slate-900"><CardContent className="p-5"><p className="text-sm text-slate-400">Produto</p><p className="mt-2 text-xl font-black">Promotores SaaS</p></CardContent></Card></section>
        <Card className="border-slate-800 bg-slate-900"><CardHeader><CardTitle>Empresas</CardTitle></CardHeader><CardContent className="space-y-3">{companies.isLoading && <p className="text-sm text-slate-400">Carregando empresas...</p>}{!companies.isLoading && !companies.data?.length && <p className="text-sm text-slate-400">Nenhuma empresa cadastrada.</p>}{companies.data?.map((company) => <div key={company.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 p-4"><div><p className="font-bold">{company.name}</p><p className="text-sm text-slate-400">Empresa #{company.id}</p></div><Badge variant="outline" className={company.active ? "border-emerald-700 text-emerald-300" : "border-slate-700 text-slate-400"}>{company.active ? "Ativa" : "Inativa"}</Badge></div>)}</CardContent></Card>
      </div>
    </main>
  );
}
