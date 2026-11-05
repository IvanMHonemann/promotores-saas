/**
 * Cache em memória por instância, com expiração curta. Usado para evitar
 * repetir as mesmas consultas (sessão, assinatura, plano) em toda requisição.
 * Cada instância serverless tem o próprio cache; por isso os TTLs são curtos.
 */
export function createTtlCache<V>(ttlMs: number, maxEntries = 500) {
  const store = new Map<string, { value: Promise<V>; expiresAt: number }>();
  return {
    get(key: string, load: () => Promise<V>): Promise<V> {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.expiresAt > now) return hit.value;
      if (store.size >= maxEntries) {
        for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
        if (store.size >= maxEntries) store.delete(store.keys().next().value as string);
      }
      const value = load();
      store.set(key, { value, expiresAt: now + ttlMs });
      // Erros não ficam em cache.
      value.catch(() => { if (store.get(key)?.value === value) store.delete(key); });
      return value;
    },
    delete(key: string) { store.delete(key); },
    clear() { store.clear(); },
  };
}
