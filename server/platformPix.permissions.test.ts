import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";

const NOW = new Date("2026-11-16T14:00:00.000Z");

function companyCaller(role: string) {
  return appRouter.createCaller({
    user: {
      id: -10, openId: "member:10", name: "Teste", email: "t@test.local",
      loginMethod: "password", role, companyId: 60001, createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW,
    } as any,
    accountId: 60001, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}

describe("Pix gerado pelo administrador geral", () => {
  const procedures = Object.keys((appRouter as any)._def.procedures);

  it("os endpoints ficam no router da plataforma, não no billing da empresa", () => {
    expect(procedures).toContain("platformCompanies.pixQuote");
    expect(procedures).toContain("platformCompanies.generatePix");
    expect((appRouter as any)._def.procedures["platformCompanies.pixQuote"]._def.type).toBe("query");
    expect((appRouter as any)._def.procedures["platformCompanies.generatePix"]._def.type).toBe("mutation");
    expect(procedures.filter((name) => name.startsWith("billing.") && /generatePix|pixQuote/i.test(name))).toEqual([]);
  });

  it("administrador da empresa, supervisor e promotor não consultam nem geram o Pix", async () => {
    for (const role of ["company_admin", "supervisor", "promoter"] as const) {
      await expect(companyCaller(role).platformCompanies.pixQuote({ companyId: 60001 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(companyCaller(role).platformCompanies.generatePix({ companyId: 60001, amount: "350.00" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });
});
