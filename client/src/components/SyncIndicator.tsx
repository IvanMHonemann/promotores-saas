import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Cloud, CloudOff, Loader2, RotateCcw, Trash2, X } from "lucide-react";
import { storeCount } from "@/lib/storeQueue";
import { clientCount } from "@/lib/clientQueue";
import { useOnline } from "@/hooks/useOnline";
import { requestSync, useOutboxItems } from "@/hooks/useOutbox";
import { discardItem, retryItem } from "@/lib/outboxDb";
import type { OutboxItem } from "@/lib/outbox";

export function pendingText(n: number) {
  return n === 1 ? "1 item aguardando envio" : `${n} itens aguardando envio`;
}

const STATUS: Record<OutboxItem["status"], { label: string; cls: string }> = {
  pending: { label: "Na fila", cls: "text-slate-300" },
  sending: { label: "Enviando…", cls: "text-sky-300" },
  error: { label: "Vai tentar de novo", cls: "text-amber-300" },
  failed: { label: "Recusado pelo servidor", cls: "text-rose-300" },
};

/**
 * Indicador de conexão + fila offline. Toque para ver cada item, o status e tentar de novo.
 */
export function SyncIndicator() {
  const online = useOnline();
  const items = useOutboxItems();
  const [legacy, setLegacy] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setLegacy(storeCount() + clientCount());
    update();
    const id = setInterval(update, 3000);
    return () => clearInterval(id);
  }, []);

  const pending = items.length + legacy;
  const sending = items.some((i) => i.status === "sending");
  const failed = items.filter((i) => i.status === "failed").length;

  const pill = !online
    ? { cls: "border-amber-400/40 bg-amber-400/15 text-amber-100", icon: <CloudOff className="h-3.5 w-3.5" />, text: pending ? `Offline · ${pendingText(pending)}` : "Offline" }
    : failed
      ? { cls: "border-rose-400/40 bg-rose-400/15 text-rose-100", icon: <AlertTriangle className="h-3.5 w-3.5" />, text: `${failed} com erro · toque para ver` }
      : pending
        ? { cls: "border-sky-400/40 bg-sky-400/15 text-sky-100", icon: sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Cloud className="h-3.5 w-3.5" />, text: pendingText(pending) }
        : { cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200", icon: <Cloud className="h-3.5 w-3.5" />, text: "Online" };

  return (
    <>
      <button type="button" data-testid="sync-indicator" onClick={() => setOpen(true)} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${pill.cls}`} aria-label={pill.text}>
        {pill.icon}
        {pill.text}
      </button>
      {open && (
        <div className="fixed inset-0 z-[85] flex items-end justify-center bg-black/60 p-3 sm:items-center" onClick={() => setOpen(false)}>
          <div role="dialog" aria-label="Itens aguardando envio" className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-4 text-slate-100 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-bold">{pending ? pendingText(pending) : "Tudo enviado"}</h2>
              <button type="button" onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10" aria-label="Fechar"><X className="h-4 w-4" /></button>
            </div>
            <p className="mb-3 text-xs text-slate-400">
              {online ? "Com internet: os itens são enviados automaticamente." : "Sem internet: tudo fica guardado neste aparelho e é enviado sozinho quando a conexão voltar. Não desinstale o app nem limpe os dados do navegador."}
            </p>
            {!pending && <p className="flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Nenhum item pendente.</p>}
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} data-testid="outbox-item" className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{i.label}</span>
                    <span className={`text-xs font-bold ${STATUS[i.status].cls}`}>{STATUS[i.status].label}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">Registrado em {new Date(i.deviceTime).toLocaleString("pt-BR")}{i.attempts ? ` · ${i.attempts} tentativa(s)` : ""}</p>
                  {i.lastError && <p className="mt-1 text-xs text-amber-200">{i.lastError}</p>}
                  {(i.status === "error" || i.status === "failed") && (
                    <div className="mt-2 flex gap-2">
                      <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 text-xs font-bold hover:bg-white/10" onClick={() => void retryItem(i.id).then(requestSync)}><RotateCcw className="h-3 w-3" /> Tentar agora</button>
                      {i.status === "failed" && (
                        <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-rose-300/40 px-2 py-1 text-xs font-bold text-rose-200 hover:bg-rose-500/10" onClick={() => { if (window.confirm("Descartar este item? Ele não será enviado e não poderá ser recuperado.")) void discardItem(i.id); }}><Trash2 className="h-3 w-3" /> Descartar</button>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {legacy > 0 && <li className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{legacy} cadastro(s) de loja/cliente na fila</li>}
            </ul>
            {online && pending > 0 && <button type="button" onClick={requestSync} className="mt-3 w-full rounded-xl bg-teal-400 py-2 text-sm font-bold text-slate-950">Enviar agora</button>}
          </div>
        </div>
      )}
    </>
  );
}
