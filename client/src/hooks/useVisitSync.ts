import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { listVisits, removeVisit } from "@/lib/visitQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza check-in/check-out de visitas da fila offline.
 */
export function useVisitSync() {
  const start = trpc.operations.visits.start.useMutation();
  const complete = trpc.operations.visits.complete.useMutation();
  const upload = trpc.storePhotos.uploadAndCreate.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return;
      const pending = listVisits();
      if (!pending.length) return;

      let synced = 0;
      for (const v of pending) {
        try {
          if (v.action === "start") {
            await start.mutateAsync({
              id: v.visitId,
              latitude: v.latitude,
              longitude: v.longitude,
              accuracy: v.accuracy,
            });
          } else {
            await complete.mutateAsync({
              id: v.visitId,
              latitude: v.latitude,
              longitude: v.longitude,
              accuracy: v.accuracy,
            });
          }
          // foto da fachada
          try {
            await upload.mutateAsync({
              storeId: v.storeId,
              capturedAt: v.queuedAt,
              latitude: v.latitude,
              longitude: v.longitude,
              accuracy: v.accuracy,
              locationStatus: v.latitude != null ? "success" : "unavailable",
              imageBase64: v.photoBase64,
              mimeType: "image/jpeg",
              idempotencyKey: `visit-${v.visitId}-${v.action}-${v.id}`.slice(0, 64),
            });
          } catch { /* foto opcional */ }
          removeVisit(v.id);
          synced++;
        } catch {
          // continua
        }
      }
      if (synced > 0) {
        toast.success(`${synced} visita(s) sincronizada(s).`);
        void utils.operations.visits.today.invalidate();
        void utils.operations.visits.list.invalidate();
      }
    };

    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [start, complete, upload, utils]);
}
