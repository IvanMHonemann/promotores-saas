import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { nanoid } from "nanoid";
import {
  clients,
  companies,
  extinguishers,
  memberSessions,
  platformSessions,
  serviceOrders,
  serviceOrderItems,
  trashItems,
  systemSettings,
  subscriptionPlans,
  companySubscriptions,
  payments,
  paymentEvents,
  users,
  type InsertClient,
  type InsertExtinguisher,
  type InsertServiceOrder,
  type InsertServiceOrderItem,
  type InsertUser,
} from "../drizzle/schema.original";
import { ENV } from "./_core/env";
import { stores as operationalStores, routes as operationalRoutes, visits as operationalVisits } from "../drizzle/schema";

/** Token público opaco (URL-safe). 21 chars ≈ 126 bits de entropia. */
export function generateExtinguisherPublicToken(): string {
  return nanoid(21);
}

export function buildExtinguisherPublicUrl(token: string): string {
  const base = (ENV.appPublicUrl || "").replace(/\/$/, "");
  return `${base}/e/${token}`;
}

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

let ownerScopeReady = false;
/** Adiciona colunas de dono se ainda não existirem (TiDB). */
export async function ensureOwnerScopeColumns() {
  if (ownerScopeReady) return;
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.query("ALTER TABLE `clients` ADD COLUMN `createdByUserId` int NULL").catch(() => undefined);
    await pool.query("ALTER TABLE `service_orders` ADD COLUMN `createdByUserId` int NULL").catch(() => undefined);
    await pool.query("ALTER TABLE `extinguishers` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => undefined);
    await pool.query("ALTER TABLE `clients` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => undefined);
    ownerScopeReady = true;
  } catch (err) {
    console.warn("[db] ensureOwnerScopeColumns", err);
    ownerScopeReady = true; // evita loop
  }
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

function pageArgs(page = 1, pageSize = 25) {
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize || 25)));
  const safePage = Math.max(1, Math.trunc(page || 1));
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}

function pageResult<T>(items: T[], total: number, page: number, pageSize: number) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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

