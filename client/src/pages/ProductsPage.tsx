import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Barcode, Camera, CameraOff, Check, Loader2, MessageCircle, Package, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

type Product = { id: number; productCode: string; description: string; quantity: number; expirationDate: string | Date; price: string | number };
const blank = { productCode: "", description: "", quantity: "0", expirationDate: "", price: "0.00" };
const dateValue = (d: string | Date) => typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
const dateLabel = (d: string | Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${dateValue(d)}T00:00:00Z`));
const money = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
function shareProducts(products: Product[]) {
  if (!products.length) return;
  const text = ["*Produtos e controle de validade*", ...products.map((p, i) => `${i + 1}. *${p.description}*\nCódigo: ${p.productCode}\nQuantidade: ${p.quantity}\nValidade: ${dateLabel(p.expirationDate)}\nPreço: ${money(p.price)}`)].join("\n\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [expiry, setExpiry] = useState<"all" | "expired" | "near">("all");
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<number | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const utils = trpc.useUtils();
  const products = trpc.products.list.useQuery({ search: search.trim() || undefined, expiry }, { staleTime: 15000 });
  const expiringProducts = trpc.products.list.useQuery({ expiry: "near" }, { staleTime: 60000 });
  const create = trpc.products.create.useMutation({ onSuccess: () => { toast.success("Produto cadastrado."); resetForm(); void utils.products.list.invalidate(); }, onError: e => toast.error(e.message || "Falha ao cadastrar produto.") });
  const update = trpc.products.update.useMutation({ onSuccess: () => { toast.success("Produto atualizado."); resetForm(); void utils.products.list.invalidate(); }, onError: e => toast.error(e.message || "Falha ao atualizar produto.") });
  const remove = trpc.products.deleteMany.useMutation({ onSuccess: (result) => { toast.success(`${result.deleted} produto(s) enviado(s) à lixeira por 24 horas.`); setSelectedIds([]); if (editing !== null) resetForm(); void utils.products.list.invalidate(); void utils.trash.list.invalidate(); }, onError: e => toast.error(e.message || "Não foi possível enviar os produtos à lixeira.") });
  function resetForm() { setForm(blank); setEditing(null); }
  function stopCamera() { controlsRef.current?.stop(); controlsRef.current = null; setCameraOpen(false); }
  async function lookupBarcode(code: string) {
    setForm(old => ({ ...old, productCode: code }));
    setLookupLoading(true);
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,product_name_pt,product_name_en,brands`, { headers: { "User-Agent": "PromotoresSaaS/1.0 (product barcode lookup)" } });
      if (!response.ok) throw new Error("lookup failed");
      const data = await response.json();
      const p = data?.product;
      const description = p?.product_name_pt || p?.product_name || p?.product_name_en || "";
      if (data?.status === 1 && description) {
        const branded = p?.brands ? `${description} — ${p.brands}` : description;
        setForm(old => ({ ...old, productCode: code, description: branded.slice(0, 500) }));
        toast.success("Código lido e descrição preenchida. Confira os dados antes de salvar.");
      } else {
        toast.info("Código lido. Produto não encontrado no catálogo; informe a descrição manualmente.");
      }
    } catch {
      toast.info("Código lido. Não foi possível consultar o catálogo; informe a descrição manualmente.");
    } finally { setLookupLoading(false); stopCamera(); }
  }
  async function startCamera() {
    setCameraError(""); scannedRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setCameraError("A câmera exige uma conexão segura (HTTPS) e permissão no navegador."); return; }
    setCameraOpen(true);
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) { setCameraError("Não foi possível abrir a visualização da câmera."); setCameraOpen(false); return; }
      const reader = new BrowserMultiFormatReader();
      void reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, video, (result, error, controls) => {
        if (controls && !controlsRef.current) controlsRef.current = controls;
        const code = result?.getText()?.trim();
        if (code && !scannedRef.current) { scannedRef.current = true; controls.stop(); controlsRef.current = null; void lookupBarcode(code); }
      }).then(controls => { if (scannedRef.current) controls.stop(); else controlsRef.current = controls; }).catch(() => { setCameraError("Não foi possível acessar a câmera. Permita o uso da câmera nas configurações do navegador e tente novamente."); stopCamera(); });
    });
  }
  useEffect(() => () => { controlsRef.current?.stop(); }, []);
  useEffect(() => {
    const visibleIds = new Set((products.data || []).map((product) => product.id));
    setSelectedIds((current) => current.filter((id) => visibleIds.has(id)));
  }, [products.data]);
  const submit = () => {
    const data = { productCode: form.productCode.trim(), description: form.description.trim(), quantity: Number(form.quantity), expirationDate: form.expirationDate, price: Number(form.price).toFixed(2) };
    if (editing) update.mutate({ id: editing, ...data }); else create.mutate(data);
  };
  const editProduct = (p: Product) => { setEditing(p.id); setForm({ productCode: p.productCode, description: p.description, quantity: String(p.quantity), expirationDate: dateValue(p.expirationDate), price: Number(p.price).toFixed(2) }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const today = dateValue(new Date());
  const rows = (products.data || []) as Product[];
  const selectedProducts = rows.filter(p => selectedIds.includes(p.id));
  const allSelected = rows.length > 0 && rows.every(p => selectedIds.includes(p.id));
  const toggleAll = () => setSelectedIds(current => allSelected ? current.filter(id => !rows.some(p => p.id === id)) : [...new Set([...current, ...rows.map(p => p.id)])]);
  return <DashboardLayout title="Produtos e validades" description="Cadastre produtos, acompanhe quantidades e receba alertas de validade.">
    <div className="space-y-6">
      <Card className="border-amber-300/25 bg-amber-300/10 text-white"><CardContent className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><div><p className="font-bold">Alerta de validade — próximos 30 dias</p><p className="text-sm text-slate-200">{expiringProducts.isLoading ? "Verificando produtos..." : `${expiringProducts.data?.length || 0} produto(s) vencem nos próximos 30 dias.`}</p></div></div>{Boolean(expiringProducts.data?.length) && <Button onClick={()=>shareProducts(expiringProducts.data as Product[])} className="bg-emerald-600 text-white hover:bg-emerald-500"><MessageCircle className="mr-2 h-4 w-4"/>Compartilhar alertas no WhatsApp</Button>}</CardContent></Card>
    <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil className="h-5 w-5 text-teal-300"/> : <Plus className="h-5 w-5 text-teal-300"/>}{editing ? "Editar produto" : "Cadastrar produto"}</CardTitle></CardHeader><CardContent className="space-y-4">
        <div><Label htmlFor="product-code">Código do produto / código de barras</Label><div className="mt-1 flex gap-2"><Input id="product-code" value={form.productCode} onChange={e=>setForm({...form,productCode:e.target.value})} placeholder="Ex.: 7891234567890" className="border-white/15 bg-slate-950/60 text-white"/><Button type="button" variant="outline" onClick={()=>void startCamera()} disabled={cameraOpen||lookupLoading} className="shrink-0 border-teal-300/40 text-teal-200"><Camera className="mr-2 h-4 w-4"/>Ler código</Button></div></div>
        {cameraError&&<p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">{cameraError}</p>}
        {lookupLoading&&<p className="flex items-center gap-2 text-sm text-teal-200"><Loader2 className="h-4 w-4 animate-spin"/>Consultando catálogo...</p>}
        {cameraOpen&&<div className="space-y-2 rounded-xl border border-teal-300/20 bg-black p-2"><video ref={videoRef} autoPlay muted playsInline className="max-h-64 w-full rounded-lg object-cover"/><div className="flex items-center justify-between text-xs text-slate-300"><span>Enquadre o código de barras</span><Button type="button" size="sm" variant="ghost" onClick={stopCamera} className="text-white"><CameraOff className="mr-1 h-4 w-4"/>Parar</Button></div></div>}
        <div><Label htmlFor="product-description">Descrição</Label><Input id="product-description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} maxLength={500} placeholder="Descrição do produto" className="mt-1 border-white/15 bg-slate-950/60 text-white"/></div>
        <div className="grid grid-cols-2 gap-3"><div><Label htmlFor="product-quantity">Quantidade</Label><Input id="product-quantity" type="number" min="0" step="1" value={form.quantity} onChange={e=>setForm({...form,quantity:e.target.value})} className="mt-1 border-white/15 bg-slate-950/60 text-white"/></div><div><Label htmlFor="product-price">Preço (R$)</Label><Input id="product-price" type="number" min="0" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} className="mt-1 border-white/15 bg-slate-950/60 text-white"/></div></div>
        <div><Label htmlFor="product-expiry">Validade</Label><Input id="product-expiry" type="date" value={form.expirationDate} onChange={e=>setForm({...form,expirationDate:e.target.value})} className="mt-1 border-white/15 bg-slate-950/60 text-white"/></div>
        <div className="flex gap-2">{editing&&<Button type="button" variant="outline" onClick={resetForm} className="border-white/20 text-white"><X className="mr-1 h-4 w-4"/>Cancelar</Button>}<Button type="button" onClick={submit} disabled={create.isPending||update.isPending||!form.productCode.trim()||!form.description.trim()||!form.expirationDate||Number(form.quantity)<0||Number(form.price)<0} className="bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">{create.isPending||update.isPending?<Loader2 className="mr-2 h-4 w-4 animate-spin"/>:<Check className="mr-2 h-4 w-4"/>}{editing?"Salvar alterações":"Cadastrar produto"}</Button></div>
        <p className="text-xs text-slate-400">A câmera lê o código; a descrição é buscada no Open Food Facts quando o produto está no catálogo. Confira e complete a descrição antes de salvar. A leitura exige permissão de câmera e conexão HTTPS.</p>
      </CardContent></Card>
      <Card className="border-white/10 bg-slate-900/70 text-white"><CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-teal-300"/>Estoque e validade</CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><Input aria-label="Buscar produtos" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por código ou descrição" className="border-white/15 bg-slate-950/60 pl-9 text-white"/></div><select aria-label="Filtrar por validade" value={expiry} onChange={e=>setExpiry(e.target.value as typeof expiry)} className="h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-white"><option value="all">Todas as validades</option><option value="near">Vencem em 30 dias</option><option value="expired">Vencidos</option></select></div>
        {selectedIds.length>0&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-300/20 bg-teal-300/5 p-3"><span className="text-sm font-semibold text-teal-100">{selectedIds.length} produto(s) selecionado(s)</span><div className="flex flex-wrap gap-2"><Button size="sm" onClick={()=>shareProducts(selectedProducts)} className="bg-emerald-600 text-white hover:bg-emerald-500"><MessageCircle className="mr-1 h-4 w-4"/>Compartilhar no WhatsApp</Button><Button size="sm" variant="outline" disabled={remove.isPending} onClick={()=>{if(window.confirm(`Enviar ${selectedIds.length} produto(s) à lixeira? Eles poderão ser restaurados por 24 horas.`))remove.mutate({ids:selectedIds});}} className="border-rose-300/30 text-rose-200"><Trash2 className="mr-1 h-4 w-4"/>Excluir selecionados</Button></div></div>}
        {rows.length>0&&<label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={allSelected} onChange={toggleAll}/>Selecionar todos os produtos visíveis</label>}
        {products.isLoading&&<p className="text-sm text-slate-300">Carregando produtos...</p>}{products.isError&&<p role="alert" className="text-sm text-rose-200">Não foi possível carregar os produtos. Atualize a página e tente novamente.</p>}{!products.isLoading&&!products.isError&&!products.data?.length&&<div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300"><Barcode className="mx-auto mb-2 h-8 w-8 text-slate-500"/>Nenhum produto encontrado.</div>}
        <div className="space-y-3">{rows.map(p=>{const date=dateValue(p.expirationDate);const expired=date<today;const near=!expired&&date<=new Date(Date.now()+30*86400000).toISOString().slice(0,10);return <div key={p.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><label className="flex min-w-0 cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={selectedIds.includes(p.id)} onChange={()=>setSelectedIds(old=>old.includes(p.id)?old.filter(id=>id!==p.id):[...old,p.id])} aria-label={`Selecionar ${p.description}`}/><div className="min-w-0"><p className="break-words font-bold text-white">{p.description}</p><p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><Barcode className="h-3 w-3"/>{p.productCode}</p></div></label><Badge className={expired?"bg-rose-500 text-white":near?"bg-amber-400 text-slate-950":"bg-emerald-500/20 text-emerald-200"}>{expired?<><AlertTriangle className="mr-1 h-3 w-3"/>Vencido</>:near?<><AlertTriangle className="mr-1 h-3 w-3"/>Vence em até 30 dias</>:"Em dia"}</Badge></div><div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-400">Quantidade</p><p className="font-semibold">{p.quantity}</p></div><div><p className="text-xs text-slate-400">Validade</p><p className="font-semibold">{dateLabel(p.expirationDate)}</p></div><div><p className="text-xs text-slate-400">Preço</p><p className="font-semibold">{money(p.price)}</p></div></div><div className="mt-3 flex justify-end gap-2"><Button variant="outline" size="sm" onClick={()=>editProduct(p)} className="border-white/15 text-slate-200"><Pencil className="mr-1 h-3.5 w-3.5"/>Editar</Button><Button variant="outline" size="sm" onClick={()=>shareProducts([p])} className="border-emerald-300/20 text-emerald-200"><MessageCircle className="mr-1 h-3.5 w-3.5"/>WhatsApp</Button></div></div>})}</div>
      </CardContent></Card>
    </div>
    </div>
  </DashboardLayout>;
}
