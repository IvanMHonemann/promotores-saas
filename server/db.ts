import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  companies,
  memberAccounts,
  memberSessions,
  platformSessions,
  trashItems,
  systemSettings,
  subscriptionPlans,
  companySubscriptions,
  payments,
  paymentEvents,
  users,
  type InsertUser,
} from "../drizzle/schema.original";
import {
  companyFeatureOverrides,
  memberAccounts as entitlementMemberAccounts,
  memberFeaturePermissions,
  promoterProfiles,
  storePhotos,
  subscriptionPlanFeatures,
} from "../drizzle/schema";
import { ensureStoreOwnersTable, recordStoreOwner, storeVisibleToMember } from "./storeAccess";
import { todayInZone, addDays } from "../shared/expiry";
import { ENTITLEMENT_KEYS, PLAN_FEATURES, type EntitlementKey, type PermissionMode } from "../shared/entitlements";
import { stores as operationalStores, routes as operationalRoutes, visits as operationalVisits, weeklyRouteSchedules, inventoryProducts } from "../drizzle/schema";
let _db: ReturnType<typeof drizzle> | null = null;
let _dbUrl: string | null = null;
let _pool: mysql.Pool | null = null;

function monitoredPool(pool: mysql.Pool): mysql.Pool {
  const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 1000);
  return new Proxy(pool as object, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if ((property !== "query" && property !== "execute") || typeof value !== "function") return value;
      return (...args: any[]) => {
        const startedAt = Date.now();
        const result = value.apply(target, args);
        if (!result || typeof result.finally !== "function") return result;
        return result.finally(() => {
          const elapsed = Date.now() - startedAt;
          if (elapsed >= slowQueryMs) console.warn(`[Database] Slow query: ${elapsed}ms`);
        });
      };
    },
  }) as mysql.Pool;
}

export async function getPool() {
  await getDb();
  return _pool;
}

export async function getDb() {
  const databaseUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[Database] EXTERNAL_DATABASE_URL is not set");
    return null;
  }
  if (_db && _dbUrl !== databaseUrl) {
    await _pool?.end().catch(() => undefined);
    _pool = null;
    _db = null;
    _dbUrl = null;
  }
  if (!_db) {
    try {
      // TiDB Cloud / managed MySQL: TLS required; keep pool small and with keep-alive
      // to avoid dropped idle connections behind cloud gateways.
      _pool = monitoredPool(mysql.createPool({
        uri: databaseUrl,
        ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" as any },
        connectionLimit: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 10)),
        queueLimit: Math.max(0, Number(process.env.DB_QUEUE_LIMIT || 100)),
        connectTimeout: Math.max(1000, Number(process.env.DB_CONNECT_TIMEOUT_MS || 15000)),
        enableKeepAlive: true,
        keepAliveInitialDelay: Math.max(1000, Number(process.env.DB_KEEP_ALIVE_MS || 10000)),
        waitForConnections: true,
        idleTimeout: 60000,
        maxIdle: 2,
      }));
      // Fail fast if credentials/network are wrong instead of serving a broken pool
      const probe = await (_pool as mysql.Pool).query("SELECT 1 AS ok");
      if (!probe) throw new Error("Database probe returned empty result");
      _db = drizzle(_pool as any) as ReturnType<typeof drizzle>;
      _dbUrl = databaseUrl;
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.error("[Database] Failed to connect:", error instanceof Error ? error.message : error);
      await _pool?.end().catch(() => undefined);
      _pool = null;
      _db = null;
      _dbUrl = null;
    }
  }
  return _db;
}

function requireAccountId(accountId: number | undefined): number {
  if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0) throw new Error("Tenant comercial obrigatório");
  return accountId;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = values.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

/* Plataforma */
export async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companies).orderBy(companies.name);
}

export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}

export async function createCompany(name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(companies).values({ name: name.trim(), active: true });
  return Number(result[0].insertId);
}

export async function updateCompany(id: number, data: { name?: string; active?: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set({ ...data, name: data.name?.trim() }).where(eq(companies.id, id));
}

let _trashTableReady: Promise<void> | null = null;
/** Garante que a tabela da lixeira existe: nenhuma migração do projeto a cria, e sem ela toda exclusão falha. */
export async function ensureTrashTable(): Promise<void> {
  if (_trashTableReady) return _trashTableReady;
  _trashTableReady = (async () => {
    const database = await getDb();
    if (!database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS trash_items (
      id int AUTO_INCREMENT NOT NULL,
      accountId int NOT NULL,
      itemType varchar(40) NOT NULL,
      originalId int NOT NULL,
      label varchar(255) NOT NULL,
      snapshot text NOT NULL,
      deletedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt timestamp NOT NULL,
      deletedByMemberId int NULL,
      deletedByName varchar(255) NULL,
      ownerMemberId int NULL,
      PRIMARY KEY (id),
      KEY trash_items_account_expiry_idx (accountId, expiresAt),
      KEY trash_items_account_deleted_idx (accountId, deletedAt)
    )`);
    const [cols]: any = await database.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trash_items'`);
    const have = new Set((cols as any[]).map((c) => String(c.COLUMN_NAME ?? c.column_name).toLowerCase()));
    if (!have.has("deletedbymemberid")) await database.execute(`ALTER TABLE trash_items ADD COLUMN deletedByMemberId int NULL`);
    if (!have.has("deletedbyname")) await database.execute(`ALTER TABLE trash_items ADD COLUMN deletedByName varchar(255) NULL`);
    if (!have.has("ownermemberid")) await database.execute(`ALTER TABLE trash_items ADD COLUMN ownerMemberId int NULL`);
  })().catch((error) => {
    _trashTableReady = null; // tenta de novo na próxima chamada
    throw error;
  });
  return _trashTableReady;
}

/** Apaga da lixeira os itens vencidos; fotos vencidas também têm o arquivo removido do armazenamento. */
async function purgeExpiredTrash(database: NonNullable<Awaited<ReturnType<typeof getDb>>>, accountId?: number) {
  const expiredWhere = accountId != null
    ? and(eq(trashItems.accountId, accountId), sql`${trashItems.expiresAt} <= NOW()`)
    : sql`${trashItems.expiresAt} <= NOW()`;
  const expiredPhotos = await database.select().from(trashItems).where(and(eq(trashItems.itemType, "store_photo"), expiredWhere));
  if (expiredPhotos.length) {
    const { storageDelete } = await import("./storage");
    for (const item of expiredPhotos) await deletePhotoFiles(item.snapshot, storageDelete);
  }
  return database.delete(trashItems).where(expiredWhere);
}

async function deletePhotoFiles(snapshot: string, storageDelete: (key: string) => Promise<boolean>) {
  try {
    const photo = JSON.parse(snapshot);
    if (photo?.fileKey) await storageDelete(photo.fileKey);
    if (photo?.thumbnailKey) await storageDelete(photo.thumbnailKey);
  } catch (error) {
    console.warn("[trash] não foi possível remover o arquivo da foto", error);
  }
}

/** scopeMemberId=null: administrador (tudo da empresa). Número: só itens que o usuário apagou ou que são dele. */
function trashScope(accountId: number, scopeMemberId?: number | null) {
  const base = eq(trashItems.accountId, accountId);
  if (scopeMemberId == null) return base;
  return and(base, or(eq(trashItems.deletedByMemberId, scopeMemberId), eq(trashItems.ownerMemberId, scopeMemberId)))!;
}

export async function listTrash(accountId: number, scopeMemberId?: number | null) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  await ensureTrashTable();
  await purgeExpiredTrash(db, tenant);
  return await db.select().from(trashItems).where(and(trashScope(tenant, scopeMemberId), sql`${trashItems.expiresAt} > NOW()`)).orderBy(desc(trashItems.deletedAt));
}

