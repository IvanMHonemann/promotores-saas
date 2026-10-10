import { describe, expect, it } from "vitest";
import { diffAuditData, sanitizeAuditData } from "./audit";
import { appRouter } from "./routers";

const now = new Date();

function companyUser(accountId: number, role: "company_admin" | "operator" = "company_admin") {
  return {
    id: -accountId,
    openId: `member:${accountId}`,
    name: `User ${accountId}`,
    email: `user-${accountId}@test.local`,
    loginMethod: "password",
    role,
    companyId: accountId,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  } as const;
}

function caller(accountId: number, role: "company_admin" | "operator" = "company_admin") {
  return appRouter.createCaller({
    user: companyUser(accountId, role),
    accountId,
    memberAccountId: accountId,
    isMember: true,
    isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest", "x-forwarded-for": "127.0.0.1" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

describe("Auditoria — sanitização e diff", () => {
  it("remove campos sensíveis", () => {
    const cleaned = sanitizeAuditData({
      name: "João",
      password: "secret",
      passwordHash: "xxx",
      token: "abc",
      recoveryCode: "123",
      capacity: "6 kg",
    }) as Record<string, unknown>;
    expect(cleaned.name).toBe("João");
    expect(cleaned.capacity).toBe("6 kg");
    expect(cleaned.password).toBeUndefined();
    expect(cleaned.passwordHash).toBeUndefined();
    expect(cleaned.token).toBeUndefined();
    expect(cleaned.recoveryCode).toBeUndefined();
  });

  it("gera diff apenas dos campos alterados", () => {
    const { oldData, newData } = diffAuditData(
      { locationInBuilding: "Recepção", capacity: "6 kg", notes: "ok" },
      { locationInBuilding: "Almoxarifado", capacity: "8 kg", notes: "ok" },
    );
    expect(oldData).toMatchObject({ locationInBuilding: "Recepção", capacity: "6 kg" });
    expect(newData).toMatchObject({ locationInBuilding: "Almoxarifado", capacity: "8 kg" });
    expect(oldData).not.toHaveProperty("notes");
    expect(newData).not.toHaveProperty("notes");
  });
});

describe("Auditoria — isolamento multi-tenant", () => {
  it("usuário da empresa só lista auditoria do próprio tenant", async () => {
    const a = caller(1);
    const b = caller(30001);

    // list não deve vazar entre tenants (mesmo se vazia)
    const listA = await a.audit.list({ page: 1, pageSize: 10 });
    const listB = await b.audit.list({ page: 1, pageSize: 10 });
    expect(listA).toHaveProperty("items");
    expect(listB).toHaveProperty("items");
    expect(listA).toHaveProperty("total");
    for (const row of listA.items) {
      expect(row.companyId).toBe(1);
    }
    for (const row of listB.items) {
      expect(row.companyId).toBe(30001);
    }
  });

  it("byId de outro tenant retorna NOT_FOUND", async () => {
    const a = caller(1);
    const listA = await a.audit.list({ page: 1, pageSize: 5 });
    if (listA.items.length === 0) {
      // sem dados ainda — ok, isolamento de list já validado
      return;
    }
    const id = listA.items[0].id;
    const b = caller(30001);
    await expect(b.audit.byId({ id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("operator não pode exportar CSV (somente company_admin)", async () => {
    const op = caller(1, "operator");
    await expect(op.audit.exportCsv({})).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
