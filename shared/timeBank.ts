import type { LaborProfile, MirrorReport } from "./timesheetMirror";

export type PeriodBalance = {
  daysTracked: number; workedMinutes: number; expectedMinutes: number; balanceMinutes: number;
  overtimeMinutes: number; deficitMinutes: number; openShift: boolean; configured: boolean;
};

/** Jornada contratada configurada (sem ela não há previsto, extra nem débito). */
export function laborConfigured(labor: LaborProfile | null | undefined): boolean {
  return Boolean(labor?.dailyMinutes && labor.dailyMinutes > 0 && labor.workdays?.length);
}

/**
 * Saldo do período só com dias fechados: a jornada aberta de hoje não gera extra nem débito.
 * Regra única do banco de horas (promotor, administrador e tela inicial).
 */
export function closedPeriodBalance(report: MirrorReport, labor: LaborProfile | null | undefined, today: string): PeriodBalance {
  const configured = laborConfigured(labor);
  const openToday = report.days.find((day) => day.date === today && day.issues.some((issue) => issue.startsWith("Jornada incompleta")));
  let workedMinutes = report.totals.workedMinutes;
  let expectedMinutes = report.totals.expectedMinutes ?? 0;
  let overtimeMinutes = report.totals.overtimeMinutes ?? 0;
  let deficitMinutes = report.totals.deficitMinutes ?? 0;
  let balanceMinutes = report.totals.balanceMinutes ?? 0;
  if (openToday) {
    const todayDiff = openToday.diffMinutes ?? 0;
    workedMinutes = Math.max(0, workedMinutes - openToday.workedMinutes);
    expectedMinutes = Math.max(0, expectedMinutes - (openToday.expectedMinutes ?? 0));
    if (todayDiff > 0) overtimeMinutes = Math.max(0, overtimeMinutes - todayDiff);
    if (todayDiff < 0) deficitMinutes = Math.max(0, deficitMinutes + todayDiff);
    balanceMinutes -= todayDiff;
  }
  return {
    daysTracked: report.totals.daysWithMarks,
    workedMinutes,
    expectedMinutes: configured ? expectedMinutes : 0,
    balanceMinutes: configured ? balanceMinutes : 0,
    overtimeMinutes: configured ? overtimeMinutes : 0,
    deficitMinutes: configured ? deficitMinutes : 0,
    openShift: Boolean(openToday),
    configured,
  };
}

/** "2026-11" → primeiro e último dia do mês. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** +HH:MM / -HH:MM. */
export function formatSignedMinutes(minutes: number): string {
  const sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(minutes));
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}

export type TeamBankRow = { id: number; name: string; active: boolean; employeeCode: string | null; lastEventAt: string | null } & PeriodBalance;

/** Busca por nome (sem acento/caixa) e ordenação por saldo. */
export function filterAndSortTeamBank<T extends { name: string; balanceMinutes: number }>(rows: T[], search: string, sort: "balance_desc" | "balance_asc" | "name"): T[] {
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(search.trim());
  const list = q ? rows.filter((r) => norm(r.name).includes(q)) : [...rows];
  if (sort === "name") return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return list.sort((a, b) => (sort === "balance_desc" ? b.balanceMinutes - a.balanceMinutes : a.balanceMinutes - b.balanceMinutes) || a.name.localeCompare(b.name, "pt-BR"));
}

/** CSV (separador ;, BOM para o Excel em pt-BR). */
export function teamBankCsv(rows: TeamBankRow[], month: string): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["Funcionário", "Matrícula", "Mês", "Dias com marcação", "Trabalhadas", "Previstas", "Créditos (extras)", "Débitos", "Saldo", "Última marcação", "Jornada configurada"];
  const lines = rows.map((r) => [r.name, r.employeeCode || "", month, String(r.daysTracked), formatSignedMinutes(r.workedMinutes).replace("+", ""), formatSignedMinutes(r.expectedMinutes).replace("+", ""), formatSignedMinutes(r.overtimeMinutes).replace("+", ""), formatSignedMinutes(r.deficitMinutes).replace("+", ""), formatSignedMinutes(r.balanceMinutes), r.lastEventAt || "", r.configured ? "sim" : "não"].map(esc).join(";"));
  return "\uFEFF" + [head.join(";"), ...lines].join("\r\n");
}
