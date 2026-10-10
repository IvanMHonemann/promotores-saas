import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Loader2,
  Pencil,
  Plus,
  Save,
  Shield,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const FEATURES = [
  { key: "featureDashboard", label: "Painel e indicadores" },
  { key: "featureClients", label: "Cadastro de clientes" },
  { key: "featureExtinguishers", label: "Cadastro de extintores" },
  { key: "featureServiceOrders", label: "Ordens de serviço" },
  { key: "featureAlerts", label: "Alertas de vencimento" },
  { key: "featureReports", label: "Relatórios e histórico" },
  { key: "featureUsers", label: "Gestão de usuários" },
  { key: "featureBackup", label: "Backup e restauração" },
  { key: "featureOfflinePwa", label: "Operação offline / PWA" },
] as const;

type FeatureKey = (typeof FEATURES)[number]["key"];

const statusLabel: Record<string, string> = {
  trial: "Teste",
  test: "Teste",
  active: "Ativa",
  pending: "Pendente",
  overdue: "Em atraso",
  suspended: "Suspensa",
  canceled: "Cancelada",
  expired: "Expirada",
};

function parsePrice(value: string) {
  const normalized = value.replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function limitValue(unlimited: boolean, raw: string) {
  if (unlimited) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function fmtLimit(n: number | null | undefined) {
  if (n == null) return "Ilimitado";
  return n.toLocaleString("pt-BR");
}

function activeFeatures(row: Record<string, unknown>) {
  return FEATURES.filter((f) => Boolean(row[f.key]));
}

const emptyPlanForm = {
  id: null as number | null,
  name: "",
  description: "",
  price: "0,00",
  billingCycle: "monthly" as "monthly" | "yearly",
  maxUsers: "",
  maxClients: "",
  maxExtinguishers: "",
  unlimitedUsers: false,
  unlimitedClients: false,
  unlimitedExtinguishers: false,
  availableForNew: true,
  active: true,
  features: Object.fromEntries(FEATURES.map((f) => [f.key, true])) as Record<FeatureKey, boolean>,
};

export default function AdminAssinaturasPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "platform_admin";
  const [tab, setTab] = useState<"companies" | "plans">("companies");
  const [planForm, setPlanForm] = useState(emptyPlanForm);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false);
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null);
  const [companyEdit, setCompanyEdit] = useState({
    planId: "",
    status: "active" as string,
    startsAt: "",
    endsAt: "",
    notes: "",
  });
  const [subForm, setSubForm] = useState({
    companyId: "",
    planId: "",
    status: "active" as "trial" | "active" | "pending" | "overdue" | "suspended" | "canceled" | "test" | "expired",
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: "",
    notes: "",
  });
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const plansQuery = trpc.platform.plans.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const subsQuery = trpc.platform.subscriptions.list.useQuery(undefined, { enabled: isPlatformAdmin });
  const statsQuery = trpc.platform.subscriptions.stats.useQuery(undefined, { enabled: isPlatformAdmin });
  const companiesQuery = trpc.platform.companies.list.useQuery(undefined, { enabled: isPlatformAdmin });

  const createPlan = trpc.platform.plans.create.useMutation({
    onSuccess: () => {
      toast.success("Plano criado");
      setPlanForm(emptyPlanForm);
      setPlanDialogOpen(false);
      utils.platform.plans.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updatePlan = trpc.platform.plans.update.useMutation({
    onSuccess: () => {
      toast.success("Plano atualizado");
      setPlanForm(emptyPlanForm);
      setPlanDialogOpen(false);
      utils.platform.plans.list.invalidate();
      utils.platform.subscriptions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const createSub = trpc.platform.subscriptions.create.useMutation({
    onSuccess: () => {
      toast.success("Assinatura criada");
      setSubForm({
        companyId: "",
        planId: "",
        status: "active",
        startsAt: new Date().toISOString().slice(0, 10),
        endsAt: "",
        notes: "",
      });
      utils.platform.subscriptions.list.invalidate();
      utils.platform.subscriptions.stats.invalidate();
      utils.platform.companies.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const updateSub = trpc.platform.subscriptions.update.useMutation({
    onSuccess: () => {
      toast.success("Empresa atualizada");
      setCompanyDialogOpen(false);
      setSelectedSubId(null);
      utils.platform.subscriptions.list.invalidate();
      utils.platform.subscriptions.stats.invalidate();
      utils.platform.companies.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const plansById = useMemo(() => {
    const map = new Map<number, any>();
    for (const p of plansQuery.data || []) map.set(p.id, p);
    return map;
  }, [plansQuery.data]);

  const subs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = subsQuery.data || [];
    if (!q) return list;
    return list.filter(
      (s: any) =>
        String(s.companyName || "").toLowerCase().includes(q) ||
        String(s.planName || "").toLowerCase().includes(q),
    );
  }, [subsQuery.data, search]);

  const companiesWithoutSub = useMemo(() => {
    const withSub = new Set((subsQuery.data || []).map((s: any) => s.companyId));
    return (companiesQuery.data || []).filter((c: any) => !withSub.has(c.id));
  }, [companiesQuery.data, subsQuery.data]);

  const selectedSub = useMemo(
    () => (subsQuery.data || []).find((s: any) => s.id === selectedSubId) || null,
    [subsQuery.data, selectedSubId],
  );

  if (!isPlatformAdmin) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <Card>
          <CardContent className="p-8 text-center text-slate-600">
            Acesso restrito ao administrador da plataforma.
          </CardContent>
        </Card>
      </main>
    );
  }

  function openCreatePlan() {
    setPlanForm(emptyPlanForm);
    setPlanDialogOpen(true);
  }

  function openEditPlan(plan: any) {
    setPlanForm({
      id: plan.id,
      name: plan.name || "",
      description: plan.description || "",
      price: Number(plan.price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      billingCycle: plan.billingCycle || "monthly",
      maxUsers: plan.maxUsers != null ? String(plan.maxUsers) : "",
      maxClients: plan.maxClients != null ? String(plan.maxClients) : "",
      maxExtinguishers: plan.maxExtinguishers != null ? String(plan.maxExtinguishers) : "",
      unlimitedUsers: plan.maxUsers == null,
      unlimitedClients: plan.maxClients == null,
      unlimitedExtinguishers: plan.maxExtinguishers == null,
      availableForNew: plan.availableForNew !== false,
      active: plan.active !== false,
      features: Object.fromEntries(FEATURES.map((f) => [f.key, Boolean(plan[f.key])])) as Record<FeatureKey, boolean>,
    });
    setPlanDialogOpen(true);
  }

  function openCompany(sub: any) {
    setSelectedSubId(sub.id);
    setCompanyEdit({
      planId: String(sub.planId),
      status: sub.status,
      startsAt: String(sub.startsAt || "").slice(0, 10),
      endsAt: sub.endsAt ? String(sub.endsAt).slice(0, 10) : "",
      notes: sub.notes || "",
    });
    setCompanyDialogOpen(true);
  }

  function onSavePlan(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: planForm.name.trim(),
      description: planForm.description.trim() || null,
      price: parsePrice(planForm.price),
      billingCycle: planForm.billingCycle,
      maxUsers: limitValue(planForm.unlimitedUsers, planForm.maxUsers),
      maxClients: limitValue(planForm.unlimitedClients, planForm.maxClients),
      maxExtinguishers: limitValue(planForm.unlimitedExtinguishers, planForm.maxExtinguishers),
      availableForNew: planForm.availableForNew,
      active: planForm.active,
      ...planForm.features,
    };
    if (planForm.id) {
      updatePlan.mutate({ id: planForm.id, ...payload });
    } else {
      createPlan.mutate(payload);
    }
  }

  function onSaveCompany(e: FormEvent) {
    e.preventDefault();
    if (!selectedSubId) return;
    updateSub.mutate({
      id: selectedSubId,
      planId: Number(companyEdit.planId),
      status: companyEdit.status as any,
      startsAt: companyEdit.startsAt || undefined,
      endsAt: companyEdit.endsAt || null,
      notes: companyEdit.notes || null,
    });
  }

  function onCreateSub(e: FormEvent) {
    e.preventDefault();
    if (!subForm.companyId || !subForm.planId) {
      toast.error("Selecione empresa e plano");
      return;
    }
    createSub.mutate({
      companyId: Number(subForm.companyId),
      planId: Number(subForm.planId),
      status: subForm.status,
      startsAt: subForm.startsAt,
      endsAt: subForm.endsAt || null,
      notes: subForm.notes || null,
    });
  }

  const previewPlan = companyEdit.planId ? plansById.get(Number(companyEdit.planId)) : null;

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Planos e empresas</h1>
              <p className="text-sm text-slate-500">
                Veja o plano de cada empresa, as funções liberadas e edite quando precisar.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant={tab === "companies" ? "default" : "outline"}
              className={tab === "companies" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => setTab("companies")}
            >
              <Building2 className="mr-1.5 h-4 w-4" /> Empresas
            </Button>
            <Button
              variant={tab === "plans" ? "default" : "outline"}
              className={tab === "plans" ? "bg-red-600 hover:bg-red-700" : ""}
              onClick={() => setTab("plans")}
            >
              <CreditCard className="mr-1.5 h-4 w-4" /> Planos
            </Button>
          </div>
        </div>

        {statsQuery.data && (
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              ["Assinaturas", statsQuery.data.registered],
              ["Ativas / teste", statsQuery.data.activeOrTest],
              ["Suspensas", statsQuery.data.suspended],
              ["Vencem em 30 dias", statsQuery.data.nearExpiry],
            ].map(([label, value]) => (
              <Card key={String(label)}>
                <CardContent className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === "companies" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="Buscar empresa ou plano..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-sm bg-white"
              />
            </div>

            {companiesWithoutSub.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-amber-900">Empresas sem assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onCreateSub} className="grid gap-3 md:grid-cols-5">
                    <div className="md:col-span-2">
                      <Label>Empresa</Label>
                      <Select value={subForm.companyId} onValueChange={(v) => setSubForm({ ...subForm, companyId: v })}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {companiesWithoutSub.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Plano</Label>
                      <Select value={subForm.planId} onValueChange={(v) => setSubForm({ ...subForm, planId: v })}>
                        <SelectTrigger><SelectValue placeholder="Plano" /></SelectTrigger>
                        <SelectContent>
                          {(plansQuery.data || []).filter((p: any) => p.active).map((p: any) => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Select value={subForm.status} onValueChange={(v: any) => setSubForm({ ...subForm, status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativa</SelectItem>
                          <SelectItem value="trial">Teste</SelectItem>
                          <SelectItem value="test">Teste (interno)</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={createSub.isPending}>
                        {createSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vincular plano"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {subsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando empresas...
              </div>
            ) : subs.length === 0 ? (
              <Card>
                <CardContent className="p-10 text-center text-slate-500">Nenhuma assinatura encontrada.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {subs.map((s: any) => {
                  const feats = activeFeatures(s);
                  return (
                    <Card key={s.id} className="overflow-hidden">
                      <CardContent className="p-4 md:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Building2 className="h-4 w-4 text-slate-400" />
                              <h3 className="text-lg font-semibold text-slate-900">{s.companyName}</h3>
                              <Badge
                                className={
                                  s.status === "active" || s.status === "test" || s.status === "trial"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : s.status === "suspended" || s.status === "overdue"
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-slate-200 text-slate-700"
                                }
                              >
                                {statusLabel[s.status] || s.status}
                              </Badge>
                            </div>
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                                <CreditCard className="h-3.5 w-3.5" /> {s.planName}
                              </span>
                              <span>
                                R$ {Number(s.planPrice).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/
                                {s.billingCycle === "yearly" ? "ano" : "mês"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" /> {fmtLimit(s.maxUsers)} usuários
                              </span>
                              <span>· Clientes: {fmtLimit(s.maxClients)}</span>
                              <span>· Extintores: {fmtLimit(s.maxExtinguishers)}</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {feats.length === 0 ? (
                                <span className="text-xs text-slate-400">Nenhuma função marcada no plano</span>
                              ) : (
                                feats.map((f) => (
                                  <Badge key={f.key} variant="outline" className="border-emerald-200 bg-emerald-50 text-[11px] text-emerald-800">
                                    {f.label}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openCompany(s)}>
                            <Pencil className="h-3.5 w-3.5" /> Gerenciar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "plans" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button className="gap-1.5 bg-red-600 hover:bg-red-700" onClick={openCreatePlan}>
                <Plus className="h-4 w-4" /> Novo plano
              </Button>
            </div>
            {plansQuery.isLoading ? (
              <div className="flex items-center gap-2 py-12 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Carregando planos...
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {(plansQuery.data || []).map((plan: any) => {
                  const feats = activeFeatures(plan);
                  return (
                    <Card key={plan.id} className={!plan.active ? "opacity-60" : ""}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-lg">{plan.name}</CardTitle>
                            <p className="text-sm text-slate-500">{plan.description || "—"}</p>
                          </div>
                          <Badge variant="secondary">
                            {plan.billingCycle === "yearly" ? "Anual" : "Mensal"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-2xl font-bold text-slate-900">
                          R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <ul className="space-y-1 text-xs text-slate-600">
                          <li>Usuários: {fmtLimit(plan.maxUsers)}</li>
                          <li>Clientes: {fmtLimit(plan.maxClients)}</li>
                          <li>Extintores: {fmtLimit(plan.maxExtinguishers)}</li>
                        </ul>
                        <div className="flex flex-wrap gap-1">
                          {feats.map((f) => (
                            <Badge key={f.key} variant="outline" className="text-[10px]">
                              {f.label}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {!plan.availableForNew && (
                            <Badge className="bg-slate-200 text-slate-700">Oculto para novos</Badge>
                          )}
                          {!plan.active && <Badge className="bg-red-100 text-red-800">Inativo</Badge>}
                        </div>
                        <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => openEditPlan(plan)}>
                          <Pencil className="h-3.5 w-3.5" /> Editar plano e funções
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog: editar/criar plano */}
      <Dialog open={planDialogOpen} onOpenChange={setPlanDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{planForm.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSavePlan} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Nome</Label>
                <Input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} required />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
                <Input value={planForm.description} onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })} />
              </div>
              <div>
                <Label>Preço (R$)</Label>
                <Input value={planForm.price} onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })} />
              </div>
              <div>
                <Label>Ciclo</Label>
                <Select
                  value={planForm.billingCycle}
                  onValueChange={(v: "monthly" | "yearly") => setPlanForm({ ...planForm, billingCycle: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">Limites</p>
              {(
                [
                  ["unlimitedUsers", "maxUsers", "Usuários"],
                  ["unlimitedClients", "maxClients", "Clientes"],
                  ["unlimitedExtinguishers", "maxExtinguishers", "Extintores"],
                ] as const
              ).map(([unlimitedKey, maxKey, label]) => (
                <div key={maxKey} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={planForm[unlimitedKey]}
                      onCheckedChange={(c) => setPlanForm({ ...planForm, [unlimitedKey]: Boolean(c) })}
                    />
                    <span className="text-xs text-slate-600">Ilimitado</span>
                  </div>
                  <Label className="w-20 text-xs">{label}</Label>
                  <Input
                    className="h-8"
                    disabled={planForm[unlimitedKey]}
                    value={planForm[maxKey]}
                    onChange={(e) => setPlanForm({ ...planForm, [maxKey]: e.target.value })}
                    placeholder="Qtd"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-slate-200 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Shield className="h-4 w-4" /> Funcionalidades do plano
              </p>
              <p className="text-[11px] text-slate-500">
                Ao salvar, todas as empresas neste plano passam a ter essas funções.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {FEATURES.map((f) => (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <Checkbox
                      checked={planForm.features[f.key]}
                      onCheckedChange={(c) =>
                        setPlanForm({
                          ...planForm,
                          features: { ...planForm.features, [f.key]: Boolean(c) },
                        })
                      }
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={planForm.availableForNew}
                  onCheckedChange={(c) => setPlanForm({ ...planForm, availableForNew: Boolean(c) })}
                />
                Disponível para novos clientes
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={planForm.active}
                  onCheckedChange={(c) => setPlanForm({ ...planForm, active: Boolean(c) })}
                />
                Plano ativo
              </label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="gap-1.5 bg-red-600 hover:bg-red-700"
                disabled={createPlan.isPending || updatePlan.isPending}
              >
                {(createPlan.isPending || updatePlan.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar plano
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: gerenciar empresa */}
      <Dialog open={companyDialogOpen} onOpenChange={setCompanyDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar empresa</DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <form onSubmit={onSaveCompany} className="space-y-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="font-semibold text-slate-900">{selectedSub.companyName}</p>
                <p className="text-xs text-slate-500">ID da assinatura #{selectedSub.id}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Plano</Label>
                  <Select
                    value={companyEdit.planId}
                    onValueChange={(v) => setCompanyEdit({ ...companyEdit, planId: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(plansQuery.data || []).filter((p: any) => p.active).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} — R$ {Number(p.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={companyEdit.status}
                    onValueChange={(v) => setCompanyEdit({ ...companyEdit, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabel).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Início</Label>
                  <Input
                    type="date"
                    value={companyEdit.startsAt}
                    onChange={(e) => setCompanyEdit({ ...companyEdit, startsAt: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Fim (opcional)</Label>
                  <Input
                    type="date"
                    value={companyEdit.endsAt}
                    onChange={(e) => setCompanyEdit({ ...companyEdit, endsAt: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Observações internas</Label>
                  <Input
                    value={companyEdit.notes}
                    onChange={(e) => setCompanyEdit({ ...companyEdit, notes: e.target.value })}
                    placeholder="Ex.: cortesia, acordo comercial..."
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">Funções deste plano</p>
                  {previewPlan && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => openEditPlan(previewPlan)}
                    >
                      Editar funções do plano
                    </Button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Limites: {fmtLimit(previewPlan?.maxUsers)} usuários · {fmtLimit(previewPlan?.maxClients)} clientes ·{" "}
                  {fmtLimit(previewPlan?.maxExtinguishers)} extintores
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {FEATURES.map((f) => {
                    const on = Boolean(previewPlan?.[f.key]);
                    return (
                      <div
                        key={f.key}
                        className={`rounded-md border px-2 py-1.5 text-xs ${
                          on ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-100 bg-slate-50 text-slate-400"
                        }`}
                      >
                        {on ? "✓" : "—"} {f.label}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCompanyDialogOpen(false)}>
                  Fechar
                </Button>
                <Button type="submit" className="gap-1.5 bg-red-600 hover:bg-red-700" disabled={updateSub.isPending}>
                  {updateSub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar empresa
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
