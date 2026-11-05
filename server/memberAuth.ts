import { createTtlCache } from "./ttlCache";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, lte } from "drizzle-orm";
import { companies, companySubscriptions, memberAccounts, memberSessions, platformAdmins, platformSessions, subscriptionPlans } from "../drizzle/schema.original";
import { promoterProfiles } from "../drizzle/schema";
import { getDb } from "./db";
import { clearThrottle, configureThrottleDb, isThrottled, registerThrottleFailure } from "./authThrottle";

const SESSION_DAYS = 30;
// Limite de tentativas compartilhado entre instâncias (banco), ver authThrottle.ts.
configureThrottleDb(() => getDb());
const isRateLimited = isThrottled;
const registerFailure = registerThrottleFailure;
const clearRateLimit = clearThrottle;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, stored] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type LoginPrincipal =
  | { kind: "platform"; account: typeof platformAdmins.$inferSelect }
  | { kind: "company"; account: typeof memberAccounts.$inferSelect };

export function normalizeMemberRole(role: string): "company_admin" | "supervisor" | "promoter" {
  if (role === "admin" || role === "company_admin") return "company_admin";
  if (role === "supervisor") return "supervisor";
  return "promoter";
}

export async function authenticateMember(email: string, password: string): Promise<LoginPrincipal | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (await isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const platformResult = await db.select().from(platformAdmins).where(eq(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    await clearRateLimit(key);
    return { kind: "platform", account: platform };
  }

  const memberResult = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member && member.active && verifyPassword(password, member.passwordHash)) {
    await clearRateLimit(key);
    return { kind: "company", account: member };
  }

  await registerFailure(key);
  return null;
}

export async function createSession(principal: LoginPrincipal) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  if (principal.kind === "platform") {
    await db.delete(platformSessions).where(and(eq(platformSessions.platformAdminId, principal.account.id), lte(platformSessions.expiresAt, new Date())));
    await db.insert(platformSessions).values({ platformAdminId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
    return { rawToken, expiresAt, kind: "platform" as const };
  }
  await db.delete(memberSessions).where(and(eq(memberSessions.memberAccountId, principal.account.id), lte(memberSessions.expiresAt, new Date())));
  await db.insert(memberSessions).values({ memberAccountId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt, kind: "company" as const };
}

const SESSION_CACHE_MS = 20_000;
const memberSessionCache = createTtlCache<any>(SESSION_CACHE_MS);
const platformSessionCache = createTtlCache<any>(SESSION_CACHE_MS);
/** Derruba o cache de sessão desta instância quando sessões são encerradas (o efeito deixa de esperar o TTL). */
function dropSessionCaches() {
  memberSessionCache.clear();
  platformSessionCache.clear();
}
let lastSessionCleanup = 0;
/** Limpa sessões expiradas no máximo a cada 10 min por instância, sem bloquear a requisição. */
function cleanupExpiredSessions(db: any) {
  const nowMs = Date.now();
  if (nowMs - lastSessionCleanup < 10 * 60_000) return;
  lastSessionCleanup = nowMs;
  const now = new Date(nowMs);
  void Promise.all([
    db.delete(memberSessions).where(lte(memberSessions.expiresAt, now)),
    db.delete(platformSessions).where(lte(platformSessions.expiresAt, now)),
  ]).catch(() => undefined);
}

export function getMemberBySessionToken(rawToken: string) {
  if (!rawToken) return Promise.resolve(null);
  return memberSessionCache.get(hashToken(rawToken), () => loadMemberBySessionToken(rawToken));
}

async function loadMemberBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions)
    .innerJoin(memberAccounts, eq(memberSessions.memberAccountId, memberAccounts.id))
    .innerJoin(companies, eq(memberAccounts.companyId, companies.id))
    .where(and(eq(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq(memberAccounts.active, true), eq(companies.active, true)))
    .limit(1);
  cleanupExpiredSessions(db);
  return result[0]?.account ?? null;
}

export function getPlatformAdminBySessionToken(rawToken: string) {
  if (!rawToken) return Promise.resolve(null);
  return platformSessionCache.get(hashToken(rawToken), () => loadPlatformAdminBySessionToken(rawToken));
}

async function loadPlatformAdminBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = new Date();
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions)
    .innerJoin(platformAdmins, eq(platformSessions.platformAdminId, platformAdmins.id))
    .where(and(eq(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq(platformAdmins.active, true)))
    .limit(1);
  cleanupExpiredSessions(db);
  return result[0]?.account ?? null;
}

