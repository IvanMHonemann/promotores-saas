import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, CheckCircle2, CloudOff, RefreshCw, Trash2, Wifi, WifiOff } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { offlineDb, discardOfflineMutation, retryOfflineMutation, markOfflineMutationFailed, type OfflineMutation } from "@/offline/localDb";
import { useOnlineStatus } from "@/offline/hooks";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

const entityLabel: Record<string, string> = {
  client: "Cliente",
  extinguisher: "Extintor",
  order: "Ordem de serviço",
};

const actionLabel: Record<string, string> = {
  create: "Criar",
  update: "Atualizar",
  delete: "Excluir",
};

export default function SyncStatusPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const isOnline = useOnlineStatus();
  const isPlatformAdmin = user?.role === "platform_admin";
  const tenantKey = user
    ? isPlatformAdmin
      ? `platform:${user.id}`
      : (user as any).companyId
        ? String((user as any).companyId)
        : user.id < 0
          ? String(Math.abs(user.id))
          : String(user.id)
    : null;

  const mutations = useLiveQuery(
    () => (tenantKey ? offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt") : Promise.resolve([] as OfflineMutation[])),
    [tenantKey],
    [] as OfflineMutation[],
  );
  const localClients = useLiveQuery(
    () => (tenantKey ? offlineDb.clients.where("tenantKey").equals(tenantKey).count() : Promise.resolve(0)),
    [tenantKey],
    0,
  );
  const localExtinguishers = useLiveQuery(
    () => (tenantKey ? offlineDb.extinguishers.where("tenantKey").equals(tenantKey).count() : Promise.resolve(0)),
    [tenantKey],
    0,
  );
  const localOrders = useLiveQuery(
    () => (tenantKey ? offlineDb.orders.where("tenantKey").equals(tenantKey).count() : Promise.resolve(0)),
    [tenantKey],
    0,
  );

  const pending = mutations.filter((item) => (item.state || "pending") === "pending");
  const failed = mutations.filter((item) => item.state === "failed");
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, failed: 0 });
  const utils = trpc.useUtils();
  const createClient = trpc.clients.create.useMutation();
  const updateClient = trpc.clients.update.useMutation();
  const deleteClient = trpc.clients.delete.useMutation();
  const createExt = trpc.extinguishers.create.useMutation();
  const updateExt = trpc.extinguishers.update.useMutation();
  const deleteExt = trpc.extinguishers.delete.useMutation();
  const createOrder = trpc.orders.create.useMutation();
  const updateOrder = trpc.orders.update.useMutation();
  const deleteOrder = trpc.orders.delete.useMutation();

  const sendQueue = async (onlyId?: number) => {
    if (!tenantKey) { toast.error("Faça login novamente para enviar a fila."); return; }
    if (typeof navigator !== "undefined" && navigator.onLine === false) { toast.error("Sem internet. Conecte e toque em Enviar agora."); return; }
    const rows = (await offlineDb.mutations.where("tenantKey").equals(tenantKey).sortBy("createdAt"))
      .filter((row) => (onlyId ? row.id === onlyId : (row.state || "pending") === "pending" || row.state === "failed"));
    if (!rows.length) { toast.message("Nada pendente para enviar."); return; }
    setSending(true);
    setProgress({ done: 0, total: rows.length, failed: 0 });
    let done = 0;
    let failedCount = 0;
    for (const row of rows) {
      try {
        const payload = { ...(row.payload || {}) };
        delete payload.localId;
        delete payload.tenantKey;
        if (row.action === "create") delete payload.id;
        if (row.entity === "client" && row.action === "create") await createClient.mutateAsync(payload);
        else if (row.entity === "client" && row.action === "update") await updateClient.mutateAsync(payload);
        else if (row.entity === "client") await deleteClient.mutateAsync({ id: Number(payload.id) });
        else if (row.entity === "extinguisher" && row.action === "create") await createExt.mutateAsync(payload);
        else if (row.entity === "extinguisher" && row.action === "update") await updateExt.mutateAsync(payload);
        else if (row.entity === "extinguisher") await deleteExt.mutateAsync({ id: Number(payload.id) });
        else if (row.entity === "order" && row.action === "create") await createOrder.mutateAsync(payload);
        else if (row.entity === "order" && row.action === "update") await updateOrder.mutateAsync(payload);
        else await deleteOrder.mutateAsync({ id: Number(payload.id) });
        if (row.id) await offlineDb.mutations.delete(row.id);
        done += 1;
      } catch (error) {
        failedCount += 1;
        const message = error instanceof Error ? error.message : "Falha ao enviar";
        if (row.id) await markOfflineMutationFailed(row.id, tenantKey, message);
      }
      setProgress({ done, total: rows.length, failed: failedCount });
    }
    await Promise.all([utils.clients.invalidate(), utils.extinguishers.invalidate(), utils.orders.invalidate(), utils.dashboard.stats.invalidate()]);
    setSending(false);
    toast.success(failedCount ? `${done} enviada(s), ${failedCount} com falha.` : `${done} operação(ões) sincronizada(s).`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900 sm:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Operação offline</p>
            <h1 className="text-3xl font-black">Status da sincronização</h1>
            {tenantKey && <p className="mt-1 text-xs text-slate-500">Escopo local: empresa #{tenantKey}</p>}
          </div>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isOnline ? <Wifi className="h-5 w-5 text-emerald-600" /> : <WifiOff className="h-5 w-5 text-amber-600" />}
              {isOnline ? "Conectado" : "Sem internet"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-slate-100 p-4">
              <p className="text-xs uppercase text-slate-500">Pendentes</p>
              <p className="mt-1 text-3xl font-black">{pending.length}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs uppercase text-amber-700">Com falha</p>
              <p className="mt-1 text-3xl font-black text-amber-900">{failed.length}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs uppercase text-emerald-700">Cache local</p>
              <p className="mt-1 text-sm font-semibold text-emerald-900">
                {localClients} clientes · {localExtinguishers} extintores · {localOrders} OS
              </p>
            </div>
            <div className="rounded-xl bg-sky-50 p-4">
              <p className="text-xs uppercase text-sky-700">Fila total</p>
              <p className="mt-1 text-3xl font-black text-sky-900">{mutations.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudOff className="h-5 w-5 text-slate-600" />
              Operações que precisam de atenção
            </CardTitle>
            <Button className="bg-red-600 text-white hover:bg-red-700" disabled={!tenantKey || sending || (!pending.length && !failed.length)} onClick={() => void sendQueue()}>
              <RefreshCw className={`mr-1 h-4 w-4 ${sending ? "animate-spin" : ""}`} />
              {sending ? `Enviando ${progress.done} de ${progress.total}` : "Enviar agora"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {!tenantKey && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Não foi possível identificar a empresa desta sessão. Faça login novamente para ver a fila offline.
              </div>
            )}
            {tenantKey && !failed.length && !pending.length && (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                Tudo sincronizado. Nenhuma operação pendente neste dispositivo.
              </div>
            )}
            {[...failed, ...pending].map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={item.state === "failed" ? "destructive" : "secondary"}>
                      {item.state === "failed" ? "Falhou" : "Pendente"}
                    </Badge>
                    <strong>
                      {actionLabel[item.action] || item.action} {entityLabel[item.entity] || item.entity}
                    </strong>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Criada em {new Date(item.createdAt).toLocaleString("pt-BR")} · tentativas: {item.attempts || 0}
                    {item.payload?.localId != null ? ` · id local: ${item.payload.localId}` : ""}
                    {item.payload?.id != null ? ` · id: ${item.payload.id}` : ""}
                  </p>
                  {item.lastError && <p className="mt-1 text-sm text-red-700">{item.lastError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!tenantKey || sending}
                    onClick={() => item.id && void sendQueue(item.id)}
                  >
                    <RefreshCw className={`mr-1 h-4 w-4 ${sending ? "animate-spin" : ""}`} />
                    Reprocessar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    disabled={!tenantKey}
                    onClick={() => item.id && tenantKey && void discardOfflineMutation(item.id, tenantKey)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Descartar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <p className="text-sm text-slate-500">
          Extintores, clientes e ordens de serviço salvos sem internet ficam nesta fila e são enviados automaticamente quando a conexão voltar.
          O painel inicial mostra contadores reais de pendências e falhas.
        </p>
      </div>
    </div>
  );
}
