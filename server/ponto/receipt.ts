/**
 * Comprovante de Registro de Ponto do Trabalhador (Portaria 671, arts. 79 e 80).
 * Campos: NSR, empregador (nome e CNPJ/CPF), local de prestação do serviço, trabalhador (nome e CPF),
 * data e hora da marcação, número do INPI (REP-P) e hash SHA-256 da marcação.
 * O PDF não tem assinatura ICP-Brasil ainda (pendente de certificado digital do desenvolvedor).
 */
import { formatDH } from "./repFormat";

export type ReceiptData = {
  eventId: number;
  nsr: number | null;
  eventType: string;
  eventLabel: string;
  employerName: string;
  employerDocument: string | null;
  workplace: string;
  workerName: string;
  workerCpf: string | null;
  markedAt: string; // ISO
  recordedAt: string; // ISO
  timeZone: string;
  markedLocal: string;
  recordedLocal: string;
  dh: string;
  inpiNumber: string | null;
  hash: string | null;
  contentHash: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  offline: boolean;
  origin: string;
  sealedLegacy: boolean;
  pendingNotes: string[];
};

const LABEL: Record<string, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo", clock_out: "Saída" };

export function formatCnpjCpf(doc: string | null | undefined): string {
  const d = String(doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d || "";
}

export function buildReceiptData(input: {
  event: { id: number; nsr: number | null; eventType: string; serverTime: Date; deviceTime: Date | null; timeZone: string | null; recordHash: string | null; contentHash: string | null; workerCpf: string | null; latitude: number | null; longitude: number | null; accuracy: number | null; offline: boolean; origin: string; sealedLegacy: boolean };
  employer: { name: string; document: string | null; workplace: string | null };
  workerName: string;
  inpiNumber: string | null;
}): ReceiptData {
  const e = input.event;
  const tz = e.timeZone || "America/Sao_Paulo";
  const marked = e.deviceTime || e.serverTime;
  const fmt = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
  const pendingNotes: string[] = [];
  if (!input.employer.document) pendingNotes.push("CNPJ/CPF do empregador não cadastrado (Espelho de ponto > Dados da empresa).");
  if (!e.workerCpf) pendingNotes.push("CPF do trabalhador não cadastrado no perfil trabalhista.");
  if (!input.inpiNumber) pendingNotes.push("Registro do programa no INPI ainda não concluído.");
  pendingNotes.push("Assinatura digital ICP-Brasil pendente: este comprovante ainda não é assinado eletronicamente.");
  const gps = e.latitude != null && e.longitude != null ? `GPS ${Number(e.latitude).toFixed(6)}, ${Number(e.longitude).toFixed(6)}` : "";
  return {
    eventId: e.id,
    nsr: e.nsr,
    eventType: e.eventType,
    eventLabel: LABEL[e.eventType] ?? e.eventType,
    employerName: input.employer.name,
    employerDocument: input.employer.document ? formatCnpjCpf(input.employer.document) : null,
    workplace: input.employer.workplace || gps || "Não informado",
    workerName: input.workerName,
    workerCpf: e.workerCpf ? formatCnpjCpf(e.workerCpf) : null,
    markedAt: marked.toISOString(),
    recordedAt: e.serverTime.toISOString(),
    timeZone: tz,
    markedLocal: fmt(marked),
    recordedLocal: fmt(e.serverTime),
    dh: formatDH(marked, tz),
    inpiNumber: input.inpiNumber,
    hash: e.recordHash,
    contentHash: e.contentHash,
    latitude: e.latitude,
    longitude: e.longitude,
    accuracy: e.accuracy,
    offline: e.offline,
    origin: e.origin,
    sealedLegacy: e.sealedLegacy,
    pendingNotes,
  };
}

export async function buildReceiptPdf(r: ReceiptData): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const M = 10;
  let y = 14;
  doc.setFont("helvetica", "bold").setFontSize(13).text("Comprovante de Registro de Ponto do Trabalhador", M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90).text("Portaria MTP nº 671/2021, art. 79 — emitido pelo GondUp", M, y);
  doc.setTextColor(0);
  y += 8;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold").setFontSize(9).text(label, M, y);
    const lines = doc.splitTextToSize(value || "-", 85) as string[];
    doc.setFont("helvetica", "normal").text(lines, M + 43, y);
    y += Math.max(1, lines.length) * 4.6;
  };
  line("NSR", r.nsr != null ? String(r.nsr).padStart(9, "0") : "sem NSR");
  line("Marcação", `${r.eventLabel}${r.origin !== "original" ? " (tratamento, não é marcação original)" : ""}`);
  line("Data e hora", `${r.markedLocal} (${r.timeZone})`);
  line("Gravado no servidor", r.recordedLocal);
  line("Empregador", r.employerName || "-");
  line("CNPJ/CPF", r.employerDocument || "não cadastrado");
  line("Local", r.workplace);
  line("Trabalhador", r.workerName);
  line("CPF", r.workerCpf || "não cadastrado");
  if (r.accuracy != null) line("Precisão do GPS", `${Math.round(Number(r.accuracy))} m`);
  line("Registro INPI", r.inpiNumber || "pendente");
  if (r.offline) line("Observação", "Marcação feita sem internet e enviada depois.");
  y += 2;
  doc.setFont("helvetica", "bold").text("Código hash (SHA-256)", M, y); y += 4.5;
  doc.setFont("courier", "normal").setFontSize(7.5).text(doc.splitTextToSize(r.hash || "não selado", 128) as string[], M, y); y += 9;
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(90);
  const foot = [
    "O hash identifica esta marcação de forma única e é encadeado com a marcação anterior: qualquer alteração posterior é detectável.",
    ...(r.sealedLegacy ? ["Marcação anterior à versão com selo; selada retroativamente."] : []),
    ...r.pendingNotes,
  ];
  for (const f of foot) { const ls = doc.splitTextToSize(`• ${f}`, 128) as string[]; doc.text(ls, M, y); y += ls.length * 3.4; }
  return Buffer.from(doc.output("arraybuffer"));
}

export function receiptEmailHtml(r: ReceiptData): string {
  const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows: Array<[string, string]> = [
    ["NSR", r.nsr != null ? String(r.nsr).padStart(9, "0") : "-"],
    ["Marcação", r.eventLabel],
    ["Data e hora", `${r.markedLocal} (${r.timeZone})`],
    ["Empregador", `${r.employerName}${r.employerDocument ? ` — ${r.employerDocument}` : ""}`],
    ["Local", r.workplace],
    ["Trabalhador", `${r.workerName}${r.workerCpf ? ` — CPF ${r.workerCpf}` : ""}`],
    ["Registro INPI", r.inpiNumber || "pendente"],
    ["Hash SHA-256", r.hash || "-"],
  ];
  return `<h2 style="margin:0 0 8px">Comprovante de Registro de Ponto</h2>
<table style="border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;word-break:break-all">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:12px;color:#555">Guarde este e-mail. Você também pode baixar o comprovante em PDF no aplicativo (Ponto &gt; Comprovantes).</p>`;
}
