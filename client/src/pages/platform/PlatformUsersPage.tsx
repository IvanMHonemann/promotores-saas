import { useMemo, useState } from "react";
import { Ban, CheckCircle2, Loader2, LogIn, UsersRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { enterCompany } from "@/components/ActingAsBanner";
import { confirmAction } from "@/components/ConfirmDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = { company_admin: "Administrador", supervisor: "Supervisor", promoter: "Promotor" };

/** Usuários de todas as empresas, para o administrador geral (antes esta tela dava erro para ele). */
export default function PlatformUsersPage() {
  const utils = trpc.useUtils();
  const users = trpc.platform.users.list.useQuery(undefined, { staleTime: 10000 });
  const companies = trpc.platformCompanies.overview.useQuery(undefined, { staleTime: 60000 });
  const enterAs = trpc.platformCompanies.enterAs.useMutation();
  const setActive = trpc.accounts.setActive.useMutation({
    onSuccess: (_r, v) => { toast.success(v.active ? "Usuário liberado." : "Usuário bloqueado."); void utils.platform.users.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const [q, setQ] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const companyName = useMemo(() => new Map((companies.data || []).map((c) => [c.id, c.name])), [companies.data]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data || []).filter((u) =>
      (!companyId || u.companyId === Number(companyId)) &&
      (!role || u.role === role) &&
      (!term || `${u.userName} ${u.email}`.toLowerCase().includes(term)));
  }, [users.data, q, companyId, role]);

  return <DashboardLayout title="Usuários" description="Todos os usuários de todas as empresas." refreshing={users.isFetching} onRefresh={() => void users.refetch()}>
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardContent className="space-y-3 p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="border-white/15 bg-slate-950/60 text-white" />
        <select aria-label="Empresa" value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm"><option value="">Todas as empresas</option>{(companies.data || []).filter((c) => !c.archivedAt).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select aria-label="Perfil" value={role} onChange={(e) => setRole(e.target.value)} className="h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm"><option value="">Todos os perfis</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div>
      <p className="flex items-center gap-2 text-sm text-slate-300"><UsersRound className="h-4 w-4 text-teal-300" />{rows.length} usuário(s)</p>
      {users.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
      {users.isError && <p role="alert" className="text-sm text-rose-200">{users.error.message}</p>}
      <div className="space-y-2">{rows.map((u) => {
        const company = companyName.get(u.companyId) ?? `Empresa #${u.companyId}`;
        return <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{u.userName}</p><Badge className="bg-white/10 text-slate-200">{ROLE_LABEL[u.role] ?? u.role}</Badge>{!u.active && <Badge className="bg-rose-500/30 text-rose-100">Bloqueado</Badge>}</div>
            <p className="break-all text-xs text-slate-400">{u.email}</p>
            <p className="text-xs text-slate-400">{company}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => enterCompany(u.companyId, company, () => enterAs.mutateAsync({ companyId: u.companyId }))} className="border-fuchsia-300/40 text-fuchsia-200"><LogIn className="mr-1.5 h-4 w-4" />Entrar na empresa</Button>
            {u.active
              ? <Button size="sm" variant="outline" disabled={setActive.isPending} onClick={() => { void confirmAction({ title: `Bloquear o acesso de ${u.userName}?`, confirmLabel: "Bloquear" }).then((ok) => ok && setActive.mutate({ id: u.id, active: false })); }} className="border-rose-300/40 text-rose-200"><Ban className="mr-1.5 h-4 w-4" />Bloquear</Button>
              : <Button size="sm" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: u.id, active: true })} className="bg-emerald-500 text-white hover:bg-emerald-400"><CheckCircle2 className="mr-1.5 h-4 w-4" />Liberar</Button>}
          </div>
        </div>;
      })}{!rows.length && !users.isLoading && <p className="text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>}</div>
    </CardContent></Card>
  </DashboardLayout>;
}
