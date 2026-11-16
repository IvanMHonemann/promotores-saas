import { FormEvent, useEffect, useState } from "react";
import { Building2, Clock3, KeyRound, Minus, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { hasPersonalTimeClock } from "@shared/personalPonto";
import { isCompanyManager } from "@shared/companyAccess";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { MemberRegistryFields, registryFromMember } from "@/components/registry/MemberRegistryFields";
import { emptyMemberRegistry, type MemberRegistry } from "@shared/registryFields";

const roleLabels: Record<string, string> = {
  platform_admin: "Administrador geral",
  company_admin: "Administrador da empresa",
  supervisor: "Supervisor",
  promoter: "Promotor",
};

function formatMinutes(minutes: number) {
  const absolute = Math.abs(minutes);
  return `${minutes < 0 ? "-" : ""}${Math.floor(absolute / 60)}h ${String(absolute % 60).padStart(2, "0")}min`;
}

export default function MyAccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const isPlatformAdmin = user?.role === "platform_admin";
  const entitlements = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && !isPlatformAdmin),
  });
  const canViewTimeBank = Boolean(entitlements.data?.effective?.timeTracking);
  // Administrador da empresa não bate ponto: sem banco de horas pessoal (só o da equipe, no menu).
  const isCompanyAdmin = isCompanyManager(user?.role);
  const showPersonalTimeBank = hasPersonalTimeClock(user?.role);
  const summary = trpc.timeTracking.myTimeSummary.useQuery(undefined, {
    enabled: Boolean(user && showPersonalTimeBank && canViewTimeBank),
  });
  const profile = trpc.registry.myProfile.useQuery(undefined, { enabled: Boolean(user) && !isPlatformAdmin });
  const [identity, setIdentity] = useState<MemberRegistry>(emptyMemberRegistry());
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  useEffect(() => {
    if (profile.data && profile.data.kind === "member") {
      setIdentity(registryFromMember(profile.data.registry));
      setNewEmail(profile.data.email || user?.email || "");
    }
  }, [profile.data, user?.email]);
  const saveIdentity = trpc.registry.saveMyIdentity.useMutation({
    onSuccess: () => { toast.success("Seus dados cadastrais foram salvos."); void profile.refetch(); },
    onError: (error) => toast.error(error.message),
  });
  const changeEmail = trpc.registry.changeMyEmail.useMutation({
    onSuccess: () => { toast.success("E-mail atualizado."); setEmailPassword(""); void profile.refetch(); },
    onError: (error) => toast.error(error.message || "Não foi possível alterar o e-mail."),
  });
  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada com sucesso.");
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => toast.error(error.message || "Não foi possível alterar a senha."),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    changePassword.mutate({ currentPassword, newPassword });
  };
  const balance = summary.data?.balanceMinutes ?? 0;
  const BalanceIcon = balance > 0 ? TrendingUp : balance < 0 ? TrendingDown : Minus;
  const balanceLabel = balance > 0 ? "Horas extras acumuladas" : balance < 0 ? "Horas devidas" : "Jornada equilibrada";
  const balanceColor = balance > 0 ? "text-emerald-700" : balance < 0 ? "text-rose-700" : "text-slate-700";

  useEffect(() => {
    const targetId = window.location.hash.slice(1);
    if (!targetId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(decodeURIComponent(targetId))?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <DashboardLayout title="Minha conta" description={isCompanyAdmin || isPlatformAdmin ? "Confira seus dados e a segurança de acesso." : "Confira seus dados, banco de horas e segurança de acesso."}>
      <div className="max-w-5xl space-y-6">
        {isCompanyAdmin ? (
          canViewTimeBank && (
            <a data-testid="team-time-bank-link" href="/banco-de-horas" className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-teal-200 hover:bg-white/5">
              <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Ver o banco de horas dos funcionários</span>
              <span aria-hidden>→</span>
            </a>
          )
        ) : (
        <section id="banco-de-horas" className="scroll-mt-6">
          {isPlatformAdmin ? (
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardContent className="p-5 text-sm text-slate-700">
                O banco de horas é calculado para usuários vinculados a uma empresa e com marcações de ponto.
              </CardContent>
            </Card>
          ) : entitlements.isLoading ? (
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardContent className="p-5 text-sm text-slate-700">Verificando acesso ao banco de horas…</CardContent>
            </Card>
          ) : !canViewTimeBank ? (
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardContent className="p-5 text-sm text-slate-700">
                O banco de horas não está habilitado para este plano ou usuário.
              </CardContent>
            </Card>
          ) : (
            <Card className="border-teal-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <Clock3 className="h-5 w-5 text-teal-700" />
                  Banco de horas · {summary.data?.periodLabel || "Mês atual"}
                </CardTitle>
                <p className="text-sm text-slate-600">
                  Cálculo baseado nas marcações de ponto registradas neste mês. Jornada padrão considerada: 8 horas por dia com marcação.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Horas trabalhadas</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {summary.isLoading ? "--" : formatMinutes(summary.data?.workedMinutes ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Jornada prevista</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">
                      {summary.isLoading ? "--" : formatMinutes(summary.data?.expectedMinutes ?? 0)}
                    </p>
                  </div>
                  <div className={`rounded-xl border p-4 ${balance > 0 ? "border-emerald-200 bg-emerald-50" : balance < 0 ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-slate-50"}`}>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-600">Saldo do banco</p>
                    <p className={`mt-2 flex items-center gap-2 text-2xl font-black ${balanceColor}`}>
                      {summary.isLoading ? "--" : <><BalanceIcon className="h-6 w-6" />{formatMinutes(balance)}</>}
                    </p>
                    <p className={`mt-1 text-xs font-bold ${balanceColor}`}>
                      {summary.isLoading ? "Consultando…" : balanceLabel}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  Dias com marcação: <strong className="text-slate-950">{summary.data?.daysTracked ?? 0}</strong>
                  {summary.data?.openShift && <span className="ml-2 font-semibold text-amber-700">· Jornada atual em andamento</span>}
                </p>
              </CardContent>
            </Card>
          )}
        </section>
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-bold text-white">Dados e segurança da conta</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            <div id="dados-usuario" className="scroll-mt-6">
              <Card className="h-full border-slate-200 bg-white shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-950">
                    <UserRound className="h-5 w-5 text-teal-700" />
                    Dados do usuário
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="font-semibold text-slate-700">Nome</Label>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">{user?.name || "Não informado"}</p>
                  </div>
                  <div>
                    <Label className="font-semibold text-slate-700">E-mail atual</Label>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">{profile.data && profile.data.kind === "member" ? profile.data.email : (user?.email || "Não informado")}</p>
                  </div>
                  <div>
                    <Label className="font-semibold text-slate-700">Perfil de acesso</Label>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">
                      {roleLabels[user?.role || ""] || user?.role || "Não informado"}
                    </p>
                  </div>
                  {user?.companyId && (
                    <div>
                      <Label className="font-semibold text-slate-700">Empresa</Label>
                      <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">{(entitlements.data as any)?.companyName || "Sua empresa"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div id="seguranca" className="scroll-mt-6">
            <Card className="h-full border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-slate-950">
                  <KeyRound className="h-5 w-5 text-teal-700" />
                  Alterar senha
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label htmlFor="current-password" className="font-semibold text-slate-700">Senha atual</Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      className="mt-1 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-password" className="font-semibold text-slate-700">Nova senha</Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      required
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      className="mt-1 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500"
                    />
                  </div>
                  <Button type="submit" disabled={changePassword.isPending} className="w-full bg-teal-700 font-bold text-white hover:bg-teal-800">
                    {changePassword.isPending ? "Salvando…" : "Salvar nova senha"}
                  </Button>
                </form>
              </CardContent>
            </Card>
            </div>
          </div>
        </section>

        {!isPlatformAdmin && (
          <section id="dados-cadastrais" className="scroll-mt-6 space-y-3">
            <h2 className="text-lg font-bold text-white">Dados cadastrais</h2>
            {(user?.role === "company_admin" || user?.role === "supervisor") && (
              <a href="/dados-empresa" className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-semibold text-teal-200 hover:bg-white/5">
                <span className="flex items-center gap-2"><Building2 className="h-4 w-4" />Dados da empresa (CNPJ, endereço e contato)</span>
                <span aria-hidden>→</span>
              </a>
            )}
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-slate-950">Seus dados pessoais</CardTitle>
                {user?.role === "promoter" && (
                  <p className="text-sm font-normal text-slate-600">CPF, PIS, RG, cargo e admissão só o administrador pode alterar. Você pode atualizar o e-mail e a senha nesta página.</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <MemberRegistryFields
                  value={identity}
                  onChange={profile.data && "canEditRegistry" in profile.data && profile.data.canEditRegistry ? setIdentity : undefined}
                  disabled={!(profile.data && "canEditRegistry" in profile.data && profile.data.canEditRegistry)}
                  inputClassName="mt-1 border-slate-300 bg-white text-slate-950"
                />
                {profile.data && "canEditRegistry" in profile.data && profile.data.canEditRegistry && (
                  <Button disabled={saveIdentity.isPending} onClick={() => saveIdentity.mutate(identity)} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">
                    {saveIdentity.isPending ? "Salvando…" : "Salvar meus dados"}
                  </Button>
                )}
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-white shadow-xl">
              <CardHeader>
                <CardTitle className="text-slate-950">Alterar e-mail</CardTitle>
                <p className="text-sm font-normal text-slate-600">Informe o novo e-mail e a senha atual para confirmar.</p>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    changeEmail.mutate({ email: newEmail, currentPassword: emailPassword });
                  }}
                >
                  <div>
                    <Label htmlFor="new-email" className="font-semibold text-slate-700">Novo e-mail</Label>
                    <Input id="new-email" type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="mt-1 border-slate-300 bg-white text-slate-950" />
                  </div>
                  <div>
                    <Label htmlFor="email-password" className="font-semibold text-slate-700">Senha atual</Label>
                    <Input id="email-password" type="password" required autoComplete="current-password" value={emailPassword} onChange={(e) => setEmailPassword(e.target.value)} className="mt-1 border-slate-300 bg-white text-slate-950" />
                  </div>
                  <Button type="submit" disabled={changeEmail.isPending} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">
                    {changeEmail.isPending ? "Salvando…" : "Salvar e-mail"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
