import { describe, expect, it } from "vitest";
import { companyRegistryComplete, companyRegistryMissing, emptyCompanyRegistry, formatCompanyAddress, toLegalSnapshot } from "./registryFields";
import { canEditCompanyFiscal, canEditMemberRegistry, canEditOwnRegistry, memberRegistryDeniedMessage } from "./registryPermissions";

describe("completude e endereço da empresa", () => {
  it("considera incompleto sem razão social, documento ou endereço, e completa quando esses três existem", () => {
    const empty = emptyCompanyRegistry();
    expect(companyRegistryComplete(empty)).toBe(false);
    expect(companyRegistryMissing(empty)).toEqual(["Razão social", "CNPJ ou CPF", "Endereço"]);
    const filled = {
      ...empty,
      legalName: "Empresa Exemplo LTDA",
      taxDocument: "11222333000181",
      addressStreet: "Rua das Flores",
      addressNumber: "100",
      addressCity: "Sapiranga",
      addressState: "RS",
      addressZip: "93216000",
    };
    expect(companyRegistryComplete(filled)).toBe(true);
    expect(formatCompanyAddress(filled)).toContain("Rua das Flores, 100");
    expect(formatCompanyAddress(filled)).toContain("Sapiranga/RS");
    expect(formatCompanyAddress(filled)).toContain("93216-000");
    const legal = toLegalSnapshot(filled, "Apelido");
    expect(legal.legalName).toBe("Empresa Exemplo LTDA");
    expect(legal.document).toBe("11.222.333/0001-81");
  });
});

describe("permissões de dados cadastrais", () => {
  it("só o administrador da empresa (ou o geral) edita os dados fiscais", () => {
    expect(canEditCompanyFiscal("company_admin")).toBe(true);
    expect(canEditCompanyFiscal("platform_admin")).toBe(true);
    expect(canEditCompanyFiscal("supervisor")).toBe(false);
    expect(canEditCompanyFiscal("promoter")).toBe(false);
  });

  it("admin altera qualquer integrante; supervisor só promotores; promotor não altera cadastro", () => {
    expect(canEditMemberRegistry("company_admin", "promoter")).toBe(true);
    expect(canEditMemberRegistry("company_admin", "supervisor")).toBe(true);
    expect(canEditMemberRegistry("company_admin", "company_admin")).toBe(true);
    expect(canEditMemberRegistry("supervisor", "promoter")).toBe(true);
    expect(canEditMemberRegistry("supervisor", "company_admin")).toBe(false);
    expect(canEditMemberRegistry("supervisor", "supervisor")).toBe(false);
    expect(canEditMemberRegistry("promoter", "promoter")).toBe(false);
    expect(canEditMemberRegistry("promoter", "company_admin")).toBe(false);
    expect(memberRegistryDeniedMessage("promoter")).toMatch(/administrador da empresa/);
  });
});

  it("promotor não edita o próprio cadastro; admin e supervisor sim", () => {
    expect(canEditOwnRegistry("promoter")).toBe(false);
    expect(canEditOwnRegistry("company_admin")).toBe(true);
    expect(canEditOwnRegistry("supervisor")).toBe(true);
  });
