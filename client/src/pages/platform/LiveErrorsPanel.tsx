import { useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ExternalLink, HardDrive, MemoryStick, RefreshCw, Server, ShieldAlert, Wrench } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { confirmAction } from "@/components/ConfirmDialog";
import { toast } from "sonner";

type LiveErrorCard = {
  id: string;
  title: string;
  place: string;
  severity: "grave" | "atencao" | "leve";
  growing: boolean;
  action: "needs_fix" | "expected";
  actionReason: string;
  count24h: number;
  count7d: number;
  userCount: number;
  firstSeenLabel: string;
  lastSeenLabel: string;
  sentryUrl: string | null;
  originalTitle: string;
  technical: string;
  githubIssueUrl: string | null;
  githubIssueNumber: number | null;
  markedNormal: boolean;
  grouped: boolean;
};

const SEVERITY_LABEL = { grave: "Grave", atencao: "Atenção", leve: "Leve" } as const;
const SEVERITY_CLASS = {
  grave: "border-rose-400/30 bg-rose-500/15 text-rose-100",
  atencao: "border-amber-300/30 bg-amber-400/15 text-amber-100",
  leve: "border-white/15 bg-white/5 text-slate-200",
};

function timesLabel(count: number): string {
  return count === 1 ? "1 vez" : `${count.toLocaleString("pt-BR")} vezes`;
}

function usersLabel(count: number): string {
  if (count <= 0) return "usuários não identificados";
  return count === 1 ? "1 usuário" : `${count.toLocaleString("pt-BR")} usuários`;
}

