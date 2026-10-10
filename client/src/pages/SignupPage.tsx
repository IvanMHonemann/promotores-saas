import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Loader2, Lock } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { toast } from "sonner";

type Step = "data" | "payment";

export default function SignupPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const qs = useMemo(() => new URLSearchParams(search), [search]);
  const planIdParam = useMemo(() => {
    const raw = qs.get("planId");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [qs]);
  const planSlug = useMemo(() => (qs.get("plano") || "").trim().toLowerCase(), [qs]);

  const plansQuery = trpc.publicCatalog.plans.useQuery();
  const selectedPlan = useMemo(() => {
    const plans = plansQuery.data || [];
    if (planIdParam) {
      const byId = plans.find((p) => p.id === planIdParam);
      if (byId) return byId;
    }
    if (planSlug) {
      const byName = plans.find((p) => {
        const n = String(p.name || "").toLowerCase();
        return n === planSlug || n.includes(planSlug) || planSlug.includes(n);
      });
      if (byName) return byName;
    }
    return null;
  }, [plansQuery.data, planIdParam, planSlug]);
  const planId = selectedPlan?.id ?? null;

  const [step, setStep] = useState<Step>("data");
  const [companyName, setCompanyName] = useState("");
  const [userName, setUserName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [payMethod, setPayMethod] = useState<"PIX" | "BOLETO" | "CREDIT_CARD">("PIX");
  const trpcUtils = trpc.useUtils();

  // Sem plano escolhido → redireciona para a página de planos
  useEffect(() => {
    if (!plansQuery.isLoading && !planId) {
      toast.message("Escolha um plano antes de criar a conta.");
      navigate("/planos");
    }
  }, [planId, plansQuery.isLoading, navigate]);

  const signup = trpc.auth.signup.useMutation({
    onSuccess: async (data) => {
      toast.success(
        data.recoveryCode
          ? `Pagamento confirmado e conta criada. Código de recuperação: ${data.recoveryCode}`
          : "Pagamento confirmado e conta criada.",
        { duration: 12000 },
      );
      await trpcUtils.auth.me.invalidate();
      window.location.href = "/";
    },
    onError: (e) => toast.error(e.message),
  });

  const onSubmitData = (e: FormEvent) => {
    e.preventDefault();
    if (!planId || !selectedPlan) {
      toast.error("Selecione um plano para continuar.");
      navigate("/planos");
      return;
    }
    setStep("payment");
  };

  const onConfirmPayment = () => {
    if (!planId) {
      navigate("/planos");
      return;
    }
    // Mock: confirmação de pagamento antes de criar a conta
    signup.mutate({
      companyName,
      userName,
      email,
      password,
      planId,
      paymentConfirmed: true,
    });
  };

  if (!planId || plansQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </main>
    );
  }

  if (!selectedPlan) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-4 text-slate-100">
        <p>Plano inválido ou indisponível.</p>
        <Button onClick={() => navigate("/planos")}>Escolher um plano</Button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-red-950 p-8 shadow-xl">
          <div className="mb-6 space-y-3">
            <BrandLogo variant="dark" height={72} className="max-w-[300px]" />
            <div>
              <p className="font-black">Nova conta</p>
              <p className="text-xs uppercase tracking-wider text-red-300">
                {step === "data" ? "1/2 · Dados" : "2/2 · Pagamento"}
              </p>
            </div>
          </div>

          <div className="space-y-3 text-sm text-slate-300">
            <div className="flex items-center gap-2">
              <Badge className="bg-red-600">Plano escolhido</Badge>
            </div>
            <p className="text-xl font-semibold text-white">{selectedPlan.name}</p>
            <p>{selectedPlan.description || "Plano comercial"}</p>
            <p className="text-3xl font-bold text-white">
              R$ {Number(selectedPlan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              <span className="text-sm font-normal text-slate-400">
                /{selectedPlan.billingCycle === "yearly" ? "ano" : "mês"}
              </span>
            </p>
            <ul className="space-y-1 pt-2">
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Usuários: {selectedPlan.maxUsers ?? "Ilimitado"}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Clientes: {selectedPlan.maxClients ?? "Ilimitado"}</li>
              <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Extintores: {selectedPlan.maxExtinguishers ?? "Ilimitado"}</li>
            </ul>
            <p className="pt-4 text-xs text-slate-400">
              A conta só é criada após a confirmação do pagamento. Em modo demonstração a cobrança é simulada.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="outline" className="border-slate-600" onClick={() => navigate("/planos")}>
              Trocar plano
            </Button>
            <Button variant="ghost" onClick={() => navigate("/?login=1")}>
              Já tenho conta
            </Button>
          </div>
        </section>

        <Card className="border-slate-700 bg-white text-slate-900 shadow-2xl">
          {step === "data" ? (
            <>
              <CardHeader>
                <CardTitle>Dados da empresa e do administrador</CardTitle>
                <p className="text-sm text-slate-500">Preencha os dados. Na próxima etapa você confirma o pagamento.</p>
              </CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={onSubmitData}>
                  <div className="space-y-2">
                    <Label htmlFor="companyName">Nome da empresa</Label>
                    <Input id="companyName" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required minLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="userName">Nome do responsável</Label>
                    <Input id="userName" value={userName} onChange={(e) => setUserName(e.target.value)} required minLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail de acesso</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha (mín. 8 caracteres)</Label>
                    <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                  </div>
                  <Button type="submit" className="w-full bg-red-600 hover:bg-red-500">
                    Continuar para pagamento
                  </Button>
                </form>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Confirmar pagamento
                </CardTitle>
                <p className="text-sm text-slate-500">
                  A conta será criada somente após a confirmação abaixo.
                </p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Plano</span>
                    <span className="font-semibold">{selectedPlan.name}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-slate-600">Empresa</span>
                    <span className="font-semibold">{companyName}</span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-slate-600">E-mail</span>
                    <span className="font-semibold">{email}</span>
                  </div>
                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-base">
                    <span className="font-medium">Total</span>
                    <span className="font-bold text-red-600">
                      R$ {Number(selectedPlan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Forma de pagamento</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["PIX", "BOLETO", "CREDIT_CARD"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                          payMethod === m ? "border-red-600 bg-red-50 text-red-700" : "border-slate-200 bg-white"
                        }`}
                      >
                        {m === "CREDIT_CARD" ? "Cartão" : m === "BOLETO" ? "Boleto" : "PIX"}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Modo demonstração: nenhuma cobrança real é feita. Com Asaas ativo, o webhook confirmará o pagamento.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full bg-red-600 hover:bg-red-500"
                    disabled={signup.isPending}
                    onClick={onConfirmPayment}
                  >
                    {signup.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Confirmar pagamento e criar conta
                  </Button>
                  <Button type="button" variant="ghost" disabled={signup.isPending} onClick={() => setStep("data")}>
                    Voltar aos dados
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
