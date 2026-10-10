import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function PlansPage() {
  const [, navigate] = useLocation();
  const plansQuery = trpc.billing.plans.useQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const checkout = trpc.billing.mockCheckoutOpen.useMutation({
    onSuccess: (data) => {
      toast.success(`Checkout mock: status ${data.status}`);
      navigate("/minha-assinatura");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-2xl font-semibold">Planos</h1>
        </div>
        {plansQuery.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {(plansQuery.data || []).map((plan) => (
              <Card key={plan.id} className={`bg-slate-900 border-slate-700 ${selected === plan.id ? "ring-2 ring-red-500" : ""}`}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span>{plan.name}</span>
                    <Badge variant="secondary">{plan.billingCycle === "yearly" ? "Anual" : "Mensal"}</Badge>
                  </CardTitle>
                  <p className="text-sm text-slate-400">{plan.description}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-3xl font-bold text-white">
                    R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    <span className="text-sm font-normal text-slate-400">/{plan.billingCycle === "yearly" ? "ano" : "mês"}</span>
                  </div>
                  <ul className="space-y-1 text-sm text-slate-300">
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> {plan.maxUsers == null ? "Usuários ilimitados" : `${plan.maxUsers} usuário${plan.maxUsers > 1 ? "s" : ""}`}</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> {plan.maxClients == null ? "Clientes ilimitados" : `Até ${Number(plan.maxClients).toLocaleString("pt-BR")} clientes`}</li>
                    <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> {plan.maxExtinguishers == null ? "Extintores ilimitados" : `Até ${Number(plan.maxExtinguishers).toLocaleString("pt-BR")} extintores`}</li>
                    {plan.featureOfflinePwa ? <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Offline / PWA</li> : null}
                    {plan.featureBackup ? <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Backup</li> : null}
                    {plan.featureReports ? <li className="flex gap-2"><Check className="h-4 w-4 text-emerald-400" /> Histórico e relatórios</li> : null}
                  </ul>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="border-slate-600" onClick={() => { setSelected(plan.id); checkout.mutate({ planId: plan.id, outcome: "approved" }); }} disabled={checkout.isPending}>
                      Simular aprovado
                    </Button>
                    <Button variant="secondary" onClick={() => { setSelected(plan.id); checkout.mutate({ planId: plan.id, outcome: "pending" }); }} disabled={checkout.isPending}>
                      Simular pendente
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="destructive" onClick={() => checkout.mutate({ planId: plan.id, outcome: "overdue" })} disabled={checkout.isPending}>Vencido</Button>
                    <Button variant="ghost" onClick={() => checkout.mutate({ planId: plan.id, outcome: "canceled" })} disabled={checkout.isPending}>Cancelado</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">Checkout em modo mock — nenhuma cobrança real é feita. Integração Asaas será ativada depois.</p>
      </div>
    </div>
  );
}
