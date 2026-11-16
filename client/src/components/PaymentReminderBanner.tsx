import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { AlertTriangle, Check, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { pixQrDataUrl } from "@/lib/pixQr";
import { overdueBarLabel, paymentReminderHeadline } from "@shared/paymentReminderCopy";

type Reminder = {
  show: boolean;
  phase: string;
  dismissable: boolean;
  message: string;
  amountLabel: string | null;
  dueDate: string | null;
  dueDateLabel: string | null;
  daysUntilDue: number | null;
  daysUntilBlock: number | null;
  monthRef: string | null;
  pixPayload: string | null;
  whatsappUrl: string;
};

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function dismissKey(r: Reminder) {
  return `gondup-pay-remind:${r.dueDate}:${r.daysUntilDue}:${todayKey()}`;
}

function PixPayBox({ reminder }: { reminder: Reminder }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!reminder.pixPayload) {
      setQr(null);
      return;
    }
    void pixQrDataUrl(reminder.pixPayload, 160).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => {
      cancelled = true;
    };
  }, [reminder.pixPayload]);

  const copy = async () => {
    if (!reminder.pixPayload) return;
    try {
      await navigator.clipboard.writeText(reminder.pixPayload);
      setCopied(true);
      toast.success("Código Pix copiado.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  return (
    <div className="mt-3 w-full min-w-0 overflow-hidden rounded-xl bg-black/20 p-3">
      {reminder.monthRef ? (
        <p className="mb-2 text-xs text-slate-300">Referência: {reminder.monthRef}</p>
      ) : null}
      {qr ? (
        <img
          src={qr}
          alt="QR Code Pix"
          className="mx-auto h-36 w-36 max-w-full rounded-xl bg-white p-2"
        />
      ) : reminder.pixPayload ? (
        <div className="flex h-36 items-center justify-center text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          Pix indisponível no momento. Use o WhatsApp para enviar o comprovante.
        </p>
      )}
      {reminder.pixPayload ? (
        <div className="mt-3 w-full min-w-0">
          <p className="text-xs text-slate-300">Pix copia e cola</p>
          <p className="mt-1 max-h-20 w-full min-w-0 overflow-y-auto break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] leading-4 text-slate-200">
            {reminder.pixPayload}
          </p>
          <div className="mt-2 flex w-full min-w-0 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => void copy()}
              className="h-10 w-full min-w-0 bg-teal-300 text-slate-950 hover:bg-teal-200 sm:flex-1"
            >
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? "Copiado" : "Copiar Pix"}
            </Button>
            <Button
              type="button"
              asChild
              variant="outline"
              className="h-auto min-h-10 w-full min-w-0 whitespace-normal border-white/20 bg-transparent px-3 py-2 text-white hover:bg-white/10 sm:flex-1"
            >
              <a href={reminder.whatsappUrl} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" />
                Enviar comprovante no WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : reminder.whatsappUrl ? (
        <Button
          type="button"
          asChild
          variant="outline"
          className="mt-2 h-auto min-h-10 w-full min-w-0 whitespace-normal border-white/20 bg-transparent px-3 py-2 text-white hover:bg-white/10"
        >
          <a href={reminder.whatsappUrl} target="_blank" rel="noreferrer">
            <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" />
            Enviar comprovante no WhatsApp
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export default function PaymentReminderBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const query = trpc.billing.paymentReminder.useQuery(undefined, {
    enabled: Boolean(user && user.role === "company_admin"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const reminder = query.data as Reminder | undefined;
  useEffect(() => {
    if (!reminder?.show || !reminder.dismissable) {
      setDismissed(false);
      return;
    }
    try {
      setDismissed(window.localStorage.getItem(dismissKey(reminder)) === "1");
    } catch {
      setDismissed(false);
    }
  }, [reminder?.show, reminder?.dueDate, reminder?.daysUntilDue, reminder?.dismissable]);

  if (!user || user.role !== "company_admin") return null;
  if (location === "/pagamento-necessario") return null;
  if (!reminder?.show) return null;
  if (reminder.dismissable && dismissed) return null;

  const overdue = reminder.phase === "overdue" || reminder.phase === "blocked";
  const shell = overdue
    ? "border-rose-400/60 bg-rose-950/80 text-rose-50"
    : "border-amber-400/50 bg-amber-950/70 text-amber-50";
  const headline = paymentReminderHeadline(reminder);

  const dismiss = () => {
    try {
      window.localStorage.setItem(dismissKey(reminder), "1");
    } catch {
      /* ignore quota / private mode */
    }
    setDismissed(true);
    setOpen(false);
  };

  const content = (
    <section role="alert" className={`mb-5 overflow-hidden rounded-2xl border p-3 sm:p-4 ${shell}`}>
      <div className="flex items-start gap-2 sm:gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-bold leading-5">{headline}</p>
          <div className="mt-3">
            <Button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="h-10 w-full bg-teal-300 text-slate-950 hover:bg-teal-200 sm:w-auto"
            >
              {open ? "Ocultar Pix" : "Pagar com Pix"}
            </Button>
          </div>
          {open ? <PixPayBox reminder={reminder} /> : null}
          {overdue && open ? (
            <p className="mt-3 text-xs leading-5 text-rose-100/90">
              Este aviso não pode ser fechado. Assim que o administrador da plataforma confirmar o Pix, o acesso volta ao normal.
            </p>
          ) : null}
        </div>
        {reminder.dismissable ? (
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 rounded-lg p-1 text-current/70 hover:bg-white/10 hover:text-current"
            aria-label="Dispensar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </section>
  );

  if (!overdue) return content;

  return (
    <>
      {content}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 sm:hidden">
        <div className="pointer-events-auto overflow-hidden rounded-2xl border border-rose-400/50 bg-rose-950/95 px-3 py-2 text-xs text-rose-50 shadow-2xl">
          <p className="truncate">{overdueBarLabel(reminder)}</p>
        </div>
      </div>
    </>
  );
}

export function PaymentReminderPanel({ reminder }: { reminder: Reminder }) {
  return <PixPayBox reminder={reminder} />;
}
