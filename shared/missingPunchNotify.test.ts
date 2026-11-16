import { describe, expect, it } from "vitest";
import {
  cartaoPontoHref,
  formatMissingPunchDay,
  missingPunchNotifyMessage,
  missingPunchStaffLabel,
  missingPunchWhatsAppUrl,
  notifyPromoterMissingPunch,
} from "./missingPunchNotify";

const sample = {
  name: "Testador",
  day: "2026-11-13",
  missing: "Saída",
  lastLabel: "Retorno do intervalo",
  lastTime: "2026-11-13T19:42:00.000Z",
};

describe("aviso de falta de batida — notificar promotor", () => {
  it("usa o plural certo", () => {
    expect(missingPunchStaffLabel(1)).toBe("1 funcionário");
    expect(missingPunchStaffLabel(2)).toBe("2 funcionários");
    expect(missingPunchStaffLabel(8)).toBe("8 funcionários");
  });

  it("monta a mensagem pronta com nome, data e batidas que faltam", () => {
    const text = missingPunchNotifyMessage(sample);
    expect(text).toBe(
      "Olá, Testador! Consta falta de batida em 13/11/2026: Saída (última marcação: Retorno do intervalo às 16:42). Por favor, regularize ou solicite a correção no GondUp.",
    );
    expect(formatMissingPunchDay("2026-11-13")).toBe("13/11/2026");
  });

  it("abre o WhatsApp sem número para o usuário escolher o contato", () => {
    const text = missingPunchNotifyMessage(sample);
    expect(missingPunchWhatsAppUrl(text)).toBe(`https://wa.me/?text=${encodeURIComponent(text)}`);
    expect(cartaoPontoHref(10, "2026-11-13")).toBe("/cartao-ponto?memberId=10&month=2026-11");
  });

  it("usa a folha de compartilhamento quando ela está disponível", async () => {
    const text = missingPunchNotifyMessage(sample);
    const opened: string[] = [];
    const shared: Array<{ text: string }> = [];
    const result = await notifyPromoterMissingPunch(text, {
      canShare: true,
      share: async (data) => { shared.push(data); },
      openUrl: (url) => { opened.push(url); },
    });
    expect(result).toBe("shared");
    expect(shared).toEqual([{ text }]);
    expect(opened).toEqual([]);
  });

  it("não abre o WhatsApp se a pessoa cancelar a folha de compartilhamento", async () => {
    const text = missingPunchNotifyMessage(sample);
    const opened: string[] = [];
    const err = new Error("cancel");
    err.name = "AbortError";
    const result = await notifyPromoterMissingPunch(text, {
      canShare: true,
      share: async () => { throw err; },
      openUrl: (url) => { opened.push(url); },
    });
    expect(result).toBe("shared");
    expect(opened).toEqual([]);
  });

  it("cai no wa.me sem número quando não há compartilhamento", async () => {
    const text = missingPunchNotifyMessage(sample);
    const opened: string[] = [];
    const result = await notifyPromoterMissingPunch(text, {
      canShare: false,
      openUrl: (url) => { opened.push(url); },
    });
    expect(result).toBe("whatsapp");
    expect(opened).toEqual([`https://wa.me/?text=${encodeURIComponent(text)}`]);
  });
});
