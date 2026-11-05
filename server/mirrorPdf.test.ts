import { describe, expect, it } from "vitest";
import { pdfSafe, buildMirrorPdf } from "../client/src/lib/mirrorExport";
import { buildMirror } from "../shared/timesheetMirror";

describe("PDF do espelho de ponto", () => {
  it("pdfSafe troca ou remove caracteres que a fonte do PDF não suporta", () => {
    expect(pdfSafe("original 12:19 → 12:19")).toBe("original 12:19 -> 12:19");
    expect(pdfSafe("Saldo (trabalhadas − previstas)")).toBe("Saldo (trabalhadas - previstas)");
    expect(pdfSafe("Esqueci 😀 — não marquei “ok” • ç")).toBe("Esqueci  — não marquei “ok” • ç");
    expect(pdfSafe("linha1\nlinha2")).toBe("linha1 linha2");
  });
  it("gera o PDF com ajustes e texto especial", async () => {
    const adj = { originalType: "missing", originalTime: "2026-10-07T15:19:00Z", justification: "Esqueci → depois 😀", reviewedBy: "Ivan" };
    const ev = (id: number, type: any, time: string, extra: any = {}) => ({ id, type, time, receivedAt: time, synced: true, ...extra });
    const report = buildMirror({ events: [ev(1, "clock_in", "2026-10-07T11:00:00Z"), ev(2, "break_start", "2026-10-07T15:19:00Z", { adjustment: adj }), ev(3, "clock_out", "2026-10-07T21:00:00Z")], from: "2026-10-01", to: "2026-10-31" });
    const blob = await buildMirrorPdf({
      company: { name: "Empresa", legal: null }, generatedAt: "2026-11-05T10:00:00Z", timeZone: "America/Sao_Paulo",
      results: [{ member: { id: 1, name: "Testador", role: "promoter", employeeCode: null }, labor: null, report }],
    });
    expect(blob.size).toBeGreaterThan(1000);
  });
});
