/**
 * Cache offline de leitura para lojas, produtos e roteiros.
 * Salva a última resposta e devolve quando offline.
 */

const PREFIX = "gondup:cache:";

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, at } = JSON.parse(raw);
    // Expira em 7 dias
    if (Date.now() - at > 7 * 86400000) return null;
    return data as T;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, at: Date.now() }));
  } catch { /* quota */ }
}

export function isOnline(): boolean {
  return navigator.onLine;
}
