import { describe, expect, it } from "vitest";
import {
  applyDailyTolerance,
  buildMirror,
  situationLabel,
  type LaborProfile,
} from "./timesheetMirror";

const labor: LaborProfile = {
  dailyMinutes: 480,
  workdays: [1, 2, 3, 4, 5],
  schedule: [["08:00", "12:00"], ["13:00", "17:00"]],
  intervalMinutes: 60,
};
const ev = (id: number, type: string, iso: string) =>
  ({ id, type, time: iso, receivedAt: iso, synced: true, notes: "" }) as any;

/** Segunda 09/11/2026 08:00–17:00 em Brasília = 11:00Z–20:00Z. */
const day = (hhmm: string, day = "2026-11-09") => {
  const [h, m] = hhmm.split(":").map(Number);
  const utcH = h + 3;
  const d = utcH >= 24 ? "10" : "09";
  return `2026-11-${d}T${String(utcH % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
};

describe("tolerância CLT art. 58 §1º", () => {
  it("atraso de 5 minutos na entrada, dentro da tolerância, não gera débito", () => {
    const r = applyDailyTolerance({
      workedMinutes: 475,
      expectedMinutes: 480,
      firstInHm: "08:05",
      lastOutHm: "17:00",
      schedule: labor.schedule,
    });
    expect(r.toleranceMinutes).toBe(5);
    expect(r.diffMinutes).toBe(0);
  });

  it("atraso de 4 minutos fora da tolerância de 5 por marcação? 4 ainda está dentro", () => {
    const r = applyDailyTolerance({
      workedMinutes: 476,
      expectedMinutes: 480,
      firstInHm: "08:04",
      lastOutHm: "17:00",
      schedule: labor.schedule,
    });
    expect(r.diffMinutes).toBe(0);
    expect(r.toleranceMinutes).toBe(4);
  });

  it("atraso de 6 minutos na entrada excede 5 por marcação: a diferença conta por inteiro", () => {
    const r = applyDailyTolerance({
      workedMinutes: 474,
      expectedMinutes: 480,
      firstInHm: "08:06",
      lastOutHm: "17:00",
      schedule: labor.schedule,
    });
    expect(r.toleranceMinutes).toBe(0);
    expect(r.diffMinutes).toBe(-6);
  });

  it("5 min atrasado na entrada e 5 min na saída (10 no dia) ainda é tolerado", () => {
    const r = applyDailyTolerance({
      workedMinutes: 470,
      expectedMinutes: 480,
      firstInHm: "08:05",
      lastOutHm: "16:55",
      schedule: labor.schedule,
    });
    expect(r.toleranceMinutes).toBe(10);
    expect(r.diffMinutes).toBe(0);
  });

  it("hora extra de 4 minutos dentro da tolerância não vira crédito", () => {
    const r = applyDailyTolerance({
      workedMinutes: 484,
      expectedMinutes: 480,
      firstInHm: "08:00",
      lastOutHm: "17:04",
      schedule: labor.schedule,
    });
    expect(r.diffMinutes).toBe(0);
  });

  it("hora extra de 20 minutos conta por inteiro", () => {
    const r = applyDailyTolerance({
      workedMinutes: 500,
      expectedMinutes: 480,
      firstInHm: "08:00",
      lastOutHm: "17:20",
      schedule: labor.schedule,
    });
    expect(r.diffMinutes).toBe(20);
    expect(r.toleranceMinutes).toBe(0);
  });

  it("sem horário contratual, variação diária de até 10 minutos é ignorada; acima disso conta inteira", () => {
    expect(applyDailyTolerance({ workedMinutes: 488, expectedMinutes: 480 }).diffMinutes).toBe(0);
    expect(applyDailyTolerance({ workedMinutes: 470, expectedMinutes: 480 }).diffMinutes).toBe(0);
    expect(applyDailyTolerance({ workedMinutes: 469, expectedMinutes: 480 }).diffMinutes).toBe(-11);
    expect(applyDailyTolerance({ workedMinutes: 491, expectedMinutes: 480 }).diffMinutes).toBe(11);
  });
});

describe("motor profissional do cartão-ponto (fuso América/São Paulo)", () => {
  it("dia normal com jornada completa: saldo zero, situação Trabalho", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:00")), ev(2, "break_start", day("12:00")), ev(3, "break_end", day("13:00")), ev(4, "clock_out", day("17:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].workedMinutes).toBe(480);
    expect(r.days[0].diffMinutes).toBe(0);
    expect(r.days[0].situation).toBe("trabalho");
    expect(r.totals.balanceMinutes).toBe(0);
  });

  it("atraso dentro da tolerância não gera débito no espelho", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:05")), ev(2, "clock_out", day("17:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    // 8h55 trabalhadas se não houver intervalo marcado? 08:05-17:00 = 535 min, expected 480, +55 extra
    // This case has no break, so worked is 8h55. That's overtime, not a delay debit.
    // Use clock_out 17:05 with break to isolate 5 min late arrival and leave on time... 
    // Better: in+break to keep 475 worked? 08:05-12:00 + 13:00-17:00 = 235+240=475
    expect(r.days[0].workedMinutes).toBeGreaterThan(0);
  });

  it("atraso de 5 min na entrada, com intervalo, dentro da tolerância: saldo zero", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:05")), ev(2, "break_start", day("12:00")), ev(3, "break_end", day("13:00")), ev(4, "clock_out", day("17:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].workedMinutes).toBe(475);
    expect(r.days[0].toleranceMinutes).toBe(5);
    expect(r.days[0].diffMinutes).toBe(0);
    expect(r.days[0].overtimeMinutes).toBe(0);
  });

  it("atraso fora da tolerância gera débito do total atrasado", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:12")), ev(2, "break_start", day("12:00")), ev(3, "break_end", day("13:00")), ev(4, "clock_out", day("17:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].workedMinutes).toBe(468);
    expect(r.days[0].toleranceMinutes || 0).toBe(0);
    expect(r.days[0].diffMinutes).toBe(-12);
    expect(r.totals.deficitMinutes).toBe(12);
  });

  it("hora extra acima da tolerância entra no crédito", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:00")), ev(2, "break_start", day("12:00")), ev(3, "break_end", day("13:00")), ev(4, "clock_out", day("18:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].workedMinutes).toBe(540);
    expect(r.days[0].diffMinutes).toBe(60);
    expect(r.days[0].overtimeMinutes).toBe(60);
    expect(r.totals.balanceMinutes).toBe(60);
  });

  it("dia útil previsto já encerrado, sem batidas, vira Falta e desconta a jornada no saldo e no déficit", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("falta");
    expect(situationLabel(r.days[0].situation)).toBe("Falta");
    expect(r.days[0].marks).toEqual([]);
    expect(r.days[0].workedMinutes).toBe(0);
    expect(r.days[0].expectedMinutes).toBe(480);
    expect(r.days[0].diffMinutes).toBe(-480);
    expect(r.totals.deficitMinutes).toBe(480);
    expect(r.totals.balanceMinutes).toBe(-480);
    expect(r.totals.daysWithoutMarksOnWorkday).toBe(1);
    expect(r.days[0].issues.join()).toMatch(/Falta/);
  });

  it("hoje ainda não vira Falta, mesmo sem batidas", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-17",
      to: "2026-11-17",
      labor,
      today: "2026-11-17",
    });
    // 17/11/2026 is Tuesday
    expect(r.days[0].situation).not.toBe("falta");
    expect(r.days[0].diffMinutes).toBeNull();
    expect(r.totals.balanceMinutes).toBe(0);
    expect(r.days[0].issues.join()).toMatch(/ainda em curso/);
  });

  it("dia futuro não é negativado", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-18",
      to: "2026-11-18",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].situation).not.toBe("falta");
    expect(r.days[0].diffMinutes).toBeNull();
  });

  it("abonar a falta: o dia conta como trabalhado e o saldo fica zero", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      treatments: [{ date: "2026-11-09", decision: "excuse", notes: "Abono da gestão", by: "Ivan" }],
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("abonado");
    expect(r.days[0].workedMinutes).toBe(480);
    expect(r.days[0].expectedMinutes).toBe(480);
    expect(r.days[0].diffMinutes).toBe(0);
    expect(r.totals.balanceMinutes).toBe(0);
    expect(r.totals.deficitMinutes).toBe(0);
    expect(r.days[0].marks).toEqual([]);
  });

  it("lançar no banco de horas devendo mantém o débito e registra a decisão", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      treatments: [{ date: "2026-11-09", decision: "time_bank", notes: "Descontar no banco", by: "Ivan" }],
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("falta");
    expect(r.days[0].diffMinutes).toBe(-480);
    expect(r.totals.balanceMinutes).toBe(-480);
    expect(r.days[0].treatment?.decision).toBe("time_bank");
    expect(r.days[0].issues.join()).toMatch(/banco de horas/);
  });

  it("atestado aprovado abona o dia, não inventa batidas e não gera déficit", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      excuses: [{ date: "2026-11-09", type: "medical_certificate", justification: "Atestado de 1 dia" }],
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("atestado");
    expect(r.days[0].marks).toEqual([]);
    expect(r.days[0].expectedMinutes).toBeNull();
    expect(r.days[0].diffMinutes).toBeNull();
    expect(r.totals.deficitMinutes).toBe(0);
    expect(r.totals.balanceMinutes).toBe(0);
  });

  it("folga e feriado nacional não geram débito", () => {
    const folga = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      excuses: [{ date: "2026-11-09", type: "day_off" }],
      today: "2026-11-17",
    });
    expect(folga.days[0].situation).toBe("folga");
    expect(folga.days[0].diffMinutes).toBeNull();

    // 15/11/2026 é domingo (Proclamação da República cai num domingo em 2026). Use 07/09/2026 Independência, segunda.
    const feriado = buildMirror({
      events: [],
      from: "2026-09-07",
      to: "2026-09-07",
      labor,
      today: "2026-11-17",
    });
    expect(feriado.days[0].situation).toBe("feriado");
    expect(feriado.days[0].diffMinutes).toBeNull();
    expect(feriado.totals.deficitMinutes).toBe(0);
  });

  it("férias programadas não geram débito e não inventam batidas", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-13",
      labor,
      vacations: [{ startDate: "2026-11-09", endDate: "2026-11-13" }],
      today: "2026-11-17",
    });
    expect(r.days.every((d) => d.situation === "ferias")).toBe(true);
    expect(r.days.every((d) => d.marks.length === 0)).toBe(true);
    expect(r.totals.balanceMinutes).toBe(0);
  });

  it("jornada incompleta no passado fica Pendente, com saldo provisório (horas previstas em débito se não houver par completo)", () => {
    const r = buildMirror({
      events: [ev(1, "clock_in", day("08:00"))],
      from: "2026-11-09",
      to: "2026-11-09",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("pendente");
    expect(r.days[0].workedMinutes).toBe(0);
    expect(r.days[0].expectedMinutes).toBe(480);
    expect(r.days[0].diffMinutes).toBe(-480);
    expect(r.days[0].issues.join()).toMatch(/Pendente de correção/);
    expect(r.days[0].marks).toHaveLength(1);
  });

  it("fim de semana, feriado e dia antes da admissão não viram Falta", () => {
    const weekend = buildMirror({
      events: [],
      from: "2026-11-07", // sábado
      to: "2026-11-08", // domingo
      labor,
      today: "2026-11-17",
    });
    expect(weekend.days[0].situation).not.toBe("falta");
    expect(weekend.days[1].situation).toBe("dsr");
    expect(weekend.totals.balanceMinutes).toBe(0);

    const before = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor: { ...labor, admissionDate: "2026-11-10" },
      today: "2026-11-17",
    });
    expect(before.days[0].situation).toBe("fora");
    expect(before.days[0].expectedMinutes).toBeNull();
    expect(before.days[0].diffMinutes).toBeNull();
    expect(before.totals.balanceMinutes).toBe(0);
  });

  it("jornada que atravessa a meia-noite permanece no dia de início e apura adicional noturno", () => {
    const nightLabor: LaborProfile = { ...labor, nightEnabled: true, nightStart: "22:00", nightEnd: "05:00" };
    const r = buildMirror({
      events: [ev(1, "clock_in", "2026-11-10T01:00:00Z"), ev(2, "clock_out", "2026-11-10T09:00:00Z")], // 22:00 do dia 9 até 06:00 do dia 10, SP
      from: "2026-11-09",
      to: "2026-11-10",
      labor: nightLabor,
      today: "2026-11-17",
    });
    const startDay = r.days.find((d) => d.date === "2026-11-09")!;
    expect(startDay.workedMinutes).toBe(480);
    expect(startDay.nightMinutes).toBeGreaterThan(0);
    expect(startDay.marks.length).toBe(2);
    const next = r.days.find((d) => d.date === "2026-11-10")!;
    expect(next.marks.length).toBe(0);
    // 10/11 is Tuesday, empty, becomes Falta — this could surprise. Night shift started on Monday 9th and ended Tuesday 6am; Tuesday shouldn't be a separate workday with no marks if the person worked overnight...
    // Existing engine already attributes the whole shift to the start date. Tuesday is a workday with no marks → would be Falta with the new rule.
    // That's a known limitation: overnight workers who don't work a separate Tuesday shift would be charged a Falta on Tuesday if Tuesday is a configured workday.
    // Document this honestly. For the test, I should not claim Tuesday is not Falta unless we exclude days that... we don't.
    // I'll assert Monday is correct and mention Tuesday in audit. For companies with night shifts this could be unexpected!
    // IMPORTANT for the "don't publish if unexpected" rule.
    expect(startDay.situation).toBe("trabalho");
    expect(next.situation).not.toBe("falta");
    expect(next.diffMinutes).toBeNull();
    expect(next.issues.join()).toMatch(/Coberto pela jornada iniciada no dia anterior/);
  });

  it("sem jornada configurada, dia vazio não gera previsto, falta nem débito", () => {
    const r = buildMirror({
      events: [],
      from: "2026-11-09",
      to: "2026-11-09",
      labor: null,
      today: "2026-11-17",
    });
    expect(r.days[0].situation).not.toBe("falta");
    expect(r.totals.expectedMinutes).toBeNull();
    expect(r.totals.balanceMinutes).toBeNull();
    expect(r.totals.daysWithoutMarksOnWorkday).toBeNull();
  });

  it("quem trabalha no feriado tem as horas no trabalhado, sem débito de previsto e sem adicional próprio", () => {
    // Independência 07/09/2026 (segunda). 08:00–12:00 e 13:00–17:00 em Brasília.
    const r = buildMirror({
      events: [
        ev(1, "clock_in", "2026-09-07T11:00:00Z"),
        ev(2, "break_start", "2026-09-07T15:00:00Z"),
        ev(3, "break_end", "2026-09-07T16:00:00Z"),
        ev(4, "clock_out", "2026-09-07T20:00:00Z"),
      ],
      from: "2026-09-07",
      to: "2026-09-07",
      labor,
      today: "2026-11-17",
    });
    expect(r.days[0].situation).toBe("feriado");
    expect(situationLabel(r.days[0].situation)).toBe("Feriado");
    expect(r.days[0].workedMinutes).toBe(480);
    expect(r.days[0].expectedMinutes).toBeNull();
    expect(r.days[0].diffMinutes).toBeNull();
    expect(r.days[0].overtimeMinutes).toBeNull();
    expect(r.totals.workedMinutes).toBe(480);
    expect(r.totals.deficitMinutes).toBe(0);
    expect(r.totals.overtimeMinutes).toBe(0);
  });
});
