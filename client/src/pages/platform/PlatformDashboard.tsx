import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Building2, CheckCircle2, ChevronRight, ClipboardCheck, LayoutDashboard, LocateFixed, LogOut, Menu, RefreshCw, UsersRound, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import TimeTrackingDemo from "./TimeTrackingDemo";

type Section = "overview" | "companies" | "time";
const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "time", label: "Ponto eletrônico", icon: ClipboardCheck },
];

export default function PlatformDashboard() {
  const [section, setSection] = useState<Section>("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<"checking" | "granted" | "denied" | "unavailable">("checking");
  const companies = trpc.platform.companies.list.useQuery();
  const total = companies.data?.length ?? 0;
  const active = companies.data?.filter((company) => company.active).length ?? 0;
  const selectSection = (value: Section) => { setSection(value); setMenuOpen(false); };
  const title = section === "time" ? "Ponto eletrônico" : section === "companies" ? "Empresas" : "Visão geral";

  useEffect(() => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus("granted"),
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  const requestGps = () => {
    if (!navigator.geolocation) { setGpsStatus("unavailable"); return; }
    setGpsStatus("checking");
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus("granted"),
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return <main className="min-h-screen bg-[#07111f] text-white">
    <div className="mx-auto flex min-h-screen max-w-[1480px]">
      <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-[#091525] p-5 shadow-2xl transition-transform lg:static lg:translate-x-0 lg:shadow-none`}>
        <div className="flex items-center justify-between"><BrandLogo height={40} /><button className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
        <div className="mt-9 rounded-2xl border border-teal-300/20 bg-gradient-to-br from-teal-300/15 to-transparent p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300 font-black text-slate-950">A</div><div><p className="text-sm font-bold">Administrador geral</p><p className="text-xs text-slate-300">Plataforma central</p></div></div><div className="mt-4 flex items-center gap-2 text-xs text-teal-200"><span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_12px_#5eead4]" /> Sistema operacional</div></div>
        <nav className="mt-8 space-y-1.5">{sections.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => selectSection(id)} className={`flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-sm font-semibold transition ${section === id ? "bg-teal-300 text-slate-950 shadow-lg shadow-teal-950/30" : "text-slate-300 hover:bg-white/[.06] hover:text-white"}`}><span className="flex items-center gap-3"><Icon className="h-[18px] w-[18px]" />{label}</span>{section === id && <ChevronRight className="h-4 w-4" />}</button>)}</nav>
        <div className="mt-auto border-t border-white/10 pt-4"><Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => window.location.href = "/"}><LogOut className="mr-2 h-4 w-4" /> Sair</Button></div>
      </aside>
      {menuOpen && <button className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm lg:hidden" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <section className="min-w-0 flex-1 px-4 pb-20 pt-4 sm:px-7 sm:pt-6 lg:px-10 lg:pt-8">
        <header className="mb-7 flex items-center justify-between gap-3 border-b border-white/10 pb-5"><div className="flex min-w-0 items-center gap-3"><button className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/10 lg:hidden" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><div className="min-w-0"><p className="hidden text-xs font-semibold uppercase tracking-[.18em] text-teal-300 sm:block">Promotores SaaS · Administração</p><h1 className="truncate text-2xl font-black tracking-tight sm:mt-1 sm:text-3xl">{title}</h1><p className="mt-1 hidden text-sm text-slate-300 sm:block">Acompanhe a operação da sua plataforma em um só lugar.</p></div></div><Button variant="outline" className="shrink-0 gap-2 border-white/15 bg-white/[.04] text-sm text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => companies.refetch()}><RefreshCw className={`h-4 w-4 ${companies.isFetching ? "animate-spin" : ""}`} /><span className="hidden sm:inline">Atualizar</span></Button></header>
        {section === "time" ? <TimeTrackingDemo /> : section === "companies" ? <CompaniesView data={companies.data} loading={companies.isLoading} /> : <Overview total={total} active={active} onNavigate={selectSection} gpsStatus={gpsStatus} requestGps={requestGps} />}
      </section>
    </div>
  </main>;
}

function Overview({ total, active, onNavigate, gpsStatus, requestGps }: { total: number; active: number; onNavigate: (section: Section) => void; gpsStatus: "checking" | "granted" | "denied" | "unavailable"; requestGps: () => void }) {
  const stats = [{ label: "Empresas cadastradas", value: total, detail: "Ambientes na plataforma", icon: Building2, color: "text-sky-300", bg: "bg-sky-300/10" }, { label: "Empresas ativas", value: active, detail: "Operação em andamento", icon: Activity, color: "text-teal-300", bg: "bg-teal-300/10" }, { label: "Módulos ativos", value: "04", detail: "Recursos disponíveis", icon: CheckCircle2, color: "text-violet-300", bg: "bg-violet-300/10" }];
  return <div className="space-y-6"><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 p-5 sm:p-7"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><Badge className="border border-teal-300/25 bg-teal-300/10 text-teal-200">Visão central</Badge><h2 className="mt-3 max-w-xl text-2xl font-black leading-tight sm:text-4xl">Sua operação começa aqui.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">Gerencie empresas, equipes e acompanhe a execução das atividades de campo.</p></div><div className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-teal-300" /> Dados atualizados agora</div></div></div><GpsPermission status={gpsStatus} onRequest={requestGps} onOpenTime={() => onNavigate("time")} /><div className="grid gap-3 sm:grid-cols-3">{stats.map(({ label, value, detail, icon: Icon, color, bg }) => <Card key={label} className="border-white/10 bg-slate-900/80 shadow-xl shadow-slate-950/20"><CardContent className="flex items-center gap-4 p-4 sm:block sm:p-5"><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${bg} ${color}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 sm:mt-4"><p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-300">{label}</p><div className="mt-1 flex items-baseline gap-2"><p className={`text-3xl font-black tracking-tight ${color}`}>{value}</p><p className="hidden text-xs text-slate-300 sm:block">{detail}</p></div></div></CardContent></Card>)}</div><div><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-300">Acesso rápido</p><h2 className="mt-1 text-xl font-bold">Comece por um módulo</h2></div></div><div className="grid gap-3 sm:grid-cols-2"><QuickAction icon={Building2} title="Empresas" text="Consulte os ambientes cadastrados." onClick={() => onNavigate("companies")} /><QuickAction icon={ClipboardCheck} title="Testar ponto eletrônico" text="Simule uma jornada completa." highlight onClick={() => onNavigate("time")} /></div></div></div>;
}

function GpsPermission({ status, onRequest, onOpenTime }: { status: "checking" | "granted" | "denied" | "unavailable"; onRequest: () => void; onOpenTime: () => void }) {
  if (status === "granted") return <div className="flex items-center gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm text-teal-100"><LocateFixed className="h-5 w-5 text-teal-300" /><span><strong>GPS autorizado.</strong> A localização está pronta para o ponto eletrônico.</span></div>;
  const unavailable = status === "unavailable";
  return <div className="flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><LocateFixed className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="font-bold text-amber-100">{status === "checking" ? "Solicitando acesso ao GPS..." : unavailable ? "GPS não disponível neste navegador" : "Permita o GPS para registrar o ponto"}</p><p className="mt-1 text-sm text-amber-100/80">{unavailable ? "Use um navegador com suporte à localização." : "O aplicativo precisa da localização do celular para validar cada marcação."}</p></div></div>{!unavailable && <div className="flex shrink-0 gap-2"><Button onClick={onRequest} disabled={status === "checking"} className="bg-amber-300 text-slate-950 hover:bg-amber-200">{status === "checking" ? "Aguardando..." : "Permitir GPS"}</Button><Button variant="outline" onClick={onOpenTime} className="border-amber-200/30 bg-transparent text-amber-100 hover:bg-amber-200/10">Abrir ponto</Button></div>}</div>;
}

function QuickAction({ icon: Icon, title, text, highlight, onClick }: { icon: typeof Building2; title: string; text: string; highlight?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${highlight ? "border-teal-300/25 bg-teal-300/10 hover:bg-teal-300/15" : "border-white/10 bg-slate-900/70 hover:border-white/20 hover:bg-white/[.06]"}`}><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${highlight ? "bg-teal-300 text-slate-950" : "bg-white/10 text-slate-300"}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-slate-300">{text}</p></div><ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-300" /></button>; }

function CompaniesView({ data, loading }: { data: { id: number; name: string; active: boolean }[] | undefined; loading: boolean }) { return <div className="space-y-5"><div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7"><p className="text-sm text-slate-300">Diretório da plataforma</p><h2 className="mt-1 text-2xl font-black">Empresas cadastradas</h2><p className="mt-2 text-sm text-slate-300">Ambientes disponíveis para a operação de campo.</p></div><Card className="border-white/10 bg-slate-900/80"><CardHeader className="border-b border-white/10 pb-4"><CardTitle className="text-base text-white">Todos os ambientes</CardTitle></CardHeader><CardContent className="space-y-2 p-3 sm:p-5">{loading && <p className="p-4 text-sm text-slate-300">Carregando empresas...</p>}{!loading && !data?.length && <p className="p-4 text-sm text-slate-300">Nenhuma empresa cadastrada.</p>}{data?.map((company) => <div key={company.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-4"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-300/10 text-sky-300"><Building2 className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate font-bold">{company.name}</p><p className="text-xs text-slate-300">Ambiente #{company.id}</p></div></div><Badge variant="outline" className={company.active ? "border-teal-700/60 bg-teal-300/5 text-teal-300" : "border-slate-700 text-slate-300"}>{company.active ? "Ativa" : "Inativa"}</Badge></div>)}</CardContent></Card></div>; }
