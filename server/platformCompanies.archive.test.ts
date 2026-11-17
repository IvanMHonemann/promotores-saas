import { describe, expect, it } from "vitest";
import { purgeBlockedByTimeClock } from "./platformCompanies";

describe("guarda da exclusão definitiva de empresa", () => {
  it("libera exclusão definitiva quando não há marcações de ponto", () => {
    expect(purgeBlockedByTimeClock(0)).toBeNull();
    expect(purgeBlockedByTimeClock(-1)).toBeNull();
  });

  it("bloqueia exclusão definitiva se ainda houver marcações (Portaria 671 / CLT)", () => {
    const one = purgeBlockedByTimeClock(1);
    expect(one).toMatch(/1 marcação de ponto/);
    expect(one).toMatch(/5 anos/);
    expect(one).toMatch(/bloqueada/);
    const many = purgeBlockedByTimeClock(12);
    expect(many).toMatch(/12 marcações de ponto/);
    expect(many).not.toMatch(/1 marcação de ponto/);
  });
});
