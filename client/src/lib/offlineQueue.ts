/**
 * Fila offline de batidas de ponto.
 * Guarda localmente quando não há rede e sincroniza ao voltar online.
 */

const KEY = "gondup:punch-queue";

export type QueuedPunch = {
  id: string;
  eventType: "clock_in" | "break_start" | "break_end" | "clock_out";
  timeZone: string;
  deviceTime: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationStatus: string;
  deviceInfo?: string;
  idempotencyKey: string;
  queuedAt: string;
};

function load(): QueuedPunch[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedPunch[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function enqueue(punch: Omit<QueuedPunch, "id" | "queuedAt">): QueuedPunch {
  const item: QueuedPunch = { ...punch, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  const items = load();
  items.push(item);
  save(items);
  return item;
}

export function list(): QueuedPunch[] {
  return load();
}

export function remove(id: string) {
  save(load().filter((p) => p.id !== id));
}

export function clear() {
  localStorage.removeItem(KEY);
}

export function isOnline(): boolean {
  return navigator.onLine;
}
