import { describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { assertPermanentPurgeRole, purgeBlockedByTimeClock, purgeCompanyPermanently, purgeLegalWarning } from "./platformCompanies";

const company = { id: 1, name: "Empresa Teste", taxDocument: "12345678000190" };

describe("guarda da exclusão permanente de empresa", () => {
  it("não bloqueia mais só porque há marcações (a cópia final passa a ser obrigatória)", () => {
    expect(purgeBlockedByTimeClock(0)).toBeNull();
    expect(purgeBlockedByTimeClock(12)).toBeNull();
  });

  it("o aviso legal descreve o prazo de cerca de 5 anos e a cópia obrigatória", () => {
    expect(purgeLegalWarning(3)).toMatch(/3 marcações de ponto/);
    expect(purgeLegalWarning(3)).toMatch(/5 anos/);
    expect(purgeLegalWarning(3)).toMatch(/Se a cópia falhar, nada é apagado/);
  });
});

describe("permissão da exclusão permanente", () => {
  it("recusa qualquer papel que não seja platform_admin", () => {
    for (const role of ["company_admin", "supervisor", "promoter", "", undefined]) {
      try {
        assertPermanentPurgeRole(role as any);
        throw new Error(`deveria recusar ${role}`);
      } catch (e) {
        expect(e).toBeInstanceOf(TRPCError);
        expect((e as TRPCError).code).toBe("FORBIDDEN");
        expect((e as TRPCError).message).toMatch(/administrador da plataforma/);
      }
    }
  });

  it("aceita o administrador da plataforma", () => {
    expect(() => assertPermanentPurgeRole("platform_admin")).not.toThrow();
  });
});

describe("exclusão permanente só depois da cópia", () => {
  const baseDeps = {
    getCompany: async () => company,
    deleteMedia: vi.fn(async () => 0),
    runCascade: vi.fn(async () => ({ companies: 1 })),
  };

  it("recusa quem não é administrador da plataforma, sem gerar cópia nem apagar", async () => {
    const createBackup = vi.fn();
    await expect(purgeCompanyPermanently(1, "Empresa Teste", "company_admin", { ...baseDeps, createBackup })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(createBackup).not.toHaveBeenCalled();
    expect(baseDeps.runCascade).not.toHaveBeenCalled();
  });

  it("recusa confirmação que não é o nome nem o CNPJ", async () => {
    const createBackup = vi.fn();
    await expect(purgeCompanyPermanently(1, "Outro Nome", "platform_admin", { ...baseDeps, createBackup })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(createBackup).not.toHaveBeenCalled();
    expect(baseDeps.runCascade).not.toHaveBeenCalled();
  });

  it("não apaga nada se a cópia de segurança falhar", async () => {
    const deleteMedia = vi.fn(async () => 0);
    const runCascade = vi.fn(async () => ({ companies: 1 }));
    await expect(purgeCompanyPermanently(1, "Empresa Teste", "platform_admin", {
      getCompany: async () => company,
      createBackup: async () => { throw new Error("R2 indisponível"); },
      deleteMedia,
      runCascade,
    })).rejects.toMatchObject({ message: expect.stringMatching(/não foi excluída/i) });
    expect(deleteMedia).not.toHaveBeenCalled();
    expect(runCascade).not.toHaveBeenCalled();
  });

  it("apaga depois de guardar a cópia no prefixo de retenção, com confirmação por CNPJ", async () => {
    const runCascade = vi.fn(async () => ({ companies: 1, time_events: 4 }));
    const result = await purgeCompanyPermanently(1, "12.345.678/0001-90", "platform_admin", {
      getCompany: async () => company,
      createBackup: async () => ({
        key: "retention/company-delete/1/20261117T120000Z/copia-final.zip",
        url: "https://example.test/copia-final.zip",
        fileName: "copia-final.zip",
      }),
      deleteMedia: async () => 2,
      runCascade,
    });
    expect(runCascade).toHaveBeenCalledTimes(1);
    expect(result.filesDeleted).toBe(2);
    expect(result.deleted.time_events).toBe(4);
    expect(result.backup.key).toMatch(/^retention\/company-delete\/1\//);
  });
});
