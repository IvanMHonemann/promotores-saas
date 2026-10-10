import { useLocation, useSearch } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, LogIn } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

function fmtLimit(n: number | null | undefined, singular: string, plural: string) {
  if (n == null) return `${plural} ilimitados`;
  return `Até ${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;
}

function planHighlights(plan: {
  name: string;
  maxUsers: number | null;
  maxClients: number | null;
  maxExtinguishers: number | null;
  featureOfflinePwa?: boolean | null;
  featureBackup?: boolean | null;
  featureReports?: boolean | null;
  featureUsers?: boolean | null;
}) {
  const name = plan.name.toLowerCase();
  const items: string[] = [];

  items.push(plan.maxUsers == null ? "Usuários ilimitados" : `${plan.maxUsers} usuário${plan.maxUsers > 1 ? "s" : ""}`);
  items.push(fmtLimit(plan.maxClients, "cliente", "clientes"));
  items.push(fmtLimit(plan.maxExtinguishers, "extintor", "extintores"));

  if (name.includes("start") || name.includes("essenc") || name.includes("básico") || name.includes("basico")) {
    items.push("Clientes, extintores, alertas e OS");
    if (plan.featureOfflinePwa) items.push("App no celular com uso offline");
    if (plan.featureBackup) items.push("Backup dos dados");
  } else if (name.includes("prof")) {
    items.push("Tudo do Start");
    items.push("Histórico e auditoria");
    items.push("Lixeira com recuperação");
    items.push("Sincronização entre dispositivos");
  } else if (name.includes("empres")) {
    items.push("Tudo do Profissional");
    items.push("Suporte prioritário");
    items.push("Acesso antecipado a recursos premium");
  } else {
    if (plan.featureOfflinePwa) items.push("Operação offline / PWA");
    if (plan.featureBackup) items.push("Backup");
    if (plan.featureReports) items.push("Relatórios e histórico");
    if (plan.featureUsers) items.push("Gestão de usuários");
  }

  return items;
}

export default function PublicPlansPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const qs = new URLSearchParams(search);
  const preferredPlano = (qs.get("plano") || "").toLowerCase();
  const modo = qs.get("modo") === "compra" ? "compra" : "teste";
  const plansQuery = trpc.publicCatalog.plans.useQuery();

  const matchPlanId = (name: string) => {
    const n = name.toLowerCase();
    if (preferredPlano.includes("start") || preferredPlano.includes("essenc") || preferredPlano.includes("basic") || preferredPlano.includes("basico") || preferredPlano.includes("básico")) {
      if (n.includes("start") || n.includes("essenc") || n.includes("basic") || n.includes("basico") || n.includes("básico")) return true;
    }
    if (preferredPlano.includes("prof")) {
      if (n.includes("prof")) return true;
    }
    if (preferredPlano.includes("empres") || preferredPlano.includes("ilimit")) {
      if (n.includes("empres") || n.includes("ilimit")) return true;
    }
    return Boolean(preferredPlano) && n.includes(preferredPlano);
  };

  const plans = (plansQuery.data || []).slice().sort((a: any, b: any) => Number(a.price) - Number(b.price));

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <BrandLogo variant="dark" height={72} className="max-w-[300px]" />
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Escolha o plano ideal</h1>
              <p className="mt-2 max-w-xl text-slate-400">
                Planos pensados para empresas de extintores. Compare limites de usuários, clientes e equipamentos.
              </p>
            </div>
          </div>
          <Button variant="outline" className="border-slate-600 text-slate-100" onClick={() => navigate("/?login=1")}>
            <LogIn className="mr-2 h-4 w-4" /> Já tenho conta
          </Button>
        </header>

        {plansQuery.isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-red-500" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan: any) => {
              const isPro = String(plan.name).toLowerCase().includes("prof");
              const highlights = planHighlights(plan);
              return (
                <Card
                  key={plan.id}
                  className={`relative border-slate-800 bg-slate-900/80 ${
                    isPro ? "ring-2 ring-red-500/80" : ""
                  }`}
                >
                  {isPro ? (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-red-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                      Mais escolhido
                    </div>
                  ) : null}
                  <CardHeader className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                      <Badge variant="secondary">{plan.billingCycle === "yearly" ? "Anual" : "Mensal"}</Badge>
                    </div>
                    <p className="text-sm text-slate-400">{plan.description || "Plano comercial"}</p>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="text-3xl font-bold text-white">
                      R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      <span className="text-sm font-normal text-slate-400">
                        /{plan.billingCycle === "yearly" ? "ano" : "mês"}
                      </span>
                    </div>
                    <ul className="space-y-2 text-sm text-slate-300">
                      {highlights.map((item) => (
                        <li key={item} className="flex gap-2">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className={`w-full ${matchPlanId(plan.name) ? "bg-red-600 ring-2 ring-red-300 hover:bg-red-500" : "bg-red-600 hover:bg-red-500"}`}
                      onClick={() => navigate(`/cadastro?planId=${plan.id}&modo=${modo}`)}
                    >
                      {matchPlanId(plan.name)
                        ? (modo === "teste" ? "Continuar teste deste plano" : "Continuar compra deste plano")
                        : "Selecionar e continuar"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="text-center text-xs text-slate-500">
          Sem escolha de plano não há cadastro. A conta só é criada após a confirmação do pagamento.
        </p>
      </div>
    </main>
  );
}
