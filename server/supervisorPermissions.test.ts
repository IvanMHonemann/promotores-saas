import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import * as memberAuth from "./memberAuth";
import * as planLimits from "./planLimits";
import * as emailService from "./email";
import * as subscriptionAccess from "./subscriptionAccess";
import { PLAN_FEATURES } from "../shared/entitlements";
import { ADMIN_NO_PUNCH_MESSAGE, hasPersonalTimeClock } from "../shared/personalPonto";
import { isCompanyManager } from "../shared/companyAccess";
import { SUPERVISOR_PROMOTER_ONLY_MESSAGE, assertSupervisorPromoterOnly } from "./supervisorTeam";

const NOW = new Date("2026-11-15T13:00:00.000Z");

function caller(role: string) {
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "Teste", email: "t@test.local", loginMethod: "password", role, companyId: 1, createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

const members = [
  { id: 1, userName: "Admin", email: "a@test.local", role: "company_admin", active: true },
  { id: 2, userName: "Super", email: "s@test.local", role: "supervisor", active: true },
  { id: 10, userName: "Promotor", email: "p@test.local", role: "promoter", active: true },
];

function stubCompany() {
  vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional], price: "350.00", additionalUserPrice: "12" } } as any);
  vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
  vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
  vi.spyOn(db, "ensureSeedPlans").mockResolvedValue(undefined as any);
  vi.spyOn(db, "listSubscriptionPlans").mockResolvedValue([{ id: 150005, name: "GONDUP Completo", price: "350.00", active: true }] as any);
  vi.spyOn(planLimits, "getEffectivePlan").mockResolvedValue({ id: 150005, name: "GONDUP Completo", price: "350.00", additionalUserPrice: "12" } as any);
  vi.spyOn(db, "listPaymentsForCompany").mockResolvedValue([{ id: 1, amount: "350.00" }] as any);
  vi.spyOn(memberAuth, "listMemberAccounts").mockResolvedValue(members as any);
  vi.spyOn(emailService, "emailAccountCreated").mockResolvedValue(undefined as any);
  vi.spyOn(subscriptionAccess, "checkSubscriptionAccess").mockResolvedValue({ allowed: true, status: "ok", reason: null } as any);
  vi.spyOn(planLimits, "getStaffUsage").mockResolvedValue({
    current: 1, extraUsers: 0, included: 20, limit: 20, unlimited: false, planName: "Completo",
    planPrice: "350.00", additionalUserPrice: "12", suggestedMonthlyAmount: "350.00", label: "1 de 20",
  } as any);
}

afterEach(() => { vi.restoreAllMocks(); });

