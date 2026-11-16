import { describe, expect, it } from "vitest";
import {
  announcementAdminStatus,
  announcementExcerpt,
  announcementVisibleTo,
  filterAnnouncementsForViewer,
  isHttpUrl,
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
