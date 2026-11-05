import { useState } from "react";
import { X } from "lucide-react";

const KEY = "gondup-promoter-guide-dismissed";

/** Guia de passos para o promotor (some quando ele fecha). */
export default function PromoterGuide({ hasTimeTracking, hasFieldOperations, hasVisitCheckIn }: { hasTimeTracking: boolean; hasFieldOperations: boolean; hasVisitCheckIn: boolean }) {
  const [hidden, setHidden] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1");
  if (hidden) return null;
  const steps = [
    hasTimeTracking && { t: "Bata a entrada", d: "Ao chegar, toque em Entrada aqui em cima." },
    hasVisitCheckIn && { t: "Faça as visitas do roteiro", d: "Em cada loja, faça o Check-in, tire as fotos e depois o Check-out." },
    hasFieldOperations && !hasVisitCheckIn && { t: "Consulte o roteiro e tire fotos", d: "Veja as lojas do dia e registre fotos na galeria de cada loja." },
    hasTimeTracking && { t: "Bata a saída", d: "No fim do dia, toque em Saída para encerrar a jornada." },
  ].filter(Boolean) as { t: string; d: string }[];
  if (steps.length === 0) return null;
  return (
    <section aria-label="Como usar" className="rounded-2xl border border-sky-300/25 bg-sky-300/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-bold text-white">Seu dia em {steps.length} passos</h3>
        <button type="button" aria-label="Entendi, ocultar guia" onClick={() => { window.localStorage.setItem(KEY, "1"); setHidden(true); }} className="inline-flex h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white">Entendi <X className="h-4 w-4" /></button>
      </div>
      <ol className="mt-2 grid gap-2 sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.t} className="flex gap-3 rounded-xl bg-slate-950/50 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sky-400 text-sm font-black text-slate-950">{i + 1}</span>
            <span><span className="block font-semibold text-white">{s.t}</span><span className="block text-sm text-slate-300">{s.d}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
