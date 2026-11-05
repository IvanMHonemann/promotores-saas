import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";

export const BALLOON_DISMISS_KEY = "gondup:fale-conosco-balao";

/** Bolinha de chat fixa no canto inferior direito, com balão "Fale conosco". */
export default function FloatingContactButton({ onOpen, hidden = false }: { onOpen: () => void; hidden?: boolean }) {
  const [balloon, setBalloon] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = sessionStorage.getItem(BALLOON_DISMISS_KEY) === "1"; } catch { /* ignore */ }
    if (dismissed) return;
    const show = setTimeout(() => setBalloon(true), 1200);
    // No celular o balão some sozinho depois de alguns segundos; a bolinha continua.
    const isMobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 639px)").matches;
    const hide = isMobile ? setTimeout(() => setBalloon(false), 9000) : undefined;
    return () => { clearTimeout(show); if (hide) clearTimeout(hide); };
  }, []);
  const dismiss = () => {
    setBalloon(false);
    try { sessionStorage.setItem(BALLOON_DISMISS_KEY, "1"); } catch { /* ignore */ }
  };
  if (hidden) return null;
  return (
    <div className="pointer-events-none fixed z-[90] flex items-end gap-3"
      style={{ right: "max(1rem, env(safe-area-inset-right))", bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      {balloon && (
        <div className="pointer-events-auto relative mb-2 animate-in fade-in slide-in-from-right-2 rounded-2xl rounded-br-sm bg-white px-4 py-2.5 text-sm font-bold text-slate-900 shadow-xl shadow-black/30">
          <button type="button" onClick={() => { dismiss(); onOpen(); }} className="pr-5 text-left">Fale conosco! 👋</button>
          <button type="button" onClick={dismiss} aria-label="Fechar balão" className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <button type="button" onClick={() => { dismiss(); onOpen(); }} aria-label="Fale conosco"
        className="pointer-events-auto relative grid h-16 w-16 place-items-center rounded-full bg-teal-400 text-slate-950 shadow-2xl shadow-teal-500/40 ring-4 ring-teal-300/30 transition hover:scale-105 hover:bg-teal-300 focus:outline-none focus-visible:ring-white motion-safe:animate-[bounce_2.4s_ease-in-out_3]">
        {balloon && <span className="absolute inset-0 rounded-full bg-teal-400 opacity-60 motion-safe:animate-ping" aria-hidden />}
        <MessageCircle className="relative h-8 w-8" />
      </button>
    </div>
  );
}
