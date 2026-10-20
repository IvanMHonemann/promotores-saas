import { useMemo, useState } from "react";
import { Ban, Building2, CalendarCheck, CheckCircle2, LogIn, Loader2, Pencil, RotateCcw, Trash2, Wallet } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { enterCompany } from "@/components/ActingAsBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const STATUS_LABEL: Record<string, string> = { trial: "Teste", test: "Teste", active: "Ativa", pending: "Pagamento pendente", overdue: "Em atraso", suspended: "Suspensa", canceled: "Cancelada", expired: "Expirada" };
const sel = "mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white";
const inp = "mt-1 border-white/15 bg-slate-950/60 text-white";
const day = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const iso = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const money = (v: unknown) => Number(v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Company = NonNullable<ReturnType<typeof useCompanies>["data"]>[number];
const useCompanies = () => trpc.platformCompanies.overview.useQuery(undefined, { staleTime: 10000 });

function stateOf(c: Company): { label: string; tone: string } {
  if (c.archivedAt) return { label: "Excluída", tone: "bg-slate-500/30 text-slate-200" };
  if (!c.active) return { label: "Bloqueada", tone: "bg-rose-500/30 text-rose-100" };
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return { label: "Plano vencido", tone: "bg-amber-400/30 text-amber-100" };
  return { label: STATUS_LABEL[c.subscriptionStatus ?? ""] ?? "Sem plano", tone: "bg-emerald-500/20 text-emerald-100" };
}

export default function PlatformCompaniesPage() {
  const utils = trpc.useUtils();
  const list = useCompanies();
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const rows = useMemo(() => (list.data || []).filter((c) => (showArchived ? true : !c.archivedAt) && c.name.toLowerCase().includes(q.trim().toLowerCase())), [list.data, q, showArchived]);
  const selected = (list.data || []).find((c) => c.id === selectedId) ?? null;
  const refresh = () => { void utils.platformCompanies.overview.invalidate(); void utils.platformCompanies.payments.invalidate(); void utils.platformPayments.list.invalidate(); void utils.platform.companies.list.invalidate(); };

  return <DashboardLayout title="Empresas" description="Plano, validade, pagamentos, bloqueio e exclusão de cada empresa." refreshing={list.isFetching} onRefresh={refresh}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-300" />Empresas ({rows.length})</CardTitle></CardHeader><CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><Input aria-label="Buscar empresa" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs border-white/15 bg-slate-950/60 text-white" /><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Mostrar excluídas</label></div>
        {list.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
        {list.isError && <p role="alert" className="text-sm text-rose-200">{list.error.message}</p>}
        <div className="space-y-2">{rows.map((c) => { const st = stateOf(c); return <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === c.id ? "border-teal-300/60 bg-teal-300/10" : "border-white/10 bg-slate-950/40 hover:border-white/25"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{c.name}</p><Badge className={st.tone}>{st.label}</Badge></div>
          <p className="mt-1 text-xs text-slate-400">{c.planName ?? "Sem plano"} · válido até {day(c.expiresAt)} · último pagamento {day(c.lastPayment)} · {c.activeUsers}/{c.users} usuários</p>
        </button>; })}</div>
      </CardContent></Card>
      {selected ? <CompanyPanel key={selected.id} company={selected} onChanged={refresh} /> : <Card className="border-dashed border-white/15 bg-slate-900/40 text-slate-300"><CardContent className="p-8 text-center text-sm">Selecione uma empresa para editar plano, validade, pagamentos, bloquear ou excluir.</CardContent></Card>}
    </div>
  </DashboardLayout>;
}

function CompanyPanel({ company: c, onChanged }: { company: Company; onChanged: () => void }) {
  const plans = trpc.platform.plans.list.useQuery(undefined, { staleTime: 60000 });
  const payments = trpc.platformCompanies.payments.useQuery({ companyId: c.id });
  const ok = (msg: string) => () => { toast.success(msg); onChanged(); };
  const fail = (e: { message: string }) => toast.error(e.message);
  const rename = trpc.platformCompanies.rename.useMutation({ onSuccess: ok("Nome atualizado."), onError: fail });
  const setPlan = trpc.platformCompanies.setPlan.useMutation({ onSuccess: ok("Plano e validade salvos."), onError: fail });
  const pay = trpc.platformCompanies.registerPayment.useMutation({ onSuccess: ok("Pagamento registrado e validade atualizada."), onError: fail });
  const delPay = trpc.platformCompanies.deletePayment.useMutation({ onSuccess: ok("Pagamento excluído."), onError: fail });
  const block = trpc.platformCompanies.setBlocked.useMutation({ onSuccess: ok("Situação atualizada."), onError: fail });
  const archive = trpc.platformCompanies.archive.useMutation({ onSuccess: ok("Empresa atualizada."), onError: fail });
  const purge = trpc.platformCompanies.purge.useMutation({ onSuccess: () => { toast.success("Empresa excluída definitivamente."); onChanged(); }, onError: fail });

  const [name, setName] = useState(c.name);
  const [planId, setPlanId] = useState(String(c.planId ?? ""));
  const [status, setStatus] = useState(c.subscriptionStatus ?? "active");
  const [startsAt, setStartsAt] = useState(iso(c.startedAt) || today());
  const [endsAt, setEndsAt] = useState(iso(c.expiresAt));
  const [grace, setGrace] = useState("0");
  const [reason, setReason] = useState(c.blockedReason ?? "");
  const [pay_, setPay] = useState({ amount: c.planPrice ? String(c.planPrice) : "", paymentDate: today(), periodFrom: today(), periodTo: "", billingType: "PIX" as const });
  const [confirm, setConfirm] = useState("");
  const st = stateOf(c);

  return <div className="space-y-4">
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-lg"><Pencil className="h-4 w-4 text-teal-300" />{c.name}</CardTitle><Badge className={st.tone}>{st.label}</Badge></CardHeader><CardContent className="space-y-3 text-sm">
      <p className="text-slate-300">Responsável: {c.adminName ?? "—"} ({c.adminEmail ?? "sem e-mail"}) · criada em {day(c.createdAt)}</p>
      {c.blockedReason && !c.active && <p className="rounded-lg bg-rose-500/10 p-2 text-rose-100">Motivo do bloqueio: {c.blockedReason}</p>}
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-[220px] flex-1"><Label>Nome da empresa</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></div><Button disabled={rename.isPending || name.trim() === c.name || name.trim().length < 2} onClick={() => rename.mutate({ companyId: c.id, name })} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar nome</Button></div>
      <Button onClick={() => enterCompany(c.id, c.name)} disabled={Boolean(c.archivedAt)} variant="outline" className="border-fuchsia-300/40 text-fuchsia-200"><LogIn className="mr-2 h-4 w-4" />Acessar como esta empresa (editar tudo)</Button>
    </CardContent></Card>

    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="h-4 w-4 text-teal-300" />Plano e validade</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Plano</Label><select value={planId} onChange={(e) => setPlanId(e.target.value)} className={sel}><option value="">Selecione…</option>{(plans.data || []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {money(p.price)}/{p.billingCycle === "yearly" ? "ano" : "mês"}{p.active === false ? " (inativo)" : ""}</option>)}</select></div>
        <div><Label>Situação</Label><select value={status} onChange={(e) => setStatus(e.target.value as any)} className={sel}>{Object.entries(STATUS_LABEL).filter(([k]) => k !== "test").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><Label>Válido a partir de</Label><Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inp} /></div>
        <div><Label>Válido até (inclusive)</Label><Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inp} /></div>
        <div><Label>Tolerância após o vencimento (dias)</Label><Input inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value.replace(/\D/g, ""))} className={inp} /></div>
      </div>
      <Button disabled={!planId || !startsAt || setPlan.isPending} onClick={() => setPlan.mutate({ companyId: c.id, planId: Number(planId), status: status as any, startsAt, endsAt: endsAt || null, graceDays: Number(grace || 0) })} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar plano e validade</Button>
      <p className="text-xs text-slate-400">Depois do último dia de validade (mais a tolerância), a empresa perde o acesso às funções comerciais e só vê a tela de regularização.</p>
    </CardContent></Card>

    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4 text-teal-300" />Pagamentos</CardTitle></CardHeader><CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Valor pago (R$)</Label><Input inputMode="decimal" value={pay_.amount} onChange={(e) => setPay({ ...pay_, amount: e.target.value.replace(",", ".") })} className={inp} /></div>
        <div><Label>Pago em</Label><Input type="date" value={pay_.paymentDate} onChange={(e) => setPay({ ...pay_, paymentDate: e.target.value })} className={inp} /></div>
        <div><Label>Plano válido de</Label><Input type="date" value={pay_.periodFrom} onChange={(e) => setPay({ ...pay_, periodFrom: e.target.value })} className={inp} /></div>
        <div><Label>Plano válido até</Label><Input type="date" value={pay_.periodTo} onChange={(e) => setPay({ ...pay_, periodTo: e.target.value })} className={inp} /></div>
        <div><Label>Forma</Label><select value={pay_.billingType} onChange={(e) => setPay({ ...pay_, billingType: e.target.value as any })} className={sel}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option><option value="UNDEFINED">Outra</option></select></div>
      </div>
      <Button disabled={pay.isPending || !c.planId || !/^\d+(\.\d{1,2})?$/.test(pay_.amount) || !pay_.periodTo} onClick={() => pay.mutate({ companyId: c.id, amount: pay_.amount, paymentDate: pay_.paymentDate, periodFrom: pay_.periodFrom, periodTo: pay_.periodTo, billingType: pay_.billingType, planId: Number(planId) || c.planId })} className="bg-emerald-500 text-white hover:bg-emerald-400"><CheckCircle2 className="mr-2 h-4 w-4" />Registrar pagamento e liberar até a data</Button>
      {!c.planId && <p className="text-xs text-amber-200">Defina o plano da empresa acima antes de registrar o pagamento.</p>}
      <div className="space-y-1 border-t border-white/10 pt-3 text-sm">{(payments.data || []).map((p: any) => <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{money(p.amount)} · pago em {day(p.paymentDate)} · {p.status}</span><Button size="sm" variant="ghost" className="text-rose-200" onClick={() => { if (window.confirm("Excluir este registro de pagamento?")) delPay.mutate({ companyId: c.id, paymentId: p.id }); }}><Trash2 className="h-4 w-4" /></Button></div>)}{!payments.data?.length && <p className="text-slate-400">Nenhum pagamento registrado.</p>}</div>
    </CardContent></Card>

    <Card className="border-rose-300/20 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4 text-rose-300" />Bloqueio e exclusão</CardTitle></CardHeader><CardContent className="space-y-3">
      {c.archivedAt ? <div className="space-y-3">
        <p className="text-sm text-slate-300">Empresa excluída em {day(c.archivedAt)} (bloqueada, dados preservados).</p>
        <Button variant="outline" onClick={() => archive.mutate({ companyId: c.id, archived: false })} className="border-white/25 text-white"><RotateCcw className="mr-2 h-4 w-4" />Restaurar empresa</Button>
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3"><p className="text-sm font-semibold text-rose-100">Exclusão definitiva (irreversível)</p><p className="text-xs text-rose-100/80">Apaga todos os dados, usuários, fotos e registros desta empresa. Digite o nome exato para confirmar.</p><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={c.name} className={inp} /><Button disabled={purge.isPending || confirm.trim() !== c.name.trim()} onClick={() => purge.mutate({ companyId: c.id, confirmName: confirm })} className="mt-2 bg-rose-600 text-white hover:bg-rose-500"><Trash2 className="mr-2 h-4 w-4" />Excluir definitivamente</Button></div>
      </div> : <>
        <div><Label>Motivo do bloqueio (mostrado à empresa)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: pagamento em atraso" className={inp} /></div>
        <div className="flex flex-wrap gap-2">
          {c.active ? <Button onClick={() => { if (window.confirm(`Bloquear ${c.name}? Todos os usuários serão desconectados.`)) block.mutate({ companyId: c.id, blocked: true, reason }); }} className="bg-amber-400 text-slate-950 hover:bg-amber-300"><Ban className="mr-2 h-4 w-4" />Bloquear (falta de pagamento)</Button>
            : <Button onClick={() => block.mutate({ companyId: c.id, blocked: false })} className="bg-emerald-500 text-white hover:bg-emerald-400"><CheckCircle2 className="mr-2 h-4 w-4" />Desbloquear</Button>}
          <Button variant="outline" onClick={() => { if (window.confirm(`Excluir ${c.name}? Ela será bloqueada e arquivada; os dados só são apagados se você excluir definitivamente depois.`)) archive.mutate({ companyId: c.id, archived: true }); }} className="border-rose-300/40 text-rose-200"><Trash2 className="mr-2 h-4 w-4" />Excluir empresa</Button>
        </div>
      </>}
    </CardContent></Card>
  </div>;
}
