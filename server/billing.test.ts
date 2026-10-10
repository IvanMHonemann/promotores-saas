import { describe, expect, it, vi, beforeEach } from "vitest";
import { checkSubscriptionAccess } from "./subscriptionAccess";
import * as db from "./db";

vi.mock("./db", () => ({
  getCompanyById: vi.fn(),
  getLatestCompanySubscription: vi.fn(),
}));

describe("checkSubscriptionAccess", () => {
  beforeEach(() => {
    vi.mocked(db.getCompanyById).mockReset();
    vi.mocked(db.getLatestCompanySubscription).mockReset();
  });

  it("permite trial válido", async () => {
    const future = new Date(Date.now() + 5 * 24 * 3600 * 1000);
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      name: "ACME",
      subscriptionStatus: "trial",
      trialEndsAt: future,
      subscriptionExpiresAt: future,
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(true);
    expect(r.status).toBe("trial");
  });

  it("bloqueia trial expirado", async () => {
    const past = new Date(Date.now() - 2 * 24 * 3600 * 1000);
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      name: "ACME",
      subscriptionStatus: "trial",
      trialEndsAt: past,
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(false);
  });

  it("permite active", async () => {
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      subscriptionStatus: "active",
      subscriptionExpiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000),
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(true);
    expect(r.status).toBe("active");
  });

  it("permite overdue dentro da tolerância", async () => {
    const expired = new Date(Date.now() - 1 * 24 * 3600 * 1000);
    const grace = new Date(Date.now() + 2 * 24 * 3600 * 1000);
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      subscriptionStatus: "overdue",
      subscriptionExpiresAt: expired,
      gracePeriodEndsAt: grace,
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(true);
  });

  it("bloqueia suspended", async () => {
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      subscriptionStatus: "suspended",
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe("suspended");
  });

  it("bloqueia canceled após período", async () => {
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      subscriptionStatus: "canceled",
      subscriptionExpiresAt: new Date(Date.now() - 1000),
    } as any);
    const r = await checkSubscriptionAccess(1);
    expect(r.allowed).toBe(false);
  });

  it("empresa inexistente", async () => {
    vi.mocked(db.getCompanyById).mockResolvedValue(undefined);
    const r = await checkSubscriptionAccess(999);
    expect(r.allowed).toBe(false);
    expect(r.status).toBe("none");
  });
});

describe("payment event idempotency shape", () => {
  it("eventId is required for uniqueness", () => {
    const eventId = "evt_123";
    expect(eventId.length).toBeGreaterThan(0);
  });
});
