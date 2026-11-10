import { describe, expect, it } from "vitest";
import { distanceMeters, farFromStore, formatDistance, parseLatLngText, FAR_FROM_STORE_METERS } from "@shared/geo";

const sapiranga = { lat: -29.6386, lng: -51.0047 };
const portoAlegre = { lat: -30.0346, lng: -51.2177 };

describe("distanceMeters", () => {
  it("é zero no mesmo ponto", () => expect(distanceMeters(sapiranga, sapiranga)).toBe(0));
  it("Sapiranga → Porto Alegre ≈ 48 km", () => {
    const d = distanceMeters(sapiranga, portoAlegre);
    expect(d).toBeGreaterThan(46_000);
    expect(d).toBeLessThan(50_000);
  });
  it("0,001° de latitude ≈ 111 m", () => {
    const d = distanceMeters({ lat: -29.6, lng: -51 }, { lat: -29.601, lng: -51 });
    expect(Math.round(d)).toBeGreaterThan(105);
    expect(Math.round(d)).toBeLessThan(115);
  });
});

describe("farFromStore (aviso, nunca bloqueio)", () => {
  const store = { latitude: sapiranga.lat, longitude: sapiranga.lng };
  it("limite padrão é 500 m", () => expect(FAR_FROM_STORE_METERS).toBe(500));
  it("longe → devolve a distância", () => {
    expect(farFromStore(store, { ...portoAlegre, accuracy: 15 })).toBeGreaterThan(40_000);
  });
  it("perto (≈ 330 m) → sem aviso", () => {
    expect(farFromStore(store, { lat: sapiranga.lat - 0.003, lng: sapiranga.lng, accuracy: 10 })).toBeNull();
  });
  it("≈ 670 m com GPS bom → avisa", () => {
    expect(farFromStore(store, { lat: sapiranga.lat - 0.006, lng: sapiranga.lng, accuracy: 20 })).not.toBeNull();
  });
  it("≈ 670 m com GPS impreciso (300 m) → não avisa", () => {
    expect(farFromStore(store, { lat: sapiranga.lat - 0.006, lng: sapiranga.lng, accuracy: 300 })).toBeNull();
  });
  it("GPS péssimo não esconde 48 km", () => {
    expect(farFromStore(store, { ...portoAlegre, accuracy: 50_000 })).not.toBeNull();
  });
  it("sem GPS, sem localização da loja ou coordenada inválida → sem aviso", () => {
    expect(farFromStore(store, null)).toBeNull();
    expect(farFromStore({ latitude: null, longitude: null }, portoAlegre)).toBeNull();
    expect(farFromStore(null, portoAlegre)).toBeNull();
    expect(farFromStore({ latitude: 0, longitude: 0 }, portoAlegre)).toBeNull();
    expect(farFromStore(store, { lat: undefined, lng: undefined })).toBeNull();
  });
});

describe("formatDistance", () => {
  it("metros e km em pt-BR", () => {
    expect(formatDistance(648)).toBe("cerca de 650 m");
    expect(formatDistance(1234)).toBe("cerca de 1,2 km");
    expect(formatDistance(47_812)).toBe("cerca de 48 km");
  });
});

describe("parseLatLngText", () => {
  it("aceita o formato do Google Maps", () => expect(parseLatLngText("-29.6386, -51.0047")).toEqual(sapiranga));
  it("vazio remove", () => expect(parseLatLngText("  ")).toBeNull());
  it("inválido", () => {
    expect(parseLatLngText("abc")).toBeUndefined();
    expect(parseLatLngText("-129.6, -51")).toBeUndefined();
  });
});
