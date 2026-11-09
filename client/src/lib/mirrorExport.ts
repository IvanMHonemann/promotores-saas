/** Saídas do Espelho de Ponto (PDF, Excel, HTML de impressão). Todas usam mirrorRows/totalsLines: mesmos valores da tela. */
import { MIRROR_HEADERS, fmtDate, fmtCpf, fmtPis, mirrorRows, totalsLines, localParts, type MirrorReport, type LaborProfile } from "@shared/timesheetMirror";
import { buildXlsx, type Cell } from "./xlsx";
import type { jsPDF } from "jspdf";

export type MirrorAcceptance = {
  decision: "accepted" | "contested";
  acceptedAt: string;
  documentHash: string;
  comment?: string | null;
  stillValid?: boolean;
  ipAddress?: string | null;
};
export type MirrorResult = {
  member: { id: number; name: string; role: string; employeeCode: string | null };
  labor: LaborProfile | null;
  report: MirrorReport;
  /** Hash SHA-256 do conteúdo do espelho (aceite eletrônico / prova). */
  documentHash?: string | null;
  acceptance?: MirrorAcceptance | null;
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
  const p = localParts(data.generatedAt, "America/Sao_Paulo");
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
export function memberLines(r: MirrorResult, opts?: { maskCpf?: boolean }): Array<[string, string]> {
  const lab = r.labor;
  const cpf = opts?.maskCpf
    ? (lab?.cpf ? (() => { const d = String(lab.cpf).replace(/\D/g, ""); return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : NOT_INFORMED; })() : NOT_INFORMED)
    : fmtCpf(lab?.cpf);
  const jornada = lab?.dailyMinutes
    ? `${Math.floor(lab.dailyMinutes / 60)}h${String(lab.dailyMinutes % 60).padStart(2, "0")} por dia`
    : "Não configurada";
  const intervalo = lab?.intervalMinutes != null ? ` (intervalo ${lab.intervalMinutes} min)` : "";
  return [
    ["Funcionário", r.member.name],
    ["CPF", cpf],
    ["PIS/PASEP", fmtPis(lab?.pis)],
    ["Matrícula", r.member.employeeCode || NOT_INFORMED],
    ["Cargo/função", lab?.jobTitle || roleLabel(r.member.role)],
    ["Admissão", lab?.admissionDate ? fmtDate(lab.admissionDate) : NOT_INFORMED],
    ["Jornada contratada", `${jornada}${intervalo}`],
    ["Horário contratual", lab?.schedule?.length ? lab.schedule.map(([a, b]) => `${a}–${b}`).join(", ") : NOT_INFORMED],
  ];
}
/** Campos obrigatórios para uso do espelho em RH/processo que ainda estão em branco. */
export function missingLegalFields(data: MirrorData, r: MirrorResult): string[] {
  const miss: string[] = [];
  const l = data.company.legal;
  if (!l?.legalName && !data.company.name) miss.push("razão social");
  if (!l?.document) miss.push("CNPJ/CPF do empregador");
  if (!l?.address) miss.push("endereço do estabelecimento");
  if (!r.labor?.cpf) miss.push("CPF do funcionário");
  if (!r.labor?.admissionDate) miss.push("data de admissão");
  if (!r.labor?.jobTitle) miss.push("cargo/função");
  if (!r.labor?.dailyMinutes) miss.push("jornada contratada");
  if (!r.member.employeeCode) miss.push("matrícula");
  return miss;
}
export const periodLabel = (r: MirrorReport) => `${fmtDate(r.from)} a ${fmtDate(r.to)}`;
export const LEGEND = "Legenda (horário de Brasília, America/Sao_Paulo): * = marcação ajustada por correção aprovada (original e justificativa em Ocorrências); + = batida incluída manualmente; # = ajuste antigo sem original estruturado; A = saída automática do sistema; (pendente) = sincronização pendente; (off) = registrada offline (sem internet; horário do aparelho, recebida depois pelo servidor). — = não aplicável/não configurado. DSR = descanso semanal remunerado.";
export const DISCLAIMER = "Documento gerado pelo GondUp a partir das batidas registradas. A batida original é preservada; correções viram registros à parte. Serve para conferência e arquivo da empresa.";

/** Resumo do documento; a planilha e a tela continuam com os indicadores completos. */
export function documentTotals(r: MirrorResult): Array<[string, string]> {
  const t = r.report.totals;
  const all = totalsLines(t);
  return [
    ...all.slice(0, 7),
    ...(r.labor?.nightEnabled || t.nightMinutes != null || t.nightReducedMinutes != null ? all.slice(7, 9) : []),
    ...(t.adjustedMarks ? [all[11]] : []),
    ...(t.pendingSyncMarks ? [all[13]] : []),
    ...(t.offlineMarks ? [all[14]] : []),
  ];
}

/** Só explica símbolos presentes, sem esconder os tipos antigos de marcação. */
export function documentLegend(report: MirrorReport): string {
  const marks = report.days.flatMap((d) => d.marks);
  const items = [
    marks.some((m) => m.kind === "adjusted" && m.originalLabel) && "* ajustada",
    marks.some((m) => m.kind === "adjusted" && !m.originalLabel) && "+ incluída manualmente",
    marks.some((m) => m.kind === "legacy_adjusted") && "# ajuste antigo",
    marks.some((m) => m.kind === "automatic") && "A saída automática",
    marks.some((m) => m.offline) && "(off) registrada sem internet",
    marks.some((m) => !m.synced) && "(pendente) ainda não enviada ao servidor",
  ].filter(Boolean);
  return items.length ? `Legenda: ${items.join("; ")}.` : "";
}

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
function acceptanceHtml(r: MirrorResult): string {
  if (!r.acceptance) return r.documentHash ? `<p class="meta"><b>Código do documento:</b> <code>${esc(r.documentHash)}</code></p>` : "";
  const a = r.acceptance;
  const when = (() => { try { const p = localParts(a.acceptedAt, "America/Sao_Paulo"); return `${fmtDate(p.date)} ${p.hm}`; } catch { return a.acceptedAt; } })();
  const dec = a.decision === "accepted" ? "confirmado eletronicamente pelo funcionário" : "contestado eletronicamente pelo funcionário";
  return `<div class="accept"><p><b>Aceite eletrônico:</b> ${esc(dec)} em ${esc(when)} (Brasília).` +
    (a.stillValid === false ? " <b>Atenção:</b> houve mudança depois deste aceite." : "") +
    (a.comment ? ` Comentário: ${esc(a.comment)}.` : "") +
    `</p><p class="hash">Código do documento: <code>${esc(a.documentHash)}</code></p></div>`;
}
function htmlFor(data: MirrorData, r: MirrorResult) {
  const miss = missingLegalFields(data, r);
  const warn = miss.length ? `<p class="warn"><b>Dados incompletos para uso em RH/processo:</b> ${esc(miss.join(", "))}.</p>` : "";
  const kv = (arr: Array<[string, string]>) => `<table class="kv">${arr.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>`;
  const body = mirrorRows(r.report).map((row) => `<tr>${row.map((c, i) => `<td class="${i === 12 ? "obs" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("");
  return `<section class="page"><h1>Espelho de Ponto</h1>${warn}
<div class="grid"><div><h2>Empresa</h2>${kv(companyLines(data))}</div><div><h2>Funcionário</h2>${kv(memberLines(r))}</div></div>
<p class="meta"><b>Período:</b> ${periodLabel(r.report)} &nbsp;·&nbsp; <b>Emitido em:</b> ${stamp(data)} (horário de Brasília) &nbsp;·&nbsp; <b>Fuso:</b> ${esc(data.timeZone)}</p>
${acceptanceHtml(r)}
<table class="main"><thead><tr>${MIRROR_HEADERS.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
<h2>Totais do período</h2><table class="kv totals">${documentTotals(r).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
${documentLegend(r.report) ? `<p class="notes">${esc(documentLegend(r.report))}</p>` : ""}
<div class="sign"><div>______________________________<br>Assinatura do funcionário<br>Data: ____/____/________</div></div></section>`;
}
export function buildMirrorHtml(data: MirrorData, autoPrint = true): string {
  const css = `*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#111;margin:0}.page{page-break-after:always;padding:0}.page:last-child{page-break-after:auto}h1{font-size:18px;margin:0 0 8px}h2{font-size:12px;margin:10px 0 4px;color:#0f3d3a}.grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td,p{overflow-wrap:anywhere}.grid>div{min-width:0}.kv th{text-align:left;width:34%;padding:2px 6px 2px 0;color:#444;font-weight:600}.kv td{padding:2px 0}.main th,.main td{border:1px solid #999;padding:3px 4px;vertical-align:top;font-size:9.5px}.main th{background:#e2e8f0}.main thead{display:table-header-group}.main tr,.totals tr{break-inside:avoid}.main td.obs{width:26%}.meta{margin:8px 0}.totals{width:60%}.totals th{width:75%}.totals th,.totals td{border-bottom:1px solid #ddd}.notes{margin-top:8px;font-size:9.5px;color:#333}.notes p{margin:2px 0}.sign{display:flex;justify-content:space-around;margin-top:36px;font-size:10px;text-align:center;break-inside:avoid}.warn{background:#fff3cd;border:1px solid #f0c36d;padding:6px 8px;margin:0 0 8px;font-size:10px}.accept{background:#e8f5f3;border:1px solid #9ad5cb;padding:6px 8px;margin:0 0 8px;font-size:10px}.accept .hash,code{font-family:ui-monospace,monospace;font-size:9px;word-break:break-all}@media print{@page{size:A4 landscape;margin:10mm}}`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Espelho de ponto</title><style>${css}</style></head><body>${data.results.map((r) => htmlFor(data, r)).join("")}${autoPrint ? `<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script>` : ""}</body></html>`;
}

/* ---------------- PDF (jsPDF) ---------------- */
/**
 * As fontes padrão do jsPDF (Helvetica) só suportam Windows-1252. Qualquer outro caractere
 * (ex.: "→", "−", emojis) sai como lixo e quebra a medição de largura (letras espaçadas e texto
 * saindo da célula). Converte o que tem equivalente e remove o resto.
 */
const PDF_REPLACEMENTS: Record<string, string> = {
  "→": "->", "←": "<-", "↔": "<->", "−": "-", "‐": "-", "‑": "-", "‒": "-", "≥": ">=", "≤": "<=", "≠": "!=", "✓": "OK", "✔": "OK", "✗": "X", "✘": "X",
  "\u00a0": " ", "\u2009": " ", "\u202f": " ", "\u200b": "", "\t": " ",
};
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
export function pdfSafe(text: string): string {
  let out = "";
  for (const ch of String(text ?? "").normalize("NFC")) {
    const code = ch.codePointAt(0)!;
    if (PDF_REPLACEMENTS[ch] !== undefined) out += PDF_REPLACEMENTS[ch];
    else if (ch === "\n") out += " ";
    else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.includes(ch)) out += ch;
    else {
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (base !== ch && /^[\x20-\x7e]+$/.test(base)) out += base;
    }
  }
  return out;
}

const PDF_HEADERS = ["Data", "Dia", "Entrada", "Iníc. int.", "Ret. int.", "Saída", "Trab.", "Interv.", "Prev.", "Dif.", "Extras", "Ad. not.", "Ocorrências"];

type PageMeta = { memberName: string; companyName: string; stamp: string; hash?: string | null };

/** Divide também palavras longas (nomes, códigos e comentários) dentro da largura real. */
function pdfWrap(doc: jsPDF, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of pdfSafe(text).split(/\s+/)) {
    if (!word) continue;
    if (line && doc.getTextWidth(`${line} ${word}`) <= width) { line += ` ${word}`; continue; }
    if (line) { lines.push(line); line = ""; }
    for (const char of word) {
      if (line && doc.getTextWidth(line + char) > width) { lines.push(line); line = ""; }
      line += char;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function pdfFor(data: MirrorData, r: MirrorResult, doc: jsPDF, first: boolean, pageMeta: PageMeta[]) {
  if (!first) doc.addPage("a4", "landscape");
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 10;
  const contentW = W - 2 * M;
  const bottom = H - 20; // espaço reservado ao rodapé, inclusive nomes longos
  const widths = [19, 8, 18, 20, 20, 18, 15, 13, 13, 13, 13, 15];
  const cols = [...widths, contentW - widths.reduce((a, b) => a + b, 0)];
  let y = M;
  const hashShort = (r.documentHash || r.acceptance?.documentHash || "").slice(0, 12);
  const registerPage = () => {
    pageMeta[doc.getNumberOfPages() - 1] = {
      memberName: r.member.name,
      companyName: data.company.legal?.legalName || data.company.name || "Empresa",
      stamp: stamp(data), hash: hashShort || null,
    };
  };
  registerPage();

  const newPage = () => {
    doc.addPage("a4", "landscape");
    registerPage();
    y = M;
    const font = doc.getFont(), size = doc.getFontSize();
    doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(60);
    const lines = pdfWrap(doc, `Espelho de ponto (cont.) — ${r.member.name} — ${periodLabel(r.report)}`, contentW);
    doc.text(lines, M, y + 3, { lineHeightFactor: 1.2 });
    y += lines.length * 3.4 + 4;
    doc.setFont(font.fontName, font.fontStyle).setFontSize(size).setTextColor(0);
  };
  const ensure = (h: number) => { if (y + h > bottom) newPage(); };
  const paragraph = (text: string, size = 8, bold = false) => {
    doc.setFontSize(size).setFont("helvetica", bold ? "bold" : "normal");
    const step = size * 0.3528 * 1.3;
    for (const line of pdfWrap(doc, text, contentW)) {
      ensure(step);
      doc.text(line, M, y + step * 0.8);
      y += step;
    }
  };

  paragraph("Espelho de Ponto", 16, true);
  y += 3;
  const miss = missingLegalFields(data, r);
  if (miss.length) {
    paragraph(`Atenção — dados incompletos para uso em RH/processo: ${miss.join(", ")}.`, 8, true);
    y += 2;
  }

  // Cada linha cresce com o conteúdo; a coluna direita termina na margem, não em x=284.
  const left = companyLines(data), right = memberLines(r);
  const gap = 8, colW = (contentW - gap) / 2;
  const labelW = [30, 34];
  doc.setFontSize(8.5);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const pairs = [left[i], right[i]].map((pair, j) => {
      if (!pair) return { label: [], value: [] };
      doc.setFont("helvetica", "bold");
      const label = pdfWrap(doc, `${pair[0]}:`, labelW[j] - 2);
      doc.setFont("helvetica", "normal");
      return { label, value: pdfWrap(doc, pair[1], colW - labelW[j]) };
    });
    const count = Math.max(1, ...pairs.flatMap((p) => [p.label.length, p.value.length]));
    for (let line = 0; line < count; line++) {
      ensure(4.2);
      pairs.forEach((pair, j) => {
        const x = M + j * (colW + gap);
        doc.setFont("helvetica", "bold");
        if (pair.label[line]) doc.text(pair.label[line], x, y + 3.2);
        doc.setFont("helvetica", "normal");
        if (pair.value[line]) doc.text(pair.value[line], x + labelW[j], y + 3.2);
      });
      y += 4.2;
    }
  }
  y += 2;
  paragraph(`Período: ${periodLabel(r.report)}    Emitido em: ${stamp(data)} (Brasília)    Fuso: ${data.timeZone}`, 8, true);
  y += 2;
  if (r.acceptance) {
    const a = r.acceptance;
    let when = a.acceptedAt;
    try { const p = localParts(a.acceptedAt, "America/Sao_Paulo"); when = `${fmtDate(p.date)} ${p.hm}`; } catch { /* keep */ }
    const dec = a.decision === "accepted" ? "confirmado eletronicamente pelo funcionário" : "contestado eletronicamente pelo funcionário";
    paragraph(`Confirmação no app: ${dec} em ${when} (Brasília).${a.stillValid === false ? " ATENÇÃO: o espelho mudou depois desta confirmação." : ""}${a.comment ? ` Comentário: ${a.comment}.` : ""} Código: ${a.documentHash}`);
  } else if (r.documentHash) paragraph(`Código do documento: ${r.documentHash}`, 7.5);
  y += 2;

  const drawHead = () => {
    doc.setFontSize(7.5).setFont("helvetica", "bold").setFillColor(226, 232, 240);
    const lines = PDF_HEADERS.map((h, i) => pdfWrap(doc, h, cols[i] - 2));
    const h = Math.max(...lines.map((l) => l.length)) * 3.3 + 2;
    doc.rect(M, y, contentW, h, "F");
    let x = M;
    lines.forEach((l, i) => { doc.text(l, x + 1, y + 3.3, { lineHeightFactor: 1.247 }); x += cols[i]; });
    y += h;
    doc.setFont("helvetica", "normal");
  };
  ensure(18);
  drawHead();
  for (const row of mirrorRows(r.report)) {
    const lines = row.map((c, i) => pdfWrap(doc, c || "—", cols[i] - 2));
    const count = Math.max(...lines.map((l) => l.length), 1);
    const rowH = count * 3.3 + 2;
    // Uma ocorrência longa pode ocupar várias páginas sem cortar texto nem invadir o rodapé.
    if (y + Math.min(rowH, 25) > bottom) { newPage(); drawHead(); }
    let offset = 0;
    while (offset < count) {
      const capacity = Math.floor((bottom - y - 2) / 3.3);
      if (capacity < 1) { newPage(); drawHead(); continue; }
      const take = Math.min(count - offset, capacity);
      const h = take * 3.3 + 2;
      let x = M;
      doc.setDrawColor(190);
      lines.forEach((l, i) => {
        doc.rect(x, y, cols[i], h);
        // Repete a data nas continuações da mesma ocorrência para manter a identificação.
        const chunk = l.slice(offset, offset + take);
        if (!chunk.length && offset && i < 2) chunk.push(l[0]);
        if (chunk.length) doc.text(chunk, x + 1, y + 3.3, { lineHeightFactor: 1.247 });
        x += cols[i];
      });
      y += h;
      offset += take;
      if (offset < count) { newPage(); drawHead(); }
    }
  }

  const totals = documentTotals(r);
  ensure(12 + totals.length * 4.5);
  y += 5;
  paragraph("Totais do período", 10, true);
  y += 2;
  doc.setFontSize(8);
  // Valores junto aos rótulos, em vez de 170 mm à direita (ilegível no celular).
  const totalW = Math.min(contentW, 145), valueW = 24;
  for (const [label, value] of totals) {
    doc.setFont("helvetica", "normal");
    const labels = pdfWrap(doc, label, totalW - valueW - 4);
    doc.setFont("helvetica", "bold");
    const values = pdfWrap(doc, value, valueW - 2);
    const h = Math.max(labels.length, values.length) * 3.7 + 1;
    ensure(h);
    doc.setDrawColor(220).line(M, y + h, M + totalW, y + h);
    doc.setFont("helvetica", "normal").text(labels, M + 1, y + 3.2, { lineHeightFactor: 1.3 });
    doc.setFont("helvetica", "bold").text(values, M + totalW - valueW, y + 3.2, { lineHeightFactor: 1.3 });
    y += h;
  }
  const legend = documentLegend(r.report);
  if (legend) { y += 3; paragraph(legend, 7.5); }
  ensure(24);
  y += 8;
  doc.setDrawColor(80).line(M, y, M + 70, y);
  y += 2;
  paragraph("Assinatura do funcionário", 8);
  paragraph("Data: ____/____/________", 8);
}

export async function buildMirrorPdf(data: MirrorData): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageMeta: PageMeta[] = [];
  for (let i = 0; i < data.results.length; i++) await pdfFor(data, data.results[i], doc, i === 0, pageMeta);
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const meta = pageMeta[i - 1] || { memberName: "", companyName: data.company.name, stamp: stamp(data), hash: null };
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100);
    // Nomes extensos não empurram emissão/paginação para fora da folha.
    const hashBit = meta.hash ? ` · cód. ${meta.hash}…` : "";
    const lines = pdfWrap(doc, `${meta.companyName} · Espelho de ponto · ${meta.memberName} · emitido em ${meta.stamp} (Brasília)${hashBit} · página ${i} de ${total}`, W - 20);
    const available = 15;
    if (lines.length * 3 > available) {
      // Casos extremos: reduz a fonte até o rodapé inteiro caber na área reservada.
      let size = 7;
      while (lines.length * size * 0.3528 * 1.2 > available && size > 3) {
        size -= 0.5;
        doc.setFontSize(size);
        lines.splice(0, lines.length, ...pdfWrap(doc, `${meta.companyName} · Espelho de ponto · ${meta.memberName} · emitido em ${meta.stamp} (Brasília)${hashBit} · página ${i} de ${total}`, W - 20));
      }
    }
    const step = doc.getFontSize() * 0.3528 * 1.2;
    doc.text(lines, 10, H - 5 - (lines.length - 1) * step, { lineHeightFactor: 1.2 });
    doc.setTextColor(0);
  }
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
