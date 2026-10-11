import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { PLAN_FEATURES } from "../shared/entitlements";

const now = new Date();

function caller() {
  return appRouter.createCaller({
    user: {
      id: -10,
      openId: "member:10",
      name: "Promotor",
      email: "promotor@test.local",
      loginMethod: "password",
      role: "promoter",
      companyId: 1,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as any,
    accountId: 1,
    memberAccountId: 10,
    isMember: true,
    isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

afterEach(() => vi.restoreAllMocks());

describe("timeTracking.registerEvent idempotency", () => {
  it("does not return another tenant/member's event when an idempotency key is reused", async () => {
    vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({
      company: null,
      subscription: null,
      plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] },
    } as any);
    vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
    vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});

    const existingEvent = {
      id: 900,
      companyId: 2,
      memberAccountId: 20,
      eventType: "clock_in",
      serverTime: now,
      deviceTime: now,
      latitude: -23.5,
      longitude: -46.6,
      accuracy: 10,
      locationStatus: "success",
      idempotencyKey: "shared-key",
    };
    const query = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([existingEvent]),
    };
    const database = { select: vi.fn(() => query) };
    vi.spyOn(db, "getDb").mockResolvedValue(database as any);

    await expect(caller().timeTracking.registerEvent({
      eventType: "clock_in",
      latitude: -23.5,
      longitude: -46.6,
      accuracy: 10,
      locationStatus: "success",
      idempotencyKey: "shared-key",
      timeZone: "America/Sao_Paulo",
    })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "Esta chave de idempotência não pode ser reutilizada nesta sessão.",
    });
  });
});
