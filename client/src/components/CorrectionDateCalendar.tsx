import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  WEEKDAYS_PT_SUNDAY_FIRST,
  WEEKDAY_LABELS_PT,
  monthLabelPt,
  monthWeeks,
  shiftMonth,
  type CorrectionDayMark,
} from "@shared/correctionCalendar";

export type CalendarDayInfo = { date: string; mark: CorrectionDayMark; reason?: string };

type Props = {
  id?: string;
  value: string; // YYYY-MM-DD
  month: string; // YYYY-MM
  today: string;
  days?: CalendarDayInfo[];
  needsCorrectionCount?: number;
  onChange: (date: string) => void;
  onMonthChange: (month: string) => void;
  className?: string;
};

const MARK_DOT: Record<CorrectionDayMark, string> = {
  ok: "",
  needs_correction: "bg-amber-400",
  pending: "bg-sky-300",
};

export default function CorrectionDateCalendar({
  id, value, month, today, days = [], needsCorrectionCount = 0, onChange, onMonthChange, className = "",
}: Props) {
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const [year, mon] = month.split("-").map(Number);
  const weeks = monthWeeks(year, mon);
  const canGoNext = month < today.slice(0, 7);

  return (
    <div id={id} className={`w-full max-w-md rounded-2xl border border-white/15 bg-slate-950/70 p-3 text-white ${className}`}>
      {needsCorrectionCount > 0 && (
        <p className="mb-2 text-sm font-semibold text-amber-100">
          {needsCorrectionCount === 1 ? "1 dia precisa de correção" : `${needsCorrectionCount} dias precisam de correção`} neste mês
        </p>
      )}
      {needsCorrectionCount === 0 && days.length > 0 && (
        <p className="mb-2 text-sm text-slate-300">Nenhum dia pendente de correção neste mês</p>
      )}

      <div className="mb-2 flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Mês anterior"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          className="h-10 w-10 shrink-0 text-teal-200 hover:bg-white/10 hover:text-white"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="text-center text-sm font-bold capitalize text-white">{monthLabelPt(month)}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Próximo mês"
          disabled={!canGoNext}
          onClick={() => canGoNext && onMonthChange(shiftMonth(month, 1))}
          className="h-10 w-10 shrink-0 text-teal-200 hover:bg-white/10 hover:text-white disabled:text-slate-600"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS_PT_SUNDAY_FIRST.map((label, i) => (
          <div key={`${label}-${i}`} aria-hidden>{label}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((date, i) => {
          if (!date) return <div key={`e-${i}`} className="min-h-11" />;
          const info = byDate.get(date);
          const mark = info?.mark ?? "ok";
          const isSelected = date === value;
          const isToday = date === today;
          const isFuture = date > today;
          const dayNum = Number(date.slice(8, 10));
          const weekday = i % 7;
          return (
            <button
              key={date}
              type="button"
              disabled={isFuture}
              onClick={() => onChange(date)}
              aria-label={`${dayNum} de ${monthLabelPt(month)}, ${WEEKDAY_LABELS_PT[weekday]}${isToday ? ", hoje" : ""}${mark === "needs_correction" ? ", precisa de correção" : mark === "pending" ? ", correção já pedida" : ""}`}
              aria-current={isSelected ? "date" : undefined}
              className={[
                "relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-xl text-sm font-semibold transition",
                isFuture ? "cursor-not-allowed text-slate-600" : "text-slate-100 hover:bg-white/10",
                isSelected ? "bg-teal-300 text-slate-950 hover:bg-teal-200 hover:text-slate-950" : "",
                !isSelected && isToday ? "ring-1 ring-teal-300/80" : "",
              ].join(" ")}
            >
              <span>{dayNum}</span>
              {mark !== "ok" && !isFuture && (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? (mark === "pending" ? "bg-sky-800" : "bg-rose-700") : MARK_DOT[mark]}`}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-300">
        <li className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" aria-hidden />Precisa de correção</li>
        <li className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-300" aria-hidden />Correção já pedida</li>
        <li className="text-slate-400">Dias futuros não podem ser escolhidos</li>
      </ul>
    </div>
  );
}
