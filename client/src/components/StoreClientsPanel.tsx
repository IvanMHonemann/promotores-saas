import { useEffect, useMemo, useState } from "react";
import { Camera, Pencil, Phone, Plus, Trash2, UserRound, X } from "lucide-react";
import { PhotoCapture } from "@/components/PhotoCapture";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBusy } from "@/components/BusyOverlay";
import { trpc } from "@/lib/trpc";
import { cacheGet, cacheSet } from "@/lib/offlineCache";
import { useOnline } from "@/hooks/useOnline";
import { enqueueClient, listClients } from "@/lib/clientQueue";
import { toast } from "sonner";

export type ClientFilter = "all" | "none" | number;
const field = "h-11 border-white/20 bg-slate-950/70 text-white placeholder:text-slate-400";
const empty = { name: "", contactName: "", phone: "", notes: "" };

type Props = {
  storeId: number;
  storeName: string;
  visitId?: number | null;
  filter: ClientFilter;
  onFilter: (f: ClientFilter) => void;
  onChanged: () => void;
  /** Quantidade de fotos antigas sem cliente (para mostrar o filtro). */
  legacyPhotos: number;
};

/** Clientes da loja: cadastro e, dentro de cada cliente, o botão para tirar as fotos. */
export function StoreClientsPanel({ storeId, storeName, visitId, filter, onFilter, onChanged, legacyPhotos }: Props) {
  const utils = trpc.useUtils();
  const { run } = useBusy();
  const online = useOnline();
  const clients = trpc.storeClients.list.useQuery({ storeId }, { staleTime: 10000 });
  const [form, setForm] = useState<{ id: number | null; open: boolean } & typeof empty>({ id: null, open: false, ...empty });
  const [pendingClients, setPendingClients] = useState(() => listClients().filter((c) => c.storeId === storeId || String(c.storeId) === String(storeId)));

  useEffect(() => {
    if (clients.data) cacheSet(`clients-${storeId}`, clients.data);
  }, [clients.data, storeId]);

  useEffect(() => {
    setPendingClients(listClients().filter((c) => c.storeId === storeId || String(c.storeId) === String(storeId)));
  }, [online, storeId]);

  const cached = useMemo(() => cacheGet<any[]>(`clients-${storeId}`) || [], [storeId, clients.data, online]);
  const serverList = clients.data ?? (!online ? cached : []);
  const pendingDisplay = pendingClients.map((c) => ({
    id: c.tempId,
    name: c.name,
    contactName: c.contactName,
    phone: c.phone,
    notes: c.notes,
    photoCount: 0,
    pending: true,
  }));
  const list = [...pendingDisplay, ...serverList];

  const refresh = () => { void utils.storeClients.list.invalidate(); onChanged(); };
  const create = trpc.storeClients.create.useMutation();
  const update = trpc.storeClients.update.useMutation();
  const setActive = trpc.storeClients.setActive.useMutation({ onSuccess: () => { toast.success("Cliente removido da loja. As fotos já tiradas continuam salvas."); refresh(); }, onError: (e) => toast.error(e.message) });

  const close = () => setForm({ id: null, open: false, ...empty });
  const save = () => {
    const name = form.name.trim();
    if (name.length < 2) return toast.info("Informe o nome do cliente.");
    const data = { storeId, name, contactName: form.contactName.trim() || undefined, phone: form.phone.trim() || undefined, notes: form.notes.trim() || undefined };
    if (!online && !form.id) {
      enqueueClient(data);
      setPendingClients(listClients().filter((c) => c.storeId === storeId || String(c.storeId) === String(storeId)));
      toast.success("Cliente salvo offline. Será cadastrado quando a internet voltar.");
      close();
      return;
    }
    const job = form.id ? update.mutateAsync({ ...data, id: form.id }) : create.mutateAsync(data);
    void run(form.id ? "Salvando cliente..." : "Cadastrando cliente...", () => job)
      .then(() => { toast.success(form.id ? "Cliente atualizado." : "Cliente cadastrado. Já pode tirar as fotos dentro dele."); close(); refresh(); })
      .catch((e) => toast.error(e?.message || "Não foi possível salvar o cliente."));
  };

  return (
    <section className="space-y-3" aria-label="Clientes da loja">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-black text-white"><UserRound className="h-5 w-5 text-teal-300" />Clientes desta loja</h3>
        {!form.open && (
          <Button size="sm" className="bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" onClick={() => setForm({ id: null, open: true, ...empty })}>
            <Plus className="mr-1 h-4 w-4" />Cadastrar cliente
          </Button>
        )}
      </div>

      {form.open && (
        <div className="space-y-2 rounded-2xl border border-white/15 bg-slate-800/70 p-4">
          <div className="flex items-center justify-between">
            <p className="font-bold text-white">{form.id ? "Editar cliente" : "Novo cliente"}</p>
            <button type="button" onClick={close} aria-label="Fechar" className="rounded-full p-1.5 text-slate-200 hover:bg-white/10"><X className="h-5 w-5" /></button>
          </div>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do cliente (marca / indústria)" className={field} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="Contato (opcional)" className={field} />
            <Input value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefone (opcional)" className={field} />
          </div>
          <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações (opcional)" className={field} />
          <Button className="h-11 w-full bg-teal-400 font-bold text-slate-950 hover:bg-teal-300" disabled={create.isPending || update.isPending} onClick={save}>Salvar cliente</Button>
        </div>
      )}

      {clients.isLoading && online && <p className="text-sm text-slate-300">Carregando clientes...</p>}
      {clients.isError && online && <p className="rounded-xl border border-rose-300/40 bg-rose-400/15 p-3 text-sm text-rose-100">Não foi possível carregar os clientes. {clients.error.message}</p>}

      {!clients.isLoading && list.length === 0 && !form.open && (
        <div className="rounded-2xl border border-dashed border-white/25 bg-slate-800/40 p-6 text-center">
          <p className="text-base font-bold text-white">Nenhum cliente cadastrado nesta loja</p>
          <p className="mt-1 text-sm text-slate-300">{online ? "Cadastre o cliente para tirar as fotos dentro dele." : "Você pode tirar fotos mesmo sem clientes cadastrados (serão associadas depois)."}</p>
          {!online && (
            <div className="mt-4">
              <PhotoCapture storeId={storeId} storeName={storeName} visitId={visitId} onCaptured={refresh} />
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {list.map((c) => (
          <div key={c.id} className={`rounded-2xl border p-4 ${filter === c.id ? "border-teal-300/60 bg-teal-300/5" : "border-white/15 bg-slate-800/70"}`}>
            <div className="flex items-start justify-between gap-3">
              <button type="button" className="min-w-0 text-left" onClick={() => !c.pending && onFilter(filter === c.id ? "all" : c.id)} aria-pressed={filter === c.id} disabled={c.pending}>
                <p className="truncate text-base font-bold text-white">{c.name}{c.pending ? " (pendente)" : ""}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1"><Camera className="h-3 w-3 text-teal-300" />{c.photoCount || 0} foto{c.photoCount !== 1 ? "s" : ""}</span>
                  {c.contactName && <span>{c.contactName}</span>}
                  {c.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                </p>
              </button>
              {online && !c.pending && (
                <div className="flex shrink-0 gap-1">
                  <button type="button" aria-label={`Editar ${c.name}`} onClick={() => setForm({ id: c.id, open: true, name: c.name, contactName: c.contactName ?? "", phone: c.phone ?? "", notes: c.notes ?? "" })} className="rounded-full p-2 text-slate-200 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                  <button type="button" aria-label={`Remover ${c.name}`} onClick={() => { if (window.confirm(`Remover o cliente ${c.name} desta loja? As fotos já tiradas continuam salvas.`)) setActive.mutate({ storeId, id: c.id, active: false }); }} className="rounded-full p-2 text-rose-200 hover:bg-white/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              )}
            </div>
            {!c.pending && (
              <div className="mt-3">
                <PhotoCapture storeId={storeId} storeName={storeName} storeClientId={c.id} clientName={c.name} visitId={visitId} onCaptured={refresh} />
              </div>
            )}
          </div>
        ))}
      </div>

      {(list.length > 0 || legacyPhotos > 0) && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar fotos por cliente">
          {([["all", "Todos os clientes"], ...list.filter((c) => !c.pending).map((c) => [c.id, c.name] as [number, string]), ...(legacyPhotos > 0 ? [["none", `Sem cliente (${legacyPhotos})`] as ["none", string]] : [])] as Array<[ClientFilter, string]>).map(([id, label]) => (
            <button key={String(id)} type="button" aria-pressed={filter === id} onClick={() => onFilter(id)} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === id ? "bg-teal-400 text-slate-950" : "bg-slate-700 text-slate-100 hover:bg-slate-600"}`}>{label}</button>
          ))}
        </div>
      )}
    </section>
  );
}
