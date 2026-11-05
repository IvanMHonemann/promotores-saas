/** Saídas do Espelho de Ponto (PDF, Excel, HTML de impressão). Todas usam mirrorRows/totalsLines: mesmos valores da tela. */
import { MIRROR_HEADERS, fmtDate, fmtCpf, fmtPis, mirrorRows, totalsLines, localParts, type MirrorReport, type LaborProfile } from "@shared/timesheetMirror";
import { buildXlsx, type Cell } from "./xlsx";

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
export const LEGEND = "Legenda (horário de Brasília, America/Sao_Paulo): * = marcação ajustada por correção aprovada (original e justificativa em Ocorrências); + = batida incluída manualmente; # = ajuste antigo sem original estruturado; A = saída automática do sistema; ? = sincronização pendente. — = não aplicável/não configurado. DSR = descanso semanal remunerado.";
export const DISCLAIMER = "Documento gerado pelo GondUp a partir das marcações registradas (originais preservados; correções viram registros à parte). Serve para conferência e arquivo da empresa. A conformidade plena com a Portaria MTP 671/2021 (REP-P) depende ainda do registro no INPI e da assinatura digital ICP-Brasil do empregador/desenvolvedor.";

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
    `</p><p class="hash">Hash do documento: <code>${esc(a.documentHash)}</code></p></div>`;
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
<h2>Totais do período</h2><table class="kv totals">${totalsLines(r.report.totals).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="notes">${r.report.notes.map((n) => `<p>• ${esc(n)}</p>`).join("")}<p>${esc(LEGEND)}</p><p><i>${esc(DISCLAIMER)}</i></p></div>
<div class="sign"><div>______________________________<br>Assinatura do funcionário<br>Data: ____/____/________</div><div>______________________________<br>Responsável pela empresa<br>Data: ____/____/________</div></div></section>`;
}
export function buildMirrorHtml(data: MirrorData, autoPrint = true): string {
  const css = `*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#111;margin:0}.page{page-break-after:always;padding:0}.page:last-child{page-break-after:auto}h1{font-size:18px;margin:0 0 8px}h2{font-size:12px;margin:10px 0 4px;color:#0f3d3a}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}table{border-collapse:collapse;width:100%}.kv th{text-align:left;width:34%;padding:2px 6px 2px 0;color:#444;font-weight:600}.kv td{padding:2px 0}.main th,.main td{border:1px solid #999;padding:3px 4px;vertical-align:top;font-size:9.5px}.main th{background:#e2e8f0}.main thead{display:table-header-group}.main tr,.totals tr{break-inside:avoid}.main td.obs{width:26%}.meta{margin:8px 0}.totals{width:60%}.totals th,.totals td{border-bottom:1px solid #ddd}.notes{margin-top:8px;font-size:9.5px;color:#333}.notes p{margin:2px 0}.sign{display:flex;justify-content:space-around;margin-top:36px;font-size:10px;text-align:center;break-inside:avoid}.warn{background:#fff3cd;border:1px solid #f0c36d;padding:6px 8px;margin:0 0 8px;font-size:10px}.accept{background:#e8f5f3;border:1px solid #9ad5cb;padding:6px 8px;margin:0 0 8px;font-size:10px}.accept .hash,code{font-family:ui-monospace,monospace;font-size:9px;word-break:break-all}@media print{@page{size:A4 landscape;margin:10mm}}`;
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

async function pdfFor(data: MirrorData, r: MirrorResult, doc: any, first: boolean, pageMeta: PageMeta[]) {
  const W = 297, H = 210, M = 10;
  if (!first) doc.addPage("a4", "landscape");

  const widths = [19, 8, 18, 20, 20, 18, 15, 13, 13, 13, 13, 15];
  const obsW = W - 2 * M - widths.reduce((a, b) => a + b, 0);
  const cols = [...widths, obsW];

  let y = M;
  let inTable = false;
  const hashShort = (r.documentHash || r.acceptance?.documentHash || "").slice(0, 12);

  const registerPage = () => {
    pageMeta[doc.getNumberOfPages() - 1] = {
      memberName: r.member.name,
      companyName: data.company.name || data.company.legal?.legalName || "Empresa",
      stamp: stamp(data),
      hash: hashShort || null,
    };
  };
  registerPage();

  const ensurePlain = (h: number) => {
    if (y + h > H - 14) {
      doc.addPage("a4", "landscape");
      registerPage();
      y = M;
      // Mini-cabeçalho nas páginas de continuação (totais/notas)
      doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(60);
      doc.text(pdfSafe(`Espelho de ponto (cont.) — ${r.member.name} — ${periodLabel(r.report)}`), M, y + 3);
      doc.setTextColor(0);
      y += 7;
    }
  };

  const ensureTable = (h: number) => {
    if (y + h > H - 14) {
      doc.addPage("a4", "landscape");
      registerPage();
      y = M;
      doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(60);
      doc.text(pdfSafe(`Espelho de ponto (cont.) — ${r.member.name} — ${periodLabel(r.report)}`), M, y + 3);
      doc.setTextColor(0);
      y += 7;
      if (inTable) drawHead();
    }
  };

  const drawHead = () => {
    doc.setFontSize(7.5).setFont("helvetica", "bold").setFillColor(226, 232, 240);
    const headerLines = PDF_HEADERS.map((h, i) => doc.splitTextToSize(pdfSafe(h), cols[i] - 2) as string[]);
    const headerH = Math.max(...headerLines.map((l: string[]) => l.length), 1) * 3.2 + 2;
    let x = M;
    doc.rect(M, y, W - 2 * M, headerH, "F");
    headerLines.forEach((lines: string[], i: number) => {
      doc.text(lines, x + 1, y + 3.2);
      x += cols[i];
    });
    y += headerH;
    doc.setFont("helvetica", "normal");
  };

  // Cabeçalho do documento
  doc.setFontSize(16).setFont("helvetica", "bold").text("Espelho de Ponto", M, y + 5);
  y += 10;

  const miss = missingLegalFields(data, r);
  if (miss.length) {
    doc.setFontSize(8).setFont("helvetica", "bold").setTextColor(140, 80, 0);
    const warnLines = doc.splitTextToSize(pdfSafe(`Atenção — dados incompletos para uso em RH/processo: ${miss.join(", ")}.`), W - 2 * M) as string[];
    for (const line of warnLines) { doc.text(line, M, y); y += 3.8; }
    doc.setTextColor(0);
    y += 1;
  }

  doc.setFontSize(8.5).setFont("helvetica", "normal");
  const left = companyLines(data), right = memberLines(r);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) {
      doc.setFont("helvetica", "bold").text(`${left[i][0]}:`, M, y);
      doc.setFont("helvetica", "normal").text(pdfSafe(left[i][1]), M + 30, y, { maxWidth: 100 });
    }
    if (right[i]) {
      doc.setFont("helvetica", "bold").text(`${right[i][0]}:`, 150, y);
      doc.setFont("helvetica", "normal").text(pdfSafe(right[i][1]), 150 + 34, y, { maxWidth: 100 });
    }
    y += 4.5;
  }
  doc.setFont("helvetica", "bold").text(
    pdfSafe(`Período: ${periodLabel(r.report)}    Emitido em: ${stamp(data)} (Brasília)    Fuso: ${data.timeZone}`),
    M, y + 1,
  );
  y += 5;

  if (r.acceptance) {
    const a = r.acceptance;
    let when = a.acceptedAt;
    try { const p = localParts(a.acceptedAt, data.timeZone); when = `${fmtDate(p.date)} ${p.hm}`; } catch { /* keep */ }
    const dec = a.decision === "accepted" ? "confirmado eletronicamente pelo funcionario" : "contestado eletronicamente pelo funcionario";
    doc.setFontSize(8).setFont("helvetica", "normal").setTextColor(20, 90, 80);
    const accLines = doc.splitTextToSize(
      pdfSafe(`Aceite eletrônico: ${dec} em ${when} (Brasília).${a.stillValid === false ? " ATENÇÃO: houve mudança depois deste aceite." : ""}${a.comment ? ` Comentário: ${a.comment}.` : ""} Hash: ${a.documentHash}`),
      W - 2 * M,
    ) as string[];
    for (const line of accLines) { doc.text(line, M, y); y += 3.6; }
    doc.setTextColor(0);
    y += 1;
  } else if (r.documentHash) {
    doc.setFontSize(7.5).setFont("helvetica", "normal").setTextColor(80);
    doc.text(pdfSafe(`Código do documento (hash): ${r.documentHash}`), M, y);
    doc.setTextColor(0);
    y += 4;
  }

  y += 1;
  inTable = true;
  drawHead();
  doc.setFontSize(7.5);

  for (const row of mirrorRows(r.report)) {
    const lines = row.map((c, i) => doc.splitTextToSize(pdfSafe(c || "—"), cols[i] - 2) as string[]);
    const h = Math.max(...lines.map((l: string[]) => l.length), 1) * 3.3 + 2;
    ensureTable(h);
    let x = M;
    doc.setDrawColor(190);
    lines.forEach((l: string[], i: number) => {
      doc.rect(x, y, cols[i], h);
      doc.text(l, x + 1, y + 3.4);
      x += cols[i];
    });
    y += h;
  }
  inTable = false;

  const totals = totalsLines(r.report.totals);
  ensurePlain(12 + totals.length * 4.2);
  y += 6;
  doc.setFontSize(10).setFont("helvetica", "bold").text("Totais do período", M, y);
  y += 6;
  doc.setFontSize(8);
  for (const [k, v] of totals) {
    ensurePlain(4.5);
    doc.setFont("helvetica", "normal").text(pdfSafe(k), M, y, { maxWidth: 160 });
    doc.setFont("helvetica", "bold").text(pdfSafe(String(v)), M + 170, y);
    y += 4.2;
  }

  y += 3;
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  const notes = [...r.report.notes.map((n) => `• ${n}`), LEGEND, DISCLAIMER]
    .flatMap((n) => doc.splitTextToSize(pdfSafe(n), W - 2 * M) as string[]);
  for (const line of notes) {
    ensurePlain(3.8);
    doc.text(line, M, y);
    y += 3.5;
  }

  // Assinaturas: tenta caber na página atual; só quebra se faltar espaço de verdade.
  const signH = r.acceptance?.decision === "accepted" ? 20 : 16;
  ensurePlain(signH);
  y += 6;
  doc.setFontSize(8).setFont("helvetica", "normal");
  doc.text("______________________________", 40, y);
  doc.text("______________________________", 190, y);
  doc.text("Assinatura do funcionario", 48, y + 4);
  doc.text("Responsavel pela empresa", 198, y + 4);
  doc.text("Data: ____/____/________", 48, y + 9);
  doc.text("Data: ____/____/________", 198, y + 9);
  if (r.acceptance?.decision === "accepted") {
    doc.setFontSize(7).setTextColor(20, 90, 80);
    doc.text(pdfSafe("(Aceite eletronico registrado no sistema — ver cabecalho do documento.)"), 40, y + 14);
    doc.setTextColor(0);
  }
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
    doc.setFontSize(7).setFont("helvetica", "normal").setTextColor(100);
    const hashBit = meta.hash ? ` · hash ${meta.hash}…` : "";
    doc.text(
      pdfSafe(`${meta.companyName} · Espelho de ponto · ${meta.memberName} · emitido em ${meta.stamp} (Brasília)${hashBit} · página ${i} de ${total}`),
      10, 210 - 5,
    );
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
