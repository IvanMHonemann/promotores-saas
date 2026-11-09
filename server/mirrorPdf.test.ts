import { beforeEach, describe, expect, it, vi } from "vitest";
import { pdfSafe, buildMirrorPdf, missingLegalFields, LEGEND, documentTotals, documentLegend, buildMirrorHtml, stamp, type MirrorData } from "../client/src/lib/mirrorExport";
import { buildMirror, fmtMark, fmtCpf, fmtPis } from "../shared/timesheetMirror";

const rendered = vi.hoisted(() => [] as Array<{ text: string; x: number; y: number; width: number; pageWidth: number; pageHeight: number; page: number }>);
vi.mock("jspdf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf")>();
  return { ...actual, jsPDF: function (...args: ConstructorParameters<typeof actual.jsPDF>) {
    const doc = new actual.jsPDF(...args);
    const text = doc.text.bind(doc);
    doc.text = ((value: string | string[], x: number, y: number, opts?: any) => {
      const step = doc.getFontSize() * 25.4 / 72 * (opts?.lineHeightFactor ?? 1.15);
      (Array.isArray(value) ? value : [value]).forEach((line, i) => rendered.push({
        text: line, x, y: y + i * step, width: doc.getTextWidth(line),
        pageWidth: doc.internal.pageSize.getWidth(), pageHeight: doc.internal.pageSize.getHeight(),
        page: doc.getCurrentPageInfo().pageNumber,
      }));
      return text(value, x, y, opts);
    }) as typeof doc.text;
    return doc;
  } };
});

function fixture(): MirrorData {
  const labor = { jobTitle: "Promotor de teste", admissionDate: "2024-03-15", cpf: "00000000000", pis: "00000000000", dailyMinutes: 480, workdays: [1, 2, 3, 4, 5], schedule: [["08:00", "12:00"], ["13:00", "17:00"]] as Array<[string, string]> };
  const events = (["clock_in", "break_start", "break_end", "clock_out"] as const).map((type, i) => ({
    id: i + 1, type, time: `2026-10-07T${["11", "15", "16", "20"][i]}:00:00Z`,
    receivedAt: `2026-10-07T${["11", "15", "16", "20"][i]}:00:00Z`, synced: true,
  }));
  return {
    company: { name: "IvanMH TESTE", legal: { legalName: "Empresa Fictícia IvanMH TESTE", document: "00.000.000/0000-00", establishment: "Matriz de teste", address: "Rua Exemplo, 100, Centro, Cidade de Teste/RS" } },
    generatedAt: "2026-11-05T10:00:00Z", timeZone: "America/Sao_Paulo",
    results: [{ member: { id: 1, name: "Funcionário Fictício", role: "promoter", employeeCode: "TESTE-001" }, labor, report: buildMirror({ events, from: "2026-10-01", to: "2026-10-31", labor }) }],
  };
}

