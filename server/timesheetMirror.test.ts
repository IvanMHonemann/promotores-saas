import { describe, expect, it } from "vitest";
import { buildMirror, mirrorRows, fmtMinutes, maskCpf, fmtCpf } from "../shared/timesheetMirror";
import { expiryStatus, addDays } from "../shared/expiry";
import { inferFullDayExcuseType, looksLikeFullDayExcuse } from "../shared/correctionExcuse";

const ev = (id: number, type: any, time: string, extra: any = {}) => ({ id, type, time, receivedAt: time, synced: true, ...extra });
const labor = { dailyMinutes: 480, workdays: [1, 2, 3, 4, 5], nightEnabled: true, nightStart: "22:00", nightEnd: "05:00" };

describe("espelho de ponto", () => {
  it("calcula horas, intervalo e extras apenas com jornada configurada", () => {
    const events = [ev(1, "clock_in", "2026-10-05T11:00:00Z"), ev(2, "break_start", "2026-10-05T15:00:00Z"), ev(3, "break_end", "2026-10-05T16:00:00Z"), ev(4, "clock_out", "2026-10-05T21:00:00Z")];
    const r = buildMirror({ events, from: "2026-10-05", to: "2026-10-05", labor });
    expect(r.days[0].workedMinutes).toBe(540);
    expect(r.days[0].breakMinutes).toBe(60);
    expect(r.days[0].overtimeMinutes).toBe(60);
    const sem = buildMirror({ events, from: "2026-10-05", to: "2026-10-05" });
    expect(sem.totals.expectedMinutes).toBeNull();
    expect(sem.totals.overtimeMinutes).toBeNull();
  });
  it("marca jornada incompleta sem inventar saída", () => {
    const r = buildMirror({ events: [ev(1, "clock_in", "2026-10-06T11:00:00Z")], from: "2026-10-06", to: "2026-10-06", labor });
    expect(r.days[0].workedMinutes).toBe(0);
    expect(r.days[0].issues.join()).toContain("incompleta");
  });
  it("turno noturno atravessa a meia-noite e apura adicional noturno", () => {
    const r = buildMirror({ events: [ev(1, "clock_in", "2026-10-07T01:00:00Z"), ev(2, "clock_out", "2026-10-07T09:00:00Z")], from: "2026-10-06", to: "2026-10-07", labor });
    expect(r.days[0].workedMinutes).toBe(480);
    expect(r.days[0].nightMinutes).toBe(420);
    expect(r.totals.nightReducedMinutes).toBe(480);
  });
  it("preserva original x ajustada e a exporta nas linhas", () => {
    const adj = { originalType: "clock_out", originalTime: "2026-10-07T08:30:00Z", justification: "esqueceu" };
    const r = buildMirror({ events: [ev(1, "clock_in", "2026-10-07T01:00:00Z"), ev(2, "clock_out", "2026-10-07T09:00:00Z", { adjustment: adj })], from: "2026-10-06", to: "2026-10-06" });
    expect(r.totals.adjustedMarks).toBe(1);
    expect(mirrorRows(r)[0][5]).toContain("*"); // Saída ajustada
    expect(mirrorRows(r)[0][12]).toContain("esqueceu");
  });
  it("marca DSR em domingo sem batida", () => {
    const r = buildMirror({ events: [], from: "2026-10-04", to: "2026-10-04", labor }); // domingo
    expect(r.days[0].weekday).toBe(0);
    expect(r.days[0].issues.join()).toContain("DSR");
  });
  it("não conta dia sem marcação como falta sem configuração", () => {
    const r = buildMirror({ events: [], from: "2026-10-05", to: "2026-10-06" });
    expect(r.totals.daysWithoutMarksOnWorkday).toBeNull();
  });
  it("abona dia inteiro em folga/atestado sem inventar batidas", () => {
    const r = buildMirror({
      events: [],
      from: "2026-10-05",
      to: "2026-10-06",
      labor,
      excuses: [{ date: "2026-10-06", type: "day_off", justification: "Folga combinada" }],
    });
    const excused = r.days.find((d) => d.date === "2026-10-06");
    expect(excused?.marks).toEqual([]);
    expect(excused?.expectedMinutes).toBeNull();
    expect(excused?.excuse?.label).toBe("Folga");
    expect(excused?.issues.join()).toContain("Folga — dia abonado");
    expect(r.totals.daysWithoutMarksOnWorkday).toBe(1);
  });
  it("abona atestado sem gerar previsto nem déficit", () => {
    const r = buildMirror({
      events: [],
      from: "2026-10-05",
      to: "2026-10-05",
      labor,
      excuses: [{ date: "2026-10-05", type: "medical_certificate" }],
    });
    expect(r.days[0].excuse?.type).toBe("medical_certificate");
    expect(r.days[0].expectedMinutes).toBeNull();
    expect(r.days[0].diffMinutes).toBeNull();
    expect(r.totals.daysWithoutMarksOnWorkday).toBe(0);
  });
  it("reconhece abono antigo só pelo texto da justificativa", () => {
    expect(inferFullDayExcuseType({ justification: "Feriado" })).toBe("holiday");
    expect(looksLikeFullDayExcuse({ justification: "Feriado", timeEventId: null })).toBe(true);
    expect(looksLikeFullDayExcuse({ justification: "esqueceu a entrada", timeEventId: null })).toBe(false);
  });
  it("formatadores", () => {
    expect(fmtMinutes(75)).toBe("01:15");
    expect(fmtMinutes(-5, true)).toBe("-00:05");
    expect(maskCpf("12345678901")).toBe("***.456.789-**");
    expect(fmtCpf("12345678901")).toBe("123.456.789-01");
  });
});

