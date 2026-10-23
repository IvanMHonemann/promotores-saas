/**
 * Fila offline de cadastro de lojas.
 * Guarda localmente e sincroniza ao voltar online.
 */

const KEY = "gondup:store-queue";

export type QueuedStore = {
  id: string;
  tempId: string;
  name: string;
  city: string;
  state?: string;
  address?: string;
  queuedAt: string;
};

function load(): QueuedStore[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedStore[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Fila de lojas cheia", e);
  }
}

export function enqueueStore(item: Omit<QueuedStore, "id" | "tempId" | "queuedAt">): QueuedStore {
  const entry: QueuedStore = {
    ...item,
    id: crypto.randomUUID(),
    tempId: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  const items = load();
  items.push(entry);
  save(items);
  return entry;
}

export function listStores(): QueuedStore[] {
  return load();
}

export function removeStore(id: string) {
  save(load().filter((s) => s.id !== id));
}

export function storeCount(): number {
  return load().length;
}