export default function LiveErrorsPanel() {
  const overview = trpc.platform.liveErrors.overview.useQuery(undefined, { staleTime: 30_000 });
  const requestFix = trpc.platform.liveErrors.requestFix.useMutation();
  const markNormal = trpc.platform.liveErrors.markNormal.useMutation();
  const unmarkNormal = trpc.platform.liveErrors.unmarkNormal.useMutation();
  const [openNormal, setOpenNormal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const data = overview.data;
  const refresh = () => void overview.refetch();

  const onRequestFix = async (card: LiveErrorCard) => {
    if (!data?.github.configured) return;
    setBusyId(card.id);
    try {
      const result = await requestFix.mutateAsync({ sentryIssueId: card.id });
      await overview.refetch();
      if (result.alreadyOpen) toast.message("Correção já pedida para este erro.");
      else toast.success("Pedido de correção aberto no GitHub.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível pedir a correção agora.");
    } finally {
      setBusyId(null);
    }
  };

  const onMarkNormal = async (card: LiveErrorCard) => {
    const ok = await confirmAction({
      title: "Marcar como normal?",
      description: "Este erro vai para a seção Normal / esperado. Se o Sentry permitir, ele também é ignorado lá. Você pode desfazer depois.",
      confirmLabel: "Marcar como normal",
    });
    if (!ok) return;
    setBusyId(card.id);
    try {
      await markNormal.mutateAsync({ sentryIssueId: card.id });
      await overview.refetch();
      toast.success("Erro marcado como normal.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível marcar este erro.");
    } finally {
      setBusyId(null);
    }
  };

  const onUnmark = async (card: LiveErrorCard) => {
    setBusyId(card.id);
    try {
      await unmarkNormal.mutateAsync({ sentryIssueId: card.id });
      await overview.refetch();
      toast.success("Este erro voltou para Precisa corrigir.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível desfazer agora.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-teal-300/25 bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950/40 p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Badge className="border border-teal-300/30 bg-teal-300/10 text-teal-200">Erros ao vivo</Badge>
            <h2 className="mt-2 text-2xl font-black text-white">{data?.headline || (overview.isLoading ? "Carregando erros..." : "Erros ao vivo")}</h2>
            <p className="mt-1 text-sm text-slate-300">Resumo em português do que aconteceu com o GondUp nas últimas 24 horas, separado do que é só o uso do dia a dia.</p>
          </div>
          <Button onClick={refresh} disabled={overview.isFetching} className="gap-2 bg-teal-300 text-slate-950 hover:bg-teal-200">
            <RefreshCw className={`h-4 w-4 ${overview.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {overview.isError ? (
        <p className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">Não foi possível carregar o painel agora. Tente atualizar.</p>
      ) : null}

      {data?.sentry.pendingMessage ? (
        <PendingCard title="Conexão com o Sentry pendente" text="A lista de erros dos usuários precisa de um token de leitura do Sentry (SENTRY_AUTH_TOKEN). O restante do painel, como backup e versão no ar, continua funcionando." />
      ) : null}
      {data?.sentry.error ? (
        <p className="rounded-2xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">{data.sentry.error}</p>
      ) : null}

      {data ? <HealthGrid health={data.health} /> : null}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-rose-300" />
          <h3 className="text-lg font-bold text-white">Precisa corrigir</h3>
          {data ? <span className="text-sm text-slate-400">({data.needsFix.length})</span> : null}
        </div>
        {overview.isLoading ? <p className="text-sm text-slate-400">Carregando...</p> : null}
        {data && !data.sentry.configured ? (
          <p className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">Quando a conexão com o Sentry estiver pronta, os erros que realmente precisam de correção aparecem aqui.</p>
        ) : null}
        {data?.sentry.configured && data.needsFix.length === 0 ? (
          <p className="rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4 text-sm text-teal-100">Nenhum erro para corrigir neste período.</p>
        ) : null}
        {data?.needsFix.map((card) => (
          <ErrorCard
            key={card.id}
            card={card}
            githubConfigured={Boolean(data.github.configured)}
            githubPending={data.github.pendingMessage}
            busy={busyId === card.id}
            onRequestFix={() => void onRequestFix(card)}
            onMarkNormal={() => void onMarkNormal(card)}
          />
        ))}
      </section>

      <Collapsible open={openNormal} onOpenChange={setOpenNormal}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-left hover:bg-slate-900">
          <span className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <CheckCircle2 className="h-4 w-4 text-slate-400" />
            Normal / esperado
            <span className="font-normal text-slate-400">({data?.expectedTotal ?? 0})</span>
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${openNormal ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 space-y-3">
          {data?.expected.length === 0 ? (
            <p className="px-1 text-sm text-slate-400">Nenhuma situação normal registrada neste período.</p>
          ) : null}
          {data?.expected.map((card) => (
            <ErrorCard
              key={card.id}
              card={card}
              githubConfigured={Boolean(data.github.configured)}
              githubPending={data.github.pendingMessage}
              busy={busyId === card.id}
              expected
              onUnmark={card.markedNormal && !card.grouped ? () => void onUnmark(card) : undefined}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      <DeviceTests />
    </div>
  );
}

function PendingCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4">
      <p className="font-semibold text-amber-100">{title}</p>
      <p className="mt-1 text-sm text-amber-100/90">{text}</p>
    </div>
  );
}

function HealthGrid({ health }: { health: { backup: { ok: boolean; message: string }; jobs: Array<{ job: string; label: string; ok: boolean | null; summary: string; finishedAtLabel: string | null }>; version: { shortSha: string | null; deployedAtLabel: string | null; available: boolean }; memory: { usedLabel: string; totalLabel: string; usedPercent: number; source: string }; disk: { available: boolean; usedLabel?: string; totalLabel?: string; freeLabel?: string; usedPercent?: number; source?: string; message?: string }; logs: { available: boolean; message: string } } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <HealthCard icon={Server} title="Backup" ok={health.backup.ok} text={health.backup.message} />
      <HealthCard
        icon={Wrench}
        title="Rotinas da madrugada"
        ok={health.jobs.every((job) => job.ok !== false)}
        text={health.jobs.map((job) => `${job.label}: ${job.ok === null ? job.summary : `${job.ok ? "ok" : "falhou"} — ${job.summary}${job.finishedAtLabel ? ` (${job.finishedAtLabel})` : ""}`}`).join(" ")}
      >
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {health.jobs.map((job) => (
            <li key={job.job}>
              <span className="font-medium text-white">{job.label}:</span>{" "}
              {job.ok === null ? job.summary : `${job.ok ? "ok" : "falhou"}. ${job.summary}${job.finishedAtLabel ? ` · ${job.finishedAtLabel}` : ""}`}
            </li>
          ))}
        </ul>
      </HealthCard>
      <HealthCard
        icon={CheckCircle2}
        title="Versão no ar"
        ok={health.version.available}
        text={health.version.available
          ? `Código ${health.version.shortSha}${health.version.deployedAtLabel ? ` · ${health.version.deployedAtLabel}` : ""}`
          : "A versão ainda não está gravada neste aplicativo. Depois do próximo deploy ela aparece aqui."}
      />
      <HealthCard
        icon={MemoryStick}
        title="Memória"
        ok={health.memory.usedPercent < 90}
        text={`${health.memory.usedLabel} de ${health.memory.totalLabel} em uso (${health.memory.usedPercent}%), ${health.memory.source}.`}
      />
      <HealthCard
        icon={HardDrive}
        title="Disco"
        ok={health.disk.available ? (health.disk.usedPercent ?? 0) < 90 : true}
        text={health.disk.available
          ? `${health.disk.usedLabel} de ${health.disk.totalLabel} em uso (${health.disk.usedPercent}%), ${health.disk.freeLabel} livres, ${health.disk.source}.`
          : health.disk.message || "Disco indisponível."}
      />
      <HealthCard icon={AlertTriangle} title="Logs do servidor" ok text={health.logs.message} />
    </div>
  );
}

function HealthCard({ icon: Icon, title, ok, text, children }: { icon: typeof Server; title: string; ok: boolean; text: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
      <div className="flex items-start gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${ok ? "bg-teal-300/15 text-teal-200" : "bg-rose-500/15 text-rose-200"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-white">{title}</p>
          {children || <p className="mt-1 text-sm text-slate-300">{text}</p>}
        </div>
      </div>
    </div>
  );
}

function ErrorCard({
  card,
  githubConfigured,
  githubPending,
  busy,
  expected,
  onRequestFix,
  onMarkNormal,
  onUnmark,
}: {
  card: LiveErrorCard;
  githubConfigured: boolean;
  githubPending: string | null;
  busy: boolean;
  expected?: boolean;
  onRequestFix?: () => void;
  onMarkNormal?: () => void;
  onUnmark?: () => void;
}) {
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${expected ? "border-white/10 bg-slate-900/50" : "border-rose-400/20 bg-slate-900/80"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={SEVERITY_CLASS[card.severity]}>{SEVERITY_LABEL[card.severity]}</Badge>
        {card.growing ? <Badge className="border-amber-300/30 bg-amber-400/10 text-amber-100">Crescendo</Badge> : null}
        <span className="text-xs text-slate-400">{card.place}</span>
      </div>
      <h4 className="mt-2 text-base font-bold text-white">{card.title}</h4>
      <p className="mt-1 text-sm text-slate-300">{card.actionReason}</p>
      <p className="mt-2 text-sm text-slate-400">
        {timesLabel(card.count24h)} nas últimas 24h · {timesLabel(card.count7d)} em 7 dias · {usersLabel(card.userCount)}
        <span className="block sm:inline sm:before:content-['·_']">primeira vez {card.firstSeenLabel} · última vez {card.lastSeenLabel}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!expected && onRequestFix ? (
          card.githubIssueUrl ? (
            <a href={card.githubIssueUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/30 bg-teal-300/10 px-3 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-300/15">
              Correção já pedida{card.githubIssueNumber ? ` #${card.githubIssueNumber}` : ""} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : githubConfigured ? (
            <Button onClick={onRequestFix} disabled={busy || card.grouped} className="bg-teal-300 text-slate-950 hover:bg-teal-200">
              {busy ? "Abrindo..." : "Pedir correção"}
            </Button>
          ) : (
            <Button disabled className="bg-slate-700 text-slate-200">{githubPending || "Conexão com o GitHub pendente"}</Button>
          )
        ) : null}
        {!expected && onMarkNormal && !card.grouped ? (
          <Button variant="outline" onClick={onMarkNormal} disabled={busy} className="border-white/15 bg-transparent text-slate-100 hover:bg-white/5">
            Marcar como normal
          </Button>
        ) : null}
        {expected && onUnmark ? (
          <Button variant="outline" onClick={onUnmark} disabled={busy} className="border-white/15 bg-transparent text-slate-100 hover:bg-white/5">
            Desfazer
          </Button>
        ) : null}
      </div>
      <details className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-200">Ver detalhes técnicos</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs text-slate-400">{card.technical}</pre>
        {card.sentryUrl ? (
          <a href={card.sentryUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-teal-200 hover:underline">
            Abrir no Sentry <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </details>
    </article>
  );
}

function DeviceTests() {
  type Signal = { id: number; name: string; status: "ok" | "warning" | "pending"; latency: string; details: string };
  const initial: Signal[] = [
    { id: 1, name: "Servidor (healthz)", status: "pending", latency: "—", details: "Ainda não verificado neste aparelho." },
    { id: 2, name: "API e banco de dados", status: "pending", latency: "—", details: "Ainda não verificado." },
    { id: 3, name: "Permissão de GPS neste navegador", status: "pending", latency: "—", details: "Ainda não verificado." },
    { id: 4, name: "Armazenamento local do navegador", status: "pending", latency: "—", details: "Ainda não verificado." },
  ];
  const [signals, setSignals] = useState<Signal[]>(initial);
  const [scanning, setScanning] = useState(false);

  const timed = async (url: string) => {
    const start = performance.now();
    const response = await fetch(url, { credentials: "include", cache: "no-store" });
    return { response, ms: `${Math.round(performance.now() - start)} ms` };
  };

  const runScan = async () => {
    setScanning(true);
    const next = initial.map((item) => ({ ...item }));
    try {
      const { response, ms } = await timed("/healthz");
      next[0] = { ...next[0], status: response.ok ? "ok" : "warning", latency: ms, details: response.ok ? "Servidor respondeu normalmente." : `Servidor respondeu com erro ${response.status}.` };
    } catch {
      next[0] = { ...next[0], status: "warning", details: "Sem resposta do servidor (verifique a conexão)." };
    }
    try {
      const { response, ms } = await timed("/api/trpc/auth.me");
      next[1] = { ...next[1], status: response.ok ? "ok" : "warning", latency: ms, details: response.ok ? "API respondeu e consultou a sessão no banco." : `API respondeu com erro ${response.status}.` };
    } catch {
      next[1] = { ...next[1], status: "warning", details: "Sem resposta da API." };
    }
    try {
      const perm = await navigator.permissions?.query({ name: "geolocation" as PermissionName });
      const state = perm?.state;
      next[2] = { ...next[2], status: state === "denied" ? "warning" : "ok", details: state === "granted" ? "GPS liberado neste navegador." : state === "denied" ? "GPS bloqueado neste navegador." : "O navegador vai pedir permissão ao usar o GPS." };
    } catch {
      next[2] = { ...next[2], status: "warning", details: "Este navegador não informa o estado da permissão de GPS." };
    }
    try {
      localStorage.setItem("__scan", "1");
      localStorage.removeItem("__scan");
      next[3] = { ...next[3], status: "ok", details: "Leitura e gravação funcionando." };
    } catch {
      next[3] = { ...next[3], status: "warning", details: "Armazenamento local bloqueado (modo privado?)." };
    }
    setSignals(next);
    setScanning(false);
    const problems = next.filter((item) => item.status === "warning").length;
    if (problems) toast.warning(`Teste deste aparelho: ${problems} ponto(s) de atenção.`);
    else toast.success("Teste deste aparelho concluído sem problemas.");
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-bold text-white">Teste deste aparelho</h3>
          <p className="mt-1 text-sm text-slate-400">Confere só neste navegador se o servidor, a API, o GPS e o armazenamento respondem.</p>
        </div>
        <Button onClick={() => void runScan()} disabled={scanning} variant="outline" className="border-white/15 bg-transparent text-slate-100 hover:bg-white/5">
          {scanning ? "Verificando..." : "Executar teste"}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {signals.map((signal) => (
          <div key={signal.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-white">{signal.name}</p>
              <span className={`text-xs ${signal.status === "ok" ? "text-teal-200" : signal.status === "warning" ? "text-amber-200" : "text-slate-400"}`}>
                {signal.status === "ok" ? "ok" : signal.status === "warning" ? "atenção" : "pendente"}{signal.latency !== "—" ? ` · ${signal.latency}` : ""}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{signal.details}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
