import { FileText, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/pages/AuthShell";
import { LEGAL_TEXTS } from "@shared/legalTexts";
import { legalVersionHeadline } from "@shared/legalAcceptance";

type Kind = "termos" | "privacidade";
const TITLES: Record<Kind, string> = { termos: "Termos de Uso", privacidade: "Política de Privacidade" };

/** Termos de Uso e Política de Privacidade — texto gerado de docs/juridico (scripts/gen-legal-texts.py). */
export default function LegalPage({ kind }: { kind: Kind }) {
  const sections = LEGAL_TEXTS[kind];
  const other: Kind = kind === "termos" ? "privacidade" : "termos";
  return (
    <AuthShell title={TITLES[kind]} subtitle={legalVersionHeadline()} icon={kind === "termos" ? <FileText /> : <ShieldCheck />} backTo="/" backLabel="Voltar ao início" wide>
      <nav className="mb-6 flex flex-wrap gap-3 text-sm font-semibold">
        <a href="/termos" className={kind === "termos" ? "text-teal-300" : "text-slate-400 hover:text-white hover:underline"}>{TITLES.termos}</a>
        <span className="text-slate-600">·</span>
        <a href="/privacidade" className={kind === "privacidade" ? "text-teal-300" : "text-slate-400 hover:text-white hover:underline"}>{TITLES.privacidade}</a>
      </nav>
      <div className="space-y-5 text-sm leading-7 text-slate-300">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-bold text-white">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className={p.startsWith("- ") ? "pl-3" : ""}>{p.replace(/^- /, "• ")}</p>)}
          </section>
        ))}
      </div>
      <p className="mt-8 text-center text-xs text-slate-500">
        Também disponível: <a href={`/${other}`} className="text-teal-300 hover:underline">{TITLES[other]}</a>.
      </p>
    </AuthShell>
  );
}