describe("validade de produtos", () => {
  it("classifica vencido / a vencer / em dia por data de calendário", () => {
    expect(expiryStatus("2026-10-17", "2026-10-18")).toBe("expired");
    expect(expiryStatus("2026-10-18", "2026-10-18")).toBe("near");
    expect(expiryStatus("2026-11-17", "2026-10-18")).toBe("near");
    expect(expiryStatus("2026-11-18", "2026-10-18")).toBe("valid");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("espelho de ponto: texto das ocorrências", () => {
  const base = [ev(1, "clock_in", "2026-10-07T11:00:00Z"), ev(5, "break_end", "2026-10-07T16:19:00Z"), ev(4, "clock_out", "2026-10-07T21:00:00Z")];
  const rows = (events: any[]) => mirrorRows(buildMirror({ events, from: "2026-10-07", to: "2026-10-07" }))[0][12];
  it("batida incluída não aparece como 'original X → X'", () => {
    const adj = { originalType: "missing", originalTime: "2026-10-07T15:19:00Z", justification: "Esqueci", reviewedBy: "Ivan" };
    const text = rows([...base, ev(2, "break_start", "2026-10-07T15:19:00Z", { adjustment: adj })]);
    expect(text).toContain("Início do intervalo: batida incluída manualmente às 12:19. Justificativa: Esqueci (por Ivan)");
    expect(text).not.toContain("original");
  });
  it("ajuste de horário mostra original e novo sem caracteres fora do Latin-1", () => {
    const adj = { originalType: "clock_out", originalTime: "2026-10-07T20:30:00Z", justification: "Erro" };
    const text = rows([ev(1, "clock_in", "2026-10-07T11:00:00Z"), ev(4, "clock_out", "2026-10-07T21:00:00Z", { adjustment: adj })]);
    expect(text).toBe("Saída: original 17:30 para 18:00. Justificativa: Erro");
    expect(text).not.toContain("→");
  });
  it("ajuste que troca o tipo da marcação mostra os dois tipos", () => {
    const adj = { originalType: "break_end", originalTime: "2026-10-07T21:00:00Z", justification: "Tipo errado" };
    const text = rows([ev(1, "clock_in", "2026-10-07T11:00:00Z"), ev(4, "clock_out", "2026-10-07T21:00:00Z", { adjustment: adj })]);
    expect(text).toContain("original Retorno do intervalo 18:00 para Saída 18:00");
  });
});
