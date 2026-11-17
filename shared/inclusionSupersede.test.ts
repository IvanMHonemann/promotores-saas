import { describe, expect, it } from "vitest";
import { idsSupersededByInclusion, idsSupersededByInclusionGrouped, inclusionBlockedMessage } from "./inclusionSupersede";

function ev(id: number, type: string, time: string, origin: string | null = "original") {
  return { id, type, time: new Date(time), origin, memberId: 1 };
}

describe("idsSupersededByInclusion", () => {
  it("no 16/11, a inclusão de fim de intervalo e de saída substitui as originais do mesmo tipo", () => {
    const events = [
      ev(1, "clock_in", "2026-11-16T14:15:04Z"),
      ev(2, "break_start", "2026-11-16T18:36:34Z"),
      ev(3, "break_end", "2026-11-16T19:46:00Z", "inclusion"),
      ev(4, "break_end", "2026-11-17T02:12:58Z"),
      ev(5, "clock_out", "2026-11-17T02:13:12Z"),
      ev(6, "clock_out", "2026-11-17T02:55:00Z", "inclusion"),
    ];
    expect(idsSupersededByInclusion(events).sort()).toEqual([4, 5]);
  });

  it("não altera o dia quando só há inclusões (não havia batida original daquele tipo)", () => {
    const events = [
      ev(1, "clock_in", "2026-11-03T10:00:00Z"),
      ev(2, "break_start", "2026-11-03T15:00:00Z", "inclusion"),
      ev(3, "break_end", "2026-11-03T16:00:00Z", "inclusion"),
      ev(4, "clock_out", "2026-11-03T23:00:00Z", "inclusion"),
    ];
    expect(idsSupersededByInclusion(events)).toEqual([]);
  });

  it("em dois turnos, a inclusão da segunda saída substitui só a saída mais próxima", () => {
    const events = [
      ev(1, "clock_in", "2026-11-16T11:00:00-03:00"),
      ev(2, "clock_out", "2026-11-16T15:00:00-03:00"),
      ev(3, "clock_in", "2026-11-16T16:00:00-03:00"),
      ev(4, "clock_out", "2026-11-16T21:00:00-03:00"),
      ev(5, "clock_out", "2026-11-16T21:10:00-03:00", "inclusion"),
    ];
    expect(idsSupersededByInclusion(events)).toEqual([4]);
  });

  it("agrupa por dia civil de São Paulo, não por UTC", () => {
    const events = [
      ev(1, "clock_out", "2026-11-17T01:00:00Z"), // 16/11 22:00 SP
      ev(2, "clock_out", "2026-11-17T02:55:00Z", "inclusion"), // 16/11 23:55 SP
      ev(3, "clock_out", "2026-11-17T05:00:00Z"), // 17/11 02:00 SP, outro dia
    ];
    expect(idsSupersededByInclusionGrouped(events).sort()).toEqual([1]);
  });
});

describe("inclusionBlockedMessage", () => {
  const day = [
    ev(1, "clock_in", "2026-11-16T14:15:00Z"),
    ev(2, "break_start", "2026-11-16T18:36:00Z"),
    ev(4, "break_end", "2026-11-17T02:12:58Z"),
    ev(5, "clock_out", "2026-11-17T02:13:12Z"),
  ];

  it("recusa incluir um fim de intervalo se o dia já tem um", () => {
    const msg = inclusionBlockedMessage(day, "break_end", new Date("2026-11-16T19:46:00Z"));
    expect(msg).toMatch(/Corrigir horário desta batida/);
    expect(msg).toMatch(/Fim do intervalo/);
  });

  it("permite uma nova entrada depois da saída (nova jornada)", () => {
    expect(inclusionBlockedMessage(day, "clock_in", new Date("2026-11-17T02:30:00Z"))).toBeNull();
  });

  it("permite incluir a saída que faltava", () => {
    const open = day.filter((e) => e.type !== "clock_out" && e.type !== "break_end");
    expect(inclusionBlockedMessage(open, "break_end", new Date("2026-11-16T19:46:00Z"))).toBeNull();
  });
});
