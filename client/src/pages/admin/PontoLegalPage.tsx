import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2, Circle, Download, FileSignature, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { currentMonthSP, downloadBase64, fmtDateTimeSP } from "@/lib/downloadBase64";
import { isCompanyActionableWarning, simplifyExportWarning, simplifyIntegrityProblem } from "@/lib/pontoLegalCopy";

function Item({ ok, title, hint }: { ok: boolean; title: string; hint: string }) {
  return (
    <li className="flex gap-2">
      {ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />}
      <span><b>{title}</b> <span className="text-slate-400">— {hint}</span></span>
    </li>
  );
}

/** Tela da empresa: o que o ponto já faz e o que a própria empresa ainda precisa cadastrar. */
export default function PontoLegalPage() {
  const status = trpc.pontoLegal.status.useQuery();
  const verify = trpc.pontoLegal.verifyIntegrity.useMutation();
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
      setWarnings((r.warnings || []).filter(isCompanyActionableWarning).map(simplifyExportWarning));
      toast.success(kind === "afd"
        ? `Arquivo de batidas (AFD) pronto (${r.count} marcações).`
        : `Arquivo de jornadas (AEJ) pronto (${r.count} funcionário(s)).`);
    } catch (e: any) { toast.error(e?.message || "Não foi possível gerar o arquivo."); }
  };

  const v = verify.data;
  return (
    <DashboardLayout
      title="Ponto: prova legal"
      description="Como as batidas ficam guardadas e o que a sua empresa precisa cadastrar para usar o ponto com segurança."
    >
      <div className="space-y-4 text-white">
        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-teal-300" />Como o sistema protege as batidas</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-200">
            <p>
              Cada batida recebe um <b>número em sequência</b> e um <b>lacre de segurança</b> ligado à anterior —
              qualquer alteração fica evidente. Correções <b>nunca apagam</b> a batida original: viram um registro à parte
              (quem aprovou, quando e por quê). O funcionário recebe o comprovante de cada batida e confirma o espelho do mês.
            </p>
            {s && (
              <ul className="space-y-1.5">
                <Item ok title="Batidas com número e lacre de segurança" hint="ativo" />
                <Item ok title="Comprovante de cada batida (PDF)" hint={s.emailEnabled ? "também pode ir por e-mail" : "disponível para baixar no app"} />
                <Item ok title="Confirmação do espelho do mês" hint="fica gravado quando e de onde o funcionário confirmou" />
                <Item
                  ok={s.employerDocument}
                  title="CNPJ ou CPF da empresa"
                  hint={s.employerDocument ? (s.employerName || "cadastrado") : "ainda falta — cadastre em Espelho de ponto → Dados da empresa"}
                />
                <Item
                  ok={Boolean(s.employerAddress)}
                  title="Endereço / local de trabalho"
                  hint={s.employerAddress ? "cadastrado" : "ainda falta — cadastre em Espelho de ponto → Dados da empresa"}
                />
                <Item
                  ok={(s.workersMissingCpf ?? 0) === 0}
                  title="CPF dos funcionários"
                  hint={(s.workersMissingCpf ?? 0) === 0 ? "todos com CPF no cadastro" : `${s.workersMissingCpf} ainda sem CPF — complete no Espelho de ponto (perfil do funcionário)`}
                />
                <Item
                  ok={(s.workersMissingSchedule ?? 0) === 0}
                  title="Horário de trabalho dos funcionários"
                  hint={(s.workersMissingSchedule ?? 0) === 0 ? "jornada cadastrada" : `${s.workersMissingSchedule} sem jornada — preencha no Espelho de ponto`}
                />
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="text-base">Conferir se os registros estão intactos</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-300">
              Confere se nenhuma batida foi alterada ou apagada depois de gravada. Use se precisar mostrar que o ponto está íntegro.
            </p>
            <Button onClick={() => verify.mutate()} disabled={verify.isPending}>
              {verify.isPending ? "Conferindo..." : "Conferir agora"}
            </Button>
            {verify.error && <p className="text-rose-300">{verify.error.message}</p>}
            {v && (
              <div className={`rounded-lg border p-3 ${v.ok ? "border-emerald-300/40 bg-emerald-400/10" : "border-rose-300/40 bg-rose-400/10"}`}>
                <p className="font-bold">{v.ok ? "Tudo certo: os registros estão intactos." : `Encontramos ${v.totalProblems} problema(s).`}</p>
                <p className="text-xs text-slate-300">
                  {v.originals} batida(s) · {v.treatments} correção(ões) · conferido em {fmtDateTimeSP(v.checkedAt)}
                </p>
                {v.sealedLegacy > 0 && (
                  <p className="mt-1 text-xs text-amber-200">
                    {v.sealedLegacy} batida(s) antigas receberam o lacre quando essa proteção entrou no sistema
                    ({fmtDateTimeSP(v.sealedAt)}). O lacre prova que não mudaram depois dessa data.
                  </p>
                )}
                {v.problems.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-xs">
                    {v.problems.map((p: any, i: number) => <li key={i}>{simplifyIntegrityProblem(p)}</li>)}
                  </ul>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-slate-900/70">
          <CardHeader><CardTitle className="text-base">Arquivos oficiais para fiscalização</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-slate-300">
              <b>AFD</b> — arquivo oficial de batidas para fiscalização (marcações originais).{" "}
              <b>AEJ</b> — arquivo oficial de jornadas (com correções e inclusões). Entregue ao fiscal ou ao perito quando pedirem.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs">De<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1" /></label>
              <label className="text-xs">Até<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-white/20 bg-slate-800 px-2 py-1" /></label>
              <Button variant="secondary" disabled={afd.isPending} onClick={() => void exportFile("afd")}><Download className="mr-1 h-4 w-4" />Baixar AFD</Button>
              <Button variant="secondary" disabled={aej.isPending} onClick={() => void exportFile("aej")}><Download className="mr-1 h-4 w-4" />Baixar AEJ</Button>
            </div>
            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300/30 bg-amber-400/10 p-2 text-xs text-amber-100">
                <p className="mb-1 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Antes de entregar, complete o cadastro:</p>
                <ul className="list-disc pl-5">{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
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
                        {r.acceptance.decision === "accepted" ? "Confirmou" : "Contestou"} em {fmtDateTimeSP(r.acceptance.acceptedAt)}
                        {r.acceptance.changedAfter ? " · o espelho mudou depois (peça nova confirmação)" : ""}
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
