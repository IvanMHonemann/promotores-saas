import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildMirror } from "../shared/timesheetMirror";
import { getBrazilianHoliday, isBrazilianHoliday } from "../shared/holidays";
import { PUNCH_TOLERANCE_MS, readTimeAlert, resolvePunchTime } from "../shared/punchTime";
import { isScheduleRequestAuthorized } from "./scheduleAuth";
import { platformAdmins } from "../drizzle/schema.original";

const ev = (id: number, type: any, time: string, extra: any = {}) => ({ id, type, time, receivedAt: time, synced: true, ...extra });
const labor = { dailyMinutes: 480, workdays: [1, 2, 3, 4, 5] };

describe("feriados", () => {
  it("20/11 é feriado nacional a partir de 2024 (não antes)", () => {
    expect(getBrazilianHoliday("2024-11-20")?.name).toContain("Consciência Negra");
    expect(isBrazilianHoliday("2026-11-20")).toBe(true);
    expect(isBrazilianHoliday("2023-11-20")).toBe(false);
  });
  it("Carnaval e Corpus Christi são facultativos; Sexta-feira Santa não", () => {
    expect(getBrazilianHoliday("2026-02-17")?.optional).toBe(true); // terça de Carnaval 2026
    expect(getBrazilianHoliday("2026-06-04")?.optional).toBe(true); // Corpus Christi 2026
    expect(getBrazilianHoliday("2026-04-03")?.optional).toBeFalsy(); // Sexta-feira Santa 2026
    expect(isBrazilianHoliday("2026-02-17")).toBe(false);
  });
  it("espelho: facultativo não é abonado por padrão, mas é com a configuração da empresa", () => {
    const padrao = buildMirror({ events: [], from: "2026-02-17", to: "2026-02-17", labor });
    expect(padrao.days[0].holiday).toBeNull();
    expect(padrao.days[0].optionalHoliday).toBe("Carnaval");
    expect(padrao.days[0].expectedMinutes).toBe(480);
    expect(padrao.days[0].issues.join()).toContain("facultativo");
    const abonado = buildMirror({ events: [], from: "2026-02-17", to: "2026-02-17", labor, options: { optionalHolidaysAsHoliday: true } });
    expect(abonado.days[0].holiday).toBe("Carnaval");
    expect(abonado.days[0].expectedMinutes).toBeNull();
  });
  it("espelho: 20/11/2026 é abonado automaticamente", () => {
    const r = buildMirror({ events: [], from: "2026-11-20", to: "2026-11-20", labor });
    expect(r.days[0].holiday).toContain("Consciência Negra");
  });
});

describe("férias no espelho", () => {
  it("dias de férias programadas são abonados e não geram falta", () => {
    const r = buildMirror({ events: [], from: "2026-10-05", to: "2026-10-09", labor, vacations: [{ startDate: "2026-10-06", endDate: "2026-10-07" }] });
    const [seg, ter, qua] = r.days;
    expect(seg.vacation).toBe(false);
    expect(ter.vacation).toBe(true);
    expect(ter.issues.join()).toContain("Férias");
    expect(ter.expectedMinutes).toBeNull();
    expect(qua.vacation).toBe(true);
    expect(r.totals.daysWithoutMarksOnWorkday).toBe(3); // seg, qui, sex
  });
});

describe("horário da marcação (aparelho x servidor)", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("dentro de 5 min mantém o horário do aparelho", () => {
    const device = new Date(now.getTime() - PUNCH_TOLERANCE_MS + 1000);
    const r = resolvePunchTime({ deviceTime: device, serverNow: now });
    expect(r.alert).toBe("none");
    expect(r.effectiveTime).toEqual(device);
    expect(r.deviceTimeToStore).toEqual(device);
  });
  it("mais de 5 min: usa o servidor, guarda o horário do aparelho na observação e sinaliza", () => {
    const device = new Date("2026-11-05T09:00:00Z"); // aparelho com relógio adiantado/atrasado
    const r = resolvePunchTime({ deviceTime: device, serverNow: now });
    expect(r.alert).toBe("server_time_used");
    expect(r.effectiveTime).toEqual(now);
    expect(r.deviceTimeToStore).toBeNull(); // o sistema usa deviceTime || serverTime
    expect(r.note).toContain(device.toISOString());
    expect(readTimeAlert(r.note)?.kind).toBe("server_time_used");
  });
  it("horário do aparelho no futuro nunca é aceito, nem como offline", () => {
    const r = resolvePunchTime({ deviceTime: new Date(now.getTime() + 3600_000), serverNow: now, offline: true });
    expect(r.alert).toBe("server_time_used");
    expect(r.effectiveTime).toEqual(now);
  });
  it("marcação offline legítima (até 7 dias) mantém o horário do aparelho, mas fica sinalizada", () => {
    const device = new Date("2026-11-04T12:00:00Z");
    const r = resolvePunchTime({ deviceTime: device, serverNow: now, offline: true });
    expect(r.alert).toBe("offline");
    expect(r.effectiveTime).toEqual(device);
    expect(readTimeAlert(r.note)?.kind).toBe("offline");
  });
  it("offline com mais de 7 dias é recusado como horário oficial", () => {
    const r = resolvePunchTime({ deviceTime: new Date("2026-10-20T12:00:00Z"), serverNow: now, offline: true });
    expect(r.alert).toBe("server_time_used");
  });
  it("sem horário do aparelho usa o do servidor", () => {
    expect(resolvePunchTime({ serverNow: now }).effectiveTime).toEqual(now);
  });
  it("o alerta aparece no espelho do dia", () => {
    const note = resolvePunchTime({ deviceTime: new Date("2026-11-05T09:00:00Z"), serverNow: now }).note;
    const r = buildMirror({ events: [ev(1, "clock_in", "2026-11-05T12:00:00Z", { notes: note, timeAlert: readTimeAlert(note) })], from: "2026-11-05", to: "2026-11-05", labor });
    expect(r.days[0].timeAlerts?.length).toBe(1);
    expect(r.days[0].issues.join()).toContain("ALERTA de horário");
  });
});

