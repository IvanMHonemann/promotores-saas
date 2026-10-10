import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { companies, companySubscriptions, memberAccounts, memberSessions, platformAdmins, platformSessions, subscriptionPlans } from "../drizzle/schema.original";
import { getDb } from "./db";

const SESSION_DAYS = 30;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT = 5;
const BLOCK_MS = 15 * 60 * 1000;

type RateEntry = { failures: number; windowStartedAt: number; blockedUntil: number };
const authRate = new Map<string, RateEntry>();

function isRateLimited(key: string) {
  const now = Date.now();
  const current = authRate.get(key);
  if (!current) return false;
  if (current.blockedUntil > now) return true;
  if (now - current.windowStartedAt >= RATE_WINDOW_MS) authRate.delete(key);
  return false;
}

function registerFailure(key: string) {
  const now = Date.now();
  const current = authRate.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS
    ? { failures: 1, windowStartedAt: now, blockedUntil: 0 }
    : { ...current, failures: current.failures + 1 };
  if (entry.failures >= RATE_LIMIT) entry.blockedUntil = now + BLOCK_MS;
  authRate.set(key, entry);
}

function clearRateLimit(key: string) {
  authRate.delete(key);
}

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

export async function authenticateMember(email: string, password: string): Promise<LoginPrincipal | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");

  const platformResult = await db.select().from(platformAdmins).where(eq(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    clearRateLimit(key);
    return { kind: "platform", account: platform };
  }

  const memberResult = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member && member.active && verifyPassword(password, member.passwordHash)) {
    clearRateLimit(key);
    return { kind: "company", account: member };
  }

  registerFailure(key);
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

export async function getMemberBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions)
    .innerJoin(memberAccounts, eq(memberSessions.memberAccountId, memberAccounts.id))
    .where(and(eq(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq(memberAccounts.active, true)))
    .limit(1);
  await db.delete(memberSessions).where(lte(memberSessions.expiresAt, now));
  return result[0]?.account ?? null;
}

export async function getPlatformAdminBySessionToken(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = new Date();
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions)
    .innerJoin(platformAdmins, eq(platformSessions.platformAdminId, platformAdmins.id))
    .where(and(eq(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq(platformAdmins.active, true)))
    .limit(1);
  await db.delete(platformSessions).where(lte(platformSessions.expiresAt, now));
  return result[0]?.account ?? null;
}

export async function revokeSessions(rawToken: string) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(memberSessions).where(eq(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq(platformSessions.tokenHash, tokenHash));
}

export async function changeMemberPassword(memberAccountId: number, currentPassword: string, newPassword: string) {
  const key = `change:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberAccountId));
  return true;
}

export async function changePlatformPassword(platformAdminId: number, currentPassword: string, newPassword: string) {
  const key = `change:platform:${platformAdminId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq(platformSessions.platformAdminId, platformAdminId));
  return true;
}

export async function resetMemberPassword(memberAccountId: number, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, memberAccountId));
  clearRateLimit(`login:${memberAccountId}`);
}

export async function recoverPassword(email: string, recoveryCode: string, newPassword: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;

  const platformResult = await db.select().from(platformAdmins).where(eq(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq(platformSessions.platformAdminId, platform.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" as const };
  }

  const memberResult = await db.select().from(memberAccounts).where(eq(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, member.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" as const };
  }

  registerFailure(key);
  return false;
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
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt }).from(memberAccounts);
  return companyId ? await query.where(eq(memberAccounts.companyId, companyId)) : await query;
}

export async function updateCompanyUser(accountId: number, companyId: number, data: { userName?: string; email?: string; role?: "company_admin" | "supervisor" | "promoter" }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
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
  if (!active) await db.delete(memberSessions).where(eq(memberSessions.memberAccountId, id));
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
  return { success: true as const };
}


export async function verifyMemberPassword(memberAccountId: number, password: string) {
  const key = `verify:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.select().from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  return true;
}
