import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, CalendarDays, MoreVertical, Pencil, Plus, Share2, Store as StoreIcon, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { confirmAction } from "@/components/ConfirmDialog";
import StoreForm from "@/components/StoreForm";
import { WEEKDAY_ORDER, buildRouteShareText, capitalize, defaultRouteName, duplicateOccurrenceIds, filterAndSortSchedules, findScheduleConflict, moveItem, weekdayLabel } from "@shared/routeSchedule";

const selectCls = "h-11 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-base text-white sm:h-10 sm:text-sm";

type Store = { id: number; name: string; city?: string | null };
type Promoter = { id: number; userName: string };
type Schedule = { id: number; promoterId: number; weekday: number; name: string; storeIds: number[] };
type Form = { id?: number; promoterId: string; weekday: string; name: string; storeIds: number[] };

const emptyForm = (promoterId = ""): Form => ({ promoterId, weekday: "1", name: "", storeIds: [] });

async function shareText(title: string, text: string) {
  try {
    if (navigator.share) { await navigator.share({ title, text }); return; }
    await navigator.clipboard.writeText(text);
    toast.success("Roteiro copiado. É só colar no WhatsApp.");
  } catch (error: any) {
    if (error?.name !== "AbortError") toast.info("Não foi possível compartilhar neste aparelho.");
  }
}

