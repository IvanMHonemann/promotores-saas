import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Circle, Download, FileSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { currentMonthSP, downloadBase64, fmtDateTimeSP } from "@/lib/downloadBase64";

function Item({ ok, title, hint }: { ok: boolean; title: string; hint: string }) {
  return (
    <li className="flex gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
      <span><b>{title}</b> <span className="text-slate-400">— {hint}</span></span>
    </li>
  );
}

/** Ponto com valor de prova: situação, integridade, arquivos fiscais (AFD/AEJ) e aceites do espelho. */
export default function PontoLegalPage() {
  const status = trpc.pontoLegal.status.useQuery();
  const verify = trpc.pontoLegal.verifyIntegrity.useMutation();
  const clock = trpc.pontoLegal.clockStatus.useQuery();
  const clockCheck = trpc.pontoLegal.clockCheck.useMutation({ onSuccess: () => void clock.refetch(), onError: (e) => toast.error(e.message) });
  const afd = trpc.pontoLegal.exportAfd.useMutation();
  const aej = trpc.pontoLegal.exportAej.useMutation();
  const firstDay = `${currentMonthSP(-1)}-01`;
  const [from, setFrom] = useState(firstDay);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(currentMonthSP(-1));
  const acc = trpc.pontoLegal.mirrorAcceptances.useQuery({ month });
  const [warnings, setWarnings] = useState<string[]>([]);
  const s = status.data;

  const exportFile = async (kind: "afd" | "aej") => {
    try {
      const r = await (kind === "afd" ? afd : aej).mutateAsync({ from, to });
      downloadBase64(r.base64, r.fileName, r.mimeType);
      setWarnings(r.warnings || []);
      toast.success(`${kind.toUpperCase()} gerado (${r.count} ${kind === "afd" ? "marcações" : "funcionários"}).`);
    } catch (e: any) { toast.error(e?.message || "Falha ao gerar o arquivo."); }
  };

  const v = verify.data;
  return (
    <DashboardLayout title="Ponto: prova legal" description="Tudo o que deixa o cartão-ponto utilizável numa fiscalização ou processo trabalhista.">
      <div className="space-y-4 text-white">
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-teal-300" />Como o sistema protege as marcações</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p>
              Cada batida recebe um <b>NSR</b> (número sequencial da empresa, sem pular) e um <b>hash SHA-256 encadeado</b> com a anterior —
              como os elos de uma corrente. Correções aprovadas <b>nunca alteram nem apagam</b> a batida original: viram um registro
              separado (quem aprovou, quando e por quê). O funcionário recebe comprovante de cada batida e confirma o espelho do mês.
            </p>
            {s && (
              <ul className="space-y-1.5">
                <Item ok title="Marcações imutáveis, NSR e cadeia de hash" hint="ativo" />
                <Item ok title="Comprovante por batida (PDF)" hint={s.emailEnabled ? "com envio por e-mail" : "e-mail desativado neste ambiente; o PDF fica disponível"} />
                <Item ok title="Aceite eletrônico do espelho" hint="IP, aparelho, data e hash do documento" />
                <Item ok={s.employerDocument} title="CNPJ/CPF do empregador" hint={s.employerDocument ? (s.employerName || "cadastrado") : "cadastre nos dados da empresa para sair no AFD/AEJ e nos comprovantes"} />
                <Item ok={Boolean(s.inpiNumber)} title="Registro do programa no INPI" hint={s.inpiNumber ? `nº ${s.inpiNumber}` : "pendente (obrigatório para REP-P — art. 91 da Portaria 671)"} />
                <Item ok={s.developerDocument} title="CNPJ/CPF do desenvolvedor" hint={s.developerDocument ? "configurado" : "pendente (variável GONDUP_DEVELOPER_DOCUMENT)"} />
                <Item ok={s.signature} title="Assinatura ICP-Brasil (.p7s) do AFD/AEJ" hint="pendente: os arquivos saem sem assinatura até haver certificado digital" />
              </ul>
            )}
          </CardContent>
        </Card>

        {s?.readiness && (
          <Card className={s.readiness.ok ? "border-emerald-300/30 bg-emerald-950/30" : "border-amber-300/40 bg-amber-950/30"}>
            <CardHeader><CardTitle className="text-base">Cadastro para AFD, AEJ, comprovante e espelho</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {s.readiness.ok ? <p className="text-emerald-200">Tudo cadastrado.</p> : <>
                <p className="text-slate-300">Os arquivos saem mesmo assim, mas com campos em branco ou zerados — o que enfraquece a prova. Complete em <a href="/espelho-ponto" className="font-bold text-teal-300 underline">Espelho de ponto → Dados para o espelho</a>.</p>
                {s.readiness.company.length > 0 && <p><b>Empresa:</b> falta {s.readiness.company.join(", ")}.</p>}
                {s.readiness.people.length > 0 && <ul className="list-disc pl-5 text-xs">{s.readiness.people.slice(0, 30).map((p: any) => <li key={p.memberId}><b>{p.name}</b>: falta {p.missing.join(", ")}</li>)}{s.readiness.people.length > 30 && <li>…e mais {s.readiness.people.length - 30}</li>}</ul>}
              </>}
            </CardContent>
          </Card>
        )}

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="text-base">Relógio x Hora Legal Brasileira</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-300">A Portaria 671 exige no máximo 30 segundos de diferença para a hora oficial (NTP.br, Observatório Nacional). O sistema confere todo dia, ao abrir esta tela (se a última conferência tiver mais de 6 horas) e quando você pedir. Cada conferência fica gravada na auditoria.</p>
            <Button variant="secondary" onClick={() => clockCheck.mutate()} disabled={clockCheck.isPending}>{clockCheck.isPending ? "Conferindo..." : "Conferir agora"}</Button>
            {(() => {
              const last = clock.data?.checks?.[0];
              if (!last) return <p className="text-slate-400">Nenhuma conferência ainda.</p>;
              if (last.error) return <p className="text-amber-200">Última tentativa ({fmtDateTimeSP(last.checkedAt)}) não conseguiu falar com a hora oficial: {last.error}</p>;
              const worst = Math.max(Math.abs(last.serverOffsetMs), Math.abs(last.databaseOffsetMs ?? 0));
              return <div className={`rounded-lg border p-3 ${last.ok ? "border-emerald-300/40 bg-emerald-400/10" : "border-rose-300/40 bg-rose-400/10"}`}>
                <p className="font-bold">{last.ok ? "Dentro do limite" : "FORA DO LIMITE de 30 s — avise o suporte"}: diferença de {(worst / 1000).toFixed(2)} s</p>
                <p className="text-xs text-slate-300">Servidor {last.serverOffsetMs} ms · banco de dados (que carimba as batidas) {last.databaseOffsetMs ?? "?"} ms · fonte {last.source} ({last.method === "sntp" ? "NTP" : "HTTPS, precisão ~1 s"}) · {fmtDateTimeSP(last.checkedAt)}</p>
              </div>;
            })()}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="text-base">Verificar integridade</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-300">Recalcula todos os hashes e confere a sequência de NSR. Se alguém mexer direto no banco de dados, aparece aqui.</p>
            <Button onClick={() => verify.mutate()} disabled={verify.isPending}>{verify.isPending ? "Verificando..." : "Verificar agora"}</Button>
            {verify.error && <p className="text-rose-300">{verify.error.message}</p>}
            {v && (
              <div className={`rounded-lg border p-3 ${v.ok ? "border-emerald-300/40 bg-emerald-400/10" : "border-rose-300/40 bg-rose-400/10"}`}>
                <p className="font-bold">{v.ok ? "Tudo íntegro." : `${v.totalProblems} problema(s) encontrado(s).`}</p>
                <p className="text-xs text-slate-300">{v.originals} marcações originais (último NSR {v.lastNsr}) · {v.treatments} tratamentos (ajustes/inclusões) · verificado em {fmtDateTimeSP(v.checkedAt)}</p>
                {v.sealedLegacy > 0 && <p className="mt-1 text-xs text-amber-200">{v.sealedLegacy} marcações anteriores a esta versão foram seladas em {fmtDateTimeSP(v.sealedAt)}: o selo prova que não mudaram depois dessa data, mas não antes.</p>}
                {v.problems.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs">{v.problems.map((p: any, i: number) => <li key={i}>{p.nsr ? `NSR ${p.nsr}: ` : ""}{p.message}</li>)}</ul>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="text-base">Arquivos para fiscalização (AFD e AEJ)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-300">
              <b>AFD</b>: todas as marcações originais, no leiaute oficial do Ministério do Trabalho. <b>AEJ</b>: jornadas tratadas
              (com ajustes e inclusões). Entregue ao auditor-fiscal ou ao perito quando pedirem.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">De<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1" /></label>
              <label className="text-xs">Até<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1" /></label>
              <Button variant="secondary" disabled={afd.isPending} onClick={() => void exportFile("afd")}><Download className="mr-1 h-4 w-4" />Baixar AFD</Button>
              <Button variant="secondary" disabled={aej.isPending} onClick={() => void exportFile("aej")}><Download className="mr-1 h-4 w-4" />Baixar AEJ</Button>
            </div>
            <p className="flex gap-2 rounded-lg border border-amber-300/30 bg-amber-400/10 p-2 text-xs text-amber-100">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Os arquivos ainda saem sem a assinatura digital ICP-Brasil (.p7s) exigida pela Portaria 671. Até lá, servem como prova
              complementar junto com o relatório de integridade.
            </p>
            {warnings.length > 0 && <ul className="list-disc pl-5 text-xs text-amber-200">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><FileSignature className="h-4 w-4 text-teal-300" />Quem confirmou o espelho</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1" aria-label="Mês" />
            {(acc.data || []).map((r: any) => (
              <div key={r.memberId} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/10 p-2">
                <span className="font-semibold">{r.name}{!r.active ? " (inativo)" : ""}</span>
                <span className="text-xs">
                  {!r.acceptance ? <span className="text-slate-400">Ainda não confirmou</span>
                    : <span className={r.acceptance.decision === "accepted" ? "text-emerald-300" : "text-rose-300"}>
                        {r.acceptance.decision === "accepted" ? "Confirmou" : "Contestou"} em {fmtDateTimeSP(r.acceptance.acceptedAt)} · IP {r.acceptance.ipAddress || "—"}
                        {r.acceptance.changedAfter ? " · espelho mudou depois (pedir nova confirmação)" : ""}
                        {r.acceptance.comment ? ` · “${r.acceptance.comment}”` : ""}
                      </span>}
                </span>
              </div>
            ))}
            {acc.data && !acc.data.length && <p className="text-slate-400">Nenhum funcionário.</p>}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
