import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { listPhotos, removePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza fotos da fila offline quando volta a conexão.
 * Também tenta a cada 60 s (sinal fraco nem sempre dispara o evento "online").
 */
export function usePhotoSync() {
  const upload = trpc.storePhotos.uploadAndCreate.useMutation();
  const utils = trpc.useUtils();
  const uploadRef = useRef(upload.mutateAsync);
  uploadRef.current = upload.mutateAsync;
  const utilsRef = useRef(utils);
  utilsRef.current = utils;
  const running = useRef(false);

  useEffect(() => {
    const sync = async () => {
      if (running.current || !isOnline()) return;
      running.current = true;
      try {
        const pending = await listPhotos();
        if (!pending.length) return;
        let synced = 0;
        for (const photo of pending) {
          try {
            await uploadRef.current({
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
            await removePhoto(photo.id);
            synced++;
          } catch (error: any) {
            const code = error?.data?.code || error?.shape?.data?.code;
            // Sem rede, limite de envios ou sessão expirada: para e tenta depois.
            // Outros erros (ex.: loja removida) pulam só esta foto; ela fica guardada, nunca é apagada.
            if (!isOnline() || code === undefined || code === "TOO_MANY_REQUESTS" || code === "UNAUTHORIZED") break;
          }
        }
        if (synced > 0) {
          toast.success(`${synced} foto(s) offline enviada(s).`);
          void utilsRef.current.storePhotos.invalidate();
          void utilsRef.current.storeClients.list.invalidate();
        }
      } finally {
        running.current = false;
      }
    };

    window.addEventListener("online", sync);
    const interval = window.setInterval(() => void sync(), 60000);
    void sync(); // Tenta ao montar
    return () => {
      window.removeEventListener("online", sync);
      window.clearInterval(interval);
    };
  }, []);
}
