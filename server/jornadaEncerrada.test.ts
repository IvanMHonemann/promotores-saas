import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as ledger from "./ponto/ledger";
import { PLAN_FEATURES } from "../shared/entitlements";
import { JORNADA_ENCERRADA_MESSAGE } from "./modules/timeTracking";

// 15:00 em São Paulo: longe da virada do dia.
const NOW = new Date("2026-11-09T18:00:00.000Z");

function caller() {
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "Promotor", email: "promotor@test.local", loginMethod: "password", role: "promoter", companyId: 1, createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

function event(id: number, eventType: string, at: string) {
  const t = new Date(at);
  return { id, companyId: 1, memberAccountId: 10, eventType, serverTime: t, deviceTime: t, latitude: -23.5, longitude: -46.6, accuracy: 10, locationStatus: "success", notes: null };
}

function setup(history: any[]) {
  vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] } } as any);
  vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
  vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
  vi.spyOn(ledger, "ensurePunchLedger").mockResolvedValue(undefined as any);
  vi.spyOn(ledger, "effectiveRows").mockImplementation(async (rows: any) => rows);
  const append = vi.spyOn(ledger, "appendOriginalPunch").mockRejectedValue(new Error("stop-after-append"));
  const query: any = { from: vi.fn(() => query), where: vi.fn(() => query), orderBy: vi.fn(() => query), limit: vi.fn().mockResolvedValue(history) };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: vi.fn(() => query) } as any);
  return append;
}

const base = { latitude: -23.5, longitude: -46.6, accuracy: 10, locationStatus: "success" as const, timeZone: "America/Sao_Paulo" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("jornada encerrada: nova entrada depois da saída no mesmo dia", () => {
  const closedDay = [event(2, "clock_out", "2026-11-09T17:00:00.000Z"), event(1, "clock_in", "2026-11-09T12:00:00.000Z")];

  it("recusa nova entrada online depois da saída do dia", async () => {
    const append = setup(closedDay);
    await expect(caller().timeTracking.registerEvent({ ...base, eventType: "clock_in" })).rejects.toMatchObject({ code: "BAD_REQUEST", message: JORNADA_ENCERRADA_MESSAGE });
    expect(append).not.toHaveBeenCalled();
  });

  it("libera a entrada no dia seguinte", async () => {
    const append = setup([event(2, "clock_out", "2026-11-08T21:00:00.000Z"), event(1, "clock_in", "2026-11-08T12:00:00.000Z")]);
    await expect(caller().timeTracking.registerEvent({ ...base, eventType: "clock_in" })).rejects.toThrow("stop-after-append");
    expect(append).toHaveBeenCalledOnce();
  });

  it("não perde batida offline já feita no aparelho: aceita e sinaliza", async () => {
    const append = setup(closedDay);
    await expect(caller().timeTracking.registerEvent({ ...base, eventType: "clock_in", offline: true, deviceTime: "2026-11-09T17:30:00.000Z" })).rejects.toThrow("stop-after-append");
    expect(append).toHaveBeenCalledOnce();
    expect(append.mock.calls[0][0].notes).toContain(ledger.NEW_SHIFT_MARKER);
  });
});
