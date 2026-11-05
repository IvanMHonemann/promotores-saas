import { afterEach, describe, expect, it } from "vitest";
import { MIN_TIME_AUDIT_RETENTION_DAYS, timeAuditRetentionDays } from "../scheduledMaintenance";

describe("retenção da auditoria do ponto", () => {
  afterEach(() => { delete process.env.AUDIT_RETENTION_TIME_DAYS; });
  it("por padrão nunca apaga a auditoria do ponto", () => {
    expect(timeAuditRetentionDays()).toBeNull();
  });
  it("valor configurado nunca fica abaixo de 7 anos", () => {
    process.env.AUDIT_RETENTION_TIME_DAYS = "100";
    expect(timeAuditRetentionDays()).toBe(MIN_TIME_AUDIT_RETENTION_DAYS);
    process.env.AUDIT_RETENTION_TIME_DAYS = "4000";
    expect(timeAuditRetentionDays()).toBe(4000);
  });
});
