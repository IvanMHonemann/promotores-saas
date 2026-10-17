import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type BusyState = { label: string; progress: number | null; detail?: string };

export type BusyControls = {
  /** Atualiza a barra de progresso (0–1) e, opcionalmente, um texto de detalhe (ex.: "3 de 10"). */
  setProgress: (value: number | null, detail?: string) => void;
  /** Troca o texto principal durante a execução. */
  setLabel: (label: string) => void;
};

type BusyContextValue = {
  /**
   * Executa uma função demorada exibindo o carregamento visual em tela cheia.
   * O indicador só aparece se a ação passar de ~150 ms (evita piscar em ações rápidas)
   * e some sozinho ao terminar, mesmo se ocorrer erro.
   */
  run: <T,>(label: string, task: (controls: BusyControls) => Promise<T>) => Promise<T>;
};

const BusyContext = createContext<BusyContextValue | null>(null);

const SHOW_DELAY_MS = 150;

export function BusyProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BusyState | null>(null);
  const [visible, setVisible] = useState(false);
  const activeRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  const run = useCallback<BusyContextValue["run"]>(async (label, task) => {
    activeRef.current += 1;
    setState({ label, progress: null });
    if (activeRef.current === 1) {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    }
    const controls: BusyControls = {
      setProgress: (value, detail) => setState((s) => (s ? { ...s, progress: value == null ? null : Math.min(1, Math.max(0, value)), detail } : s)),
      setLabel: (next) => setState((s) => (s ? { ...s, label: next } : s)),
    };
    try {
      return await task(controls);
    } finally {
      activeRef.current = Math.max(0, activeRef.current - 1);
      if (activeRef.current === 0) {
        if (timerRef.current) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        setVisible(false);
        setState(null);
      }
    }
  }, []);

  const value = useMemo(() => ({ run }), [run]);

  return (
    <BusyContext.Provider value={value}>
      {children}
      {visible && state && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-live="polite"
          aria-label={state.label}
        >
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-teal-300" />
            <p className="mt-4 text-base font-semibold text-white">{state.label}</p>
            {state.detail && <p className="mt-1 text-xs text-slate-400">{state.detail}</p>}
            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/10">
              {state.progress == null ? (
                <div className="h-full w-1/3 animate-[busy-slide_1.1s_ease-in-out_infinite] rounded-full bg-teal-300" />
              ) : (
                <div className="h-full rounded-full bg-teal-300 transition-[width] duration-200" style={{ width: `${Math.round(state.progress * 100)}%` }} />
              )}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">Aguarde, não feche esta tela.</p>
          </div>
          <style>{`@keyframes busy-slide{0%{transform:translateX(-110%)}100%{transform:translateX(320%)}}`}</style>
        </div>
      )}
    </BusyContext.Provider>
  );
}

export function useBusy(): BusyContextValue {
  const ctx = useContext(BusyContext);
  if (!ctx) {
    // Fora do provider: executa normalmente, sem indicador (evita quebrar telas isoladas/testes).
    return { run: (_label, task) => task({ setProgress: () => {}, setLabel: () => {} }) };
  }
  return ctx;
}
