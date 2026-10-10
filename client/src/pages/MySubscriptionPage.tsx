import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Labels usam classes explícitas para contraste no tema escuro
import { PasswordInput } from "@/components/PasswordInput";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  CreditCard,
  KeyRound,
  Loader2,
  LogOut,
  Shield,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";

const statusLabel: Record<string, string> = {
  trial: "Teste",
  test: "Teste",
  active: "Ativa",
  pending: "Pendente",
  overdue: "Em atraso",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
  none: "Sem plano",
};

const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: "featureDashboard", label: "Painel e indicadores" },
  { key: "featureClients", label: "Cadastro de clientes" },
  { key: "featureExtinguishers", label: "Cadastro de extintores" },
  { key: "featureServiceOrders", label: "Ordens de serviço" },
  { key: "featureAlerts", label: "Alertas de vencimento" },
  { key: "featureReports", label: "Histórico e auditoria" },
  { key: "featureUsers", label: "Gestão de usuários da equipe" },
  { key: "featureBackup", label: "Backup e restauração" },
  { key: "featureOfflinePwa", label: "Operação offline / PWA" },
];

function fmtLimit(v: number | null | undefined, unit: string) {
  if (v == null) return "Ilimitado";
  return `Até ${Number(v).toLocaleString("pt-BR")} ${unit}`;
}

async function fileToDataUrl(file: File, maxSide = 256, maxBytes = 180_000): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, w, h);
  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > maxBytes && quality > 0.4) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  if (dataUrl.length > maxBytes) throw new Error("Imagem muito grande. Escolha outra foto.");
  return dataUrl;
}