export async function getPlatformDashboardStats(companyId: number, options: { city?: string; from?: string; to?: string } = {}) {
  const tenant = requireAccountId(companyId);
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", tenant, "30"), 10) || 30;
  const clientConditions = [eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") clientConditions.push(eq(clients.city, options.city));
  const clientWhere = and(...clientConditions);
  const extinguisherConditions = [eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") extinguisherConditions.push(eq(clients.city, options.city));
  const extinguisherWhere = and(...extinguisherConditions);
  const orderConditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") orderConditions.push(eq(clients.city, options.city));
  if (options.from) orderConditions.push(sql`${serviceOrders.orderDate} >= ${options.from}`);
  if (options.to) orderConditions.push(sql`${serviceOrders.orderDate} <= ${options.to}`);
  const orderWhere = and(...orderConditions);
  const [clientCountRows, cityCountRows, extinguisherCountRows, expiredRows, nearRows, orderCountRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(clients).where(clientWhere),
    db.select({ total: sql<number>`count(distinct ${clients.city})` }).from(clients).where(clientWhere),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(extinguisherWhere),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
    db.select({ total: sql<number>`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(orderWhere),
  ]);
  return {
    totalClients: Number(clientCountRows[0]?.total || 0),
    totalCities: Number(cityCountRows[0]?.total || 0),
    totalExtinguishers: Number(extinguisherCountRows[0]?.total || 0),
    nearExpirationCount: Number(nearRows[0]?.total || 0),
    expiredCount: Number(expiredRows[0]?.total || 0),
    totalOrders: Number(orderCountRows[0]?.total || 0),
    alertDaysConfig: daysAhead,
  };
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

export async function getPlatformClients(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(clients).where(eq(clients.accountId, companyId)).orderBy(desc(clients.createdAt)) : await db.select().from(clients).orderBy(desc(clients.createdAt));
}

export async function getPlatformExtinguishers(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(extinguishers).where(eq(extinguishers.accountId, companyId)).orderBy(extinguishers.expirationDate) : await db.select().from(extinguishers).orderBy(extinguishers.expirationDate);
}

export async function getPlatformOrders(companyId?: number) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return companyId ? await query.where(eq(serviceOrders.accountId, companyId)).orderBy(desc(serviceOrders.createdAt)) : await query.orderBy(desc(serviceOrders.createdAt));
}

export async function getClientsPage(accountId: number, options: { page?: number; pageSize?: number; city?: string; search?: string; ownerUserId?: number | null } = {}) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const search = options.search?.trim(); const conditions = [eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.ownerUserId != null) conditions.push(eq(clients.createdByUserId, options.ownerUserId));
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.cnpj, `%${search}%`), like(clients.contactName, `%${search}%`))!);
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select().from(clients).where(where).orderBy(desc(clients.createdAt), desc(clients.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(clients).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Clientes */
export async function getClients(cityFilter: string | undefined, accountId: number, ownerUserId?: number | null) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(clients.accountId, tenant)];
  if (cityFilter && cityFilter !== "TODAS") conditions.push(eq(clients.city, cityFilter));
  if (ownerUserId != null) conditions.push(eq(clients.createdByUserId, ownerUserId));
  return await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt)).limit(500);
}

export async function getClientById(id: number, accountId: number, ownerUserId?: number | null) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return undefined;
  const conditions = [eq(clients.id, id), eq(clients.accountId, tenant)];
  if (ownerUserId != null) conditions.push(eq(clients.createdByUserId, ownerUserId));
  const result = await db.select().from(clients).where(and(...conditions)).limit(1);
  return result[0];
}

export async function createClient(data: InsertClient) {
  const tenant = requireAccountId(data.accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const optional = ["cnpj", "address", "cep", "phone", "contactName", "cpf", "birthDate", "notes"] as const;
  const payload: any = { ...data, accountId: tenant, stockQuantity: Number((data as any).stockQuantity) > 0 ? Number((data as any).stockQuantity) : 1 };
  for (const key of optional) if (payload[key] === "") payload[key] = null;
  const result = await db.insert(clients).values(payload);
  return Number(result[0].insertId);
}

export async function updateClient(id: number, data: Partial<InsertClient>, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  const { accountId: ignoredAccountId, ...safeData } = data;
  void ignoredAccountId;
  await db.update(clients).set(safeData).where(and(eq(clients.id, id), eq(clients.accountId, tenant)));
}

export async function deleteClient(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente não encontrado ou sem permissão");
  const clientOrders = await db.select().from(serviceOrders).where(and(eq(serviceOrders.clientId, id), eq(serviceOrders.accountId, tenant)));
  const orderIds = clientOrders.map((order) => order.id);
  const clientExtinguishers = await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, id), eq(extinguishers.accountId, tenant)));
  const orderItems = orderIds.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, orderIds)) : [];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "client", originalId: id, label: client.companyName, snapshot: JSON.stringify({ client, orders: clientOrders, items: orderItems, extinguishers: clientExtinguishers }), expiresAt });
    for (const order of clientOrders) {
      await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, order.id));
      await tx.delete(serviceOrders).where(and(eq(serviceOrders.id, order.id), eq(serviceOrders.accountId, tenant)));
    }
    await tx.delete(extinguishers).where(and(eq(extinguishers.clientId, id), eq(extinguishers.accountId, tenant)));
    await tx.delete(clients).where(and(eq(clients.id, id), eq(clients.accountId, tenant)));
  });
}

export async function getDistinctCities(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ city: clients.city }).from(clients).where(eq(clients.accountId, tenant)).orderBy(clients.city);
  return result.map(row => row.city).filter(Boolean);
}

export async function getExtinguishersPage(accountId: number, options: { page?: number; pageSize?: number; clientId?: number; search?: string; filter?: "all" | "active" | "near" | "expired" } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant)]; const search = options.search?.trim();
  if (options.clientId) conditions.push(eq(extinguishers.clientId, options.clientId));
  if (search) conditions.push(or(like(extinguishers.typeModel, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`), like(extinguishers.locationInBuilding, `%${search}%`))!);
  if (options.filter === "active") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE()`);
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`);
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(where, eq(clients.accountId, tenant))).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Extintores */
export async function getExtinguishers(accountId: number) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(extinguishers).where(eq(extinguishers.accountId, tenant)).orderBy(extinguishers.expirationDate).limit(500);
}

export async function getExtinguisherById(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  return rows[0];
}

