import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as announcements from "./platformAnnouncements";

const NOW = new Date("2026-11-15T13:00:00.000Z");

function companyCaller(role: string, companyId = 60001, memberAccountId = 10) {
  return appRouter.createCaller({
    user: {
      id: -10, openId: `member:${memberAccountId}`, name: "Teste", email: "t@test.local",
      loginMethod: "password", role, companyId, createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW,
    } as any,
    accountId: companyId, memberAccountId, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

function platformCaller() {
  return appRouter.createCaller({
    user: {
      id: 1, openId: "platform:1", name: "Ivan", email: "ivan@test.local",
      loginMethod: "password", role: "platform_admin", createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW,
    } as any,
    accountId: undefined, memberAccountId: undefined, isMember: false, isPlatformAdmin: true, platformAdminId: 1,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

afterEach(() => { vi.restoreAllMocks(); });

describe("permissões dos avisos da plataforma", () => {
  it("só o administrador geral cria, edita, pausa e exclui", async () => {
    const created = { id: 11, title: "Teste", roles: ["promoter"], audienceScope: "selected", companyIds: [60001] };
    vi.spyOn(announcements, "createAnnouncement").mockResolvedValue(created as any);
    vi.spyOn(announcements, "updateAnnouncement").mockResolvedValue(created as any);
    vi.spyOn(announcements, "setAnnouncementActive").mockResolvedValue(created as any);
    vi.spyOn(announcements, "getAnnouncement").mockResolvedValue(created as any);
    vi.spyOn(announcements, "deleteAnnouncement").mockResolvedValue({ success: true });
    vi.spyOn(announcements, "listAnnouncements").mockResolvedValue([created] as any);

    const payload = {
      title: "Teste",
      body: "Olá",
      tone: "info" as const,
      audienceScope: "selected" as const,
      companyIds: [60001],
      roles: ["promoter" as const],
      dismissable: true,
    };

    await expect(companyCaller("company_admin").announcements.create(payload)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(companyCaller("supervisor").announcements.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(companyCaller("promoter").announcements.delete({ id: 11 })).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(platformCaller().announcements.create(payload)).resolves.toEqual(expect.objectContaining({ id: 11 }));
    await expect(platformCaller().announcements.list()).resolves.toEqual([expect.objectContaining({ id: 11 })]);
    expect(announcements.createAnnouncement).toHaveBeenCalled();
  });

  it("cada usuário só recebe os avisos da empresa e da função dele", async () => {
    const visible = [{ id: 11, title: "Só promotor IvanMH", body: "Pix de teste", tone: "info", dismissable: true }];
    const spy = vi.spyOn(announcements, "listVisibleAnnouncementsFor").mockImplementation(async (input) => {
      if (input.companyId === 60001 && input.role === "promoter") return visible as any;
      return [];
    });

    await expect(companyCaller("promoter", 60001).announcements.mine()).resolves.toEqual(visible);
    await expect(companyCaller("company_admin", 60001, 1).announcements.mine()).resolves.toEqual([]);
    await expect(companyCaller("promoter", 90002, 99).announcements.mine()).resolves.toEqual([]);
    await expect(platformCaller().announcements.mine()).resolves.toEqual([]);
    expect(spy).toHaveBeenCalled();
  });
});
