import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  afdType7Fields, buildAej, buildAfd, crc16Kermit, formatDH, punchContentHash, punchHash, toAejSequence, treatmentHash, tzOffset, verifyLedger, type LedgerRow,
} from "./repFormat";

const TZ = "America/Sao_Paulo";

function chain(n: number): LedgerRow[] {
  const rows: LedgerRow[] = [];
  let prev: string | null = null;
  for (let i = 1; i <= n; i++) {
    const markedAt = new Date(Date.UTC(2026, 10, 5, 11 + i, 0, 0));
    const p = { nsr: i, markedAt, recordedAt: markedAt, cpf: "12345678909", timeZone: TZ, collector: "02", offline: false };
    const recordHash = punchHash(p, prev);
    const contentHash = punchContentHash({ nsr: i, memberAccountId: 10, eventType: i % 2 ? "clock_in" : "clock_out", markedAt, recordedAt: markedAt, clientTime: null, latitude: -23.5, longitude: -46.6, accuracy: 10, timeZone: TZ, cpf: "12345678909", offline: false });
    rows.push({ id: i, origin: "original", nsr: i, recordHash, prevHash: prev, contentHash, memberAccountId: 10, eventType: i % 2 ? "clock_in" : "clock_out", markedAt, recordedAt: markedAt, cpf: "12345678909", timeZone: TZ, collectorId: "02", offline: false, replacesEventId: null, correctionRequestId: null, recordedByName: null, reason: null, latitude: -23.5, longitude: -46.6, accuracy: 10, clientTime: null });
    prev = recordHash;
  }
  return rows;
}

describe("formatação da Portaria 671", () => {
  it("CRC-16/KERMIT confere com o exemplo oficial", () => {
    expect(crc16Kermit("123456789")).toBe("2189");
  });
  it("data e hora no formato DH com fuso", () => {
    const d = new Date("2021-04-27T19:44:31Z");
    expect(formatDH(d, TZ)).toBe("2021-04-27T16:44:00-0300");
    expect(formatDH(d, TZ)).toHaveLength(24);
    expect(tzOffset(d, "UTC")).toBe("+0000");
  });
  it("AFD tem cabeçalho de 302 posições, registro 7 de 137, trailer e assinatura", () => {
    const rows = chain(2);
    const afd = buildAfd({ employer: { document: "12.345.678/0001-95", name: "Empresa Teste IvanMH" }, developer: { document: "" }, inpiNumber: null, from: "2026-11-05", to: "2026-11-05", generatedAt: new Date("2026-11-05T20:00:00Z"), timeZone: TZ,
      punches: rows.map((r) => ({ nsr: r.nsr!, markedAt: r.markedAt, recordedAt: r.recordedAt, cpf: r.cpf, timeZone: TZ, offline: false, hash: r.recordHash! })) });
    expect(afd.lines[0]).toHaveLength(302);
    expect(afd.lines[0].slice(0, 10)).toBe("0000000001");
    expect(afd.lines[0].slice(-4)).toBe(crc16Kermit(afd.lines[0].slice(0, 298)));
    expect(afd.lines[1]).toHaveLength(137);
    expect(afd.lines[1].slice(9, 10)).toBe("7");
    expect(afd.lines[3]).toHaveLength(64);
    expect(afd.lines[3].slice(55, 63)).toBe("00000002".padStart(9, "0").slice(1));
    expect(afd.lines[4].trim()).toBe("ASSINATURA_DIGITAL_EM_ARQUIVO_P7S");
    expect(afd.content.endsWith("\r\n")).toBe(true);
    expect(afd.fileName).toContain("REP_P");
  });
  it("hash do registro 7 é o SHA-256 dos campos + hash anterior", () => {
    const rows = chain(2);
    const fields = afdType7Fields({ nsr: 2, markedAt: rows[1].markedAt, recordedAt: rows[1].recordedAt, cpf: rows[1].cpf, timeZone: TZ, offline: false });
    expect(fields).toHaveLength(73);
    expect(rows[1].recordHash).toMatch(/^[a-f0-9]{64}$/);
  });
  it("AEJ usa pipe, pares entrada/saída e trailer com contagens", () => {
    const day = toAejSequence([
      { type: "clock_in", time: new Date("2026-11-05T11:00:00Z") },
      { type: "break_start", time: new Date("2026-11-05T15:00:00Z") },
      { type: "break_end", time: new Date("2026-11-05T16:00:00Z") },
      { type: "clock_out", time: new Date("2026-11-05T20:00:00Z") },
    ]);
    expect(day.map((d) => `${d.tpMarc}${d.seq}`)).toEqual(["E1", "S1", "E2", "S2"]);
    const aej = buildAej({ employer: { document: "12345678000195", name: "Empresa Teste IvanMH" }, from: "2026-11-01", to: "2026-11-30", generatedAt: new Date("2026-11-05T20:00:00Z"), timeZone: TZ,
      ptrp: { version: "1.0", developerDocument: "", developerName: "GondUp", developerEmail: "" },
      workers: [{ cpf: "12345678909", name: "Promotor Teste", contract: { code: "J480", dailyMinutes: 480, pairs: [] }, marks: day.map((d) => ({ markedAt: d.time, tpMarc: d.tpMarc, seq: d.seq, fonte: "O" as const })) }] });
    expect(aej.lines[0].startsWith("01|1|12345678000195|")).toBe(true);
    expect(aej.lines.find((l) => l.startsWith("05|"))).toContain("|E|001|O|J480|");
    expect(aej.lines.at(-2)).toBe("99|1|1|1|1|4|0|0|1");
    expect(aej.lines.at(-1)?.trim()).toBe("ASSINATURA_DIGITAL_EM_ARQUIVO_P7S");
  });
});

