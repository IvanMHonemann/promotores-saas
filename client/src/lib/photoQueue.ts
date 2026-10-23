/**
 * Fila offline de fotos.
 *
 * Guarda a foto (base64) no IndexedDB do aparelho e sincroniza ao voltar online.
 * O IndexedDB aguenta centenas de fotos; o localStorage antigo (~5 MB) lotava com
 * ~10 fotos e a foto era perdida sem aviso. Itens antigos do localStorage são
 * migrados automaticamente na primeira abertura.
 */

const LEGACY_KEY = "gondup:photo-queue";
const DB_NAME = "gondup-offline";
const STORE = "photos";
const CHANGE_EVENT = "gondup:photo-queue-changed";

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

let dbPromise: Promise<IDBDatabase> | null = null;
let cachedCount = 0;
let cachedByStore: Record<number, number> = {};

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB indisponível"));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB"));
  }).then(async (db) => {
    await migrateLegacy(db);
    return db;
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function tx<T>(db: IDBDatabase, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    let result: T | undefined;
    const req = fn(t.objectStore(STORE));
    if (req) req.onsuccess = () => { result = req.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error ?? new Error("Falha no IndexedDB"));
    t.onabort = () => reject(t.error ?? new Error("Operação cancelada (sem espaço no aparelho?)"));
  });
}

function loadLegacy(): QueuedPhoto[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLegacy(items: QueuedPhoto[]) {
  if (!items.length) localStorage.removeItem(LEGACY_KEY);
  else localStorage.setItem(LEGACY_KEY, JSON.stringify(items));
}

async function migrateLegacy(db: IDBDatabase) {
  const legacy = loadLegacy();
  if (!legacy.length) return;
  try {
    await tx(db, "readwrite", (store) => { legacy.forEach((item) => store.put(item)); });
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {
    console.warn("Não foi possível migrar a fila de fotos antiga", e);
  }
}

function updateCounts(items: QueuedPhoto[]) {
  cachedCount = items.length;
  cachedByStore = {};
  items.forEach((p) => { cachedByStore[p.storeId] = (cachedByStore[p.storeId] || 0) + 1; });
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Salva a foto na fila. Lança erro se o aparelho não tiver espaço (a foto NÃO foi salva). */
export async function enqueuePhoto(photo: Omit<QueuedPhoto, "id" | "queuedAt">): Promise<QueuedPhoto> {
  const item: QueuedPhoto = { ...photo, id: crypto.randomUUID(), queuedAt: new Date().toISOString() };
  try {
    const db = await openDb();
    await tx(db, "readwrite", (store) => store.put(item));
  } catch (idbError) {
    // Plano B: localStorage (pequeno, mas melhor que perder a foto).
    try {
      saveLegacy([...loadLegacy(), item]);
    } catch {
      console.warn("Fila de fotos cheia", idbError);
      throw new Error("Sem espaço no aparelho para guardar a foto offline. Conecte-se à internet para enviar as fotos pendentes.");
    }
  }
  await listPhotos(); // atualiza contadores
  return item;
}

export async function listPhotos(): Promise<QueuedPhoto[]> {
  let items: QueuedPhoto[] = [];
  try {
    const db = await openDb();
    items = ((await tx<QueuedPhoto[]>(db, "readonly", (store) => store.getAll() as IDBRequest<QueuedPhoto[]>)) || []);
  } catch {
    /* sem IndexedDB: usa só o localStorage */
  }
  const legacy = loadLegacy();
  const all = [...items, ...legacy.filter((l) => !items.some((i) => i.id === l.id))];
  all.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  updateCounts(all);
  return all;
}

export async function removePhoto(id: string) {
  try {
    const db = await openDb();
    await tx(db, "readwrite", (store) => store.delete(id));
  } catch {
    /* ignora */
  }
  const legacy = loadLegacy();
  if (legacy.some((p) => p.id === id)) {
    try { saveLegacy(legacy.filter((p) => p.id !== id)); } catch { /* ignora */ }
  }
  await listPhotos();
}

/** Quantidade de fotos aguardando envio (valor em memória, atualizado a cada operação). */
export function photoCount(): number {
  return cachedCount;
}

/** Fotos aguardando envio de uma loja específica. */
export function photoCountForStore(storeId: number): number {
  return cachedByStore[storeId] || 0;
}

export function onPhotoQueueChange(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  return () => window.removeEventListener(CHANGE_EVENT, cb);
}

// Carrega os contadores assim que o app abre.
if (typeof window !== "undefined") void listPhotos().catch(() => undefined);
