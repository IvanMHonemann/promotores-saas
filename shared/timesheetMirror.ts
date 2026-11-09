/**
 * Cálculo do Espelho de Ponto (puro, sem I/O).
 * Regras: nada é inventado. Jornada prevista, horas extras e adicional noturno só são calculados quando a
 * empresa configurou o perfil trabalhista do funcionário; caso contrário o relatório informa a ausência.
 * Marcações originais nunca são substituídas: ajustes aparecem separados (original x tratado).
 * Feriados nacionais são identificados automaticamente: falta de batida é abonada, mas o ponto continua liberado.
 */
import { getBrazilianHoliday } from "./holidays";
import { fullDayExcuseLabel, isFullDayExcuseType, type FullDayExcuseType } from "./correctionExcuse";

export type MarkType = "clock_in" | "break_start" | "break_end" | "clock_out";
export const MARK_LABEL: Record<MarkType, string> = { clock_in: "Entrada", break_start: "Início do intervalo", break_end: "Retorno do intervalo", clock_out: "Saída" };

export type MirrorEvent = {
  id: number;
  type: MarkType;
  /** Instante considerado pelo sistema (deviceTime, senão serverTime), ISO UTC. */
  time: string;
  /** Instante em que o servidor recebeu a marcação, ISO UTC. */
  receivedAt: string;
  synced: boolean;
  notes?: string | null;
  /** Saída gerada automaticamente pelo sistema (não é marcação do funcionário). */
  automatic?: boolean;
  /** Ajuste aprovado: valores originais preservados. */
  adjustment?: { originalType: MarkType; originalTime: string; justification: string; reviewedBy?: string | null; reviewedAt?: string | null } | null;
  /** Ajuste antigo (anterior ao registro estruturado), só com texto livre em notes. */
  legacyAdjustment?: boolean;
  /** Alerta de horário gravado na marcação (ver shared/punchTime). */
  timeAlert?: { kind: "server_time_used" | "offline"; text: string } | null;
  /** Marcação feita sem internet e sincronizada depois (horário = aparelho; recebimento = servidor). */
  offline?: boolean;
  /** Alerta de possível alteração do relógio do aparelho (ver shared/offlineClock). */
  clockAlert?: string | null;
};

export type LaborProfile = {
  jobTitle?: string | null;
  admissionDate?: string | null; // YYYY-MM-DD
  cpf?: string | null;
  /** PIS/PASEP (opcional; usado no espelho/AFD quando cadastrado). */
  pis?: string | null;
  /** Jornada diária contratada em minutos (somente se configurada). */
  dailyMinutes?: number | null;
  /** Horário contratual (pares entrada/saída HH:MM). */
  schedule?: Array<[string, string]> | null;
  /** Intervalo previsto em minutos (informativo). */
  intervalMinutes?: number | null;
  /** Dias úteis da semana (0=domingo ... 6=sábado). Se ausente, não se calcula previsto/faltas. */
  workdays?: number[] | null;
  nightEnabled?: boolean;
  nightStart?: string; // HH:MM
  nightEnd?: string;
};

export type DayRow = {
  date: string; // YYYY-MM-DD (dia local do início do turno)
  weekday: number;
  marks: Array<{
    type: MarkType; label: string; time: string; receivedAt: string; synced: boolean;
    kind: "original" | "adjusted" | "automatic" | "legacy_adjusted";
    /** Registrado offline (sincronizado depois). */
    offline?: boolean;
    originalTime?: string; originalLabel?: string; justification?: string; reviewedBy?: string | null; reviewedAt?: string | null;
  }>;
  workedMinutes: number;
  breakMinutes: number;
  expectedMinutes: number | null;
  diffMinutes: number | null;
  overtimeMinutes: number | null;
  nightMinutes: number | null;
  issues: string[];
  holiday?: string | null;
  excuse?: { type: FullDayExcuseType; label: string; justification?: string | null } | null;
  /** Ponto facultativo (Carnaval, Corpus Christi) quando a empresa NÃO o trata como feriado: não abonado. */
  optionalHoliday?: string | null;
  /** Dia dentro de férias programadas (abonado como "Férias"). */
  vacation?: boolean;
  /** Alertas de horário da marcação (aparelho x servidor / offline). */
  timeAlerts?: string[];
};