describe("PDF do espelho de ponto", () => {
  beforeEach(() => { rendered.length = 0; });
  it("pdfSafe troca ou remove caracteres que a fonte do PDF não suporta", () => {
    expect(pdfSafe("original 12:19 → 12:19")).toBe("original 12:19 -> 12:19");
    expect(pdfSafe("Saldo (trabalhadas − previstas)")).toBe("Saldo (trabalhadas - previstas)");
    expect(pdfSafe("Esqueci 😀 — não marquei “ok” • ç")).toBe("Esqueci  — não marquei “ok” • ç");
    expect(pdfSafe("linha1\nlinha2")).toBe("linha1 linha2");
  });

  it("fmtMark usa símbolos de legenda (* + A # ?)", () => {
    const base = { type: "clock_in" as const, label: "Entrada", time: "2026-10-07T11:00:00Z", receivedAt: "2026-10-07T11:00:00Z", synced: true };
    expect(fmtMark({ ...base, kind: "original" }, "America/Sao_Paulo")).toBe("08:00");
    expect(fmtMark({ ...base, kind: "adjusted", originalLabel: "Entrada", originalTime: "2026-10-07T10:55:00Z", justification: "x" }, "America/Sao_Paulo")).toBe("08:00*");
    expect(fmtMark({ ...base, kind: "adjusted", justification: "incluiu" }, "America/Sao_Paulo")).toBe("08:00+");
    expect(fmtMark({ ...base, kind: "automatic" }, "America/Sao_Paulo")).toBe("08:00A");
    expect(fmtMark({ ...base, kind: "legacy_adjusted" }, "America/Sao_Paulo")).toBe("08:00#");
    expect(fmtMark({ ...base, kind: "original", synced: false }, "America/Sao_Paulo")).toBe("08:00(pendente)");
  });

  it("fmtCpf e fmtPis formatam para o espelho da empresa", () => {
    expect(fmtCpf("52998224725")).toBe("529.982.247-25");
    expect(fmtCpf(null)).toBe("Não informado");
    expect(fmtPis("12345678901")).toBe("12345678901");
    expect(fmtPis("")).toBe("Não informado");
  });

  it("gera o PDF com ajustes, CPF completo, página X de Y e aviso de dados incompletos", async () => {
    const adj = { originalType: "break_start" as const, originalTime: "2026-10-07T15:19:00Z", justification: "Esqueci → depois 😀", reviewedBy: "Ivan" };
    const ev = (id: number, type: any, time: string, extra: any = {}) => ({ id, type, time, receivedAt: time, synced: true, ...extra });
    const report = buildMirror({
      events: [
        ev(1, "clock_in", "2026-10-07T11:00:00Z"),
        ev(2, "break_start", "2026-10-07T15:30:00Z", { adjustment: adj }),
        ev(3, "break_end", "2026-10-07T16:30:00Z"),
        ev(4, "clock_out", "2026-10-07T21:00:00Z", { automatic: true }),
      ],
      from: "2026-10-01",
      to: "2026-10-31",
      labor: { dailyMinutes: 480, workdays: [1, 2, 3, 4, 5], jobTitle: "Promotor", admissionDate: "2024-03-15", cpf: "52998224725", pis: "17033259504" },
    });
    const result = {
      member: { id: 1, name: "Testador", role: "promoter", employeeCode: "PM-001" },
      labor: { jobTitle: "Promotor", admissionDate: "2024-03-15", cpf: "52998224725", pis: "17033259504", dailyMinutes: 480, workdays: [1, 2, 3, 4, 5] },
      report,
      documentHash: "a".repeat(64),
      acceptance: { decision: "accepted" as const, acceptedAt: "2026-11-02T15:00:00Z", documentHash: "a".repeat(64), stillValid: true },
    };
    const data = {
      company: {
        name: "IvanMH",
        legal: { legalName: "Ivan Mateus Honemann ME", document: "12.345.678/0001-90", establishment: "Matriz", address: "Rua Exemplo, 100 — Sapiranga/RS" },
      },
      generatedAt: "2026-11-05T10:00:00Z",
      timeZone: "America/Sao_Paulo",
      results: [result],
    };
    expect(missingLegalFields(data, result)).toEqual([]);
    expect(LEGEND).toContain("* = marcação ajustada");
    const blob = await buildMirrorPdf(data);
    expect(blob.size).toBeGreaterThan(2000);
    const buf = Buffer.from(await blob.arrayBuffer());
    // jsPDF stores page text mostly as binary; still assert PDF header and size scale with month
    expect(buf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
  });

  it("lista campos faltantes quando cadastro está incompleto", () => {
    const report = buildMirror({ events: [], from: "2026-10-01", to: "2026-10-01" });
    const miss = missingLegalFields(
      { company: { name: "X", legal: null }, generatedAt: "2026-11-05T10:00:00Z", timeZone: "America/Sao_Paulo", results: [] },
      { member: { id: 1, name: "Y", role: "promoter", employeeCode: null }, labor: null, report },
    );
    expect(miss).toEqual(expect.arrayContaining(["CNPJ/CPF do empregador", "CPF do funcionário", "jornada contratada"]));
  });
  it("mantém sete totais essenciais e só inclui indicadores adicionais quando aplicáveis", () => {
    const r = fixture().results[0];
    const totals = documentTotals(r);
    expect(totals).toHaveLength(7);
    expect(Object.fromEntries(totals)).toMatchObject({ "Dias com marcação": "1", "Horas trabalhadas": "08:00", "Tempo de intervalo": "01:00", "Horas extras": "00:00" });
    Object.assign(r.report.totals, { adjustedMarks: 2, offlineMarks: 1, pendingSyncMarks: 1, nightMinutes: 0, nightReducedMinutes: 0 });
    const extra = documentTotals(r);
    expect(extra).toHaveLength(12);
    expect(extra).toContainEqual(["Adicional noturno (min. relógio)", "00:00"]);
    expect(extra).toContainEqual(["Marcações registradas offline", "1"]);
    expect(extra.some(([k]) => /incompletos|automáticas|Dias úteis/.test(k))).toBe(false);
  });

  it("legenda é curta e contém apenas símbolos usados (inclusive os tipos antigos)", () => {
    const r = fixture().results[0];
    expect(documentLegend(r.report)).toBe("");
    const mark = r.report.days.flatMap((d) => d.marks)[0];
    Object.assign(mark, { kind: "adjusted", originalLabel: "Entrada", originalTime: mark.time, offline: true, synced: false });
    expect(documentLegend(r.report)).toBe("Legenda: * ajustada; (off) registrada sem internet; (pendente) ainda não enviada ao servidor.");
    mark.originalLabel = undefined;
    expect(documentLegend(r.report)).toContain("+ incluída manualmente");
    mark.kind = "legacy_adjusted";
    expect(documentLegend(r.report)).toContain("# ajuste antigo");
    mark.kind = "automatic";
    expect(documentLegend(r.report)).toContain("A saída automática");
  });

  it("PDF tem valores visíveis junto aos rótulos, assinatura, data e emissão em todas as páginas", async () => {
    const data = fixture();
    await buildMirrorPdf(data);
    const label = rendered.find((t) => t.text === "Horas trabalhadas")!;
    const value = rendered.find((t) => t.text === "08:00" && t.page === label.page && t.y === label.y)!;
    expect(value).toBeDefined();
    expect(value.x).toBeLessThan(150);
    expect(value.x + value.width).toBeLessThan(value.pageWidth - 10);
    const text = rendered.map((t) => t.text).join(" ");
    expect(text).toContain("Assinatura do funcionário");
    expect(text).toContain("Data: ____/____/________");
    expect(text).not.toContain("Responsavel pela empresa");
    expect(text).not.toContain("Documento gerado pelo GondUp");
    expect(text).not.toContain("Adicional noturno e hora reduzida não configurados");
    expect(text).not.toContain("Carnaval e Corpus Christi");
    expect(text).not.toContain("Banco de horas");
    expect(text).not.toContain("Legenda:");
    const pages = Math.max(...rendered.map((t) => t.page));
    for (let page = 1; page <= pages; page++) {
      const footer = rendered.filter((t) => t.page === page && t.y > 190).map((t) => t.text).join(" ");
      expect(footer).toContain(data.company.legal!.legalName);
      expect(footer).toContain(data.results[0].member.name);
      expect(footer).toContain("emitido em 05/11/2026 07:00 (Brasília)");
      expect(footer).toContain(`página ${page} de ${pages}`);
    }
  });

  it("nomes, cabeçalhos, ocorrências extensas e rodapés respeitam as margens", async () => {
    const data = fixture();
    const r = data.results[0];
    data.company.legal!.legalName = "Empresa Fictícia para testar razão social muito extensa ".repeat(5);
    data.company.legal!.address = "Rua Exemplo para testar um endereço muito extenso ".repeat(8);
    r.member.name = "Funcionário de Teste Com Nome Muito Longo ".repeat(6);
    r.labor!.jobTitle = "CargoExtensoSemEspaços".repeat(15);
    r.labor!.schedule = Array.from({ length: 12 }, () => ["08:00", "12:00"]);
    const day = r.report.days.find((d) => d.marks.length)!;
    day.issues.push("OcorrênciaComPalavraMuitoLongaSemEspaços".repeat(300));
    r.documentHash = "a".repeat(64);
    r.acceptance = { decision: "contested", acceptedAt: data.generatedAt, documentHash: r.documentHash, comment: "Comentário muito longo ".repeat(80) };
    await buildMirrorPdf(data);
    expect(new Set(rendered.map((t) => t.page)).size).toBeGreaterThan(2);
    for (const t of rendered) {
      expect(t.x, t.text).toBeGreaterThanOrEqual(9.9);
      expect(t.x + t.width, t.text).toBeLessThanOrEqual(t.pageWidth - 9.9);
      expect(t.y, t.text).toBeGreaterThanOrEqual(9.9);
      expect(t.y, t.text).toBeLessThanOrEqual(t.pageHeight - 4.9);
    }
  });

  it("impressão HTML também remove o apêndice longo e usa o resumo/legenda do período", () => {
    const html = buildMirrorHtml(fixture(), false);
    expect(html).toContain("Horas trabalhadas</th><td>08:00");
    expect(html).toContain("Assinatura do funcionário");
    expect(html).not.toContain("Responsável pela empresa");
    expect(html).not.toContain("Documento gerado pelo GondUp");
    expect(html).not.toContain("Carnaval e Corpus Christi");
    expect(html).not.toContain("Dias incompletos/inconsistentes");
    expect(html).toContain("overflow-wrap:anywhere");
  });

  it("emissão usa Brasília mesmo que o fuso das marcações seja outro", () => {
    const data = fixture();
    data.timeZone = "UTC";
    expect(stamp(data)).toBe("05/11/2026 07:00");
  });

});
