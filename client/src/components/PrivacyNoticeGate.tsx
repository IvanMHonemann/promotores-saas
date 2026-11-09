import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { PRIVACY_NOTICE_SECTIONS, PRIVACY_NOTICE_TITLE, PRIVACY_NOTICE_VERSION } from "@shared/privacyNotice";

/**
 * Aviso de privacidade ao promotor (LGPD art. 9º). Não é consentimento: só pede ciência, com um toque.
 * Aparece no primeiro acesso e de novo sempre que a versão do texto mudar. Se a consulta falhar (offline), não bloqueia.
 */
export default function PrivacyNoticeGate() {
  const utils = trpc.useUtils();
  const status = trpc.lgpd.noticeStatus.useQuery(undefined, { staleTime: 5 * 60_000, retry: 1 });
  const ack = trpc.lgpd.acknowledgeNotice.useMutation({
    onSuccess: async () => { toast.success("Obrigado! Você pode consultar este aviso a qualquer momento em “Meus dados (LGPD)”."); await utils.lgpd.noticeStatus.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  if (!status.data?.required) return null;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="privacy-title" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-teal-300/30 bg-slate-900 text-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center gap-3 border-b border-white/10 p-5">
          <ShieldCheck className="h-7 w-7 shrink-0 text-teal-300" />
          <div>
            <h2 id="privacy-title" className="text-lg font-black">{PRIVACY_NOTICE_TITLE}</h2>
            <p className="text-xs text-slate-400">Leia antes de continuar · versão {PRIVACY_NOTICE_VERSION}</p>
          </div>
        </div>
        <div className="space-y-3 overflow-y-auto p-5 text-sm leading-relaxed text-slate-200">
          {PRIVACY_NOTICE_SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="font-bold text-white">{s.title}</h3>
              <p>{s.body}</p>
            </section>
          ))}
        </div>
        <div className="border-t border-white/10 p-4">
          <Button className="h-12 w-full bg-teal-300 text-base font-black text-slate-950 hover:bg-teal-200" disabled={ack.isPending} onClick={() => ack.mutate({ version: PRIVACY_NOTICE_VERSION })}>
            {ack.isPending ? "Registrando..." : "Li e estou ciente"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Registramos data, hora, endereço IP e aparelho desta ciência. Isto não é um pedido de autorização.</p>
        </div>
      </div>
    </div>
  );
}
