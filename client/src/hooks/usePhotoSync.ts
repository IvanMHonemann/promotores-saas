import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { listPhotos, removePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza fotos da fila offline quando volta a conexão.
 */
export function usePhotoSync() {
  const upload = trpc.storePhotos.uploadAndCreate.useMutation();

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return;
      const pending = listPhotos();
      if (!pending.length) return;

      let synced = 0;
      for (const photo of pending) {
        try {
          await upload.mutateAsync({
            storeId: photo.storeId,
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
    };

    window.addEventListener("online", sync);
    sync(); // Tenta ao montar
    return () => window.removeEventListener("online", sync);
  }, [upload]);
}
