/** Fila offline persistida no IndexedDB + avisos para a interface. */
import { idbAvailable, idbDelete, idbGetAll, idbPut, OUTBOX } from "./idb";
import { newItem, recoverInterrupted, type OutboxItem, type OutboxStore } from "./outbox";
import { captureClockEvidence } from "./clockAnchor";

export const OUTBOX_EVENT = "gondup:outbox-changed";
const notify = () => { try { window.dispatchEvent(new Event(OUTBOX_EVENT)); } catch { /* ignore */ } };

export const idbOutbox: OutboxStore = {
  all: () => idbGetAll<OutboxItem>(OUTBOX),
  put: async (item) => { await idbPut(OUTBOX, item); notify(); },
  remove: async (id) => { await idbDelete(OUTBOX, id); notify(); },
};

export function currentUserId(): number | null {
  try { const u = JSON.parse(localStorage.getItem("promotores-saas-auth-user") || "null"); return typeof u?.id === "number" ? u.id : null; } catch { return null; }
}

export async function enqueueItem(fields: Parameters<typeof newItem>[0]): Promise<OutboxItem> {
  if (!idbAvailable()) throw new Error("Este navegador não permite guardar dados offline.");
  const item = newItem({ ownerId: currentUserId(), ...fields });
  try {
    await idbOutbox.put(item);
  } catch (e) {
    throw new Error("Sem espaço para guardar no aparelho. Libere espaço e tente de novo.");
  }
  // Pede ao navegador para não apagar a fila quando faltar espaço.
  try { void (navigator as any).storage?.persist?.(); } catch { /* ignore */ }
  return item;
}

export function nowEvidence() {
  return { deviceTime: new Date().toISOString(), clock: captureClockEvidence() };
}

export async function listOutbox(): Promise<OutboxItem[]> {
  if (!idbAvailable()) return [];
  try { return (await idbOutbox.all()).sort((a, b) => a.seq - b.seq); } catch { return []; }
}

export async function retryItem(id: string) {
  const item = (await idbOutbox.all()).find((i) => i.id === id);
  if (item) await idbOutbox.put({ ...item, status: "pending", nextAttemptAt: 0 });
}

export async function discardItem(id: string) {
  await idbOutbox.remove(id);
}

export function base64ToBlob(base64: string, mime = "image/jpeg"): Blob {
  const clean = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result); resolve(r.slice(r.indexOf(",") + 1)); };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

const LEGACY = { punch: "gondup:punch-queue", visit: "gondup:visit-queue", photo: "gondup:photo-queue" };

/** Move as filas antigas (localStorage) para o IndexedDB, sem perder nada. */
export async function migrateLegacyQueues() {
  if (!idbAvailable()) return;
  await recoverInterrupted(idbOutbox);
  const read = (k: string) => { try { return JSON.parse(localStorage.getItem(k) || "[]") as any[]; } catch { return []; } };
  const owner = currentUserId();
  for (const p of read(LEGACY.punch)) {
    await idbOutbox.put(newItem({ id: p.idempotencyKey?.length <= 64 ? p.idempotencyKey : p.id, kind: "punch", label: punchLabel(p.eventType, p.deviceTime), deviceTime: p.deviceTime, clock: {}, ownerId: owner, payload: { eventType: p.eventType, timeZone: p.timeZone, latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, deviceInfo: p.deviceInfo } }));
  }
  localStorage.removeItem(LEGACY.punch);
  for (const v of read(LEGACY.visit)) {
    const visit = newItem({ kind: "visit", label: `${v.action === "start" ? "Check-in" : "Check-out"} · ${v.storeName || "Loja"}`, deviceTime: v.capturedAt || v.queuedAt, clock: {}, ownerId: owner, payload: { action: v.action, visitId: v.visitId, storeId: v.storeId, storeName: v.storeName, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy, notes: v.notes } });
    await idbOutbox.put(visit);
    if (v.photoBase64) await idbOutbox.put(newItem({ kind: "photo", dependsOn: visit.id, label: `Foto · ${v.storeName || "Loja"}`, deviceTime: v.capturedAt || v.queuedAt, clock: {}, ownerId: owner, blob: base64ToBlob(v.photoBase64), payload: { storeId: v.storeId, visitId: v.visitId, capturedAt: v.capturedAt || v.queuedAt, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy, locationStatus: v.latitude != null ? "success" : "unavailable", idempotencyKey: (v.idempotencyKey || `visit${v.visitId}${v.action}${String(v.id).replace(/-/g, "")}`).slice(0, 64) } }));
  }
  localStorage.removeItem(LEGACY.visit);
  for (const p of read(LEGACY.photo)) {
    await idbOutbox.put(newItem({ kind: "photo", label: "Foto", deviceTime: p.capturedAt, clock: {}, ownerId: owner, blob: base64ToBlob(p.imageBase64, p.mimeType), payload: { storeId: p.storeId, storeClientId: p.storeClientId, visitId: p.visitId, capturedAt: p.capturedAt, latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, locationStatus: p.locationStatus, idempotencyKey: p.idempotencyKey } }));
  }
  localStorage.removeItem(LEGACY.photo);
  notify();
}

export const PUNCH_LABEL: Record<string, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo", clock_out: "Saída" };
export function punchLabel(type: string, iso: string) {
  return `${PUNCH_LABEL[type] || "Ponto"} ${new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Voltou a internet: itens que esperavam só por falta de rede podem tentar já. */
export async function resetNetworkBackoff() {
  if (!idbAvailable()) return;
  for (const item of await idbOutbox.all()) {
    if (item.status === "error" && (item.lastError === "Sem conexão" || item.lastError?.startsWith("Sessão"))) await idbOutbox.put({ ...item, nextAttemptAt: 0 });
  }
}
