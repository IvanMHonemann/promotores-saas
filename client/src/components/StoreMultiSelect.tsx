import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

export type SelectableStore = { id: number; name: string; city?: string | null; state?: string | null };

type Props = {
  stores: SelectableStore[];
  value: number[];
  onChange: (storeIds: number[]) => void;
  loading?: boolean;
  error?: boolean;
  disabled?: boolean;
  /** Prefixo dos ids dos campos (acessibilidade). */
  idPrefix: string;
};

/** Seleção de várias lojas (opcional): busca, "selecionar todas" e "limpar". Usada ao criar e ao editar promotores. */
export function StoreMultiSelect({ stores, value, onChange, loading, error, disabled, idPrefix }: Props) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLowerCase();
  const selected = useMemo(() => new Set(value), [value]);
  const visible = useMemo(
    () => stores.filter((store) => !term || `${store.name} ${store.city ?? ""}`.toLowerCase().includes(term)),
    [stores, term],
  );

  if (loading) return <p className="flex items-center gap-2 py-3 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando lojas...</p>;
  if (error) return <p role="alert" className="rounded-lg border border-rose-300/20 bg-rose-400/10 p-3 text-sm text-rose-200">Não foi possível carregar as lojas. Atualize a página e tente novamente.</p>;
  if (!stores.length) return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">Nenhuma loja cadastrada ainda. O promotor pode ser salvo sem lojas e receber os vínculos depois.</p>;

  const toggle = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    onChange([...next]);
  };
  const selectVisible = () => onChange([...new Set([...value, ...visible.map((store) => store.id)])]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">{value.length} loja(s) selecionada(s)</Badge>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" className="text-teal-600 hover:underline disabled:opacity-50" disabled={disabled || !visible.length} onClick={selectVisible}>Selecionar {term ? "as filtradas" : "todas"}</button>
          <button type="button" className="text-slate-500 hover:underline disabled:opacity-50" disabled={disabled || !value.length} onClick={() => onChange([])}>Limpar</button>
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input aria-label="Buscar loja" className="pl-9" placeholder="Buscar loja pelo nome ou cidade" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      <div className="grid max-h-52 gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
        {visible.length === 0 && <p className="p-2 text-sm text-slate-500 sm:col-span-2">Nenhuma loja encontrada.</p>}
        {visible.map((store) => (
          <label key={store.id} htmlFor={`${idPrefix}-store-${store.id}`} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-sm text-slate-700 hover:bg-white">
            <input
              id={`${idPrefix}-store-${store.id}`}
              type="checkbox"
              className="mt-1 accent-teal-600"
              disabled={disabled}
              checked={selected.has(store.id)}
              onChange={(event) => toggle(store.id, event.target.checked)}
            />
            <span className="min-w-0"><span className="block font-medium">{store.name}</span><span className="text-xs text-slate-500">{store.city ?? ""}{store.state ? ` — ${store.state}` : ""}</span></span>
          </label>
        ))}
      </div>
    </div>
  );
}
