import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { listClients, removeClient } from "@/lib/clientQueue";
import { isOnline } from "@/lib/offlineCache";
import { toast } from "sonner";

/**
 * Sincroniza cadastros de clientes de loja da fila offline.
 */
export function useClientSync() {
  const create = trpc.storeClients.create.useMutation();
  const utils = trpc.useUtils();

  useEffect(() => {
    const sync = async () => {
      if (!isOnline()) return;
      const pending = listClients();
      if (!pending.length) return;

      let synced = 0;
      for (const client of pending) {
        try {
          // storeId pode ser temp se a loja também foi criada offline; nesse caso pula até a loja sincronizar
          if (typeof client.storeId === "string" && client.storeId.startsWith("temp-")) continue;
          await create.mutateAsync({
            storeId: Number(client.storeId),
            name: client.name,
            contactName: client.contactName,
            phone: client.phone,
            notes: client.notes,
          });
          removeClient(client.id);
          synced++;
        } catch {
          // continua
        }
      }
      if (synced > 0) {
        toast.success(`${synced} cliente(s) sincronizado(s).`);
        void utils.storeClients.list.invalidate();
      }
    };

    window.addEventListener("online", sync);
    sync();
    return () => window.removeEventListener("online", sync);
  }, [create, utils]);
}
