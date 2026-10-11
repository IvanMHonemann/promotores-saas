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