export async function getExtinguishersByClient(clientId: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  if (!(await getClientById(clientId, tenant))) return [];
  return await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, clientId), eq(extinguishers.accountId, tenant))).orderBy(extinguishers.expirationDate);
}

export async function createExtinguisher(data: InsertExtinguisher, accountId: number) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.accountId !== tenant || !(await getClientById(data.clientId, tenant))) throw new Error("Cliente sem permissão");
  const publicToken = data.publicToken?.trim() || generateExtinguisherPublicToken();
  const result = await db.insert(extinguishers).values({ ...data, accountId: tenant, publicToken });
  return Number(result[0].insertId);
}

/** Garante publicToken no extintor do tenant; não regenera se já existir. */
export async function ensureExtinguisherPublicToken(id: number, accountId: number): Promise<string> {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows = await db
    .select()
    .from(extinguishers)
    .where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error("Extintor sem permissão");
  if (row.publicToken) return row.publicToken;
  const token = generateExtinguisherPublicToken();
  await db
    .update(extinguishers)
    .set({ publicToken: token })
    .where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant), isNull(extinguishers.publicToken)));
  const after = await db
    .select({ publicToken: extinguishers.publicToken })
    .from(extinguishers)
    .where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)))
    .limit(1);
  return after[0]?.publicToken || token;
}

/** Backfill de tokens faltantes em um tenant (ou todos se accountId omitido no backfill global). */
export async function backfillExtinguisherPublicTokens(accountId: number): Promise<{ updated: number }> {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const missing = await db
    .select({ id: extinguishers.id })
    .from(extinguishers)
    .where(and(eq(extinguishers.accountId, tenant), or(isNull(extinguishers.publicToken), eq(extinguishers.publicToken, ""))!));
  let updated = 0;
  for (const row of missing) {
    const token = generateExtinguisherPublicToken();
    await db
      .update(extinguishers)
      .set({ publicToken: token })
      .where(and(eq(extinguishers.id, row.id), eq(extinguishers.accountId, tenant)));
    updated += 1;
  }
  return { updated };
}

/**
 * Consulta pública por token. Não exige login.
 * Foco em dados operacionais da empresa de manutenção (diferente do selo Inmetro).
 */
export async function getPublicExtinguisherByToken(token: string) {
  const clean = (token || "").trim();
  if (!clean || clean.length < 10 || clean.length > 32) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: extinguishers.id,
      accountId: extinguishers.accountId,
      publicToken: extinguishers.publicToken,
      typeModel: extinguishers.typeModel,
      capacity: extinguishers.capacity,
      serialNumber: extinguishers.serialNumber,
      locationInBuilding: extinguishers.locationInBuilding,
      expirationDate: extinguishers.expirationDate,
      lastInspectionDate: extinguishers.lastInspectionDate,
      status: extinguishers.status,
      notes: extinguishers.notes,
      clientName: clients.companyName,
      clientCity: clients.city,
      clientPhone: clients.phone,
      companyName: companies.name,
    })
    .from(extinguishers)
    .innerJoin(clients, and(eq(clients.id, extinguishers.clientId), eq(clients.accountId, extinguishers.accountId)))
    .innerJoin(companies, eq(companies.id, extinguishers.accountId))
    .where(eq(extinguishers.publicToken, clean))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    publicToken: row.publicToken,
    typeModel: row.typeModel,
    capacity: row.capacity,
    serialNumber: row.serialNumber,
    locationInBuilding: row.locationInBuilding,
    expirationDate: row.expirationDate,
    lastInspectionDate: row.lastInspectionDate,
    status: row.status,
    notes: row.notes,
    clientName: row.clientName,
    clientCity: row.clientCity,
    companyName: row.companyName,
    companyPhone: row.clientPhone, // contato do cliente/unidade (útil para a equipe em campo)
    _internalId: row.id,
    _accountId: row.accountId,
  };
}

export async function updateExtinguisher(id: number, data: Partial<InsertExtinguisher>, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permissão");
  const { accountId: ignoredAccountId, clientId: ignoredClientId, ...safeData } = data;
  void ignoredAccountId;
  void ignoredClientId;
  await db.update(extinguishers).set(safeData).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
}