export async function cleanupExpiredData() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const [trashResult, memberResult, platformResult] = await Promise.all([
    purgeExpiredTrash(db),
    db.delete(memberSessions).where(sql`${memberSessions.expiresAt} <= NOW()`),
    db.delete(platformSessions).where(sql`${platformSessions.expiresAt} <= NOW()`),
  ]);
  return {
    trash: Number(trashResult[0]?.affectedRows || 0),
    memberSessions: Number(memberResult[0]?.affectedRows || 0),
    platformSessions: Number(platformResult[0]?.affectedRows || 0),
  };
}

function parseTrashSnapshot(snapshot: string): any {
  try {
    return JSON.parse(snapshot);
  } catch {
    throw new Error("O item da lixeira está corrompido e não pode ser restaurado.");
  }
}

function restoreDateFields<T extends Record<string, any>>(value: T): T {
  const restored: Record<string, any> = { ...value };
  for (const key of ["createdAt", "updatedAt", "capturedAt", "expiresAt"] as const) {
    if (restored[key] && !(restored[key] instanceof Date)) restored[key] = new Date(restored[key]);
  }
  return restored as T;
}

export async function restoreTrashItem(id: number, accountId: number, scopeMemberId?: number | null) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and(eq(trashItems.id, id), trashScope(tenant, scopeMemberId))).limit(1))[0];
  if (!item) throw new Error("Item não encontrado na lixeira ou sem permissão.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
    throw new Error("O prazo de restauração deste item expirou.");
  }

  const snapshot = parseTrashSnapshot(item.snapshot);
  await db.transaction(async (tx) => {
    if (item.itemType === "product") {
      const existing = await tx.select({ id: inventoryProducts.id }).from(inventoryProducts).where(and(eq(inventoryProducts.id, item.originalId), eq(inventoryProducts.companyId, tenant))).limit(1);
      if (existing[0]) throw new Error("Já existe um produto com esse identificador. Não foi possível restaurar.");
      await tx.insert(inventoryProducts).values({ ...restoreDateFields(snapshot), id: item.originalId, companyId: tenant } as any);
    } else if (item.itemType === "store_photo") {
      const existing = await tx.select({ id: storePhotos.id }).from(storePhotos).where(and(eq(storePhotos.id, item.originalId), eq(storePhotos.companyId, tenant))).limit(1);
      if (existing[0]) throw new Error("Esta foto já existe na galeria. Não foi possível restaurar.");
      const restored = restoreDateFields(snapshot);
      // Foto restaurada não pode ser apagada de imediato pela rotina de retenção.
      const minExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const expiresAt = new Date(Math.max(restored.expiresAt ? new Date(restored.expiresAt).getTime() : 0, minExpiry));
      await tx.insert(storePhotos).values({ ...restored, id: item.originalId, companyId: tenant, expiresAt } as any);
      const restoredClientId = Number((restored as any).storeClientId);
      if (Number.isInteger(restoredClientId) && restoredClientId > 0) {
        try {
          // Só religa se o cliente ainda existe nesta loja/empresa.
          await tx.execute(sql`UPDATE store_photos SET storeClientId = ${restoredClientId} WHERE id = ${item.originalId} AND companyId = ${tenant} AND EXISTS (SELECT 1 FROM store_clients c WHERE c.id = ${restoredClientId} AND c.companyId = ${tenant} AND c.storeId = store_photos.storeId)`);
        } catch { /* coluna/tabela ausente: foto restaurada sem cliente */ }
      }
    } else {
      throw new Error("Tipo de item da lixeira não reconhecido.");
    }
    await tx.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  });
  return { itemType: item.itemType, label: item.label, originalId: item.originalId };
}

export async function permanentlyDeleteTrashItem(id: number, accountId: number, scopeMemberId?: number | null) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and(eq(trashItems.id, id), trashScope(tenant, scopeMemberId))).limit(1))[0];
  if (!item) throw new Error("Item não encontrado na lixeira ou sem permissão.");
  const result = await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  if (!result[0]?.affectedRows) throw new Error("Item não encontrado na lixeira ou sem permissão.");
  if (item?.itemType === "store_photo") {
    const { storageDelete } = await import("./storage");
    await deletePhotoFiles(item.snapshot, storageDelete);
  }
  return { itemType: item.itemType, label: item.label, originalId: item.originalId };
}

/* Configuração por empresa */
export async function getSetting(key: string, accountId: number, defaultValue = "30") {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(systemSettings).where(and(eq(systemSettings.settingKey, key), eq(systemSettings.accountId, tenant))).limit(1);
  return result[0]?.settingValue ?? defaultValue;
}

