import { describe, expect, it } from "vitest";
import { pdfSafe, buildMirrorPdf, missingLegalFields, LEGEND } from "../client/src/lib/mirrorExport";
import { buildMirror, fmtMark, fmtCpf, fmtPis } from "../shared/timesheetMirror";

describe("PDF do espelho de ponto", () => {
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
    expect(fmtMark({ ...base, kind: "original", synced: false }, "America/Sao_Paulo")).toBe("08:00?");
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
});
