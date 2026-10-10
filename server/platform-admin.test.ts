import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  getCompanyById: vi.fn(),
  createClient: vi.fn(),
  createExtinguisher: vi.fn(),
  createServiceOrder: vi.fn(),
  getServiceOrderHistory: vi.fn(),
  deleteServiceOrder: vi.fn(),
}));

vi.mock("./db", () => dbMock);

import { appRouter } from "./routers";

describe("platform.data.createClient", () => {
  beforeEach(() => {
    dbMock.getCompanyById.mockReset();
    dbMock.createClient.mockReset();
    dbMock.createExtinguisher.mockReset();
    dbMock.createServiceOrder.mockReset();
    dbMock.getServiceOrderHistory.mockReset();
    dbMock.deleteServiceOrder.mockReset();
  });

  it("grava o cliente na empresa selecionada pelo administrador global", async () => {
    dbMock.getCompanyById.mockResolvedValue({ id: 7, name: "Empresa Teste", active: true });
    dbMock.createClient.mockResolvedValue(42);

    const caller = appRouter.createCaller({
      user: {
        id: 99,
        openId: "platform:99",
        name: "Administrador Global",
        email: "admin@example.com",
        loginMethod: "password",
        role: "platform_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      isPlatformAdmin: true,
      platformAdminId: 99,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.platform.data.createClient({
      companyId: 7,
      companyName: "Cliente Novo",
      city: "Sapiranga",
      cnpj: "",
      address: "",
      cep: "",
      phone: "",
      contactName: "",
      cpf: "",
      birthDate: "",
      notes: "",
    });

    expect(result).toEqual({ id: 42 });
    expect(dbMock.getCompanyById).toHaveBeenCalledWith(7);
    expect(dbMock.createClient).toHaveBeenCalledWith(expect.objectContaining({
      accountId: 7,
      companyName: "Cliente Novo",
      city: "Sapiranga",
      cnpj: null,
      address: null,
    }));
  });

  it("recusa salvar em empresa inexistente ou inativa", async () => {
    dbMock.getCompanyById.mockResolvedValue({ id: 7, name: "Empresa Inativa", active: false });

    const caller = appRouter.createCaller({
      user: {
        id: 99,
        openId: "platform:99",
        name: "Administrador Global",
        email: "admin@example.com",
        loginMethod: "password",
        role: "platform_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      isPlatformAdmin: true,
      platformAdminId: 99,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    await expect(caller.platform.data.createClient({
      companyId: 7,
      companyName: "Cliente Não Salvo",
      city: "Sapiranga",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMock.createClient).not.toHaveBeenCalled();
  });

  it("cria a ordem de serviço na empresa selecionada sem accountId na sessão", async () => {
    dbMock.getCompanyById.mockResolvedValue({ id: 7, name: "Empresa Teste", active: true });
    dbMock.createServiceOrder.mockResolvedValue({ id: 88, orderNumber: 1001 });

    const caller = appRouter.createCaller({
      user: {
        id: 99,
        openId: "platform:99",
        name: "Administrador Global",
        email: "admin@example.com",
        loginMethod: "password",
        role: "platform_admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      isPlatformAdmin: true,
      platformAdminId: 99,
      req: { protocol: "https", headers: {} } as any,
      res: {} as any,
    });

    const result = await caller.platform.data.createOrder({
      companyId: 7,
      orderDate: "2026-09-26",
      clientId: 12,
      totalAmount: "45.00",
      items: [{ description: "Recarga", quantity: 1, unitPrice: "45.00", totalPrice: "45.00" }],
    });

    expect(result).toEqual({ id: 88, orderNumber: 1001 });
    expect(dbMock.createServiceOrder).toHaveBeenCalledWith(expect.objectContaining({ accountId: 7, clientId: 12, createdByName: "Administrador Global" }), expect.any(Array), 7);
  });

  it("permite ao administrador geral consultar o histórico completo de uma empresa", async () => {
    dbMock.getServiceOrderHistory.mockResolvedValue([{ order: { id: 88 }, client: { id: 12 }, items: [] }]);
    const caller = appRouter.createCaller({
      user: { id: 99, openId: "platform:99", name: "Administrador Global", email: "admin@example.com", loginMethod: "password", role: "platform_admin", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
      isPlatformAdmin: true, platformAdminId: 99, req: { protocol: "https", headers: {} } as any, res: {} as any,
    });
    const result = await caller.platform.data.history({ companyId: 7, clientId: 12 });
    expect(result).toHaveLength(1);
    expect(dbMock.getServiceOrderHistory).toHaveBeenCalledWith(12, 7);
  });
});
