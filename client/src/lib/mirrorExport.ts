/** Saídas do Espelho de Ponto (PDF, Excel, HTML de impressão). Todas usam mirrorRows/totalsLines: mesmos valores da tela. */
import { MIRROR_HEADERS, fmtDate, maskCpf, mirrorRows, totalsLines, localParts, type MirrorReport, type LaborProfile } from "@shared/timesheetMirror";
import { buildXlsx, type Cell } from "./xlsx";

export type MirrorResult = {
  member: { id: number; name: string; role: string; employeeCode: string | null };
  labor: LaborProfile | null;
  report: MirrorReport;
};
export type MirrorData = {
  company: { name: string; legal: { legalName: string; document: string; establishment: string; address: string } | null };
  generatedAt: string;
  timeZone: string;
  results: MirrorResult[];
};

export const NOT_INFORMED = "Não informado";
const roleLabel = (r: string) => (r === "promoter" ? "Promotor" : r === "supervisor" ? "Supervisor" : r);
export const stamp = (data: MirrorData) => {
  const p = localParts(data.generatedAt, data.timeZone);
  return `${fmtDate(p.date)} ${p.hm}`;
};
export function companyLines(data: MirrorData): Array<[string, string]> {
  const l = data.company.legal;
  return [
    ["Empresa", l?.legalName || data.company.name || NOT_INFORMED],
    ["CNPJ/CPF", l?.document || NOT_INFORMED],
    ["Estabelecimento", l?.establishment || NOT_INFORMED],
    ["Endereço", l?.address || NOT_INFORMED],
  ];
}
export function memberLines(r: MirrorResult): Array<[string, string]> {
  const lab = r.labor;
  return [
    ["Funcionário", r.member.name],
    ["CPF", maskCpf(lab?.cpf)],
    ["Matrícula", r.member.employeeCode || NOT_INFORMED],
    ["Cargo/função", lab?.jobTitle || roleLabel(r.member.role)],
    ["Admissão", lab?.admissionDate ? fmtDate(lab.admissionDate) : NOT_INFORMED],
    ["Jornada contratada", lab?.dailyMinutes ? `${Math.floor(lab.dailyMinutes / 60)}h${String(lab.dailyMinutes % 60).padStart(2, "0")} por dia` : "Não configurada"],
  ];
}
export const periodLabel = (r: MirrorReport) => `${fmtDate(r.from)} a ${fmtDate(r.to)}`;
export const LEGEND = "Legenda: horários em Brasília. “(ajustada)” = marcação corrigida após solicitação aprovada (valor original e justificativa nas ocorrências); “(automática)” = saída gerada pelo sistema; “(pend. sinc.)” = marcação ainda não sincronizada. “—” = não aplicável/não configurado.";
export const DISCLAIMER = "Documento de conferência gerado pelo sistema a partir das marcações registradas. Não substitui o comprovante/registro oficial de ponto nem constitui, por si só, atestado de conformidade com a Portaria MTP 671/2021.";

const safe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "arquivo";
export const fileBase = (data: MirrorData, r?: MirrorResult) =>
  `espelho-ponto-${r ? safe(r.member.name) : "consolidado"}-${data.results[0]?.report.from ?? ""}_${data.results[0]?.report.to ?? ""}`;

