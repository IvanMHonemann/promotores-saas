import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { listPhotos, removePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza fotos da fila offline quando volta a conexão.
 * Efeito executado uma vez + trava contra execuções simultâneas (ver useVisitSync).
 */
export function usePhotoSync() {
  const upload = trpc.storePhotos.uploadAndCreate.useMutation();
  const latest = useRef(upload);
  latest.current = upload;
  const running = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (running.current || !isOnline()) return;
      running.current = true;
      try {
        const pending = listPhotos();
        if (!pending.length) return;

        let synced = 0;
        for (const photo of pending) {
          try {
            await latest.current.mutateAsync({
              storeId: photo.storeId && photo.storeId > 0 ? photo.storeId : undefined,
              storeClientId: photo.storeClientId,
              visitId: photo.visitId,
              capturedAt: photo.capturedAt,
              latitude: photo.latitude,
              longitude: photo.longitude,
              accuracy: photo.accuracy,
              locationStatus: photo.locationStatus as any,
              imageBase64: photo.imageBase64,
              mimeType: photo.mimeType,
              idempotencyKey: photo.idempotencyKey,
            });
            removePhoto(photo.id);
            synced++;
          } catch {
            // Continua com a próxima
          }
        }
        if (synced > 0) {
          toast.success(`${synced} foto(s) sincronizada(s).`);
        }
      } finally {
        running.current = false;
      }
    };

    const onVisible = () => { if (document.visibilityState === "visible") void sync(); };
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    void sync(); // Tenta ao montar
    return () => {
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
