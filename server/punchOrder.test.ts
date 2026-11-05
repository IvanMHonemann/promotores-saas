import { describe, expect, it } from "vitest";
import { punchOrderError, sortPunches } from "@shared/punchOrder";

const t = (h: string) => `2026-11-02T${h}:00-03:00`;
describe("punchOrder", () => {
  it("ordena batidas pelo horário", () => {
    const items = [{ type: "clock_out", time: t("17:00") }, { type: "clock_in", time: t("08:00") }];
    expect(sortPunches(items, i => i.time, i => i.type).map(i => i.type)).toEqual(["clock_in", "clock_out"]);
  });
  it("recusa saída antes do intervalo", () => {
    const existing = [{ type: "clock_in", time: t("08:00") }, { type: "break_start", time: t("11:08") }];
    const err = punchOrderError(existing as any, { type: "clock_out", time: t("08:00") } as any);
    expect(err).toMatch(/Saída/);
  });
  it("aceita sequência correta", () => {
    const existing = [{ type: "clock_in", time: t("08:00") }];
    expect(punchOrderError(existing as any, { type: "clock_out", time: t("17:00") } as any)).toBeNull();
  });
});
