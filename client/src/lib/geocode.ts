import { createTRPCClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../../server/routers";
import { formatBrAddress } from "@shared/address";
import { authFetch } from "./authFetch";

const client = createTRPCClient<AppRouter>({ links: [httpLink({ url: "/api/trpc", transformer: superjson, fetch: authFetch as any })] });
/** v4: invalida caches antigos que só tinham "Cidade-UF, CEP …" sem rua/bairro. */
const CACHE_KEY = "gondup:geocode:v4";
const memory = new Map<string, Promise<string | null>>();

function cacheGet(key: string): string | null {
  try { return (JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, string>)[key] ?? null; } catch { return null; }
}
function cacheSet(key: string, value: string) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") as Record<string, string>;
    const keys = Object.keys(all);
    if (keys.length > 300) delete all[keys[0]];
    all[key] = value;
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch { /* sem espaço: segue sem cache */ }
}

async function viaBrowser(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR`;
  const res = await fetch(url, { signal: AbortSignal.timeout?.(5000), headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const data = await res.json();
  return formatBrAddress(data.address, data.display_name);
}

/**
 * Endereço completo (rua, nº, bairro, cidade-UF, CEP). Primeiro pelo servidor (Nominatim +
 * Photon + ViaCEP/BrasilAPI, cache e User-Agent identificado), depois direto do aparelho.
 * null se nada funcionar.
 */
export function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached) return Promise.resolve(cached);
  const pending = memory.get(key);
  if (pending) return pending;
  const run = (async () => {
    let address: string | null = null;
    try {
      address = (await Promise.race([
        client.geo.reverse.mutate({ latitude: lat, longitude: lng }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 12000)),
      ])).address;
    } catch { /* offline ou servidor lento: tenta no aparelho */ }
    if (!address) { try { address = await viaBrowser(lat, lng); } catch { /* sem internet */ } }
    if (address) cacheSet(key, address);
    memory.delete(key);
    return address;
  })();
  memory.set(key, run);
  return run;
}