function ActionsMenu({ label, onEdit, onShare, onDelete }: { label: string; onEdit?: () => void; onShare?: () => void; onDelete?: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" aria-label={`Opções de ${label}`} className="h-11 w-11 shrink-0 border-white/20 p-0 text-white sm:h-9 sm:w-9"><MoreVertical className="h-5 w-5" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEdit && <DropdownMenuItem onSelect={onEdit}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
        {onShare && <DropdownMenuItem onSelect={onShare}><Share2 className="mr-2 h-4 w-4" />Compartilhar</DropdownMenuItem>}
        {onDelete && <DropdownMenuItem onSelect={onDelete} className="text-rose-300 focus:text-rose-200"><Trash2 className="mr-2 h-4 w-4" />Excluir</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function RoutesSection({ isCompanyAdmin, isPromoter, stores = [], today }: { isCompanyAdmin: boolean; isPromoter: boolean; stores: Store[]; today: string }) {
  const utils = trpc.useUtils();
  const weekly = trpc.operations.routes.weekly.useQuery(undefined, { staleTime: 15000 });
  const promotersQuery = trpc.operations.promoters.list.useQuery(undefined, { enabled: !isPromoter });
  const promoters: Promoter[] = promotersQuery.data || [];
  const [filter, setFilter] = useState<number | "all">("all");
  const [form, setForm] = useState<Form | null>(null);
  const [day, setDay] = useState(today);
  // Cadastro de loja também aqui (pedido do Ivan, 09/11/2026), com o mesmo formulário de /lojas.
  const canCreateStore = !isPromoter;
  const [storeFormOpen, setStoreFormOpen] = useState(false);

  const storeName = (id: number) => stores.find((s) => s.id === id)?.name || `Loja #${id}`;
  const promoterName = (id: number) => promoters.find((p) => p.id === id)?.userName || (isPromoter ? "Você" : `Promotor #${id}`);
  const schedules: Schedule[] = (weekly.data || []) as any;
  const visible = useMemo(() => filterAndSortSchedules(schedules, filter), [schedules, filter]);

  const invalidate = async () => {
    await utils.operations.routes.weekly.invalidate();
    await utils.operations.routes.list.invalidate();
    await utils.operations.visits.list.invalidate();
  };
  const save = trpc.operations.routes.saveWeekly.useMutation({
    onSuccess: async () => { toast.success("Roteiro salvo."); setForm(null); await invalidate(); },
    onError: (e) => toast.error(e.message || "Não foi possível salvar o roteiro."),
  });
  const remove = trpc.operations.routes.deleteWeekly.useMutation({
    onSuccess: async () => { toast.success("Roteiro excluído."); await invalidate(); },
    onError: (e) => toast.error(e.message || "Não foi possível excluir o roteiro."),
  });
  const removeDaily = trpc.operations.routes.delete.useMutation({
    onSuccess: async () => { toast.success("Roteiro do dia excluído."); await invalidate(); },
    onError: (e) => toast.error(e.message || "Não foi possível excluir."),
  });

  const submit = async () => {
    if (!form) return;
    const promoterId = Number(form.promoterId);
    const weekday = Number(form.weekday);
    if (!promoterId) return toast.error("Escolha o promotor.");
    if (!form.storeIds.length) return toast.error("Adicione pelo menos uma loja.");
    const conflict = findScheduleConflict(schedules, promoterId, weekday, form.id);
    if (conflict) {
      if (form.id) return toast.error(`${promoterName(promoterId)} já tem roteiro na ${weekdayLabel(weekday)}. Edite o roteiro que já existe.`);
      const ok = await confirmAction({ title: "Substituir roteiro?", description: `${promoterName(promoterId)} já tem o roteiro "${conflict.name}" na ${weekdayLabel(weekday)}. O novo vai ficar no lugar dele.`, confirmLabel: "Substituir" });
      if (!ok) return;
    }
    save.mutate({ id: form.id, promoterId, weekday, name: form.name.trim() || defaultRouteName(weekday), storeIds: form.storeIds });
  };

  // Abre o mesmo formulário de edição do roteiro semanal (salva no mesmo roteiro, sem criar outro).
  const editSchedule = (s: Schedule) => {
    setForm({ id: s.id, promoterId: String(s.promoterId), weekday: String(s.weekday), name: s.name, storeIds: [...(s.storeIds || [])] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const scheduleOfRoute = (route: any) => route?.weeklyScheduleId ? schedules.find((s) => s.id === route.weeklyScheduleId) : undefined;

  const share = (s: Schedule) => shareText(s.name, buildRouteShareText({ name: s.name, weekday: s.weekday, promoterName: isPromoter ? null : promoterName(s.promoterId), storeNames: (s.storeIds || []).map(storeName) }));
  const askDelete = async (s: Schedule) => {
    if (await confirmAction({ title: "Excluir este roteiro?", description: `${promoterName(s.promoterId)} deixa de ter visitas automáticas na ${weekdayLabel(s.weekday)}. Visitas já feitas continuam no histórico.`, confirmLabel: "Excluir roteiro" })) remove.mutate({ id: s.id });
  };

  // Roteiros de um dia específico (o que cada promotor tem na agenda).
  const daily = trpc.operations.routes.list.useQuery({ date: day });
  const dailyVisits = trpc.operations.visits.list.useQuery({ date: day }, { enabled: daily.isSuccess });
  const dailyHidden = useMemo(() => duplicateOccurrenceIds((daily.data || []) as any[], (dailyVisits.data || []).filter((row: any) => !["pending", "cancelled"].includes(row.visit.status)).map((row: any) => row.visit.routeId)), [daily.data, dailyVisits.data]);
  // Um card por roteiro: nunca mostra a mesma ocorrência do roteiro semanal duas vezes.
  const dailyRoutes = (daily.data || []).filter((r: any) => !dailyHidden.has(r.id) && (filter === "all" || r.promoterId === filter));
  const storesOfRoute = (routeId: number) => (dailyVisits.data || []).filter((row: any) => row.visit.routeId === routeId).map((row: any) => row.store?.name || "Loja");
  const dailyLabel = day === today ? "hoje" : new Date(`${day}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-white"><CalendarDays className="h-5 w-5 text-teal-300" />{isPromoter ? "Minha semana" : "Roteiros da semana"}</CardTitle>
            <div className="flex flex-wrap gap-2">
              {canCreateStore && !storeFormOpen && <Button type="button" variant="outline" className="border-white/20 text-white" onClick={() => setStoreFormOpen(true)}><StoreIcon className="mr-1 h-4 w-4" />Cadastrar loja</Button>}
              {isCompanyAdmin && !form && <Button type="button" onClick={() => setForm(emptyForm(filter === "all" ? "" : String(filter)))}><Plus className="mr-1 h-4 w-4" />Novo roteiro</Button>}
            </div>
          </div>
          <p className="text-sm text-slate-300">{isPromoter ? "As lojas que você visita em cada dia da semana." : "Cada promotor tem um roteiro para cada dia da semana. No dia certo, as lojas aparecem sozinhas na agenda dele."}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canCreateStore && storeFormOpen && (
            <StoreForm
              onClose={() => setStoreFormOpen(false)}
              onSaved={(store) => {
                setStoreFormOpen(false);
                // Com um roteiro aberto, a loja nova já entra no fim da lista.
                if (store.id && form) setForm({ ...form, storeIds: form.storeIds.includes(store.id) ? form.storeIds : [...form.storeIds, store.id] });
              }}
            />
          )}
          {form && (
            <div className="space-y-3 rounded-xl border border-teal-300/30 bg-teal-300/5 p-3 sm:p-4">
              <p className="font-bold text-white">{form.id ? "Editar roteiro" : "Novo roteiro"}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="route-promoter">Promotor</Label>
                  <select id="route-promoter" value={form.promoterId} onChange={(e) => setForm({ ...form, promoterId: e.target.value })} className={`mt-1 ${selectCls}`}>
                    <option value="">Escolha o promotor</option>
                    {promoters.map((p) => <option key={p.id} value={p.id}>{p.userName}</option>)}
                  </select>
                </div>
                <div><Label htmlFor="route-weekday">Dia da semana</Label>
                  <select id="route-weekday" value={form.weekday} onChange={(e) => setForm({ ...form, weekday: e.target.value })} className={`mt-1 ${selectCls}`}>
                    {WEEKDAY_ORDER.map((d) => <option key={d} value={d}>{capitalize(weekdayLabel(d))}</option>)}
                  </select>
                </div>
              </div>
              <div><Label htmlFor="route-name">Nome (opcional)</Label><Input id="route-name" className="mt-1" value={form.name} maxLength={255} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={defaultRouteName(Number(form.weekday))} /></div>
              <div>
                <Label htmlFor="route-add-store">Lojas, na ordem da visita</Label>
                <select id="route-add-store" value="" onChange={(e) => { const id = Number(e.target.value); if (id) setForm({ ...form, storeIds: [...form.storeIds, id] }); }} className={`mt-1 ${selectCls}`}>
                  <option value="">+ Adicionar loja</option>
                  {stores.filter((s) => !form.storeIds.includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.name}{s.city ? ` · ${s.city}` : ""}</option>)}
                </select>
                {!stores.length && <p className="mt-2 text-sm text-amber-200">Nenhuma loja cadastrada ainda.</p>}
                {canCreateStore && !storeFormOpen && <button type="button" onClick={() => { setStoreFormOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="mt-2 text-sm font-bold text-teal-300 underline">+ Cadastrar loja nova</button>}
                <ol className="mt-2 space-y-2">
                  {form.storeIds.map((id, i) => (
                    <li key={id} className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-950/50 p-2">
                      <span className="w-6 shrink-0 text-center text-sm font-bold text-teal-300">{i + 1}</span>
                      <span className="min-w-0 flex-1 break-words text-sm text-white">{storeName(id)}</span>
                      <Button type="button" size="icon" variant="ghost" aria-label="Subir" disabled={i === 0} onClick={() => setForm({ ...form, storeIds: moveItem(form.storeIds, i, -1) })}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Descer" disabled={i === form.storeIds.length - 1} onClick={() => setForm({ ...form, storeIds: moveItem(form.storeIds, i, 1) })}><ArrowDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" aria-label="Tirar loja" onClick={() => setForm({ ...form, storeIds: form.storeIds.filter((x) => x !== id) })}><X className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ol>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? "Salvando..." : "Salvar roteiro"}</Button>
                <Button type="button" variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
              </div>
            </div>
          )}

          {!isPromoter && promoters.length > 0 && (
            <div><Label htmlFor="route-filter">Mostrar roteiros de</Label>
              <select id="route-filter" value={filter} onChange={(e) => setFilter(e.target.value === "all" ? "all" : Number(e.target.value))} className={`mt-1 ${selectCls} sm:max-w-xs`}>
                <option value="all">Todos os promotores</option>
                {promoters.map((p) => <option key={p.id} value={p.id}>{p.userName}</option>)}
              </select>
            </div>
          )}

          {weekly.isLoading && <p className="text-sm text-slate-300">Carregando roteiros...</p>}
          {weekly.isError && <p className="text-sm text-rose-200">Não foi possível carregar os roteiros.</p>}
          {weekly.isSuccess && !visible.length && <p className="rounded-xl border border-dashed border-white/15 p-4 text-sm text-slate-300">{filter === "all" ? "Nenhum roteiro ainda." : "Esse promotor ainda não tem roteiro."}{isCompanyAdmin ? " Toque em Novo roteiro para montar." : ""}</p>}
          <div className="space-y-2">
            {visible.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-slate-100">{s.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="border-teal-300/40 text-teal-200">{capitalize(weekdayLabel(s.weekday))}</Badge>
                      {!isPromoter && <Badge variant="outline" className="border-white/20 text-slate-200">{promoterName(s.promoterId)}</Badge>}
                    </div>
                    <p className="mt-2 break-words text-sm text-slate-300">{(s.storeIds || []).map((id, i) => `${i + 1}. ${storeName(id)}`).join("  ·  ") || "Sem lojas"}</p>
                  </div>
                  <ActionsMenu label={s.name}
                    onEdit={isCompanyAdmin ? () => editSchedule(s) : undefined}
                    onShare={() => void share(s)}
                    onDelete={isCompanyAdmin ? () => void askDelete(s) : undefined} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <CardTitle className="text-white">Agenda de {dailyLabel}</CardTitle>
            {!isPromoter && <div><Label htmlFor="route-day" className="sr-only">Dia</Label><Input id="route-day" type="date" value={day} onChange={(e) => setDay(e.target.value || today)} className="w-auto" /></div>}
          </div>
          <p className="text-sm text-slate-300">O que cada promotor tem para visitar nesse dia.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {daily.isLoading && <p className="text-sm text-slate-300">Carregando...</p>}
          {daily.isError && <p className="text-sm text-rose-200">Não foi possível carregar a agenda.</p>}
          {daily.isSuccess && !dailyRoutes.length && <p className="text-sm text-slate-300">Nenhuma visita programada nesse dia.</p>}
          {dailyRoutes.map((route: any) => {
            const names = storesOfRoute(route.id);
            const schedule = scheduleOfRoute(route);
            return (
              <div key={route.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-slate-100">{route.name}</p>
                    {!isPromoter && <p className="text-sm text-slate-300">{promoterName(route.promoterId)}</p>}
                    {names.length > 0 && <p className="mt-1 break-words text-sm text-slate-400">{names.map((n: string, i: number) => `${i + 1}. ${n}`).join("  ·  ")}</p>}
                  </div>
                  <ActionsMenu label={route.name}
                    onEdit={isCompanyAdmin && schedule ? () => editSchedule(schedule) : undefined}
                    onShare={() => void shareText(route.name, buildRouteShareText({ name: route.name, promoterName: isPromoter ? null : promoterName(route.promoterId), storeNames: names }))}
                    onDelete={isCompanyAdmin && !route.weeklyScheduleId ? async () => { if (await confirmAction({ title: "Excluir este roteiro do dia?", description: "O promotor deixa de ver estas visitas na agenda.", confirmLabel: "Excluir" })) removeDaily.mutate({ id: route.id }); } : undefined} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