export async function deleteExtinguisher(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permissão");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "extinguisher", originalId: id, label: `${existing[0].typeModel} — ${existing[0].serialNumber || "sem selo"}`, snapshot: JSON.stringify(existing[0]), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await tx.delete(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
  });
}

export async function getExpiringExtinguishers(daysAhead: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId))).where(and(eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant), sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)).orderBy(extinguishers.expirationDate).limit(300);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return result.map(item => {
    const expDate = new Date(item.extinguisher.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 86400000);
    let alertStatus: "expired" | "urgent" | "warning" | "ok" = "ok";
    let alertMessage = "";
    if (diffDays < 0) { alertStatus = "expired"; alertMessage = `VENCIDO há ${Math.abs(diffDays)} dia(s)!`; }
    else if (diffDays <= 15) { alertStatus = "urgent"; alertMessage = diffDays === 0 ? "VENCE HOJE!" : `Vence em ${diffDays} dia(s) (Urgente)`; }
    else if (diffDays <= daysAhead) { alertStatus = "warning"; alertMessage = `Vence em ${diffDays} dia(s) (Alerta prévio)`; }
    return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: diffDays <= daysAhead };
  });
}

export async function getServiceOrdersPage(accountId: number, options: { page?: number; pageSize?: number; clientId?: number; search?: string; city?: string; from?: string; to?: string; ownerUserId?: number | null } = {}) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.ownerUserId != null) conditions.push(eq(serviceOrders.createdByUserId, options.ownerUserId));
  if (options.clientId) conditions.push(eq(serviceOrders.clientId, options.clientId));
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.from) conditions.push(sql`${serviceOrders.orderDate} >= ${options.from}`);
  if (options.to) conditions.push(sql`${serviceOrders.orderDate} <= ${options.to}`);
  const search = options.search?.trim();
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(sql`CAST(${serviceOrders.orderNumber} AS CHAR)`, `%${search}%`))!);
  const where = and(...conditions);
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  const [items, totalRows] = await Promise.all([
    query.where(where).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt), desc(serviceOrders.id)).limit(pageSize).offset(offset),
    db.select({ total: sql<number>`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(where),
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

export async function getOfflineSnapshot(accountId: number, options: { page?: number; pageSize?: number } = {}) {
  const tenant = requireAccountId(accountId);
  const page = Math.max(1, Math.trunc(options.page || 1));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(options.pageSize || 50)));
  const [clientsPage, extinguishersPage, ordersPage, alertsPage] = await Promise.all([
    getClientsPage(tenant, { page, pageSize }),
    getExtinguishersPage(tenant, { page, pageSize }),
    getServiceOrdersPage(tenant, { page, pageSize }),
    getExpiringExtinguishersPage(30, tenant, { page, pageSize, filter: "all" }),
  ]);
  return {
    page,
    pageSize,
    clients: clientsPage.items,
    extinguishers: extinguishersPage.items.map((row: any) => row.extinguisher),
    orders: ordersPage.items,
    alerts: alertsPage.items.map((row: any) => ({ ...row.extinguisher, ...row })),
    totals: { clients: clientsPage.total, extinguishers: extinguishersPage.total, orders: ordersPage.total, alerts: alertsPage.total },
    hasMore: { clients: page < clientsPage.totalPages, extinguishers: page < extinguishersPage.totalPages, orders: page < ordersPage.totalPages, alerts: page < alertsPage.totalPages },
  };
}

export async function getExpiringExtinguishersPage(daysAhead: number, accountId: number, options: { page?: number; pageSize?: number; filter?: "all" | "near" | "expired"; search?: string; city?: string } = {}) {
  const tenant = requireAccountId(accountId); const db = await getDb(); if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  if (options.filter === "all") conditions.push(sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  const search = options.search?.trim(); if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`))!);
  const where = and(...conditions);
  const query = db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId)));
  const [rows, totalRows] = await Promise.all([query.where(where).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset), db.select({ total: sql<number>`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(where)]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const items = rows.map((item) => { const expiration = new Date(item.extinguisher.expirationDate); expiration.setHours(0, 0, 0, 0); const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 86400000); const alertStatus = diffDays < 0 ? "expired" : diffDays <= 15 ? "urgent" : "warning"; const alertMessage = diffDays < 0 ? `VENCIDO há ${Math.abs(diffDays)} dia(s)!` : diffDays === 0 ? "VENCE HOJE!" : diffDays <= 15 ? `Vence em ${diffDays} dia(s) (Urgente)` : `Vence em ${diffDays} dia(s) (Alerta prévio)`; return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: true }; });
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}

/* Ordens de Serviço */
export async function getNextOrderNumber(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return 1001;
  const result = await db.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
}

async function allocateOrderNumber(tx: any, tenant: number) {
  const maxRows = await tx.select({ maxNum: sql<number>`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  const currentMax = Math.max(1000, Number(maxRows[0]?.maxNum || 1000));
  await tx.insert(systemSettings).values({ accountId: tenant, settingKey: "order_sequence", settingValue: String(currentMax) }).onDuplicateKeyUpdate({
    set: { updatedAt: new Date() },
  });
  await tx.update(systemSettings).set({
    settingValue: sql`CAST(GREATEST(CAST(${systemSettings.settingValue} AS UNSIGNED), ${currentMax}) + 1 AS CHAR)`,
  }).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence")));
  const rows = await tx.select({ value: systemSettings.settingValue }).from(systemSettings).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence"))).limit(1);
  const nextNumber = Number(rows[0]?.value);
  if (!Number.isInteger(nextNumber) || nextNumber < 1001) throw new Error("Não foi possível reservar o número da OS.");
  return nextNumber;
}

function isDuplicateKeyError(error: unknown) {
  return Number((error as any)?.code) === 1062 || String((error as any)?.message || "").includes("Duplicate entry");
}

export async function createServiceOrder(order: InsertServiceOrder, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId: number) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const pool = await getPool();
  const db = await getDb();
  if (!pool) throw new Error("Database not connected");
  if (!db) throw new Error("Database not connected");
  if (order.accountId !== tenant || !(await getClientById(order.clientId, tenant))) throw new Error("Cliente sem permissão");
  const requestedNumber = order.orderNumber && Number.isInteger(order.orderNumber) ? order.orderNumber : undefined;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const orderNumber = requestedNumber ?? await allocateOrderNumber(tx, tenant);
        const result = await tx.insert(serviceOrders).values({ ...order, accountId: tenant, orderNumber });
        const orderId = Number(result[0].insertId);
        if (items.length) await tx.insert(serviceOrderItems).values(items.map(item => { const { extinguisherId: _ignored, ...row } = item as any; return { ...row, serviceOrderId: orderId }; }));
      for (const item of items as any[]) {
        const extId = Number(item.extinguisherId);
        const qty = Number(item.quantity) || 0;
        if (!extId || qty < 1) continue;
        const [rows] = await pool.query("SELECT stockQuantity FROM extinguishers WHERE id = ? AND accountId = ? LIMIT 1", [extId, tenant]) as any;
        const current = Number(rows?.[0]?.stockQuantity ?? 1);
        if (current < qty) throw new Error("Estoque insuficiente para o extintor selecionado.");
        await pool.query("UPDATE extinguishers SET stockQuantity = stockQuantity - ? WHERE id = ? AND accountId = ?", [qty, extId, tenant]);
      }
        return { id: orderId, orderNumber };
      });
    } catch (error) {
      if (requestedNumber !== undefined || !isDuplicateKeyError(error) || attempt === 3) throw error;
      console.warn(`[Database] OS number conflict; retrying allocation (${attempt}/3).`);
    }
  }
  throw new Error("Não foi possível criar a OS.");
}