export async function revokeSessions(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  memberSessionCache.delete(tokenHash);
  platformSessionCache.delete(tokenHash);
  await db.delete(memberSessions).where(eq(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq(platformSessions.tokenHash, tokenHash));
}

export async function changeMemberPassword(memberAccountId: number, currentPassword: string, newPassword: string) {
  const key = `change:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return true;
}

export async function changePlatformPassword(platformAdminId: number, currentPassword: string, newPassword: string) {
  const key = `change:platform:${platformAdminId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq(platformSessions.platformAdminId, platformAdminId));
  dropSessionCaches();
  return true;
}

export async function resetMemberPassword(memberAccountId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  const [acc] = await db.select({ email: memberAccounts.email }).from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  if (acc?.email) await clearRateLimit(`login:${acc.email.trim().toLowerCase()}`);
}

export async function recoverPassword(email: string, recoveryCode: string, newPassword: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;

  const platformResult = await db.select().from(platformAdmins).where(eq(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq(platformSessions.platformAdminId, platform.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" as const };
  }

  const memberResult = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, member.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" as const };
  }

  await registerFailure(key);
  return false;
}

// ---------------------------------------------------------------------------
// Redefinição de senha por link (e-mail). Token sem estado, assinado com JWT_SECRET:
//   payload = { k: "platform"|"company", id, exp } + assinatura HMAC que inclui um trecho do hash da
//   senha ATUAL. Assim o link só funciona uma vez (depois da troca o hash muda) e expira em 1 hora.
// Não precisa de tabela nova. Sem JWT_SECRET configurado, o recurso fica desativado.
// ---------------------------------------------------------------------------
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function resetSecret() {
  return process.env.JWT_SECRET || "";
}

function signResetToken(kind: "platform" | "company", id: number, exp: number, passwordHash: string) {
  const payload = Buffer.from(JSON.stringify({ k: kind, id, exp })).toString("base64url");
  const mac = createHmac("sha256", resetSecret()).update(`${payload}.${passwordHash.slice(-24)}`).digest("base64url");
  return `${payload}.${mac}`;
}

function parseResetToken(token: string): { k: "platform" | "company"; id: number; exp: number; payload: string; mac: string } | null {
  const [payload, mac] = String(token || "").split(".");
  if (!payload || !mac) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if ((data.k !== "platform" && data.k !== "company") || !Number.isInteger(data.id) || typeof data.exp !== "number") return null;
    return { ...data, payload, mac };
  } catch {
    return null;
  }
}

export function isPasswordResetAvailable() {
  return Boolean(resetSecret());
}

/** Gera o token de redefinição para o e-mail. Devolve null se o e-mail não existe/está inativo (não revele isso ao usuário). */
export async function createPasswordResetToken(email: string): Promise<{ token: string; userName: string } | null> {
  if (!isPasswordResetAvailable()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const exp = Date.now() + RESET_TOKEN_TTL_MS;
  const platform = (await db.select().from(platformAdmins).where(eq(platformAdmins.email, normalizedEmail)).limit(1))[0];
  if (platform?.active) return { token: signResetToken("platform", platform.id, exp, platform.passwordHash), userName: platform.userName || normalizedEmail };
  const member = (await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1))[0];
  if (member?.active) return { token: signResetToken("company", member.id, exp, member.passwordHash), userName: member.userName || normalizedEmail };
  return null;
}

/** Valida o token e troca a senha. Encerra todas as sessões da conta. */
export async function resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
  if (!isPasswordResetAvailable()) return false;
  const parsed = parseResetToken(token);
  if (!parsed || parsed.exp < Date.now()) return false;
  const key = `reset:${parsed.k}:${parsed.id}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const account = parsed.k === "platform"
    ? (await db.select().from(platformAdmins).where(eq(platformAdmins.id, parsed.id)).limit(1))[0]
    : (await db.select().from(memberAccounts).where(eq(memberAccounts.id, parsed.id)).limit(1))[0];
  if (!account || !account.active) { await registerFailure(key); return false; }
  const expected = signResetToken(parsed.k, parsed.id, parsed.exp, account.passwordHash);
  const a = Buffer.from(expected);
  const b = Buffer.from(`${parsed.payload}.${parsed.mac}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) { await registerFailure(key); return false; }
  if (parsed.k === "platform") {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq(platformAdmins.id, parsed.id));
    await db.delete(platformSessions).where(eq(platformSessions.platformAdminId, parsed.id));
  } else {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, parsed.id));
    await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, parsed.id));
  }
  await clearRateLimit(key);
  dropSessionCaches();
  return true;
}

/** Limita pedidos de redefinição por e-mail (5 por 15 min, compartilhado entre instâncias). */
export async function allowPasswordResetRequest(email: string) {
  const key = `resetreq:${email.trim().toLowerCase()}`;
  if (await isRateLimited(key)) return false;
  await registerFailure(key);
  return true;
}

