/**
 * Check-in/check-out guardado offline. Agora fica na fila única do IndexedDB (lib/outbox):
 * o check-in vira um item e a foto da fachada outro, que só sobe depois do check-in.
 */
import { base64ToBlob, enqueueItem, nowEvidence } from "./outboxDb";
import { requestSync } from "@/hooks/useOutbox";

export type QueuedVisitInput = {
  action: "start" | "complete";
  visitId: number;
  storeId: number;
  storeName: string;
  photoBase64: string;
  mimeType: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  notes?: string;
  idempotencyKey?: string;
  capturedAt?: string;
};

export async function enqueueVisit(v: QueuedVisitInput) {
  const { deviceTime, clock } = nowEvidence();
  const label = `${v.action === "start" ? "Check-in" : "Check-out"} · ${v.storeName || "Loja"}`;
  const visit = await enqueueItem({ kind: "visit", label, deviceTime, clock, payload: { action: v.action, visitId: v.visitId, storeId: v.storeId, storeName: v.storeName, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy, notes: v.notes } });
  if (v.photoBase64) {
    await enqueueItem({
      kind: "photo", dependsOn: visit.id, label: `Foto do ${label}`, deviceTime: v.capturedAt || deviceTime, clock,
      blob: base64ToBlob(v.photoBase64, v.mimeType || "image/jpeg"),
      payload: { storeId: v.storeId, visitId: v.visitId, capturedAt: v.capturedAt || deviceTime, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy, locationStatus: v.latitude != null ? "success" : "unavailable", idempotencyKey: (v.idempotencyKey || crypto.randomUUID().replace(/-/g, "")).slice(0, 64) },
    });
  }
  requestSync();
  return visit;
}

/** Converte Blob para base64. */
export { blobToBase64 } from "./outboxDb";
