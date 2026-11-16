import { describe, expect, it } from "vitest";
import { LEGAL_TEXT_VERSION } from "./legalTexts";
import { latestAcceptanceByCompany, termsAcceptanceLabel, termsAcceptanceSummary } from "./legalOverview";

const day = (v: unknown) => (v ? "16/11/2026" : "—");

describe("resumo do aceite dos termos na lista de empresas", () => {
  it("escolhe o aceite mais recente de cada empresa", () => {
    const map = latestAcceptanceByCompany([
      { companyId: 1, version: "0.9", acceptedAt: "2026-11-01T12:00:00Z", acceptedByName: "Antigo" },
      { companyId: 1, version: "1.0", acceptedAt: "2026-11-16T12:00:00Z", acceptedByName: "Ivan" },
      { companyId: 2, version: "1.0", acceptedAt: "2026-11-16T10:00:00Z", acceptedByName: "Ana" },
    ]);
    expect(map.get(1)?.version).toBe("1.0");
    expect(map.get(1)?.acceptedByName).toBe("Ivan");
    expect(map.get(2)?.acceptedByName).toBe("Ana");
  });

  it("marca pendente, atual e desatualizado", () => {
    expect(termsAcceptanceLabel(termsAcceptanceSummary(undefined), day)).toBe("Termos pendentes");
    expect(termsAcceptanceLabel(termsAcceptanceSummary({
      companyId: 1, version: LEGAL_TEXT_VERSION, acceptedAt: "2026-11-16", acceptedByName: "Ivan",
    }), day)).toBe("Termos 1.0 aceitos em 16/11/2026 por Ivan");
    expect(termsAcceptanceLabel(termsAcceptanceSummary({
      companyId: 1, version: "0.9", acceptedAt: "2026-11-01", acceptedByName: "Ivan",
    }), day)).toBe("Termos desatualizados (aceitou 0.9 em 16/11/2026 por Ivan)");
  });
});
