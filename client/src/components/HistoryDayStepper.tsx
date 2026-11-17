import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDayLabelPt, shiftDay } from "@shared/correctionCalendar";

type Props = {
  id?: string;
  value: string;
  today: string;
  onChange: (date: string) => void;
  onOpenCalendar?: () => void;
};

/** Seletor compacto do dia no histórico: setas e data em pt-BR, sem o calendário completo. */
export default function HistoryDayStepper({ id, value, today, onChange, onOpenCalendar }: Props) {
  const prev = shiftDay(value, -1);
  const next = shiftDay(value, 1);
  const canNext = next <= today;
  const label = formatDayLabelPt(value);

  return (
    <div id={id} className="flex items-center gap-1 rounded-2xl border border-white/15 bg-slate-950/70 p-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Dia anterior"
        onClick={() => onChange(prev)}
        className="h-11 w-11 shrink-0 text-teal-200 hover:bg-white/10 hover:text-white"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <button
        type="button"
        onClick={onOpenCalendar}
        aria-label={`${label}. Abrir calendário de correção`}
        className="min-h-11 min-w-0 flex-1 rounded-xl px-2 text-center text-sm font-semibold text-white hover:bg-white/10"
      >
        {label}
      </button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Próximo dia"
        disabled={!canNext}
        onClick={() => canNext && onChange(next)}
        className="h-11 w-11 shrink-0 text-teal-200 hover:bg-white/10 hover:text-white disabled:text-slate-600"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
