import { describe, expect, it } from "vitest";
import {
  formatCep,
  formatCnpj,
  formatCpf,
  formatCpfOrCnpj,
  formatPis,
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidCpfOrCnpj,
  isValidPis,
} from "./brDocs";

describe("CPF e CNPJ", () => {
  it("aceita CPF e CNPJ válidos, com ou sem máscara, e recusa dígito errado ou repetido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("11111111111")).toBe(false);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCpfOrCnpj("52998224725")).toBe(true);
    expect(isValidCpfOrCnpj("11222333000181")).toBe(true);
    expect(isValidCpfOrCnpj("")).toBe(false);
  });

  it("formata máscaras", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCpfOrCnpj("52998224725")).toBe("529.982.247-25");
    expect(formatCpfOrCnpj("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatCep("93216000")).toBe("93216-000");
    expect(isValidCep("93216-000")).toBe(true);
    expect(isValidCep("123")).toBe(false);
  });

  it("valida PIS quando preenchido", () => {
    expect(isValidPis("17033259504")).toBe(true);
    expect(isValidPis("170.33259.50-4")).toBe(true);
    expect(isValidPis("11111111111")).toBe(false);
    expect(isValidPis("17033259505")).toBe(false);
    expect(formatPis("17033259504")).toBe("170.33259.50-4");
  });
});