describe("verificação de integridade", () => {
  it("cadeia intacta passa", () => {
    const r = verifyLedger(chain(5));
    expect(r.ok).toBe(true);
    expect(r.lastNsr).toBe(5);
  });
  it("horário alterado no banco é detectado", () => {
    const rows = chain(3);
    rows[1] = { ...rows[1], markedAt: new Date(rows[1].markedAt.getTime() - 3600000) };
    const r = verifyLedger(rows);
    expect(r.ok).toBe(false);
    expect(r.problems.some((p) => p.kind === "hash" && p.nsr === 2)).toBe(true);
  });
  it("tipo de batida trocado é detectado pelo selo de conteúdo", () => {
    const rows = chain(3);
    rows[0] = { ...rows[0], eventType: "clock_out" };
    expect(verifyLedger(rows).problems.some((p) => p.nsr === 1 && p.kind === "hash")).toBe(true);
  });
  it("marcação apagada aparece como lacuna de NSR e quebra de cadeia", () => {
    const rows = chain(4).filter((r) => r.nsr !== 2);
    const kinds = verifyLedger(rows).problems.map((p) => p.kind);
    expect(kinds).toContain("gap");
    expect(kinds).toContain("chain");
  });
  it("tratamentos têm cadeia própria", () => {
    const t1 = { id: 10, kind: "adjustment" as const, replacesEventId: 1, memberAccountId: 10, eventType: "clock_in", markedAt: new Date("2026-11-05T11:05:00Z"), recordedAt: new Date("2026-11-06T10:00:00Z"), reason: "Esqueci", decidedBy: "Admin", correctionRequestId: 3 };
    const h1 = treatmentHash(t1, null);
    const row: LedgerRow = { id: 10, origin: "adjustment", nsr: null, recordHash: h1, prevHash: null, memberAccountId: 10, eventType: "clock_in", markedAt: t1.markedAt, recordedAt: t1.recordedAt, cpf: null, timeZone: TZ, collectorId: null, offline: false, replacesEventId: 1, correctionRequestId: 3, recordedByName: "Admin", reason: "Esqueci" };
    expect(verifyLedger([...chain(1), row]).ok).toBe(true);
    expect(verifyLedger([...chain(1), { ...row, reason: "outro motivo" }]).ok).toBe(false);
  });
});

describe("imutabilidade das marcações", () => {
  it("nenhum código do servidor altera ou apaga marcações de ponto (exceto o selo inicial de registros antigos)", () => {
    const root = path.resolve(__dirname, "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.ts$/.test(name) && !/\.test\.ts$/.test(name)) files.push(full);
      }
    };
    walk(root);
    const offenders: string[] = [];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      if (/update\(timeEvents\)|delete\(timeEvents\)|DELETE\s+FROM\s+time_events/i.test(text)) offenders.push(f);
      const updates = text.match(/UPDATE\s+time_events[^`]*/gi) || [];
      for (const u of updates) if (!/recordHash IS NULL/.test(u)) offenders.push(`${f}: ${u.slice(0, 60)}`);
    }
    expect(offenders).toEqual([]);
  });
});
