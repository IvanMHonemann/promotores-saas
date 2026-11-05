import { useEffect, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

/**
 * Indicador global de "salvando": aparece quando qualquer ação (mutação) demora mais de ~400 ms,
 * para o usuário não achar que o clique foi ignorado (ex.: excluir/cadastrar produto em conexão lenta).
 */
export function GlobalMutationIndicator() {
  const pending = useIsMutating();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (pending === 0) { setVisible(false); return; }
    const timer = window.setTimeout(() => setVisible(true), 400);
    return () => window.clearTimeout(timer);
  }, [pending]);
  if (!visible) return null;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[100]">
      <div className="h-1 w-full animate-pulse bg-gradient-to-r from-teal-300 via-emerald-300 to-teal-300" />
      <div className="mx-auto mt-2 flex w-fit items-center gap-2 rounded-full border border-white/15 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" /> Salvando...
      </div>
    </div>
  );
}
