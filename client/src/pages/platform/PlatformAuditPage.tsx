import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";

export default function PlatformAuditPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState("");
  const companies = trpc.platformCompanies.overview.useQuery(undefined, { staleTime: 60000 });
  const list = trpc.audit.platformList.useQuery({ page, pageSize: 25, search: search.trim() || undefined, companyId: companyId ? Number(companyId) : undefined }, { staleTime: 5000 });
  const items: any[] = (list.data as any)?.items ?? [];
  const total = Number((list.data as any)?.total ?? 0);
  const pages = Math.max(1, Math.ceil(total / 25));
  return <DashboardLayout title="Auditoria geral" description="Atividades registradas em todas as empresas, incluindo ações do administrador da plataforma." refreshing={list.isFetching} onRefresh={() => void list.refetch()}>
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardContent className="space-y-3 p-4">
      <div className="flex flex-wrap gap-3"><Input aria-label="Buscar" placeholder="Buscar na descrição" value={search} onChange={(e) => { setPage(1); setSearch(e.target.value); }} className="max-w-xs border-white/15 bg-slate-950/60 text-white" />
        <select aria-label="Empresa" value={companyId} onChange={(e) => { setPage(1); setCompanyId(e.target.value); }} className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm"><option value="">Todas as empresas</option>{(companies.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="space-y-2">{items.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3 text-sm"><p className="font-semibold">{r.description}</p><p className="text-xs text-slate-400">{new Date(r.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} · {r.userName || "—"} · {r.module}/{r.action}{r.companyId ? ` · empresa #${r.companyId}` : " · plataforma"}</p></div>)}{!items.length && !list.isLoading && <p className="text-center text-sm text-slate-400">Nenhum registro.</p>}</div>
      <div className="flex items-center justify-between text-sm text-slate-300"><span>{total} registro(s)</span><div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)} className="border-white/20 text-white">Anterior</Button><span>{page}/{pages}</span><Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)} className="border-white/20 text-white">Próxima</Button></div></div>
    </CardContent></Card>
  </DashboardLayout>;
}
