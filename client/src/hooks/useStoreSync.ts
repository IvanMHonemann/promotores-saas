import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { listStores, removeStore } from "@/lib/storeQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza cadastros de lojas da fila offline quando volta a conexão.
 */
export function useStoreSync() {
  const create = trpc.operations.stores.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return;
      const pending = listStores();
      if (!pending.length) return;

      let synced = 0;
      for (const store of pending) {
        try {
          await create.mutateAsync({
            name: store.name,
            city: store.city,
            state: store.state || undefined,
            address: store.address || undefined,
          });
          removeStore(store.id);
          synced++;
        } catch {
          // continua
        }
      }
      if (synced > 0) {
        toast.success(`${synced} loja(s) sincronizada(s).`);
        void utils.storePhotos.listStoresWithStats.invalidate();
        void utils.operations.stores.list.invalidate();
      }
    };

    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [create, utils]);
}
