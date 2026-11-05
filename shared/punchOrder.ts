/** Ordem cronológica das batidas de um dia (entrada → intervalo → retorno → saída). */
export type PunchType = "clock_in" | "break_start" | "break_end" | "clock_out";
export type Punch = { type: PunchType; time: Date | string | number; id?: number | null };

export const PUNCH_ORDER: PunchType[] = ["clock_in", "break_start", "break_end", "clock_out"];
export const PUNCH_LABEL: Record<PunchType, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo", clock_out: "Saída" };

const ms = (t: Date | string | number) => (t instanceof Date ? t.getTime() : new Date(t).getTime());
function hhmm(t: Date | string | number, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(ms(t)));
}

/** Ordena por horário (empate: pela ordem natural da jornada). */
export function sortPunches<T>(items: T[], getTime: (i: T) => Date | string | number = (i: any) => i.time, getType?: (i: T) => string): T[] {
  return items.slice().sort((a, b) => ms(getTime(a)) - ms(getTime(b)) || (getType ? PUNCH_ORDER.indexOf(getType(a) as PunchType) - PUNCH_ORDER.indexOf(getType(b) as PunchType) : 0));
}

/**
 * Confere se, aplicando a correção (`change` substitui a batida `replaceId`, se houver), as batidas do dia
 * continuam em ordem. Devolve a mensagem de erro em português ou null se estiver tudo certo.
 */
export function punchOrderError(existing: Punch[], change: Punch & { replaceId?: number | null }, timeZone = "America/Sao_Paulo"): string | null {
  const all = existing.filter((p) => change.replaceId == null || p.id !== change.replaceId).concat([{ type: change.type, time: change.time }]);
  const t = ms(change.time);
  for (const other of all) {
    if (other === all[all.length - 1]) continue;
    const a = PUNCH_ORDER.indexOf(other.type), b = PUNCH_ORDER.indexOf(change.type);
    if (a === b) continue;
    const ot = ms(other.time);
    if (a < b && ot >= t) return `${PUNCH_LABEL[change.type]} (${hhmm(t, timeZone)}) precisa ser depois de ${PUNCH_LABEL[other.type]} (${hhmm(ot, timeZone)}). Confira o horário.`;
    if (a > b && ot <= t) return `${PUNCH_LABEL[change.type]} (${hhmm(t, timeZone)}) precisa ser antes de ${PUNCH_LABEL[other.type]} (${hhmm(ot, timeZone)}). Confira o horário.`;
  }
  return null;
}