export async function setSetting(key: string, value: string, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({ accountId: tenant, settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}

/* Planos e permissões comerciais */
function isMissingEntitlementsTable(error: any) {
  const code = error?.code ?? error?.cause?.code;
  const message = String(error?.sqlMessage ?? error?.message ?? "");
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR" || /unknown table|does not exist|doesn't exist/i.test(message);
}

async function replaceSubscriptionPlanFeatures(database: any, planId: number, featureKeys: readonly EntitlementKey[]) {
  const enabled = new Set(featureKeys);
  const rows = ENTITLEMENT_KEYS.map((featureKey) => ({ planId, featureKey, enabled: enabled.has(featureKey) }));
  await database.transaction(async (tx: any) => {
    await tx.delete(subscriptionPlanFeatures).where(eq(subscriptionPlanFeatures.planId, planId));
    await tx.insert(subscriptionPlanFeatures).values(rows);
  });
}

async function attachPlanFeatureKeys(database: any, plans: any[]) {
  if (!plans.length) return plans;
  let featureRows: any[] = [];
  try {
    featureRows = await database.select({ planId: subscriptionPlanFeatures.planId, featureKey: subscriptionPlanFeatures.featureKey, enabled: subscriptionPlanFeatures.enabled })
      .from(subscriptionPlanFeatures)
      .where(inArray(subscriptionPlanFeatures.planId, plans.map((plan) => Number(plan.id))));
  } catch (error) {
    if (!isMissingEntitlementsTable(error)) throw error;
  }
  const byPlan = new Map<number, any[]>();
  for (const row of featureRows ?? []) {
    const values = byPlan.get(Number(row.planId)) ?? [];
    values.push(row);
    byPlan.set(Number(row.planId), values);
  }
  return plans.map((plan) => {
    const stored = byPlan.get(Number(plan.id));
    const featureKeys = (stored ?? []).filter((row) => Boolean(row.enabled)).map((row) => row.featureKey as EntitlementKey);
    return { ...plan, featureKeys };
  });
}

export async function getCompanyFeatureOverrides(companyId: number): Promise<Partial<Record<EntitlementKey, boolean>>> {
  const database = await getDb();
  if (!database) return {};
  try {
    const rows = await database.select({ featureKey: companyFeatureOverrides.featureKey, enabled: companyFeatureOverrides.enabled })
      .from(companyFeatureOverrides).where(eq(companyFeatureOverrides.companyId, companyId));
    return Object.fromEntries(rows.filter((row) => (ENTITLEMENT_KEYS as readonly string[]).includes(row.featureKey)).map((row) => [row.featureKey, Boolean(row.enabled)])) as Partial<Record<EntitlementKey, boolean>>;
  } catch (error) {
    if (isMissingEntitlementsTable(error)) return {};
    throw error;
  }
}

export async function getMemberFeatureModes(memberAccountId: number, companyId: number): Promise<Partial<Record<EntitlementKey, PermissionMode>>> {
  const database = await getDb();
  if (!database) return {};
  const account = await database.select({ id: entitlementMemberAccounts.id }).from(entitlementMemberAccounts)
    .where(and(eq(entitlementMemberAccounts.id, memberAccountId), eq(entitlementMemberAccounts.companyId, companyId))).limit(1);
  if (!account[0]) return {};
  try {
    const rows = await database.select({ featureKey: memberFeaturePermissions.featureKey, mode: memberFeaturePermissions.mode })
      .from(memberFeaturePermissions).where(eq(memberFeaturePermissions.memberAccountId, memberAccountId));
    return Object.fromEntries(rows.filter((row) => (ENTITLEMENT_KEYS as readonly string[]).includes(row.featureKey)).map((row) => [row.featureKey, row.mode])) as Partial<Record<EntitlementKey, PermissionMode>>;
  } catch (error) {
    if (isMissingEntitlementsTable(error)) return {};
    throw error;
  }
}

export async function replaceCompanyFeatureOverrides(input: {
  companyId: number;
  overrides: Partial<Record<EntitlementKey, boolean | null>>;
  updatedByPlatformAdminId: number | null;
  reason?: string | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const rows = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const enabled = input.overrides[featureKey];
    return enabled == null ? [] : [{ companyId: input.companyId, featureKey, enabled, reason: input.reason ?? null, updatedByPlatformAdminId: input.updatedByPlatformAdminId }];
  });
  await database.transaction(async (tx: any) => {
    await tx.delete(companyFeatureOverrides).where(eq(companyFeatureOverrides.companyId, input.companyId));
    if (rows.length) await tx.insert(companyFeatureOverrides).values(rows);
  });
  return { success: true as const };
}

export async function replaceMemberFeatureModes(input: {
  memberAccountId: number;
  modes: Partial<Record<EntitlementKey, PermissionMode>>;
  updatedByMemberAccountId: number | null;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const rows = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const mode = input.modes[featureKey];
    return !mode || mode === "inherit" ? [] : [{ memberAccountId: input.memberAccountId, featureKey, mode, updatedByMemberAccountId: input.updatedByMemberAccountId }];
  });
  await database.transaction(async (tx: any) => {
    await tx.delete(memberFeaturePermissions).where(eq(memberFeaturePermissions.memberAccountId, input.memberAccountId));
    if (rows.length) await tx.insert(memberFeaturePermissions).values(rows);
  });
  return { success: true as const };
}

export async function listSubscriptionPlans() {
  const database = await getDb();
  if (!database) return [];
  const plans = await database.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
  return attachPlanFeatureKeys(database, plans);
}

export async function createSubscriptionPlan(data: {
  name: string;
  description?: string | null;
  price: string;
  billingCycle: "monthly" | "yearly";
  maxUsers?: number | null;
  maxClients?: number | null;
  maxExtinguishers?: number | null;
  featureKeys: EntitlementKey[];
  availableForNew?: boolean;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const { featureKeys, ...planFields } = data;
  const [result] = await database.insert(subscriptionPlans).values({
    ...planFields,
    description: data.description ?? null,
    maxUsers: data.maxUsers ?? null,
    maxClients: data.maxClients ?? null,
    maxExtinguishers: data.maxExtinguishers ?? null,
    availableForNew: data.availableForNew ?? true,
    active: true,
  });
  const id = Number((result as any).insertId);
  await replaceSubscriptionPlanFeatures(database, id, featureKeys);
  return { id };
}

export async function updateSubscriptionPlan(id: number, data: Partial<{
  name: string;
  description: string | null;
  price: string;
  billingCycle: "monthly" | "yearly";
  maxUsers: number | null;
  maxClients: number | null;
  maxExtinguishers: number | null;
  featureKeys: EntitlementKey[];
  availableForNew: boolean;
  active: boolean;
}>) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const { featureKeys, ...planFields } = data;
  if (Object.keys(planFields).length) {
    await database.update(subscriptionPlans).set(planFields).where(eq(subscriptionPlans.id, id));
  }
  if (featureKeys !== undefined) await replaceSubscriptionPlanFeatures(database, id, featureKeys);
  return { success: true as const };
}

export async function listCompanySubscriptions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: companySubscriptions.id,
      companyId: companySubscriptions.companyId,
      planId: companySubscriptions.planId,
      status: companySubscriptions.status,
      startsAt: companySubscriptions.startsAt,
      endsAt: companySubscriptions.endsAt,
      notes: companySubscriptions.notes,
      createdAt: companySubscriptions.createdAt,
      companyName: companies.name,
      planName: subscriptionPlans.name,
      planPrice: subscriptionPlans.price,
      billingCycle: subscriptionPlans.billingCycle,
      maxUsers: subscriptionPlans.maxUsers,
      maxClients: subscriptionPlans.maxClients,
      maxExtinguishers: subscriptionPlans.maxExtinguishers,
    })
    .from(companySubscriptions)
    .innerJoin(companies, eq(companySubscriptions.companyId, companies.id))
    .innerJoin(subscriptionPlans, eq(companySubscriptions.planId, subscriptionPlans.id))
    .orderBy(desc(companySubscriptions.createdAt));
  return rows;
}

