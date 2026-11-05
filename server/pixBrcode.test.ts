import { describe, expect, it } from "vitest";
import { buildPixBrcode, crc16Ccitt, sanitizePixText } from "@shared/pixBrcode";

describe("Pix BR Code (EMV)", () => {
  it("sanitiza nome e cidade (sem acento, maiúsculas, limites)", () => {
    expect(sanitizePixText("Ivan Mateus Honemann", 25)).toBe("IVAN MATEUS HONEMANN");
    expect(sanitizePixText("Sapiranga / RS", 15)).toBe("SAPIRANGA RS");
    expect(sanitizePixText("São Leopoldo", 15)).toBe("SAO LEOPOLDO");
    expect(sanitizePixText("A".repeat(40), 25)).toHaveLength(25);
  });

  it("CRC16-CCITT bate no vetor Bacen (payload conhecido)", () => {
    // Vetor clássico: CRC de "123456789" com poly 0x1021/init 0xFFFF = 0x29B1
    expect(crc16Ccitt("123456789")).toBe("29B1");
  });

  it("gera payload com valor, chave e CRC válido", () => {
    const payload = buildPixBrcode({
      key: "ivanhonemann09@gmail.com",
      name: "IVAN MATEUS HONEMANN",
      city: "SAPIRANGA",
      amount: "199.90",
      txid: "GONDUPTEST001",
    });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("br.gov.bcb.pix");
    expect(payload).toContain("ivanhonemann09@gmail.com");
    expect(payload).toContain("5406199.90"); // id 54 + len 06 + valor
    expect(payload).toContain("5920IVAN MATEUS HONEMANN");
    expect(payload).toContain("6009SAPIRANGA");
    expect(payload).toMatch(/6304[0-9A-F]{4}$/);
    // Recalcula CRC: corpo até "6304" inclusive
    const body = payload.slice(0, -4);
    expect(body.endsWith("6304")).toBe(true);
    expect(crc16Ccitt(body)).toBe(payload.slice(-4));
  });

  it("rejeita valor inválido", () => {
    expect(() => buildPixBrcode({ amount: "abc" })).toThrow(/inválido/i);
  });
});