describe("papéis da empresa", () => {
  it("helpers de papel", () => {
    expect(isCompanyManager("company_admin")).toBe(true);
    expect(isCompanyManager("supervisor")).toBe(true);
    expect(isCompanyManager("promoter")).toBe(false);
    expect(hasPersonalTimeClock("promoter")).toBe(true);
    expect(hasPersonalTimeClock("supervisor")).toBe(false);
    expect(hasPersonalTimeClock("company_admin")).toBe(false);
    expect(() => assertSupervisorPromoterOnly("supervisor", "company_admin")).toThrow(SUPERVISOR_PROMOTER_ONLY_MESSAGE);
    expect(() => assertSupervisorPromoterOnly("supervisor", "supervisor")).toThrow(SUPERVISOR_PROMOTER_ONLY_MESSAGE);
    expect(() => assertSupervisorPromoterOnly("supervisor", "promoter")).not.toThrow();
    expect(() => assertSupervisorPromoterOnly("company_admin", "supervisor")).not.toThrow();
  });

  it("billing com valores fica só para o admin da empresa", async () => {
    stubCompany();
    const forbidden = ["plans", "mySubscription", "payments", "paymentReminder"] as const;
    for (const role of ["supervisor", "promoter"] as const) {
      const api = caller(role).billing;
      for (const key of forbidden) {
        await expect((api as any)[key]()).rejects.toMatchObject({ code: "FORBIDDEN" });
      }
      await expect(api.access()).resolves.toBeTruthy();
    }
    const admin = caller("company_admin").billing;
    await expect(admin.plans()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ name: "GONDUP Completo" })]));
    await expect(admin.mySubscription()).resolves.toEqual(expect.objectContaining({ plan: expect.objectContaining({ price: "350.00" }) }));
    await expect(admin.payments()).resolves.toEqual([expect.objectContaining({ amount: "350.00" })]);
  });

  it("supervisor não vê preços no uso de funcionários", async () => {
    stubCompany();
    const usage = await caller("supervisor").companyUsers.staffUsage();
    expect(usage).toEqual(expect.objectContaining({ current: 1, label: "1 de 20" }));
    expect(usage).not.toHaveProperty("planPrice");
    expect(usage).not.toHaveProperty("additionalUserPrice");
    expect(usage).not.toHaveProperty("suggestedMonthlyAmount");
    const adminUsage = await caller("company_admin").companyUsers.staffUsage();
    expect(adminUsage).toEqual(expect.objectContaining({ planPrice: "350.00", additionalUserPrice: "12", suggestedMonthlyAmount: "350.00" }));
  });

  it("supervisor cadastra só promotores e não edita admin nem outro supervisor", async () => {
    stubCompany();
    const create = vi.spyOn(memberAuth, "createCompanyUser").mockResolvedValue({ accountId: 99, recoveryCode: "x" } as any);
    const update = vi.spyOn(memberAuth, "updateCompanyUser").mockResolvedValue(undefined as any);
    const reset = vi.spyOn(memberAuth, "resetMemberPassword").mockResolvedValue(undefined as any);
    vi.spyOn(planLimits, "assertUserLimit").mockResolvedValue(undefined as any);

    await expect(caller("supervisor").companyUsers.create({ userName: "Novo Admin", email: "na@test.local", password: "abcdefgh", role: "company_admin" })).rejects.toMatchObject({ code: "FORBIDDEN", message: SUPERVISOR_PROMOTER_ONLY_MESSAGE });
    await expect(caller("supervisor").companyUsers.create({ userName: "Novo Super", email: "ns@test.local", password: "abcdefgh", role: "supervisor" })).rejects.toMatchObject({ code: "FORBIDDEN", message: SUPERVISOR_PROMOTER_ONLY_MESSAGE });
    expect(create).not.toHaveBeenCalled();

    await expect(caller("supervisor").companyUsers.create({ userName: "Novo Promotor", email: "np@test.local", password: "abcdefgh", role: "promoter" })).resolves.toEqual({ accountId: 99, recoveryCode: "x" });
    expect(create).toHaveBeenCalledOnce();

    await expect(caller("supervisor").companyUsers.update({ id: 1, userName: "Hack" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("supervisor").companyUsers.update({ id: 2, userName: "Hack" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(update).not.toHaveBeenCalled();
    await expect(caller("supervisor").companyUsers.update({ id: 10, userName: "Promotor Atualizado" })).resolves.toEqual({ success: true });
    expect(update).toHaveBeenCalled();

    await expect(caller("supervisor").companyUsers.resetPassword({ id: 1, newPassword: "abcdefgh" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reset).not.toHaveBeenCalled();
    await expect(caller("supervisor").companyUsers.resetPassword({ id: 10, newPassword: "abcdefgh" })).resolves.toEqual({ success: true });
    expect(reset).toHaveBeenCalledOnce();

    await expect(caller("company_admin").companyUsers.create({ userName: "Outro Super", email: "os@test.local", password: "abcdefgh", role: "supervisor" })).resolves.toEqual({ accountId: 99, recoveryCode: "x" });
  });

  it("supervisor acessa o ponto da equipe e não registra ponto pessoal", async () => {
    stubCompany();
    await expect(caller("supervisor").timeTracking.registerEvent({
      eventType: "clock_in", latitude: -23.5, longitude: -46.6, accuracy: 10, locationStatus: "success", timeZone: "America/Sao_Paulo",
    } as any)).rejects.toThrow(ADMIN_NO_PUNCH_MESSAGE);

    await expect(caller("supervisor").timeTracking.correctionRequests.pending()).resolves.toEqual([]);

    await expect(caller("promoter").timeTracking.companyToday({ timeZone: "America/Sao_Paulo" })).rejects.toMatchObject({
      message: "Somente o administrador ou o supervisor da empresa pode executar esta operação.",
    });
  });
});
