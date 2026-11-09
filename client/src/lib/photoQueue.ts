/**
 * Foto guardada offline (Blob comprimido no IndexedDB, fila única em lib/outbox).
 */
import { base64ToBlob, enqueueItem, nowEvidence } from "./outboxDb";
import { requestSync } from "@/hooks/useOutbox";

export type QueuedPhotoInput = {
  storeId?: number | null;
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
};

export async function enqueuePhoto(photo: QueuedPhotoInput, opts: { label?: string; dependsOn?: string } = {}) {
  const { clock } = nowEvidence();
  const { imageBase64, mimeType, ...payload } = photo;
  const item = await enqueueItem({ kind: "photo", label: opts.label || "Foto", dependsOn: opts.dependsOn, deviceTime: photo.capturedAt, clock, blob: base64ToBlob(imageBase64, mimeType || "image/jpeg"), payload });
  requestSync();
  return item;
}
