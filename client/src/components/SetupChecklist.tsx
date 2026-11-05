import { useState } from "react";
import { CheckCircle2, Circle, X } from "lucide-react";

export type SetupStep = { key: string; label: string; hint: string; href: string; done: boolean };

const KEY = "gondup-setup-checklist-dismissed";

/** Passos da implantação (admin). Some sozinho quando tudo estiver feito, ou se a pessoa fechar. */
export function buildSetupSteps(c: { stores: number; promoters: number; routes: number; activity: boolean }): SetupStep[] {
  return [
    { key: "stores", label: "Cadastrar as lojas", hint: "Onde a equipe trabalha.", href: "/lojas", done: c.stores > 0 },
    { key: "promoters", label: "Convidar os promotores", hint: "Cada um recebe o próprio acesso.", href: "/admin/usuarios", done: c.promoters > 0 },
    { key: "routes", label: "Montar o primeiro roteiro", hint: "Quais lojas cada promotor visita e em que dias.", href: "/#roteiros", done: c.routes > 0 },
    { key: "activity", label: "Receber a primeira batida ou foto", hint: "Peça para um promotor entrar pelo celular e testar.", href: "/check-in-out", done: c.activity },
  ];
}

export default function SetupChecklist({ steps }: { steps: SetupStep[] }) {
  const [dismissed, setDismissed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(KEY) === "1");
  const done = steps.filter((s) => s.done).length;
  if (dismissed || done === steps.length) return null;
  const pct = Math.round((done / steps.length) * 100);
  return (
    <section aria-label="Primeiros passos" className="rounded-2xl border border-teal-300/30 bg-teal-300/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Primeiros passos</h3>
          <p className="mt-1 text-sm text-slate-300">{done} de {steps.length} concluídos. Siga a ordem para deixar a operação pronta.</p>
        </div>
        <button type="button" aria-label="Ocultar primeiros passos" onClick={() => { window.localStorage.setItem(KEY, "1"); setDismissed(true); }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${pct}%` }} /></div>
      <ol className="mt-4 space-y-2">
        {steps.map((s) => (
          <li key={s.key}>
            <a href={s.href} className={`flex min-h-[56px] items-center gap-3 rounded-xl border px-4 py-3 transition ${s.done ? "border-white/5 bg-white/[.02]" : "border-white/10 bg-slate-950/50 hover:border-teal-300/40"}`}>
              {s.done ? <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" /> : <Circle className="h-6 w-6 shrink-0 text-slate-500" />}
              <span className="min-w-0">
                <span className={`block font-semibold ${s.done ? "text-slate-400 line-through" : "text-white"}`}>{s.label}</span>
                {!s.done && <span className="block text-sm text-slate-300">{s.hint}</span>}
              </span>
              {!s.done && <span className="ml-auto shrink-0 text-sm font-bold text-teal-300">Fazer</span>}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Supervisor: o que precisa de ação hoje, em vez de números soltos. */
export function AttentionCard({ pendingVisits, expiring }: { pendingVisits: number; expiring: number }) {
  const items = [
    pendingVisits > 0 && { text: `${pendingVisits} visita(s) de hoje ainda não começaram`, href: "/#visitas" },
    expiring > 0 && { text: `${expiring} produto(s) vencendo nos próximos 30 dias`, href: "/produtos" },
  ].filter(Boolean) as { text: string; href: string }[];
  return (
    <section aria-label="Precisa da sua atenção" className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
      <h3 className="text-lg font-bold text-white">Precisa da sua atenção</h3>
      {items.length === 0 ? <p className="mt-2 flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5" /> Tudo em dia por enquanto.</p> : (
        <ul className="mt-3 space-y-2">
          {items.map((i) => <li key={i.href}><a href={i.href} className="flex min-h-[48px] items-center justify-between gap-3 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm font-semibold text-amber-50 hover:bg-amber-300/15">{i.text}<span className="shrink-0 text-amber-200">Ver</span></a></li>)}
        </ul>
      )}
    </section>
  );
}