export async function getServiceOrderById(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return null;
  const orderResult = await db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant))).limit(1);
  if (!orderResult[0]) return null;
  const items = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  return { ...orderResult[0].order, client: orderResult[0].client, items };
}

export async function getServiceOrders(clientId: number | undefined, accountId: number, ownerUserId?: number | null) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (ownerUserId != null) conditions.push(eq(serviceOrders.createdByUserId, ownerUserId));
  if (clientId) conditions.push(eq(serviceOrders.clientId, clientId));
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  // O histórico deve seguir a data do atendimento informada na OS, não a data
  // técnica em que o registro foi criado ou posteriormente editado.
  // Limite de segurança: telas devem usar orders.page para volumes grandes.
  return await query.where(and(...conditions)).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt)).limit(clientId ? 200 : 500);
}

export async function getServiceOrderHistory(clientId: number, accountId: number) {
  const orders = await getServiceOrders(clientId, accountId);
  const db = await getDb();
  if (!db) return [];
  const ids = orders.map(({ order }) => order.id);
  const items = ids.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, ids)) : [];
  return orders.map((entry) => ({ ...entry, items: items.filter((item) => item.serviceOrderId === entry.order.id) }));
}

export async function updateServiceOrder(id: number, order: Partial<InsertServiceOrder>, items: Omit<InsertServiceOrderItem, "serviceOrderId">[], accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await getServiceOrderById(id, tenant);
  if (!existing) throw new Error("Ordem não encontrada ou sem permissão");
  if (order.clientId && !(await getClientById(order.clientId, tenant))) throw new Error("Cliente sem permissão");
  const { accountId: ignoredAccountId, orderNumber: ignoredOrderNumber, ...safeOrder } = order;
  void ignoredAccountId; void ignoredOrderNumber;
  await db.transaction(async (tx) => {
    await tx.update(serviceOrders).set(safeOrder).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    if (items.length) await tx.insert(serviceOrderItems).values(items.map(item => ({ ...item, serviceOrderId: id })));
  });
}

