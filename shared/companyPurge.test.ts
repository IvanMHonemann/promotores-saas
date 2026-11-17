import { describe, expect, it } from "vitest";
import {
  applyCompanyCascade,
  canPermanentlyPurge,
  confirmMatchesCompany,
  isRetentionBackupKey,
  planCompanyCascade,
  purgeLegalWarning,
  retentionBackupKey,
  stripSensitiveFields,
} from "./companyPurge";

describe("confirmação da exclusão permanente", () => {
  const company = { name: "Isael Promoções", taxDocument: "12345678000190" };

  it("aceita o nome exato (com espaços nas pontas)", () => {
    expect(confirmMatchesCompany(company, "Isael Promoções")).toBe(true);
    expect(confirmMatchesCompany(company, "  Isael Promoções  ")).toBe(true);
  });

  it("aceita o CNPJ com ou sem pontuação", () => {
    expect(confirmMatchesCompany(company, "12345678000190")).toBe(true);
    expect(confirmMatchesCompany(company, "12.345.678/0001-90")).toBe(true);
  });

  it("recusa nome diferente, vazio ou CNPJ de outra empresa", () => {
    expect(confirmMatchesCompany(company, "")).toBe(false);
    expect(confirmMatchesCompany(company, "isael promoções")).toBe(false);
    expect(confirmMatchesCompany(company, "Isael")).toBe(false);
    expect(confirmMatchesCompany(company, "00000000000000")).toBe(false);
    expect(confirmMatchesCompany({ name: "Lisa", taxDocument: null }, "12345678000190")).toBe(false);
  });
});

describe("permissão", () => {
  it("só o platform_admin pode excluir permanentemente", () => {
    expect(canPermanentlyPurge("platform_admin")).toBe(true);
    expect(canPermanentlyPurge("company_admin")).toBe(false);
    expect(canPermanentlyPurge("supervisor")).toBe(false);
    expect(canPermanentlyPurge("promoter")).toBe(false);
    expect(canPermanentlyPurge(undefined)).toBe(false);
    expect(canPermanentlyPurge("")).toBe(false);
  });
});

describe("aviso legal", () => {
  it("cita o prazo de cerca de 5 anos e que a exclusão é irreversível", () => {
    const none = purgeLegalWarning(0);
    expect(none).toMatch(/não tem marcações/);
    expect(none).toMatch(/5 anos/);
    expect(none).toMatch(/irreversível/);
    expect(none).toMatch(/Se a cópia falhar, nada é apagado/);
    expect(purgeLegalWarning(1)).toMatch(/1 marcação de ponto/);
    expect(purgeLegalWarning(12)).toMatch(/12 marcações de ponto/);
  });
});

describe("chave de retenção", () => {
  it("monta prefixo retention/company-delete e valida a chave", () => {
    const key = retentionBackupKey(30001, "20261117T105000Z", "copia-final.zip");
    expect(key).toBe("retention/company-delete/30001/20261117T105000Z/copia-final.zip");
    expect(isRetentionBackupKey(key, 30001)).toBe(true);
    expect(isRetentionBackupKey(key, 60001)).toBe(false);
    expect(isRetentionBackupKey("store-photos/30001/foto.jpg", 30001)).toBe(false);
    expect(isRetentionBackupKey("backups/database/x.zip")).toBe(false);
    expect(isRetentionBackupKey("retention/company-delete/30001/../copia.zip")).toBe(false);
  });
});

describe("cascata em uma fixture", () => {
  it("apaga só a empresa alvo e preserva as outras; não inclui companies no meio do plano", () => {
    const columns = [
      { t: "time_events", c: "companyId" },
      { t: "member_accounts", c: "companyId" },
      { t: "payments", c: "companyId" },
      { t: "audit_logs", c: "companyId" },
      { t: "companies", c: "id" },
      { t: "evil;drop", c: "companyId" },
    ];
    const plan = planCompanyCascade(columns, [11, 12]);
    expect(plan.deleteSessions).toBe(true);
    expect(plan.tables.map((t) => t.table)).toEqual(["time_events", "member_accounts", "payments", "audit_logs"]);
    expect(plan.tables.some((t) => t.table === "companies")).toBe(false);
  });

  it("executa a cascata na fixture e deixa intacta a outra empresa", async () => {
    const db: Record<string, Array<Record<string, unknown>>> = {
      member_sessions: [
        { memberAccountId: 11, token: "a" },
        { memberAccountId: 22, token: "b" },
      ],
      time_events: [
        { id: 1, companyId: 1 },
        { id: 2, companyId: 2 },
      ],
      member_accounts: [
        { id: 11, companyId: 1 },
        { id: 22, companyId: 2 },
      ],
      payments: [{ id: 7, companyId: 1 }],
      audit_logs: [
        { id: 1, companyId: 1 },
        { id: 2, companyId: null },
      ],
      companies: [{ id: 1, name: "Alvo" }, { id: 2, name: "Outra" }],
    };

    const exec = {
      query: async (sql: string, params?: unknown[]) => {
        if (sql.startsWith("DELETE FROM member_sessions")) {
          const ids = new Set(params?.[0] as number[]);
          const before = db.member_sessions.length;
          db.member_sessions = db.member_sessions.filter((r) => !ids.has(Number(r.memberAccountId)));
          return { affectedRows: before - db.member_sessions.length };
        }
        const byCol = sql.match(/^DELETE FROM `(\w+)` WHERE `(\w+)` = \?$/);
        if (byCol) {
          const [, table, col] = byCol;
          const id = params?.[0];
          const before = db[table].length;
          db[table] = db[table].filter((r) => r[col] !== id);
          return { affectedRows: before - db[table].length };
        }
        if (sql === "DELETE FROM companies WHERE id = ?") {
          const id = params?.[0];
          const before = db.companies.length;
          db.companies = db.companies.filter((r) => r.id !== id);
          return { affectedRows: before - db.companies.length };
        }
        throw new Error(`sql inesperado: ${sql}`);
      },
    };

    const deleted = await applyCompanyCascade(
      exec,
      1,
      [
        { t: "time_events", c: "companyId" },
        { t: "member_accounts", c: "companyId" },
        { t: "payments", c: "companyId" },
        { t: "audit_logs", c: "companyId" },
      ],
      [11],
    );

    expect(deleted.member_sessions).toBe(1);
    expect(deleted.time_events).toBe(1);
    expect(deleted.member_accounts).toBe(1);
    expect(deleted.payments).toBe(1);
    expect(deleted.audit_logs).toBe(1);
    expect(deleted.companies).toBe(1);
    expect(db.companies).toEqual([{ id: 2, name: "Outra" }]);
    expect(db.time_events).toEqual([{ id: 2, companyId: 2 }]);
    expect(db.member_accounts).toEqual([{ id: 22, companyId: 2 }]);
    expect(db.member_sessions).toEqual([{ memberAccountId: 22, token: "b" }]);
    expect(db.audit_logs).toEqual([{ id: 2, companyId: null }]);
  });

  it("não envia senha ou token na cópia", () => {
    const clean = stripSensitiveFields({
      id: 1,
      userName: "Ana",
      passwordHash: "secret",
      recoveryCodeHash: "x",
      recordHash: "deve-permanecer",
    });
    expect(clean).toEqual({ id: 1, userName: "Ana", recordHash: "deve-permanecer" });
  });
});
