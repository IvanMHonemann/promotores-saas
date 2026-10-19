import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Loader2, MessageCircle, Printer, Save, Settings2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useBusy } from "@/components/BusyOverlay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { MIRROR_HEADERS, mirrorRows, totalsLines } from "@shared/timesheetMirror";
import { buildMirrorHtml, buildMirrorPdf, buildMirrorXlsx, companyLines, download, fileBase, memberLines, periodLabel, shareOrDownload, stamp, LEGEND, DISCLAIMER, type MirrorData } from "@/lib/mirrorExport";

const field = "mt-1 border-white/15 bg-slate-950/60 text-white";
const select = "mt-1 h-10 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white";
const WEEKDAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const monthRange = (ym: string) => {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
};
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function TimesheetMirrorPage() {
  const { run } = useBusy();
  const utils = trpc.useUtils();
  const nowMonth = new Date().toISOString().slice(0, 7);
  const [who, setWho] = useState<string>("all"); // "all" | id
  const [mode, setMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(nowMonth);
  const [custom, setCustom] = useState({ from: `${nowMonth}-01`, to: new Date().toISOString().slice(0, 10) });
  const [request, setRequest] = useState<{ memberIds?: number[]; from: string; to: string } | null>(null);
  const [consolidated, setConsolidated] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const promoters = trpc.timesheetMirror.promoters.useQuery(undefined, { staleTime: 30000 });
  const range = mode === "month" ? monthRange(month) : custom;
  const invalid = !range.from || !range.to || range.from > range.to;
  const mirror = trpc.timesheetMirror.generate.useQuery(request!, { enabled: Boolean(request), staleTime: 0, refetchOnWindowFocus: false });
  const logExport = trpc.timesheetMirror.logExport.useMutation();
  const data = mirror.data as unknown as MirrorData | undefined;

  const generate = () => {
    if (invalid) { toast.error("Informe um período válido."); return; }
    const next = { memberIds: who === "all" ? undefined : [Number(who)], ...range };
    if (request && JSON.stringify(request) === JSON.stringify(next)) void mirror.refetch(); else setRequest(next);
  };
  const log = (kind: "pdf" | "xlsx" | "print" | "whatsapp") => data && logExport.mutate({ kind, from: data.results[0].report.from, to: data.results[0].report.to, count: data.results.length });

  const withOne = (r: MirrorData["results"][number]): MirrorData => ({ ...data!, results: [r] });
  const onPrint = () => {
    if (!data) return;
    const w = window.open("", "_blank");
    if (!w) { toast.error("Permita pop-ups para imprimir."); return; }
    w.document.open(); w.document.write(buildMirrorHtml(data)); w.document.close();
    log("print");
  };
  const onPdf = (share: boolean, only?: MirrorData["results"][number]) => run(share ? "Preparando PDF para compartilhar..." : "Gerando PDF...", async () => {
    const d = only ? withOne(only) : data!;
    const blob = await buildMirrorPdf(d);
    const file = new File([blob], `${fileBase(d, only)}.pdf`, { type: "application/pdf" });
    if (share) {
      const r = await shareOrDownload(file, `Espelho de ponto — ${d.company.name} — ${periodLabel(d.results[0].report)}`);
      if (r === "downloaded") toast.info("PDF baixado. Anexe-o na conversa do WhatsApp.");
      if (r !== "cancelled") log("whatsapp");
    } else { download(file); log("pdf"); }
  }).catch(() => toast.error("Não foi possível gerar o PDF."));
  const onXlsx = (share: boolean, only?: MirrorData["results"][number]) => run(share ? "Preparando Excel para compartilhar..." : "Gerando Excel...", async () => {
    const d = only ? withOne(only) : data!;
    const blob = await buildMirrorXlsx(d, consolidated && !only);
    const file = new File([blob], `${fileBase(d, only)}.xlsx`, { type: XLSX_TYPE });
    if (share) {
      const r = await shareOrDownload(file, `Espelho de ponto — ${d.company.name} — ${periodLabel(d.results[0].report)}`);
      if (r === "downloaded") toast.info("Excel baixado. Anexe-o na conversa do WhatsApp.");
      if (r !== "cancelled") log("whatsapp");
    } else { download(file); log("xlsx"); }
  }).catch(() => toast.error("Não foi possível gerar o Excel."));

  return <DashboardLayout title="Espelho de ponto" description="Confira, imprima, exporte e compartilhe as marcações de ponto por funcionário e período.">
    <div className="space-y-6">
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle>Filtros do relatório</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div><Label htmlFor="mirror-who">Funcionário</Label><select id="mirror-who" value={who} onChange={(e) => setWho(e.target.value)} className={select}><option value="all">Todos os funcionários</option>{(promoters.data || []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.active ? "" : " (inativo)"}</option>)}</select></div>
          <div><Label htmlFor="mirror-mode">Período</Label><select id="mirror-mode" value={mode} onChange={(e) => setMode(e.target.value as any)} className={select}><option value="month">Mês completo</option><option value="custom">Período personalizado</option></select></div>
          {mode === "month"
            ? <div><Label htmlFor="mirror-month">Mês</Label><Input id="mirror-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={field} /></div>
            : <div className="grid grid-cols-2 gap-2"><div><Label htmlFor="mirror-from">Data inicial</Label><Input id="mirror-from" type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className={field} /></div><div><Label htmlFor="mirror-to">Data final</Label><Input id="mirror-to" type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className={field} /></div></div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={generate} disabled={invalid || mirror.isFetching} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">{mirror.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}Visualizar espelho</Button>
          <Button variant="outline" onClick={() => setShowSettings((v) => !v)} className="border-white/20 text-white"><Settings2 className="mr-2 h-4 w-4" />Dados da empresa e jornada</Button>
        </div>
        {invalid && <p role="alert" className="text-sm text-amber-200">A data inicial deve ser anterior ou igual à final.</p>}
      </CardContent></Card>

      {showSettings && <SettingsPanel who={who} promoters={(promoters.data || []) as any[]} onSaved={() => { void utils.timesheetMirror.promoters.invalidate(); void utils.timesheetMirror.getCompanyProfile.invalidate(); if (request) void mirror.refetch(); }} />}

      {mirror.isError && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-200">{mirror.error.message || "Não foi possível gerar o espelho."}</p>}
      {mirror.isFetching && !data && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Gerando espelho...</p>}

      {data && <>
        <Card className="border-teal-300/20 bg-slate-900/70 text-white"><CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="text-sm"><p className="font-bold">{data.results.length} funcionário(s) · {periodLabel(data.results[0].report)}</p><p className="text-slate-300">Emitido em {stamp(data)}. Os arquivos usam exatamente os dados exibidos abaixo.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onPrint} variant="outline" className="border-white/25 text-white"><Printer className="mr-2 h-4 w-4" />Imprimir</Button>
            <Button onClick={() => void onPdf(false)} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><FileText className="mr-2 h-4 w-4" />PDF</Button>
            <Button onClick={() => void onXlsx(false)} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button onClick={() => void onPdf(true)} className="bg-emerald-600 text-white hover:bg-emerald-500"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp (PDF)</Button>
            <Button onClick={() => void onXlsx(true)} variant="outline" className="border-emerald-300/40 text-emerald-200"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp (Excel)</Button>
          </div>
          {data.results.length > 1 && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)} />Incluir aba consolidada da empresa no Excel</label>}
        </CardContent></Card>

        {data.results.map((r) => <Card key={r.member.id} className="border-white/10 bg-slate-900/70 text-white"><CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2"><CardTitle className="text-lg">{r.member.name}</CardTitle>
          <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => void onPdf(false, r)} className="border-white/20 text-white"><FileText className="mr-1 h-4 w-4" />PDF individual</Button><Button size="sm" variant="outline" onClick={() => void onXlsx(false, r)} className="border-white/20 text-white"><FileSpreadsheet className="mr-1 h-4 w-4" />Excel individual</Button></div></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-x-8 gap-y-1 text-sm md:grid-cols-2">{[...companyLines(data), ...memberLines(r)].map(([k, v], i) => <p key={i}><span className="text-slate-400">{k}: </span><span className="font-medium">{v}</span></p>)}</div>
            <div className="overflow-x-auto rounded-lg border border-white/10"><table className="w-full min-w-[1100px] text-xs"><thead className="bg-white/5"><tr>{MIRROR_HEADERS.map((h) => <th key={h} className="px-2 py-2 text-left font-semibold text-slate-200">{h}</th>)}</tr></thead><tbody>
              {mirrorRows(r.report).map((row, i) => <tr key={i} className={`border-t border-white/5 ${row[12] ? "bg-amber-400/5" : ""}`}>{row.map((c, j) => <td key={j} className={`px-2 py-1.5 align-top ${j === 12 ? "min-w-[260px] text-amber-200" : ""}`}>{c}</td>)}</tr>)}
            </tbody></table></div>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">{totalsLines(r.report.totals).map(([k, v]) => <div key={k} className="flex justify-between gap-3 rounded-lg bg-white/5 px-3 py-2"><span className="text-slate-300">{k}</span><b>{v}</b></div>)}</div>
            <div className="space-y-1 text-xs text-slate-400">{r.report.notes.map((n, i) => <p key={i}>• {n}</p>)}<p>{LEGEND}</p><p className="italic">{DISCLAIMER}</p></div>
          </CardContent></Card>)}
      </>}
    </div>
  </DashboardLayout>;
}

