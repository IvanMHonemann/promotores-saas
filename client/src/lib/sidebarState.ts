import { useSyncExternalStore } from "react";

/** Estado "menu lateral recolhido" (persistido). Em telas largas o menu fica fixo; recolhido, o conteúdo ocupa toda a largura. */
const KEY = "promotores:sidebar-collapsed";
const listeners = new Set<() => void>();

function read(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setSidebarCollapsed(value: boolean) {
  try { localStorage.setItem(KEY, value ? "1" : "0"); } catch { /* modo privado */ }
  listeners.forEach((fn) => fn());
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    read,
    () => false,
  );
}
