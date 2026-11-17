/**
 * Regras dos dias sinalizados no calendário de correção de ponto do promotor.
 * Alinha com o aviso de "falta de batida" (jornada aberta) e com o espelho
 * (jornada incompleta e dia previsto sem marcação, respeitando feriado, férias e abono).
 */
export type PunchType = "clock_in" | "break_start" | "break_end" | "clock_out";
export type CorrectionDayMark = "ok" | "needs_correction" | "pending";

export type CorrectionDayFacts = {
  date: string; // YYYY-MM-DD
  today: string;
  punches: PunchType[]; // ordem cronológica, só as que contam
  hasPendingCorrection: boolean;
  excused: boolean; // feriado abonado, férias ou abono aprovado
  isWorkday: boolean | null; // null = jornada semanal não configurada
  workEndTime?: string | null; // HH:MM
  nowHm?: string | null; // horário atual em Brasília, para o dia de hoje
  lastPunchHm?: string | null;
};

/** A jornada do dia ficou aberta ou inconsistente (falta saída, retorno, etc.). */
export function journeyIsIncomplete(punches: PunchType[]): boolean {
  let openIn = false;
  let openBreak = false;
  for (const type of punches) {
    if (type === "clock_in") {
      if (openIn) return true;
      openIn = true;
    } else if (type === "break_start") {
      if (openBreak || !openIn) return true;
      openIn = false;
      openBreak = true;
    } else if (type === "break_end") {
      if (!openBreak) return true;
      openBreak = false;
      openIn = true;
    } else if (type === "clock_out") {
      if (!openIn) return true;
      openIn = false;
    }
  }
  return openBreak || openIn;
}

/**
 * No dia de hoje, só alerta depois do horário limite — igual ao aviso de falta de batida.
 * Sem limite configurado, espera o dia virar.
 */
export function todayIncompleteShouldAlert(opts: {
  workEndTime?: string | null;
  nowHm?: string | null;
  lastPunchHm?: string | null;
}): boolean {
  const limit = (opts.workEndTime || "").trim();
  const nowHm = opts.nowHm || "";
  if (!limit || !nowHm || nowHm < limit) return false;
  const last = opts.lastPunchHm || "";
  if (last && last >= limit) return false;
  return true;
}

export function classifyCorrectionDay(facts: CorrectionDayFacts): { mark: CorrectionDayMark; reason?: string } {
  if (facts.date > facts.today) return { mark: "ok" };
  if (facts.hasPendingCorrection) return { mark: "pending", reason: "Correção já pedida" };
  if (facts.excused) return { mark: "ok" };

  const incomplete = facts.punches.length > 0 && journeyIsIncomplete(facts.punches);
  const missingOnWorkday = facts.punches.length === 0 && facts.isWorkday === true;
  const isToday = facts.date === facts.today;

  if (isToday) {
    if (incomplete && todayIncompleteShouldAlert({ workEndTime: facts.workEndTime, nowHm: facts.nowHm, lastPunchHm: facts.lastPunchHm })) {
      return { mark: "needs_correction", reason: "Jornada incompleta" };
    }
    if (missingOnWorkday && todayIncompleteShouldAlert({ workEndTime: facts.workEndTime, nowHm: facts.nowHm, lastPunchHm: "00:00" })) {
      return { mark: "needs_correction", reason: "Batida faltando" };
    }
    return { mark: "ok" };
  }

  if (incomplete) return { mark: "needs_correction", reason: "Jornada incompleta" };
  if (missingOnWorkday) return { mark: "needs_correction", reason: "Batida faltando" };
  return { mark: "ok" };
}

export function countDaysNeedingCorrection(days: Array<{ mark: CorrectionDayMark }>): number {
  return days.filter((d) => d.mark === "needs_correction").length;
}

/** Semanas do mês, começando no domingo. Células fora do mês vêm nulas. */
export function monthWeeks(year: number, month: number): Array<Array<string | null>> {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay(); // 0 = domingo
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<string | null> = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<string | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabelPt(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const name = names[(m || 1) - 1];
  return `${name.charAt(0).toLocaleUpperCase("pt-BR")}${name.slice(1)} de ${y}`;
}

export const WEEKDAYS_PT_SUNDAY_FIRST = ["D", "S", "T", "Q", "Q", "S", "S"] as const;
export const WEEKDAY_LABELS_PT = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"] as const;
