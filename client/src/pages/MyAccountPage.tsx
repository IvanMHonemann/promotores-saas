import { FormEvent, useEffect, useState } from "react";
import { Clock3, KeyRound, Minus, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

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
  const canViewTimeBank = Boolean(entitlements.data?.effective.timeTracking);
  const summary = trpc.timeTracking.myTimeSummary.useQuery(undefined, {
    enabled: Boolean(user && !isPlatformAdmin && canViewTimeBank),
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
    <DashboardLayout title="Minha conta" description="Confira seus dados, banco de horas e segurança de acesso.">
      <div className="max-w-5xl space-y-6">
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
                    <Label className="font-semibold text-slate-700">E-mail</Label>
                    <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">{user?.email || "Não informado"}</p>
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
                      <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-3 font-medium text-slate-950">Empresa #{user.companyId}</p>
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
      </div>
    </DashboardLayout>
  );
}
