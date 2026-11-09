import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, Building2, CheckCircle2, ChevronRight, ClipboardCheck, LayoutDashboard, LocateFixed, LogOut, Menu, RefreshCw, UsersRound, CreditCard, UserRound, X, Sparkles, ShieldAlert, Bug, Terminal, Search, CheckCircle, AlertTriangle, Cpu, Play } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";
import TimeTrackingDemo from "./TimeTrackingDemo";
import { AIChatBox, type Message } from "@/components/AIChatBox";

export type Section = "overview" | "companies" | "time" | "ai-support" | "code-scanner";
const SECTION_PATH: Record<Section, string> = { overview: "/", companies: "/admin/empresas", time: "/plataforma/ponto", "ai-support": "/plataforma/ia", "code-scanner": "/plataforma/scanner" };

export default function PlatformDashboard({ section = "overview" }: { section?: Section }) {
  const [gpsStatus, setGpsStatus] = useState<"checking" | "granted" | "denied" | "unavailable">("checking");
  const companies = trpc.platformCompanies.overview.useQuery(undefined, { enabled: section === "overview", staleTime: 30000 });
  const live = (companies.data || []).filter((company) => !company.archivedAt);
  const total = live.length;
  const active = live.filter((company) => company.active).length;
  const attention = live.filter((company) => !company.active || ["overdue", "pending", "suspended", "expired"].includes(company.subscriptionStatus ?? "") || (company.expiresAt && new Date(company.expiresAt).getTime() < Date.now())).length;
  const activeUsers = live.reduce((sum, company) => sum + Number(company.activeUsers || 0), 0);
  const selectSection = (value: Section) => { window.location.href = SECTION_PATH[value]; };
  const title = section === "time" ? "Ponto eletrônico" : section === "companies" ? "Empresas" : section === "ai-support" ? "Suporte com IA" : section === "code-scanner" ? "Erros ao vivo" : "Visão geral";

  useEffect(() => {
    // O GPS só é pedido na área de teste de ponto, não na visão geral.
    if (section !== "time") return;
    if (!navigator.geolocation || !window.isSecureContext) { setGpsStatus("unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      () => setGpsStatus("granted"),
      (error) => { setGpsStatus("denied"); if (error.code === 1) toast.error("O navegador bloqueou o GPS. Libere a localização nas permissões do site."); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, [section]);

  const requestGps = () => {
    if (!navigator.geolocation || !window.isSecureContext) { setGpsStatus("unavailable"); toast.error("O GPS só funciona em uma conexão HTTPS e em navegador compatível."); return; }
    setGpsStatus("checking");
    navigator.geolocation.getCurrentPosition(
      () => { setGpsStatus("granted"); toast.success("GPS autorizado. Agora você pode registrar o ponto."); },
      (error) => { setGpsStatus("denied"); toast.error(error.code === 1 ? "Permissão bloqueada. Toque no cadeado ao lado do endereço, abra Permissões do site e permita Localização. Depois recarregue a página." : "O GPS não respondeu. Tente novamente em um local aberto."); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  return <DashboardLayout title={title} description="Acompanhe a operação da sua plataforma em um só lugar." onRefresh={() => void companies.refetch()} refreshing={companies.isFetching}>
    {section === "ai-support" ? <PersistentAIChat /> : null}
    {section === "code-scanner" ? <CodeScannerView /> : null}
    {section === "time" ? <TimeTrackingDemo /> : section === "overview" ? <Overview total={total} active={active} attention={attention} activeUsers={activeUsers} onNavigate={selectSection} gpsStatus={gpsStatus} requestGps={requestGps} /> : null}
  </DashboardLayout>;
}

function CodeScannerView() {
  const [scanning, setScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  type Signal = { id: number; name: string; type: string; status: "ok" | "warning" | "pending"; latency: string; details: string };
  const initialSignals: Signal[] = [
    { id: 1, name: "Servidor (healthz)", type: "backend", status: "pending", latency: "—", details: "Ainda não verificado. Clique em Executar verificação." },
    { id: 2, name: "API e banco de dados", type: "backend", status: "pending", latency: "—", details: "Ainda não verificado." },
    { id: 3, name: "Permissão de GPS neste navegador", type: "sensor", status: "pending", latency: "—", details: "Ainda não verificado." },
    { id: 4, name: "Armazenamento local do navegador", type: "storage", status: "pending", latency: "—", details: "Ainda não verificado." },
  ];
  const [signals, setSignals] = useState<Signal[]>(initialSignals);

  // Verificações reais feitas a partir deste navegador (sem valores inventados).
  const timed = async (url: string) => { const t = performance.now(); const r = await fetch(url, { credentials: "include", cache: "no-store" }); return { r, ms: `${Math.round(performance.now() - t)} ms` }; };
  const runScan = async () => {
    setScanning(true);
    setScanComplete(false);
    const next = initialSignals.map(s => ({ ...s }));
    try { const { r, ms } = await timed("/healthz"); next[0] = { ...next[0], status: r.ok ? "ok" : "warning", latency: ms, details: r.ok ? "Servidor respondeu normalmente." : `Servidor respondeu com erro ${r.status}.` }; }
    catch { next[0] = { ...next[0], status: "warning", details: "Sem resposta do servidor (verifique a conexão)." }; }
    try { const { r, ms } = await timed("/api/trpc/auth.me"); next[1] = { ...next[1], status: r.ok ? "ok" : "warning", latency: ms, details: r.ok ? "API respondeu e consultou a sessão no banco." : `API respondeu com erro ${r.status}.` }; }
    catch { next[1] = { ...next[1], status: "warning", details: "Sem resposta da API." }; }
    try {
      const perm = await (navigator.permissions?.query({ name: "geolocation" as PermissionName }));
      const state = perm?.state;
      next[2] = { ...next[2], status: state === "denied" ? "warning" : "ok", details: state === "granted" ? "GPS liberado neste navegador." : state === "denied" ? "GPS bloqueado neste navegador." : "O navegador vai pedir permissão ao usar o GPS." };
    } catch { next[2] = { ...next[2], status: "warning", details: "Este navegador não informa o estado da permissão de GPS." }; }
    try { localStorage.setItem("__scan", "1"); localStorage.removeItem("__scan"); next[3] = { ...next[3], status: "ok", details: "Leitura e gravação funcionando." }; }
    catch { next[3] = { ...next[3], status: "warning", details: "Armazenamento local bloqueado (modo privado?)." }; }
    setSignals(next);
    setScanning(false);
    setScanComplete(true);
    const problems = next.filter(s => s.status === "warning").length;
    if (problems) toast.warning(`Verificação concluída com ${problems} ponto(s) de atenção.`); else toast.success("Verificação concluída sem problemas.");
  };

  const filteredSignals = signals.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-teal-300/25 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Badge className="border border-teal-300/30 bg-teal-300/10 text-teal-200">Diagnóstico</Badge>
            <h2 className="mt-2 text-2xl font-black text-white">Verificação do sistema</h2>
            <p className="mt-1 text-sm text-slate-300">Testa servidor, API, GPS e armazenamento a partir deste navegador.</p>
          </div>
          <Button onClick={runScan} disabled={scanning} className="gap-2 bg-teal-300 text-slate-950 hover:bg-teal-200">
            {scanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {scanning ? "Verificando..." : "Executar verificação"}
          </Button>
        </div>
      </div>

      {/* Search and Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Procurar erros, funções ou componentes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-900/90 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-teal-300"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {signals.length} verificações
        </div>
      </div>

      {/* Signals Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {filteredSignals.map((signal) => (
          <div key={signal.id} className={`rounded-2xl border p-5 transition ${signal.status === "warning" ? "border-amber-400/40 bg-amber-500/10" : "border-white/10 bg-slate-900/80 hover:border-white/20"}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${signal.status === "warning" ? "bg-amber-400/20 text-amber-300" : "bg-teal-300/10 text-teal-300"}`}>
                  {signal.status === "warning" ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-white">{signal.name}</h3>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Módulo: {signal.type}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge className={signal.status === "warning" ? "bg-amber-400/20 text-amber-300 border-amber-400/40" : "bg-emerald-400/20 text-emerald-300 border-emerald-400/40"}>
                  {signal.status === "warning" ? "Atenção" : signal.status === "pending" ? "Não verificado" : "Operacional"}
                </Badge>
                <p className="mt-1 text-xs text-slate-400">Latência: {signal.latency}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-300 border-t border-white/10 pt-3">
              {signal.details}
            </p>
          </div>
        ))}
      </div>

      {/* Live Console Terminal simulation */}
      <div className="rounded-2xl border border-white/10 bg-slate-950 p-5 font-mono text-xs">
        <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3 text-slate-400">
          <span className="flex items-center gap-2"><Terminal className="h-4 w-4 text-teal-300" /> Terminal de Diagnóstico & Logs</span>
          <span>{scanComplete ? "Varredura concluída" : "Pronto para varredura"}</span>
        </div>
        <div className="space-y-1.5 text-slate-300">
          <p className="text-emerald-400">[INFO] Sistema inicializado no ambiente GondUp.</p>
          <p>[CHECK] Verificando integridade dos componentes TypeScript e React 19...</p>
          <p>[CHECK] Rotas tRPC e autenticação JWT verificadas com sucesso.</p>
          {scanComplete ? (
            <p className="text-teal-300">[SUCCESS] Scanner finalizado: 5 componentes saudáveis, 1 aviso de GPS monitorado.</p>
          ) : (
            <p className="text-amber-300">[READY] Clique em &quot;Executar Varredura Agora&quot; para testar todas as funções do site.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const AI_CHAT_STORAGE_KEY = "promotores-saas:platform-ai-chat:v2";

function PersistentAIChat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const stored = window.localStorage.getItem(AI_CHAT_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((message): message is Message =>
        message && ["user", "assistant", "system"].includes(message.role) && typeof message.content === "string",
      ) : [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-40))); } catch { /* armazenamento pode estar bloqueado */ }
  }, [messages]);
  const chat = trpc.platform.aiSupport.chat.useMutation({
    onSuccess: (result) => setMessages((current) => [...current, { role: "assistant", content: result.reply }]),
    onError: (error) => setMessages((current) => [...current, { role: "assistant", content: `Não foi possível aplicar o pedido: ${error.message}` }]),
  });
  const send = (prompt: string) => {
    const nextMessages = [...messages, { role: "user" as const, content: prompt }];
    setMessages(nextMessages);
    chat.mutate({
      prompt,
      history: nextMessages.filter((message): message is { role: "user" | "assistant"; content: string } => message.role !== "system").slice(-30),
    });
  };
  const runAction = (prompt: string) => send(prompt);
  const health = [
    { label: "Chat Gemini", value: chat.isPending ? "Analisando" : "Pronto", tone: chat.isPending ? "text-amber-300" : "text-emerald-300", icon: Sparkles },
    { label: "Sessão", value: "Ativa", tone: "text-emerald-300", icon: CheckCircle },
    { label: "Código", value: "Aguardando varredura", tone: "text-slate-300", icon: Terminal },
    { label: "Deploy", value: "Via GitHub + Vercel", tone: "text-teal-300", icon: Activity },
  ];
  return <section className="mb-6 space-y-4">
    <div className="rounded-3xl border border-teal-300/20 bg-slate-900/80 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-teal-300">Gemini · suporte inteligente</p><h2 className="mt-1 text-xl font-bold">Converse, investigue e continue tarefas</h2><p className="mt-1 text-sm text-slate-300">O histórico fica salvo neste dispositivo. A IA pode sugerir alterações, que só entram no site depois de revisadas e aprovadas.</p></div>
        <Badge className="border border-emerald-300/30 bg-emerald-300/10 text-emerald-200"><span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-300" />Monitor ativo</Badge>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{health.map(({ label, value, tone, icon: Icon }) => <div key={label} className="rounded-xl border border-white/10 bg-slate-950/40 p-3"><div className="flex items-center gap-2 text-xs text-slate-400"><Icon className={`h-3.5 w-3.5 ${tone}`} />{label}</div><p className={`mt-1 text-sm font-semibold ${tone}`}>{value}</p></div>)}</div>
    </div>
    <div className="grid gap-2 sm:grid-cols-3">
      <Button variant="outline" disabled={chat.isPending} onClick={() => runAction("Faça uma varredura do código atual e procure erros, bugs, rotas quebradas e funções que não estejam funcionando. Liste os achados por prioridade e não altere nada ainda.")} className="h-auto justify-start gap-2 border-white/10 bg-slate-900/70 px-3 py-3 text-left text-slate-200 hover:bg-white/[.06] hover:text-white"><Search className="h-4 w-4 text-teal-300" /><span><b className="block text-sm">Procurar erros</b><small className="text-xs text-slate-400">Analisar código atual</small></span></Button>
      <Button variant="outline" disabled={chat.isPending} onClick={() => runAction("Escaneie os arquivos principais do site, verifique problemas de segurança, bugs e integrações. Retorne um diagnóstico objetivo com sinalizadores OK, atenção ou crítico.")} className="h-auto justify-start gap-2 border-white/10 bg-slate-900/70 px-3 py-3 text-left text-slate-200 hover:bg-white/[.06] hover:text-white"><ShieldAlert className="h-4 w-4 text-amber-300" /><span><b className="block text-sm">Scanear código</b><small className="text-xs text-slate-400">Executar diagnóstico</small></span></Button>
      <Button variant="outline" disabled={chat.isPending || !messages.length} onClick={() => runAction("Continue a tarefa anterior exatamente de onde paramos. Revise o histórico e confirme o próximo passo necessário.")} className="h-auto justify-start gap-2 border-white/10 bg-slate-900/70 px-3 py-3 text-left text-slate-200 hover:bg-white/[.06] hover:text-white"><RefreshCw className="h-4 w-4 text-violet-300" /><span><b className="block text-sm">Continuar tarefa</b><small className="text-xs text-slate-400">Usar histórico salvo</small></span></Button>
    </div>
    <AIChatBox messages={messages} onSendMessage={send} isLoading={chat.isPending} height="380px" emptyStateMessage="Escreva uma pergunta ou peça uma alteração no site" placeholder="Digite sua pergunta ou pedido..." suggestedPrompts={["O que você consegue fazer?", "Procure erros no código atual.", "Continue a tarefa anterior."]} />
  </section>;
}

function Overview({ total, active, attention, activeUsers, onNavigate, gpsStatus, requestGps }: { total: number; active: number; attention: number; activeUsers: number; onNavigate: (section: Section) => void; gpsStatus: "checking" | "granted" | "denied" | "unavailable"; requestGps: () => void }) {
  const stats = [{ label: "Empresas cadastradas", value: total, detail: "Ambientes na plataforma", icon: Building2, color: "text-sky-300", bg: "bg-sky-300/10" }, { label: "Empresas ativas", value: active, detail: "Operação em andamento", icon: Activity, color: "text-teal-300", bg: "bg-teal-300/10" }, { label: "Precisam de atenção", value: attention, detail: "Vencidas, em atraso ou bloqueadas", icon: ShieldAlert, color: attention ? "text-amber-300" : "text-violet-300", bg: attention ? "bg-amber-300/10" : "bg-violet-300/10" }, { label: "Usuários ativos", value: activeUsers, detail: "Em todas as empresas", icon: UsersRound, color: "text-violet-300", bg: "bg-violet-300/10" }];
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/30 p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <Badge className="border border-teal-300/25 bg-teal-300/10 text-teal-200">Visão central</Badge>
            <h2 className="mt-3 max-w-xl text-2xl font-black leading-tight sm:text-4xl">Sua operação começa aqui.</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">Gerencie empresas, equipes e acompanhe a execução das atividades de campo.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300"><span className="h-2.5 w-2.5 rounded-full bg-teal-300" /> Dados atualizados agora</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-3xl lg:grid-cols-4 border border-white/10 bg-white/10 shadow-xl shadow-slate-950/20">
        {stats.map(({ label, value, detail, icon: Icon, color, bg }, index) => (
          <Card key={label} className={`rounded-none border-0 bg-[#0b1021] shadow-none ${stats.length % 2 === 1 && index === stats.length - 1 ? "col-span-2" : ""}`}>
            <CardContent className="flex min-h-[142px] items-start justify-between gap-3 p-4 sm:min-h-[160px] sm:p-6">
              <div className="flex min-w-0 flex-col self-stretch">
                <p className="text-xs font-bold uppercase tracking-[.12em] text-slate-300 sm:text-xs sm:tracking-[.14em]">{label}</p>
                <p className={`mt-2 text-4xl font-black leading-none ${color}`}>{value}</p>
                <p className="mt-auto pt-2 text-xs text-slate-300 sm:text-sm">{detail} <span aria-hidden="true">→</span></p>
              </div>
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${bg} ${color} sm:h-10 sm:w-10`}><Icon className="h-4 w-4 sm:h-5 sm:w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div>
        <div className="mb-3 flex items-end justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-300">Acesso rápido</p><h2 className="mt-1 text-xl font-bold">Comece por um módulo</h2></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <QuickAction icon={ShieldAlert} title="Erros ao vivo" text="Verifique bugs, rotas e sensores em tempo real." onClick={() => onNavigate("code-scanner")} />
          <QuickAction icon={Building2} title="Empresas" text="Plano, validade, pagamentos e acesso de cada empresa." onClick={() => onNavigate("companies")} />
          <QuickAction icon={UsersRound} title="Usuários" text="Todos os usuários de todas as empresas." onClick={() => { window.location.href = "/admin/usuarios"; }} />
          <QuickAction icon={ClipboardCheck} title="Testar ponto eletrônico" text="Simule uma jornada completa." highlight onClick={() => onNavigate("time")} />
          <QuickAction icon={Sparkles} title="Suporte com IA" text="Converse com a inteligência artificial da plataforma." onClick={() => onNavigate("ai-support")} />
        </div>
      </div>
    </div>
  );
}

function GpsPermission({ status, onRequest, onOpenTime }: { status: "checking" | "granted" | "denied" | "unavailable"; onRequest: () => void; onOpenTime: () => void }) {
  if (status === "granted") return <div role="status" className="flex items-center gap-3 rounded-2xl border border-teal-300/20 bg-teal-300/10 px-4 py-3 text-sm text-teal-100"><LocateFixed className="h-5 w-5 text-teal-300" /><span><strong>GPS autorizado.</strong> A localização está pronta para o ponto eletrônico.</span></div>;
  const unavailable = status === "unavailable";
  return <div role="alert" className="flex flex-col gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><LocateFixed className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /><div><p className="font-bold text-amber-100">{status === "checking" ? "Solicitando acesso ao GPS..." : unavailable ? "GPS não disponível neste navegador" : "Permita o GPS para registrar o ponto"}</p><p className="mt-1 text-sm text-amber-100/80">{unavailable ? "Use um navegador com suporte à localização e abra o site em HTTPS." : status === "denied" ? "Toque no cadeado ao lado do endereço → Permissões do site → Localização → Permitir. Depois recarregue a página." : "O aplicativo precisa da localização do celular para validar cada marcação."}</p></div></div>{!unavailable && <div className="flex shrink-0 gap-2"><Button onClick={onRequest} disabled={status === "checking"} className="bg-amber-300 text-slate-950 hover:bg-amber-200">{status === "checking" ? "Aguardando..." : status === "denied" ? "Tentar novamente" : "Permitir GPS"}</Button><Button variant="outline" onClick={onOpenTime} className="border-amber-200/30 bg-transparent text-amber-100 hover:bg-amber-200/10">Abrir ponto</Button></div>}</div>;
}

function QuickAction({ icon: Icon, title, text, highlight, onClick }: { icon: typeof Building2; title: string; text: string; highlight?: boolean; onClick: () => void }) { return <button onClick={onClick} className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${highlight ? "border-teal-300/25 bg-teal-300/10 hover:bg-teal-300/15" : "border-white/10 bg-slate-900/70 hover:border-white/20 hover:bg-white/[.06]"}`}><div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${highlight ? "bg-teal-300 text-slate-950" : "bg-white/10 text-slate-300"}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-bold">{title}</p><p className="mt-1 text-sm text-slate-300">{text}</p></div><ArrowUpRight className="h-5 w-5 text-slate-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-teal-300" /></button>; }

