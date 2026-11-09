import { afterEach, describe, expect, it, vi } from "vitest";
import { backoffMs, classifyError, memoryStore, newItem, recoverInterrupted, runOutbox, type OutboxItem } from "../client/src/lib/outbox";
import { applyQueuedPunches, applyQueuedVisits } from "../client/src/lib/offlineOverlay";
import { assessDeviceClock, clockAlertNote, readClockAlert, CLOCK_ALERT_MARKER } from "../shared/offlineClock";
import { resolvePunchTime } from "../shared/punchTime";
import { fmtMark } from "../shared/timesheetMirror";
import * as offlineSync from "./modules/offlineSync";
import { appRouter } from "./routers";
import * as db from "./db";
import { PLAN_FEATURES } from "../shared/entitlements";

const item = (over: Partial<OutboxItem> & Pick<OutboxItem, "kind">): OutboxItem =>
  newItem({ label: over.kind, payload: {}, deviceTime: "2026-11-05T11:00:00.000Z", clock: {}, ...over });

describe("fila offline (runOutbox)", () => {
  it("envia na ordem e remove o que o servidor aceitou", async () => {
    const a = item({ kind: "punch", seq: 1, payload: { eventType: "clock_in" } });
    const b = item({ kind: "punch", seq: 2, payload: { eventType: "break_start" } });
    const store = memoryStore([b, a]);
    const sent: string[] = [];
    const r = await runOutbox(store, { punch: async (i) => { sent.push(i.payload.eventType); } });
    expect(sent).toEqual(["clock_in", "break_start"]);
    expect(r).toMatchObject({ sent: 2, remaining: 0 });
  });

  it("foto só sobe depois do check-in dela; se o check-in falhar por rede, a foto espera", async () => {
    const visit = item({ kind: "visit", seq: 1 });
    const photo = item({ kind: "photo", seq: 2, dependsOn: visit.id });
    const store = memoryStore([visit, photo]);
    const photoHandler = vi.fn(async () => {});
    const r = await runOutbox(store, { visit: async () => { throw new TypeError("Failed to fetch"); }, photo: photoHandler }, { now: () => 1000 });
    expect(photoHandler).not.toHaveBeenCalled();
    expect(r.stoppedBy).toBe("network");
    const saved = store.items.get(visit.id)!;
    expect(saved.status).toBe("error");
    expect(saved.attempts).toBe(1);
    expect(saved.nextAttemptAt).toBeGreaterThan(1000);
    // Rede voltou e o tempo de espera passou: check-in e depois a foto.
    const order: string[] = [];
    await runOutbox(store, { visit: async () => { order.push("visit"); }, photo: async () => { order.push("photo"); } }, { now: () => 10_000_000 });
    expect(order).toEqual(["visit", "photo"]);
    expect(store.items.size).toBe(0);
  });

  it("recusa definitiva marca como erro (sem apagar) e segura as batidas seguintes para manter a ordem", async () => {
    const a = item({ kind: "punch", seq: 1 });
    const b = item({ kind: "punch", seq: 2 });
    const store = memoryStore([a, b]);
    const handler = vi.fn(async () => { throw Object.assign(new Error("Sequência inválida"), { data: { code: "BAD_REQUEST" } }); });
    const r = await runOutbox(store, { punch: handler });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(r.failed).toBe(1);
    expect(store.items.get(a.id)!.status).toBe("failed");
    expect(store.items.get(a.id)!.lastError).toBe("Sequência inválida");
    expect(store.items.get(b.id)!.status).toBe("pending");
  });

  it("não envia a fila de outro usuário do mesmo aparelho", async () => {
    const other = item({ kind: "photo", ownerId: 99 });
    const store = memoryStore([other]);
    const h = vi.fn(async () => {});
    await runOutbox(store, { photo: h }, { ownerId: 7 });
    expect(h).not.toHaveBeenCalled();
  });

  it("item interrompido no meio do envio volta para a fila", async () => {
    const a = item({ kind: "punch", status: "sending" });
    const store = memoryStore([a]);
    await recoverInterrupted(store);
    expect(store.items.get(a.id)!.status).toBe("pending");
  });

  it("espera cresce até 5 min e classifica erros", () => {
    expect(backoffMs(1, () => 0.5)).toBe(5000);
    expect(backoffMs(3, () => 0.5)).toBe(20000);
    expect(backoffMs(30, () => 0.5)).toBe(300000);
    expect(classifyError(new TypeError("Failed to fetch"))).toBe("network");
    expect(classifyError({ data: { code: "UNAUTHORIZED" } })).toBe("auth");
    expect(classifyError({ data: { code: "CONFLICT" } })).toBe("permanent");
    expect(classifyError({ data: { code: "INTERNAL_SERVER_ERROR" } })).toBe("transient");
  });

  it("cada item tem um UUID próprio (chave de idempotência)", () => {
    const a = item({ kind: "punch" });
    const b = item({ kind: "punch" });
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.id).not.toBe(b.id);
    expect(item({ kind: "punch", id: undefined }).id).toBeTruthy();
  });
});

