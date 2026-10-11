import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeAddress } from "./geocoding";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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
