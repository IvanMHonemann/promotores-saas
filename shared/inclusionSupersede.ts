import { todayInZone } from "./expiry";

export const INCLUSION_SUPERSEDE_REASON = "Substituída pela correção aprovada.";

const PUNCH_LABEL: Record<string, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};

export type InclusionEvent = {
  id: number;
  type: string;
  time: Date | string | number;
  origin?: string | null;
  alreadyOut?: boolean;
  memberId?: number;
};

function timeMs(value: Date | string | number): number {
  if (typeof value === "number") return value;
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isTreatment(origin?: string | null): boolean {
  return origin === "inclusion" || origin === "adjustment";
}

/** Originals of the same type superseded by an approved inclusion/adjustment, paired by nearest time. */
export function idsSupersededByInclusion(events: InclusionEvent[]): number[] {
  const active = events.filter((e) => !e.alreadyOut);
  const byType = new Map<string, InclusionEvent[]>();
  for (const e of active) {
    const list = byType.get(e.type) || [];
    list.push(e);
    byType.set(e.type, list);
  }
  const gone = new Set<number>();
  for (const list of byType.values()) {
    const treatments = list.filter((e) => isTreatment(e.origin));
    const originals = list.filter((e) => !isTreatment(e.origin));
    if (!treatments.length || !originals.length) continue;
    const unused = [...originals];
    for (const treatment of treatments) {
      if (!unused.length) break;
      const t = timeMs(treatment.time);
      let best = 0;
      let bestDist = Math.abs(timeMs(unused[0].time) - t);
      for (let i = 1; i < unused.length; i++) {
        const d = Math.abs(timeMs(unused[i].time) - t);
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      }
      gone.add(unused[best].id);
      unused.splice(best, 1);
    }
  }
  return [...gone];
}

/** Same rule, grouping by person and civil day (America/Sao_Paulo by default). */
export function idsSupersededByInclusionGrouped(events: InclusionEvent[], timeZone = "America/Sao_Paulo"): number[] {
  const groups = new Map<string, InclusionEvent[]>();
  for (const e of events) {
    const day = todayInZone(new Date(timeMs(e.time)), timeZone);
    const key = `${e.memberId ?? 0}:${day}`;
    const list = groups.get(key) || [];
    list.push(e);
    groups.set(key, list);
  }
  const gone = new Set<number>();
  for (const list of groups.values()) {
    for (const id of idsSupersededByInclusion(list)) gone.add(id);
  }
  return [...gone];
}

/**
 * Inclusion of a type already present in the same shift is refused.
 * A new shift starts with an Entrada after a Saída; types can repeat in the new shift.
 */
export function inclusionBlockedMessage(
  dayEvents: Array<{ type: string; time: Date | string | number }>,
  type: string,
  time: Date | string | number,
): string | null {
  const t = timeMs(time);
  const lastOutBefore = dayEvents
    .filter((e) => e.type === "clock_out" && timeMs(e.time) < t)
    .sort((a, b) => timeMs(b.time) - timeMs(a.time))[0];
  const shiftStart = lastOutBefore ? timeMs(lastOutBefore.time) : -Infinity;
  const nextInAfterOut = lastOutBefore
    ? dayEvents
      .filter((e) => e.type === "clock_in" && timeMs(e.time) > shiftStart)
      .sort((a, b) => timeMs(a.time) - timeMs(b.time))[0]
    : null;
  const shiftEnd = nextInAfterOut && timeMs(nextInAfterOut.time) > t ? timeMs(nextInAfterOut.time) : Infinity;
  // If we're including a clock_in after a clock_out, that starts a new shift (allowed even if another clock_in exists earlier).
  const shiftEvents = dayEvents.filter((e) => {
    const ms = timeMs(e.time);
    if (type === "clock_in" && lastOutBefore && ms <= shiftStart) return false;
    if (type === "clock_in") return ms > shiftStart && ms < (shiftEnd === Infinity ? Infinity : shiftEnd);
    return ms > shiftStart && (shiftEnd === Infinity || ms < shiftEnd);
  });
  if (shiftEvents.some((e) => e.type === type)) {
    const label = PUNCH_LABEL[type] || type;
    return `Já existe um registro de ${label} neste dia. Para mudar o horário, use “Corrigir horário desta batida” em vez de incluir outra.`;
  }
  return null;
}
