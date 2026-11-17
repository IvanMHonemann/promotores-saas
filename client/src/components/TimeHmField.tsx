import { formatTimeHmMask, isValidTimeHm, normalizeTimeHm } from "@shared/timeHm";
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
 * Relógio nativo (o seletor de hora e minuto do aparelho), com passo de 1 minuto (00–59).
 * O `step="60"` pede minutos completos; o seletor em lista do #149 foi desfeito a pedido.
 */
export default function TimeHmField({ value, onChange, id, name, required, disabled, className, ...rest }: Props) {
  const shown = isValidTimeHm(value) ? value : "";
  return (
    <input
      type="time"
      step={60}
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      value={shown}
      aria-label={rest["aria-label"] || "Horário (hora e minuto)"}
      onChange={(e) => {
        const raw = e.target.value;
        const normalized = normalizeTimeHm(formatTimeHmMask(raw)) || (isValidTimeHm(raw) ? raw.slice(0, 5) : "");
        onChange(normalized);
      }}
      className={cn(
        "h-11 min-h-11 w-full min-w-0 rounded-md border border-white/15 bg-slate-950/60 px-3 text-base tabular-nums text-slate-100 [color-scheme:dark] placeholder:text-slate-500 sm:h-10 sm:min-h-10 sm:text-sm",
        className,
      )}
    />
  );
}
