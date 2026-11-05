import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; danger?: boolean };
type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let open: ((p: Pending) => void) | null = null;

/** Confirmação própria (substitui o confirm() do navegador). Resolve true se a pessoa confirmar. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!open) { resolve(window.confirm([options.title, options.description].filter(Boolean).join("\n\n"))); return; }
    open({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  useEffect(() => { open = setPending; return () => { open = null; }; }, []);
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  if (!pending) return null;
  const finish = (ok: boolean) => { pending.resolve(ok); setPending(null); };
  const danger = pending.danger !== false;
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => finish(false)}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0b1626] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start gap-3">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${danger ? "bg-rose-500/15 text-rose-300" : "bg-teal-400/15 text-teal-300"}`}><AlertTriangle className="h-5 w-5" /></span>
          <div>
            <h2 id="confirm-title" className="text-lg font-bold">{pending.title}</h2>
            {pending.description && <p className="mt-1 text-sm leading-6 text-slate-300">{pending.description}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => finish(false)} className="h-12 rounded-xl border border-white/15 px-5 font-semibold text-slate-200 hover:bg-white/10">{pending.cancelLabel || "Cancelar"}</button>
          <button type="button" autoFocus onClick={() => finish(true)} className={`h-12 rounded-xl px-5 font-bold ${danger ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-teal-400 text-slate-950 hover:bg-teal-300"}`}>{pending.confirmLabel || "Confirmar"}</button>
        </div>
      </div>
    </div>
  );
}
