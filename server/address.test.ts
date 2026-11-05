import { describe, expect, it } from "vitest";
import { formatBrAddress, stateToUf, wrapText } from "../shared/address";

describe("endereço legível", () => {
  it("monta rua, número, bairro, cidade-UF e CEP", () => {
    expect(formatBrAddress({ road: "Avenida Ipiranga", house_number: "1234", suburb: "Partenon", city: "Porto Alegre", state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "90610000" }))
      .toBe("Avenida Ipiranga, 1234 - Partenon, Porto Alegre-RS, CEP 90610-000");
  });
  it("funciona sem número/CEP e com cidade pequena", () => {
    expect(formatBrAddress({ road: "Rua A", town: "Canela", state: "Rio Grande do Sul" })).toBe("Rua A, Canela-RS");
    expect(formatBrAddress({ city: "São Paulo", state: "São Paulo" })).toBe("São Paulo-SP");
  });
  it("cai para display_name quando não há detalhes", () => {
    expect(formatBrAddress(undefined, "Algum lugar")).toBe("Algum lugar");
    expect(formatBrAddress({}, "X")).toBe("X");
    expect(stateToUf("Paraná")).toBe("PR");
  });
  it("quebra o carimbo em linhas que cabem na foto", () => {
    const lines = wrapText("Local: Avenida Ipiranga, 1234 - Partenon, Porto Alegre-RS", 20, (s) => s.length);
    expect(lines.every((l) => l.length <= 20 || !l.includes(" "))).toBe(true);
    expect(lines.join(" ")).toBe("Local: Avenida Ipiranga, 1234 - Partenon, Porto Alegre-RS");
  });
});
describe("lotes de compartilhamento", () => {
  it("divide em lotes", async () => {
    const { splitShareBatches } = await import("../client/src/lib/shareFiles");
    expect(splitShareBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitShareBatches([1], 10)).toEqual([[1]]);
  });
});
