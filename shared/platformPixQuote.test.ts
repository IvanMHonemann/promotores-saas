import { describe, expect, it } from "vitest";
import {
  pixChargeWhatsAppUrl,
  pixChargeWhatsAppMessage,
  quotePixCharge,
} from "./platformPixQuote";

describe("valor do Pix gerado pelo administrador geral", () => {
  it("usa o valor negociado quando ele existe, e mostra a composição com extras", () => {
    const q = quotePixCharge({
      companyName: "IvanMH",
      planName: "GONDUP Completo",
      planPrice: "350.00",
      extraUsers: 2,
      additionalUserPrice: "12.00",
      negotiatedAmount: "350.00",
      dueDate: "2026-11-18",
    });
    expect(q.suggestedAmount).toBe("374.00");
    expect(q.defaultAmount).toBe("350.00");
    expect(q.usedNegotiated).toBe(true);
    expect(q.dueDateLabel).toBe("18/11/2026");
    expect(q.monthRef).toBe("novembro/2026");
    expect(q.lines.map((l) => l.label.replace(/\u00a0/g, " "))).toEqual([
      "Preço do plano (GONDUP Completo)",
      "2 funcionários extras × R$ 12,00",
      "Valor sugerido (plano + extras)",
      "Valor mensal negociado",
    ]);
  });

  it("sem valor negociado, soma o preço do plano com os funcionários extras", () => {
    const q = quotePixCharge({
      companyName: "Lisa",
      planName: "GONDUP Completo",
      planPrice: "350.00",
      extraUsers: 3,
      additionalUserPrice: "12.00",
      negotiatedAmount: null,
      dueDate: "2026-11-23",
    });
    expect(q.defaultAmount).toBe("386.00");
    expect(q.usedNegotiated).toBe(false);
    expect(q.extrasTotal).toBe("36.00");
  });

  it("sem extras, o padrão é o preço do plano", () => {
    const q = quotePixCharge({
      companyName: "Lisa",
      planName: "GONDUP Completo",
      planPrice: "350",
      extraUsers: 0,
      additionalUserPrice: "12.00",
      negotiatedAmount: "",
      dueDate: null,
    });
    expect(q.defaultAmount).toBe("350.00");
    expect(q.lines).toEqual([{ label: "Preço do plano (GONDUP Completo)", amount: "350.00" }]);
    expect(q.dueDateLabel).toBeNull();
  });
});

describe("WhatsApp do Pix gerado", () => {
  it("abre o WhatsApp sem número, para o admin escolher o contato", () => {
    const msg = pixChargeWhatsAppMessage({
      companyName: "IvanMH",
      monthRef: "novembro/2026",
      dueDateLabel: "18/11/2026",
      amountLabel: "R$ 350,00",
      pixPayload: "00020126...",
    });
    const url = pixChargeWhatsAppUrl(msg);
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(url).not.toMatch(/wa\.me\/\d/);
    expect(decodeURIComponent(url)).toContain("Empresa: IvanMH");
    expect(decodeURIComponent(url)).toContain("Vencimento: 18/11/2026");
    expect(msg).toContain("Pix copia e cola:");
  });
});
