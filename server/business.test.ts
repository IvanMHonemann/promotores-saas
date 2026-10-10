import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const adminUser = {
  id: -1,
  openId: "member:1",
  name: "Administrador de Teste",
  email: "admin@test.local",
  loginMethod: "test",
  role: "company_admin" as const,
  companyId: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createCaller() {
  return appRouter.createCaller({
    user: adminUser,
    accountId: 1,
    memberAccountId: 1,
    isMember: true,
    isPlatformAdmin: false,
    req: { protocol: "https", headers: {} } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

describe("Business Logic - Extintores e Ordens de Serviço", () => {
  it("deve carregar as estatísticas do painel com sucesso", async () => {
    const stats = await createCaller().dashboard.stats();
    expect(stats).toBeDefined();
    expect(stats.totalClients).toBeGreaterThanOrEqual(1);
    expect(stats.totalExtinguishers).toBeGreaterThanOrEqual(1);
  });

  it("deve listar os clientes e filtrar corretamente por cidade", async () => {
    const caller = createCaller();
    const cities = await caller.clients.cities();
    expect(cities).toBeInstanceOf(Array);
    expect(cities.length).toBeGreaterThan(0);

    const sapirangaClients = await caller.clients.list({ city: "Sapiranga" });
    expect(sapirangaClients.length).toBeGreaterThan(0);
    expect(sapirangaClients[0].city).toBe("Sapiranga");
  });

  it("deve retornar alertas de vencimento com cálculo de dias e urgência", async () => {
    const alerts = await createCaller().extinguishers.alerts({ daysAhead: 30 });
    expect(alerts).toBeInstanceOf(Array);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]).toHaveProperty("diffDays");
    expect(alerts[0]).toHaveProperty("alertStatus");
    expect(alerts[0]).toHaveProperty("alertMessage");
  });

  it("deve buscar uma ordem de serviço e seus itens correspondentes", async () => {
    const caller = createCaller();
    const orders = await caller.orders.list();
    expect(orders.length).toBeGreaterThan(0);
    const orderDetail = await caller.orders.byId({ id: orders[0].order.id });
    expect(orderDetail).toBeDefined();
    expect(orderDetail?.items).toBeInstanceOf(Array);
    expect(orderDetail?.items.length).toBeGreaterThanOrEqual(1);
    expect(orderDetail?.client).toBeDefined();
    expect(orderDetail).toHaveProperty("observations");
  });

  it("deve retornar o histórico do cliente com os serviços e itens da OS", async () => {
    const caller = createCaller();
    const clients = await caller.clients.list();
    const history = await caller.orders.history({ clientId: clients[0].id });
    expect(history).toBeInstanceOf(Array);
    expect(history.every((entry) => Array.isArray(entry.items))).toBe(true);
    for (let index = 1; index < history.length; index += 1) {
      expect(new Date(history[index - 1].order.orderDate).getTime()).toBeGreaterThanOrEqual(new Date(history[index].order.orderDate).getTime());
    }
  });

  it("deve consultar somente a lixeira da empresa autenticada", async () => {
    const trash = await createCaller().trash.list();
    expect(trash).toBeInstanceOf(Array);
    expect(trash.every((item) => item.accountId === 1)).toBe(true);
  });
});
