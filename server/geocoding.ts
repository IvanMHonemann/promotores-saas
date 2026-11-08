import {
  formatBrAddress,
  formatCep,
  mergeAddressParts,
  streetFromAddress,
  bairroFromAddress,
  type NominatimAddress,
} from "@shared/address";

export type ReverseGeocodeResult = {
  address: string | null;
  configured: boolean;
};

type CacheEntry = {
  address: string | null;
  expiresAt: number;
};

type GeoapifyPayload = {
  results?: Array<{ formatted?: unknown }>;
  features?: Array<{ properties?: { formatted?: unknown } }>;
};

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 2_000;
const MIN_REQUEST_INTERVAL_MS = 250;
const addressCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

const NOMINATIM_UA = "GondUp/1.0 (https://gondup.com.br; contato@gondup.com.br)";

function coordinateKey(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function enqueueRequest<T>(request: () => Promise<T>): Promise<T> {
  const queued = requestQueue.then(async () => {
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt));
    if (waitMs > 0) await delay(waitMs);
    lastRequestStartedAt = Date.now();
    return request();
  });
  requestQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

function remember(key: string, address: string | null) {
  if (addressCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = addressCache.keys().next().value;
    if (oldestKey) addressCache.delete(oldestKey);
  }
  addressCache.set(key, { address, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function reverseGeocodeAddress(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return { address: null, configured: false };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { address: null, configured: true };
  }

  const key = coordinateKey(latitude, longitude);
  const cached = addressCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    addressCache.delete(key);
    addressCache.set(key, cached);
    return { address: cached.address, configured: true };
  }
  if (cached) addressCache.delete(key);

  let request = inFlight.get(key);
  if (!request) {
    request = enqueueRequest(async () => {
      const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("format", "json");
      url.searchParams.set("lang", "pt");
      url.searchParams.set("limit", "1");

      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        console.warn(`[geocoding] Geoapify returned HTTP ${response.status}`);
        return null;
      }
      const payload = await response.json() as GeoapifyPayload;
      const result = payload.results?.[0]?.formatted ?? payload.features?.[0]?.properties?.formatted;
      return typeof result === "string" && result.trim() ? result.trim() : null;
    });
    inFlight.set(key, request);
  }

  try {
    const address = await request;
    remember(key, address);
    return { address, configured: true };
  } catch (error) {
    console.warn("[geocoding] Geoapify reverse lookup failed", error instanceof Error ? error.name : "unknown error");
    return { address: null, configured: true };
  } finally {
    inFlight.delete(key);
  }
}


const brCache = new Map<string, CacheEntry>();
const BR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
let lastNominatimAt = 0;
let nominatimQueue: Promise<void> = Promise.resolve();

function needsEnrichment(parts: NominatimAddress): boolean {
  return !streetFromAddress(parts) || !bairroFromAddress(parts);
}

