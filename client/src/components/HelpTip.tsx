import { useState } from "react";
import { HelpCircle } from "lucide-react";

/** Ícone "?" com uma explicação curta. Funciona no toque (celular) e no mouse. */
export default function HelpTip({ text, label = "Ajuda" }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}
        className="grid h-8 w-8 place-items-center rounded-full text-slate-300 hover:bg-white/10 hover:text-white">
        <HelpCircle className="h-5 w-5" />
      </button>
      {open && <span role="tooltip" className="absolute left-1/2 top-9 z-50 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm font-normal leading-5 text-slate-200 shadow-xl">{text}</span>}
    </span>
  );
}
