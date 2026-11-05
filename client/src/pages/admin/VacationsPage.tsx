import { useMemo, useState } from "react";
import { brDate } from "@/lib/labels";
import { CalendarDays, Plus, Trash2, Pencil, Palmtree } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { todayInZone } from "@shared/expiry";

const statusLabel = (s: string, start: string, end: string) => {
  if (s === "cancelled") return "Cancelada";
  const today = todayInZone();
  if (today < start) return "Futura";
  if (today > end) return "Concluída";
  return "Em andamento";
};

function isoDate(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

export default function VacationsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState<number | "all">(new Date().getMonth() + 1);
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "scheduled" | "cancelled">("scheduled");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ memberAccountId: "", startDate: "", endDate: "", notes: "" });

  const members = trpc.vacations.members.useQuery(undefined, { staleTime: 30000 });
  const personName = (id?: number | null) => (id ? (members.data || []).find((m: any) => m.id === id)?.userName || "administrador" : "—");
  const list = trpc.vacations.list.useQuery({
    memberAccountId: memberFilter === "all" ? undefined : Number(memberFilter),
    status: statusFilter === "all" ? "all" : statusFilter,
  });
  const calendar = trpc.vacations.calendar.useQuery({ year, month: month === "all" ? undefined : month });
  const create = trpc.vacations.create.useMutation({
    onSuccess: (r) => { toast.success(r.warning || "Férias cadastradas."); setOpen(false); list.refetch(); calendar.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.vacations.update.useMutation({
    onSuccess: (r) => { toast.success(r.warning || "Férias atualizadas."); setOpen(false); list.refetch(); calendar.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const cancel = trpc.vacations.cancel.useMutation({
    onSuccess: () => { toast.success("Férias canceladas."); list.refetch(); calendar.refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm({ memberAccountId: "", startDate: "", endDate: "", notes: "" }); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ memberAccountId: String(row.memberAccountId), startDate: isoDate(row.startDate), endDate: isoDate(row.endDate), notes: row.notes || "" }); setOpen(true); };

  const save = () => {
    if (!form.memberAccountId || !form.startDate || !form.endDate) return toast.error("Preencha funcionário e datas.");
    const payload = { memberAccountId: Number(form.memberAccountId), startDate: form.startDate, endDate: form.endDate, notes: form.notes || undefined };
    if (editing) update.mutate({ id: editing.id, startDate: form.startDate, endDate: form.endDate, notes: form.notes || undefined });
    else create.mutate(payload);
  };

  const days = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate + "T00:00:00");
    const e = new Date(form.endDate + "T00:00:00");
    if (e < s) return 0;
    return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  }, [form.startDate, form.endDate]);

  const byMonth = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const row of calendar.data || []) {
      const startIso = isoDate(row.startDate);
      const endIso = isoDate(row.endDate);
      if (!startIso || !endIso) continue;
      const start = new Date(startIso + "T00:00:00");
      const end = new Date(endIso + "T00:00:00");
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
      const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
      const last = new Date(end.getFullYear(), end.getMonth(), 1);
      let guard = 0;
      while (cursor <= last && guard < 24) {
        const m = cursor.getMonth() + 1;
        (map[m] ||= []).push(row);
        cursor.setMonth(cursor.getMonth() + 1);
        guard += 1;
      }
    }
    return map;
  }, [calendar.data]);

  return (
    <DashboardLayout title="Férias" description="Programação de férias dos funcionários.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={openNew} className="bg-teal-500 text-slate-950 hover:bg-teal-400"><Plus className="mr-2 h-4 w-4" />Nova programação</Button>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{[year - 1, year, year + 1].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ano inteiro</SelectItem>
              {Array.from({ length: 12 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{new Date(2000, i).toLocaleString("pt-BR", { month: "long" })}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-teal-300" />Calendário {month === "all" ? year : `${new Date(2000, Number(month) - 1).toLocaleString("pt-BR", { month: "long" })} ${year}`}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(month === "all" ? Array.from({ length: 12 }, (_, i) => i + 1) : [month]).map((m) => (
              <div key={m} className="rounded-lg border border-white/10 p-3">
                <p className="mb-2 font-semibold text-teal-200">{new Date(2000, m - 1).toLocaleString("pt-BR", { month: "long" })}</p>
                {(byMonth[m] || []).length === 0 ? <p className="text-slate-400">Nenhuma férias.</p> : (byMonth[m] || []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-1">
                    <span>{r.memberName}</span>
                    <span className="text-slate-300">{isoDate(r.startDate).slice(8)}–{isoDate(r.endDate).slice(8)}</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70 text-white">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><Palmtree className="h-4 w-4 text-teal-300" />Programações</CardTitle>
              <div className="flex gap-2">
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Funcionário" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {(members.data || []).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.userName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Ativas</SelectItem>
                    <SelectItem value="cancelled">Canceladas</SelectItem>
                    <SelectItem value="all">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(list.data || []).map((row: any) => (
              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 p-3">
                <div>
                  <p className="font-semibold">{row.memberName}</p>
                  <p className="text-slate-300">{brDate(isoDate(row.startDate))} a {brDate(isoDate(row.endDate))} · {row.days} dias · {statusLabel(row.status, isoDate(row.startDate), isoDate(row.endDate))}</p>
                  {row.notes && <p className="text-xs text-slate-400">{row.notes}</p>}
                  <p className="text-xs text-slate-500">Criado por {personName(row.createdByMemberAccountId)}{row.updatedByMemberAccountId ? ` · editado por ${personName(row.updatedByMemberAccountId)}` : ""}{row.cancelledByMemberAccountId ? ` · cancelado por ${personName(row.cancelledByMemberAccountId)}` : ""}</p>
                </div>
                {row.status === "scheduled" && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(row)}><Pencil className="h-3 w-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => cancel.mutate({ id: row.id })}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                )}
              </div>
            ))}
            {!list.data?.length && <p className="text-slate-400">Nenhuma programação encontrada.</p>}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-white/10 bg-slate-900 text-white">
          <DialogHeader><DialogTitle>{editing ? "Editar férias" : "Nova programação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {!editing && (
              <div>
                <Label>Funcionário</Label>
                <Select value={form.memberAccountId} onValueChange={(v) => setForm({ ...form, memberAccountId: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(members.data || []).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.userName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
              <div><Label>Término</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            <p className="text-sm text-teal-300">{days ? `${days} dias corridos` : ""}</p>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={create.isPending || update.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