export async function getSubscriptionStats() {
  const db = await getDb();
  if (!db) return { registered: 0, activeOrTest: 0, suspended: 0, nearExpiry: 0 };
  const all = await db.select().from(companySubscriptions);
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  let activeOrTest = 0;
  let suspended = 0;
  let nearExpiry = 0;
  for (const s of all) {
    if (s.status === "active" || s.status === "test") activeOrTest += 1;
    if (s.status === "suspended") suspended += 1;
    if (s.endsAt && (s.status === "active" || s.status === "test")) {
      const end = new Date(s.endsAt);
      if (end >= now && end <= in30) nearExpiry += 1;
    }
  }
  return { registered: all.length, activeOrTest, suspended, nearExpiry };
}

export async function createCompanySubscription(data: {
  companyId: number;
  planId: number;
  status: "trial" | "active" | "pending" | "overdue" | "suspended" | "canceled" | "test" | "expired";
  startsAt: string;
  endsAt?: string | null;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(companySubscriptions).values(({
    companyId: data.companyId,
    planId: data.planId,
    status: data.status,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
    notes: data.notes ?? null,
  } as any));
  // Mantém companies.planId / status alinhados com a assinatura vigente
  await db.update(companies).set({
    planId: data.planId,
    subscriptionStatus: data.status,
    subscriptionStartedAt: new Date(data.startsAt),
    subscriptionExpiresAt: data.endsAt ? new Date(data.endsAt) : null,
  } as any).where(eq(companies.id, data.companyId));
  return { id: Number((result as any).insertId) };
}

export async function updateCompanySubscription(id: number, data: Partial<{
  planId: number;
  status: "trial" | "active" | "pending" | "overdue" | "suspended" | "canceled" | "test" | "expired";
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companySubscriptions).set(data as any).where(eq(companySubscriptions.id, id));
  // Sincroniza empresa quando o admin altera a assinatura
  const rows = await db.select().from(companySubscriptions).where(eq(companySubscriptions.id, id)).limit(1);
  const sub = rows[0];
  if (sub) {
    const patch: Record<string, unknown> = {};
    if (data.planId !== undefined) patch.planId = data.planId;
    if (data.status !== undefined) patch.subscriptionStatus = data.status;
    if (data.endsAt !== undefined) patch.subscriptionExpiresAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.startsAt !== undefined) patch.subscriptionStartedAt = new Date(data.startsAt);
    if (Object.keys(patch).length) {
      await db.update(companies).set(patch as any).where(eq(companies.id, sub.companyId));
    }
  }
  return { success: true as const };
}

// --- Billing / Asaas helpers ---

export async function getSubscriptionPlanById(planId: number) {
  const database = await getDb();
  if (!database) return null;
  const rows = await database.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  return (await attachPlanFeatureKeys(database, rows))[0] ?? null;
}

/** Resolve plano da empresa: assinatura vigente → companies.planId → auto-cura. */
export async function resolveCompanyPlan(companyId: number) {
  const db = await getDb();
  if (!db) return { company: null, subscription: null, plan: null as any };
  const companyRows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const company = companyRows[0] ?? null;
  const sub = await getLatestCompanySubscription(companyId);
  let planId = sub?.planId ?? company?.planId ?? null;
  let plan = planId ? await getSubscriptionPlanById(Number(planId)) : null;

  // Se a assinatura tem plano mas a empresa não, alinha (auto-cura)
  if (company && sub?.planId && !company.planId) {
    try {
      await db.update(companies).set({
        planId: sub.planId,
        subscriptionStatus: (sub.status as any) || company.subscriptionStatus,
      } as any).where(eq(companies.id, companyId));
      (company as any).planId = sub.planId;
    } catch {
      /* ignore heal errors */
    }
  }
  // Empresa tem planId mas sem linha de assinatura legível: ainda devolve o plano
  if (!plan && company?.planId) {
    plan = await getSubscriptionPlanById(Number(company.planId));
  }
  return { company, subscription: sub, plan };
}

/** Assinatura vigente preferencial; se não houver, a mais recente. */
export async function getLatestCompanySubscription(companyId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(companySubscriptions)
    .where(eq(companySubscriptions.companyId, companyId))
    .orderBy(desc(companySubscriptions.createdAt));
  if (!rows.length) return null;
  const preferred = rows.find((r) =>
    ["active", "trial", "test", "pending", "overdue"].includes(String(r.status)),
  );
  return preferred ?? rows[0];
}

export async function updateCompanySubscriptionFields(
  companyId: number,
  data: Partial<{
    planId: number | null;
    subscriptionStatus: "trial" | "active" | "pending" | "overdue" | "suspended" | "canceled" | "test" | "expired" | null;
    asaasCustomerId: string | null;
    asaasSubscriptionId: string | null;
    subscriptionStartedAt: Date | null;
    subscriptionExpiresAt: Date | null;
    trialEndsAt: Date | null;
    gracePeriodEndsAt: Date | null;
  }>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set(data as any).where(eq(companies.id, companyId));
  return { success: true as const };
}

export async function listPaymentsForCompany(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.companyId, companyId)).orderBy(desc(payments.createdAt));
}

export async function listAllPayments(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: payments.id,
      companyId: payments.companyId,
      subscriptionId: payments.subscriptionId,
      amount: payments.amount,
      netAmount: payments.netAmount,
      billingType: payments.billingType,
      status: payments.status,
      dueDate: payments.dueDate,
      paymentDate: payments.paymentDate,
      createdAt: payments.createdAt,
      companyName: companies.name,
    })
    .from(payments)
    .innerJoin(companies, eq(payments.companyId, companies.id))
    .orderBy(desc(payments.createdAt))
    .limit(limit);
}

