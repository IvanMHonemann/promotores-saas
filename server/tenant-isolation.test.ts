import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const now = new Date();

function user(id: number, role: "company_admin" | "operator" = "company_admin") {
  return {
    id: -id,
    openId: `member:${id}`,
    name: `Tenant ${id}`,
    email: `tenant-${id}@test.local`,
    loginMethod: "password",
    role,
    companyId: id,
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  } as const;
}

function caller(accountId?: number) {
  const id = accountId || 999999;
  return appRouter.createCaller({
    user: user(id),
    accountId,
    memberAccountId: accountId,
    isMember: Boolean(accountId),
    isPlatformAdmin: false,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

describe("Isolamento real entre tenants A e B", () => {
  it("lista somente clientes e OS do próprio tenant e bloqueia IDs cruzados", async () => {
    const tenantA = caller(1);
    const tenantB = caller(30001);
    const clientsA = await tenantA.clients.list();
    const clientsB = await tenantB.clients.list();
    expect(clientsA.length).toBeGreaterThan(0);
    expect(clientsB.length).toBeGreaterThan(0);
    expect(clientsA.every(client => client.accountId === 1)).toBe(true);
    expect(clientsB.every(client => client.accountId === 30001)).toBe(true);
    expect(clientsA.some(client => client.id === 30001)).toBe(false);
    expect(clientsB.some(client => client.id === 1)).toBe(false);

    expect((await tenantA.clients.byId({ id: 30001 })).client).toBeNull();
    expect((await tenantB.clients.byId({ id: 1 })).client).toBeNull();
    expect((await tenantA.orders.byId({ id: 30001 }))).toBeNull();
    expect((await tenantB.orders.byId({ id: 1 }))).toBeNull();

    const ordersA = await tenantA.orders.list();
    const ordersB = await tenantB.orders.list();
    expect(ordersA.every(row => row.order.accountId === 1)).toBe(true);
    expect(ordersB.every(row => row.order.accountId === 30001)).toBe(true);
  });

  it("bloqueia alteração e exclusão usando IDs de outro tenant", async () => {
    const tenantA = caller(1);
    await expect(tenantA.clients.update({
      id: 30001,
      companyName: "Tentativa indevida",
      city: "Não autorizado",
    })).rejects.toBeTruthy();
    await expect(tenantA.clients.delete({ id: 30001 })).rejects.toBeTruthy();
    await expect(tenantBDelete()).rejects.toBeTruthy();
  });

  it("bloqueia extintor de outra empresa e consultas sem accountId", async () => {
    const tenantA = caller(1);
    const tenantB = caller(30001);
    const extinguishersA = await tenantA.extinguishers.listByClient({ clientId: 1 });
    expect(extinguishersA.length).toBeGreaterThan(0);
    expect(await tenantB.extinguishers.listByClient({ clientId: 1 })).toEqual([]);
    await expect(caller().clients.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().orders.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller().dashboard.stats()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

async function tenantBDelete() {
  return caller(30001).clients.delete({ id: 1 });
}
