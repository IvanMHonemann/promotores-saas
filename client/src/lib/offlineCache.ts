/**
 * Cache de leitura para abrir as telas sem internet (roteiro do dia, lojas, clientes, últimas batidas...).
 * Guardado no IndexedDB (cabe muito mais que o localStorage) com cópia em memória para leitura síncrona.
 * Chame hydrateOfflineCache() antes de montar o app.
 */
import { CACHE, idbAvailable, idbGetAll, idbPut, idbClear } from "./idb";

const PREFIX = "gondup:cache:";
const MAX_AGE_MS = 7 * 86400000;
type Entry = { key: string; data: unknown; at: number };
const memory = new Map<string, Entry>();
const pending = new Map<string, number>();

export async function hydrateOfflineCache(): Promise<void> {
  // Cache antigo do localStorage: migra e libera o espaço.
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(PREFIX)) continue;
      try { const { data, at } = JSON.parse(localStorage.getItem(k) || "null") || {}; if (at) memory.set(k.slice(PREFIX.length), { key: k.slice(PREFIX.length), data, at }); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  if (!idbAvailable()) return;
  try {
    const rows = await idbGetAll<Entry>(CACHE);
    for (const r of rows) { const cur = memory.get(r.key); if (!cur || cur.at < r.at) memory.set(r.key, r); }
    for (const e of memory.values()) void idbPut(CACHE, e).catch(() => undefined);
    for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) localStorage.removeItem(k); }
  } catch (e) {
    console.warn("[offlineCache] IndexedDB indisponível", e);
  }
}

export function cacheGet<T>(key: string): T | null {
  const e = memory.get(key);
  if (!e) return null;
  if (Date.now() - e.at > MAX_AGE_MS) return null;
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T) {
  const cur = memory.get(key);
  if (cur && cur.data === data) return; // mesma resposta (chamado a cada render)
  const entry = { key, data, at: Date.now() };
  memory.set(key, entry);
  if (!idbAvailable()) return;
  // Agrupa gravações da mesma chave.
  window.clearTimeout(pending.get(key));
  pending.set(key, window.setTimeout(() => { pending.delete(key); void idbPut(CACHE, memory.get(key)).catch(() => undefined); }, 300));
}

/** Logout: apaga os dados de leitura do usuário anterior. */
export async function clearOfflineCache() {
  memory.clear();
  if (idbAvailable()) await idbClear(CACHE).catch(() => undefined);
}

export function isOnline(): boolean {
  return navigator.onLine;
}
