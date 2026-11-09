import { afterEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { PLAN_FEATURES } from "../shared/entitlements";
import { buildMirror, type LaborProfile } from "../shared/timesheetMirror";
import { closedPeriodBalance, filterAndSortTeamBank, formatSignedMinutes, monthBounds, teamBankCsv } from "../shared/timeBank";

const labor: LaborProfile = { dailyMinutes: 480, workdays: [1, 2, 3, 4, 5] } as any;
const ev = (id: number, type: string, iso: string) => ({ id, type, time: iso, receivedAt: iso, synced: true, notes: "" }) as any;

describe("closedPeriodBalance (mesma regra do promotor e do administrador)", () => {
  it("soma créditos e débitos dos dias fechados e ignora a jornada aberta de hoje", () => {
    const events = [
      // seg 09/11: 9h (crédito 1h)
      ev(1, "clock_in", "2026-11-09T11:00:00Z"), ev(2, "clock_out", "2026-11-09T20:00:00Z"),
      // ter 10/11: 7h (débito 1h)
      ev(3, "clock_in", "2026-11-10T11:00:00Z"), ev(4, "clock_out", "2026-11-10T18:00:00Z"),
      // qua 11/11 (hoje): aberta
      ev(5, "clock_in", "2026-11-11T11:00:00Z"),
    ];
    const report = buildMirror({ events, from: "2026-11-01", to: "2026-11-30", timeZone: "America/Sao_Paulo", labor });
    const b = closedPeriodBalance(report, labor, "2026-11-11");
    expect(b.configured).toBe(true);
    expect(b.openShift).toBe(true);
    expect(b.overtimeMinutes).toBe(60);
    expect(b.deficitMinutes).toBe(60);
    expect(b.balanceMinutes).toBe(0);
  });

  it("sem jornada configurada não há previsto, crédito nem débito", () => {
    const report = buildMirror({ events: [ev(1, "clock_in", "2026-11-09T11:00:00Z"), ev(2, "clock_out", "2026-11-09T20:00:00Z")], from: "2026-11-01", to: "2026-11-30", timeZone: "America/Sao_Paulo", labor: null });
    expect(closedPeriodBalance(report, null, "2026-11-10")).toMatchObject({ configured: false, balanceMinutes: 0, overtimeMinutes: 0, deficitMinutes: 0, workedMinutes: 540 });
  });
});

describe("helpers do banco de horas da equipe", () => {
  it("mês, formatação, busca e ordenação", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(formatSignedMinutes(-95)).toBe("-01:35");
    expect(formatSignedMinutes(61)).toBe("+01:01");
    const rows = [{ name: "João", balanceMinutes: -30 }, { name: "Ana", balanceMinutes: 120 }, { name: "Bea", balanceMinutes: 0 }];
    expect(filterAndSortTeamBank(rows, "", "balance_desc").map((r) => r.name)).toEqual(["Ana", "Bea", "João"]);
    expect(filterAndSortTeamBank(rows, "", "balance_asc").map((r) => r.name)).toEqual(["João", "Bea", "Ana"]);
    expect(filterAndSortTeamBank(rows, "joao", "name").map((r) => r.name)).toEqual(["João"]);
  });

  it("CSV com cabeçalho e saldo com sinal", () => {
    const csv = teamBankCsv([{ id: 1, name: "Ana; Silva", active: true, employeeCode: null, lastEventAt: null, daysTracked: 2, workedMinutes: 900, expectedMinutes: 960, balanceMinutes: -60, overtimeMinutes: 0, deficitMinutes: 60, openShift: false, configured: true }], "2026-11");
    expect(csv.startsWith("\uFEFFFuncionário;")).toBe(true);
    expect(csv).toContain('"Ana; Silva";;2026-11;2;15:00;16:00;00:00;01:00;-01:00;;sim');
  });
});

function caller(role: string) {
  const now = new Date();
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "U", email: "u@test.local", loginMethod: "password", role, companyId: 1, createdAt: now, updatedAt: now, lastSignedIn: now } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

describe("autorização do banco de horas da equipe", () => {
  afterEach(() => vi.restoreAllMocks());
  const plan = () => {
    vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 3, name: "Empresarial", featureKeys: [...PLAN_FEATURES.empresarial] } } as any);
    vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
    vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
  };

  it("promotor não acessa a lista nem o detalhe da equipe", async () => {
    plan();
    await expect(caller("promoter").timesheetMirror.teamTimeBank({ month: "2026-11" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller("promoter").timesheetMirror.memberTimeBank({ memberId: 99, month: "2026-11" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("administrador não vê funcionário de outra empresa (consulta sempre filtrada pela empresa da sessão)", async () => {
    plan();
    const where = vi.fn();
    const chain: any = { from: () => chain, leftJoin: () => chain, where: (w: any) => { where(w); return Promise.resolve([]); } };
    vi.spyOn(db, "getDb").mockResolvedValue({ select: () => chain } as any);
    await expect(caller("company_admin").timesheetMirror.memberTimeBank({ memberId: 99, month: "2026-11" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(where).toHaveBeenCalledOnce();
  });
});