export async function deleteServiceOrder(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const order = await getServiceOrderById(id, tenant);
  if (!order) throw new Error("Ordem não encontrada ou sem permissão");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "order", originalId: id, label: `OS #${order.orderNumber}`, snapshot: JSON.stringify({ order, items: order.items }), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    await tx.delete(serviceOrders).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
  });
}

export async function listTrash(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  await db.delete(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} <= NOW()`));
  return await db.select().from(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} > NOW()`)).orderBy(desc(trashItems.deletedAt));
}

export async function cleanupExpiredData() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [trashResult, memberResult, platformResult] = await Promise.all([
    db.delete(trashItems).where(sql`${trashItems.expiresAt} <= NOW()`),
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
  for (const key of ["createdAt", "updatedAt"] as const) {
    if (restored[key] && !(restored[key] instanceof Date)) restored[key] = new Date(restored[key]);
  }
  return restored as T;
}

export async function restoreTrashItem(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const item = (await db.select().from(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant))).limit(1))[0];
  if (!item) throw new Error("Item não encontrado na lixeira ou sem permissão.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
    throw new Error("O prazo de restauração deste item expirou.");
  }

  const snapshot = parseTrashSnapshot(item.snapshot);
  await db.transaction(async (tx) => {
    if (item.itemType === "client") {
      const clientData = snapshot.client || snapshot;
      const orders = snapshot.orders || [];
      const items = snapshot.items || [];
      const savedExtinguishers = snapshot.extinguishers || [];
      const existingClient = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, item.originalId)).limit(1);
      if (existingClient[0]) throw new Error("Já existe um cliente com o mesmo identificador. Exclua o conflito antes de restaurar.");
      await tx.insert(clients).values({ ...restoreDateFields(clientData), id: item.originalId, accountId: tenant } as any);
      for (const extinguisher of savedExtinguishers) {
        await tx.insert(extinguishers).values({ ...restoreDateFields(extinguisher), accountId: tenant, clientId: item.originalId } as any);
      }
      for (const savedOrder of orders) {
        const { client: _client, items: _nestedItems, ...orderData } = savedOrder;
        void _client; void _nestedItems;
        await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), accountId: tenant, clientId: item.originalId } as any);
        const orderItems = items.filter((entry: any) => entry.serviceOrderId === savedOrder.id);
        if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry: any) => ({ ...restoreDateFields(entry), serviceOrderId: savedOrder.id })) as any);
      }
    } else if (item.itemType === "order") {
      const savedOrder = snapshot.order || snapshot;
      const { client: _client, items: nestedItems, ...orderData } = savedOrder;
      void _client;
      const orderItems = snapshot.items || nestedItems || [];
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, orderData.clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado à OS não existe mais; restaure o cliente antes.");
      await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), id: item.originalId, accountId: tenant } as any);
      if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry: any) => ({ ...restoreDateFields(entry), serviceOrderId: item.originalId })) as any);
    } else if (item.itemType === "extinguisher") {
      const clientId = snapshot.clientId;
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado ao extintor não existe mais; restaure o cliente antes.");
      await tx.insert(extinguishers).values({ ...restoreDateFields(snapshot), id: item.originalId, accountId: tenant } as any);
    } else {
      throw new Error("Tipo de item da lixeira não reconhecido.");
    }
    await tx.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  });
}

