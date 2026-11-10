import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as ledger from "./ponto/ledger";
import { PLAN_FEATURES } from "../shared/entitlements";
import { ADMIN_NO_PUNCH_MESSAGE, hasPersonalTimeClock } from "../shared/personalPonto";

const NOW = new Date("2026-11-10T13:00:00.000Z");

function caller(role: string) {
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "Teste", email: "t@test.local", loginMethod: "password", role, companyId: 1, createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

function setup() {
  vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] } } as any);
  vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
  vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
  vi.spyOn(ledger, "ensurePunchLedger").mockResolvedValue(undefined as any);
  vi.spyOn(ledger, "effectiveRows").mockImplementation(async (rows: any) => rows);
  const append = vi.spyOn(ledger, "appendOriginalPunch").mockRejectedValue(new Error("stop-after-append"));
  const query: any = { from: vi.fn(() => query), where: vi.fn(() => query), orderBy: vi.fn(() => query), limit: vi.fn().mockResolvedValue([]) };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: vi.fn(() => query) } as any);
  return append;
}

const punch = { eventType: "clock_in" as const, latitude: -23.5, longitude: -46.6, accuracy: 10, locationStatus: "success" as const, timeZone: "America/Sao_Paulo" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("administrador da empresa não tem ponto pessoal", () => {
  it("quem tem ponto pessoal", () => {
    expect(hasPersonalTimeClock("promoter")).toBe(true);
    expect(hasPersonalTimeClock("supervisor")).toBe(true);
    expect(hasPersonalTimeClock("company_admin")).toBe(false);
    expect(hasPersonalTimeClock("platform_admin")).toBe(false);
    expect(hasPersonalTimeClock(undefined)).toBe(false);
  });

  it("administrador: bater ponto é recusado com mensagem amigável e nada é gravado", async () => {
    const append = setup();
    await expect(caller("company_admin").timeTracking.registerEvent(punch)).rejects.toThrow(ADMIN_NO_PUNCH_MESSAGE);
    expect(append).not.toHaveBeenCalled();
  });

  it("administrador: pedido de correção pessoal é recusado", async () => {
    setup();
    await expect(caller("company_admin").timeTracking.requestCorrection({ date: "2026-11-09", requestedType: "clock_in", requestedTime: "2026-11-09T12:00:00.000Z", justification: "x" })).rejects.toThrow(ADMIN_NO_PUNCH_MESSAGE);
  });

  it("promotor e supervisor continuam batendo ponto (chegam ao registro)", async () => {
    for (const role of ["promoter", "supervisor"]) {
      const append = setup();
      await expect(caller(role).timeTracking.registerEvent(punch)).rejects.toThrow("stop-after-append");
      expect(append).toHaveBeenCalledOnce();
      vi.restoreAllMocks();
    }
  });
});
