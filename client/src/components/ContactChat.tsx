import { useEffect, useRef, useState } from "react";
import { MessageCircle, Pencil, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTACT_STEPS, OTHER_REASON, buildWhatsAppUrl, contactWhatsAppNumber, normalizeAnswer, questionText, validateContactField, type ContactAnswers } from "@/lib/contactChat";

const WHATSAPP = contactWhatsAppNumber(import.meta.env.VITE_CONTACT_WHATSAPP as string | undefined);
const LABELS: Record<string, string> = { motivo: "Motivo", nome: "Nome", empresa: "Empresa", telefone: "Telefone/WhatsApp", promotores: "Promotores", mensagem: "Mensagem" };

/** Formulário de contato em forma de chat: uma pergunta por vez e, no fim, abre o WhatsApp com as respostas. */
export default function ContactChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [answers, setAnswers] = useState<ContactAnswers>({});
  const [step, setStep] = useState(0);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [otherMode, setOtherMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const done = step >= CONTACT_STEPS.length;
  const current = CONTACT_STEPS[step];

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open, step]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [step, error, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;

  const submit = (skip = false, picked?: string) => {
    if (!current) return;
    const raw = picked ?? (skip ? "" : value);
    if (!(skip && current.optional)) {
      const err = validateContactField(current.field, raw);
      if (err) return setError(err);
      if (!raw.trim() && !current.optional) return setError("Responda para continuar.");
    }
    setAnswers(a => ({ ...a, [current.field]: raw.trim() ? normalizeAnswer(current.field, raw) : "" }));
    setValue(""); setError(null); setOtherMode(false); setStep(s => s + 1);
  };
  const pickOption = (opt: string) => { if (opt === OTHER_REASON) { setOtherMode(true); setError(null); setTimeout(() => inputRef.current?.focus(), 50); } else submit(false, opt); };
  const showOptions = Boolean(current?.options) && !otherMode;
  const restart = () => { setAnswers({}); setStep(0); setValue(""); setError(null); setOtherMode(false); };
  const editFrom = (i: number) => { const st = CONTACT_STEPS[i]; const prev = answers[st.field] || ""; const custom = Boolean(st.options) && prev !== "" && !st.options!.includes(prev); setOtherMode(custom); setValue(st.options && !custom ? "" : prev); setStep(i); setError(null); };

  const bubbleBot = "max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-800 px-4 py-2.5 text-sm text-slate-100";
  const bubbleUser = "ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-teal-400 px-4 py-2.5 text-sm font-medium text-slate-950 break-words";

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Fale conosco" onClick={onClose}>
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#07111f] text-white sm:h-[640px] sm:max-w-md sm:rounded-3xl sm:border sm:border-white/10 sm:shadow-2xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 bg-slate-900 px-4 py-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-400/15 text-teal-300"><MessageCircle className="h-5 w-5" /></span>
          <div className="flex-1"><p className="font-bold">Fale com o GondUp</p><p className="text-xs text-teal-300">Respondemos pelo WhatsApp</p></div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-2 text-slate-300 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {CONTACT_STEPS.slice(0, Math.min(step + 1, CONTACT_STEPS.length)).map((s, i) => (
            <div key={s.field} className="space-y-3">
              <div className={bubbleBot}>{questionText(s, answers)}</div>
              {i < step && <div className={bubbleUser}>{answers[s.field] || <span className="italic opacity-70">(pulou)</span>}</div>}
            </div>
          ))}
          {done && (
            <div className="space-y-3">
              <div className={bubbleBot}>
                <p className="mb-2">Pronto! Confira seus dados:</p>
                <dl className="space-y-1.5">
                  {CONTACT_STEPS.map((s, i) => answers[s.field] ? (
                    <div key={s.field} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1"><dt className="text-xs uppercase tracking-wide text-slate-400">{LABELS[s.field]}</dt><dd className="break-words">{answers[s.field]}</dd></div>
                      <button type="button" onClick={() => editFrom(i)} aria-label={`Corrigir ${LABELS[s.field]}`} className="rounded-full p-1 text-slate-400 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : null)}
                </dl>
                <p className="mt-2 text-xs text-slate-400">Ao tocar no botão, o WhatsApp abre com a mensagem pronta. É só enviar.</p>
              </div>
            </div>
          )}
          {error && <p role="alert" className="max-w-[85%] rounded-xl border border-rose-300/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-100">{error}</p>}
          <div ref={endRef} />
        </div>

        <footer className="border-t border-white/10 bg-slate-900 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          {done ? (
            <div className="flex gap-2">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10" onClick={restart}>Recomeçar</Button>
              <Button asChild className="h-11 flex-1 bg-[#25D366] font-bold text-slate-950 hover:bg-[#1fb957]">
                <a href={buildWhatsAppUrl(answers, WHATSAPP)} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-5 w-5" />Enviar pelo WhatsApp</a>
              </Button>
            </div>
          ) : showOptions ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Motivo do contato">
              {current!.options!.map(opt => (
                <button key={opt} type="button" onClick={() => pickOption(opt)} className="min-h-11 flex-1 basis-[45%] rounded-full border border-teal-300/40 bg-teal-300/10 px-4 py-2 text-sm font-semibold text-teal-100 hover:bg-teal-300/20">{opt}</button>
              ))}
            </div>
          ) : (
            <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
              <input ref={inputRef} value={value} onChange={e => { setValue(e.target.value); if (error) setError(null); }} placeholder={current?.placeholder}
                inputMode={current?.inputMode} type={current?.inputMode === "tel" ? "tel" : "text"} autoComplete={current?.field === "nome" ? "name" : current?.field === "telefone" ? "tel" : current?.field === "empresa" ? "organization" : "off"}
                aria-label={current?.placeholder} aria-invalid={Boolean(error)} maxLength={current?.field === "mensagem" ? 500 : current?.field === "motivo" ? 120 : 100}
                className="h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-slate-950 px-4 text-base text-white placeholder:text-slate-500 focus:border-teal-300 focus:outline-none sm:text-sm" />
              {otherMode && <Button type="button" variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => { setOtherMode(false); setValue(""); setError(null); }}>Voltar</Button>}
              {current?.optional && <Button type="button" variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => submit(true)}>Pular</Button>}
              <Button type="submit" aria-label="Enviar resposta" className="h-11 w-11 shrink-0 rounded-full bg-teal-400 p-0 text-slate-950 hover:bg-teal-300"><Send className="h-5 w-5" /></Button>
            </form>
          )}
        </footer>
      </div>
    </div>
  );
}
