import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Barcode, Camera, CameraOff, Check, ChevronLeft, ChevronRight, Download, ImageIcon, Loader2, MessageCircle, Package, Pencil, Plus, Printer, Search, Share2, Trash2, X } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useBusy } from "@/components/BusyOverlay";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
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
const newRequestId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

function shareProducts(products: Product[], today: string, alertDays: number) {
  if (!products.length) return;
  const text = ["*Produtos e controle de validade*", ...products.map((p) => [`*${p.description}*`, `*Código:* ${p.productCode}`, p.clientName ? `*Indústria:* ${p.clientName}` : "", p.storeId ? `*Loja:* ${storeLabel(p)}` : "", p.lot ? `*Lote:* ${p.lot}` : "", `*Quantidade:* ${p.quantity}`, `*Validade:* ${formatDateBR(p.expirationDate)} (${situationLabel(p.expirationDate, today, alertDays)})`].filter(Boolean).join("\n"))].join("\n\n");
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
function downloadCsv(csv: string, filename: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = filename; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(search.trim()), 350); return () => clearTimeout(t); }, [search]);
  const [expiry, setExpiry] = useState<Expiry>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [storeFilter, setStoreFilter] = useState<number | undefined>(undefined);
  const [industryFilter, setIndustryFilter] = useState("");
  const [mine, setMine] = useState(false);
  const [page, setPage] = useState(1);
  const filters = { search: debouncedSearch || undefined, expiry, storeId: storeFilter, clientName: industryFilter || undefined, from: from || undefined, to: to || undefined, mine: mine || undefined };
  useEffect(() => { setPage(1); }, [debouncedSearch, expiry, storeFilter, industryFilter, from, to, mine]);

  const [form, setForm] = useState(blank);
  const [requestId, setRequestId] = useState(newRequestId);
  const [photo, setPhoto] = useState<{ base64: string; preview: string } | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
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
    requestAnimationFrame(() => {
      const video = videoRef.current;
      if (!video) { setCameraError("Não foi possível abrir a visualização da câmera."); setCameraOpen(false); return; }
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
        if (r.merged) toast.success(`Já existia com a mesma loja, indústria, lote e validade: quantidade somada (agora ${r.product?.quantity ?? "?"}).`);
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
    printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Produtos vencidos e a vencer</title><style>body{font:13px Arial,sans-serif;color:#111;padding:24px}h1{font-size:20px;margin:0 0 6px}h2{font-size:15px;margin:18px 0 6px}p{color:#444;margin:0 0 12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #aaa;padding:6px;text-align:left;vertical-align:top}th{background:#e8eef2}tr{break-inside:avoid}@media print{body{padding:0}@page{size:A4 portrait;margin:12mm}}</style></head><body><h1>Produtos vencidos e com validade em até ${report.alertDays} dias</h1><p>Emitido em ${formatDateBR(report.today)} (horário de Brasília) · ${report.items.length} produto(s), agrupados por indústria${report.truncated ? " · lista limitada a 5.000 itens" : ""}</p>${body}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></body></html>`);
    printWindow.document.close();
  };
  const shareReportFile = async () => {
    let report;
    try { report = await fetchReport(); } catch { toast.error("Não foi possível gerar o relatório."); return; }
    if (!report.items.length) { toast.info("Nenhum produto vencido ou a vencer."); return; }
    const file = new File([productsCsv(report.items, report.today, report.alertDays)], `produtos-vencidos-e-a-vencer-${report.today}.csv`, { type: "text/csv;charset=utf-8" });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Produtos vencidos e a vencer" }); } catch (error) { if ((error as DOMException).name !== "AbortError") toast.error("Não foi possível abrir o compartilhamento do arquivo."); }
      return;
    }
    downloadCsv(await file.text(), file.name);
    toast.info("Arquivo CSV baixado. Anexe-o na conversa do WhatsApp.");
  };
  const doExport = async () => {
    try {
      const r = await run("Gerando planilha...", () => exportCsv.mutateAsync(filters));
      downloadCsv(r.csv, r.filename);
      toast.success(`${r.count} produto(s) exportado(s)${r.truncated ? " (limite de 10 mil linhas: use filtros)" : ""}.`);
    } catch (e: any) { toast.error(e?.message || "Não foi possível exportar."); }
  };

  const manageable = rows.filter((p) => p.canManage);
  const selectedProducts = rows.filter((p) => selectedIds.includes(p.id));
  const allSelected = manageable.length > 0 && manageable.every((p) => selectedIds.includes(p.id));
  const toggleAll = () => setSelectedIds((cur) => allSelected ? cur.filter((id) => !manageable.some((p) => p.id === id)) : [...new Set([...cur, ...manageable.map((p) => p.id)])]);
  const editingStoreRemoved = Boolean(editing?.storeId && (editing.storeActive === false || !editing.storeName));
  const storeOptions = useMemo(() => {
    const list = (stores.data || []) as Array<{ id: number; name: string }>;
    return editingStoreRemoved && editing?.storeId ? [...list, { id: editing.storeId, name: storeLabel(editing) }] : list;
  }, [stores.data, editingStoreRemoved, editing]);

  return <DashboardLayout title="Produtos e validades" description="Cadastre produtos por loja e indústria, acompanhe lotes e receba alertas de validade.">
    <div className="space-y-6">
      <Card className="border-amber-300/25 bg-amber-300/10 text-white"><CardContent className="flex flex-col justify-between gap-3 p-4 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300"/><div>
          <p className="font-bold">Alerta de validade: vencidos e próximos {alertDays} dias</p>
          <p className="text-sm text-slate-200">{summary.isLoading ? "Verificando produtos..." : summary.isError ? "Não foi possível verificar agora." : <><button type="button" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline sm:min-h-0" onClick={() => setExpiry("expired")}>{summary.data?.expired ?? 0} vencido(s)</button> · <button type="button" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline sm:min-h-0" onClick={() => setExpiry("near")}>{summary.data?.near ?? 0} vencem em até {alertDays} dias</button></>}</p>
          {isAdmin && <label className="mt-2 flex items-center gap-2 text-xs text-amber-100">Avisar com
            <select aria-label="Prazo do alerta de validade" value={alertDays} disabled={setAlertDays.isPending} onChange={(e) => setAlertDays.mutate({ days: Number(e.target.value) })} className="h-11 rounded-md border border-white/20 bg-slate-950/60 px-2 text-sm text-white sm:h-8">
              {[...new Set([...ALERT_DAY_OPTIONS, alertDays])].sort((a, b) => a - b).map((d) => <option key={d} value={d}>{d} dias</option>)}
            </select> de antecedência</label>}
        </div></div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void printReport()} variant="outline" className="h-11 border-white/25 text-white sm:h-10"><Printer className="mr-2 h-4 w-4"/>Imprimir por indústria</Button>
          <Button onClick={() => void shareReportFile()} className="h-11 bg-emerald-600 text-white hover:bg-emerald-500 sm:h-10"><Share2 className="mr-2 h-4 w-4"/>Compartilhar arquivo</Button>
        </div>
      </CardContent></Card>

    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      {formOpen ? (
      <Card id="produto-form" className="order-first border-white/10 bg-slate-900/70 text-white xl:order-none"><CardHeader><CardTitle className="flex items-center gap-2">{editing ? <Pencil className="h-5 w-5 text-teal-300"/> : <Plus className="h-5 w-5 text-teal-300"/>}{editing ? "Editar produto" : "Cadastrar produto"}</CardTitle></CardHeader><CardContent className="space-y-4">
        <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) void submit(sequential && !editing); }} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="product-store">Loja</Label><select id="product-store" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.target.value, storeClientId: "" })} className={`mt-1 ${selectCls}`}><option value="">Sem loja</option>{storeOptions.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</select></div>
          <div><Label htmlFor="product-client">Indústria</Label><select id="product-client" value={form.storeClientId} disabled={!form.storeId} onChange={(e) => setForm({ ...form, storeClientId: e.target.value })} className={`mt-1 ${selectCls} disabled:opacity-50`}><option value="">{form.storeId ? "Sem indústria" : "Escolha a loja"}</option>{(storeClients.data || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}{editing?.storeClientId && form.storeClientId === String(editing.storeClientId) && !(storeClients.data || []).some((c) => c.id === editing.storeClientId) && <option value={editing.storeClientId}>{editing.clientName || "Indústria removida"}</option>}</select></div>
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
          <div><Label htmlFor="product-price">Preço (R$)</Label><Input id="product-price" type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={`mt-1 ${field}`}/></div>
        </div>
        <div><Label>Foto da etiqueta (opcional)</Label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-white/20 px-3 text-sm text-slate-100 sm:h-10"><ImageIcon className="mr-2 h-4 w-4"/>{photo ? "Trocar foto" : "Tirar foto"}<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void pickPhoto(e.target.files?.[0]); e.target.value = ""; }}/></label>
            {photo && <><img src={photo.preview} alt="Etiqueta" className="h-11 w-11 rounded object-cover"/><Button type="button" variant="ghost" onClick={clearPhoto} className="h-11 text-slate-300">Remover</Button></>}
            {!photo && editing?.photoKey && !removePhoto && <><Button type="button" variant="ghost" onClick={() => void openPhoto(editing)} className="h-11 text-teal-200">Ver foto atual</Button><Button type="button" variant="ghost" onClick={() => setRemovePhoto(true)} className="h-11 text-rose-200">Apagar foto</Button></>}
            {removePhoto && <span className="text-xs text-rose-200">A foto será apagada ao salvar.</span>}
          </div></div>
        {!editing && <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200"><input type="checkbox" className="h-5 w-5" checked={sequential} onChange={(e) => setSequential(e.target.checked)}/>Cadastro rápido: depois de salvar, já abrir o próximo (mantém loja e indústria)</label>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={resetForm} className="h-11 border-white/20 text-white"><X className="mr-1 h-4 w-4"/>{editing ? "Cancelar" : "Fechar"}</Button>
          {editing && editing.canManage && <Button type="button" variant="outline" disabled={remove.isPending} onClick={() => confirmRemove([editing.id], form.description)} className="h-11 border-rose-300/30 text-rose-200"><Trash2 className="mr-1 h-4 w-4"/>Excluir</Button>}
          <Button type="submit" disabled={create.isPending || update.isPending || !canSubmit} className="h-11 flex-1 bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">{create.isPending || update.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4"/>}{editing ? "Salvar alterações" : sequential ? "Salvar e próximo" : "Cadastrar produto"}</Button>
        </div>
        </form>
        <p className="text-xs text-slate-400">Mesmo produto, loja, indústria, lote e validade: a quantidade é somada ao registro que já existe.</p>
      </CardContent></Card>
      ) : (
        <div className="order-2 xl:order-none"><Button type="button" onClick={() => { setFormOpen(true); setRequestId(newRequestId()); }} className="h-12 w-full bg-teal-300 text-base font-bold text-slate-950 hover:bg-teal-200"><Plus className="mr-2 h-5 w-5"/>Cadastrar produto</Button></div>
      )}
      <Card className="order-1 border-white/10 bg-slate-900/70 text-white xl:order-none"><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><Package className="h-5 w-5 text-teal-300"/>Estoque e validade</span><Button type="button" variant="outline" onClick={() => void doExport()} disabled={exportCsv.isPending} className="h-11 border-white/20 text-sm text-white sm:h-9"><Download className="mr-1 h-4 w-4"/>Exportar CSV</Button></CardTitle></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="relative sm:col-span-2 lg:col-span-3"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 sm:top-3"/><Input aria-label="Buscar produtos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, descrição ou lote" className={`${field} pl-9`}/></div>
          <select aria-label="Filtrar por loja" value={storeFilter ?? ""} onChange={(e) => setStoreFilter(e.target.value ? Number(e.target.value) : undefined)} className={selectCls}><option value="">Todas as lojas</option>{(stores.data || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <select aria-label="Filtrar por indústria" value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)} className={selectCls}><option value="">Todas as indústrias</option>{(industries.data || []).map((n) => <option key={n} value={n}>{n}</option>)}<option value="__none__">Sem indústria</option></select>
          <select aria-label="Filtrar por validade" value={expiry} onChange={(e) => setExpiry(e.target.value as Expiry)} className={selectCls}><option value="all">Todas as validades</option><option value="alert">Vencidos e a vencer</option><option value="expired">Vencidos</option><option value="near">Vencem em até {alertDays} dias</option><option value="valid">Dentro da validade</option></select>
          <Input aria-label="Validade de" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={field}/>
          <Input aria-label="Validade até" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={field}/>
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="h-5 w-5" checked={mine} onChange={(e) => setMine(e.target.checked)}/>Só os que eu cadastrei</label>
        </div>
        {selectedIds.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-300/20 bg-teal-300/5 p-3"><span className="text-sm font-semibold text-teal-100">{selectedIds.length} produto(s) selecionado(s)</span><div className="flex flex-wrap gap-2"><Button onClick={() => shareProducts(selectedProducts, today, alertDays)} className="h-11 bg-emerald-600 text-white hover:bg-emerald-500 sm:h-9"><MessageCircle className="mr-1 h-4 w-4"/>WhatsApp</Button><Button variant="outline" disabled={remove.isPending} onClick={() => confirmRemove(selectedIds)} className="h-11 border-rose-300/30 text-rose-200 sm:h-9"><Trash2 className="mr-1 h-4 w-4"/>Excluir selecionados</Button></div></div>}
        {manageable.length > 0 && <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="h-5 w-5" checked={allSelected} onChange={toggleAll}/>Selecionar os que posso alterar nesta página</label>}
        {products.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin"/>Carregando produtos...</p>}
        {products.isError && <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-rose-200">Não foi possível carregar os produtos.<Button variant="outline" onClick={() => products.refetch()} className="h-11 border-rose-300/30 text-rose-100 sm:h-9">Tentar de novo</Button></div>}
        {!products.isLoading && !products.isError && rows.length === 0 && <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300"><Barcode className="mx-auto mb-2 h-8 w-8 text-slate-500"/>Nenhum produto encontrado.</div>}
        <div className="space-y-3">{rows.map((p) => {
          const st = expiryStatus(p.expirationDate, today, alertDays); const expired = st === "expired"; const near = st === "near";
          const days = daysUntil(p.expirationDate, today);
          const removedStore = Boolean(p.storeId && (p.storeActive === false || !p.storeName));
          return <div key={p.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><label className={`flex min-w-0 items-start gap-2 ${p.canManage ? "cursor-pointer" : ""}`}>{p.canManage ? <input type="checkbox" className="mt-0.5 h-5 w-5" checked={selectedIds.includes(p.id)} onChange={() => setSelectedIds((old) => old.includes(p.id) ? old.filter((id) => id !== p.id) : [...old, p.id])} aria-label={`Selecionar ${p.description}`}/> : <span className="w-5"/>}<div className="min-w-0"><p className="break-words font-bold text-white">{p.description}</p><p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-slate-400"><Barcode className="h-3 w-3"/>{p.productCode}{p.lot ? ` · Lote ${p.lot}` : ""}</p><p className="mt-0.5 text-xs text-slate-400">{p.clientName || "Sem indústria"} · {removedStore ? <span className="text-amber-300">{storeLabel(p)}</span> : storeLabel(p)}{p.createdByName ? ` · por ${p.createdByName}` : ""}</p></div></label>
              <Badge className={expired ? "bg-rose-500 text-white" : near ? "bg-amber-400 text-slate-950" : "bg-emerald-500/20 text-emerald-200"}>{expired ? <><AlertTriangle className="mr-1 h-3 w-3"/>Vencido há {-days} dia(s)</> : near ? <><AlertTriangle className="mr-1 h-3 w-3"/>{days === 0 ? "Vence hoje" : `Vence em ${days} dia(s)`}</> : "Em dia"}</Badge></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm"><div><p className="text-xs text-slate-400">Quantidade</p><p className="font-semibold">{p.quantity}</p></div><div><p className="text-xs text-slate-400">Validade</p><p className="font-semibold">{formatDateBR(p.expirationDate)}</p></div><div><p className="text-xs text-slate-400">Preço</p><p className="font-semibold">{money(p.price)}</p></div></div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {p.photoKey && <Button variant="outline" onClick={() => void openPhoto(p)} className="h-11 border-white/15 text-slate-200 sm:h-9"><ImageIcon className="mr-1 h-3.5 w-3.5"/>Foto</Button>}
              <Button variant="outline" onClick={() => shareProducts([p], today, alertDays)} className="h-11 border-emerald-300/20 text-emerald-200 sm:h-9"><MessageCircle className="mr-1 h-3.5 w-3.5"/>WhatsApp</Button>
              {p.canManage && <Button variant="outline" onClick={() => editProduct(p)} className="h-11 border-white/15 text-slate-200 sm:h-9"><Pencil className="mr-1 h-3.5 w-3.5"/>Editar</Button>}
              {p.canManage && <Button variant="outline" disabled={remove.isPending} aria-label={`Excluir ${p.description}`} onClick={() => confirmRemove([p.id], p.description)} className="h-11 border-rose-300/30 text-rose-200 sm:h-9"><Trash2 className="mr-1 h-3.5 w-3.5"/>Excluir</Button>}
            </div></div>;
        })}</div>
        {total > 0 && <div className="flex items-center justify-between gap-2 text-sm text-slate-300"><span>{total} produto(s) · página {page} de {pages}</span><div className="flex gap-2"><Button variant="outline" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))} className="h-11 w-11 border-white/15 p-0 text-white"><ChevronLeft className="h-5 w-5"/></Button><Button variant="outline" aria-label="Próxima página" disabled={page >= pages} onClick={() => setPage((n) => Math.min(pages, n + 1))} className="h-11 w-11 border-white/15 p-0 text-white"><ChevronRight className="h-5 w-5"/></Button></div></div>}
      </CardContent></Card>
    </div>
    </div>
  </DashboardLayout>;
}
