import { useState } from "react";
import { ArchiveRestore, Clock3, Loader2, Package, RotateCcw, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
const typeLabels: Record<string,string> = { client: "Cliente", order: "Ordem de serviço", extinguisher: "Equipamento", product: "Produto", store_photo: "Foto de loja" };
export default function TrashPage() {
  const [busyId, setBusyId] = useState<number|null>(null);
  const utils = trpc.useUtils();
  const list = trpc.trash.list.useQuery();
  const refresh = () => { void utils.trash.list.invalidate(); void utils.products.list.invalidate(); };
  const restore = trpc.trash.restore.useMutation({ onMutate: ({id})=>setBusyId(id), onSuccess:()=>{toast.success("Item restaurado.");refresh();}, onError:e=>toast.error(e.message||"Não foi possível restaurar o item."), onSettled:()=>setBusyId(null) });
  const permanentlyDelete = trpc.trash.permanentlyDelete.useMutation({ onMutate:({id})=>setBusyId(id), onSuccess:()=>{toast.success("Registro removido definitivamente da lixeira.");refresh();}, onError:e=>toast.error(e.message||"Não foi possível excluir o registro."), onSettled:()=>setBusyId(null) });
  return <DashboardLayout title="Lixeira" description="Restaure itens removidos recentemente ou exclua os registros definitivamente.">
    <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-teal-300"/>Itens removidos</CardTitle></CardHeader><CardContent className="space-y-3">
      <p className="text-sm text-slate-300">Os itens permanecem disponíveis para restauração por 5 dias.</p>
      {list.isLoading&&<p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin"/>Carregando lixeira...</p>}
      {list.isError&&<p role="alert" className="text-sm text-rose-200">Não foi possível carregar a lixeira.</p>}
      {!list.isLoading&&!list.isError&&!list.data?.length&&<div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300"><Trash2 className="mx-auto mb-2 h-8 w-8 text-slate-500"/>A lixeira está vazia.</div>}
      {list.data?.map(item=>{const expired=new Date(item.expiresAt).getTime()<=Date.now();return <div key={item.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="rounded-lg bg-teal-300/10 p-2">{item.itemType==="product"?<Package className="h-5 w-5 text-teal-300"/>:<Trash2 className="h-5 w-5 text-teal-300"/>}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="break-words font-semibold text-white">{item.label}</p><Badge variant="outline" className="border-white/15 text-slate-300">{typeLabels[item.itemType]||item.itemType}</Badge></div><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3 w-3"/>Excluído em {new Date(item.deletedAt).toLocaleString("pt-BR")} · {expired?"prazo expirado":`restauração até ${new Date(item.expiresAt).toLocaleString("pt-BR")}`}</p></div></div><div className="flex shrink-0 gap-2"><Button size="sm" disabled={busyId===item.id||expired} onClick={()=>restore.mutate({id:item.id})} className="bg-teal-300 text-slate-950 hover:bg-teal-200"><ArchiveRestore className="mr-1 h-4 w-4"/>Restaurar</Button><Button size="sm" variant="outline" disabled={busyId===item.id} onClick={()=>{if(window.confirm(`Excluir definitivamente “${item.label}”? Esta ação não pode ser desfeita.`))permanentlyDelete.mutate({id:item.id});}} className="border-rose-300/25 text-rose-200"><Trash2 className="mr-1 h-4 w-4"/>Excluir definitivamente</Button></div></div>})}
    </CardContent></Card>
  </DashboardLayout>;
}
