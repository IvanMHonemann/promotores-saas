import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, CalendarClock, ChevronLeft, ChevronRight, Download, Loader2, MapPin, ShieldCheck, Timer, UserRound } from "lucide-react";

const CATEGORY_LABEL: Record<string, string> = {
  visits: "Visitas e tarefas",
  time_tracking: "Ponto eletrônico",
  corrections: "Correções de ponto",
  products: "Produtos e validades",
  other: "Outras atividades",
  users: "Usuários",
  settings: "Configurações",
  auth: "Acesso ao sistema",
  billing: "Assinatura",
  system: "Sistema",
};
const ACTION_LABEL: Record<string, string> = {
  clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Fim do intervalo", clock_out: "Saída",
  pending: "Tarefa atribuída", in_progress: "Visita iniciada", completed: "Concluída", not_done: "Não realizada", cancelled: "Cancelada",
  submitted: "Enviado", upload: "Enviada", approved: "Aprovada", rejected: "Rejeitada", create: "Criou", update: "Alterou", delete: "Excluiu", restore: "Restaurou", activate: "Ativou", deactivate: "Desativou", login: "Entrou no sistema", logout: "Saiu do sistema", login_failed: "Falha de acesso", settings_change: "Alterou configuração", security: "Segurança",
};
type ActivityRow = {
  activityId: string;
  promoterId: number;
  userName?: string | null;
  userEmail?: string | null;
  occurredAt: string | Date;
  module: string;
  action: string;
  entityType?: string;
  entityLabel?: string | null;
  description?: string | null;
  details?: unknown;
};
type AddressState = { status: "loading" | "ready" | "not_found" | "not_configured" | "error"; address?: string };
function formatDateTime(value: unknown) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium" }).format(date);
}
function parseDetails(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { detalhe: parsed }; }
    catch { return { detalhe: value }; }
  }
  return { detalhe: value };
}
function coordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}
function displayValue(value: unknown) {
  if (value == null || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  return String(value);
}
function moduleIcon(module: string) {
  if (module === "time_tracking") return Timer;
  if (module === "visits") return MapPin;
  if (module === "corrections") return ShieldCheck;
  return Activity;
}
function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [promoterId, setPromoterId] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const filters = useMemo(() => ({
    page, pageSize: 50, from: from || undefined, to: to || undefined,
    promoterId: promoterId === "all" ? undefined : Number(promoterId),
    category: category === "all" ? undefined : category,
    search: search.trim() || undefined,
  }), [page, from, to, promoterId, category, search]);
  const promotersQuery = trpc.audit.promoters.useQuery();
  const listQuery = trpc.audit.promoterActivity.useQuery(filters);
  const utils = trpc.useUtils();
  const exportMutation = trpc.audit.promoterActivityExportCsv.useMutation({
    onSuccess: (result) => { downloadCsv(result.csv, result.filename); toast.success("Arquivo de atividades baixado."); },
    onError: (error) => toast.error(error.message || "Não foi possível exportar o histórico."),
  });
  const items = (listQuery.data?.items || []) as ActivityRow[];
  const total = listQuery.data?.total || 0;
  const pageSize = listQuery.data?.pageSize || 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const promoters = promotersQuery.data || [];
  const onFilterChange = (change: () => void) => { change(); setPage(1); };
  const [addresses, setAddresses] = useState<Record<string, AddressState>>({});
  const addressesRef = useRef<Record<string, AddressState>>({});
  const reverseGeocode = trpc.audit.reverseGeocodePoint.useMutation();

  useEffect(() => {
    const points = new Map<string, { latitude: number; longitude: number }>();
    for (const row of items) {
      if (row.module !== "time_tracking") continue;
      const details = parseDetails(row.details);
      if (details.latitude == null || details.longitude == null) continue;
      const latitude = Number(details.latitude);
      const longitude = Number(details.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
      const key = coordinateKey(latitude, longitude);
      const cached = addressesRef.current[key];
      if (cached && cached.status !== "loading") {
        setAddresses((current) => current[key] ? current : { ...current, [key]: cached });
      } else {
        points.set(key, { latitude, longitude });
      }
    }

    let cancelled = false;
    const resolveAddresses = async () => {
      const entries = [...points.entries()];
      for (let index = 0; index < entries.length; index++) {
        if (cancelled) return;
        const [key, point] = entries[index];
        const cached = addressesRef.current[key];
        if (cached && cached.status !== "loading") continue;

        const loading: AddressState = { status: "loading" };
        addressesRef.current = { ...addressesRef.current, [key]: loading };
        if (!cancelled) setAddresses((current) => ({ ...current, [key]: loading }));
        try {
          const result = await reverseGeocode.mutateAsync(point);
          const resolved: AddressState = result.address
            ? { status: "ready", address: result.address }
            : { status: result.configured ? "not_found" : "not_configured" };
          addressesRef.current = { ...addressesRef.current, [key]: resolved };
          if (!cancelled) setAddresses((current) => ({ ...current, [key]: resolved }));

          if (!result.configured) {
            for (const [pendingKey] of entries.slice(index + 1)) {
              addressesRef.current = { ...addressesRef.current, [pendingKey]: { status: "not_configured" } };
            }
            if (!cancelled) setAddresses({ ...addressesRef.current });
            break;
          }
        } catch {
          const failed: AddressState = { status: "error" };
          addressesRef.current = { ...addressesRef.current, [key]: failed };
          if (!cancelled) setAddresses((current) => ({ ...current, [key]: failed }));
        }
        if (index < entries.length - 1 && !cancelled) await new Promise((resolve) => setTimeout(resolve, 250));
      }
    };
    void resolveAddresses();
    return () => { cancelled = true; };
  }, [items]);

  return <DashboardLayout title="Auditoria de atividades" description="Acompanhe visitas, ponto, correções, produtos e demais ações registradas pelos promotores." refreshing={listQuery.isFetching} onRefresh={() => { void utils.audit.promoterActivity.invalidate(); }}>
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl border border-teal-300/15 bg-gradient-to-br from-teal-300/[.10] to-slate-900/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-teal-300/10 p-2.5 text-teal-200"><Activity className="h-5 w-5"/></div><div className="min-w-0"><h2 className="font-bold text-white">Histórico de campo</h2><p className="mt-1 text-sm leading-relaxed text-slate-300">Reúne tarefas e visitas, marcações de ponto, correções, produtos e outros eventos registrados no sistema.</p></div></div>
        <Button onClick={() => exportMutation.mutate({ from: from || undefined, to: to || undefined, promoterId: promoterId === "all" ? undefined : Number(promoterId), category: category === "all" ? undefined : category, search: search.trim() || undefined })} disabled={exportMutation.isPending} className="w-full shrink-0 bg-teal-300 font-semibold text-slate-950 hover:bg-teal-200 sm:w-auto"><span className="flex items-center justify-center gap-2">{exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}Exportar CSV</span></Button>
      </div>

      <Card className="min-w-0 border-white/10 bg-slate-900/70 text-white">
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtrar atividades</CardTitle></CardHeader>
        <CardContent className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <label className="min-w-0 text-xs font-medium text-slate-300">De<Input type="date" value={from} onChange={e = className="[color-scheme:dark]"> onFilterChange(() => setFrom(e.target.value))} className="mt-1 min-w-0 border-white/15 bg-slate-950/70 text-white [color-scheme:dark]"/></label>
          <label className="min-w-0 text-xs font-medium text-slate-300">Até<Input type="date" value={to} onChange={e = className="[color-scheme:dark]"> onFilterChange(() => setTo(e.target.value))} className="mt-1 min-w-0 border-white/15 bg-slate-950/70 text-white [color-scheme:dark]"/></label>
          <div className="min-w-0"><label className="text-xs font-medium text-slate-300">Promotor</label><Select value={promoterId} onValueChange={v => onFilterChange(() => setPromoterId(v))}><SelectTrigger className="mt-1 min-w-0 border-white/15 bg-slate-950/70 text-white"><SelectValue/></SelectTrigger><SelectContent className="border-white/10 bg-slate-900 text-white"><SelectItem value="all">Todos os promotores</SelectItem>{promoters.map((user: any) => <SelectItem key={user.id} value={String(user.id)}>{user.userName || user.name || user.email}</SelectItem>)}</SelectContent></Select></div>
          <div className="min-w-0"><label className="text-xs font-medium text-slate-300">Tipo de atividade</label><Select value={category} onValueChange={v => onFilterChange(() => setCategory(v))}><SelectTrigger className="mt-1 min-w-0 border-white/15 bg-slate-950/70 text-white"><SelectValue/></SelectTrigger><SelectContent className="border-white/10 bg-slate-900 text-white"><SelectItem value="all">Todas as atividades</SelectItem><SelectItem value="visits">Visitas e tarefas</SelectItem><SelectItem value="time_tracking">Ponto eletrônico</SelectItem><SelectItem value="corrections">Correções de ponto</SelectItem><SelectItem value="products">Produtos e validades</SelectItem><SelectItem value="other">Outras atividades</SelectItem></SelectContent></Select></div>
          <label className="min-w-0 text-xs font-medium text-slate-300 sm:col-span-2 xl:col-span-1">Buscar<Input value={search} onChange={e => onFilterChange(() => setSearch(e.target.value))} placeholder="Nome, loja ou atividade" className="mt-1 min-w-0 border-white/15 bg-slate-950/70 text-white placeholder:text-slate-500"/></label>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-slate-300"><span>{total.toLocaleString("pt-BR")} atividade(s) encontrada(s)</span><span className="text-xs text-slate-400">Mais recentes primeiro</span></div>
      {listQuery.isLoading ? <div className="flex justify-center rounded-2xl border border-white/10 bg-slate-900/70 py-16"><Loader2 className="h-8 w-8 animate-spin text-teal-300"/></div> : listQuery.isError ? <Card className="border-rose-300/20 bg-rose-300/5 text-rose-100"><CardContent className="p-5"><p className="font-semibold">Não foi possível carregar as atividades.</p><p className="mt-1 text-sm text-rose-100/75">Atualize a página ou ajuste os filtros e tente novamente.</p></CardContent></Card> : items.length === 0 ? <Card className="border-white/10 bg-slate-900/70 text-white"><CardContent className="p-10 text-center"><Activity className="mx-auto mb-3 h-8 w-8 text-slate-500"/><p className="font-semibold">Nenhuma atividade encontrada</p><p className="mt-1 text-sm text-slate-400">Tente ampliar o período ou limpar os filtros.</p></CardContent></Card> : <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
        {items.map((row) => {
          const Icon = moduleIcon(row.module);
          const details = parseDetails(row.details);
          const hasPointCoordinates = row.module === "time_tracking" && details.latitude != null && details.longitude != null && Number.isFinite(Number(details.latitude)) && Number.isFinite(Number(details.longitude));
          const pointAddressKey = hasPointCoordinates ? coordinateKey(Number(details.latitude), Number(details.longitude)) : null;
          const pointAddress = pointAddressKey ? addresses[pointAddressKey] : undefined;
          const pointAddressLabel = pointAddress?.status === "ready" ? pointAddress.address : pointAddress?.status === "not_configured" ? "Endereço ainda não configurado" : pointAddress?.status === "not_found" ? "Endereço não localizado" : pointAddress?.status === "error" ? "Endereço indisponível no momento" : "Consultando endereço…";
          const detailEntries = Object.entries(details).filter(([key, value]) => value != null && value !== "" && !(row.module === "time_tracking" && ["latitude", "longitude", "locationstatus", "location_status"].includes(key.toLowerCase())));
          const actionLabel = ACTION_LABEL[row.action] || row.action.replaceAll("_", " ");
          return <Card key={row.activityId} className="min-w-0 overflow-hidden border-white/10 bg-slate-900/70 text-white">
            <CardContent className="min-w-0 p-4 sm:p-5">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-xl border border-teal-300/15 bg-teal-300/[.08] p-2 text-teal-200"><Icon className="h-4 w-4"/></div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-wrap items-center gap-2"><Badge className="max-w-full whitespace-normal border border-teal-300/15 bg-teal-300/10 text-teal-100">{CATEGORY_LABEL[row.module] || row.module}</Badge><Badge variant="outline" className="max-w-full whitespace-normal border-white/15 text-slate-200">{actionLabel}</Badge></div>
                  <h3 className="mt-2 break-words font-bold leading-snug text-white">{row.description || row.entityLabel || "Atividade registrada"}</h3>
                  {row.entityLabel && row.description !== row.entityLabel && <p className="mt-1 break-words text-sm text-slate-300">{row.entityLabel}</p>}
                </div>
              </div>
              <div className="mt-4 grid min-w-0 grid-cols-1 gap-2 border-y border-white/[.07] py-3 sm:grid-cols-2">
                <div className="flex min-w-0 items-start gap-2 text-sm"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><span className="min-w-0 break-words text-slate-200">{formatDateTime(row.occurredAt)}</span></div>
                <div className="flex min-w-0 items-start gap-2 text-sm"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><span className="min-w-0 break-words"><span className="font-semibold text-white">{row.userName || `Promotor #${row.promoterId}`}</span>{row.userEmail && <span className="block break-all text-xs text-slate-400">{row.userEmail}</span>}</span></div>
              </div>
              {(detailEntries.length > 0 || hasPointCoordinates) && <dl className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-2 pt-3 sm:grid-cols-2">
                {hasPointCoordinates && <div className="min-w-0 rounded-lg bg-slate-950/40 px-3 py-2"><dt className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-400">Endereço da batida</dt><dd className="mt-1 min-w-0 break-words text-sm leading-relaxed text-slate-200">{pointAddressLabel}</dd>{pointAddress?.status === "ready" && <dd className="mt-1 text-[10px] text-slate-500">Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer" className="text-teal-200 underline">Geoapify</a> · dados <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-teal-200 underline">© OpenStreetMap contributors</a></dd>}</div>}
                {detailEntries.map(([key, value]) => {
                  const isFileUrl = key === "arquivoUrl" && typeof value === "string";
                  return <div key={key} className="min-w-0 rounded-lg bg-slate-950/40 px-3 py-2"><dt className="break-words text-[11px] font-semibold uppercase tracking-wide text-slate-400">{key.replaceAll("_", " ")}</dt><dd className="mt-1 min-w-0 break-words text-sm leading-relaxed text-slate-200">{isFileUrl ? <a href={value as string} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 break-all text-teal-200 underline decoration-teal-200/40 underline-offset-2">Abrir arquivo</a> : displayValue(value)}</dd></div>;
                })}
              </dl>}
            </CardContent>
          </Card>;
        })}
      </div>}
      <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between"><span>Mostrando {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} de {total.toLocaleString("pt-BR")}</span><div className="flex items-center justify-between gap-3 sm:justify-end"><Button variant="outline" size="sm" className="border-white/15 bg-slate-950/40 text-white" disabled={page <= 1 || listQuery.isFetching} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft className="mr-1 h-4 w-4"/>Anterior</Button><span className="whitespace-nowrap">Página {page} / {totalPages}</span><Button variant="outline" size="sm" className="border-white/15 bg-slate-950/40 text-white" disabled={page >= totalPages || listQuery.isFetching} onClick={() => setPage(p => p + 1)}>Próxima<ChevronRight className="ml-1 h-4 w-4"/></Button></div></div>
    </div>
  </DashboardLayout>;
}
