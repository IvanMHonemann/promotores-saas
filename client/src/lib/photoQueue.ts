/**
 * Fila offline de fotos.
 * Guarda a foto (base64) localmente e sincroniza ao voltar online.
 */

const KEY = "gondup:photo-queue";

export type QueuedPhoto = {
  id: string;
  storeId: number;
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

function save(items: QueuedPhoto[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch (e) {
    console.warn("Fila de fotos cheia", e);
    return false;
  }
}

export function enqueuePhoto(photo: Omit<QueuedPhoto, "id" | "queuedAt">): QueuedPhoto {
  const item: QueuedPhoto = { ...photo, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  const items = load();
  items.push(item);
  if (!save(items)) throw new Error("Sem espaço para guardar a foto offline neste aparelho.");
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
