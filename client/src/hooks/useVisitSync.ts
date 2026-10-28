import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { listVisits, removeVisit } from "@/lib/visitQueue";
import { enqueuePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

function toBase64(dataUrlOrBase64: string): string {
  const idx = dataUrlOrBase64.indexOf(",");
  return idx >= 0 ? dataUrlOrBase64.slice(idx + 1) : dataUrlOrBase64;
}

/**
 * Sincroniza check-in/check-out de visitas da fila offline.
 *
 * O resultado de useMutation() muda de identidade a cada render; usá-lo como dependência do efeito
 * fazia a sincronização reiniciar sozinha várias vezes em paralelo (envios duplicados + JSON.parse
 * da fila inteira a cada render). Agora o efeito roda uma vez e uma trava impede execuções simultâneas.
 */
export function useVisitSync() {
  const start = trpc.operations.visits.start.useMutation();
  const complete = trpc.operations.visits.complete.useMutation();
  const upload = trpc.storePhotos.uploadAndCreate.useMutation();
  const utils = trpc.useUtils();
  const latest = useRef({ start, complete, upload, utils });
  latest.current = { start, complete, upload, utils };
  const running = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (running.current || !isOnline()) return;
      running.current = true;
      try {
        const pending = listVisits();
        if (!pending.length) return;

        let synced = 0;
        for (const v of pending) {
          try {
            const { start, complete, upload } = latest.current;
            if (v.action === "start") {
              await start.mutateAsync({ id: v.visitId, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy });
            } else {
              await complete.mutateAsync({ id: v.visitId, latitude: v.latitude, longitude: v.longitude, accuracy: v.accuracy });
            }
            // foto da fachada vinculada à visita (mesma chave da captura: o servidor ignora repetição)
            const photo = {
              storeId: v.storeId,
              visitId: v.visitId,
              capturedAt: v.capturedAt ?? v.queuedAt,
              latitude: v.latitude,
              longitude: v.longitude,
              accuracy: v.accuracy,
              locationStatus: (v.latitude != null ? "success" : "unavailable") as "success" | "unavailable",
              imageBase64: toBase64(v.photoBase64),
              mimeType: "image/jpeg",
              idempotencyKey: v.idempotencyKey ?? `visit-${v.visitId}-${v.action}-${v.id}`.slice(0, 64),
            };
            try {
              await upload.mutateAsync(photo);
            } catch {
              // A visita já foi registrada: guarda a foto na fila de fotos em vez de descartá-la.
              try { enqueuePhoto(photo); } catch (queueErr) { console.warn("Foto não pôde ser guardada", queueErr); }
            }
            removeVisit(v.id);
            synced++;
          } catch {
            // continua
          }
        }
        if (synced > 0) {
          toast.success(`${synced} visita(s) sincronizada(s).`);
          void latest.current.utils.operations.visits.today.invalidate();
          void latest.current.utils.operations.visits.list.invalidate();
        }
      } finally {
        running.current = false;
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    void sync();
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
