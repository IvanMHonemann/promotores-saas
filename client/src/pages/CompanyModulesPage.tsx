import { CheckCircle2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ENTITLEMENT_CATALOG } from "@shared/entitlements";

/** Visão somente leitura dos módulos liberados para a empresa do usuário. */
export default function CompanyModulesPage() {
  const entitlements = trpc.entitlements.mine.useQuery(undefined, { staleTime: 60_000 });
  const effective = entitlements.data?.effective ?? {};
  const enabled = ENTITLEMENT_CATALOG.filter((item) => effective[item.key]);
  const disabled = ENTITLEMENT_CATALOG.filter((item) => !effective[item.key]);

  return (
    <DashboardLayout
      title="Módulos da conta"
      description="O que está liberado para sua empresa. Alterações são feitas pelo administrador da plataforma."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-emerald-200">
              <CheckCircle2 className="h-5 w-5" /> Liberados ({enabled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {entitlements.isLoading && <p className="text-slate-400">Carregando...</p>}
            {enabled.map((item) => (
              <div key={item.key} className="rounded-lg border border-emerald-400/20 bg-emerald-500/10 p-3">
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-slate-300">{item.description}</p>
              </div>
            ))}
            {!entitlements.isLoading && enabled.length === 0 && <p className="text-slate-400">Nenhum módulo adicional liberado.</p>}
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-slate-300">
              <XCircle className="h-5 w-5" /> Não liberados ({disabled.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {disabled.map((item) => (
              <div key={item.key} className="rounded-lg border border-white/10 bg-white/5 p-3 opacity-70">
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-slate-400">{item.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