async function nominatimParts(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch,
): Promise<NominatimAddress | null> {
  const run = nominatimQueue.then(async () => {
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await delay(wait);
    lastNominatimAt = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&email=contato@gondup.com.br`;
    const res = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": NOMINATIM_UA },
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) {
      console.warn(`[geocoding] Nominatim HTTP ${res.status}`);
      return null;
    }
    const data = await res.json() as { address?: NominatimAddress; display_name?: string };
    return data.address ? { ...data.address } : null;
  });
  nominatimQueue = run.then(() => undefined, () => undefined);
  return run;
}

/** Rua nomeada mais próxima (Photon/Komoot). Sem chave; usado quando o Nominatim devolve via sem nome. */
async function photonParts(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch,
): Promise<NominatimAddress | null> {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`;
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.warn(`[geocoding] Photon HTTP ${res.status}`);
      return null;
    }
    const data = await res.json() as {
      features?: Array<{ properties?: Record<string, string | undefined> }>;
    };
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const road = p.street || (p.type === "street" ? p.name : undefined) || undefined;
    if (!road && !p.city && !p.postcode) return null;
    const out: NominatimAddress = {
      road,
      house_number: p.housenumber,
      suburb: p.district && p.district !== p.city ? p.district : undefined,
      city: p.city,
      state: p.state,
      postcode: p.postcode,
      approximateStreet: !!road, // Photon = rua próxima, não necessariamente o ponto exato
    };
    if (p.countrycode === "BR" && p.state) {
      // state já em texto; ISO opcional
    }
    return out;
  } catch (error) {
    console.warn("[geocoding] Photon falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}

async function viaCepParts(cep: string, fetchImpl: typeof fetch): Promise<NominatimAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      cep?: string;
    };
    if (data.erro || (!data.logradouro && !data.bairro && !data.localidade)) return null;
    return {
      road: data.logradouro || undefined,
      suburb: data.bairro || undefined,
      city: data.localidade || undefined,
      state: data.uf || undefined,
      postcode: data.cep || formatCep(digits),
      approximateStreet: false,
    };
  } catch (error) {
    console.warn("[geocoding] ViaCEP falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}

async function brasilApiParts(cep: string, fetchImpl: typeof fetch): Promise<NominatimAddress | null> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      street?: string;
      neighborhood?: string;
      city?: string;
      state?: string;
      cep?: string;
    };
    if (!data.street && !data.neighborhood && !data.city) return null;
    return {
      road: data.street || undefined,
      suburb: data.neighborhood || undefined,
      city: data.city || undefined,
      state: data.state || undefined,
      postcode: formatCep(data.cep || digits),
      approximateStreet: false,
    };
  } catch (error) {
    console.warn("[geocoding] BrasilAPI falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}

/**
 * Endereço brasileiro completo (rua, nº, bairro, cidade-UF, CEP) para carimbo de foto e ponto.
 * Cadeia: Nominatim → Photon (rua próxima) → ViaCEP/BrasilAPI (CEP) → Geoapify.
 * Cache de 7 dias por ~11 m; Nominatim no máx. 1 consulta/s com User-Agent identificado.
 */
export async function reverseGeocodeBr(
  latitude: number,
  longitude: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return null;
  }
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = brCache.get(key);
  if (hit && hit.expiresAt > Date.now() && hit.address) return hit.address;

  let parts: NominatimAddress = {};
  try {
    const nom = await nominatimParts(latitude, longitude, fetchImpl);
    if (nom) parts = nom;
  } catch (error) {
    console.warn("[geocoding] Nominatim falhou", error instanceof Error ? error.name : "erro");
  }

  if (needsEnrichment(parts)) {
    const photon = await photonParts(latitude, longitude, fetchImpl);
    if (photon) parts = mergeAddressParts(parts, photon);
  }

  const cep = formatCep(parts.postcode);
  if (cep && needsEnrichment(parts)) {
    const via = await viaCepParts(cep, fetchImpl);
    if (via) parts = mergeAddressParts(parts, via);
  }
  if (cep && needsEnrichment(parts)) {
    const br = await brasilApiParts(cep, fetchImpl);
    if (br) parts = mergeAddressParts(parts, br);
  }

  let address = formatBrAddress(parts);
  if (!address || !streetFromAddress(parts)) {
    // Último recurso: Geoapify (string formatada pronta)
    const geo = await reverseGeocodeAddress(latitude, longitude).catch(() => ({ address: null as string | null }));
    if (geo.address) address = geo.address;
  }

  if (address) {
    if (brCache.size >= MAX_CACHE_ENTRIES) {
      const k = brCache.keys().next().value;
      if (k) brCache.delete(k);
    }
    brCache.set(key, { address, expiresAt: Date.now() + BR_TTL_MS });
  }
  return address;
}

/** Só para testes: limpa o cache BR entre casos. */
export function __clearBrGeocodeCacheForTests() {
  brCache.clear();
  lastNominatimAt = 0;
}
