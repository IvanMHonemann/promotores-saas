import { FormEvent, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, CalendarDays, Check, Clock3, KeyRound, Loader2, Pencil, ShieldCheck, Trash2, UserPlus, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { ENTITLEMENT_CATALOG, ENTITLEMENT_KEYS, ROLE_FEATURE_CEILING, type EntitlementKey, type PermissionMode } from "@shared/entitlements";

const roleLabels = { company_admin: "Administrador da empresa", supervisor: "Supervisor", promoter: "Promotor" } as const;
const weekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export default function AdminUsersPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const isCompanyAdmin = user?.role === "company_admin";
  const canManage = isPlatformAdmin || isCompanyAdmin;
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"company_admin" | "supervisor" | "promoter">("promoter");
  const [createStoreIds, setCreateStoreIds] = useState<number[]>([]);
  const [platformCreateMode, setPlatformCreateMode] = useState<"company" | "user">("company");
  const [platformCompanyId, setPlatformCompanyId] = useState("");
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newOwnPassword, setNewOwnPassword] = useState("");
  const [permissionsUserId, setPermissionsUserId] = useState<number | null>(null);
  const [editingPromoterId, setEditingPromoterId] = useState<number | null>(null);
  const [promoterNameDraft, setPromoterNameDraft] = useState("");
  const [promoterEmailDraft, setPromoterEmailDraft] = useState("");
  const [employeeCodeDraft, setEmployeeCodeDraft] = useState("");
  const [workStartDraft, setWorkStartDraft] = useState("");
  const [workEndDraft, setWorkEndDraft] = useState("");
  const [weeklyDraft, setWeeklyDraft] = useState<Record<number, number[]>>({});
  const [assignedStoreIds, setAssignedStoreIds] = useState<number[]>([]);
  const [permissionsDraft, setPermissionsDraft] = useState<Record<EntitlementKey, PermissionMode>>(
    Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, "inherit"])) as Record<EntitlementKey, PermissionMode>,
  );
  const utils = trpc.useUtils();
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const platformUsersQuery = trpc.platform.users.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const companyUsersQuery = trpc.companyUsers.list.useQuery(undefined, { enabled: isCompanyAdmin });
  const entitlementsQuery = trpc.entitlements.mine.useQuery(undefined, { enabled: isCompanyAdmin });
  const hasFieldOperations = Boolean(entitlementsQuery.data?.effective.fieldOperations);
  const promoterStoresQuery = trpc.operations.stores.list.useQuery(undefined, { enabled: isCompanyAdmin && editingPromoterId !== null && hasFieldOperations });
  const createStoresQuery = trpc.operations.stores.list.useQuery(undefined, { enabled: isCompanyAdmin && role === "promoter" && hasFieldOperations, staleTime: 60000 });
  const promoterWeeklyRoutesQuery = trpc.operations.routes.weekly.useQuery(undefined, { enabled: isCompanyAdmin && editingPromoterId !== null && hasFieldOperations });
  const promoterAssignedStoresQuery = trpc.companyUsers.getPromoterStores.useQuery({ id: editingPromoterId! }, { enabled: isCompanyAdmin && editingPromoterId !== null });
  const permissionsQuery = trpc.companyUsers.permissions.useQuery({ id: permissionsUserId ?? 0 }, { enabled: isCompanyAdmin && permissionsUserId !== null });
  const createCompanyMutation = trpc.platform.companies.create.useMutation({ onSuccess: (data) => { toast.success(`Empresa criada. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); setCompanyName(""); setUserName(""); setEmail(""); setPassword(""); utils.platform.companies.list.invalidate(); utils.platform.users.invalidate(); }, onError: (error) => toast.error(error.message) });
  const createUserMutation = trpc.companyUsers.create.useMutation({ onSuccess: (data) => { toast.success(`Usuário criado. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); setUserName(""); setEmail(""); setPassword(""); setRole("promoter"); setCreateStoreIds([]); utils.companyUsers.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const createPlatformUserMutation = trpc.platform.users.create.useMutation({ onSuccess: (data) => { toast.success(`Usuário criado. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); setUserName(""); setEmail(""); setPassword(""); setRole("promoter"); setPlatformCompanyId(""); utils.platform.users.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const platformStatusMutation = trpc.accounts.setActive.useMutation({ onSuccess: () => { toast.success("Status atualizado."); utils.platform.users.invalidate(); utils.accounts.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const companyStatusMutation = trpc.companyUsers.setActive.useMutation({ onSuccess: () => { toast.success("Status atualizado."); utils.companyUsers.list.invalidate(); }, onError: (error) => toast.error(error.message) });
  const platformResetMutation = trpc.accounts.resetPassword.useMutation({ onSuccess: () => { toast.success("Senha redefinida com segurança."); setResettingId(null); setResetPassword(""); }, onError: (error) => toast.error(error.message) });
  const companyResetMutation = trpc.companyUsers.resetPassword.useMutation({ onSuccess: () => { toast.success("Senha redefinida com segurança."); setResettingId(null); setResetPassword(""); }, onError: (error) => toast.error(error.message) });
  const savePermissionsMutation = trpc.companyUsers.setPermissions.useMutation({
    onSuccess: async () => {
      toast.success("Permissões individuais atualizadas.");
      if (permissionsUserId !== null) await utils.companyUsers.permissions.invalidate({ id: permissionsUserId });
      await utils.companyUsers.list.invalidate();
      await utils.entitlements.mine.invalidate();
      setPermissionsUserId(null);
    },
    onError: (error) => toast.error(error.message),
  });
  const ownPasswordMutation = trpc.auth.changePassword.useMutation({ onSuccess: () => { toast.success("Sua senha foi alterada."); setCurrentPassword(""); setNewOwnPassword(""); }, onError: (error) => toast.error(error.message) });
  const savePromoterManagement = trpc.companyUsers.updatePromoterManagement.useMutation({ onSuccess: async () => { toast.success("Cadastro, jornada e roteiro semanal atualizados."); await utils.companyUsers.list.invalidate(); await utils.operations.routes.weekly.invalidate(); setEditingPromoterId(null); }, onError: e => toast.error(e.message || "Não foi possível atualizar o promotor.") });
  const users = isPlatformAdmin ? platformUsersQuery.data ?? [] : companyUsersQuery.data ?? [];

  useEffect(() => {
    const data = permissionsQuery.data;
    if (!data || data.memberAccountId !== permissionsUserId) return;
    setPermissionsDraft(Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, data.memberOverrides[key] ?? "inherit"])) as Record<EntitlementKey, PermissionMode>);
  }, [permissionsQuery.data, permissionsUserId]);

  useEffect(() => {
    if (editingPromoterId === null) return;
    if (promoterWeeklyRoutesQuery.data) {
      const routes = promoterWeeklyRoutesQuery.data.filter((item: any) => item.promoterId === editingPromoterId && item.active);
      setWeeklyDraft(Object.fromEntries(routes.map((item: any) => [item.weekday, item.storeIds || []])));
    }
    if (promoterAssignedStoresQuery.data) {
      setAssignedStoreIds(promoterAssignedStoresQuery.data);
    }
  }, [editingPromoterId, promoterWeeklyRoutesQuery.data]);

  if (!canManage) return <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><Card className="max-w-md"><CardContent className="p-6 text-center"><p className="font-bold text-slate-900">Acesso restrito ao administrador da empresa.</p><Button className="mt-4" onClick={() => navigate("/")}>Voltar ao painel</Button></CardContent></Card></div>;

  const handleCreate = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (isPlatformAdmin && platformCreateMode === "company") createCompanyMutation.mutate({ companyName, userName, email, password }); else if (isPlatformAdmin) createPlatformUserMutation.mutate({ companyId: Number(platformCompanyId), userName, email, password, role }); else createUserMutation.mutate({ userName, email, password, role, storeIds: role === "promoter" ? createStoreIds : undefined }); };
  const handleOwnPassword = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); ownPasswordMutation.mutate({ currentPassword, newPassword: newOwnPassword }); };
  const openPromoterEditor = (account: any) => {
    setPromoterNameDraft(account.userName || "");
    setAssignedStoreIds([]); // will be loaded by query
    setPromoterEmailDraft(account.email || "");
    setEmployeeCodeDraft(account.employeeCode || "");
    setWorkStartDraft(account.workStartTime || "");
    setWorkEndDraft(account.workEndTime || "");
    setWeeklyDraft({});
    setEditingPromoterId(account.id);
  };
  const generateEmployeeCode = () => {
    const code = globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 8).toUpperCase()
      || Math.random().toString(36).slice(2, 10).toUpperCase();
    setEmployeeCodeDraft(`PROM-${code}`);
  };
  const toggleWeeklyStore = (weekday: number, storeId: number, checked: boolean) => {
    setWeeklyDraft((current) => {
      const next = new Set(current[weekday] || []);
      if (checked) next.add(storeId); else next.delete(storeId);
      return { ...current, [weekday]: [...next] };
    });
  };
  const savePromoterProfile = () => {
    if (editingPromoterId === null) return;
    if (promoterNameDraft.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(promoterEmailDraft.trim())) {
      toast.error("Informe um nome válido e um e-mail correto para o promotor.");
      return;
    }
    if (workStartDraft && workEndDraft && workEndDraft <= workStartDraft) {
      toast.error("O fim da jornada precisa ser posterior ao início.");
      return;
    }
    if (hasFieldOperations && (promoterWeeklyRoutesQuery.isLoading || promoterStoresQuery.isLoading)) {
      toast.info("Aguarde o carregamento das lojas e da programação semanal.");
      return;
    }
    if (hasFieldOperations && (promoterWeeklyRoutesQuery.isError || promoterStoresQuery.isError)) {
      toast.error("Não foi possível carregar lojas ou roteiros. Atualize a página antes de salvar.");
      return;
    }
    const weeklyRoutes = hasFieldOperations
      ? weekdays.flatMap((_, weekday) => (weeklyDraft[weekday] || []).length ? [{ weekday, storeIds: weeklyDraft[weekday] }] : [])
      : undefined;
    savePromoterManagement.mutate({
      id: editingPromoterId,
      userName: promoterNameDraft.trim(),
      email: promoterEmailDraft.trim(),
      employeeCode: employeeCodeDraft.trim() || null,
      workStartTime: workStartDraft || null,
      workEndTime: workEndDraft || null,
      weeklyRoutes,
      storeIds: assignedStoreIds,
    });
  };
  const deletePromoter = (account: any) => {
    if (!window.confirm(`Excluir ${account.userName}? O acesso será desativado e o histórico de ponto, visitas e auditoria será preservado.`)) return;
    companyStatusMutation.mutate({ id: account.id, active: false });
  };
  const permissionUser = users.find((account: any) => account.id === permissionsUserId) ?? null;
  const isLoadingUsers = isPlatformAdmin ? platformUsersQuery.isLoading : companyUsersQuery.isLoading;
  const isCreating = createCompanyMutation.isPending || createUserMutation.isPending || createPlatformUserMutation.isPending;
  const isResetting = platformResetMutation.isPending || companyResetMutation.isPending;
  const savePermissions = () => {
    if (permissionsUserId === null) return;
    savePermissionsMutation.mutate({
      id: permissionsUserId,
      permissions: ENTITLEMENT_KEYS.map((featureKey) => ({ featureKey, mode: permissionsDraft[featureKey] })),
    });
  };

  return (
    <DashboardLayout
      title={isPlatformAdmin ? "Empresas e acessos" : "Promotores e equipe"}
      description={isPlatformAdmin ? "Empresas, usuários e dados globais da plataforma." : "Gerencie promotores, acessos, jornadas e roteiros da sua empresa."}
      onRefresh={() => {
        if (isPlatformAdmin) {
          void utils.platform.companies.invalidate();
          void utils.platform.users.invalidate();
        } else {
          void utils.companyUsers.list.invalidate();
          void utils.entitlements.mine.invalidate();
        }
      }}
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          {isCompanyAdmin && <div className="lg:col-span-2"><PromoterManagementSection users={users} loading={isLoadingUsers} onEdit={openPromoterEditor} onDelete={deletePromoter} onReactivate={(account: any) => companyStatusMutation.mutate({ id: account.id, active: true })} statusPending={companyStatusMutation.isPending} /></div>}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-5 w-5 text-red-600" /> {isPlatformAdmin ? (platformCreateMode === "company" ? "Criar nova empresa" : "Criar usuário em uma empresa") : "Adicionar usuário"}</CardTitle></CardHeader><CardContent>{isPlatformAdmin && <div className="mb-4 grid grid-cols-2 gap-2"><Button type="button" variant={platformCreateMode === "company" ? "default" : "outline"} onClick={() => setPlatformCreateMode("company")}>Nova empresa</Button><Button type="button" variant={platformCreateMode === "user" ? "default" : "outline"} onClick={() => setPlatformCreateMode("user")}>Novo usuário</Button></div>}<form onSubmit={handleCreate} className="space-y-4">{isPlatformAdmin && platformCreateMode === "company" && <div className="space-y-2"><Label htmlFor="account-company">Nome da empresa</Label><Input id="account-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex.: Empresa ABC" required /></div>}{isPlatformAdmin && platformCreateMode === "user" && <div className="space-y-2"><Label htmlFor="account-company-select">Empresa do usuário</Label><select id="account-company-select" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={platformCompanyId} onChange={(e) => setPlatformCompanyId(e.target.value)} required><option value="">Selecione uma empresa ativa</option>{companiesQuery.data?.filter((company) => company.active).map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>}<div className="space-y-2"><Label htmlFor="account-user">Nome do usuário</Label><Input id="account-user" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nome do responsável" required /></div><div className="space-y-2"><Label htmlFor="account-email">E-mail de acesso</Label><Input id="account-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@empresa.com" required /></div>{(isCompanyAdmin || (isPlatformAdmin && platformCreateMode === "user")) && <div className="space-y-2"><Label htmlFor="account-role">Permissão</Label><select id="account-role" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="promoter">Promotor — operação em campo</option><option value="supervisor">Supervisor — equipes e roteiros</option><option value="company_admin">Administrador — usuários e configurações</option></select></div>}{isCompanyAdmin && role === "promoter" && hasFieldOperations && (
              <div className="space-y-2">
                <Label>Lojas atribuídas (opcional)</Label>
                <p className="text-xs text-slate-500">Selecione as lojas que este promotor poderá acessar na tela de fotos. Pode deixar em branco.</p>
                {createStoresQuery.isLoading ? <p className="text-sm text-slate-500">Carregando lojas...</p> : !createStoresQuery.data?.length ? <p className="text-sm text-slate-500">Nenhuma loja cadastrada ainda.</p> : (
                  <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 p-2 space-y-1">
                    {createStoresQuery.data.map((store: any) => (
                      <label key={store.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-50">
                        <input type="checkbox" className="accent-teal-600" checked={createStoreIds.includes(store.id)} onChange={(e) => {
                          setCreateStoreIds(prev => e.target.checked ? [...prev, store.id] : prev.filter(id => id !== store.id));
                        }} />
                        <span>{store.name}{store.city ? ` — ${store.city}` : ""}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}<div className="space-y-2"><Label htmlFor="account-password">Senha inicial</Label><PasswordInput id="account-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres" required /><p className="text-xs text-slate-500">A senha é armazenada protegida e não poderá ser visualizada depois.</p></div><Button type="submit" className="w-full bg-red-600 font-bold hover:bg-red-700" disabled={isCreating}>{isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} {isPlatformAdmin && platformCreateMode === "company" ? "Criar empresa" : "Criar usuário"}</Button></form></CardContent></Card>
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Minha senha</CardTitle></CardHeader><CardContent><form onSubmit={handleOwnPassword} className="space-y-3"><PasswordInput placeholder="Senha atual" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required /><PasswordInput minLength={8} placeholder="Nova senha (mínimo de 8 caracteres)" value={newOwnPassword} onChange={(e) => setNewOwnPassword(e.target.value)} required /><Button type="submit" variant="outline" className="w-full" disabled={ownPasswordMutation.isPending}>{ownPasswordMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />} Alterar minha senha</Button></form><p className="mt-3 text-xs leading-relaxed text-slate-500">As senhas existentes nunca são exibidas.</p></CardContent></Card>
          </div>
          <div className="space-y-6">
            {isPlatformAdmin && <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-5 w-5 text-red-600" /> Empresas cadastradas</CardTitle></CardHeader><CardContent>{companiesQuery.isLoading ? <Loading /> : companiesQuery.data?.length ? <div className="space-y-2">{companiesQuery.data.map(company => <div key={company.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><div><p className="font-bold">{company.name}</p><p className="text-xs text-slate-500">Empresa #{company.id}</p></div><Badge className={company.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "border border-white/10 bg-slate-700/60 text-slate-200 hover:bg-slate-700/60"}>{company.active ? "Ativa" : "Bloqueada"}</Badge></div>)}</div> : <Empty />}</CardContent></Card>}
            <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-red-600" /> {isPlatformAdmin ? "Usuários de todas as empresas" : "Usuários cadastrados"}</CardTitle></CardHeader><CardContent>{isLoadingUsers ? <Loading /> : users.length ? <div className="space-y-3">{users.map((account: any) => <div key={account.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100"><UserRound className="h-5 w-5 text-slate-500" /></div><div className="min-w-0"><p className="truncate font-bold text-slate-900">{account.userName}</p><p className="truncate text-xs text-slate-500">Login: {account.email}</p><p className="text-xs text-slate-500">Empresa #{account.companyId} · {roleLabels[account.role as keyof typeof roleLabels]}</p><p className="text-xs text-slate-400">Criado em {new Date(account.createdAt).toLocaleDateString("pt-BR")}</p></div></div><Button size="sm" variant="outline" className={account.active ? "text-red-700" : "text-emerald-700"} disabled={account.id === user?.id || account.id === Math.abs(user?.id ?? 0)} onClick={() => isPlatformAdmin ? platformStatusMutation.mutate({ id: account.id, active: !account.active }) : companyStatusMutation.mutate({ id: account.id, active: !account.active })}>{account.active ? "Bloquear" : "Reativar"}</Button></div><div className="mt-3 border-t border-slate-100 pt-3">{isCompanyAdmin && <Button size="sm" variant="outline" className="mb-2 h-8 gap-2" onClick={() => setPermissionsUserId(account.id)}>Permissões de módulos</Button>}{resettingId === account.id ? <div className="flex flex-col gap-2 sm:flex-row"><PasswordInput minLength={8} placeholder="Nova senha temporária" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /><Button size="sm" className="bg-red-600 hover:bg-red-700" disabled={isResetting || resetPassword.length < 8} onClick={() => isPlatformAdmin ? platformResetMutation.mutate({ id: account.id, newPassword: resetPassword }) : companyResetMutation.mutate({ id: account.id, newPassword: resetPassword })}>{isResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar nova senha"}</Button><Button size="sm" variant="ghost" onClick={() => { setResettingId(null); setResetPassword(""); }}>Cancelar</Button></div> : <Button size="sm" variant="ghost" className="h-8 gap-2 px-0 text-slate-600 hover:text-red-700" onClick={() => setResettingId(account.id)}><KeyRound className="h-3.5 w-3.5" /> Redefinir senha</Button>}</div></div>)}</div> : <Empty />}</CardContent></Card>
          </div>
        </div>
      </div>
      <PromoterEditDialog
        open={editingPromoterId !== null}
        account={users.find((account: any) => account.id === editingPromoterId)}
        promoterName={promoterNameDraft} setPromoterName={setPromoterNameDraft}
        promoterEmail={promoterEmailDraft} setPromoterEmail={setPromoterEmailDraft}
        employeeCode={employeeCodeDraft} setEmployeeCode={setEmployeeCodeDraft}
        workStart={workStartDraft} setWorkStart={setWorkStartDraft}
        workEnd={workEndDraft} setWorkEnd={setWorkEndDraft}
        weeklyDraft={weeklyDraft} toggleWeeklyStore={toggleWeeklyStore}
        assignedStoreIds={assignedStoreIds} setAssignedStoreIds={setAssignedStoreIds}
        hasFieldOperations={hasFieldOperations}
        stores={promoterStoresQuery.data || []}
        storesLoading={promoterStoresQuery.isLoading || promoterWeeklyRoutesQuery.isLoading}
        storesError={promoterStoresQuery.isError || promoterWeeklyRoutesQuery.isError}
        saving={savePromoterManagement.isPending}
        onGenerateCode={generateEmployeeCode}
        onSave={savePromoterProfile}
        onOpenChange={(open: boolean) => { if (!open) setEditingPromoterId(null); }}
      />
      <Dialog open={permissionsUserId !== null} onOpenChange={(open) => { if (!open) setPermissionsUserId(null); }}>
        <DialogContent className="saas-page max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0b1728] text-slate-100 [&_.bg-slate-50]:bg-white/5 [&_.border-slate-200]:border-white/10 [&_.text-slate-500]:text-slate-400 [&_.text-slate-700]:text-slate-300 [&_.text-slate-900]:text-white">
          <DialogHeader>
            <DialogTitle>Permissões de módulos — {permissionUser?.userName || "usuário"}</DialogTitle>
          </DialogHeader>
          {permissionsQuery.isLoading ? <Loading /> : permissionsQuery.error ? (
            <p className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-200">{permissionsQuery.error.message}</p>
          ) : permissionsQuery.data ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Plano: <strong>{permissionsQuery.data.planName}</strong> · Papel: <strong>{roleLabels[permissionsQuery.data.role]}</strong>.
                <span className="block pt-1 text-xs">“Herdar” usa o padrão do papel; permissões adicionais não podem ultrapassar o plano da empresa nem o teto do papel.</span>
              </div>
              <div className="space-y-2">
                {ENTITLEMENT_CATALOG.map((feature) => {
                  const data = permissionsQuery.data;
                  const mode = permissionsDraft[feature.key];
                  const canAllow = data.companyFeatures[feature.key] && ROLE_FEATURE_CEILING[data.role].includes(feature.key);
                  const canDeny = !(data.role === "company_admin" && feature.key === "teamManagement");
                  const enabled = data.effective[feature.key];
                  return (
                    <div key={feature.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{feature.label}</p>
                        <p className="text-xs text-slate-500">{feature.description}</p>
                        <p className={`mt-1 text-xs font-semibold ${enabled ? "text-emerald-300" : "text-slate-500"}`}>Acesso efetivo: {enabled ? "liberado" : "bloqueado"}</p>
                      </div>
                      <Select value={mode} onValueChange={(value: PermissionMode) => setPermissionsDraft({ ...permissionsDraft, [feature.key]: value })}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#0f1d31] text-slate-100">
                          <SelectItem value="inherit">Herdar do papel</SelectItem>
                          <SelectItem value="allow" disabled={!canAllow}>Permitir</SelectItem>
                          <SelectItem value="deny" disabled={!canDeny}>Bloquear</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : <p className="text-sm text-slate-500">Selecione um usuário para editar permissões.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPermissionsUserId(null)}>Cancelar</Button>
            <Button onClick={savePermissions} disabled={!permissionsQuery.data || permissionsQuery.isLoading || savePermissionsMutation.isPending} className="bg-red-600 hover:bg-red-700">
              {savePermissionsMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Salvar permissões
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Loading() { return <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>; }
function Empty() { return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum registro encontrado.</div>; }


function PromoterManagementSection({ users, loading, onEdit, onDelete, onReactivate, statusPending }: any) {
  const promoters = users.filter((account: any) => account.role === "promoter");
  return (
    <Card className="border-teal-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-teal-600" /> Promotores cadastrados</CardTitle>
        <p className="text-sm text-slate-500">Edite dados de acesso, matrícula, jornada e roteiro semanal diretamente no cadastro do promotor.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <Loading /> : promoters.length ? promoters.map((account: any) => (
          <div key={account.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-bold text-slate-900">{account.userName}</p>
              <p className="truncate text-xs text-slate-500">{account.email}</p>
              <p className="mt-1 text-xs text-slate-500">{account.employeeCode ? `Matrícula ${account.employeeCode}` : "Sem matrícula"}{account.workStartTime && account.workEndTime ? ` · ${account.workStartTime}–${account.workEndTime}` : ""}</p>
              <Badge className={`mt-2 ${account.active ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "border border-white/10 bg-slate-700/60 text-slate-200 hover:bg-slate-700/60"}`}>{account.active ? "Ativo" : "Inativo"}</Badge>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-2 border-teal-300/50 text-teal-200 hover:bg-teal-300/10" onClick={() => onEdit(account)}><Pencil className="h-4 w-4" />Editar promotor</Button>
              {account.active
                ? <Button size="sm" variant="outline" className="gap-2 border-rose-300/40 text-rose-200 hover:bg-rose-300/10" disabled={statusPending} onClick={() => onDelete(account)}><Trash2 className="h-4 w-4" />Excluir</Button>
                : <Button size="sm" variant="outline" className="border-emerald-300/40 text-emerald-200 hover:bg-emerald-300/10" disabled={statusPending} onClick={() => onReactivate(account)}>Reativar</Button>}
            </div>
          </div>
        )) : <Empty />}
        <p className="text-xs text-slate-500">Excluir desativa o acesso do promotor, mas preserva registros históricos de ponto, visitas e auditoria.</p>
      </CardContent>
    </Card>
  );
}


function PromoterEditDialog({ open, onOpenChange, account, promoterName, setPromoterName, promoterEmail, setPromoterEmail, employeeCode, setEmployeeCode, workStart, setWorkStart, workEnd, setWorkEnd, weeklyDraft, toggleWeeklyStore, assignedStoreIds, setAssignedStoreIds, hasFieldOperations, stores, storesLoading, storesError, saving, onGenerateCode, onSave }: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="saas-page max-h-[92vh] max-w-4xl overflow-y-auto border-white/10 bg-[#0b1728] text-slate-100 [&_.bg-slate-50]:bg-white/5 [&_.border-slate-200]:border-white/10 [&_.text-slate-500]:text-slate-400 [&_.text-slate-700]:text-slate-300 [&_.text-slate-900]:text-white">
        <DialogHeader>
          <DialogTitle>Editar promotor — {account?.userName || "carregando"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <section className="space-y-4 rounded-xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 font-bold text-slate-900"><Pencil className="h-4 w-4 text-teal-600" />Dados operacionais</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="promoter-name">Nome</Label><Input id="promoter-name" className="mt-1" maxLength={255} value={promoterName} onChange={(event) => setPromoterName(event.target.value)} required /></div>
              <div><Label htmlFor="promoter-email">E-mail de acesso</Label><Input id="promoter-email" className="mt-1" type="email" maxLength={320} value={promoterEmail} onChange={(event) => setPromoterEmail(event.target.value)} required /></div>
            </div>
            <div>
              <Label htmlFor="promoter-employee-code">Matrícula</Label>
              <div className="mt-1 flex gap-2">
                <Input id="promoter-employee-code" maxLength={50} value={employeeCode} onChange={(event) => setEmployeeCode(event.target.value)} placeholder="Informe uma matrícula ou gere uma aleatória" />
                <Button type="button" variant="outline" className="shrink-0 border-teal-300/50 text-teal-200 hover:bg-teal-300/10" onClick={onGenerateCode}>Gerar aleatória</Button>
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-teal-600" />Horário de trabalho</Label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <div><Label htmlFor="promoter-work-start" className="text-xs text-slate-500">Início</Label><Input id="promoter-work-start" type="time" value={workStart} onChange={(event) => setWorkStart(event.target.value)} /></div>
                <div><Label htmlFor="promoter-work-end" className="text-xs text-slate-500">Fim</Label><Input id="promoter-work-end" type="time" value={workEnd} onChange={(event) => setWorkEnd(event.target.value)} /></div>
              </div>
              <p className="mt-2 text-xs text-slate-500">Os horários são informativos e podem ser deixados em branco.</p>
            </div>
          </section>

          <section className="space-y-4 rounded-xl border border-slate-200 p-4">
            <h3 className="flex items-center gap-2 font-bold text-slate-900"><Building2 className="h-4 w-4 text-teal-600" />Lojas atribuídas</h3>
            <p className="text-sm text-slate-500">Selecione as lojas que este promotor poderá acessar na tela de fotos. A atribuição é opcional — o cadastro pode ser concluído sem lojas.</p>
            {storesLoading ? <p className="text-sm text-slate-500">Carregando lojas...</p> : !stores.length ? <p className="text-sm text-slate-500">Nenhuma loja cadastrada ainda.</p> : (
              <div className="grid max-h-60 gap-1 overflow-y-auto sm:grid-cols-2">
                {stores.map((store: any) => (
                  <label key={store.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-white">
                    <input type="checkbox" className="mt-1 accent-teal-600" checked={assignedStoreIds?.includes(store.id)} onChange={(e) => {
                      setAssignedStoreIds((prev: number[]) => e.target.checked ? [...(prev || []), store.id] : (prev || []).filter((id: number) => id !== store.id));
                    }} />
                    <span className="min-w-0"><span className="block font-medium">{store.name}</span><span className="text-xs text-slate-500">{store.city}{store.state ? ` — ${store.state}` : ""}</span></span>
                  </label>
                ))}
              </div>
            )}
          </section>
          <section className="space-y-4 rounded-xl border border-slate-200 p-4">
            <div>
              <h3 className="flex items-center gap-2 font-bold text-slate-900"><CalendarDays className="h-4 w-4 text-teal-600" />Roteiro semanal fixo</h3>
              <p className="mt-1 text-sm text-slate-500">Escolha as lojas de cada dia. O roteiro do dia será exibido automaticamente no painel inicial do promotor.</p>
            </div>
            {!hasFieldOperations ? <p className="rounded-lg border border-amber-300/20 bg-amber-400/10 p-3 text-sm text-amber-100">A programação de visitas exige que o módulo de operações de campo esteja liberado no plano da empresa.</p> : storesLoading ? <Loading /> : storesError ? <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-200">Não foi possível carregar lojas ou roteiros. Atualize a página e tente novamente.</p> : !stores.length ? <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Cadastre lojas no módulo de operações antes de montar o roteiro semanal.</p> : (
              <div className="space-y-2">
                {weekdays.map((day, weekday) => {
                  const selected = weeklyDraft[weekday] || [];
                  return (
                    <details key={weekday} open={weekday === 1} className="rounded-xl border border-slate-200 bg-slate-50">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 font-semibold text-slate-800">
                        <span>{day}</span><Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">{selected.length} loja(s)</Badge>
                      </summary>
                      <div className="grid max-h-52 gap-1 overflow-y-auto border-t border-slate-200 p-2 sm:grid-cols-2">
                        {stores.map((store: any) => <label key={store.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-white">
                          <input type="checkbox" className="mt-1 accent-teal-600" checked={selected.includes(store.id)} onChange={(event) => toggleWeeklyStore(weekday, store.id, event.target.checked)} />
                          <span className="min-w-0"><span className="block font-medium">{store.name}</span><span className="text-xs text-slate-500">{store.city}{store.state ? ` — ${store.state}` : ""}</span></span>
                        </label>)}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" className="bg-teal-600 text-white hover:bg-teal-700" onClick={onSave} disabled={saving || (hasFieldOperations && (storesLoading || storesError))}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Salvar cadastro e roteiro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
