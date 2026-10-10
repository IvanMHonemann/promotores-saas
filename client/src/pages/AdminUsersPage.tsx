import { FormEvent, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Check, KeyRound, Loader2, LogOut, ShieldCheck, UserPlus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const roleLabels = { company_admin: "Administrador da empresa", supervisor: "Supervisor", promoter: "Promotor" } as const;

export default function AdminUsersPage() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const isCompanyAdmin = user?.role === "company_admin";
  const canManage = isPlatformAdmin || isCompanyAdmin;
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"company_admin" | "supervisor" | "promoter">("promoter");
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newOwnPassword, setNewOwnPassword] = useState("");
  const utils = trpc.useUtils();
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const platformUsersQuery = trpc.platform.users.useQuery(undefined, { enabled: isPlatformAdmin });
  const companyUsersQuery = trpc.companyUsers.list.useQuery(undefined, { enabled: isCompanyAdmin });
  const createCompanyMutation = trpc.platform.companies.create.useMutation({ onSuccess: (data) => { toast.success(`Empresa criada. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); setCompanyName(""); setUserName(""); setEmail(""); setPassword(""); utils.platform.companies.list.invalidate(); utils.platform.users.invalidate(); }, onError: (error) => toast.error(error.message) });
  const createUserMutation = trpc.companyUsers.create.useMutation({ onSuccess: (data) => { toast.success(`Usuário criado. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); setUserName(""); setEmail(""); setPassword(""); setRole("promoter"); utils.companyUsers.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const platformStatusMutation = trpc.accounts.setActive.useMutation({ onSuccess: () => { toast.success("Status atualizado."); utils.platform.users.invalidate(); utils.accounts.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const companyStatusMutation = trpc.companyUsers.setActive.useMutation({ onSuccess: () => { toast.success("Status atualizado."); utils.companyUsers.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const platformResetMutation = trpc.accounts.resetPassword.useMutation({ onSuccess: () => { toast.success("Senha redefinida com segurança."); setResettingId(null); setResetPassword(""); }, onError: (error) => toast.error(error.message) });
  const companyResetMutation = trpc.companyUsers.resetPassword.useMutation({ onSuccess: () => { toast.success("Senha redefinida com segurança."); setResettingId(null); setResetPassword(""); }, onError: (error) => toast.error(error.message) });
  const ownPasswordMutation = trpc.auth.changePassword.useMutation({ onSuccess: () => { toast.success("Sua senha foi alterada."); setCurrentPassword(""); setNewOwnPassword(""); }, onError: (error) => toast.error(error.message) });

  if (!canManage) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-md"><CardContent className="p-6 text-center"><p className="font-bold text-slate-900">Acesso restrito ao administrador da empresa.</p><Button className="mt-4" onClick={() => navigate("/")}>Voltar ao painel</Button></CardContent></Card></div>;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (isPlatformAdmin) createCompanyMutation.mutate({ companyName, userName, email, password }); else createUserMutation.mutate({ userName, email, password, role }); };
  const handleOwnPassword = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); ownPasswordMutation.mutate({ currentPassword, newPassword: newOwnPassword }); };
  const users = isPlatformAdmin ? platformUsersQuery.data ?? [] : companyUsersQuery.data ?? [];
  const isLoadingUsers = isPlatformAdmin ? platformUsersQuery.isLoading : companyUsersQuery.isLoading;
  const isCreating = createCompanyMutation.isPending || createUserMutation.isPending;
  const isResetting = platformResetMutation.isPending || companyResetMutation.isPending;
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else navigate("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600"><Users className="h-5 w-5" /></div><div><p className="font-black tracking-tight">{isPlatformAdmin ? "Administração da plataforma" : "Equipe da empresa"}</p><p className="text-xs text-slate-400">{isPlatformAdmin ? "Empresas, usuários e dados globais" : "Usuários desta empresa"}</p></div></div><Button variant="outline" size="sm" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800" onClick={() => logout()}><LogOut className="mr-2 h-4 w-4" /> Sair</Button></div></header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><Button variant="ghost" className="mb-2 -ml-3 gap-2" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Voltar</Button><h1 className="text-2xl font-black sm:text-3xl">{isPlatformAdmin ? "Empresas e acessos" : "Usuários da empresa"}</h1><p className="mt-1 text-sm text-slate-500">{isPlatformAdmin ? "O administrador global pode visualizar e administrar qualquer empresa sem pertencer a um tenant." : "Você pode criar usuários e definir permissões somente dentro da sua empresa."}</p></div><Badge className="w-fit bg-emerald-100 text-emerald-800 hover:bg-emerald-100"><Check className="mr-1 h-3.5 w-3.5" /> {isPlatformAdmin ? "Administrador global" : "Administrador da empresa"}</Badge></div>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-red-600" /> {isPlatformAdmin ? "Criar nova empresa" : "Adicionar usuário"}</CardTitle></CardHeader><CardContent><form onSubmit={handleCreate} className="space-y-4">{isPlatformAdmin && <div className="space-y-2"><Label htmlFor="account-company">Empresa</Label><Input id="account-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Empresa ABC" required /></div>}<div className="space-y-2"><Label htmlFor="account-user">Nome do usuário</Label><Input id="account-user" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do responsável" required /></div><div className="space-y-2"><Label htmlFor="account-email">E-mail de acesso</Label><Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required /></div>{isCompanyAdmin && <div className="space-y-2"><Label htmlFor="account-role">Permissão</Label><select id="account-role" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="promoter">Promotor — operação em campo</option><option value="supervisor">Supervisor — equipes e roteiros</option><option value="company_admin">Administrador — usuários e configurações</option></select></div>}<div className="space-y-2"><Label htmlFor="account-password">Senha inicial</Label><PasswordInput id="account-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" required /><p className="text-xs text-slate-500">A senha é armazenada protegida e não poderá ser visualizada depois.</p></div><Button type="submit" className="w-full bg-red-600 font-bold hover:bg-red-700" disabled={isCreating}>{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} {isPlatformAdmin ? "Criar empresa" : "Criar usuário"}</Button></form></CardContent></Card>
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Minha senha</CardTitle></CardHeader><CardContent><form onSubmit={handleOwnPassword} className="space-y-3"><PasswordInput placeholder="Senha atual" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /><PasswordInput minLength={8} placeholder="Nova senha (mínimo de 8 caracteres)" value={newOwnPassword} onChange={(e) => setNewOwnPassword(e.target.value)} required /><Button type="submit" variant="outline" className="w-full" disabled={ownPasswordMutation.isPending}>{ownPasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Alterar minha senha</Button></form><p className="mt-3 text-xs leading-relaxed text-slate-500">As senhas existentes nunca são exibidas.</p></CardContent></Card>
          </div>
          <div className="space-y-6">
            {isPlatformAdmin && <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-red-600" /> Empresas cadastradas</CardTitle></CardHeader><CardContent>{companiesQuery.isLoading ? <Loading /> : companiesQuery.data?.length ? <div className="space-y-2">{companiesQuery.data.map(company => <div key={company.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div><p className="font-bold">{company.name}</p><p className="text-xs text-slate-500">Empresa #{company.id}</p></div><Badge className={company.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}>{company.active ? "Ativa" : "Bloqueada"}</Badge></div>)}</div> : <Empty />}</CardContent></Card>}
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-red-600" /> {isPlatformAdmin ? "Usuários de todas as empresas" : "Usuários cadastrados"}</CardTitle></CardHeader><CardContent>{isLoadingUsers ? <Loading /> : users.length ? <div className="space-y-3">{users.map(account => <div key={account.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100"><UserRound className="h-5 w-5 text-slate-500" /></div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{account.userName}</p><p className="truncate text-xs text-slate-500">Login: {account.email}</p><p className="text-xs text-slate-500">Empresa #{account.companyId} · {roleLabels[account.role]}</p><p className="text-xs text-slate-400">Criado em {new Date(account.createdAt).toLocaleDateString("pt-BR")}</p></div></div><Button size="sm" variant="outline" className={account.active ? "text-red-700" : "text-emerald-700"} disabled={account.id === user?.id || account.id === Math.abs(user?.id ?? 0)} onClick={() => isPlatformAdmin ? platformStatusMutation.mutate({ id: account.id, active: !account.active }) : companyStatusMutation.mutate({ id: account.id, active: !account.active })}>{account.active ? "Bloquear" : "Reativar"}</Button></div><div className="mt-3 border-t border-slate-100 pt-3">{resettingId === account.id ? <div className="flex flex-col gap-2 sm:flex-row"><PasswordInput minLength={8} placeholder="Nova senha temporária" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /><Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={isResetting || resetPassword.length < 8} onClick={() => isPlatformAdmin ? platformResetMutation.mutate({ id: account.id, newPassword: resetPassword }) : companyResetMutation.mutate({ id: account.id, newPassword: resetPassword })}>{isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}</Button><Button size="sm" variant="ghost" onClick={() => { setResettingId(null); setResetPassword(""); }}>Cancelar</Button></div> : <Button size="sm" variant="ghost" className="h-8 gap-2 px-0 text-slate-600 hover:text-red-700" onClick={() => setResettingId(account.id)}><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</Button>}</div></div>)}</div> : <Empty />}</CardContent></Card>
          </div>
        </div>
      </div>
    </main>
  );
}

function Loading() { return <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>; }
function Empty() { return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</div>; }
