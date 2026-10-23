/**
 * Fila offline de check-in/check-out de visitas.
 * Guarda a ação e a foto da fachada para sincronizar depois.
 */

const KEY = "gondup:visit-queue";

export type QueuedVisit = {
  id: string;
  action: "start" | "complete";
  visitId: number;
  storeId: number;
  storeName: string;
  photoBase64: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  notes?: string;
  queuedAt: string;
};

function load(): QueuedVisit[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedVisit[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Fila de visitas cheia", e);
  }
}

export function enqueueVisit(item: Omit<QueuedVisit, "id" | "queuedAt">): QueuedVisit {
  const entry: QueuedVisit = { ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  const items = load();
  items.push(entry);
  save(items);
  return entry;
}

export function listVisits(): QueuedVisit[] {
  return load();
}

export function removeVisit(id: string) {
  save(load().filter((v) => v.id !== id));
}

export function visitCount(): number {
  return load().length;
}
