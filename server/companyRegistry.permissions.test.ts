import { describe, expect, it } from "vitest";
import { changeMyEmailInput, memberRegistryInput, PROMOTER_FORBIDDEN_REGISTRY_KEYS } from "./companyRegistry";
import { canEditMemberRegistry, canEditOwnRegistry } from "../shared/registryPermissions";

describe("rotas de cadastro e o promotor", () => {
  it("a troca de e-mail do próprio usuário só aceita e-mail e senha atual", () => {
    const keys = Object.keys((changeMyEmailInput as any).shape);
    expect(keys.sort()).toEqual(["currentPassword", "email"]);
    for (const field of PROMOTER_FORBIDDEN_REGISTRY_KEYS) {
      expect(keys).not.toContain(field);
    }
  });

  it("os dados cadastrais (CPF, PIS, RG etc.) existem só no formulário de identidade, não na troca de e-mail", () => {
    const identity = memberRegistryInput.safeParse({
      cpf: "529.982.247-25",
      pis: "17033259504",
      rg: "1234567",
      birthDate: "1990-01-15",
      jobTitle: "Promotor",
      admissionDate: "2024-02-01",
      phone: "11999999999",
    });
    expect(identity.success).toBe(true);
    const sneaked = changeMyEmailInput.safeParse({
      email: "promotor@example.com",
      currentPassword: "senha-atual-valida",
      cpf: "529.982.247-25",
      pis: "17033259504",
    });
    // Zod por padrão descarta chaves desconhecidas; o endpoint não processa CPF/PIS.
    expect(sneaked.success).toBe(true);
    if (sneaked.success) {
      expect(sneaked.data).toEqual({ email: "promotor@example.com", currentPassword: "senha-atual-valida" });
      expect(sneaked.data).not.toHaveProperty("cpf");
      expect(sneaked.data).not.toHaveProperty("pis");
    }
  });

  it("o promotor não edita cadastro próprio nem de ninguém; admin e supervisor editan conforme a regra atual", () => {
    expect(canEditOwnRegistry("promoter")).toBe(false);
    expect(canEditMemberRegistry("promoter", "promoter")).toBe(false);
    expect(canEditMemberRegistry("company_admin", "promoter")).toBe(true);
    expect(canEditMemberRegistry("supervisor", "promoter")).toBe(true);
    expect(canEditMemberRegistry("supervisor", "company_admin")).toBe(false);
    expect(canEditMemberRegistry("supervisor", "supervisor")).toBe(false);
  });
});