function SettingsPanel({ who, promoters, onSaved }: { who: string; promoters: any[]; onSaved: () => void }) {
  const company = trpc.timesheetMirror.getCompanyProfile.useQuery(undefined, { staleTime: 30000 });
  const saveCompany = trpc.timesheetMirror.saveCompanyProfile.useMutation({ onSuccess: () => { toast.success("Dados da empresa salvos."); onSaved(); }, onError: (e) => toast.error(e.message) });
  const saveLabor = trpc.timesheetMirror.saveLaborProfile.useMutation({ onSuccess: () => { toast.success("Perfil do funcionário salvo."); onSaved(); }, onError: (e) => toast.error(e.message) });
  const [legal, setLegal] = useState<any>(null);
  const [labor, setLabor] = useState<{ id: string; v: any } | null>(null);
  const legalValue = legal ?? company.data?.legal ?? { legalName: "", document: "", establishment: "", address: "" };
  const member = useMemo(() => promoters.find((p) => String(p.id) === who), [promoters, who]);
  const stored = member?.labor || {};
  const lv = labor && labor.id === who ? labor.v : {
    jobTitle: stored.jobTitle ?? "", admissionDate: stored.admissionDate ?? "", cpf: stored.cpf ?? "",
    dailyHours: stored.dailyMinutes ? String(stored.dailyMinutes / 60) : "", intervalMinutes: stored.intervalMinutes != null ? String(stored.intervalMinutes) : "",
    workdays: stored.workdays ?? [], nightEnabled: Boolean(stored.nightEnabled), nightStart: stored.nightStart ?? "22:00", nightEnd: stored.nightEnd ?? "05:00",
  };
  const setLv = (patch: any) => setLabor({ id: who, v: { ...lv, ...patch } });
  const submitLabor = () => {
    const h = lv.dailyHours === "" ? null : Math.round(Number(String(lv.dailyHours).replace(",", ".")) * 60);
    saveLabor.mutate({ memberId: Number(who), profile: {
      jobTitle: lv.jobTitle || null, admissionDate: lv.admissionDate || null, cpf: lv.cpf || null,
      dailyMinutes: h && h > 0 ? h : null, intervalMinutes: lv.intervalMinutes === "" ? null : Number(lv.intervalMinutes),
      workdays: lv.workdays.length ? lv.workdays : null, nightEnabled: lv.nightEnabled, nightStart: lv.nightStart, nightEnd: lv.nightEnd,
    } });
  };
  return <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle>Dados para o espelho</CardTitle></CardHeader><CardContent className="space-y-6">
    <div className="space-y-3"><p className="text-sm text-slate-300">Identificação do empregador. Campos em branco aparecem como “Não informado” no relatório.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Razão social / nome</Label><Input value={legalValue.legalName} onChange={(e) => setLegal({ ...legalValue, legalName: e.target.value })} className={field} /></div>
        <div><Label>CNPJ ou CPF</Label><Input value={legalValue.document} onChange={(e) => setLegal({ ...legalValue, document: e.target.value })} className={field} /></div>
        <div><Label>Estabelecimento</Label><Input value={legalValue.establishment} onChange={(e) => setLegal({ ...legalValue, establishment: e.target.value })} className={field} /></div>
        <div><Label>Endereço</Label><Input value={legalValue.address} onChange={(e) => setLegal({ ...legalValue, address: e.target.value })} className={field} /></div>
      </div>
      <Button onClick={() => saveCompany.mutate(legalValue)} disabled={saveCompany.isPending} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><Save className="mr-2 h-4 w-4" />Salvar empresa</Button></div>
    <div className="space-y-3 border-t border-white/10 pt-4"><p className="text-sm text-slate-300">Perfil trabalhista — selecione um funcionário no filtro acima. Sem jornada e dias configurados, horas previstas, extras e faltas não são calculadas.</p>
      {!member ? <p className="text-sm text-amber-200">Escolha um funcionário específico para editar o perfil.</p> : <>
        <div className="grid gap-3 md:grid-cols-3">
          <div><Label>Cargo/função</Label><Input value={lv.jobTitle} onChange={(e) => setLv({ jobTitle: e.target.value })} className={field} /></div>
          <div><Label>CPF</Label><Input value={lv.cpf} onChange={(e) => setLv({ cpf: e.target.value })} placeholder="000.000.000-00" className={field} /></div>
          <div><Label>Data de admissão</Label><Input type="date" value={lv.admissionDate} onChange={(e) => setLv({ admissionDate: e.target.value })} className={field} /></div>
          <div><Label>Jornada diária (horas)</Label><Input inputMode="decimal" value={lv.dailyHours} onChange={(e) => setLv({ dailyHours: e.target.value })} placeholder="Ex.: 8 ou 7,33" className={field} /></div>
          <div><Label>Intervalo previsto (min)</Label><Input inputMode="numeric" value={lv.intervalMinutes} onChange={(e) => setLv({ intervalMinutes: e.target.value })} className={field} /></div>
        </div>
        <div><Label>Dias de trabalho</Label><div className="mt-1 flex flex-wrap gap-2">{WEEKDAY_NAMES.map((n, i) => <label key={n} className="flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-sm"><input type="checkbox" checked={lv.workdays.includes(i)} onChange={(e) => setLv({ workdays: e.target.checked ? [...lv.workdays, i].sort() : lv.workdays.filter((d: number) => d !== i) })} />{n}</label>)}</div></div>
        <div className="flex flex-wrap items-end gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lv.nightEnabled} onChange={(e) => setLv({ nightEnabled: e.target.checked })} />Apurar adicional noturno (com hora reduzida)</label>
          {lv.nightEnabled && <><div><Label>Início</Label><Input type="time" value={lv.nightStart} onChange={(e) => setLv({ nightStart: e.target.value })} className={field} /></div><div><Label>Fim</Label><Input type="time" value={lv.nightEnd} onChange={(e) => setLv({ nightEnd: e.target.value })} className={field} /></div></>}</div>
        <Button onClick={submitLabor} disabled={saveLabor.isPending} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><Save className="mr-2 h-4 w-4" />Salvar perfil de {member.name}</Button></>}
    </div>
  </CardContent></Card>;
}
