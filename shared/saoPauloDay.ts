/** Início (inclusive) e fim (exclusive) do dia civil em America/Sao_Paulo. */
export function saoPauloDayRange(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Data inválida.");
  const start = new Date(`${date}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function isInSaoPauloDay(value: Date, date: string): boolean {
  const { start, end } = saoPauloDayRange(date);
  return value >= start && value < end;
}

/** Pedido em aberto que impede um novo envio da mesma batida: só os PENDENTES. */
export function hasPendingSamePunch(existing: Array<{
  status?: string | null;
  requestedTime: Date | string;
  requestedType?: string | null;
  timeEventId?: number | null;
  isFullDay?: boolean;
}>, opts: { day: string; requestedType?: string | null; timeEventId?: number | null; fullDay?: boolean; dayOf: (value: Date | string) => string }): boolean {
  return existing.some((row) => {
    if (row.status && row.status !== "pending") return false;
    if (opts.dayOf(row.requestedTime) !== opts.day) return false;
    if (opts.fullDay) return Boolean(row.isFullDay);
    if (row.isFullDay) return false;
    return row.requestedType === opts.requestedType && (row.timeEventId ?? null) === (opts.timeEventId ?? null);
  });
}