export type MirrorTotals = {
  daysWithMarks: number; workedMinutes: number; breakMinutes: number;
  expectedMinutes: number | null; balanceMinutes: number | null; overtimeMinutes: number | null; deficitMinutes: number | null;
  nightMinutes: number | null; nightReducedMinutes: number | null;
  incompleteDays: number; adjustedMarks: number; automaticMarks: number; pendingSyncMarks: number; daysWithoutMarksOnWorkday: number | null;
  /** Marcações registradas offline. */
  offlineMarks?: number;
};

export type MirrorReport = { from: string; to: string; timeZone: string; days: DayRow[]; totals: MirrorTotals; notes: string[] };

const DAY = 86400000;
export function localParts(iso: string, timeZone: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}:${v.second}`, hm: `${v.hour}:${v.minute}`, minutesOfDay: Number(v.hour) * 60 + Number(v.minute) };
}
const dayNum = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, dd) / DAY); };
const weekdayOf = (d: string) => new Date(dayNum(d) * DAY).getUTCDay();
const addDay = (d: string, n: number) => new Date((dayNum(d) + n) * DAY).toISOString().slice(0, 10);
const toMin = (hm: string) => { const [h, m] = hm.split(":").map(Number); return h * 60 + m; };

/** Minutos de [a,b) (instantes ms) que caem na janela noturna local. Passo de 1 min (jornadas são curtas). */
function nightOverlap(aMs: number, bMs: number, tz: string, start: number, end: number) {
  let n = 0;
  for (let t = Math.ceil(aMs / 60000) * 60000; t < bMs; t += 60000) {
    const m = localParts(new Date(t).toISOString(), tz).minutesOfDay;
    if (start > end ? (m >= start || m < end) : (m >= start && m < end)) n++;
  }
  return n;
}

export type DayExcuseInput = { date: string; type: string; justification?: string | null };
export type VacationRange = { startDate: string; endDate: string }; // YYYY-MM-DD, inclusive
export type MirrorOptions = {
  /** Se true, Carnaval e Corpus Christi (ponto facultativo) são tratados como feriado abonado. Padrão: false. */
  optionalHolidaysAsHoliday?: boolean;
};

export function buildMirror(input: { events: MirrorEvent[]; from: string; to: string; timeZone?: string; labor?: LaborProfile | null; excuses?: DayExcuseInput[]; vacations?: VacationRange[]; options?: MirrorOptions }): MirrorReport {
  const tz = input.timeZone || "America/Sao_Paulo";
  const labor = input.labor || null;
  const events = [...input.events].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
  const notes: string[] = [];
  type Shift = { date: string; events: MirrorEvent[] };
  const shifts: Shift[] = [];
  let cur: Shift | null = null;
  for (const ev of events) {
    const date = localParts(ev.time, tz).date;
    const lastT = cur ? new Date(cur.events[cur.events.length - 1].time).getTime() : 0;
    const stale = cur && new Date(ev.time).getTime() - lastT > 20 * 3600000;
    if (ev.type === "clock_in" || !cur || stale) {
      cur = { date, events: [] };
      shifts.push(cur);
    }
    cur.events.push(ev);
    if (ev.type === "clock_out") cur = null;
  }
  const byDate = new Map<string, Shift[]>();
  for (const s of shifts) { if (s.date >= input.from && s.date <= input.to) byDate.set(s.date, [...(byDate.get(s.date) || []), s]); }

  const workdays = labor?.workdays && labor.workdays.length ? new Set(labor.workdays) : null;
  const daily = labor?.dailyMinutes && labor.dailyMinutes > 0 ? labor.dailyMinutes : null;
  const night = labor?.nightEnabled && labor.nightStart && labor.nightEnd ? { s: toMin(labor.nightStart), e: toMin(labor.nightEnd) } : null;
  const excusesByDate = new Map<string, DayExcuseInput>();
  for (const item of input.excuses || []) {
    if (item.date >= input.from && item.date <= input.to && isFullDayExcuseType(item.type) && !excusesByDate.has(item.date)) {
      excusesByDate.set(item.date, item);
    }
  }

  const days: DayRow[] = [];
  for (let d = input.from; d <= input.to; d = addDay(d, 1)) {
    const rawHoliday = getBrazilianHoliday(d);
    const holiday = rawHoliday && (!rawHoliday.optional || input.options?.optionalHolidaysAsHoliday) ? rawHoliday : null;
    const optionalHoliday = rawHoliday && rawHoliday.optional && !holiday ? rawHoliday.name : null;
    const onVacation = (input.vacations || []).some((v) => d >= v.startDate && d <= v.endDate);
    const dayShifts = byDate.get(d) || [];
    const issues: string[] = [];
    const marks: DayRow["marks"] = [];
    let worked = 0, brk = 0, nightMin = 0;
    for (const sh of dayShifts) {
      let openIn: number | null = null, openBreak: number | null = null;
      for (const ev of sh.events) {
        const t = new Date(ev.time).getTime();
        const kind: DayRow["marks"][number]["kind"] = ev.automatic ? "automatic" : ev.adjustment ? "adjusted" : ev.legacyAdjustment ? "legacy_adjusted" : "original";
        marks.push({ type: ev.type, label: MARK_LABEL[ev.type], time: ev.time, receivedAt: ev.receivedAt, synced: ev.synced, kind, offline: Boolean(ev.offline || ev.timeAlert?.kind === "offline"),
          originalTime: ev.adjustment?.originalTime, originalLabel: ev.adjustment ? MARK_LABEL[ev.adjustment.originalType] : undefined,
          justification: ev.adjustment?.justification, reviewedBy: ev.adjustment?.reviewedBy, reviewedAt: ev.adjustment?.reviewedAt });
        if (ev.type === "clock_in") { if (openIn != null) issues.push("Entrada sem saída anterior"); openIn = t; }
        else if (ev.type === "break_start") {
          if (openIn == null) issues.push("Início de intervalo sem entrada");
          else { worked += (t - openIn) / 60000; if (night) nightMin += nightOverlap(openIn, t, tz, night.s, night.e); openIn = null; }
          openBreak = t;
        } else if (ev.type === "break_end") {
          if (openBreak == null) issues.push("Retorno de intervalo sem início");
          else { brk += (t - openBreak) / 60000; openBreak = null; }
          openIn = t;
        } else if (ev.type === "clock_out") {
          if (openIn == null) issues.push("Saída sem entrada");
          else { worked += (t - openIn) / 60000; if (night) nightMin += nightOverlap(openIn, t, tz, night.s, night.e); openIn = null; }
        }
      }
      if (openIn != null || openBreak != null) issues.push("Jornada incompleta: falta marcação de saída ou retorno");
    }
    const timeAlerts: string[] = [];
    for (const sh of dayShifts) for (const ev of sh.events) {
      if (ev.timeAlert?.kind === "server_time_used") timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.timeAlert.text}`);
      else if (ev.timeAlert?.kind === "offline") timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.timeAlert.text}`);
    }
    for (const sh of dayShifts) for (const ev of sh.events) {
      if (ev.clockAlert) timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.clockAlert}`);
      // Registrado offline sem o texto do alerta (ex.: lacre antigo): ainda informa o horário de recebimento.
      else if (ev.offline && ev.timeAlert?.kind !== "offline") timeAlerts.push(`${MARK_LABEL[ev.type]}: registrada offline; recebida pelo servidor em ${ev.receivedAt}`);
    }
    for (const t of timeAlerts) issues.push(`ALERTA de horário — ${t}`);
    if (marks.some((m) => !m.synced)) issues.push("Marcação com sincronização pendente");
    if (marks.some((m) => m.kind === "automatic")) issues.push("Saída automática do sistema (não marcada pelo funcionário)");
    if (marks.some((m) => m.kind === "legacy_adjusted")) issues.push("Ajuste antigo sem registro estruturado do valor original (ver observações da marcação)");

    const isWorkday = workdays ? workdays.has(weekdayOf(d)) : null;
    const hasMarks = marks.length > 0;
    const excuseRow = excusesByDate.get(d);
    const excuse = excuseRow && isFullDayExcuseType(excuseRow.type)
      ? { type: excuseRow.type, label: fullDayExcuseLabel(excuseRow.type), justification: excuseRow.justification || null }
      : null;
    const excused = Boolean(holiday || excuse || onVacation);

    // Feriado nacional: abona falta de batida automaticamente, mas permite ponto normal se houver marcações.
    if (holiday) {
      issues.push(`Feriado nacional: ${holiday.name} — abonado automaticamente`);
    }
    if (excuse) {
      const extra = excuse.justification ? ` — ${excuse.justification}` : "";
      issues.push(`${excuse.label} — dia abonado${extra}`);
    }
    if (onVacation) issues.push(hasMarks ? "Férias programadas — há marcações neste dia (conferir)" : "Férias — dia abonado");
    if (optionalHoliday) issues.push(`Ponto facultativo: ${optionalHoliday} — não abonado automaticamente (a empresa pode abonar pela correção de ponto ou ativar esse abono na configuração)`);
    if (!hasMarks && isWorkday && !excused) {
      issues.push("Sem marcações em dia previsto — verificar falta, abono ou justificativa (não informados)");
    }
    // Domingo sem marcação e fora da jornada: indica DSR (descanso semanal remunerado) para o espelho da empresa.
    if (!hasMarks && weekdayOf(d) === 0 && !isWorkday && !holiday && !onVacation && !excuse) {
      issues.push("DSR (descanso semanal remunerado)");
    }

    const expected = (daily != null && isWorkday && !excused) ? daily : (daily != null && !workdays ? null : null);
    const w = Math.round(worked);
    const diff = expected != null && hasMarks ? w - expected : null;
    days.push({
      date: d, weekday: weekdayOf(d), marks, workedMinutes: w, breakMinutes: Math.round(brk),
      expectedMinutes: expected, diffMinutes: diff,
      overtimeMinutes: diff != null ? Math.max(0, diff) : null,
      nightMinutes: night && hasMarks ? nightMin : null,
      issues,
      holiday: holiday?.name ?? null,
      excuse,
      optionalHoliday,
      vacation: onVacation,
      timeAlerts,
    });
  }

  const marked = days.filter((x) => x.marks.length);
  const sum = (f: (x: DayRow) => number | null) => marked.reduce((a, x) => a + (f(x) || 0), 0);
  const configured = daily != null && workdays != null;
  const totals: MirrorTotals = {
    daysWithMarks: marked.length, workedMinutes: sum((x) => x.workedMinutes), breakMinutes: sum((x) => x.breakMinutes),
    expectedMinutes: configured ? days.reduce((a, x) => a + (x.expectedMinutes || 0), 0) : null,
    balanceMinutes: configured ? sum((x) => x.diffMinutes) : null,
    overtimeMinutes: configured ? sum((x) => x.overtimeMinutes) : null,
    deficitMinutes: configured ? marked.reduce((a, x) => a + Math.max(0, -(x.diffMinutes || 0)), 0) : null,
    nightMinutes: night ? sum((x) => x.nightMinutes) : null,
    nightReducedMinutes: night ? Math.round(sum((x) => x.nightMinutes) * 60 / 52.5) : null,
    incompleteDays: marked.filter((x) => x.issues.some((i) => i.startsWith("Jornada incompleta") || i.includes("sem entrada") || i.includes("sem saída") || i.includes("sem início"))).length,
    adjustedMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "adjusted" || m.kind === "legacy_adjusted").length, 0),
    automaticMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "automatic").length, 0),
    offlineMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.offline).length, 0),
    pendingSyncMarks: marked.reduce((a, x) => a + x.marks.filter((m) => !m.synced).length, 0),
    daysWithoutMarksOnWorkday: workdays ? days.filter((x) => !x.marks.length && workdays.has(x.weekday) && !x.holiday && !x.excuse && !x.vacation).length : null,
  };
  if (!daily) notes.push("Jornada contratada não configurada para este funcionário: horas previstas, diferenças e horas extras não foram calculadas.");
  if (!workdays) notes.push("Dias de trabalho da semana não configurados: faltas e dias previstos não foram apurados.");
  if (!night) notes.push("Adicional noturno e hora reduzida não configurados: não calculados.");
  notes.push("Feriados nacionais (inclui 20/11 a partir de 2024) são identificados e abonados automaticamente (falta de batida não gera déficit). O ponto continua liberado nesses dias.");
  notes.push(input.options?.optionalHolidaysAsHoliday
    ? "Carnaval e Corpus Christi (ponto facultativo) estão sendo tratados como feriado, conforme a configuração da empresa."
    : "Carnaval e Corpus Christi são ponto facultativo e NÃO são abonados automaticamente; a empresa pode ativar esse abono na configuração. Feriados estaduais e municipais não são identificados.");
  notes.push("Férias programadas (cadastro de Férias) abonam o dia inteiro como \"Férias\", sem criar batidas.");
  notes.push("Folga, feriado e atestado aprovados na correção de ponto abonam o dia inteiro, sem criar batidas.");
  notes.push("Banco de horas, compensções, abonos manuais e tolerância (CLT art. 58 §1º) dependem de regras/convenção não cadastradas e não foram aplicados.");
  return { from: input.from, to: input.to, timeZone: tz, days, totals, notes };
}

