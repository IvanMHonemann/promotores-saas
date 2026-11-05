import { describe, expect, it } from "vitest";
import { buildWhatsAppMessage, buildWhatsAppUrl, contactWhatsAppNumber, formatPhone, normalizeAnswer, questionText, CONTACT_STEPS, validateContactField } from "../client/src/lib/contactChat";

describe("formulário de contato (chat)", () => {
  it("valida nome, empresa, telefone, promotores e mensagem", () => {
    expect(validateContactField("motivo", "")).toBeTruthy();
    expect(validateContactField("motivo", "Parceria comercial")).toBeNull();
    expect(validateContactField("nome", "a")).toBeTruthy();
    expect(validateContactField("nome", "123")).toBeTruthy();
    expect(validateContactField("nome", "Ivan")).toBeNull();
    expect(validateContactField("empresa", " ")).toBeTruthy();
    expect(validateContactField("telefone", "9999-9999")).toBeTruthy();
    expect(validateContactField("telefone", "(51) 99166-7804")).toBeNull();
    expect(validateContactField("telefone", "+55 51 99166-7804")).toBeNull();
    expect(validateContactField("telefone", "(01) 99166-7804")).toBeTruthy();
    expect(validateContactField("promotores", "abc")).toBeTruthy();
    expect(validateContactField("promotores", "0")).toBeTruthy();
    expect(validateContactField("promotores", "12")).toBeNull();
    expect(validateContactField("mensagem", "")).toBeNull();
    expect(validateContactField("mensagem", "x".repeat(501))).toBeTruthy();
  });
  it("formata respostas", () => {
    expect(formatPhone("51991667804")).toBe("(51) 99166-7804");
    expect(formatPhone("5551991667804")).toBe("(51) 99166-7804");
    expect(normalizeAnswer("promotores", "012")).toBe("12");
    expect(CONTACT_STEPS[0].field).toBe("motivo");
    expect(CONTACT_STEPS[0].options).toEqual(["Solicitar demonstração", "Planos e preços", "Suporte", "Outro"]);
    expect(questionText(CONTACT_STEPS[2], { nome: "Ivan Honemann" })).toContain("Prazer, Ivan!");
  });
  it("monta o link do WhatsApp com a mensagem codificada", () => {
    const a = { motivo: "Planos e preços", nome: "Ivan", empresa: "IvanMH & Cia", telefone: "(51) 99166-7804", promotores: "12", mensagem: "Quero uma demo" };
    const msg = buildWhatsAppMessage(a);
    expect(msg.split("\n")[0]).toBe("*Motivo do contato:* Planos e preços");
    expect(msg).toContain("*Empresa:* IvanMH & Cia");
    expect(msg).toContain("*Mensagem:* Quero uma demo");
    expect(buildWhatsAppMessage({ ...a, mensagem: "" })).not.toContain("Mensagem");
    const url = buildWhatsAppUrl(a);
    expect(url.startsWith("https://wa.me/5551991667804?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(msg);
    expect(url).not.toContain("&C");
  });
  it("usa o número padrão ou o da variável VITE_CONTACT_WHATSAPP", () => {
    expect(contactWhatsAppNumber(undefined)).toBe("5551991667804");
    expect(contactWhatsAppNumber("+55 (11) 98888-7777")).toBe("5511988887777");
    expect(contactWhatsAppNumber("123")).toBe("5551991667804");
  });
});