/* ---------------- Excel ---------------- */
function sheetFor(data: MirrorData, r: MirrorResult) {
  const hdr = (arr: string[]): Cell[] => arr.map((v) => ({ v, fill: true }));
  const rows: Cell[][] = [
    [{ v: "ESPELHO DE PONTO", bold: true }],
    ...companyLines(data).map(([k, v]) => [{ v: k, bold: true }, v] as Cell[]),
    ...memberLines(r).map(([k, v]) => [{ v: k, bold: true }, v] as Cell[]),
    [{ v: "Período", bold: true }, periodLabel(r.report)],
    [{ v: "Emitido em", bold: true }, stamp(data)],
    [],
  ];
  const headerRow = rows.length + 1;
  rows.push(hdr(MIRROR_HEADERS), ...mirrorRows(r.report));
  rows.push([], [{ v: "TOTAIS DO PERÍODO", bold: true }], ...totalsLines(r.report.totals).map(([k, v]) => [{ v: k, bold: true }, v] as Cell[]));
  rows.push([], [{ v: "Observações", bold: true }], ...r.report.notes.map((n) => [n] as Cell[]), [LEGEND], [DISCLAIMER]);
  return { name: r.member.name, rows, widths: [12, 6, 16, 16, 16, 16, 12, 10, 10, 10, 10, 12, 60], freezeRow: headerRow, autoFilterRow: headerRow };
}
export async function buildMirrorXlsx(data: MirrorData, consolidated = false): Promise<Blob> {
  const sheets = data.results.map((r) => sheetFor(data, r));
  if (consolidated || data.results.length > 1) {
    const head: Cell[] = ["Funcionário", "Matrícula", "Dias com marcação", "Trabalhadas", "Previstas", "Saldo", "Extras", "Adic. noturno", "Incompletos", "Ajustadas", "Automáticas"].map((v) => ({ v, fill: true }));
    const lines = data.results.map((r): Cell[] => {
      const t = Object.fromEntries(totalsLines(r.report.totals));
      return [r.member.name, r.member.employeeCode || NOT_INFORMED, t["Dias com marcação"], t["Horas trabalhadas"], t["Horas previstas"], t["Saldo (trabalhadas − previstas)"], t["Horas extras"], t["Adicional noturno (min. relógio)"], t["Dias incompletos/inconsistentes"], t["Marcações ajustadas"], t["Saídas automáticas do sistema"]];
    });
    const rows: Cell[][] = [[{ v: "ESPELHO DE PONTO — RELATÓRIO CONSOLIDADO", bold: true }], ...companyLines(data).map(([k, v]) => [{ v: k, bold: true }, v] as Cell[]), [{ v: "Período", bold: true }, periodLabel(data.results[0].report)], [{ v: "Emitido em", bold: true }, stamp(data)], [], head, ...lines, [], [DISCLAIMER]];
    sheets.unshift({ name: "Consolidado", rows, widths: [28, 14, 12, 12, 12, 10, 10, 14, 12, 10, 12], freezeRow: 9, autoFilterRow: 9 });
  }
  return buildXlsx(sheets);
}