export async function createPaymentRecord(data: {
  companyId: number;
  subscriptionId?: number | null;
  asaasPaymentId?: string | null;
  asaasCustomerId?: string | null;
  asaasSubscriptionId?: string | null;
  amount: string;
  netAmount?: string | null;
  billingType?: "BOLETO" | "CREDIT_CARD" | "PIX" | "UNDEFINED" | "MOCK";
  status?: "PENDING" | "CONFIRMED" | "RECEIVED" | "OVERDUE" | "REFUNDED" | "DELETED" | "MOCK_APPROVED" | "MOCK_PENDING" | "MOCK_OVERDUE";
  dueDate?: string | null;
  paymentDate?: string | null;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(payments).values({
    companyId: data.companyId,
    subscriptionId: data.subscriptionId ?? null,
    asaasPaymentId: data.asaasPaymentId ?? null,
    asaasCustomerId: data.asaasCustomerId ?? null,
    asaasSubscriptionId: data.asaasSubscriptionId ?? null,
    amount: data.amount,
    netAmount: data.netAmount ?? null,
    billingType: data.billingType ?? "MOCK",
    status: data.status ?? "PENDING",
    dueDate: data.dueDate ?? null,
    paymentDate: data.paymentDate ?? null,
    invoiceUrl: data.invoiceUrl ?? null,
    bankSlipUrl: data.bankSlipUrl ?? null,
  } as any);
  return { id: Number((result as any).insertId) };
}

export async function findPaymentEventByEventId(eventId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(paymentEvents).where(eq(paymentEvents.eventId, eventId)).limit(1);
  return rows[0] ?? null;
}

export async function recordPaymentEvent(data: {
  eventId: string;
  event: string;
  paymentId?: number | null;
  subscriptionId?: number | null;
  payload: string;
  processed?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await findPaymentEventByEventId(data.eventId);
  if (existing) return { id: existing.id, duplicate: true as const };
  const [result] = await db.insert(paymentEvents).values({
    eventId: data.eventId,
    event: data.event,
    paymentId: data.paymentId ?? null,
    subscriptionId: data.subscriptionId ?? null,
    payload: data.payload,
    processed: data.processed ?? true,
  });
  return { id: Number((result as any).insertId), duplicate: false as const };
}

export async function listAvailablePlansForCompanies() {
  const plans = await listSubscriptionPlans();
  return plans.filter((plan: any) => plan.active && plan.availableForNew).sort((a: any, b: any) => Number(a.price) - Number(b.price));
}

export async function applyMockCheckout(input: {
  companyId: number;
  planId: number;
  outcome: "approved" | "pending" | "overdue" | "canceled";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const planRows = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1);
  const plan = planRows[0];
  if (!plan) throw new Error("Plano não encontrado");

  const today = new Date();
  const ymd = today.toISOString().slice(0, 10);
  const periodDays = plan.billingCycle === "yearly" ? 365 : 30;
  const periodEnd = new Date(today.getTime() + periodDays * 24 * 3600 * 1000);
  const periodEndYmd = periodEnd.toISOString().slice(0, 10);
  const grace = new Date(periodEnd.getTime() + 3 * 24 * 3600 * 1000);

  const statusMap = {
    approved: "active" as const,
    pending: "pending" as const,
    overdue: "overdue" as const,
    canceled: "canceled" as const,
  };
  // Usa status padrão do enum (CONFIRMED/PENDING/…) para não depender de valores MOCK_*
  // caso a coluna no TiDB ainda não tenha sido migrada com os enums de mock.
  const payStatusMap = {
    approved: "CONFIRMED" as const,
    pending: "PENDING" as const,
    overdue: "OVERDUE" as const,
    canceled: "DELETED" as const,
  };

  const subStatus = statusMap[input.outcome];
  const [subResult] = await db.insert(companySubscriptions).values({
    companyId: input.companyId,
    planId: input.planId,
    status: subStatus,
    startsAt: ymd,
    endsAt: periodEndYmd,
    billingInterval: plan.billingCycle,
    amount: plan.price,
    currentPeriodStart: ymd,
    currentPeriodEnd: periodEndYmd,
    gracePeriodEndsAt: grace.toISOString().slice(0, 10),
    cancelAtPeriodEnd: input.outcome === "canceled",
    canceledAt: input.outcome === "canceled" ? today : null,
    asaasCustomerId: `cus_mock_${input.companyId}`,
    asaasSubscriptionId: `sub_mock_${input.companyId}_${Date.now()}`,
    notes: `Mock checkout: ${input.outcome}`,
  } as any);
  const subscriptionId = Number((subResult as any).insertId);

  let paymentId = 0;
  try {
    const [payResult] = await db.insert(payments).values({
      companyId: input.companyId,
      subscriptionId: subscriptionId || null,
      asaasPaymentId: `pay_mock_${Date.now()}`,
      asaasCustomerId: `cus_mock_${input.companyId}`,
      asaasSubscriptionId: `sub_mock_${input.companyId}`,
      amount: String(plan.price ?? "0.00"),
      netAmount: String(plan.price ?? "0.00"),
      billingType: "UNDEFINED",
      status: payStatusMap[input.outcome],
      dueDate: ymd,
      paymentDate: input.outcome === "approved" ? ymd : null,
      invoiceUrl: "https://mock.local/invoice",
      bankSlipUrl: null,
    } as any);
    paymentId = Number((payResult as any).insertId) || 0;
  } catch (payErr) {
    // Não bloqueia a troca de plano se o histórico de pagamento falhar (schema legado).
    console.warn("[mockCheckout] payment insert skipped:", payErr);
  }

  await db.update(companies).set({
    planId: input.planId,
    subscriptionStatus: subStatus,
    asaasCustomerId: `cus_mock_${input.companyId}`,
    asaasSubscriptionId: `sub_mock_${input.companyId}`,
    subscriptionStartedAt: today,
    subscriptionExpiresAt: periodEnd,
    gracePeriodEndsAt: grace,
  } as any).where(eq(companies.id, input.companyId));

  return { subscriptionId, paymentId, status: subStatus };
}

export async function ensureSeedPlans() {
  const database = await getDb();
  if (!database) return;

  const catalog = [
    {
      name: "Start",
      description: "Ideal para quem está começando",
      price: "59.90",
      billingCycle: "monthly" as const,
      maxUsers: 1,
      maxClients: 1000,
      maxExtinguishers: 3000,
      featureKeys: [...PLAN_FEATURES.start],
      availableForNew: true,
      active: true,
    },
    {
      name: "Profissional",
      description: "Para equipes em operação",
      price: "99.90",
      billingCycle: "monthly" as const,
      maxUsers: 5,
      maxClients: null,
      maxExtinguishers: 10000,
      featureKeys: [...PLAN_FEATURES.profissional],
      availableForNew: true,
      active: true,
    },
    {
      name: "Empresarial",
      description: "Para operação maior e crescimento",
      price: "169.90",
      billingCycle: "monthly" as const,
      maxUsers: 10,
      maxClients: null,
      maxExtinguishers: null,
      featureKeys: [...PLAN_FEATURES.empresarial],
      availableForNew: true,
      active: true,
    },
  ];

  const existing = await database.select().from(subscriptionPlans);
  const byName = new Map(existing.map((p) => [String(p.name).toLowerCase().trim(), p]));

  for (const plan of catalog) {
    const key = plan.name.toLowerCase();
    const row = byName.get(key);
    if (row) continue;
    const { featureKeys, ...planFields } = plan;
    const [result] = await database.insert(subscriptionPlans).values(planFields);
    const id = Number((result as any).insertId);
    if (id) {
      try {
        await replaceSubscriptionPlanFeatures(database, id, featureKeys);
      } catch (error) {
        if (!isMissingEntitlementsTable(error)) throw error;
      }
    }
  }
}


/* Núcleo operacional de promotores — usa as tabelas novas e permanece separado do legado. */
/** `memberAccountId` = usuário não administrador: só vê lojas que cadastrou ou que estão em visitas atribuídas a ele. */
export async function listOperationalStores(companyId: number, search?: string, memberAccountId?: number | null) {
  const database = await getDb();
  if (!database) return [];
  const conditions: any[] = [eq(operationalStores.companyId, requireAccountId(companyId)), eq(operationalStores.active, true)];
  if (search?.trim()) conditions.push(like(operationalStores.name, `%${search.trim()}%`));
  if (memberAccountId != null) {
    await ensureStoreOwnersTable(database);
    conditions.push(storeVisibleToMember(operationalStores.id, memberAccountId));
  }
  return database.select().from(operationalStores).where(and(...conditions)).orderBy(operationalStores.name);
}

export async function createOperationalStore(input: typeof operationalStores.$inferInsert, ownerMemberAccountId?: number | null) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(operationalStores).values(input);
  const storeId = Number((result as any)[0]?.insertId);
  // Registra quem cadastrou a loja (define quem poderá vê-la, além do administrador).
  if (ownerMemberAccountId) await recordStoreOwner(database, { storeId, companyId: input.companyId, memberAccountId: ownerMemberAccountId });
  const rows = await database.select().from(operationalStores).where(eq(operationalStores.id, storeId)).limit(1);
  return rows[0];
}

export async function listOperationalRoutes(companyId: number, options: { date?: string; promoterId?: number } = {}) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(operationalRoutes.companyId, requireAccountId(companyId))];
  if (options.date) conditions.push(eq(operationalRoutes.date, options.date as any));
  if (options.promoterId) conditions.push(eq(operationalRoutes.promoterId, options.promoterId));
  return database.select().from(operationalRoutes).where(and(...conditions)).orderBy(desc(operationalRoutes.date), desc(operationalRoutes.id));
}

