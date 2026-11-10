/**
 * Distância entre o GPS do promotor e a loja (check-in).
 * Só AVISA quando está longe; nunca bloqueia o check-in.
 */

/** Acima disso (descontada a imprecisão do GPS) o check-in mostra o aviso. */
export const FAR_FROM_STORE_METERS = 500;
/** Imprecisão máxima do GPS que descontamos (GPS muito ruim não deve "esconder" distâncias enormes). */
const MAX_ACCURACY_DISCOUNT_METERS = 1_000;

export type LatLng = { lat: number; lng: number };

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

/** Distância em metros (fórmula de haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Retorna a distância (m) quando o promotor parece estar longe da loja; null quando não há o que avisar
 * (sem GPS, loja sem localização, ou perto o suficiente).
 */
export function farFromStore(
  store: { latitude?: number | null; longitude?: number | null } | null | undefined,
  gps: { lat?: number | null; lng?: number | null; accuracy?: number | null } | null | undefined,
  threshold = FAR_FROM_STORE_METERS,
): number | null {
  if (!store || !gps || !isValidLatLng(store.latitude, store.longitude) || !isValidLatLng(gps.lat, gps.lng)) return null;
  const d = distanceMeters({ lat: store.latitude as number, lng: store.longitude as number }, { lat: gps.lat as number, lng: gps.lng as number });
  const acc = typeof gps.accuracy === "number" && Number.isFinite(gps.accuracy) && gps.accuracy > 0 ? Math.min(gps.accuracy, MAX_ACCURACY_DISCOUNT_METERS) : 0;
  return d - acc > threshold ? d : null;
}

/** "cerca de 650 m" / "cerca de 1,2 km" / "cerca de 45 km". */
export function formatDistance(meters: number): string {
  if (meters < 1_000) return `cerca de ${Math.max(10, Math.round(meters / 10) * 10)} m`;
  if (meters < 10_000) return `cerca de ${(Math.round(meters / 100) / 10).toLocaleString("pt-BR")} km`;
  return `cerca de ${Math.round(meters / 1_000).toLocaleString("pt-BR")} km`;
}

/** Aceita "-29.6386, -51.0047" (como o Google Maps copia). Vazio = null (remover). Inválido = undefined. */
export function parseLatLngText(text: string): LatLng | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return undefined;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return isValidLatLng(lat, lng) ? { lat, lng } : undefined;
}
