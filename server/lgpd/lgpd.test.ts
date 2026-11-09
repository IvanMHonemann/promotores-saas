import { describe, expect, it } from "vitest";
import { isValidCnpj, isValidCpf, isValidCpfOrCnpj, parseSchedule, formatSchedule } from "../../shared/brDocs";
import { PRIVACY_NOTICE_SECTIONS, PRIVACY_NOTICE_VERSION, privacyNoticeText } from "../../shared/privacyNotice";
import { ntpOffset, readNtpTimestamp } from "../ponto/clock";
import { ANONYMIZE_PLAN, summarizeSubjectData } from "./router";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("CPF/CNPJ", () => {
  it("valida dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCpfOrCnpj("11222333000181")).toBe(true);
  });
  it("lê o horário contratual", () => {
    expect(parseSchedule("08:00-12:00, 13:00-17:00")).toEqual([["08:00", "12:00"], ["13:00", "17:00"]]);
    expect(parseSchedule("")).toEqual([]);
    expect(parseSchedule("8h às 12h")).toBeNull();
    expect(formatSchedule([["08:00", "12:00"]])).toBe("08:00-12:00");
  });
});

describe("aviso de privacidade", () => {
  it("não pede consentimento e cita a base legal", () => {
    const t = privacyNoticeText();
    expect(t).toContain("art. 7º, II e V");
    expect(t).not.toMatch(/autorizo|consinto/i);
    expect(PRIVACY_NOTICE_SECTIONS.length).toBeGreaterThanOrEqual(6);
    expect(PRIVACY_NOTICE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});

describe("relógio NTP", () => {
  it("converte timestamp NTP e calcula o desvio", () => {
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(2208988800 + 1_700_000_000, 0);
    buf.writeUInt32BE(2 ** 31, 4); // 0,5 s
    expect(readNtpTimestamp(buf, 0)).toBe(1_700_000_000_500);
    // relógio local 40 s atrasado, 100 ms de ida e volta
    const r = ntpOffset(1000, 41050, 41050, 1100);
    expect(r.offsetMs).toBe(40000);
    expect(r.roundTripMs).toBe(100);
  });
});

describe("direitos do titular", () => {
  it("anonimização preserva o ponto", () => {
    expect(ANONYMIZE_PLAN.mantem.join(" ")).toMatch(/Marcações de ponto/);
    const src = readFileSync(path.resolve(__dirname, "router.ts"), "utf8");
    const body = src.slice(src.indexOf("export async function anonymizeSubject"), src.indexOf("const kindSchema"));
    expect(body).not.toMatch(/timeEvents|timeCorrectionRequests|labor_profile|timesheet_acceptances/);
  });
  it("resume as categorias exportadas", () => {
    const fake: any = { conta: { nome: "Promotor Teste" }, perfilTrabalhista: {}, marcacoesDePonto: [1, 2], pedidosDeCorrecao: [], aceitesDoEspelho: [], cienciasDoAviso: [1], ferias: [], visitas: [], fotosDeVisita: [], fotosDeLoja: [], evidencias: [], checklists: [], registrosDeAuditoria: [] };
    const s = summarizeSubjectData(fake);
    expect(s.find((r) => r[0].startsWith("Marcações"))?.[1]).toBe(2);
  });
});
