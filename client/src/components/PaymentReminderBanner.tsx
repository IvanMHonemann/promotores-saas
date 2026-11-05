import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, MessageCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { pixQrDataUrl } from "@/lib/pixQr";
import { toast } from "sonner";

const DISMISS_PREFIX = "gondup-pay-remind:";

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

type Reminder = {
  phase: "none" | "pre_due" | "overdue" | "blocked";
  show: boolean;
  dismissable: boolean;
  companyName: string;
  amount: string | null;
  amountLabel: string | null;
  dueDate: string | null;
  dueDateLabel: string | null;
  daysUntilDue: number | null;
  daysUntilBlock: number | null;
  graceDays: number;
  monthRef: string | null;
  pixPayload: string | null;
  whatsappUrl: string | null;
  message: string;
};

function PixPayBox({ reminder, compact }: { reminder: Reminder; compact?: boolean }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    if (!reminder.pixPayload) return;
    void pixQrDataUrl(reminder.pixPayload, compact ? 160 : 220).then((url) => {
      if (!cancelled) setQr(url);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [reminder.pixPayload, compact]);

  const copy = async () => {
    if (!reminder.pixPayload) return;
    try {
      await navigator.clipboard.writeText(reminder.pixPayload);
      setCopied(true);
      toast.success("Código Pix copiado.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  return (
    <div className={`mt-3 grid gap-3 ${compact ? "" : "sm:grid-cols-[auto_1fr]"} items-start`}>
      {qr ? (
        <img src={qr} alt="QR Code Pix" className={`mx-auto rounded-xl bg-white p-2 ${compact ? "h-40 w-40" : "h-52 w-52"}`} />
      ) : reminder.pixPayload ? (
        <div className={`mx-auto flex items-center justify-center rounded-xl bg-white/10 text-xs text-slate-300 ${compact ? "h-40 w-40" : "h-52 w-52"}`}>Gerando QR…</div>
      ) : null}
      <div className="space-y-2 text-sm">
        {reminder.amountLabel && (
          <p><span className="text-slate-300">Valor:</span> <strong className="text-white">{reminder.amountLabel}</strong>
            {reminder.dueDateLabel ? <> · vence em <strong>{reminder.dueDateLabel}</strong></> : null}
            {reminder.monthRef ? <> · ref. {reminder.monthRef}</> : null}
          </p>
        )}
        {reminder.pixPayload ? (
          <>
            <p className="text-xs text-slate-300">Pix copia e cola</p>
            <textarea
              readOnly
              value={reminder.pixPayload}
              className="h-20 w-full resize-none rounded-lg border border-white/15 bg-slate-950/70 p-2 font-mono text-[11px] text-slate-100"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void copy()} className="bg-teal-300 text-slate-950 hover:bg-teal-200">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copiado" : "Copiar Pix"}
              </Button>
              {reminder.whatsappUrl && (
                <Button type="button" asChild variant="outline" className="border-emerald-300/40 text-emerald-100">
                  <a href={reminder.whatsappUrl} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Pagar / enviar comprovante no WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-amber-100">Valor mensal ainda não definido. Fale conosco pelo WhatsApp para pagar.</p>
        )}
      </div>
    </div>
  );
}

/** Banner/modal de cobrança: pré-vencimento (fechável no dia) e atraso (fixo, sem fechar). */
export default function PaymentReminderBanner() {
  const { user } = useAuth();
  const isAdmin = user?.role === "company_admin";
  const query = trpc.billing.paymentReminder.useQuery(undefined, {
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
  const reminder = query.data as Reminder | undefined;
  const dismissKey = useMemo(() => {
    if (!reminder?.dueDate || reminder.daysUntilDue == null) return "";
    return `${DISMISS_PREFIX}${reminder.dueDate}:${reminder.daysUntilDue}:${todayKey()}`;
  }, [reminder?.dueDate, reminder?.daysUntilDue]);

  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!dismissKey || !reminder?.dismissable) { setDismissed(false); return; }
    try { setDismissed(localStorage.getItem(dismissKey) === "1"); } catch { setDismissed(false); }
  }, [dismissKey, reminder?.dismissable, reminder?.phase]);

  if (!isAdmin || !reminder?.show) return null;
  if (reminder.phase === "blocked") return null; // tela cheia cuida disso
  if (reminder.phase === "pre_due" && dismissed) return null;

  const overdue = reminder.phase === "overdue";
  const dismiss = () => {
    if (!reminder.dismissable || !dismissKey) return;
    try { localStorage.setItem(dismissKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  const shell = overdue
    ? "border-rose-400/50 bg-rose-950/90 text-rose-50 shadow-2xl shadow-rose-950/50"
    : "border-amber-300/40 bg-amber-500/10 text-amber-50";

  const content = (
    <section role="alert" className={`mb-5 rounded-2xl border p-4 ${shell}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${overdue ? "text-rose-300" : "text-amber-300"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">
            {overdue
              ? `Pagamento em atraso — bloqueio em ${Math.max(0, reminder.daysUntilBlock ?? 0)} dia(s)`
              : `Lembrete de pagamento — vence em ${reminder.daysUntilDue} dia(s)`}
          </p>
          <p className="mt-1 text-sm opacity-90">{reminder.message}</p>
          <PixPayBox reminder={reminder} compact={!overdue} />
          {overdue && (
            <p className="mt-3 text-xs text-rose-100/80">
              Este aviso não pode ser fechado. Assim que o administrador da plataforma confirmar o Pix, o acesso volta ao normal.
            </p>
          )}
        </div>
        {reminder.dismissable && (
          <button type="button" aria-label="Fechar aviso de hoje" onClick={dismiss} className="rounded-lg p-2 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </section>
  );

  if (!overdue) return content;

  // Atraso: banner fixo no topo + modal persistente atrás do conteúdo (overlay suave sem bloquear leitura total — mas o banner é inevitável em toda página).
  return (
    <>
      <div className="sticky top-0 z-40 -mx-4 mb-5 sm:-mx-7 lg:-mx-10">
        <div className="border-b border-rose-400/40 bg-rose-700 px-4 py-2 text-center text-sm font-bold text-white">
          Pagamento em atraso · {reminder.amountLabel ?? "mensalidade"} · bloqueio em {Math.max(0, reminder.daysUntilBlock ?? 0)} dia(s)
        </div>
      </div>
      {content}
    </>
  );
}

export function PaymentReminderPanel({ reminder }: { reminder: Reminder }) {
  return <PixPayBox reminder={reminder} />;
}
