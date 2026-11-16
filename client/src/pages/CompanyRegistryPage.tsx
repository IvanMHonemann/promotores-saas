import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyRegistryForm } from "@/components/registry/CompanyRegistryForm";
import { trpc } from "@/lib/trpc";
import { emptyCompanyRegistry, type CompanyRegistry } from "@shared/registryFields";
import { toast } from "sonner";

export default function CompanyRegistryPage() {
  const data = trpc.registry.company.useQuery();
  const save = trpc.registry.saveCompany.useMutation({
    onSuccess: (r) => {
      toast.success(r.complete ? "Dados da empresa salvos." : "Dados salvos. Ainda faltam: " + r.missing.join(", ") + ".");
      void data.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const [form, setForm] = useState<CompanyRegistry>(emptyCompanyRegistry());
  useEffect(() => {
    if (data.data?.registry) setForm(data.data.registry);
  }, [data.data]);
  const canEdit = Boolean(data.data?.canEdit);
  return (
    <DashboardLayout title="Dados da empresa" description="Razão social, CNPJ e endereço usados no espelho de ponto, nos comprovantes e nos arquivos legais. Nada disso é obrigatório no cadastro inicial.">
      <Card className="border-white/10 bg-slate-900/70 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Building2 className="h-4 w-4 text-teal-300" />Cadastro da empresa</CardTitle>
          {!canEdit && <p className="text-sm font-normal text-slate-300">Somente o administrador pode alterar estes dados. Você pode consultar o que já está cadastrado.</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {data.isLoading ? <p className="text-sm text-slate-300">Carregando…</p> : (
            <>
              <CompanyRegistryForm value={form} onChange={canEdit ? setForm : undefined} disabled={!canEdit} />
              {canEdit && (
                <Button disabled={save.isPending} onClick={() => save.mutate(form)} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">
                  {save.isPending ? "Salvando…" : "Salvar dados da empresa"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
