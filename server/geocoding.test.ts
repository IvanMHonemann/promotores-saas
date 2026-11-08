import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeAddress, reverseGeocodeBr, __clearBrGeocodeCacheForTests } from "./geocoding";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  __clearBrGeocodeCacheForTests();
});

describe("reverseGeocodeAddress", () => {
  it("não chama nenhum serviço externo quando a chave não está configurada", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await reverseGeocodeAddress(-19.87654, -43.98765);

    expect(result).toEqual({ address: null, configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("consulta apenas coordenadas e reutiliza o endereço em cache", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "test-only-key");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [{ formatted: "Rua de Teste, Belo Horizonte, MG" }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const first = await reverseGeocodeAddress(-19.81234, -43.91234);
    const second = await reverseGeocodeAddress(-19.81234, -43.91234);

    expect(first).toEqual({ address: "Rua de Teste, Belo Horizonte, MG", configured: true });
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.hostname).toBe("api.geoapify.com");
    expect(requestUrl.searchParams.get("lat")).toBe("-19.81234");
    expect(requestUrl.searchParams.get("lon")).toBe("-43.91234");
    expect([...requestUrl.searchParams.keys()].sort()).toEqual(["apiKey", "format", "lang", "lat", "limit", "lon"]);
  });
});

describe("reverseGeocodeBr", () => {
  it("enriquece Nominatim sem rua com Photon + ViaCEP (caso Sapiranga do carimbo)", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("nominatim.openstreetmap.org")) {
        return new Response(JSON.stringify({
          address: {
            city_district: "Sapiranga",
            town: "Sapiranga",
            state: "Rio Grande do Sul",
            "ISO3166-2-lvl4": "BR-RS",
            postcode: "93819-700",
            country: "Brasil",
            country_code: "br",
          },
          display_name: "Sapiranga, Rio Grande do Sul, 93819-700, Brasil",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("photon.komoot.io")) {
        return new Response(JSON.stringify({
          features: [{
            properties: {
              name: "Rua Victor Hugo",
              type: "street",
              city: "Sapiranga",
              state: "Rio Grande do Sul",
              postcode: "93800-048",
              countrycode: "BR",
            },
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("viacep.com.br")) {
        return new Response(JSON.stringify({
          cep: "93819-700",
          logradouro: "Rua Martin Berg",
          bairro: "São Jacó",
          localidade: "Sapiranga",
          uf: "RS",
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });

    const address = await reverseGeocodeBr(-29.642, -51.008, fetchMock as unknown as typeof fetch);
    expect(address).toBe("Rua Martin Berg - São Jacó, Sapiranga-RS, CEP 93819-700");

    const hosts = fetchMock.mock.calls.map((c) => new URL(String(c[0])).hostname);
    expect(hosts).toContain("nominatim.openstreetmap.org");
    expect(hosts).toContain("photon.komoot.io");
    expect(hosts).toContain("viacep.com.br");
  });

  it("quando Nominatim já traz rua, só busca bairro no ViaCEP se faltar", async () => {
    vi.stubEnv("GEOAPIFY_API_KEY", "");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("nominatim.openstreetmap.org")) {
        return new Response(JSON.stringify({
          address: {
            road: "Avenida João Corrêa",
            house_number: "222",
            city_district: "Sapiranga",
            town: "Sapiranga",
            state: "Rio Grande do Sul",
            "ISO3166-2-lvl4": "BR-RS",
            postcode: "93800-000",
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.includes("photon.komoot.io")) {
        return new Response(JSON.stringify({ features: [] }), { status: 200 });
      }
      if (url.includes("viacep.com.br")) {
        return new Response(JSON.stringify({
          cep: "93800-000",
          logradouro: "Avenida João Corrêa",
          bairro: "Centro",
          localidade: "Sapiranga",
          uf: "RS",
        }), { status: 200 });
      }
      return new Response("x", { status: 404 });
    });

    const address = await reverseGeocodeBr(-29.63438, -51.00133, fetchMock as unknown as typeof fetch);
    expect(address).toBe("Avenida João Corrêa, 222 - Centro, Sapiranga-RS, CEP 93800-000");
  });
});