export async function listWeeklyRouteSchedules(companyId: number) {
  const database = await getDb();
  if (!database) return [];
  return database.select().from(weeklyRouteSchedules)
    .where(eq(weeklyRouteSchedules.companyId, requireAccountId(companyId)))
    .orderBy(weeklyRouteSchedules.weekday, weeklyRouteSchedules.promoterId);
}
export async function saveWeeklyRouteSchedule(input: { companyId: number; promoterId: number; weekday: number; name: string; storeIds: number[] }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const companyId = requireAccountId(input.companyId);
  const storeIds = [...new Set(input.storeIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!storeIds.length) throw new Error("Selecione ao menos uma loja.");
  return database.transaction(async (tx) => {
    const stores = await tx.select({ id: operationalStores.id }).from(operationalStores)
      .where(and(inArray(operationalStores.id, storeIds), eq(operationalStores.companyId, companyId), eq(operationalStores.active, true)));
    if (stores.length !== storeIds.length) throw new Error("Uma ou mais lojas não pertencem a esta empresa.");
    await tx.insert(weeklyRouteSchedules).values({ ...input, companyId, storeIds, active: true })
      .onDuplicateKeyUpdate({ set: { name: input.name, storeIds, active: true } });
    // Remove roteiro materializado de hoje para que seja recriado com as novas lojas
    const today = new Date().toISOString().slice(0, 10);
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    if (weekday === input.weekday) {
      const existing = await tx.select({ id: operationalRoutes.id }).from(operationalRoutes).where(and(
        eq(operationalRoutes.companyId, companyId), eq(operationalRoutes.promoterId, input.promoterId), eq(operationalRoutes.date, today as any),
      ));
      for (const route of existing) {
        await tx.delete(operationalVisits).where(eq(operationalVisits.routeId, route.id));
        await tx.delete(operationalRoutes).where(eq(operationalRoutes.id, route.id));
      }
    }
    return (await tx.select().from(weeklyRouteSchedules).where(and(
      eq(weeklyRouteSchedules.companyId, companyId), eq(weeklyRouteSchedules.promoterId, input.promoterId), eq(weeklyRouteSchedules.weekday, input.weekday),
    )).limit(1))[0];
  });
}

export async function updatePromoterManagement(input: {
  companyId: number;
  promoterId: number;
  userName: string;
  email: string;
  employeeCode: string | null;
  workStartTime: string | null;
  workEndTime: string | null;
  weeklyRoutes?: Array<{ weekday: number; storeIds: number[] }>;
}) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const companyId = requireAccountId(input.companyId);
  const promoter = await database.select({ id: entitlementMemberAccounts.id })
    .from(entitlementMemberAccounts)
    .where(and(
      eq(entitlementMemberAccounts.id, input.promoterId),
      eq(entitlementMemberAccounts.companyId, companyId),
      eq(entitlementMemberAccounts.role, "promoter"),
    )).limit(1);
  if (!promoter.length) throw new Error("Promotor não pertence a esta empresa.");

  const employeeCode = input.employeeCode?.trim() || null;
  const weeklyRoutes = input.weeklyRoutes;
  if (weeklyRoutes !== undefined) {
    const days = weeklyRoutes.map((route) => route.weekday);
    if (new Set(days).size !== days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error("A programação semanal contém dias inválidos ou repetidos.");
    }
    const storeIds = [...new Set(weeklyRoutes.flatMap((route) => route.storeIds))];
    if (storeIds.length) {
      const stores = await database.select({ id: operationalStores.id }).from(operationalStores).where(and(
        inArray(operationalStores.id, storeIds),
        eq(operationalStores.companyId, companyId),
        eq(operationalStores.active, true),
      ));
      if (stores.length !== storeIds.length) throw new Error("Uma ou mais lojas não pertencem a esta empresa ou estão inativas.");
    }
    if (weeklyRoutes.some((route) => !route.storeIds.length)) throw new Error("Cada dia programado precisa ter ao menos uma loja.");
  }

  await database.transaction(async (tx) => {
    await tx.update(memberAccounts).set({ userName: input.userName.trim(), email: input.email.trim().toLowerCase() }).where(and(
      eq(memberAccounts.id, input.promoterId),
      eq(memberAccounts.companyId, companyId),
      eq(memberAccounts.role, "promoter"),
    ));
    await tx.insert(promoterProfiles).values({
      memberAccountId: input.promoterId,
      companyId,
      employeeCode,
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime,
    }).onDuplicateKeyUpdate({ set: { companyId, employeeCode, workStartTime: input.workStartTime, workEndTime: input.workEndTime } });

    if (weeklyRoutes === undefined) return;
    const weekdayLabels = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
    for (let weekday = 0; weekday <= 6; weekday++) {
      const schedule = weeklyRoutes.find((route) => route.weekday === weekday);
      const conditions = and(
        eq(weeklyRouteSchedules.companyId, companyId),
        eq(weeklyRouteSchedules.promoterId, input.promoterId),
        eq(weeklyRouteSchedules.weekday, weekday),
      );
      if (!schedule) {
        await tx.delete(weeklyRouteSchedules).where(conditions);
        continue;
      }
      const storeIds = [...new Set(schedule.storeIds)];
      await tx.insert(weeklyRouteSchedules).values({
        companyId,
        promoterId: input.promoterId,
        weekday,
        name: `Roteiro de ${weekdayLabels[weekday]}`,
        storeIds,
        active: true,
      }).onDuplicateKeyUpdate({ set: { name: `Roteiro de ${weekdayLabels[weekday]}`, storeIds, active: true } });
    }
  });
  return { success: true as const };
}

