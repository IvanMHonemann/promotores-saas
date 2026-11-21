import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Barcode, Camera, CameraOff, Check, ChevronLeft, ChevronRight, Download, ImageIcon, Loader2, MessageCircle, MoreVertical, Package, Pencil, Plus, Printer, Search, Share2, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useBusy } from "@/components/BusyOverlay";
// O leitor de código de barras (~400 kB) só é baixado quando a câmera é aberta.
import type { IScannerControls } from "@zxing/browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useOfflineQuery } from "@/lib/useOfflineQuery";
import { compressImageFile } from "@/lib/imageCompress";
import { toast } from "sonner";
import { todayInZone, expiryStatus, daysUntil } from "@shared/expiry";
import { isValidGtin, looksNumeric } from "@shared/barcode";
import { ALERT_DAY_OPTIONS, formatDateBR, groupByIndustry, isPastDate, isPlausibleExpiry, productsCsv, situationLabel, storeLabel } from "@shared/products";
import { confirmAction } from "@/components/ConfirmDialog";
import { toastWithUndo } from "@/lib/undoTrash";
import { isCompanyManager } from "@shared/companyAccess";

type Product = {
  id: number; productCode: string; description: string; quantity: number; expirationDate: string; price: string | number;
  storeId: number | null; storeClientId: number | null; lot: string | null; photoKey: string | null;
  storeName: string | null; storeActive: boolean | null; clientName: string | null; createdByName: string | null; canManage: boolean;
};
type Expiry = "all" | "alert" | "expired" | "near" | "valid";
const blank = { productCode: "", description: "", quantity: "1", expirationDate: "", price: "0.00", storeId: "", storeClientId: "", lot: "" };
/** Campos de toque com 44 px no celular (padrão de acessibilidade) e 40 px no computador. */
const field = "h-11 border-white/15 bg-slate-950/60 text-base text-white sm:h-10 sm:text-sm";
const selectCls = "h-11 w-full rounded-md border border-white/15 bg-slate-950/60 px-3 text-base text-white sm:h-10 sm:text-sm";
const money = (v: string | number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
/** Formata o preço para exibição no campo (pt-BR). Vazio quando zero para o usuário começar a digitar sem os zeros. */
const displayPrice = (value: string) => {
  const num = Number(value);
  if (!value || isNaN(num) || num === 0) return "";
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
/** Converte o que o usuário digitou (só dígitos) em valor com 2 casas, estilo caixa registradora. */
const parsePriceDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "0.00";
  return (parseInt(digits, 10) / 100).toFixed(2);
};
const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&", "<": "<", ">": ">", '"': """, "'": "&#39;" })[char]!);

function shareProducts(products: Product[], today: string, alertDays: number) {
  if (!products.length) return;
  const text = ["*Produtos e controle de validade*", ...products.map((p) => [`*${p.description}*`, `*Código:* ${p.productCode}`, p.clientName ? `*Marca/Cliente:* ${p.clientName}` : "", p.storeId ? `*Loja:* ${storeLabel(p)}` : "", p.lot ? `*Lote:* ${p.lot}` : "", `*Quantidade:* ${p.quantity}`, `*Validade:* ${formatDateBR(p.expirationDate)} (${situationLabel(p.expirationDate, today, alertDays)})`].filter(Boolean).join("\n"))].join("\n\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = isCompanyManager(user?.role);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const [expiry, setExpiry] = useState<Expiry>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [storeFilter, setStoreFilter] = useState<number | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState("");
  const [mine, setMine] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const activeFilters = [storeFilter != null, !!industryFilter, !!from, !!to, mine].filter(Boolean).length;
  const [page, setPage] = useState(1);
  const filters = { search: debouncedSearch || undefined, expiry, storeId: storeFilter, clientName: industryFilter || undefined, from: from || undefined, to: to || undefined, mine: mine || undefined };
  useEffect(() => { setPage(1); }, [debouncedSearch, expiry, storeFilter, industryFilter, from, to, mine]);

  // Atalho do roteiro: /produtos?loja=ID&novo=1 já abre o cadastro com a loja da visita.
  const urlParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const urlStoreId = urlParams?.get("loja") && /^\d+$/.test(urlParams.get("loja")!) ? urlParams.get("loja")! : "";
  const [form, setForm] = useState(() => (urlStoreId ? { ...blank, storeId: urlStoreId } : blank));
  const [requestId, setRequestId] = useState(newRequestId);
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(() => Boolean(urlStoreId && urlParams?.get("novo") === "1"));
  const [sequential, setSequential] = useState(true);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const lastWasScanRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scannedRef = useRef(false);
  const utils = trpc.useUtils();

  const settings = trpc.products.settings.useQuery(undefined, { staleTime: 60000 });
  const stores = trpc.products.stores.useQuery(undefined, { staleTime: 60000 });
  const industries = trpc.products.industries.useQuery(undefined, { staleTime: 60000 });
  const formStoreId = form.storeId ? Number(form.storeId) : 0;
  const storeClients = trpc.products.storeClients.useQuery({ storeId: formStoreId }, { enabled: formStoreId > 0, staleTime: 60000 });
  const productsQuery = trpc.products.list.useQuery({ ...filters, page }, { staleTime: 15000, placeholderData: (prev) => prev });
  const products = useOfflineQuery(productsQuery, "products-page");
  const summary = trpc.products.summary.useQuery(undefined, { staleTime: 30000 });
  const alertDays = summary.data?.alertDays ?? settings.data?.alertDays ?? 30;
  const { run } = useBusy();
  const invalidate = () => { void utils.products.list.invalidate(); void utils.products.summary.invalidate(); void utils.products.industries.invalidate(); void utils.inventoryAlerts.invalidate(); };

  const setAlertDays = trpc.products.setAlertDays.useMutation({ onSuccess: (r) => { toast.success(`Alerta passa a avisar ${r.alertDays} dias antes do vencimento.`); void utils.products.invalidate(); void utils.inventoryAlerts.invalidate(); }, onError: (e) => toast.error(e.message) });
  const exportCsv = trpc.products.exportCsv.useMutation();
  const create = trpc.products.create.useMutation();
  const update = trpc.products.update.useMutation();
  const restoreTrash = trpc.trash.restore.useMutation();
  const remove = trpc.products.deleteMany.useMutation({
    onSuccess: (result, vars) => {
      toastWithUndo({ message: `${result.deleted} produto(s) enviado(s) à lixeira.`, itemType: "product", originalIds: vars.ids, fetchTrash: () => utils.trash.list.fetch() as any, restore: (id) => restoreTrash.mutateAsync({ id }), onRestored: () => { invalidate(); void utils.trash.list.invalidate(); } });
      setSelectedIds([]); if (editing) resetForm(); invalidate(); void utils.trash.list.invalidate();
    },
    onError: (e) => toast.error(e.message || "Não foi possível enviar os produtos à lixeira."),
  });

  function clearPhoto() { if (photo) URL.revokeObjectURL(photo.preview); setPhoto(null); }
  function resetForm() { setForm(blank); setEditing(null); setFormOpen(false); clearPhoto(); setRemovePhoto(false); setRequestId(newRequestId()); }
  /** Cadastro em sequência: mantém loja/indústria/preço e já prepara o próximo item. */
  function nextItem() {
    setForm((old) => ({ ...blank, storeId: old.storeId, storeClientId: old.storeClientId }));
    clearPhoto(); setRequestId(newRequestId());
    if (lastWasScanRef.current) window.setTimeout(() => void startCamera(), 150);
    else window.setTimeout(() => document.getElementById("product-code")?.focus(), 100);
  }
  function stopCamera() { controlsRef.current?.stop(); controlsRef.current = null; setCameraOpen(false); }
  async function lookupBarcode(code: string, fromScan: boolean) {
    lastWasScanRef.current = fromScan;
    setForm((old) => ({ ...old, productCode: code }));
    setLookupLoading(true);
    try {
      const r = await utils.products.lookupByCode.fetch({ code });
      if (r.found && r.description) {
        setForm((old) => ({ ...old, productCode: code, description: r.description, price: r.price && Number(old.price) === 0 ? Number(r.price).toFixed(2) : old.price }));
        toast.success(r.source === "company" ? "Produto já conhecido. Informe a validade." : "Código lido. Confira a descrição e informe a validade.");
        window.setTimeout(() => document.getElementById("product-expiry")?.focus(), 100);
      } else {
        toast.info("Código lido, mas o produto não está nos catálogos. Informe a descrição: da próxima vez ele será reconhecido.");
        window.setTimeout(() => document.getElementById("product-description")?.focus(), 100);
      }
    } catch {
      toast.info("Código lido. Não foi possível consultar os catálogos agora; informe a descrição.");
      window.setTimeout(() => document.getElementById("product-description")?.focus(), 100);
    } finally { setLookupLoading(false); stopCamera(); }
  }
  async function startCamera() {
    setCameraError(""); scannedRef.current = false;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) { setCameraError("A câmera exige uma conexão segura (HTTPS) e permissão no navegador."); return; }
    setCameraOpen(true);
    requestAnimationFrame(async () => {
      const video = videoRef.current;
      if (!video) { setCameraError("Não foi possível abrir a visualização da câmera."); setCameraOpen(false); return; }
      let BrowserMultiFormatReader: typeof import("@zxing/browser").BrowserMultiFormatReader;
      try { ({ BrowserMultiFormatReader } = await import("@zxing/browser")); }
      catch { setCameraError("Não foi possível carregar o leitor de código de barras. Verifique a internet e tente novamente."); stopCamera(); return; }
      if (!video.isConnected) return; // a câmera foi fechada enquanto o leitor carregava
      const reader = new BrowserMultiFormatReader();
      void reader.decodeFromConstraints({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" } as any] }, audio: false }, video, (result, _error, controls) => {
        if (controls && !controlsRef.current) controlsRef.current = controls;
        const code = result?.getText()?.trim();
        if (code && !scannedRef.current && (!looksNumeric(code) || isValidGtin(code))) { scannedRef.current = true; controls.stop(); controlsRef.current = null; navigator.vibrate?.(60); void lookupBarcode(code, true); }
      }).then((controls) => { if (scannedRef.current) controls.stop(); else controlsRef.current = controls; }).catch(() => { setCameraError("Não foi possível acessar a câmera. Permita o uso da câmera nas configurações do navegador e tente novamente."); stopCamera(); });
    });
  }
  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  const today = todayInZone();
  const rows = ((products.data as any)?.items || []) as Product[];
  const total = Number((products.data as any)?.total ?? 0);
  const pages = Number((products.data as any)?.pages ?? 1);
  useEffect(() => { const visible = new Set(rows.map((p) => p.id)); setSelectedIds((cur) => cur.filter((id) => visible.has(id))); }, [products.data]); // eslint-disable-line react-hooks/exhaustive-deps

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const { blob, base64 } = await compressImageFile(file);
      clearPhoto(); setPhoto({ base64, preview: URL.createObjectURL(blob) }); setRemovePhoto(false);
    } catch (e: any) { toast.error(e?.message || "Não foi possível usar essa foto."); }
  }

  const canSubmit = form.productCode.trim() && form.description.trim() && form.expirationDate && Number(form.quantity) >= 0 && Number(form.price) >= 0;
  async function submit(goNext: boolean) {
    if (!isPlausibleExpiry(form.expirationDate)) { toast.error("Confira a data de validade (dd/mm/aaaa)."); return; }
    if (isPastDate(form.expirationDate, today) && (!editing || editing.expirationDate !== form.expirationDate)) {
      const ok = await confirmAction({ title: "Essa validade já passou", description: `A data ${formatDateBR(form.expirationDate)} é anterior a hoje. O produto será registrado como vencido. Confirma?`, confirmLabel: "Sim, registrar vencido" });
      if (!ok) { document.getElementById("product-expiry")?.focus(); return; }
    }
    const data = {
      productCode: form.productCode.trim(), description: form.description.trim(), quantity: Math.trunc(Number(form.quantity) || 0), expirationDate: form.expirationDate,
      price: Number(form.price || 0).toFixed(2), storeId: form.storeId ? Number(form.storeId) : null, storeClientId: form.storeClientId ? Number(form.storeClientId) : null,
      lot: form.lot.trim() || null, photoBase64: photo?.base64,
    };
    try {
      if (editing) {
        await run("Salvando produto...", () => update.mutateAsync({ id: editing.id, ...data, removePhoto }));
        toast.success("Produto atualizado."); resetForm();
      } else {
        const r = await run("Salvando...", () => create.mutateAsync({ ...data, clientRequestId: requestId }));
        if (r.merged) toast.success(`Já existia com a mesma loja, marca/cliente, lote e validade: quantidade somada (agora ${r.product?.quantity ?? "?"}).`);
        else toast.success(r.duplicate ? "Esse cadastro já tinha sido salvo." : "Produto cadastrado.");
        if (goNext) nextItem(); else resetForm();
      }
      invalidate();
    } catch (e: any) { toast.error(e?.message || "Não foi possível salvar o produto."); }
  }

  const editProduct = (p: Product) => {
    setEditing(p); setFormOpen(true); clearPhoto(); setRemovePhoto(false);
    setForm({ productCode: p.productCode, description: p.description, quantity: String(p.quantity), expirationDate: p.expirationDate, price: Number(p.price).toFixed(2), storeId: p.storeId ? String(p.storeId) : "", storeClientId: p.storeClientId ? String(p.storeClientId) : "", lot: p.lot || "" });
    setTimeout(() => document.getElementById("produto-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };
  const confirmRemove = (ids: number[], label?: string) => {
    const what = ids.length === 1 && label ? `o produto "${label}"` : `${ids.length} produto(s)`;
    void confirmAction({ title: `Enviar ${what} para a lixeira?`, description: "Você pode desfazer agora ou restaurar pela Lixeira em até 5 dias.", confirmLabel: "Enviar para a lixeira" }).then((ok) => { if (ok) void run("Enviando para a lixeira...", () => remove.mutateAsync({ ids })).catch(() => {}); });
  };
  const openPhoto = async (p: Product) => {
    try { const { url } = await utils.products.photoUrl.fetch({ id: p.id }); window.open(url, "_blank", "noopener,noreferrer"); }
    catch { toast.error("Não foi possível abrir a foto da etiqueta."); }
  };

  const fetchReport = () => utils.products.report.fetch({ storeId: storeFilter, clientName: industryFilter || undefined, mine: mine || undefined });
  const printReport = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Permita pop-ups para imprimir o relatório."); return; }
    let report;
    try { report = await fetchReport(); } catch { printWindow.close(); toast.error("Não foi possível gerar o relatório."); return; }
    if (!report.items.length) { printWindow.close(); toast.info("Nenhum produto vencido ou a vencer."); return; }
    const groups = groupByIndustry(report.items as Product[]);
    const body = groups.map((g) => `<h2>${escapeHtml(g.name)} <small>(${g.items.length})</small></h2><table><thead><tr><th>Loja</th><th>Código</th><th>Descrição</th><th>Lote</th><th>Qtd.</th><th>Validade</th><th>Situação</th></tr></thead><tbody>${g.items.map((p) => `<tr><td>${escapeHtml(storeLabel(p))}</td><td>${escapeHtml(p.productCode)}</td><td>${escapeHtml(p.description)}</td><td>${escapeHtml(p.lot || "")}</td><td>${p.quantity}</td><td>${formatDateBR(p.expirationDate)}</td><td>${situationLabel(p.expirationDate, report.today, report.alertDays)}</td></tr>`).join("")}</tbody></table>`).join("");
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Produtos vencidos e a vencer</title><style>body{font:13px Arial,sans-serif;color:#111;padding:24px}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:18px 0 6px}p{color:#444;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:6px;text-align:left;vertical-align:top}th{background:#e8eef2}tr{break-inside:avoid}@media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style></head><body><h1>Produtos vencidos e com validade em até ${report.alertDays} dias</h1><p>Emitido em ${formatDateBR(report.today)} (horário de Brasília) · ${report.items.length} item(ns)</p>${body}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => { printWindow.print(); }, 250);
  };

  const doExport = async () => {
    try {
      const r = await run("Gerando CSV...", () => exportCsv.mutateAsync(filters));
      downloadCsv(r.csv, `produtos-${today}.csv`);
      toast.success("CSV baixado.");
    } catch (e: any) { toast.error(e?.message || "Não foi possível exportar."); }
  };

  const storeOptions = (stores.data || []).filter((st) => st.active || (editing && String(st.id) === form.storeId));
  const editingStoreRemoved = editing && form.storeId && !(stores.data || []).some((st) => String(st.id) === form.storeId);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Estoque e validade</h1>
            <p className="text-sm text-slate-400">Controle de produtos, validades e alertas.</p>
          </div>
          <div className="flex gap-2">
            {isAdmin && <Button type="button" variant="outline" onClick={() => void printReport()} className="h-11 border-white/20 text-white"><Printer className="mr-1 h-4 w-4"/>Relatório</Button>}
            <Button type="button" onClick={() => { if (formOpen && !editing) resetForm(); else { setFormOpen(true); setEditing(null); setForm(blank); } }} className="h-11 bg-teal-300 font-bold text-slate-950 hover:bg-teal-200"><Plus className="mr-1 h-4 w-4"/>{formOpen && !editing ? "Fechar" : "Novo produto"}</Button>
          </div>
        </div>

        {formOpen && (
          <Card id="produto-form" className="order-first border-white/10 bg-slate-900/70 text-white xl:order-none"><CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil className="h-5 w-5 text-teal-300"/> : <Plus className="h-5 w-5 text-teal-300"/>}{editing ? "Editar produto" : "Cadastrar produto"}</CardTitle></CardHeader><CardContent className="space-y-4">
            <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(sequential && !editing); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="product-store">Loja</Label><select id="product-store" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value, storeClientId: "" })} className={`mt-1 ${selectCls}`}><option value="">Sem loja</option>{storeOptions.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select></div>
              <div><Label htmlFor="product-client">Marca/Cliente</Label><select id="product-client" value={form.storeClientId} disabled={!form.storeId} onChange={(e) => setForm({ ...form, storeClientId: e.target.value })} className={`mt-1 ${selectCls} disabled:opacity-50`}><option value="">{form.storeId ? "Sem marca/cliente" : "Escolha a loja"}</option>{(storeClients.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{editing?.storeClientId && form.storeClientId === String(editing.storeClientId) && !(storeClients.data || []).some((c) => c.id === editing.storeClientId) && <option value={editing.storeClientId}>{editing.clientName || "Marca/cliente removida"}</option>}</select></div>
            </div>
            {editingStoreRemoved && <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-200">A loja deste produto foi removida. Você pode manter assim ou escolher outra loja.</p>}
            <Button type="button" onClick={() => void startCamera()} disabled={cameraOpen || lookupLoading} className="h-12 w-full bg-teal-300 text-base font-bold text-slate-950 hover:bg-teal-200"><Camera className="mr-2 h-5 w-5"/>Ler código de barras</Button>
            {cameraError && <p role="alert" className="rounded-lg bg-amber-500/10 p-3 text-sm text-amber-200">{cameraError}</p>}
            {lookupLoading && <p className="flex items-center gap-2 text-sm text-teal-200"><Loader2 className="h-4 w-4 animate-spin"/>Consultando catálogo...</p>}
            {cameraOpen && <div className="space-y-2 rounded-xl border border-teal-300/20 bg-black p-2"><video ref={videoRef} autoPlay muted playsInline className="max-h-64 w-full rounded-lg object-cover"/><div className="flex items-center justify-between text-xs text-slate-300"><span>Enquadre o código de barras</span><Button type="button" variant="ghost" onClick={stopCamera} className="h-11 text-white"><CameraOff className="mr-1 h-4 w-4"/>Parar</Button></div></div>}
            <div><Label htmlFor="product-code">Código / EAN</Label><Input id="product-code" inputMode="numeric" autoComplete="off" value={form.productCode} onChange={(e) => setForm({ ...form, productCode: e.target.value })} onBlur={() => { const c = form.productCode.trim(); if (c.length >= 8 && !form.description && (!looksNumeric(c) || isValidGtin(c))) void lookupBarcode(c, false); }} placeholder="Ex.: 7891234567890" className={`mt-1 ${field}`}/></div>
            <div><Label htmlFor="product-description">Descrição</Label><Input id="product-description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} placeholder="Descrição do produto" className={`mt-1 ${field}`}/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="product-expiry">Validade</Label><Input id="product-expiry" type="date" value={form.expirationDate} onChange={(e) => setForm({ ...form, expirationDate: e.target.value })} className={`mt-1 ${field}`}/>{form.expirationDate && isPlausibleExpiry(form.expirationDate) && <p className={`mt-1 text-xs ${isPastDate(form.expirationDate, today) ? "text-rose-300" : "text-slate-400"}`}>{formatDateBR(form.expirationDate)} · {situationLabel(form.expirationDate, today, alertDays)}</p>}</div>
              <div><Label htmlFor="product-quantity">Quantidade</Label><Input id="product-quantity" type="number" inputMode="numeric" min="0" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={`mt-1 ${field}`}/></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="product-lot">Lote (opcional)</Label><Input id="product-lot" value={form.lot} maxLength={64} onChange={(e) => setForm({ ...form, lot: e.target.value })} placeholder="Ex.: L2345" className={`mt-1 ${field} uppercase`}/></div>
              <div><Label htmlFor="product-price">Preço (R$)</Label><Input id="product-price" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" value={displayPrice(form.price)} onChange={(e) => setForm({ ...form, price: parsePriceDigits(e.target.value) })} className={`mt-1 ${field}`}/></div>
            </div>
            <div><Label>Foto da etiqueta (opcional)</Label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-white/20 px-3 text-sm text-slate-100 sm:h-10"><ImageIcon className="mr-2 h-4 w-4"/>{photo ? "Trocar foto" : "Tirar foto"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }}/></label>
                {photo && <><img src={photo.preview} alt="Etiqueta" className="h-11 w-11 rounded object-cover"/><Button type="button" variant="ghost" onClick={clearPhoto} className="h-11 text-slate-300">Remover</Button></>}
                {!photo && editing?.photoKey && !removePhoto && <><Button type="button" variant="ghost" onClick={() => void openPhoto(editing)} className="h-11 text-teal-200">Ver foto atual</Button><Button type="button" variant="ghost" onClick={() => setRemovePhoto(true)} className="h-11 text-rose-200">Apagar foto</Button></>}
                {removePhoto && <span className="text-xs text-rose-200">A foto será apagada ao salvar.</span>}
              </div></div>
            {!editing && <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="h-5 w-5" checked={sequential} onChange={(e) => setSequential(e.target.checked)}/>Cadastro rápido: depois de salvar, já abrir o próximo (mantém loja e marca/cliente)</label>}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={resetForm} className="h-11 border-white/20 text-white"><X className="mr-1 h-4 w-4"/>{editing ? "Cancelar" : "Fechar"}</Button>
              {editing && editing.canManage && <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => confirmRemove([editing.id], form.description)} className="h-11 border-rose-300/30 text-rose-200"><Trash2 className="mr-1 h-4 w-4"/>Excluir</Button>}
              <Button type="submit" disabled={create.isPending || update.isPending || !canSubmit} className="h-11 flex-1 bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">{create.isPending || update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}{editing ? "Salvar alterações" : sequential ? "Salvar e próximo" : "Cadastrar produto"}</Button>
            </div>
            </form>
            <p className="text-xs text-slate-400">Mesmo produto, loja, marca/cliente, lote e validade: a quantidade é somada ao registro que já existe.</p>
          </CardContent></Card>
        )}
        <Card className="order-1 border-white/10 bg-slate-900/70 text-white xl:order-none"><CardHeader><CardTitle className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Package className="h-5 w-5 text-teal-300"/>Estoque e validade</span><DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="outline" aria-label="Mais opções" className="h-11 border-white/20 px-3 text-white sm:h-9"><MoreVertical className="h-5 w-5"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={exportCsv.isPending} onSelect={() => void doExport()}><Download className="mr-2 h-4 w-4"/>Exportar CSV</DropdownMenuItem></DropdownMenuContent></DropdownMenu></CardTitle></CardHeader><CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 sm:top-3"/><Input aria-label="Buscar produtos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto ou código" className={`${field} pl-9`}/></div>
            <div className="flex flex-wrap items-center gap-2">
              {(["all", "alert", "expired", "near", "valid"] as Expiry[]).map((k) => <Button key={k} type="button" variant={expiry === k ? "default" : "outline"} onClick={() => setExpiry(k)} className={`h-9 text-xs ${expiry === k ? "bg-teal-300 text-slate-950" : "border-white/20 text-white"}`}>{k === "all" ? "Todos" : k === "alert" ? "A vencer" : k === "expired" ? "Vencidos" : k === "near" ? "Próximos" : "Válidos"}</Button>)}
              <Button type="button" variant="outline" onClick={() => setShowFilters((v) => !v)} className="h-9 border-white/20 text-xs text-white">Filtros {activeFilters > 0 && `(${activeFilters})`}</Button>
            </div>
            {showFilters && <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 p-3 sm:grid-cols-4">
              <select value={storeFilter ?? ""} onChange={(e) => setStoreFilter(e.target.value ? Number(e.target.value) : undefined)} className={selectCls}><option value="">Todas as lojas</option>{(stores.data || []).map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select>
              <select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className={selectCls}><option value="">Todas as marcas</option>{(industries.data || []).map((i) => <option key={i} value={i}>{i}</option>)}</select>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field} placeholder="De"/>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field} placeholder="Até"/>
              <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4"/>Somente os que eu cadastrei</label>
            </div>}
          </div>
          {summary.data && <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Total</p><p className="text-lg font-bold">{summary.data.total}</p></div>
            <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">A vencer</p><p className="text-lg font-bold text-amber-300">{summary.data.near}</p></div>
            <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Vencidos</p><p className="text-lg font-bold text-rose-300">{summary.data.expired}</p></div>
            <div className="rounded-lg bg-white/5 p-2"><p className="text-xs text-slate-400">Válidos</p><p className="text-lg font-bold text-teal-300">{summary.data.valid}</p></div>
          </div>}
          {isAdmin && <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">Avisar com antecedência de</span>
            <select value={alertDays} onChange={(e) => setAlertDays.mutate({ alertDays: Number(e.target.value) })} className={`${selectCls} w-auto`}>
              {ALERT_DAY_OPTIONS.map((d) => <option key={d} value={d}>{d} dias</option>)}
            </select>
          </div>}
          <div className="space-y-2">
            {products.isLoading && <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin"/>Carregando produtos...</p>}
            {!products.isLoading && rows.length === 0 && <p className="py-8 text-center text-sm text-slate-400">Nenhum produto encontrado.</p>}
            {rows.map((p) => {
              const status = expiryStatus(p.expirationDate, today, alertDays);
              const days = daysUntil(p.expirationDate, today);
              return (
                <div key={p.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedIds.includes(p.id)} onChange={(e) => setSelectedIds((cur) => e.target.checked ? [...cur, p.id] : cur.filter((id) => id !== p.id))} className="h-4 w-4"/>
                        <p className="truncate font-semibold">{p.description}</p>
                        {status === "expired" && <Badge variant="destructive" className="text-[10px]">Vencido</Badge>}
                        {status === "near" && <Badge className="bg-amber-500/20 text-[10px] text-amber-200">A vencer</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">{p.productCode} {p.lot && `· Lote ${p.lot}`} {p.clientName && `· ${p.clientName}`}</p>
                      {p.storeName && <p className="text-xs text-slate-500">{p.storeName}</p>}
                    </div>
                    <DropdownMenu><DropdownMenuTrigger asChild><Button type="button" variant="ghost" className="h-8 w-8 p-0 text-slate-300"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => editProduct(p)}><Pencil className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                      {p.photoKey && <DropdownMenuItem onSelect={() => void openPhoto(p)}><ImageIcon className="mr-2 h-4 w-4"/>Ver foto</DropdownMenuItem>}
                      <DropdownMenuItem onSelect={() => confirmRemove([p.id], p.description)} className="text-rose-300"><Trash2 className="mr-2 h-4 w-4"/>Excluir</DropdownMenuItem>
                    </DropdownMenuContent></DropdownMenu>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-400">Quantidade</p><p className="font-semibold">{p.quantity}</p></div><div><p className="text-xs text-slate-400">Validade</p><p className="font-semibold">{formatDateBR(p.expirationDate)}</p></div><div><p className="text-xs text-slate-400">Preço</p><p className="font-semibold">{money(p.price)}</p></div></div>
                  {status !== "valid" && <p className={`mt-1 text-xs ${status === "expired" ? "text-rose-300" : "text-amber-300"}`}>{days < 0 ? `Vencido há ${Math.abs(days)} dias` : days === 0 ? "Vence hoje" : `Vence em ${days} dias`}</p>}
                </div>
              );
            })}
          </div>
          {pages > 1 && <div className="flex items-center justify-between text-sm">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="border-white/20 text-white"><ChevronLeft className="h-4 w-4"/></Button>
            <span className="text-slate-400">Página {page} de {pages} · {total} itens</span>
            <Button type="button" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="border-white/20 text-white"><ChevronRight className="h-4 w-4"/></Button>
          </div>}
          {selectedIds.length > 0 && <div className="flex items-center justify-between rounded-lg bg-white/5 p-3">
            <span className="text-sm">{selectedIds.length} selecionado(s)</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => shareProducts(rows.filter((p) => selectedIds.includes(p.id)), today, alertDays)} className="h-9 border-white/20 text-white"><MessageCircle className="mr-1 h-4 w-4"/>WhatsApp</Button>
              <Button type="button" variant="outline" onClick={() => confirmRemove(selectedIds)} className="h-9 border-rose-300/30 text-rose-200"><Trash2 className="mr-1 h-4 w-4"/>Excluir</Button>
            </div>
          </div>}
        </CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
