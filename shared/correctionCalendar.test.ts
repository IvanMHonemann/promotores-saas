import { describe, expect, it } from "vitest";
import {
  classifyCorrectionDay,
  countDaysNeedingCorrection,
  journeyIsIncomplete,
  monthWeeks,
  monthLabelPt,
  formatDayLabelPt,
  shiftDay,
  shiftMonth,
  todayIncompleteShouldAlert,
  type CorrectionDayFacts,
} from "./correctionCalendar";

const base = (over: Partial<CorrectionDayFacts> = {}): CorrectionDayFacts => ({
  date: "2026-11-10",
  today: "2026-11-16",
  punches: [],
  hasPendingCorrection: false,
  excused: false,
  isWorkday: true,
  workEndTime: "18:00",
  nowHm: "23:50",
  ...over,
});

describe("journeyIsIncomplete", () => {
  it("entrada e saída completas", () => {
    expect(journeyIsIncomplete(["clock_in", "clock_out"])).toBe(false);
    expect(journeyIsIncomplete(["clock_in", "break_start", "break_end", "clock_out"])).toBe(false);
  });
  it("falta saída ou retorno do intervalo", () => {
    expect(journeyIsIncomplete(["clock_in"])).toBe(true);
    expect(journeyIsIncomplete(["clock_in", "break_start"])).toBe(true);
    expect(journeyIsIncomplete(["clock_in", "break_start", "break_end"])).toBe(true);
  });
  it("inconsistências também contam", () => {
    expect(journeyIsIncomplete(["clock_out"])).toBe(true);
    expect(journeyIsIncomplete(["clock_in", "clock_in"])).toBe(true);
    expect(journeyIsIncomplete(["break_start"])).toBe(true);
  });
});

describe("todayIncompleteShouldAlert (mesma regra do aviso de falta de batida)", () => {
  it("não alerta antes do horário limite", () => {
    expect(todayIncompleteShouldAlert({ workEndTime: "18:00", nowHm: "17:59", lastPunchHm: "08:00" })).toBe(false);
  });
  it("alerta depois do limite se a última batida foi antes dele", () => {
    expect(todayIncompleteShouldAlert({ workEndTime: "18:00", nowHm: "18:00", lastPunchHm: "08:00" })).toBe(true);
  });
  it("não alerta se a última batida foi depois do limite (espera o dia seguinte)", () => {
    expect(todayIncompleteShouldAlert({ workEndTime: "18:00", nowHm: "21:00", lastPunchHm: "20:42" })).toBe(false);
  });
  it("sem horário limite, não alerta no mesmo dia", () => {
    expect(todayIncompleteShouldAlert({ workEndTime: null, nowHm: "23:50", lastPunchHm: "08:00" })).toBe(false);
  });
});

describe("classifyCorrectionDay", () => {
  it("dia futuro não é sinalizado e não trava correção de dias passados", () => {
    expect(classifyCorrectionDay(base({ date: "2026-11-17", today: "2026-11-16", punches: [] })).mark).toBe("ok");
  });

  it("dia útil passado sem marcação precisa de correção", () => {
    const r = classifyCorrectionDay(base({ date: "2026-11-10", punches: [] }));
    expect(r.mark).toBe("needs_correction");
    expect(r.reason).toBe("Batida faltando");
  });

  it("fim de semana sem jornada prevista e sem marcação não é sinalizado", () => {
    expect(classifyCorrectionDay(base({ date: "2026-11-15", isWorkday: false, punches: [] })).mark).toBe("ok");
  });

  it("sem jornada configurada, dia vazio não é tratado como falta", () => {
    expect(classifyCorrectionDay(base({ isWorkday: null, punches: [] })).mark).toBe("ok");
  });

  it("feriado, férias ou abono aprovado desfaz a falta", () => {
    expect(classifyCorrectionDay(base({ excused: true, punches: [] })).mark).toBe("ok");
  });

  it("jornada incompleta em dia passado precisa de correção", () => {
    const r = classifyCorrectionDay(base({ date: "2026-11-14", punches: ["clock_in", "break_start", "break_end"] }));
    expect(r.mark).toBe("needs_correction");
    expect(r.reason).toBe("Jornada incompleta");
  });

  it("jornada completa em dia passado fica ok", () => {
    expect(classifyCorrectionDay(base({ date: "2026-11-14", punches: ["clock_in", "break_start", "break_end", "clock_out"] })).mark).toBe("ok");
  });

  it("hoje, jornada aberta só depois do horário limite", () => {
    const open = { date: "2026-11-16", today: "2026-11-16", punches: ["clock_in"] as const, lastPunchHm: "08:00", workEndTime: "18:00" };
    expect(classifyCorrectionDay(base({ ...open, nowHm: "17:00" })).mark).toBe("ok");
    expect(classifyCorrectionDay(base({ ...open, nowHm: "18:01" })).mark).toBe("needs_correction");
  });

  it("hoje, entrada depois do limite não alerta no mesmo dia", () => {
    expect(classifyCorrectionDay(base({
      date: "2026-11-16", today: "2026-11-16", punches: ["clock_in"], lastPunchHm: "20:42", nowHm: "21:00", workEndTime: "18:00",
    })).mark).toBe("ok");
  });

  it("correção já pedida (pendente) tem estado diferente, mesmo com falta", () => {
    const r = classifyCorrectionDay(base({ punches: [], hasPendingCorrection: true }));
    expect(r.mark).toBe("pending");
    expect(r.reason).toBe("Correção já pedida");
  });

  it("pendente prevalece sobre jornada incompleta", () => {
    expect(classifyCorrectionDay(base({ punches: ["clock_in"], hasPendingCorrection: true })).mark).toBe("pending");
  });
});

describe("monthWeeks (domingo primeiro) e contagem", () => {
  it("novembro de 2026 começa no domingo dia 1", () => {
    const weeks = monthWeeks(2026, 11);
    expect(weeks[0][0]).toBe("2026-11-01"); // domingo
    expect(weeks[0][1]).toBe("2026-11-02");
    expect(weeks.at(-1)?.[1]).toBe("2026-11-30"); // segunda
    expect(weeks.at(-1)?.[2]).toBeNull();
  });

  it("conta só os que precisam de correção, não os pendentes", () => {
    expect(countDaysNeedingCorrection([
      { mark: "needs_correction" },
      { mark: "needs_correction" },
      { mark: "pending" },
      { mark: "ok" },
    ])).toBe(2);
  });

  it("avança e volta o mês", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-11", -1)).toBe("2026-10");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("rótulo do mês em português, só a primeira letra maiúscula", () => {
    expect(monthLabelPt("2026-11")).toBe("Novembro de 2026");
    expect(monthLabelPt("2026-03")).toBe("Março de 2026");
    expect(monthLabelPt("2026-11")).not.toBe("Novembro De 2026");
  });

  it("avança e volta o dia civil, inclusive virada de mês", () => {
    expect(shiftDay("2026-11-17", -1)).toBe("2026-11-16");
    expect(shiftDay("2026-11-17", 1)).toBe("2026-11-18");
    expect(shiftDay("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rótulo do dia em português, sem capitalizar o de", () => {
    expect(formatDayLabelPt("2026-11-17")).toBe("Terça-feira, 17 de novembro de 2026");
    expect(formatDayLabelPt("2026-11-17")).not.toContain("De novembro");
  });
});
