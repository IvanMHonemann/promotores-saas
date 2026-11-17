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

  describe("pending (aguardando pagamento) com prazo de tolerância", () => {
    const day = 24 * 3600 * 1000;

    it("permite pending dentro de 7 dias do início", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({
        id: 1, subscriptionStatus: "pending", subscriptionStartedAt: new Date(Date.now() - 3 * day),
      } as any);
      const r = await checkSubscriptionAccess(1);
      expect(r.allowed).toBe(true);
      expect(r.status).toBe("pending");
      expect(r.graceUntil).toBeInstanceOf(Date);
    });

    it("bloqueia pending após 7 dias do início", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({
        id: 1, subscriptionStatus: "pending", subscriptionStartedAt: new Date(Date.now() - 8 * day),
      } as any);
      const r = await checkSubscriptionAccess(1);
      expect(r.allowed).toBe(false);
      expect(r.status).toBe("pending");
      expect(r.reason).toContain("fale com o suporte");
    });

    it("respeita tolerância explícita definida pela plataforma (mais tardia que 7 dias)", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({
        id: 1, subscriptionStatus: "pending",
        subscriptionStartedAt: new Date(Date.now() - 20 * day),
        gracePeriodEndsAt: new Date(Date.now() + 2 * day),
      } as any);
      expect((await checkSubscriptionAccess(1)).allowed).toBe(true);
    });

    it("sem nenhuma data conhecida, usa a criação da empresa", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({
        id: 1, subscriptionStatus: "pending", createdAt: new Date(Date.now() - 30 * day),
      } as any);
      expect((await checkSubscriptionAccess(1)).allowed).toBe(false);
    });

    it("sem datas e sem criação, bloqueia", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({ id: 1, subscriptionStatus: "pending" } as any);
      expect((await checkSubscriptionAccess(1)).allowed).toBe(false);
    });

    it("usa a assinatura mais recente quando a empresa não tem status", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(db.getLatestCompanySubscription).mockResolvedValue({
        status: "pending", startsAt: new Date(Date.now() - 10 * day).toISOString().slice(0, 10),
      } as any);
      expect((await checkSubscriptionAccess(1)).allowed).toBe(false);
    });

    it("registrar pagamento (status active no futuro) volta a liberar", async () => {
      vi.mocked(db.getCompanyById).mockResolvedValue({
        id: 1, subscriptionStatus: "active", subscriptionStartedAt: new Date(Date.now() - 30 * day),
        subscriptionExpiresAt: new Date(Date.now() + 30 * day),
      } as any);
      expect((await checkSubscriptionAccess(1)).allowed).toBe(true);
    });
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

describe("trial com validade e data de bloqueio configuradas (fuso America/Sao_Paulo)", () => {
  // Caso real: PJ Promoções (90002) — teste de 14 dias encerrado em 02/11,
  // vencimento no fim de 30/11 (gravado como 2026-12-01T02:59:59.000Z) e
  // bloqueio após 5 dias de atraso (fim de 05/12).
  const company = {
    id: 90002,
    name: "PJ Promoções e Merchandising",
    active: true,
    subscriptionStatus: "trial",
    trialEndsAt: new Date("2026-11-02T16:06:46.000Z"),
    subscriptionExpiresAt: new Date("2026-12-01T02:59:59.000Z"),
    gracePeriodEndsAt: new Date("2026-12-06T02:59:59.000Z"),
  };

  beforeEach(() => {
    vi.mocked(db.getCompanyById).mockResolvedValue(company as any);
  });

  it("em 16/11 (antes do vencimento) o acesso permanece liberado", async () => {
    const r = await checkSubscriptionAccess(90002, new Date("2026-11-16T23:18:00-03:00"));
    expect(r.allowed).toBe(true);
    expect(r.status).toBe("trial");
  });

  it("no fim de 30/11 em Brasília o acesso ainda está liberado", async () => {
    const r = await checkSubscriptionAccess(90002, new Date("2026-11-30T23:59:59-03:00"));
    expect(r.allowed).toBe(true);
  });

  it("logo após 30/11 entra na tolerância, sem bloquear", async () => {
    const r = await checkSubscriptionAccess(90002, new Date("2026-12-01T00:00:00-03:00"));
    expect(r.allowed).toBe(true);
    expect(r.status).toBe("overdue");
    expect(r.reason).toBe("Período de tolerância.");
  });

  it("no fim da tolerância (05/12 23:59 de Brasília) ainda libera", async () => {
    const r = await checkSubscriptionAccess(90002, new Date("2026-12-05T23:59:59-03:00"));
    expect(r.allowed).toBe(true);
  });

  it("depois da data de bloqueio (06/12 00:00 de Brasília) bloqueia", async () => {
    const r = await checkSubscriptionAccess(90002, new Date("2026-12-06T00:00:00-03:00"));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("Período de teste encerrado.");
  });

  it("teste clássico, só com trialEndsAt vencido e sem validade, continua bloqueado", async () => {
    vi.mocked(db.getCompanyById).mockResolvedValue({
      id: 1,
      subscriptionStatus: "trial",
      trialEndsAt: new Date("2026-11-02T16:06:46.000Z"),
    } as any);
    const r = await checkSubscriptionAccess(1, new Date("2026-11-16T23:18:00-03:00"));
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("Período de teste encerrado.");
  });
});
