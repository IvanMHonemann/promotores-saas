import { describe, expect, it } from "vitest";
import {
  addressHasStreet,
  formatBrAddress,
  mergeAddressParts,
  pickStampLocation,
  stateToUf,
  wrapText,
} from "../shared/address";

describe("endereço legível", () => {
  it("monta rua, número, bairro, cidade-UF e CEP", () => {
    expect(formatBrAddress({
      road: "Avenida Ipiranga", house_number: "1234", suburb: "Partenon",
      city: "Porto Alegre", state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "90610000",
    })).toBe("Avenida Ipiranga, 1234 - Partenon, Porto Alegre-RS, CEP 90610-000");
  });

  it("funciona sem número/CEP e com cidade pequena", () => {
    expect(formatBrAddress({ road: "Rua A", town: "Canela", state: "Rio Grande do Sul" })).toBe("Rua A, Canela-RS");
    expect(formatBrAddress({ city: "São Paulo", state: "São Paulo" })).toBe("São Paulo-SP");
  });

  it("não usa city_district como bairro quando é o nome da cidade (caso Sapiranga)", () => {
    expect(formatBrAddress({
      road: "Avenida João Corrêa", house_number: "222",
      city_district: "Sapiranga", town: "Sapiranga",
      state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "93800-000",
    })).toBe("Avenida João Corrêa, 222, Sapiranga-RS, CEP 93800-000");
  });

  it("reproduz o carimbo incompleto (só cidade+CEP) quando o Nominatim não traz rua", () => {
    expect(formatBrAddress({
      city_district: "Sapiranga", town: "Sapiranga",
      state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "93819-700",
    })).toBe("Sapiranga-RS, CEP 93819-700");
    expect(addressHasStreet("Sapiranga-RS, CEP 93819-700")).toBe(false);
  });

  it("marca rua aproximada (Photon) como 'próximo a'", () => {
    expect(formatBrAddress({
      road: "Rua Victor Hugo", approximateStreet: true,
      town: "Sapiranga", state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "93800-048",
    })).toBe("próximo a Rua Victor Hugo, Sapiranga-RS, CEP 93800-048");
    expect(addressHasStreet("próximo a Rua Victor Hugo, Sapiranga-RS, CEP 93800-048")).toBe(true);
  });

  it("ViaCEP preenche rua e bairro sobre o resultado incompleto do Nominatim", () => {
    const merged = mergeAddressParts(
      { city_district: "Sapiranga", town: "Sapiranga", state: "Rio Grande do Sul", "ISO3166-2-lvl4": "BR-RS", postcode: "93819-700" },
      { road: "Rua Martin Berg", suburb: "São Jacó", city: "Sapiranga", state: "RS", postcode: "93819-700" },
    );
    expect(formatBrAddress(merged)).toBe("Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700");
  });

  it("ViaCEP substitui rua aproximada do Photon", () => {
    const merged = mergeAddressParts(
      { road: "Rua Victor Hugo", approximateStreet: true, town: "Sapiranga", state: "Rio Grande do Sul", postcode: "93800-102" },
      { road: "Rodovia RS-239", suburb: "Centro", city: "Sapiranga", state: "RS", postcode: "93800-102", approximateStreet: false },
    );
    expect(merged.approximateStreet).toBeFalsy();
    expect(formatBrAddress(merged)).toBe("Rodovia RS-239 - Centro, Sapiranga-RS, CEP 93800-102");
  });

  it("cai para display_name quando não há detalhes", () => {
    expect(formatBrAddress(undefined, "Algum lugar")).toBe("Algum lugar");
    expect(formatBrAddress({}, "X")).toBe("X");
    expect(stateToUf("Paraná")).toBe("PR");
  });

  it("quebra o carimbo em linhas que cabem na foto", () => {
    const lines = wrapText("Local: Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700", 28, (s) => s.length);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((l) => l.length <= 28 || !l.includes(" "))).toBe(true);
    expect(lines.join(" ")).toBe("Local: Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700");
  });

  it("pickStampLocation prefere GPS completo; senão endereço da loja", () => {
    expect(pickStampLocation({
      geocoded: "Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700",
      storeAddress: "Av. cadastrada, 100",
      coordsFallback: "GPS 0,0",
    })).toBe("Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700");

    expect(pickStampLocation({
      geocoded: "Sapiranga-RS, CEP 93819-700",
      storeAddress: "Rua Martin Berg, 371 - São Jacó",
      coordsFallback: "GPS 0,0",
    })).toBe("Rua Martin Berg, 371 - São Jacó");

    expect(pickStampLocation({
      geocoded: null,
      storeAddress: null,
      coordsFallback: "GPS -29.63800, -51.00600",
    })).toBe("GPS -29.63800, -51.00600");
  });
});

describe("lotes de compartilhamento", () => {
  it("divide em lotes", async () => {
    const { splitShareBatches } = await import("../client/src/lib/shareFiles");
    expect(splitShareBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitShareBatches([1], 10)).toEqual([[1]]);
  });
});
