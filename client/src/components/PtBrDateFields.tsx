import { MESES_PT, capitalizePt, formatDatePT, formatMonthYearPT, maskDatePT, parseDatePT } from "@shared/ptBrDate";
import { currentMonthSP } from "@/lib/downloadBase64";
import { useEffect, useState } from "react";

type FieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  "aria-label"?: string;
};

const fieldClass = "h-10 rounded-md border border-white/15 bg-slate-950/60 px-3 text-sm text-slate-100";

/** Seletor de mês com nomes em português, independente do idioma do navegador. */
export function MonthInput({ id, value, onChange, className, min, max, ...rest }: FieldProps) {
  const [year, month] = (value || "").split("-").map(Number);
  const currentYear = year || new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
  const setPart = (nextYear: number, nextMonth: number) => {
    const ym = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    if (min && ym < min) return;
    if (max && ym > max) return;
    onChange(ym);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select
        id={id}
        aria-label={rest["aria-label"] || "Mês"}
        value={month || ""}
        onChange={(e) => setPart(currentYear, Number(e.target.value))}
        className={className || fieldClass}
      >
        {MESES_PT.map((name, i) => {
          const ym = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
          const disabled = Boolean((min && ym < min) || (max && ym > max));
          return <option key={name} value={i + 1} disabled={disabled}>{capitalizePt(name)}</option>;
        })}
      </select>
      <select
        aria-label="Ano"
        value={currentYear}
        onChange={(e) => setPart(Number(e.target.value), month || 1)}
        className={className || fieldClass}
      >
        {years.map((y) => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}

/** Lista compacta dos últimos meses (ex.: banco de horas), sempre em português. */
export function MonthSelect({ id, value, onChange, className, months = 18, max, "aria-label": ariaLabel }: FieldProps & { months?: number }) {
  const cap = max || currentMonthSP();
  const [cy, cm] = cap.split("-").map(Number);
  const origin = cy && cm ? new Date(cy, cm - 1, 15) : new Date();
  const options = Array.from({ length: months }, (_, i) => {
    const d = new Date(origin.getFullYear(), origin.getMonth() - i, 15);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value: ym, label: formatMonthYearPT(ym, true) };
  });
  if (value && !options.some((o) => o.value === value)) {
    options.unshift({ value, label: formatMonthYearPT(value, true) });
  }
  return (
    <select id={id} aria-label={ariaLabel || "Mês"} value={value} onChange={(e) => onChange(e.target.value)} className={className || fieldClass}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Campo de data no formato dd/mm/aaaa, com ícone de calendário nativo. */
export function DateInput({ id, value, onChange, className, min, max, ...rest }: FieldProps) {
  const [text, setText] = useState(value ? formatDatePT(value) : "");
  useEffect(() => { setText(value ? formatDatePT(value) : ""); }, [value]);
  return (
    <div className="relative inline-flex min-w-0 items-center">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        aria-label={rest["aria-label"]}
        value={text}
        onChange={(e) => {
          const masked = maskDatePT(e.target.value);
          setText(masked);
          if (!masked) onChange("");
          const iso = parseDatePT(masked);
          if (iso) {
            if (min && iso < min) return;
            if (max && iso > max) return;
            onChange(iso);
          }
        }}
        onBlur={() => setText(value ? formatDatePT(value) : "")}
        className={`${className || fieldClass} pr-10`}
      />
      <input
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ""}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2 cursor-pointer opacity-0"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-teal-300" aria-hidden>📅</span>
    </div>
  );
}