export default function MySubscriptionPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const access = trpc.billing.access.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  const mine = trpc.billing.mySubscription.useQuery(undefined, { enabled: Boolean(user && user.role !== "platform_admin") });
  const extras = trpc.auth.profileExtras.useQuery(undefined, { enabled: Boolean(user) });

  const [userName, setUserName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [alertDays, setAlertDays] = useState(30);
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [newRecoveryCode, setNewRecoveryCode] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.name) setUserName(user.name);
  }, [user?.name]);

  useEffect(() => {
    if (mine.data?.company?.name) setCompanyName(mine.data.company.name);
  }, [mine.data?.company?.name]);

  useEffect(() => {
    if (extras.data?.avatarDataUrl) setAvatarPreview(extras.data.avatarDataUrl);
    if (extras.data?.alertDays) setAlertDays(extras.data.alertDays);
  }, [extras.data?.avatarDataUrl, extras.data?.alertDays]);

  const plan = (mine.data?.plan || (mine.data as any)?.effective || null) as any;
  const sub = mine.data?.subscription;
  const company = mine.data?.company;
  const status = access.data?.status || company?.subscriptionStatus || sub?.status || "none";

  const updateProfile = trpc.auth.updateProfile.useMutation({
    onSuccess: async (data) => {
      toast.success("Perfil atualizado.");
      await utils.auth.me.invalidate();
      await utils.auth.profileExtras.invalidate();
      if (data.userName) setUserName(data.userName);
    },
    onError: (e) => toast.error(e.message),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Senha alterada. Em outros dispositivos será necessário entrar de novo.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e) => toast.error(e.message),
  });

  const setAlert = trpc.settings.setAlertDays.useMutation({
    onSuccess: async () => {
      toast.success("Antecedência de alertas atualizada.");
      await utils.auth.profileExtras.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateCompanyName = trpc.companyProfile.updateName.useMutation({
    onSuccess: async () => {
      toast.success("Nome da empresa atualizado.");
      await utils.billing.mySubscription.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const regenerateRecovery = trpc.auth.regenerateRecoveryCode.useMutation({
    onSuccess: (data) => {
      setNewRecoveryCode(data.recoveryCode);
      setRecoveryPassword("");
      toast.success("Novo código gerado. Guarde em local seguro.");
    },
    onError: (e) => toast.error(e.message),
  });

  const logoutMut = trpc.auth.logout.useMutation();
  const logoutAll = trpc.auth.logoutAllSessions.useMutation({
    onSuccess: async () => {
      toast.success("Sessões encerradas. Entre novamente.");
      try { await logoutMut.mutateAsync(); } catch { /* ignore */ }
      window.location.href = "/landing-site.html";
    },
    onError: (e) => toast.error(e.message),
  });

  const initials = useMemo(() => {
    const n = (userName || user?.name || user?.email || "?").trim();
    return n.slice(0, 2).toUpperCase();
  }, [userName, user?.name, user?.email]);

  const onSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({ userName: userName.trim(), avatarDataUrl: avatarPreview });
  };

  const onChangePassword = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("A confirmação da nova senha não confere.");
      return;
    }
    changePassword.mutate({ currentPassword, newPassword });
  };

  const onPickPhoto = async (file?: File | null) => {
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setAvatarPreview(dataUrl);
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível ler a imagem.");
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        <Button onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  if (user.role === "platform_admin") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-200">
        <p>Conta de administrador da plataforma não usa Minha conta comercial.</p>
        <Button onClick={() => navigate("/")}>Voltar ao painel</Button>
      </div>
    );
  }

  if (access.isLoading || mine.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  const isCompanyAdmin = user.role === "company_admin";

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Minha conta</h1>
            <p className="text-sm text-slate-400">Perfil, plano e preferências da sua empresa</p>
          </div>
        </div>

        {!access.data?.allowed && (
          <Card className="border-amber-600/50 bg-amber-950/30">
            <CardContent className="space-y-3 pt-6 text-amber-100">
              <p className="font-medium">Assinatura precisa ser regularizada</p>
              <p className="text-sm">{access.data?.reason}</p>
              <Button onClick={() => navigate("/upgrade")}>Ver upgrade de plano</Button>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <User className="h-5 w-5 text-red-400" /> Perfil
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-6 md:grid-cols-[160px_1fr]" onSubmit={onSaveProfile}>
              <div className="flex flex-col items-center gap-3">
                <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-slate-600 bg-slate-800">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Foto de perfil" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-slate-300">{initials}</div>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onPickPhoto(e.target.files?.[0])} />
                <div className="flex flex-wrap justify-center gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                    <Camera className="mr-1 h-4 w-4" /> Foto
                  </Button>
                  {avatarPreview && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAvatarPreview(null)}>
                      Remover
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-200" htmlFor="userName">Nome</Label>
                  <Input id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500" required />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-200">E-mail</Label>
                  <Input value={user.email || ""} readOnly className="border-slate-700 bg-slate-950/60 text-slate-300" />
                  <p className="text-xs text-slate-400">O e-mail de login não pode ser alterado nesta tela.</p>
                </div>
                <Button type="submit" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar perfil"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Building2 className="h-5 w-5 text-red-400" /> Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-200" htmlFor="companyName">Nome da empresa</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={!isCompanyAdmin} className="border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-500" />
                {isCompanyAdmin && (
                  <Button type="button" disabled={updateCompanyName.isPending || companyName.trim().length < 2} onClick={() => updateCompanyName.mutate({ name: companyName.trim() })}>
                    Salvar
                  </Button>
                )}
              </div>
              {!isCompanyAdmin && <p className="text-xs text-slate-400">Somente o administrador da empresa pode alterar o nome.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2 text-lg text-white">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-red-400" /> Plano atual
              </span>
              <Badge className="bg-slate-100 text-slate-900">{statusLabel[String(status)] || String(status)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-200">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-xs text-slate-400">Plano</p>
                <p className="text-lg font-semibold text-white">{plan?.name || "Sem plano"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Valor</p>
                <p className="text-lg font-semibold text-white">
                  {plan?.price != null
                    ? `R$ ${Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/${plan?.billingCycle === "yearly" ? "ano" : "mês"}`
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Usuários</p>
                <p>{fmtLimit(plan?.maxUsers, "usuário(s)")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Clientes</p>
                <p>{fmtLimit(plan?.maxClients, "cliente(s)")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Extintores</p>
                <p>{fmtLimit(plan?.maxExtinguishers, "extintor(es)")}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Início / validade</p>
                <p>
                  {(sub?.startsAt || company?.subscriptionStartedAt
                    ? String(sub?.startsAt || company?.subscriptionStartedAt).slice(0, 10)
                    : "—") +
                    " → " +
                    (sub?.endsAt || company?.subscriptionExpiresAt || company?.trialEndsAt
                      ? String(sub?.endsAt || company?.subscriptionExpiresAt || company?.trialEndsAt).slice(0, 10)
                      : "—")}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" onClick={() => navigate("/upgrade")}>Upgrade de plano</Button>
              <Button variant="secondary" onClick={() => navigate("/pagamentos")}>Histórico de pagamentos</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Shield className="h-5 w-5 text-red-400" /> Funções do seu plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {FEATURE_ROWS.map((row) => {
                const on = Boolean(plan?.[row.key]);
                return (
                  <li key={row.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? "border-emerald-700/50 bg-emerald-950/20 text-emerald-100" : "border-slate-700 bg-slate-950/40 text-slate-400"}`}>
                    {on ? <Check className="h-4 w-4 shrink-0 text-emerald-400" /> : <X className="h-4 w-4 shrink-0 text-slate-500" />}
                    {row.label}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {isCompanyAdmin && (
          <Card className="border-slate-700 bg-slate-900 text-slate-100">
            <CardHeader>
              <CardTitle className="text-lg text-white">Preferências</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Label className="text-slate-200" htmlFor="alertDays">Antecedência de alertas de vencimento (dias)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input id="alertDays" type="number" min={1} max={365} value={alertDays} onChange={(e) => setAlertDays(Number(e.target.value) || 30)} className="max-w-[140px] border-slate-700 bg-slate-950 text-slate-100" />
                <Button type="button" disabled={setAlert.isPending} onClick={() => setAlert.mutate({ days: alertDays })}>
                  Salvar preferência
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <KeyRound className="h-5 w-5 text-red-400" /> Alterar senha
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid max-w-md gap-3" onSubmit={onChangePassword}>
              <div className="space-y-1">
                <Label className="text-slate-200">Senha atual</Label>
                <PasswordInput className="border-slate-700 bg-slate-950 text-slate-100" value={currentPassword} onChange={(e: any) => setCurrentPassword(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-200">Nova senha</Label>
                <PasswordInput className="border-slate-700 bg-slate-950 text-slate-100" value={newPassword} onChange={(e: any) => setNewPassword(e.target.value)} required minLength={8} />
              </div>
              <div className="space-y-1">
                <Label className="text-slate-200">Confirmar nova senha</Label>
                <PasswordInput className="border-slate-700 bg-slate-950 text-slate-100" value={confirmPassword} onChange={(e: any) => setConfirmPassword(e.target.value)} required minLength={8} />
              </div>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar senha"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="text-lg text-white">Código de recuperação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p>
              O código original só é mostrado na criação da conta. Por segurança ele fica criptografado. Você pode{" "}
              <strong className="text-white">gerar um código novo</strong> (o anterior deixa de valer).
            </p>
            <div className="flex max-w-md flex-col gap-2">
              <Label className="text-slate-200">Confirme sua senha atual</Label>
              <PasswordInput className="border-slate-700 bg-slate-950 text-slate-100" value={recoveryPassword} onChange={(e: any) => setRecoveryPassword(e.target.value)} />
              <Button type="button" variant="secondary" disabled={regenerateRecovery.isPending || recoveryPassword.length < 1} onClick={() => regenerateRecovery.mutate({ currentPassword: recoveryPassword })}>
                Gerar novo código
              </Button>
            </div>
            {newRecoveryCode && (
              <div className="rounded-lg border border-amber-600/50 bg-amber-950/40 p-3 text-amber-50">
                <p className="text-xs uppercase tracking-wide text-amber-200">Guarde este código agora</p>
                <p className="mt-1 break-all font-mono text-lg font-bold">{newRecoveryCode}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <LogOut className="h-5 w-5 text-red-400" /> Sessões
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-400">Encerra o acesso em todos os dispositivos (incluindo este). Use se suspeitar de uso indevido da conta.</p>
            <Button variant="destructive" disabled={logoutAll.isPending} onClick={() => { if (confirm("Encerrar todas as sessões e sair agora?")) logoutAll.mutate(); }}>
              Sair de todos os dispositivos
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