describe("autenticação dos agendamentos (Vercel Cron)", () => {
  const req = (headers: Record<string, string>) => ({ headers });
  it("aceita CRON_SECRET via Authorization: Bearer (formato do Vercel Cron)", () => {
    expect(isScheduleRequestAuthorized(req({ authorization: "Bearer cron-secret-1234567" }), { CRON_SECRET: "cron-secret-1234567" } as any)).toBe(true);
  });
  it("aceita SCHEDULE_SECRET por Bearer e por x-schedule-secret", () => {
    const env = { SCHEDULE_SECRET: "schedule-secret-123" } as any;
    expect(isScheduleRequestAuthorized(req({ authorization: "Bearer schedule-secret-123" }), env)).toBe(true);
    expect(isScheduleRequestAuthorized(req({ "x-schedule-secret": "schedule-secret-123" }), env)).toBe(true);
  });
  it("recusa segredo errado, ausente ou nenhum segredo configurado", () => {
    expect(isScheduleRequestAuthorized(req({ authorization: "Bearer errado" }), { CRON_SECRET: "cron-secret-1234567" } as any)).toBe(false);
    expect(isScheduleRequestAuthorized(req({}), { CRON_SECRET: "cron-secret-1234567" } as any)).toBe(false);
    expect(isScheduleRequestAuthorized(req({ authorization: "Bearer " }), {} as any)).toBe(false);
    expect(isScheduleRequestAuthorized(req({ authorization: "Bearer x" }), {} as any)).toBe(false);
  });
});

// ---- redefinição de senha por link (banco simulado) ----
const fake = vi.hoisted(() => ({ admin: null as any, sessionsDeleted: 0 }));
vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => (fake.admin ? [fake.admin] : []) }) }) }),
    update: () => ({ set: (v: any) => ({ where: async () => { fake.admin.passwordHash = v.passwordHash; } }) }),
    delete: () => ({ where: async () => { fake.sessionsDeleted += 1; } }),
  }),
}));

describe("redefinição de senha por link", () => {
  beforeEach(async () => {
    process.env.JWT_SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
    const { hashPassword } = await import("./memberAuth");
    fake.admin = { id: 7, email: "a@b.com", active: true, userName: "Ana", passwordHash: hashPassword("SenhaAntiga123") };
    fake.sessionsDeleted = 0;
  });

  it("gera token, troca a senha e encerra sessões; o token não funciona uma segunda vez", async () => {
    const auth = await import("./memberAuth");
    const created = await auth.createPasswordResetToken("A@B.com");
    expect(created?.token).toBeTruthy();
    expect(await auth.resetPasswordWithToken(created!.token, "NovaSenha1234")).toBe(true);
    expect(auth.verifyPassword("NovaSenha1234", fake.admin.passwordHash)).toBe(true);
    expect(fake.sessionsDeleted).toBe(1);
    expect(await auth.resetPasswordWithToken(created!.token, "OutraSenha999")).toBe(false); // uso único
    expect(auth.verifyPassword("NovaSenha1234", fake.admin.passwordHash)).toBe(true);
  });
  it("rejeita token adulterado e token expirado", async () => {
    const auth = await import("./memberAuth");
    const created = await auth.createPasswordResetToken("a@b.com");
    const [payload, mac] = created!.token.split(".");
    expect(await auth.resetPasswordWithToken(`${payload}.${mac.slice(0, -2)}xx`, "NovaSenha1234")).toBe(false);
    const forged = Buffer.from(JSON.stringify({ k: "platform", id: 7, exp: Date.now() + 1e9 })).toString("base64url");
    expect(await auth.resetPasswordWithToken(`${forged}.${mac}`, "NovaSenha1234")).toBe(false);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 2 * 3600_000);
    expect(await auth.resetPasswordWithToken(created!.token, "NovaSenha1234")).toBe(false);
    vi.useRealTimers();
    expect(auth.verifyPassword("SenhaAntiga123", fake.admin.passwordHash)).toBe(true);
  });
  it("sem JWT_SECRET o recurso fica indisponível (não quebra)", async () => {
    delete process.env.JWT_SECRET;
    const auth = await import("./memberAuth");
    expect(auth.isPasswordResetAvailable()).toBe(false);
    expect(await auth.createPasswordResetToken("a@b.com")).toBeNull();
  });
  it("e-mail inexistente devolve null (sem revelar)", async () => {
    const auth = await import("./memberAuth");
    fake.admin = null;
    expect(await auth.createPasswordResetToken("naoexiste@x.com")).toBeNull();
  });
});
