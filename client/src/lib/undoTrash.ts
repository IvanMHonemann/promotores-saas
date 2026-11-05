import { toast } from "sonner";

type TrashItem = { id: number; itemType: string; originalId: number };

/** Mostra "Enviado para a lixeira" com o botão Desfazer, que restaura os itens recém-apagados. */
export function toastWithUndo(opts: {
  message: string;
  itemType: string;
  originalIds: number[];
  fetchTrash: () => Promise<TrashItem[]>;
  restore: (id: number) => Promise<unknown>;
  onRestored?: () => void;
}) {
  toast.success(opts.message, {
    duration: 8000,
    action: {
      label: "Desfazer",
      onClick: async () => {
        try {
          const items = await opts.fetchTrash();
          const ids = new Set(opts.originalIds);
          const matches = items.filter((i) => i.itemType === opts.itemType && ids.has(i.originalId));
          for (const item of matches) await opts.restore(item.id);
          opts.onRestored?.();
          toast.success(matches.length ? "Restaurado." : "Não encontrei os itens na lixeira.");
        } catch {
          toast.error("Não foi possível desfazer. Restaure pela Lixeira.");
        }
      },
    },
  });
}
