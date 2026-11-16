import { describe, expect, it } from "vitest";
import {
  cartaoPontoHref,
  formatMissingPunchDay,
  missingPunchNotifyMessage,
  missingPunchStaffLabel,
  missingPunchWhatsAppUrl,
  normalizeWhatsAppPhone,
} from "./missingPunchNotify";

describe("aviso de falta de batida — notificar promotor", () => {
  it("usa o plural certo", () => {
    expect(missingPunchStaffLabel(1)).toBe("1 funcionário");
    expect(missingPunchStaffLabel(2)).toBe("2 funcionários");
    expect(missingPunchStaffLabel(8)).toBe("8 funcionários");
  });

  it("normaliza o telefone com DDI 55 e rejeita número vazio", () => {
    expect(normalizeWhatsAppPhone("(51) 99916-7804")).toBe("5551999167804");
    expect(normalizeWhatsAppPhone("51999167804")).toBe("5551999167804");
    expect(normalizeWhatsAppPhone("5551999167804")).toBe("5551999167804");
    expect(normalizeWhatsAppPhone("051999167804")).toBe("5551999167804");
    expect(normalizeWhatsAppPhone("5133334444")).toBe("555133334444");
    expect(normalizeWhatsAppPhone("")).toBeNull();
    expect(normalizeWhatsAppPhone(null)).toBeNull();
    expect(normalizeWhatsAppPhone("123")).toBeNull();
  });

  it("monta a mensagem pronta com nome, data e batidas que faltam", () => {
    const text = missingPunchNotifyMessage({
      name: "Testador",
      day: "2026-11-13",
      missing: "Saída",
      lastLabel: "Retorno do intervalo",
      lastTime: "2026-11-13T19:42:00.000Z",
    });
    expect(text).toBe(
      "Olá, Testador! Consta falta de batida em 13/11/2026: Saída (última marcação: Retorno do intervalo às 16:42). Por favor, regularize ou solicite a correção no GondUp.",
    );
    expect(formatMissingPunchDay("2026-11-13")).toBe("13/11/2026");
  });

  it("abre o WhatsApp no wa.me ou fica sem link quando não há telefone", () => {
    const text = missingPunchNotifyMessage({
      name: "Testador",
      day: "2026-11-13",
      missing: "Saída",
      lastLabel: "Retorno do intervalo",
      lastTime: "2026-11-13T19:42:00.000Z",
    });
    const url = missingPunchWhatsAppUrl("51999167804", text);
    expect(url).toBe(`https://wa.me/5551999167804?text=${encodeURIComponent(text)}`);
    expect(missingPunchWhatsAppUrl(null, text)).toBeNull();
    expect(cartaoPontoHref(10, "2026-11-13")).toBe("/cartao-ponto?memberId=10&month=2026-11");
  });
});
