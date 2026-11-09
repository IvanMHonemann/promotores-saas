import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { runOutbox, type OutboxItem } from "@/lib/outbox";
import { blobToBase64, currentUserId, idbOutbox, listOutbox, migrateLegacyQueues, OUTBOX_EVENT, resetNetworkBackoff } from "@/lib/outboxDb";

/** Itens da fila offline (reage a mudanças). */
export function useOutboxItems(): OutboxItem[] {
  const [items, setItems] = useState<OutboxItem[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => { void listOutbox().then((list) => { if (alive) setItems(list); }); };
    load();
    window.addEventListener(OUTBOX_EVENT, load);
    const id = window.setInterval(load, 10_000);
    return () => { alive = false; window.removeEventListener(OUTBOX_EVENT, load); window.clearInterval(id); };
  }, []);
  return items;
}

export const SYNC_NOW_EVENT = "gondup:sync-now";
export function requestSync() { window.dispatchEvent(new Event(SYNC_NOW_EVENT)); }

/**
 * Envia a fila offline: ao abrir, ao voltar a internet, ao voltar para o app, a cada 30 s e quando algo entra na fila.
 * Uma trava impede duas execuções ao mesmo tempo.
 */
export function useOutboxSync() {
  const utils = trpc.useUtils();
  const latest = useRef(utils);
  latest.current = utils;
  const running = useRef(false);
  const again = useRef(false);

  useEffect(() => {
    let disposed = false;
    const sync = async () => {
      if (running.current) { again.current = true; return; }
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      if (currentUserId() == null) return;
      running.current = true;
      try {
        const client = latest.current.client;
        const result = await runOutbox(idbOutbox, {
          punch: async (item) => {
            await client.timeTracking.registerEvent.mutate({
              ...item.payload as any,
              deviceTime: item.deviceTime,
              offline: true,
              clock: item.clock,
              locationStatus: "success",
              latitude: item.payload.latitude ?? 0,
              longitude: item.payload.longitude ?? 0,
              accuracy: item.payload.accuracy ?? 0,
              idempotencyKey: item.id.slice(0, 64),
            });
          },
          visit: async (item) => {
            const p = item.payload;
            const common = { id: p.visitId, latitude: p.latitude, longitude: p.longitude, accuracy: p.accuracy, clientId: item.id, deviceTime: item.deviceTime, offline: true, clock: item.clock };
            if (p.action === "start") await client.operations.visits.start.mutate(common);
            else await client.operations.visits.complete.mutate({ ...common, notes: p.notes });
          },
          photo: async (item) => {
            if (!item.blob) throw Object.assign(new Error("Foto sem arquivo no aparelho."), { data: { code: "BAD_REQUEST" } });
            const imageBase64 = await blobToBase64(item.blob);
            (window as any).__gondupUploading = ((window as any).__gondupUploading || 0) + 1;
            try {
              await client.storePhotos.uploadAndCreate.mutate({ ...item.payload as any, storeId: item.payload.storeId && item.payload.storeId > 0 ? item.payload.storeId : undefined, imageBase64, mimeType: item.blob.type || "image/jpeg" });
            } finally {
              (window as any).__gondupUploading = Math.max(0, ((window as any).__gondupUploading || 1) - 1);
            }
          },
        }, { ownerId: currentUserId() });
        if (disposed) return;
        if (result.sent > 0) {
          toast.success(result.sent === 1 ? "1 item enviado ao servidor." : `${result.sent} itens enviados ao servidor.`);
          const u = latest.current;
          void u.timeTracking.myHistory.invalidate();
          void u.timeTracking.shiftStatus.invalidate();
          void u.timeTracking.myTimeSummary.invalidate();
          void u.operations.visits.today.invalidate();
          void u.operations.visits.list.invalidate();
          void u.storePhotos.invalidate();
        }
        if (result.failed > 0) toast.error("Um item não foi aceito pelo servidor. Veja em “Itens aguardando envio”.");
      } catch (e) {
        console.warn("[outbox] sincronização falhou", e);
      } finally {
        running.current = false;
        if (again.current && !disposed) { again.current = false; window.setTimeout(() => void sync(), 500); }
      }
    };
    void migrateLegacyQueues().catch((e) => console.warn("[outbox] migração", e)).finally(() => void sync());
    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    const onOnline = () => { void resetNetworkBackoff().finally(() => void sync()); };
    window.addEventListener("online", onOnline);
    window.addEventListener(SYNC_NOW_EVENT, sync);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => void sync(), 30_000);
    return () => {
      disposed = true;
      window.removeEventListener("online", onOnline);
      window.removeEventListener(SYNC_NOW_EVENT, sync);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, []);
}
