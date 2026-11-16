import { useEffect, useMemo, useState } from "react";
import { Ban, Building2, CalendarCheck, CheckCircle2, LogIn, Loader2, Pencil, Plus, QrCode, RotateCcw, Trash2, UserPlus, Wallet } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { enterCompany } from "@/components/ActingAsBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/PasswordInput";
import { trpc } from "@/lib/trpc";
import { ENTITLEMENT_CATALOG, type EntitlementKey } from "@shared/entitlements";
import { isSelectablePlan, nextPaidPeriod, planSelectLabel } from "@shared/commercialPlans";
import { effectiveUserLimit, parseExtraUsers, staffUsageLabel, suggestedMonthlyAmount } from "@shared/staffLimit";
import { termsAcceptanceLabel } from "@shared/legalOverview";
import { toast } from "sonner";
import { confirmAction } from "@/components/ConfirmDialog";
import GeneratePixDialog from "@/components/platform/GeneratePixDialog";

const STATUS_LABEL: Record<string, string> = { trial: "Teste", test: "Teste", active: "Ativa", pending: "Pagamento pendente", overdue: "Em atraso", suspended: "Suspensa", canceled: "Cancelada", expired: "Expirada" };
const sel = "mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white";
const inp = "mt-1 border-white/15 bg-slate-950/60 text-white";
const day = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
const iso = (v: unknown) => (v ? new Date(v as any).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }) : "");
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const DEFAULT_COMPANY_FEATURES: EntitlementKey[] = ["dashboard", "fieldOperations", "timeTracking"];
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
  const [creating, setCreating] = useState(false);
  const [pixFor, setPixFor] = useState<{ id: number; name: string } | null>(null);
  const rows = useMemo(() => (list.data || []).filter((c) => (showArchived ? true : !c.archivedAt) && c.name.toLowerCase().includes(q.trim().toLowerCase())), [list.data, q, showArchived]);
  const selected = (list.data || []).find((c) => c.id === selectedId) ?? null;
  const refresh = () => { void utils.platformCompanies.overview.invalidate(); void utils.platformCompanies.payments.invalidate(); void utils.platformPayments.list.invalidate(); void utils.platform.companies.list.invalidate(); };

  return <DashboardLayout title="Empresas" description="Crie empresas e gerencie módulos, validade, bloqueio e exclusão." refreshing={list.isFetching} onRefresh={refresh}>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3"><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-teal-300" />Empresas ({rows.length})</CardTitle><Button size="sm" className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={() => { setCreating(true); setSelectedId(null); }}><Plus className="h-4 w-4" /> Nova empresa</Button></CardHeader><CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3"><Input aria-label="Buscar empresa" placeholder="Buscar por nome" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs border-white/15 bg-slate-950/60 text-white" /><label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Mostrar excluídas</label></div>
        {list.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Carregando...</p>}
        {list.isError && <p role="alert" className="text-sm text-rose-200">{list.error.message}</p>}
        <div className="space-y-2">{rows.map((c) => { const st = stateOf(c); return <button key={c.id} type="button" onClick={() => { setSelectedId(c.id); setCreating(false); if (window.innerWidth < 1280) window.setTimeout(() => document.getElementById("empresa-selecionada")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} className={`w-full rounded-xl border p-3 text-left transition ${selectedId === c.id ? "border-teal-300/60 bg-teal-300/10" : "border-white/10 bg-slate-950/40 hover:border-white/25"}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-bold">{c.name}</p><Badge className={st.tone}>{st.label}</Badge></div>
          <p className="mt-1 text-xs text-slate-400">{c.legalName || "Razão social não cadastrada"}{c.taxDocument ? ` · CNPJ/CPF ${c.taxDocument}` : " · sem CNPJ/CPF"}{(c.addressCity || c.addressState) ? ` · ${[c.addressCity, c.addressState].filter(Boolean).join("/")}` : ""}</p>
          <p className="mt-1 text-xs text-slate-400">{c.planName ?? "Sem plano"} · válido até {day(c.expiresAt)} · último pagamento {day(c.lastPayment)} · {c.activeUsers}/{c.users} usuários</p>
          <p className={`mt-1 text-xs ${c.termsAcceptedCurrent ? "text-emerald-300/80" : "text-amber-200/80"}`}>{termsAcceptanceLabel(c, day)}</p>
          {!c.archivedAt && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" className="bg-teal-300 text-slate-950 hover:bg-teal-200" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); setCreating(false); setPixFor({ id: c.id, name: c.name }); }}>
                <QrCode className="mr-1.5 h-3.5 w-3.5" />Gerar Pix
              </Button>
            </div>
          )}
        </button>; })}</div>
      </CardContent></Card>
      {creating ? <div id="empresa-selecionada" className="min-w-0 scroll-mt-4"><CreateCompanyCard onCancel={() => setCreating(false)} onCreated={(id) => { setCreating(false); setSelectedId(id); refresh(); }} /></div> : selected ? <div id="empresa-selecionada" className="min-w-0 scroll-mt-4"><CompanyPanel key={selected.id} company={selected} onChanged={refresh} onGeneratePix={() => setPixFor({ id: selected.id, name: selected.name })} /></div> : <Card className="border-dashed border-white/15 bg-slate-900/40 text-slate-300"><CardContent className="p-8 text-center text-sm">Selecione uma empresa para editar módulos, validade, bloquear ou excluir, ou cadastre uma nova.</CardContent></Card>}
    </div>
    {pixFor && (
      <GeneratePixDialog
        companyId={pixFor.id}
        companyName={pixFor.name}
        open={Boolean(pixFor)}
        onOpenChange={(open) => { if (!open) setPixFor(null); }}
        onGenerated={refresh}
      />
    )}
  </DashboardLayout>;
}

function CreateCompanyCard({ onCancel, onCreated }: { onCancel: () => void; onCreated: (companyId: number) => void }) {
  const [form, setForm] = useState({ companyName: "", userName: "", email: "", password: "", featureKeys: DEFAULT_COMPANY_FEATURES });
  const create = trpc.platform.companies.create.useMutation({
    onSuccess: (data) => { toast.success(`Empresa criada. Código de recuperação: ${data.recoveryCode}`, { duration: 12000 }); onCreated(data.companyId); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = (key: EntitlementKey) => setForm((prev) => ({ ...prev, featureKeys: prev.featureKeys.includes(key) ? prev.featureKeys.filter((k) => k !== key) : [...prev.featureKeys, key] }));
  const submit = () => {
    if (form.companyName.trim().length < 2) return toast.info("Informe o nome da empresa.");
    if (form.userName.trim().length < 2) return toast.info("Informe o nome do administrador.");
    if (!form.email.trim()) return toast.info("Informe o e-mail de acesso.");
    if (form.password.length < 8) return toast.info("A senha precisa ter ao menos 8 caracteres.");
    create.mutate({ companyName: form.companyName.trim(), userName: form.userName.trim(), email: form.email.trim(), password: form.password, featureKeys: form.featureKeys });
  };
  return (
    <Card className="border-white/10 bg-slate-900/70 text-white">
      <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="h-4 w-4 text-teal-300" />Nova empresa</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div><Label htmlFor="nova-empresa-nome">Nome da empresa</Label><Input id="nova-empresa-nome" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} placeholder="Ex.: Empresa ABC" className={inp} /></div>
        <div>
          <Label>Módulos liberados</Label>
          <div className="mt-1 grid gap-1 rounded-lg border border-white/10 bg-slate-950/40 p-3 text-sm">
            {ENTITLEMENT_CATALOG.map((f) => (
              <label key={f.key} className="flex items-center gap-2">
                <input type="checkbox" checked={form.featureKeys.includes(f.key)} onChange={() => toggle(f.key)} />
                {f.label}
              </label>
            ))}
          </div>
        </div>
        <div><Label htmlFor="nova-empresa-admin">Nome do administrador</Label><Input id="nova-empresa-admin" value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} placeholder="Nome do responsável" className={inp} /></div>
        <div><Label htmlFor="nova-empresa-email">E-mail de acesso</Label><Input id="nova-empresa-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@empresa.com" className={inp} /></div>
        <div>
          <Label htmlFor="nova-empresa-senha">Senha inicial</Label>
          <PasswordInput id="nova-empresa-senha" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo de 8 caracteres" className={`${inp} border-slate-700 bg-slate-950 text-white`} />
          <p className="mt-1 text-xs text-slate-400">A senha é armazenada protegida e não poderá ser visualizada depois.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button disabled={create.isPending} onClick={submit} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}Criar empresa</Button>
          <Button variant="outline" className="border-white/20 text-white" onClick={onCancel}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyPanel({ company: c, onChanged, onGeneratePix }: { company: Company; onChanged: () => void; onGeneratePix: () => void }) {
  const plans = trpc.platform.plans.list.useQuery(undefined, { staleTime: 60000 });
  const payments = trpc.platformCompanies.payments.useQuery({ companyId: c.id });
  const ok = (msg: string) => () => { toast.success(msg); onChanged(); };
  const fail = (e: { message: string }) => toast.error(e.message);
  const rename = trpc.platformCompanies.rename.useMutation({ onSuccess: ok("Nome atualizado."), onError: fail });
  const setPlan = trpc.platformCompanies.setPlan.useMutation({ onError: fail });
  const pay = trpc.platformCompanies.registerPayment.useMutation({ onSuccess: ok("Pagamento registrado e validade atualizada."), onError: fail });
  const setBilling = trpc.platformCompanies.setBilling.useMutation({ onError: fail });
  const delPay = trpc.platformCompanies.deletePayment.useMutation({ onSuccess: ok("Pagamento excluído."), onError: fail });
  const block = trpc.platformCompanies.setBlocked.useMutation({ onSuccess: ok("Situação atualizada."), onError: fail });
  const archive = trpc.platformCompanies.archive.useMutation({ onSuccess: ok("Empresa atualizada."), onError: fail });
  const enterAs = trpc.platformCompanies.enterAs.useMutation();
  const purge = trpc.platformCompanies.purge.useMutation({ onSuccess: () => { toast.success("Empresa excluída definitivamente."); onChanged(); }, onError: fail });

  const [name, setName] = useState(c.name);
  const [planId, setPlanId] = useState(String(c.planId ?? ""));
  const [status, setStatus] = useState(c.subscriptionStatus ?? "active");
  const [startsAt] = useState(iso(c.startedAt) || today());
  const [endsAt, setEndsAt] = useState(iso(c.expiresAt));
  const [editingDue, setEditingDue] = useState(false);
  const [grace, setGrace] = useState(String((c as any).blockAfterOverdueDays ?? 5));
  const [monthlyAmount, setMonthlyAmount] = useState(String((c as any).monthlyAmount ?? c.planPrice ?? ""));
  const [payAmount, setPayAmount] = useState(String((c as any).monthlyAmount ?? c.planPrice ?? ""));
  const [extraUsers, setExtraUsers] = useState(String((c as any).extraUsers ?? 0));
  const [payDate, setPayDate] = useState(today());
  const [payType, setPayType] = useState<"PIX" | "BOLETO" | "CREDIT_CARD" | "UNDEFINED">("PIX");
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState(c.blockedReason ?? "");
  const [confirm, setConfirm] = useState("");
  const st = stateOf(c);
  const planOptions = (plans.data || []).filter((p: any) => isSelectablePlan(p, c.planId));
  const paidPeriod = nextPaidPeriod(iso(c.expiresAt) || null, today());
  const extrasN = parseExtraUsers(extraUsers);
  const selectedPlan = (plans.data || []).find((p: any) => String(p.id) === planId) ?? null;
  const liveLimit = effectiveUserLimit({
    maxUsers: selectedPlan ? (selectedPlan.maxUsers == null ? null : Number(selectedPlan.maxUsers)) : (c as any).planMaxUsers,
    extraUsers: extrasN,
  });
  const liveSuggested = selectedPlan
    ? suggestedMonthlyAmount({ planPrice: selectedPlan.price, extraUsers: extrasN, additionalUserPrice: selectedPlan.additionalUserPrice })
    : ((c as any).suggestedMonthlyAmount ?? "");

  const applySuggested = (plan: any, extras: number) => {
    if (!plan) return;
    const suggested = suggestedMonthlyAmount({ planPrice: plan.price, extraUsers: extras, additionalUserPrice: plan.additionalUserPrice });
    setMonthlyAmount(suggested);
    setPayAmount(suggested);
  };

  const onPlanChange = (id: string) => {
    setPlanId(id);
    const selected = (plans.data || []).find((p: any) => String(p.id) === id);
    applySuggested(selected, extrasN);
  };

  const onExtrasChange = (raw: string) => {
    const cleaned = raw.replace(/\D/g, "");
    setExtraUsers(cleaned);
    const selected = (plans.data || []).find((p: any) => String(p.id) === planId);
    applySuggested(selected, parseExtraUsers(cleaned));
  };

  const saveAll = async () => {
    if (!planId) return toast.info("Selecione um plano.");
    if (monthlyAmount && !/^\d+(\.\d{1,2})?$/.test(monthlyAmount)) return toast.info("Valor mensal inválido.");
    setSaving(true);
    try {
      await setBilling.mutateAsync({
        companyId: c.id,
        monthlyAmount: /^\d+(\.\d{1,2})?$/.test(monthlyAmount) ? monthlyAmount : undefined,
        blockAfterOverdueDays: Number(grace || 5),
        dueDate: endsAt || undefined,
        extraUsers: extrasN,
      });
      await setPlan.mutateAsync({
        companyId: c.id,
        planId: Number(planId),
        status: status as any,
        startsAt: startsAt || today(),
        endsAt: endsAt || null,
        graceDays: Number(grace || 5),
      });
      toast.success("Plano e pagamento salvos.");
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const registerPay = () => {
    if (!c.planId) return toast.info("Salve o plano da empresa antes de registrar o pagamento.");
    if (!/^\d+(\.\d{1,2})?$/.test(payAmount)) return toast.info("Informe o valor pago.");
    const until = new Date(`${paidPeriod.periodTo}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    void confirmAction({
      title: `Registrar pagamento de ${money(payAmount)} para ${c.name}? A validade será estendida até ${until}.`,
      confirmLabel: "Registrar pagamento",
    }).then((okConfirm) => okConfirm && pay.mutate({
      companyId: c.id,
      amount: payAmount,
      paymentDate: payDate,
      periodFrom: paidPeriod.periodFrom,
      periodTo: paidPeriod.periodTo,
      billingType: payType,
      planId: c.planId,
    }));
  };

  return <div className="space-y-4">
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="flex items-center gap-2 text-lg"><Pencil className="h-4 w-4 text-teal-300" />{c.name}</CardTitle><Badge className={st.tone}>{st.label}</Badge></CardHeader><CardContent className="space-y-3 text-sm">
      <p className="text-slate-300">Responsável: {c.adminName ?? "—"} ({c.adminEmail ?? "sem e-mail"}) · criada em {day(c.createdAt)}</p>
      <p className="text-slate-300">Cadastro: {c.legalName || "—"} · {c.taxDocument || "sem CNPJ/CPF"} · {[c.addressStreet, c.addressCity, c.addressState].filter(Boolean).join(", ") || "endereço não cadastrado"}</p>
      <p className={c.termsAcceptedCurrent ? "text-emerald-200" : "text-amber-100"}>{termsAcceptanceLabel(c, day)}</p>
      {c.blockedReason && !c.active && <p className="rounded-lg bg-rose-500/10 p-2 text-rose-100">Motivo do bloqueio: {c.blockedReason}</p>}
      <div className="flex flex-wrap items-end gap-2"><div className="min-w-[220px] flex-1"><Label>Nome da empresa</Label><Input value={name} onChange={(e) => setName(e.target.value)} className={inp} /></div><Button disabled={rename.isPending || name.trim() === c.name || name.trim().length < 2} onClick={() => rename.mutate({ companyId: c.id, name })} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar nome</Button></div>
      <Button onClick={() => enterCompany(c.id, c.name, () => enterAs.mutateAsync({ companyId: c.id }))} disabled={Boolean(c.archivedAt)} variant="outline" className="h-auto min-h-10 whitespace-normal border-fuchsia-300/40 text-left text-fuchsia-200"><LogIn className="mr-2 h-4 w-4" />Acessar como esta empresa (editar tudo)</Button>
    </CardContent></Card>

    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarCheck className="h-4 w-4 text-teal-300" />Plano e pagamento</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Plano</Label><select value={planId} onChange={(e) => onPlanChange(e.target.value)} className={sel}><option value="">Selecione…</option>{planOptions.map((p: any) => <option key={p.id} value={p.id}>{planSelectLabel(p)}</option>)}</select></div>
        <div><Label>Situação</Label><select value={status} onChange={(e) => setStatus(e.target.value as any)} className={sel}>{Object.entries(STATUS_LABEL).filter(([k]) => k !== "test").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><Label>Funcionários extras</Label><Input inputMode="numeric" value={extraUsers} onChange={(e) => onExtrasChange(e.target.value)} className={inp} placeholder="0" /><p className="mt-1 text-[11px] text-slate-400">Soma ao limite incluso do plano. Só os promotores ativos entram na cota; supervisores e o administrador não contam.</p></div>
        <div><Label>Valor mensal negociado (R$)</Label><Input inputMode="decimal" value={monthlyAmount} onChange={(e) => { const v = e.target.value.replace(",", "."); setMonthlyAmount(v); setPayAmount(v); }} className={inp} placeholder="Ex.: 199.90" /></div>
        <div><Label>Bloquear após atraso (dias)</Label><Input inputMode="numeric" value={grace} onChange={(e) => setGrace(e.target.value.replace(/\D/g, ""))} className={inp} /><p className="mt-1 text-[11px] text-slate-400">Padrão 5. Nesse período o admin vê aviso vermelho; depois só a tela de Pix.</p></div>
      </div>
      <div className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-200">
        <p>Uso atual: <span className="font-medium">{staffUsageLabel(Number((c as any).staffCurrent ?? 0), liveLimit, extrasN)}</span></p>
        {liveSuggested && <p className="mt-1 text-xs text-slate-400">Valor mensal sugerido: {money(liveSuggested)} (preço do plano + extras × adicional). Você pode ajustar o valor negociado.</p>}
      </div>
      <div className="rounded-lg bg-white/5 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>Vencimento atual: <span className="font-medium">{endsAt ? day(`${endsAt}T12:00:00-03:00`) : "Sem vencimento"}</span></p>
          <Button type="button" size="sm" variant="outline" className="border-white/25 text-white" onClick={() => setEditingDue((v) => !v)}>{editingDue ? "Ocultar data" : "Alterar data"}</Button>
        </div>
        {editingDue && <div className="mt-2 max-w-xs"><Label>Nova data de vencimento</Label><Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inp} /></div>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={!planId || saving || setPlan.isPending || setBilling.isPending} onClick={() => void saveAll()} className="bg-teal-300 text-slate-950 hover:bg-teal-200">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar</Button>
        <Button type="button" onClick={onGeneratePix} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><QrCode className="mr-2 h-4 w-4" />Gerar Pix</Button>
      </div>
      <p className="text-xs text-slate-400">Depois do vencimento + tolerância, a empresa só vê a tela de Pix/WhatsApp até você registrar o pagamento.</p>

      <div className="space-y-3 border-t border-white/10 pt-4">
        <p className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-teal-300" />Registrar pagamento</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><Label>Valor pago (R$)</Label><Input inputMode="decimal" value={payAmount} onChange={(e) => setPayAmount(e.target.value.replace(",", "."))} className={inp} /></div>
          <div><Label>Pago em</Label><Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={inp} /></div>
          <div><Label>Forma</Label><select value={payType} onChange={(e) => setPayType(e.target.value as any)} className={sel}><option value="PIX">Pix</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartão</option><option value="UNDEFINED">Outra</option></select></div>
        </div>
        <p className="text-xs text-slate-400">A validade será estendida automaticamente de {day(`${paidPeriod.periodFrom}T12:00:00-03:00`)} até {day(`${paidPeriod.periodTo}T12:00:00-03:00`)} (hoje ou o vencimento atual, o que for maior, mais 1 mês).</p>
        <Button disabled={pay.isPending || !c.planId || !/^\d+(\.\d{1,2})?$/.test(payAmount)} onClick={registerPay} className="h-auto min-h-10 bg-emerald-500 text-white hover:bg-emerald-400"><CheckCircle2 className="mr-2 h-4 w-4 shrink-0" />Registrar pagamento</Button>
        {!c.planId && <p className="text-xs text-amber-200">Salve o plano da empresa acima antes de registrar o pagamento.</p>}
        <div className="space-y-1 border-t border-white/10 pt-3 text-sm">{(payments.data || []).map((p: any) => <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2"><span>{money(p.amount)} · {p.status === "PENDING" ? `pendente · vence em ${day(p.dueDate)}` : `pago em ${day(p.paymentDate)}`} · {p.status === "PENDING" ? "Pendente" : p.status}</span><Button size="sm" variant="ghost" className="text-rose-200" onClick={() => { void confirmAction({ title: "Excluir este registro de pagamento?", confirmLabel: "Confirmar" }).then((okConfirm) => okConfirm && delPay.mutate({ companyId: c.id, paymentId: p.id })); }}><Trash2 className="h-4 w-4" /></Button></div>)}{!payments.data?.length && <p className="text-slate-400">Nenhum pagamento registrado.</p>}</div>
      </div>
    </CardContent></Card>

    <CompanyFeaturesCard companyId={c.id} />

    <Card className="border-rose-300/20 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Ban className="h-4 w-4 text-rose-300" />Bloqueio e exclusão</CardTitle></CardHeader><CardContent className="space-y-3">
      {c.archivedAt ? <div className="space-y-3">
        <p className="text-sm text-slate-300">Empresa excluída em {day(c.archivedAt)} (bloqueada, dados preservados).</p>
        <Button variant="outline" onClick={() => archive.mutate({ companyId: c.id, archived: false })} className="border-white/25 text-white"><RotateCcw className="mr-2 h-4 w-4" />Restaurar empresa</Button>
        <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3"><p className="text-sm font-semibold text-rose-100">Exclusão definitiva (irreversível)</p><p className="text-xs text-rose-100/80">Apaga todos os dados, usuários, fotos e registros desta empresa. Digite o nome exato para confirmar.</p><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={c.name} className={inp} /><Button disabled={purge.isPending || confirm.trim() !== c.name.trim()} onClick={() => purge.mutate({ companyId: c.id, confirmName: confirm })} className="mt-2 bg-rose-600 text-white hover:bg-rose-500"><Trash2 className="mr-2 h-4 w-4" />Excluir definitivamente</Button></div>
      </div> : <>
        <div><Label>Motivo do bloqueio (mostrado à empresa)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: pagamento em atraso" className={inp} /></div>
        <div className="flex flex-wrap gap-2">
          {c.active ? <Button onClick={() => { void confirmAction({ title: `Bloquear ${c.name}? Todos os usuários serão desconectados.`, confirmLabel: "Confirmar" }).then((ok) => ok && block.mutate({ companyId: c.id, blocked: true, reason })); }} className="bg-amber-400 text-slate-950 hover:bg-amber-300"><Ban className="mr-2 h-4 w-4" />Bloquear (falta de pagamento)</Button>
            : <Button onClick={() => block.mutate({ companyId: c.id, blocked: false })} className="bg-emerald-500 text-white hover:bg-emerald-400"><CheckCircle2 className="mr-2 h-4 w-4" />Desbloquear</Button>}
          <Button variant="outline" onClick={() => { void confirmAction({ title: `Excluir ${c.name}? Ela será bloqueada e arquivada; os dados só são apagados se você excluir definitivamente depois.`, confirmLabel: "Confirmar" }).then((ok) => ok && archive.mutate({ companyId: c.id, archived: true })); }} className="border-rose-300/40 text-rose-200"><Trash2 className="mr-2 h-4 w-4" />Excluir empresa</Button>
        </div>
      </>}
    </CardContent></Card>
  </div>;
}

function CompanyFeaturesCard({ companyId }: { companyId: number }) {
  const features = trpc.platform.companyFeatures.get.useQuery({ companyId });
  const setFeatures = trpc.platform.companyFeatures.set.useMutation({
    onSuccess: () => { toast.success("Módulos atualizados."); void features.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [selected, setSelected] = useState<EntitlementKey[]>([]);
  useEffect(() => {
    if (features.data?.companyFeatures) {
      setSelected(ENTITLEMENT_CATALOG.filter((f) => features.data.companyFeatures[f.key]).map((f) => f.key));
    }
  }, [features.data]);
  const toggle = (key: EntitlementKey) => setSelected((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  const save = () => setFeatures.mutate({
    companyId,
    overrides: ENTITLEMENT_CATALOG.map((f) => ({ featureKey: f.key, mode: selected.includes(f.key) ? "allow" as const : "deny" as const })),
    reason: "Ajuste pelo administrador da plataforma",
  });
  return (
    <Card className="border-white/10 bg-slate-900/70 text-white">
      <CardHeader><CardTitle className="text-base">Módulos liberados</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {features.isLoading && <p className="text-slate-400">Carregando...</p>}
        <div className="grid gap-1">{ENTITLEMENT_CATALOG.map((f) => <label key={f.key} className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(f.key)} onChange={() => toggle(f.key)} />{f.label}</label>)}</div>
        <Button disabled={setFeatures.isPending} onClick={save} className="bg-teal-300 text-slate-950 hover:bg-teal-200">Salvar módulos</Button>
      </CardContent>
    </Card>
  );
}