export async function createCompanyWithAdmin(input: {
  companyName: string;
  userName: string;
  email: string;
  password: string;
  planId?: number | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const normalizedEmail = input.email.trim().toLowerCase();
  return await database.transaction(async (tx) => {
    const trialEnds = new Date(Date.now() + 14 * 24 * 3600 * 1000);
    const trialYmd = trialEnds.toISOString().slice(0, 10);
    const todayYmd = new Date().toISOString().slice(0, 10);
    const companyResult = await tx.insert(companies).values({
      name: input.companyName.trim(),
      active: true,
      planId: input.planId ?? null,
      subscriptionStatus: "trial",
      subscriptionStartedAt: new Date(),
      trialEndsAt: trialEnds,
      subscriptionExpiresAt: trialEnds,
    } as any);
    const companyId = Number(companyResult[0].insertId);
    const accountResult = await tx.insert(memberAccounts).values({
      companyId,
      userName: input.userName.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      recoveryCodeHash: hashPassword(recoveryCode),
      role: "company_admin",
      active: true,
    });
    if (input.planId) {
      const planRows = await tx.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1);
      const plan = planRows[0];
      if (plan) {
        await tx.insert(companySubscriptions).values({
          companyId,
          planId: input.planId,
          status: "trial",
          startsAt: todayYmd,
          endsAt: trialYmd,
          billingInterval: plan.billingCycle,
          amount: plan.price,
          currentPeriodStart: todayYmd,
          currentPeriodEnd: trialYmd,
          trialEndsAt: trialYmd,
          notes: "Cadastro público com plano selecionado (trial 14 dias)",
        } as any);
      }
    }
    return { companyId, accountId: Number(accountResult[0].insertId), recoveryCode, planId: input.planId ?? null };
  });
}

export async function createCompanyUser(input: { companyId: number; userName: string; email: string; password: string; role: "company_admin" | "supervisor" | "promoter" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const userName = input.userName.trim();
  const email = input.email.trim().toLowerCase();
  if (userName.length < 2) throw new Error("Informe o nome completo do usuário.");
  if (email.length < 3) throw new Error("Informe um e-mail válido.");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const result = await db.insert(memberAccounts).values({
    companyId: input.companyId,
    userName,
    email,
    passwordHash: hashPassword(input.password),
    recoveryCodeHash: hashPassword(recoveryCode),
    role: input.role,
    active: true,
  });
  return { accountId: Number(result[0].insertId), recoveryCode };
}

export async function listMemberAccounts(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt, employeeCode: promoterProfiles.employeeCode, workStartTime: promoterProfiles.workStartTime, workEndTime: promoterProfiles.workEndTime }).from(memberAccounts).leftJoin(promoterProfiles, and(eq(promoterProfiles.memberAccountId, memberAccounts.id), eq(promoterProfiles.companyId, memberAccounts.companyId)));
  const rows = companyId ? await query.where(eq(memberAccounts.companyId, companyId)) : await query;
  return rows.map((row) => ({ ...row, role: normalizeMemberRole(String(row.role)) }));
}

export async function updateCompanyUser(accountId: number, companyId: number, data: { userName?: string; email?: string; role?: "company_admin" | "supervisor" | "promoter" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.role && data.role !== "company_admin") {
    // Não deixa a empresa sem administrador ao rebaixar o último (a empresa ficaria sem ninguém para gerenciá-la).
    const [target] = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(and(eq(memberAccounts.id, accountId), eq(memberAccounts.companyId, companyId))).limit(1);
    if (target && normalizeMemberRole(String(target.role)) === "company_admin") {
      const admins = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and(eq(memberAccounts.companyId, companyId), eq(memberAccounts.active, true), inArray(memberAccounts.role, ["company_admin", "admin"] as any))).limit(2);
      if (admins.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
    }
  }
  await db.update(memberAccounts).set({ ...data, email: data.email?.trim().toLowerCase() }).where(and(eq(memberAccounts.id, accountId), eq(memberAccounts.companyId, companyId)));
}

export async function setMemberActive(id: number, active: boolean, companyId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const conditions = companyId === undefined ? eq(memberAccounts.id, id) : and(eq(memberAccounts.id, id), eq(memberAccounts.companyId, companyId));
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(conditions).limit(1);
  if (account[0]?.role === "company_admin" && !active) {
    const adminCount = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and(eq(memberAccounts.companyId, companyId ?? 0), eq(memberAccounts.role, "company_admin"), eq(memberAccounts.active, true))).limit(2);
    if (adminCount.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
  }
  await db.update(memberAccounts).set({ active }).where(conditions);
  if (!active) {
    await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, id));
    dropSessionCaches();
  }
}

export async function setPlatformAdminActive(id: number, active: boolean) {
  if (!active) throw new Error("A conta do administrador da plataforma não pode ser desativada nesta operação.");
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAdmins).set({ active }).where(eq(platformAdmins.id, id));
}

export async function updateMemberProfile(memberAccountId: number, data: { userName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const name = data.userName.trim();
  if (name.length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres.");
  await db.update(memberAccounts).set({ userName: name }).where(eq(memberAccounts.id, memberAccountId));
  return { success: true as const, userName: name };
}

export async function regenerateMemberRecoveryCode(memberAccountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq(memberAccounts.id, memberAccountId));
  return { recoveryCode };
}

export async function revokeAllMemberSessions(memberAccountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return { success: true as const };
}


export async function verifyMemberPassword(memberAccountId: number, password: string) {
  const key = `verify:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.select().from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  return true;
}
