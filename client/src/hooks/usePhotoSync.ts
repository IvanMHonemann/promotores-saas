import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { listPhotos, removePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";
import { NO_STORE_LABEL } from "@shared/stores";

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
      let movedToNoStore = 0;
      for (const photo of pending) {
        const send = (withStore: boolean) =>
          upload.mutateAsync({
            storeId: withStore ? photo.storeId : undefined,
            storeClientId: withStore ? photo.storeClientId : undefined,
            visitId: withStore ? photo.visitId : undefined,
            capturedAt: photo.capturedAt,
            latitude: photo.latitude,
            longitude: photo.longitude,
            accuracy: photo.accuracy,
            locationStatus: photo.locationStatus as any,
            imageBase64: photo.imageBase64,
            mimeType: photo.mimeType,
            idempotencyKey: photo.idempotencyKey,
          });
        try {
          try {
            await send(true);
          } catch (error: any) {
            // A loja deixou de estar vinculada ao promotor enquanto a foto esperava na fila:
            // a foto não fica presa; é enviada como "Sem loja vinculada".
            if (photo.storeId && error?.data?.code === "NOT_FOUND") {
              await send(false);
              movedToNoStore++;
            } else {
              throw error;
            }
          }
          removePhoto(photo.id);
          synced++;
        } catch {
          // Continua com a próxima
        }
      }
      if (synced > 0) {
        toast.success(`${synced} foto(s) sincronizada(s).`);
      }
      if (movedToNoStore > 0) {
        toast.info(`${movedToNoStore} foto(s) foram enviadas como "${NO_STORE_LABEL}" porque a loja não está mais vinculada a você.`);
      }
    };

    window.addEventListener("online", sync);
    sync(); // Tenta ao montar
    return () => window.removeEventListener("online", sync);
  }, [upload]);
}
