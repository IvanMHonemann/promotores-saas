import { describe, expect, it } from "vitest";
import { capitalizePt, formatDatePT, formatMonthYearPT, maskDatePT, parseDatePT } from "./ptBrDate";

describe("datas em português", () => {
  it("formata mês e ano sem depender do idioma do ambiente", () => {
    expect(formatMonthYearPT("2026-11")).toBe("novembro de 2026");
    expect(formatMonthYearPT("2026-10", true)).toBe("Outubro de 2026");
    expect(capitalizePt("janeiro")).toBe("Janeiro");
  });

  it("converte e valida dd/mm/aaaa", () => {
    expect(formatDatePT("2026-11-15")).toBe("15/11/2026");
    expect(parseDatePT("15/11/2026")).toBe("2026-11-15");
    expect(parseDatePT("15112026")).toBe("2026-11-15");
    expect(parseDatePT("31/04/2026")).toBeNull();
    expect(parseDatePT("15/11")).toBeNull();
    expect(maskDatePT("15112026")).toBe("15/11/2026");
  });
});