/* ---------------- HTML (impressão A4) ---------------- */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
function htmlFor(data: MirrorData, r: MirrorResult) {
  const kv = (arr: Array<[string, string]>) => `<table class="kv">${arr.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
  const body = mirrorRows(r.report).map((row) => `<tr>${row.map((c, i) => `<td class="${i === 12 ? "obs" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<section class="page"><h1>Espelho de Ponto</h1>
<div class="grid"><div><h2>Empresa</h2>${kv(companyLines(data))}</div><div><h2>Funcionário</h2>${kv(memberLines(r))}</div></div>
<p class="meta"><b>Período:</b> ${periodLabel(r.report)} &nbsp;·&nbsp; <b>Emitido em:</b> ${stamp(data)}</p>
<table class="main"><thead><tr>${MIRROR_HEADERS.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
<h2>Totais do período</h2><table class="kv totals">${totalsLines(r.report.totals).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="notes">${r.report.notes.map((n) => `<p>• ${esc(n)}</p>`).join("")}<p>${esc(LEGEND)}</p><p><i>${esc(DISCLAIMER)}</i></p></div>
<div class="sign"><div>______________________________<br>Assinatura do funcionário</div><div>______________________________<br>Responsável pela empresa</div></div></section>`;
}
export function buildMirrorHtml(data: MirrorData, autoPrint = true): string {
  const css = `*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#111;margin:0}.page{page-break-after:always;padding:0}.page:last-child{page-break-after:auto}h1{font-size:18px;margin:0 0 8px}h2{font-size:12px;margin:10px 0 4px;color:#0f3d3a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{border-collapse:collapse;width:100%}.kv th{text-align:left;width:34%;padding:2px 6px 2px 0;color:#444;font-weight:600}.kv td{padding:2px 0}.main th,.main td{border:1px solid #999;padding:3px 4px;vertical-align:top;font-size:9.5px}.main th{background:#e2e8f0}.main thead{display:table-header-group}.main tr,.totals tr{break-inside:avoid}.main td.obs{width:26%}.meta{margin:8px 0}.totals{width:60%}.totals th,.totals td{border-bottom:1px solid #ddd}.notes{margin-top:8px;font-size:9.5px;color:#333}.notes p{margin:2px 0}.sign{display:flex;justify-content:space-around;margin-top:36px;font-size:10px;text-align:center;break-inside:avoid}@media print{@page{size:A4 landscape;margin:10mm}}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Espelho de ponto</title><style>${css}</style></head><body>${data.results.map((r) => htmlFor(data, r)).join("")}${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>` : ""}</body></html>`;
}

/* ---------------- PDF (jsPDF) ---------------- */
async function pdfFor(data: MirrorData, r: MirrorResult, doc: any, first: boolean) {
  const W = 297, H = 210, M = 10;
  if (!first) doc.addPage("a4", "landscape");
  const widths = [18, 9, 24, 24, 24, 24, 17, 15, 15, 15, 14, 16];
  const obsW = W - 2 * M - widths.reduce((a, b) => a + b, 0);
  const cols = [...widths, obsW];
  let y = M;
  const footer = () => { doc.setFontSize(7).setTextColor(100); doc.text(`${data.company.name} · Espelho de ponto · ${r.member.name} · emitido em ${stamp(data)} · página ${doc.getNumberOfPages()}`, M, H - 5); doc.setTextColor(0); };
  const ensure = (h: number) => { if (y + h > H - 10) { footer(); doc.addPage("a4", "landscape"); y = M; drawHead(); } };
  const drawHead = () => {
    doc.setFontSize(8).setFont("helvetica", "bold").setFillColor(226, 232, 240);
    let x = M; doc.rect(M, y, W - 2 * M, 7, "F");
    MIRROR_HEADERS.forEach((h, i) => { doc.text(h, x + 1, y + 4.5, { maxWidth: cols[i] - 2 }); x += cols[i]; });
    y += 7; doc.setFont("helvetica", "normal");
  };
  doc.setFontSize(16).setFont("helvetica", "bold").text("Espelho de Ponto", M, y + 5); y += 10;
  doc.setFontSize(8.5).setFont("helvetica", "normal");
  const left = companyLines(data), right = memberLines(r);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) { doc.setFont("helvetica", "bold").text(`${left[i][0]}:`, M, y); doc.setFont("helvetica", "normal").text(left[i][1], M + 28, y, { maxWidth: 100 }); }
    if (right[i]) { doc.setFont("helvetica", "bold").text(`${right[i][0]}:`, 150, y); doc.setFont("helvetica", "normal").text(right[i][1], 150 + 32, y, { maxWidth: 105 }); }
    y += 4.6;
  }
  doc.setFont("helvetica", "bold").text(`Período: ${periodLabel(r.report)}    Emitido em: ${stamp(data)}`, M, y + 1); y += 6;
  drawHead();
  doc.setFontSize(7.5);
  for (const row of mirrorRows(r.report)) {
    const lines = row.map((c, i) => doc.splitTextToSize(c, cols[i] - 2) as string[]);
    const h = Math.max(...lines.map((l) => l.length)) * 3.4 + 2;
    ensure(h);
    let x = M;
    doc.setDrawColor(190);
    lines.forEach((l, i) => { doc.rect(x, y, cols[i], h); doc.text(l, x + 1, y + 3.6); x += cols[i]; });
    y += h;
  }
  const totals = totalsLines(r.report.totals);
  ensure(8 + Math.ceil(totals.length / 2) * 5);
  y += 5; doc.setFontSize(10).setFont("helvetica", "bold").text("Totais do período", M, y); y += 5; doc.setFontSize(8.5);
  totals.forEach(([k, v], i) => { const cx = M + (i % 2) * 140, cy = y + Math.floor(i / 2) * 5; doc.setFont("helvetica", "normal").text(k, cx, cy); doc.setFont("helvetica", "bold").text(v, cx + 90, cy); });
  y += Math.ceil(totals.length / 2) * 5 + 4;
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  const notes = [...r.report.notes.map((n) => `• ${n}`), LEGEND, DISCLAIMER].flatMap((n) => doc.splitTextToSize(n, W - 2 * M) as string[]);
  for (const line of notes) { ensure(4); doc.text(line, M, y); y += 3.5; }
  ensure(22); y += 14;
  doc.setFontSize(8).text("______________________________", 40, y).text("______________________________", 190, y);
  doc.text("Assinatura do funcionário", 50, y + 4).text("Responsável pela empresa", 200, y + 4);
  footer();
}
export async function buildMirrorPdf(data: MirrorData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  for (let i = 0; i < data.results.length; i++) await pdfFor(data, data.results[i], doc, i === 0);
  return doc.output("blob");
}

/** Compartilha o arquivo (Web Share) quando possível; senão baixa e abre o WhatsApp. */
export async function shareOrDownload(file: File, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: file.name, text }); return "shared"; }
    catch (e) { if ((e as DOMException).name === "AbortError") return "cancelled"; }
  }
  download(file);
  window.open(`https://wa.me/?text=${encodeURIComponent(`${text} (anexe o arquivo baixado: ${file.name})`)}`, "_blank", "noopener,noreferrer");
  return "downloaded";
}
export function download(file: File | Blob, name?: string) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a"); a.href = url; a.download = name || (file as File).name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
