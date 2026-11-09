import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusy } from "@/components/BusyOverlay";
import { trpc } from "@/lib/trpc";
import { useOnline } from "@/hooks/useOnline";
import { enqueueStore } from "@/lib/storeQueue";
import { validateStoreForm, type StoreFormValues } from "@shared/storeForm";

export type EditableStore = { id: number; name?: string | null; city?: string | null; state?: string | null; address?: string | null };
export type SavedStore = { id?: number; name: string; pending?: boolean };

const fieldCls = "h-11 border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400";

/**
 * Formulário único de cadastro/edição de loja. Usado em /lojas e em Roteiros (mesma validação,
 * mesma fila offline). Use `key` para reiniciar ao trocar a loja editada.
 */
export default function StoreForm({ editing, onClose, onSaved }: { editing?: EditableStore | null; onClose: () => void; onSaved?: (store: SavedStore) => void }) {
  const online = useOnline();
  const { run } = useBusy();
  const utils = trpc.useUtils();
  const [form, setForm] = useState<StoreFormValues>({ name: editing?.name || "", city: editing?.city || "", state: editing?.state || "", address: editing?.address || "" });
  const refresh = () => Promise.all([utils.storePhotos.listStoresWithStats.invalidate(), utils.operations.stores.list.invalidate()]);
  const createStore = trpc.operations.stores.create.useMutation({
    onSuccess: (store: any) => { toast.success("Loja cadastrada."); void refresh(); onSaved?.({ id: store?.id, name: store?.name || form.name.trim() }); },
    onError: (e) => toast.error(e.message || "Não foi possível cadastrar a loja."),
  });
  const updateStore = trpc.operations.stores.update.useMutation({
    onSuccess: () => { toast.success("Loja atualizada."); void refresh(); onSaved?.({ id: editing?.id, name: form.name.trim() }); },
    onError: (e) => toast.error(e.message || "Não foi possível salvar a loja."),
  });

  const submit = () => {
    const checked = validateStoreForm(form);
    if (!checked.ok) return toast.info(checked.message);
    const { payload } = checked;
    if (editing) {
      if (!online) return toast.info("Conecte-se à internet para editar a loja.");
      void run("Salvando loja...", () => updateStore.mutateAsync({ id: editing.id, name: payload.name, city: payload.city, state: payload.state || "", address: payload.address || "" })).catch(() => {});
      return;
    }
    if (!online) {
      enqueueStore(payload);
      toast.success("Loja salva offline. Será cadastrada quando a internet voltar.");
      onSaved?.({ name: payload.name, pending: true });
      return;
    }
    void run("Cadastrando loja...", () => createStore.mutateAsync(payload)).catch(() => {});
  };

  return (
    <section className="space-y-3 rounded-2xl border border-white/15 bg-slate-800/70 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white">{editing ? "Editar loja" : "Cadastrar loja"}</h3>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-slate-200 hover:bg-white/10">
          <X className="h-5 w-5" />
        </button>
      </div>
      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome da loja" className={fieldCls} />
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" className={fieldCls} />
        <Input value={form.state} maxLength={2} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} placeholder="UF" className={`${fieldCls} text-center`} />
      </div>
      <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Endereço (opcional)" className={fieldCls} />
      <Button className="h-11 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={submit}>
        Salvar loja
      </Button>
    </section>
  );
}
