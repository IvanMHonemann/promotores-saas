/** Regras simples dos roteiros semanais (usadas no servidor e na tela). */

export const WEEKDAY_LABELS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"] as const;
/** Ordem de exibição: segunda a domingo. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABELS[weekday] ?? "dia inválido";
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function defaultRouteName(weekday: number): string {
  return `Roteiro de ${weekdayLabel(weekday)}`;
}

type ScheduleKey = { id: number; promoterId: number; weekday: number };

/** Outro roteiro que já ocupa o mesmo promotor + dia (cada promotor tem um roteiro por dia). */
export function findScheduleConflict<T extends ScheduleKey>(schedules: T[], promoterId: number, weekday: number, ignoreId?: number | null): T | undefined {
  return schedules.find((s) => s.promoterId === promoterId && s.weekday === weekday && s.id !== ignoreId);
}

/** Filtra por promotor ("all" = todos) e ordena de segunda a domingo. */
export function filterAndSortSchedules<T extends ScheduleKey>(schedules: T[], promoterId: number | "all"): T[] {
  const pos = (day: number) => WEEKDAY_ORDER.indexOf(day as any);
  return schedules
    .filter((s) => promoterId === "all" || s.promoterId === promoterId)
    .slice()
    .sort((a, b) => pos(a.weekday) - pos(b.weekday) || a.promoterId - b.promoterId || a.id - b.id);
}

/** Texto enviado pelo botão Compartilhar (WhatsApp etc.). */
export function buildRouteShareText(input: { name: string; weekday?: number | null; promoterName?: string | null; storeNames: string[] }): string {
  const lines = [`Roteiro: ${input.name}`];
  if (input.promoterName) lines.push(`Promotor: ${input.promoterName}`);
  if (input.weekday != null) lines.push(`Dia: ${capitalize(weekdayLabel(input.weekday))}`);
  if (input.storeNames.length) {
    lines.push("", "Lojas na ordem:");
    input.storeNames.forEach((name, i) => lines.push(`${i + 1}. ${name}`));
  }
  return lines.join("\n");
}

/** Move um item da lista de lojas para cima (-1) ou para baixo (+1). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = list.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

type OccurrenceKey = { id: number; weeklyScheduleId?: number | null; date?: unknown };

/**
 * Ocorrências repetidas do mesmo roteiro semanal no mesmo dia (sobra de corrida antiga ao editar).
 * Devolve os ids que devem ficar escondidos: mantém a que já tem visita iniciada (ou a mais antiga);
 * se mais de uma já tem visita iniciada, nenhuma com trabalho feito é escondida.
 */
export function duplicateOccurrenceIds<T extends OccurrenceKey>(routes: T[], startedRouteIds: Iterable<number> = []): Set<number> {
  const started = new Set(startedRouteIds);
  const groups = new Map<string, T[]>();
  for (const route of routes) {
    if (!route.weeklyScheduleId) continue;
    const day = route.date instanceof Date ? route.date.toISOString().slice(0, 10) : String(route.date ?? "").slice(0, 10);
    const key = `${route.weeklyScheduleId}|${day}`;
    groups.set(key, [...(groups.get(key) || []), route]);
  }
  const hidden = new Set<number>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const keep = sorted.find((r) => started.has(r.id)) ?? sorted[0];
    for (const r of sorted) if (r.id !== keep.id && !started.has(r.id)) hidden.add(r.id);
  }
  return hidden;
}
