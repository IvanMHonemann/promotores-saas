/**
 * Fila offline de cadastro de clientes de loja.
 */

const KEY = "gondup:client-queue";

export type QueuedClient = {
  id: string;
  tempId: string;
  storeId: number | string;
  name: string;
  contactName?: string;
  phone?: string;
  notes?: string;
  queuedAt: string;
};

function load(): QueuedClient[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedClient[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Fila de clientes cheia", e);
  }
}

export function enqueueClient(item: Omit<QueuedClient, "id" | "tempId" | "queuedAt">): QueuedClient {
  const entry: QueuedClient = {
    ...item,
    id: crypto.randomUUID(),
    tempId: `temp-client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    queuedAt: new Date().toISOString(),
  };
  const items = load();
  items.push(entry);
  save(items);
  return entry;
}

export function listClients(): QueuedClient[] {
  return load();
}

export function removeClient(id: string) {
  save(load().filter((c) => c.id !== id));
}

export function clientCount(): number {
  return load().length;
}
