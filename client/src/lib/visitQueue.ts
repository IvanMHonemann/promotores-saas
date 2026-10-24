/**
 * Fila offline de check-in/check-out de visitas.
 * Suporta tanto o fluxo antigo (base64) quanto o novo (blob → base64 quando offline).
 */

const KEY = "gondup:visit-queue";

export type QueuedVisit = {
  id: string;
  action: "start" | "complete";
  visitId: number;
  storeId: number;
  storeName: string;
  photoBase64: string;           // sempre base64 para persistir no localStorage
  mimeType: string;
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
  const entry: QueuedVisit = {
    ...item,
    id: crypto.randomUUID(),
    queuedAt: new Date().toISOString(),
  };
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

/** Converte Blob para base64 (usado apenas no modo offline) */
export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
