/**
 * Fila offline de fotos.
 * Guarda a foto (base64) localmente e sincroniza ao voltar online.
 */

const KEY = "gondup:photo-queue";

export type QueuedPhoto = {
  id: string;
  /** Ausente = foto sem loja ("Sem loja vinculada"). */
  storeId?: number;
  storeClientId?: number;
  visitId?: number;
  capturedAt: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  locationStatus: string;
  imageBase64: string;
  mimeType: string;
  idempotencyKey: string;
  queuedAt: string;
};

function load(): QueuedPhoto[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: QueuedPhoto[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch (e) {
    console.warn("Fila de fotos cheia", e);
  }
}

export function enqueuePhoto(photo: Omit<QueuedPhoto, "id" | "queuedAt">): QueuedPhoto {
  const item: QueuedPhoto = { ...photo, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  const items = load();
  items.push(item);
  save(items);
  return item;
}

export function listPhotos(): QueuedPhoto[] {
  return load();
}

export function removePhoto(id: string) {
  save(load().filter((p) => p.id !== id));
}

export function photoCount(): number {
  return load().length;
}