export async function materializeWeeklyRoutes(companyId: number, promoterId: number, dateString: string) {
  const database = await getDb();
  if (!database) return [];
  const company = requireAccountId(companyId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || Number.isNaN(Date.parse(`${dateString}T00:00:00Z`))) return [];
  const weekday = new Date(`${dateString}T00:00:00Z`).getUTCDay();
  const schedules = await database.select().from(weeklyRouteSchedules).where(and(
    eq(weeklyRouteSchedules.companyId, company), eq(weeklyRouteSchedules.promoterId, promoterId), eq(weeklyRouteSchedules.weekday, weekday), eq(weeklyRouteSchedules.active, true),
  ));
  for (const schedule of schedules) {
    try {
      await database.transaction(async (tx) => {
        // Não materializa se já existe qualquer roteiro para essa data/promotor (manual ou semanal)
        const existing = await tx.select({ id: operationalRoutes.id }).from(operationalRoutes).where(and(
          eq(operationalRoutes.companyId, company), eq(operationalRoutes.promoterId, promoterId), eq(operationalRoutes.date, dateString as any),
        )).limit(1);
        if (existing.length) return;
        const storeIds = Array.isArray(schedule.storeIds) ? schedule.storeIds : [];
        if (!storeIds.length) return;
        const stores = await tx.select({ id: operationalStores.id }).from(operationalStores).where(and(
          inArray(operationalStores.id, storeIds), eq(operationalStores.companyId, company), eq(operationalStores.active, true),
        ));
        if (!stores.length) return;
        const inserted = await tx.insert(operationalRoutes).values({
          companyId: company, name: schedule.name, date: dateString as any, promoterId, weeklyScheduleId: schedule.id, status: "assigned",
        });
        const routeId = Number((inserted as any)[0]?.insertId);
        await tx.insert(operationalVisits).values(stores.map((store) => ({ companyId: company, routeId, storeId: store.id, promoterId, status: "pending" as const })));
      });
    } catch (error: any) {
      // Duas requisições simultâneas podem tentar materializar a mesma ocorrência; a chave única torna isso idempotente.
      if (error?.code !== "ER_DUP_ENTRY") throw error;
    }
  }
  return listOperationalRoutes(company, { date: dateString, promoterId });
}
export async function createOperationalRoute(input: typeof operationalRoutes.$inferInsert) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(operationalRoutes).values(input);
  const rows = await database.select().from(operationalRoutes).where(eq(operationalRoutes.id, Number((result as any)[0]?.insertId))).limit(1);
  return rows[0];
}

export async function updateOperationalRoute(companyId: number, routeId: number, data: { name?: string; promoterId?: number; date?: string; storeIds?: number[] }) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  const updates: any = {};
  if (data.name) updates.name = data.name;
  if (data.promoterId) updates.promoterId = data.promoterId;
  if (data.date) updates.date = data.date;
  if (Object.keys(updates).length) {
    await database.update(operationalRoutes).set(updates).where(and(eq(operationalRoutes.id, routeId), eq(operationalRoutes.companyId, companyId)));
  }
  // Update visits promoter if changed
  if (data.promoterId) {
    await database.update(visits).set({ promoterId: data.promoterId }).where(and(eq(visits.routeId, routeId), eq(visits.companyId, companyId)));
  }
  // Update stores if provided
  if (data.storeIds) {
    await database.delete(visits).where(and(eq(visits.routeId, routeId), eq(visits.companyId, companyId)));
    for (const storeId of data.storeIds) {
      await database.insert(visits).values({ companyId, routeId, storeId, promoterId: data.promoterId || 0, status: "pending" });
    }
  }
  return { success: true };
}

export async function deleteOperationalRoute(companyId: number, routeId: number) {
  const database = await getDb();
  if (!database) throw new Error("Database not available");
  // Delete visits first, then route
  await database.delete(visits).where(and(eq(visits.routeId, routeId), eq(visits.companyId, companyId)));
  await database.delete(operationalRoutes).where(and(eq(operationalRoutes.id, routeId), eq(operationalRoutes.companyId, companyId)));
  return { success: true };
}

export async function createOperationalRouteWithVisits(input: { route: typeof operationalRoutes.$inferInsert; storeIds: number[] }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const companyId = requireAccountId(input.route.companyId);
  const uniqueStoreIds = [...new Set(input.storeIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!uniqueStoreIds.length) throw new Error("Selecione ao menos uma loja para o roteiro.");
  return database.transaction(async (tx) => {
    const stores = await tx.select({ id: operationalStores.id }).from(operationalStores)
      .where(and(inArray(operationalStores.id, uniqueStoreIds), eq(operationalStores.companyId, companyId), eq(operationalStores.active, true)));
    if (stores.length !== uniqueStoreIds.length) throw new Error("Uma ou mais lojas não pertencem a esta empresa.");
    const result = await tx.insert(operationalRoutes).values(input.route);
    const routeId = Number((result as any)[0]?.insertId);
    await tx.insert(operationalVisits).values(stores.map((store) => ({ companyId, routeId, storeId: store.id, promoterId: input.route.promoterId, status: "pending" as const })));
    const rows = await tx.select().from(operationalRoutes).where(eq(operationalRoutes.id, routeId)).limit(1);
    return rows[0];
  });
}

export async function listOperationalVisits(companyId: number, options: { date?: string; promoterId?: number; routeId?: number } = {}) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(operationalVisits.companyId, requireAccountId(companyId))];
  if (options.promoterId) conditions.push(eq(operationalVisits.promoterId, options.promoterId));
  if (options.routeId) conditions.push(eq(operationalVisits.routeId, options.routeId));
  if (options.date) conditions.push(eq(operationalRoutes.date, options.date as any));
  const rows = await database.select({ visit: operationalVisits, store: operationalStores })
    .from(operationalVisits)
    .innerJoin(operationalStores, eq(operationalVisits.storeId, operationalStores.id))
    .innerJoin(operationalRoutes, eq(operationalVisits.routeId, operationalRoutes.id))
    .where(and(...conditions))
    .orderBy(operationalVisits.plannedStart, operationalVisits.id);
  return rows;
}

export async function updateOperationalVisit(companyId: number, id: number, data: Partial<typeof operationalVisits.$inferInsert>) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  await database.update(operationalVisits).set(data).where(and(eq(operationalVisits.id, id), eq(operationalVisits.companyId, requireAccountId(companyId))));
  const rows = await database.select({ visit: operationalVisits, store: operationalStores })
    .from(operationalVisits)
    .innerJoin(operationalStores, eq(operationalVisits.storeId, operationalStores.id))
    .where(and(eq(operationalVisits.id, id), eq(operationalVisits.companyId, companyId))).limit(1);
  return rows[0];
}

