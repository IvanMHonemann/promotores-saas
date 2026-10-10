import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useOnlineStatus } from "@/offline/hooks";
import { offlineDb } from "@/offline/localDb";
import { downloadQrCodePng, openPrintQrLabel, qrCodeImageUrl } from "@/lib/qrcodeUrl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Edit, Eye, FileText, Flame, History, MapPin, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function ClientDetailCard({
  client,
  extinguisherFilter = "all",
  onAddExtinguisher,
  onCreateOrder,
  onEdit,
  onEditOrder,
  onViewOrder,
  onDelete,
}: {
  client: any;
  extinguisherFilter?: "all" | "active";
  onAddExtinguisher: () => void;
  onCreateOrder: () => void;
  onEdit: () => void;
  onEditOrder: (id: number) => void;
  onViewOrder: (id: number) => void;
  onDelete: () => void;
}) {
  const { user } = useAuth();
  const tenantKey = user && user.id < 0 ? String(Math.abs(user.id)) : null;
  const isPlatformAdmin = user?.role === "platform_admin";
  const extinguishersQuery = trpc.extinguishers.listByClient.useQuery({ clientId: client.id }, { enabled: Boolean(tenantKey) });
  const extinguishersPageQuery = trpc.extinguishers.page.useQuery({ clientId: client.id, page: 1, pageSize: 25, filter: extinguisherFilter }, { enabled: Boolean(tenantKey && !isPlatformAdmin) });
  const ordersQuery = trpc.orders.list.useQuery({ clientId: client.id }, { enabled: Boolean(tenantKey) });
  const platformExtinguishersPageQuery = trpc.platform.data.extinguishersPage.useQuery({ companyId: client.accountId || 0, clientId: client.id, page: 1, pageSize: 25, filter: extinguisherFilter }, { enabled: Boolean(isPlatformAdmin && client.accountId) });
  const platformOrdersPageQuery = trpc.platform.data.ordersPage.useQuery({ companyId: client.accountId || 0, clientId: client.id, page: 1, pageSize: 25 }, { enabled: Boolean(isPlatformAdmin && client.accountId) });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [extAuditId, setExtAuditId] = useState<number | null>(null);
  const [qrExtId, setQrExtId] = useState<number | null>(null);
  const [qrLabel, setQrLabel] = useState("");
  const historyQuery = trpc.orders.history.useQuery({ clientId: client.id }, { enabled: Boolean(tenantKey && historyOpen) });
  const platformHistoryQuery = trpc.platform.data.history.useQuery({ companyId: client.accountId, clientId: client.id }, { enabled: Boolean(isPlatformAdmin && historyOpen && client.accountId) });
  const visibleHistory = isPlatformAdmin ? (platformHistoryQuery.data || []) : (historyQuery.data || []);
  const extAuditQuery = trpc.audit.entityHistory.useQuery(
    { entityType: "extinguisher", entityId: extAuditId!, page: 1, pageSize: 30 },
    { enabled: Boolean(tenantKey && extAuditId && !isPlatformAdmin) },
  );
  const qrInfoQuery = trpc.extinguishers.qrInfo.useQuery(
    { id: qrExtId! },
    { enabled: Boolean(tenantKey && qrExtId && !isPlatformAdmin) },
  );

  const isOnline = useOnlineStatus();
  const localExtinguishers = useLiveQuery(() => tenantKey ? offlineDb.extinguishers.where("tenantKey").equals(tenantKey).filter((row) => row.clientId === client.id).toArray() : Promise.resolve([] as any[]), [tenantKey, client.id], [] as any[]);
  const extinguisherRows = isPlatformAdmin
    ? (platformExtinguishersPageQuery.data?.items || [])
    : isOnline && extinguishersPageQuery.data ? extinguishersPageQuery.data.items.map((row: any) => row.extinguisher) : localExtinguishers;
  const clientOrders = isPlatformAdmin
    ? (platformOrdersPageQuery.data?.items || [])
    : (ordersQuery.data || []);
  const visibleExtinguishers = (extinguisherRows || []).filter((ext) => {
    if (extinguisherFilter === "all") return true;
    const expiration = new Date(ext.expirationDate);
    expiration.setHours(0, 0, 0, 0);
    return expiration >= new Date(new Date().setHours(0, 0, 0, 0));
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-black text-slate-900">
              {client.companyName}
            </h3>
            <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200 font-bold text-[10px] gap-1">
              <MapPin className="w-3 h-3 text-red-600" />
              {client.city}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1 mt-1">
            <span><strong>CNPJ:</strong> {client.cnpj || "—"}</span>
            <span><strong>Endereço:</strong> {client.address || "—"}</span>
            <span><strong>Fone:</strong> {client.phone || "—"}</span>
            <span><strong>Responsável:</strong> {client.contactName || "—"}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-8 gap-1"
            onClick={onAddExtinguisher}
          >
            <Flame className="w-3.5 h-3.5 text-red-600" />
            + Extintor
          </Button>

          <Button
            size="sm"
            className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs h-8 gap-1"
            onClick={onCreateOrder}
          >
            <FileText className="w-3.5 h-3.5" />
            Gerar OS
          </Button>

          <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={onEdit}><Edit className="w-3.5 h-3.5 text-blue-600" /> Editar</Button>

          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-900">Histórico de atendimento</p>
            <p className="mt-0.5 text-xs text-blue-800">{clientOrders.length} ordem(ns) registrada(s) para este cliente.</p>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => setHistoryOpen(true)}><History className="h-3.5 w-3.5" /> Ver histórico completo</Button>
        </div>
      </div>

      {/* EXTINTORES INSTALADOS */}
      <div>
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
          <span>Extintores no Estabelecimento ({visibleExtinguishers.length})</span>
        </div>

        {visibleExtinguishers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {visibleExtinguishers.map((ext) => {
              const expDate = new Date(ext.expirationDate);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const isExpired = expDate < today;
              const daysLeft = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isWarning = daysLeft >= 0 && daysLeft <= 30;

              return (
                <div
                  key={ext.id}
                  className={`p-2.5 rounded-lg border text-xs flex justify-between items-start ${
                    isExpired
                      ? "bg-red-50 border-red-200"
                      : isWarning
                      ? "bg-amber-50 border-amber-200"
                      : "bg-slate-50 border-slate-200"
                  }`}
                >
                  <div>
                    <div className="font-bold text-slate-900">
                      {ext.typeModel} ({ext.capacity || "N/I"})
                    </div>
                    <div className="text-slate-600 text-[11px] mt-0.5">
                      📍 {ext.locationInBuilding || "Local não especificado"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-red-600"
                        onClick={() => setExtAuditId(ext.id)}
                        title="Histórico do equipamento"
                      >
                        <History className="h-3 w-3" /> Histórico
                      </button>
                      {!isPlatformAdmin && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-red-600"
                          onClick={() => {
                            setQrExtId(ext.id);
                            setQrLabel(ext.serialNumber || ext.typeModel || `#${ext.id}`);
                          }}
                          title="QR Code do equipamento"
                        >
                          <QrCode className="h-3 w-3" /> QR Code
                        </button>
                      )}
                    </div>
                    {ext.serialNumber && (
                      <div className="text-[10px] text-slate-500 font-mono">
                        Selo: {ext.serialNumber}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-black text-[11px] ${
                        isExpired
                          ? "text-red-700"
                          : isWarning
                          ? "text-amber-800"
                          : "text-slate-700"
                      }`}
                    >
                      {isExpired ? "VENCIDO" : isWarning ? `Vence em ${daysLeft}d` : "Válido"}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {expDate.toLocaleDateString("pt-BR")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400">
            {extinguisherFilter === "active" ? "Nenhum extintor ativo encontrado para este cliente." : 'Nenhum extintor cadastrado para este cliente ainda. Clique em "+ Extintor" para adicionar.'}
          </div>
        )}
      </div>


      <Dialog open={extAuditId != null} onOpenChange={(open) => !open && setExtAuditId(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico do equipamento</DialogTitle>
          </DialogHeader>
          {extAuditQuery.isLoading ? (
            <p className="text-sm text-slate-500">Carregando…</p>
          ) : (extAuditQuery.data?.items || []).length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento de auditoria para este extintor.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {(extAuditQuery.data?.items || []).map((ev: any) => (
                <li key={ev.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-900">{ev.action}</span>
                    <span className="text-xs text-slate-500">{ev.createdAt ? new Date(ev.createdAt as any).toLocaleString("pt-BR") : ""}</span>
                  </div>
                  <p className="mt-1 text-slate-600">{ev.description}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{ev.userName || "—"}</p>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={qrExtId != null}
        onOpenChange={(open) => {
          if (!open) {
            setQrExtId(null);
            setQrLabel("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code do extintor</DialogTitle>
          </DialogHeader>
          {qrInfoQuery.isLoading ? (
            <p className="py-8 text-center text-sm text-slate-500">Gerando QR Code…</p>
          ) : qrInfoQuery.data?.url ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <img
                src={qrCodeImageUrl(qrInfoQuery.data.url, 280)}
                alt={`QR Code ${qrLabel}`}
                className="h-56 w-56 rounded-lg border border-slate-200 bg-white p-2"
              />
              <p className="font-mono text-sm font-bold text-slate-900">{qrLabel}</p>
              <p className="break-all text-center text-[10px] text-slate-400">{qrInfoQuery.data.url}</p>
              <div className="flex w-full flex-wrap gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 gap-1 text-xs"
                  onClick={async () => {
                    try {
                      await downloadQrCodePng(qrInfoQuery.data!.url, `qr-${qrLabel || qrExtId}`);
                      toast.success("QR Code baixado");
                    } catch {
                      toast.error("Falha ao baixar QR Code");
                    }
                  }}
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </Button>
                <Button
                  size="sm"
                  className="flex-1 gap-1 bg-red-600 text-xs hover:bg-red-700"
                  onClick={() =>
                    openPrintQrLabel({
                      url: qrInfoQuery.data!.url,
                      label: qrLabel || `EXT #${qrExtId}`,
                    })
                  }
                >
                  <QrCode className="h-3.5 w-3.5" /> Imprimir
                </Button>
              </div>
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-slate-500">Não foi possível obter o QR Code.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrExtId(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Histórico de atendimento — {client.companyName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {visibleHistory.map(({ order, client: orderClient, items }: any) => (
              <div key={order.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div><p className="font-mono text-sm font-bold text-slate-900">OS #{String(order.orderNumber).padStart(5, "0")}</p><p className="mt-1 text-xs text-slate-600"><strong>Data do atendimento:</strong> {new Date(order.orderDate).toLocaleDateString("pt-BR")}</p><p className="text-xs text-slate-500">Cliente: {orderClient?.companyName || client.companyName}</p></div>
                  <div className="text-right"><p className="text-[10px] font-bold uppercase text-slate-400">Valor total</p><span className="font-mono text-sm font-bold text-slate-900">R$ {Number(order.totalAmount || 0).toFixed(2)}</span></div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                  <p><strong>Troca/entrega:</strong> {order.replacedAndDelivered || "—"}</p>
                  <p><strong>Deixou reserva:</strong> {order.leftReserve || "—"}</p>
                  <p><strong>Detalhes da reserva:</strong> {order.reserveDetails || "—"}</p>
                  <p><strong>Vencimento do extintor:</strong> {order.extinguisherExpiration || "—"}</p>
                  <p><strong>Vencimento do alvará:</strong> {order.licenseExpiration || "—"}</p>
                  <p><strong>Pagamento:</strong> {order.paymentMethod || "—"}{order.installmentsCount && order.installmentsCount > 1 ? ` · ${order.installmentsCount} parcelas` : ""}</p>
                  {order.installmentDates && <p><strong>Datas das parcelas:</strong> {order.installmentDates}</p>}
                  <p><strong>Responsável:</strong> {order.responsibleName || "—"}</p>
                  <p><strong>CPF:</strong> {order.responsibleCpf || "—"}</p>
                  <p><strong>Data de nascimento:</strong> {order.responsibleBirthDate || "—"}</p>
                </div>
                <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Serviços e produtos realizados neste atendimento</p>
                  {items?.length > 0 ? <div className="space-y-1.5">{items.map((item: any) => <div key={item.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-xs"><span className="min-w-0 break-words font-medium">{item.description}</span><span>{item.quantity}×</span><span>R$ {Number(item.unitPrice || 0).toFixed(2)}</span><strong>R$ {Number(item.totalPrice || 0).toFixed(2)}</strong></div>)}</div> : <p className="text-xs text-slate-500">Nenhum item detalhado registrado nesta OS.</p>}
                </div>
                <div className="mt-3 rounded-md border border-amber-100 bg-amber-50/50 p-3 text-xs"><strong>Observações do atendimento:</strong><p className="mt-1 whitespace-pre-wrap break-words">{order.observations || "Nenhuma observação registrada."}</p></div>
                <p className="mt-3 text-xs text-slate-500"><strong>Criada por:</strong> {order.createdByName || "Usuário não registrado (OS antiga)"}</p>
                <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => onViewOrder(order.id)}><Eye className="h-3.5 w-3.5" /> Ver / imprimir OS</Button><Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { setHistoryOpen(false); onEditOrder(order.id); }}><Edit className="h-3.5 w-3.5 text-blue-600" /> Editar OS</Button></div>
              </div>
            ))}
            {visibleHistory.length === 0 && !historyQuery.isLoading && !platformHistoryQuery.isLoading && <div className="rounded-lg bg-slate-50 p-6 text-center text-sm text-slate-500">Nenhum atendimento registrado para este cliente.</div>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setHistoryOpen(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
