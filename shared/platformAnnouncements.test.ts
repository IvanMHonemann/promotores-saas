import { describe, expect, it } from "vitest";
import {
  announcementAdminStatus,
  announcementExcerpt,
  announcementSenderLabel,
  announcementVisibleTo,
  canManageCompanyAnnouncement,
  filterAnnouncementsForViewer,
  isHttpUrl,
  parseCompanyAnnouncementRoles,
  parseAnnouncementRoles,
  serializeAnnouncementRoles,
  splitMessageLinks,
} from "./platformAnnouncements";

const base = {
  id: 1,
  active: true,
  startsAt: null as string | null,
  endsAt: null as string | null,
  audienceScope: "selected" as const,
  companyIds: [60001],
  roles: ["promoter"],
};

describe("visibilidade dos avisos", () => {
  const today = "2026-11-15";

  it("o promotor da empresa escolhida vê o aviso; o admin da mesma empresa não vê", () => {
    expect(announcementVisibleTo(base, { companyId: 60001, role: "promoter", todayIso: today })).toBe(true);
    expect(announcementVisibleTo(base, { companyId: 60001, role: "company_admin", todayIso: today })).toBe(false);
    expect(announcementVisibleTo(base, { companyId: 60001, role: "supervisor", todayIso: today })).toBe(false);
  });

  it("outra empresa não vê, mesmo com a mesma função", () => {
    expect(announcementVisibleTo(base, { companyId: 90002, role: "promoter", todayIso: today })).toBe(false);
    expect(announcementVisibleTo({ ...base, audienceScope: "all", companyIds: [] }, { companyId: 90002, role: "promoter", todayIso: today })).toBe(true);
  });

  it("respeita período, pausa e dispensa", () => {
    const viewer = { companyId: 60001, role: "promoter", todayIso: today };
    expect(announcementVisibleTo({ ...base, startsAt: "2026-11-16" }, viewer)).toBe(false);
    expect(announcementVisibleTo({ ...base, endsAt: "2026-11-14" }, viewer)).toBe(false);
    expect(announcementVisibleTo({ ...base, startsAt: "2026-11-15", endsAt: "2026-11-15" }, viewer)).toBe(true);
    expect(announcementVisibleTo({ ...base, active: false }, viewer)).toBe(false);
    expect(announcementVisibleTo(base, { ...viewer, dismissedIds: [1] })).toBe(false);
    expect(announcementAdminStatus({ ...base, startsAt: "2026-11-20" }, today)).toBe("scheduled");
    expect(announcementAdminStatus({ ...base, endsAt: "2026-11-10" }, today)).toBe("ended");
    expect(announcementAdminStatus({ ...base, active: 0 }, today)).toBe("paused");
  });

  it("ordena urgente na frente e oculta o que não se aplica", () => {
    const items = [
      { ...base, id: 2, tone: "info" },
      { ...base, id: 3, tone: "urgent" },
      { ...base, id: 4, tone: "warning", roles: ["company_admin"] },
    ];
    const visible = filterAnnouncementsForViewer(items, { companyId: 60001, role: "promoter", todayIso: today });
    expect(visible.map((item) => item.id)).toEqual([3, 2]);
  });
});