describe("tela offline (sobreposição da fila)", () => {
  it("check-in guardado deixa a visita em andamento e marca como aguardando envio", () => {
    const rows = [{ visit: { id: 5, status: "pending" }, store: { name: "Loja" } }];
    const out = applyQueuedVisits(rows, [item({ kind: "visit", payload: { action: "start", visitId: 5 }, deviceTime: "2026-11-05T12:00:00.000Z" })]);
    expect(out[0].visit.status).toBe("in_progress");
    expect(out[0].visit.actualStart).toBe("2026-11-05T12:00:00.000Z");
    expect(out[0].queued).toBe(true);
  });
  it("entrada guardada libera a jornada offline", () => {
    const shift = applyQueuedPunches({ active: false, status: "clock_in_required" }, [item({ kind: "punch", payload: { eventType: "clock_in" } })], "2026-11-05", (iso) => iso.slice(0, 10));
    expect(shift?.active).toBe(true);
  });
});

describe("relógio do aparelho (detecção de alteração)", () => {
  const anchorServer = new Date("2026-11-05T11:00:00Z");
  const serverNow = new Date("2026-11-05T15:00:00Z");
  it("sem alteração: hora do aparelho bate com o tempo decorrido", () => {
    const device = new Date(anchorServer.getTime() + 3600_000);
    const a = assessDeviceClock(device, { anchorServerTime: anchorServer.toISOString(), anchorDeviceTime: anchorServer.toISOString(), monoElapsedMs: 3600_000 }, serverNow);
    expect(a.suspect).toBe(false);
  });
  it("relógio atrasado de propósito (marcou 1h antes do real) é sinalizado", () => {
    const device = new Date(anchorServer.getTime() + 3600_000 - 3600_000);
    const a = assessDeviceClock(device, { anchorServerTime: anchorServer.toISOString(), anchorDeviceTime: anchorServer.toISOString(), monoElapsedMs: 3600_000 }, serverNow);
    expect(a.suspect).toBe(true);
    const note = clockAlertNote(device, a)!;
    expect(note.startsWith(CLOCK_ALERT_MARKER)).toBe(true);
    expect(readClockAlert(`linha\n${note}`)).toContain("relógio");
  });
  it("app reiniciado (sem relógio monotônico) e relógio que voltou para trás é sinalizado", () => {
    const device = new Date(anchorServer.getTime() - 30 * 60_000);
    const a = assessDeviceClock(device, { anchorServerTime: anchorServer.toISOString(), anchorDeviceTime: anchorServer.toISOString(), monoElapsedMs: null }, serverNow);
    expect(a.suspect).toBe(true);
  });
  it("marcação offline sincronizada em poucos minutos continua registrada como offline", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    const r = resolvePunchTime({ deviceTime: new Date(now.getTime() - 60_000), serverNow: now, offline: true });
    expect(r.alert).toBe("offline");
  });
  it("espelho mostra o símbolo de registrada offline", () => {
    expect(fmtMark({ type: "clock_in", label: "Entrada", time: "2026-11-05T11:00:00Z", receivedAt: "2026-11-05T15:00:00Z", synced: true, kind: "original", offline: true }, "America/Sao_Paulo")).toBe("08:00(off)");
  });
});

