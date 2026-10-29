import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  LogOut,
  Play,
  Store,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { VisitCheckIn } from "@/components/VisitCheckIn";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const ACT_AS_KEY = "promotores-saas-act-as";
const TEST_SESSION_KEY = "promotores-saas-platform-test";

type TestSession = {
  companyId: number;
  memberId: number;
  visitId: number;
  storeId: number;
  storeName: string;
};

function readJson<T>(key: string): T | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value && typeof value === "object" ? (value as T) : null;
  } catch {
    return null;
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PlatformCheckInOutTestPage() {
  const { user } = useAuth();
  const testSession = readJson<TestSession>(TEST_SESSION_KEY);
  const actingAs = readJson<{ id?: number; memberId?: number }>(ACT_AS_KEY);
  const isTestSession = Boolean(
    user?.companyId &&
      user.role === "promoter" &&
      testSession &&
      actingAs?.id &&
      actingAs.memberId
  );

  if (isTestSession && testSession) return <ActiveTest session={testSession} />;
  return <TestSetup />;
}

function TestSetup() {
  const [companyId, setCompanyId] = useState("");
  const [promoterId, setPromoterId] = useState("");
  const [storeId, setStoreId] = useState("");
  const companies = trpc.platform.companies.list.useQuery(undefined, {
    staleTime: 60000,
  });
  const users = trpc.platform.users.list.useQuery(undefined, {
    staleTime: 60000,
  });
  const stores = trpc.platform.testing.stores.useQuery(
    { companyId: Number(companyId) },
    { enabled: Number(companyId) > 0, staleTime: 30000 }
  );
  const createVisit = trpc.platform.testing.createVisit.useMutation({
    onError: error => toast.error(error.message),
  });
  const promoters = useMemo(
    () =>
      (users.data ?? []).filter(
        member =>
          member.companyId === Number(companyId) &&
          member.role === "promoter" &&
          member.active
      ),
    [users.data, companyId]
  );
  const activeCompanies = (companies.data ?? []).filter(
    company => company.active
  );

  const startTest = async () => {
    if (!companyId || !promoterId || !storeId) {
      toast.error(
        "Selecione a empresa, o promotor e a loja para iniciar o teste."
      );
      return;
    }
    try {
      const result = await createVisit.mutateAsync({
        companyId: Number(companyId),
        promoterId: Number(promoterId),
        storeId: Number(storeId),
        date: today(),
      });
      localStorage.setItem(
        ACT_AS_KEY,
        JSON.stringify({ id: Number(companyId), memberId: Number(promoterId) })
      );
      localStorage.setItem(
        TEST_SESSION_KEY,
        JSON.stringify({
          companyId: Number(companyId),
          memberId: Number(promoterId),
          ...result,
        } satisfies TestSession)
      );
      toast.success("Visita de teste preparada. Abrindo o check-in...");
      window.location.href = "/plataforma/teste-check-in-out";
    } catch {
      // O toast de erro da mutation já informa o motivo.
    }
  };

  return (
    <DashboardLayout
      title="Teste de check-in / check-out"
      description="Execute o fluxo real de campo como administrador geral, sem as limitações do perfil comercial."
    >
      <div className="space-y-5">
        <div className="rounded-3xl border border-amber-300/30 bg-gradient-to-br from-amber-300/15 via-slate-900 to-slate-950 p-5 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Badge className="border border-amber-300/30 bg-amber-300/10 text-amber-200">
                Modo administrador geral
              </Badge>
              <h2 className="mt-2 text-2xl font-black text-white">
                Teste sem limitações comerciais
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Escolha uma empresa, um promotor e uma loja. O sistema prepara
                uma visita real para você validar foto da fachada, GPS, check-in
                e check-out.
              </p>
            </div>
            <Camera className="hidden h-12 w-12 text-amber-200 sm:block" />
          </div>
        </div>

        <Card className="border-slate-200 bg-white shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Play className="h-5 w-5 text-teal-600" /> Preparar novo teste
            </CardTitle>
            <p className="text-sm text-slate-500">
              A visita será registrada na empresa selecionada com a
              identificação de teste.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4 text-teal-600" /> Empresa
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal"
                value={companyId}
                onChange={event => {
                  setCompanyId(event.target.value);
                  setPromoterId("");
                  setStoreId("");
                }}
              >
                <option value="">Selecione uma empresa</option>
                {activeCompanies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-teal-600" /> Promotor
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal disabled:bg-slate-100"
                value={promoterId}
                onChange={event => setPromoterId(event.target.value)}
                disabled={!companyId}
              >
                <option value="">Selecione um promotor</option>
                {promoters.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.userName} · {member.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm font-semibold text-slate-700">
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4 text-teal-600" /> Loja
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-normal disabled:bg-slate-100"
                value={storeId}
                onChange={event => setStoreId(event.target.value)}
                disabled={!companyId}
              >
                <option value="">Selecione uma loja</option>
                {(stores.data ?? []).map(store => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                    {store.city ? ` · ${store.city}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <div className="md:col-span-3">
              <Button
                onClick={() => void startTest()}
                disabled={
                  createVisit.isPending || !companyId || !promoterId || !storeId
                }
                className="h-11 w-full bg-teal-600 font-bold text-white hover:bg-teal-700 sm:w-auto"
              >
                <Play className="mr-2 h-4 w-4" />
                {createVisit.isPending
                  ? "Preparando visita..."
                  : "Iniciar teste de check-in"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            O teste usa o mesmo fluxo de produção, mas a visita criada fica
            identificada como <strong>Teste de check-in / check-out</strong>.
            Isso permite validar o comportamento sem alterar permissões ou
            assinaturas das empresas.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

function ActiveTest({ session }: { session: TestSession }) {
  const visits = trpc.operations.visits.list.useQuery(
    { date: today() },
    { refetchOnWindowFocus: true, staleTime: 0 }
  );
  const visit = visits.data?.find(item => item.visit.id === session.visitId);
  const action =
    visit?.visit.status === "in_progress"
      ? "complete"
      : visit?.visit.status === "pending"
        ? "start"
        : null;
  const stop = () => {
    localStorage.removeItem(ACT_AS_KEY);
    localStorage.removeItem(TEST_SESSION_KEY);
    window.location.href = "/plataforma/teste-check-in-out";
  };

  return (
    <DashboardLayout
      title="Teste de check-in / check-out"
      description={`Atuando como promotor de teste na loja ${session.storeName}.`}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="border border-amber-300/30 bg-amber-400/10 text-amber-800">
              Sessão de teste ativa
            </Badge>
            <p className="mt-2 text-sm text-slate-700">
              Empresa #{session.companyId} · Promotor #{session.memberId} ·
              Visita #{session.visitId}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={stop}
            className="gap-2 border-slate-300 bg-white"
          >
            <LogOut className="h-4 w-4" /> Encerrar teste
          </Button>
        </div>
        {!visit && visits.isLoading && (
          <Card>
            <CardContent className="p-6 text-sm text-slate-600">
              Carregando a visita de teste...
            </CardContent>
          </Card>
        )}
        {!visit && !visits.isLoading && (
          <Card>
            <CardContent className="p-6">
              <p className="font-semibold text-slate-900">
                Visita não encontrada
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Encerre esta sessão e prepare um novo teste.
              </p>
            </CardContent>
          </Card>
        )}
        {visit && action && (
          <Card className="border-teal-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <Camera className="h-5 w-5 text-teal-600" />{" "}
                {action === "start"
                  ? "Confirmar check-in"
                  : "Confirmar check-out"}
              </CardTitle>
              <p className="text-sm text-slate-500">
                Ao manter a foto, a operação será concluída automaticamente.
              </p>
            </CardHeader>
            <CardContent>
              <VisitCheckIn
                action={action}
                visitId={visit.visit.id}
                storeId={visit.store.id}
                storeName={visit.store.name}
                onDone={() => void visits.refetch()}
                onCancel={() => undefined}
              />
            </CardContent>
          </Card>
        )}
        {visit?.visit.status === "completed" && (
          <Card className="border-emerald-200 bg-emerald-50">
            <CardContent className="flex items-center gap-3 p-5 text-emerald-900">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <p className="font-bold">Teste concluído</p>
                <p className="text-sm">
                  Check-in e check-out foram registrados. Encerre o teste para
                  preparar outra visita.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
