import { useEffect, useMemo, useState } from "react";
import { Copy, KeyRound, Loader2, MessageCircle, Pencil, Plus, Shield, Store, UserPlus, UsersRound } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { trpc } from "@/lib/trpc";
import { ENTITLEMENT_CATALOG, ROLE_FEATURE_CEILING, type CompanyRole, type EntitlementKey, type PermissionMode } from "@shared/entitlements";
import { toast } from "sonner";

const ROLE_LABEL: Record<string, string> = {
  company_admin: "Administrador",
  supervisor: "Supervisor",
  promoter: "Promotor",
};
const MODE_LABEL: Record<PermissionMode, string> = { inherit: "Herdar", allow: "Permitir", deny: "Bloquear" };
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const inp = "mt-1 border-white/15 bg-slate-950/60 text-white";
const sel = "mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white";

type Member = {
  id: number;
  userName: string;
  email: string;
  role: CompanyRole;
  active: boolean;
  employeeCode?: string | null;
  workStartTime?: string | null;
  workEndTime?: string | null;
};

function hhmm(value?: string | null) {
  return value ? String(value).slice(0, 5) : "";
}

function selfMemberId(userId?: number) {
  return userId && userId < 0 ? -userId : null;
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const list = trpc.companyUsers.list.useQuery(undefined, { staleTime: 10000 });
  const access = trpc.entitlements.mine.useQuery(undefined, { staleTime: 60000 });
  const hasFieldOperations = Boolean(access.data?.effective?.fieldOperations);
  const stores = trpc.operations.stores.list.useQuery(undefined, { staleTime: 30000, enabled: hasFieldOperations, retry: false });
  const weekly = trpc.operations.routes.weekly.useQuery(undefined, { staleTime: 15000, enabled: hasFieldOperations, retry: false });
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const rows = useMemo(
    () => (list.data || []).filter((m) => `${m.userName} ${m.email}`.toLowerCase().includes(q.trim().toLowerCase())),
    [list.data, q],
  );
  const selected = (list.data || []).find((m) => m.id === selectedId) as Member | undefined;
  const refresh = () => {
    void utils.companyUsers.list.invalidate();
    void utils.operations.routes.weekly.invalidate();
    void utils.operations.promoters.list.invalidate();
  };

  return (
    <DashboardLayout title="Promotores e equipe" description="Cadastre usuários, permissões, jornada e lojas de cada promotor." refreshing={list.isFetching} onRefresh={refresh}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.1fr)]">
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-teal-300" />Equipe ({rows.length})</CardTitle>
            <Button size="sm" className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => { setCreating(true); setSelectedId(null); }}>
              <Plus className="h-4 w-4" /> Novo usuário
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input aria-label="Buscar usuário" placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm border-white/15 bg-slate-950/60 text-white" />
            {list.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
            {list.isError && <p role="alert" className="text-sm text-rose-200">{list.error.message}</p>}
            <div className="space-y-2">
              {rows.map((member) => (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => { setSelectedId(member.id); setCreating(false); }}
                  className={`w-full rounded-xl border p-3 text-left transition ${selectedId === member.id ? "border-teal-300/60 bg-teal-300/10" : "border-white/10 bg-slate-950/40 hover:border-white/25"}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{member.userName}</p>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/10 text-slate-100">{ROLE_LABEL[member.role] || member.role}</Badge>
                      <Badge className={member.active ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/30 text-rose-100"}>{member.active ? "Ativo" : "Inativo"}</Badge>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{member.email}{member.employeeCode ? ` · matrícula ${member.employeeCode}` : ""}</p>
                </button>
              ))}
              {!list.isLoading && rows.length === 0 && (q.trim()
                ? <p className="text-sm text-slate-300">Ninguém encontrado com “{q.trim()}”. Confira o nome ou e-mail.</p>
                : <div className="rounded-2xl border border-dashed border-teal-300/30 bg-teal-300/5 p-5 text-center">
                    <p className="font-bold text-white">Convide seu primeiro promotor</p>
                    <p className="mt-1 text-sm text-slate-300">Cadastre a equipe para ela bater ponto e registrar visitas pelo celular.</p>
                    <Button className="mt-3 h-11 bg-teal-300 font-bold text-slate-950 hover:bg-teal-200" onClick={() => { setCreating(true); setSelectedId(null); }}><Plus className="h-4 w-4" /> Cadastrar promotor</Button>
                  </div>)}
            </div>
          </CardContent>
        </Card>
        {creating ? (
          <CreateUserCard stores={stores.data || []} onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelectedId(id); refresh(); }} />
        ) : selected ? (
          <MemberPanel key={selected.id} member={selected} stores={stores.data} weekly={weekly.data} weeklyReady={!hasFieldOperations || weekly.isSuccess || weekly.isError} storesReady={!hasFieldOperations || stores.isSuccess || stores.isError} selfId={selfMemberId(user?.id)} onChanged={refresh} />
        ) : (
          <Card className="border-dashed border-white/15 bg-slate-900/40 text-slate-300">
            <CardContent className="p-8 text-center text-sm">Selecione um usuário para editar dados, permissões e roteiro, ou cadastre um novo.</CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function CreateUserCard({ stores, onCancel, onCreated }: { stores: Array<{ id: number; name: string }>; onCancel: () => void; onCreated: (id: number) => void }) {
  const [form, setForm] = useState({ userName: "", email: "", password: "", role: "promoter" as CompanyRole, storeIds: [] as number[] });
  const create = trpc.companyUsers.create.useMutation({
    onSuccess: (data) => { toast.success("Usuário criado. Um e-mail com o acesso foi enviado."); onCreated(data.accountId); },
    onError: (e) => toast.error(e.message),
  });
  const toggleStore = (id: number) => setForm((prev) => ({ ...prev, storeIds: prev.storeIds.includes(id) ? prev.storeIds.filter((s) => s !== id) : [...prev.storeIds, id] }));
  const submit = () => {
    if (form.userName.trim().length < 2) return toast.info("Informe o nome completo.");
    if (!form.email.trim()) return toast.info("Informe o e-mail.");
    if (form.password.length < 8) return toast.info("A senha precisa ter ao menos 8 caracteres.");
    create.mutate({
      userName: form.userName.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      storeIds: form.role === "promoter" ? form.storeIds : undefined,
    });
  };
  return (
    <Card className="border-white/10 bg-slate-900/70 text-white">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-4 w-4 text-teal-300" />Novo usuário</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label>Nome</Label><Input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} className={inp} /></div>
        <div><Label>E-mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inp} /></div>
        <div><Label>Senha inicial</Label><PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={`${inp} border-slate-700 bg-slate-950 text-white`} /></div>
        <div>
          <Label>Papel</Label>
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as CompanyRole })} className={sel}>
            <option value="promoter">Promotor</option>
            <option value="supervisor">Supervisor</option>
            <option value="company_admin">Administrador</option>
          </select>
        </div>
        {form.role === "promoter" && (
          <StorePicker stores={stores} selected={form.storeIds} onToggle={toggleStore} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={create.isPending} onClick={submit} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Cadastrar</Button>
          <Button variant="outline" className="border-white/20 text-white" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberPanel({ member, stores, weekly, weeklyReady, storesReady, selfId, onChanged }: { member: Member; stores?: Array<{ id: number; name: string }>; weekly?: Array<{ promoterId?: number; weekday: number; storeIds: number[] }>; weeklyReady: boolean; storesReady: boolean; selfId: number | null; onChanged: () => void }) {
  const fail = (e: { message: string }) => toast.error(e.message);
  const update = trpc.companyUsers.update.useMutation({ onSuccess: () => { toast.success("Usuário atualizado."); onChanged(); }, onError: fail });
  const setActive = trpc.companyUsers.setActive.useMutation({ onSuccess: () => { toast.success("Situação atualizada."); onChanged(); }, onError: fail });
  const resetPassword = trpc.companyUsers.resetPassword.useMutation({ onSuccess: () => { toast.success("Senha redefinida."); setNewPassword(""); }, onError: fail });
  const updatePromoter = trpc.companyUsers.updatePromoterManagement.useMutation({ onSuccess: () => { toast.success("Cadastro do promotor salvo."); onChanged(); }, onError: fail });
  const setPermissions = trpc.companyUsers.setPermissions.useMutation({ onSuccess: () => toast.success("Permissões salvas."), onError: fail });
  const assigned = trpc.companyUsers.getPromoterStores.useQuery({ id: member.id }, { enabled: member.role === "promoter", staleTime: 10000 });
  const snapshot = trpc.companyUsers.permissions.useQuery({ id: member.id }, { staleTime: 15000 });

  const [userName, setUserName] = useState(member.userName);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<CompanyRole>(member.role);
  const [employeeCode, setEmployeeCode] = useState(member.employeeCode || "");
  const [workStartTime, setWorkStartTime] = useState(hhmm(member.workStartTime));
  const [workEndTime, setWorkEndTime] = useState(hhmm(member.workEndTime));
  const [storeIds, setStoreIds] = useState<number[]>([]);
  const [routes, setRoutes] = useState<Record<number, number[]>>({});
  const [modes, setModes] = useState<Partial<Record<EntitlementKey, PermissionMode>>>({});
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    setUserName(member.userName);
    setEmail(member.email);
    setRole(member.role);
    setEmployeeCode(member.employeeCode || "");
    setWorkStartTime(hhmm(member.workStartTime));
    setWorkEndTime(hhmm(member.workEndTime));
  }, [member]);

  useEffect(() => {
    if (assigned.data) setStoreIds(assigned.data);
  }, [assigned.data]);

  useEffect(() => {
    if (!weekly) return;
    const next: Record<number, number[]> = {};
    for (const item of weekly) {
      if (item.promoterId !== member.id) continue;
      next[item.weekday] = Array.isArray(item.storeIds) ? item.storeIds : [];
    }
    setRoutes(next);
  }, [member.id, weekly]);

  useEffect(() => {
    if (snapshot.data?.memberOverrides) setModes(snapshot.data.memberOverrides);
  }, [snapshot.data]);

  const toggleStore = (id: number) => setStoreIds((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  const toggleDayStore = (day: number, id: number) => {
    setRoutes((prev) => {
      const current = prev[day] || [];
      const next = current.includes(id) ? current.filter((s) => s !== id) : [...current, id];
      const copy = { ...prev };
      if (next.length) copy[day] = next;
      else delete copy[day];
      return copy;
    });
  };
  const saveProfile = () => {
    if (userName.trim().length < 2) return toast.info("Informe o nome completo.");
    if (member.role === "promoter") {
      if (workStartTime && workEndTime && workEndTime <= workStartTime) return toast.info("O fim da jornada precisa ser posterior ao início.");
      updatePromoter.mutate({
        id: member.id,
        userName: userName.trim(),
        email: email.trim(),
        employeeCode: employeeCode.trim() || null,
        workStartTime: workStartTime || null,
        workEndTime: workEndTime || null,
        weeklyRoutes: weeklyReady ? Object.entries(routes).filter(([, ids]) => ids.length).map(([weekday, ids]) => ({ weekday: Number(weekday), storeIds: ids })) : undefined,
        storeIds: storesReady ? storeIds : undefined,
      });
      return;
    }
    update.mutate({ id: member.id, userName: userName.trim(), email: email.trim(), role });
  };
  const savePerms = () => {
    const ceiling = new Set(ROLE_FEATURE_CEILING[member.role]);
    setPermissions.mutate({
      id: member.id,
      permissions: ENTITLEMENT_CATALOG.filter((f) => ceiling.has(f.key)).map((f) => ({ featureKey: f.key, mode: modes[f.key] ?? "inherit" })),
    });
  };
  const isSelf = selfId === member.id;

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-slate-900/70 text-white">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-lg"><Pencil className="h-4 w-4 text-teal-300" />{member.userName}</CardTitle>
          <Badge className={member.active ? "bg-emerald-500/20 text-emerald-100" : "bg-rose-500/30 text-rose-100"}>{member.active ? "Ativo" : "Inativo"}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {member.active && member.id !== selfId && <ShareAccess name={member.userName} email={member.email} />}
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nome</Label><Input value={userName} onChange={(e) => setUserName(e.target.value)} className={inp} /></div>
            <div><Label>E-mail</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inp} /></div>
            {member.role !== "promoter" && (
              <div>
                <Label>Papel</Label>
                <select value={role} onChange={(e) => setRole(e.target.value as CompanyRole)} className={sel} disabled={isSelf}>
                  <option value="company_admin">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="promoter">Promotor</option>
                </select>
              </div>
            )}
            {member.role === "promoter" && (
              <>
                <div><Label>Matrícula</Label><Input value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} className={inp} /></div>
                <div><Label>Início da jornada</Label><Input type="time" value={workStartTime} onChange={(e) => setWorkStartTime(e.target.value)} className={inp} /></div>
                <div><Label>Fim da jornada</Label><Input type="time" value={workEndTime} onChange={(e) => setWorkEndTime(e.target.value)} className={inp} /></div>
              </>
            )}
          </div>
          <Button disabled={update.isPending || updatePromoter.isPending} onClick={saveProfile} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar cadastro</Button>
        </CardContent>
      </Card>

      {member.role === "promoter" && (
        <>
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Store className="h-4 w-4 text-teal-300" />Lojas atribuídas</CardTitle></CardHeader>
            <CardContent>
              <StorePicker stores={stores || []} selected={storeIds} onToggle={toggleStore} />
            </CardContent>
          </Card>
          <Card className="border-white/10 bg-slate-900/70 text-white">
            <CardHeader><CardTitle className="text-base">Programação semanal</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {WEEKDAYS.map((label, day) => (
                <div key={day} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <p className="text-sm font-semibold">{label}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(stores || []).map((store) => {
                      const on = (routes[day] || []).includes(store.id);
                      return (
                        <button key={store.id} type="button" onClick={() => toggleDayStore(day, store.id)} className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-teal-300/50 bg-teal-300/15 text-teal-100" : "border-white/10 text-slate-300"}`}>
                          {store.name}
                        </button>
                      );
                    })}
                    {!(stores || []).length && <p className="text-xs text-slate-400">Cadastre lojas para montar o roteiro.</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      <Card className="border-white/10 bg-slate-900/70 text-white">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-teal-300" />Permissões de módulos</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {snapshot.isLoading && <p className="text-slate-400">Carregando...</p>}
          {ENTITLEMENT_CATALOG.filter((f) => ROLE_FEATURE_CEILING[member.role].includes(f.key)).map((f) => (
            <div key={f.key} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="font-semibold">{f.label}</p>
                <p className="text-xs text-slate-400">{f.description}</p>
              </div>
              <select value={modes[f.key] ?? "inherit"} onChange={(e) => setModes((prev) => ({ ...prev, [f.key]: e.target.value as PermissionMode }))} className="h-9 rounded-md border border-white/15 bg-slate-950 px-2 text-xs text-white">
                {(Object.keys(MODE_LABEL) as PermissionMode[]).map((mode) => <option key={mode} value={mode}>{MODE_LABEL[mode]}</option>)}
              </select>
            </div>
          ))}
          <Button disabled={setPermissions.isPending} onClick={savePerms} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar permissões</Button>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-slate-900/70 text-white">
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-teal-300" />Acesso</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1"><Label>Nova senha</Label><PasswordInput value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={`${inp} border-slate-700 bg-slate-950 text-white`} /></div>
            <Button disabled={resetPassword.isPending || newPassword.length < 8} onClick={() => resetPassword.mutate({ id: member.id, newPassword })} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Redefinir senha</Button>
          </div>
          <Button
            variant="outline"
            disabled={setActive.isPending || (isSelf && member.active)}
            onClick={() => setActive.mutate({ id: member.id, active: !member.active })}
            className={member.active ? "border-rose-300/40 text-rose-200" : "border-emerald-300/40 text-emerald-200"}
          >
            {member.active ? "Desativar usuário" : "Reativar usuário"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function StorePicker({ stores, selected, onToggle }: { stores: Array<{ id: number; name: string }>; selected: number[]; onToggle: (id: number) => void }) {
  if (!stores.length) return <p className="text-xs text-slate-400">Nenhuma loja cadastrada. A atribuição é opcional.</p>;
  return (
    <div>
      <Label>Lojas do promotor (opcional)</Label>
      <div className="mt-2 flex flex-wrap gap-2">
        {stores.map((store) => {
          const on = selected.includes(store.id);
          return (
            <button key={store.id} type="button" onClick={() => onToggle(store.id)} className={`rounded-lg border px-2 py-1 text-xs ${on ? "border-teal-300/50 bg-teal-300/15 text-teal-100" : "border-white/10 text-slate-300"}`}>
              {store.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Texto pronto para mandar o acesso pelo WhatsApp (sem senha: a senha inicial é passada pelo admin). */
function accessMessage(name: string, email: string) {
  const first = name.trim().split(/\s+/)[0] || name;
  return [
    `Olá, ${first}! Seu acesso ao GondUp está pronto.`,
    "",
    "1. Abra https://gondup.com no Chrome do celular",
    `2. Entre com o e-mail: ${email}`,
    "3. Use a senha inicial que eu te passei (ou toque em \"Esqueci minha senha\")",
    "4. Toque em \"Baixar aplicativo\" para instalar o app na tela inicial",
  ].join("\n");
}

function ShareAccess({ name, email }: { name: string; email: string }) {
  const text = accessMessage(name, email);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success("Texto copiado. Cole no WhatsApp ou onde preferir."); }
    catch { toast.error("Não foi possível copiar. Use o botão do WhatsApp."); }
  };
  return (
    <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/5 p-3">
      <p className="text-sm font-semibold text-emerald-100">Enviar o acesso para {name.split(" ")[0]}</p>
      <p className="mt-0.5 text-xs text-slate-300">Mensagem pronta com o link e o e-mail de login (a senha não vai no texto).</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-500 px-3 text-sm font-bold text-white hover:bg-emerald-400">
          <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
        </a>
        <Button type="button" variant="outline" className="h-10 border-white/20 text-white" onClick={() => void copy()}><Copy className="mr-1.5 h-4 w-4" /> Copiar texto</Button>
      </div>
    </div>
  );
}
