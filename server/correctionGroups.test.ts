import { describe, expect, it } from "vitest";
import { formatGroupedCorrectionTitle, groupCorrectionItems, defaultCorrectionJustification, justificationRequiresText } from "../shared/correctionGroups";
import { looksLikeFullDayExcuse, fullDayExcuseLabel, inferFullDayExcuseType } from "../shared/correctionExcuse";

describe("correctionGroups", () => {
  const mk = (id: number, type: string, time: string, status = "pending", timeEventId: number | null = null) => ({
    request: { id, memberAccountId: 1, requestedType: type, requestedTime: time, status, timeEventId, justificationType: "normal", justification: "Esquecimento" },
  });

  it("agrupa inclusões do mesmo dia/status", () => {
    const items = [
      mk(1, "clock_in", "2026-11-02T10:00:00.000Z"),
      mk(2, "break_start", "2026-11-02T15:00:00.000Z"),
      mk(3, "clock_out", "2026-11-02T20:00:00.000Z"),
      mk(4, "clock_in", "2026-11-03T10:00:00.000Z"),
    ];
    const groups = groupCorrectionItems(items, { isExcuse: looksLikeFullDayExcuse, includeMember: true });
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(3);
    const title = formatGroupedCorrectionTitle(groups[0], {
      isExcuse: looksLikeFullDayExcuse,
      excuseLabel: (r) => fullDayExcuseLabel(inferFullDayExcuseType(r)!),
    });
    expect(title).toMatch(/02\/11\/2026/);
    expect(title).toContain("Entrada");
    expect(title).toContain("inclusão");
  });

  it("justificativa: Outro exige texto; Esquecimento tem default", () => {
    expect(justificationRequiresText("other")).toBe(true);
    expect(justificationRequiresText("normal")).toBe(false);
    expect(defaultCorrectionJustification({ justificationType: "normal", timeEventId: null })).toBe("Esquecimento");
    expect(defaultCorrectionJustification({ justificationType: "normal", timeEventId: 9 })).toBe("Horário incorreto");
    expect(defaultCorrectionJustification({ justificationType: "other" })).toBe("");
  });
});
