import { FileText, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/pages/AuthShell";
import { LEGAL_TEXTS, LEGAL_TEXT_VERSION } from "@shared/legalTexts";

type Kind = "termos" | "privacidade";
const TITLES: Record<Kind, string> = { termos: "Termos de Uso", privacidade: "Política de Privacidade" };

/**
 * Termos de Uso e Política de Privacidade — VERSÃO PRELIMINAR, em revisão pelo advogado.
 * Texto gerado de docs/juridico/*.md (scripts/gen-legal-texts.py).
 */
export default function LegalPage({ kind }: { kind: Kind }) {
  const sections = LEGAL_TEXTS[kind];
  return (
    <AuthShell title={TITLES[kind]} icon={kind === "termos" ? <FileText /> : <ShieldCheck />} backTo="/" backLabel="Voltar ao início">
      <div role="note" className="mb-5 rounded-2xl border border-amber-300/40 bg-amber-300/10 p-3 text-sm font-semibold text-amber-100">
        Versão preliminar ({LEGAL_TEXT_VERSION}), em revisão jurídica. Campos entre colchetes ainda serão preenchidos.
      </div>
      <div className="space-y-4 text-sm leading-6 text-slate-300">
        {sections.filter((s) => !s.h.startsWith("Pontos para o advogado")).map((s) => (
          <section key={s.h}>
            <h2 className="font-bold text-white">{s.h}</h2>
            {s.p.map((p, i) => <p key={i} className={p.startsWith("- ") ? "pl-3" : ""}>{p.replace(/^- /, "• ")}</p>)}
          </section>
        ))}
      </div>
    </AuthShell>
  );
}
