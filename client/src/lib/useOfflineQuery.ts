import { useEffect, useState } from "react";
import { cacheGet, cacheSet, isOnline } from "./offlineCache";

/**
 * Wrapper para queries tRPC com fallback offline.
 * Online: usa a query normal e salva no cache.
 * Offline: devolve o cache se existir.
 */
export function useOfflineQuery<T>(
  query: { data: T | undefined; isLoading: boolean; isError: boolean; refetch: () => void },
  cacheKey: string,
) {
  const [cached, setCached] = useState<T | null>(() => cacheGet<T>(cacheKey));
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (query.data) {
      cacheSet(cacheKey, query.data);
      setCached(query.data);
      setFromCache(false);
    }
  }, [query.data, cacheKey]);

  useEffect(() => {
    if (!isOnline() && !query.data && cached) {
      setFromCache(true);
    }
  }, [query.data, cached]);

  const data = query.data ?? cached ?? undefined;
  const isLoading = query.isLoading && !data;
  const isError = query.isError && !data;

  return { data, isLoading, isError, fromCache, refetch: query.refetch };
}
