import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { PLAN_FEATURES } from "../shared/entitlements";

const now = new Date();

function caller(role: "company_admin" | "supervisor" | "promoter", memberAccountId = 10, accountId = 1) {
  return appRouter.createCaller({
    user: {
      id: -memberAccountId,
      openId: `member:${memberAccountId}`,
      name: role,
      email: `${role}@test.local`,
      loginMethod: "password",
      role,
      companyId: accountId,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } as any,
    accountId,
    memberAccountId,
    isMember: true,
    isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

function allowProfessionalPlan() {
  vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({
    company: null,
    subscription: null,
    plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] },
  } as any);
  vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
  vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
}

const newStore = { name: "Loja Centro", city: "São Paulo", state: "SP" };

afterEach(() => vi.restoreAllMocks());

describe("cadastro de lojas (operations.stores.create)", () => {
  it("bloqueia o promotor antes de qualquer acesso ao banco", async () => {
    const create = vi.spyOn(db, "createOperationalStore");
    await expect(caller("promoter").operations.stores.create(newStore)).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Somente administradores e supervisores da empresa podem cadastrar lojas.",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it.each(["company_admin", "supervisor"] as const)("permite o perfil %s e grava na empresa do usuário", async (role) => {
    allowProfessionalPlan();
    const create = vi.spyOn(db, "createOperationalStore").mockResolvedValue({ id: 77, ...newStore } as any);
    const result = await caller(role, 11, 5).operations.stores.create(newStore);
    expect(result).toMatchObject({ id: 77 });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ companyId: 5, name: "Loja Centro" }), 11);
  });
});

describe("vínculos promotor ↔ loja (operations.promoterStores.list)", () => {
  it("só o administrador da empresa consulta os vínculos", async () => {
    await expect(caller("promoter").operations.promoterStores.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("supervisor").operations.promoterStores.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("edição de promotor com lojas (companyUsers.updatePromoterManagement)", () => {
  it("o promotor não pode alterar os próprios vínculos", async () => {
    await expect(caller("promoter").companyUsers.updatePromoterManagement({
      id: 10, userName: "Promotor", email: "p@test.local", employeeCode: null, workStartTime: null, workEndTime: null, storeIds: [1, 2],
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
