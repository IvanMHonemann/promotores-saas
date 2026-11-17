import { describe, expect, it } from "vitest";
import { shouldApplyPaymentLock } from "./paymentLock";

describe("shouldApplyPaymentLock", () => {
  it("trava o admin da empresa quando o acesso foi recusado", () => {
    expect(shouldApplyPaymentLock({ role: "company_admin", companyId: 90002, allowed: false })).toBe(true);
    expect(shouldApplyPaymentLock({ role: "promoter", companyId: 90002, allowed: false })).toBe(true);
    expect(shouldApplyPaymentLock({ role: "supervisor", companyId: 90002, allowed: false })).toBe(true);
  });

  it("não trava quem ainda está liberado", () => {
    expect(shouldApplyPaymentLock({ role: "company_admin", companyId: 90002, allowed: true })).toBe(false);
    expect(shouldApplyPaymentLock({ role: "company_admin", companyId: 90002 })).toBe(false);
  });

  it("o administrador geral nunca fica preso, mesmo personificando uma empresa bloqueada", () => {
    expect(shouldApplyPaymentLock({
      role: "company_admin",
      companyId: 90002,
      actingAs: true,
      allowed: false,
    })).toBe(false);
    expect(shouldApplyPaymentLock({ role: "platform_admin", companyId: 90002, allowed: false })).toBe(false);
  });
});