// ---------- servidor: idempotência dos envios offline ----------
const now = new Date();
function caller() {
  return appRouter.createCaller({
    user: { id: -10, openId: "member:10", name: "Promotor", email: "p@test.local", loginMethod: "password", role: "promoter", companyId: 1, createdAt: now, updatedAt: now, lastSignedIn: now } as any,
    accountId: 1, memberAccountId: 10, isMember: true, isPlatformAdmin: false,
    req: { protocol: "https", headers: { "user-agent": "vitest" } } as any,
    res: { clearCookie: () => {}, cookie: () => {} } as any,
  });
}
function mockPlan() {
  vi.spyOn(db, "resolveCompanyPlan").mockResolvedValue({ company: null, subscription: null, plan: { id: 2, name: "Profissional", featureKeys: [...PLAN_FEATURES.profissional] } } as any);
  vi.spyOn(db, "getCompanyFeatureOverrides").mockResolvedValue({});
  vi.spyOn(db, "getMemberFeatureModes").mockResolvedValue({});
}
afterEach(() => vi.restoreAllMocks());

describe("servidor: envios offline idempotentes", () => {
  it("batida reenviada com a mesma chave devolve a mesma marcação (não duplica)", async () => {
    mockPlan();
    const existing = { id: 901, companyId: 1, memberAccountId: 10, eventType: "clock_in", nsr: 12, serverTime: now, deviceTime: now, idempotencyKey: "5b0c7a7e-1111-4b8e-9c55-000000000001" };
    const query = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([existing]) };
    const insert = vi.fn();
    vi.spyOn(db, "getDb").mockResolvedValue({ select: vi.fn(() => query), insert, execute: vi.fn().mockResolvedValue([[]]), transaction: vi.fn() } as any);
    const r: any = await caller().timeTracking.registerEvent({
      eventType: "clock_in", latitude: -29.6, longitude: -50.9, accuracy: 12, locationStatus: "success",
      idempotencyKey: existing.idempotencyKey, timeZone: "America/Sao_Paulo", offline: true, deviceTime: new Date(now.getTime() - 3600_000).toISOString(),
      clock: { anchorServerTime: new Date(now.getTime() - 7200_000).toISOString(), anchorDeviceTime: new Date(now.getTime() - 7200_000).toISOString(), monoElapsedMs: 3600_000 },
    });
    expect(r.id).toBe(901);
    expect(insert).not.toHaveBeenCalled();
  });

  it("check-in offline grava o horário do aparelho e registra a chave; reenvio não regrava", async () => {
    mockPlan();
    const deviceTime = new Date(now.getTime() - 40 * 60_000).toISOString();
    const visitRow = { visit: { id: 77, status: "pending", promoterId: 10, actualStart: null }, store: { name: "Loja" } };
    vi.spyOn(db, "autoCloseStaleVisits").mockResolvedValue([] as any);
    vi.spyOn(db, "listOperationalVisits").mockResolvedValue([visitRow] as any);
    const update = vi.spyOn(db, "updateOperationalVisit").mockResolvedValue({ ...visitRow, visit: { ...visitRow.visit, status: "in_progress" } } as any);
    const find = vi.spyOn(offlineSync, "findSubmission").mockResolvedValueOnce(null);
    const record = vi.spyOn(offlineSync, "recordSubmission").mockResolvedValue(undefined);
    await caller().operations.visits.start({ id: 77, latitude: -29.6, longitude: -50.9, accuracy: 10, clientId: "9f0c7a7e-2222-4b8e-9c55-000000000002", deviceTime, offline: true });
    expect(update).toHaveBeenCalledTimes(1);
    expect((update.mock.calls[0][2] as any).actualStart.toISOString()).toBe(deviceTime);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ kind: "visit_start", entityId: 77, offline: true }));

    find.mockResolvedValueOnce({ kind: "visit_start", entityId: 77 });
    await caller().operations.visits.start({ id: 77, clientId: "9f0c7a7e-2222-4b8e-9c55-000000000002", deviceTime, offline: true });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("chave reaproveitada para outra visita é recusada", async () => {
    mockPlan();
    vi.spyOn(db, "listOperationalVisits").mockResolvedValue([{ visit: { id: 78, status: "in_progress", promoterId: 10 }, store: {} }] as any);
    vi.spyOn(offlineSync, "findSubmission").mockResolvedValue({ kind: "visit_start", entityId: 77 });
    await expect(caller().operations.visits.complete({ id: 78, clientId: "9f0c7a7e-2222-4b8e-9c55-000000000002" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("horário offline legítimo é o do aparelho", () => {
    const r = offlineSync.resolveOfflineTime({ deviceTime: new Date(now.getTime() - 60_000).toISOString(), offline: true, serverNow: now });
    expect(r.offline).toBe(true);
    expect(r.effectiveTime.getTime()).toBe(now.getTime() - 60_000);
  });
});
