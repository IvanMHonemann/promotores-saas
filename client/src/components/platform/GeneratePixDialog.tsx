import { useEffect, useState } from "react";
import { Check, Copy, Loader2, MessageCircle, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { pixQrDataUrl } from "@/lib/pixQr";
import { moneyLabelBr } from "@shared/platformPixQuote";
import { toast } from "sonner";

export default function GeneratePixDialog({
  companyId,
  companyName,
  open,
  onOpenChange,
  onGenerated,
}: {
  companyId: number;
  companyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void;
}) {
  const quote = trpc.platformCompanies.pixQuote.useQuery({ companyId }, { enabled: open, staleTime: 10_000 });
  const generate = trpc.platformCompanies.generatePix.useMutation({
    onError: (e) => toast.error(e.message || "Não foi possível gerar o Pix."),
  });
  const [amount, setAmount] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      generate.reset();
      setQr(null);
      setCopied(false);
      return;
    }
    if (quote.data?.defaultAmount) setAmount(quote.data.defaultAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quote.data?.defaultAmount]);

  const result = generate.data;
  useEffect(() => {
    if (!result?.pixPayload) {
      setQr(null);
      return;
    }
    let cancelled = false;
    void pixQrDataUrl(result.pixPayload, 200).then((url) => {
      if (!cancelled) setQr(url);
    });
    return () => { cancelled = true; };
  }, [result?.pixPayload]);

  const submit = () => {
    const value = amount.replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(value) || Number(value) <= 0) {
      toast.info("Informe um valor maior que zero.");
      return;
    }
    generate.mutate({ companyId, amount: Number(value).toFixed(2) }, {
      onSuccess: (data) => {
        toast.success(data.recordedAsPending ? "Pix gerado. A cobrança ficou pendente, ainda não está paga." : "Pix gerado.");
        onGenerated?.();
      },
    });
  };

  const copy = async () => {
    if (!result?.pixPayload) return;
    try {
      await navigator.clipboard.writeText(result.pixPayload);
      setCopied(true);
      toast.success("Código Pix copiado.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Selecione o código e copie manualmente.");
    }
  };

  const q = quote.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-white/10 bg-slate-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <QrCode className="h-5 w-5 text-teal-300" />Gerar Pix · {companyName}
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            O valor segue o plano da empresa. Você pode ajustar antes de gerar. Isso não marca o pagamento como recebido.
          </DialogDescription>
        </DialogHeader>

        {quote.isLoading && <p className="flex items-center gap-2 text-sm text-slate-300"><Loader2 className="h-4 w-4 animate-spin" />Consultando o plano…</p>}
        {quote.isError && <p role="alert" className="text-sm text-rose-200">{quote.error.message}</p>}

        {q && !result && (
          <div className="space-y-3">
            <div className="rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-200">
              <p>Vencimento atual: <span className="font-semibold">{q.dueDateLabel || "sem vencimento"}</span>{q.monthRef ? ` · ${q.monthRef}` : ""}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {q.lines.map((line) => (
                  <li key={line.label} className="flex justify-between gap-3">
                    <span>{line.label}</span>
                    <span className="font-medium text-white">{line.amount ? moneyLabelBr(line.amount) : "—"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Label>Valor do Pix (R$)</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(",", "."))} className="mt-1 border-white/15 bg-slate-950/60 text-white" />
            </div>
            <Button disabled={generate.isPending} onClick={submit} className="w-full bg-teal-300 font-bold text-slate-950 hover:bg-teal-200">
              {generate.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
              {generate.isPending ? "Gerando…" : "Gerar Pix"}
            </Button>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-slate-200">
              {result.amountLabel}
              {result.dueDateLabel ? ` · vence em ${result.dueDateLabel}` : ""}
              {result.monthRef ? ` · ${result.monthRef}` : ""}
            </p>
            {result.recordedAsPending && (
              <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
                Cobrança registrada como pendente. Ela só entra como paga quando você registrar o pagamento.
              </p>
            )}
            {!result.recordedAsPending && (
              <p className="rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                A empresa não tem vencimento cadastrado, então o Pix foi gerado sem criar cobrança no histórico.
              </p>
            )}
            {qr ? (
              <img src={qr} alt="QR Code Pix" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
            ) : (
              <div className="flex h-44 items-center justify-center text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
            )}
            <div>
              <p className="text-xs text-slate-300">Pix copia e cola</p>
              <p className="mt-1 max-h-24 overflow-y-auto break-all rounded-lg bg-black/30 px-2 py-1.5 font-mono text-[11px] leading-4 text-slate-200">{result.pixPayload}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={() => void copy()} className="h-10 bg-teal-300 text-slate-950 hover:bg-teal-200 sm:flex-1">
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                {copied ? "Copiado" : "Copiar Pix"}
              </Button>
              <Button type="button" asChild variant="outline" className="h-auto min-h-10 whitespace-normal border-white/20 bg-transparent px-3 py-2 text-white hover:bg-white/10 sm:flex-1">
                <a href={result.whatsappUrl} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4 shrink-0" />
                  Enviar no WhatsApp
                </a>
              </Button>
            </div>
            <Button type="button" variant="outline" className="w-full border-white/20 text-white" onClick={() => generate.reset()}>
              Gerar de novo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
