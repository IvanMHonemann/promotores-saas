import { beforeEach, describe, expect, it, vi } from "vitest";
import { geocodeStoreAddress, splitStreetNumber, __clearStoreGeocodeCacheForTests } from "./geocoding";

beforeEach(() => __clearStoreGeocodeCacheForTests());

const json = (body: unknown) => ({ ok: true, json: async () => body }) as Response;

describe("splitStreetNumber", () => {
  it("rua, número", () => expect(splitStreetNumber("rua Vicente celestino, 46")).toEqual({ street: "rua Vicente celestino", number: "46" }));
  it("número no fim e bairro depois do traço", () => expect(splitStreetNumber("Av. Mauá 1234 - Centro")).toEqual({ street: "Av. Mauá", number: "1234" }));
  it("nº", () => expect(splitStreetNumber("Rua 7 de Setembro nº 766")).toEqual({ street: "Rua 7 de Setembro", number: "766" }));
  it("sem número claro → null", () => {
    expect(splitStreetNumber("Centro")).toBeNull();
    expect(splitStreetNumber("Av.Maua")).toBeNull();
    expect(splitStreetNumber("Rua 7 de Setembro")).toBeNull();
    expect(splitStreetNumber(null)).toBeNull();
  });
});

describe("geocodeStoreAddress", () => {
  it("aceita só resultado com o mesmo número e cidade", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("nominatim") && url.includes("street=")) {
        return json([
          { lat: "-23.5", lon: "-47.4", address: { house_number: "766", city: "Sorocaba" } },
          { lat: "-29.6431", lon: "-51.0069", address: { house_number: "766", city: "Sapiranga" } },
        ]);
      }
      return json([]);
    });
    const r = await geocodeStoreAddress({ address: "Rua 7 de Setembro, 766", city: "SAPIRANGA" }, fetchMock as unknown as typeof fetch);
    expect(r).toEqual({ latitude: -29.6431, longitude: -51.0069, source: "nominatim" });
  });

  it("rua certa mas número diferente → não grava (evita aviso falso)", async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes("photon")
      ? json({ features: [{ geometry: { coordinates: [-51.0, -29.6] }, properties: { countrycode: "BR", city: "Sapiranga" } }] })
      : json([{ lat: "-29.63", lon: "-51.0", address: { city: "Sapiranga" } }]));
    expect(await geocodeStoreAddress({ address: "Av. Mauá, 1234", city: "Sapiranga" }, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("endereço vago nem consulta", async () => {
    const fetchMock = vi.fn();
    expect(await geocodeStoreAddress({ address: "Centro", city: "Sapiranga" }, fetchMock as unknown as typeof fetch)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Photon de reserva, só Brasil", async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes("photon")
      ? json({ features: [
          { geometry: { coordinates: [-47.4, -23.5] }, properties: { countrycode: "PT", housenumber: "46", city: "Sapiranga" } },
          { geometry: { coordinates: [-51.01, -29.64] }, properties: { countrycode: "BR", housenumber: "46", city: "Sapiranga" } },
        ] })
      : json([]));
    expect(await geocodeStoreAddress({ address: "rua Vicente celestino, 46", city: "Sapiranga" }, fetchMock as unknown as typeof fetch)).toEqual({ latitude: -29.64, longitude: -51.01, source: "photon" });
  });

  it("falha de rede não quebra: devolve null", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("offline"); });
    expect(await geocodeStoreAddress({ address: "rua X, 10", city: "Sapiranga" }, fetchMock as unknown as typeof fetch)).toBeNull();
  });
});
