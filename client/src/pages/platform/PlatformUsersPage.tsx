import { useMemo, useState } from "react";
import { Ban, CheckCircle2, KeyRound, Loader2, LogIn, Plus, UserPlus, UsersRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { enterCompany } from "@/components/ActingAsBanner";
import { confirmAction } from "@/components/ConfirmDialog";
import { PasswordInput } from "@/components/PasswordInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = { company_admin: "Administrador", supervisor: "Supervisor", promoter: "Promotor" };
const inp = "mt-1 border-white/15 bg-slate-950/60 text-white";
const sel = "mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white";

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
  const resetPassword = trpc.accounts.resetPassword.useMutation({
    onSuccess: () => { toast.success("Senha redefinida com segurança."); setResettingId(null); setResetPassword(""); },
    onError: (e) => toast.error(e.message),
  });
  const [q, setQ] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [role, setRole] = useState("");
  const [creating, setCreating] = useState(false);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetValue, setResetPassword] = useState("");
  const companyName = useMemo(() => new Map((companies.data || []).map((c) => [c.id, c.name])), [companies.data]);
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (users.data || []).filter((u) =>
      (!companyId || u.companyId === Number(companyId)) &&
      (!role || u.role === role) &&
      (!term || `${u.userName} ${u.email}`.toLowerCase().includes(term)));
  }, [users.data, q, companyId, role]);

  return <DashboardLayout title="Usuários" description="Crie usuários e gerencie os acessos de todas as empresas." refreshing={users.isFetching} onRefresh={() => void users.refetch()}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-teal-300" />Usuários ({rows.length})</CardTitle><Button size="sm" className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Novo usuário</Button></CardHeader><CardContent className="space-y-3">
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
        return <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
          </div>
          {resettingId === u.id ? (
            <div className="flex flex-col gap-2 border-t border-white/10 pt-2 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`reset-senha-${u.id}`}>Nova senha temporária</Label>
                <PasswordInput id={`reset-senha-${u.id}`} minLength={8} value={resetValue} onChange={(e) => setResetPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" className={`${inp} border-slate-700 bg-slate-950 text-white`} />
              </div>
              <Button size="sm" disabled={resetPassword.isPending || resetValue.length < 8} onClick={() => resetPassword.mutate({ id: u.id, newPassword: resetValue })} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar nova senha</Button>
              <Button size="sm" variant="ghost" className="text-slate-300" onClick={() => { setResettingId(null); setResetPassword(""); }}>Cancelar</Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-8 w-fit gap-2 px-0 text-slate-300 hover:text-teal-200" onClick={() => { setResettingId(u.id); setResetPassword(""); }}><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</Button>
          )}
        </div>;
      })}{!rows.length && !users.isLoading && <p className="text-center text-sm text-slate-400">Nenhum usuário encontrado.</p>}</div>
    </CardContent></Card>
      {creating ? (
        <CreatePlatformUserCard
          companies={(companies.data || []).filter((c) => c.active && !c.archivedAt).map((c) => ({ id: c.id, name: c.name }))}
          defaultCompanyId={companyId}
          onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); void utils.platform.users.list.invalidate(); void utils.platformCompanies.overview.invalidate(); }}
        />
      ) : (
        <Card className="border-dashed border-white/15 bg-slate-900/40 text-slate-300"><CardContent className="p-8 text-center text-sm">Cadastre um novo usuário em uma empresa ou use os filtros ao lado para gerenciar os acessos.</CardContent></Card>
      )}
    </div>
  </DashboardLayout>;
}

function CreatePlatformUserCard({ companies, defaultCompanyId, onCancel, onCreated }: { companies: Array<{ id: number; name: string }>; defaultCompanyId: string; onCancel: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ companyId: defaultCompanyId, userName: "", email: "", password: "", role: "promoter" as "company_admin" | "supervisor" | "promoter" });
  const create = trpc.platform.users.create.useMutation({
    onSuccess: (data) => { toast.success(`Usuário criado. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); onCreated(); },
    onError: (e) => toast.error(e.message),
  });
  const submit = () => {
    if (!form.companyId) return toast.info("Selecione a empresa do usuário.");
    if (form.userName.trim().length < 2) return toast.info("Informe o nome completo.");
    if (!form.email.trim()) return toast.info("Informe o e-mail.");
    if (form.password.length < 8) return toast.info("A senha precisa ter ao menos 8 caracteres.");
    create.mutate({ companyId: Number(form.companyId), userName: form.userName.trim(), email: form.email.trim(), password: form.password, role: form.role });
  };
  return (
    <Card className="border-white/10 bg-slate-900/70 text-white">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-4 w-4 text-teal-300" />Novo usuário</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label htmlFor="novo-usuario-empresa">Empresa do usuário</Label>
          <select id="novo-usuario-empresa" value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className={sel} required>
            <option value="">Selecione uma empresa ativa</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div><Label htmlFor="novo-usuario-nome">Nome do usuário</Label><Input id="novo-usuario-nome" value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} placeholder="Nome do responsável" className={inp} /></div>
        <div><Label htmlFor="novo-usuario-email">E-mail de acesso</Label><Input id="novo-usuario-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@empresa.com" className={inp} /></div>
        <div>
          <Label htmlFor="novo-usuario-papel">Permissão</Label>
          <select id="novo-usuario-papel" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })} className={sel}>
            <option value="promoter">Promotor — operação em campo</option>
            <option value="supervisor">Supervisor — equipes e roteiros</option>
            <option value="company_admin">Administrador — usuários e configurações</option>
          </select>
        </div>
        <div>
          <Label htmlFor="novo-usuario-senha">Senha inicial</Label>
          <PasswordInput id="novo-usuario-senha" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo de 8 caracteres" className={`${inp} border-slate-700 bg-slate-950 text-white`} />
          <p className="mt-1 text-xs text-slate-400">A senha é armazenada protegida e não poderá ser visualizada depois.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={create.isPending} onClick={submit} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Criar usuário</Button>
          <Button variant="outline" className="border-white/20 text-white" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}