/* ---------- Formatação (usada por tela, PDF, impressão e Excel: mesmos valores) ---------- */
export const pad = (n: number) => String(n).padStart(2, "0");
export function fmtMinutes(min: number | null | undefined, signed = false): string {
  if (min == null) return "—";
  const sign = min < 0 ? "-" : signed && min > 0 ? "+" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
export const fmtDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** CPF mascarado (telas). Para PDF/Excel da empresa use fmtCpf. */
export function maskCpf(cpf?: string | null): string {
  const d = String(cpf || "").replace(/\D/g, "");
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : "Não informado";
}
/** CPF completo formatado (espelho impresso / RH / processo). */
export function fmtCpf(cpf?: string | null): string {
  const d = String(cpf || "").replace(/\D/g, "");
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : "Não informado";
}
/** PIS/PASEP formatado (11 dígitos) ou texto de ausência. */
export function fmtPis(pis?: string | null): string {
  const d = String(pis || "").replace(/\D/g, "");
  return d.length >= 11 ? d.padStart(11, "0").slice(0, 11) : d.length ? d : "Não informado";
}
/**
 * Horário da marcação no espelho.
 * Símbolos (legenda no rodapé): * ajustada, + incluída, # ajuste antigo, A automática, ? sync pendente, o registrada offline.
 */
export function fmtMark(m: DayRow["marks"][number], tz: string): string {
  const t = localParts(m.time, tz);
  const included = m.kind === "adjusted" && !m.originalLabel;
  let tag = "";
  if (m.kind === "automatic") tag = "A";
  else if (m.kind === "legacy_adjusted") tag = "#";
  else if (included) tag = "+";
  else if (m.kind === "adjusted") tag = "*";
  const sync = m.synced ? "" : "?";
  const off = m.offline ? "(off)" : "";
  return `${t.hm}${tag}${off}${sync}`;
}

/**
 * Texto da ocorrência de uma marcação ajustada. Evita caracteres fora do Latin-1 (como "→"),
 * que as fontes padrão do PDF não suportam.
 * - batida incluída (esquecida): não existia marcação original, então não há "original → novo".
 * - mesmo tipo: "original HH:MM para HH:MM".
 * - tipo alterado: "original <tipo> HH:MM para <tipo> HH:MM".
 */
export function adjustmentText(m: DayRow["marks"][number], tz: string): string {
  const to = localParts(m.time, tz).hm;
  const why = `Justificativa: ${m.justification}${m.reviewedBy ? ` (por ${m.reviewedBy})` : ""}`;
  if (!m.originalLabel) return `${m.label}: batida incluída manualmente às ${to}. ${why}`;
  const from = localParts(m.originalTime!, tz).hm;
  if (m.originalLabel !== m.label) return `${m.label}: original ${m.originalLabel} ${from} para ${m.label} ${to}. ${why}`;
  return `${m.label}: original ${from} para ${to}. ${why}`;
}

export const MIRROR_HEADERS = ["Data", "Dia", "Entrada", "Início intervalo", "Retorno intervalo", "Saída", "Trabalhadas", "Intervalo", "Previstas", "Diferença", "Extras", "Adic. noturno", "Ocorrências"];
export function mirrorRows(report: MirrorReport): string[][] {
  const tz = report.timeZone;
  return report.days.map((d) => {
    const pick = (t: MarkType) => d.marks.filter((m) => m.type === t).map((m) => fmtMark(m, tz)).join(" / ") || "—";
    const has = d.marks.length > 0;
    const adj = d.marks.filter((m) => m.kind === "adjusted").map((m) => adjustmentText(m, tz));
    const issues = [...d.issues, ...adj].join("; ") || "";
    return [fmtDate(d.date), WEEKDAYS[d.weekday], pick("clock_in"), pick("break_start"), pick("break_end"), pick("clock_out"),
      has ? fmtMinutes(d.workedMinutes) : "—", has ? fmtMinutes(d.breakMinutes) : "—", fmtMinutes(d.expectedMinutes), fmtMinutes(d.diffMinutes, true), fmtMinutes(d.overtimeMinutes), fmtMinutes(d.nightMinutes), issues];
  });
}
export function totalsLines(t: MirrorTotals): Array<[string, string]> {
  return [
    ["Dias com marcação", String(t.daysWithMarks)], ["Horas trabalhadas", fmtMinutes(t.workedMinutes)], ["Tempo de intervalo", fmtMinutes(t.breakMinutes)],
    ["Horas previstas", fmtMinutes(t.expectedMinutes)], ["Saldo (trabalhadas − previstas)", fmtMinutes(t.balanceMinutes, true)], ["Horas extras", fmtMinutes(t.overtimeMinutes)], ["Horas devidas (déficit)", fmtMinutes(t.deficitMinutes)],
    ["Adicional noturno (min. relógio)", fmtMinutes(t.nightMinutes)], ["Hora noturna reduzida (equivalente)", fmtMinutes(t.nightReducedMinutes)],
    ["Dias incompletos/inconsistentes", String(t.incompleteDays)], ["Dias úteis sem marcação", t.daysWithoutMarksOnWorkday == null ? "—" : String(t.daysWithoutMarksOnWorkday)],
    ["Marcações ajustadas", String(t.adjustedMarks)], ["Saídas automáticas do sistema", String(t.automaticMarks)], ["Marcações pendentes de sincronização", String(t.pendingSyncMarks)],
    ["Marcações registradas offline", String(t.offlineMarks ?? 0)],
  ];
}