/* Inventário e validade de produtos isolados por empresa. */
let _inventoryReady: Promise<void> | null = null;
/**
 * Auto-reparo idempotente: o schema passou a ter inventory_products.storeId, mas nenhuma migração o criava,
 * então todo SELECT/INSERT falhava em bancos já existentes. Cria a tabela/coluna só se faltarem; nunca apaga dados.
 */
export async function ensureInventoryProductsSchema(): Promise<void> {
  if (_inventoryReady) return _inventoryReady;
  _inventoryReady = (async () => {
    const database = await getDb();
    if (!database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS inventory_products (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      productCode varchar(64) NOT NULL,
      description varchar(500) NOT NULL,
      quantity int NOT NULL DEFAULT 0,
      expirationDate date NOT NULL,
      price decimal(12,2) NOT NULL DEFAULT 0.00,
      storeId int NULL,
      createdByMemberId int NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY inventory_products_company_idx (companyId),
      KEY inventory_products_code_idx (companyId, productCode),
      KEY inventory_products_expiry_idx (companyId, expirationDate)
    )`);
    const [cols]: any = await database.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_products'`);
    const names = new Set((cols as any[]).map((c) => String(c.COLUMN_NAME ?? c.column_name).toLowerCase()));
    if (!names.has("storeid")) await database.execute(`ALTER TABLE inventory_products ADD COLUMN storeId int NULL`);
    if (!names.has("createdbymemberid")) await database.execute(`ALTER TABLE inventory_products ADD COLUMN createdByMemberId int NULL`);
  })().catch((error) => {
    _inventoryReady = null;
    throw error;
  });
  return _inventoryReady;
}

export type InventoryFilters = { search?: string; expiry?: "all" | "expired" | "near" | "valid"; storeId?: number; from?: string; to?: string };
export async function listInventoryProducts(companyId: number, filters: InventoryFilters = {}) {
  const database = await getDb();
  if (!database) return [];
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  const today = todayInZone();
  const limit = addDays(today, 30);
  const conditions = [eq(inventoryProducts.companyId, company)];
  const search = filters.search?.trim();
  if (search) conditions.push(or(like(inventoryProducts.productCode, `%${search}%`), like(inventoryProducts.description, `%${search}%`))!);
  if (filters.expiry === "expired") conditions.push(sql`${inventoryProducts.expirationDate} < ${today}`);
  if (filters.expiry === "near") conditions.push(sql`${inventoryProducts.expirationDate} >= ${today} AND ${inventoryProducts.expirationDate} <= ${limit}`);
  if (filters.expiry === "valid") conditions.push(sql`${inventoryProducts.expirationDate} > ${limit}`);
  if (filters.storeId) conditions.push(eq(inventoryProducts.storeId, filters.storeId));
  if (filters.from) conditions.push(sql`${inventoryProducts.expirationDate} >= ${filters.from}`);
  if (filters.to) conditions.push(sql`${inventoryProducts.expirationDate} <= ${filters.to}`);
  return database.select().from(inventoryProducts).where(and(...conditions)).orderBy(inventoryProducts.expirationDate, inventoryProducts.description);
}
export async function getInventoryProduct(companyId: number, id: number) {
  const database = await getDb();
  if (!database) return null;
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  return (await database.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, company))).limit(1))[0] ?? null;
}
export async function createInventoryProduct(input: typeof inventoryProducts.$inferInsert) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  await ensureInventoryProductsSchema();
  const companyId = requireAccountId(input.companyId);
  // Evita duplicar em duplo clique/reenvio: mesmo produto, validade, loja e quantidade criado há menos de 60 s.
  const dup = await database.select().from(inventoryProducts).where(and(
    eq(inventoryProducts.companyId, companyId),
    eq(inventoryProducts.productCode, input.productCode),
    sql`${inventoryProducts.expirationDate} = ${input.expirationDate}`,
    input.storeId ? eq(inventoryProducts.storeId, input.storeId) : isNull(inventoryProducts.storeId),
    eq(inventoryProducts.quantity, input.quantity ?? 0),
    sql`${inventoryProducts.createdAt} >= DATE_SUB(NOW(), INTERVAL 60 SECOND)`,
  )).limit(1);
  if (dup[0]) return dup[0];
  const result = await database.insert(inventoryProducts).values({ ...input, companyId });
  const id = Number((result as any)[0]?.insertId);
  return (await database.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, companyId))).limit(1))[0];
}
export async function updateInventoryProduct(companyId: number, id: number, data: Pick<typeof inventoryProducts.$inferInsert, "productCode"|"description"|"quantity"|"expirationDate"|"price"> & { storeId?: number | null }) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  await database.update(inventoryProducts).set(data).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, company)));
  return (await database.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.companyId, company))).limit(1))[0] || null;
}
export type TrashActor = { memberId?: number | null; name?: string | null };
export async function deleteInventoryProducts(companyId: number, ids: number[], actor?: TrashActor) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const tenant = requireAccountId(companyId);
  const uniqueIds = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
  if (!uniqueIds.length) return { deleted: 0 };
  await ensureTrashTable();
  await ensureInventoryProductsSchema();
  return database.transaction(async (tx) => {
    const rows = await tx.select().from(inventoryProducts).where(and(inArray(inventoryProducts.id, uniqueIds), eq(inventoryProducts.companyId, tenant)));
    if (rows.length !== uniqueIds.length) throw new Error("Um ou mais produtos não existem ou não pertencem à sua empresa.");
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    await tx.insert(trashItems).values(rows.map((product) => ({ accountId: tenant, deletedByMemberId: actor?.memberId ?? null, deletedByName: actor?.name ?? null, ownerMemberId: product.createdByMemberId ?? null, itemType: "product", originalId: product.id, label: `${product.description} (${product.productCode})`.slice(0, 255), snapshot: JSON.stringify(product), expiresAt })));
    await tx.delete(inventoryProducts).where(and(inArray(inventoryProducts.id, uniqueIds), eq(inventoryProducts.companyId, tenant)));
    return { deleted: rows.length };
  });
}
export async function deleteInventoryProduct(companyId: number, id: number, actor?: TrashActor) {
  return deleteInventoryProducts(companyId, [id], actor);
}
export async function getExpiringInventoryProducts(companyId: number, daysAhead = 30) {
  const database = await getDb();
  if (!database) return [];
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  const days = Math.max(0, Math.min(365, Math.trunc(daysAhead)));
  return database.select().from(inventoryProducts).where(and(
    eq(inventoryProducts.companyId, company),
    sql`${inventoryProducts.expirationDate} >= ${todayInZone()} AND ${inventoryProducts.expirationDate} <= ${addDays(todayInZone(), days)}`,
  )).orderBy(inventoryProducts.expirationDate, inventoryProducts.description);
}
