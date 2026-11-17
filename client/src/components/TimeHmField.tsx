import { useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatTimeHmMask, HOUR_OPTIONS, isValidTimeHm, MINUTE_OPTIONS, normalizeTimeHm } from "@shared/timeHm";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

/**
 * Campo de horário com qualquer minuto (00–59).
 * Substitui o input nativo type=time, que no Android costuma pular de 5 em 5 minutos.
 */
export default function TimeHmField({ value, onChange, id, name, required, disabled, className, ...rest }: Props) {
  const [text, setText] = useState(value || "");
  const [open, setOpen] = useState(false);
  const hourRef = useRef<HTMLButtonElement | null>(null);
  const minuteRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setText(value || "");
  }, [value]);

  useEffect(() => {
    if (!open) return;
    hourRef.current?.scrollIntoView({ block: "center" });
    minuteRef.current?.scrollIntoView({ block: "center" });
  }, [open, value]);

  const hour = isValidTimeHm(value) ? value.slice(0, 2) : "";
  const minute = isValidTimeHm(value) ? value.slice(3, 5) : "";

  const pick = (h: string, m: string) => {
    const next = `${h}:${m}`;
    onChange(next);
    setText(next);
  };

  const listClass = "flex max-h-56 w-[4.5rem] flex-col overflow-y-auto overscroll-contain rounded-lg bg-slate-950/80 py-1";
  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-11 w-full items-center justify-center text-base font-semibold tabular-nums",
      active ? "bg-teal-300 text-slate-950" : "text-slate-100 hover:bg-white/10",
    );

  const hourButtons = useMemo(
    () =>
      HOUR_OPTIONS.map((h) => (
        <button
          key={h}
          type="button"
          ref={h === hour ? hourRef : undefined}
          className={itemClass(h === hour)}
          onClick={() => pick(h, minute || "00")}
        >
          {h}
        </button>
      )),
    [hour, minute],
  );
  const minuteButtons = useMemo(
    () =>
      MINUTE_OPTIONS.map((m) => (
        <button
          key={m}
          type="button"
          ref={m === minute ? minuteRef : undefined}
          className={itemClass(m === minute)}
          onClick={() => pick(hour || "00", m)}
        >
          {m}
        </button>
      )),
    [hour, minute],
  );

  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <input
        id={id}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        placeholder="--:--"
        required={required}
        disabled={disabled}
        value={text}
        aria-label={rest["aria-label"] || "Horário (hora e minuto)"}
        onChange={(e) => {
          const masked = formatTimeHmMask(e.target.value);
          setText(masked);
          const normalized = normalizeTimeHm(masked);
          onChange(normalized || (isValidTimeHm(masked) ? masked : ""));
        }}
        onBlur={() => {
          const normalized = normalizeTimeHm(text);
          setText(normalized || text);
          if (normalized) onChange(normalized);
        }}
        className="h-11 min-h-11 w-full min-w-0 rounded-md border border-white/15 bg-slate-950/60 px-3 text-base tabular-nums text-slate-100 [color-scheme:dark] placeholder:text-slate-500 sm:h-10 sm:min-h-10 sm:text-sm"
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Abrir seletor de hora e minuto"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-white/15 bg-slate-950/80 text-teal-200 hover:bg-white/10 disabled:opacity-50 sm:h-10 sm:w-10"
          >
            <Clock className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-auto border-white/15 bg-slate-900 p-3 text-slate-100 shadow-xl"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Hora e minuto (00 a 59)</p>
          <div className="flex gap-2">
            <div>
              <p className="mb-1 text-center text-[11px] text-slate-400">Hora</p>
              <div className={listClass}>{hourButtons}</div>
            </div>
            <div>
              <p className="mb-1 text-center text-[11px] text-slate-400">Minuto</p>
              <div className={listClass}>{minuteButtons}</div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
