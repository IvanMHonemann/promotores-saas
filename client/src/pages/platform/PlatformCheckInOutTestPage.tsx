import { useEffect } from "react";
import { Camera, CheckCircle2, RotateCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { VisitCheckIn } from "@/components/VisitCheckIn";
import { trpc } from "@/lib/trpc";

export default function PlatformCheckInOutTestPage() {
  const session = trpc.platform.testing.session.useQuery();
  const utils = trpc.useUtils();
  const reset = trpc.platform.testing.reset.useMutation({
    onSuccess: () => {
      void utils.platform.testing.session.invalidate();
      toast.success("Sandbox reiniciado. Nenhum dado comercial foi alterado.");
    },
    onError: error => toast.error(error.message),
  });
  const current = session.data;
  const action =
    current?.status === "pending"
      ? "start"
      : current?.status === "in_progress"
        ? "complete"
        : null;

  useEffect(() => {
    localStorage.removeItem("promotores-saas-act-as");
    void session.refetch();
  }, []);

  return (
    <DashboardLayout
      title="Teste privado de check-in / check-out"
      description="Sandbox exclusivo da sua conta de administrador geral."
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-emerald-300/30 bg-gradient-to-br from-emerald-300/15 via-slate-900 to-slate-950 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                Sandbox isolado
              </Badge>
              <h2 className="mt-2 text-2xl font-black text-white">
                Teste somente na sua conta
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Este ambiente usa uma sessão fictícia vinculada apenas ao seu
                administrador. Não entra na conta de nenhum usuário, não cria
                visita em empresa e não grava foto na galeria real.
              </p>
            </div>
            <ShieldCheck className="hidden h-12 w-12 text-emerald-200 sm:block" />
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-slate-900">
                  <Camera className="h-5 w-5 text-teal-600" /> Loja fictícia do
                  sandbox
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Status atual:{" "}
                  <strong>
                    {current?.status === "pending"
                      ? "aguardando check-in"
                      : current?.status === "in_progress"
                        ? "em visita"
                        : "check-out concluído"}
                  </strong>{" "}
                  · Fotos no sandbox: {current?.photoCount ?? 0}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => reset.mutate()}
                disabled={reset.isPending}
                className="gap-2 border-slate-300"
              >
                <RotateCcw className="h-4 w-4" /> Reiniciar sandbox
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {session.isLoading && (
              <p className="text-sm text-slate-500">Carregando sandbox...</p>
            )}
            {action && current && (
              <VisitCheckIn
                sandbox
                action={action}
                visitId={current.visitId}
                storeId={current.storeId}
                storeName={current.storeName}
                onDone={() => void session.refetch()}
                onCancel={() => undefined}
              />
            )}
            {current?.status === "completed" && (
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-bold">Teste concluído no sandbox</p>
                  <p className="text-sm">
                    O check-in, o check-out e as fotos foram processados apenas
                    na sessão da sua conta.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            <strong>Garantia de isolamento:</strong> o backend usa endpoints
            exclusivos de plataforma e mantém o estado do teste fora das tabelas
            de empresas, usuários, roteiros, visitas e fotos comerciais.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