export async function permanentlyDeleteTrashItem(id: number, accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  if (!result[0]?.affectedRows) throw new Error("Item não encontrado na lixeira ou sem permissão.");
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

export async function getDashboardStats(accountId: number) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", tenant, "30"), 10) || 30;
  // Contagens em SQL — não carrega milhares de linhas em memória
  const [clientRows, cityRows, extinguisherTotalRows, expiredRows, nearRows, orderRows] = await Promise.all([
    db.select({ total: sql<number>`count(*)` }).from(clients).where(eq(clients.accountId, tenant)),
    db.select({ total: sql<number>`count(distinct ${clients.city})` }).from(clients).where(and(eq(clients.accountId, tenant), sql`${clients.city} is not null AND ${clients.city} <> ''`)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(eq(extinguishers.accountId, tenant)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql<number>`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
    db.select({ total: sql<number>`count(*)` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant)),
  ]);
  return {
    totalClients: Number(clientRows[0]?.total || 0),
    totalCities: Number(cityRows[0]?.total || 0),
    totalExtinguishers: Number(extinguisherTotalRows[0]?.total || 0),
    nearExpirationCount: Number(nearRows[0]?.total || 0),
    expiredCount: Number(expiredRows[0]?.total || 0),
    totalOrders: Number(orderRows[0]?.total || 0),
    alertDaysConfig: daysAhead,
  };
}

/* Planos e assinaturas (admin da plataforma) */
export async function listSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
}

export async function createSubscriptionPlan(data: {
  name: string;
  description?: string | null;
  price: string;
  billingCycle: "monthly" | "yearly";
  maxUsers?: number | null;
  maxClients?: number | null;
  maxExtinguishers?: number | null;
  featureDashboard?: boolean;
  featureClients?: boolean;
  featureExtinguishers?: boolean;
  featureServiceOrders?: boolean;
  featureAlerts?: boolean;
  featureReports?: boolean;
  featureUsers?: boolean;
  featureBackup?: boolean;
  featureOfflinePwa?: boolean;
  availableForNew?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(subscriptionPlans).values({
    name: data.name,
    description: data.description ?? null,
    price: data.price,
    billingCycle: data.billingCycle,
    maxUsers: data.maxUsers ?? null,
    maxClients: data.maxClients ?? null,
    maxExtinguishers: data.maxExtinguishers ?? null,
    featureDashboard: data.featureDashboard ?? false,
    featureClients: data.featureClients ?? false,
    featureExtinguishers: data.featureExtinguishers ?? false,
    featureServiceOrders: data.featureServiceOrders ?? false,
    featureAlerts: data.featureAlerts ?? false,
    featureReports: data.featureReports ?? false,
    featureUsers: data.featureUsers ?? false,
    featureBackup: data.featureBackup ?? false,
    featureOfflinePwa: data.featureOfflinePwa ?? false,
    availableForNew: data.availableForNew ?? true,
    active: true,
  });
  return { id: Number((result as any).insertId) };
}

export async function updateSubscriptionPlan(id: number, data: Partial<{
  name: string;
  description: string | null;
  price: string;
  billingCycle: "monthly" | "yearly";
  maxUsers: number | null;
  maxClients: number | null;
  maxExtinguishers: number | null;
  featureDashboard: boolean;
  featureClients: boolean;
  featureExtinguishers: boolean;
  featureServiceOrders: boolean;
  featureAlerts: boolean;
  featureReports: boolean;
  featureUsers: boolean;
  featureBackup: boolean;
  featureOfflinePwa: boolean;
  availableForNew: boolean;
  active: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, id));
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
      featureDashboard: subscriptionPlans.featureDashboard,
      featureClients: subscriptionPlans.featureClients,
      featureExtinguishers: subscriptionPlans.featureExtinguishers,
      featureServiceOrders: subscriptionPlans.featureServiceOrders,
      featureAlerts: subscriptionPlans.featureAlerts,
      featureReports: subscriptionPlans.featureReports,
      featureUsers: subscriptionPlans.featureUsers,
      featureBackup: subscriptionPlans.featureBackup,
      featureOfflinePwa: subscriptionPlans.featureOfflinePwa,
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
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  return rows[0] ?? null;
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
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(subscriptionPlans)
    .where(and(eq(subscriptionPlans.active, true), eq(subscriptionPlans.availableForNew, true)))
    .orderBy(subscriptionPlans.price);
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
  const db = await getDb();
  if (!db) return;

  const catalog = [
    {
      name: "Start",
      description: "Ideal para quem está começando",
      price: "59.90",
      billingCycle: "monthly" as const,
      maxUsers: 1,
      maxClients: 1000,
      maxExtinguishers: 3000,
      featureDashboard: true,
      featureClients: true,
      featureExtinguishers: true,
      featureServiceOrders: true,
      featureAlerts: true,
      featureReports: true,
      featureUsers: false,
      featureBackup: true,
      featureOfflinePwa: true,
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
      featureDashboard: true,
      featureClients: true,
      featureExtinguishers: true,
      featureServiceOrders: true,
      featureAlerts: true,
      featureReports: true,
      featureUsers: true,
      featureBackup: true,
      featureOfflinePwa: true,
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
      featureDashboard: true,
      featureClients: true,
      featureExtinguishers: true,
      featureServiceOrders: true,
      featureAlerts: true,
      featureReports: true,
      featureUsers: true,
      featureBackup: true,
      featureOfflinePwa: true,
      availableForNew: true,
      active: true,
    },
  ];

  const existing = await db.select().from(subscriptionPlans);
  const byName = new Map(existing.map((p) => [String(p.name).toLowerCase().trim(), p]));

  for (const plan of catalog) {
    const key = plan.name.toLowerCase();
    const row = byName.get(key);
    if (row) {
      await db
        .update(subscriptionPlans)
        .set({
          description: plan.description,
          price: plan.price,
          billingCycle: plan.billingCycle,
          maxUsers: plan.maxUsers,
          maxClients: plan.maxClients,
          maxExtinguishers: plan.maxExtinguishers,
          featureDashboard: plan.featureDashboard,
          featureClients: plan.featureClients,
          featureExtinguishers: plan.featureExtinguishers,
          featureServiceOrders: plan.featureServiceOrders,
          featureAlerts: plan.featureAlerts,
          featureReports: plan.featureReports,
          featureUsers: plan.featureUsers,
          featureBackup: plan.featureBackup,
          featureOfflinePwa: plan.featureOfflinePwa,
          availableForNew: true,
          active: true,
        })
        .where(eq(subscriptionPlans.id, row.id));
    } else {
      await db.insert(subscriptionPlans).values(plan);
    }
  }

  // Planos legados de seed/teste deixam de aparecer para novas assinaturas
  const keep = new Set(catalog.map((p) => p.name.toLowerCase()));
  for (const row of existing) {
    const key = String(row.name).toLowerCase().trim();
    if (!keep.has(key) && row.availableForNew) {
      await db
        .update(subscriptionPlans)
        .set({ availableForNew: false })
        .where(eq(subscriptionPlans.id, row.id));
    }
  }
}


/* Núcleo operacional de promotores — usa as tabelas novas e permanece separado do legado. */
export async function listOperationalStores(companyId: number, search?: string) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(operationalStores.companyId, requireAccountId(companyId)), eq(operationalStores.active, true)];
  if (search?.trim()) conditions.push(like(operationalStores.name, `%${search.trim()}%`));
  return database.select().from(operationalStores).where(and(...conditions)).orderBy(operationalStores.name);
}

export async function createOperationalStore(input: typeof operationalStores.$inferInsert) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(operationalStores).values(input);
  const rows = await database.select().from(operationalStores).where(eq(operationalStores.id, Number((result as any)[0]?.insertId))).limit(1);
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

export async function createOperationalRoute(input: typeof operationalRoutes.$inferInsert) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(operationalRoutes).values(input);
  const rows = await database.select().from(operationalRoutes).where(eq(operationalRoutes.id, Number((result as any)[0]?.insertId))).limit(1);
  return rows[0];
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
