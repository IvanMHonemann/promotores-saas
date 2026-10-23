import { useSyncExternalStore } from "react";
import { isOnline } from "@/lib/connectivity";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); };
}

/**
 * true quando o aparelho está online E o servidor responde.
 * Reage aos eventos online/offline, inclusive os disparados pelo app quando uma
 * requisição estoura o tempo (sinal fraco com navigator.onLine ainda true).
 */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, isOnline, () => true);
}
