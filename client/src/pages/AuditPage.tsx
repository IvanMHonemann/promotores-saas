import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ScrollText,
} from "lucide-react";

const ACTION_LABEL: Record<string, string> = {
  create: "Criação",
  update: "Alteração",
  delete: "Exclusão",
  restore: "Restauração",
  activate: "Ativação",
  deactivate: "Desativação",
  login: "Login",
  logout: "Logout",
  login_failed: "Login falhou",
  settings_change: "Configuração",
  security: "Segurança",
};

const MODULE_LABEL: Record<string, string> = {
  clients: "Clientes",
  extinguishers: "Extintores",
  orders: "Ordens de serviço",
  users: "Usuários",
  settings: "Configurações",
  auth: "Autenticação",
  trash: "Lixeira",
  billing: "Assinatura",
  system: "Sistema",
};

const FIELD_LABEL: Record<string, string> = {
  companyName: "Nome / empresa",
  cnpj: "CNPJ",
  address: "Endereço",
  city: "Cidade",
  cep: "CEP",
  phone: "Telefone",
  contactName: "Contato",
  cpf: "CPF",
  birthDate: "Nascimento",
  notes: "Observações",
  typeModel: "Tipo / modelo",
  capacity: "Capacidade",
  serialNumber: "Nº de série",
  locationInBuilding: "Local",
  expirationDate: "Validade",
  lastInspectionDate: "Última inspeção",
  status: "Status",
  orderDate: "Data da OS",
  clientId: "Cliente",
  replacedAndDelivered: "Substituído e entregue",
  leftReserve: "Deixou reserva",
  reserveDetails: "Detalhes da reserva",
  extinguisherExpiration: "Validade do extintor",
  licenseExpiration: "Validade da licença",
  totalAmount: "Valor total",
  paymentMethod: "Forma de pagamento",
  installmentsCount: "Parcelas",
  installmentDates: "Datas das parcelas",
  responsibleName: "Responsável",
  responsibleCpf: "CPF do responsável",
  responsibleBirthDate: "Nascimento do responsável",
  observations: "Observações",
  items: "Itens da OS",
  userName: "Nome do usuário",
  email: "E-mail",
  role: "Perfil",
  active: "Ativo",
};

function summarizeAction(row: { action?: string; module?: string; description?: string | null; entityLabel?: string | null }) {
  const action = ACTION_LABEL[row.action || ""] || row.action || "Ação";
  const area = MODULE_LABEL[row.module || ""] || row.module || "Sistema";
  if (row.description && String(row.description).trim()) return String(row.description);
  const target = row.entityLabel ? ` — ${row.entityLabel}` : "";
  return `${action} em ${area}${target}`;
}

function actionVariant(action: string): "default" | "secondary" | "destructive" | "outline" {
  if (action === "create" || action === "activate" || action === "login") return "default";
  if (action === "delete" || action === "deactivate" || action === "login_failed") return "destructive";
  if (action === "update" || action === "settings_change") return "secondary";
  return "outline";
}

function parseJson(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw !== "string") return { value: raw as any };
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? v : { value: v };
  } catch {
    return { raw };
  }
}

function formatDateTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value as any);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function formatValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function AuditPage() {
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [module, setModule] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      page,
      pageSize: 50,
      from: from || undefined,
      to: to || undefined,
      module: module === "all" ? undefined : module,
      action: action === "all" ? undefined : action,
      userId: userId === "all" ? undefined : Number(userId),
    }),
    [page, from, to, module, action, userId],
  );

  const usersQuery = trpc.companyUsers.list.useQuery();
  const listQuery = trpc.audit.list.useQuery(filters);
  const detailQuery = trpc.audit.byId.useQuery(
    { id: selectedId! },
    { enabled: selectedId != null },
  );
  const [exportPhase, setExportPhase] = useState<"idle" | "preparing" | "downloading" | "done">("idle");

  const exportMut = trpc.audit.exportCsv.useMutation({
    onMutate: () => {
      setExportPhase("preparing");
      toast.loading("Preparando exportação CSV…", { id: "audit-csv-export" });
    },
    onSuccess: (data) => {
      setExportPhase("downloading");
      toast.loading("Iniciando download…", { id: "audit-csv-export" });
      try {
        const blob = new Blob([data.csv], { type: data.contentType || "text/csv; charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = data.filename || "auditoria.csv";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        setExportPhase("done");
        toast.success("Download do CSV iniciado.", { id: "audit-csv-export" });
      } catch (err) {
        setExportPhase("idle");
        toast.error("Não foi possível salvar o arquivo CSV.", { id: "audit-csv-export" });
      }
      window.setTimeout(() => setExportPhase("idle"), 2000);
    },
    onError: (err) => {
      setExportPhase("idle");
      toast.error(err.message || "Falha ao exportar CSV.", { id: "audit-csv-export" });
    },
  });

  const items = listQuery.data?.items || [];
  const listError = listQuery.error?.message;
  const total = listQuery.data?.total || 0;
  const pageSize = listQuery.data?.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const fromIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const toIdx = Math.min(page * pageSize, total);

  const detail = detailQuery.data;
  const oldData = parseJson(detail?.oldData ?? null);
  const newData = parseJson(detail?.newData ?? null);
  const changedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (oldData) Object.keys(oldData).forEach((k) => keys.add(k));
    if (newData) Object.keys(newData).forEach((k) => keys.add(k));
    return Array.from(keys);
  }, [oldData, newData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 [&_label]:text-slate-300 [&_input]:text-slate-100 [&_button]:text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-slate-200 hover:bg-slate-800 hover:text-white" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold text-white">
                <ScrollText className="h-6 w-6 text-red-500" />
                Auditoria
              </h1>
              <p className="text-sm text-slate-300">
                Histórico do que cada usuário fez no sistema
              </p>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button
              variant="outline"
              className="border-slate-500 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
              disabled={exportMut.isPending || exportPhase === "preparing" || exportPhase === "downloading"}
              onClick={() =>
                exportMut.mutate({
                  from: from || undefined,
                  to: to || undefined,
                  module: module === "all" ? undefined : module,
                  action: action === "all" ? undefined : action,
                  userId: userId === "all" ? undefined : Number(userId),
                })
              }
            >
              {exportMut.isPending || exportPhase === "preparing" || exportPhase === "downloading" ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {exportPhase === "preparing"
                ? "Preparando arquivo…"
                : exportPhase === "downloading"
                  ? "Baixando CSV…"
                  : exportPhase === "done"
                    ? "Download iniciado"
                    : "Exportar CSV"}
            </Button>
            {(exportMut.isPending || exportPhase === "preparing" || exportPhase === "downloading") && (
              <p className="text-xs text-slate-400">Aguarde — o download vai começar em instantes.</p>
            )}
          </div>
        </div>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Filtrar registros</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">De</label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Até</label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 [color-scheme:dark]" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Área do sistema</label>
              <Select value={module} onValueChange={(v) => { setModule(v); setPage(1); }}>
                <SelectTrigger className="border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 [color-scheme:dark]"><SelectValue placeholder="Módulo" /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(MODULE_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Tipo de ação</label>
              <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
                <SelectTrigger className="border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 [color-scheme:dark]"><SelectValue placeholder="Ação" /></SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(ACTION_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">Usuário</label>
              <Select value={userId} onValueChange={(v) => { setUserId(v); setPage(1); }}>
                <SelectTrigger className="border-slate-600 bg-slate-950 text-slate-100">
                  <SelectValue placeholder="Usuários da empresa" />
                </SelectTrigger>
                <SelectContent className="border-slate-700 bg-slate-900 text-slate-100">
                  <SelectItem value="all">Todos os usuários</SelectItem>
                  {(usersQuery.data || []).map((u: any) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.userName || u.name || u.email || `Usuário #${u.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-700 bg-slate-900 text-slate-100">
          <CardContent className="p-0">
            {listError ? (
              <div className="space-y-2 px-4 py-8 text-center text-sm">
                <p className="font-medium text-red-300">Não foi possível carregar o histórico.</p>
                <p className="text-slate-400">Tente limpar as datas ou escolher &quot;Todos&quot; nos filtros e atualizar a página.</p>
              </div>
            ) : listQuery.isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-red-500" />
              </div>
            ) : items.length === 0 ? (
              <p className="py-16 text-center text-slate-400">Nenhum registro de auditoria encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="border-b border-slate-700 bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Usuário</th>
                      <th className="px-4 py-3 font-medium">Ação</th>
                      <th className="px-4 py-3 font-medium">Módulo</th>
                      <th className="px-4 py-3 font-medium">Registro</th>
                      <th className="px-4 py-3 font-medium">O que fez</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-b border-slate-800 hover:bg-slate-800/60"
                        onClick={() => setSelectedId(row.id)}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                          {formatDateTime(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{row.userName || "—"}</div>
                          <div className="text-xs text-slate-500">{row.userEmail}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={actionVariant(row.action)}>
                            {ACTION_LABEL[row.action] || row.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {MODULE_LABEL[row.module] || row.module}
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {row.entityLabel || (row.entityId != null ? `#${row.entityId}` : "—")}
                        </td>
                        <td className="max-w-xs truncate px-4 py-3 text-slate-400">
                          {row.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 text-sm text-slate-400">
              <span>
                {fromIdx}–{toIdx} de {total.toLocaleString("pt-BR")} registros
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-500 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span>
                  Página {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-slate-500 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle className="text-white">O que aconteceu</DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-red-500" />
            </div>
          ) : !detail ? (
            <p className="text-slate-400">Registro não encontrado.</p>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-4">
                <p className="text-base font-semibold text-white">
                  {summarizeAction(detail)}
                </p>
                <p className="mt-2 text-slate-300">
                  <span className="text-slate-500">Quem:</span>{" "}
                  {detail.userName || "Usuário"}{detail.userEmail ? ` (${detail.userEmail})` : ""}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Quando:</span> {formatDateTime(detail.createdAt)}
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Área:</span>{" "}
                  {MODULE_LABEL[detail.module] || detail.module}{" · "}
                  <span className="text-slate-500">Tipo:</span>{" "}
                  {ACTION_LABEL[detail.action] || detail.action}
                </p>
                {detail.entityLabel ? (
                  <p className="text-slate-300">
                    <span className="text-slate-500">Registro:</span> {detail.entityLabel}
                  </p>
                ) : null}
              </div>

              {detail.action === "update" && changedKeys.length > 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-amber-400">
                    O que mudou
                  </p>
                  <ul className="space-y-2">
                    {changedKeys
                      .filter((k) => !["id", "accountId", "createdAt", "updatedAt", "password", "passwordHash"].includes(k))
                      .map((k) => {
                        const before = oldData?.[k];
                        const after = newData?.[k];
                        const emptyBefore = before == null || before === "" || before === "—";
                        const emptyAfter = after == null || after === "" || after === "—";
                        if (emptyBefore && emptyAfter) return null;
                        return (
                          <li key={k} className="rounded-lg border border-slate-800 px-3 py-2">
                            <div className="text-xs font-semibold text-slate-400">
                              {FIELD_LABEL[k] || k}
                            </div>
                            <div className="mt-1 grid gap-1 text-sm sm:grid-cols-2">
                              <div>
                                <span className="text-slate-500">Antes: </span>
                                <span className="text-slate-200">{formatValue(before)}</span>
                              </div>
                              <div>
                                <span className="text-slate-500">Depois: </span>
                                <span className="text-emerald-300">{formatValue(after)}</span>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              ) : null}

              {detail.action === "create" && newData && Object.keys(newData).length > 0 ? (
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wide text-emerald-400">
                    Dados cadastrados
                  </p>
                  <ul className="space-y-1.5">
                    {Object.entries(newData)
                      .filter(([k]) => !["id", "accountId", "createdAt", "updatedAt", "items", "password", "passwordHash"].includes(k))
                      .filter(([, v]) => v != null && v !== "")
                      .slice(0, 12)
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between gap-3 border-b border-slate-800/80 py-1">
                          <span className="text-slate-500">{FIELD_LABEL[k] || k}</span>
                          <span className="text-right text-slate-100">{formatValue(v)}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              {detail.action === "delete" ? (
                <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-red-200">
                  Este registro foi excluído (enviado à lixeira, quando aplicável).
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
