import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { PLAN_FEATURES } from "../shared/entitlements";
import { buildMirror, mirrorRows, type MirrorEvent } from "../shared/timesheetMirror";
import { documentLegend, documentTotals } from "../client/src/lib/mirrorExport";

const now = new Date();
function caller(role: "promoter" | "company_admin") {
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "Teste", email: "t@test.local", loginMethod: "password", role, companyId: 1, createdAt: now, updatedAt: now, lastSignedIn: now } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

const ev = (id: number, type: MirrorEvent["type"], time: string, extra: Partial<MirrorEvent> = {}): MirrorEvent => ({ id, type, time, receivedAt: time, synced: true, ...extra });
const inc = (id: number, type: MirrorEvent["type"], time: string, justification: string) => ev(id, type, time, { adjustment: { originalType: "missing" as any, originalTime: time, justification, reviewedBy: "Ivan" } });
const dis = { reason: "Inclusão em duplicidade", by: "Ivan" };
// Caso 24/10: entrada 07:34, dois pares de intervalo repetidos; 12:18/13:18 (e 12:19/13:00) desconsiderados.
const day24 = (disregard: boolean): MirrorEvent[] => [
  ev(1, "clock_in", "2026-10-24T10:34:00Z"),
  inc(2, "break_start", "2026-10-24T14:08:00Z", "Esqueci"), inc(3, "break_end", "2026-10-24T15:08:00Z", "Esqueci"),
  { ...inc(4, "break_start", "2026-10-24T15:18:00Z", "Esquecimento"), disregarded: disregard ? dis : null },
  { ...inc(5, "break_end", "2026-10-24T16:18:00Z", "Esquecimento"), disregarded: disregard ? dis : null },
  ev(6, "clock_out", "2026-10-24T20:00:00Z"),
];

describe("batida desconsiderada: cálculo e espelho", () => {
  const before = buildMirror({ events: day24(false), from: "2026-10-24", to: "2026-10-24" });
  const after = buildMirror({ events: day24(true), from: "2026-10-24", to: "2026-10-24" });
  const row = mirrorRows(after)[0];
  it("sai das colunas principais", () => {
    expect(row[3]).toBe("11:08+");
    expect(row[4]).toBe("12:08+");
    expect(row[3]).not.toContain("12:18");
    expect(row[4]).not.toContain("13:18");
  });
  it("sai do cálculo de horas e intervalo", () => {
    // 07:34-11:08 (3h34) + 12:08-17:00 (4h52) = 8h26; intervalo 1h
    expect(after.days[0].workedMinutes).toBe(506);
    expect(after.days[0].breakMinutes).toBe(60);
    expect(before.days[0].breakMinutes).toBe(120);
    expect(after.totals.adjustedMarks).toBe(2);
    expect(after.totals.disregardedMarks).toBe(2);
  });
  it("não gera aviso de pareamento e aparece curto em Ocorrências", () => {
    expect(after.days[0].issues).toEqual([]);
    expect(row[12]).toBe("Batidas incluídas manualmente: 11:08, 12:08 — Esqueci (por Ivan); Batidas desconsideradas: 12:18, 13:18 — Inclusão em duplicidade (por Ivan)");
  });
  it("legenda e totais do PDF só citam desconsideradas quando há", () => {
    const mk = (report: any) => ({ member: { id: 1, name: "T", role: "promoter", employeeCode: null }, labor: null, report } as any);
    expect(documentLegend(after)).toContain("desconsideradas");
    expect(documentLegend(before)).not.toContain("desconsideradas");
    expect(documentTotals(mk(after)).some(([k]) => k === "Batidas desconsideradas")).toBe(true);
    expect(documentTotals(mk(before)).some(([k]) => k === "Batidas desconsideradas")).toBe(false);
  });
  it("dia só com batida desconsiderada não tem marcações", () => {
    const r = buildMirror({ events: [ev(9, "clock_in", "2026-10-25T12:00:00Z", { disregarded: dis })], from: "2026-10-25", to: "2026-10-25" });
    expect(r.days[0].marks).toEqual([]);
    expect(r.totals.daysWithMarks).toBe(0);
    expect(mirrorRows(r)[0][12]).toContain("Batida desconsiderada: 09:00 — Inclusão em duplicidade (por Ivan)");
  });
});

describe("batida desconsiderada: permissões", () => {
  afterEach(() => vi.restoreAllMocks());
  const withPlan = () => {
    vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] } } as any);
    vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
    vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
  };
  it("promotor não pode desconsiderar nem reconsiderar", async () => {
    withPlan();
    await expect(caller("promoter").timeTracking.disregardEvent({ eventId: 1, reason: "Duplicada no dia" })).rejects.toThrow(/administrador da empresa/);
    await expect(caller("promoter").timeTracking.disregardEvent({ eventId: 1, reason: "Duplicada no dia" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("promoter").timeTracking.reconsiderEvent({ eventId: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("justificativa é obrigatória (mínimo 5 caracteres)", async () => {
    withPlan();
    await expect(caller("company_admin").timeTracking.disregardEvent({ eventId: 1, reason: "abc" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