describe("funções, links e resumo", () => {
  it("serializa funções e rejeita lista vazia", () => {
    expect(parseAnnouncementRoles("promoter,company_admin,promoter")).toEqual(["company_admin", "promoter"]);
    expect(serializeAnnouncementRoles(["promoter", "supervisor"])).toBe("supervisor,promoter");
    expect(() => serializeAnnouncementRoles(["x"])).toThrow(/função/);
  });

  it("só aceita links http(s) e os torna clicáveis, preservando quebras de linha", () => {
    expect(isHttpUrl("https://gondup.com/pix")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    const parts = splitMessageLinks("Pague aqui:\nhttps://gondup.com/pix, obrigado.");
    expect(parts).toEqual([
      { type: "text", value: "Pague aqui:\n" },
      { type: "link", value: "https://gondup.com/pix", href: "https://gondup.com/pix" },
      { type: "text", value: ", obrigado." },
    ]);
    expect(announcementExcerpt("Linha 1\nLinha 2", 20)).toBe("Linha 1 Linha 2");
  });
});

describe("avisos da empresa", () => {
  const today = "2026-11-16";
  const company = {
    id: 20,
    active: true,
    startsAt: null as string | null,
    endsAt: null as string | null,
    audienceScope: "all" as const,
    companyIds: [],
    roles: ["promoter", "supervisor"],
    source: "company" as const,
    companyId: 60001,
    targetMode: "roles" as const,
    memberIds: [] as number[],
    createdByMemberAccountId: 2,
  };

  it("vai só para promotor e supervisor da própria empresa, nunca para o admin", () => {
    expect(announcementVisibleTo(company, { companyId: 60001, role: "promoter", todayIso: today, memberAccountId: 10 })).toBe(true);
    expect(announcementVisibleTo(company, { companyId: 60001, role: "supervisor", todayIso: today, memberAccountId: 3 })).toBe(true);
    expect(announcementVisibleTo(company, { companyId: 60001, role: "company_admin", todayIso: today, memberAccountId: 1 })).toBe(false);
    expect(announcementVisibleTo(company, { companyId: 90002, role: "promoter", todayIso: today, memberAccountId: 99 })).toBe(false);
  });

  it("o supervisor não recebe o aviso que ele mesmo criou", () => {
    expect(announcementVisibleTo(company, { companyId: 60001, role: "supervisor", todayIso: today, memberAccountId: 2 })).toBe(false);
  });

  it("pessoas específicas: só o membro escolhido da empresa vê", () => {
    const targeted = { ...company, targetMode: "members" as const, memberIds: [10], roles: [] };
    expect(announcementVisibleTo(targeted, { companyId: 60001, role: "promoter", todayIso: today, memberAccountId: 10 })).toBe(true);
    expect(announcementVisibleTo(targeted, { companyId: 60001, role: "promoter", todayIso: today, memberAccountId: 11 })).toBe(false);
    expect(announcementVisibleTo(targeted, { companyId: 60001, role: "supervisor", todayIso: today, memberAccountId: 3 })).toBe(false);
  });

  it("o admin da empresa edita todos; o supervisor só os que criou; isolado por empresa", () => {
    expect(canManageCompanyAnnouncement({ role: "company_admin", companyId: 60001, memberAccountId: 1 }, company)).toBe(true);
    expect(canManageCompanyAnnouncement({ role: "supervisor", companyId: 60001, memberAccountId: 2 }, company)).toBe(true);
    expect(canManageCompanyAnnouncement({ role: "supervisor", companyId: 60001, memberAccountId: 3 }, company)).toBe(false);
    expect(canManageCompanyAnnouncement({ role: "company_admin", companyId: 90002, memberAccountId: 1 }, company)).toBe(false);
    expect(canManageCompanyAnnouncement({ role: "promoter", companyId: 60001, memberAccountId: 10 }, company)).toBe(false);
    expect(canManageCompanyAnnouncement({ role: "company_admin", companyId: 60001, memberAccountId: 1 }, { source: "platform", companyId: 60001 })).toBe(false);
  });

  it("monta o rótulo de quem enviou e restringe as funções da empresa", () => {
    expect(announcementSenderLabel({ source: "company", authorName: "Ivan", companyName: "IvanMH" })).toBe("Aviso de Ivan (IvanMH)");
    expect(announcementSenderLabel({ source: "platform" })).toBe("Aviso da GondUp");
    expect(parseCompanyAnnouncementRoles(["company_admin", "promoter", "supervisor"])).toEqual(["supervisor", "promoter"]);
  });
});
