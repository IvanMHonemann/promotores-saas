import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { listOutbox } from "@/lib/outboxDb";
import { isStandaloneDisplay } from "@/pwa/hooks";

/** Aplica a versão nova do app (service worker em espera). Não apaga a fila offline nem o cache. */
export async function applyWaitingUpdate() {
  const waiting: ServiceWorker | undefined = (window as any).__gondupWaitingSW;
  if (waiting) waiting.postMessage({ type: "SKIP_WAITING" }); // controllerchange (main.tsx) recarrega
  else window.location.reload();
}

export function SwUpdatePrompt() {
  const [visible, setVisible] = useState(() => Boolean((window as any).__gondupWaitingSW));
  const [pending, setPending] = useState(0);
  useEffect(() => {
    const show = () => { setVisible(true); void listOutbox().then((l) => setPending(l.filter((i) => i.status === "sending").length)); };
    window.addEventListener("gondup:sw-update", show);
    return () => window.removeEventListener("gondup:sw-update", show);
  }, []);
  // Em aba do navegador a atualização roda em silêncio (main.tsx); o aviso fica só no app instalado.
  if (!visible || !isStandaloneDisplay()) return null;
  return (
    <div role="status" data-testid="sw-update" className="fixed inset-x-3 bottom-14 z-[75] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-violet-300/40 bg-slate-900/95 p-3 text-sm text-violet-50 shadow-xl print:hidden">
      <RefreshCw className="h-5 w-5 shrink-0 text-violet-300" />
      <span className="flex-1">Nova versão do app disponível.{pending ? " Aguarde o envio terminar." : " Seus dados guardados continuam no aparelho."}</span>
      <button type="button" className="rounded-lg bg-violet-400 px-3 py-1.5 font-bold text-slate-950" onClick={() => void applyWaitingUpdate()}>Recarregar</button>
      <button type="button" className="rounded-lg px-2 py-1.5 text-violet-200 hover:bg-white/10" onClick={() => setVisible(false)}>Depois</button>
    </div>
  );
}
