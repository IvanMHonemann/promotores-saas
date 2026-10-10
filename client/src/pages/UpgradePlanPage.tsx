import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";


function formatDate(value: unknown): string {
  if (value == null || value === "") return "—";
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "—" : value.toLocaleDateString("pt-BR");
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
    return String(value).slice(0, 10);
  }
  return "—";
}

const statusLabel: Record<string, string> = {
  trial: "Teste",
  test: "Teste",
  active: "Ativa",
  pending: "Pendente",
  overdue: "Em atraso",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
};

export default function UpgradePlanPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isCompanyAdmin = user?.role === "company_admin";

  const access = trpc.billing.access.useQuery();
  const mine = trpc.billing.mySubscription.useQuery();
  const plansQuery = trpc.billing.plans.useQuery();
  const utils = trpc.useUtils();

  const changePlan = trpc.billing.mockCheckoutOpen.useMutation({
    onSuccess: async (data) => {
      toast.success(`Plano atualizado (simulação). Status: ${data.status}`);
      await utils.billing.mySubscription.invalidate();
      await utils.billing.access.invalidate();
      await utils.billing.plans.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (access.isLoading || mine.isLoading || plansQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-red-500" />
      </div>
    );
  }

  const sub = mine.data?.subscription;
  const plan = mine.data?.plan;
  const company = mine.data?.company;
  const status = access.data?.status || company?.subscriptionStatus || sub?.status || "none";
  const currentPlanId = plan?.id ?? company?.planId ?? sub?.planId ?? null;

  const plans = plansQuery.data || [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" /> Upgrade de plano
            </h1>
            <p className="text-sm text-slate-400">Veja seu plano atual e migre quando precisar de mais recursos.</p>
          </div>
        </div>

        <Card className="border-red-500/40 bg-gradient-to-br from-slate-900 to-red-950/40">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-white">
              <span className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" /> Plano atual
              </span>
              <Badge className="bg-red-600 hover:bg-red-600">{statusLabel[String(status)] || String(status)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-200 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Nome</p>
              <p className="text-lg font-semibold text-white">{plan?.name || (status && status !== "none" ? "Plano ativo (detalhes indisponíveis)" : "Sem plano definido")}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Valor</p>
              <p className="text-lg font-semibold text-white">
                {plan
                  ? `R$ ${Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} / ${plan.billingCycle === "yearly" ? "ano" : "mês"}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Vigência / teste até</p>
              <p>
                {formatDate(sub?.currentPeriodEnd || sub?.endsAt || company?.subscriptionExpiresAt || company?.trialEndsAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Limites</p>
              <p>
                Usuários: {plan?.maxUsers ?? "∞"} · Clientes: {plan?.maxClients ?? "∞"} · Extintores:{" "}
                {plan?.maxExtinguishers ?? "∞"}
              </p>
            </div>
            {!isCompanyAdmin && (
              <p className="md:col-span-2 text-amber-200/90">
                Somente o administrador da empresa pode alterar o plano.
              </p>
            )}
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Outros planos disponíveis</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((p) => {
              const isCurrent = currentPlanId === p.id;
              return (
                <Card
                  key={p.id}
                  className={`border-slate-700 bg-slate-900 ${isCurrent ? "ring-2 ring-red-500" : ""}`}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2 text-base text-white">
                      <span>{p.name}</span>
                      {isCurrent ? <Badge>Atual</Badge> : (
                        <Badge variant="secondary">{p.billingCycle === "yearly" ? "Anual" : "Mensal"}</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-slate-400">{p.description || "—"}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-2xl font-bold text-white">
                      R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-slate-400">
                        /{p.billingCycle === "yearly" ? "ano" : "mês"}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm text-slate-300">
                      <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Usuários: {p.maxUsers ?? "Ilimitado"}</li>
                      <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Clientes: {p.maxClients ?? "Ilimitado"}</li>
                      <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Extintores: {p.maxExtinguishers ?? "Ilimitado"}</li>
                    </ul>
                    <Button
                      className="w-full"
                      disabled={isCurrent || !isCompanyAdmin || changePlan.isPending}
                      variant={isCurrent ? "secondary" : "default"}
                      onClick={() => {
                        if (!isCompanyAdmin) {
                          toast.error("Somente o administrador da empresa pode migrar de plano.");
                          return;
                        }
                        changePlan.mutate({ planId: p.id, outcome: "approved" });
                      }}
                    >
                      {isCurrent ? "Plano atual" : changePlan.isPending ? "Processando…" : "Migrar para este plano"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Alteração em modo simulação (mock). A cobrança real via Asaas será conectada depois.
          </p>
        </div>
      </div>
    </div>
  );
}
