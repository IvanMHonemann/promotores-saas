import { useState } from "react";
import { FileText, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/_core/hooks/useAuth";
import { readActAs } from "@/components/ActingAsBanner";
import { trpc } from "@/lib/trpc";
import { legalVersionHeadline, TERMS_SESSION_DISMISS_KEY } from "@shared/legalAcceptance";
import { LEGAL_TEXT_VERSION } from "@shared/legalTexts";

function dismissedThisSession(): boolean {
  try { return sessionStorage.getItem(TERMS_SESSION_DISMISS_KEY) === "1"; } catch { return false; }
}

function dismissForSession() {
  try { sessionStorage.setItem(TERMS_SESSION_DISMISS_KEY, "1"); } catch { /* ignore */ }
}

/**
 * Pedido de aceite dos Termos e da Política ao administrador da empresa.
 * Não bloqueia o uso do app: dá para fechar e voltar a trabalhar; o aviso reaparece na próxima sessão
 * (ou quando a versão mudar). Promotor, supervisor e sessão "acessar como empresa" não veem este modal.
 */
export default function TermsAcceptanceGate() {
  const { user } = useAuth();
  const actingAs = Boolean(readActAs());
  const enabled = user?.role === "company_admin" && !actingAs;
  const [open, setOpen] = useState(() => !dismissedThisSession());
  const [checked, setChecked] = useState(false);
  const utils = trpc.useUtils();
  const status = trpc.legal.status.useQuery(undefined, { enabled, staleTime: 5 * 60_000, retry: 1 });
  const accept = trpc.legal.accept.useMutation({
    onSuccess: async () => {
      toast.success("Aceite registrado. Você pode reler os documentos em Termos e privacidade.");
      await utils.legal.status.invalidate();
      setOpen(false);
    },
    onError: (error) => toast.error(error.message),
  });

  if (!enabled || !open || !status.data?.required) return null;

  const close = () => {
    dismissForSession();
    setOpen(false);
  };

  return (
    <div role="dialog" aria-labelledby="terms-title" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-teal-300/30 bg-slate-900 text-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3 border-b border-white/10 p-5">
          <FileText className="mt-0.5 h-7 w-7 shrink-0 text-teal-300" />
          <div className="min-w-0 flex-1">
            <h2 id="terms-title" className="text-lg font-black">Atualizamos nossos Termos</h2>
            <p className="text-xs text-slate-400">{legalVersionHeadline()}</p>
          </div>
          <button type="button" onClick={close} className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Fechar e continuar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5 text-sm leading-relaxed text-slate-200">
          <p>Para continuar usando o GondUp com clareza sobre o contrato e o tratamento de dados, pedimos que o administrador da empresa leia e aceite os documentos atualizados.</p>
          <p>Você pode usar o sistema normalmente se fechar este aviso. Ele volta a aparecer na próxima sessão até o aceite ser registrado.</p>
          <p className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
            <a href="/termos" target="_blank" rel="noreferrer" className="text-teal-300 hover:underline">Ler os Termos de Uso</a>
            <a href="/privacidade" target="_blank" rel="noreferrer" className="text-teal-300 hover:underline">Ler a Política de Privacidade</a>
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[.04] p-3">
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => setChecked(value === true)}
              className="mt-0.5 border-white/40 data-[state=checked]:border-teal-300 data-[state=checked]:bg-teal-300 data-[state=checked]:text-slate-950"
            />
            <span>Li e aceito os Termos de Uso e a Política de Privacidade</span>
          </label>
        </div>
        <div className="flex flex-col gap-2 border-t border-white/10 p-4 sm:flex-row">
          <Button type="button" variant="outline" className="h-12 flex-1 border-white/15 bg-white/[.04] text-slate-200 hover:bg-white/10 hover:text-white" onClick={close}>
            Agora não
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 bg-teal-300 text-base font-black text-slate-950 hover:bg-teal-200"
            disabled={!checked || accept.isPending}
            onClick={() => accept.mutate({ version: LEGAL_TEXT_VERSION })}
          >
            {accept.isPending ? "Registrando..." : "Aceitar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
