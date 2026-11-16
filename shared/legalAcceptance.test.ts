import { describe, expect, it } from "vitest";
import { LEGAL_TEXT_VERSION } from "./legalTexts";
import { legalEffectiveDateLabel, legalVersionHeadline, needsLegalAcceptance } from "./legalAcceptance";

describe("versão e aceite dos termos", () => {
  it("mostra a versão 1.0 e a data de vigência em português", () => {
    expect(LEGAL_TEXT_VERSION).toBe("1.0");
    expect(legalEffectiveDateLabel("2026-11-16")).toBe("16/11/2026");
    expect(legalVersionHeadline()).toBe("Versão 1.0 — vigente desde 16/11/2026");
  });

  it("pede aceite de novo quando a versão muda ou ainda não houve aceite", () => {
    expect(needsLegalAcceptance(null)).toBe(true);
    expect(needsLegalAcceptance("1.0", "1.0")).toBe(false);
    expect(needsLegalAcceptance("1.0", "1.1")).toBe(true);
  });
});
