var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/forceUtc.ts
function forceUtc(env2 = process.env) {
  const previous = env2.TZ;
  if (previous !== "UTC") {
    env2.TZ = "UTC";
    if (previous) console.warn(`[tz] TZ=${previous} ignorado; o servidor roda em UTC.`);
  }
  return previous;
}
var init_forceUtc = __esm({
  "server/_core/forceUtc.ts"() {
    "use strict";
    forceUtc();
  }
});

// server/_core/originGuard.ts
function firstHeader(value) {
  return (Array.isArray(value) ? value[0] : value ?? "").split(",")[0].trim().toLowerCase();
}
function isAllowedOrigin(headers, method, extraAllowed = []) {
  if (SAFE_METHODS.has(method.toUpperCase())) return true;
  const origin = firstHeader(headers.origin);
  if (origin) {
    if (origin === "null") return false;
    let originHost;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return false;
    }
    const hosts = [firstHeader(headers["x-forwarded-host"]), firstHeader(headers.host)].filter(Boolean);
    if (hosts.includes(originHost)) return true;
    return extraAllowed.some((allowed) => {
      try {
        return new URL(allowed).host.toLowerCase() === originHost;
      } catch {
        return false;
      }
    });
  }
  const site = firstHeader(headers["sec-fetch-site"]);
  if (site === "cross-site") return false;
  return true;
}
function originGuard(extraAllowed = []) {
  return (req, res, next) => {
    const extras = [...extraAllowed, process.env.APP_PUBLIC_URL ?? ""].filter(Boolean);
    if (isAllowedOrigin(req.headers, req.method, extras)) return next();
    res.status(403).json({ error: "Origem n\xE3o permitida." });
  };
}
var SAFE_METHODS;
var init_originGuard = __esm({
  "server/_core/originGuard.ts"() {
    "use strict";
    SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
  }
});

// shared/csv.ts
function neutralizeCsvFormula(value) {
  const text4 = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text4) ? `'${text4}` : text4;
}
var init_csv = __esm({
  "shared/csv.ts"() {
    "use strict";
  }
});

// shared/const.ts
var MEMBER_COOKIE_NAME, ONE_YEAR_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    MEMBER_COOKIE_NAME = "member_session_id";
    ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
  }
});

// server/mediaKeys.ts
function hasTraversal(key) {
  return key.split("/").some((part) => part === ".." || part === "." || part === "");
}
function safeKeySegment(value, fallback = "x") {
  const cleaned = String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return cleaned || fallback;
}
function isTenantMediaKey(key, companyId, areas = ["store-photos"]) {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  if (!Number.isInteger(companyId) || companyId <= 0) return false;
  if (!SAFE_CHARS.test(key) || hasTraversal(key)) return false;
  return areas.some((area) => key.startsWith(`${area}/${companyId}/`));
}
function isDeletableMediaKey(key, companyId) {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  if (!SAFE_CHARS.test(key) || hasTraversal(key)) return false;
  const match = /^(store-photos|corrections|archives|product-photos)\/(\d+)\//.exec(key);
  if (!match) return false;
  return companyId == null || Number(match[2]) === companyId;
}
async function guardedStorageDelete(storageDelete2, key, companyId) {
  if (!isDeletableMediaKey(key, companyId)) {
    if (key) console.warn("[storage] exclus\xE3o recusada: chave fora das \xE1reas permitidas", String(key).slice(0, 80));
    return false;
  }
  return storageDelete2(key);
}
function detectImageMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 255 && buf[1] === 216 && buf[2] === 255) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
var TENANT_MEDIA_AREAS, SAFE_CHARS;
var init_mediaKeys = __esm({
  "server/mediaKeys.ts"() {
    "use strict";
    TENANT_MEDIA_AREAS = ["store-photos", "corrections", "archives", "product-photos"];
    SAFE_CHARS = /^[A-Za-z0-9._\-/]+$/;
  }
});

// shared/uploadLimits.ts
function payloadTooLargeBody(path3) {
  return { error: { json: { message: BODY_TOO_LARGE_MESSAGE, code: -32600, data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413, path: path3 } } } };
}
function isPayloadTooLargeError(err) {
  const e = err;
  return Boolean(e && (e.type === "entity.too.large" || e.status === 413));
}
var MAX_BODY_SIZE, MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE, BODY_TOO_LARGE_MESSAGE;
var init_uploadLimits = __esm({
  "shared/uploadLimits.ts"() {
    "use strict";
    MAX_BODY_SIZE = "4500kb";
    MAX_PHOTO_BASE64_CHARS = 42e5;
    PHOTO_TOO_LARGE_MESSAGE = "Imagem grande demais para enviar. Tire a foto novamente ou use uma resolu\xE7\xE3o menor.";
    BODY_TOO_LARGE_MESSAGE = "Arquivo grande demais para enviar (m\xE1ximo de 4,5 MB). Tente uma foto ou arquivo menor.";
  }
});

// server/ttlCache.ts
function createTtlCache(ttlMs, maxEntries = 500) {
  const store = /* @__PURE__ */ new Map();
  return {
    get(key, load) {
      const now = Date.now();
      const hit = store.get(key);
      if (hit && hit.expiresAt > now) return hit.value;
      if (store.size >= maxEntries) {
        for (const [k, v] of store) if (v.expiresAt <= now) store.delete(k);
        if (store.size >= maxEntries) store.delete(store.keys().next().value);
      }
      const value = load();
      store.set(key, { value, expiresAt: now + ttlMs });
      value.catch(() => {
        if (store.get(key)?.value === value) store.delete(key);
      });
      return value;
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}
var init_ttlCache = __esm({
  "server/ttlCache.ts"() {
    "use strict";
  }
});

// drizzle/schema.original.ts
import { boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
var users, companies, platformAdmins, memberAccounts, memberSessions, platformSessions, clients, extinguishers, serviceOrders, serviceOrderItems, trashItems, systemSettings, subscriptionPlans, companySubscriptions, payments, paymentEvents, auditLogs;
var init_schema_original = __esm({
  "drizzle/schema.original.ts"() {
    "use strict";
    users = mysqlTable("users", {
      id: int("id").autoincrement().primaryKey(),
      openId: varchar("openId", { length: 64 }).notNull().unique(),
      name: text("name"),
      email: varchar("email", { length: 320 }),
      loginMethod: varchar("loginMethod", { length: 64 }),
      role: mysqlEnum("role", ["oauth_user", "platform_admin"]).default("oauth_user").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
    });
    companies = mysqlTable("companies", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 255 }).notNull(),
      active: boolean("active").default(true).notNull(),
      planId: int("planId"),
      subscriptionStatus: mysqlEnum("subscriptionStatus", ["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]),
      asaasCustomerId: varchar("asaasCustomerId", { length: 64 }),
      asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 64 }),
      subscriptionStartedAt: timestamp("subscriptionStartedAt"),
      subscriptionExpiresAt: timestamp("subscriptionExpiresAt"),
      trialEndsAt: timestamp("trialEndsAt"),
      gracePeriodEndsAt: timestamp("gracePeriodEndsAt"),
      legalName: varchar("legalName", { length: 200 }),
      tradeName: varchar("tradeName", { length: 200 }),
      taxDocument: varchar("taxDocument", { length: 14 }),
      stateRegistration: varchar("stateRegistration", { length: 30 }),
      establishment: varchar("establishment", { length: 200 }),
      addressZip: varchar("addressZip", { length: 8 }),
      addressStreet: varchar("addressStreet", { length: 200 }),
      addressNumber: varchar("addressNumber", { length: 20 }),
      addressComplement: varchar("addressComplement", { length: 120 }),
      addressDistrict: varchar("addressDistrict", { length: 120 }),
      addressCity: varchar("addressCity", { length: 120 }),
      addressState: varchar("addressState", { length: 2 }),
      contactPhone: varchar("contactPhone", { length: 50 }),
      contactEmail: varchar("contactEmail", { length: 320 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      activeIdx: index("companies_active_idx").on(table2.active),
      nameIdx: index("companies_name_idx").on(table2.name),
      planIdx: index("companies_plan_idx").on(table2.planId),
      subscriptionStatusIdx: index("companies_subscription_status_idx").on(table2.subscriptionStatus)
    }));
    platformAdmins = mysqlTable("platform_admins", {
      id: int("id").autoincrement().primaryKey(),
      userName: varchar("userName", { length: 255 }).notNull(),
      email: varchar("email", { length: 320 }).notNull().unique(),
      passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
      recoveryCodeHash: varchar("recoveryCodeHash", { length: 255 }),
      active: boolean("active").default(true).notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    memberAccounts = mysqlTable("member_accounts", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
      userName: varchar("userName", { length: 255 }).notNull(),
      email: varchar("email", { length: 320 }).notNull().unique(),
      passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
      recoveryCodeHash: varchar("recoveryCodeHash", { length: 255 }),
      role: mysqlEnum("role", ["company_admin", "supervisor", "promoter"]).default("promoter").notNull(),
      active: boolean("active").default(true).notNull(),
      phone: varchar("phone", { length: 50 }),
      cpf: varchar("cpf", { length: 11 }),
      pis: varchar("pis", { length: 11 }),
      rg: varchar("rg", { length: 20 }),
      birthDate: varchar("birthDate", { length: 10 }),
      jobTitle: varchar("jobTitle", { length: 120 }),
      admissionDate: varchar("admissionDate", { length: 10 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index("member_accounts_company_idx").on(table2.companyId),
      companyRoleIdx: index("member_accounts_company_role_idx").on(table2.companyId, table2.role)
    }));
    memberSessions = mysqlTable("member_sessions", {
      id: int("id").autoincrement().primaryKey(),
      memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "cascade" }),
      tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table2) => ({
      accountExpiryIdx: index("member_sessions_account_expiry_idx").on(table2.memberAccountId, table2.expiresAt)
    }));
    platformSessions = mysqlTable("platform_sessions", {
      id: int("id").autoincrement().primaryKey(),
      platformAdminId: int("platformAdminId").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
      tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table2) => ({
      adminExpiryIdx: index("platform_sessions_admin_expiry_idx").on(table2.platformAdminId, table2.expiresAt)
    }));
    clients = mysqlTable("clients", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "restrict" }),
      /** Membro que cadastrou (operadores só veem os próprios). */
      createdByUserId: int("createdByUserId"),
      companyName: varchar("companyName", { length: 255 }).notNull(),
      cnpj: varchar("cnpj", { length: 30 }),
      address: text("address"),
      city: varchar("city", { length: 120 }).notNull(),
      cep: varchar("cep", { length: 20 }),
      phone: varchar("phone", { length: 50 }),
      contactName: varchar("contactName", { length: 255 }),
      cpf: varchar("cpf", { length: 30 }),
      birthDate: varchar("birthDate", { length: 20 }),
      notes: text("notes"),
      stockQuantity: int("stockQuantity").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      accountIdx: index("clients_account_idx").on(table2.accountId),
      cityIdx: index("clients_account_city_idx").on(table2.accountId, table2.city)
    }));
    extinguishers = mysqlTable("extinguishers", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "restrict" }),
      clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "cascade" }),
      /** Token público opaco para QR Code (/e/:token). Nunca sequencial. */
      publicToken: varchar("publicToken", { length: 32 }),
      typeModel: varchar("typeModel", { length: 100 }).notNull(),
      capacity: varchar("capacity", { length: 50 }),
      serialNumber: varchar("serialNumber", { length: 100 }),
      locationInBuilding: varchar("locationInBuilding", { length: 200 }),
      expirationDate: date("expirationDate").notNull(),
      lastInspectionDate: date("lastInspectionDate"),
      status: mysqlEnum("status", ["ok", "warning", "expired"]).default("ok").notNull(),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      accountIdx: index("extinguishers_account_idx").on(table2.accountId),
      clientIdx: index("extinguishers_client_idx").on(table2.clientId),
      expirationIdx: index("extinguishers_account_expiration_idx").on(table2.accountId, table2.expirationDate),
      publicTokenIdx: index("extinguishers_public_token_idx").on(table2.publicToken)
    }));
    serviceOrders = mysqlTable("service_orders", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "restrict" }),
      orderNumber: int("orderNumber").notNull(),
      orderDate: date("orderDate").notNull(),
      createdByName: varchar("createdByName", { length: 255 }),
      createdByUserId: int("createdByUserId"),
      clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
      replacedAndDelivered: varchar("replacedAndDelivered", { length: 10 }).default("SIM"),
      leftReserve: varchar("leftReserve", { length: 10 }).default("N\xC3O"),
      reserveDetails: varchar("reserveDetails", { length: 255 }),
      extinguisherExpiration: varchar("extinguisherExpiration", { length: 100 }),
      licenseExpiration: varchar("licenseExpiration", { length: 100 }),
      totalAmount: decimal("totalAmount", { precision: 10, scale: 2 }).default("0.00").notNull(),
      paymentMethod: varchar("paymentMethod", { length: 50 }).default("A VISTA"),
      installmentsCount: int("installmentsCount").default(1),
      installmentDates: varchar("installmentDates", { length: 255 }),
      responsibleName: varchar("responsibleName", { length: 255 }),
      responsibleCpf: varchar("responsibleCpf", { length: 30 }),
      responsibleBirthDate: varchar("responsibleBirthDate", { length: 20 }),
      observations: text("observations"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      accountIdx: index("service_orders_account_idx").on(table2.accountId),
      clientIdx: index("service_orders_client_idx").on(table2.clientId),
      dateIdx: index("service_orders_account_date_idx").on(table2.accountId, table2.orderDate),
      numberIdx: index("service_orders_account_number_idx").on(table2.accountId, table2.orderNumber)
    }));
    serviceOrderItems = mysqlTable("service_order_items", {
      id: int("id").autoincrement().primaryKey(),
      serviceOrderId: int("serviceOrderId").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
      description: varchar("description", { length: 255 }).notNull(),
      quantity: int("quantity").notNull().default(1),
      unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
      totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table2) => ({
      orderIdx: index("service_order_items_order_idx").on(table2.serviceOrderId)
    }));
    trashItems = mysqlTable("trash_items", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      itemType: varchar("itemType", { length: 40 }).notNull(),
      originalId: int("originalId").notNull(),
      label: varchar("label", { length: 255 }).notNull(),
      snapshot: text("snapshot").notNull(),
      deletedAt: timestamp("deletedAt").defaultNow().notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      deletedByMemberId: int("deletedByMemberId"),
      deletedByName: varchar("deletedByName", { length: 255 }),
      ownerMemberId: int("ownerMemberId")
    }, (table2) => ({
      accountExpiryIdx: index("trash_items_account_expiry_idx").on(table2.accountId, table2.expiresAt),
      accountDeletedIdx: index("trash_items_account_deleted_idx").on(table2.accountId, table2.deletedAt)
    }));
    systemSettings = mysqlTable("system_settings", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      settingKey: varchar("settingKey", { length: 100 }).notNull(),
      settingValue: text("settingValue").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      accountKeyUnique: uniqueIndex("system_settings_account_key_unique").on(table2.accountId, table2.settingKey),
      accountIdx: index("system_settings_account_idx").on(table2.accountId)
    }));
    subscriptionPlans = mysqlTable("subscription_plans", {
      id: int("id").autoincrement().primaryKey(),
      name: varchar("name", { length: 120 }).notNull(),
      description: text("description"),
      price: decimal("price", { precision: 12, scale: 2 }).notNull().default("0.00"),
      billingCycle: mysqlEnum("billingCycle", ["monthly", "yearly"]).notNull().default("monthly"),
      maxUsers: int("maxUsers"),
      maxClients: int("maxClients"),
      maxExtinguishers: int("maxExtinguishers"),
      additionalUserPrice: decimal("additionalUserPrice", { precision: 12, scale: 2 }),
      availableForNew: boolean("availableForNew").notNull().default(true),
      active: boolean("active").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      nameIdx: index("subscription_plans_name_idx").on(table2.name),
      availableIdx: index("subscription_plans_available_idx").on(table2.availableForNew, table2.active)
    }));
    companySubscriptions = mysqlTable("company_subscriptions", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      planId: int("planId").notNull().references(() => subscriptionPlans.id, { onDelete: "restrict" }),
      status: mysqlEnum("status", ["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).notNull().default("active"),
      startsAt: date("startsAt").notNull(),
      endsAt: date("endsAt"),
      asaasCustomerId: varchar("asaasCustomerId", { length: 64 }),
      asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 64 }),
      billingInterval: mysqlEnum("billingInterval", ["monthly", "yearly"]),
      amount: decimal("amount", { precision: 12, scale: 2 }),
      currentPeriodStart: date("currentPeriodStart"),
      currentPeriodEnd: date("currentPeriodEnd"),
      trialEndsAt: date("trialEndsAt"),
      gracePeriodEndsAt: date("gracePeriodEndsAt"),
      cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").notNull().default(false),
      canceledAt: timestamp("canceledAt"),
      notes: text("notes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index("company_subscriptions_company_idx").on(table2.companyId),
      planIdx: index("company_subscriptions_plan_idx").on(table2.planId),
      statusIdx: index("company_subscriptions_status_idx").on(table2.status),
      endsAtIdx: index("company_subscriptions_ends_at_idx").on(table2.endsAt),
      asaasSubIdx: index("company_subscriptions_asaas_sub_idx").on(table2.asaasSubscriptionId)
    }));
    payments = mysqlTable("payments", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      subscriptionId: int("subscriptionId").references(() => companySubscriptions.id, { onDelete: "set null" }),
      asaasPaymentId: varchar("asaasPaymentId", { length: 64 }),
      asaasCustomerId: varchar("asaasCustomerId", { length: 64 }),
      asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 64 }),
      amount: decimal("amount", { precision: 12, scale: 2 }).notNull().default("0.00"),
      netAmount: decimal("netAmount", { precision: 12, scale: 2 }),
      billingType: mysqlEnum("billingType", ["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED", "MOCK"]).notNull().default("MOCK"),
      status: mysqlEnum("status", ["PENDING", "CONFIRMED", "RECEIVED", "OVERDUE", "REFUNDED", "DELETED", "MOCK_APPROVED", "MOCK_PENDING", "MOCK_OVERDUE"]).notNull().default("PENDING"),
      dueDate: date("dueDate"),
      paymentDate: date("paymentDate"),
      invoiceUrl: text("invoiceUrl"),
      bankSlipUrl: text("bankSlipUrl"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index("payments_company_idx").on(table2.companyId),
      subscriptionIdx: index("payments_subscription_idx").on(table2.subscriptionId),
      asaasPaymentIdx: index("payments_asaas_payment_idx").on(table2.asaasPaymentId),
      statusIdx: index("payments_status_idx").on(table2.status)
    }));
    paymentEvents = mysqlTable("payment_events", {
      id: int("id").autoincrement().primaryKey(),
      eventId: varchar("eventId", { length: 128 }).notNull().unique(),
      event: varchar("event", { length: 120 }).notNull(),
      paymentId: int("paymentId"),
      subscriptionId: int("subscriptionId"),
      payload: text("payload").notNull(),
      processed: boolean("processed").notNull().default(false),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table2) => ({
      processedIdx: index("payment_events_processed_idx").on(table2.processed)
    }));
    auditLogs = mysqlTable("audit_logs", {
      id: int("id").autoincrement().primaryKey(),
      companyId: int("companyId").references(() => companies.id, { onDelete: "cascade" }),
      userId: int("userId"),
      userName: varchar("userName", { length: 255 }),
      userEmail: varchar("userEmail", { length: 320 }),
      action: varchar("action", { length: 64 }).notNull(),
      module: varchar("module", { length: 64 }).notNull(),
      entityType: varchar("entityType", { length: 64 }).notNull(),
      entityId: int("entityId"),
      entityLabel: varchar("entityLabel", { length: 255 }),
      description: text("description").notNull(),
      oldData: text("oldData"),
      newData: text("newData"),
      ipAddress: varchar("ipAddress", { length: 64 }),
      userAgent: varchar("userAgent", { length: 512 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table2) => ({
      companyIdx: index("audit_logs_company_idx").on(table2.companyId),
      companyCreatedIdx: index("audit_logs_company_created_idx").on(table2.companyId, table2.createdAt),
      userIdx: index("audit_logs_user_idx").on(table2.userId),
      entityIdx: index("audit_logs_entity_idx").on(table2.entityType, table2.entityId),
      actionIdx: index("audit_logs_action_idx").on(table2.action),
      moduleIdx: index("audit_logs_module_idx").on(table2.module),
      createdIdx: index("audit_logs_created_idx").on(table2.createdAt)
    }));
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  auditLogs: () => auditLogs2,
  brands: () => brands,
  checklistQuestions: () => checklistQuestions,
  checklistResponses: () => checklistResponses,
  checklists: () => checklists,
  clients: () => clients2,
  companies: () => companies2,
  companyFeatureOverrides: () => companyFeatureOverrides,
  companySubscriptions: () => companySubscriptions2,
  evidences: () => evidences,
  inventoryProducts: () => inventoryProducts,
  legalAcceptances: () => legalAcceptances,
  liveErrorOverrides: () => liveErrorOverrides,
  memberAccounts: () => memberAccounts2,
  memberFeaturePermissions: () => memberFeaturePermissions,
  memberSessions: () => memberSessions2,
  platformAdmins: () => platformAdmins2,
  platformAnnouncementCompanies: () => platformAnnouncementCompanies,
  platformAnnouncementDismissals: () => platformAnnouncementDismissals,
  platformAnnouncementMembers: () => platformAnnouncementMembers,
  platformAnnouncements: () => platformAnnouncements,
  platformJobRuns: () => platformJobRuns,
  platformSessions: () => platformSessions2,
  promoterProfiles: () => promoterProfiles,
  retailChains: () => retailChains,
  routes: () => routes,
  storePhotos: () => storePhotos,
  stores: () => stores,
  subscriptionPlanFeatures: () => subscriptionPlanFeatures,
  subscriptionPlans: () => subscriptionPlans2,
  systemSettings: () => systemSettings2,
  teams: () => teams,
  timeCorrectionRequests: () => timeCorrectionRequests,
  timeDayTreatments: () => timeDayTreatments,
  timeEvents: () => timeEvents,
  users: () => users2,
  vacationSchedules: () => vacationSchedules,
  visitPhotos: () => visitPhotos,
  visits: () => visits,
  weeklyRouteSchedules: () => weeklyRouteSchedules
});
import { bigint, boolean as boolean2, date as date2, decimal as decimal2, index as index2, int as int2, json, mysqlEnum as mysqlEnum2, mysqlTable as mysqlTable2, text as text2, timestamp as timestamp2, uniqueIndex as uniqueIndex2, varchar as varchar2, double } from "drizzle-orm/mysql-core";
var users2, companies2, platformAdmins2, memberAccounts2, promoterProfiles, memberSessions2, platformSessions2, clients2, brands, retailChains, stores, teams, routes, weeklyRouteSchedules, inventoryProducts, visits, timeEvents, timeCorrectionRequests, timeDayTreatments, checklists, checklistQuestions, checklistResponses, evidences, auditLogs2, subscriptionPlans2, subscriptionPlanFeatures, companyFeatureOverrides, memberFeaturePermissions, companySubscriptions2, systemSettings2, storePhotos, visitPhotos, vacationSchedules, platformAnnouncements, platformAnnouncementCompanies, platformAnnouncementDismissals, platformAnnouncementMembers, legalAcceptances, liveErrorOverrides, platformJobRuns;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    users2 = mysqlTable2("users", {
      id: int2("id").autoincrement().primaryKey(),
      openId: varchar2("openId", { length: 64 }).notNull().unique(),
      name: text2("name"),
      email: varchar2("email", { length: 320 }),
      loginMethod: varchar2("loginMethod", { length: 64 }),
      role: mysqlEnum2("role", ["oauth_user", "platform_admin"]).default("oauth_user").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull(),
      lastSignedIn: timestamp2("lastSignedIn").defaultNow().notNull()
    });
    companies2 = mysqlTable2("companies", {
      id: int2("id").autoincrement().primaryKey(),
      name: varchar2("name", { length: 255 }).notNull(),
      active: boolean2("active").default(true).notNull(),
      planId: int2("planId"),
      subscriptionStatus: mysqlEnum2("subscriptionStatus", ["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]),
      asaasCustomerId: varchar2("asaasCustomerId", { length: 64 }),
      asaasSubscriptionId: varchar2("asaasSubscriptionId", { length: 64 }),
      subscriptionStartedAt: timestamp2("subscriptionStartedAt"),
      subscriptionExpiresAt: timestamp2("subscriptionExpiresAt"),
      trialEndsAt: timestamp2("trialEndsAt"),
      gracePeriodEndsAt: timestamp2("gracePeriodEndsAt"),
      legalName: varchar2("legalName", { length: 200 }),
      tradeName: varchar2("tradeName", { length: 200 }),
      taxDocument: varchar2("taxDocument", { length: 14 }),
      stateRegistration: varchar2("stateRegistration", { length: 30 }),
      establishment: varchar2("establishment", { length: 200 }),
      addressZip: varchar2("addressZip", { length: 8 }),
      addressStreet: varchar2("addressStreet", { length: 200 }),
      addressNumber: varchar2("addressNumber", { length: 20 }),
      addressComplement: varchar2("addressComplement", { length: 120 }),
      addressDistrict: varchar2("addressDistrict", { length: 120 }),
      addressCity: varchar2("addressCity", { length: 120 }),
      addressState: varchar2("addressState", { length: 2 }),
      contactPhone: varchar2("contactPhone", { length: 50 }),
      contactEmail: varchar2("contactEmail", { length: 320 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      activeIdx: index2("companies_active_idx").on(table2.active),
      nameIdx: index2("companies_name_idx").on(table2.name),
      planIdx: index2("companies_plan_idx").on(table2.planId),
      subscriptionStatusIdx: index2("companies_subscription_status_idx").on(table2.subscriptionStatus)
    }));
    platformAdmins2 = mysqlTable2("platform_admins", {
      id: int2("id").autoincrement().primaryKey(),
      userName: varchar2("userName", { length: 255 }).notNull(),
      email: varchar2("email", { length: 320 }).notNull().unique(),
      passwordHash: varchar2("passwordHash", { length: 255 }).notNull(),
      recoveryCodeHash: varchar2("recoveryCodeHash", { length: 255 }),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    });
    memberAccounts2 = mysqlTable2("member_accounts", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      userName: varchar2("userName", { length: 255 }).notNull(),
      email: varchar2("email", { length: 320 }).notNull().unique(),
      passwordHash: varchar2("passwordHash", { length: 255 }).notNull(),
      recoveryCodeHash: varchar2("recoveryCodeHash", { length: 255 }),
      role: mysqlEnum2("role", ["company_admin", "supervisor", "promoter"]).default("promoter").notNull(),
      active: boolean2("active").default(true).notNull(),
      phone: varchar2("phone", { length: 50 }),
      cpf: varchar2("cpf", { length: 11 }),
      pis: varchar2("pis", { length: 11 }),
      rg: varchar2("rg", { length: 20 }),
      birthDate: varchar2("birthDate", { length: 10 }),
      jobTitle: varchar2("jobTitle", { length: 120 }),
      admissionDate: varchar2("admissionDate", { length: 10 }),
      supervisorId: int2("supervisorId"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("member_accounts_company_idx").on(table2.companyId),
      companyRoleIdx: index2("member_accounts_company_role_idx").on(table2.companyId, table2.role)
    }));
    promoterProfiles = mysqlTable2("promoter_profiles", {
      memberAccountId: int2("memberAccountId").primaryKey().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      employeeCode: varchar2("employeeCode", { length: 50 }),
      workStartTime: varchar2("workStartTime", { length: 5 }),
      workEndTime: varchar2("workEndTime", { length: 5 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("promoter_profiles_company_idx").on(table2.companyId),
      companyEmployeeCodeUnique: uniqueIndex2("promoter_profiles_company_employee_code_unique").on(table2.companyId, table2.employeeCode)
    }));
    memberSessions2 = mysqlTable2("member_sessions", {
      id: int2("id").autoincrement().primaryKey(),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      tokenHash: varchar2("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      accountExpiryIdx: index2("member_sessions_account_expiry_idx").on(table2.memberAccountId, table2.expiresAt)
    }));
    platformSessions2 = mysqlTable2("platform_sessions", {
      id: int2("id").autoincrement().primaryKey(),
      platformAdminId: int2("platformAdminId").notNull().references(() => platformAdmins2.id, { onDelete: "cascade" }),
      tokenHash: varchar2("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      adminExpiryIdx: index2("platform_sessions_admin_expiry_idx").on(table2.platformAdminId, table2.expiresAt)
    }));
    clients2 = mysqlTable2("clients", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      cnpj: varchar2("cnpj", { length: 30 }),
      contactName: varchar2("contactName", { length: 255 }),
      phone: varchar2("phone", { length: 50 }),
      email: varchar2("email", { length: 320 }),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("clients_company_idx").on(table2.companyId),
      nameIdx: index2("clients_company_name_idx").on(table2.companyId, table2.name)
    }));
    brands = mysqlTable2("brands", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      clientId: int2("clientId").references(() => clients2.id, { onDelete: "set null" }),
      name: varchar2("name", { length: 255 }).notNull(),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("brands_company_idx").on(table2.companyId),
      clientIdx: index2("brands_client_idx").on(table2.clientId)
    }));
    retailChains = mysqlTable2("retail_chains", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("retail_chains_company_idx").on(table2.companyId)
    }));
    stores = mysqlTable2("stores", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      clientId: int2("clientId").references(() => clients2.id, { onDelete: "set null" }),
      brandId: int2("brandId").references(() => brands.id, { onDelete: "set null" }),
      retailChainId: int2("retailChainId").references(() => retailChains.id, { onDelete: "set null" }),
      name: varchar2("name", { length: 255 }).notNull(),
      code: varchar2("code", { length: 50 }),
      address: text2("address"),
      city: varchar2("city", { length: 120 }).notNull(),
      state: varchar2("state", { length: 2 }),
      cep: varchar2("cep", { length: 20 }),
      latitude: double("latitude"),
      longitude: double("longitude"),
      contactName: varchar2("contactName", { length: 255 }),
      phone: varchar2("phone", { length: 50 }),
      expectedVisitFrequency: varchar2("expectedVisitFrequency", { length: 50 }),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("stores_company_idx").on(table2.companyId),
      clientIdx: index2("stores_client_idx").on(table2.clientId),
      cityIdx: index2("stores_company_city_idx").on(table2.companyId, table2.city),
      geoIdx: index2("stores_geo_idx").on(table2.latitude, table2.longitude)
    }));
    teams = mysqlTable2("teams", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      supervisorId: int2("supervisorId"),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("teams_company_idx").on(table2.companyId)
    }));
    routes = mysqlTable2("routes", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      date: date2("date").notNull(),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      teamId: int2("teamId").references(() => teams.id, { onDelete: "set null" }),
      status: mysqlEnum2("status", ["draft", "assigned", "in_progress", "completed", "cancelled"]).default("assigned").notNull(),
      notes: text2("notes"),
      createdByUserId: int2("createdByUserId"),
      weeklyScheduleId: int2("weeklyScheduleId"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("routes_company_idx").on(table2.companyId),
      promoterDateIdx: index2("routes_promoter_date_idx").on(table2.promoterId, table2.date),
      dateIdx: index2("routes_company_date_idx").on(table2.companyId, table2.date),
      weeklyOccurrenceUnique: uniqueIndex2("routes_weekly_occurrence_unique").on(table2.weeklyScheduleId, table2.date)
    }));
    weeklyRouteSchedules = mysqlTable2("weekly_route_schedules", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      weekday: int2("weekday").notNull(),
      // 0 = domingo, 6 = sábado
      name: varchar2("name", { length: 255 }).notNull(),
      storeIds: json("storeIds").$type().notNull(),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("weekly_route_schedules_company_idx").on(table2.companyId),
      promoterDayUnique: uniqueIndex2("weekly_route_schedules_promoter_day_unique").on(table2.companyId, table2.promoterId, table2.weekday)
    }));
    inventoryProducts = mysqlTable2("inventory_products", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      productCode: varchar2("productCode", { length: 64 }).notNull(),
      description: varchar2("description", { length: 500 }).notNull(),
      quantity: int2("quantity").notNull().default(0),
      expirationDate: date2("expirationDate").notNull(),
      price: decimal2("price", { precision: 12, scale: 2 }).notNull().default("0.00"),
      storeId: int2("storeId"),
      /** Indústria (cliente da loja, tabela store_clients). */
      storeClientId: int2("storeClientId"),
      lot: varchar2("lot", { length: 64 }),
      /** Foto da etiqueta no R2: product-photos/{companyId}/... */
      photoKey: varchar2("photoKey", { length: 512 }),
      createdByMemberId: int2("createdByMemberId"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("inventory_products_company_idx").on(table2.companyId),
      codeIdx: index2("inventory_products_company_code_idx").on(table2.companyId, table2.productCode),
      expiryIdx: index2("inventory_products_expiration_idx").on(table2.companyId, table2.expirationDate)
    }));
    visits = mysqlTable2("visits", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      routeId: int2("routeId").references(() => routes.id, { onDelete: "cascade" }),
      storeId: int2("storeId").references(() => stores.id, { onDelete: "set null" }),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      plannedStart: timestamp2("plannedStart"),
      plannedEnd: timestamp2("plannedEnd"),
      actualStart: timestamp2("actualStart"),
      actualEnd: timestamp2("actualEnd"),
      status: mysqlEnum2("status", ["pending", "in_progress", "completed", "not_done", "cancelled"]).default("pending").notNull(),
      startLatitude: double("startLatitude"),
      startLongitude: double("startLongitude"),
      startAccuracy: double("startAccuracy"),
      endLatitude: double("endLatitude"),
      endLongitude: double("endLongitude"),
      endAccuracy: double("endAccuracy"),
      distanceMeters: double("distanceMeters"),
      justification: text2("justification"),
      notes: text2("notes"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("visits_company_idx").on(table2.companyId),
      routeIdx: index2("visits_route_idx").on(table2.routeId),
      storeIdx: index2("visits_store_idx").on(table2.storeId),
      promoterIdx: index2("visits_promoter_idx").on(table2.promoterId),
      statusIdx: index2("visits_status_idx").on(table2.companyId, table2.status)
    }));
    timeEvents = mysqlTable2("time_events", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      eventType: mysqlEnum2("eventType", ["clock_in", "break_start", "break_end", "clock_out"]).notNull(),
      serverTime: timestamp2("serverTime").defaultNow().notNull(),
      deviceTime: timestamp2("deviceTime"),
      latitude: double("latitude"),
      longitude: double("longitude"),
      accuracy: double("accuracy"),
      locationStatus: mysqlEnum2("locationStatus", ["success", "permission_denied", "unavailable", "timeout", "error"]).default("success"),
      locationError: text2("locationError"),
      deviceInfo: text2("deviceInfo"),
      idempotencyKey: varchar2("idempotencyKey", { length: 64 }),
      synced: boolean2("synced").default(true).notNull(),
      notes: text2("notes"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      // --- Livro de ponto à prova de alteração (Portaria 671; ver server/ponto/ledger.ts e drizzle/0026) ---
      /** Número Sequencial de Registro por empresa (só marcações originais). */
      nsr: bigint("nsr", { mode: "number" }),
      /** SHA-256 do registro (tipo 7 do AFD para originais; cadeia própria para tratamentos). */
      recordHash: varchar2("recordHash", { length: 64 }),
      prevHash: varchar2("prevHash", { length: 64 }),
      /** SHA-256 do conteúdo completo (tipo, horários, GPS) da marcação original. */
      contentHash: varchar2("contentHash", { length: 64 }),
      timeZone: varchar2("timeZone", { length: 64 }),
      collectorId: varchar2("collectorId", { length: 8 }),
      offline: boolean2("offline").default(false).notNull(),
      /** Horário informado pelo aparelho (sempre guardado, mesmo quando divergente). */
      clientTime: timestamp2("clientTime"),
      workerCpf: varchar2("workerCpf", { length: 14 }),
      /** original = batida do funcionário; inclusion = incluída por tratamento; adjustment = substitui replacesEventId. */
      origin: varchar2("origin", { length: 16 }).default("original").notNull(),
      replacesEventId: int2("replacesEventId"),
      correctionRequestId: int2("correctionRequestId"),
      recordedByMemberId: int2("recordedByMemberId"),
      recordedByName: varchar2("recordedByName", { length: 255 }),
      reason: text2("reason"),
      sealedLegacy: boolean2("sealedLegacy").default(false).notNull()
    }, (table2) => ({
      companyIdx: index2("time_events_company_idx").on(table2.companyId),
      memberIdx: index2("time_events_member_idx").on(table2.memberAccountId),
      memberTimeIdx: index2("time_events_member_time_idx").on(table2.memberAccountId, table2.serverTime),
      idempotencyIdx: uniqueIndex2("time_events_idempotency_unique").on(table2.idempotencyKey)
    }));
    timeCorrectionRequests = mysqlTable2("time_correction_requests", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      timeEventId: int2("timeEventId").references(() => timeEvents.id, { onDelete: "set null" }),
      requestedType: mysqlEnum2("requestedType", ["clock_in", "break_start", "break_end", "clock_out"]).notNull(),
      requestedTime: timestamp2("requestedTime").notNull(),
      justification: text2("justification").notNull(),
      status: mysqlEnum2("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
      reviewedByUserId: int2("reviewedByUserId"),
      reviewNotes: text2("reviewNotes"),
      reviewedAt: timestamp2("reviewedAt"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      justificationType: varchar2("justificationType", { length: 32 }).default("normal"),
      attachmentKey: varchar2("attachmentKey", { length: 512 })
    }, (table2) => ({
      companyIdx: index2("time_corrections_company_idx").on(table2.companyId),
      memberIdx: index2("time_corrections_member_idx").on(table2.memberAccountId),
      statusIdx: index2("time_corrections_status_idx").on(table2.companyId, table2.status)
    }));
    timeDayTreatments = mysqlTable2("time_day_treatments", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      day: varchar2("day", { length: 10 }).notNull(),
      decision: varchar2("decision", { length: 32 }).notNull(),
      notes: text2("notes"),
      decidedByUserId: int2("decidedByUserId"),
      decidedByName: varchar2("decidedByName", { length: 255 }),
      decidedAt: timestamp2("decidedAt").defaultNow().notNull(),
      reversedAt: timestamp2("reversedAt"),
      reversedByUserId: int2("reversedByUserId"),
      reversedByName: varchar2("reversedByName", { length: 255 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      memberDayIdx: index2("time_day_treatments_member_day").on(table2.companyId, table2.memberAccountId, table2.day),
      companyIdx: index2("time_day_treatments_company").on(table2.companyId)
    }));
    checklists = mysqlTable2("checklists", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      clientId: int2("clientId").references(() => clients2.id, { onDelete: "set null" }),
      brandId: int2("brandId").references(() => brands.id, { onDelete: "set null" }),
      description: text2("description"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("checklists_company_idx").on(table2.companyId)
    }));
    checklistQuestions = mysqlTable2("checklist_questions", {
      id: int2("id").autoincrement().primaryKey(),
      checklistId: int2("checklistId").notNull().references(() => checklists.id, { onDelete: "cascade" }),
      order: int2("order").notNull().default(0),
      questionText: text2("questionText").notNull(),
      questionType: mysqlEnum2("questionType", ["text", "yes_no", "select", "number", "photo", "observation"]).notNull(),
      required: boolean2("required").default(false).notNull(),
      options: text2("options"),
      // JSON for select options
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      checklistIdx: index2("checklist_questions_checklist_idx").on(table2.checklistId)
    }));
    checklistResponses = mysqlTable2("checklist_responses", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      visitId: int2("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
      checklistId: int2("checklistId").notNull().references(() => checklists.id, { onDelete: "restrict" }),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      responses: text2("responses").notNull(),
      // JSON
      completedAt: timestamp2("completedAt").defaultNow().notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      visitIdx: index2("checklist_responses_visit_idx").on(table2.visitId),
      companyIdx: index2("checklist_responses_company_idx").on(table2.companyId)
    }));
    evidences = mysqlTable2("evidences", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      visitId: int2("visitId").references(() => visits.id, { onDelete: "cascade" }),
      checklistResponseId: int2("checklistResponseId").references(() => checklistResponses.id, { onDelete: "cascade" }),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      fileUrl: text2("fileUrl").notNull(),
      fileName: varchar2("fileName", { length: 255 }),
      mimeType: varchar2("mimeType", { length: 100 }),
      sizeBytes: int2("sizeBytes"),
      caption: text2("caption"),
      latitude: double("latitude"),
      longitude: double("longitude"),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      companyIdx: index2("evidences_company_idx").on(table2.companyId),
      visitIdx: index2("evidences_visit_idx").on(table2.visitId)
    }));
    auditLogs2 = mysqlTable2("audit_logs", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").references(() => companies2.id, { onDelete: "cascade" }),
      userId: int2("userId"),
      userName: varchar2("userName", { length: 255 }),
      userEmail: varchar2("userEmail", { length: 320 }),
      action: varchar2("action", { length: 64 }).notNull(),
      module: varchar2("module", { length: 64 }).notNull(),
      entityType: varchar2("entityType", { length: 64 }).notNull(),
      entityId: int2("entityId"),
      entityLabel: varchar2("entityLabel", { length: 255 }),
      description: text2("description").notNull(),
      oldData: text2("oldData"),
      newData: text2("newData"),
      ipAddress: varchar2("ipAddress", { length: 64 }),
      userAgent: varchar2("userAgent", { length: 512 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      companyIdx: index2("audit_logs_company_idx").on(table2.companyId),
      companyCreatedIdx: index2("audit_logs_company_created_idx").on(table2.companyId, table2.createdAt),
      userIdx: index2("audit_logs_user_idx").on(table2.userId),
      entityIdx: index2("audit_logs_entity_idx").on(table2.entityType, table2.entityId),
      actionIdx: index2("audit_logs_action_idx").on(table2.action),
      moduleIdx: index2("audit_logs_module_idx").on(table2.module),
      createdIdx: index2("audit_logs_created_idx").on(table2.createdAt)
    }));
    subscriptionPlans2 = mysqlTable2("subscription_plans", {
      id: int2("id").autoincrement().primaryKey(),
      name: varchar2("name", { length: 120 }).notNull(),
      description: text2("description"),
      price: decimal2("price", { precision: 12, scale: 2 }).notNull().default("0.00"),
      billingCycle: mysqlEnum2("billingCycle", ["monthly", "yearly"]).notNull().default("monthly"),
      maxUsers: int2("maxUsers"),
      maxClients: int2("maxClients"),
      maxExtinguishers: int2("maxExtinguishers"),
      additionalUserPrice: decimal2("additionalUserPrice", { precision: 12, scale: 2 }),
      availableForNew: boolean2("availableForNew").notNull().default(true),
      active: boolean2("active").notNull().default(true),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      nameIdx: index2("subscription_plans_name_idx").on(table2.name),
      availableIdx: index2("subscription_plans_available_idx").on(table2.availableForNew, table2.active)
    }));
    subscriptionPlanFeatures = mysqlTable2("subscription_plan_features", {
      id: int2("id").autoincrement().primaryKey(),
      planId: int2("planId").notNull().references(() => subscriptionPlans2.id, { onDelete: "cascade" }),
      featureKey: varchar2("featureKey", { length: 64 }).notNull(),
      enabled: boolean2("enabled").notNull().default(false),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      planFeatureUnique: uniqueIndex2("subscription_plan_features_plan_feature_unique").on(table2.planId, table2.featureKey),
      planIdx: index2("subscription_plan_features_plan_idx").on(table2.planId)
    }));
    companyFeatureOverrides = mysqlTable2("company_feature_overrides", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "cascade" }),
      featureKey: varchar2("featureKey", { length: 64 }).notNull(),
      enabled: boolean2("enabled").notNull(),
      reason: text2("reason"),
      updatedByPlatformAdminId: int2("updatedByPlatformAdminId").references(() => platformAdmins2.id, { onDelete: "set null" }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyFeatureUnique: uniqueIndex2("company_feature_overrides_company_feature_unique").on(table2.companyId, table2.featureKey),
      companyIdx: index2("company_feature_overrides_company_idx").on(table2.companyId)
    }));
    memberFeaturePermissions = mysqlTable2("member_feature_permissions", {
      id: int2("id").autoincrement().primaryKey(),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      featureKey: varchar2("featureKey", { length: 64 }).notNull(),
      mode: mysqlEnum2("mode", ["allow", "deny"]).notNull(),
      updatedByMemberAccountId: int2("updatedByMemberAccountId").references(() => memberAccounts2.id, { onDelete: "set null" }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      memberFeatureUnique: uniqueIndex2("member_feature_permissions_member_feature_unique").on(table2.memberAccountId, table2.featureKey),
      memberIdx: index2("member_feature_permissions_member_idx").on(table2.memberAccountId)
    }));
    companySubscriptions2 = mysqlTable2("company_subscriptions", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "cascade" }),
      planId: int2("planId").notNull().references(() => subscriptionPlans2.id, { onDelete: "restrict" }),
      status: mysqlEnum2("status", ["trial", "active", "pending", "overdue", "suspended", "canceled", "expired"]).notNull(),
      startedAt: timestamp2("startedAt").defaultNow().notNull(),
      expiresAt: timestamp2("expiresAt"),
      asaasSubscriptionId: varchar2("asaasSubscriptionId", { length: 64 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyIdx: index2("company_subscriptions_company_idx").on(table2.companyId)
    }));
    systemSettings2 = mysqlTable2("system_settings", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "cascade" }),
      settingKey: varchar2("settingKey", { length: 100 }).notNull(),
      settingValue: text2("settingValue").notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      accountKeyUnique: uniqueIndex2("system_settings_company_key_unique").on(table2.companyId, table2.settingKey),
      companyIdx: index2("system_settings_company_idx").on(table2.companyId)
    }));
    storePhotos = mysqlTable2("store_photos", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      storeId: int2("storeId").references(() => stores.id, { onDelete: "set null" }),
      promoterId: int2("promoterId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      visitId: int2("visitId").references(() => visits.id, { onDelete: "set null" }),
      capturedAt: timestamp2("capturedAt").notNull(),
      latitude: double("latitude"),
      longitude: double("longitude"),
      accuracy: double("accuracy"),
      locationStatus: mysqlEnum2("locationStatus", ["success", "permission_denied", "unavailable", "timeout", "error"]).default("unavailable"),
      fileKey: varchar2("fileKey", { length: 512 }).notNull(),
      thumbnailKey: varchar2("thumbnailKey", { length: 512 }),
      mimeType: varchar2("mimeType", { length: 100 }),
      fileSize: int2("fileSize"),
      idempotencyKey: varchar2("idempotencyKey", { length: 64 }),
      uploadStatus: mysqlEnum2("uploadStatus", ["pending", "uploaded", "failed"]).default("pending").notNull(),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyStoreDateIdx: index2("store_photos_company_store_date_idx").on(table2.companyId, table2.storeId, table2.capturedAt),
      companyPromoterIdx: index2("store_photos_company_promoter_idx").on(table2.companyId, table2.promoterId),
      expiresIdx: index2("store_photos_expires_idx").on(table2.expiresAt),
      companyIdempotencyUnique: uniqueIndex2("store_photos_company_idempotency_unique").on(table2.companyId, table2.idempotencyKey)
    }));
    visitPhotos = mysqlTable2("visit_photos", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull(),
      visitId: int2("visitId").notNull(),
      type: mysqlEnum2("type", ["checkin", "checkout"]).notNull(),
      fileKey: varchar2("fileKey", { length: 512 }).notNull(),
      latitude: double("latitude"),
      longitude: double("longitude"),
      address: varchar2("address", { length: 255 }),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table2) => ({
      visitIdx: index2("visit_photos_visit_idx").on(table2.visitId),
      expiresIdx: index2("visit_photos_expires_idx").on(table2.expiresAt)
    }));
    vacationSchedules = mysqlTable2("vacation_schedules", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      startDate: date2("startDate").notNull(),
      endDate: date2("endDate").notNull(),
      days: int2("days").notNull(),
      status: mysqlEnum2("status", ["scheduled", "cancelled"]).default("scheduled").notNull(),
      notes: text2("notes"),
      createdByMemberAccountId: int2("createdByMemberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "restrict" }),
      updatedByMemberAccountId: int2("updatedByMemberAccountId").references(() => memberAccounts2.id, { onDelete: "set null" }),
      cancelledByMemberAccountId: int2("cancelledByMemberAccountId").references(() => memberAccounts2.id, { onDelete: "set null" }),
      cancelledAt: timestamp2("cancelledAt"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      companyMemberIdx: index2("vacation_schedules_company_member_idx").on(table2.companyId, table2.memberAccountId),
      companyDatesIdx: index2("vacation_schedules_company_dates_idx").on(table2.companyId, table2.startDate, table2.endDate),
      statusIdx: index2("vacation_schedules_status_idx").on(table2.status)
    }));
    platformAnnouncements = mysqlTable2("platform_announcements", {
      id: int2("id").autoincrement().primaryKey(),
      title: varchar2("title", { length: 200 }).notNull(),
      body: text2("body").notNull(),
      tone: mysqlEnum2("tone", ["info", "warning", "urgent"]).notNull().default("info"),
      buttonLabel: varchar2("buttonLabel", { length: 80 }),
      buttonUrl: varchar2("buttonUrl", { length: 500 }),
      audienceScope: mysqlEnum2("audienceScope", ["all", "selected"]).notNull().default("all"),
      roles: varchar2("roles", { length: 120 }).notNull(),
      startsAt: date2("startsAt"),
      endsAt: date2("endsAt"),
      dismissable: boolean2("dismissable").notNull().default(true),
      active: boolean2("active").notNull().default(true),
      createdByPlatformAdminId: int2("createdByPlatformAdminId"),
      updatedByPlatformAdminId: int2("updatedByPlatformAdminId"),
      source: varchar2("source", { length: 16 }).notNull().default("platform"),
      companyId: int2("companyId"),
      createdByMemberAccountId: int2("createdByMemberAccountId"),
      updatedByMemberAccountId: int2("updatedByMemberAccountId"),
      targetMode: varchar2("targetMode", { length: 16 }).notNull().default("roles"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      activeIdx: index2("platform_announcements_active_idx").on(table2.active, table2.startsAt, table2.endsAt),
      sourceCompanyIdx: index2("platform_announcements_source_company_idx").on(table2.source, table2.companyId)
    }));
    platformAnnouncementCompanies = mysqlTable2("platform_announcement_companies", {
      id: int2("id").autoincrement().primaryKey(),
      announcementId: int2("announcementId").notNull(),
      companyId: int2("companyId").notNull()
    }, (table2) => ({
      uniquePair: uniqueIndex2("platform_announcement_companies_unique").on(table2.announcementId, table2.companyId),
      companyIdx: index2("platform_announcement_companies_company_idx").on(table2.companyId)
    }));
    platformAnnouncementDismissals = mysqlTable2("platform_announcement_dismissals", {
      id: int2("id").autoincrement().primaryKey(),
      announcementId: int2("announcementId").notNull(),
      memberAccountId: int2("memberAccountId").notNull(),
      dismissedAt: timestamp2("dismissedAt").defaultNow().notNull()
    }, (table2) => ({
      uniquePair: uniqueIndex2("platform_announcement_dismissals_unique").on(table2.announcementId, table2.memberAccountId),
      memberIdx: index2("platform_announcement_dismissals_member_idx").on(table2.memberAccountId)
    }));
    platformAnnouncementMembers = mysqlTable2("platform_announcement_members", {
      id: int2("id").autoincrement().primaryKey(),
      announcementId: int2("announcementId").notNull(),
      memberAccountId: int2("memberAccountId").notNull()
    }, (table2) => ({
      uniquePair: uniqueIndex2("platform_announcement_members_unique").on(table2.announcementId, table2.memberAccountId),
      memberIdx: index2("platform_announcement_members_member_idx").on(table2.memberAccountId)
    }));
    legalAcceptances = mysqlTable2("legal_acceptances", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull(),
      memberAccountId: int2("memberAccountId").notNull(),
      version: varchar2("version", { length: 32 }).notNull(),
      acceptedAt: timestamp2("acceptedAt").defaultNow().notNull(),
      ipAddress: varchar2("ipAddress", { length: 64 }),
      userAgent: varchar2("userAgent", { length: 512 })
    }, (table2) => ({
      uniqueVersion: uniqueIndex2("legal_acceptances_unique").on(table2.companyId, table2.memberAccountId, table2.version),
      companyVersionIdx: index2("legal_acceptances_company_version_idx").on(table2.companyId, table2.version)
    }));
    liveErrorOverrides = mysqlTable2("live_error_overrides", {
      id: int2("id").autoincrement().primaryKey(),
      sentryIssueId: varchar2("sentryIssueId", { length: 64 }).notNull(),
      classification: varchar2("classification", { length: 16 }).notNull(),
      githubIssueNumber: int2("githubIssueNumber"),
      githubIssueUrl: varchar2("githubIssueUrl", { length: 255 }),
      sentryIgnored: int2("sentryIgnored").default(0).notNull(),
      updatedBy: varchar2("updatedBy", { length: 255 }),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table2) => ({
      issueUnique: uniqueIndex2("live_error_overrides_issue").on(table2.sentryIssueId)
    }));
    platformJobRuns = mysqlTable2("platform_job_runs", {
      id: int2("id").autoincrement().primaryKey(),
      job: varchar2("job", { length: 64 }).notNull(),
      ok: int2("ok").notNull(),
      summary: varchar2("summary", { length: 500 }),
      startedAt: timestamp2("startedAt").notNull(),
      finishedAt: timestamp2("finishedAt").defaultNow().notNull()
    }, (table2) => ({
      jobFinishedIdx: index2("platform_job_runs_job_finished").on(table2.job, table2.finishedAt)
    }));
  }
});

// server/storeAccess.ts
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
function isCompanyAdmin(ctx) {
  return ctx.user.role === "company_admin";
}
function isSupervisor(ctx) {
  return ctx.user.role === "supervisor";
}
function hasFullStoreAccess(ctx) {
  return isCompanyAdmin(ctx) || isSupervisor(ctx);
}
function scopeMemberId(ctx) {
  if (hasFullStoreAccess(ctx)) return null;
  if (!ctx.memberAccountId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Seu usu\xE1rio n\xE3o est\xE1 vinculado a um perfil de campo." });
  }
  return ctx.memberAccountId;
}
function ensureStoreOwnersTable(db) {
  if (storeOwnersReady) return storeOwnersReady;
  storeOwnersReady = db.execute(`CREATE TABLE IF NOT EXISTS store_owners (
      storeId int NOT NULL,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (storeId),
      KEY store_owners_company_member_idx (companyId, memberAccountId)
    )`).then(() => void 0).catch((error) => {
    storeOwnersReady = null;
    throw error;
  });
  return storeOwnersReady;
}
function ensurePromoterStoreAssignmentsTable(db) {
  if (promoterAssignmentsReady) return promoterAssignmentsReady;
  promoterAssignmentsReady = db.execute(`CREATE TABLE IF NOT EXISTS promoter_store_assignments (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      promoterId int NOT NULL,
      storeId int NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY promoter_store_unique (promoterId, storeId),
      KEY promoter_store_company_promoter_idx (companyId, promoterId),
      KEY promoter_store_company_store_idx (companyId, storeId)
    )`).then(() => void 0).catch((error) => {
    promoterAssignmentsReady = null;
    throw error;
  });
  return promoterAssignmentsReady;
}
function storeAssignedToPromoter(storeIdColumn, promoterId) {
  return sql`EXISTS (SELECT 1 FROM promoter_store_assignments psa WHERE psa.storeId = ${storeIdColumn} AND psa.promoterId = ${promoterId})`;
}
function storeVisibleToMember(storeIdColumn, memberId) {
  return storeAssignedToPromoter(storeIdColumn, memberId);
}
async function recordStoreOwner(db, input) {
  await ensureStoreOwnersTable(db);
  await db.execute(sql`INSERT IGNORE INTO store_owners (storeId, companyId, memberAccountId) VALUES (${input.storeId}, ${input.companyId}, ${input.memberAccountId})`);
}
async function setPromoterStoreAssignments(db, companyId, promoterId, storeIds) {
  await ensurePromoterStoreAssignmentsTable(db);
  const unique = [...new Set(storeIds.filter((id3) => Number.isInteger(id3) && id3 > 0))];
  await db.execute(sql`DELETE FROM promoter_store_assignments WHERE companyId = ${companyId} AND promoterId = ${promoterId}`);
  if (unique.length === 0) return;
  const valid2 = await db.execute(sql`SELECT id FROM stores WHERE companyId = ${companyId} AND active = 1 AND id IN (${sql.join(unique.map((id3) => sql`${id3}`), sql`, `)})`);
  const validIds = (Array.isArray(valid2?.[0]) ? valid2[0] : Array.isArray(valid2) ? valid2 : valid2?.rows ?? []).map((r) => Number(r.id));
  if (validIds.length !== unique.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Uma ou mais lojas n\xE3o pertencem a esta empresa ou est\xE3o inativas." });
  }
  for (const storeId of validIds) {
    await db.execute(sql`INSERT IGNORE INTO promoter_store_assignments (companyId, promoterId, storeId) VALUES (${companyId}, ${promoterId}, ${storeId})`);
  }
}
async function getPromoterStoreAssignments(db, companyId, promoterId) {
  await ensurePromoterStoreAssignmentsTable(db);
  const res = await db.execute(sql`SELECT storeId FROM promoter_store_assignments WHERE companyId = ${companyId} AND promoterId = ${promoterId}`);
  const rows4 = Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [];
  return rows4.map((r) => Number(r.storeId));
}
async function assertStoreAccess(db, ctx, storeId) {
  const memberId = scopeMemberId(ctx);
  const conditions = [eq(stores.id, storeId), eq(stores.companyId, ctx.accountId)];
  if (memberId !== null) {
    await ensurePromoterStoreAssignmentsTable(db);
    conditions.push(storeAssignedToPromoter(stores.id, memberId));
  }
  const [store] = await db.select().from(stores).where(and(...conditions)).limit(1);
  if (!store) throw new TRPCError({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
  return store;
}
function assertPhotoAccess(ctx, photo) {
  const memberId = scopeMemberId(ctx);
  if (memberId !== null && photo.promoterId !== memberId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
  }
}
var storeOwnersReady, promoterAssignmentsReady;
var init_storeAccess = __esm({
  "server/storeAccess.ts"() {
    "use strict";
    init_schema();
    storeOwnersReady = null;
    promoterAssignmentsReady = null;
  }
});

// shared/expiry.ts
function todayInZone(now = /* @__PURE__ */ new Date(), timeZone = "America/Sao_Paulo") {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts;
}
function dayNumber(iso) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 864e5);
}
function addDays(iso, days) {
  return new Date((dayNumber(iso) + days) * 864e5).toISOString().slice(0, 10);
}
function daysUntil(expirationDate, today) {
  return dayNumber(expirationDate) - dayNumber(today);
}
function expiryStatus(expirationDate, today, nearDays = NEAR_EXPIRY_DAYS) {
  const diff = daysUntil(expirationDate, today);
  if (diff < 0) return "expired";
  if (diff <= nearDays) return "near";
  return "valid";
}
var NEAR_EXPIRY_DAYS;
var init_expiry = __esm({
  "shared/expiry.ts"() {
    "use strict";
    NEAR_EXPIRY_DAYS = 30;
  }
});

// shared/routeSchedule.ts
function duplicateOccurrenceIds(routes2, startedRouteIds2 = []) {
  const started = new Set(startedRouteIds2);
  const groups = /* @__PURE__ */ new Map();
  for (const route of routes2) {
    if (!route.weeklyScheduleId) continue;
    const day = route.date instanceof Date ? route.date.toISOString().slice(0, 10) : String(route.date ?? "").slice(0, 10);
    const key = `${route.weeklyScheduleId}|${day}`;
    groups.set(key, [...groups.get(key) || [], route]);
  }
  const hidden = /* @__PURE__ */ new Set();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.id - b.id);
    const keep = sorted.find((r) => started.has(r.id)) ?? sorted[0];
    for (const r of sorted) if (r.id !== keep.id && !started.has(r.id)) hidden.add(r.id);
  }
  return hidden;
}
var init_routeSchedule = __esm({
  "shared/routeSchedule.ts"() {
    "use strict";
  }
});

// shared/entitlements.ts
function resolveEntitlements(input) {
  const plan = new Set(input.planFeatures);
  const roleCeiling = new Set(ROLE_FEATURE_CEILING[input.role]);
  const roleDefaults = new Set(ROLE_FEATURE_DEFAULTS[input.role]);
  return Object.fromEntries(ENTITLEMENT_KEYS.map((key) => {
    const companyEnabled = key === "dashboard" ? true : input.companyOverrides?.[key] ?? plan.has(key);
    const mode = input.memberOverrides?.[key] ?? "inherit";
    const requested = mode === "allow" ? true : mode === "deny" ? false : roleDefaults.has(key);
    return [key, Boolean(companyEnabled && roleCeiling.has(key) && requested)];
  }));
}
var ENTITLEMENT_KEYS, ALL_FEATURES, SUPERVISOR_CEILING, PROMOTER_CEILING, ROLE_FEATURE_CEILING, ROLE_FEATURE_DEFAULTS;
var init_entitlements = __esm({
  "shared/entitlements.ts"() {
    "use strict";
    ENTITLEMENT_KEYS = [
      "dashboard",
      "clients",
      "pointsOfSale",
      "alerts",
      "timeTracking",
      "fieldOperations",
      "visitCheckIn",
      "products",
      "reports",
      "teamManagement",
      "backup",
      "offline"
    ];
    ALL_FEATURES = [...ENTITLEMENT_KEYS];
    SUPERVISOR_CEILING = [
      "dashboard",
      "clients",
      "pointsOfSale",
      "alerts",
      "timeTracking",
      "fieldOperations",
      "visitCheckIn",
      "products",
      "reports",
      "teamManagement",
      "offline"
    ];
    PROMOTER_CEILING = ["dashboard", "timeTracking", "fieldOperations", "visitCheckIn", "products"];
    ROLE_FEATURE_CEILING = {
      company_admin: ALL_FEATURES,
      supervisor: SUPERVISOR_CEILING,
      promoter: PROMOTER_CEILING
    };
    ROLE_FEATURE_DEFAULTS = {
      company_admin: ALL_FEATURES,
      supervisor: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "visitCheckIn", "products", "reports", "teamManagement"],
      promoter: ["dashboard", "timeTracking", "fieldOperations", "visitCheckIn", "products"]
    };
  }
});

// shared/commercialPlans.ts
function planNameKey(name) {
  return String(name ?? "").toLowerCase().trim();
}
function isLegacyPlanName(name) {
  return LEGACY_PLAN_NAME_KEYS.includes(planNameKey(name));
}
var LEGACY_PLAN_NAME_KEYS, PONTO_FEATURES, MERCHANDISING_FEATURES, COMMERCIAL_PLANS;
var init_commercialPlans = __esm({
  "shared/commercialPlans.ts"() {
    "use strict";
    init_entitlements();
    LEGACY_PLAN_NAME_KEYS = ["start", "profissional", "empresarial", "basico", "b\xE1sico", "ilimitado"];
    PONTO_FEATURES = [
      "dashboard",
      "timeTracking",
      "teamManagement",
      "reports",
      "backup",
      "offline"
    ];
    MERCHANDISING_FEATURES = [
      "dashboard",
      "clients",
      "pointsOfSale",
      "alerts",
      "fieldOperations",
      "visitCheckIn",
      "products",
      "reports",
      "teamManagement",
      "backup",
      "offline"
    ];
    COMMERCIAL_PLANS = [
      {
        name: "GONDUP Ponto",
        description: "At\xE9 20 funcion\xE1rios. Adicional de R$ 8,00 por funcion\xE1rio. Registro de ponto com GPS, corre\xE7\xF5es, comprovantes e espelho do m\xEAs.",
        price: "199.90",
        billingCycle: "monthly",
        includedUsers: 20,
        additionalUserPrice: "8.00",
        featureKeys: PONTO_FEATURES
      },
      {
        name: "GONDUP Merchandising",
        description: "At\xE9 20 promotores. Adicional de R$ 8,00 por promotor. Check-in/check-out com GPS, fotos, validades e alertas.",
        price: "179.90",
        billingCycle: "monthly",
        includedUsers: 20,
        additionalUserPrice: "8.00",
        featureKeys: MERCHANDISING_FEATURES
      },
      {
        name: "GONDUP Completo",
        description: "At\xE9 20 funcion\xE1rios. Adicional de R$ 12,00 por funcion\xE1rio. GONDUP Ponto + GONDUP Merchandising, os dois planos em um s\xF3.",
        price: "350.00",
        billingCycle: "monthly",
        includedUsers: 20,
        additionalUserPrice: "12.00",
        featureKeys: [...ENTITLEMENT_KEYS]
      }
    ];
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  isStorageConfigured: () => isStorageConfigured,
  storageDelete: () => storageDelete,
  storageDeleteMany: () => storageDeleteMany,
  storageGet: () => storageGet,
  storageGetSignedUrl: () => storageGetSignedUrl,
  storageListKeys: () => storageListKeys,
  storagePut: () => storagePut,
  storagePutExact: () => storagePutExact,
  storageRead: () => storageRead
});
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
function getS3Client() {
  const signature = [process.env.S3_BUCKET, process.env.S3_ACCESS_KEY_ID, process.env.S3_SECRET_ACCESS_KEY, process.env.S3_REGION, process.env.S3_ENDPOINT, process.env.S3_FORCE_PATH_STYLE, process.env.S3_PUBLIC_BASE_URL].join("|");
  if (cachedS3?.signature === signature) return cachedS3.value;
  const value = buildS3Client();
  cachedS3 = value ? { signature, value } : null;
  return value;
}
function buildS3Client() {
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!bucket || !accessKeyId || !secretAccessKey) return null;
  const rawRegion = process.env.S3_REGION || "us-east-1";
  const region = rawRegion === "auto" ? "us-east-1" : rawRegion;
  const endpoint = process.env.S3_ENDPOINT || void 0;
  const client = new S3Client({
    region,
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(endpoint && endpoint.includes("r2.cloudflarestorage.com")),
    credentials: { accessKeyId, secretAccessKey }
  });
  return { bucket, client, publicBaseUrl: process.env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, "") };
}
function isStorageConfigured() {
  return Boolean(getS3Client());
}
function publicOrSignedUrl(s3, key) {
  if (!s3) return Promise.reject(new Error("Storage is not configured."));
  if (s3.publicBaseUrl) {
    return Promise.resolve(`${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`);
  }
  return getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: await publicOrSignedUrl(s3, key) };
}
async function storagePutExact(relKey, data, contentType = "application/octet-stream") {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
  return { key, url: await publicOrSignedUrl(s3, key) };
}
async function storageGet(relKey) {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}
async function storageGetSignedUrl(relKey) {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  return publicOrSignedUrl(s3, key);
}
async function storageRead(relKey) {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const result = await s3.client.send(new GetObjectCommand({ Bucket: s3.bucket, Key: key }));
  if (!result.Body) throw new Error("Storage returned an empty image.");
  const bytes = await result.Body.transformToByteArray();
  return { data: Buffer.from(bytes), contentType: result.ContentType };
}
async function storageDelete(relKey) {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) return false;
  try {
    await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}
async function storageListKeys(prefix) {
  const s3 = getS3Client();
  if (!s3) return [];
  const keys = [];
  let continuationToken;
  do {
    const result = await s3.client.send(
      new ListObjectsV2Command({
        Bucket: s3.bucket,
        Prefix: normalizeKey(prefix),
        ContinuationToken: continuationToken
      })
    );
    for (const obj of result.Contents || []) {
      if (obj.Key) keys.push(obj.Key);
    }
    continuationToken = result.IsTruncated ? result.NextContinuationToken : void 0;
  } while (continuationToken);
  return keys;
}
async function storageDeleteMany(keys) {
  const s3 = getS3Client();
  if (!s3 || keys.length === 0) return 0;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += 1e3) {
    const chunk = keys.slice(i, i + 1e3).map((Key) => ({ Key: normalizeKey(Key) }));
    const result = await s3.client.send(
      new DeleteObjectsCommand({
        Bucket: s3.bucket,
        Delete: { Objects: chunk, Quiet: true }
      })
    );
    deleted += result.Deleted?.length ?? chunk.length;
  }
  return deleted;
}
var cachedS3;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    cachedS3 = null;
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  RouteValidationError: () => RouteValidationError,
  WeeklyRouteConflictError: () => WeeklyRouteConflictError,
  archiveOperationalStore: () => archiveOperationalStore,
  autoCloseStaleVisits: () => autoCloseStaleVisits,
  cleanupExpiredData: () => cleanupExpiredData,
  createCompany: () => createCompany,
  createCompanySubscription: () => createCompanySubscription,
  createInventoryProduct: () => createInventoryProduct,
  createOperationalRoute: () => createOperationalRoute,
  createOperationalRouteWithVisits: () => createOperationalRouteWithVisits,
  createOperationalStore: () => createOperationalStore,
  createPaymentRecord: () => createPaymentRecord,
  createSubscriptionPlan: () => createSubscriptionPlan,
  deleteInventoryProduct: () => deleteInventoryProduct,
  deleteInventoryProducts: () => deleteInventoryProducts,
  deleteOperationalRoute: () => deleteOperationalRoute,
  deleteWeeklyRouteSchedule: () => deleteWeeklyRouteSchedule,
  ensureAdditionalUserPriceColumn: () => ensureAdditionalUserPriceColumn,
  ensureInventoryProductsSchema: () => ensureInventoryProductsSchema,
  ensureOwnerScopeColumns: () => ensureOwnerScopeColumns,
  ensureProductsFeature: () => ensureProductsFeature,
  ensureSeedPlans: () => ensureSeedPlans,
  ensureTrashTable: () => ensureTrashTable,
  ensureVisitCheckInFeature: () => ensureVisitCheckInFeature,
  findPaymentEventByEventId: () => findPaymentEventByEventId,
  getCompanyById: () => getCompanyById,
  getCompanyFeatureOverrides: () => getCompanyFeatureOverrides,
  getDb: () => getDb,
  getExpiringInventoryProducts: () => getExpiringInventoryProducts,
  getInventoryProduct: () => getInventoryProduct,
  getLatestCompanySubscription: () => getLatestCompanySubscription,
  getMemberFeatureModes: () => getMemberFeatureModes,
  getOperationalStore: () => getOperationalStore,
  getPool: () => getPool,
  getSetting: () => getSetting,
  getSubscriptionPlanById: () => getSubscriptionPlanById,
  getSubscriptionStats: () => getSubscriptionStats,
  getUserByOpenId: () => getUserByOpenId,
  listAllPayments: () => listAllPayments,
  listAvailablePlansForCompanies: () => listAvailablePlansForCompanies,
  listCompanies: () => listCompanies,
  listCompanySubscriptions: () => listCompanySubscriptions,
  listInventoryProducts: () => listInventoryProducts,
  listOperationalRoutes: () => listOperationalRoutes,
  listOperationalStores: () => listOperationalStores,
  listOperationalVisits: () => listOperationalVisits,
  listPaymentsForCompany: () => listPaymentsForCompany,
  listStoresMissingCoordinates: () => listStoresMissingCoordinates,
  listSubscriptionPlans: () => listSubscriptionPlans,
  listTrash: () => listTrash,
  listWeeklyRouteSchedules: () => listWeeklyRouteSchedules,
  materializeWeeklyRoutes: () => materializeWeeklyRoutes,
  permanentlyDeleteTrashItem: () => permanentlyDeleteTrashItem,
  recordPaymentEvent: () => recordPaymentEvent,
  replaceCompanyFeatureOverrides: () => replaceCompanyFeatureOverrides,
  replaceMemberFeatureModes: () => replaceMemberFeatureModes,
  resolveCompanyPlan: () => resolveCompanyPlan,
  restoreTrashItem: () => restoreTrashItem,
  saveWeeklyRouteSchedule: () => saveWeeklyRouteSchedule,
  setSetting: () => setSetting,
  updateCompany: () => updateCompany,
  updateCompanySubscription: () => updateCompanySubscription,
  updateCompanySubscriptionFields: () => updateCompanySubscriptionFields,
  updateInventoryProduct: () => updateInventoryProduct,
  updateOperationalRoute: () => updateOperationalRoute,
  updateOperationalStore: () => updateOperationalStore,
  updateOperationalVisit: () => updateOperationalVisit,
  updatePromoterManagement: () => updatePromoterManagement,
  updateSubscriptionPlan: () => updateSubscriptionPlan,
  upsertUser: () => upsertUser
});
import { and as and2, desc, eq as eq2, inArray, isNull, like, or, sql as sql2 } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
function monitoredPool(pool) {
  const slowQueryMs = Number(process.env.DB_SLOW_QUERY_MS || 1e3);
  return new Proxy(pool, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== "query" && property !== "execute" || typeof value !== "function") return value;
      return (...args) => {
        const startedAt = Date.now();
        const result = value.apply(target, args);
        if (!result || typeof result.finally !== "function") return result;
        return result.finally(() => {
          const elapsed = Date.now() - startedAt;
          if (elapsed >= slowQueryMs) console.warn(`[Database] Slow query: ${elapsed}ms`);
        });
      };
    }
  });
}
async function getPool() {
  await getDb();
  return _pool;
}
async function ensureOwnerScopeColumns() {
  if (ownerScopeReady) return;
  if (ownerScopePromise) return ownerScopePromise;
  ownerScopePromise = (async () => {
    const pool = await getPool();
    if (!pool) return;
    try {
      await pool.query("ALTER TABLE `clients` ADD COLUMN `createdByUserId` int NULL").catch(() => void 0);
      await pool.query("ALTER TABLE `service_orders` ADD COLUMN `createdByUserId` int NULL").catch(() => void 0);
      await pool.query("ALTER TABLE `extinguishers` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => void 0);
      await pool.query("ALTER TABLE `clients` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => void 0);
    } catch (err) {
      console.warn("[db] ensureOwnerScopeColumns", err);
    } finally {
      ownerScopeReady = true;
      ownerScopePromise = null;
    }
  })();
  return ownerScopePromise;
}
async function getDb() {
  const databaseUrl = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.warn("[Database] EXTERNAL_DATABASE_URL is not set");
    return null;
  }
  if (_db && _dbUrl !== databaseUrl) {
    await _pool?.end().catch(() => void 0);
    _pool = null;
    _db = null;
    _dbUrl = null;
  }
  if (!_db) {
    try {
      _pool = monitoredPool(mysql.createPool({
        uri: databaseUrl,
        ssl: { rejectUnauthorized: true, minVersion: "TLSv1.2" },
        connectionLimit: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 10)),
        queueLimit: Math.max(0, Number(process.env.DB_QUEUE_LIMIT || 100)),
        connectTimeout: Math.max(1e3, Number(process.env.DB_CONNECT_TIMEOUT_MS || 15e3)),
        enableKeepAlive: true,
        keepAliveInitialDelay: Math.max(1e3, Number(process.env.DB_KEEP_ALIVE_MS || 1e4)),
        waitForConnections: true,
        idleTimeout: 6e4,
        // Requisições em lote rodam várias consultas em paralelo; manter as conexões
        // abertas evita refazer o handshake TLS a cada lote.
        maxIdle: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT || 10))
      }));
      const probe = await _pool.query("SELECT 1 AS ok");
      if (!probe) throw new Error("Database probe returned empty result");
      _db = drizzle(_pool);
      _dbUrl = databaseUrl;
      console.log("[Database] Connected successfully");
    } catch (error) {
      console.error("[Database] Failed to connect:", error instanceof Error ? error.message : error);
      await _pool?.end().catch(() => void 0);
      _pool = null;
      _db = null;
      _dbUrl = null;
    }
  }
  return _db;
}
function requireAccountId(accountId) {
  if (typeof accountId !== "number" || !Number.isInteger(accountId) || accountId <= 0) throw new Error("Tenant comercial obrigat\xF3rio");
  return accountId;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = values.role;
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq2(users.openId, openId)).limit(1);
  return result[0];
}
async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companies).orderBy(companies.name);
}
async function getCompanyById(id3) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(companies).where(eq2(companies.id, id3)).limit(1);
  return result[0];
}
async function createCompany(name) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(companies).values({ name: name.trim(), active: true });
  return Number(result[0].insertId);
}
async function updateCompany(id3, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set({ ...data, name: data.name?.trim() }).where(eq2(companies.id, id3));
}
async function ensureTrashTable() {
  if (_trashTableReady) return _trashTableReady;
  _trashTableReady = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(`CREATE TABLE IF NOT EXISTS trash_items (
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
    const [cols] = await database2.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'trash_items'`);
    const have = new Set(cols.map((c) => String(c.COLUMN_NAME ?? c.column_name).toLowerCase()));
    if (!have.has("deletedbymemberid")) await database2.execute(`ALTER TABLE trash_items ADD COLUMN deletedByMemberId int NULL`);
    if (!have.has("deletedbyname")) await database2.execute(`ALTER TABLE trash_items ADD COLUMN deletedByName varchar(255) NULL`);
    if (!have.has("ownermemberid")) await database2.execute(`ALTER TABLE trash_items ADD COLUMN ownerMemberId int NULL`);
  })().catch((error) => {
    _trashTableReady = null;
    throw error;
  });
  return _trashTableReady;
}
async function purgeExpiredTrash(database2, accountId) {
  const expiredWhere = accountId != null ? and2(eq2(trashItems.accountId, accountId), sql2`${trashItems.expiresAt} <= NOW()`) : sql2`${trashItems.expiresAt} <= NOW()`;
  const expiredPhotos = await database2.select().from(trashItems).where(and2(inArray(trashItems.itemType, ["store_photo", "product"]), expiredWhere));
  if (expiredPhotos.length) {
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const item of expiredPhotos) await deletePhotoFiles(item.snapshot, storageDelete2, item.accountId);
  }
  return database2.delete(trashItems).where(expiredWhere);
}
async function deletePhotoFiles(snapshot, storageDelete2, accountId) {
  try {
    const photo = JSON.parse(snapshot);
    if (photo?.fileKey) await guardedStorageDelete(storageDelete2, photo.fileKey, accountId);
    if (photo?.thumbnailKey) await guardedStorageDelete(storageDelete2, photo.thumbnailKey, accountId);
    if (photo?.photoKey) await guardedStorageDelete(storageDelete2, photo.photoKey, accountId);
  } catch (error) {
    console.warn("[trash] n\xE3o foi poss\xEDvel remover o arquivo da foto", error);
  }
}
function trashScope(accountId, scopeMemberId2) {
  const base = eq2(trashItems.accountId, accountId);
  if (scopeMemberId2 == null) return base;
  return and2(base, or(eq2(trashItems.deletedByMemberId, scopeMemberId2), eq2(trashItems.ownerMemberId, scopeMemberId2)));
}
async function listTrash(accountId, scopeMemberId2) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  await ensureTrashTable();
  await purgeExpiredTrash(db, tenant);
  return await db.select().from(trashItems).where(and2(trashScope(tenant, scopeMemberId2), sql2`${trashItems.expiresAt} > NOW()`)).orderBy(desc(trashItems.deletedAt));
}
async function cleanupExpiredData() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const [trashResult, memberResult, platformResult] = await Promise.all([
    purgeExpiredTrash(db),
    db.delete(memberSessions).where(sql2`${memberSessions.expiresAt} <= NOW()`),
    db.delete(platformSessions).where(sql2`${platformSessions.expiresAt} <= NOW()`)
  ]);
  return {
    trash: Number(trashResult[0]?.affectedRows || 0),
    memberSessions: Number(memberResult[0]?.affectedRows || 0),
    platformSessions: Number(platformResult[0]?.affectedRows || 0)
  };
}
function parseTrashSnapshot(snapshot) {
  try {
    return JSON.parse(snapshot);
  } catch {
    throw new Error("O item da lixeira est\xE1 corrompido e n\xE3o pode ser restaurado.");
  }
}
function restoreDateFields(value) {
  const restored = { ...value };
  for (const key of ["createdAt", "updatedAt", "capturedAt", "expiresAt"]) {
    if (restored[key] && !(restored[key] instanceof Date)) restored[key] = new Date(restored[key]);
  }
  return restored;
}
async function restoreTrashItem(id3, accountId, scopeMemberId2) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and2(eq2(trashItems.id, id3), trashScope(tenant, scopeMemberId2))).limit(1))[0];
  if (!item) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and2(eq2(trashItems.id, id3), eq2(trashItems.accountId, tenant)));
    throw new Error("O prazo de restaura\xE7\xE3o deste item expirou.");
  }
  const snapshot = parseTrashSnapshot(item.snapshot);
  await db.transaction(async (tx) => {
    if (item.itemType === "product") {
      const existing = await tx.select({ id: inventoryProducts.id }).from(inventoryProducts).where(and2(eq2(inventoryProducts.id, item.originalId), eq2(inventoryProducts.companyId, tenant))).limit(1);
      if (existing[0]) throw new Error("J\xE1 existe um produto com esse identificador. N\xE3o foi poss\xEDvel restaurar.");
      const expirationDate = String(snapshot.expirationDate ?? "").slice(0, 10);
      await tx.insert(inventoryProducts).values({ ...restoreDateFields(snapshot), expirationDate, id: item.originalId, companyId: tenant });
    } else if (item.itemType === "store_photo") {
      const existing = await tx.select({ id: storePhotos.id }).from(storePhotos).where(and2(eq2(storePhotos.id, item.originalId), eq2(storePhotos.companyId, tenant))).limit(1);
      if (existing[0]) throw new Error("Esta foto j\xE1 existe na galeria. N\xE3o foi poss\xEDvel restaurar.");
      const restored = restoreDateFields(snapshot);
      const minExpiry = Date.now() + 7 * 24 * 60 * 60 * 1e3;
      const expiresAt = new Date(Math.max(restored.expiresAt ? new Date(restored.expiresAt).getTime() : 0, minExpiry));
      await tx.insert(storePhotos).values({ ...restored, id: item.originalId, companyId: tenant, expiresAt });
      const restoredClientId = Number(restored.storeClientId);
      if (Number.isInteger(restoredClientId) && restoredClientId > 0) {
        try {
          await tx.execute(sql2`UPDATE store_photos SET storeClientId = ${restoredClientId} WHERE id = ${item.originalId} AND companyId = ${tenant} AND EXISTS (SELECT 1 FROM store_clients c WHERE c.id = ${restoredClientId} AND c.companyId = ${tenant} AND c.storeId = store_photos.storeId)`);
        } catch {
        }
      }
    } else {
      throw new Error("Tipo de item da lixeira n\xE3o reconhecido.");
    }
    await tx.delete(trashItems).where(and2(eq2(trashItems.id, id3), eq2(trashItems.accountId, tenant)));
  });
  return { itemType: item.itemType, label: item.label, originalId: item.originalId };
}
async function permanentlyDeleteTrashItem(id3, accountId, scopeMemberId2) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and2(eq2(trashItems.id, id3), trashScope(tenant, scopeMemberId2))).limit(1))[0];
  if (!item) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  const result = await db.delete(trashItems).where(and2(eq2(trashItems.id, id3), eq2(trashItems.accountId, tenant)));
  if (!result[0]?.affectedRows) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  if (item?.itemType === "store_photo" || item?.itemType === "product") {
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    await deletePhotoFiles(item.snapshot, storageDelete2, tenant);
  }
  return { itemType: item.itemType, label: item.label, originalId: item.originalId };
}
async function getSetting(key, accountId, defaultValue = "30") {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(systemSettings).where(and2(eq2(systemSettings.settingKey, key), eq2(systemSettings.accountId, tenant))).limit(1);
  return result[0]?.settingValue ?? defaultValue;
}
async function setSetting(key, value, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({ accountId: tenant, settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}
function isMissingEntitlementsTable(error) {
  const code = error?.code ?? error?.cause?.code;
  const message = String(error?.sqlMessage ?? error?.message ?? "");
  return code === "ER_NO_SUCH_TABLE" || code === "ER_BAD_TABLE_ERROR" || /unknown table|does not exist|doesn't exist/i.test(message);
}
async function replaceSubscriptionPlanFeatures(database2, planId, featureKeys) {
  const enabled = new Set(featureKeys);
  const rows4 = ENTITLEMENT_KEYS.map((featureKey) => ({ planId, featureKey, enabled: enabled.has(featureKey) }));
  await database2.transaction(async (tx) => {
    await tx.delete(subscriptionPlanFeatures).where(eq2(subscriptionPlanFeatures.planId, planId));
    await tx.insert(subscriptionPlanFeatures).values(rows4);
  });
}
async function attachPlanFeatureKeys(database2, plans) {
  if (!plans.length) return plans;
  let featureRows = [];
  try {
    featureRows = await database2.select({ planId: subscriptionPlanFeatures.planId, featureKey: subscriptionPlanFeatures.featureKey, enabled: subscriptionPlanFeatures.enabled }).from(subscriptionPlanFeatures).where(inArray(subscriptionPlanFeatures.planId, plans.map((plan) => Number(plan.id))));
  } catch (error) {
    if (!isMissingEntitlementsTable(error)) throw error;
  }
  const byPlan = /* @__PURE__ */ new Map();
  for (const row2 of featureRows ?? []) {
    const values = byPlan.get(Number(row2.planId)) ?? [];
    values.push(row2);
    byPlan.set(Number(row2.planId), values);
  }
  return plans.map((plan) => {
    const stored = byPlan.get(Number(plan.id));
    const featureKeys = (stored ?? []).filter((row2) => Boolean(row2.enabled)).map((row2) => row2.featureKey);
    return { ...plan, featureKeys };
  });
}
async function getCompanyFeatureOverrides(companyId) {
  const database2 = await getDb();
  if (!database2) return {};
  try {
    const rows4 = await database2.select({ featureKey: companyFeatureOverrides.featureKey, enabled: companyFeatureOverrides.enabled }).from(companyFeatureOverrides).where(eq2(companyFeatureOverrides.companyId, companyId));
    return Object.fromEntries(rows4.filter((row2) => ENTITLEMENT_KEYS.includes(row2.featureKey)).map((row2) => [row2.featureKey, Boolean(row2.enabled)]));
  } catch (error) {
    if (isMissingEntitlementsTable(error)) return {};
    throw error;
  }
}
async function getMemberFeatureModes(memberAccountId, companyId) {
  const database2 = await getDb();
  if (!database2) return {};
  const account = await database2.select({ id: memberAccounts2.id }).from(memberAccounts2).where(and2(eq2(memberAccounts2.id, memberAccountId), eq2(memberAccounts2.companyId, companyId))).limit(1);
  if (!account[0]) return {};
  try {
    const rows4 = await database2.select({ featureKey: memberFeaturePermissions.featureKey, mode: memberFeaturePermissions.mode }).from(memberFeaturePermissions).where(eq2(memberFeaturePermissions.memberAccountId, memberAccountId));
    return Object.fromEntries(rows4.filter((row2) => ENTITLEMENT_KEYS.includes(row2.featureKey)).map((row2) => [row2.featureKey, row2.mode]));
  } catch (error) {
    if (isMissingEntitlementsTable(error)) return {};
    throw error;
  }
}
async function replaceCompanyFeatureOverrides(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const rows4 = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const enabled = input.overrides[featureKey];
    return enabled == null ? [] : [{ companyId: input.companyId, featureKey, enabled, reason: input.reason ?? null, updatedByPlatformAdminId: input.updatedByPlatformAdminId }];
  });
  await database2.transaction(async (tx) => {
    await tx.delete(companyFeatureOverrides).where(eq2(companyFeatureOverrides.companyId, input.companyId));
    if (rows4.length) await tx.insert(companyFeatureOverrides).values(rows4);
  });
  return { success: true };
}
async function replaceMemberFeatureModes(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const rows4 = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const mode = input.modes[featureKey];
    return !mode || mode === "inherit" ? [] : [{ memberAccountId: input.memberAccountId, featureKey, mode, updatedByMemberAccountId: input.updatedByMemberAccountId }];
  });
  await database2.transaction(async (tx) => {
    await tx.delete(memberFeaturePermissions).where(eq2(memberFeaturePermissions.memberAccountId, input.memberAccountId));
    if (rows4.length) await tx.insert(memberFeaturePermissions).values(rows4);
  });
  return { success: true };
}
async function listSubscriptionPlans() {
  const database2 = await getDb();
  if (!database2) return [];
  await ensureAdditionalUserPriceColumn();
  const plans = await database2.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
  return attachPlanFeatureKeys(database2, plans);
}
async function createSubscriptionPlan(data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const { featureKeys, ...planFields } = data;
  const [result] = await database2.insert(subscriptionPlans).values({
    ...planFields,
    description: data.description ?? null,
    maxUsers: data.maxUsers ?? null,
    maxClients: data.maxClients ?? null,
    maxExtinguishers: data.maxExtinguishers ?? null,
    availableForNew: data.availableForNew ?? true,
    active: true
  });
  const id3 = Number(result.insertId);
  await replaceSubscriptionPlanFeatures(database2, id3, featureKeys);
  return { id: id3 };
}
async function updateSubscriptionPlan(id3, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const { featureKeys, ...planFields } = data;
  if (Object.keys(planFields).length) {
    await database2.update(subscriptionPlans).set(planFields).where(eq2(subscriptionPlans.id, id3));
  }
  if (featureKeys !== void 0) await replaceSubscriptionPlanFeatures(database2, id3, featureKeys);
  return { success: true };
}
async function listCompanySubscriptions() {
  const db = await getDb();
  if (!db) return [];
  const rows4 = await db.select({
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
    maxExtinguishers: subscriptionPlans.maxExtinguishers
  }).from(companySubscriptions).innerJoin(companies, eq2(companySubscriptions.companyId, companies.id)).innerJoin(subscriptionPlans, eq2(companySubscriptions.planId, subscriptionPlans.id)).orderBy(desc(companySubscriptions.createdAt));
  return rows4;
}
async function getSubscriptionStats() {
  const db = await getDb();
  if (!db) return { registered: 0, activeOrTest: 0, suspended: 0, nearExpiry: 0 };
  const all = await db.select().from(companySubscriptions);
  const now = /* @__PURE__ */ new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1e3);
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
async function createCompanySubscription(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [result] = await db.insert(companySubscriptions).values({
    companyId: data.companyId,
    planId: data.planId,
    status: data.status,
    startsAt: data.startsAt,
    endsAt: data.endsAt ?? null,
    notes: data.notes ?? null
  });
  await db.update(companies).set({
    planId: data.planId,
    subscriptionStatus: data.status,
    subscriptionStartedAt: new Date(data.startsAt),
    subscriptionExpiresAt: data.endsAt ? new Date(data.endsAt) : null
  }).where(eq2(companies.id, data.companyId));
  return { id: Number(result.insertId) };
}
async function updateCompanySubscription(id3, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companySubscriptions).set(data).where(eq2(companySubscriptions.id, id3));
  const rows4 = await db.select().from(companySubscriptions).where(eq2(companySubscriptions.id, id3)).limit(1);
  const sub = rows4[0];
  if (sub) {
    const patch = {};
    if (data.planId !== void 0) patch.planId = data.planId;
    if (data.status !== void 0) patch.subscriptionStatus = data.status;
    if (data.endsAt !== void 0) patch.subscriptionExpiresAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.startsAt !== void 0) patch.subscriptionStartedAt = new Date(data.startsAt);
    if (Object.keys(patch).length) {
      await db.update(companies).set(patch).where(eq2(companies.id, sub.companyId));
    }
  }
  return { success: true };
}
async function getSubscriptionPlanById(planId) {
  const database2 = await getDb();
  if (!database2) return null;
  const rows4 = await database2.select().from(subscriptionPlans).where(eq2(subscriptionPlans.id, planId)).limit(1);
  return (await attachPlanFeatureKeys(database2, rows4))[0] ?? null;
}
async function resolveCompanyPlan(companyId) {
  const db = await getDb();
  if (!db) return { company: null, subscription: null, plan: null };
  const companyRows = await db.select().from(companies).where(eq2(companies.id, companyId)).limit(1);
  const company = companyRows[0] ?? null;
  const sub = await getLatestCompanySubscription(companyId);
  let planId = sub?.planId ?? company?.planId ?? null;
  let plan = planId ? await getSubscriptionPlanById(Number(planId)) : null;
  if (company && sub?.planId && !company.planId) {
    try {
      await db.update(companies).set({
        planId: sub.planId,
        subscriptionStatus: sub.status || company.subscriptionStatus
      }).where(eq2(companies.id, companyId));
      company.planId = sub.planId;
    } catch {
    }
  }
  if (!plan && company?.planId) {
    plan = await getSubscriptionPlanById(Number(company.planId));
  }
  return { company, subscription: sub, plan };
}
async function getLatestCompanySubscription(companyId) {
  const db = await getDb();
  if (!db) return null;
  const rows4 = await db.select().from(companySubscriptions).where(eq2(companySubscriptions.companyId, companyId)).orderBy(desc(companySubscriptions.createdAt));
  if (!rows4.length) return null;
  const preferred = rows4.find(
    (r) => ["active", "trial", "test", "pending", "overdue"].includes(String(r.status))
  );
  return preferred ?? rows4[0];
}
async function updateCompanySubscriptionFields(companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set(data).where(eq2(companies.id, companyId));
  return { success: true };
}
async function listPaymentsForCompany(companyId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq2(payments.companyId, companyId)).orderBy(desc(payments.createdAt));
}
async function listAllPayments(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
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
    companyName: companies.name
  }).from(payments).innerJoin(companies, eq2(payments.companyId, companies.id)).orderBy(desc(payments.createdAt)).limit(limit);
}
async function createPaymentRecord(data) {
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
    bankSlipUrl: data.bankSlipUrl ?? null
  });
  return { id: Number(result.insertId) };
}
async function findPaymentEventByEventId(eventId) {
  const db = await getDb();
  if (!db) return null;
  const rows4 = await db.select().from(paymentEvents).where(eq2(paymentEvents.eventId, eventId)).limit(1);
  return rows4[0] ?? null;
}
async function recordPaymentEvent(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await findPaymentEventByEventId(data.eventId);
  if (existing) return { id: existing.id, duplicate: true };
  const [result] = await db.insert(paymentEvents).values({
    eventId: data.eventId,
    event: data.event,
    paymentId: data.paymentId ?? null,
    subscriptionId: data.subscriptionId ?? null,
    payload: data.payload,
    processed: data.processed ?? true
  });
  return { id: Number(result.insertId), duplicate: false };
}
async function ensureAdditionalUserPriceColumn() {
  const database2 = await getDb();
  if (!database2) return;
  try {
    const [cols] = await database2.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans'`);
    const names = new Set(cols.map((c) => String(c.COLUMN_NAME ?? c.column_name).toLowerCase()));
    if (!names.has("additionaluserprice")) {
      await database2.execute(`ALTER TABLE subscription_plans ADD COLUMN additionalUserPrice decimal(12,2) NULL`);
    }
  } catch (error) {
    console.warn("[db] ensureAdditionalUserPriceColumn", error instanceof Error ? error.message : error);
  }
}
async function listAvailablePlansForCompanies() {
  const plans = await listSubscriptionPlans();
  return plans.filter((plan) => plan.active && plan.availableForNew).sort((a, b) => Number(a.price) - Number(b.price));
}
async function ensureSeedPlans() {
  const database2 = await getDb();
  if (!database2) return;
  await ensureAdditionalUserPriceColumn();
  const existing = await database2.select().from(subscriptionPlans);
  const byName = new Map(existing.map((p) => [planNameKey(String(p.name)), p]));
  for (const plan of COMMERCIAL_PLANS) {
    const row2 = byName.get(planNameKey(plan.name));
    if (row2) {
      await database2.update(subscriptionPlans).set({
        maxUsers: plan.includedUsers,
        additionalUserPrice: plan.additionalUserPrice
      }).where(eq2(subscriptionPlans.id, row2.id));
      continue;
    }
    const [result] = await database2.insert(subscriptionPlans).values({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      billingCycle: plan.billingCycle,
      maxUsers: plan.includedUsers,
      maxClients: null,
      maxExtinguishers: null,
      additionalUserPrice: plan.additionalUserPrice,
      availableForNew: true,
      active: true
    });
    const id3 = Number(result.insertId);
    if (id3) {
      try {
        await replaceSubscriptionPlanFeatures(database2, id3, [...plan.featureKeys]);
      } catch (error) {
        if (!isMissingEntitlementsTable(error)) throw error;
      }
    }
  }
  const legacyIds = existing.filter((p) => isLegacyPlanName(String(p.name)) && (p.active || p.availableForNew)).map((p) => p.id);
  if (legacyIds.length) {
    await database2.update(subscriptionPlans).set({
      active: false,
      availableForNew: false
    }).where(inArray(subscriptionPlans.id, legacyIds));
  }
  await ensureVisitCheckInFeature();
  await ensureProductsFeature();
}
async function ensureProductsFeature() {
  const database2 = await getDb();
  if (!database2) return;
  try {
    await database2.execute(sql2`
      INSERT INTO subscription_plan_features (planId, featureKey, enabled)
      SELECT p.id, 'products', 1 FROM subscription_plans p
      WHERE NOT EXISTS (SELECT 1 FROM subscription_plan_features x WHERE x.planId = p.id AND x.featureKey = 'products')
    `);
  } catch (error) {
    if (!isMissingEntitlementsTable(error)) throw error;
  }
}
async function ensureVisitCheckInFeature() {
  const database2 = await getDb();
  if (!database2) return;
  try {
    await database2.execute(sql2`
      INSERT INTO subscription_plan_features (planId, featureKey, enabled)
      SELECT planId, 'visitCheckIn', enabled FROM subscription_plan_features spf
      WHERE featureKey = 'fieldOperations'
        AND NOT EXISTS (
          SELECT 1 FROM subscription_plan_features x
          WHERE x.planId = spf.planId AND x.featureKey = 'visitCheckIn'
        )
    `);
    await database2.execute(sql2`
      UPDATE subscription_plan_features v
      INNER JOIN subscription_plan_features f
        ON f.planId = v.planId AND f.featureKey = 'fieldOperations'
      SET v.enabled = 1
      WHERE v.featureKey = 'visitCheckIn'
        AND f.enabled = 1
        AND v.enabled = 0
    `);
    await database2.execute(sql2`
      INSERT INTO subscription_plan_features (planId, featureKey, enabled)
      SELECT p.id, 'visitCheckIn', 0 FROM subscription_plans p
      WHERE NOT EXISTS (
        SELECT 1 FROM subscription_plan_features x
        WHERE x.planId = p.id AND x.featureKey = 'visitCheckIn'
      )
    `);
    await database2.execute(sql2`
      INSERT INTO company_feature_overrides (companyId, featureKey, enabled, reason)
      SELECT o.companyId, 'visitCheckIn', o.enabled, 'Backfill: check-in/out alinhado a lojas e roteiros'
      FROM company_feature_overrides o
      WHERE o.featureKey = 'fieldOperations'
        AND NOT EXISTS (
          SELECT 1 FROM company_feature_overrides x
          WHERE x.companyId = o.companyId AND x.featureKey = 'visitCheckIn'
        )
    `);
  } catch (error) {
    if (!isMissingEntitlementsTable(error)) throw error;
  }
}
async function listOperationalStores(companyId, search, memberAccountId) {
  const database2 = await getDb();
  if (!database2) return [];
  const conditions = [eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true)];
  if (search?.trim()) conditions.push(like(stores.name, `%${search.trim()}%`));
  if (memberAccountId != null) {
    await ensureStoreOwnersTable(database2);
    conditions.push(storeVisibleToMember(stores.id, memberAccountId));
  }
  return database2.select().from(stores).where(and2(...conditions)).orderBy(stores.name);
}
async function createOperationalStore(input, ownerMemberAccountId) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.insert(stores).values(input);
  const storeId = Number(result[0]?.insertId);
  if (ownerMemberAccountId) await recordStoreOwner(database2, { storeId, companyId: input.companyId, memberAccountId: ownerMemberAccountId });
  const rows4 = await database2.select().from(stores).where(eq2(stores.id, storeId)).limit(1);
  return rows4[0];
}
async function updateOperationalStore(companyId, id3, patch) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const where = and2(eq2(stores.id, id3), eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true));
  const found = await database2.select({ id: stores.id }).from(stores).where(where).limit(1);
  if (!found[0]) return false;
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== void 0));
  if (Object.keys(clean).length) await database2.update(stores).set(clean).where(where);
  return true;
}
async function getOperationalStore(companyId, id3) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const rows4 = await database2.select().from(stores).where(and2(eq2(stores.id, id3), eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true))).limit(1);
  return rows4[0];
}
async function listStoresMissingCoordinates(companyId, limit = 10) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  return database2.select({ id: stores.id, name: stores.name, address: stores.address, city: stores.city, state: stores.state }).from(stores).where(and2(eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true), isNull(stores.latitude), sql2`${stores.address} IS NOT NULL AND TRIM(${stores.address}) <> ''`)).orderBy(stores.id).limit(limit);
}
async function archiveOperationalStore(companyId, id3) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const where = and2(eq2(stores.id, id3), eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true));
  const found = await database2.select({ id: stores.id, name: stores.name }).from(stores).where(where).limit(1);
  if (!found[0]) return null;
  await database2.update(stores).set({ active: false }).where(where);
  return found[0];
}
async function listOperationalRoutes(companyId, options = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  const conditions = [eq2(routes.companyId, requireAccountId(companyId))];
  if (options.date) conditions.push(eq2(routes.date, options.date));
  if (options.promoterId) conditions.push(eq2(routes.promoterId, options.promoterId));
  const rows4 = await database2.select().from(routes).where(and2(...conditions)).orderBy(desc(routes.date), desc(routes.id));
  const candidates = duplicateOccurrenceIds(rows4);
  if (!candidates.size) return rows4;
  const started = await startedRouteIds(database2, requireAccountId(companyId), rows4.map((r) => r.id));
  const hidden = duplicateOccurrenceIds(rows4, started);
  return rows4.filter((r) => !hidden.has(r.id));
}
async function startedRouteIds(database2, companyId, routeIds) {
  if (!routeIds.length) return [];
  const rows4 = await database2.select({ routeId: visits.routeId }).from(visits).where(and2(
    eq2(visits.companyId, companyId),
    inArray(visits.routeId, routeIds),
    sql2`${visits.status} NOT IN ('pending', 'cancelled')`
  ));
  return rows4.map((r) => Number(r.routeId));
}
async function ensureWeeklyOccurrenceUniqueIndex(database2) {
  if (weeklyOccurrenceIndexChecked) return;
  weeklyOccurrenceIndexChecked = true;
  try {
    const found = await database2.execute(sql2`SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'routes' AND index_name = 'routes_weekly_occurrence_unique'`);
    const rows4 = Array.isArray(found?.[0]) ? found[0] : found?.rows ?? [];
    if (Number(rows4?.[0]?.n ?? 0) > 0) return;
    await database2.execute(sql2`CREATE UNIQUE INDEX routes_weekly_occurrence_unique ON routes (weeklyScheduleId, date)`);
  } catch (e) {
    console.warn("[routes] unique index weekly occurrence", e?.code || e?.message);
  }
}
async function listWeeklyRouteSchedules(companyId) {
  const database2 = await getDb();
  if (!database2) return [];
  return database2.select().from(weeklyRouteSchedules).where(eq2(weeklyRouteSchedules.companyId, requireAccountId(companyId))).orderBy(weeklyRouteSchedules.weekday, weeklyRouteSchedules.promoterId);
}
async function ensureWeeklyRouteSchedulesTable(database2) {
  try {
    await database2.execute(`CREATE TABLE IF NOT EXISTS weekly_route_schedules (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      promoterId int NOT NULL,
      weekday int NOT NULL,
      name varchar(255) NOT NULL,
      storeIds json NOT NULL,
      active boolean NOT NULL DEFAULT true,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY weekly_route_schedules_company_idx (companyId),
      UNIQUE KEY weekly_route_schedules_promoter_day_unique (companyId, promoterId, weekday)
    )`);
  } catch (e) {
    console.warn("[routes] ensure weekly table", e);
  }
}
async function dropPendingOccurrences(tx, companyId, scheduleId, fromDate, onlyDate = true) {
  const rows4 = await tx.select({ id: routes.id }).from(routes).where(and2(
    eq2(routes.companyId, companyId),
    eq2(routes.weeklyScheduleId, scheduleId),
    onlyDate ? eq2(routes.date, fromDate) : sql2`${routes.date} >= ${fromDate}`
  ));
  for (const route of rows4) {
    const started = await tx.select({ id: visits.id }).from(visits).where(and2(
      eq2(visits.routeId, route.id),
      eq2(visits.companyId, companyId),
      sql2`${visits.status} NOT IN ('pending', 'cancelled')`
    )).limit(1);
    if (started[0]) continue;
    await tx.delete(visits).where(and2(eq2(visits.routeId, route.id), eq2(visits.companyId, companyId)));
    await tx.delete(routes).where(and2(eq2(routes.id, route.id), eq2(routes.companyId, companyId)));
  }
}
async function saveWeeklyRouteSchedule(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await ensureWeeklyRouteSchedulesTable(database2);
  const companyId = requireAccountId(input.companyId);
  const storeIds = [...new Set(input.storeIds)].filter((id3) => Number.isInteger(id3) && id3 > 0);
  if (!storeIds.length) throw new Error("Selecione ao menos uma loja.");
  const today = todayInZone();
  const values = { promoterId: input.promoterId, weekday: input.weekday, name: input.name.trim(), storeIds };
  return database2.transaction(async (tx) => {
    const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(inArray(stores.id, storeIds), eq2(stores.companyId, companyId), eq2(stores.active, true)));
    if (stores2.length !== storeIds.length) throw new Error("Uma ou mais lojas n\xE3o pertencem a esta empresa.");
    let scheduleId;
    if (input.id) {
      const [current] = await tx.select().from(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, input.id), eq2(weeklyRouteSchedules.companyId, companyId))).limit(1);
      if (!current) throw new WeeklyRouteConflictError("Roteiro n\xE3o encontrado nesta empresa.");
      const [taken] = await tx.select({ id: weeklyRouteSchedules.id }).from(weeklyRouteSchedules).where(and2(
        eq2(weeklyRouteSchedules.companyId, companyId),
        eq2(weeklyRouteSchedules.promoterId, input.promoterId),
        eq2(weeklyRouteSchedules.weekday, input.weekday)
      )).limit(1);
      if (taken && taken.id !== input.id) throw new WeeklyRouteConflictError("Esse promotor j\xE1 tem um roteiro nesse dia. Edite o roteiro que j\xE1 existe.");
      await tx.update(weeklyRouteSchedules).set({ ...values, active: true }).where(and2(eq2(weeklyRouteSchedules.id, input.id), eq2(weeklyRouteSchedules.companyId, companyId)));
      scheduleId = input.id;
    } else {
      await tx.insert(weeklyRouteSchedules).values({ ...values, companyId, active: true }).onDuplicateKeyUpdate({ set: { name: values.name, storeIds, active: true } });
      const [row2] = await tx.select({ id: weeklyRouteSchedules.id }).from(weeklyRouteSchedules).where(and2(
        eq2(weeklyRouteSchedules.companyId, companyId),
        eq2(weeklyRouteSchedules.promoterId, input.promoterId),
        eq2(weeklyRouteSchedules.weekday, input.weekday)
      )).limit(1);
      scheduleId = row2.id;
    }
    await dropPendingOccurrences(tx, companyId, scheduleId, today);
    return (await tx.select().from(weeklyRouteSchedules).where(eq2(weeklyRouteSchedules.id, scheduleId)).limit(1))[0];
  });
}
async function deleteWeeklyRouteSchedule(companyId, id3) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const cid = requireAccountId(companyId);
  return database2.transaction(async (tx) => {
    const [current] = await tx.select({ id: weeklyRouteSchedules.id }).from(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, id3), eq2(weeklyRouteSchedules.companyId, cid))).limit(1);
    if (!current) return { success: false };
    await dropPendingOccurrences(tx, cid, id3, todayInZone(), false);
    await tx.delete(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, id3), eq2(weeklyRouteSchedules.companyId, cid)));
    return { success: true };
  });
}
async function updatePromoterManagement(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const companyId = requireAccountId(input.companyId);
  const promoter = await database2.select({ id: memberAccounts2.id }).from(memberAccounts2).where(and2(
    eq2(memberAccounts2.id, input.promoterId),
    eq2(memberAccounts2.companyId, companyId),
    eq2(memberAccounts2.role, "promoter")
  )).limit(1);
  if (!promoter.length) throw new Error("Promotor n\xE3o pertence a esta empresa.");
  const employeeCode = input.employeeCode?.trim() || null;
  const weeklyRoutes = input.weeklyRoutes;
  if (weeklyRoutes !== void 0) {
    const days = weeklyRoutes.map((route) => route.weekday);
    if (new Set(days).size !== days.length || days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
      throw new Error("A programa\xE7\xE3o semanal cont\xE9m dias inv\xE1lidos ou repetidos.");
    }
    const storeIds = [...new Set(weeklyRoutes.flatMap((route) => route.storeIds))];
    if (storeIds.length) {
      const stores2 = await database2.select({ id: stores.id }).from(stores).where(and2(
        inArray(stores.id, storeIds),
        eq2(stores.companyId, companyId),
        eq2(stores.active, true)
      ));
      if (stores2.length !== storeIds.length) throw new Error("Uma ou mais lojas n\xE3o pertencem a esta empresa ou est\xE3o inativas.");
    }
    if (weeklyRoutes.some((route) => !route.storeIds.length)) throw new Error("Cada dia programado precisa ter ao menos uma loja.");
  }
  await database2.transaction(async (tx) => {
    await tx.update(memberAccounts).set({ userName: input.userName.trim(), email: input.email.trim().toLowerCase() }).where(and2(
      eq2(memberAccounts.id, input.promoterId),
      eq2(memberAccounts.companyId, companyId),
      eq2(memberAccounts.role, "promoter")
    ));
    await tx.insert(promoterProfiles).values({
      memberAccountId: input.promoterId,
      companyId,
      employeeCode,
      workStartTime: input.workStartTime,
      workEndTime: input.workEndTime
    }).onDuplicateKeyUpdate({ set: { companyId, employeeCode, workStartTime: input.workStartTime, workEndTime: input.workEndTime } });
    if (weeklyRoutes === void 0) return;
    const weekdayLabels = ["domingo", "segunda-feira", "ter\xE7a-feira", "quarta-feira", "quinta-feira", "sexta-feira", "s\xE1bado"];
    for (let weekday = 0; weekday <= 6; weekday++) {
      const schedule = weeklyRoutes.find((route) => route.weekday === weekday);
      const conditions = and2(
        eq2(weeklyRouteSchedules.companyId, companyId),
        eq2(weeklyRouteSchedules.promoterId, input.promoterId),
        eq2(weeklyRouteSchedules.weekday, weekday)
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
        active: true
      }).onDuplicateKeyUpdate({ set: { name: `Roteiro de ${weekdayLabels[weekday]}`, storeIds, active: true } });
    }
  });
  return { success: true };
}
async function materializeWeeklyRoutes(companyId, promoterId, dateString) {
  const database2 = await getDb();
  if (!database2) return [];
  const company = requireAccountId(companyId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || Number.isNaN(Date.parse(`${dateString}T00:00:00Z`))) return [];
  const weekday = (/* @__PURE__ */ new Date(`${dateString}T00:00:00Z`)).getUTCDay();
  const schedules = await database2.select().from(weeklyRouteSchedules).where(and2(
    eq2(weeklyRouteSchedules.companyId, company),
    eq2(weeklyRouteSchedules.promoterId, promoterId),
    eq2(weeklyRouteSchedules.weekday, weekday),
    eq2(weeklyRouteSchedules.active, true)
  ));
  if (schedules.length) await ensureWeeklyOccurrenceUniqueIndex(database2);
  for (const schedule of schedules) {
    try {
      await database2.transaction(async (tx) => {
        const [locked] = await tx.select({ id: weeklyRouteSchedules.id }).from(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, schedule.id), eq2(weeklyRouteSchedules.companyId, company))).for("update");
        if (!locked) return;
        const existing = await tx.select({ id: routes.id }).from(routes).where(and2(
          eq2(routes.companyId, company),
          eq2(routes.promoterId, promoterId),
          eq2(routes.date, dateString)
        )).limit(1).for("update");
        if (existing.length) return;
        const storeIds = Array.isArray(schedule.storeIds) ? schedule.storeIds : [];
        if (!storeIds.length) return;
        const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(
          inArray(stores.id, storeIds),
          eq2(stores.companyId, company),
          eq2(stores.active, true)
        ));
        if (!stores2.length) return;
        stores2.sort((a, b) => storeIds.indexOf(a.id) - storeIds.indexOf(b.id));
        const inserted = await tx.insert(routes).values({
          companyId: company,
          name: schedule.name,
          date: dateString,
          promoterId,
          weeklyScheduleId: schedule.id,
          status: "assigned"
        });
        const routeId = Number(inserted[0]?.insertId);
        await tx.insert(visits).values(stores2.map((store) => ({ companyId: company, routeId, storeId: store.id, promoterId, status: "pending" })));
      });
    } catch (error) {
      const raced = error?.code === "ER_DUP_ENTRY" || error?.code === "ER_LOCK_DEADLOCK" || error?.errno === 9007 || /write conflict/i.test(String(error?.message || ""));
      if (!raced) throw error;
    }
  }
  return listOperationalRoutes(company, { date: dateString, promoterId });
}
async function createOperationalRoute(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.insert(routes).values(input);
  const rows4 = await database2.select().from(routes).where(eq2(routes.id, Number(result[0]?.insertId))).limit(1);
  return rows4[0];
}
async function updateOperationalRoute(companyId, routeId, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not available");
  const cid = requireAccountId(companyId);
  return database2.transaction(async (tx) => {
    const [route] = await tx.select().from(routes).where(and2(eq2(routes.id, routeId), eq2(routes.companyId, cid))).limit(1);
    if (!route) throw new RouteValidationError("Roteiro n\xE3o encontrado para esta empresa.");
    if (data.promoterId) {
      const [promoter] = await tx.select({ id: memberAccounts.id }).from(memberAccounts).where(and2(eq2(memberAccounts.id, data.promoterId), eq2(memberAccounts.companyId, cid), eq2(memberAccounts.active, true))).limit(1);
      if (!promoter) throw new RouteValidationError("O promotor selecionado n\xE3o pertence a esta empresa ou est\xE1 inativo.");
    }
    const uniqueStoreIds = data.storeIds ? [...new Set(data.storeIds)].filter((id3) => Number.isInteger(id3) && id3 > 0) : [];
    if (uniqueStoreIds.length) {
      const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(inArray(stores.id, uniqueStoreIds), eq2(stores.companyId, cid), eq2(stores.active, true)));
      if (stores2.length !== uniqueStoreIds.length) throw new RouteValidationError("Uma ou mais lojas n\xE3o pertencem a esta empresa.");
    }
    const updates = {};
    if (data.name) updates.name = data.name;
    if (data.promoterId) updates.promoterId = data.promoterId;
    if (data.date) updates.date = data.date.slice(0, 10);
    if (Object.keys(updates).length) {
      await tx.update(routes).set(updates).where(and2(eq2(routes.id, routeId), eq2(routes.companyId, cid)));
    }
    if (data.promoterId) {
      await tx.update(visits).set({ promoterId: data.promoterId }).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, cid), eq2(visits.status, "pending")));
    }
    if (uniqueStoreIds.length) {
      const current = await tx.select({ id: visits.id, storeId: visits.storeId, status: visits.status }).from(visits).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, cid)));
      const wanted = new Set(uniqueStoreIds);
      const removable = current.filter((v) => !(v.storeId != null && wanted.has(v.storeId)) && v.status === "pending").map((v) => v.id);
      if (removable.length) await tx.delete(visits).where(and2(inArray(visits.id, removable), eq2(visits.companyId, cid)));
      const existingStores = new Set(current.map((v) => v.storeId));
      const promoterId = data.promoterId ?? route.promoterId ?? 0;
      const toCreate = uniqueStoreIds.filter((storeId) => !existingStores.has(storeId));
      if (toCreate.length) await tx.insert(visits).values(toCreate.map((storeId) => ({ companyId: cid, routeId, storeId, promoterId, status: "pending" })));
    }
    return { success: true };
  });
}
async function deleteOperationalRoute(companyId, routeId) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not available");
  const cid = requireAccountId(companyId);
  const done = await database2.select({ id: visits.id }).from(visits).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, cid), sql2`${visits.status} NOT IN ('pending', 'cancelled')`)).limit(1);
  if (done[0]) throw new RouteValidationError("Este roteiro j\xE1 tem visitas realizadas e n\xE3o pode ser exclu\xEDdo, para n\xE3o perder o hist\xF3rico. Remova apenas as lojas pendentes.");
  await database2.delete(visits).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, cid)));
  await database2.delete(routes).where(and2(eq2(routes.id, routeId), eq2(routes.companyId, cid)));
  return { success: true };
}
async function createOperationalRouteWithVisits(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const companyId = requireAccountId(input.route.companyId);
  const uniqueStoreIds = [...new Set(input.storeIds)].filter((id3) => Number.isInteger(id3) && id3 > 0);
  if (!uniqueStoreIds.length) throw new Error("Selecione ao menos uma loja para o roteiro.");
  return database2.transaction(async (tx) => {
    const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(inArray(stores.id, uniqueStoreIds), eq2(stores.companyId, companyId), eq2(stores.active, true)));
    if (stores2.length !== uniqueStoreIds.length) throw new Error("Uma ou mais lojas n\xE3o pertencem a esta empresa.");
    const result = await tx.insert(routes).values(input.route);
    const routeId = Number(result[0]?.insertId);
    await tx.insert(visits).values(uniqueStoreIds.map((storeId) => ({ companyId, routeId, storeId, promoterId: input.route.promoterId, status: "pending" })));
    const rows4 = await tx.select().from(routes).where(eq2(routes.id, routeId)).limit(1);
    return rows4[0];
  });
}
async function listOperationalVisits(companyId, options = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  const conditions = [eq2(visits.companyId, requireAccountId(companyId))];
  if (options.id) conditions.push(eq2(visits.id, options.id));
  if (options.promoterId) conditions.push(eq2(visits.promoterId, options.promoterId));
  if (options.routeId) conditions.push(eq2(visits.routeId, options.routeId));
  if (options.date) conditions.push(eq2(routes.date, options.date));
  const rows4 = await database2.select({ visit: visits, store: stores, occurrence: { id: routes.id, weeklyScheduleId: routes.weeklyScheduleId, date: routes.date } }).from(visits).innerJoin(stores, and2(eq2(visits.storeId, stores.id), eq2(stores.companyId, visits.companyId))).innerJoin(routes, and2(eq2(visits.routeId, routes.id), eq2(routes.companyId, visits.companyId))).where(and2(...conditions)).orderBy(visits.plannedStart, visits.id);
  const occurrences = [...new Map(rows4.map((r) => [r.occurrence.id, r.occurrence])).values()];
  const started = rows4.filter((r) => r.visit.status !== "pending" && r.visit.status !== "cancelled").map((r) => r.occurrence.id);
  const hidden = options.id ? /* @__PURE__ */ new Set() : duplicateOccurrenceIds(occurrences, started);
  return rows4.filter((r) => !hidden.has(r.occurrence.id)).map(({ visit, store }) => ({ visit, store }));
}
async function updateOperationalVisit(companyId, id3, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await database2.update(visits).set(data).where(and2(eq2(visits.id, id3), eq2(visits.companyId, requireAccountId(companyId))));
  const rows4 = await database2.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq2(visits.storeId, stores.id)).where(and2(eq2(visits.id, id3), eq2(visits.companyId, companyId))).limit(1);
  return rows4[0];
}
async function autoCloseStaleVisits(companyId, promoterId, today) {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
    const database2 = await getDb();
    if (!database2) return [];
    const company = requireAccountId(companyId);
    const open = await database2.select({
      visit: visits,
      routeDate: routes.date,
      storeName: stores.name
    }).from(visits).innerJoin(routes, eq2(visits.routeId, routes.id)).innerJoin(stores, eq2(visits.storeId, stores.id)).where(
      and2(
        eq2(visits.companyId, company),
        eq2(visits.promoterId, promoterId),
        eq2(visits.status, "in_progress")
      )
    );
    const closed = [];
    for (const row2 of open) {
      const routeDate = String(row2.routeDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(routeDate) || routeDate >= today) continue;
      const actualEnd = /* @__PURE__ */ new Date(`${routeDate}T21:00:00.000Z`);
      const note = "Check-out autom\xE1tico: visita de dia anterior n\xE3o encerrada ap\xF3s o expediente.";
      const existingNotes = row2.visit.notes ? String(row2.visit.notes) : "";
      const notes = existingNotes.includes(note) ? existingNotes : existingNotes ? `${existingNotes}
${note}` : note;
      await database2.update(visits).set({
        status: "completed",
        actualEnd,
        notes
      }).where(and2(eq2(visits.id, row2.visit.id), eq2(visits.companyId, company)));
      closed.push({ id: row2.visit.id, storeName: row2.storeName ?? null, routeDate });
    }
    return closed;
  } catch (error) {
    console.warn("[visits] autoCloseStaleVisits failed", error);
    return [];
  }
}
async function ensureInventoryProductsSchema() {
  if (_inventoryReady) return _inventoryReady;
  _inventoryReady = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(`CREATE TABLE IF NOT EXISTS inventory_products (
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
    const [cols] = await database2.execute(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_products'`);
    const names = new Set(cols.map((c) => String(c.COLUMN_NAME ?? c.column_name).toLowerCase()));
    if (!names.has("storeid")) await database2.execute(`ALTER TABLE inventory_products ADD COLUMN storeId int NULL`);
    if (!names.has("createdbymemberid")) await database2.execute(`ALTER TABLE inventory_products ADD COLUMN createdByMemberId int NULL`);
    if (!names.has("storeclientid")) await database2.execute(`ALTER TABLE inventory_products ADD COLUMN storeClientId int NULL`);
    if (!names.has("lot")) await database2.execute(`ALTER TABLE inventory_products ADD COLUMN lot varchar(64) NULL`);
    if (!names.has("photokey")) await database2.execute(`ALTER TABLE inventory_products ADD COLUMN photoKey varchar(512) NULL`);
    await database2.execute(`CREATE TABLE IF NOT EXISTS inventory_product_requests (
      companyId int NOT NULL,
      clientRequestId varchar(64) NOT NULL,
      productId int NOT NULL,
      merged boolean NOT NULL DEFAULT false,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (companyId, clientRequestId)
    )`);
    const [idx] = await database2.execute(`SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory_products'`);
    const indexNames = new Set(idx.map((r) => String(r.INDEX_NAME ?? r.index_name)));
    for (const [name, ddl] of [
      ["inventory_products_merge_idx", `CREATE INDEX inventory_products_merge_idx ON inventory_products (companyId, productCode, expirationDate)`],
      ["inventory_products_client_idx", `CREATE INDEX inventory_products_client_idx ON inventory_products (companyId, storeClientId)`]
    ]) {
      if (indexNames.has(name)) continue;
      try {
        await database2.execute(ddl);
      } catch (error) {
        if (!/exist|duplicate/i.test(`${error?.message ?? ""} ${error?.cause?.message ?? ""}`)) console.warn("[inventory] \xEDndice", error);
      }
    }
  })().catch((error) => {
    _inventoryReady = null;
    throw error;
  });
  return _inventoryReady;
}
async function listInventoryProducts(companyId, filters = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  const today = todayInZone();
  const limit = addDays(today, 30);
  const conditions = [eq2(inventoryProducts.companyId, company)];
  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    conditions.push(or(sql2`LOWER(${inventoryProducts.productCode}) LIKE ${pattern}`, sql2`LOWER(${inventoryProducts.description}) LIKE ${pattern}`));
  }
  if (filters.expiry === "expired") conditions.push(sql2`${inventoryProducts.expirationDate} < ${today}`);
  if (filters.expiry === "near") conditions.push(sql2`${inventoryProducts.expirationDate} >= ${today} AND ${inventoryProducts.expirationDate} <= ${limit}`);
  if (filters.expiry === "valid") conditions.push(sql2`${inventoryProducts.expirationDate} > ${limit}`);
  if (filters.storeId) conditions.push(eq2(inventoryProducts.storeId, filters.storeId));
  if (filters.from) conditions.push(sql2`${inventoryProducts.expirationDate} >= ${filters.from}`);
  if (filters.to) conditions.push(sql2`${inventoryProducts.expirationDate} <= ${filters.to}`);
  return database2.select().from(inventoryProducts).where(and2(...conditions)).orderBy(inventoryProducts.expirationDate, inventoryProducts.description);
}
async function getInventoryProduct(companyId, id3) {
  const database2 = await getDb();
  if (!database2) return null;
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id3), eq2(inventoryProducts.companyId, company))).limit(1))[0] ?? null;
}
async function createInventoryProduct(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await ensureInventoryProductsSchema();
  const companyId = requireAccountId(input.companyId);
  const dup = await database2.select().from(inventoryProducts).where(and2(
    eq2(inventoryProducts.companyId, companyId),
    eq2(inventoryProducts.productCode, input.productCode),
    sql2`${inventoryProducts.expirationDate} = ${input.expirationDate}`,
    input.storeId ? eq2(inventoryProducts.storeId, input.storeId) : isNull(inventoryProducts.storeId),
    eq2(inventoryProducts.quantity, input.quantity ?? 0),
    sql2`${inventoryProducts.createdAt} >= DATE_SUB(NOW(), INTERVAL 60 SECOND)`
  )).limit(1);
  if (dup[0]) return dup[0];
  const result = await database2.insert(inventoryProducts).values({ ...input, companyId });
  const id3 = Number(result[0]?.insertId);
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id3), eq2(inventoryProducts.companyId, companyId))).limit(1))[0];
}
async function updateInventoryProduct(companyId, id3, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  await database2.update(inventoryProducts).set(data).where(and2(eq2(inventoryProducts.id, id3), eq2(inventoryProducts.companyId, company)));
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id3), eq2(inventoryProducts.companyId, company))).limit(1))[0] || null;
}
async function deleteInventoryProducts(companyId, ids, actor) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const tenant = requireAccountId(companyId);
  const uniqueIds = [...new Set(ids)].filter((id3) => Number.isInteger(id3) && id3 > 0);
  if (!uniqueIds.length) return { deleted: 0 };
  await ensureTrashTable();
  await ensureInventoryProductsSchema();
  return database2.transaction(async (tx) => {
    const rows4 = await tx.select().from(inventoryProducts).where(and2(inArray(inventoryProducts.id, uniqueIds), eq2(inventoryProducts.companyId, tenant)));
    if (rows4.length !== uniqueIds.length) throw new Error("Um ou mais produtos n\xE3o existem ou n\xE3o pertencem \xE0 sua empresa.");
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3);
    await tx.insert(trashItems).values(rows4.map((product) => ({ accountId: tenant, deletedByMemberId: actor?.memberId ?? null, deletedByName: actor?.name ?? null, ownerMemberId: product.createdByMemberId ?? null, itemType: "product", originalId: product.id, label: `${product.description} (${product.productCode})`.slice(0, 255), snapshot: JSON.stringify(product), expiresAt })));
    await tx.delete(inventoryProducts).where(and2(inArray(inventoryProducts.id, uniqueIds), eq2(inventoryProducts.companyId, tenant)));
    return { deleted: rows4.length };
  });
}
async function deleteInventoryProduct(companyId, id3, actor) {
  return deleteInventoryProducts(companyId, [id3], actor);
}
async function getExpiringInventoryProducts(companyId, daysAhead = 30) {
  const database2 = await getDb();
  if (!database2) return [];
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  const days = Math.max(0, Math.min(365, Math.trunc(daysAhead)));
  return database2.select().from(inventoryProducts).where(and2(
    eq2(inventoryProducts.companyId, company),
    sql2`${inventoryProducts.expirationDate} >= ${todayInZone()} AND ${inventoryProducts.expirationDate} <= ${addDays(todayInZone(), days)}`
  )).orderBy(inventoryProducts.expirationDate, inventoryProducts.description);
}
var _db, _dbUrl, _pool, ownerScopeReady, ownerScopePromise, _trashTableReady, weeklyOccurrenceIndexChecked, WeeklyRouteConflictError, RouteValidationError, _inventoryReady;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_mediaKeys();
    init_schema_original();
    init_schema();
    init_storeAccess();
    init_expiry();
    init_routeSchedule();
    init_entitlements();
    init_commercialPlans();
    init_schema();
    _db = null;
    _dbUrl = null;
    _pool = null;
    ownerScopeReady = false;
    ownerScopePromise = null;
    _trashTableReady = null;
    weeklyOccurrenceIndexChecked = false;
    WeeklyRouteConflictError = class extends Error {
    };
    RouteValidationError = class extends Error {
    };
    _inventoryReady = null;
  }
});

// server/subscriptionAccess.ts
var subscriptionAccess_exports = {};
__export(subscriptionAccess_exports, {
  DEFAULT_OVERDUE_GRACE_DAYS: () => DEFAULT_OVERDUE_GRACE_DAYS,
  MANUAL_BILLING_MESSAGE: () => MANUAL_BILLING_MESSAGE,
  PENDING_GRACE_DAYS: () => PENDING_GRACE_DAYS,
  checkSubscriptionAccess: () => checkSubscriptionAccess,
  laterDate: () => laterDate
});
function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
function laterDate(...values) {
  const dates = values.filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
  if (!dates.length) return null;
  return dates.reduce((a, b) => a.getTime() >= b.getTime() ? a : b);
}
function checkSubscriptionAccess(companyId, now) {
  if (process.env.NODE_ENV === "test" || now) return loadSubscriptionAccess(companyId, now);
  return accessCache.get(String(companyId), () => loadSubscriptionAccess(companyId));
}
async function loadSubscriptionAccess(companyId, now = /* @__PURE__ */ new Date()) {
  const company = await getCompanyById(companyId);
  if (!company) {
    return { allowed: false, status: "none", reason: "Empresa n\xE3o encontrada." };
  }
  if (company.active === false) {
    const reason = await getSetting("blocked_reason", companyId, "");
    return { allowed: false, status: "suspended", reason: reason || "Empresa bloqueada. Entre em contato com o suporte." };
  }
  let status2 = company.subscriptionStatus || null;
  let expiresAt = parseDate(company.subscriptionExpiresAt);
  let trialEndsAt = parseDate(company.trialEndsAt);
  let graceUntil = parseDate(company.gracePeriodEndsAt);
  let pendingSince = parseDate(company.subscriptionStartedAt) || parseDate(company.createdAt);
  if (!status2) {
    const sub = await getLatestCompanySubscription(companyId);
    if (!sub) {
      const created = parseDate(company.createdAt) || /* @__PURE__ */ new Date();
      const implicitTrialEnd = new Date(created.getTime() + 14 * 24 * 3600 * 1e3);
      if (/* @__PURE__ */ new Date() <= implicitTrialEnd) {
        return { allowed: true, status: "trial", expiresAt: implicitTrialEnd, reason: "Per\xEDodo de teste impl\xEDcito." };
      }
      return { allowed: false, status: "none", reason: "Nenhuma assinatura ativa. Regularize o plano." };
    }
    status2 = sub.status;
    expiresAt = parseDate(sub.currentPeriodEnd) || parseDate(sub.endsAt);
    trialEndsAt = parseDate(sub.trialEndsAt);
    graceUntil = parseDate(sub.gracePeriodEndsAt);
    pendingSince = parseDate(sub.startsAt) || parseDate(sub.createdAt) || pendingSince;
  }
  switch (status2) {
    case "trial":
    case "test": {
      const end = laterDate(trialEndsAt, expiresAt);
      if (!end || now <= end) {
        return { allowed: true, status: status2, expiresAt: end, graceUntil };
      }
      const grace = graceUntil || (expiresAt ? new Date(expiresAt.getTime() + DEFAULT_OVERDUE_GRACE_DAYS * 24 * 3600 * 1e3) : null);
      if (grace && now <= grace) {
        return { allowed: true, status: "overdue", expiresAt: end, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
      }
      return { allowed: false, status: status2, expiresAt: end, graceUntil: grace, reason: "Per\xEDodo de teste encerrado." };
    }
    case "active":
      if (expiresAt && now > expiresAt) {
        const grace = graceUntil || new Date(expiresAt.getTime() + DEFAULT_OVERDUE_GRACE_DAYS * 24 * 3600 * 1e3);
        if (now <= grace) {
          return { allowed: true, status: "overdue", expiresAt, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
        }
        return { allowed: false, status: "overdue", expiresAt, graceUntil: grace, reason: "Assinatura vencida." };
      }
      return { allowed: true, status: status2, expiresAt };
    case "pending": {
      const defaultDeadline = pendingSince ? new Date(pendingSince.getTime() + PENDING_GRACE_DAYS * 24 * 3600 * 1e3) : null;
      const deadline = graceUntil && defaultDeadline ? graceUntil > defaultDeadline ? graceUntil : defaultDeadline : graceUntil || defaultDeadline;
      if (deadline && now <= deadline) {
        return { allowed: true, status: status2, expiresAt, graceUntil: deadline, reason: "Pagamento pendente." };
      }
      return { allowed: false, status: status2, expiresAt, graceUntil: deadline, reason: `Pagamento pendente h\xE1 mais de ${PENDING_GRACE_DAYS} dias. ${MANUAL_BILLING_MESSAGE}` };
    }
    case "overdue": {
      const grace = graceUntil || (expiresAt ? new Date(expiresAt.getTime() + DEFAULT_OVERDUE_GRACE_DAYS * 24 * 3600 * 1e3) : null);
      if (grace && now <= grace) {
        return { allowed: true, status: status2, expiresAt, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
      }
      return { allowed: false, status: status2, expiresAt, graceUntil: grace, reason: "Pagamento em atraso. Regularize a assinatura." };
    }
    case "suspended":
      return { allowed: false, status: status2, expiresAt, reason: "Assinatura suspensa." };
    case "canceled":
    case "expired":
      if (expiresAt && now <= expiresAt) {
        return { allowed: true, status: status2, expiresAt, reason: "Acesso at\xE9 o fim do per\xEDodo j\xE1 pago." };
      }
      return { allowed: false, status: status2, expiresAt, reason: "Assinatura cancelada ou expirada." };
    default:
      return { allowed: false, status: "none", reason: "Status de assinatura desconhecido." };
  }
}
var MANUAL_BILLING_MESSAGE, PENDING_GRACE_DAYS, DEFAULT_OVERDUE_GRACE_DAYS, accessCache;
var init_subscriptionAccess = __esm({
  "server/subscriptionAccess.ts"() {
    "use strict";
    init_ttlCache();
    init_db();
    MANUAL_BILLING_MESSAGE = "Para contratar ou renovar, fale com o suporte.";
    PENDING_GRACE_DAYS = 7;
    DEFAULT_OVERDUE_GRACE_DAYS = 5;
    accessCache = createTtlCache(3e4);
  }
});

// shared/vacationLock.ts
function formatBrDate(iso) {
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return iso;
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function isOnVacationDay(todayYmd, startDate, endDate) {
  const t2 = todayYmd.slice(0, 10);
  const a = startDate.slice(0, 10);
  const b = endDate.slice(0, 10);
  if (![t2, a, b].every((x) => /^\d{4}-\d{2}-\d{2}$/.test(x))) return false;
  return t2 >= a && t2 <= b;
}
function vacationBlockMessage(startDate, endDate) {
  return `Voc\xEA est\xE1 de f\xE9rias de ${formatBrDate(startDate)} a ${formatBrDate(endDate)}. O aplicativo \xE9 liberado no dia seguinte ao t\xE9rmino.`;
}
var init_vacationLock = __esm({
  "shared/vacationLock.ts"() {
    "use strict";
    init_expiry();
  }
});

// server/modules/vacations.ts
var vacations_exports = {};
__export(vacations_exports, {
  ensureVacationSchedulesTable: () => ensureVacationSchedulesTable,
  vacationsRouter: () => vacationsRouter
});
import { TRPCError as TRPCError2 } from "@trpc/server";
import { and as and3, eq as eq3, gte, lte, ne, inArray as inArray2 } from "drizzle-orm";
import { z } from "zod";
function asDateStr(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}
function dbDate(value) {
  return value;
}
async function ensureVacationSchedulesTable() {
  if (tableReady) return tableReady;
  tableReady = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(`CREATE TABLE IF NOT EXISTS vacation_schedules (
      id int AUTO_INCREMENT PRIMARY KEY,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      startDate date NOT NULL,
      endDate date NOT NULL,
      days int NOT NULL,
      status enum('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
      notes text,
      createdByMemberAccountId int NOT NULL,
      updatedByMemberAccountId int,
      cancelledByMemberAccountId int,
      cancelledAt timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY vacation_schedules_company_member_idx (companyId, memberAccountId),
      KEY vacation_schedules_company_dates_idx (companyId, startDate, endDate),
      KEY vacation_schedules_status_idx (status)
    )`);
  })().catch((e) => {
    tableReady = null;
    throw e;
  });
  return tableReady;
}
function daysBetween(start, end) {
  const s = /* @__PURE__ */ new Date(start + "T00:00:00");
  const e = /* @__PURE__ */ new Date(end + "T00:00:00");
  if (e < s) throw new TRPCError2({ code: "BAD_REQUEST", message: "Data final n\xE3o pode ser anterior \xE0 inicial." });
  return Math.round((e.getTime() - s.getTime()) / 864e5) + 1;
}
function assertManager(ctx) {
  if (ctx.user?.role === "promoter") {
    throw new TRPCError2({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem gerenciar f\xE9rias." });
  }
}
async function assertNoOverlap(tx, companyId, memberAccountId, startDate, endDate, excludeId) {
  const conditions = [
    eq3(vacationSchedules.companyId, companyId),
    eq3(vacationSchedules.memberAccountId, memberAccountId),
    eq3(vacationSchedules.status, "scheduled"),
    and3(lte(vacationSchedules.startDate, dbDate(endDate)), gte(vacationSchedules.endDate, dbDate(startDate)))
  ];
  if (excludeId) conditions.push(ne(vacationSchedules.id, excludeId));
  const existing = await tx.select({ id: vacationSchedules.id }).from(vacationSchedules).where(and3(...conditions)).limit(1);
  if (existing.length) throw new TRPCError2({ code: "CONFLICT", message: "J\xE1 existe f\xE9rias sobrepostas para este funcion\xE1rio no per\xEDodo informado." });
}
async function teamOverlapWarning(database2, companyId, memberAccountId, startDate, endDate) {
  const [me] = await database2.select({ supervisorId: memberAccounts2.supervisorId }).from(memberAccounts2).where(eq3(memberAccounts2.id, memberAccountId)).limit(1);
  if (!me?.supervisorId) return null;
  const teammates = await database2.select({ id: memberAccounts2.id, userName: memberAccounts2.userName }).from(memberAccounts2).where(and3(eq3(memberAccounts2.companyId, companyId), eq3(memberAccounts2.supervisorId, me.supervisorId), ne(memberAccounts2.id, memberAccountId), eq3(memberAccounts2.active, true)));
  if (!teammates.length) return null;
  const ids = teammates.map((t2) => t2.id);
  const overlaps = await database2.select({ memberAccountId: vacationSchedules.memberAccountId }).from(vacationSchedules).where(and3(
    eq3(vacationSchedules.companyId, companyId),
    eq3(vacationSchedules.status, "scheduled"),
    inArray2(vacationSchedules.memberAccountId, ids),
    and3(lte(vacationSchedules.startDate, dbDate(endDate)), gte(vacationSchedules.endDate, dbDate(startDate)))
  ));
  if (!overlaps.length) return null;
  const names = teammates.filter((t2) => overlaps.some((o) => o.memberAccountId === t2.id)).map((t2) => t2.userName);
  return names.length ? `Aten\xE7\xE3o: ${names.join(", ")} da mesma equipe tamb\xE9m estar\xE3o de f\xE9rias neste per\xEDodo.` : null;
}
async function requireDb() {
  const database2 = await getDb();
  if (!database2) throw new TRPCError2({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indispon\xEDvel no momento. Tente novamente em instantes." });
  return database2;
}
var dateStr, tableReady, vacationsRouter;
var init_vacations = __esm({
  "server/modules/vacations.ts"() {
    "use strict";
    init_schema();
    init_trpc();
    init_db();
    dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    tableReady = null;
    vacationsRouter = router({
      members: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        assertManager(ctx);
        const database2 = await requireDb();
        return database2.select({ id: memberAccounts2.id, userName: memberAccounts2.userName }).from(memberAccounts2).where(and3(eq3(memberAccounts2.companyId, ctx.accountId), eq3(memberAccounts2.active, true))).orderBy(memberAccounts2.userName);
      }),
      list: commercialFeatureProcedure("timeTracking").input(z.object({
        memberAccountId: z.number().int().positive().optional(),
        from: dateStr.optional(),
        to: dateStr.optional(),
        status: z.enum(["scheduled", "cancelled", "all"]).optional()
      }).optional()).query(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const conds = [eq3(vacationSchedules.companyId, ctx.accountId)];
        if (input?.memberAccountId) conds.push(eq3(vacationSchedules.memberAccountId, input.memberAccountId));
        if (input?.status && input.status !== "all") conds.push(eq3(vacationSchedules.status, input.status));
        if (input?.from) conds.push(gte(vacationSchedules.endDate, dbDate(input.from)));
        if (input?.to) conds.push(lte(vacationSchedules.startDate, dbDate(input.to)));
        const rows4 = await database2.select({
          id: vacationSchedules.id,
          memberAccountId: vacationSchedules.memberAccountId,
          startDate: vacationSchedules.startDate,
          endDate: vacationSchedules.endDate,
          days: vacationSchedules.days,
          status: vacationSchedules.status,
          notes: vacationSchedules.notes,
          createdAt: vacationSchedules.createdAt,
          cancelledAt: vacationSchedules.cancelledAt,
          createdByMemberAccountId: vacationSchedules.createdByMemberAccountId,
          updatedByMemberAccountId: vacationSchedules.updatedByMemberAccountId,
          cancelledByMemberAccountId: vacationSchedules.cancelledByMemberAccountId,
          memberName: memberAccounts2.userName
        }).from(vacationSchedules).innerJoin(memberAccounts2, eq3(memberAccounts2.id, vacationSchedules.memberAccountId)).where(and3(...conds)).orderBy(vacationSchedules.startDate);
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
      }),
      mine: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.memberAccountId || !ctx.accountId) throw new TRPCError2({ code: "FORBIDDEN" });
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const rows4 = await database2.select().from(vacationSchedules).where(and3(eq3(vacationSchedules.companyId, ctx.accountId), eq3(vacationSchedules.memberAccountId, ctx.memberAccountId))).orderBy(vacationSchedules.startDate);
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
      }),
      /** Usado pela tela de bloqueio. Liberado mesmo com o restante da API barrada nas férias. */
      myActive: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user?.role !== "promoter" || !ctx.memberAccountId || !ctx.accountId) {
          return { active: false };
        }
        const { findActiveVacationForMember: findActiveVacationForMember2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
        const active = await findActiveVacationForMember2(ctx.accountId, ctx.memberAccountId);
        if (!active) return { active: false };
        return { active: true, startDate: active.startDate, endDate: active.endDate };
      }),
      create: commercialFeatureProcedure("timeTracking").input(z.object({
        memberAccountId: z.number().int().positive(),
        startDate: dateStr,
        endDate: dateStr,
        notes: z.string().max(500).optional()
      })).mutation(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const [member] = await database2.select({ id: memberAccounts2.id, companyId: memberAccounts2.companyId, active: memberAccounts2.active }).from(memberAccounts2).where(eq3(memberAccounts2.id, input.memberAccountId)).limit(1);
        if (!member || member.companyId !== ctx.accountId || !member.active) {
          throw new TRPCError2({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado ou inativo." });
        }
        const days = daysBetween(input.startDate, input.endDate);
        const warning = await teamOverlapWarning(database2, ctx.accountId, input.memberAccountId, input.startDate, input.endDate);
        await database2.transaction(async (tx) => {
          await assertNoOverlap(tx, ctx.accountId, input.memberAccountId, input.startDate, input.endDate);
          await tx.insert(vacationSchedules).values({
            companyId: ctx.accountId,
            memberAccountId: input.memberAccountId,
            startDate: dbDate(input.startDate),
            endDate: dbDate(input.endDate),
            days,
            notes: input.notes || null,
            createdByMemberAccountId: ctx.memberAccountId
          });
        });
        return { ok: true, warning };
      }),
      update: commercialFeatureProcedure("timeTracking").input(z.object({
        id: z.number().int().positive(),
        startDate: dateStr,
        endDate: dateStr,
        notes: z.string().max(500).optional()
      })).mutation(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const days = daysBetween(input.startDate, input.endDate);
        let warning = null;
        await database2.transaction(async (tx) => {
          const [row2] = await tx.select().from(vacationSchedules).where(and3(eq3(vacationSchedules.id, input.id), eq3(vacationSchedules.companyId, ctx.accountId))).limit(1);
          if (!row2) throw new TRPCError2({ code: "NOT_FOUND" });
          if (row2.status === "cancelled") throw new TRPCError2({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel editar f\xE9rias canceladas." });
          await assertNoOverlap(tx, ctx.accountId, row2.memberAccountId, input.startDate, input.endDate, input.id);
          warning = await teamOverlapWarning(tx, ctx.accountId, row2.memberAccountId, input.startDate, input.endDate);
          await tx.update(vacationSchedules).set({
            startDate: dbDate(input.startDate),
            endDate: dbDate(input.endDate),
            days,
            notes: input.notes ?? row2.notes,
            updatedByMemberAccountId: ctx.memberAccountId
          }).where(eq3(vacationSchedules.id, input.id));
        });
        return { ok: true, warning };
      }),
      cancel: commercialFeatureProcedure("timeTracking").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        await database2.transaction(async (tx) => {
          const [row2] = await tx.select().from(vacationSchedules).where(and3(eq3(vacationSchedules.id, input.id), eq3(vacationSchedules.companyId, ctx.accountId))).limit(1);
          if (!row2) throw new TRPCError2({ code: "NOT_FOUND" });
          if (row2.status === "cancelled") return;
          await tx.update(vacationSchedules).set({
            status: "cancelled",
            cancelledAt: /* @__PURE__ */ new Date(),
            cancelledByMemberAccountId: ctx.memberAccountId
          }).where(eq3(vacationSchedules.id, input.id));
        });
        return { ok: true };
      }),
      calendar: commercialFeatureProcedure("timeTracking").input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12).optional() })).query(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const from = input.month ? `${input.year}-${String(input.month).padStart(2, "0")}-01` : `${input.year}-01-01`;
        const last = new Date(input.year, input.month ?? 12, 0).getDate();
        const to = input.month ? `${input.year}-${String(input.month).padStart(2, "0")}-${String(last).padStart(2, "0")}` : `${input.year}-12-31`;
        const rows4 = await database2.select({
          id: vacationSchedules.id,
          memberAccountId: vacationSchedules.memberAccountId,
          memberName: memberAccounts2.userName,
          startDate: vacationSchedules.startDate,
          endDate: vacationSchedules.endDate,
          status: vacationSchedules.status,
          createdByMemberAccountId: vacationSchedules.createdByMemberAccountId,
          updatedByMemberAccountId: vacationSchedules.updatedByMemberAccountId,
          cancelledByMemberAccountId: vacationSchedules.cancelledByMemberAccountId
        }).from(vacationSchedules).innerJoin(memberAccounts2, eq3(memberAccounts2.id, vacationSchedules.memberAccountId)).where(and3(
          eq3(vacationSchedules.companyId, ctx.accountId),
          eq3(vacationSchedules.status, "scheduled"),
          lte(vacationSchedules.startDate, dbDate(to)),
          gte(vacationSchedules.endDate, dbDate(from))
        ));
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
      })
    });
  }
});

// server/vacationLock.ts
var vacationLock_exports = {};
__export(vacationLock_exports, {
  assertPromoterNotOnVacation: () => assertPromoterNotOnVacation,
  findActiveVacationForMember: () => findActiveVacationForMember
});
import { TRPCError as TRPCError3 } from "@trpc/server";
import { and as and4, eq as eq4, gte as gte2, lte as lte2 } from "drizzle-orm";
function asDateStr2(value) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}
function dbDate2(value) {
  return value;
}
async function findActiveVacationForMember(companyId, memberAccountId, now = /* @__PURE__ */ new Date()) {
  try {
    const { ensureVacationSchedulesTable: ensureVacationSchedulesTable2 } = await Promise.resolve().then(() => (init_vacations(), vacations_exports));
    await ensureVacationSchedulesTable2();
    const database2 = await getDb();
    if (!database2) return null;
    const today = todayInZone(now);
    const rows4 = await database2.select({
      startDate: vacationSchedules.startDate,
      endDate: vacationSchedules.endDate
    }).from(vacationSchedules).where(and4(
      eq4(vacationSchedules.companyId, companyId),
      eq4(vacationSchedules.memberAccountId, memberAccountId),
      eq4(vacationSchedules.status, "scheduled"),
      lte2(vacationSchedules.startDate, dbDate2(today)),
      gte2(vacationSchedules.endDate, dbDate2(today))
    )).limit(1);
    const row2 = rows4[0];
    if (!row2) return null;
    const startDate = asDateStr2(row2.startDate);
    const endDate = asDateStr2(row2.endDate);
    if (!isOnVacationDay(today, startDate, endDate)) return null;
    return { startDate, endDate };
  } catch {
    return null;
  }
}
async function assertPromoterNotOnVacation(ctx) {
  if (ctx.actingAsPlatform) return;
  if (ctx.user?.role !== "promoter") return;
  if (!ctx.accountId || !ctx.memberAccountId) return;
  const active = await findActiveVacationForMember(ctx.accountId, ctx.memberAccountId);
  if (!active) return;
  throw new TRPCError3({
    code: "FORBIDDEN",
    message: vacationBlockMessage(active.startDate, active.endDate),
    cause: { code: "VACATION_BLOCKED", startDate: active.startDate, endDate: active.endDate }
  });
}
var init_vacationLock2 = __esm({
  "server/vacationLock.ts"() {
    "use strict";
    init_schema();
    init_expiry();
    init_vacationLock();
    init_db();
  }
});

// server/entitlements.ts
var entitlements_exports = {};
__export(entitlements_exports, {
  assertCompanyFeatureAccess: () => assertCompanyFeatureAccess,
  assertMemberFeatureAccess: () => assertMemberFeatureAccess,
  getCompanyEntitlementBase: () => getCompanyEntitlementBase,
  getMemberEntitlementSnapshot: () => getMemberEntitlementSnapshot
});
import { TRPCError as TRPCError4 } from "@trpc/server";
function getCompanyEntitlementBase(companyId) {
  if (process.env.NODE_ENV === "test") return loadCompanyEntitlementBase(companyId);
  return entitlementBaseCache.get(String(companyId), () => loadCompanyEntitlementBase(companyId));
}
async function loadCompanyEntitlementBase(companyId) {
  if (!commercialModulesReady) {
    commercialModulesReady = (async () => {
      try {
        await ensureVisitCheckInFeature();
        await ensureProductsFeature();
      } catch (error) {
        commercialModulesReady = null;
        console.warn("[entitlements] ensure commercial modules", error);
      }
    })();
  }
  await commercialModulesReady;
  const resolved = await resolveCompanyPlan(companyId);
  const plan = resolved.plan ?? null;
  const rawKeys = Array.isArray(plan?.featureKeys) ? plan.featureKeys.filter((key) => ENTITLEMENT_KEYS.includes(key)) : [];
  const companyOverrides = await getCompanyFeatureOverrides(companyId);
  const planSet = new Set(rawKeys);
  const companyFeatures = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, companyOverrides[key] ?? planSet.has(key)]));
  const company = await getCompanyById(companyId).catch(() => void 0);
  return {
    companyId,
    companyName: company?.name ?? null,
    planId: plan?.id == null ? null : Number(plan.id),
    planName: String(plan?.name ?? "Sem plano"),
    planFeatureKeys: rawKeys,
    companyOverrides,
    companyFeatures,
    plan
  };
}
async function getMemberEntitlementSnapshot(companyId, memberAccountId, role) {
  const base = await getCompanyEntitlementBase(companyId);
  const memberOverrides = await getMemberFeatureModes(memberAccountId, companyId);
  const effective = resolveEntitlements({
    planFeatures: base.planFeatureKeys,
    companyOverrides: base.companyOverrides,
    role,
    memberOverrides
  });
  return {
    ...base,
    memberAccountId,
    role,
    memberOverrides,
    effective,
    effectiveFeatureKeys: ENTITLEMENT_KEYS.filter((key) => effective[key])
  };
}
async function assertCompanyFeatureAccess(companyId, featureKey) {
  const base = await getCompanyEntitlementBase(companyId);
  if (!base.companyFeatures[featureKey]) {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: `O m\xF3dulo \u201C${featureKey}\u201D n\xE3o est\xE1 habilitado para esta empresa.`,
      cause: { code: "PLAN_FEATURE_BLOCKED", featureKey, planId: base.planId, planName: base.planName }
    });
  }
  return base;
}
async function assertMemberFeatureAccess(input) {
  const memberOverrides = input.memberAccountId ? await getMemberFeatureModes(input.memberAccountId, input.companyId) : {};
  const base = await getCompanyEntitlementBase(input.companyId);
  const effective = resolveEntitlements({
    planFeatures: base.planFeatureKeys,
    companyOverrides: base.companyOverrides,
    role: input.role,
    memberOverrides
  });
  if (!effective[input.featureKey]) {
    let message = "Este m\xF3dulo n\xE3o est\xE1 liberado para seu usu\xE1rio. Pe\xE7a ao administrador da empresa para revisar o acesso.";
    let code = "MEMBER_FEATURE_BLOCKED";
    if (base.companyOverrides[input.featureKey] === false) {
      message = "Este m\xF3dulo foi bloqueado para a empresa pelo administrador da plataforma.";
      code = "COMPANY_FEATURE_BLOCKED";
    } else if (!base.companyFeatures[input.featureKey]) {
      message = `O plano ${base.planName} n\xE3o inclui este m\xF3dulo. Fa\xE7a upgrade ou solicite uma exce\xE7\xE3o ao administrador da plataforma.`;
      code = "PLAN_FEATURE_BLOCKED";
    } else if (memberOverrides[input.featureKey] === "deny") {
      message = "O administrador da empresa bloqueou este m\xF3dulo para seu usu\xE1rio.";
    } else if (!base.planFeatureKeys.includes(input.featureKey) && base.companyOverrides[input.featureKey] === true) {
      message = "Seu perfil n\xE3o tem permiss\xE3o para usar este m\xF3dulo.";
      code = "ROLE_FEATURE_BLOCKED";
    }
    throw new TRPCError4({
      code: "FORBIDDEN",
      message,
      cause: { code, featureKey: input.featureKey, planId: base.planId, planName: base.planName, role: input.role }
    });
  }
  return { ...base, memberOverrides, effective };
}
var entitlementBaseCache, commercialModulesReady;
var init_entitlements2 = __esm({
  "server/entitlements.ts"() {
    "use strict";
    init_ttlCache();
    init_db();
    init_entitlements();
    entitlementBaseCache = createTtlCache(3e4);
    commercialModulesReady = null;
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError5 } from "@trpc/server";
import superjson from "superjson";
var t, router, publicProcedure, requireUser, requireCompanyUser, requireCompanyAdmin, requireCompanyManager, requirePlatformAdmin, protectedProcedure, requireCompanyMemberNoBillingGate, companyBillingProcedure, requireEntitlement, commercialFeatureProcedure, companyAdminFeatureProcedure, companyAdminProcedure, companyManagerProcedure, platformProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    t = initTRPC.context().create({ transformer: superjson });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    });
    requireCompanyUser = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada para acessar dados comerciais." });
      }
      const companyRoles = ["company_admin", "supervisor", "promoter"];
      if (!companyRoles.includes(user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
      if (process.env.NODE_ENV !== "test" && !opts.ctx.actingAsPlatform) {
        const { checkSubscriptionAccess: checkSubscriptionAccess2 } = await Promise.resolve().then(() => (init_subscriptionAccess(), subscriptionAccess_exports));
        const access = await checkSubscriptionAccess2(opts.ctx.accountId);
        if (!access.allowed) {
          throw new TRPCError5({
            code: "FORBIDDEN",
            message: access.reason || "Assinatura irregular. Regularize o plano para continuar.",
            cause: { code: "SUBSCRIPTION_BLOCKED", status: access.status }
          });
        }
      }
      const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
      await assertPromoterNotOnVacation2(opts.ctx);
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    requireCompanyAdmin = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (user.role !== "company_admin" || !opts.ctx.accountId) throw new TRPCError5({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode executar esta opera\xE7\xE3o." });
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    requireCompanyManager = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (user.role !== "company_admin" && user.role !== "supervisor" || !opts.ctx.accountId) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "Somente o administrador ou o supervisor da empresa pode executar esta opera\xE7\xE3o." });
      }
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    requirePlatformAdmin = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (user.role !== "platform_admin" || !opts.ctx.isPlatformAdmin) throw new TRPCError5({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      return opts.next({ ctx: { ...opts.ctx, user } });
    });
    protectedProcedure = t.procedure.use(requireUser);
    requireCompanyMemberNoBillingGate = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError5({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada." });
      }
      const companyRoles = ["company_admin", "supervisor", "promoter"];
      if (!companyRoles.includes(user.role)) throw new TRPCError5({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
      if (opts.type === "mutation") {
        const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
        await assertPromoterNotOnVacation2(opts.ctx);
      }
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    companyBillingProcedure = t.procedure.use(requireCompanyMemberNoBillingGate);
    requireEntitlement = (featureKey) => t.middleware(async (opts) => {
      const user = opts.ctx.user;
      const companyId = opts.ctx.accountId;
      if (!user || !companyId || user.role === "platform_admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "N\xE3o foi poss\xEDvel determinar a empresa e o perfil para validar este m\xF3dulo." });
      }
      if (opts.ctx.actingAsPlatform) return opts.next({ ctx: { ...opts.ctx, user, accountId: companyId } });
      const { assertMemberFeatureAccess: assertMemberFeatureAccess2 } = await Promise.resolve().then(() => (init_entitlements2(), entitlements_exports));
      await assertMemberFeatureAccess2({
        companyId,
        memberAccountId: opts.ctx.memberAccountId ?? null,
        role: user.role,
        featureKey
      });
      return opts.next({ ctx: { ...opts.ctx, user, accountId: companyId } });
    });
    commercialFeatureProcedure = (featureKey) => t.procedure.use(requireCompanyUser).use(requireEntitlement(featureKey));
    companyAdminFeatureProcedure = (featureKey) => t.procedure.use(requireCompanyManager).use(requireCompanyUser).use(requireEntitlement(featureKey));
    companyAdminProcedure = t.procedure.use(requireCompanyAdmin);
    companyManagerProcedure = t.procedure.use(requireCompanyManager);
    platformProcedure = t.procedure.use(requirePlatformAdmin);
    adminProcedure = platformProcedure;
  }
});

// server/audit.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
async function ensureAuditLogsTable() {
  if (auditTableReady) return;
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS \`audit_logs\` (
      \`id\` int AUTO_INCREMENT NOT NULL,
      \`companyId\` int NULL,
      \`userId\` int NULL,
      \`userName\` varchar(255) NULL,
      \`userEmail\` varchar(320) NULL,
      \`action\` varchar(64) NOT NULL,
      \`module\` varchar(64) NOT NULL,
      \`entityType\` varchar(64) NOT NULL,
      \`entityId\` int NULL,
      \`entityLabel\` varchar(255) NULL,
      \`description\` text NOT NULL,
      \`oldData\` text NULL,
      \`newData\` text NULL,
      \`ipAddress\` varchar(64) NULL,
      \`userAgent\` varchar(512) NULL,
      \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      KEY \`audit_logs_company_idx\` (\`companyId\`),
      KEY \`audit_logs_company_created_idx\` (\`companyId\`, \`createdAt\`),
      KEY \`audit_logs_user_idx\` (\`userId\`),
      KEY \`audit_logs_entity_idx\` (\`entityType\`, \`entityId\`),
      KEY \`audit_logs_action_idx\` (\`action\`),
      KEY \`audit_logs_module_idx\` (\`module\`),
      KEY \`audit_logs_created_idx\` (\`createdAt\`)
    )`);
    auditTableReady = true;
  } catch (err) {
    console.warn("[audit] ensure table failed", err);
  }
}
function toMysqlDateTime(value, endOfDay2 = false) {
  const raw = String(value).trim();
  const d = raw.length <= 10 ? /* @__PURE__ */ new Date(`${raw}T${endOfDay2 ? "23:59:59" : "00:00:00"}`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace("T", " ");
  const pad2 = (n) => String(n).padStart(2, "0");
  if (raw.length <= 10) {
    return `${raw} ${endOfDay2 ? "23:59:59" : "00:00:00"}`;
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}
function sanitizeAuditData(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditData);
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(k)) continue;
    out[k] = sanitizeAuditData(v);
  }
  return out;
}
function diffAuditData(before, after) {
  const a = sanitizeAuditData(before);
  const b = sanitizeAuditData(after);
  if (!a && !b) return { oldData: null, newData: null };
  if (!a) return { oldData: null, newData: b || null };
  if (!b) return { oldData: a || null, newData: null };
  const oldPart = {};
  const newPart = {};
  const keys = /* @__PURE__ */ new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    const as = av === void 0 ? null : typeof av === "object" ? JSON.stringify(av) : String(av ?? "");
    const bs = bv === void 0 ? null : typeof bv === "object" ? JSON.stringify(bv) : String(bv ?? "");
    if (as !== bs) {
      if (av !== void 0) oldPart[key] = av;
      if (bv !== void 0) newPart[key] = bv;
    }
  }
  return {
    oldData: Object.keys(oldPart).length ? oldPart : null,
    newData: Object.keys(newPart).length ? newPart : null
  };
}
function requestMeta(ctx) {
  const req = ctx.req;
  const xf = req.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(xf) ? xf[0] : xf;
  const ip = typeof forwarded === "string" && forwarded.split(",")[0]?.trim() || (typeof req.headers?.["x-real-ip"] === "string" ? req.headers["x-real-ip"] : null) || req.ip || req.socket?.remoteAddress || null;
  const uaRaw = req.headers?.["user-agent"];
  const userAgent = (Array.isArray(uaRaw) ? uaRaw[0] : uaRaw) || null;
  return {
    ipAddress: ip ? String(ip).slice(0, 64) : null,
    userAgent: userAgent ? String(userAgent).slice(0, 512) : null
  };
}
function actorFromCtx(ctx) {
  const companyId = ctx.accountId && Number.isInteger(ctx.accountId) && ctx.accountId > 0 ? ctx.accountId : null;
  const userId = ctx.memberAccountId ?? (ctx.platformAdminId != null ? ctx.platformAdminId : null) ?? (ctx.user?.id != null ? Math.abs(ctx.user.id) : null);
  return {
    companyId,
    userId: userId != null ? Number(userId) : null,
    userName: ctx.user?.name || null,
    userEmail: ctx.user?.email || null
  };
}
function serializeJson(value) {
  if (value == null) return null;
  try {
    return JSON.stringify(sanitizeAuditData(value));
  } catch {
    return null;
  }
}
async function writeAuditLog(input) {
  try {
    await ensureAuditLogsTable();
    const pool = await getPool();
    if (!pool) return null;
    const [result] = await pool.query(
      `INSERT INTO \`audit_logs\` (
        \`companyId\`, \`userId\`, \`userName\`, \`userEmail\`, \`action\`, \`module\`,
        \`entityType\`, \`entityId\`, \`entityLabel\`, \`description\`, \`oldData\`, \`newData\`,
        \`ipAddress\`, \`userAgent\`
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.companyId ?? null,
        input.userId ?? null,
        input.userName ? String(input.userName).slice(0, 255) : null,
        input.userEmail ? String(input.userEmail).slice(0, 320) : null,
        String(input.action).slice(0, 64),
        String(input.module).slice(0, 64),
        String(input.entityType).slice(0, 64),
        input.entityId ?? null,
        input.entityLabel ? String(input.entityLabel).slice(0, 255) : null,
        String(input.description).slice(0, 4e3),
        serializeJson(input.oldData),
        serializeJson(input.newData),
        input.ipAddress ? String(input.ipAddress).slice(0, 64) : null,
        input.userAgent ? String(input.userAgent).slice(0, 512) : null
      ]
    );
    return Number(result?.insertId || 0) || null;
  } catch (err) {
    console.warn("[audit] failed to write log", err);
    return null;
  }
}
async function auditFromCtx(ctx, partial) {
  const actor = actorFromCtx(ctx);
  const meta = requestMeta(ctx);
  return writeAuditLog({
    ...partial,
    companyId: partial.companyId !== void 0 ? partial.companyId : actor.companyId,
    userId: actor.userId,
    userName: actor.userName,
    userEmail: actor.userEmail,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent
  });
}
async function listAuditLogs(filters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return { items: [], total: 0, page, pageSize };
  const where = [];
  const params = [];
  where.push("`module` NOT IN ('clients', 'orders', 'extinguishers', 'trash')");
  if (filters.companyId != null) {
    where.push("`companyId` = ?");
    params.push(Number(filters.companyId));
  }
  if (filters.userId != null) {
    where.push("`userId` = ?");
    params.push(Number(filters.userId));
  }
  if (filters.module) {
    where.push("`module` = ?");
    params.push(String(filters.module));
  }
  if (filters.action) {
    where.push("`action` = ?");
    params.push(String(filters.action));
  }
  if (filters.entityType) {
    where.push("`entityType` = ?");
    params.push(String(filters.entityType));
  }
  if (filters.entityId != null) {
    where.push("`entityId` = ?");
    params.push(Number(filters.entityId));
  }
  if (filters.from) {
    const fromStr = toMysqlDateTime(String(filters.from), false);
    where.push("`createdAt` >= ?");
    params.push(fromStr);
  }
  if (filters.to) {
    const toStr = toMysqlDateTime(String(filters.to), true);
    where.push("`createdAt` <= ?");
    params.push(toStr);
  }
  if (filters.search && filters.search.trim()) {
    const q = `%${filters.search.trim().slice(0, 100)}%`;
    where.push("(`userName` LIKE ? OR `userEmail` LIKE ? OR `description` LIKE ? OR `entityLabel` LIKE ?)");
    params.push(q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  try {
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS value FROM \`audit_logs\` ${whereSql}`,
      params
    );
    const total = Number(countRows[0]?.value || 0);
    const [rows4] = await pool.query(
      `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return {
      items: rows4 || [],
      total,
      page,
      pageSize
    };
  } catch (err) {
    console.warn("[audit] list failed", err);
    auditTableReady = false;
    await ensureAuditLogsTable();
    try {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS value FROM \`audit_logs\` ${whereSql}`,
        params
      );
      const total = Number(countRows[0]?.value || 0);
      const [rows4] = await pool.query(
        `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      return { items: rows4 || [], total, page, pageSize };
    } catch (err2) {
      console.warn("[audit] list failed permanently", err2);
      return { items: [], total: 0, page, pageSize };
    }
  }
}
async function getAuditLogById(id3, companyId) {
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return null;
  try {
    if (companyId != null) {
      const [rows5] = await pool.query(
        "SELECT * FROM `audit_logs` WHERE `id` = ? AND `companyId` = ? LIMIT 1",
        [id3, companyId]
      );
      return rows5[0] || null;
    }
    const [rows4] = await pool.query(
      "SELECT * FROM `audit_logs` WHERE `id` = ? LIMIT 1",
      [id3]
    );
    return rows4[0] || null;
  } catch (err) {
    console.warn("[audit] getById failed", err);
    return null;
  }
}
async function listEntityAuditHistory(params) {
  return listAuditLogs({
    companyId: params.companyId,
    enforceTenant: true,
    entityType: params.entityType,
    entityId: params.entityId,
    page: params.page || 1,
    pageSize: params.pageSize || 50
  });
}
async function exportAuditLogsCsv(filters) {
  const result = await listAuditLogs({ ...filters, page: 1, pageSize: 5e3 });
  const header = [
    "id",
    "createdAt",
    "companyId",
    "userName",
    "userEmail",
    "action",
    "module",
    "entityType",
    "entityId",
    "entityLabel",
    "description",
    "oldData",
    "newData",
    "ipAddress"
  ];
  const escape = (v) => {
    const s = neutralizeCsvFormula(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const row2 of result.items) {
    lines.push(
      [
        row2.id,
        row2.createdAt instanceof Date ? row2.createdAt.toISOString() : row2.createdAt,
        row2.companyId,
        row2.userName,
        row2.userEmail,
        row2.action,
        row2.module,
        row2.entityType,
        row2.entityId,
        row2.entityLabel,
        row2.description,
        row2.oldData,
        row2.newData,
        row2.ipAddress
      ].map(escape).join(",")
    );
  }
  return lines.join("\n");
}
async function listPromoterActivities(filters) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(1e4, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return { items: [], total: 0, page, pageSize };
  const unionSql = `
    SELECT CONCAT('point-', te.id) AS activityId, te.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, te.serverTime AS occurredAt,
      'time_tracking' AS module, te.eventType AS action, 'time_event' AS entityType,
      'Ponto eletr\xF4nico' AS entityLabel,
      CONCAT('Registro de ponto: ', CASE te.eventType WHEN 'clock_in' THEN 'entrada' WHEN 'break_start' THEN 'in\xEDcio de intervalo' WHEN 'break_end' THEN 'fim de intervalo' WHEN 'clock_out' THEN 'sa\xEDda' ELSE te.eventType END, CASE WHEN te.notes LIKE '%[ALERTA-HORARIO]%' THEN ' \xB7 ALERTA: hor\xE1rio do aparelho divergente do servidor (considerado o do servidor)' WHEN te.notes LIKE '%[MARCACAO-OFFLINE]%' THEN ' \xB7 feita offline' ELSE '' END) AS description,
      JSON_OBJECT('tipo', te.eventType, 'hor\xE1rio do servidor', te.serverTime, 'hor\xE1rio do dispositivo', te.deviceTime, 'situa\xE7\xE3o da localiza\xE7\xE3o', te.locationStatus, 'latitude', te.latitude, 'longitude', te.longitude, 'precis\xE3o GPS (m)', te.accuracy, 'observa\xE7\xF5es', te.notes, 'dispositivo', te.deviceInfo) AS details
    FROM time_events te INNER JOIN member_accounts ma ON ma.id = te.memberAccountId AND ma.companyId = te.companyId
    WHERE te.companyId = ? AND ma.role NOT IN ('company_admin', 'admin', 'supervisor')
    UNION ALL
    SELECT CONCAT('visit-', v.id) AS activityId, v.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, COALESCE(v.actualEnd, v.actualStart, v.plannedStart, v.createdAt) AS occurredAt,
      'visits' AS module, v.status AS action, 'visit' AS entityType,
      COALESCE(s.name, CONCAT('Loja #', v.storeId)) AS entityLabel,
      CONCAT(CASE v.status WHEN 'completed' THEN 'Visita conclu\xEDda' WHEN 'in_progress' THEN 'Visita iniciada' WHEN 'not_done' THEN 'Visita n\xE3o realizada' WHEN 'cancelled' THEN 'Visita cancelada' ELSE 'Tarefa atribu\xEDda' END, ' \xB7 ', COALESCE(s.name, CONCAT('Loja #', v.storeId))) AS description,
      JSON_OBJECT('loja', s.name, 'endere\xE7o', s.address, 'cidade', s.city, 'roteiro', r.name, 'situa\xE7\xE3o', v.status, 'in\xEDcio previsto', v.plannedStart, 'fim previsto', v.plannedEnd, 'in\xEDcio real', v.actualStart, 'fim real', v.actualEnd, 'observa\xE7\xF5es', v.notes, 'justificativa', v.justification, 'latitude inicial', v.startLatitude, 'longitude inicial', v.startLongitude, 'precis\xE3o GPS inicial (m)', v.startAccuracy, 'latitude final', v.endLatitude, 'longitude final', v.endLongitude, 'precis\xE3o GPS final (m)', v.endAccuracy, 'dist\xE2ncia registrada (m)', v.distanceMeters) AS details
    FROM visits v INNER JOIN member_accounts ma ON ma.id = v.promoterId AND ma.companyId = v.companyId
      LEFT JOIN stores s ON s.id = v.storeId AND s.companyId = v.companyId
      LEFT JOIN routes r ON r.id = v.routeId AND r.companyId = v.companyId
    WHERE v.companyId = ? AND ma.role NOT IN ('company_admin', 'admin', 'supervisor')
    UNION ALL
    SELECT CONCAT('correction-', tc.id) AS activityId, tc.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, COALESCE(tc.reviewedAt, tc.createdAt) AS occurredAt,
      'corrections' AS module, tc.status AS action, 'time_correction' AS entityType,
      CONCAT('Solicita\xE7\xE3o #', tc.id) AS entityLabel,
      CONCAT('Solicita\xE7\xE3o de corre\xE7\xE3o de ponto \xB7 ', CASE tc.status WHEN 'pending' THEN 'pendente' WHEN 'approved' THEN 'aprovada' WHEN 'rejected' THEN 'recusada' ELSE tc.status END) AS description,
      JSON_OBJECT('marca\xE7\xE3o solicitada', tc.requestedType, 'hor\xE1rio solicitado', tc.requestedTime, 'justificativa', tc.justification, 'situa\xE7\xE3o', tc.status, 'observa\xE7\xF5es da revis\xE3o', tc.reviewNotes, 'solicitado em', tc.createdAt, 'revisado em', tc.reviewedAt, 'revisor (ID)', tc.reviewedByUserId) AS details
    FROM time_correction_requests tc INNER JOIN member_accounts ma ON ma.id = tc.memberAccountId AND ma.companyId = tc.companyId
    WHERE tc.companyId = ? AND ma.role NOT IN ('company_admin', 'admin', 'supervisor')
    UNION ALL
    SELECT CONCAT('product-', ip.id) AS activityId, ip.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, ip.createdAt AS occurredAt,
      'products' AS module, 'create' AS action, 'product' AS entityType,
      ip.description AS entityLabel,
      CONCAT('Produto cadastrado \xB7 ', ip.description) AS description,
      JSON_OBJECT('c\xF3digo', ip.productCode, 'descri\xE7\xE3o', ip.description, 'quantidade', ip.quantity, 'validade', ip.expirationDate, 'pre\xE7o', ip.price, 'cadastrado em', ip.createdAt) AS details
    FROM inventory_products ip INNER JOIN member_accounts ma ON ma.id = ip.createdByMemberId AND ma.companyId = ip.companyId
    WHERE ip.companyId = ? AND ma.role NOT IN ('company_admin', 'admin', 'supervisor')
      AND NOT EXISTS (SELECT 1 FROM audit_logs existing WHERE existing.companyId = ip.companyId AND existing.entityType = 'product' AND existing.entityId = ip.id AND existing.action = 'create')
    UNION ALL
    SELECT CONCAT('audit-', al.id) AS activityId, al.companyId, ma.id AS promoterId,
      COALESCE(al.userName, ma.userName) AS userName, COALESCE(al.userEmail, ma.email) AS userEmail,
      al.createdAt AS occurredAt, al.module, al.action, al.entityType,
      COALESCE(al.entityLabel, al.description) AS entityLabel, al.description,
      JSON_OBJECT('registro', al.entityLabel, 'dados anteriores', al.oldData, 'dados novos', al.newData, 'IP', al.ipAddress, 'navegador/dispositivo', al.userAgent) AS details
    FROM audit_logs al INNER JOIN member_accounts ma ON ma.id = al.userId AND ma.companyId = al.companyId
    WHERE al.companyId = ? AND ma.role NOT IN ('company_admin', 'admin', 'supervisor')
  `;
  const where = [];
  const params = [filters.companyId, filters.companyId, filters.companyId, filters.companyId, filters.companyId];
  if (filters.from) {
    where.push("activity.occurredAt >= ?");
    params.push(toMysqlDateTime(filters.from));
  }
  if (filters.to) {
    where.push("activity.occurredAt <= ?");
    params.push(toMysqlDateTime(filters.to, true));
  }
  if (filters.promoterId != null) {
    where.push("activity.promoterId = ?");
    params.push(filters.promoterId);
  }
  if (filters.category === "other") {
    where.push("activity.module NOT IN ('visits', 'time_tracking', 'corrections', 'products')");
  } else if (filters.category) {
    where.push("activity.module = ?");
    params.push(filters.category);
  }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().slice(0, 100)}%`;
    where.push("(activity.userName LIKE ? OR activity.userEmail LIKE ? OR activity.description LIKE ? OR activity.entityLabel LIKE ?)");
    params.push(q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tableSql = `FROM (${unionSql}) AS activity ${whereSql}`;
  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS value ${tableSql}`, params);
    const total = Number(countRows[0]?.value || 0);
    const [rows4] = await pool.query(`SELECT activity.* ${tableSql} ORDER BY activity.occurredAt DESC, activity.activityId DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    return { items: rows4 || [], total, page, pageSize };
  } catch (err) {
    console.warn("[audit] promoter activity query failed", err);
    throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel carregar as atividades dos promotores. Tente novamente em instantes." });
  }
}
var auditTableReady, SENSITIVE_KEY_RE;
var init_audit = __esm({
  "server/audit.ts"() {
    "use strict";
    init_csv();
    init_db();
    auditTableReady = false;
    SENSITIVE_KEY_RE = /password|passwd|pwd|token|secret|cookie|authorization|recovery|hash|credit.?card|card.?number|cvv|cvc|ssn|api.?key/i;
  }
});

// shared/brDocs.ts
function isValidCpf(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = sum * 10 % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}
function isValidCnpj(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * w[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}
function formatCpf(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 11) return String(value ?? "").trim();
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
function formatCnpj(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 14) return String(value ?? "").trim();
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
function formatCpfOrCnpj(value) {
  const d = onlyDigitsStr(value);
  if (d.length === 11) return formatCpf(d);
  if (d.length === 14) return formatCnpj(d);
  return String(value ?? "").trim();
}
function formatCep(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 8) return String(value ?? "").trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}
function isValidCep(value) {
  const d = onlyDigitsStr(value);
  return d.length === 8;
}
function isValidPis(value) {
  const d = onlyDigitsStr(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const weights = [3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * weights[i];
  const r = sum % 11;
  const dv = r < 2 ? 0 : 11 - r;
  return dv === Number(d[10]);
}
var onlyDigitsStr, isValidCpfOrCnpj;
var init_brDocs = __esm({
  "shared/brDocs.ts"() {
    "use strict";
    onlyDigitsStr = (v) => String(v ?? "").replace(/\D/g, "");
    isValidCpfOrCnpj = (v) => onlyDigitsStr(v).length === 11 ? isValidCpf(v) : isValidCnpj(v);
  }
});

// shared/punchTime.ts
function resolvePunchTime(input) {
  const { serverNow } = input;
  const device = input.deviceTime && !Number.isNaN(input.deviceTime.getTime()) ? input.deviceTime : null;
  if (!device) return { effectiveTime: serverNow, deviceTimeToStore: null, alert: "none", diffMinutes: 0, note: null };
  const diffMs = device.getTime() - serverNow.getTime();
  const diffMinutes = Math.round(diffMs / 6e4);
  const age = -diffMs;
  if (input.offline && diffMs <= PUNCH_TOLERANCE_MS && age <= PUNCH_OFFLINE_MAX_AGE_MS && age > 0) {
    return {
      effectiveTime: device,
      deviceTimeToStore: device,
      alert: "offline",
      diffMinutes,
      note: `${OFFLINE_MARKER} Marca\xE7\xE3o feita sem internet \xE0s ${fmt(device)} (hor\xE1rio do aparelho) e recebida pelo servidor \xE0s ${fmt(serverNow)}.`
    };
  }
  if (Math.abs(diffMs) <= PUNCH_TOLERANCE_MS) return { effectiveTime: device, deviceTimeToStore: device, alert: "none", diffMinutes, note: null };
  if (input.offline && diffMs <= PUNCH_TOLERANCE_MS && age <= PUNCH_OFFLINE_MAX_AGE_MS) {
    return {
      effectiveTime: device,
      deviceTimeToStore: device,
      alert: "offline",
      diffMinutes,
      note: `${OFFLINE_MARKER} Marca\xE7\xE3o feita sem internet \xE0s ${fmt(device)} (hor\xE1rio do aparelho) e recebida pelo servidor \xE0s ${fmt(serverNow)}.`
    };
  }
  return {
    effectiveTime: serverNow,
    deviceTimeToStore: null,
    alert: "server_time_used",
    diffMinutes,
    note: `${TIME_ALERT_MARKER} Hor\xE1rio do aparelho (${fmt(device)}) divergiu ${Math.abs(diffMinutes)} min do servidor (${fmt(serverNow)}); considerado o hor\xE1rio do servidor.`
  };
}
function readTimeAlert(notes) {
  if (!notes) return null;
  for (const line of String(notes).split("\n")) {
    if (line.startsWith(TIME_ALERT_MARKER)) return { kind: "server_time_used", text: line.slice(TIME_ALERT_MARKER.length).trim() };
    if (line.startsWith(OFFLINE_MARKER)) return { kind: "offline", text: line.slice(OFFLINE_MARKER.length).trim() };
  }
  return null;
}
var PUNCH_TOLERANCE_MS, PUNCH_OFFLINE_MAX_AGE_MS, TIME_ALERT_MARKER, OFFLINE_MARKER, fmt;
var init_punchTime = __esm({
  "shared/punchTime.ts"() {
    "use strict";
    PUNCH_TOLERANCE_MS = 5 * 60 * 1e3;
    PUNCH_OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
    TIME_ALERT_MARKER = "[ALERTA-HORARIO]";
    OFFLINE_MARKER = "[MARCACAO-OFFLINE]";
    fmt = (d) => d.toISOString();
  }
});

// shared/offlineClock.ts
function assessDeviceClock(deviceTime, clock, serverNow) {
  const reasons = [];
  const anchorServer = valid(clock?.anchorServerTime);
  const anchorDevice = valid(clock?.anchorDeviceTime);
  if (deviceTime.getTime() > serverNow.getTime() + CLOCK_DRIFT_LIMIT_MS) reasons.push("hor\xE1rio do aparelho est\xE1 no futuro em rela\xE7\xE3o ao servidor");
  if (!anchorServer || !anchorDevice) return { suspect: reasons.length > 0, estimatedTime: null, driftMs: null, reasons };
  const anchorSkew = anchorDevice.getTime() - anchorServer.getTime();
  if (Math.abs(anchorSkew) > CLOCK_DRIFT_LIMIT_MS) reasons.push(`rel\xF3gio do aparelho j\xE1 estava ${Math.round(Math.abs(anchorSkew) / 6e4)} min ${anchorSkew > 0 ? "adiantado" : "atrasado"} na \xFAltima conex\xE3o`);
  const deviceDelta = deviceTime.getTime() - anchorDevice.getTime();
  if (deviceDelta < -CLOCK_DRIFT_LIMIT_MS) reasons.push("rel\xF3gio do aparelho voltou para antes da \xFAltima conex\xE3o");
  let estimated = null;
  let drift = null;
  const mono = clock?.monoElapsedMs;
  if (typeof mono === "number" && Number.isFinite(mono) && mono >= 0) {
    estimated = new Date(anchorServer.getTime() + mono);
    drift = deviceTime.getTime() - estimated.getTime();
    if (Math.abs(drift) > CLOCK_DRIFT_LIMIT_MS) reasons.push(`rel\xF3gio do aparelho divergiu ${Math.round(Math.abs(drift) / 6e4)} min do tempo decorrido medido pelo app`);
  } else {
    estimated = new Date(deviceTime.getTime() - anchorSkew);
    drift = anchorSkew;
  }
  if (estimated && estimated.getTime() > serverNow.getTime() + CLOCK_DRIFT_LIMIT_MS) reasons.push("hora estimada da marca\xE7\xE3o \xE9 posterior ao recebimento");
  return { suspect: reasons.length > 0, estimatedTime: estimated, driftMs: drift, reasons };
}
function clockAlertNote(deviceTime, a) {
  if (!a.suspect) return null;
  return `${CLOCK_ALERT_MARKER} Poss\xEDvel altera\xE7\xE3o do rel\xF3gio do aparelho: ${a.reasons.join("; ")}. Hor\xE1rio do aparelho ${deviceTime.toISOString()}${a.estimatedTime ? `, estimado pelo sistema ${a.estimatedTime.toISOString()}` : ""}. Conferir com o funcion\xE1rio.`;
}
function readClockAlert(notes) {
  if (!notes) return null;
  const line = String(notes).split("\n").find((l) => l.startsWith(CLOCK_ALERT_MARKER));
  return line ? line.slice(CLOCK_ALERT_MARKER.length).trim() : null;
}
var CLOCK_DRIFT_LIMIT_MS, CLOCK_ALERT_MARKER, valid, OFFLINE_SEQUENCE_MARKER;
var init_offlineClock = __esm({
  "shared/offlineClock.ts"() {
    "use strict";
    CLOCK_DRIFT_LIMIT_MS = 2 * 60 * 1e3;
    CLOCK_ALERT_MARKER = "[ALERTA-RELOGIO]";
    valid = (s) => {
      if (!s) return null;
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    OFFLINE_SEQUENCE_MARKER = "[SEQUENCIA-OFFLINE]";
  }
});

// server/ponto/repFormat.ts
import { createHash } from "node:crypto";
function crc16Kermit(text4) {
  let crc = 0;
  const bytes = Buffer.from(text4, "latin1");
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? crc >>> 1 ^ 33800 : crc >>> 1;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function padA(value, size) {
  const clean = String(value ?? "").replace(/[\r\n|]/g, " ").normalize("NFC");
  return clean.slice(0, size).padEnd(size, " ");
}
function padN(value, size) {
  const digits = onlyDigits(String(value ?? ""));
  return digits.slice(-size).padStart(size, "0");
}
function tzOffset(date3, timeZone) {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" }).formatToParts(date3).find((p) => p.type === "timeZoneName")?.value || "GMT";
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name);
    if (!m) return "+0000";
    return `${m[1]}${m[2]}${m[3] ?? "00"}`;
  } catch {
    return "-0300";
  }
}
function localParts(date3, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(date3);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { y: p.year, mo: p.month, d: p.day, h: p.hour === "24" ? "00" : p.hour, mi: p.minute };
}
function formatDH(date3, timeZone) {
  const p = localParts(date3, timeZone);
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:00${tzOffset(date3, timeZone)}`;
}
function formatD(date3, timeZone) {
  const p = localParts(date3, timeZone);
  return `${p.y}-${p.mo}-${p.d}`;
}
function afdType7Fields(p) {
  return padN(p.nsr, 9) + "7" + formatDH(p.markedAt, p.timeZone) + padN(p.cpf, 12) + formatDH(p.recordedAt, p.timeZone) + (p.collector || COLLECTOR_BROWSER) + (p.offline ? "1" : "0");
}
function punchHash(p, previousHash) {
  return sha256(afdType7Fields(p) + (previousHash || ""));
}
function punchContentHash(c) {
  return sha256(["C1", c.nsr ?? "", c.memberAccountId, c.eventType, c.markedAt.toISOString(), c.recordedAt.toISOString(), c.clientTime ? c.clientTime.toISOString() : "", num(c.latitude), num(c.longitude), num(c.accuracy), c.timeZone || "", onlyDigits(c.cpf), c.offline ? 1 : 0].join("|"));
}
function treatmentHash(t2, previousHash) {
  const payload2 = [
    "T1",
    t2.kind,
    t2.replacesEventId ?? "",
    t2.memberAccountId,
    t2.eventType,
    t2.markedAt.toISOString(),
    t2.recordedAt.toISOString(),
    t2.correctionRequestId ?? "",
    t2.decidedBy,
    t2.reason
  ].join("|");
  return sha256(payload2 + (previousHash || ""));
}
function verifyLedger(rows4) {
  const problems = [];
  const originals = rows4.filter((r) => r.origin === "original").sort((a, b) => (a.nsr ?? Infinity) - (b.nsr ?? Infinity) || a.id - b.id);
  const treatments = rows4.filter((r) => r.origin !== "original").sort((a, b) => a.id - b.id);
  let prev = null;
  let expectedNsr = 1;
  const seen = /* @__PURE__ */ new Set();
  for (const r of originals) {
    if (r.nsr == null || !r.recordHash) {
      problems.push({ id: r.id, nsr: r.nsr, kind: "unsealed", message: "Marca\xE7\xE3o sem NSR/hash (ainda n\xE3o selada)." });
      continue;
    }
    if (seen.has(r.nsr)) problems.push({ id: r.id, nsr: r.nsr, kind: "duplicate", message: `NSR ${r.nsr} repetido.` });
    seen.add(r.nsr);
    if (r.nsr !== expectedNsr) problems.push({ id: r.id, nsr: r.nsr, kind: "gap", message: `Sequ\xEAncia quebrada: esperado NSR ${expectedNsr}, encontrado ${r.nsr}.` });
    expectedNsr = r.nsr + 1;
    if ((r.prevHash || null) !== (prev || null)) problems.push({ id: r.id, nsr: r.nsr, kind: "chain", message: `Encadeamento quebrado no NSR ${r.nsr}: o hash anterior gravado n\xE3o confere.` });
    const recomputed = punchHash({ nsr: r.nsr, markedAt: r.markedAt, recordedAt: r.recordedAt, cpf: r.cpf, timeZone: r.timeZone || "America/Sao_Paulo", collector: r.collectorId || COLLECTOR_BROWSER, offline: r.offline }, r.prevHash);
    if (recomputed !== r.recordHash) problems.push({ id: r.id, nsr: r.nsr, kind: "hash", message: `Conte\xFAdo da marca\xE7\xE3o NSR ${r.nsr} n\xE3o confere com o hash gravado (poss\xEDvel altera\xE7\xE3o).` });
    else if (r.contentHash && punchContentHash({ nsr: r.nsr, memberAccountId: r.memberAccountId, eventType: r.eventType, markedAt: r.markedAt, recordedAt: r.recordedAt, clientTime: r.clientTime ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null, accuracy: r.accuracy ?? null, timeZone: r.timeZone, cpf: r.cpf, offline: r.offline }) !== r.contentHash) {
      problems.push({ id: r.id, nsr: r.nsr, kind: "hash", message: `Tipo, hor\xE1rio ou localiza\xE7\xE3o da marca\xE7\xE3o NSR ${r.nsr} n\xE3o confere com o selo gravado (poss\xEDvel altera\xE7\xE3o).` });
    }
    prev = r.recordHash;
  }
  let tPrev = null;
  for (const t2 of treatments) {
    if (!t2.recordHash) {
      problems.push({ id: t2.id, nsr: null, kind: "unsealed", message: "Tratamento sem hash (ainda n\xE3o selado)." });
      continue;
    }
    if ((t2.prevHash || null) !== (tPrev || null)) problems.push({ id: t2.id, nsr: null, kind: "chain", message: `Encadeamento de tratamentos quebrado no registro ${t2.id}.` });
    const recomputed = treatmentHash({ id: t2.id, kind: t2.origin === "inclusion" ? "inclusion" : "adjustment", replacesEventId: t2.replacesEventId, memberAccountId: t2.memberAccountId, eventType: t2.eventType, markedAt: t2.markedAt, recordedAt: t2.recordedAt, reason: t2.reason || "", decidedBy: t2.recordedByName || "", correctionRequestId: t2.correctionRequestId }, t2.prevHash);
    if (recomputed !== t2.recordHash) problems.push({ id: t2.id, nsr: null, kind: "hash", message: `Tratamento ${t2.id} n\xE3o confere com o hash gravado (poss\xEDvel altera\xE7\xE3o).` });
    tPrev = t2.recordHash;
  }
  const lastNsr = originals.reduce((m, r) => Math.max(m, r.nsr ?? 0), 0);
  return { ok: problems.length === 0, originals: originals.length, treatments: treatments.length, problems, lastNsr };
}
function employerIdType(doc) {
  return onlyDigits(doc).length === 11 ? "2" : "1";
}
function buildAfd(input) {
  const tz = input.timeZone;
  const lines = [];
  const h = "0000000001" + employerIdType(input.employer.document) + padA(onlyDigits(input.employer.document), 14) + padN("", 14) + padA(input.employer.name, 150) + padN(input.inpiNumber || "", 17) + input.from + input.to + formatDH(input.generatedAt, tz) + AFD_LAYOUT_VERSION + employerIdType(input.developer.document) + padA(onlyDigits(input.developer.document), 14) + padA("", 30);
  lines.push(h + crc16Kermit(h));
  const punches = [...input.punches].sort((a, b) => a.nsr - b.nsr);
  for (const p of punches) lines.push(afdType7Fields(p) + p.hash);
  lines.push("999999999" + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(0, 9) + padN(punches.length, 9) + "9");
  lines.push(padA(SIGNATURE_PLACEHOLDER, 100));
  const fileName = `AFD${onlyDigits(input.inpiNumber || "") || "SEMINPI"}${onlyDigits(input.employer.document) || "SEMCNPJ"}REP_P.txt`;
  return { content: lines.join("\r\n") + "\r\n", fileName, lines };
}
function toAejSequence(dayMarks) {
  let seq = 0;
  return [...dayMarks].sort((a, b) => a.time.getTime() - b.time.getTime()).map((m) => {
    const entry = m.type === "clock_in" || m.type === "break_end";
    if (entry || seq === 0) seq += 1;
    return { ...m, tpMarc: entry ? "E" : "S", seq };
  });
}
function buildAej(input) {
  const tz = input.timeZone;
  const doc = onlyDigits(input.employer.document);
  const clean = (v, max) => String(v ?? "").replace(/[\r\n|]/g, " ").trim().slice(0, max);
  const lines = [];
  const counts = [0, 0, 0, 0, 0, 0, 0, 0];
  const push = (type, fields) => {
    lines.push(fields.join("|"));
    counts[type - 1] += 1;
  };
  push(1, ["01", employerIdType(doc), doc, "", "", clean(input.employer.name, 150), input.from, input.to, formatDH(input.generatedAt, tz), AEJ_LAYOUT_VERSION]);
  push(2, ["02", 1, 3, padN(input.inpiNumber || "", 17)]);
  const contracts = /* @__PURE__ */ new Map();
  input.workers.forEach((w) => {
    if (w.contract) contracts.set(w.contract.code, w.contract);
  });
  input.workers.forEach((w, i) => push(3, ["03", i + 1, padN(w.cpf, 11), clean(w.name, 150)]));
  for (const c of contracts.values()) push(4, ["04", clean(c.code, 30), Math.max(0, Math.round(c.dailyMinutes)), ...c.pairs.flat()]);
  input.workers.forEach((w, i) => {
    for (const m of w.marks) {
      const firstEntry = m.tpMarc === "E" && m.seq === 1;
      const motivo = m.tpMarc === "D" || m.fonte === "I" ? clean(m.motivo || "Tratamento aprovado pelo empregador", 150) : "";
      push(5, ["05", i + 1, formatDH(m.markedAt, tz), m.fonte === "O" ? 1 : "", m.tpMarc, String(m.seq).padStart(3, "0"), m.fonte, firstEntry && w.contract ? clean(w.contract.code, 30) : "", motivo]);
    }
  });
  input.workers.forEach((w, i) => {
    if (w.matEsocial) push(6, ["06", i + 1, clean(w.matEsocial, 30)]);
  });
  push(8, ["08", PTRP_NAME, clean(input.ptrp.version, 8), employerIdType(input.ptrp.developerDocument), onlyDigits(input.ptrp.developerDocument), clean(input.ptrp.developerName, 150), clean(input.ptrp.developerEmail, 50)]);
  lines.push(["99", ...counts].join("|"));
  lines.push(padA(SIGNATURE_PLACEHOLDER, 100));
  return { content: lines.join("\r\n") + "\r\n", fileName: `AEJ_${doc || "SEMCNPJ"}_${input.from}_${input.to}.txt`, lines };
}
function toLatin1(text4) {
  return Buffer.from(text4.replace(/[^\x00-\xff]/g, "?"), "latin1");
}
var AFD_LAYOUT_VERSION, AEJ_LAYOUT_VERSION, SIGNATURE_PLACEHOLDER, COLLECTOR_BROWSER, PTRP_NAME, onlyDigits, sha256, num;
var init_repFormat = __esm({
  "server/ponto/repFormat.ts"() {
    "use strict";
    AFD_LAYOUT_VERSION = "003";
    AEJ_LAYOUT_VERSION = "002";
    SIGNATURE_PLACEHOLDER = "ASSINATURA_DIGITAL_EM_ARQUIVO_P7S";
    COLLECTOR_BROWSER = "02";
    PTRP_NAME = "GondUp";
    onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
    sha256 = (text4) => createHash("sha256").update(text4, "utf8").digest("hex");
    num = (v) => v == null || Number.isNaN(Number(v)) ? "" : Number(v).toFixed(6);
  }
});

// server/ponto/ledger.ts
import { sql as sql3, inArray as inArray3, and as and5, eq as eq5 } from "drizzle-orm";
async function ensurePunchLedger() {
  if (ready) return ready;
  ready = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    for (const alter of ALTERS) await database2.execute(sql3.raw(`ALTER TABLE time_events ${alter}`));
    await database2.execute(sql3.raw("CREATE UNIQUE INDEX IF NOT EXISTS time_events_company_nsr_unique ON time_events (companyId, nsr)"));
    await database2.execute(sql3.raw("CREATE INDEX IF NOT EXISTS time_events_replaces_idx ON time_events (companyId, replacesEventId)"));
    await database2.execute(sql3.raw(`CREATE TABLE IF NOT EXISTS rep_ledger_state (
      companyId INT NOT NULL PRIMARY KEY,
      lastNsr BIGINT NOT NULL DEFAULT 0,
      lastHash VARCHAR(64) NULL,
      lastTreatmentHash VARCHAR(64) NULL,
      initializedAt TIMESTAMP NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`));
    await database2.execute(sql3.raw(`CREATE TABLE IF NOT EXISTS timesheet_acceptances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      month CHAR(7) NOT NULL,
      decision VARCHAR(16) NOT NULL DEFAULT 'accepted',
      documentHash CHAR(64) NOT NULL,
      summary TEXT NULL,
      comment TEXT NULL,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY timesheet_acceptances_member_idx (companyId, memberAccountId, month),
      KEY timesheet_acceptances_month_idx (companyId, month)
    )`));
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
}
async function loadWorkerCpf(companyId, memberId) {
  try {
    const raw = await getSetting(`labor_profile:${memberId}`, companyId, "");
    if (!raw) return null;
    const cpf = onlyDigits(JSON.parse(raw)?.cpf);
    return cpf.length === 11 ? cpf : null;
  } catch {
    return null;
  }
}
async function lockState(tx, companyId) {
  await tx.execute(sql3`INSERT IGNORE INTO rep_ledger_state (companyId, lastNsr) VALUES (${companyId}, 0)`);
  const [rows4] = await tx.execute(sql3`SELECT lastNsr, lastHash, lastTreatmentHash, initializedAt FROM rep_ledger_state WHERE companyId = ${companyId} FOR UPDATE`);
  const row2 = rows4?.[0] ?? {};
  let state = { lastNsr: Number(row2.lastNsr ?? 0), lastHash: row2.lastHash ?? null, lastTreatmentHash: row2.lastTreatmentHash ?? null };
  if (!row2.initializedAt) {
    state = await sealLegacy(tx, companyId, state);
    await tx.execute(sql3`UPDATE rep_ledger_state SET lastNsr = ${state.lastNsr}, lastHash = ${state.lastHash}, lastTreatmentHash = ${state.lastTreatmentHash}, initializedAt = UTC_TIMESTAMP() WHERE companyId = ${companyId}`);
  }
  return state;
}
async function sealLegacy(tx, companyId, state) {
  const [rows4] = await tx.execute(sql3`SELECT id, memberAccountId, eventType, serverTime, deviceTime, latitude, longitude, accuracy, notes FROM time_events WHERE companyId = ${companyId} AND recordHash IS NULL ORDER BY id`);
  if (!rows4?.length) return state;
  const cpfCache = /* @__PURE__ */ new Map();
  let { lastNsr, lastHash, lastTreatmentHash } = state;
  for (const r of rows4) {
    const memberId = Number(r.memberAccountId);
    if (!cpfCache.has(memberId)) cpfCache.set(memberId, await loadWorkerCpf(companyId, memberId));
    const cpf = cpfCache.get(memberId) ?? null;
    const recordedAt = new Date(r.serverTime);
    const markedAt = new Date(r.deviceTime || r.serverTime);
    const offline = /\[MARCACAO-OFFLINE\]/.test(String(r.notes || ""));
    if (LEGACY_INCLUSION.test(String(r.notes || ""))) {
      const reason = String(r.notes || "").slice(0, 2e3);
      const hash2 = treatmentHash({ id: Number(r.id), kind: "inclusion", replacesEventId: null, memberAccountId: memberId, eventType: r.eventType, markedAt, recordedAt, reason, decidedBy: "", correctionRequestId: null }, lastTreatmentHash);
      await tx.execute(sql3`UPDATE time_events SET origin = 'inclusion', reason = ${reason}, recordHash = ${hash2}, prevHash = ${lastTreatmentHash}, timeZone = ${DEFAULT_TZ}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
      lastTreatmentHash = hash2;
      continue;
    }
    const nsr = lastNsr + 1;
    const p = { nsr, markedAt, recordedAt, cpf, timeZone: DEFAULT_TZ, collector: COLLECTOR_BROWSER, offline };
    const hash = punchHash(p, lastHash);
    const content = punchContentHash({ nsr, memberAccountId: memberId, eventType: r.eventType, markedAt, recordedAt, clientTime: null, latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy, timeZone: DEFAULT_TZ, cpf, offline });
    await tx.execute(sql3`UPDATE time_events SET nsr = ${nsr}, recordHash = ${hash}, prevHash = ${lastHash}, contentHash = ${content}, timeZone = ${DEFAULT_TZ}, collectorId = ${COLLECTOR_BROWSER}, offline = ${offline ? 1 : 0}, workerCpf = ${cpf}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
    lastNsr = nsr;
    lastHash = hash;
  }
  return { lastNsr, lastHash, lastTreatmentHash };
}
async function appendOriginalPunch(input) {
  await ensurePunchLedger();
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  const cpf = await loadWorkerCpf(input.companyId, input.memberAccountId);
  return database2.transaction(async (tx) => {
    const state = await lockState(tx, input.companyId);
    const nsr = state.lastNsr + 1;
    const recordedAt = truncSec(/* @__PURE__ */ new Date());
    const deviceTime = input.deviceTimeToStore ? truncSec(input.deviceTimeToStore) : null;
    const markedAt = deviceTime ?? recordedAt;
    const clientTime = input.clientTime ? truncSec(input.clientTime) : null;
    const tz = validTimeZone(input.timeZone);
    const hash = punchHash({ nsr, markedAt, recordedAt, cpf, timeZone: tz, collector: COLLECTOR_BROWSER, offline: input.offline }, state.lastHash);
    const content = punchContentHash({ nsr, memberAccountId: input.memberAccountId, eventType: input.eventType, markedAt, recordedAt, clientTime, latitude: input.latitude, longitude: input.longitude, accuracy: input.accuracy, timeZone: tz, cpf, offline: input.offline });
    const result = await tx.insert(timeEvents).values({
      companyId: input.companyId,
      memberAccountId: input.memberAccountId,
      eventType: input.eventType,
      serverTime: recordedAt,
      deviceTime,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      locationStatus: input.locationStatus,
      locationError: input.locationError ?? null,
      deviceInfo: input.deviceInfo ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      notes: input.notes ?? null,
      synced: true,
      nsr,
      recordHash: hash,
      prevHash: state.lastHash,
      contentHash: content,
      timeZone: tz,
      collectorId: COLLECTOR_BROWSER,
      offline: input.offline,
      clientTime,
      workerCpf: cpf,
      origin: "original"
    });
    await tx.execute(sql3`UPDATE rep_ledger_state SET lastNsr = ${nsr}, lastHash = ${hash} WHERE companyId = ${input.companyId}`);
    return Number(result?.[0]?.insertId);
  });
}
async function appendTreatment(tx, input) {
  const state = await lockState(tx, input.companyId);
  const recordedAt = truncSec(/* @__PURE__ */ new Date());
  const markedAt = truncSec(input.markedAt);
  const reason = input.reason.slice(0, 2e3);
  const hash = treatmentHash({ id: null, kind: input.kind, replacesEventId: input.replacesEventId, memberAccountId: input.memberAccountId, eventType: input.eventType, markedAt, recordedAt, reason, decidedBy: input.decidedByName, correctionRequestId: input.correctionRequestId }, state.lastTreatmentHash);
  const result = await tx.insert(timeEvents).values({
    companyId: input.companyId,
    memberAccountId: input.memberAccountId,
    eventType: input.eventType,
    serverTime: recordedAt,
    deviceTime: markedAt,
    notes: input.notes ?? null,
    synced: true,
    locationStatus: "unavailable",
    origin: input.kind,
    replacesEventId: input.replacesEventId,
    correctionRequestId: input.correctionRequestId,
    recordedByMemberId: input.decidedByMemberId,
    recordedByName: input.decidedByName,
    reason,
    recordHash: hash,
    prevHash: state.lastTreatmentHash,
    timeZone: validTimeZone(input.timeZone || DEFAULT_TZ)
  });
  await tx.execute(sql3`UPDATE rep_ledger_state SET lastTreatmentHash = ${hash} WHERE companyId = ${input.companyId}`);
  return Number(result?.[0]?.insertId);
}
function validTimeZone(tz) {
  const value = String(tz || "").trim();
  if (!value) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value.slice(0, 64);
  } catch {
    return DEFAULT_TZ;
  }
}
async function supersededIds(companyId, ids) {
  const out = /* @__PURE__ */ new Set();
  if (!ids.length) return out;
  await ensurePunchLedger();
  const database2 = await getDb();
  if (!database2) return out;
  for (let i = 0; i < ids.length; i += 1e3) {
    const chunk = ids.slice(i, i + 1e3);
    const rows4 = await database2.select({ id: timeEvents.replacesEventId }).from(timeEvents).where(and5(eq5(timeEvents.companyId, companyId), inArray3(timeEvents.replacesEventId, chunk)));
    for (const r of rows4) if (r.id != null) out.add(Number(r.id));
  }
  return out;
}
async function ensureDisregardsTable() {
  if (disregardsReady) return disregardsReady;
  disregardsReady = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql3.raw(`CREATE TABLE IF NOT EXISTS time_event_disregards (
      id INT AUTO_INCREMENT NOT NULL,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      timeEventId INT NOT NULL,
      reason TEXT NOT NULL,
      decidedByMemberId INT NULL,
      decidedByName VARCHAR(255) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      revertedAt TIMESTAMP NULL,
      revertedByMemberId INT NULL,
      revertedByName VARCHAR(255) NULL,
      revertReason TEXT NULL,
      PRIMARY KEY (id),
      KEY time_event_disregards_event_idx (companyId, timeEventId),
      KEY time_event_disregards_member_idx (companyId, memberAccountId)
    )`));
  })().catch((e) => {
    disregardsReady = null;
    throw e;
  });
  return disregardsReady;
}
async function activeDisregards(companyId, ids) {
  const out = /* @__PURE__ */ new Map();
  if (!ids.length) return out;
  try {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return out;
    await ensureDisregardsTable();
    for (let i = 0; i < ids.length; i += 1e3) {
      const chunk = ids.slice(i, i + 1e3);
      const res = await database2.execute(sql3`SELECT id, timeEventId, reason, decidedByName, createdAt FROM time_event_disregards WHERE companyId = ${companyId} AND revertedAt IS NULL AND timeEventId IN (${sql3.join(chunk.map((id3) => sql3`${id3}`), sql3`, `)}) ORDER BY id`);
      const rows4 = Array.isArray(res?.[0]) ? res[0] : [];
      for (const r of rows4) out.set(Number(r.timeEventId), { id: Number(r.id), reason: String(r.reason || ""), decidedByName: r.decidedByName ?? null, createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : "" });
    }
  } catch (error) {
    console.warn("[ponto] desconsidera\xE7\xF5es indispon\xEDveis", error);
  }
  return out;
}
async function effectiveRows(rows4, opts) {
  if (!rows4.length) return rows4;
  const companyId = rows4[0].companyId;
  const gone = await supersededIds(companyId, rows4.map((r) => r.id));
  const kept = gone.size ? rows4.filter((r) => !gone.has(r.id)) : rows4;
  const dis = await activeDisregards(companyId, kept.map((r) => r.id));
  if (opts?.keepDisregarded) return kept.map((r) => ({ ...r, disregard: dis.get(r.id) ?? null }));
  return dis.size ? kept.filter((r) => !dis.has(r.id)) : kept;
}
function toLedgerRow(r) {
  return {
    id: Number(r.id),
    origin: String(r.origin || "original"),
    nsr: r.nsr == null ? null : Number(r.nsr),
    recordHash: r.recordHash ?? null,
    prevHash: r.prevHash ?? null,
    memberAccountId: Number(r.memberAccountId),
    eventType: String(r.eventType),
    markedAt: new Date(r.deviceTime || r.serverTime),
    recordedAt: new Date(r.serverTime),
    cpf: r.workerCpf ?? null,
    timeZone: r.timeZone ?? null,
    collectorId: r.collectorId ?? null,
    offline: Boolean(Number(r.offline ?? 0)),
    replacesEventId: r.replacesEventId == null ? null : Number(r.replacesEventId),
    correctionRequestId: r.correctionRequestId == null ? null : Number(r.correctionRequestId),
    recordedByName: r.recordedByName ?? null,
    reason: r.reason ?? null,
    contentHash: r.contentHash ?? null,
    clientTime: r.clientTime ? new Date(r.clientTime) : null,
    latitude: r.latitude == null ? null : Number(r.latitude),
    longitude: r.longitude == null ? null : Number(r.longitude),
    accuracy: r.accuracy == null ? null : Number(r.accuracy)
  };
}
var DEFAULT_TZ, NEW_SHIFT_MARKER, truncSec, ready, ALTERS, LEGACY_INCLUSION, disregardsReady;
var init_ledger = __esm({
  "server/ponto/ledger.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_repFormat();
    DEFAULT_TZ = "America/Sao_Paulo";
    NEW_SHIFT_MARKER = "[NOVA-JORNADA-MESMO-DIA]";
    truncSec = (d) => new Date(Math.floor(d.getTime() / 1e3) * 1e3);
    ready = null;
    ALTERS = [
      "ADD COLUMN IF NOT EXISTS nsr BIGINT NULL",
      "ADD COLUMN IF NOT EXISTS recordHash VARCHAR(64) NULL",
      "ADD COLUMN IF NOT EXISTS prevHash VARCHAR(64) NULL",
      "ADD COLUMN IF NOT EXISTS contentHash VARCHAR(64) NULL",
      "ADD COLUMN IF NOT EXISTS timeZone VARCHAR(64) NULL",
      "ADD COLUMN IF NOT EXISTS collectorId VARCHAR(8) NULL",
      "ADD COLUMN IF NOT EXISTS offline TINYINT(1) NOT NULL DEFAULT 0",
      "ADD COLUMN IF NOT EXISTS clientTime TIMESTAMP NULL",
      "ADD COLUMN IF NOT EXISTS workerCpf VARCHAR(14) NULL",
      "ADD COLUMN IF NOT EXISTS origin VARCHAR(16) NOT NULL DEFAULT 'original'",
      "ADD COLUMN IF NOT EXISTS replacesEventId INT NULL",
      "ADD COLUMN IF NOT EXISTS correctionRequestId INT NULL",
      "ADD COLUMN IF NOT EXISTS recordedByMemberId INT NULL",
      "ADD COLUMN IF NOT EXISTS recordedByName VARCHAR(255) NULL",
      "ADD COLUMN IF NOT EXISTS reason TEXT NULL",
      "ADD COLUMN IF NOT EXISTS sealedLegacy TINYINT(1) NOT NULL DEFAULT 0"
    ];
    LEGACY_INCLUSION = /^Batida incluída via solicitação aprovada/;
    disregardsReady = null;
  }
});

// shared/inclusionSupersede.ts
function timeMs(value) {
  if (typeof value === "number") return value;
  const t2 = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t2) ? 0 : t2;
}
function isTreatment(origin) {
  return origin === "inclusion" || origin === "adjustment";
}
function idsSupersededByInclusion(events) {
  const active = events.filter((e) => !e.alreadyOut);
  const byType = /* @__PURE__ */ new Map();
  for (const e of active) {
    const list = byType.get(e.type) || [];
    list.push(e);
    byType.set(e.type, list);
  }
  const gone = /* @__PURE__ */ new Set();
  for (const list of byType.values()) {
    const treatments = list.filter((e) => isTreatment(e.origin));
    const originals = list.filter((e) => !isTreatment(e.origin));
    if (!treatments.length || !originals.length) continue;
    const unused = [...originals];
    for (const treatment of treatments) {
      if (!unused.length) break;
      const t2 = timeMs(treatment.time);
      let best = 0;
      let bestDist = Math.abs(timeMs(unused[0].time) - t2);
      for (let i = 1; i < unused.length; i++) {
        const d = Math.abs(timeMs(unused[i].time) - t2);
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      }
      gone.add(unused[best].id);
      unused.splice(best, 1);
    }
  }
  return [...gone];
}
function idsSupersededByInclusionGrouped(events, timeZone = "America/Sao_Paulo") {
  const groups = /* @__PURE__ */ new Map();
  for (const e of events) {
    const day = todayInZone(new Date(timeMs(e.time)), timeZone);
    const key = `${e.memberId ?? 0}:${day}`;
    const list = groups.get(key) || [];
    list.push(e);
    groups.set(key, list);
  }
  const gone = /* @__PURE__ */ new Set();
  for (const list of groups.values()) {
    for (const id3 of idsSupersededByInclusion(list)) gone.add(id3);
  }
  return [...gone];
}
function inclusionBlockedMessage(dayEvents, type, time) {
  const t2 = timeMs(time);
  const lastOutBefore = dayEvents.filter((e) => e.type === "clock_out" && timeMs(e.time) < t2).sort((a, b) => timeMs(b.time) - timeMs(a.time))[0];
  const shiftStart = lastOutBefore ? timeMs(lastOutBefore.time) : -Infinity;
  const nextInAfterOut = lastOutBefore ? dayEvents.filter((e) => e.type === "clock_in" && timeMs(e.time) > shiftStart).sort((a, b) => timeMs(a.time) - timeMs(b.time))[0] : null;
  const shiftEnd = nextInAfterOut && timeMs(nextInAfterOut.time) > t2 ? timeMs(nextInAfterOut.time) : Infinity;
  const shiftEvents = dayEvents.filter((e) => {
    const ms2 = timeMs(e.time);
    if (type === "clock_in" && lastOutBefore && ms2 <= shiftStart) return false;
    if (type === "clock_in") return ms2 > shiftStart && ms2 < (shiftEnd === Infinity ? Infinity : shiftEnd);
    return ms2 > shiftStart && (shiftEnd === Infinity || ms2 < shiftEnd);
  });
  if (shiftEvents.some((e) => e.type === type)) {
    const label = PUNCH_LABEL[type] || type;
    return `J\xE1 existe um registro de ${label} neste dia. Para mudar o hor\xE1rio, use \u201CCorrigir hor\xE1rio desta batida\u201D em vez de incluir outra.`;
  }
  return null;
}
var INCLUSION_SUPERSEDE_REASON, PUNCH_LABEL;
var init_inclusionSupersede = __esm({
  "shared/inclusionSupersede.ts"() {
    "use strict";
    init_expiry();
    INCLUSION_SUPERSEDE_REASON = "Substitu\xEDda pela corre\xE7\xE3o aprovada.";
    PUNCH_LABEL = {
      clock_in: "Entrada",
      break_start: "In\xEDcio do intervalo",
      break_end: "Fim do intervalo",
      clock_out: "Sa\xEDda"
    };
  }
});

// server/modules/mirrorData.ts
import { and as and6, eq as eq6, gte as gte3, inArray as inArray4, lt, sql as sql4 } from "drizzle-orm";
function withInclusionSupersede(rows4) {
  if (!rows4.length) return rows4;
  const gone = new Set(idsSupersededByInclusionGrouped(rows4.map((r) => ({
    id: r.id,
    type: String(r.eventType || r.type || ""),
    time: r.deviceTime || r.serverTime || 0,
    origin: r.origin,
    alreadyOut: Boolean(r.disregard),
    memberId: r.memberAccountId
  }))));
  if (!gone.size) return rows4;
  return rows4.map((r) => {
    if (!gone.has(r.id) || r.disregard) return r;
    const virtual = { id: 0, reason: INCLUSION_SUPERSEDE_REASON, decidedByName: null, createdAt: "" };
    return { ...r, disregard: virtual };
  });
}
function mirrorWindow(from, to) {
  return {
    start: new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 36e5),
    end: new Date(Date.parse(`${to}T00:00:00Z`) + 60 * 36e5)
  };
}
async function loadMirrorEventRows(companyId, memberIds, from, to) {
  if (!memberIds.length) return [];
  const database2 = await getDb();
  if (!database2) return [];
  const { start, end } = mirrorWindow(from, to);
  await ensurePunchLedger();
  const rows4 = await effectiveRows(await database2.select().from(timeEvents).where(and6(eq6(timeEvents.companyId, companyId), inArray4(timeEvents.memberAccountId, memberIds), gte3(effectiveEventTime, start), lt(effectiveEventTime, end))).orderBy(effectiveEventTime), { keepDisregarded: true });
  return withInclusionSupersede(rows4);
}
async function loadMemberVacations(companyId, memberIds, from, to) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  try {
    const { ensureVacationSchedulesTable: ensureVacationSchedulesTable2 } = await Promise.resolve().then(() => (init_vacations(), vacations_exports));
    await ensureVacationSchedulesTable2();
    const database2 = await getDb();
    if (!database2) return map;
    const rows4 = await database2.select({ memberAccountId: vacationSchedules.memberAccountId, startDate: vacationSchedules.startDate, endDate: vacationSchedules.endDate }).from(vacationSchedules).where(and6(eq6(vacationSchedules.companyId, companyId), eq6(vacationSchedules.status, "scheduled"), inArray4(vacationSchedules.memberAccountId, memberIds)));
    for (const r of rows4) {
      const startDate = dateOnly(r.startDate), endDate = dateOnly(r.endDate);
      if (!startDate || !endDate || endDate < from || startDate > to) continue;
      map.set(r.memberAccountId, [...map.get(r.memberAccountId) || [], { startDate, endDate }]);
    }
  } catch (error) {
    console.warn("[mirror] n\xE3o foi poss\xEDvel carregar f\xE9rias", error);
  }
  return map;
}
function dateOnly(value) {
  if (!value) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
async function loadMirrorOptions(companyId) {
  const raw = await getSetting(OPTIONAL_HOLIDAYS_SETTING, companyId, "");
  return { optionalHolidaysAsHoliday: raw === "1" || raw === "true" };
}
async function loadAdjustmentsByEvent(companyId, memberIds) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  const database2 = await getDb();
  if (!database2) return map;
  try {
    const { ensureAdjustmentsTable: ensureAdjustmentsTable2 } = await Promise.resolve().then(() => (init_timesheetMirror2(), timesheetMirror_exports));
    await ensureAdjustmentsTable2();
    const rows4 = (await database2.execute(sql4`SELECT timeEventId, originalType, originalTime, justification, reviewedByName, createdAt FROM time_event_adjustments WHERE companyId = ${companyId} AND memberAccountId IN (${sql4.join(memberIds.map((id3) => sql4`${id3}`), sql4`, `)}) ORDER BY id`))[0];
    for (const a of rows4) if (!map.has(Number(a.timeEventId))) map.set(Number(a.timeEventId), a);
  } catch (error) {
    console.warn("[mirror] ajustes indispon\xEDveis", error);
  }
  return map;
}
function cleanReason(reason) {
  return String(reason || "").replace(/^Batida incluída via solicitação aprovada em \S+?\.?\s*Motivo:\s*/i, "").trim();
}
function toMirrorEvents(rows4, adjByEvent) {
  return rows4.map((r) => {
    const a = adjByEvent.get(r.id);
    const notes = r.notes || "";
    const inclusion = r.origin === "inclusion";
    return {
      id: r.id,
      type: r.eventType,
      time: (r.deviceTime || r.serverTime).toISOString(),
      receivedAt: r.serverTime.toISOString(),
      synced: r.synced,
      notes,
      automatic: /automática/i.test(notes) && /^auto-clock-out:/.test(r.idempotencyKey || ""),
      adjustment: a ? { originalType: a.originalType, originalTime: new Date(a.originalTime).toISOString(), justification: a.justification, reviewedBy: a.reviewedByName, reviewedAt: a.createdAt ? new Date(a.createdAt).toISOString() : null } : inclusion || r.origin === "adjustment" ? { originalType: inclusion ? "missing" : r.eventType, originalTime: (r.deviceTime || r.serverTime).toISOString(), justification: cleanReason(r.reason), reviewedBy: r.recordedByName, reviewedAt: r.serverTime.toISOString() } : null,
      legacyAdjustment: !a && r.origin === "original" && /Ajuste aprovado em/.test(notes),
      timeAlert: readTimeAlert(notes),
      offline: Boolean(r.offline),
      clockAlert: readClockAlert(notes),
      disregarded: r.disregard ? { reason: r.disregard.reason, by: r.disregard.decidedByName, at: r.disregard.createdAt } : null
    };
  });
}
var effectiveEventTime, OPTIONAL_HOLIDAYS_SETTING;
var init_mirrorData = __esm({
  "server/modules/mirrorData.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_punchTime();
    init_offlineClock();
    init_ledger();
    init_inclusionSupersede();
    effectiveEventTime = sql4`COALESCE(${timeEvents.deviceTime}, ${timeEvents.serverTime})`;
    OPTIONAL_HOLIDAYS_SETTING = "mirror_optional_holidays_as_holiday";
  }
});

// shared/holidays.ts
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = (h + l - 7 * m + 114) % 31 + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function addDays2(d, days) {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function getBrazilianHoliday(dateStr7) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr7)) return null;
  const [y] = dateStr7.split("-").map(Number);
  if (y < 2020 || y > 2035) return null;
  const fixed = FIXED.find((f) => dateStr7.endsWith(f.md) && (!f.fromYear || y >= f.fromYear));
  if (fixed) return { date: dateStr7, name: fixed.name };
  const easter = easterSunday(y);
  const carnival = addDays2(easter, -47);
  const goodFriday = addDays2(easter, -2);
  const corpusChristi = addDays2(easter, 60);
  const movable = [
    { date: ymd(carnival), name: "Carnaval", optional: true },
    { date: ymd(addDays2(carnival, -1)), name: "Carnaval (segunda)", optional: true },
    { date: ymd(goodFriday), name: "Sexta-feira Santa" },
    { date: ymd(corpusChristi), name: "Corpus Christi", optional: true }
  ];
  return movable.find((h) => h.date === dateStr7) ?? null;
}
var FIXED;
var init_holidays = __esm({
  "shared/holidays.ts"() {
    "use strict";
    FIXED = [
      { md: "01-01", name: "Confraterniza\xE7\xE3o Universal" },
      { md: "04-21", name: "Tiradentes" },
      { md: "05-01", name: "Dia do Trabalho" },
      { md: "09-07", name: "Independ\xEAncia do Brasil" },
      { md: "10-12", name: "Nossa Senhora Aparecida" },
      { md: "11-02", name: "Finados" },
      { md: "11-15", name: "Proclama\xE7\xE3o da Rep\xFAblica" },
      { md: "11-20", name: "Dia Nacional de Zumbi e da Consci\xEAncia Negra", fromYear: 2024 },
      // Lei 14.759/2023 (feriado nacional a partir de 2024)
      { md: "12-25", name: "Natal" }
    ];
  }
});

// shared/correctionExcuse.ts
function isFullDayExcuseType(value) {
  return value === "holiday" || value === "day_off" || value === "medical_certificate";
}
function inferFullDayExcuseType(row2) {
  if (isFullDayExcuseType(row2.justificationType)) return row2.justificationType;
  const text4 = String(row2.justification || "").toLowerCase();
  if (/\batestado\b/.test(text4)) return "medical_certificate";
  if (/\bferiado\b/.test(text4)) return "holiday";
  if (/\bfolga\b/.test(text4)) return "day_off";
  return null;
}
function looksLikeFullDayExcuse(row2) {
  if (isFullDayExcuseType(row2.justificationType)) return true;
  return !row2.timeEventId && inferFullDayExcuseType(row2) != null;
}
function fullDayExcuseLabel(value) {
  return isFullDayExcuseType(value) ? FULL_DAY_EXCUSE_LABELS[value] : "Abono";
}
function excuseDay(isoOrDate, timeZone = "America/Sao_Paulo") {
  const date3 = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date3);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date3.toISOString().slice(0, 10);
  }
}
function noonInSaoPaulo(date3) {
  return /* @__PURE__ */ new Date(`${date3}T12:00:00-03:00`);
}
var FULL_DAY_EXCUSE_LABELS;
var init_correctionExcuse = __esm({
  "shared/correctionExcuse.ts"() {
    "use strict";
    FULL_DAY_EXCUSE_LABELS = {
      holiday: "Feriado",
      day_off: "Folga",
      medical_certificate: "Atestado m\xE9dico"
    };
  }
});

// shared/timesheetMirror.ts
function localParts2(iso, timeZone) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}:${v.second}`, hm: `${v.hour}:${v.minute}`, minutesOfDay: Number(v.hour) * 60 + Number(v.minute) };
}
function nightOverlap(aMs, bMs, tz, start, end) {
  let n = 0;
  for (let t2 = Math.ceil(aMs / 6e4) * 6e4; t2 < bMs; t2 += 6e4) {
    const m = localParts2(new Date(t2).toISOString(), tz).minutesOfDay;
    if (start > end ? m >= start || m < end : m >= start && m < end) n++;
  }
  return n;
}
function situationLabel(s) {
  return SITUATION_LABELS[s] || "";
}
function todayInTimeZone(timeZone, now = /* @__PURE__ */ new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
function hmToMinutes(hm2) {
  const [h, m] = hm2.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function applyDailyTolerance(input) {
  const raw = Math.round(input.workedMinutes - input.expectedMinutes);
  if (raw === 0) return { diffMinutes: 0, toleranceMinutes: 0 };
  let ignore = 0;
  const schedule = input.schedule;
  if (schedule && schedule.length && input.firstInHm && input.lastOutHm) {
    const contractStart = hmToMinutes(schedule[0][0]);
    const contractEnd = hmToMinutes(schedule[schedule.length - 1][1]);
    const firstIn = hmToMinutes(input.firstInHm);
    const lastOut = hmToMinutes(input.lastOutHm);
    const inVar = Math.abs(firstIn - contractStart);
    const outVar = Math.abs(lastOut - contractEnd);
    const inTol = inVar <= 5 ? inVar : 0;
    const outTol = outVar <= 5 ? outVar : 0;
    ignore = inTol + outTol;
    if (ignore > 10) return { diffMinutes: raw, toleranceMinutes: 0 };
  } else if (Math.abs(raw) <= 10) {
    ignore = Math.abs(raw);
  } else {
    return { diffMinutes: raw, toleranceMinutes: 0 };
  }
  if (ignore <= 0) return { diffMinutes: raw, toleranceMinutes: 0 };
  if (raw > 0) {
    const diff2 = Math.max(0, raw - ignore);
    return { diffMinutes: diff2, toleranceMinutes: raw - diff2 };
  }
  const diff = Math.min(0, raw + ignore);
  return { diffMinutes: diff, toleranceMinutes: -raw + diff };
}
function buildMirror(input) {
  const tz = input.timeZone || "America/Sao_Paulo";
  const labor = input.labor || null;
  const sorted = [...input.events].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
  const events = sorted.filter((e) => !e.disregarded);
  const disregardedByDate = /* @__PURE__ */ new Map();
  for (const e of sorted) {
    if (!e.disregarded) continue;
    const date3 = localParts2(e.time, tz).date;
    disregardedByDate.set(date3, [...disregardedByDate.get(date3) || [], { type: e.type, label: MARK_LABEL[e.type], time: e.time, reason: e.disregarded.reason, by: e.disregarded.by ?? null }]);
  }
  const notes = [];
  const shifts = [];
  let cur = null;
  for (const ev of events) {
    const date3 = localParts2(ev.time, tz).date;
    const lastT = cur ? new Date(cur.events[cur.events.length - 1].time).getTime() : 0;
    const stale = cur && new Date(ev.time).getTime() - lastT > 20 * 36e5;
    if (ev.type === "clock_in" || !cur || stale) {
      cur = { date: date3, events: [] };
      shifts.push(cur);
    }
    cur.events.push(ev);
    if (ev.type === "clock_out") cur = null;
  }
  const byDate = /* @__PURE__ */ new Map();
  const coveredByOvernight = /* @__PURE__ */ new Set();
  for (const s of shifts) {
    if (s.date >= input.from && s.date <= input.to) byDate.set(s.date, [...byDate.get(s.date) || [], s]);
    for (const ev of s.events) {
      const evDate = localParts2(ev.time, tz).date;
      if (evDate !== s.date) coveredByOvernight.add(evDate);
    }
  }
  const workdays = labor?.workdays && labor.workdays.length ? new Set(labor.workdays) : null;
  const daily = labor?.dailyMinutes && labor.dailyMinutes > 0 ? labor.dailyMinutes : null;
  const night = labor?.nightEnabled && labor.nightStart && labor.nightEnd ? { s: toMin(labor.nightStart), e: toMin(labor.nightEnd) } : null;
  const excusesByDate = /* @__PURE__ */ new Map();
  for (const item of input.excuses || []) {
    if (item.date >= input.from && item.date <= input.to && isFullDayExcuseType(item.type) && !excusesByDate.has(item.date)) {
      excusesByDate.set(item.date, item);
    }
  }
  const admission = labor?.admissionDate ? String(labor.admissionDate).slice(0, 10) : null;
  const today = String(input.today || input.options?.today || todayInTimeZone(tz)).slice(0, 10);
  const treatmentsByDate = /* @__PURE__ */ new Map();
  for (const item of input.treatments || []) {
    if (item.date >= input.from && item.date <= input.to && (item.decision === "excuse" || item.decision === "time_bank") && !treatmentsByDate.has(item.date)) {
      treatmentsByDate.set(item.date, item);
    }
  }
  const days = [];
  for (let d = input.from; d <= input.to; d = addDay(d, 1)) {
    const rawHoliday = getBrazilianHoliday(d);
    const holiday = rawHoliday && (!rawHoliday.optional || input.options?.optionalHolidaysAsHoliday) ? rawHoliday : null;
    const optionalHoliday = rawHoliday && rawHoliday.optional && !holiday ? rawHoliday.name : null;
    const onVacation = (input.vacations || []).some((v) => d >= v.startDate && d <= v.endDate);
    const dayShifts = byDate.get(d) || [];
    const issues = [];
    const marks = [];
    let worked = 0, brk = 0, nightMin = 0;
    for (const sh of dayShifts) {
      let openIn = null, openBreak = null;
      for (const ev of sh.events) {
        const t2 = new Date(ev.time).getTime();
        const kind = ev.automatic ? "automatic" : ev.adjustment ? "adjusted" : ev.legacyAdjustment ? "legacy_adjusted" : "original";
        marks.push({
          type: ev.type,
          label: MARK_LABEL[ev.type],
          time: ev.time,
          receivedAt: ev.receivedAt,
          synced: ev.synced,
          kind,
          offline: Boolean(ev.offline || ev.timeAlert?.kind === "offline"),
          originalTime: ev.adjustment?.originalTime,
          originalLabel: ev.adjustment ? MARK_LABEL[ev.adjustment.originalType] : void 0,
          justification: ev.adjustment?.justification,
          reviewedBy: ev.adjustment?.reviewedBy,
          reviewedAt: ev.adjustment?.reviewedAt
        });
        if (ev.type === "clock_in") {
          if (openIn != null) issues.push("Entrada sem sa\xEDda anterior");
          openIn = t2;
        } else if (ev.type === "break_start") {
          if (openBreak != null) issues.push("Dois in\xEDcios de intervalo seguidos");
          else if (openIn == null) issues.push("In\xEDcio de intervalo sem entrada");
          else {
            worked += (t2 - openIn) / 6e4;
            if (night) nightMin += nightOverlap(openIn, t2, tz, night.s, night.e);
            openIn = null;
          }
          openBreak = t2;
        } else if (ev.type === "break_end") {
          if (openBreak == null) issues.push(openIn != null ? "Dois retornos de intervalo seguidos" : "Retorno de intervalo sem in\xEDcio");
          else {
            brk += (t2 - openBreak) / 6e4;
            openBreak = null;
          }
          openIn = t2;
        } else if (ev.type === "clock_out") {
          if (openIn == null) issues.push("Sa\xEDda sem entrada");
          else {
            worked += (t2 - openIn) / 6e4;
            if (night) nightMin += nightOverlap(openIn, t2, tz, night.s, night.e);
            openIn = null;
          }
        }
      }
      if (openBreak != null) issues.push("Jornada incompleta: falta o retorno do intervalo");
      else if (openIn != null) issues.push("Jornada incompleta: falta a sa\xEDda");
    }
    const timeAlerts = [];
    for (const sh of dayShifts) for (const ev of sh.events) {
      if (ev.timeAlert?.kind === "server_time_used") timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.timeAlert.text}`);
      else if (ev.timeAlert?.kind === "offline") timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.timeAlert.text}`);
    }
    for (const sh of dayShifts) for (const ev of sh.events) {
      if (ev.clockAlert) timeAlerts.push(`${MARK_LABEL[ev.type]}: ${ev.clockAlert}`);
      else if (ev.offline && ev.timeAlert?.kind !== "offline") timeAlerts.push(`${MARK_LABEL[ev.type]}: registrada offline; recebida pelo servidor em ${ev.receivedAt}`);
    }
    for (const t2 of timeAlerts) issues.push(`ALERTA de hor\xE1rio \u2014 ${t2}`);
    if (marks.some((m) => !m.synced)) issues.push("Marca\xE7\xE3o com sincroniza\xE7\xE3o pendente");
    if (marks.some((m) => m.kind === "automatic")) issues.push("Sa\xEDda autom\xE1tica do sistema (n\xE3o marcada pelo funcion\xE1rio)");
    if (marks.some((m) => m.kind === "legacy_adjusted")) issues.push("Ajuste antigo sem registro estruturado do valor original (ver observa\xE7\xF5es da marca\xE7\xE3o)");
    const uniqueIssues = [...new Set(issues)];
    issues.length = 0;
    issues.push(...uniqueIssues);
    const isWorkday = workdays ? workdays.has(weekdayOf(d)) : null;
    const hasMarks = marks.length > 0;
    const excuseRow = excusesByDate.get(d);
    const excuse = excuseRow && isFullDayExcuseType(excuseRow.type) ? { type: excuseRow.type, label: fullDayExcuseLabel(excuseRow.type), justification: excuseRow.justification || null } : null;
    const excused = Boolean(holiday || excuse || onVacation);
    const beforeAdmission = Boolean(admission && d < admission);
    const isFuture = d > today;
    const isToday = d === today;
    const treatment = treatmentsByDate.get(d) || void 0;
    const incomplete = issues.some((i) => i.startsWith("Jornada incompleta") || i.includes("sem entrada") || i.includes("sem sa\xEDda") || i.includes("sem in\xEDcio") || i.includes("seguidos"));
    if (holiday) {
      issues.push(`Feriado nacional: ${holiday.name} \u2014 abonado automaticamente`);
    }
    if (excuse) {
      const extra = excuse.justification ? ` \u2014 ${excuse.justification}` : "";
      issues.push(`${excuse.label} \u2014 dia abonado${extra}`);
    }
    if (onVacation) issues.push(hasMarks ? "F\xE9rias programadas \u2014 h\xE1 marca\xE7\xF5es neste dia (conferir)" : "F\xE9rias \u2014 dia abonado");
    if (optionalHoliday) issues.push(`Ponto facultativo: ${optionalHoliday} \u2014 n\xE3o abonado automaticamente (a empresa pode abonar pela corre\xE7\xE3o de ponto ou ativar esse abono na configura\xE7\xE3o)`);
    if (!hasMarks && weekdayOf(d) === 0 && !isWorkday && !holiday && !onVacation && !excuse) {
      issues.push("DSR (descanso semanal remunerado)");
    }
    const overnightCover = !hasMarks && coveredByOvernight.has(d);
    if (overnightCover) issues.push("Coberto pela jornada iniciada no dia anterior (n\xE3o \xE9 falta)");
    const willDebitAbsence = Boolean(
      !hasMarks && isWorkday && daily != null && !excused && !beforeAdmission && !isFuture && !isToday && !overnightCover && treatment?.decision !== "excuse"
    );
    if (!hasMarks && isWorkday && !excused && !beforeAdmission) {
      if (willDebitAbsence) {
        if (treatment?.decision === "time_bank") {
          issues.push("Falta lan\xE7ada no banco de horas (devendo), conforme decis\xE3o do administrador");
        } else {
          issues.push("Falta: horas do dia lan\xE7adas como d\xE9bito at\xE9 corre\xE7\xE3o, justificativa v\xE1lida ou decis\xE3o do administrador (abonar ou banco de horas)");
        }
      } else if (isToday) {
        issues.push("Dia de trabalho ainda em curso \u2014 a falta s\xF3 \xE9 lan\xE7ada depois que o dia termina");
      } else if (!isFuture) {
        issues.push("Sem marca\xE7\xF5es em dia previsto \u2014 verificar falta, abono ou justificativa (n\xE3o informados)");
      }
    }
    if (hasMarks && incomplete && !isToday && !isFuture && isWorkday && !excused) {
      issues.push("Pendente de corre\xE7\xE3o: o saldo deste dia \xE9 provis\xF3rio at\xE9 as marca\xE7\xF5es serem completadas ou justificadas");
    }
    let expected = daily != null && isWorkday && !excused && !beforeAdmission ? daily : null;
    let w = Math.round(worked);
    let diff = null;
    let overtime = null;
    let toleranceMinutes = 0;
    if (treatment?.decision === "excuse" && isWorkday && daily != null && !hasMarks && !beforeAdmission) {
      expected = daily;
      w = daily;
      diff = 0;
      overtime = 0;
      issues.push("Dia abonado pelo administrador: conta como trabalhado, saldo zero");
    } else if (willDebitAbsence) {
      expected = daily;
      w = 0;
      diff = -daily;
      overtime = 0;
    } else if (hasMarks && expected != null) {
      const firstIn = marks.find((m) => m.type === "clock_in");
      const lastOut = [...marks].reverse().find((m) => m.type === "clock_out");
      const adj = applyDailyTolerance({
        workedMinutes: w,
        expectedMinutes: expected,
        firstInHm: firstIn ? localParts2(firstIn.time, tz).hm : null,
        lastOutHm: lastOut ? localParts2(lastOut.time, tz).hm : null,
        schedule: labor?.schedule || null
      });
      diff = adj.diffMinutes;
      toleranceMinutes = adj.toleranceMinutes;
      overtime = Math.max(0, diff);
      if (toleranceMinutes > 0) issues.push(`Toler\xE2ncia legal aplicada: ${toleranceMinutes} min (CLT art. 58 \xA71\xBA)`);
    }
    let situation = "fora";
    if (beforeAdmission) situation = "fora";
    else if (onVacation) situation = "ferias";
    else if (holiday) situation = "feriado";
    else if (excuse?.type === "medical_certificate") situation = "atestado";
    else if (excuse?.type === "day_off") situation = "folga";
    else if (excuse?.type === "holiday") situation = "feriado";
    else if (excuse || treatment?.decision === "excuse") situation = "abonado";
    else if (willDebitAbsence) situation = "falta";
    else if (hasMarks && incomplete) situation = "pendente";
    else if (hasMarks) situation = "trabalho";
    else if (!hasMarks && weekdayOf(d) === 0 && !isWorkday && !holiday && !onVacation && !excuse) situation = "dsr";
    else if (optionalHoliday && !hasMarks) situation = "facultativo";
    days.push({
      date: d,
      weekday: weekdayOf(d),
      marks,
      workedMinutes: w,
      breakMinutes: Math.round(brk),
      expectedMinutes: expected,
      diffMinutes: diff,
      overtimeMinutes: overtime,
      nightMinutes: night && hasMarks ? nightMin : null,
      issues,
      situation,
      toleranceMinutes: toleranceMinutes || void 0,
      treatment,
      holiday: holiday?.name ?? null,
      excuse,
      optionalHoliday,
      vacation: onVacation,
      timeAlerts,
      ...disregardedByDate.has(d) ? { disregarded: disregardedByDate.get(d) } : {}
    });
  }
  const marked = days.filter((x) => x.marks.length);
  const sumMarked = (f) => marked.reduce((a, x) => a + (f(x) || 0), 0);
  const sumAll = (f) => days.reduce((a, x) => a + (f(x) || 0), 0);
  const configured = daily != null && workdays != null;
  const totals = {
    daysWithMarks: marked.length,
    workedMinutes: sumAll((x) => x.workedMinutes),
    breakMinutes: sumMarked((x) => x.breakMinutes),
    expectedMinutes: configured ? days.reduce((a, x) => a + (x.expectedMinutes || 0), 0) : null,
    balanceMinutes: configured ? sumAll((x) => x.diffMinutes) : null,
    overtimeMinutes: configured ? sumAll((x) => x.overtimeMinutes) : null,
    deficitMinutes: configured ? days.reduce((a, x) => a + Math.max(0, -(x.diffMinutes || 0)), 0) : null,
    nightMinutes: night ? sumMarked((x) => x.nightMinutes) : null,
    nightReducedMinutes: night ? Math.round(sumMarked((x) => x.nightMinutes) * 60 / 52.5) : null,
    incompleteDays: marked.filter((x) => x.issues.some((i) => i.startsWith("Jornada incompleta") || i.includes("sem entrada") || i.includes("sem sa\xEDda") || i.includes("sem in\xEDcio") || i.includes("seguidos"))).length,
    adjustedMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "adjusted" || m.kind === "legacy_adjusted").length, 0),
    automaticMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "automatic").length, 0),
    offlineMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.offline).length, 0),
    disregardedMarks: days.reduce((a, x) => a + (x.disregarded?.length || 0), 0),
    pendingSyncMarks: marked.reduce((a, x) => a + x.marks.filter((m) => !m.synced).length, 0),
    daysWithoutMarksOnWorkday: workdays ? days.filter((x) => !x.marks.length && workdays.has(x.weekday) && !x.holiday && !x.excuse && !x.vacation && x.situation !== "abonado" && x.date <= today && (!admission || x.date >= admission) && !x.issues.some((i) => i.startsWith("Coberto pela jornada"))).length : null
  };
  if (!daily) notes.push("Jornada contratada n\xE3o configurada para este funcion\xE1rio: horas previstas, diferen\xE7as e horas extras n\xE3o foram calculadas.");
  if (!workdays) notes.push("Dias de trabalho da semana n\xE3o configurados: faltas e dias previstos n\xE3o foram apurados.");
  if (!night) notes.push("Adicional noturno e hora reduzida n\xE3o configurados: n\xE3o calculados.");
  notes.push("Feriados nacionais (inclui 20/11 a partir de 2024) s\xE3o identificados e abonados automaticamente (falta de batida n\xE3o gera d\xE9ficit). O ponto continua liberado nesses dias.");
  notes.push(input.options?.optionalHolidaysAsHoliday ? "Carnaval e Corpus Christi (ponto facultativo) est\xE3o sendo tratados como feriado, conforme a configura\xE7\xE3o da empresa." : "Carnaval e Corpus Christi s\xE3o ponto facultativo e N\xC3O s\xE3o abonados automaticamente; a empresa pode ativar esse abono na configura\xE7\xE3o. Feriados estaduais e municipais n\xE3o s\xE3o identificados.");
  notes.push('F\xE9rias programadas (cadastro de F\xE9rias) abonam o dia inteiro como "F\xE9rias", sem criar batidas.');
  notes.push("Folga, feriado e atestado aprovados na corre\xE7\xE3o de ponto abonam o dia inteiro, sem criar batidas.");
  notes.push("Dia de trabalho previsto j\xE1 encerrado, sem marca\xE7\xE3o, f\xE9rias, feriado, abono ou atestado, \xE9 lan\xE7ado como Falta: as horas previstas entram como d\xE9bito no saldo e no banco de horas, at\xE9 corre\xE7\xE3o, justificativa v\xE1lida ou decis\xE3o do administrador.");
  notes.push("O administrador pode abonar o dia (conta como trabalhado, saldo zero) ou lan\xE7ar no banco de horas devendo (mant\xE9m o d\xE9bito). A decis\xE3o fica registrada, pode ser revertida, e n\xE3o altera as marca\xE7\xF5es originais.");
  notes.push("Toler\xE2ncia da CLT art. 58 \xA71\xBA: varia\xE7\xF5es de at\xE9 5 minutos por marca\xE7\xE3o, no limite de 10 minutos no dia, n\xE3o s\xE3o descontadas nem computadas como extra. Se a varia\xE7\xE3o passar desses limites, a diferen\xE7a do dia conta por inteiro.");
  notes.push("Dias anteriores \xE0 admiss\xE3o, folgas, feriados, f\xE9rias e atestados aprovados n\xE3o geram d\xE9bito. O dia de hoje e datas futuras n\xE3o s\xE3o lan\xE7ados como Falta at\xE9 o dia terminar.");
  return { from: input.from, to: input.to, timeZone: tz, days, totals, notes };
}
function fmtMinutes(min, signed = false) {
  if (min == null) return "\u2014";
  const sign = min < 0 ? "-" : signed && min > 0 ? "+" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
function fmtMark(m, tz) {
  const t2 = localParts2(m.time, tz);
  const included = m.kind === "adjusted" && !m.originalLabel;
  let tag = "";
  if (m.kind === "automatic") tag = "A";
  else if (m.kind === "legacy_adjusted") tag = "#";
  else if (included) tag = "+";
  else if (m.kind === "adjusted") tag = "*";
  const sync = m.synced ? "" : " (pendente)";
  const off = m.offline ? " (off)" : "";
  return `${t2.hm}${tag}${off}${sync}`;
}
function adjustmentText(m, tz) {
  const to = localParts2(m.time, tz).hm;
  const why = `Justificativa: ${m.justification}${m.reviewedBy ? ` (por ${m.reviewedBy})` : ""}`;
  if (!m.originalLabel) return `${m.label}: batida inclu\xEDda manualmente \xE0s ${to}. ${why}`;
  const from = localParts2(m.originalTime, tz).hm;
  if (m.originalLabel !== m.label) return `${m.label}: original ${m.originalLabel} ${from} para ${m.label} ${to}. ${why}`;
  return `${m.label}: original ${from} para ${to}. ${why}`;
}
function treatmentTexts(marks, tz) {
  const out = [];
  const groups = /* @__PURE__ */ new Map();
  for (const m of marks) {
    if (m.kind !== "adjusted") continue;
    if (m.originalLabel) {
      out.push(adjustmentText(m, tz));
      continue;
    }
    const why = `${(m.justification || "").trim() || "sem justificativa"}${m.reviewedBy ? ` (por ${m.reviewedBy})` : ""}`;
    const g = groups.get(why) || { why, times: [] };
    g.times.push(localParts2(m.time, tz).hm);
    groups.set(why, g);
  }
  if (groups.size) {
    const parts = [...groups.values()].map((g) => `${[...g.times].sort().join(", ")} \u2014 ${g.why}`);
    const total = [...groups.values()].reduce((a, g) => a + g.times.length, 0);
    out.unshift(`${total > 1 ? "Batidas inclu\xEDdas manualmente" : "Batida inclu\xEDda manualmente"}: ${parts.join("; ")}`);
  }
  return out;
}
function disregardedText(list, tz) {
  if (!list?.length) return "";
  const groups = /* @__PURE__ */ new Map();
  for (const m of list) {
    const why = `${m.reason.trim() || "sem justificativa"}${m.by ? ` (por ${m.by})` : ""}`;
    groups.set(why, [...groups.get(why) || [], localParts2(m.time, tz).hm]);
  }
  const parts = [...groups.entries()].map(([why, times]) => `${times.sort().join(", ")} \u2014 ${why}`);
  return `${list.length > 1 ? "Batidas desconsideradas" : "Batida desconsiderada"}: ${parts.join("; ")}`;
}
function mirrorRows(report) {
  const tz = report.timeZone;
  return report.days.map((d) => {
    const pick = (t2) => d.marks.filter((m) => m.type === t2).map((m) => fmtMark(m, tz)).join(" / ") || "\u2014";
    const has = d.marks.length > 0;
    const showHours = has || d.diffMinutes != null || d.situation === "falta" || d.situation === "abonado";
    const adj = treatmentTexts(d.marks, tz);
    const dis = disregardedText(d.disregarded, tz);
    if (dis) adj.push(dis);
    const issues = [...d.issues, ...adj].join("; ") || "";
    return [
      fmtDate(d.date),
      WEEKDAYS[d.weekday],
      situationLabel(d.situation) || "\u2014",
      pick("clock_in"),
      pick("break_start"),
      pick("break_end"),
      pick("clock_out"),
      showHours ? fmtMinutes(d.workedMinutes) : "\u2014",
      has ? fmtMinutes(d.breakMinutes) : "\u2014",
      fmtMinutes(d.expectedMinutes),
      fmtMinutes(d.diffMinutes, true),
      fmtMinutes(d.overtimeMinutes),
      fmtMinutes(d.nightMinutes),
      issues
    ];
  });
}
function totalsLines(t2) {
  return [
    ["Dias com marca\xE7\xE3o", String(t2.daysWithMarks)],
    ["Horas trabalhadas", fmtMinutes(t2.workedMinutes)],
    ["Tempo de intervalo", fmtMinutes(t2.breakMinutes)],
    ["Horas previstas", fmtMinutes(t2.expectedMinutes)],
    ["Saldo (trabalhadas \u2212 previstas)", fmtMinutes(t2.balanceMinutes, true)],
    ["Horas extras", fmtMinutes(t2.overtimeMinutes)],
    ["Horas devidas (d\xE9ficit)", fmtMinutes(t2.deficitMinutes)],
    ["Adicional noturno (min. rel\xF3gio)", fmtMinutes(t2.nightMinutes)],
    ["Hora noturna reduzida (equivalente)", fmtMinutes(t2.nightReducedMinutes)],
    ["Dias incompletos/inconsistentes", String(t2.incompleteDays)],
    ["Dias \xFAteis sem marca\xE7\xE3o", t2.daysWithoutMarksOnWorkday == null ? "\u2014" : String(t2.daysWithoutMarksOnWorkday)],
    ["Marca\xE7\xF5es ajustadas", String(t2.adjustedMarks)],
    ["Sa\xEDdas autom\xE1ticas do sistema", String(t2.automaticMarks)],
    ["Marca\xE7\xF5es pendentes de sincroniza\xE7\xE3o", String(t2.pendingSyncMarks)],
    ["Marca\xE7\xF5es registradas offline", String(t2.offlineMarks ?? 0)],
    ["Batidas desconsideradas", String(t2.disregardedMarks ?? 0)]
  ];
}
var MARK_LABEL, DAY, dayNum, weekdayOf, addDay, toMin, SITUATION_LABELS, pad, fmtDate, WEEKDAYS, MIRROR_HEADERS;
var init_timesheetMirror = __esm({
  "shared/timesheetMirror.ts"() {
    "use strict";
    init_holidays();
    init_correctionExcuse();
    MARK_LABEL = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
    DAY = 864e5;
    dayNum = (d) => {
      const [y, m, dd] = d.split("-").map(Number);
      return Math.floor(Date.UTC(y, m - 1, dd) / DAY);
    };
    weekdayOf = (d) => new Date(dayNum(d) * DAY).getUTCDay();
    addDay = (d, n) => new Date((dayNum(d) + n) * DAY).toISOString().slice(0, 10);
    toMin = (hm2) => {
      const [h, m] = hm2.split(":").map(Number);
      return h * 60 + m;
    };
    SITUATION_LABELS = {
      trabalho: "Trabalho",
      falta: "Falta",
      abonado: "Abonado",
      atestado: "Atestado",
      folga: "Folga",
      feriado: "Feriado",
      ferias: "F\xE9rias",
      pendente: "Pendente",
      dsr: "DSR",
      facultativo: "Ponto facultativo",
      fora: ""
    };
    pad = (n) => String(n).padStart(2, "0");
    fmtDate = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b"];
    MIRROR_HEADERS = ["Data", "Dia", "Situa\xE7\xE3o", "Entrada", "In\xEDcio intervalo", "Retorno intervalo", "Sa\xEDda", "Trabalhadas", "Intervalo", "Previstas", "Diferen\xE7a", "Extras", "Adic. noturno", "Ocorr\xEAncias"];
  }
});

// shared/timeBank.ts
function laborConfigured(labor) {
  return Boolean(labor?.dailyMinutes && labor.dailyMinutes > 0 && labor.workdays?.length);
}
function closedPeriodBalance(report, labor, today) {
  const configured = laborConfigured(labor);
  const openToday = report.days.find((day) => day.date === today && day.issues.some((issue) => issue.startsWith("Jornada incompleta")));
  let workedMinutes = report.totals.workedMinutes;
  let expectedMinutes = report.totals.expectedMinutes ?? 0;
  let overtimeMinutes = report.totals.overtimeMinutes ?? 0;
  let deficitMinutes = report.totals.deficitMinutes ?? 0;
  let balanceMinutes = report.totals.balanceMinutes ?? 0;
  if (openToday) {
    const todayDiff = openToday.diffMinutes ?? 0;
    workedMinutes = Math.max(0, workedMinutes - openToday.workedMinutes);
    expectedMinutes = Math.max(0, expectedMinutes - (openToday.expectedMinutes ?? 0));
    if (todayDiff > 0) overtimeMinutes = Math.max(0, overtimeMinutes - todayDiff);
    if (todayDiff < 0) deficitMinutes = Math.max(0, deficitMinutes + todayDiff);
    balanceMinutes -= todayDiff;
  }
  return {
    daysTracked: report.totals.daysWithMarks,
    workedMinutes,
    expectedMinutes: configured ? expectedMinutes : 0,
    balanceMinutes: configured ? balanceMinutes : 0,
    overtimeMinutes: configured ? overtimeMinutes : 0,
    deficitMinutes: configured ? deficitMinutes : 0,
    openShift: Boolean(openToday),
    configured
  };
}
function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}
var init_timeBank = __esm({
  "shared/timeBank.ts"() {
    "use strict";
  }
});

// server/modules/correctionExtras.ts
import { and as and7, eq as eq7, gte as gte4, inArray as inArray5, lt as lt2, sql as sql5 } from "drizzle-orm";
async function ensureCorrectionExtras() {
  if (ready2) return ready2;
  ready2 = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(sql5`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS justificationType varchar(32) NULL DEFAULT 'normal'`);
    await database2.execute(sql5`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS attachmentKey varchar(512) NULL`);
  })().catch((e) => {
    ready2 = null;
    throw e;
  });
  return ready2;
}
async function saveCorrectionAttachment(companyId, requestId, base64, mime = "image/jpeg") {
  if (!base64) return null;
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(clean, "base64");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Foto muito grande (m\xE1x. 8 MB).");
  const detected = detectImageMime(buf);
  if (!detected) throw new Error("O anexo precisa ser uma imagem v\xE1lida (JPG, PNG ou WebP).");
  const ext = detected === "image/png" ? "png" : detected === "image/webp" ? "webp" : "jpg";
  const key = `corrections/${companyId}/${requestId}_${Date.now()}.${ext}`;
  const { key: stored } = await storagePut(key, buf, detected);
  return stored;
}
async function loadApprovedDayExcuses(companyId, memberIds, from, to) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  const database2 = await getDb();
  if (!database2) return map;
  await ensureCorrectionExtras();
  const start = new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 36e5);
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + 60 * 36e5);
  const rows4 = await database2.select().from(timeCorrectionRequests).where(and7(
    eq7(timeCorrectionRequests.companyId, companyId),
    inArray5(timeCorrectionRequests.memberAccountId, memberIds),
    eq7(timeCorrectionRequests.status, "approved"),
    gte4(timeCorrectionRequests.requestedTime, start),
    lt2(timeCorrectionRequests.requestedTime, end)
  ));
  for (const row2 of rows4) {
    if (!looksLikeFullDayExcuse(row2)) continue;
    const date3 = excuseDay(row2.requestedTime);
    if (date3 < from || date3 > to) continue;
    const type = inferFullDayExcuseType(row2);
    if (!type) continue;
    const list = map.get(row2.memberAccountId) || [];
    if (list.some((item) => item.date === date3)) continue;
    list.push({ date: date3, type, justification: row2.justification });
    map.set(row2.memberAccountId, list);
  }
  return map;
}
var ready2;
var init_correctionExtras = __esm({
  "server/modules/correctionExtras.ts"() {
    "use strict";
    init_mediaKeys();
    init_db();
    init_schema();
    init_storage();
    init_correctionExcuse();
    ready2 = null;
  }
});

// server/modules/dayTreatments.ts
import { and as and8, eq as eq8, gte as gte5, inArray as inArray6, isNull as isNull2, lte as lte3 } from "drizzle-orm";
async function ensureDayTreatmentsTable() {
  if (ready3) return ready3;
  ready3 = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(`CREATE TABLE IF NOT EXISTS time_day_treatments (
      id int NOT NULL AUTO_INCREMENT,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      day varchar(10) NOT NULL,
      decision varchar(32) NOT NULL,
      notes text NULL,
      decidedByUserId int NULL,
      decidedByName varchar(255) NULL,
      decidedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reversedAt timestamp NULL,
      reversedByUserId int NULL,
      reversedByName varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY time_day_treatments_member_day (companyId, memberAccountId, day),
      KEY time_day_treatments_company (companyId)
    )`);
  })().catch((e) => {
    ready3 = null;
    throw e;
  });
  return ready3;
}
function toTreatmentInput(row2) {
  return {
    date: row2.day,
    decision: row2.decision === "time_bank" ? "time_bank" : "excuse",
    notes: row2.notes ?? null,
    by: row2.decidedByName ?? null,
    at: row2.decidedAt ? new Date(row2.decidedAt).toISOString() : null
  };
}
async function loadDayTreatments(companyId, memberIds, from, to) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  await ensureDayTreatmentsTable();
  const database2 = await getDb();
  if (!database2) return map;
  const rows4 = await database2.select().from(timeDayTreatments).where(and8(
    eq8(timeDayTreatments.companyId, companyId),
    inArray6(timeDayTreatments.memberAccountId, memberIds),
    isNull2(timeDayTreatments.reversedAt),
    gte5(timeDayTreatments.day, from),
    lte3(timeDayTreatments.day, to)
  ));
  for (const row2 of rows4) {
    const list = map.get(row2.memberAccountId) || [];
    list.push(toTreatmentInput(row2));
    map.set(row2.memberAccountId, list);
  }
  return map;
}
async function getActiveTreatment(companyId, memberId, day) {
  await ensureDayTreatmentsTable();
  const database2 = await getDb();
  if (!database2) return null;
  const rows4 = await database2.select().from(timeDayTreatments).where(and8(
    eq8(timeDayTreatments.companyId, companyId),
    eq8(timeDayTreatments.memberAccountId, memberId),
    eq8(timeDayTreatments.day, day),
    isNull2(timeDayTreatments.reversedAt)
  )).limit(1);
  return rows4[0] || null;
}
async function saveDayTreatment(opts) {
  await ensureDayTreatmentsTable();
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  const now = /* @__PURE__ */ new Date();
  const current = await getActiveTreatment(opts.companyId, opts.memberId, opts.day);
  if (current) {
    await database2.update(timeDayTreatments).set({
      reversedAt: now,
      reversedByUserId: opts.decidedByUserId ?? null,
      reversedByName: opts.decidedByName ?? null
    }).where(eq8(timeDayTreatments.id, current.id));
  }
  await database2.insert(timeDayTreatments).values({
    companyId: opts.companyId,
    memberAccountId: opts.memberId,
    day: opts.day,
    decision: opts.decision,
    notes: opts.notes || null,
    decidedByUserId: opts.decidedByUserId ?? null,
    decidedByName: opts.decidedByName ?? null,
    decidedAt: now
  });
}
async function reverseDayTreatment(opts) {
  const current = await getActiveTreatment(opts.companyId, opts.memberId, opts.day);
  if (!current) return false;
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  const notes = [current.notes, opts.notes ? `Revers\xE3o: ${opts.notes}` : null].filter(Boolean).join(" | ");
  await database2.update(timeDayTreatments).set({
    reversedAt: /* @__PURE__ */ new Date(),
    reversedByUserId: opts.reversedByUserId ?? null,
    reversedByName: opts.reversedByName ?? null,
    notes: notes || current.notes
  }).where(eq8(timeDayTreatments.id, current.id));
  return true;
}
var ready3;
var init_dayTreatments = __esm({
  "server/modules/dayTreatments.ts"() {
    "use strict";
    init_schema();
    init_db();
    ready3 = null;
  }
});

// server/modules/timeBank.ts
import { sql as sql6 } from "drizzle-orm";
async function loadLaborProfiles(companyId, memberIds) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  const database2 = await getDb();
  if (!database2) return map;
  const wanted = new Set(memberIds);
  const rows4 = (await database2.execute(sql6`SELECT settingKey, settingValue FROM system_settings WHERE accountId = ${companyId} AND settingKey LIKE 'labor\\_profile:%'`))[0];
  for (const r of rows4) {
    const id3 = Number(String(r.settingKey).split(":")[1]);
    if (!wanted.has(id3)) continue;
    try {
      map.set(id3, JSON.parse(r.settingValue));
    } catch {
    }
  }
  return map;
}
async function buildMemberReports(companyId, memberIds, from, to, timeZone) {
  const out = /* @__PURE__ */ new Map();
  if (!memberIds.length) return out;
  const eventRows = await loadMirrorEventRows(companyId, memberIds, from, to);
  const eventsByMember = /* @__PURE__ */ new Map();
  for (const r of eventRows) eventsByMember.set(r.memberAccountId, [...eventsByMember.get(r.memberAccountId) || [], r]);
  const [adjByEvent, laborByMember, excusesByMember, vacationsByMember, treatmentsByMember, options] = await Promise.all([
    loadAdjustmentsByEvent(companyId, memberIds),
    loadLaborProfiles(companyId, memberIds),
    loadApprovedDayExcuses(companyId, memberIds, from, to),
    loadMemberVacations(companyId, memberIds, from, to),
    loadDayTreatments(companyId, memberIds, from, to),
    loadMirrorOptions(companyId)
  ]);
  const today = todayInTimeZone(timeZone);
  for (const id3 of memberIds) {
    const rows4 = eventsByMember.get(id3) || [];
    const labor = laborByMember.get(id3) ?? null;
    const report = buildMirror({ events: toMirrorEvents(rows4, adjByEvent), from, to, timeZone, labor, excuses: excusesByMember.get(id3) || [], vacations: vacationsByMember.get(id3) || [], treatments: treatmentsByMember.get(id3) || [], options, today });
    const last = rows4.length ? rows4[rows4.length - 1] : null;
    out.set(id3, { memberId: id3, labor, report, lastEventAt: last ? (last.deviceTime || last.serverTime).toISOString() : null });
  }
  return out;
}
var init_timeBank2 = __esm({
  "server/modules/timeBank.ts"() {
    "use strict";
    init_db();
    init_timesheetMirror();
    init_timeBank();
    init_correctionExtras();
    init_dayTreatments();
    init_mirrorData();
  }
});

// shared/registryFields.ts
function formatCompanyAddress(c) {
  if (!c) return "";
  const line1 = [c.addressStreet, c.addressNumber, c.addressComplement].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
  const line2 = [c.addressDistrict, [c.addressCity, c.addressState].filter(Boolean).join("/")].filter(Boolean).join(" \u2014 ");
  const zip = c.addressZip ? `CEP ${formatCep(c.addressZip)}` : "";
  return [line1, line2, zip].filter(Boolean).join(". ");
}
function companyRegistryMissing(c) {
  const missing = [];
  if (!String(c?.legalName || "").trim()) missing.push("Raz\xE3o social");
  if (!onlyDigitsStr(c?.taxDocument)) missing.push("CNPJ ou CPF");
  const hasAddress = Boolean(String(c?.addressStreet || "").trim() && String(c?.addressCity || "").trim());
  if (!hasAddress) missing.push("Endere\xE7o");
  return missing;
}
function companyRegistryComplete(c) {
  return companyRegistryMissing(c).length === 0;
}
function toLegalSnapshot(c, fallbackName = "") {
  const legalName = String(c?.legalName || fallbackName || "").trim();
  return {
    legalName,
    document: onlyDigitsStr(c?.taxDocument) ? formatCpfOrCnpj(c?.taxDocument) : "",
    establishment: String(c?.establishment || "").trim(),
    address: formatCompanyAddress(c)
  };
}
var BR_STATES, emptyCompanyRegistry, emptyMemberRegistry;
var init_registryFields = __esm({
  "shared/registryFields.ts"() {
    "use strict";
    init_brDocs();
    BR_STATES = [
      "AC",
      "AL",
      "AP",
      "AM",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MT",
      "MS",
      "MG",
      "PA",
      "PB",
      "PR",
      "PE",
      "PI",
      "RJ",
      "RN",
      "RS",
      "RO",
      "RR",
      "SC",
      "SP",
      "SE",
      "TO"
    ];
    emptyCompanyRegistry = () => ({
      legalName: "",
      tradeName: "",
      taxDocument: "",
      stateRegistration: "",
      establishment: "",
      addressZip: "",
      addressStreet: "",
      addressNumber: "",
      addressComplement: "",
      addressDistrict: "",
      addressCity: "",
      addressState: "",
      contactPhone: "",
      contactEmail: ""
    });
    emptyMemberRegistry = () => ({
      cpf: "",
      pis: "",
      rg: "",
      birthDate: "",
      jobTitle: "",
      admissionDate: "",
      phone: ""
    });
  }
});

// shared/registryPermissions.ts
function canEditCompanyFiscal(role) {
  return role === "company_admin" || role === "platform_admin";
}
function canEditMemberRegistry(actorRole2, targetRole) {
  if (actorRole2 === "company_admin" || actorRole2 === "platform_admin") return true;
  if (actorRole2 === "supervisor") return targetRole === "promoter";
  return false;
}
function memberRegistryDeniedMessage(actorRole2) {
  if (actorRole2 === "promoter") {
    return "Os dados cadastrais (CPF, PIS e demais) s\xF3 podem ser alterados pelo administrador da empresa. Voc\xEA pode atualizar o e-mail e a senha.";
  }
  if (actorRole2 === "supervisor") {
    return "O supervisor s\xF3 pode alterar os dados cadastrais de promotores.";
  }
  return "Voc\xEA n\xE3o pode alterar estes dados cadastrais.";
}
function canEditOwnRegistry(role) {
  return role === "company_admin" || role === "supervisor" || role === "platform_admin";
}
var init_registryPermissions = __esm({
  "shared/registryPermissions.ts"() {
    "use strict";
  }
});

// server/authThrottle.ts
import { createHash as createHash2 } from "node:crypto";
import { sql as sql7 } from "drizzle-orm";
function throttleKeyHash(key) {
  return createHash2("sha256").update(key).digest("hex");
}
function nextEntryAfterFailure(current, now, limit = THROTTLE_LIMIT) {
  const entry = !current || now - current.windowStartedAt >= THROTTLE_WINDOW_MS ? { failures: 1, windowStartedAt: now, blockedUntil: 0 } : { ...current, failures: current.failures + 1 };
  if (entry.failures >= limit) entry.blockedUntil = now + THROTTLE_BLOCK_MS;
  return entry;
}
function configureThrottleDb(getter) {
  dbGetter = getter;
  ensured = null;
}
async function table() {
  const db = await dbGetter();
  if (!db) return null;
  if (!ensured) {
    ensured = db.execute(sql7.raw(`CREATE TABLE IF NOT EXISTS auth_throttle (
      keyHash char(64) NOT NULL,
      failures int NOT NULL DEFAULT 0,
      windowStartedAt bigint NOT NULL,
      blockedUntil bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (keyHash)
    )`)).then(() => void 0).catch((err) => {
      ensured = null;
      throw err;
    });
  }
  await ensured;
  return db;
}
async function isThrottled(key) {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.blockedUntil > now) return true;
  try {
    const db = await table();
    if (!db) return false;
    const found = rows(await db.execute(sql7`SELECT blockedUntil FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)} LIMIT 1`));
    return Number(found[0]?.blockedUntil ?? 0) > now;
  } catch (err) {
    console.warn("[auth-throttle] banco indispon\xEDvel, usando s\xF3 a mem\xF3ria", err?.message);
    return false;
  }
}
async function registerThrottleFailure(key) {
  const now = Date.now();
  memory.set(key, nextEntryAfterFailure(memory.get(key), now));
  if (memory.size > 5e3) {
    for (const [k, v] of memory) if (now - v.windowStartedAt >= THROTTLE_WINDOW_MS) memory.delete(k);
  }
  try {
    const db = await table();
    if (!db) return;
    const hash = throttleKeyHash(key);
    const found = rows(await db.execute(sql7`SELECT failures, windowStartedAt, blockedUntil FROM auth_throttle WHERE keyHash = ${hash} LIMIT 1`));
    const current = found[0] ? { failures: Number(found[0].failures), windowStartedAt: Number(found[0].windowStartedAt), blockedUntil: Number(found[0].blockedUntil) } : void 0;
    const next = nextEntryAfterFailure(current, now);
    await db.execute(sql7`INSERT INTO auth_throttle (keyHash, failures, windowStartedAt, blockedUntil)
      VALUES (${hash}, ${next.failures}, ${next.windowStartedAt}, ${next.blockedUntil})
      ON DUPLICATE KEY UPDATE failures = VALUES(failures), windowStartedAt = VALUES(windowStartedAt), blockedUntil = VALUES(blockedUntil)`);
  } catch (err) {
    console.warn("[auth-throttle] falha ao gravar tentativa", err?.message);
  }
}
async function clearThrottle(key) {
  memory.delete(key);
  try {
    const db = await table();
    if (db) await db.execute(sql7`DELETE FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)}`);
  } catch {
  }
}
var THROTTLE_LIMIT, THROTTLE_WINDOW_MS, THROTTLE_BLOCK_MS, memory, ensured, dbGetter, rows;
var init_authThrottle = __esm({
  "server/authThrottle.ts"() {
    "use strict";
    THROTTLE_LIMIT = 5;
    THROTTLE_WINDOW_MS = 15 * 60 * 1e3;
    THROTTLE_BLOCK_MS = 15 * 60 * 1e3;
    memory = /* @__PURE__ */ new Map();
    ensured = null;
    dbGetter = async () => null;
    rows = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
  }
});

// server/memberAuth.ts
var memberAuth_exports = {};
__export(memberAuth_exports, {
  allowPasswordResetRequest: () => allowPasswordResetRequest,
  authenticateMember: () => authenticateMember,
  changeMemberPassword: () => changeMemberPassword,
  changePlatformPassword: () => changePlatformPassword,
  createCompanyUser: () => createCompanyUser,
  createCompanyWithAdmin: () => createCompanyWithAdmin,
  createPasswordResetToken: () => createPasswordResetToken,
  createSession: () => createSession,
  getMemberBySessionToken: () => getMemberBySessionToken,
  getPlatformAdminBySessionToken: () => getPlatformAdminBySessionToken,
  hashPassword: () => hashPassword,
  isPasswordResetAvailable: () => isPasswordResetAvailable,
  listMemberAccounts: () => listMemberAccounts,
  normalizeMemberRole: () => normalizeMemberRole,
  recoverPassword: () => recoverPassword,
  regenerateMemberRecoveryCode: () => regenerateMemberRecoveryCode,
  resetMemberPassword: () => resetMemberPassword,
  resetPasswordWithToken: () => resetPasswordWithToken,
  revokeAllMemberSessions: () => revokeAllMemberSessions,
  revokeSessions: () => revokeSessions,
  setMemberActive: () => setMemberActive,
  setPlatformAdminActive: () => setPlatformAdminActive,
  updateCompanyUser: () => updateCompanyUser,
  updateMemberProfile: () => updateMemberProfile,
  verifyMemberPassword: () => verifyMemberPassword,
  verifyPassword: () => verifyPassword
});
import { createHash as createHash3, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and as and9, eq as eq9, gt, inArray as inArray7, lte as lte4 } from "drizzle-orm";
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}
function verifyPassword(password, encoded) {
  const [algorithm, salt, stored] = encoded.split(":");
  if (algorithm !== "scrypt" || !salt || !stored) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}
function hashToken(token) {
  return createHash3("sha256").update(token).digest("hex");
}
function normalizeMemberRole(role) {
  if (role === "admin" || role === "company_admin") return "company_admin";
  if (role === "supervisor") return "supervisor";
  return "promoter";
}
async function authenticateMember(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (await isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureCompanyRegistryColumns();
  const platformResult = await db.select().from(platformAdmins).where(eq9(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    await clearRateLimit(key);
    return { kind: "platform", account: platform };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq9(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member && member.active && verifyPassword(password, member.passwordHash)) {
    await clearRateLimit(key);
    return { kind: "company", account: member };
  }
  await registerFailure(key);
  return null;
}
async function createSession(principal) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3);
  if (principal.kind === "platform") {
    await db.delete(platformSessions).where(and9(eq9(platformSessions.platformAdminId, principal.account.id), lte4(platformSessions.expiresAt, /* @__PURE__ */ new Date())));
    await db.insert(platformSessions).values({ platformAdminId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
    return { rawToken, expiresAt, kind: "platform" };
  }
  await db.delete(memberSessions).where(and9(eq9(memberSessions.memberAccountId, principal.account.id), lte4(memberSessions.expiresAt, /* @__PURE__ */ new Date())));
  await db.insert(memberSessions).values({ memberAccountId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt, kind: "company" };
}
function dropSessionCaches() {
  memberSessionCache.clear();
  platformSessionCache.clear();
}
function cleanupExpiredSessions(db) {
  const nowMs = Date.now();
  if (nowMs - lastSessionCleanup < 10 * 6e4) return;
  lastSessionCleanup = nowMs;
  const now = new Date(nowMs);
  void Promise.all([
    db.delete(memberSessions).where(lte4(memberSessions.expiresAt, now)),
    db.delete(platformSessions).where(lte4(platformSessions.expiresAt, now))
  ]).catch(() => void 0);
}
function getMemberBySessionToken(rawToken) {
  if (!rawToken) return Promise.resolve(null);
  return memberSessionCache.get(hashToken(rawToken), () => loadMemberBySessionToken(rawToken));
}
async function loadMemberBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions).innerJoin(memberAccounts, eq9(memberSessions.memberAccountId, memberAccounts.id)).innerJoin(companies, eq9(memberAccounts.companyId, companies.id)).where(and9(eq9(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq9(memberAccounts.active, true), eq9(companies.active, true))).limit(1);
  cleanupExpiredSessions(db);
  return result[0]?.account ?? null;
}
function getPlatformAdminBySessionToken(rawToken) {
  if (!rawToken) return Promise.resolve(null);
  return platformSessionCache.get(hashToken(rawToken), () => loadPlatformAdminBySessionToken(rawToken));
}
async function loadPlatformAdminBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions).innerJoin(platformAdmins, eq9(platformSessions.platformAdminId, platformAdmins.id)).where(and9(eq9(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq9(platformAdmins.active, true))).limit(1);
  cleanupExpiredSessions(db);
  return result[0]?.account ?? null;
}
async function revokeSessions(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  memberSessionCache.delete(tokenHash);
  platformSessionCache.delete(tokenHash);
  await db.delete(memberSessions).where(eq9(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq9(platformSessions.tokenHash, tokenHash));
}
async function changeMemberPassword(memberAccountId, currentPassword, newPassword) {
  const key = `change:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq9(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq9(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return true;
}
async function changePlatformPassword(platformAdminId, currentPassword, newPassword) {
  const key = `change:platform:${platformAdminId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq9(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq9(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq9(platformSessions.platformAdminId, platformAdminId));
  dropSessionCaches();
  return true;
}
async function resetMemberPassword(memberAccountId, newPassword) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq9(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  const [acc] = await db.select({ email: memberAccounts.email }).from(memberAccounts).where(eq9(memberAccounts.id, memberAccountId)).limit(1);
  if (acc?.email) await clearRateLimit(`login:${acc.email.trim().toLowerCase()}`);
}
async function recoverPassword(email, recoveryCode, newPassword) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const platformResult = await db.select().from(platformAdmins).where(eq9(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq9(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq9(platformSessions.platformAdminId, platform.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq9(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq9(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, member.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" };
  }
  await registerFailure(key);
  return false;
}
function resetSecret() {
  return process.env.JWT_SECRET || "";
}
function signResetToken(kind, id3, exp, passwordHash) {
  const payload2 = Buffer.from(JSON.stringify({ k: kind, id: id3, exp })).toString("base64url");
  const mac = createHmac("sha256", resetSecret()).update(`${payload2}.${passwordHash.slice(-24)}`).digest("base64url");
  return `${payload2}.${mac}`;
}
function parseResetToken(token) {
  const [payload2, mac] = String(token || "").split(".");
  if (!payload2 || !mac) return null;
  try {
    const data = JSON.parse(Buffer.from(payload2, "base64url").toString("utf8"));
    if (data.k !== "platform" && data.k !== "company" || !Number.isInteger(data.id) || typeof data.exp !== "number") return null;
    return { ...data, payload: payload2, mac };
  } catch {
    return null;
  }
}
function isPasswordResetAvailable() {
  return Boolean(resetSecret());
}
async function createPasswordResetToken(email) {
  if (!isPasswordResetAvailable()) return null;
  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const exp = Date.now() + RESET_TOKEN_TTL_MS;
  const platform = (await db.select().from(platformAdmins).where(eq9(platformAdmins.email, normalizedEmail)).limit(1))[0];
  if (platform?.active) return { token: signResetToken("platform", platform.id, exp, platform.passwordHash), userName: platform.userName || normalizedEmail };
  const member = (await db.select().from(memberAccounts).where(eq9(memberAccounts.email, normalizedEmail)).limit(1))[0];
  if (member?.active) return { token: signResetToken("company", member.id, exp, member.passwordHash), userName: member.userName || normalizedEmail };
  return null;
}
async function resetPasswordWithToken(token, newPassword) {
  if (!isPasswordResetAvailable()) return false;
  const parsed = parseResetToken(token);
  if (!parsed || parsed.exp < Date.now()) return false;
  const key = `reset:${parsed.k}:${parsed.id}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const account = parsed.k === "platform" ? (await db.select().from(platformAdmins).where(eq9(platformAdmins.id, parsed.id)).limit(1))[0] : (await db.select().from(memberAccounts).where(eq9(memberAccounts.id, parsed.id)).limit(1))[0];
  if (!account || !account.active) {
    await registerFailure(key);
    return false;
  }
  const expected = signResetToken(parsed.k, parsed.id, parsed.exp, account.passwordHash);
  const a = Buffer.from(expected);
  const b = Buffer.from(`${parsed.payload}.${parsed.mac}`);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await registerFailure(key);
    return false;
  }
  if (parsed.k === "platform") {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq9(platformAdmins.id, parsed.id));
    await db.delete(platformSessions).where(eq9(platformSessions.platformAdminId, parsed.id));
  } else {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq9(memberAccounts.id, parsed.id));
    await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, parsed.id));
  }
  await clearRateLimit(key);
  dropSessionCaches();
  return true;
}
async function allowPasswordResetRequest(email) {
  const key = `resetreq:${email.trim().toLowerCase()}`;
  if (await isRateLimited(key)) return false;
  await registerFailure(key);
  return true;
}
async function createCompanyWithAdmin(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const normalizedEmail = input.email.trim().toLowerCase();
  return await database2.transaction(async (tx) => {
    const trialEnds = new Date(Date.now() + 14 * 24 * 3600 * 1e3);
    const trialYmd = trialEnds.toISOString().slice(0, 10);
    const todayYmd = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const companyResult = await tx.insert(companies).values({
      name: input.companyName.trim(),
      active: true,
      planId: input.planId ?? null,
      subscriptionStatus: "trial",
      subscriptionStartedAt: /* @__PURE__ */ new Date(),
      trialEndsAt: trialEnds,
      subscriptionExpiresAt: trialEnds
    });
    const companyId = Number(companyResult[0].insertId);
    const accountResult = await tx.insert(memberAccounts).values({
      companyId,
      userName: input.userName.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(input.password),
      recoveryCodeHash: hashPassword(recoveryCode),
      role: "company_admin",
      active: true
    });
    if (input.planId) {
      const planRows = await tx.select().from(subscriptionPlans).where(eq9(subscriptionPlans.id, input.planId)).limit(1);
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
          notes: "Cadastro p\xFAblico com plano selecionado (trial 14 dias)"
        });
      }
    }
    return { companyId, accountId: Number(accountResult[0].insertId), recoveryCode, planId: input.planId ?? null };
  });
}
async function createCompanyUser(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const userName = input.userName.trim();
  const email = input.email.trim().toLowerCase();
  if (userName.length < 2) throw new Error("Informe o nome completo do usu\xE1rio.");
  if (email.length < 3) throw new Error("Informe um e-mail v\xE1lido.");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const result = await db.insert(memberAccounts).values({
    companyId: input.companyId,
    userName,
    email,
    passwordHash: hashPassword(input.password),
    recoveryCodeHash: hashPassword(recoveryCode),
    role: input.role,
    active: true
  });
  return { accountId: Number(result[0].insertId), recoveryCode };
}
async function listMemberAccounts(companyId) {
  const db = await getDb();
  if (!db) return [];
  await ensureCompanyRegistryColumns();
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt, phone: memberAccounts.phone, cpf: memberAccounts.cpf, pis: memberAccounts.pis, rg: memberAccounts.rg, birthDate: memberAccounts.birthDate, jobTitle: memberAccounts.jobTitle, admissionDate: memberAccounts.admissionDate, employeeCode: promoterProfiles.employeeCode, workStartTime: promoterProfiles.workStartTime, workEndTime: promoterProfiles.workEndTime }).from(memberAccounts).leftJoin(promoterProfiles, and9(eq9(promoterProfiles.memberAccountId, memberAccounts.id), eq9(promoterProfiles.companyId, memberAccounts.companyId)));
  const rows4 = companyId ? await query.where(eq9(memberAccounts.companyId, companyId)) : await query;
  return rows4.map((row2) => ({ ...row2, role: normalizeMemberRole(String(row2.role)) }));
}
async function updateCompanyUser(accountId, companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.role && data.role !== "company_admin") {
    const [target] = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(and9(eq9(memberAccounts.id, accountId), eq9(memberAccounts.companyId, companyId))).limit(1);
    if (target && normalizeMemberRole(String(target.role)) === "company_admin") {
      const admins = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and9(eq9(memberAccounts.companyId, companyId), eq9(memberAccounts.active, true), inArray7(memberAccounts.role, ["company_admin", "admin"]))).limit(2);
      if (admins.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
    }
  }
  await db.update(memberAccounts).set({ ...data, email: data.email?.trim().toLowerCase() }).where(and9(eq9(memberAccounts.id, accountId), eq9(memberAccounts.companyId, companyId)));
}
async function setMemberActive(id3, active, companyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const conditions = companyId === void 0 ? eq9(memberAccounts.id, id3) : and9(eq9(memberAccounts.id, id3), eq9(memberAccounts.companyId, companyId));
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(conditions).limit(1);
  if (account[0]?.role === "company_admin" && !active) {
    const adminCount = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and9(eq9(memberAccounts.companyId, companyId ?? 0), eq9(memberAccounts.role, "company_admin"), eq9(memberAccounts.active, true))).limit(2);
    if (adminCount.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
  }
  await db.update(memberAccounts).set({ active }).where(conditions);
  if (!active) {
    await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, id3));
    dropSessionCaches();
  }
}
async function setPlatformAdminActive(id3, active) {
  if (!active) throw new Error("A conta do administrador da plataforma n\xE3o pode ser desativada nesta opera\xE7\xE3o.");
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAdmins).set({ active }).where(eq9(platformAdmins.id, id3));
}
async function updateMemberProfile(memberAccountId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const name = data.userName.trim();
  if (name.length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres.");
  await db.update(memberAccounts).set({ userName: name }).where(eq9(memberAccounts.id, memberAccountId));
  return { success: true, userName: name };
}
async function regenerateMemberRecoveryCode(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq9(memberAccounts.id, memberAccountId));
  return { recoveryCode };
}
async function revokeAllMemberSessions(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(eq9(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return { success: true };
}
async function verifyMemberPassword(memberAccountId, password) {
  const key = `verify:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.select().from(memberAccounts).where(eq9(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  return true;
}
var SESSION_DAYS, isRateLimited, registerFailure, clearRateLimit, SESSION_CACHE_MS, memberSessionCache, platformSessionCache, lastSessionCleanup, RESET_TOKEN_TTL_MS;
var init_memberAuth = __esm({
  "server/memberAuth.ts"() {
    "use strict";
    init_ttlCache();
    init_companyRegistry();
    init_schema_original();
    init_schema();
    init_db();
    init_authThrottle();
    SESSION_DAYS = 30;
    configureThrottleDb(() => getDb());
    isRateLimited = isThrottled;
    registerFailure = registerThrottleFailure;
    clearRateLimit = clearThrottle;
    SESSION_CACHE_MS = 2e4;
    memberSessionCache = createTtlCache(SESSION_CACHE_MS);
    platformSessionCache = createTtlCache(SESSION_CACHE_MS);
    lastSessionCleanup = 0;
    RESET_TOKEN_TTL_MS = 60 * 60 * 1e3;
  }
});

// server/companyRegistry.ts
var companyRegistry_exports = {};
__export(companyRegistry_exports, {
  PROMOTER_FORBIDDEN_REGISTRY_KEYS: () => PROMOTER_FORBIDDEN_REGISTRY_KEYS,
  changeMyEmailInput: () => changeMyEmailInput,
  companyRegistryInput: () => companyRegistryInput,
  companyRegistryRouter: () => companyRegistryRouter,
  ensureCompanyRegistryColumns: () => ensureCompanyRegistryColumns,
  getCompanyRegistry: () => getCompanyRegistry,
  getLaborIdentity: () => getLaborIdentity,
  getLegalSnapshotForCompany: () => getLegalSnapshotForCompany,
  getMemberRegistry: () => getMemberRegistry,
  memberRegistryInput: () => memberRegistryInput,
  saveCompanyRegistry: () => saveCompanyRegistry,
  saveMemberRegistry: () => saveMemberRegistry
});
import { z as z2 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
import { eq as eq10, sql as sql8 } from "drizzle-orm";
function blank(value) {
  return String(value ?? "").trim();
}
function orNull(value) {
  return value ? value : null;
}
async function ensureCompanyRegistryColumns() {
  if (ready4) return ready4;
  ready4 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    const alters = [
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS legalName VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tradeName VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS taxDocument VARCHAR(14) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS stateRegistration VARCHAR(30) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS establishment VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressZip VARCHAR(8) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressStreet VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressNumber VARCHAR(20) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressComplement VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressDistrict VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressCity VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressState VARCHAR(2) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contactPhone VARCHAR(50) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contactEmail VARCHAR(320) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS cpf VARCHAR(11) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS pis VARCHAR(11) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS rg VARCHAR(20) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS birthDate VARCHAR(10) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS jobTitle VARCHAR(120) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS admissionDate VARCHAR(10) NULL"
    ];
    for (const stmt of alters) {
      await database2.execute(sql8.raw(stmt));
    }
  })().catch((error) => {
    ready4 = null;
    throw error;
  });
  return ready4;
}
function rowToCompany(row2, fallbackName = "") {
  const base = emptyCompanyRegistry();
  if (!row2) return { ...base, legalName: fallbackName };
  return {
    legalName: blank(row2.legalName) || fallbackName,
    tradeName: blank(row2.tradeName),
    taxDocument: onlyDigitsStr(row2.taxDocument),
    stateRegistration: blank(row2.stateRegistration),
    establishment: blank(row2.establishment),
    addressZip: onlyDigitsStr(row2.addressZip),
    addressStreet: blank(row2.addressStreet),
    addressNumber: blank(row2.addressNumber),
    addressComplement: blank(row2.addressComplement),
    addressDistrict: blank(row2.addressDistrict),
    addressCity: blank(row2.addressCity),
    addressState: blank(row2.addressState).toUpperCase(),
    contactPhone: blank(row2.contactPhone),
    contactEmail: blank(row2.contactEmail)
  };
}
function parseLegacyLegal(raw) {
  if (!raw) return {};
  try {
    const json2 = JSON.parse(raw);
    const address = blank(json2.address);
    return {
      legalName: blank(json2.legalName),
      taxDocument: onlyDigitsStr(json2.document),
      establishment: blank(json2.establishment),
      addressStreet: address && !address.includes("CEP") ? address : address
    };
  } catch {
    return {};
  }
}
function mergeCompany(row2, legacy) {
  const out = { ...row2 };
  if (!out.legalName && legacy.legalName) out.legalName = legacy.legalName;
  if (!out.taxDocument && legacy.taxDocument) out.taxDocument = legacy.taxDocument;
  if (!out.establishment && legacy.establishment) out.establishment = legacy.establishment;
  if (!out.addressStreet && legacy.addressStreet) out.addressStreet = legacy.addressStreet;
  return out;
}
function parseLegacyLabor(raw) {
  if (!raw) return {};
  try {
    const json2 = JSON.parse(raw);
    return {
      cpf: onlyDigitsStr(json2.cpf),
      pis: onlyDigitsStr(json2.pis),
      jobTitle: blank(json2.jobTitle),
      admissionDate: blank(json2.admissionDate)
    };
  } catch {
    return {};
  }
}
function rowToMember(row2, legacy = {}) {
  const base = emptyMemberRegistry();
  if (!row2) return { ...base, ...legacy, cpf: onlyDigitsStr(legacy.cpf), pis: onlyDigitsStr(legacy.pis) };
  return {
    cpf: onlyDigitsStr(row2.cpf) || onlyDigitsStr(legacy.cpf),
    pis: onlyDigitsStr(row2.pis) || onlyDigitsStr(legacy.pis),
    rg: blank(row2.rg),
    birthDate: blank(row2.birthDate),
    jobTitle: blank(row2.jobTitle) || blank(legacy.jobTitle),
    admissionDate: blank(row2.admissionDate) || blank(legacy.admissionDate),
    phone: blank(row2.phone)
  };
}
async function getCompanyRegistry(companyId) {
  await ensureCompanyRegistryColumns();
  const database2 = await getDb();
  const row2 = database2 ? (await database2.select().from(companies2).where(eq10(companies2.id, companyId)).limit(1))[0] : null;
  const legacy = parseLegacyLegal(await getSetting("company_legal_profile", companyId, ""));
  const registry = mergeCompany(rowToCompany(row2, blank(row2?.name)), legacy);
  const missing = companyRegistryMissing(registry);
  return { name: blank(row2?.name), registry, complete: missing.length === 0, missing, canEdit: false };
}
async function saveCompanyRegistry(companyId, input) {
  await ensureCompanyRegistryColumns();
  const database2 = await getDb();
  if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const taxDocument = onlyDigitsStr(input.taxDocument) || null;
  const addressZip = onlyDigitsStr(input.addressZip) || null;
  await database2.update(companies2).set({
    legalName: orNull(blank(input.legalName)),
    tradeName: orNull(blank(input.tradeName)),
    taxDocument,
    stateRegistration: orNull(blank(input.stateRegistration)),
    establishment: orNull(blank(input.establishment)),
    addressZip,
    addressStreet: orNull(blank(input.addressStreet)),
    addressNumber: orNull(blank(input.addressNumber)),
    addressComplement: orNull(blank(input.addressComplement)),
    addressDistrict: orNull(blank(input.addressDistrict)),
    addressCity: orNull(blank(input.addressCity)),
    addressState: orNull(blank(input.addressState).toUpperCase()),
    contactPhone: orNull(blank(input.contactPhone)),
    contactEmail: orNull(blank(input.contactEmail))
  }).where(eq10(companies2.id, companyId));
  const snapshot = toLegalSnapshot({ ...input, taxDocument: taxDocument || "", addressZip: addressZip || "" }, input.legalName);
  await setSetting("company_legal_profile", JSON.stringify({
    legalName: snapshot.legalName,
    document: snapshot.document,
    establishment: snapshot.establishment,
    address: snapshot.address
  }), companyId);
  return (await getCompanyRegistry(companyId)).registry;
}
async function getMemberRegistry(companyId, memberId) {
  await ensureCompanyRegistryColumns();
  const database2 = await getDb();
  if (!database2) return null;
  const row2 = (await database2.select().from(memberAccounts2).where(eq10(memberAccounts2.id, memberId)).limit(1))[0];
  if (!row2 || Number(row2.companyId) !== Number(companyId)) return null;
  const legacy = parseLegacyLabor(await getSetting(`labor_profile:${memberId}`, companyId, ""));
  return {
    id: row2.id,
    name: row2.userName,
    email: row2.email,
    role: String(row2.role),
    registry: rowToMember(row2, legacy)
  };
}
async function saveMemberRegistry(companyId, memberId, input) {
  await ensureCompanyRegistryColumns();
  const database2 = await getDb();
  if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const cpf = onlyDigitsStr(input.cpf) || null;
  const pis = onlyDigitsStr(input.pis) || null;
  await database2.update(memberAccounts2).set({
    cpf,
    pis,
    rg: orNull(blank(input.rg)),
    birthDate: orNull(blank(input.birthDate)),
    jobTitle: orNull(blank(input.jobTitle)),
    admissionDate: orNull(blank(input.admissionDate)),
    phone: orNull(blank(input.phone))
  }).where(eq10(memberAccounts2.id, memberId));
  const raw = await getSetting(`labor_profile:${memberId}`, companyId, "");
  let labor = {};
  try {
    labor = raw ? JSON.parse(raw) : {};
  } catch {
    labor = {};
  }
  labor = {
    ...labor,
    cpf: cpf || "",
    pis: pis || "",
    jobTitle: blank(input.jobTitle) || null,
    admissionDate: blank(input.admissionDate) || null
  };
  await setSetting(`labor_profile:${memberId}`, JSON.stringify(labor), companyId);
  const saved = await getMemberRegistry(companyId, memberId);
  return saved?.registry ?? emptyMemberRegistry();
}
async function getLegalSnapshotForCompany(companyId) {
  const data = await getCompanyRegistry(companyId);
  return { name: data.name, legal: toLegalSnapshot(data.registry, data.name) };
}
async function getLaborIdentity(companyId, memberId) {
  const data = await getMemberRegistry(companyId, memberId);
  const r = data?.registry ?? emptyMemberRegistry();
  return {
    cpf: r.cpf || null,
    pis: r.pis || null,
    jobTitle: r.jobTitle || null,
    admissionDate: r.admissionDate || null,
    phone: r.phone || null,
    rg: r.rg || null,
    birthDate: r.birthDate || null
  };
}
function actorRole(ctx) {
  if (ctx.actingAsPlatform) return "platform_admin";
  return ctx.user?.role || "";
}
var dateStr2, ready4, companyRegistryInput, memberRegistryInput, changeMyEmailInput, PROMOTER_FORBIDDEN_REGISTRY_KEYS, companyRegistryRouter;
var init_companyRegistry = __esm({
  "server/companyRegistry.ts"() {
    "use strict";
    init_schema();
    init_brDocs();
    init_registryFields();
    init_registryPermissions();
    init_db();
    init_audit();
    init_trpc();
    dateStr2 = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inv\xE1lida.").or(z2.literal(""));
    ready4 = null;
    companyRegistryInput = z2.object({
      legalName: z2.string().trim().max(200).optional().default(""),
      tradeName: z2.string().trim().max(200).optional().default(""),
      taxDocument: z2.string().trim().max(32).optional().default("").refine((v) => !v || isValidCpfOrCnpj(v), "CNPJ ou CPF inv\xE1lido: confira os n\xFAmeros."),
      stateRegistration: z2.string().trim().max(30).optional().default(""),
      establishment: z2.string().trim().max(200).optional().default(""),
      addressZip: z2.string().trim().max(16).optional().default("").refine((v) => !v || isValidCep(v), "CEP inv\xE1lido."),
      addressStreet: z2.string().trim().max(200).optional().default(""),
      addressNumber: z2.string().trim().max(20).optional().default(""),
      addressComplement: z2.string().trim().max(120).optional().default(""),
      addressDistrict: z2.string().trim().max(120).optional().default(""),
      addressCity: z2.string().trim().max(120).optional().default(""),
      addressState: z2.string().trim().max(2).optional().default("").refine((v) => !v || BR_STATES.includes(v), "Informe a UF com duas letras."),
      contactPhone: z2.string().trim().max(50).optional().default(""),
      contactEmail: z2.string().trim().max(320).optional().default("").refine((v) => !v || z2.string().email().safeParse(v).success, "E-mail de contato inv\xE1lido.")
    });
    memberRegistryInput = z2.object({
      cpf: z2.string().trim().max(14).optional().default("").refine((v) => !v || isValidCpf(v), "CPF inv\xE1lido: confira os n\xFAmeros."),
      pis: z2.string().trim().max(20).optional().default("").refine((v) => !v || isValidPis(v), "PIS/NIS inv\xE1lido: confira os n\xFAmeros."),
      rg: z2.string().trim().max(20).optional().default(""),
      birthDate: dateStr2.optional().default(""),
      jobTitle: z2.string().trim().max(120).optional().default(""),
      admissionDate: dateStr2.optional().default(""),
      phone: z2.string().trim().max(50).optional().default("")
    });
    changeMyEmailInput = z2.object({
      email: z2.string().trim().email("Informe um e-mail v\xE1lido.").max(320),
      currentPassword: z2.string().min(1, "Informe a senha atual.")
    });
    PROMOTER_FORBIDDEN_REGISTRY_KEYS = ["cpf", "pis", "rg", "birthDate", "jobTitle", "admissionDate", "phone"];
    companyRegistryRouter = router({
      company: companyManagerProcedure.query(async ({ ctx }) => {
        const data = await getCompanyRegistry(ctx.accountId);
        return { ...data, canEdit: canEditCompanyFiscal(actorRole(ctx)), addressLabel: formatCompanyAddress(data.registry) };
      }),
      status: companyAdminProcedure.query(async ({ ctx }) => {
        const data = await getCompanyRegistry(ctx.accountId);
        return { complete: data.complete, missing: data.missing };
      }),
      saveCompany: companyAdminProcedure.input(companyRegistryInput).mutation(async ({ ctx, input }) => {
        if (!canEditCompanyFiscal(actorRole(ctx))) {
          throw new TRPCError7({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode alterar os dados fiscais." });
        }
        const registry = await saveCompanyRegistry(ctx.accountId, input);
        void auditFromCtx(ctx, { action: "update", module: "users", entityType: "company_registry", entityId: ctx.accountId, description: "Atualizou os dados cadastrais da empresa", newData: { legalName: registry.legalName, taxDocument: registry.taxDocument } });
        return { success: true, registry, complete: companyRegistryComplete(registry), missing: companyRegistryMissing(registry) };
      }),
      member: companyManagerProcedure.input(z2.object({ memberId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
        const data = await getMemberRegistry(ctx.accountId, input.memberId);
        if (!data) throw new TRPCError7({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado nesta empresa." });
        return { ...data, canEdit: canEditMemberRegistry(actorRole(ctx), data.role) };
      }),
      saveMember: companyManagerProcedure.input(z2.object({ memberId: z2.number().int().positive(), profile: memberRegistryInput })).mutation(async ({ ctx, input }) => {
        const data = await getMemberRegistry(ctx.accountId, input.memberId);
        if (!data) throw new TRPCError7({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o encontrado nesta empresa." });
        if (!canEditMemberRegistry(actorRole(ctx), data.role)) {
          throw new TRPCError7({ code: "FORBIDDEN", message: memberRegistryDeniedMessage(actorRole(ctx)) });
        }
        const registry = await saveMemberRegistry(ctx.accountId, input.memberId, input.profile);
        void auditFromCtx(ctx, { action: "update", module: "users", entityType: "member_registry", entityId: input.memberId, entityLabel: data.name, description: `Atualizou dados cadastrais de ${data.name}`, newData: { cpf: registry.cpf ? "informado" : "", jobTitle: registry.jobTitle } });
        return { success: true, registry };
      }),
      myProfile: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
          return { kind: "platform", canEditRegistry: false, registry: emptyMemberRegistry(), email: ctx.user?.email || "", name: ctx.user?.name || "", role: ctx.user?.role || "" };
        }
        const data = await getMemberRegistry(ctx.accountId, ctx.memberAccountId);
        if (!data) throw new TRPCError7({ code: "NOT_FOUND", message: "Conta n\xE3o encontrada." });
        return {
          kind: "member",
          ...data,
          canEditRegistry: canEditOwnRegistry(data.role),
          canEditEmail: true
        };
      }),
      /** Promotor e demais papéis podem trocar o próprio e-mail; dados cadastrais não entram nesta rota. */
      changeMyEmail: protectedProcedure.input(changeMyEmailInput).mutation(async ({ ctx, input }) => {
        const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
        await assertPromoterNotOnVacation2(ctx);
        if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: "A conta da plataforma n\xE3o usa este e-mail." });
        }
        const database2 = await getDb();
        if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const { verifyPassword: verifyPassword2 } = await Promise.resolve().then(() => (init_memberAuth(), memberAuth_exports));
        const row2 = (await database2.select().from(memberAccounts2).where(eq10(memberAccounts2.id, ctx.memberAccountId)).limit(1))[0];
        if (!row2 || !verifyPassword2(input.currentPassword, row2.passwordHash)) {
          throw new TRPCError7({ code: "UNAUTHORIZED", message: "A senha atual est\xE1 incorreta." });
        }
        const email = input.email.trim().toLowerCase();
        try {
          await database2.update(memberAccounts2).set({ email }).where(eq10(memberAccounts2.id, ctx.memberAccountId));
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError7({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
        void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: ctx.memberAccountId, description: "Atualizou o e-mail da pr\xF3pria conta" });
        return { success: true, email };
      }),
      /** Só admin/supervisor (não promotor) editam os próprios dados cadastrais. Promotor é recusado. */
      saveMyIdentity: protectedProcedure.input(memberRegistryInput).mutation(async ({ ctx, input }) => {
        const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
        await assertPromoterNotOnVacation2(ctx);
        if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
          throw new TRPCError7({ code: "BAD_REQUEST", message: "A conta da plataforma n\xE3o tem estes dados." });
        }
        const role = actorRole(ctx);
        if (!canEditOwnRegistry(role)) {
          throw new TRPCError7({ code: "FORBIDDEN", message: memberRegistryDeniedMessage("promoter") });
        }
        const registry = await saveMemberRegistry(ctx.accountId, ctx.memberAccountId, input);
        void auditFromCtx(ctx, { action: "update", module: "users", entityType: "member_registry", entityId: ctx.memberAccountId, description: "Atualizou os pr\xF3prios dados cadastrais" });
        return { success: true, registry };
      }),
      platformGet: platformProcedure.input(z2.object({ companyId: z2.number().int().positive() })).query(async ({ input }) => {
        const data = await getCompanyRegistry(input.companyId);
        return { ...data, addressLabel: formatCompanyAddress(data.registry) };
      })
    });
  }
});

// server/modules/timesheetMirror.ts
var timesheetMirror_exports = {};
__export(timesheetMirror_exports, {
  ensureAdjustmentsTable: () => ensureAdjustmentsTable,
  recordAdjustment: () => recordAdjustment,
  timesheetMirrorRouter: () => timesheetMirrorRouter
});
import { z as z3 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
import { and as and10, eq as eq11, inArray as inArray8, sql as sql9 } from "drizzle-orm";
function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
}
async function ensureAdjustmentsTable() {
  if (adjustmentsReady) return adjustmentsReady;
  adjustmentsReady = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(`CREATE TABLE IF NOT EXISTS time_event_adjustments (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      timeEventId int NOT NULL,
      correctionRequestId int NULL,
      memberAccountId int NOT NULL,
      originalType varchar(20) NOT NULL,
      originalTime timestamp NOT NULL,
      correctedType varchar(20) NOT NULL,
      correctedTime timestamp NOT NULL,
      justification text NOT NULL,
      reviewedByMemberId int NULL,
      reviewedByName varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY time_event_adj_event_idx (companyId, timeEventId),
      KEY time_event_adj_member_idx (companyId, memberAccountId)
    )`);
  })().catch((e) => {
    adjustmentsReady = null;
    throw e;
  });
  return adjustmentsReady;
}
async function recordAdjustment(a) {
  await ensureAdjustmentsTable();
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  await database2.execute(sql9`INSERT INTO time_event_adjustments
    (companyId, timeEventId, correctionRequestId, memberAccountId, originalType, originalTime, correctedType, correctedTime, justification, reviewedByMemberId, reviewedByName)
    VALUES (${a.companyId}, ${a.timeEventId}, ${a.correctionRequestId}, ${a.memberAccountId}, ${a.originalType}, ${a.originalTime}, ${a.correctedType}, ${a.correctedTime}, ${a.justification}, ${a.reviewedByMemberId ?? null}, ${a.reviewedByName ?? null})`);
}
async function readJson(key, companyId) {
  const raw = await getSetting(key, companyId, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function companyMembers(companyId, memberIds) {
  const database2 = await getDb();
  if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const where = [eq11(memberAccounts2.companyId, companyId)];
  if (memberIds?.length) where.push(inArray8(memberAccounts2.id, memberIds));
  const rows4 = await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts2).leftJoin(promoterProfiles, eq11(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and10(...where));
  return rows4.filter((r) => r.role !== "company_admin");
}
var TZ, monthStr, dateStr3, hm, adjustmentsReady, legalSchema, laborSchema, timesheetMirrorRouter;
var init_timesheetMirror2 = __esm({
  "server/modules/timesheetMirror.ts"() {
    "use strict";
    init_brDocs();
    init_trpc();
    init_db();
    init_schema();
    init_audit();
    init_mirrorData();
    init_timeBank2();
    init_timeBank();
    init_companyRegistry();
    TZ = "America/Sao_Paulo";
    monthStr = z3.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "M\xEAs inv\xE1lido (use AAAA-MM).");
    dateStr3 = z3.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    hm = z3.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    adjustmentsReady = null;
    legalSchema = z3.object({
      legalName: z3.string().trim().max(200).optional().default(""),
      document: z3.string().trim().max(32).optional().default("").refine((v) => !v || isValidCpfOrCnpj(v), "CNPJ/CPF inv\xE1lido: confira os n\xFAmeros."),
      // CNPJ/CPF do empregador
      establishment: z3.string().trim().max(200).optional().default(""),
      address: z3.string().trim().max(300).optional().default("")
    });
    laborSchema = z3.object({
      jobTitle: z3.string().trim().max(120).nullish(),
      admissionDate: dateStr3.nullish(),
      cpf: z3.string().trim().max(14).nullish().refine((v) => !v || isValidCpf(v), "CPF inv\xE1lido: confira os n\xFAmeros."),
      pis: z3.string().trim().max(20).nullish(),
      /** Horário contratual: pares entrada/saída, ex.: [["08:00","12:00"],["13:00","17:00"]]. */
      schedule: z3.array(z3.tuple([hm, hm])).max(4).nullish(),
      dailyMinutes: z3.number().int().min(0).max(1440).nullish(),
      intervalMinutes: z3.number().int().min(0).max(600).nullish(),
      workdays: z3.array(z3.number().int().min(0).max(6)).max(7).nullish(),
      nightEnabled: z3.boolean().optional(),
      nightStart: hm.optional(),
      nightEnd: hm.optional()
    });
    timesheetMirrorRouter = router({
      /** Promotores da empresa + perfil trabalhista configurado (ou null). */
      promoters: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        const members = await companyMembers(ctx.accountId);
        const out = [];
        for (const m of members) out.push({ ...m, labor: await readJson(`labor_profile:${m.id}`, ctx.accountId) });
        return out;
      }),
      getCompanyProfile: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        const snap = await getLegalSnapshotForCompany(ctx.accountId);
        return { name: snap.name, legal: snap.legal };
      }),
      saveCompanyProfile: companyAdminFeatureProcedure("timeTracking").input(legalSchema).mutation(async ({ ctx, input }) => {
        const current = await getCompanyRegistry(ctx.accountId);
        const registry = { ...current.registry };
        registry.legalName = (input.legalName || "").trim() || registry.legalName;
        registry.taxDocument = (input.document || "").trim() || registry.taxDocument;
        registry.establishment = (input.establishment || "").trim() || registry.establishment;
        const address = (input.address || "").trim();
        if (address && !registry.addressStreet && !registry.addressCity) registry.addressStreet = address;
        await saveCompanyRegistry(ctx.accountId, registry);
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "company_legal_profile", description: "Atualizou dados de identifica\xE7\xE3o da empresa para o espelho de ponto", newData: input });
        return { success: true };
      }),
      /** Configuração do espelho: tratar Carnaval/Corpus Christi (ponto facultativo) como feriado abonado? */
      getMirrorOptions: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => loadMirrorOptions(ctx.accountId)),
      saveMirrorOptions: companyAdminFeatureProcedure("timeTracking").input(z3.object({ optionalHolidaysAsHoliday: z3.boolean() })).mutation(async ({ ctx, input }) => {
        await setSetting(OPTIONAL_HOLIDAYS_SETTING, input.optionalHolidaysAsHoliday ? "1" : "0", ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "mirror_options", description: `Carnaval/Corpus Christi ${input.optionalHolidaysAsHoliday ? "passam a ser abonados como feriado" : "deixam de ser abonados automaticamente"} no espelho de ponto`, newData: input });
        return { success: true };
      }),
      saveLaborProfile: companyAdminFeatureProcedure("timeTracking").input(z3.object({ memberId: z3.number().int().positive(), profile: laborSchema })).mutation(async ({ ctx, input }) => {
        const [member] = await companyMembers(ctx.accountId, [input.memberId]);
        if (!member) throw new TRPCError8({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado." });
        const current = await getMemberRegistry(ctx.accountId, input.memberId);
        await setSetting(`labor_profile:${input.memberId}`, JSON.stringify(input.profile), ctx.accountId);
        if (current) {
          await saveMemberRegistry(ctx.accountId, input.memberId, {
            ...current.registry,
            cpf: input.profile.cpf ?? current.registry.cpf,
            pis: input.profile.pis ?? current.registry.pis,
            jobTitle: input.profile.jobTitle ?? current.registry.jobTitle,
            admissionDate: input.profile.admissionDate ?? current.registry.admissionDate
          });
        }
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "labor_profile", entityId: input.memberId, entityLabel: member.name, description: `Atualizou perfil trabalhista de ${member.name}`, newData: input.profile });
        return { success: true };
      }),
      /** Gera os dados do espelho. Somente leitura; registra a emissão na auditoria. */
      generate: companyAdminFeatureProcedure("timeTracking").input(z3.object({ memberIds: z3.array(z3.number().int().positive()).max(500).optional(), from: dateStr3, to: dateStr3 })).query(async ({ ctx, input }) => {
        if (input.from > input.to) throw new TRPCError8({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
        const spanDays = (Date.parse(input.to) - Date.parse(input.from)) / 864e5 + 1;
        if (spanDays > 366) throw new TRPCError8({ code: "BAD_REQUEST", message: "O per\xEDodo m\xE1ximo \xE9 de 366 dias." });
        const database2 = await getDb();
        if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await ensureAdjustmentsTable();
        const members = await companyMembers(ctx.accountId, input.memberIds);
        if (input.memberIds?.length && members.length !== new Set(input.memberIds).size) throw new TRPCError8({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
        const snap = await getLegalSnapshotForCompany(ctx.accountId);
        const company = { name: snap.name };
        const legal = snap.legal;
        const memberIds = members.map((m) => m.id);
        const reports = await buildMemberReports(ctx.accountId, memberIds, input.from, input.to, TZ);
        const results = members.map((m) => {
          const r = reports.get(m.id);
          return { member: { id: m.id, name: m.name, role: m.role, employeeCode: m.employeeCode ?? null }, labor: r.labor ? { ...r.labor } : null, report: r.report };
        });
        void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "timesheet_mirror", description: `Gerou espelho de ponto ${input.from} a ${input.to} (${results.length} funcion\xE1rio(s))`, newData: { from: input.from, to: input.to, memberIds: results.map((r) => r.member.id) } });
        return { company: { name: company?.name ?? "", legal: legal ?? null }, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), timeZone: TZ, results };
      }),
      /**
       * Banco de horas da equipe (administrador da empresa): saldo do mês de cada funcionário, com a mesma regra do
       * promotor (closedPeriodBalance) e do espelho (buildMirror). Sempre restrito à empresa da sessão.
       */
      teamTimeBank: companyAdminFeatureProcedure("timeTracking").input(z3.object({ month: monthStr })).query(async ({ ctx, input }) => {
        const { from, to } = monthBounds(input.month);
        const today = todayIn(TZ);
        const members = await companyMembers(ctx.accountId);
        const reports = await buildMemberReports(ctx.accountId, members.map((m) => m.id), from, to, TZ);
        const rows4 = members.map((m) => {
          const r = reports.get(m.id);
          return { id: m.id, name: m.name, active: Boolean(m.active), employeeCode: m.employeeCode ?? null, lastEventAt: r.lastEventAt, ...closedPeriodBalance(r.report, r.labor, today) };
        }).filter((r) => r.active || r.daysTracked > 0);
        return { month: input.month, from, to, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), rows: rows4 };
      }),
      /** Detalhe diário do banco de horas de UM funcionário da empresa (previsto x trabalhado, extra/débito). */
      memberTimeBank: companyAdminFeatureProcedure("timeTracking").input(z3.object({ memberId: z3.number().int().positive(), month: monthStr })).query(async ({ ctx, input }) => {
        const [member] = await companyMembers(ctx.accountId, [input.memberId]);
        if (!member) throw new TRPCError8({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
        const { from, to } = monthBounds(input.month);
        const r = (await buildMemberReports(ctx.accountId, [member.id], from, to, TZ)).get(member.id);
        const days = r.report.days.map((d) => ({ date: d.date, weekday: d.weekday, workedMinutes: d.workedMinutes, expectedMinutes: d.expectedMinutes, diffMinutes: d.diffMinutes, marks: d.marks.map((m) => ({ type: m.type, label: m.label, time: m.time, kind: m.kind })), issues: d.issues, holiday: d.holiday ?? null, excuse: d.excuse?.label ?? null, vacation: Boolean(d.vacation) }));
        return { member: { id: member.id, name: member.name, employeeCode: member.employeeCode ?? null }, month: input.month, lastEventAt: r.lastEventAt, balance: closedPeriodBalance(r.report, r.labor, todayIn(TZ)), days, notes: r.report.notes };
      }),
      /** Registra no log de auditoria que o espelho foi exportado/impresso/compartilhado. */
      logExport: companyAdminFeatureProcedure("timeTracking").input(z3.object({ kind: z3.enum(["pdf", "xlsx", "print", "whatsapp"]), from: dateStr3, to: dateStr3, count: z3.number().int().min(1).max(500) })).mutation(async ({ ctx, input }) => {
        void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "timesheet_mirror", description: `Exportou espelho de ponto (${input.kind}) ${input.from} a ${input.to}, ${input.count} funcion\xE1rio(s)`, newData: input });
        return { success: true };
      })
    });
  }
});

// server/missingPunch.ts
var missingPunch_exports = {};
__export(missingPunch_exports, {
  findMissingPunches: () => findMissingPunches
});
import { inArray as inArray9, sql as sql10 } from "drizzle-orm";
function local(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ2, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
async function findMissingPunches(opts = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  await ensurePunchLedger();
  const since = new Date(Date.now() - 14 * 864e5);
  const filters = [sql10`COALESCE(te.deviceTime, te.serverTime) >= ${since}`];
  if (opts.companyId) filters.push(sql10`te.companyId = ${opts.companyId}`);
  if (opts.memberId) filters.push(sql10`te.memberAccountId = ${opts.memberId}`);
  const where = sql10.join(filters, sql10` AND `);
  const [raw] = await database2.execute(sql10`
    SELECT te.id, te.companyId, te.memberAccountId, te.eventType, te.serverTime, te.deviceTime
    FROM time_events te
    JOIN (
      SELECT id AS maxId FROM (
        SELECT te.id, ROW_NUMBER() OVER (PARTITION BY te.memberAccountId ORDER BY COALESCE(te.deviceTime, te.serverTime) DESC, te.id DESC) AS rn
        FROM time_events te
        WHERE ${where} AND NOT EXISTS (SELECT 1 FROM time_events r WHERE r.companyId = te.companyId AND r.replacesEventId = te.id)
      ) ranked WHERE ranked.rn = 1
    ) lastev ON lastev.maxId = te.id
    WHERE te.eventType <> 'clock_out'`);
  const open = raw.map((r) => ({ companyId: Number(r.companyId), memberAccountId: Number(r.memberAccountId), eventType: String(r.eventType), t: new Date(r.deviceTime || r.serverTime) }));
  if (!open.length) return [];
  const ids = open.map((o) => o.memberAccountId);
  const members = await database2.select({ id: memberAccounts2.id, companyId: memberAccounts2.companyId, name: memberAccounts2.userName, email: memberAccounts2.email, phone: memberAccounts2.phone, active: memberAccounts2.active }).from(memberAccounts2).where(inArray9(memberAccounts2.id, ids));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const profiles = await database2.select({ id: promoterProfiles.memberAccountId, end: promoterProfiles.workEndTime }).from(promoterProfiles).where(inArray9(promoterProfiles.memberAccountId, ids));
  const endByMember = new Map(profiles.map((p) => [p.id, p.end]));
  const companyIds = [...new Set(open.map((o) => o.companyId))];
  const [settingRows] = await database2.execute(sql10`SELECT accountId, settingValue FROM system_settings WHERE settingKey = 'auto_clock_out_time' AND accountId IN (${sql10.join(companyIds.map((c) => sql10`${c}`), sql10`, `)})`);
  const limitByCompany = new Map(settingRows.map((r) => [Number(r.accountId), String(r.settingValue)]));
  const now = local(/* @__PURE__ */ new Date());
  const out = [];
  for (const e of open) {
    const member = memberById.get(e.memberAccountId);
    if (!member?.active || member.companyId !== e.companyId) continue;
    const lt7 = local(e.t);
    let reason = null;
    if (lt7.date < now.date) reason = "previous_day";
    else {
      const limit = endByMember.get(e.memberAccountId) || limitByCompany.get(e.companyId) || "";
      if (limit && now.hm >= limit && lt7.hm < limit) reason = "past_end_time";
    }
    if (!reason) continue;
    out.push({ memberId: e.memberAccountId, companyId: e.companyId, name: member.name, email: member.email, phone: member.phone ?? null, lastType: e.eventType, lastLabel: LABEL[e.eventType] ?? e.eventType, missing: NEXT[e.eventType] ?? "Sa\xEDda", lastTime: e.t.toISOString(), day: lt7.date, reason });
  }
  return out;
}
var TZ2, LABEL, NEXT;
var init_missingPunch = __esm({
  "server/missingPunch.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_ledger();
    TZ2 = "America/Sao_Paulo";
    LABEL = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo" };
    NEXT = { clock_in: "Sa\xEDda (ou intervalo)", break_start: "Retorno do intervalo e Sa\xEDda", break_end: "Sa\xEDda" };
  }
});

// shared/correctionCalendar.ts
function journeyIsIncomplete(punches) {
  let openIn = false;
  let openBreak = false;
  for (const type of punches) {
    if (type === "clock_in") {
      if (openIn) return true;
      openIn = true;
    } else if (type === "break_start") {
      if (openBreak || !openIn) return true;
      openIn = false;
      openBreak = true;
    } else if (type === "break_end") {
      if (!openBreak) return true;
      openBreak = false;
      openIn = true;
    } else if (type === "clock_out") {
      if (!openIn) return true;
      openIn = false;
    }
  }
  return openBreak || openIn;
}
function todayIncompleteShouldAlert(opts) {
  const limit = (opts.workEndTime || "").trim();
  const nowHm = opts.nowHm || "";
  if (!limit || !nowHm || nowHm < limit) return false;
  const last = opts.lastPunchHm || "";
  if (last && last >= limit) return false;
  return true;
}
function classifyCorrectionDay(facts) {
  if (facts.date > facts.today) return { mark: "ok" };
  if (facts.hasPendingCorrection) return { mark: "pending", reason: "Corre\xE7\xE3o j\xE1 pedida" };
  if (facts.excused && (facts.punches.length === 0 || !facts.autoHoliday)) return { mark: "ok" };
  const incomplete = facts.punches.length > 0 && journeyIsIncomplete(facts.punches);
  const missingOnWorkday = facts.punches.length === 0 && facts.isWorkday === true && !facts.excused;
  const isToday = facts.date === facts.today;
  if (isToday) {
    if (incomplete && todayIncompleteShouldAlert({ workEndTime: facts.workEndTime, nowHm: facts.nowHm, lastPunchHm: facts.lastPunchHm })) {
      return { mark: "needs_correction", reason: "Jornada incompleta" };
    }
    if (missingOnWorkday && todayIncompleteShouldAlert({ workEndTime: facts.workEndTime, nowHm: facts.nowHm, lastPunchHm: "00:00" })) {
      return { mark: "needs_correction", reason: "Batida faltando" };
    }
    return { mark: "ok" };
  }
  if (incomplete) return { mark: "needs_correction", reason: "Jornada incompleta" };
  if (missingOnWorkday) return { mark: "needs_correction", reason: "Falta" };
  return { mark: "ok" };
}
var init_correctionCalendar = __esm({
  "shared/correctionCalendar.ts"() {
    "use strict";
  }
});

// server/correctionCalendar.ts
import { and as and11, eq as eq12, gte as gte7, lte as lte5, sql as sql11 } from "drizzle-orm";
function localParts3(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ3,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, month: `${p.year}-${p.month}` };
}
function daysInMonth(month) {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}
function weekdayOf2(date3) {
  const [y, m, d] = date3.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
async function getMyCorrectionCalendarDays(opts) {
  const now = localParts3(opts.now ?? /* @__PURE__ */ new Date());
  const month = opts.month;
  const from = `${month}-01`;
  const to = daysInMonth(month).at(-1);
  await ensureCorrectionExtras();
  const [events, vacationsMap, options, laborRaw, memberRow, corrections] = await Promise.all([
    loadMirrorEventRows(opts.companyId, [opts.memberId], from, to),
    loadMemberVacations(opts.companyId, [opts.memberId], from, to),
    loadMirrorOptions(opts.companyId),
    getSetting(`labor_profile:${opts.memberId}`, opts.companyId, ""),
    loadWorkEnd(opts.companyId, opts.memberId),
    loadMonthCorrections(opts.companyId, opts.memberId, from, to)
  ]);
  let labor = null;
  try {
    labor = laborRaw ? JSON.parse(laborRaw) : null;
  } catch {
    labor = null;
  }
  const workdays = labor?.workdays && labor.workdays.length ? new Set(labor.workdays) : null;
  const admission = (labor?.admissionDate || memberRow.admissionDate || "").slice(0, 10);
  const workEndTime = memberRow.workEndTime || memberRow.companyLimit || null;
  const vacations = vacationsMap.get(opts.memberId) || [];
  const punchesByDay = /* @__PURE__ */ new Map();
  for (const ev of events) {
    if (ev.disregard) continue;
    const t2 = new Date(ev.deviceTime || ev.time || ev.serverTime);
    if (Number.isNaN(t2.getTime())) continue;
    const loc = localParts3(t2);
    if (loc.date < from || loc.date > to) continue;
    const type = ev.eventType || ev.type;
    if (!type) continue;
    const list = punchesByDay.get(loc.date) || [];
    list.push({ type, hm: loc.hm });
    punchesByDay.set(loc.date, list);
  }
  for (const list of punchesByDay.values()) list.sort((a, b) => a.hm.localeCompare(b.hm));
  const days = daysInMonth(month).map((date3) => {
    if (admission && date3 < admission) return { date: date3, mark: "ok" };
    const onVacation = vacations.some((v) => date3 >= v.startDate && date3 <= v.endDate);
    const rawHoliday = getBrazilianHoliday(date3);
    const holiday = rawHoliday && (!rawHoliday.optional || options.optionalHolidaysAsHoliday) ? rawHoliday : null;
    const punches = punchesByDay.get(date3) || [];
    const dayCorrections = corrections.filter((c) => c.day === date3);
    const hasPending = dayCorrections.some((c) => c.status === "pending");
    const approvedExcuse = dayCorrections.some((c) => c.status === "approved" && c.excuse);
    const excused = Boolean(holiday || onVacation || approvedExcuse);
    const classified = classifyCorrectionDay({
      date: date3,
      today: now.date,
      punches: punches.map((p) => p.type),
      hasPendingCorrection: hasPending,
      excused,
      autoHoliday: Boolean(holiday),
      isWorkday: workdays ? workdays.has(weekdayOf2(date3)) : null,
      workEndTime,
      nowHm: now.hm,
      lastPunchHm: punches.at(-1)?.hm ?? null
    });
    return { date: date3, mark: classified.mark, reason: classified.reason, holiday: holiday?.name ?? null };
  });
  return {
    month,
    today: now.date,
    nowHm: now.hm,
    days,
    needsCorrectionCount: days.filter((d) => d.mark === "needs_correction").length
  };
}
async function loadWorkEnd(companyId, memberId) {
  const database2 = await getDb();
  if (!database2) return { workEndTime: null, companyLimit: null, admissionDate: null };
  const [profile] = await database2.select({
    workEndTime: promoterProfiles.workEndTime
  }).from(promoterProfiles).where(and11(eq12(promoterProfiles.companyId, companyId), eq12(promoterProfiles.memberAccountId, memberId))).limit(1);
  const [member] = await database2.select({
    admissionDate: memberAccounts2.admissionDate
  }).from(memberAccounts2).where(and11(eq12(memberAccounts2.id, memberId), eq12(memberAccounts2.companyId, companyId))).limit(1);
  const companyLimit = (await getSetting("auto_clock_out_time", companyId, "")).trim() || null;
  const admission = member?.admissionDate ? String(member.admissionDate).slice(0, 10) : null;
  return { workEndTime: profile?.workEndTime || null, companyLimit, admissionDate: admission };
}
async function loadMonthCorrections(companyId, memberId, from, to) {
  const database2 = await getDb();
  if (!database2) return [];
  const start = /* @__PURE__ */ new Date(`${from}T00:00:00-03:00`);
  const end = /* @__PURE__ */ new Date(`${to}T23:59:59.999-03:00`);
  const rows4 = await database2.select({
    requestedTime: timeCorrectionRequests.requestedTime,
    status: timeCorrectionRequests.status,
    justificationType: timeCorrectionRequests.justificationType,
    justification: timeCorrectionRequests.justification,
    timeEventId: timeCorrectionRequests.timeEventId
  }).from(timeCorrectionRequests).where(and11(
    eq12(timeCorrectionRequests.companyId, companyId),
    eq12(timeCorrectionRequests.memberAccountId, memberId),
    sql11`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
    gte7(timeCorrectionRequests.requestedTime, start),
    lte5(timeCorrectionRequests.requestedTime, end)
  ));
  return rows4.map((r) => ({
    day: excuseDay(r.requestedTime),
    status: String(r.status),
    excuse: looksLikeFullDayExcuse(r)
  }));
}
var TZ3;
var init_correctionCalendar2 = __esm({
  "server/correctionCalendar.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_holidays();
    init_correctionExcuse();
    init_correctionCalendar();
    init_mirrorData();
    init_correctionExtras();
    TZ3 = "America/Sao_Paulo";
  }
});

// shared/saoPauloDay.ts
function saoPauloDayRange(date3) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date3)) throw new Error("Data inv\xE1lida.");
  const start = /* @__PURE__ */ new Date(`${date3}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1e3);
  return { start, end };
}
function hasPendingSamePunch(existing, opts) {
  return existing.some((row2) => {
    if (row2.status && row2.status !== "pending") return false;
    if (opts.dayOf(row2.requestedTime) !== opts.day) return false;
    if (opts.fullDay) return Boolean(row2.isFullDay);
    if (row2.isFullDay) return false;
    return row2.requestedType === opts.requestedType && (row2.timeEventId ?? null) === (opts.timeEventId ?? null);
  });
}
var init_saoPauloDay = __esm({
  "shared/saoPauloDay.ts"() {
    "use strict";
  }
});

// shared/correctionGroups.ts
function defaultCorrectionJustification(input) {
  if (input.fullDay) return input.fullDayLabel || "Abono";
  if (input.justificationType === "other") return "";
  if (input.justificationType === "holiday") return "Feriado";
  if (input.justificationType === "day_off") return "Folga";
  if (input.justificationType === "medical_certificate") return "Atestado m\xE9dico";
  return input.timeEventId ? "Hor\xE1rio incorreto" : "Esquecimento";
}
function justificationRequiresText(justificationType) {
  return (justificationType || "normal") === "other";
}
var init_correctionGroups = __esm({
  "shared/correctionGroups.ts"() {
    "use strict";
  }
});

// shared/punchOrder.ts
function hhmm(t2, timeZone) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(ms(t2)));
}
function punchOrderError(existing, change, timeZone = "America/Sao_Paulo") {
  const all = existing.filter((p) => change.replaceId == null || p.id !== change.replaceId).concat([{ type: change.type, time: change.time }]);
  const t2 = ms(change.time);
  for (const other of all) {
    if (other === all[all.length - 1]) continue;
    const a = PUNCH_ORDER.indexOf(other.type), b = PUNCH_ORDER.indexOf(change.type);
    if (a === b) continue;
    const ot = ms(other.time);
    if (a < b && ot >= t2) return `${PUNCH_LABEL2[change.type]} (${hhmm(t2, timeZone)}) precisa ser depois de ${PUNCH_LABEL2[other.type]} (${hhmm(ot, timeZone)}). Confira o hor\xE1rio.`;
    if (a > b && ot <= t2) return `${PUNCH_LABEL2[change.type]} (${hhmm(t2, timeZone)}) precisa ser antes de ${PUNCH_LABEL2[other.type]} (${hhmm(ot, timeZone)}). Confira o hor\xE1rio.`;
  }
  return null;
}
var PUNCH_ORDER, PUNCH_LABEL2, ms;
var init_punchOrder = __esm({
  "shared/punchOrder.ts"() {
    "use strict";
    PUNCH_ORDER = ["clock_in", "break_start", "break_end", "clock_out"];
    PUNCH_LABEL2 = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
    ms = (t2) => t2 instanceof Date ? t2.getTime() : new Date(t2).getTime();
  }
});

// shared/personalPonto.ts
function hasPersonalTimeClock(role) {
  return Boolean(role) && role !== "company_admin" && role !== "supervisor" && role !== "platform_admin";
}
var ADMIN_NO_PUNCH_MESSAGE;
var init_personalPonto = __esm({
  "shared/personalPonto.ts"() {
    "use strict";
    ADMIN_NO_PUNCH_MESSAGE = "O administrador da empresa e o supervisor n\xE3o registram ponto. Use as telas de ponto da equipe.";
  }
});

// server/modules/offlineSync.ts
import { sql as sql12 } from "drizzle-orm";
import { z as z4 } from "zod";
function resolveOfflineTime(input) {
  const device = input.deviceTime ? new Date(input.deviceTime) : null;
  const decision = resolvePunchTime({ deviceTime: device, serverNow: input.serverNow, offline: input.offline });
  const isOffline = decision.alert === "offline";
  const assessment = device && input.offline ? assessDeviceClock(device, input.clock, input.serverNow) : null;
  return {
    effectiveTime: decision.effectiveTime,
    offline: isOffline,
    clockAlert: device && assessment ? clockAlertNote(device, assessment) : null,
    timeNote: decision.alert === "server_time_used" ? decision.note : null
  };
}
function ensureOfflineSubmissions() {
  if (ready5) return ready5;
  ready5 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql12.raw(`CREATE TABLE IF NOT EXISTS offline_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NULL,
      clientId VARCHAR(64) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      entityId INT NULL,
      deviceTime TIMESTAMP NULL,
      receivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      offline TINYINT(1) NOT NULL DEFAULT 0,
      alert TEXT NULL,
      UNIQUE KEY offline_submissions_client_unique (companyId, clientId),
      KEY offline_submissions_entity_idx (companyId, kind, entityId)
    )`));
  })().catch((error) => {
    ready5 = null;
    throw error;
  });
  return ready5;
}
async function findSubmission(companyId, clientId) {
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return null;
  const [rows4] = await database2.execute(sql12`SELECT kind, entityId FROM offline_submissions WHERE companyId = ${companyId} AND clientId = ${clientId} LIMIT 1`);
  const r = rows4?.[0];
  return r ? { kind: String(r.kind), entityId: r.entityId == null ? null : Number(r.entityId) } : null;
}
async function recordSubmission(input) {
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return;
  await database2.execute(sql12`INSERT IGNORE INTO offline_submissions (companyId, memberAccountId, clientId, kind, entityId, deviceTime, offline, alert)
    VALUES (${input.companyId}, ${input.memberAccountId}, ${input.clientId}, ${input.kind}, ${input.entityId}, ${input.deviceTime}, ${input.offline ? 1 : 0}, ${input.alert})`);
}
async function listVisitOfflineMarks(companyId, visitIds) {
  const ids = visitIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (!ids.length) return [];
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return [];
  const [rows4] = await database2.execute(sql12`SELECT kind, entityId, offline, deviceTime, receivedAt, alert FROM offline_submissions
    WHERE companyId = ${companyId} AND kind IN ('visit_start', 'visit_complete') AND entityId IN (${sql12.join(ids.map((id3) => sql12`${id3}`), sql12`, `)})`);
  return (rows4 || []).filter((r) => Number(r.offline) === 1 || r.alert).map((r) => ({
    visitId: Number(r.entityId),
    phase: r.kind === "visit_start" ? "start" : "complete",
    offline: Number(r.offline) === 1,
    deviceTime: r.deviceTime ? new Date(r.deviceTime).toISOString() : null,
    receivedAt: new Date(r.receivedAt).toISOString(),
    alert: r.alert ?? null
  }));
}
var clockEvidenceSchema, offlineVisitFields, ready5;
var init_offlineSync = __esm({
  "server/modules/offlineSync.ts"() {
    "use strict";
    init_db();
    init_punchTime();
    init_offlineClock();
    clockEvidenceSchema = z4.object({
      anchorServerTime: z4.string().datetime().nullish(),
      anchorDeviceTime: z4.string().datetime().nullish(),
      monoElapsedMs: z4.number().finite().nonnegative().nullish()
    }).optional();
    offlineVisitFields = {
      clientId: z4.string().min(8).max(64).optional(),
      deviceTime: z4.string().datetime().optional(),
      offline: z4.boolean().optional(),
      clock: clockEvidenceSchema
    };
    ready5 = null;
  }
});

// server/modules/timeTracking.ts
import { z as z5 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
import { eq as eq13, and as and12, desc as desc2, gte as gte8, lt as lt4, lte as lte6, inArray as inArray10, sql as sql13 } from "drizzle-orm";
async function safeAdjustment(data) {
  try {
    await recordAdjustment(data);
  } catch (error) {
    console.error("adjustment log failed", error);
  }
}
function localDay(date3, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date3);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return date3.toISOString().slice(0, 10);
  }
}
function isValidTransition(last, next) {
  if (!last) return next === "clock_in";
  const transitions = {
    clock_in: ["break_start", "clock_out"],
    break_start: ["break_end"],
    break_end: ["break_start", "clock_out"],
    clock_out: ["clock_in"]
  };
  return transitions[last].includes(next);
}
async function applyApprovedCorrection(database2, request, ctx, opts) {
  if (looksLikeFullDayExcuse(request)) return;
  await ensurePunchLedger();
  const decidedByName = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
  if (request.timeEventId) {
    const event = (await database2.select().from(timeEvents).where(and12(eq13(timeEvents.id, request.timeEventId), eq13(timeEvents.companyId, ctx.accountId))).limit(1))[0];
    if (!event) {
      if (opts?.skipMissing) return;
      throw new TRPCError9({ code: "NOT_FOUND", message: "A marca\xE7\xE3o original n\xE3o foi encontrada." });
    }
    const already = await database2.select({ id: timeEvents.id }).from(timeEvents).where(and12(eq13(timeEvents.companyId, ctx.accountId), eq13(timeEvents.replacesEventId, event.id))).limit(1);
    if (already[0]) {
      if (opts?.skipMissing) return;
      throw new TRPCError9({ code: "CONFLICT", message: "Esta marca\xE7\xE3o j\xE1 foi corrigida. Pe\xE7a a corre\xE7\xE3o sobre a marca\xE7\xE3o atual." });
    }
    const originalTime = event.deviceTime || event.serverTime;
    const newId = await appendTreatment(database2, {
      companyId: ctx.accountId,
      memberAccountId: event.memberAccountId,
      kind: "adjustment",
      replacesEventId: event.id,
      eventType: request.requestedType,
      markedAt: request.requestedTime,
      reason: request.justification,
      correctionRequestId: request.id,
      decidedByMemberId: ctx.memberAccountId ?? null,
      decidedByName,
      notes: `Ajuste aprovado. Original preservada: ${event.eventType} em ${originalTime.toISOString()} (registro #${event.id}${event.nsr ? `, NSR ${event.nsr}` : ""}).`,
      timeZone: event.timeZone || void 0
    });
    await safeAdjustment({ companyId: ctx.accountId, timeEventId: newId, correctionRequestId: request.id, memberAccountId: event.memberAccountId, originalType: event.eventType, originalTime, correctedType: request.requestedType, correctedTime: request.requestedTime, justification: request.justification, reviewedByMemberId: ctx.memberAccountId ?? null, reviewedByName: ctx.user?.name ?? null });
    return;
  }
  const newEventId = await appendTreatment(database2, {
    companyId: request.companyId,
    memberAccountId: request.memberAccountId,
    kind: "inclusion",
    replacesEventId: null,
    eventType: request.requestedType,
    markedAt: request.requestedTime,
    reason: request.justification,
    correctionRequestId: request.id,
    decidedByMemberId: ctx.memberAccountId ?? null,
    decidedByName,
    notes: `Batida inclu\xEDda por solicita\xE7\xE3o aprovada (n\xE3o \xE9 marca\xE7\xE3o original do funcion\xE1rio).`
  });
  if (newEventId) {
    await safeAdjustment({
      companyId: ctx.accountId,
      timeEventId: newEventId,
      correctionRequestId: request.id,
      memberAccountId: request.memberAccountId,
      originalType: "missing",
      originalTime: request.requestedTime,
      correctedType: request.requestedType,
      correctedTime: request.requestedTime,
      justification: request.justification,
      reviewedByMemberId: ctx.memberAccountId ?? null,
      reviewedByName: ctx.user?.name ?? null
    });
  }
}
var inFlightCorrections, timeEventType, timeTrackingRouter;
var init_timeTracking = __esm({
  "server/modules/timeTracking.ts"() {
    "use strict";
    init_mediaKeys();
    init_uploadLimits();
    init_trpc();
    init_db();
    init_schema();
    init_audit();
    init_timesheetMirror2();
    init_missingPunch();
    init_correctionCalendar2();
    init_correctionExtras();
    init_storage();
    init_punchTime();
    init_mirrorData();
    init_inclusionSupersede();
    init_timeBank2();
    init_timeBank();
    init_dayTreatments();
    init_correctionExcuse();
    init_saoPauloDay();
    init_correctionGroups();
    init_punchOrder();
    init_personalPonto();
    init_ledger();
    init_mirrorData();
    init_offlineSync();
    init_offlineClock();
    inFlightCorrections = /* @__PURE__ */ new Set();
    timeEventType = z5.enum(["clock_in", "break_start", "break_end", "clock_out"]);
    timeTrackingRouter = router({
      shiftStatus: commercialFeatureProcedure("timeTracking").input(z5.object({ timeZone: z5.string().min(1).default("UTC") }).optional()).query(async ({ ctx, input }) => {
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        const timeZone = input?.timeZone || "UTC";
        if (!companyId || !memberId) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
        const database2 = await getDb();
        if (!database2) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
        const today = localDay(/* @__PURE__ */ new Date(), timeZone);
        await ensurePunchLedger();
        const events = await effectiveRows(await database2.select().from(timeEvents).where(and12(eq13(timeEvents.memberAccountId, memberId), eq13(timeEvents.companyId, companyId))).orderBy(desc2(effectiveEventTime)).limit(100));
        const todayEvents = events.filter((event) => localDay(event.deviceTime || event.serverTime, timeZone) === today);
        const last = todayEvents[0];
        const active = Boolean(last && last.eventType !== "clock_out");
        return { status: active ? "active" : last?.eventType === "clock_out" ? "closed" : "clock_in_required", active, timeZone, localDate: today, lastEvent: last?.eventType || null };
      }),
      companyToday: companyAdminFeatureProcedure("timeTracking").input(z5.object({ timeZone: z5.string().min(1).max(128).default("UTC") }).optional()).query(async ({ ctx, input }) => {
        const database2 = await getDb();
        if (!database2) return [];
        const timeZone = input?.timeZone || "UTC";
        const today = localDay(/* @__PURE__ */ new Date(), timeZone);
        const since = new Date(Date.now() - 36 * 60 * 60 * 1e3);
        await ensurePunchLedger();
        const rawRows = await database2.select({
          id: timeEvents.id,
          companyId: timeEvents.companyId,
          promoterId: memberAccounts2.id,
          promoterName: memberAccounts2.userName,
          eventType: timeEvents.eventType,
          serverTime: timeEvents.serverTime,
          deviceTime: timeEvents.deviceTime,
          latitude: timeEvents.latitude,
          longitude: timeEvents.longitude,
          accuracy: timeEvents.accuracy
        }).from(timeEvents).innerJoin(memberAccounts2, and12(
          eq13(timeEvents.memberAccountId, memberAccounts2.id),
          eq13(memberAccounts2.companyId, ctx.accountId)
        )).where(and12(
          eq13(timeEvents.companyId, ctx.accountId),
          eq13(memberAccounts2.role, "promoter"),
          gte8(timeEvents.serverTime, since)
        )).orderBy(desc2(timeEvents.serverTime)).limit(5e3);
        const rows4 = await effectiveRows(rawRows);
        const eventsByPromoter = /* @__PURE__ */ new Map();
        for (const row2 of rows4) {
          if (localDay(row2.deviceTime || row2.serverTime, timeZone) !== today) continue;
          const promoterEvents = eventsByPromoter.get(row2.promoterId) || [];
          promoterEvents.push(row2);
          eventsByPromoter.set(row2.promoterId, promoterEvents);
        }
        const presence = [];
        for (const [promoterId, promoterEvents] of eventsByPromoter) {
          const chronological = [...promoterEvents].sort((a, b) => (a.deviceTime || a.serverTime).getTime() - (b.deviceTime || b.serverTime).getTime());
          const entry = chronological.find((event) => event.eventType === "clock_in");
          const last = chronological[chronological.length - 1];
          if (!entry || !last) continue;
          presence.push({
            promoterId,
            promoterName: entry.promoterName,
            clockInTime: entry.deviceTime || entry.serverTime,
            lastEventType: last.eventType,
            lastEventTime: last.deviceTime || last.serverTime,
            active: last.eventType === "clock_in" || last.eventType === "break_end",
            latitude: entry.latitude,
            longitude: entry.longitude,
            accuracy: entry.accuracy
          });
        }
        return presence.sort((a, b) => b.clockInTime.getTime() - a.clockInTime.getTime());
      }),
      registerEvent: commercialFeatureProcedure("timeTracking").input(z5.object({
        eventType: timeEventType,
        deviceTime: z5.string().datetime().optional(),
        /** true quando a marcação foi guardada sem internet e está sendo sincronizada agora. */
        offline: z5.boolean().optional(),
        latitude: z5.number().min(-90).max(90),
        longitude: z5.number().min(-180).max(180),
        accuracy: z5.number().finite().nonnegative().max(1e4),
        locationStatus: z5.literal("success"),
        locationError: z5.string().optional(),
        deviceInfo: z5.string().optional(),
        idempotencyKey: z5.string().min(1).max(64).optional(),
        timeZone: z5.string().min(1),
        notes: z5.string().optional(),
        /** Evidência do relógio do aparelho (âncora com o servidor + tempo monotônico) para marcações offline. */
        clock: clockEvidenceSchema
      })).mutation(async ({ ctx, input }) => {
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        if (!companyId || !memberId) throw new TRPCError9({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        if (!hasPersonalTimeClock(ctx.user?.role)) throw new TRPCError9({ code: "FORBIDDEN", message: ADMIN_NO_PUNCH_MESSAGE });
        if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || !Number.isFinite(input.accuracy) || input.locationStatus !== "success") {
          throw new TRPCError9({ code: "BAD_REQUEST", message: "O ponto s\xF3 pode ser registrado ap\xF3s obter uma localiza\xE7\xE3o GPS v\xE1lida." });
        }
        const database2 = await getDb();
        if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await ensurePunchLedger();
        if (input.idempotencyKey) {
          const existing = await database2.select().from(timeEvents).where(eq13(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
          if (existing[0]) {
            if (Number(existing[0].companyId) !== companyId || Number(existing[0].memberAccountId) !== memberId) {
              throw new TRPCError9({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
            }
            return existing[0];
          }
        }
        const punchTime = resolvePunchTime({ deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, serverNow: /* @__PURE__ */ new Date(), offline: input.offline });
        const today = localDay(punchTime.effectiveTime, input.timeZone);
        const recent = await effectiveRows(await database2.select().from(timeEvents).where(and12(eq13(timeEvents.memberAccountId, memberId), eq13(timeEvents.companyId, companyId))).orderBy(desc2(effectiveEventTime)).limit(100));
        const effectiveMs = punchTime.effectiveTime.getTime();
        const todayEvents = recent.filter((event) => localDay(event.deviceTime || event.serverTime, input.timeZone) === today && (event.deviceTime || event.serverTime).getTime() <= effectiveMs);
        const lastToday = todayEvents[0]?.eventType;
        const isOfflinePunch = punchTime.alert === "offline";
        const clockNote = isOfflinePunch && input.deviceTime ? clockAlertNote(new Date(input.deviceTime), assessDeviceClock(new Date(input.deviceTime), input.clock, /* @__PURE__ */ new Date())) : null;
        const newShiftSameDay = input.eventType === "clock_in" && lastToday === "clock_out";
        const sequenceOk = !(input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) && isValidTransition(lastToday, input.eventType);
        const offlineSequenceNote = !sequenceOk && isOfflinePunch ? `${OFFLINE_SEQUENCE_MARKER} Marca\xE7\xE3o offline fora da sequ\xEAncia esperada (anterior: ${lastToday ?? "nenhuma"}). Conferir com o funcion\xE1rio.` : null;
        const notesWithAlert = [input.notes, punchTime.note, clockNote, offlineSequenceNote, newShiftSameDay ? `${NEW_SHIFT_MARKER} Nova entrada registrada depois da sa\xEDda no mesmo dia.` : null].filter(Boolean).join("\n") || void 0;
        if (!sequenceOk && !isOfflinePunch) {
          if (input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) throw new TRPCError9({ code: "BAD_REQUEST", message: "Bata a entrada antes de registrar este evento." });
          throw new TRPCError9({ code: "BAD_REQUEST", message: "Sequ\xEAncia de marca\xE7\xE3o inv\xE1lida. Confira o \xFAltimo evento do ponto." });
        }
        let insertedId;
        try {
          insertedId = await appendOriginalPunch({
            companyId,
            memberAccountId: memberId,
            eventType: input.eventType,
            deviceTimeToStore: punchTime.deviceTimeToStore,
            clientTime: input.deviceTime ? new Date(input.deviceTime) : null,
            latitude: input.latitude,
            longitude: input.longitude,
            accuracy: input.accuracy,
            locationStatus: "success",
            locationError: input.locationError,
            deviceInfo: input.deviceInfo,
            idempotencyKey: input.idempotencyKey,
            notes: notesWithAlert,
            timeZone: input.timeZone,
            offline: punchTime.alert === "offline"
          });
        } catch (error) {
          const duplicate = error?.code === "ER_DUP_ENTRY" || /duplicate entry/i.test(String(error?.message ?? error?.cause?.message ?? ""));
          if (!duplicate || !input.idempotencyKey) throw error;
          const existing = await database2.select().from(timeEvents).where(eq13(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
          if (existing[0] && Number(existing[0].companyId) === companyId && Number(existing[0].memberAccountId) === memberId) {
            return existing[0];
          }
          throw new TRPCError9({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
        }
        const insertedRows = await database2.select().from(timeEvents).where(eq13(timeEvents.id, insertedId)).limit(1);
        const inserted = insertedRows[0];
        if (!inserted) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a marca\xE7\xE3o criada." });
        await auditFromCtx(ctx, {
          action: "create",
          module: "time_tracking",
          entityType: "time_event",
          entityId: inserted.id,
          description: `Marca\xE7\xE3o de ponto (NSR ${inserted.nsr ?? "?"}): ${input.eventType}${newShiftSameDay ? " \u2014 nova entrada ap\xF3s sa\xEDda no mesmo dia" : ""}${punchTime.alert === "server_time_used" ? ` \u2014 ALERTA: ${punchTime.note?.replace(TIME_ALERT_MARKER, "").trim()}` : punchTime.alert === "offline" ? " (feita offline)" : ""}${clockNote ? " \u2014 ALERTA: poss\xEDvel altera\xE7\xE3o do rel\xF3gio do aparelho" : ""}${offlineSequenceNote ? " \u2014 fora de sequ\xEAncia" : ""}`
        });
        return inserted;
      }),
      companyHistory: companyAdminFeatureProcedure("timeTracking").input(z5.object({ memberId: z5.number().int().positive(), month: z5.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
        const database2 = await getDb();
        if (!database2) return [];
        const [year, mon] = input.month.split("-").map(Number);
        const start = new Date(Date.UTC(year, mon - 1, 1));
        const end = new Date(Date.UTC(year, mon, 1));
        await ensurePunchLedger();
        return withInclusionSupersede(await effectiveRows(await database2.select().from(timeEvents).where(and12(eq13(timeEvents.memberAccountId, input.memberId), eq13(timeEvents.companyId, ctx.accountId), gte8(effectiveEventTime, start), lt4(effectiveEventTime, end))).orderBy(effectiveEventTime), { keepDisregarded: true }));
      }),
      /**
       * Desconsidera uma batida (ex.: inclusão repetida). Justificativa obrigatória. NÃO apaga nada:
       * a marcação continua no banco/AFD; só deixa de contar no espelho e no cálculo. Pode ser revertida.
       */
      disregardEvent: companyAdminFeatureProcedure("timeTracking").input(z5.object({ eventId: z5.number().int().positive(), reason: z5.string().trim().min(5, "Escreva pelo menos 5 caracteres na justificativa.").max(500) })).mutation(async ({ ctx, input }) => {
        const database2 = await getDb();
        if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await ensurePunchLedger();
        await ensureDisregardsTable();
        const event = (await database2.select().from(timeEvents).where(and12(eq13(timeEvents.id, input.eventId), eq13(timeEvents.companyId, ctx.accountId))).limit(1))[0];
        if (!event) throw new TRPCError9({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada nesta empresa." });
        if ((await supersededIds(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError9({ code: "BAD_REQUEST", message: "Esta marca\xE7\xE3o j\xE1 foi substitu\xEDda por um ajuste. Desconsidere a marca\xE7\xE3o atual." });
        if ((await activeDisregards(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError9({ code: "CONFLICT", message: "Esta batida j\xE1 est\xE1 desconsiderada." });
        const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
        await database2.execute(sql13`INSERT INTO time_event_disregards (companyId, memberAccountId, timeEventId, reason, decidedByMemberId, decidedByName)
        VALUES (${ctx.accountId}, ${event.memberAccountId}, ${event.id}, ${input.reason}, ${ctx.memberAccountId ?? null}, ${by})`);
        const markedAt = (event.deviceTime || event.serverTime).toISOString();
        await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: event.id, description: `Batida desconsiderada (${event.eventType} em ${markedAt}). Motivo: ${input.reason}`, newData: { eventId: event.id, memberAccountId: event.memberAccountId, eventType: event.eventType, markedAt, reason: input.reason, disregarded: true } });
        return { success: true };
      }),
      /** Reverte a desconsideração: a batida volta a contar. O registro da desconsideração fica no histórico (revertedAt). */
      reconsiderEvent: companyAdminFeatureProcedure("timeTracking").input(z5.object({ eventId: z5.number().int().positive(), reason: z5.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        const database2 = await getDb();
        if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await ensureDisregardsTable();
        const active = (await activeDisregards(ctx.accountId, [input.eventId])).get(input.eventId);
        if (!active) throw new TRPCError9({ code: "NOT_FOUND", message: "Esta batida n\xE3o est\xE1 desconsiderada." });
        const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
        await database2.execute(sql13`UPDATE time_event_disregards SET revertedAt = CURRENT_TIMESTAMP, revertedByMemberId = ${ctx.memberAccountId ?? null}, revertedByName = ${by}, revertReason = ${input.reason || null}
        WHERE id = ${active.id} AND companyId = ${ctx.accountId} AND revertedAt IS NULL`);
        await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: input.eventId, description: `Batida reconsiderada (volta a contar no espelho)${input.reason ? `. Motivo: ${input.reason}` : ""}`, oldData: { disregardReason: active.reason, disregardedBy: active.decidedByName }, newData: { eventId: input.eventId, disregarded: false, reason: input.reason || null } });
        return { success: true };
      }),
      companyApprovedExcuses: companyAdminFeatureProcedure("timeTracking").input(z5.object({ memberId: z5.number().int().positive(), month: z5.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
        const from = `${input.month}-01`;
        const [year, mon] = input.month.split("-").map(Number);
        const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
        const to = `${input.month}-${String(lastDay).padStart(2, "0")}`;
        const map = await loadApprovedDayExcuses(ctx.accountId, [input.memberId], from, to);
        return map.get(input.memberId) || [];
      }),
      /** Faltas e tratamentos do mês (cálculo em leitura, sem alterar batidas). */
      monthAbsences: companyAdminFeatureProcedure("timeTracking").input(z5.object({ memberId: z5.number().int().positive(), month: z5.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })).query(async ({ ctx, input }) => {
        const { from, to } = monthBounds(input.month);
        const reports = await buildMemberReports(ctx.accountId, [input.memberId], from, to, "America/Sao_Paulo");
        const report = reports.get(input.memberId)?.report;
        if (!report) return [];
        return report.days.filter((d) => d.situation === "falta" || d.situation === "abonado" || d.situation === "pendente" || d.treatment).map((d) => ({
          date: d.date,
          situation: d.situation,
          expectedMinutes: d.expectedMinutes,
          workedMinutes: d.workedMinutes,
          diffMinutes: d.diffMinutes,
          treatment: d.treatment || null,
          issues: d.issues
        }));
      }),
      treatAbsence: companyAdminFeatureProcedure("timeTracking").input(z5.object({
        memberId: z5.number().int().positive(),
        date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        decision: z5.enum(["excuse", "time_bank"]),
        notes: z5.string().trim().max(1e3).optional()
      })).mutation(async ({ ctx, input }) => {
        await ensureDayTreatmentsTable();
        const database2 = await getDb();
        if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const member = (await database2.select({ id: memberAccounts2.id }).from(memberAccounts2).where(and12(eq13(memberAccounts2.id, input.memberId), eq13(memberAccounts2.companyId, ctx.accountId))).limit(1))[0];
        if (!member) throw new TRPCError9({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
        const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
        await saveDayTreatment({
          companyId: ctx.accountId,
          memberId: input.memberId,
          day: input.date,
          decision: input.decision,
          notes: input.notes || null,
          decidedByUserId: ctx.memberAccountId ?? null,
          decidedByName: by
        });
        const label = input.decision === "excuse" ? "abonou o dia" : "lan\xE7ou o dia no banco de horas (devendo)";
        await auditFromCtx(ctx, {
          action: "update",
          module: "time_tracking",
          entityType: "time_day_treatment",
          entityId: input.memberId,
          description: `Administrador ${label} ${input.date} do funcion\xE1rio #${input.memberId}${input.notes ? `. Motivo: ${input.notes}` : ""}`,
          newData: { memberId: input.memberId, date: input.date, decision: input.decision, notes: input.notes || null }
        });
        return { success: true };
      }),
      reverseAbsenceTreatment: companyAdminFeatureProcedure("timeTracking").input(z5.object({
        memberId: z5.number().int().positive(),
        date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z5.string().trim().max(1e3).optional()
      })).mutation(async ({ ctx, input }) => {
        await ensureDayTreatmentsTable();
        const current = await getActiveTreatment(ctx.accountId, input.memberId, input.date);
        if (!current) throw new TRPCError9({ code: "NOT_FOUND", message: "N\xE3o h\xE1 decis\xE3o ativa neste dia para reverter." });
        const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
        await reverseDayTreatment({
          companyId: ctx.accountId,
          memberId: input.memberId,
          day: input.date,
          reversedByUserId: ctx.memberAccountId ?? null,
          reversedByName: by,
          notes: input.notes || null
        });
        await auditFromCtx(ctx, {
          action: "update",
          module: "time_tracking",
          entityType: "time_day_treatment",
          entityId: input.memberId,
          description: `Administrador reverteu a decis\xE3o (${current.decision}) do dia ${input.date} do funcion\xE1rio #${input.memberId}`,
          oldData: { decision: current.decision, notes: current.notes, decidedBy: current.decidedByName },
          newData: { memberId: input.memberId, date: input.date, reversed: true, notes: input.notes || null }
        });
        return { success: true };
      }),
      myMissingPunch: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        if (!ctx.accountId || !ctx.memberAccountId) return null;
        const found = (await findMissingPunches({ companyId: ctx.accountId, memberId: ctx.memberAccountId }))[0];
        if (!found) return null;
        const database2 = await getDb();
        if (!database2) return found;
        const dayStart = /* @__PURE__ */ new Date(`${found.day}T00:00:00-03:00`);
        const dayEnd = /* @__PURE__ */ new Date(`${found.day}T23:59:59.999-03:00`);
        const covering = await database2.select({ id: timeCorrectionRequests.id }).from(timeCorrectionRequests).where(and12(
          eq13(timeCorrectionRequests.companyId, ctx.accountId),
          eq13(timeCorrectionRequests.memberAccountId, ctx.memberAccountId),
          sql13`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
          gte8(timeCorrectionRequests.requestedTime, dayStart),
          lte6(timeCorrectionRequests.requestedTime, dayEnd)
        )).limit(1);
        return covering.length ? null : found;
      }),
      companyMissingPunches: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        const found = await findMissingPunches({ companyId: ctx.accountId });
        if (!found.length) return found;
        const database2 = await getDb();
        if (!database2) return found;
        const memberIds = [...new Set(found.map((m) => m.memberId))];
        const dayStarts = [...new Set(found.map((m) => m.day))].map((d) => /* @__PURE__ */ new Date(`${d}T00:00:00-03:00`));
        const dayEnds = [...new Set(found.map((m) => m.day))].map((d) => /* @__PURE__ */ new Date(`${d}T23:59:59.999-03:00`));
        const rangeStart = new Date(Math.min(...dayStarts.map((d) => d.getTime())));
        const rangeEnd = new Date(Math.max(...dayEnds.map((d) => d.getTime())));
        const rows4 = await database2.select({
          memberAccountId: timeCorrectionRequests.memberAccountId,
          requestedTime: timeCorrectionRequests.requestedTime
        }).from(timeCorrectionRequests).where(and12(
          eq13(timeCorrectionRequests.companyId, ctx.accountId),
          inArray10(timeCorrectionRequests.memberAccountId, memberIds),
          sql13`${timeCorrectionRequests.status} IN ('pending', 'approved')`,
          gte8(timeCorrectionRequests.requestedTime, rangeStart),
          lte6(timeCorrectionRequests.requestedTime, rangeEnd)
        ));
        const covered = /* @__PURE__ */ new Set();
        for (const row2 of rows4) {
          covered.add(`${row2.memberAccountId}:${excuseDay(row2.requestedTime)}`);
        }
        return found.filter((m) => !covered.has(`${m.memberId}:${m.day}`));
      }),
      /** Dias do mês, só do próprio promotor, para sinalizar no calendário de correção. */
      myCorrectionDays: commercialFeatureProcedure("timeTracking").input(z5.object({ month: z5.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
        if (!ctx.accountId || !ctx.memberAccountId) {
          return { month: input.month, today: "", nowHm: "", days: [], needsCorrectionCount: 0 };
        }
        return getMyCorrectionCalendarDays({ companyId: ctx.accountId, memberId: ctx.memberAccountId, month: input.month });
      }),
      myHistory: commercialFeatureProcedure("timeTracking").input(z5.object({ limit: z5.number().min(1).max(100).default(100), date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), includeDisregarded: z5.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        if (!companyId || !memberId) return [];
        const database2 = await getDb();
        if (!database2) return [];
        const conditions = [eq13(timeEvents.memberAccountId, memberId), eq13(timeEvents.companyId, companyId)];
        if (input?.date) {
          const { start, end } = saoPauloDayRange(input.date);
          conditions.push(gte8(effectiveEventTime, start), lt4(effectiveEventTime, end));
        }
        await ensurePunchLedger();
        const rows4 = await database2.select().from(timeEvents).where(and12(...conditions)).orderBy(desc2(effectiveEventTime)).limit(input?.limit || 100);
        const tagged = withInclusionSupersede(await effectiveRows(rows4, { keepDisregarded: true }));
        if (input?.includeDisregarded) return tagged;
        return tagged.filter((r) => !r.disregard);
      }),
      myTimeSummary: commercialFeatureProcedure("timeTracking").input(z5.object({ timeZone: z5.string().min(1).max(128).optional() }).optional()).query(async ({ ctx, input }) => {
        const empty = {
          periodLabel: "M\xEAs atual",
          daysTracked: 0,
          workedMinutes: 0,
          expectedMinutes: 0,
          balanceMinutes: 0,
          overtimeMinutes: 0,
          deficitMinutes: 0,
          openShift: false,
          configured: false
        };
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        if (!companyId || !memberId) return empty;
        const database2 = await getDb();
        if (!database2) return empty;
        const timeZone = input?.timeZone || "America/Sao_Paulo";
        const today = localDay(/* @__PURE__ */ new Date(), timeZone);
        const [year, month] = today.split("-").map(Number);
        const from = `${today.slice(0, 7)}-01`;
        const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
        const to = `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
        const reports = await buildMemberReports(companyId, [memberId], from, to, timeZone);
        const mr = reports.get(memberId);
        const bal = closedPeriodBalance(mr.report, mr.labor, today);
        const periodLabel = (/* @__PURE__ */ new Date(`${from}T12:00:00Z`)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone });
        return {
          periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
          daysTracked: bal.daysTracked,
          workedMinutes: bal.workedMinutes,
          expectedMinutes: bal.expectedMinutes,
          balanceMinutes: bal.balanceMinutes,
          overtimeMinutes: bal.overtimeMinutes,
          deficitMinutes: bal.deficitMinutes,
          openShift: bal.openShift,
          configured: bal.configured
        };
      }),
      myCorrections: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        if (!companyId || !memberId) return [];
        const database2 = await getDb();
        if (!database2) return [];
        return database2.select({ request: timeCorrectionRequests, event: timeEvents }).from(timeCorrectionRequests).leftJoin(timeEvents, eq13(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and12(eq13(timeCorrectionRequests.companyId, companyId), eq13(timeCorrectionRequests.memberAccountId, memberId))).orderBy(desc2(timeCorrectionRequests.createdAt));
      }),
      requestCorrection: commercialFeatureProcedure("timeTracking").input(z5.object({
        timeEventId: z5.number().int().positive().optional().nullable(),
        requestedType: timeEventType.optional(),
        requestedTime: z5.string().datetime().optional(),
        date: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        justification: z5.string().max(2e3).optional(),
        justificationType: z5.enum(["normal", "holiday", "day_off", "medical_certificate", "other"]).optional(),
        attachmentBase64: z5.string().max(MAX_PHOTO_BASE64_CHARS + 100, PHOTO_TOO_LARGE_MESSAGE).optional()
      })).mutation(async ({ ctx, input }) => {
        const companyId = ctx.accountId;
        const memberId = ctx.memberAccountId;
        if (!companyId || !memberId) throw new TRPCError9({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        if (!hasPersonalTimeClock(ctx.user?.role)) throw new TRPCError9({ code: "FORBIDDEN", message: ADMIN_NO_PUNCH_MESSAGE });
        const database2 = await getDb();
        if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const jType = input.justificationType || "normal";
        const fullDay = isFullDayExcuseType(jType);
        let reason = (input.justification || "").trim();
        if (!reason) {
          reason = defaultCorrectionJustification({
            justificationType: jType,
            timeEventId: input.timeEventId ?? null,
            fullDay,
            fullDayLabel: fullDay ? fullDayExcuseLabel(jType) : void 0
          });
        }
        if (justificationRequiresText(jType) && reason.length < 5) {
          throw new TRPCError9({ code: "BAD_REQUEST", message: "Descreva o que aconteceu (m\xEDnimo 5 caracteres)." });
        }
        if (!reason) throw new TRPCError9({ code: "BAD_REQUEST", message: "Informe a justificativa." });
        if (!fullDay && !input.requestedType) throw new TRPCError9({ code: "BAD_REQUEST", message: "Informe o tipo de marca\xE7\xE3o." });
        await ensureCorrectionExtras();
        let timeEventId = null;
        if (fullDay) {
          timeEventId = null;
        } else if (input.timeEventId) {
          await ensurePunchLedger();
          const event = await database2.select().from(timeEvents).where(and12(eq13(timeEvents.id, input.timeEventId), eq13(timeEvents.companyId, companyId), eq13(timeEvents.memberAccountId, memberId))).limit(1);
          if (!event[0]) throw new TRPCError9({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada para este funcion\xE1rio." });
          timeEventId = input.timeEventId;
        }
        let requestedTime;
        if (fullDay) {
          const day = input.date || (input.requestedTime ? excuseDay(input.requestedTime) : "");
          if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TRPCError9({ code: "BAD_REQUEST", message: "Informe a data do abono." });
          requestedTime = noonInSaoPaulo(day);
        } else {
          if (!input.requestedTime) throw new TRPCError9({ code: "BAD_REQUEST", message: "Informe o hor\xE1rio da corre\xE7\xE3o." });
          requestedTime = new Date(input.requestedTime);
        }
        if (!fullDay && input.requestedType) {
          const day = excuseDay(requestedTime);
          const { start, end } = saoPauloDayRange(day);
          await ensurePunchLedger();
          const dayRows = await effectiveRows(await database2.select({ id: timeEvents.id, companyId: timeEvents.companyId, type: timeEvents.eventType, deviceTime: timeEvents.deviceTime, serverTime: timeEvents.serverTime }).from(timeEvents).where(and12(eq13(timeEvents.companyId, companyId), eq13(timeEvents.memberAccountId, memberId), gte8(effectiveEventTime, start), lt4(effectiveEventTime, end))));
          const dayEvents = dayRows.map((r) => ({ id: r.id, type: r.type, time: r.deviceTime || r.serverTime }));
          const orderError = punchOrderError(dayEvents, { type: input.requestedType, time: requestedTime, replaceId: timeEventId });
          if (orderError) throw new TRPCError9({ code: "BAD_REQUEST", message: orderError });
          if (!timeEventId) {
            const blocked = inclusionBlockedMessage(dayEvents, input.requestedType, requestedTime);
            if (blocked) throw new TRPCError9({ code: "BAD_REQUEST", message: blocked });
          }
        }
        const lockKey = `${companyId}:${memberId}:${excuseDay(requestedTime)}:${fullDay ? "day" : input.requestedType}:${timeEventId ?? ""}`;
        if (inFlightCorrections.has(lockKey)) throw new TRPCError9({ code: "CONFLICT", message: "Este pedido j\xE1 est\xE1 sendo enviado. Aguarde." });
        inFlightCorrections.add(lockKey);
        try {
          const existing = await database2.select({
            id: timeCorrectionRequests.id,
            status: timeCorrectionRequests.status,
            requestedTime: timeCorrectionRequests.requestedTime,
            requestedType: timeCorrectionRequests.requestedType,
            timeEventId: timeCorrectionRequests.timeEventId,
            justificationType: timeCorrectionRequests.justificationType,
            justification: timeCorrectionRequests.justification
          }).from(timeCorrectionRequests).where(and12(
            eq13(timeCorrectionRequests.companyId, companyId),
            eq13(timeCorrectionRequests.memberAccountId, memberId),
            eq13(timeCorrectionRequests.status, "pending")
          )).orderBy(desc2(timeCorrectionRequests.createdAt)).limit(100);
          if (input.attachmentBase64) {
            const head = Buffer.from(input.attachmentBase64.replace(/^data:[^;]+;base64,/, "").slice(0, 64), "base64");
            if (!detectImageMime(head)) throw new TRPCError9({ code: "BAD_REQUEST", message: "O anexo precisa ser uma imagem v\xE1lida (JPG, PNG ou WebP)." });
          }
          if (fullDay) {
            const day = excuseDay(requestedTime);
            const blocked = hasPendingSamePunch(
              existing.map((row2) => ({ ...row2, isFullDay: looksLikeFullDayExcuse(row2) })),
              { day, fullDay: true, dayOf: excuseDay }
            );
            if (blocked) {
              throw new TRPCError9({ code: "CONFLICT", message: "J\xE1 existe um abono pendente para este dia." });
            }
          } else {
            const day = excuseDay(requestedTime);
            const blocked = hasPendingSamePunch(
              existing.map((row2) => ({ ...row2, isFullDay: looksLikeFullDayExcuse(row2) })),
              { day, requestedType: input.requestedType, timeEventId, dayOf: excuseDay }
            );
            if (blocked) {
              throw new TRPCError9({ code: "CONFLICT", message: "J\xE1 existe um pedido pendente para esta batida neste dia." });
            }
          }
          const result = await database2.insert(timeCorrectionRequests).values({
            companyId,
            memberAccountId: memberId,
            timeEventId,
            requestedType: fullDay ? "clock_in" : input.requestedType,
            requestedTime,
            justification: reason,
            status: "pending",
            justificationType: jType
          });
          const insertedRows = await database2.select().from(timeCorrectionRequests).where(eq13(timeCorrectionRequests.id, Number(result[0]?.insertId))).limit(1);
          const inserted = insertedRows[0];
          if (!inserted) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a solicita\xE7\xE3o criada." });
          let attachmentKey = null;
          try {
            if (input.attachmentBase64) {
              attachmentKey = await saveCorrectionAttachment(companyId, inserted.id, input.attachmentBase64);
            }
            if (attachmentKey) {
              await database2.execute(sql13`UPDATE time_correction_requests SET justificationType = ${jType}, attachmentKey = ${attachmentKey} WHERE id = ${inserted.id}`);
            } else {
              await database2.execute(sql13`UPDATE time_correction_requests SET justificationType = ${jType} WHERE id = ${inserted.id}`);
            }
          } catch (err) {
            console.warn("correction extras persist skipped", err);
          }
          await auditFromCtx(ctx, {
            action: "create",
            module: "time_tracking",
            entityType: "correction_request",
            entityId: inserted.id,
            description: fullDay ? `Solicita\xE7\xE3o de abono (${fullDayExcuseLabel(jType)})` : timeEventId ? "Solicita\xE7\xE3o de corre\xE7\xE3o de ponto" : "Solicita\xE7\xE3o de inclus\xE3o de batida faltante"
          });
          return { ...inserted, justificationType: input.justificationType || "normal", attachmentKey };
        } finally {
          inFlightCorrections.delete(lockKey);
        }
      }),
      correctionRequests: router({
        pending: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
          const database2 = await getDb();
          if (!database2) return [];
          await ensureCorrectionExtras();
          const rows4 = await database2.select({
            request: timeCorrectionRequests,
            event: timeEvents,
            employee: { userName: memberAccounts2.userName }
          }).from(timeCorrectionRequests).innerJoin(memberAccounts2, eq13(timeCorrectionRequests.memberAccountId, memberAccounts2.id)).leftJoin(timeEvents, eq13(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and12(eq13(timeCorrectionRequests.companyId, ctx.accountId), eq13(timeCorrectionRequests.status, "pending"))).orderBy(desc2(timeCorrectionRequests.createdAt));
          return Promise.all(rows4.map(async (row2) => {
            const key = row2.request.attachmentKey;
            let attachmentUrl = null;
            if (key) {
              try {
                attachmentUrl = await storageGetSignedUrl(key);
              } catch {
                attachmentUrl = null;
              }
            }
            return { ...row2, attachmentUrl };
          }));
        }),
        review: companyAdminFeatureProcedure("timeTracking").input(z5.object({ id: z5.number().int().positive(), status: z5.enum(["approved", "rejected"]), reviewNotes: z5.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
          const database2 = await getDb();
          if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
          const rows4 = await database2.select().from(timeCorrectionRequests).where(and12(eq13(timeCorrectionRequests.id, input.id), eq13(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
          const request = rows4[0];
          if (!request) throw new TRPCError9({ code: "NOT_FOUND", message: "Solicita\xE7\xE3o de corre\xE7\xE3o n\xE3o encontrada." });
          if (request.status !== "pending") throw new TRPCError9({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
          await database2.transaction(async (tx) => {
            const claimed = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(and12(eq13(timeCorrectionRequests.id, request.id), eq13(timeCorrectionRequests.status, "pending")));
            if (Number(claimed?.[0]?.affectedRows ?? 1) === 0) throw new TRPCError9({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
            if (input.status === "approved") await applyApprovedCorrection(tx, request, ctx);
          });
          const excuse = isFullDayExcuseType(request.justificationType);
          await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicita\xE7\xE3o de corre\xE7\xE3o ${input.status === "approved" ? "aprovada" : "rejeitada"}${excuse ? ` (abono ${fullDayExcuseLabel(request.justificationType)})` : !request.timeEventId ? " (inclus\xE3o de batida)" : ""}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
          return { success: true };
        }),
        reviewMany: companyAdminFeatureProcedure("timeTracking").input(z5.object({ ids: z5.array(z5.number().int().positive()).min(1).max(20), status: z5.enum(["approved", "rejected"]), reviewNotes: z5.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
          const database2 = await getDb();
          if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
          let done = 0;
          for (const id3 of input.ids) {
            const rows4 = await database2.select().from(timeCorrectionRequests).where(and12(eq13(timeCorrectionRequests.id, id3), eq13(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
            const request = rows4[0];
            if (!request || request.status !== "pending") continue;
            const applied = await database2.transaction(async (tx) => {
              const claimed = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(and12(eq13(timeCorrectionRequests.id, request.id), eq13(timeCorrectionRequests.status, "pending")));
              if (Number(claimed?.[0]?.affectedRows ?? 1) === 0) return false;
              if (input.status === "approved") await applyApprovedCorrection(tx, request, ctx, { skipMissing: true });
              return true;
            });
            if (applied) done += 1;
          }
          await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: input.ids[0], description: `${done} solicita\xE7\xE3o(\xF5es) de corre\xE7\xE3o ${input.status === "approved" ? "aprovadas" : "rejeitadas"} em lote`, newData: { status: input.status, ids: input.ids, reviewNotes: input.reviewNotes || null } });
          return { success: true, count: done };
        })
      })
    });
  }
});

// server/ponto/receipt.ts
function formatCnpjCpf(doc) {
  const d = String(doc ?? "").replace(/\D/g, "");
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return d || "";
}
function buildReceiptData(input) {
  const e = input.event;
  const tz = e.timeZone || "America/Sao_Paulo";
  const marked = e.deviceTime || e.serverTime;
  const fmt2 = (d) => new Intl.DateTimeFormat("pt-BR", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
  const pendingNotes = [];
  if (!input.employer.document) pendingNotes.push("CNPJ/CPF da empresa ainda n\xE3o cadastrado \u2014 pe\xE7a ao administrador para completar em Dados da empresa.");
  if (!e.workerCpf) pendingNotes.push("Seu CPF ainda n\xE3o est\xE1 no cadastro \u2014 pe\xE7a ao administrador para completar em Promotores e equipe.");
  const gps = e.latitude != null && e.longitude != null ? `GPS ${Number(e.latitude).toFixed(6)}, ${Number(e.longitude).toFixed(6)}` : "";
  return {
    eventId: e.id,
    nsr: e.nsr,
    eventType: e.eventType,
    eventLabel: LABEL2[e.eventType] ?? e.eventType,
    employerName: input.employer.name,
    employerDocument: input.employer.document ? formatCnpjCpf(input.employer.document) : null,
    workplace: input.employer.workplace || gps || "N\xE3o informado",
    workerName: input.workerName,
    workerCpf: e.workerCpf ? formatCnpjCpf(e.workerCpf) : null,
    markedAt: marked.toISOString(),
    recordedAt: e.serverTime.toISOString(),
    timeZone: tz,
    markedLocal: fmt2(marked),
    recordedLocal: fmt2(e.serverTime),
    dh: formatDH(marked, tz),
    inpiNumber: input.inpiNumber,
    hash: e.recordHash,
    contentHash: e.contentHash,
    latitude: e.latitude,
    longitude: e.longitude,
    accuracy: e.accuracy,
    offline: e.offline,
    origin: e.origin,
    sealedLegacy: e.sealedLegacy,
    pendingNotes
  };
}
async function buildReceiptPdf(r) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" });
  const M = 10;
  let y = 14;
  doc.setFont("helvetica", "bold").setFontSize(13).text("Comprovante de Registro de Ponto do Trabalhador", M, y);
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90).text("Comprovante de batida \u2014 emitido pelo GondUp", M, y);
  doc.setTextColor(0);
  y += 8;
  const line = (label, value) => {
    doc.setFont("helvetica", "bold").setFontSize(9).text(label, M, y);
    const lines = doc.splitTextToSize(value || "-", 85);
    doc.setFont("helvetica", "normal").text(lines, M + 43, y);
    y += Math.max(1, lines.length) * 4.6;
  };
  line("N\xFAmero da batida", r.nsr != null ? String(r.nsr).padStart(9, "0") : "sem n\xFAmero");
  line("Marca\xE7\xE3o", `${r.eventLabel}${r.origin !== "original" ? " (tratamento, n\xE3o \xE9 marca\xE7\xE3o original)" : ""}`);
  line("Data e hora", `${r.markedLocal} (${r.timeZone})`);
  line("Gravado no servidor", r.recordedLocal);
  line("Empregador", r.employerName || "-");
  line("CNPJ/CPF", r.employerDocument || "n\xE3o cadastrado");
  line("Local", r.workplace);
  line("Trabalhador", r.workerName);
  line("CPF", r.workerCpf || "n\xE3o cadastrado");
  if (r.accuracy != null) line("Precis\xE3o do GPS", `${Math.round(Number(r.accuracy))} m`);
  if (r.inpiNumber) line("Registro do sistema", r.inpiNumber);
  if (r.offline) line("Observa\xE7\xE3o", "Marca\xE7\xE3o feita sem internet e enviada depois.");
  y += 2;
  doc.setFont("helvetica", "bold").text("C\xF3digo de seguran\xE7a da batida", M, y);
  y += 4.5;
  doc.setFont("courier", "normal").setFontSize(7.5).text(doc.splitTextToSize(r.hash || "ainda sem c\xF3digo", 128), M, y);
  y += 9;
  doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(90);
  const foot = [
    "Este c\xF3digo identifica a batida e a liga \xE0 anterior. Se algu\xE9m alterar o registro depois, o c\xF3digo deixa de bater.",
    ...r.sealedLegacy ? ["Batida antiga: o lacre foi aplicado quando essa prote\xE7\xE3o entrou no sistema."] : [],
    ...r.pendingNotes
  ];
  for (const f of foot) {
    const ls = doc.splitTextToSize(`\u2022 ${f}`, 128);
    doc.text(ls, M, y);
    y += ls.length * 3.4;
  }
  return Buffer.from(doc.output("arraybuffer"));
}
function receiptEmailHtml(r) {
  const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows4 = [
    ["N\xFAmero da batida", r.nsr != null ? String(r.nsr).padStart(9, "0") : "-"],
    ["Marca\xE7\xE3o", r.eventLabel],
    ["Data e hora", `${r.markedLocal} (${r.timeZone})`],
    ["Empresa", `${r.employerName}${r.employerDocument ? ` \u2014 ${r.employerDocument}` : ""}`],
    ["Local", r.workplace],
    ["Funcion\xE1rio", `${r.workerName}${r.workerCpf ? ` \u2014 CPF ${r.workerCpf}` : ""}`],
    ...r.inpiNumber ? [["Registro do sistema", r.inpiNumber]] : [],
    ["C\xF3digo de seguran\xE7a", r.hash || "-"]
  ];
  return `<h2 style="margin:0 0 8px">Comprovante de Registro de Ponto</h2>
<table style="border-collapse:collapse;font-size:14px">${rows4.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:bold;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;word-break:break-all">${esc(v)}</td></tr>`).join("")}</table>
<p style="font-size:12px;color:#555">Guarde este e-mail. Voc\xEA tamb\xE9m pode baixar o comprovante em PDF no aplicativo (Ponto &gt; Comprovantes).</p>`;
}
var LABEL2;
var init_receipt = __esm({
  "server/ponto/receipt.ts"() {
    "use strict";
    init_repFormat();
    LABEL2 = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
  }
});

// server/email.ts
var email_exports = {};
__export(email_exports, {
  emailAccountCreated: () => emailAccountCreated,
  emailAdminNewCompany: () => emailAdminNewCompany,
  emailAdminPlanChanged: () => emailAdminPlanChanged,
  emailPasswordReset: () => emailPasswordReset,
  emailPlanChanged: () => emailPlanChanged,
  emailProductExpirationAlerts: () => emailProductExpirationAlerts,
  getAdminNotificationEmail: () => getAdminNotificationEmail,
  getAppPublicUrl: () => getAppPublicUrl,
  getEmailFrom: () => getEmailFrom,
  sendEmail: () => sendEmail
});
function env(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}
function getAdminNotificationEmail() {
  return env("ADMIN_NOTIFICATION_EMAIL", "ivan.honemann@gmail.com");
}
function getAppPublicUrl() {
  return env("APP_PUBLIC_URL", "https://promotores-saas-teste.vercel.app").replace(/\/$/, "");
}
function getEmailFrom() {
  return env("EMAIL_FROM", "GondUp <onboarding@resend.dev>");
}
function provider() {
  const explicit = env("EMAIL_PROVIDER").toLowerCase();
  if (explicit === "console") return "console";
  if (explicit === "webhook" || env("EMAIL_WEBHOOK_URL")) return env("EMAIL_WEBHOOK_URL") ? "webhook" : "console";
  if (explicit === "resend" || env("RESEND_API_KEY")) return "resend";
  return "console";
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#0a0f23;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8ecf8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0f23;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141a2e;border:1px solid #2a334d;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#e10600,#ff2d2d);">
          <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em;">GondUp</div>
          <div style="font-size:12px;color:rgba(255,255,255,.9);margin-top:2px;">Gest\xE3o de opera\xE7\xF5es</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#fff;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #2a334d;font-size:12px;color:#8b93ad;">
          Este e-mail foi enviado automaticamente pelo GondUp. N\xE3o responda a esta mensagem se n\xE3o reconhecer a atividade.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#8b93ad;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#fff;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}
function dataTable(rows4) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 20px;">${rows4.map(([l, v]) => row(l, v)).join("")}</table>`;
}
function cta(href, label) {
  return `<p style="margin:20px 0 8px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#e10600;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">${escapeHtml(label)}</a></p>`;
}
async function sendEmail(input) {
  const toList = (Array.isArray(input.to) ? input.to : [input.to]).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (!toList.length) return { ok: false, error: "Destinat\xE1rio ausente" };
  const mode = provider();
  if (mode === "console") {
    console.info("[email:console]", {
      to: toList,
      subject: input.subject,
      preview: (input.text || input.html).slice(0, 240)
    });
    return { ok: true, id: "console" };
  }
  if (mode === "webhook") {
    const endpoint = env("EMAIL_WEBHOOK_URL");
    if (!endpoint) {
      console.info("[email:webhook] EMAIL_WEBHOOK_URL ausente \u2014 log only", { to: toList, subject: input.subject });
      return { ok: true, id: "console" };
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: toList,
          subject: input.subject,
          html: input.html,
          text: input.text,
          source: "extinfy",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        })
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.warn("[email:webhook] fail", res.status, detail);
        return { ok: false, error: detail || res.statusText };
      }
      return { ok: true, id: "webhook" };
    } catch (error) {
      console.warn("[email:webhook] error", error);
      return { ok: false, error: error instanceof Error ? error.message : "webhook failed" };
    }
  }
  if (!env("RESEND_API_KEY")) {
    console.info("[email:console] RESEND_API_KEY ausente", { to: toList, subject: input.subject });
    return { ok: true, id: "console" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: toList,
        subject: input.subject,
        html: input.html,
        text: input.text
      })
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[email:resend] fail", res.status, body);
      return { ok: false, error: String(body?.message || res.statusText) };
    }
    return { ok: true, id: String(body?.id || "") };
  } catch (error) {
    console.warn("[email:resend] error", error);
    return { ok: false, error: error instanceof Error ? error.message : "send failed" };
  }
}
async function emailAccountCreated(input) {
  const loginUrl = `${getAppPublicUrl()}/?login=1`;
  const planLine = input.planName ? `${input.planName}${input.isTrial ? " (teste gr\xE1tis)" : ""}` : input.isTrial ? "Teste gr\xE1tis" : "N\xE3o informado";
  const rows4 = [
    ["Empresa", input.companyName],
    ["Respons\xE1vel", input.userName],
    ["E-mail de acesso", input.email]
  ];
  if (input.password) rows4.push(["Senha", input.password]);
  rows4.push(["C\xF3digo de redefini\xE7\xE3o", input.recoveryCode]);
  rows4.push(["Plano", planLine]);
  const html = layout(
    "Sua conta GondUp foi criada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Sua conta foi criada com sucesso. Guarde estes dados em local seguro.</p>
    ${dataTable(rows4)}
    <p style="margin:0 0 8px;color:#c4cae0;font-size:13px;line-height:1.5;">Use o <strong style="color:#fff;">c\xF3digo de redefini\xE7\xE3o</strong> se precisar trocar a senha na tela de recupera\xE7\xE3o.</p>
    ${cta(loginUrl, "Entrar no GondUp")}`
  );
  return sendEmail({
    to: input.to,
    subject: "GondUp \u2014 conta criada e dados de acesso",
    html,
    text: `Conta criada
Empresa: ${input.companyName}
E-mail: ${input.email}
Senha: ${input.password || "(a definida no cadastro)"}
C\xF3digo de redefini\xE7\xE3o: ${input.recoveryCode}
Plano: ${planLine}
Acesse: ${loginUrl}`
  });
}
async function emailPasswordReset(input) {
  const link = `${getAppPublicUrl()}/redefinir-senha?token=${encodeURIComponent(input.token)}`;
  const html = layout(
    "Redefini\xE7\xE3o de senha",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Recebemos um pedido para redefinir a senha da sua conta. O link vale por 1 hora e s\xF3 pode ser usado uma vez.</p>
    ${cta(link, "Criar nova senha")}
    <p style="margin:16px 0 0;color:#8b93ad;font-size:13px;">Se voc\xEA n\xE3o pediu isso, ignore este e-mail: sua senha continua a mesma.</p>`
  );
  return sendEmail({
    to: input.to,
    subject: "GondUp \u2014 Redefini\xE7\xE3o de senha",
    html,
    text: `Redefini\xE7\xE3o de senha
Acesse o link (vale por 1 hora): ${link}
Se voc\xEA n\xE3o pediu isso, ignore este e-mail.`
  });
}
async function emailPlanChanged(input) {
  const title = input.isUpgrade ? "Upgrade de plano confirmado" : "Plano adquirido";
  const rows4 = [
    ["Empresa", input.companyName],
    ["Plano", input.planName],
    ["Status", input.status]
  ];
  if (input.amount) rows4.push(["Valor", `R$ ${input.amount}`]);
  if (input.periodEnd) rows4.push(["V\xE1lido at\xE9", input.periodEnd]);
  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Registramos a altera\xE7\xE3o do plano da sua empresa.</p>
    ${dataTable(rows4)}
    ${cta(`${getAppPublicUrl()}/minha-assinatura`, "Ver minha assinatura")}`
  );
  return sendEmail({
    to: input.to,
    subject: `GondUp \u2014 ${title}: ${input.planName}`,
    html,
    text: `${title}
Empresa: ${input.companyName}
Plano: ${input.planName}
Status: ${input.status}`
  });
}
async function emailAdminNewCompany(input) {
  const admin = getAdminNotificationEmail();
  if (!admin) return { ok: false, error: "ADMIN_NOTIFICATION_EMAIL vazio" };
  const planLabel = input.planName ? `${input.planName}${input.isTrial ? " \u2014 teste gr\xE1tis" : ""}` : input.isTrial ? "Teste gr\xE1tis (plano n\xE3o informado)" : "N\xE3o informado";
  const html = layout(
    "Nova empresa cadastrada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Uma nova empresa acabou de se cadastrar no GondUp.</p>
    ${dataTable([
      ["Empresa", input.companyName],
      ["Respons\xE1vel", input.userName],
      ["E-mail", input.email],
      ["Plano / modo", planLabel],
      ["Quando", (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]
    ])}`
  );
  return sendEmail({
    to: admin,
    subject: `GondUp \u2014 nova empresa: ${input.companyName} (${planLabel})`,
    html,
    text: `Nova empresa
${input.companyName}
${input.userName} <${input.email}>
Plano: ${planLabel}`
  });
}
async function emailAdminPlanChanged(input) {
  const admin = getAdminNotificationEmail();
  if (!admin) return { ok: false, error: "ADMIN_NOTIFICATION_EMAIL vazio" };
  const title = input.isUpgrade ? "Upgrade de plano na plataforma" : "Plano adquirido na plataforma";
  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Um cliente alterou ou adquiriu um plano no GondUp.</p>
    ${dataTable([
      ["Empresa", input.companyName],
      ["Respons\xE1vel", input.userName],
      ["E-mail", input.email],
      ["Plano", input.planName],
      ["Status", input.status],
      ["Valor", input.amount ? `R$ ${input.amount}` : "\u2014"],
      ["Quando", (/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })]
    ])}`
  );
  return sendEmail({
    to: admin,
    subject: `GondUp \u2014 ${input.isUpgrade ? "upgrade" : "plano"}: ${input.companyName} \u2192 ${input.planName}`,
    html,
    text: `${title}
Empresa: ${input.companyName}
${input.userName} <${input.email}>
Plano: ${input.planName}
Status: ${input.status}`
  });
}
async function emailProductExpirationAlerts(input) {
  if (!input.items.length) return { ok: true, id: "empty" };
  const list = input.items.slice(0, 50).map((item) => `<li style="margin:0 0 12px;color:#c4cae0;"><strong style="color:#fff;">${escapeHtml(item.description)}</strong><br/>C\xF3digo: ${escapeHtml(item.productCode)} \xB7 Quantidade: ${item.quantity} \xB7 Pre\xE7o: R$ ${escapeHtml(String(item.price))}<br/><span style="color:#fbbf24;">Validade: ${escapeHtml(item.expirationDate)}</span></li>`).join("");
  const more = input.items.length > 50 ? `<p style="color:#8b93ad;font-size:13px;">\u2026 e mais ${input.items.length - 50} produto(s).</p>` : "";
  const html = layout("Produtos pr\xF3ximos do vencimento", `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong> (${escapeHtml(input.companyName)}). Estes produtos vencem nos pr\xF3ximos 30 dias:</p><ul style="margin:0;padding-left:18px;">${list}</ul>${more}${cta(getAppPublicUrl() + "/produtos", "Ver produtos e validades")}`);
  return sendEmail({ to: input.to, subject: `GondUp \u2014 ${input.items.length} produto(s) vencem em at\xE9 30 dias (${input.companyName})`, html, text: `Produtos com validade nos pr\xF3ximos 30 dias: ${input.items.map((i) => `${i.description} (${i.productCode}), quantidade ${i.quantity}, validade ${i.expirationDate}, pre\xE7o R$ ${i.price}`).join("; ")}. Acesse /produtos.` });
}
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
  }
});

// server/ponto/clock.ts
var clock_exports = {};
__export(clock_exports, {
  MAX_DRIFT_MS: () => MAX_DRIFT_MS,
  NTP_SERVERS: () => NTP_SERVERS,
  httpsDateSample: () => httpsDateSample,
  latestClockChecks: () => latestClockChecks,
  ntpOffset: () => ntpOffset,
  readNtpTimestamp: () => readNtpTimestamp,
  runClockCheck: () => runClockCheck,
  sampleLegalTime: () => sampleLegalTime,
  sntpQuery: () => sntpQuery
});
import dgram from "node:dgram";
import { sql as sql14 } from "drizzle-orm";
function readNtpTimestamp(buf, offset) {
  const seconds = buf.readUInt32BE(offset);
  const fraction = buf.readUInt32BE(offset + 4);
  return (seconds - NTP_EPOCH_OFFSET) * 1e3 + Math.round(fraction / 2 ** 32 * 1e3);
}
function ntpOffset(t0, t1, t2, t3) {
  return { offsetMs: Math.round((t1 - t0 + (t2 - t3)) / 2), roundTripMs: Math.max(0, t3 - t0 - (t2 - t1)) };
}
function sntpQuery(host, timeoutMs = 2500, now = Date.now) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const packet = Buffer.alloc(48);
    packet[0] = 35;
    let t0 = 0;
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`timeout ${host}`));
    }, timeoutMs);
    socket.once("error", (e) => {
      clearTimeout(timer);
      socket.close();
      reject(e);
    });
    socket.once("message", (msg) => {
      const t3 = now();
      clearTimeout(timer);
      socket.close();
      if (msg.length < 48) return reject(new Error("resposta NTP curta"));
      const t1 = readNtpTimestamp(msg, 32);
      const t2 = readNtpTimestamp(msg, 40);
      const { offsetMs, roundTripMs } = ntpOffset(t0, t1, t2, t3);
      resolve({ source: host, method: "sntp", offsetMs, roundTripMs, precisionMs: Math.max(1, Math.round(roundTripMs / 2)) });
    });
    t0 = now();
    socket.send(packet, 123, host, (err) => {
      if (err) {
        clearTimeout(timer);
        socket.close();
        reject(err);
      }
    });
  });
}
async function httpsDateSample(url = "https://ntp.br/", now = Date.now) {
  const t0 = now();
  const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(4e3) });
  const t3 = now();
  const date3 = res.headers.get("date");
  if (!date3) throw new Error("sem cabe\xE7alho Date");
  const server = Date.parse(date3) + 500;
  return { source: new URL(url).host, method: "https-date", offsetMs: Math.round(server - (t0 + t3) / 2), roundTripMs: t3 - t0, precisionMs: 1e3 + Math.round((t3 - t0) / 2) };
}
async function sampleLegalTime() {
  const results = await Promise.allSettled(NTP_SERVERS.map((h) => sntpQuery(h)));
  const ok = results.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
  if (ok.length) return ok.sort((a, b) => a.roundTripMs - b.roundTripMs)[0];
  return httpsDateSample();
}
async function ensureClockTable() {
  const database2 = await getDb();
  if (!database2 || typeof database2.execute !== "function") return null;
  await database2.execute(sql14.raw(`CREATE TABLE IF NOT EXISTS clock_checks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    checkedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(64) NOT NULL,
    method VARCHAR(16) NOT NULL,
    precisionMs INT NOT NULL,
    serverOffsetMs INT NOT NULL,
    databaseOffsetMs INT NULL,
    ok TINYINT(1) NOT NULL,
    error VARCHAR(255) NULL,
    INDEX clock_checks_checked_idx (checkedAt)
  )`));
  return database2;
}
async function runClockCheck(trigger = "agendado") {
  const database2 = await ensureClockTable();
  const checkedAt = (/* @__PURE__ */ new Date()).toISOString();
  let result;
  try {
    const sample = await sampleLegalTime();
    let databaseOffsetMs = null;
    if (database2) {
      const before = Date.now();
      const [rows4] = await database2.execute(sql14`SELECT UNIX_TIMESTAMP(UTC_TIMESTAMP(3)) * 1000 AS ms`);
      const after = Date.now();
      const dbMs = Number(rows4?.[0]?.ms);
      if (Number.isFinite(dbMs)) databaseOffsetMs = Math.round((before + after) / 2 + sample.offsetMs - dbMs);
    }
    const worstMs = Math.max(Math.abs(sample.offsetMs), Math.abs(databaseOffsetMs ?? 0));
    result = { checkedAt, source: sample.source, method: sample.method, precisionMs: sample.precisionMs, serverOffsetMs: sample.offsetMs, databaseOffsetMs, worstMs, ok: worstMs <= MAX_DRIFT_MS };
  } catch (e) {
    result = { checkedAt, source: "-", method: "-", precisionMs: 0, serverOffsetMs: 0, databaseOffsetMs: null, worstMs: 0, ok: false, error: String(e?.message || e).slice(0, 200) };
  }
  let previousOk = null;
  if (database2) {
    try {
      const [prev] = await database2.execute(sql14`SELECT ok FROM clock_checks WHERE error IS NULL ORDER BY id DESC LIMIT 1`);
      previousOk = prev?.[0] ? Boolean(Number(prev[0].ok)) : null;
      await database2.execute(sql14`INSERT INTO clock_checks (source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error)
        VALUES (${result.source}, ${result.method}, ${result.precisionMs}, ${result.serverOffsetMs}, ${result.databaseOffsetMs}, ${result.ok ? 1 : 0}, ${result.error ?? null})`);
    } catch (e) {
      console.warn("[clock] falha ao gravar", e);
    }
  }
  const changed = !result.error && previousOk !== null && previousOk !== result.ok;
  const description = result.error ? `Confer\xEAncia do rel\xF3gio (${trigger}) falhou: ${result.error}` : `${changed ? result.ok ? "AJUSTE: rel\xF3gio voltou ao limite" : "ALERTA: rel\xF3gio fora do limite" : "Confer\xEAncia do rel\xF3gio"} (${trigger}) \u2014 servidor ${result.serverOffsetMs} ms, banco ${result.databaseOffsetMs ?? "?"} ms vs ${result.source} (${result.method})`;
  void writeAuditLog({ companyId: null, action: result.ok ? "read" : "security", module: "time_tracking", entityType: "clock_check", description, newData: result });
  return result;
}
async function latestClockChecks(limit = 10) {
  const database2 = await ensureClockTable();
  if (!database2) return [];
  const [rows4] = await database2.execute(sql14`SELECT checkedAt, source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error FROM clock_checks ORDER BY id DESC LIMIT ${limit}`);
  return (rows4 || []).map((r) => ({ ...r, ok: Boolean(Number(r.ok)) }));
}
var NTP_SERVERS, MAX_DRIFT_MS, NTP_EPOCH_OFFSET;
var init_clock = __esm({
  "server/ponto/clock.ts"() {
    "use strict";
    init_db();
    init_audit();
    NTP_SERVERS = ["a.ntp.br", "b.ntp.br", "c.ntp.br"];
    MAX_DRIFT_MS = 3e4;
    NTP_EPOCH_OFFSET = 2208988800;
  }
});

// server/ponto/signature.ts
import forge from "node-forge";
import fs from "node:fs";
async function signPades(pdfBuffer, p12Buffer, password) {
  const { default: signpdf } = await import("@signpdf/signpdf");
  const { P12Signer } = await import("@signpdf/signer-p12");
  const { pdflibAddPlaceholder } = await import("@signpdf/placeholder-pdf-lib");
  const { PDFDocument } = await import("pdf-lib");
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  pdflibAddPlaceholder({
    pdfDoc,
    reason: "Comprovante de registro de ponto",
    contactInfo: "GondUp",
    name: "GondUp REP-P",
    location: "Brasil"
  });
  const pdfWithPlaceholder = Buffer.from(await pdfDoc.save());
  const signer = new P12Signer(p12Buffer, { passphrase: password });
  return await signpdf.sign(pdfWithPlaceholder, signer);
}
function loadP12Buffer(path3) {
  const certPath = path3 || process.env.REP_SIGN_CERT_PATH;
  if (!certPath || !fs.existsSync(certPath)) return null;
  return fs.readFileSync(certPath);
}
var SignatureError;
var init_signature = __esm({
  "server/ponto/signature.ts"() {
    "use strict";
    SignatureError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "SignatureError";
      }
    };
  }
});

// server/ponto/router.ts
import { z as z6 } from "zod";
import { TRPCError as TRPCError10 } from "@trpc/server";
import { and as and13, asc, desc as desc3, eq as eq14, gte as gte9, inArray as inArray11, lt as lt5, sql as sql15 } from "drizzle-orm";
function developerInfo() {
  return {
    document: onlyDigits(process.env.GONDUP_DEVELOPER_DOCUMENT || ""),
    name: (process.env.GONDUP_DEVELOPER_NAME || "GondUp").trim(),
    email: (process.env.GONDUP_DEVELOPER_EMAIL || "").trim(),
    inpiNumber: onlyDigits(process.env.GONDUP_INPI_NUMBER || "") || null,
    version: (process.env.GONDUP_PTRP_VERSION || "1.0").trim().slice(0, 8)
  };
}
async function readJson2(key, companyId) {
  const raw = await getSetting(key, companyId, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function employerOf(companyId) {
  const snap = await getLegalSnapshotForCompany(companyId);
  const document = onlyDigits(snap.legal.document) || null;
  return { name: (snap.legal.legalName || snap.name || "").trim(), document, workplace: (snap.legal.establishment || snap.legal.address || "").trim() || null };
}
async function loadReceipt(ctx, eventId) {
  await ensurePunchLedger();
  const database2 = await getDb();
  if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const row2 = (await database2.select().from(timeEvents).where(and13(eq14(timeEvents.id, eventId), eq14(timeEvents.companyId, ctx.accountId))).limit(1))[0];
  if (!row2) throw new TRPCError10({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada." });
  if (row2.memberAccountId !== ctx.memberAccountId && !isAdminRole(ctx)) throw new TRPCError10({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode ver os seus comprovantes." });
  const member = (await database2.select({ name: memberAccounts2.userName, email: memberAccounts2.email }).from(memberAccounts2).where(eq14(memberAccounts2.id, row2.memberAccountId)).limit(1))[0];
  const employer = await employerOf(ctx.accountId);
  const data = buildReceiptData({
    event: { id: row2.id, nsr: row2.nsr ?? null, eventType: row2.eventType, serverTime: row2.serverTime, deviceTime: row2.deviceTime, timeZone: row2.timeZone, recordHash: row2.recordHash, contentHash: row2.contentHash, workerCpf: row2.workerCpf, latitude: row2.latitude, longitude: row2.longitude, accuracy: row2.accuracy, offline: Boolean(row2.offline), origin: row2.origin || "original", sealedLegacy: Boolean(row2.sealedLegacy) },
    employer,
    workerName: member?.name ?? "",
    inpiNumber: developerInfo().inpiNumber
  });
  return { data, memberEmail: member?.email ?? null };
}
async function memberMonthMirror(companyId, memberId, month) {
  const [year, mon] = month.split("-").map(Number);
  const from = `${month}-01`;
  const to = `${month}-${String(new Date(Date.UTC(year, mon, 0)).getUTCDate()).padStart(2, "0")}`;
  const database2 = await getDb();
  if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const member = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts2).leftJoin(promoterProfiles, eq14(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and13(eq14(memberAccounts2.id, memberId), eq14(memberAccounts2.companyId, companyId))).limit(1))[0];
  if (!member) throw new TRPCError10({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado." });
  const rows4 = await loadMirrorEventRows(companyId, [memberId], from, to);
  const adj = await loadAdjustmentsByEvent(companyId, [memberId]);
  const labor = await readJson2(`labor_profile:${memberId}`, companyId);
  const excuses = (await loadApprovedDayExcuses(companyId, [memberId], from, to)).get(memberId) || [];
  const vacations = (await loadMemberVacations(companyId, [memberId], from, to)).get(memberId) || [];
  const treatments = (await loadDayTreatments(companyId, [memberId], from, to)).get(memberId) || [];
  const options = await loadMirrorOptions(companyId);
  const report = buildMirror({ events: toMirrorEvents(rows4, adj), from, to, timeZone: TZ4, labor, excuses, vacations, treatments, options, today: todayInTimeZone(TZ4) });
  const employer = await employerOf(companyId);
  const document = {
    v: 1,
    month,
    employer: { name: employer.name, document: employer.document },
    worker: { id: member.id, name: member.name, cpf: onlyDigits(labor?.cpf) || null, jobTitle: labor?.jobTitle ?? null, admissionDate: labor?.admissionDate ?? null },
    days: report.days.map((d) => ({ date: d.date, marks: d.marks.map((m) => [m.type, m.time, m.kind, m.originalTime ?? null]), worked: d.workedMinutes, expected: d.expectedMinutes, issues: d.issues, ...d.disregarded?.length ? { disregarded: d.disregarded.map((m) => [m.type, m.time, m.reason]) } : {} })),
    totals: report.totals
  };
  return { member, employer, labor, report, from, to, documentHash: sha256(JSON.stringify(document)) };
}
async function latestAcceptances(companyId, month, memberIds) {
  await ensurePunchLedger();
  const database2 = await getDb();
  if (!database2) return /* @__PURE__ */ new Map();
  const filter = memberIds?.length ? sql15` AND memberAccountId IN (${sql15.join(memberIds.map((id3) => sql15`${id3}`), sql15`, `)})` : sql15``;
  const [rows4] = await database2.execute(sql15`SELECT id, memberAccountId, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND month = ${month}${filter} ORDER BY id DESC`);
  const map = /* @__PURE__ */ new Map();
  for (const r of rows4) if (!map.has(Number(r.memberAccountId))) map.set(Number(r.memberAccountId), r);
  return map;
}
function rangeUtc(from, to) {
  return { start: new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 36e5), end: new Date(Date.parse(`${to}T00:00:00Z`) + 39 * 36e5) };
}
function fileResponse(content, fileName) {
  return { fileName, base64: toLatin1(content).toString("base64"), mimeType: "text/plain;charset=iso-8859-1" };
}
async function dataReadiness(companyId) {
  const snap = await getLegalSnapshotForCompany(companyId);
  const legal = snap.legal;
  const company = [];
  if (!(legal?.legalName || "").trim()) company.push("Raz\xE3o social");
  const doc = onlyDigits(legal?.document);
  if (!doc) company.push("CNPJ/CPF");
  else if (!isValidCpfOrCnpj(doc)) company.push("CNPJ/CPF v\xE1lido (o cadastrado n\xE3o confere)");
  if (!(legal?.address || "").trim()) company.push("Endere\xE7o");
  const database2 = await getDb();
  const members = database2 ? (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq14(memberAccounts2.companyId, companyId))).filter((m) => m.role !== "company_admin" && m.active) : [];
  const people = [];
  for (const m of members) {
    const identity = await getLaborIdentity(companyId, m.id);
    const l = { ...await readJson2(`labor_profile:${m.id}`, companyId), cpf: identity.cpf || void 0, pis: identity.pis || void 0, jobTitle: identity.jobTitle || void 0, admissionDate: identity.admissionDate || void 0 };
    const missing = [];
    if (!l?.cpf) missing.push("CPF");
    else if (!isValidCpf(l.cpf)) missing.push("CPF v\xE1lido");
    if (!(l?.jobTitle || "").trim()) missing.push("Cargo");
    if (!l?.admissionDate) missing.push("Data de admiss\xE3o");
    if (!l?.schedule?.length) missing.push("Hor\xE1rio contratual");
    if (missing.length) people.push({ memberId: m.id, name: m.name, missing });
  }
  return { company, people, ok: company.length === 0 && people.length === 0 };
}
var TZ4, monthStr2, dateStr4, isAdminRole, pontoLegalRouter;
var init_router = __esm({
  "server/ponto/router.ts"() {
    "use strict";
    init_brDocs();
    init_trpc();
    init_db();
    init_schema();
    init_audit();
    init_timesheetMirror();
    init_correctionExtras();
    init_dayTreatments();
    init_mirrorData();
    init_ledger();
    init_repFormat();
    init_receipt();
    init_email();
    init_companyRegistry();
    init_clock();
    init_signature();
    TZ4 = DEFAULT_TZ;
    monthStr2 = z6.string().regex(/^\d{4}-\d{2}$/);
    dateStr4 = z6.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    isAdminRole = (ctx) => ["company_admin", "supervisor"].includes(String(ctx.user?.role || ""));
    pontoLegalRouter = router({
      /** Situação para a empresa cliente: só o que ela pode cadastrar (sem pendências do dono da plataforma). */
      status: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
        const employer = await employerOf(ctx.accountId);
        const database2 = await getDb();
        let workersMissingCpf = 0;
        let workersMissingSchedule = 0;
        if (database2) {
          const members = await database2.select({ id: memberAccounts2.id, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq14(memberAccounts2.companyId, ctx.accountId));
          for (const m of members) {
            if (!m.active || m.role === "company_admin") continue;
            const labor = await readJson2(`labor_profile:${m.id}`, ctx.accountId);
            if (onlyDigits(labor?.cpf).length !== 11) workersMissingCpf += 1;
            if (!Number(labor?.dailyMinutes || 0)) workersMissingSchedule += 1;
          }
        }
        return {
          employerDocument: Boolean(employer.document),
          employerName: employer.name,
          employerAddress: Boolean(employer.workplace),
          workersMissingCpf,
          workersMissingSchedule,
          emailEnabled: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_WEBHOOK_URL),
          readiness: await dataReadiness(ctx.accountId)
        };
      }),
      /** Pendências do dono do GondUp (INPI, documento do desenvolvedor, certificado) — só platform_admin. */
      platformStatus: platformProcedure.query(async () => {
        const dev = developerInfo();
        return {
          inpiNumber: dev.inpiNumber,
          developerDocument: Boolean(dev.document),
          developerName: dev.name,
          signature: false,
          emailEnabled: Boolean(process.env.RESEND_API_KEY || process.env.EMAIL_WEBHOOK_URL)
        };
      }),
      /** Comprovantes do próprio funcionário (padrão: últimos 30 dias; a Portaria exige ao menos as últimas 48 h). */
      myReceipts: commercialFeatureProcedure("timeTracking").input(z6.object({ days: z6.number().int().min(1).max(90).default(30) }).optional()).query(async ({ ctx, input }) => {
        if (!ctx.accountId || !ctx.memberAccountId) return [];
        await ensurePunchLedger();
        const database2 = await getDb();
        if (!database2) return [];
        const since = new Date(Date.now() - (input?.days ?? 30) * 864e5);
        const rows4 = await database2.select({ id: timeEvents.id, nsr: timeEvents.nsr, eventType: timeEvents.eventType, serverTime: timeEvents.serverTime, deviceTime: timeEvents.deviceTime, recordHash: timeEvents.recordHash, origin: timeEvents.origin, timeZone: timeEvents.timeZone, offline: timeEvents.offline }).from(timeEvents).where(and13(eq14(timeEvents.companyId, ctx.accountId), eq14(timeEvents.memberAccountId, ctx.memberAccountId), gte9(timeEvents.serverTime, since))).orderBy(desc3(timeEvents.serverTime)).limit(500);
        const gone = await supersededIds(ctx.accountId, rows4.map((r) => r.id));
        return rows4.map((r) => ({ ...r, markedAt: r.deviceTime || r.serverTime, superseded: gone.has(r.id) }));
      }),
      receipt: commercialFeatureProcedure("timeTracking").input(z6.object({ eventId: z6.number().int().positive() })).query(async ({ ctx, input }) => (await loadReceipt(ctx, input.eventId)).data),
      receiptPdf: commercialFeatureProcedure("timeTracking").input(z6.object({ eventId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { data } = await loadReceipt(ctx, input.eventId);
        let pdf = await buildReceiptPdf(data);
        let signed = false;
        let signError = null;
        try {
          const p12 = loadP12Buffer();
          const password = process.env.REP_SIGN_CERT_PASSWORD;
          if (p12 && password) {
            pdf = await signPades(pdf, p12, password);
            signed = true;
          } else {
            signError = "Certificado n\xE3o configurado. PDF gerado sem assinatura digital.";
          }
        } catch (e) {
          signError = e instanceof SignatureError ? e.message : "Assinatura digital do recibo n\xE3o gerada.";
        }
        void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Baixou comprovante de ponto (NSR ${data.nsr ?? "-"})${signed ? " assinado" : " sem assinatura"}` });
        return { fileName: `comprovante-ponto-NSR${String(data.nsr ?? input.eventId).padStart(9, "0")}.pdf`, base64: pdf.toString("base64"), signed, signError };
      }),
      emailReceipt: commercialFeatureProcedure("timeTracking").input(z6.object({ eventId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const { data, memberEmail } = await loadReceipt(ctx, input.eventId);
        if (!memberEmail) return { sent: false, message: "Seu cadastro n\xE3o tem e-mail. Pe\xE7a ao administrador para incluir." };
        if (!process.env.RESEND_API_KEY && !process.env.EMAIL_WEBHOOK_URL) return { sent: false, message: "Envio de e-mail n\xE3o est\xE1 ativado neste ambiente. Baixe o PDF." };
        const result = await sendEmail({ to: memberEmail, subject: `Comprovante de ponto \u2014 ${data.eventLabel} ${data.markedLocal}`, html: receiptEmailHtml(data) });
        void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Comprovante de ponto enviado por e-mail (NSR ${data.nsr ?? "-"})${result.ok ? "" : " \u2014 falhou"}` });
        return result.ok ? { sent: true, message: `Comprovante enviado para ${memberEmail}.` } : { sent: false, message: "N\xE3o foi poss\xEDvel enviar o e-mail agora. Baixe o PDF." };
      }),
      // ------------------------------------------------------------------ aceite do espelho
      myMirror: commercialFeatureProcedure("timeTracking").input(z6.object({ month: monthStr2 })).query(async ({ ctx, input }) => {
        if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError10({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
        const acc = (await latestAcceptances(ctx.accountId, input.month, [ctx.memberAccountId])).get(ctx.memberAccountId) ?? null;
        return {
          month: input.month,
          from: m.from,
          to: m.to,
          timeZone: TZ4,
          report: m.report,
          documentHash: m.documentHash,
          employer: m.employer,
          member: { id: m.member.id, name: m.member.name, employeeCode: m.member.employeeCode ?? null },
          labor: m.labor,
          worker: { name: m.member.name, cpf: m.labor?.cpf ?? null, jobTitle: m.labor?.jobTitle ?? null, admissionDate: m.labor?.admissionDate ?? null },
          acceptance: acc ? { decision: acc.decision, acceptedAt: acc.acceptedAt, documentHash: acc.documentHash, comment: acc.comment, stillValid: acc.documentHash === m.documentHash } : null
        };
      }),
      acceptMirror: commercialFeatureProcedure("timeTracking").input(z6.object({ month: monthStr2, documentHash: z6.string().regex(/^[a-f0-9]{64}$/), decision: z6.enum(["accepted", "contested"]), comment: z6.string().trim().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
        if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError10({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        if (input.decision === "contested" && (input.comment || "").length < 5) throw new TRPCError10({ code: "BAD_REQUEST", message: "Explique o que est\xE1 errado (pelo menos 5 caracteres)." });
        const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
        if (m.documentHash !== input.documentHash) throw new TRPCError10({ code: "CONFLICT", message: "O espelho mudou enquanto voc\xEA lia (nova marca\xE7\xE3o ou corre\xE7\xE3o). Confira de novo antes de confirmar." });
        const meta = requestMeta(ctx);
        const database2 = await getDb();
        if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const summary = JSON.stringify({ totals: m.report.totals, days: m.report.days.length });
        await database2.execute(sql15`INSERT INTO timesheet_acceptances (companyId, memberAccountId, month, decision, documentHash, summary, comment, ipAddress, userAgent, acceptedAt)
        VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.month}, ${input.decision}, ${m.documentHash}, ${summary}, ${input.comment || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
        void auditFromCtx(ctx, { action: input.decision === "accepted" ? "update" : "security", module: "time_tracking", entityType: "timesheet_acceptance", entityId: ctx.memberAccountId, description: `${input.decision === "accepted" ? "Funcion\xE1rio confirmou" : "Funcion\xE1rio contestou"} o espelho de ${input.month} (hash ${m.documentHash.slice(0, 12)}\u2026)`, newData: { month: input.month, documentHash: m.documentHash, comment: input.comment || null } });
        return { success: true, documentHash: m.documentHash };
      }),
      mirrorAcceptances: companyAdminFeatureProcedure("timeTracking").input(z6.object({ month: monthStr2 })).query(async ({ ctx, input }) => {
        const database2 = await getDb();
        if (!database2) return [];
        const members = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq14(memberAccounts2.companyId, ctx.accountId))).filter((m) => m.role !== "company_admin");
        const acc = await latestAcceptances(ctx.accountId, input.month, members.map((m) => m.id));
        const out = [];
        for (const m of members) {
          const a = acc.get(m.id);
          let currentHash = null;
          if (a) {
            try {
              currentHash = (await memberMonthMirror(ctx.accountId, m.id, input.month)).documentHash;
            } catch {
              currentHash = null;
            }
          }
          if (!a && !m.active) continue;
          out.push({ memberId: m.id, name: m.name, active: m.active, acceptance: a ? { decision: a.decision, acceptedAt: a.acceptedAt, documentHash: a.documentHash, comment: a.comment, ipAddress: a.ipAddress, userAgent: a.userAgent, changedAfter: currentHash != null && currentHash !== a.documentHash } : null });
        }
        return out.sort((x, y) => x.name.localeCompare(y.name, "pt-BR"));
      }),
      // ------------------------------------------------------------------ relógio (Hora Legal Brasileira)
      clockStatus: companyAdminFeatureProcedure("timeTracking").query(async () => {
        let checks = await latestClockChecks(10);
        const last = checks[0] ? new Date(checks[0].checkedAt).getTime() : 0;
        if (Date.now() - last > 6 * 36e5) {
          await runClockCheck("agendado");
          checks = await latestClockChecks(10);
        }
        return { limitMs: MAX_DRIFT_MS, checks };
      }),
      clockCheck: companyAdminFeatureProcedure("timeTracking").mutation(async ({ ctx }) => {
        const r = await runClockCheck("manual");
        void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "clock_check", description: `Conferiu o rel\xF3gio com a Hora Legal Brasileira: ${r.error ? "falhou" : `${r.worstMs} ms`}` });
        return r;
      }),
      // ------------------------------------------------------------------ integridade
      verifyIntegrity: companyAdminFeatureProcedure("timeTracking").mutation(async ({ ctx }) => {
        await ensurePunchLedger();
        const database2 = await getDb();
        if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const rows4 = await database2.select().from(timeEvents).where(eq14(timeEvents.companyId, ctx.accountId)).orderBy(asc(timeEvents.id));
        const result = verifyLedger(rows4.map(toLedgerRow));
        const [stateRows] = await database2.execute(sql15`SELECT lastNsr, lastHash, initializedAt FROM rep_ledger_state WHERE companyId = ${ctx.accountId}`);
        const state = stateRows?.[0] ?? null;
        const stateMismatch = state && Number(state.lastNsr) !== result.lastNsr;
        const legacy = rows4.filter((r) => r.sealedLegacy).length;
        void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "integrity_check", description: `Verifica\xE7\xE3o de integridade do ponto: ${result.ok && !stateMismatch ? "OK" : `${result.problems.length} problema(s)`}` });
        return {
          ok: result.ok && !stateMismatch,
          checkedAt: (/* @__PURE__ */ new Date()).toISOString(),
          originals: result.originals,
          treatments: result.treatments,
          lastNsr: result.lastNsr,
          sealedLegacy: legacy,
          sealedAt: state?.initializedAt ?? null,
          problems: [
            ...stateMismatch ? [{ id: 0, nsr: null, kind: "gap", message: `A contagem de batidas n\xE3o fecha (esperado at\xE9 ${state.lastNsr}, encontrado ${result.lastNsr}): pode ter faltado alguma batida.` }] : [],
            ...result.problems
          ].slice(0, 100),
          totalProblems: result.problems.length + (stateMismatch ? 1 : 0)
        };
      }),
      // ------------------------------------------------------------------ AFD / AEJ
      exportAfd: companyAdminFeatureProcedure("timeTracking").input(z6.object({ from: dateStr4, to: dateStr4 })).mutation(async ({ ctx, input }) => {
        if (input.from > input.to) throw new TRPCError10({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
        await ensurePunchLedger();
        const database2 = await getDb();
        if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const { start, end } = rangeUtc(input.from, input.to);
        const rows4 = (await database2.select().from(timeEvents).where(and13(eq14(timeEvents.companyId, ctx.accountId), eq14(timeEvents.origin, "original"), gte9(effectiveEventTime, start), lt5(effectiveEventTime, end))).orderBy(asc(timeEvents.nsr))).filter((r) => r.nsr != null && r.recordHash).filter((r) => {
          const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ4);
          return d >= input.from && d <= input.to;
        });
        const employer = await employerOf(ctx.accountId);
        const dev = developerInfo();
        const afd = buildAfd({
          employer: { document: employer.document || "", name: employer.name },
          developer: { document: dev.document },
          inpiNumber: dev.inpiNumber,
          from: input.from,
          to: input.to,
          generatedAt: /* @__PURE__ */ new Date(),
          timeZone: TZ4,
          punches: rows4.map((r) => ({ nsr: Number(r.nsr), markedAt: r.deviceTime || r.serverTime, recordedAt: r.serverTime, cpf: r.workerCpf, timeZone: r.timeZone || TZ4, collector: r.collectorId || "02", offline: Boolean(r.offline), hash: r.recordHash }))
        });
        const warnings = [
          ...!employer.document ? ["Falta o CNPJ (ou CPF) da empresa. Cadastre em Dados da empresa."] : [],
          ...rows4.some((r) => !r.workerCpf) ? [`${rows4.filter((r) => !r.workerCpf).length} batida(s) sem CPF do funcion\xE1rio. Complete o cadastro no Espelho de ponto (vale para as pr\xF3ximas batidas).`] : []
        ];
        void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "afd", description: `Gerou AFD ${input.from} a ${input.to} (${rows4.length} marca\xE7\xF5es)`, newData: { from: input.from, to: input.to, count: rows4.length } });
        return { ...fileResponse(afd.content, afd.fileName), count: rows4.length, warnings };
      }),
      exportAej: companyAdminFeatureProcedure("timeTracking").input(z6.object({ from: dateStr4, to: dateStr4 })).mutation(async ({ ctx, input }) => {
        if (input.from > input.to) throw new TRPCError10({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
        await ensurePunchLedger();
        const database2 = await getDb();
        if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const members = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role }).from(memberAccounts2).where(eq14(memberAccounts2.companyId, ctx.accountId))).filter((m) => m.role !== "company_admin");
        const ids = members.map((m) => m.id);
        const { start, end } = rangeUtc(input.from, input.to);
        const all = ids.length ? await database2.select().from(timeEvents).where(and13(eq14(timeEvents.companyId, ctx.accountId), inArray11(timeEvents.memberAccountId, ids), gte9(effectiveEventTime, start), lt5(effectiveEventTime, end))).orderBy(asc(effectiveEventTime)) : [];
        const inPeriod = all.filter((r) => {
          const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ4);
          return d >= input.from && d <= input.to;
        });
        const replacedBy = /* @__PURE__ */ new Map();
        for (const r of all) if (r.replacesEventId) replacedBy.set(r.replacesEventId, r);
        const disregarded = await activeDisregards(ctx.accountId, inPeriod.map((r) => r.id));
        const workers = [];
        const missingCpf = [];
        const missingSchedule = [];
        for (const m of members) {
          const mine = inPeriod.filter((r) => r.memberAccountId === m.id);
          if (!mine.length) continue;
          const labor = await readJson2(`labor_profile:${m.id}`, ctx.accountId);
          const cpf = onlyDigits(labor?.cpf);
          if (cpf.length !== 11) missingCpf.push(m.name);
          const effective = mine.filter((r) => !replacedBy.has(r.id) && !disregarded.has(r.id));
          const byDay = /* @__PURE__ */ new Map();
          for (const r of effective) {
            const d = formatD(r.deviceTime || r.serverTime, TZ4);
            byDay.set(d, [...byDay.get(d) || [], r]);
          }
          const marks = [];
          for (const [, dayRows] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
            for (const s of toAejSequence(dayRows.map((r) => ({ type: r.eventType, time: r.deviceTime || r.serverTime, row: r })))) {
              marks.push({ markedAt: s.time, tpMarc: s.tpMarc, seq: s.seq, fonte: s.row.origin === "original" ? "O" : "I", motivo: s.row.origin === "original" ? null : s.row.reason });
            }
          }
          for (const r of mine.filter((x) => replacedBy.has(x.id))) {
            const by = replacedBy.get(r.id);
            marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Substitu\xEDda por ajuste aprovado por ${by.recordedByName || "administrador"}: ${by.reason || ""}` });
          }
          for (const r of mine.filter((x) => !replacedBy.has(x.id) && disregarded.has(x.id))) {
            const d = disregarded.get(r.id);
            marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Desconsiderada por ${d.decidedByName || "administrador"}: ${d.reason}` });
          }
          marks.sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime());
          const sched = (labor?.schedule || []).filter((p) => Array.isArray(p) && p.length === 2);
          const schedMinutes = sched.reduce((t2, [a, b]) => {
            const [ah, am] = a.split(":").map(Number);
            const [bh, bm] = b.split(":").map(Number);
            return t2 + (bh * 60 + bm - ah * 60 - am + 1440) % 1440;
          }, 0);
          const daily = Number(labor?.dailyMinutes || 0) || schedMinutes;
          if (!sched.length) missingSchedule.push(m.name);
          const pairs = sched.map(([a, b]) => [a.replace(":", ""), b.replace(":", "")]);
          workers.push({ cpf, name: m.name, marks, contract: daily > 0 ? { code: `J${daily}${pairs.length ? `-${pairs.flat().join("")}` : ""}`, dailyMinutes: daily, pairs } : null });
        }
        const employer = await employerOf(ctx.accountId);
        const dev = developerInfo();
        const aej = buildAej({
          employer: { document: employer.document || "", name: employer.name },
          inpiNumber: dev.inpiNumber,
          from: input.from,
          to: input.to,
          generatedAt: /* @__PURE__ */ new Date(),
          timeZone: TZ4,
          ptrp: { version: dev.version, developerDocument: dev.document, developerName: dev.name, developerEmail: dev.email },
          workers
        });
        const warnings = [
          ...!employer.document ? ["Falta o CNPJ (ou CPF) da empresa. Cadastre em Dados da empresa."] : [],
          ...missingCpf.length ? [`Sem CPF no cadastro: ${missingCpf.slice(0, 10).join(", ")}${missingCpf.length > 10 ? "\u2026" : ""}. Complete no cadastro do funcion\xE1rio (Promotores e equipe).`] : [],
          ...workers.some((w) => !w.contract) ? ["H\xE1 funcion\xE1rio sem hor\xE1rio de trabalho cadastrado. Preencha a jornada no Espelho de ponto."] : [],
          ...missingSchedule.length ? [`Sem hor\xE1rio de entrada e sa\xEDda cadastrado: ${missingSchedule.slice(0, 10).join(", ")}${missingSchedule.length > 10 ? "\u2026" : ""}. Complete no cadastro do funcion\xE1rio (Promotores e equipe).`] : []
        ];
        void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "aej", description: `Gerou AEJ ${input.from} a ${input.to} (${workers.length} funcion\xE1rio(s))`, newData: { from: input.from, to: input.to } });
        return { ...fileResponse(aej.content, aej.fileName), count: workers.length, warnings };
      })
    });
  }
});

// shared/privacyNotice.ts
function privacyNoticeText() {
  return [PRIVACY_NOTICE_TITLE, ...PRIVACY_NOTICE_SECTIONS.map((s) => `${s.title}
${s.body}`)].join("\n\n");
}
var PRIVACY_NOTICE_VERSION, PRIVACY_NOTICE_TITLE, PRIVACY_NOTICE_SECTIONS;
var init_privacyNotice = __esm({
  "shared/privacyNotice.ts"() {
    "use strict";
    PRIVACY_NOTICE_VERSION = "2026-11-05.1";
    PRIVACY_NOTICE_TITLE = "Como seus dados s\xE3o usados no ponto e nas visitas";
    PRIVACY_NOTICE_SECTIONS = [
      { title: "Quem \xE9 o respons\xE1vel", body: "A empresa que te contratou (seu empregador) \xE9 a controladora dos seus dados. O GondUp \xE9 o sistema que ela usa e trata os dados s\xF3 seguindo as instru\xE7\xF5es dela." },
      { title: "O que coletamos", body: "Em cada batida de ponto: data e hora (do servidor e do seu aparelho), fuso hor\xE1rio, localiza\xE7\xE3o GPS com a precis\xE3o informada pelo aparelho e dados t\xE9cnicos do aparelho/navegador. Nas visitas a lojas: as fotos que voc\xEA tirar e a localiza\xE7\xE3o no check-in/check-out. Tamb\xE9m seu nome, e-mail, telefone e os dados do contrato informados pela empresa (CPF, cargo, admiss\xE3o, hor\xE1rio)." },
      { title: "Para qu\xEA", body: "Registrar sua jornada como a lei exige, calcular horas e gerar o espelho de ponto, comprovar as visitas feitas e cumprir obriga\xE7\xF5es trabalhistas e fiscais. A localiza\xE7\xE3o \xE9 colhida s\xF3 no momento da batida ou do check-in \u2014 n\xE3o existe rastreamento cont\xEDnuo." },
      { title: "Por que n\xE3o pedimos \u201Cconsentimento\u201D", body: "O registro de ponto \xE9 uma obriga\xE7\xE3o legal do empregador (CLT art. 74) e faz parte do contrato de trabalho. Por isso a base legal \xE9 o cumprimento de obriga\xE7\xE3o legal e a execu\xE7\xE3o do contrato (LGPD art. 7\xBA, II e V). Voc\xEA est\xE1 sendo informado, n\xE3o precisa autorizar." },
      { title: "Quem v\xEA", body: "Os administradores e supervisores da sua empresa e, quando necess\xE1rio, auditores-fiscais do trabalho, a Justi\xE7a e o contador da empresa. O GondUp usa fornecedores de infraestrutura (hospedagem, banco de dados, armazenamento de arquivos, e-mail e monitoramento de erros), alguns com servidores fora do Brasil, sob contrato com cl\xE1usulas de prote\xE7\xE3o de dados." },
      { title: "Por quanto tempo", body: "As marca\xE7\xF5es de ponto s\xE3o guardadas durante o contrato e por pelo menos 5 anos depois dele, por exig\xEAncia legal, e n\xE3o podem ser apagadas nem alteradas \u2014 corre\xE7\xF5es viram registros separados. Fotos de visitas s\xE3o apagadas automaticamente ap\xF3s 60 dias." },
      { title: "Seus direitos", body: "Voc\xEA pode pedir uma c\xF3pia dos seus dados, a corre\xE7\xE3o de dados errados e a elimina\xE7\xE3o ou anonimiza\xE7\xE3o do que n\xE3o for de guarda obrigat\xF3ria. Use o bot\xE3o \u201CMeus dados (LGPD)\u201D no menu ou fale com o administrador da sua empresa." }
    ];
  }
});

// server/lgpd/router.ts
import { randomBytes as randomBytes2 } from "node:crypto";
import { z as z7 } from "zod";
import { TRPCError as TRPCError11 } from "@trpc/server";
import { and as and14, eq as eq15, inArray as inArray12, sql as sql16 } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";
async function ensureLgpdTables() {
  if (ready6) return ready6;
  ready6 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql16.raw(`CREATE TABLE IF NOT EXISTS privacy_acknowledgements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      noticeVersion VARCHAR(32) NOT NULL,
      textHash CHAR(64) NOT NULL,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      acknowledgedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX privacy_ack_member_idx (companyId, memberAccountId, noticeVersion)
    )`));
    await database2.execute(sql16.raw(`CREATE TABLE IF NOT EXISTS lgpd_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      kind VARCHAR(24) NOT NULL,
      message TEXT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'open',
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolvedAt TIMESTAMP NULL,
      resolvedBy VARCHAR(255) NULL,
      resolution TEXT NULL,
      INDEX lgpd_requests_company_idx (companyId, status)
    )`));
  })().catch((e) => {
    ready6 = null;
    throw e;
  });
  return ready6;
}
async function rows2(query) {
  const database2 = await getDb();
  if (!database2) return [];
  const [r] = await database2.execute(query);
  return r || [];
}
async function collectSubjectData(companyId, memberId) {
  await ensureLgpdTables();
  const database2 = await getDb();
  if (!database2) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const [account] = await database2.select({ id: memberAccounts2.id, nome: memberAccounts2.userName, email: memberAccounts2.email, telefone: memberAccounts2.phone, perfil: memberAccounts2.role, ativo: memberAccounts2.active, criadoEm: memberAccounts2.createdAt, atualizadoEm: memberAccounts2.updatedAt, cpf: memberAccounts2.cpf, pis: memberAccounts2.pis, rg: memberAccounts2.rg, dataNascimento: memberAccounts2.birthDate, cargo: memberAccounts2.jobTitle, dataAdmissao: memberAccounts2.admissionDate }).from(memberAccounts2).where(and14(eq15(memberAccounts2.id, memberId), eq15(memberAccounts2.companyId, companyId))).limit(1);
  if (!account) throw new TRPCError11({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
  const laborRaw = await getSetting(`labor_profile:${memberId}`, companyId, "");
  const identity = await getLaborIdentity(companyId, memberId);
  const myVisits = await database2.select().from(visits).where(and14(eq15(visits.companyId, companyId), eq15(visits.promoterId, memberId)));
  const visitIds = myVisits.map((v) => v.id);
  return {
    geradoEm: (/* @__PURE__ */ new Date()).toISOString(),
    observacao: "Exporta\xE7\xE3o dos dados pessoais do titular (LGPD art. 18, II e V). Senhas e tokens de sess\xE3o n\xE3o s\xE3o exportados.",
    conta: account,
    perfilPromotor: (await database2.select().from(promoterProfiles).where(eq15(promoterProfiles.memberAccountId, memberId)))[0] ?? null,
    perfilTrabalhista: { ...laborRaw ? JSON.parse(laborRaw) : {}, ...identity },
    marcacoesDePonto: await database2.select().from(timeEvents).where(and14(eq15(timeEvents.companyId, companyId), eq15(timeEvents.memberAccountId, memberId))),
    pedidosDeCorrecao: await database2.select().from(timeCorrectionRequests).where(and14(eq15(timeCorrectionRequests.companyId, companyId), eq15(timeCorrectionRequests.memberAccountId, memberId))),
    aceitesDoEspelho: await rows2(sql16`SELECT month, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`).catch(() => []),
    cienciasDoAviso: await rows2(sql16`SELECT noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    pedidosLgpd: await rows2(sql16`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    ferias: await database2.select().from(vacationSchedules).where(and14(eq15(vacationSchedules.companyId, companyId), eq15(vacationSchedules.memberAccountId, memberId))),
    visitas: myVisits,
    fotosDeVisita: visitIds.length ? await database2.select().from(visitPhotos).where(and14(eq15(visitPhotos.companyId, companyId), inArray12(visitPhotos.visitId, visitIds))) : [],
    fotosDeLoja: await database2.select().from(storePhotos).where(and14(eq15(storePhotos.companyId, companyId), eq15(storePhotos.promoterId, memberId))),
    evidencias: await database2.select().from(evidences).where(and14(eq15(evidences.companyId, companyId), eq15(evidences.promoterId, memberId))),
    checklists: await database2.select().from(checklistResponses).where(and14(eq15(checklistResponses.companyId, companyId), eq15(checklistResponses.promoterId, memberId))),
    registrosDeAuditoria: await rows2(sql16`SELECT action, module, entityType, description, ipAddress, userAgent, createdAt FROM audit_logs WHERE companyId = ${companyId} AND userId = ${memberId} ORDER BY id DESC LIMIT 5000`).catch(() => [])
  };
}
function summarizeSubjectData(data) {
  const count = (v) => Array.isArray(v) ? v.length : v ? 1 : 0;
  return [
    ["Conta de acesso (nome, e-mail, telefone)", count(data.conta), "Execu\xE7\xE3o do contrato"],
    ["Perfil trabalhista (CPF, cargo, admiss\xE3o, hor\xE1rio)", count(data.perfilTrabalhista), "Obriga\xE7\xE3o legal"],
    ["Marca\xE7\xF5es de ponto (hora, fuso, GPS, aparelho)", count(data.marcacoesDePonto), "Obriga\xE7\xE3o legal \u2014 guarda obrigat\xF3ria"],
    ["Pedidos de corre\xE7\xE3o de ponto", count(data.pedidosDeCorrecao), "Obriga\xE7\xE3o legal"],
    ["Aceites do espelho de ponto", count(data.aceitesDoEspelho), "Obriga\xE7\xE3o legal"],
    ["Ci\xEAncias do aviso de privacidade", count(data.cienciasDoAviso), "Obriga\xE7\xE3o legal (prova de transpar\xEAncia)"],
    ["F\xE9rias", count(data.ferias), "Obriga\xE7\xE3o legal"],
    ["Visitas (check-in/out com GPS)", count(data.visitas), "Execu\xE7\xE3o do contrato"],
    ["Fotos de visita e de loja (metadados)", count(data.fotosDeVisita) + count(data.fotosDeLoja), "Execu\xE7\xE3o do contrato \u2014 apagadas em 60 dias"],
    ["Evid\xEAncias e checklists", count(data.evidencias) + count(data.checklists), "Execu\xE7\xE3o do contrato"],
    ["Registros de auditoria (a\xE7\xF5es do titular)", count(data.registrosDeAuditoria), "Leg\xEDtimo interesse / defesa em processo"]
  ];
}
async function summaryPdf(data, companyName) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;
  const line = (t2, size = 10, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    for (const l of doc.splitTextToSize(t2, 180)) {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(l, 15, y);
      y += size * 0.5;
    }
    y += 1.5;
  };
  line("Relat\xF3rio de dados pessoais do titular (LGPD art. 18)", 14, true);
  line(`Empresa (controladora): ${companyName}`);
  line(`Titular: ${data.conta.nome} \u2014 ${data.conta.email}`);
  line(`Gerado em: ${new Date(data.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (hor\xE1rio de Bras\xEDlia)`);
  y += 3;
  line("Categorias de dados encontradas", 12, true);
  for (const [label, n, basis] of summarizeSubjectData(data)) line(`\u2022 ${label}: ${n} registro(s). Base legal: ${basis}.`);
  y += 3;
  line("O arquivo dados.json, no mesmo pacote, cont\xE9m o conte\xFAdo completo em formato leg\xEDvel por m\xE1quina (portabilidade).", 9);
  line("As marca\xE7\xF5es de ponto n\xE3o podem ser apagadas: a lei exige guard\xE1-las (CLT art. 74; Portaria MTP 671; prescri\xE7\xE3o de 5 anos \u2014 CF art. 7\xBA, XXIX).", 9);
  return Buffer.from(doc.output("arraybuffer"));
}
async function buildSubjectExportZip(companyId, memberId) {
  const data = await collectSubjectData(companyId, memberId);
  const database2 = await getDb();
  const [company] = database2 ? await rows2(sql16`SELECT name FROM companies WHERE id = ${companyId}`) : [];
  const pdf = await summaryPdf(data, company?.name || "");
  const json2 = JSON.stringify(data, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2);
  const zip = zipSync({
    "LEIA-ME.txt": strToU8("Pacote de dados pessoais (LGPD art. 18).\r\n- resumo.pdf: resumo leg\xEDvel.\r\n- dados.json: todos os dados.\r\nHor\xE1rios em UTC (ISO 8601).\r\n"),
    "dados.json": strToU8(json2),
    "resumo.pdf": new Uint8Array(pdf)
  });
  const safe = data.conta.nome.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `titular-${memberId}`;
  return { fileName: `dados-lgpd-${safe}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.zip`, buffer: Buffer.from(zip), summary: summarizeSubjectData(data) };
}
async function anonymizeSubject(companyId, memberId) {
  const database2 = await getDb();
  if (!database2) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const [m] = await database2.select({ id: memberAccounts2.id, role: memberAccounts2.role }).from(memberAccounts2).where(and14(eq15(memberAccounts2.id, memberId), eq15(memberAccounts2.companyId, companyId))).limit(1);
  if (!m) throw new TRPCError11({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
  if (m.role === "company_admin") throw new TRPCError11({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel anonimizar um administrador da empresa." });
  const pseudonym = `Titular anonimizado #${memberId}`;
  await database2.update(memberAccounts2).set({
    userName: pseudonym,
    email: `anonimizado+${companyId}-${memberId}@invalid.gondup`,
    phone: null,
    active: false,
    passwordHash: `!anonimizado:${randomBytes2(24).toString("hex")}`,
    recoveryCodeHash: null
  }).where(and14(eq15(memberAccounts2.id, memberId), eq15(memberAccounts2.companyId, companyId)));
  await database2.delete(memberSessions2).where(eq15(memberSessions2.memberAccountId, memberId));
  await database2.update(promoterProfiles).set({ employeeCode: null }).where(eq15(promoterProfiles.memberAccountId, memberId));
  const now = /* @__PURE__ */ new Date();
  await database2.update(storePhotos).set({ expiresAt: now }).where(and14(eq15(storePhotos.companyId, companyId), eq15(storePhotos.promoterId, memberId)));
  const myVisits = await database2.select({ id: visits.id }).from(visits).where(and14(eq15(visits.companyId, companyId), eq15(visits.promoterId, memberId)));
  if (myVisits.length) {
    const ids = myVisits.map((v) => v.id);
    await database2.update(visitPhotos).set({ expiresAt: now }).where(and14(eq15(visitPhotos.companyId, companyId), inArray12(visitPhotos.visitId, ids)));
    await database2.update(visits).set({ startLatitude: null, startLongitude: null, endLatitude: null, endLongitude: null, notes: null }).where(and14(eq15(visits.companyId, companyId), inArray12(visits.id, ids)));
  }
  await database2.update(evidences).set({ latitude: null, longitude: null, caption: null }).where(and14(eq15(evidences.companyId, companyId), eq15(evidences.promoterId, memberId)));
  return { pseudonym };
}
var ready6, noticeHash, KIND_LABEL, ANONYMIZE_PLAN, kindSchema, lgpdRouter;
var init_router2 = __esm({
  "server/lgpd/router.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_schema();
    init_audit();
    init_privacyNotice();
    init_repFormat();
    init_companyRegistry();
    ready6 = null;
    noticeHash = () => sha256(privacyNoticeText());
    KIND_LABEL = { export: "C\xF3pia dos meus dados", correction: "Corre\xE7\xE3o de dados", anonymize: "Elimina\xE7\xE3o/anonimiza\xE7\xE3o", info: "D\xFAvida sobre meus dados" };
    ANONYMIZE_PLAN = {
      apaga: ["Nome, e-mail e telefone da conta (substitu\xEDdos por pseud\xF4nimo)", "Senha, c\xF3digo de recupera\xE7\xE3o e sess\xF5es (a conta fica inutiliz\xE1vel)", "C\xF3digo de funcion\xE1rio", "Fotos de visita e de loja (apagadas na pr\xF3xima limpeza autom\xE1tica)", "Coordenadas GPS de visitas e evid\xEAncias", "Observa\xE7\xF5es de visitas e legendas de evid\xEAncias"],
      mantem: ["Marca\xE7\xF5es de ponto completas (hora, GPS, NSR, hash) \u2014 guarda obrigat\xF3ria por lei e protegidas contra altera\xE7\xE3o", "Perfil trabalhista (CPF, cargo, admiss\xE3o, hor\xE1rio) \u2014 necess\xE1rio para AFD/AEJ e espelho durante o prazo legal", "Pedidos de corre\xE7\xE3o, aceites do espelho, f\xE9rias e auditoria \u2014 prova trabalhista"]
    };
    kindSchema = z7.enum(["export", "correction", "anonymize", "info"]);
    lgpdRouter = router({
      /** Aviso ao trabalhador: precisa mostrar? (só para promotores) */
      noticeStatus: companyBillingProcedure.query(async ({ ctx }) => {
        const base = { version: PRIVACY_NOTICE_VERSION, required: false, acknowledgedAt: null };
        if (ctx.user?.role !== "promoter" || !ctx.memberAccountId || ctx.actingAsPlatform) return base;
        await ensureLgpdTables();
        const r = await rows2(sql16`SELECT acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} AND noticeVersion = ${PRIVACY_NOTICE_VERSION} ORDER BY id DESC LIMIT 1`);
        return { ...base, required: !r.length, acknowledgedAt: r[0]?.acknowledgedAt ?? null };
      }),
      acknowledgeNotice: companyBillingProcedure.input(z7.object({ version: z7.string().max(32) })).mutation(async ({ ctx, input }) => {
        if (!ctx.memberAccountId) throw new TRPCError11({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        if (input.version !== PRIVACY_NOTICE_VERSION) throw new TRPCError11({ code: "CONFLICT", message: "O aviso foi atualizado. Recarregue a p\xE1gina para ler a vers\xE3o nova." });
        await ensureLgpdTables();
        const meta = requestMeta(ctx);
        const hash = noticeHash();
        const database2 = await getDb();
        if (!database2) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await database2.execute(sql16`INSERT INTO privacy_acknowledgements (companyId, memberAccountId, noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt)
      VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${PRIVACY_NOTICE_VERSION}, ${hash}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
        void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "privacy_notice", entityId: ctx.memberAccountId, description: `Ci\xEAncia do aviso de privacidade vers\xE3o ${PRIVACY_NOTICE_VERSION} (hash ${hash.slice(0, 12)}\u2026)`, newData: { version: PRIVACY_NOTICE_VERSION, textHash: hash } });
        return { success: true };
      }),
      /** Titular: abrir pedido (art. 18). */
      createRequest: companyBillingProcedure.input(z7.object({ kind: kindSchema, message: z7.string().trim().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
        if (!ctx.memberAccountId) throw new TRPCError11({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        await ensureLgpdTables();
        const meta = requestMeta(ctx);
        const database2 = await getDb();
        if (!database2) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await database2.execute(sql16`INSERT INTO lgpd_requests (companyId, memberAccountId, kind, message, ipAddress, userAgent) VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.kind}, ${input.message || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null})`);
        void auditFromCtx(ctx, { action: "create", module: "lgpd", entityType: "lgpd_request", entityId: ctx.memberAccountId, description: `Pedido do titular (LGPD): ${KIND_LABEL[input.kind]}` });
        return { success: true };
      }),
      myRequests: companyBillingProcedure.query(async ({ ctx }) => {
        if (!ctx.memberAccountId) return [];
        await ensureLgpdTables();
        return rows2(sql16`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} ORDER BY id DESC LIMIT 50`);
      }),
      /** Titular baixa a própria cópia (mesmo pacote do administrador). */
      exportMine: companyBillingProcedure.mutation(async ({ ctx }) => {
        if (!ctx.memberAccountId) throw new TRPCError11({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
        const z18 = await buildSubjectExportZip(ctx.accountId, ctx.memberAccountId);
        void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: ctx.memberAccountId, description: "Titular baixou c\xF3pia dos pr\xF3prios dados (LGPD art. 18)" });
        return { fileName: z18.fileName, base64: z18.buffer.toString("base64") };
      }),
      // ------------------------------------------------------------- administrador
      requests: companyManagerProcedure.input(z7.object({ status: z7.enum(["open", "all"]).default("open") }).optional()).query(async ({ ctx, input }) => {
        await ensureLgpdTables();
        const companyId = Number(ctx.accountId);
        return rows2(sql16`SELECT r.id, r.memberAccountId, m.userName AS name, r.kind, r.message, r.status, r.createdAt, r.resolvedAt, r.resolvedBy, r.resolution
      FROM lgpd_requests r LEFT JOIN member_accounts m ON m.id = r.memberAccountId WHERE r.companyId = ${companyId} ${input?.status === "all" ? sql16`` : sql16`AND r.status = 'open'`} ORDER BY r.id DESC LIMIT 200`);
      }),
      acknowledgements: companyManagerProcedure.query(async ({ ctx }) => {
        await ensureLgpdTables();
        return rows2(sql16`SELECT m.id AS memberId, m.userName AS name, m.active, MAX(CASE WHEN a.noticeVersion = ${PRIVACY_NOTICE_VERSION} THEN a.acknowledgedAt END) AS acknowledgedAt
      FROM member_accounts m LEFT JOIN privacy_acknowledgements a ON a.memberAccountId = m.id AND a.companyId = m.companyId
      WHERE m.companyId = ${Number(ctx.accountId)} AND m.role = 'promoter' GROUP BY m.id, m.userName, m.active ORDER BY m.userName`);
      }),
      plan: companyManagerProcedure.query(() => ANONYMIZE_PLAN),
      exportMember: companyManagerProcedure.input(z7.object({ memberId: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const companyId = Number(ctx.accountId);
        const z18 = await buildSubjectExportZip(companyId, input.memberId);
        void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: input.memberId, description: "Exportou todos os dados pessoais de um titular (LGPD art. 18)" });
        return { fileName: z18.fileName, base64: z18.buffer.toString("base64"), summary: z18.summary };
      }),
      anonymizeMember: companyManagerProcedure.input(z7.object({ memberId: z7.number().int().positive(), confirm: z7.literal("ANONIMIZAR"), requestId: z7.number().int().positive().optional(), reason: z7.string().trim().min(5).max(500) })).mutation(async ({ ctx, input }) => {
        const companyId = Number(ctx.accountId);
        await ensureLgpdTables();
        const { pseudonym } = await anonymizeSubject(companyId, input.memberId);
        if (input.requestId) {
          const database2 = await getDb();
          await database2?.execute(sql16`UPDATE lgpd_requests SET status = 'done', resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${`Anonimizado: ${input.reason}`} WHERE id = ${input.requestId} AND companyId = ${companyId}`);
        }
        void auditFromCtx(ctx, { action: "delete", module: "lgpd", entityType: "subject_anonymization", entityId: input.memberId, entityLabel: pseudonym, description: `Anonimizou dados pessoais do titular #${input.memberId} (ponto preservado por obriga\xE7\xE3o legal). Motivo: ${input.reason}`, newData: { plan: ANONYMIZE_PLAN, requestId: input.requestId ?? null } });
        return { success: true, pseudonym };
      }),
      resolveRequest: companyManagerProcedure.input(z7.object({ id: z7.number().int().positive(), status: z7.enum(["done", "rejected"]), resolution: z7.string().trim().min(3).max(2e3) })).mutation(async ({ ctx, input }) => {
        await ensureLgpdTables();
        const database2 = await getDb();
        if (!database2) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await database2.execute(sql16`UPDATE lgpd_requests SET status = ${input.status}, resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${input.resolution} WHERE id = ${input.id} AND companyId = ${Number(ctx.accountId)}`);
        void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "lgpd_request", entityId: input.id, description: `Pedido LGPD #${input.id} ${input.status === "done" ? "atendido" : "recusado"}: ${input.resolution}` });
        return { success: true };
      })
    });
  }
});

// server/modules/timesheetArchive.ts
var timesheetArchive_exports = {};
__export(timesheetArchive_exports, {
  archiveClosedMonth: () => archiveClosedMonth,
  buildMirrorPdfBuffer: () => buildMirrorPdfBuffer,
  ensureTimesheetArchivesTable: () => ensureTimesheetArchivesTable,
  runTimesheetArchiveJob: () => runTimesheetArchiveJob,
  timesheetArchiveRouter: () => timesheetArchiveRouter
});
import { createHash as createHash4 } from "node:crypto";
import { z as z8 } from "zod";
import { TRPCError as TRPCError12 } from "@trpc/server";
import { and as and15, eq as eq16, inArray as inArray13, sql as sql17 } from "drizzle-orm";
async function ensureTimesheetArchivesTable() {
  if (ready7) return ready7;
  ready7 = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(sql17`CREATE TABLE IF NOT EXISTS timesheet_archives (
      id int AUTO_INCREMENT PRIMARY KEY,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      year smallint NOT NULL,
      month tinyint NOT NULL,
      version int NOT NULL DEFAULT 1,
      fileKey varchar(512) NULL,
      contentHash varchar(64) NULL,
      mimeType varchar(100) NULL DEFAULT 'application/pdf',
      sizeBytes int NULL,
      status enum('pending','ready','failed') NOT NULL DEFAULT 'pending',
      generatedAt timestamp NULL,
      notes text NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY timesheet_archives_unique (companyId, memberAccountId, year, month, version),
      KEY timesheet_archives_company_idx (companyId, year, month)
    )`);
  })().catch((e) => {
    ready7 = null;
    throw e;
  });
  return ready7;
}
async function readJson3(key, companyId) {
  const raw = await getSetting(key, companyId, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function companyMembers2(companyId, memberIds) {
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  const where = [eq16(memberAccounts2.companyId, companyId)];
  if (memberIds?.length) where.push(inArray13(memberAccounts2.id, memberIds));
  const rows4 = await database2.select({
    id: memberAccounts2.id,
    name: memberAccounts2.userName,
    role: memberAccounts2.role,
    active: memberAccounts2.active,
    employeeCode: promoterProfiles.employeeCode
  }).from(memberAccounts2).leftJoin(promoterProfiles, eq16(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and15(...where));
  return rows4.filter((r) => r.role !== "company_admin");
}
async function buildMirrorPdfBuffer(opts) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297, H = 210, M = 10;
  let y = M;
  doc.setFontSize(16).setFont("helvetica", "bold").text("Espelho de Ponto (arquivo hist\xF3rico)", M, y + 5);
  y += 10;
  doc.setFontSize(9).setFont("helvetica", "normal");
  doc.text(`Empresa: ${opts.companyName}`, M, y);
  doc.text(`Funcion\xE1rio: ${opts.memberName}${opts.employeeCode ? ` (${opts.employeeCode})` : ""}`, 150, y);
  y += 5;
  doc.text(`Per\xEDodo: ${fmtDate(opts.from)} a ${fmtDate(opts.to)}`, M, y);
  doc.text(`Gerado em: ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: TZ5 })}`, 150, y);
  y += 7;
  doc.setFontSize(7).setFont("helvetica", "bold").setFillColor(226, 232, 240);
  const widths = [16, 8, 16, 18, 18, 18, 18, 14, 12, 12, 12, 12, 14];
  const obsW = W - 2 * M - widths.reduce((a, b) => a + b, 0);
  const cols = [...widths, obsW];
  doc.rect(M, y, W - 2 * M, 6, "F");
  let x = M;
  MIRROR_HEADERS.forEach((h, i) => {
    doc.text(h, x + 1, y + 4, { maxWidth: cols[i] - 2 });
    x += cols[i];
  });
  y += 6;
  doc.setFont("helvetica", "normal").setFontSize(6.5);
  for (const row2 of mirrorRows(opts.report)) {
    if (y > H - 15) {
      doc.addPage("a4", "landscape");
      y = M;
    }
    const lines = row2.map((c, i) => doc.splitTextToSize(String(c), cols[i] - 2));
    const h = Math.max(...lines.map((l) => l.length), 1) * 3 + 1.5;
    let cx = M;
    doc.setDrawColor(200);
    lines.forEach((l, i) => {
      doc.rect(cx, y, cols[i], h);
      doc.text(l, cx + 1, y + 2.8);
      cx += cols[i];
    });
    y += h;
  }
  y += 4;
  doc.setFontSize(8).setFont("helvetica", "bold").text("Totais", M, y);
  y += 4;
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  for (const [k, v] of totalsLines(opts.report.totals)) {
    if (y > H - 12) {
      doc.addPage("a4", "landscape");
      y = M;
    }
    doc.text(`${k}: ${v}`, M, y);
    y += 3.8;
  }
  y += 3;
  doc.setFontSize(7).setTextColor(80);
  doc.text("Documento hist\xF3rico gerado automaticamente. N\xE3o substitui as marca\xE7\xF5es originais registradas no sistema.", M, y);
  doc.setTextColor(0);
  return Buffer.from(doc.output("arraybuffer"));
}
async function archiveClosedMonth(companyId, year, month, memberIds) {
  await ensureTimesheetArchivesTable();
  await ensureAdjustmentsTable();
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const members = await companyMembers2(companyId, memberIds);
  const company = (await database2.select({ name: companies2.name }).from(companies2).where(eq16(companies2.id, companyId)).limit(1))[0];
  const ids = members.map((m) => m.id);
  const eventRows = await loadMirrorEventRows(companyId, ids, from, to);
  const byMember = /* @__PURE__ */ new Map();
  for (const r of eventRows) byMember.set(r.memberAccountId, [...byMember.get(r.memberAccountId) || [], r]);
  const excusesByMember = await loadApprovedDayExcuses(companyId, ids, from, to);
  const vacationsByMember = await loadMemberVacations(companyId, ids, from, to);
  const treatmentsByMember = await loadDayTreatments(companyId, ids, from, to);
  const options = await loadMirrorOptions(companyId);
  const adjByEvent = await loadAdjustmentsByEvent(companyId, ids);
  const today = todayInTimeZone(TZ5);
  const results = [];
  for (const m of members) {
    try {
      const labor = await readJson3(`labor_profile:${m.id}`, companyId);
      const events = toMirrorEvents(byMember.get(m.id) || [], adjByEvent);
      const report = buildMirror({ events, from, to, timeZone: TZ5, labor, excuses: excusesByMember.get(m.id) || [], vacations: vacationsByMember.get(m.id) || [], treatments: treatmentsByMember.get(m.id) || [], options, today });
      const buf = await buildMirrorPdfBuffer({
        companyName: company?.name ?? "",
        memberName: m.name,
        employeeCode: m.employeeCode ?? null,
        from,
        to,
        report
      });
      const hash = createHash4("sha256").update(buf).digest("hex");
      const existing = (await database2.execute(sql17`SELECT id, version, contentHash FROM timesheet_archives WHERE companyId = ${companyId} AND memberAccountId = ${m.id} AND year = ${year} AND month = ${month} ORDER BY version DESC LIMIT 1`))[0] ?? [];
      const last = existing[0];
      if (last && last.contentHash === hash) {
        results.push({ companyId, memberId: m.id, year, month, version: last.version, skipped: true, reason: "hash igual" });
        continue;
      }
      const version = last ? Number(last.version) + 1 : 1;
      const keyBase = `archives/${companyId}/${year}/${String(month).padStart(2, "0")}/${m.id}/v${version}-espelho.pdf`;
      const uploaded = await storagePut(keyBase, buf, "application/pdf");
      await database2.execute(sql17`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, fileKey, contentHash, mimeType, sizeBytes, status, generatedAt)
        VALUES (${companyId}, ${m.id}, ${year}, ${month}, ${version}, ${uploaded.key}, ${hash}, 'application/pdf', ${buf.length}, 'ready', NOW())`);
      results.push({ companyId, memberId: m.id, year, month, version, skipped: false });
    } catch (err) {
      console.warn(`[archive] company=${companyId} member=${m.id} ${year}-${month}`, err);
      try {
        await database2.execute(sql17`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, status, notes, generatedAt)
          VALUES (${companyId}, ${m.id}, ${year}, ${month}, 1, 'failed', ${String(err?.message || err).slice(0, 500)}, NOW())
          ON DUPLICATE KEY UPDATE status = 'failed', notes = VALUES(notes), generatedAt = NOW()`);
      } catch {
      }
      results.push({ companyId, memberId: m.id, year, month, version: 0, skipped: false, reason: String(err?.message || err) });
    }
  }
  return results;
}
function eligibleMonths(now = /* @__PURE__ */ new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  const out = [];
  if (d >= GRACE_DAYS) {
    out.push(m === 1 ? { year: y - 1, month: 12 } : { year: y, month: m - 1 });
  }
  out.push(m <= 2 ? { year: y - 1, month: m === 1 ? 11 : 12 } : { year: y, month: m - 2 });
  return out;
}
async function runTimesheetArchiveJob(opts) {
  await ensureTimesheetArchivesTable();
  const database2 = await getDb();
  if (!database2) return { processed: 0, results: [] };
  const months = eligibleMonths();
  const companiesRows = opts?.companyId ? await database2.select({ id: companies2.id }).from(companies2).where(eq16(companies2.id, opts.companyId)).limit(1) : await database2.select({ id: companies2.id }).from(companies2).where(eq16(companies2.active, true)).limit(opts?.limitCompanies ?? 20);
  const all = [];
  for (const c of companiesRows) {
    for (const { year, month } of months) {
      const r = await archiveClosedMonth(c.id, year, month);
      all.push(...r);
    }
  }
  return { processed: companiesRows.length, results: all };
}
var TZ5, GRACE_DAYS, ready7, timesheetArchiveRouter;
var init_timesheetArchive = __esm({
  "server/modules/timesheetArchive.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_schema();
    init_timesheetMirror();
    init_storage();
    init_timesheetMirror2();
    init_correctionExtras();
    init_dayTreatments();
    init_mirrorData();
    TZ5 = "America/Sao_Paulo";
    GRACE_DAYS = 5;
    ready7 = null;
    timesheetArchiveRouter = router({
      list: companyAdminFeatureProcedure("timeTracking").input(z8.object({
        memberId: z8.number().int().positive().optional(),
        year: z8.number().int().min(2020).max(2100).optional(),
        month: z8.number().int().min(1).max(12).optional()
      }).optional()).query(async ({ ctx, input }) => {
        await ensureTimesheetArchivesTable();
        const database2 = await getDb();
        if (!database2) return [];
        const conds = [sql17`a.companyId = ${ctx.accountId}`];
        if (input?.memberId) conds.push(sql17`a.memberAccountId = ${input.memberId}`);
        if (input?.year) conds.push(sql17`a.year = ${input.year}`);
        if (input?.month) conds.push(sql17`a.month = ${input.month}`);
        const rows4 = (await database2.execute(sql17`SELECT a.*, m.userName AS memberName
        FROM timesheet_archives a
        LEFT JOIN member_accounts m ON m.id = a.memberAccountId AND m.companyId = a.companyId
        WHERE ${sql17.join(conds, sql17` AND `)}
        ORDER BY a.year DESC, a.month DESC, a.memberAccountId, a.version DESC
        LIMIT 500`))[0] ?? [];
        return rows4;
      }),
      downloadUrl: companyAdminFeatureProcedure("timeTracking").input(z8.object({ id: z8.number().int().positive() })).query(async ({ ctx, input }) => {
        await ensureTimesheetArchivesTable();
        const database2 = await getDb();
        if (!database2) throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const rows4 = (await database2.execute(sql17`SELECT fileKey, status FROM timesheet_archives WHERE id = ${input.id} AND companyId = ${ctx.accountId} LIMIT 1`))[0] ?? [];
        const row2 = rows4[0];
        if (!row2 || row2.status !== "ready" || !row2.fileKey) throw new TRPCError12({ code: "NOT_FOUND", message: "Arquivo n\xE3o encontrado ou indispon\xEDvel." });
        const url = await storageGetSignedUrl(row2.fileKey);
        return { url };
      }),
      archiveNow: companyAdminFeatureProcedure("timeTracking").input(z8.object({ year: z8.number().int().min(2020).max(2100), month: z8.number().int().min(1).max(12) })).mutation(async ({ ctx, input }) => {
        const now = /* @__PURE__ */ new Date();
        const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1;
        if (input.year > curY || input.year === curY && input.month >= curM) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel arquivar o m\xEAs corrente ou futuro." });
        }
        const results = await archiveClosedMonth(ctx.accountId, input.year, input.month);
        return { success: true, results };
      })
    });
  }
});

// shared/pixBrcode.ts
function sanitizePixText(value, max) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function tlv(id3, value) {
  const v = String(value);
  const len = String(v.length).padStart(2, "0");
  return `${id3}${len}${v}`;
}
function crc16Ccitt(payload2) {
  let crc = 65535;
  for (let i = 0; i < payload2.length; i++) {
    crc ^= payload2.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 32768 ? (crc << 1 ^ 4129) & 65535 : crc << 1 & 65535;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function formatAmount(amount) {
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor Pix inv\xE1lido.");
  return n.toFixed(2);
}
function buildPixBrcode(input) {
  const key = String(input.key ?? DEFAULTS.key).trim();
  if (!key) throw new Error("Chave Pix obrigat\xF3ria.");
  const name = sanitizePixText(input.name ?? DEFAULTS.name, 25) || DEFAULTS.name;
  const city = sanitizePixText(input.city ?? DEFAULTS.city, 15) || DEFAULTS.city;
  const amount = formatAmount(input.amount);
  const txid = sanitizePixText(input.txid ?? "***", 25) || "***";
  const gui = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const desc8 = input.description ? tlv("02", sanitizePixText(input.description, 25)) : "";
  const merchantAccount = tlv("26", gui + desc8);
  const additional = tlv("62", tlv("05", txid));
  const body = tlv("00", "01") + tlv("01", "11") + // estático
  merchantAccount + tlv("52", "0000") + tlv("53", "986") + tlv("54", amount) + tlv("58", "BR") + tlv("59", name) + tlv("60", city) + additional + "6304";
  return body + crc16Ccitt(body);
}
function getDefaultPixConfig() {
  return {
    key: typeof process !== "undefined" && process.env?.PIX_KEY?.trim() || DEFAULTS.key,
    name: sanitizePixText(
      typeof process !== "undefined" && process.env?.PIX_MERCHANT_NAME || DEFAULTS.name,
      25
    ) || DEFAULTS.name,
    city: sanitizePixText(
      typeof process !== "undefined" && process.env?.PIX_MERCHANT_CITY || DEFAULTS.city,
      15
    ) || DEFAULTS.city,
    whatsapp: typeof process !== "undefined" && process.env?.PIX_WHATSAPP?.replace(/\D/g, "") || "5551991667804"
  };
}
var DEFAULTS;
var init_pixBrcode = __esm({
  "shared/pixBrcode.ts"() {
    "use strict";
    DEFAULTS = {
      key: "ivanhonemann09@gmail.com",
      name: "IVAN MATEUS HONEMANN",
      city: "SAPIRANGA"
    };
  }
});

// shared/paymentReminderCopy.ts
function countDaysLabel(days) {
  const n = Math.max(0, Math.trunc(Number.isFinite(days) ? days : 0));
  return n === 1 ? "1 dia" : `${n} dias`;
}
function shortDueDate(input) {
  if (!input) return "";
  const s = String(input).trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}`;
  const br = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(s);
  if (br) return `${br[1].padStart(2, "0")}/${br[2].padStart(2, "0")}`;
  const long = /^(\d{1,2})\s+de\s+([a-zç]+)/i.exec(s);
  if (long) {
    const months = {
      janeiro: "01",
      fevereiro: "02",
      mar\u00E7o: "03",
      marco: "03",
      abril: "04",
      maio: "05",
      junho: "06",
      julho: "07",
      agosto: "08",
      setembro: "09",
      outubro: "10",
      novembro: "11",
      dezembro: "12"
    };
    const mm = months[long[2].toLowerCase()];
    if (mm) return `${long[1].padStart(2, "0")}/${mm}`;
  }
  return s;
}
function amountPhrase(amountLabel) {
  return amountLabel ? `Mensalidade de ${amountLabel}` : "A mensalidade";
}
function paymentReminderHeadline(r) {
  const when = shortDueDate(r.dueDate || r.dueDateLabel);
  const withOf = amountPhrase(r.amountLabel);
  if (r.phase === "blocked") {
    return when ? `${withOf} venceu em ${when}. Acesso bloqueado.` : `${withOf} venceu. Acesso bloqueado.`;
  }
  if (r.phase === "overdue") {
    const left = Math.max(0, r.daysUntilBlock ?? 0);
    const due = when ? ` venceu em ${when}` : " venceu";
    if (left === 0) return `${withOf}${due}. Bloqueio hoje.`;
    return `${withOf}${due}. Bloqueio em ${countDaysLabel(left)}.`;
  }
  const days = r.daysUntilDue ?? 0;
  if (days <= 0) {
    return when ? `${withOf} vence hoje (${when})` : `${withOf} vence hoje`;
  }
  if (when) return `${withOf} vence em ${when} (${countDaysLabel(days)})`;
  return `${withOf} vence em ${countDaysLabel(days)}`;
}
function paymentReminderMessage(r) {
  const headline = paymentReminderHeadline(r);
  if (r.phase === "blocked") return `${headline} Regularize via Pix ou WhatsApp.`;
  if (r.phase === "overdue") return `${headline} Pague via Pix ou envie o comprovante no WhatsApp.`;
  return headline;
}
var init_paymentReminderCopy = __esm({
  "shared/paymentReminderCopy.ts"() {
    "use strict";
  }
});

// server/paymentReminder.ts
var paymentReminder_exports = {};
__export(paymentReminder_exports, {
  BILLING_DAY_KEY: () => BILLING_DAY_KEY,
  BLOCK_AFTER_OVERDUE_KEY: () => BLOCK_AFTER_OVERDUE_KEY,
  MONTHLY_AMOUNT_KEY: () => MONTHLY_AMOUNT_KEY,
  PRE_DUE_REMINDER_DAYS: () => PRE_DUE_REMINDER_DAYS,
  addCalendarMonthsIso: () => addCalendarMonthsIso,
  calendarDaysUntil: () => calendarDaysUntil,
  ensureBillingDay: () => ensureBillingDay,
  getPaymentReminder: () => getPaymentReminder,
  markCompanyPaid: () => markCompanyPaid,
  nextDueAfterMarkPaid: () => nextDueAfterMarkPaid,
  resolveBillingDay: () => resolveBillingDay,
  resolveGraceDays: () => resolveGraceDays,
  resolveMonthlyAmount: () => resolveMonthlyAmount,
  todayIsoBR: () => todayIsoBR
});
function todayIsoBR(now = /* @__PURE__ */ new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: BR_TZ });
}
function calendarDaysUntil(dueIso, todayIso = todayIsoBR()) {
  const a = Date.parse(`${todayIso}T12:00:00-03:00`);
  const b = Date.parse(`${dueIso}T12:00:00-03:00`);
  return Math.round((b - a) / 864e5);
}
function addCalendarMonthsIso(isoDate2, months, anchorDay) {
  const [y, m, d] = isoDate2.split("-").map(Number);
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : d;
  const probe = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth() + 1, 0)).getUTCDate();
  probe.setUTCDate(Math.min(day, lastDay));
  return probe.toISOString().slice(0, 10);
}
function nextDueAfterMarkPaid(currentDueIso, anchorDay) {
  const day = anchorDay && anchorDay >= 1 && anchorDay <= 31 ? anchorDay : Number(currentDueIso.slice(8, 10));
  return addCalendarMonthsIso(currentDueIso, 1, day);
}
function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: BR_TZ });
}
function moneyLabel(amount) {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function monthLabel(iso) {
  const [y, m] = iso.split("-").map(Number);
  const names = ["janeiro", "fevereiro", "mar\xE7o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[(m || 1) - 1]}/${y}`;
}
async function resolveBillingDay(companyId, fallbackDueIso) {
  const raw = (await getSetting(BILLING_DAY_KEY, companyId, "")).trim();
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
  if (fallbackDueIso && /^\d{4}-\d{2}-\d{2}/.test(fallbackDueIso)) {
    const day = Number(fallbackDueIso.slice(8, 10));
    if (day >= 1 && day <= 31) return day;
  }
  return null;
}
async function ensureBillingDay(companyId, dueIso) {
  const existing = await resolveBillingDay(companyId, null);
  if (existing) return existing;
  const day = Number(dueIso.slice(8, 10));
  const safe = Math.min(31, Math.max(1, day || 1));
  await setSetting(BILLING_DAY_KEY, String(safe), companyId);
  return safe;
}
async function resolveMonthlyAmount(companyId) {
  const custom = (await getSetting(MONTHLY_AMOUNT_KEY, companyId, "")).trim();
  if (custom && /^\d+(\.\d{1,2})?$/.test(custom) && Number(custom) > 0) return Number(custom).toFixed(2);
  const resolved = await resolveCompanyPlan(companyId);
  const fromSub = resolved.subscription?.amount ? String(resolved.subscription.amount) : "";
  if (fromSub && Number(fromSub) > 0) return Number(fromSub).toFixed(2);
  const fromPlan = resolved.plan?.price != null ? String(resolved.plan.price) : "";
  if (fromPlan && Number(fromPlan) > 0) return Number(fromPlan).toFixed(2);
  return null;
}
async function resolveGraceDays(companyId) {
  const raw = (await getSetting(BLOCK_AFTER_OVERDUE_KEY, companyId, "")).trim();
  if (raw === "") return DEFAULT_OVERDUE_GRACE_DAYS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_OVERDUE_GRACE_DAYS;
  return Math.min(60, Math.floor(n));
}
function buildWhatsAppUrl(params) {
  const text4 = [
    `Ol\xE1! Segue o comprovante do pagamento GondUp.`,
    ``,
    `Empresa: ${params.companyName}`,
    `Refer\xEAncia: ${params.monthRef}`,
    `Valor: ${params.amountLabel}`,
    ``,
    `(anexe o comprovante do Pix nesta conversa)`
  ].join("\n");
  return `https://wa.me/${params.whatsapp}?text=${encodeURIComponent(text4)}`;
}
async function getPaymentReminder(companyId, now = /* @__PURE__ */ new Date()) {
  const company = await getCompanyById(companyId);
  const pix = getDefaultPixConfig();
  const empty = {
    phase: "none",
    show: false,
    dismissable: true,
    companyId,
    companyName: company?.name ?? "",
    amount: null,
    amountLabel: null,
    dueDate: null,
    dueDateLabel: null,
    daysUntilDue: null,
    daysUntilBlock: null,
    graceDays: DEFAULT_OVERDUE_GRACE_DAYS,
    monthRef: null,
    pixPayload: null,
    whatsappUrl: null,
    whatsappNumber: pix.whatsapp,
    message: ""
  };
  if (!company) return empty;
  const dueDate = toIsoDate(company.subscriptionExpiresAt);
  const graceDays = await resolveGraceDays(companyId);
  const amount = await resolveMonthlyAmount(companyId);
  const today = todayIsoBR(now);
  if (!dueDate) return { ...empty, companyName: company.name, graceDays, amount, amountLabel: amount ? moneyLabel(amount) : null };
  const daysUntilDue = calendarDaysUntil(dueDate, today);
  const daysUntilBlock = daysUntilDue + graceDays;
  const amountLabel = amount ? moneyLabel(amount) : null;
  const dueDateLabel = (/* @__PURE__ */ new Date(`${dueDate}T12:00:00-03:00`)).toLocaleDateString("pt-BR", { timeZone: BR_TZ });
  const monthRef = monthLabel(dueDate);
  let pixPayload = null;
  if (amount) {
    try {
      pixPayload = buildPixBrcode({
        key: pix.key,
        name: pix.name,
        city: pix.city,
        amount,
        description: `GONDUP ${monthRef}`.slice(0, 25),
        txid: `GONDUP${companyId}${dueDate.replace(/-/g, "").slice(2)}`.slice(0, 25)
      });
    } catch {
      pixPayload = null;
    }
  }
  const whatsappUrl = amountLabel ? buildWhatsAppUrl({ whatsapp: pix.whatsapp, companyName: company.name, monthRef, amountLabel }) : `https://wa.me/${pix.whatsapp}`;
  const base = {
    companyId,
    companyName: company.name,
    amount,
    amountLabel,
    dueDate,
    dueDateLabel,
    daysUntilDue,
    daysUntilBlock,
    graceDays,
    monthRef,
    pixPayload,
    whatsappUrl,
    whatsappNumber: pix.whatsapp
  };
  if (daysUntilDue < -graceDays) {
    return {
      ...base,
      phase: "blocked",
      show: true,
      dismissable: false,
      message: paymentReminderMessage({
        phase: "blocked",
        amountLabel,
        dueDate,
        dueDateLabel,
        daysUntilDue,
        daysUntilBlock
      })
    };
  }
  if (daysUntilDue < 0) {
    return {
      ...base,
      phase: "overdue",
      show: true,
      dismissable: false,
      message: paymentReminderMessage({
        phase: "overdue",
        amountLabel,
        dueDate,
        dueDateLabel,
        daysUntilDue,
        daysUntilBlock
      })
    };
  }
  if (PRE_DUE_REMINDER_DAYS.includes(daysUntilDue)) {
    return {
      ...base,
      phase: "pre_due",
      show: true,
      dismissable: true,
      message: paymentReminderMessage({
        phase: "pre_due",
        amountLabel,
        dueDate,
        dueDateLabel,
        daysUntilDue,
        daysUntilBlock
      })
    };
  }
  return { ...base, phase: "none", show: false, dismissable: true, message: "" };
}
async function markCompanyPaid(input) {
  const { registerCompanyPayment: registerCompanyPayment2 } = await Promise.resolve().then(() => (init_platformCompanies(), platformCompanies_exports));
  const company = await getCompanyById(input.companyId);
  if (!company) throw new Error("Empresa n\xE3o encontrada.");
  const today = todayIsoBR();
  const amount = (input.amount && /^\d+(\.\d{1,2})?$/.test(input.amount) ? Number(input.amount).toFixed(2) : null) || await resolveMonthlyAmount(input.companyId);
  if (!amount) throw new Error("Informe o valor mensal da empresa antes de marcar como pago.");
  const currentDue = toIsoDate(company.subscriptionExpiresAt);
  if (!currentDue) throw new Error("Defina o vencimento da empresa antes de marcar como pago.");
  const anchor = await ensureBillingDay(input.companyId, currentDue);
  const periodTo = nextDueAfterMarkPaid(currentDue, anchor);
  const periodFrom = currentDue;
  const grace = input.graceDays ?? await resolveGraceDays(input.companyId);
  return registerCompanyPayment2({
    companyId: input.companyId,
    amount,
    paymentDate: input.paymentDate || today,
    periodFrom,
    periodTo,
    billingType: "PIX",
    planId: company.planId,
    graceDays: grace,
    note: input.note ?? "Marcado como pago (Pix manual)."
  });
}
var PRE_DUE_REMINDER_DAYS, MONTHLY_AMOUNT_KEY, BLOCK_AFTER_OVERDUE_KEY, BILLING_DAY_KEY, BR_TZ;
var init_paymentReminder = __esm({
  "server/paymentReminder.ts"() {
    "use strict";
    init_db();
    init_pixBrcode();
    init_paymentReminderCopy();
    init_subscriptionAccess();
    PRE_DUE_REMINDER_DAYS = [5, 3, 1];
    MONTHLY_AMOUNT_KEY = "monthly_amount";
    BLOCK_AFTER_OVERDUE_KEY = "block_after_overdue_days";
    BILLING_DAY_KEY = "billing_day";
    BR_TZ = "America/Sao_Paulo";
  }
});

// shared/staffLimit.ts
function staffLimitAppliesToRole(role) {
  const key = String(role ?? "").toLowerCase().trim();
  return key === "promoter";
}
function countsTowardStaffLimit(member) {
  if (member.active === false || member.active === 0 || member.active == null) return false;
  return staffLimitAppliesToRole(member.role);
}
function countBillableStaff(members) {
  return members.filter(countsTowardStaffLimit).length;
}
function effectiveUserLimit(input) {
  if (input.maxUsers == null || !Number.isFinite(Number(input.maxUsers))) return null;
  const included = Math.max(0, Math.floor(Number(input.maxUsers)));
  const extras = Math.max(0, Math.floor(Number(input.extraUsers ?? 0)));
  return included + extras;
}
function parseExtraUsers(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}
function suggestedMonthlyAmount(input) {
  const base = Number(input.planPrice ?? 0);
  const extra = parseExtraUsers(input.extraUsers);
  const add = Number(input.additionalUserPrice ?? 0);
  const total = (Number.isFinite(base) ? base : 0) + extra * (Number.isFinite(add) ? add : 0);
  return total.toFixed(2);
}
function staffUsageLabel(current, limit, extraUsers = 0) {
  if (limit == null) return `${current} funcion\xE1rios (sem limite)`;
  const extras = parseExtraUsers(extraUsers);
  if (extras > 0) return `${current} de ${limit} funcion\xE1rios (${extras} extras)`;
  return `${current} de ${limit} funcion\xE1rios`;
}
function userLimitReachedMessage(limit) {
  return `Seu plano permite at\xE9 ${limit} funcion\xE1rios. Fale com o suporte para liberar mais.`;
}
var EXTRA_USERS_KEY;
var init_staffLimit = __esm({
  "shared/staffLimit.ts"() {
    "use strict";
    EXTRA_USERS_KEY = "extra_users";
  }
});

// shared/legalTexts.ts
var LEGAL_TEXT_VERSION;
var init_legalTexts = __esm({
  "shared/legalTexts.ts"() {
    "use strict";
    LEGAL_TEXT_VERSION = "1.0";
  }
});

// shared/legalOverview.ts
function latestAcceptanceByCompany(rows4) {
  const map = /* @__PURE__ */ new Map();
  for (const row2 of rows4) {
    const prev = map.get(row2.companyId);
    if (!prev) {
      map.set(row2.companyId, row2);
      continue;
    }
    const prevTime = new Date(prev.acceptedAt ?? 0).getTime();
    const nextTime = new Date(row2.acceptedAt ?? 0).getTime();
    if (nextTime >= prevTime) map.set(row2.companyId, row2);
  }
  return map;
}
function termsAcceptanceSummary(row2, currentVersion = LEGAL_TEXT_VERSION) {
  if (!row2) {
    return { termsAcceptedVersion: null, termsAcceptedAt: null, termsAcceptedByName: null, termsAcceptedCurrent: false };
  }
  return {
    termsAcceptedVersion: row2.version,
    termsAcceptedAt: row2.acceptedAt,
    termsAcceptedByName: row2.acceptedByName,
    termsAcceptedCurrent: row2.version === currentVersion
  };
}
var init_legalOverview = __esm({
  "shared/legalOverview.ts"() {
    "use strict";
    init_legalTexts();
  }
});

// shared/legalAcceptance.ts
function needsLegalAcceptance(acceptedVersion, currentVersion = LEGAL_ACCEPTANCE_VERSION) {
  return !acceptedVersion || acceptedVersion !== currentVersion;
}
var LEGAL_ACCEPTANCE_VERSION, TERMS_SESSION_DISMISS_KEY;
var init_legalAcceptance = __esm({
  "shared/legalAcceptance.ts"() {
    "use strict";
    init_legalTexts();
    LEGAL_ACCEPTANCE_VERSION = LEGAL_TEXT_VERSION;
    TERMS_SESSION_DISMISS_KEY = `gondup-terms-dismissed:${LEGAL_ACCEPTANCE_VERSION}`;
  }
});

// server/legal.ts
import { z as z9 } from "zod";
import { TRPCError as TRPCError13 } from "@trpc/server";
import { sql as sql18 } from "drizzle-orm";
async function ensureLegalAcceptancesTable() {
  if (ready8) return ready8;
  ready8 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql18.raw(`CREATE TABLE IF NOT EXISTS legal_acceptances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      version VARCHAR(32) NOT NULL,
      acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      UNIQUE KEY legal_acceptances_unique (companyId, memberAccountId, version),
      KEY legal_acceptances_company_version_idx (companyId, version)
    )`));
  })().catch((error) => {
    ready8 = null;
    throw error;
  });
  return ready8;
}
async function queryRows(query) {
  const database2 = await getDb();
  if (!database2) return [];
  const [rows4] = await database2.execute(query);
  return rows4 || [];
}
async function listLatestLegalAcceptances() {
  await ensureLegalAcceptancesTable();
  return queryRows(sql18`
    SELECT la.companyId, la.version, la.acceptedAt, ma.userName AS acceptedByName
    FROM legal_acceptances la
    LEFT JOIN member_accounts ma ON ma.id = la.memberAccountId
  `).catch(() => []);
}
var ready8, legalRouter;
var init_legal = __esm({
  "server/legal.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_audit();
    init_legalTexts();
    init_legalAcceptance();
    ready8 = null;
    legalRouter = router({
      status: companyAdminProcedure.query(async ({ ctx }) => {
        const base = { version: LEGAL_TEXT_VERSION, required: false, acceptedAt: null, acceptedVersion: null };
        if (ctx.actingAsPlatform || ctx.user?.role !== "company_admin" || !ctx.memberAccountId || !ctx.accountId) return base;
        await ensureLegalAcceptancesTable();
        const rows4 = await queryRows(sql18`
      SELECT version, acceptedAt
      FROM legal_acceptances
      WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId}
      ORDER BY acceptedAt DESC, id DESC
      LIMIT 1
    `);
        const acceptedVersion = rows4[0]?.version ?? null;
        const acceptedAt = rows4[0]?.acceptedAt ?? null;
        return { ...base, required: needsLegalAcceptance(acceptedVersion), acceptedAt, acceptedVersion };
      }),
      accept: companyAdminProcedure.input(z9.object({ version: z9.string().max(32) })).mutation(async ({ ctx, input }) => {
        if (ctx.actingAsPlatform) throw new TRPCError13({ code: "FORBIDDEN", message: "O aceite deve ser feito pelo administrador da empresa, n\xE3o pela sess\xE3o da plataforma." });
        if (!ctx.memberAccountId || !ctx.accountId) throw new TRPCError13({ code: "FORBIDDEN", message: "Administrador da empresa n\xE3o identificado." });
        if (input.version !== LEGAL_TEXT_VERSION) throw new TRPCError13({ code: "CONFLICT", message: "Os termos foram atualizados. Recarregue a p\xE1gina para ler a vers\xE3o nova." });
        await ensureLegalAcceptancesTable();
        const database2 = await getDb();
        if (!database2) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        const meta = requestMeta(ctx);
        await database2.execute(sql18`
      INSERT INTO legal_acceptances (companyId, memberAccountId, version, ipAddress, userAgent, acceptedAt)
      VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${LEGAL_TEXT_VERSION}, ${meta.ipAddress}, ${meta.userAgent}, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE acceptedAt = acceptedAt, ipAddress = ipAddress, userAgent = userAgent
    `);
        void auditFromCtx(ctx, {
          action: "update",
          module: "legal",
          entityType: "legal_acceptance",
          entityId: ctx.memberAccountId,
          description: `Aceite dos Termos de Uso e da Pol\xEDtica de Privacidade, vers\xE3o ${LEGAL_TEXT_VERSION}`,
          newData: { version: LEGAL_TEXT_VERSION }
        });
        return { success: true, version: LEGAL_TEXT_VERSION };
      })
    });
  }
});

// shared/companyPurge.ts
function confirmMatchesCompany(company, confirm) {
  const typed = String(confirm ?? "").trim();
  if (!typed) return false;
  if (typed === String(company.name ?? "").trim()) return true;
  const typedDigits = onlyDigitsStr(typed);
  const doc = onlyDigitsStr(company.taxDocument);
  return Boolean(doc && typedDigits.length >= 11 && typedDigits === doc);
}
function purgeLegalWarning(eventCount) {
  const n = Math.max(0, Math.trunc(eventCount || 0));
  const punches = n <= 0 ? "Esta empresa n\xE3o tem marca\xE7\xF5es de ponto registradas." : n === 1 ? "Esta empresa tem 1 marca\xE7\xE3o de ponto." : `Esta empresa tem ${n} marca\xE7\xF5es de ponto.`;
  return `${punches} As marca\xE7\xF5es de ponto t\xEAm prazo legal de guarda de cerca de 5 anos (Portaria 671 e CLT). A exclus\xE3o permanente \xE9 irrevers\xEDvel: apaga usu\xE1rios, batidas, corre\xE7\xF5es, avisos, cobran\xE7as e arquivos da empresa. Antes de apagar, o sistema gera uma c\xF3pia final (AFD, AEJ se houver, espelhos/cart\xE3o-ponto e dados da empresa e dos funcion\xE1rios) e a guarda no arquivo de reten\xE7\xE3o. Se a c\xF3pia falhar, nada \xE9 apagado. Prefira \u201CEncerrar e arquivar\u201D se quiser s\xF3 desativar a conta, mantendo os dados.`;
}
function retentionBackupKey(companyId, stamp, fileName = "copia-final.zip") {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Empresa inv\xE1lida.");
  const safeStamp = String(stamp || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "agora";
  const safeName2 = String(fileName || "copia-final.zip").replace(/[^A-Za-z0-9._-]/g, "_");
  return `${RETENTION_PREFIX}/${companyId}/${safeStamp}/${safeName2}`;
}
function isRetentionBackupKey(key, companyId) {
  if (typeof key !== "string" || key.length > 512) return false;
  if (!/^retention\/company-delete\/\d+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key)) return false;
  if (companyId != null) {
    if (!Number.isInteger(companyId) || companyId <= 0) return false;
    return key.startsWith(`${RETENTION_PREFIX}/${companyId}/`);
  }
  return true;
}
function planCompanyCascade(columns, memberIds) {
  const seen = /* @__PURE__ */ new Set();
  const tables = [];
  for (const { t: t2, c } of columns) {
    if (!t2 || !c || t2 === "companies") continue;
    if (!/^[A-Za-z0-9_]+$/.test(t2) || !/^[A-Za-z0-9_]+$/.test(c)) continue;
    const k = `${t2}.${c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    tables.push({ table: t2, column: c });
  }
  return { deleteSessions: memberIds.length > 0, tables, deleteCompany: true };
}
async function applyCompanyCascade(exec, companyId, columns, memberIds) {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Empresa inv\xE1lida.");
  const plan = planCompanyCascade(columns, memberIds);
  const deleted = {};
  if (plan.deleteSessions) {
    const r2 = await exec.query("DELETE FROM member_sessions WHERE memberAccountId IN (?)", [memberIds]);
    deleted.member_sessions = r2.affectedRows || 0;
  }
  for (const { table: table2, column } of plan.tables) {
    const r2 = await exec.query(`DELETE FROM \`${table2}\` WHERE \`${column}\` = ?`, [companyId]);
    if (r2.affectedRows) deleted[table2] = (deleted[table2] ?? 0) + r2.affectedRows;
  }
  const r = await exec.query("DELETE FROM companies WHERE id = ?", [companyId]);
  deleted.companies = r.affectedRows || 0;
  return deleted;
}
function stripSensitiveFields(row2) {
  const out = { ...row2 };
  for (const key of SENSITIVE_BACKUP_KEYS) {
    if (key in out) delete out[key];
  }
  return out;
}
function canPermanentlyPurge(role) {
  return role === "platform_admin";
}
var RETENTION_PREFIX, SENSITIVE_BACKUP_KEYS;
var init_companyPurge = __esm({
  "shared/companyPurge.ts"() {
    "use strict";
    init_brDocs();
    RETENTION_PREFIX = "retention/company-delete";
    SENSITIVE_BACKUP_KEYS = [
      "passwordHash",
      "password_hash",
      "recoveryCodeHash",
      "recovery_code_hash",
      "sessionToken",
      "session_token",
      "refreshToken",
      "refresh_token",
      "cookie",
      "mfaSecret",
      "mfa_secret"
    ];
  }
});

// server/companyRetentionBackup.ts
var companyRetentionBackup_exports = {};
__export(companyRetentionBackup_exports, {
  createCompanyRetentionBackup: () => createCompanyRetentionBackup
});
import { zipSync as zipSync2, strToU8 as strToU82 } from "fflate";
import { TRPCError as TRPCError14 } from "@trpc/server";
import { and as and16, asc as asc2, eq as eq17, inArray as inArray14 } from "drizzle-orm";
async function readJson4(key, companyId) {
  const raw = await getSetting(key, companyId, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
async function employerOf2(companyId) {
  const snap = await getLegalSnapshotForCompany(companyId);
  const document = onlyDigits(snap.legal.document) || null;
  return { name: (snap.legal.legalName || snap.name || "").trim(), document, workplace: (snap.legal.establishment || snap.legal.address || "").trim() || null, snapshot: snap };
}
function isoStamp(now) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
}
function safeName(value, fallback) {
  return value.normalize("NFD").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || fallback;
}
async function dumpScopedTables(companyId) {
  const warnings = [];
  const tables = {};
  const pool = await getPool();
  if (!pool) throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const conn = await pool.getConnection();
  try {
    const [cols] = await conn.query(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`
    );
    const seen = /* @__PURE__ */ new Set();
    for (const { t: t2, c } of cols) {
      if (!t2 || !c || !/^[A-Za-z0-9_]+$/.test(t2) || !/^[A-Za-z0-9_]+$/.test(c)) continue;
      if (t2 === "member_sessions") continue;
      const key = `${t2}.${c}`;
      if (seen.has(key)) continue;
      seen.add(key);
      try {
        const [rows4] = await conn.query(`SELECT * FROM \`${t2}\` WHERE \`${c}\` = ?`, [companyId]);
        const cleaned = rows4.map((r) => stripSensitiveFields(r));
        tables[t2] = (tables[t2] || []).concat(cleaned);
      } catch (e) {
        warnings.push(`N\xE3o foi poss\xEDvel incluir a tabela ${t2}: ${e instanceof Error ? e.message : "erro"}.`);
      }
    }
    const [companyRows] = await conn.query("SELECT * FROM companies WHERE id = ?", [companyId]);
    tables.companies = companyRows.map((r) => stripSensitiveFields(r));
  } finally {
    conn.release();
  }
  return { tables, warnings };
}
async function dateRangeForCompany(companyId) {
  const database2 = await getDb();
  if (!database2) return null;
  const rows4 = await database2.select({
    serverTime: timeEvents.serverTime,
    deviceTime: timeEvents.deviceTime,
    timeZone: timeEvents.timeZone
  }).from(timeEvents).where(eq17(timeEvents.companyId, companyId)).orderBy(asc2(effectiveEventTime)).limit(5e5);
  if (!rows4.length) return null;
  let from = "9999-99-99";
  let to = "0000-00-00";
  for (const r of rows4) {
    const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ6);
    if (d < from) from = d;
    if (d > to) to = d;
  }
  if (from > to) return null;
  return { from, to };
}
async function buildAfdFile(companyId, from, to, employer) {
  const database2 = await getDb();
  if (!database2) return null;
  await ensurePunchLedger();
  const rows4 = (await database2.select().from(timeEvents).where(and16(eq17(timeEvents.companyId, companyId), eq17(timeEvents.origin, "original"))).orderBy(asc2(timeEvents.nsr))).filter((r) => r.nsr != null && r.recordHash).filter((r) => {
    const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ6);
    return d >= from && d <= to;
  });
  const dev = developerInfo();
  return buildAfd({
    employer: { document: employer.document || "", name: employer.name },
    developer: { document: dev.document },
    inpiNumber: dev.inpiNumber,
    from,
    to,
    generatedAt: /* @__PURE__ */ new Date(),
    timeZone: TZ6,
    punches: rows4.map((r) => ({
      nsr: Number(r.nsr),
      markedAt: r.deviceTime || r.serverTime,
      recordedAt: r.serverTime,
      cpf: r.workerCpf,
      timeZone: r.timeZone || TZ6,
      collector: r.collectorId || "02",
      offline: Boolean(r.offline),
      hash: r.recordHash
    }))
  });
}
async function buildAejFile(companyId, from, to, employer) {
  const database2 = await getDb();
  if (!database2) return null;
  const members = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role }).from(memberAccounts2).where(eq17(memberAccounts2.companyId, companyId))).filter((m) => m.role !== "company_admin");
  const ids = members.map((m) => m.id);
  const all = ids.length ? await database2.select().from(timeEvents).where(and16(eq17(timeEvents.companyId, companyId), inArray14(timeEvents.memberAccountId, ids))).orderBy(asc2(effectiveEventTime)) : [];
  const inPeriod = all.filter((r) => {
    const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ6);
    return d >= from && d <= to;
  });
  const replacedBy = /* @__PURE__ */ new Map();
  for (const r of all) if (r.replacesEventId) replacedBy.set(r.replacesEventId, r);
  const disregarded = await activeDisregards(companyId, inPeriod.map((r) => r.id));
  const workers = [];
  for (const m of members) {
    const mine = inPeriod.filter((r) => r.memberAccountId === m.id);
    if (!mine.length) continue;
    const labor = await readJson4(`labor_profile:${m.id}`, companyId);
    const cpf = onlyDigits(labor?.cpf);
    const effective = mine.filter((r) => !replacedBy.has(r.id) && !disregarded.has(r.id));
    const byDay = /* @__PURE__ */ new Map();
    for (const r of effective) {
      const d = formatD(r.deviceTime || r.serverTime, TZ6);
      byDay.set(d, [...byDay.get(d) || [], r]);
    }
    const marks = [];
    for (const [, dayRows] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      for (const s of toAejSequence(dayRows.map((r) => ({ type: r.eventType, time: r.deviceTime || r.serverTime, row: r })))) {
        marks.push({ markedAt: s.time, tpMarc: s.tpMarc, seq: s.seq, fonte: s.row.origin === "original" ? "O" : "I", motivo: s.row.origin === "original" ? null : s.row.reason });
      }
    }
    for (const r of mine.filter((x) => replacedBy.has(x.id))) {
      const by = replacedBy.get(r.id);
      marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Substitu\xEDda por ajuste aprovado por ${by.recordedByName || "administrador"}: ${by.reason || ""}` });
    }
    for (const r of mine.filter((x) => !replacedBy.has(x.id) && disregarded.has(x.id))) {
      const d = disregarded.get(r.id);
      marks.push({ markedAt: r.deviceTime || r.serverTime, tpMarc: "D", seq: 0, fonte: r.origin === "original" ? "O" : "I", motivo: `Desconsiderada por ${d.decidedByName || "administrador"}: ${d.reason}` });
    }
    marks.sort((a, b) => a.markedAt.getTime() - b.markedAt.getTime());
    const sched = (labor?.schedule || []).filter((p) => Array.isArray(p) && p.length === 2);
    const schedMinutes = sched.reduce((t2, [a, b]) => {
      const [ah, am] = a.split(":").map(Number);
      const [bh, bm] = b.split(":").map(Number);
      return t2 + (bh * 60 + bm - ah * 60 - am + 1440) % 1440;
    }, 0);
    const daily = Number(labor?.dailyMinutes || 0) || schedMinutes;
    const pairs = sched.map(([a, b]) => [a.replace(":", ""), b.replace(":", "")]);
    workers.push({ cpf, name: m.name, marks, contract: daily > 0 ? { code: `J${daily}${pairs.length ? `-${pairs.flat().join("")}` : ""}`, dailyMinutes: daily, pairs } : null });
  }
  const dev = developerInfo();
  return buildAej({
    employer: { document: employer.document || "", name: employer.name },
    inpiNumber: dev.inpiNumber,
    from,
    to,
    generatedAt: /* @__PURE__ */ new Date(),
    timeZone: TZ6,
    ptrp: { version: dev.version, developerDocument: dev.document, developerName: dev.name, developerEmail: dev.email },
    workers
  });
}
async function addMirrors(files, warnings, companyId, companyName, range) {
  const database2 = await getDb();
  if (!database2) return;
  const members = await database2.select({
    id: memberAccounts2.id,
    name: memberAccounts2.userName,
    role: memberAccounts2.role,
    employeeCode: promoterProfiles.employeeCode
  }).from(memberAccounts2).leftJoin(promoterProfiles, eq17(promoterProfiles.memberAccountId, memberAccounts2.id)).where(eq17(memberAccounts2.companyId, companyId));
  const staff = members.filter((m) => m.role !== "company_admin");
  if (!staff.length) return;
  const ids = staff.map((m) => m.id);
  const eventRows = await loadMirrorEventRows(companyId, ids, range.from, range.to);
  const months = /* @__PURE__ */ new Set();
  for (const r of eventRows) {
    const d = formatD(r.deviceTime || r.serverTime || r.time, r.timeZone || TZ6);
    if (d) months.add(d.slice(0, 7));
  }
  const start = range.from.slice(0, 7);
  const end = range.to.slice(0, 7);
  for (let m = start; m <= end; ) {
    months.add(m);
    const [y, mo] = m.split("-").map(Number);
    const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    m = next;
    if (months.size > 120) break;
  }
  const options = await loadMirrorOptions(companyId);
  const adjByEvent = await loadAdjustmentsByEvent(companyId, ids);
  const today = todayInTimeZone(TZ6);
  const sortedMonths = [...months].sort();
  for (const month of sortedMonths) {
    const [year, mon] = month.split("-").map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const to = `${month}-${String(lastDay).padStart(2, "0")}`;
    const monthEvents = eventRows.filter((r) => {
      const d = formatD(r.deviceTime || r.serverTime || r.time, r.timeZone || TZ6);
      return d >= from && d <= to;
    });
    if (!monthEvents.length) continue;
    const excusesByMember = await loadApprovedDayExcuses(companyId, ids, from, to);
    const vacationsByMember = await loadMemberVacations(companyId, ids, from, to);
    const treatmentsByMember = await loadDayTreatments(companyId, ids, from, to);
    for (const member of staff) {
      const mine = monthEvents.filter((r) => r.memberAccountId === member.id);
      if (!mine.length) continue;
      try {
        const labor = await readJson4(`labor_profile:${member.id}`, companyId);
        const events = toMirrorEvents(mine, adjByEvent);
        const report = buildMirror({
          events,
          from,
          to,
          timeZone: TZ6,
          labor,
          excuses: excusesByMember.get(member.id) || [],
          vacations: vacationsByMember.get(member.id) || [],
          treatments: treatmentsByMember.get(member.id) || [],
          options,
          today
        });
        const folder = `espelhos/${safeName(member.name, `membro-${member.id}`)}`;
        files[`${folder}/${month}.json`] = strToU82(JSON.stringify({ memberId: member.id, name: member.name, employeeCode: member.employeeCode ?? null, from, to, report }, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
        try {
          const pdf = await buildMirrorPdfBuffer({
            companyName,
            memberName: member.name,
            employeeCode: member.employeeCode ?? null,
            from,
            to,
            report
          });
          files[`${folder}/${month}.pdf`] = new Uint8Array(pdf);
        } catch (e) {
          warnings.push(`N\xE3o foi poss\xEDvel gerar o PDF do espelho de ${member.name} em ${month}: ${e instanceof Error ? e.message : "erro"}.`);
        }
      } catch (e) {
        warnings.push(`N\xE3o foi poss\xEDvel gerar o espelho de ${member.name} em ${month}: ${e instanceof Error ? e.message : "erro"}.`);
      }
    }
  }
}
async function createCompanyRetentionBackup(companyId, opts) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError14({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  const warnings = [];
  const files = {};
  try {
    const employer = await employerOf2(companyId);
    const dumped = await dumpScopedTables(companyId);
    warnings.push(...dumped.warnings);
    files["empresa.json"] = strToU82(JSON.stringify({
      id: companyId,
      name: company.name,
      employer,
      exportedAt: (opts?.now ?? /* @__PURE__ */ new Date()).toISOString()
    }, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
    files["dados/tabelas.json"] = strToU82(JSON.stringify(dumped.tables, (_k, v) => typeof v === "bigint" ? v.toString() : v, 2));
    const range = await dateRangeForCompany(companyId);
    if (range) {
      try {
        const afd = await buildAfdFile(companyId, range.from, range.to, employer);
        if (afd) files[`afd/${afd.fileName}`] = strToU82(afd.content);
      } catch (e) {
        warnings.push(`N\xE3o foi poss\xEDvel gerar o AFD: ${e instanceof Error ? e.message : "erro"}. As marca\xE7\xF5es seguem em dados/tabelas.json.`);
      }
      try {
        const aej = await buildAejFile(companyId, range.from, range.to, employer);
        if (aej) files[`aej/${aej.fileName}`] = strToU82(aej.content);
      } catch (e) {
        warnings.push(`N\xE3o foi poss\xEDvel gerar o AEJ: ${e instanceof Error ? e.message : "erro"}.`);
      }
      try {
        await addMirrors(files, warnings, companyId, company.name, range);
      } catch (e) {
        warnings.push(`N\xE3o foi poss\xEDvel gerar os espelhos: ${e instanceof Error ? e.message : "erro"}.`);
      }
    } else {
      warnings.push("N\xE3o havia marca\xE7\xF5es de ponto; o ZIP n\xE3o inclui AFD, AEJ nem espelhos.");
    }
  } catch (e) {
    throw new TRPCError14({
      code: "INTERNAL_SERVER_ERROR",
      message: `N\xE3o foi poss\xEDvel gerar a c\xF3pia final de seguran\xE7a. A empresa n\xE3o foi exclu\xEDda. ${e instanceof Error ? e.message : ""}`.trim()
    });
  }
  files["LEIA-ME.txt"] = strToU82([
    "C\xF3pia final da empresa antes da exclus\xE3o permanente no GondUp.",
    `Empresa: ${company.name} (#${companyId})`,
    `Gerada em: ${(opts?.now ?? /* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: TZ6 })} (America/Sao_Paulo).`,
    "",
    "Conte\xFAdo:",
    "- empresa.json: identifica\xE7\xE3o e dados cadastrais da empresa;",
    "- dados/tabelas.json: registros ligados \xE0 empresa (sem senhas, tokens ou c\xF3digos de recupera\xE7\xE3o);",
    "- afd/: Arquivo Fonte de Dados, quando houver marca\xE7\xF5es originais;",
    "- aej/: Arquivo Eletr\xF4nico de Jornada, quando foi poss\xEDvel gerar;",
    "- espelhos/: cart\xE3o-ponto / espelho em JSON e PDF por funcion\xE1rio e m\xEAs.",
    "",
    "As marca\xE7\xF5es de ponto t\xEAm prazo legal de guarda de cerca de 5 anos (Portaria 671 e CLT).",
    "Esta c\xF3pia fica no arquivo de reten\xE7\xE3o e n\xE3o \xE9 apagada com a empresa.",
    warnings.length ? `
Avisos:
- ${warnings.join("\n- ")}` : "",
    ""
  ].join("\r\n"));
  if (warnings.length) files["AVISOS.txt"] = strToU82(warnings.join("\r\n") + "\r\n");
  let zip;
  try {
    zip = zipSync2(files);
  } catch (e) {
    throw new TRPCError14({
      code: "INTERNAL_SERVER_ERROR",
      message: `N\xE3o foi poss\xEDvel compactar a c\xF3pia final de seguran\xE7a. A empresa n\xE3o foi exclu\xEDda. ${e instanceof Error ? e.message : ""}`.trim()
    });
  }
  const now = opts?.now ?? /* @__PURE__ */ new Date();
  const fileName = `copia-final-${safeName(company.name, `empresa-${companyId}`)}-${isoStamp(now).slice(0, 8)}.zip`;
  const key = retentionBackupKey(companyId, isoStamp(now), fileName);
  const put = opts?.put ?? storagePutExact;
  try {
    const stored = await put(key, Buffer.from(zip), "application/zip");
    return { key: stored.key || key, url: stored.url, fileName, bytes: zip.byteLength, warnings };
  } catch (e) {
    throw new TRPCError14({
      code: "INTERNAL_SERVER_ERROR",
      message: `N\xE3o foi poss\xEDvel guardar a c\xF3pia final de seguran\xE7a. A empresa n\xE3o foi exclu\xEDda. ${e instanceof Error ? e.message : ""}`.trim()
    });
  }
}
var TZ6;
var init_companyRetentionBackup = __esm({
  "server/companyRetentionBackup.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_companyRegistry();
    init_repFormat();
    init_router();
    init_ledger();
    init_timesheetMirror();
    init_correctionExtras();
    init_dayTreatments();
    init_mirrorData();
    init_timesheetArchive();
    init_companyPurge();
    init_storage();
    TZ6 = DEFAULT_TZ;
  }
});

// server/platformCompanies.ts
var platformCompanies_exports = {};
__export(platformCompanies_exports, {
  archiveCompany: () => archiveCompany,
  assertCompanyNotArchived: () => assertCompanyNotArchived,
  assertPermanentPurgeRole: () => assertPermanentPurgeRole,
  deleteCompanyMediaFiles: () => deleteCompanyMediaFiles,
  deletePayment: () => deletePayment,
  endOfDay: () => endOfDay,
  getArchivedAt: () => getArchivedAt,
  listCompaniesOverview: () => listCompaniesOverview,
  listCompanyPayments: () => listCompanyPayments,
  markCompanyPaid: () => markCompanyPaid,
  purgeBlockedByTimeClock: () => purgeBlockedByTimeClock,
  purgeCompany: () => purgeCompany,
  purgeCompanyPermanently: () => purgeCompanyPermanently,
  purgeLegalWarning: () => purgeLegalWarning,
  registerCompanyPayment: () => registerCompanyPayment,
  resolveGraceDays: () => resolveGraceDays,
  resolveMonthlyAmount: () => resolveMonthlyAmount,
  setCompanyBilling: () => setCompanyBilling,
  setCompanyBlocked: () => setCompanyBlocked,
  setCompanyPlan: () => setCompanyPlan,
  startOfDay: () => startOfDay
});
import { and as and17, eq as eq18, inArray as inArray15, sql as sql19 } from "drizzle-orm";
import { TRPCError as TRPCError15 } from "@trpc/server";
async function database() {
  const d = await getDb();
  if (!d) throw new TRPCError15({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return d;
}
async function getArchivedAt(companyId) {
  return await getSetting("archived_at", companyId, "") || "";
}
async function assertCompanyNotArchived(companyId) {
  const archived = await getArchivedAt(companyId);
  if (archived) {
    throw new TRPCError15({
      code: "PRECONDITION_FAILED",
      message: "Esta empresa est\xE1 exclu\xEDda (arquivada). Restaure-a antes de alterar plano, cobran\xE7a ou acesso."
    });
  }
}
function purgeBlockedByTimeClock(_eventCount) {
  return null;
}
function assertPermanentPurgeRole(role) {
  if (!canPermanentlyPurge(role)) {
    throw new TRPCError15({ code: "FORBIDDEN", message: "S\xF3 o administrador da plataforma pode excluir uma empresa em car\xE1ter permanente." });
  }
}
async function deleteCompanyMediaFiles(companyId) {
  const { storageListKeys: storageListKeys2, storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let filesDeleted = 0;
  for (const area of TENANT_MEDIA_AREAS) {
    const keys = await storageListKeys2(`${area}/${companyId}/`);
    for (const k of keys) {
      if (isRetentionBackupKey(k)) continue;
      try {
        if (await guardedStorageDelete(storageDelete2, k, companyId)) filesDeleted++;
      } catch {
      }
    }
  }
  return filesDeleted;
}
async function listCompaniesOverview() {
  const d = await database();
  await ensureAdditionalUserPriceColumn();
  const { ensureCompanyRegistryColumns: ensureCompanyRegistryColumns2 } = await Promise.resolve().then(() => (init_companyRegistry(), companyRegistry_exports));
  await ensureCompanyRegistryColumns2();
  const [rows4, plans, pays, counts, admins, flags, acceptances] = await Promise.all([
    d.select().from(companies).orderBy(companies.name),
    d.select().from(subscriptionPlans),
    d.execute(sql19`SELECT companyId, MAX(paymentDate) AS lastPayment, COUNT(*) AS n FROM payments WHERE status IN ('RECEIVED','CONFIRMED','MOCK_APPROVED') GROUP BY companyId`),
    d.execute(sql19`SELECT companyId, COUNT(*) AS total, SUM(active) AS ativos, SUM(CASE WHEN active = 1 AND role = 'promoter' THEN 1 ELSE 0 END) AS staff FROM member_accounts GROUP BY companyId`),
    d.execute(sql19`SELECT companyId, MIN(email) AS email, MIN(userName) AS name FROM member_accounts WHERE role = 'company_admin' GROUP BY companyId`),
    d.select().from(systemSettings).where(inArray15(systemSettings.settingKey, ["blocked_reason", "archived_at", MONTHLY_AMOUNT_KEY, BLOCK_AFTER_OVERDUE_KEY, EXTRA_USERS_KEY, "company_legal_profile"])),
    listLatestLegalAcceptances()
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const acceptanceBy = latestAcceptanceByCompany(acceptances);
  const map = (r, key = "companyId") => new Map(r[0].map((x) => [Number(x[key]), x]));
  const payBy = map(pays), countBy = map(counts), adminBy = map(admins);
  const flagBy = new Map(flags.map((f) => [`${f.accountId}:${f.settingKey}`, f.settingValue]));
  const legacyLegal = (companyId) => {
    try {
      return JSON.parse(flagBy.get(`${companyId}:company_legal_profile`) || "");
    } catch {
      return {};
    }
  };
  return rows4.map((c) => {
    const plan = c.planId ? planById.get(c.planId) : null;
    const legacy = legacyLegal(c.id);
    const monthlyAmount = flagBy.get(`${c.id}:${MONTHLY_AMOUNT_KEY}`) || (plan?.price != null ? String(plan.price) : null);
    const blockAfter = flagBy.get(`${c.id}:${BLOCK_AFTER_OVERDUE_KEY}`);
    const extraUsers = parseExtraUsers(flagBy.get(`${c.id}:${EXTRA_USERS_KEY}`));
    const planMaxUsers = plan?.maxUsers == null ? null : Number(plan.maxUsers);
    const additionalUserPrice = plan?.additionalUserPrice != null ? String(plan.additionalUserPrice) : null;
    const staffCurrent = Number(countBy.get(c.id)?.staff ?? 0);
    const staffLimit = effectiveUserLimit({ maxUsers: planMaxUsers, extraUsers });
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      createdAt: c.createdAt,
      legalName: c.legalName || legacy.legalName || null,
      taxDocument: c.taxDocument || legacy.document || null,
      addressCity: c.addressCity ?? null,
      addressState: c.addressState ?? null,
      addressStreet: c.addressStreet || legacy.address || null,
      archivedAt: flagBy.get(`${c.id}:archived_at`) ?? null,
      blockedReason: flagBy.get(`${c.id}:blocked_reason`) ?? null,
      planId: c.planId ?? null,
      planName: plan?.name ?? null,
      planPrice: plan?.price ?? null,
      monthlyAmount,
      additionalUserPrice,
      planMaxUsers,
      extraUsers,
      staffCurrent,
      staffLimit,
      staffUsageLabel: staffUsageLabel(staffCurrent, staffLimit, extraUsers),
      suggestedMonthlyAmount: plan?.price != null ? suggestedMonthlyAmount({ planPrice: plan.price, extraUsers, additionalUserPrice }) : null,
      blockAfterOverdueDays: blockAfter != null && blockAfter !== "" ? Number(blockAfter) : DEFAULT_OVERDUE_GRACE_DAYS,
      subscriptionStatus: c.subscriptionStatus ?? null,
      startedAt: c.subscriptionStartedAt ?? null,
      expiresAt: c.subscriptionExpiresAt ?? null,
      graceUntil: c.gracePeriodEndsAt ?? null,
      lastPayment: payBy.get(c.id)?.lastPayment ?? null,
      paymentsCount: Number(payBy.get(c.id)?.n ?? 0),
      users: Number(countBy.get(c.id)?.total ?? 0),
      activeUsers: Number(countBy.get(c.id)?.ativos ?? 0),
      adminEmail: adminBy.get(c.id)?.email ?? null,
      adminName: adminBy.get(c.id)?.name ?? null,
      ...termsAcceptanceSummary(acceptanceBy.get(c.id))
    };
  });
}
async function setCompanyBlocked(companyId, blocked, reason) {
  const d = await database();
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (!blocked) await assertCompanyNotArchived(companyId);
  await updateCompany(companyId, { active: !blocked });
  if (blocked) await setSetting("blocked_reason", (reason || "").trim().slice(0, 300) || "Acesso bloqueado pelo administrador da plataforma.", companyId);
  else await d.delete(systemSettings).where(and17(eq18(systemSettings.accountId, companyId), eq18(systemSettings.settingKey, "blocked_reason")));
  if (blocked) {
    const ids = (await d.select({ id: memberAccounts.id }).from(memberAccounts).where(eq18(memberAccounts.companyId, companyId))).map((r) => r.id);
    if (ids.length) await d.delete(memberSessions).where(inArray15(memberSessions.memberAccountId, ids));
  }
  return company;
}
async function setCompanyPlan(input) {
  const d = await database();
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  await assertCompanyNotArchived(input.companyId);
  const plan = await getSubscriptionPlanById(input.planId);
  if (!plan) throw new TRPCError15({ code: "NOT_FOUND", message: "Plano n\xE3o encontrado." });
  if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError15({ code: "BAD_REQUEST", message: "A validade final n\xE3o pode ser anterior ao in\xEDcio." });
  const latest = await getLatestCompanySubscription(input.companyId);
  if (latest) await updateCompanySubscription(latest.id, { planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? latest.notes ?? null });
  else await createCompanySubscription({ companyId: input.companyId, planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? null });
  const end = input.endsAt ? endOfDay(input.endsAt) : null;
  await d.update(companies).set({
    planId: input.planId,
    subscriptionStatus: input.status,
    subscriptionStartedAt: startOfDay(input.startsAt),
    subscriptionExpiresAt: end,
    // tolerância explícita (padrão 5 dias): acesso até o fim do dia de validade + graceDays
    gracePeriodEndsAt: end ? addDaysDate(end, Math.max(0, input.graceDays ?? DEFAULT_OVERDUE_GRACE_DAYS)) : null,
    // Se a situação for teste, alinha trialEndsAt à validade informada para não ficar um
    // trialEndsAt antigo (ex.: 14 dias da criação) bloqueando antes da data configurada.
    ...input.status === "trial" || input.status === "test" ? { trialEndsAt: end } : {}
  }).where(eq18(companies.id, input.companyId));
  if (input.endsAt) await ensureBillingDay(input.companyId, input.endsAt);
  return { success: true };
}
async function registerCompanyPayment(input) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  await assertCompanyNotArchived(input.companyId);
  if (input.periodTo < input.periodFrom) throw new TRPCError15({ code: "BAD_REQUEST", message: "O fim do per\xEDodo pago n\xE3o pode ser anterior ao in\xEDcio." });
  const planId = input.planId ?? company.planId;
  if (!planId) throw new TRPCError15({ code: "BAD_REQUEST", message: "Selecione um plano para esta empresa antes de registrar o pagamento." });
  const latest = await getLatestCompanySubscription(input.companyId);
  await setCompanyPlan({ companyId: input.companyId, planId, status: "active", startsAt: input.periodFrom, endsAt: input.periodTo, graceDays: input.graceDays ?? DEFAULT_OVERDUE_GRACE_DAYS, notes: input.note ?? latest?.notes ?? null });
  const sub = await getLatestCompanySubscription(input.companyId);
  const created = await createPaymentRecord({ companyId: input.companyId, subscriptionId: sub?.id ?? null, amount: input.amount, netAmount: input.amount, billingType: input.billingType, status: "RECEIVED", dueDate: input.periodFrom, paymentDate: input.paymentDate });
  if (!company.active) await setCompanyBlocked(input.companyId, false);
  return created;
}
async function listCompanyPayments(companyId) {
  return listPaymentsForCompany(companyId);
}
async function deletePayment(id3, companyId) {
  const d = await database();
  const r = await d.delete(payments).where(and17(eq18(payments.id, id3), eq18(payments.companyId, companyId)));
  if (!r[0]?.affectedRows) throw new TRPCError15({ code: "NOT_FOUND", message: "Pagamento n\xE3o encontrado." });
}
async function archiveCompany(companyId, archived) {
  const d = await database();
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (archived) {
    await setCompanyBlocked(companyId, true, "Empresa exclu\xEDda pelo administrador da plataforma.");
    await setSetting("archived_at", (/* @__PURE__ */ new Date()).toISOString(), companyId);
  } else {
    await d.delete(systemSettings).where(and17(eq18(systemSettings.accountId, companyId), eq18(systemSettings.settingKey, "archived_at")));
    await setCompanyBlocked(companyId, false);
  }
  return company;
}
async function purgeCompanyPermanently(companyId, confirmName, role, deps) {
  assertPermanentPurgeRole(role);
  const company = await (deps?.getCompany ?? getCompanyById)(companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  let taxDocument = company.taxDocument;
  if (!deps?.getCompany) {
    try {
      const registry = await getCompanyRegistry(companyId);
      taxDocument = taxDocument || registry.registry.taxDocument || null;
    } catch {
    }
  }
  if (!confirmMatchesCompany({ name: company.name, taxDocument }, confirmName)) {
    throw new TRPCError15({ code: "BAD_REQUEST", message: "O nome ou o CNPJ digitado n\xE3o confere com o da empresa." });
  }
  const { createCompanyRetentionBackup: createCompanyRetentionBackup2 } = await Promise.resolve().then(() => (init_companyRetentionBackup(), companyRetentionBackup_exports));
  const createBackup = deps?.createBackup ?? createCompanyRetentionBackup2;
  let backup;
  try {
    backup = await createBackup(companyId);
  } catch (e) {
    if (e instanceof TRPCError15) throw e;
    throw new TRPCError15({
      code: "INTERNAL_SERVER_ERROR",
      message: `N\xE3o foi poss\xEDvel gerar a c\xF3pia final de seguran\xE7a. A empresa n\xE3o foi exclu\xEDda. ${e instanceof Error ? e.message : ""}`.trim()
    });
  }
  if (!backup?.key || !isRetentionBackupKey(backup.key, companyId)) {
    throw new TRPCError15({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel gerar a c\xF3pia final de seguran\xE7a. A empresa n\xE3o foi exclu\xEDda." });
  }
  const deleteMedia = deps?.deleteMedia ?? deleteCompanyMediaFiles;
  let filesDeleted = 0;
  try {
    filesDeleted = await deleteMedia(companyId);
  } catch {
  }
  if (deps?.runCascade) {
    const deleted2 = await deps.runCascade();
    return { company, deleted: deleted2, filesDeleted, backup };
  }
  const pool = await getPool();
  if (!pool) throw new TRPCError15({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const conn = await pool.getConnection();
  const deleted = {};
  try {
    const [cols] = await conn.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`);
    const [memberIdsRows] = await conn.query("SELECT id FROM member_accounts WHERE companyId = ?", [companyId]);
    const memberIds = memberIdsRows.map((r) => r.id);
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();
    const exec = {
      query: async (sqlText, params) => {
        const [r] = await conn.query(sqlText, params);
        return { affectedRows: r?.affectedRows || 0 };
      }
    };
    Object.assign(deleted, await applyCompanyCascade(exec, companyId, cols, memberIds));
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => void 0);
    throw e;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => void 0);
    conn.release();
  }
  return { company, deleted, filesDeleted, backup };
}
async function purgeCompany(companyId, confirmName, role = "platform_admin") {
  return purgeCompanyPermanently(companyId, confirmName, role);
}
async function setCompanyBilling(input) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError15({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  await assertCompanyNotArchived(input.companyId);
  if (input.extraUsers != null) {
    await setSetting(EXTRA_USERS_KEY, String(parseExtraUsers(input.extraUsers)), input.companyId);
  }
  if (input.monthlyAmount != null && input.monthlyAmount !== "") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.monthlyAmount) || Number(input.monthlyAmount) <= 0) {
      throw new TRPCError15({ code: "BAD_REQUEST", message: "Valor mensal inv\xE1lido." });
    }
    await setSetting(MONTHLY_AMOUNT_KEY, Number(input.monthlyAmount).toFixed(2), input.companyId);
  }
  if (input.blockAfterOverdueDays != null) {
    const n = Math.max(0, Math.min(60, Math.floor(input.blockAfterOverdueDays)));
    await setSetting(BLOCK_AFTER_OVERDUE_KEY, String(n), input.companyId);
    if (company.subscriptionExpiresAt) {
      const end = company.subscriptionExpiresAt instanceof Date ? company.subscriptionExpiresAt : new Date(company.subscriptionExpiresAt);
      await updateCompanySubscriptionFields(input.companyId, {
        gracePeriodEndsAt: addDaysDate(end, n)
      });
    }
  }
  if (input.dueDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new TRPCError15({ code: "BAD_REQUEST", message: "Data de vencimento inv\xE1lida." });
    const grace = input.blockAfterOverdueDays != null ? Math.max(0, Math.min(60, Math.floor(input.blockAfterOverdueDays))) : await resolveGraceDays(input.companyId);
    const end = endOfDay(input.dueDate);
    await updateCompanySubscriptionFields(input.companyId, {
      subscriptionExpiresAt: end,
      gracePeriodEndsAt: addDaysDate(end, grace)
    });
    await setSetting(BILLING_DAY_KEY, String(Number(input.dueDate.slice(8, 10))), input.companyId);
  }
  return {
    success: true,
    monthlyAmount: await resolveMonthlyAmount(input.companyId),
    graceDays: await resolveGraceDays(input.companyId),
    extraUsers: parseExtraUsers(await getSetting(EXTRA_USERS_KEY, input.companyId, "0"))
  };
}
var BR, endOfDay, startOfDay, addDaysDate;
var init_platformCompanies = __esm({
  "server/platformCompanies.ts"() {
    "use strict";
    init_db();
    init_schema_original();
    init_paymentReminder();
    init_staffLimit();
    init_legalOverview();
    init_legal();
    init_companyRegistry();
    init_companyPurge();
    init_mediaKeys();
    init_subscriptionAccess();
    BR = "-03:00";
    endOfDay = (d) => /* @__PURE__ */ new Date(`${d}T23:59:59${BR}`);
    startOfDay = (d) => /* @__PURE__ */ new Date(`${d}T00:00:00${BR}`);
    addDaysDate = (d, n) => new Date(d.getTime() + n * 864e5);
  }
});

// shared/platformPixQuote.ts
function asMoney(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}
function moneyLabelBr(amount) {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dueDateLabelBr(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return (/* @__PURE__ */ new Date(`${iso.slice(0, 10)}T12:00:00-03:00`)).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
function monthRefLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const names = ["janeiro", "fevereiro", "mar\xE7o", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[(m || 1) - 1]}/${y}`;
}
function quotePixCharge(input) {
  const planPrice = asMoney(input.planPrice);
  const additionalUserPrice = asMoney(input.additionalUserPrice);
  const extraUsers = parseExtraUsers(input.extraUsers);
  const extrasTotal = extraUsers > 0 && additionalUserPrice ? (extraUsers * Number(additionalUserPrice)).toFixed(2) : extraUsers > 0 ? "0.00" : null;
  const suggestedAmount = planPrice ? suggestedMonthlyAmount({ planPrice, extraUsers, additionalUserPrice }) : null;
  const negotiatedAmount = asMoney(input.negotiatedAmount);
  const defaultAmount = negotiatedAmount || suggestedAmount;
  const usedNegotiated = Boolean(negotiatedAmount);
  const lines = [];
  if (planPrice) {
    lines.push({ label: input.planName ? `Pre\xE7o do plano (${input.planName})` : "Pre\xE7o do plano", amount: planPrice });
  }
  if (extraUsers > 0) {
    const unit = additionalUserPrice ? moneyLabelBr(additionalUserPrice) : "sem valor adicional";
    lines.push({
      label: extraUsers === 1 ? `1 funcion\xE1rio extra \xD7 ${unit}` : `${extraUsers} funcion\xE1rios extras \xD7 ${unit}`,
      amount: extrasTotal
    });
  }
  if (suggestedAmount && extraUsers > 0) {
    lines.push({ label: "Valor sugerido (plano + extras)", amount: suggestedAmount });
  }
  if (negotiatedAmount) {
    lines.push({ label: "Valor mensal negociado", amount: negotiatedAmount });
  }
  return {
    companyName: input.companyName,
    planName: input.planName,
    planPrice,
    extraUsers,
    additionalUserPrice,
    extrasTotal,
    suggestedAmount,
    negotiatedAmount,
    defaultAmount,
    dueDate: input.dueDate && /^\d{4}-\d{2}-\d{2}/.test(input.dueDate) ? input.dueDate.slice(0, 10) : null,
    dueDateLabel: dueDateLabelBr(input.dueDate),
    monthRef: monthRefLabel(input.dueDate),
    usedNegotiated,
    lines
  };
}
function pixChargeWhatsAppMessage(input) {
  const lines = [
    "Ol\xE1! Segue o Pix da mensalidade GondUp.",
    "",
    `Empresa: ${input.companyName}`
  ];
  if (input.monthRef) lines.push(`Refer\xEAncia: ${input.monthRef}`);
  if (input.dueDateLabel) lines.push(`Vencimento: ${input.dueDateLabel}`);
  lines.push(`Valor: ${input.amountLabel}`);
  if (input.pixPayload) {
    lines.push("", "Pix copia e cola:", input.pixPayload);
  }
  return lines.join("\n");
}
function pixChargeWhatsAppUrl(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
var init_platformPixQuote = __esm({
  "shared/platformPixQuote.ts"() {
    "use strict";
    init_staffLimit();
  }
});

// server/platformPix.ts
import { and as and18, eq as eq19 } from "drizzle-orm";
import { TRPCError as TRPCError16 } from "@trpc/server";
function toIsoDate2(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function parseAmount(raw) {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) throw new TRPCError16({ code: "BAD_REQUEST", message: "Informe um valor maior que zero." });
  return n.toFixed(2);
}
async function getCompanyPixQuote(companyId) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError16({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  const resolved = await resolveCompanyPlan(companyId);
  const extraRaw = await getSetting(EXTRA_USERS_KEY, companyId, "0");
  const negotiated = (await getSetting(MONTHLY_AMOUNT_KEY, companyId, "")).trim();
  const quote = quotePixCharge({
    companyName: company.name,
    planName: resolved.plan?.name ?? null,
    planPrice: resolved.plan?.price != null ? String(resolved.plan.price) : null,
    extraUsers: parseExtraUsers(extraRaw),
    additionalUserPrice: resolved.plan?.additionalUserPrice != null ? String(resolved.plan.additionalUserPrice) : null,
    negotiatedAmount: negotiated || null,
    dueDate: toIsoDate2(company.subscriptionExpiresAt)
  });
  return { ...quote, companyId };
}
async function generateCompanyPix(companyId, amountOverride) {
  const quote = await getCompanyPixQuote(companyId);
  const amount = parseAmount(amountOverride || quote.defaultAmount || "");
  const amountLabel = moneyLabelBr(amount);
  const pix = getDefaultPixConfig();
  const monthKey = (quote.dueDate || (/* @__PURE__ */ new Date()).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" })).replace(/-/g, "");
  const pixPayload = buildPixBrcode({
    key: pix.key,
    name: pix.name,
    city: pix.city,
    amount,
    description: `GONDUP ${quote.monthRef || quote.companyName}`.slice(0, 25),
    txid: `GONDUP${companyId}${monthKey.slice(2)}`.slice(0, 25)
  });
  const message = pixChargeWhatsAppMessage({
    companyName: quote.companyName,
    monthRef: quote.monthRef,
    dueDateLabel: quote.dueDateLabel,
    amountLabel,
    pixPayload
  });
  const whatsappUrl = pixChargeWhatsAppUrl(message);
  let paymentId = null;
  let paymentReused = false;
  let recordedAsPending = false;
  if (quote.dueDate) {
    const recorded = await upsertPendingPixCharge({
      companyId,
      amount,
      dueDate: quote.dueDate
    });
    paymentId = recorded.id;
    paymentReused = recorded.reused;
    recordedAsPending = true;
  }
  return {
    companyId,
    companyName: quote.companyName,
    amount,
    amountLabel,
    dueDate: quote.dueDate,
    dueDateLabel: quote.dueDateLabel,
    monthRef: quote.monthRef,
    quote,
    pixPayload,
    whatsappUrl,
    message,
    paymentId,
    paymentReused,
    recordedAsPending
  };
}
async function upsertPendingPixCharge(input) {
  const database2 = await getDb();
  if (!database2) throw new TRPCError16({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const sub = await getLatestCompanySubscription(input.companyId);
  const existing = (await database2.select().from(payments).where(and18(
    eq19(payments.companyId, input.companyId),
    eq19(payments.status, "PENDING"),
    eq19(payments.billingType, "PIX"),
    eq19(payments.dueDate, input.dueDate)
  )).limit(1))[0];
  if (existing) {
    await database2.update(payments).set({
      amount: input.amount,
      netAmount: input.amount,
      subscriptionId: sub?.id ?? existing.subscriptionId
    }).where(eq19(payments.id, existing.id));
    return { id: existing.id, reused: true };
  }
  const created = await createPaymentRecord({
    companyId: input.companyId,
    subscriptionId: sub?.id ?? null,
    amount: input.amount,
    netAmount: input.amount,
    billingType: "PIX",
    status: "PENDING",
    dueDate: input.dueDate,
    paymentDate: null
  });
  return { id: created.id, reused: false };
}
var init_platformPix = __esm({
  "server/platformPix.ts"() {
    "use strict";
    init_schema_original();
    init_pixBrcode();
    init_platformPixQuote();
    init_staffLimit();
    init_db();
    init_paymentReminder();
  }
});

// server/modules/platformCompanies.ts
import { z as z10 } from "zod";
import { TRPCError as TRPCError17 } from "@trpc/server";
var dateStr5, status, id, log, platformCompaniesRouter;
var init_platformCompanies2 = __esm({
  "server/modules/platformCompanies.ts"() {
    "use strict";
    init_trpc();
    init_db();
    init_audit();
    init_platformCompanies();
    init_platformPix();
    dateStr5 = z10.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    status = z10.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]);
    id = z10.number().int().positive();
    log = (ctx, companyId, action, description, data) => void auditFromCtx(ctx, { action, module: "platform", entityType: "company", entityId: companyId, entityLabel: String(companyId), description, newData: data, companyId: null });
    platformCompaniesRouter = router({
      overview: platformProcedure.query(() => listCompaniesOverview()),
      /** Registra na auditoria (da plataforma e da própria empresa) que o administrador geral entrou como esta empresa. */
      enterAs: platformProcedure.input(z10.object({ companyId: id })).mutation(async ({ ctx, input }) => {
        const company = await getCompanyById(input.companyId);
        if (!company) throw new TRPCError17({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
        await assertCompanyNotArchived(input.companyId);
        void auditFromCtx(ctx, { action: "security", module: "platform", entityType: "company", entityId: company.id, entityLabel: company.name, description: `Administrador da plataforma acessou a empresa ${company.name}`, companyId: company.id });
        return { success: true };
      }),
      rename: platformProcedure.input(z10.object({ companyId: id, name: z10.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
        await updateCompany(input.companyId, { name: input.name });
        log(ctx, input.companyId, "update", `Renomeou empresa #${input.companyId} para ${input.name}`);
        return { success: true };
      }),
      setBlocked: platformProcedure.input(z10.object({ companyId: id, blocked: z10.boolean(), reason: z10.string().max(300).optional() })).mutation(async ({ ctx, input }) => {
        const c = await setCompanyBlocked(input.companyId, input.blocked, input.reason);
        log(ctx, input.companyId, input.blocked ? "block" : "unblock", `${input.blocked ? "Bloqueou" : "Desbloqueou"} a empresa ${c.name}${input.reason ? `: ${input.reason}` : ""}`);
        return { success: true };
      }),
      setPlan: platformProcedure.input(z10.object({ companyId: id, planId: id, status, startsAt: dateStr5, endsAt: dateStr5.nullish(), graceDays: z10.number().int().min(0).max(60).optional(), notes: z10.string().max(500).nullish() })).mutation(async ({ ctx, input }) => {
        await setCompanyPlan(input);
        log(ctx, input.companyId, "update", `Definiu plano/validade da empresa #${input.companyId}: plano ${input.planId}, ${input.status}, ${input.startsAt} a ${input.endsAt ?? "sem fim"}`, input);
        return { success: true };
      }),
      payments: platformProcedure.input(z10.object({ companyId: id })).query(({ input }) => listCompanyPayments(input.companyId)),
      registerPayment: platformProcedure.input(z10.object({
        companyId: id,
        amount: z10.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
        paymentDate: dateStr5,
        periodFrom: dateStr5,
        periodTo: dateStr5,
        billingType: z10.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]).default("PIX"),
        planId: id.nullish(),
        graceDays: z10.number().int().min(0).max(60).optional(),
        note: z10.string().max(500).nullish()
      })).mutation(async ({ ctx, input }) => {
        const r = await registerCompanyPayment(input);
        log(ctx, input.companyId, "payment", `Registrou pagamento de R$ ${input.amount} em ${input.paymentDate}; plano v\xE1lido de ${input.periodFrom} a ${input.periodTo}`, input);
        return r;
      }),
      setBilling: platformProcedure.input(z10.object({
        companyId: id,
        monthlyAmount: z10.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullish(),
        blockAfterOverdueDays: z10.number().int().min(0).max(60).nullish(),
        dueDate: dateStr5.nullish(),
        extraUsers: z10.number().int().min(0).max(1e4).nullish()
      })).mutation(async ({ ctx, input }) => {
        const r = await setCompanyBilling(input);
        log(ctx, input.companyId, "update", `Atualizou cobran\xE7a da empresa #${input.companyId}`, input);
        return r;
      }),
      /** Composição do valor (plano, extras, negociado) e vencimento, sem gravar nada. */
      pixQuote: platformProcedure.input(z10.object({ companyId: id })).query(({ input }) => getCompanyPixQuote(input.companyId)),
      /** Gera o Pix (QR / copia e cola) e registra cobrança pendente. Não marca como pago e não altera a validade. */
      generatePix: platformProcedure.input(z10.object({
        companyId: id,
        amount: z10.string().regex(/^\d{1,10}(\.\d{1,2})?$/).optional()
      })).mutation(async ({ ctx, input }) => {
        await assertCompanyNotArchived(input.companyId);
        const r = await generateCompanyPix(input.companyId, input.amount);
        log(ctx, input.companyId, "create", `Gerou Pix de R$ ${r.amount} para a empresa #${input.companyId}${r.dueDate ? `, vencimento ${r.dueDate}` : ""}` + (r.recordedAsPending ? " (cobran\xE7a pendente)" : ""), { amount: r.amount, dueDate: r.dueDate, paymentId: r.paymentId });
        return r;
      }),
      /** Um clique: registra Pix recebido e avança a validade em 1 mês. */
      markPaid: platformProcedure.input(z10.object({
        companyId: id,
        amount: z10.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullish(),
        paymentDate: dateStr5.optional(),
        graceDays: z10.number().int().min(0).max(60).optional(),
        note: z10.string().max(500).nullish()
      })).mutation(async ({ ctx, input }) => {
        const r = await markCompanyPaid(input);
        log(ctx, input.companyId, "payment", `Marcou como pago a empresa #${input.companyId}`, input);
        return r;
      }),
      deletePayment: platformProcedure.input(z10.object({ companyId: id, paymentId: id })).mutation(async ({ ctx, input }) => {
        await deletePayment(input.paymentId, input.companyId);
        log(ctx, input.companyId, "delete", `Excluiu o pagamento #${input.paymentId} da empresa #${input.companyId}`);
        return { success: true };
      }),
      /** "Excluir": arquiva e bloqueia (reversível). */
      archive: platformProcedure.input(z10.object({ companyId: id, archived: z10.boolean() })).mutation(async ({ ctx, input }) => {
        const c = await archiveCompany(input.companyId, input.archived);
        log(ctx, input.companyId, input.archived ? "delete" : "restore", `${input.archived ? "Excluiu (arquivou)" : "Restaurou"} a empresa ${c.name}`);
        return { success: true };
      }),
      /** Exclusão permanente e irreversível (ativa ou arquivada). Exige nome ou CNPJ. Gera cópia final antes; se a cópia falhar, não apaga. */
      purge: platformProcedure.input(z10.object({ companyId: id, confirmName: z10.string().min(1) })).mutation(async ({ ctx, input }) => {
        assertPermanentPurgeRole(ctx.user?.role);
        const r = await purgeCompanyPermanently(input.companyId, input.confirmName, ctx.user?.role);
        log(
          ctx,
          input.companyId,
          "permanent_delete",
          `Excluiu PERMANENTEMENTE a empresa ${r.company.name} (#${input.companyId}). C\xF3pia final: ${r.backup.key}`,
          { deleted: r.deleted, filesDeleted: r.filesDeleted, backupKey: r.backup.key, backupFileName: r.backup.fileName }
        );
        return {
          success: true,
          deleted: r.deleted,
          backup: { key: r.backup.key, downloadUrl: r.backup.url, fileName: r.backup.fileName }
        };
      })
    });
  }
});

// shared/platformAnnouncements.ts
function toAnnouncementIsoDate(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const s2 = value.trim();
    if (ISO_DATE.test(s2.slice(0, 10))) return s2.slice(0, 10);
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toLocaleDateString("en-CA", { timeZone: "UTC" });
  }
  const s = String(value);
  if (ISO_DATE.test(s.slice(0, 10))) return s.slice(0, 10);
  return null;
}
function todayIsoSP(now = /* @__PURE__ */ new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function parseAnnouncementTone(raw) {
  const value = String(raw ?? "");
  return ANNOUNCEMENT_TONES.includes(value) ? value : "info";
}
function parseAnnouncementRoles(raw) {
  const parts = Array.isArray(raw) ? raw.map((item) => String(item)) : String(raw ?? "").split(/[,\s]+/);
  const set = /* @__PURE__ */ new Set();
  for (const part of parts) {
    if (ANNOUNCEMENT_ROLES.includes(part)) set.add(part);
  }
  return ANNOUNCEMENT_ROLES.filter((role) => set.has(role));
}
function serializeAnnouncementRoles(roles) {
  const unique = parseAnnouncementRoles(roles);
  if (!unique.length) throw new Error("Escolha pelo menos uma fun\xE7\xE3o.");
  return unique.join(",");
}
function parseCompanyAnnouncementRoles(raw) {
  return parseAnnouncementRoles(raw).filter(
    (role) => COMPANY_ANNOUNCEMENT_ROLES.includes(role)
  );
}
function serializeCompanyAnnouncementRoles(roles) {
  const unique = parseCompanyAnnouncementRoles(roles);
  if (!unique.length) throw new Error("Escolha pelo menos uma fun\xE7\xE3o (promotor ou supervisor).");
  return unique.join(",");
}
function isHttpUrl(value) {
  const s = value.trim();
  if (!/^https?:\/\/[^\s]+$/i.test(s)) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
function announcementIsLive(announcement, todayIso) {
  if (announcement.active === false || announcement.active === 0) return false;
  const start = toAnnouncementIsoDate(announcement.startsAt);
  const end = toAnnouncementIsoDate(announcement.endsAt);
  if (start && start > todayIso) return false;
  if (end && end < todayIso) return false;
  return true;
}
function announcementVisibleTo(announcement, viewer) {
  if (!announcementIsLive(announcement, viewer.todayIso)) return false;
  if (viewer.dismissedIds?.includes(announcement.id)) return false;
  const source = announcement.source || "platform";
  if (source === "company") {
    if (Number(announcement.companyId) !== Number(viewer.companyId)) return false;
    if (viewer.role === "company_admin") return false;
    if (viewer.memberAccountId && announcement.createdByMemberAccountId && Number(viewer.memberAccountId) === Number(announcement.createdByMemberAccountId)) {
      return false;
    }
    if ((announcement.targetMode || "roles") === "members") {
      return Boolean(viewer.memberAccountId && (announcement.memberIds || []).includes(Number(viewer.memberAccountId)));
    }
    return announcement.roles.includes(viewer.role);
  }
  if (!announcement.roles.includes(viewer.role)) return false;
  if (announcement.audienceScope === "selected") {
    if (!announcement.companyIds.includes(viewer.companyId)) return false;
  }
  return true;
}
function canManageCompanyAnnouncement(actor, announcement) {
  if ((announcement.source || "platform") !== "company") return false;
  if (Number(announcement.companyId) !== Number(actor.companyId)) return false;
  if (actor.role === "company_admin") return true;
  if (actor.role === "supervisor" && actor.memberAccountId && announcement.createdByMemberAccountId && Number(actor.memberAccountId) === Number(announcement.createdByMemberAccountId)) {
    return true;
  }
  return false;
}
function announcementSenderLabel(input) {
  if ((input.source || "platform") === "company") {
    if (input.authorName && input.companyName) return `Aviso de ${input.authorName} (${input.companyName})`;
    if (input.authorName) return `Aviso de ${input.authorName}`;
    if (input.companyName) return `Aviso de ${input.companyName}`;
    return "Aviso da empresa";
  }
  return "Aviso da GondUp";
}
var ANNOUNCEMENT_ROLES, ANNOUNCEMENT_TONES, COMPANY_ANNOUNCEMENT_ROLES, ISO_DATE;
var init_platformAnnouncements = __esm({
  "shared/platformAnnouncements.ts"() {
    "use strict";
    ANNOUNCEMENT_ROLES = ["company_admin", "supervisor", "promoter"];
    ANNOUNCEMENT_TONES = ["info", "warning", "urgent"];
    COMPANY_ANNOUNCEMENT_ROLES = ["supervisor", "promoter"];
    ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  }
});

// server/platformAnnouncements.ts
import { and as and19, desc as desc5, eq as eq20, inArray as inArray16 } from "drizzle-orm";
function normalizeText(value) {
  return String(value ?? "").trim();
}
function isMissingTable(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /doesn't exist|does not exist|Unknown table|ER_NO_SUCH_TABLE/i.test(message);
}
function isMissingColumn(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /Unknown column|ER_BAD_FIELD_ERROR/i.test(message);
}
async function addColumnIfMissing(db, table2, column, ddl) {
  const [cols] = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table2}' AND COLUMN_NAME = '${column}'`
  );
  if (Array.isArray(cols) && cols.length > 0) return;
  await db.execute(ddl);
}
async function addIndexIfMissing(db, table2, indexName, ddl) {
  const [rows4] = await db.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table2}' AND INDEX_NAME = '${indexName}'`
  );
  if (Array.isArray(rows4) && rows4.length > 0) return;
  await db.execute(ddl);
}
async function ensureAnnouncementTables() {
  if (ensured2) return;
  const db = await getDb();
  if (!db) return;
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS platform_announcements (
        id INT AUTO_INCREMENT NOT NULL,
        title VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        tone VARCHAR(16) NOT NULL DEFAULT 'info',
        buttonLabel VARCHAR(80) NULL,
        buttonUrl TEXT NULL,
        audienceScope VARCHAR(16) NOT NULL DEFAULT 'all',
        roles VARCHAR(80) NOT NULL,
        startsAt DATE NULL,
        endsAt DATE NULL,
        dismissable TINYINT NOT NULL DEFAULT 1,
        active TINYINT NOT NULL DEFAULT 1,
        createdByPlatformAdminId INT NULL,
        updatedByPlatformAdminId INT NULL,
        source VARCHAR(16) NOT NULL DEFAULT 'platform',
        companyId INT NULL,
        createdByMemberAccountId INT NULL,
        updatedByMemberAccountId INT NULL,
        targetMode VARCHAR(16) NOT NULL DEFAULT 'roles',
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY platform_announcements_active_idx (active, startsAt, endsAt),
        KEY platform_announcements_source_company_idx (source, companyId)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS platform_announcement_companies (
        id INT AUTO_INCREMENT NOT NULL,
        announcementId INT NOT NULL,
        companyId INT NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY platform_announcement_companies_unique (announcementId, companyId)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS platform_announcement_dismissals (
        id INT AUTO_INCREMENT NOT NULL,
        announcementId INT NOT NULL,
        memberAccountId INT NOT NULL,
        dismissedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY platform_announcement_dismissals_unique (announcementId, memberAccountId)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS platform_announcement_members (
        id INT AUTO_INCREMENT NOT NULL,
        announcementId INT NOT NULL,
        memberAccountId INT NOT NULL,
        PRIMARY KEY (id),
        UNIQUE KEY platform_announcement_members_unique (announcementId, memberAccountId),
        KEY platform_announcement_members_member_idx (memberAccountId)
      )
    `);
    await addColumnIfMissing(db, "platform_announcements", "source", "ALTER TABLE platform_announcements ADD COLUMN source varchar(16) NOT NULL DEFAULT 'platform'");
    await addColumnIfMissing(db, "platform_announcements", "companyId", "ALTER TABLE platform_announcements ADD COLUMN companyId int NULL");
    await addColumnIfMissing(db, "platform_announcements", "createdByMemberAccountId", "ALTER TABLE platform_announcements ADD COLUMN createdByMemberAccountId int NULL");
    await addColumnIfMissing(db, "platform_announcements", "updatedByMemberAccountId", "ALTER TABLE platform_announcements ADD COLUMN updatedByMemberAccountId int NULL");
    await addColumnIfMissing(db, "platform_announcements", "targetMode", "ALTER TABLE platform_announcements ADD COLUMN targetMode varchar(16) NOT NULL DEFAULT 'roles'");
    await addIndexIfMissing(
      db,
      "platform_announcements",
      "platform_announcements_source_company_idx",
      "ALTER TABLE platform_announcements ADD INDEX platform_announcements_source_company_idx (source, companyId)"
    );
    ensured2 = true;
  } catch (error) {
    console.warn("[announcements] ensureAnnouncementTables", error instanceof Error ? error.message : error);
  }
}
async function listAnnouncementCompanies(ids) {
  const map = /* @__PURE__ */ new Map();
  if (!ids.length) return map;
  const db = await getDb();
  if (!db) return map;
  try {
    const rows4 = await db.select().from(platformAnnouncementCompanies).where(inArray16(platformAnnouncementCompanies.announcementId, ids));
    for (const row2 of rows4) {
      const list = map.get(row2.announcementId) ?? [];
      list.push(row2.companyId);
      map.set(row2.announcementId, list);
    }
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  return map;
}
async function listAnnouncementMembers(ids) {
  const map = /* @__PURE__ */ new Map();
  if (!ids.length) return map;
  const db = await getDb();
  if (!db) return map;
  try {
    const rows4 = await db.select().from(platformAnnouncementMembers).where(inArray16(platformAnnouncementMembers.announcementId, ids));
    for (const row2 of rows4) {
      const list = map.get(row2.announcementId) ?? [];
      list.push(row2.memberAccountId);
      map.set(row2.announcementId, list);
    }
  } catch (error) {
    if (!isMissingTable(error) && !isMissingColumn(error)) throw error;
  }
  return map;
}
function toRecord(row2, companyMap, memberMap) {
  return {
    id: row2.id,
    active: row2.active,
    startsAt: toAnnouncementIsoDate(row2.startsAt),
    endsAt: toAnnouncementIsoDate(row2.endsAt),
    audienceScope: row2.audienceScope,
    companyIds: companyMap.get(row2.id) ?? [],
    roles: parseAnnouncementRoles(row2.roles),
    source: row2.source || "platform",
    companyId: row2.companyId ?? null,
    targetMode: row2.targetMode || "roles",
    memberIds: memberMap.get(row2.id) ?? [],
    createdByMemberAccountId: row2.createdByMemberAccountId ?? null
  };
}
async function loadNameMaps(rows4, memberMap = /* @__PURE__ */ new Map()) {
  const companyNames = /* @__PURE__ */ new Map();
  const authorNames = /* @__PURE__ */ new Map();
  const memberNames = /* @__PURE__ */ new Map();
  const db = await getDb();
  if (!db) return { companyNames, authorNames, memberNames };
  const companyIds = [...new Set(rows4.map((row2) => Number(row2.companyId)).filter((id3) => Number.isInteger(id3) && id3 > 0))];
  const authorIds = [...new Set(rows4.map((row2) => Number(row2.createdByMemberAccountId)).filter((id3) => Number.isInteger(id3) && id3 > 0))];
  const recipientIds = [...new Set([...memberMap.values()].flat().map(Number).filter((id3) => Number.isInteger(id3) && id3 > 0))];
  const memberIds = [.../* @__PURE__ */ new Set([...authorIds, ...recipientIds])];
  if (companyIds.length) {
    const found = await db.select({ id: companies2.id, name: companies2.name }).from(companies2).where(inArray16(companies2.id, companyIds));
    for (const row2 of found) companyNames.set(row2.id, row2.name);
  }
  if (memberIds.length) {
    const found = await db.select({ id: memberAccounts2.id, userName: memberAccounts2.userName }).from(memberAccounts2).where(inArray16(memberAccounts2.id, memberIds));
    for (const row2 of found) {
      memberNames.set(row2.id, row2.userName);
      if (authorIds.includes(row2.id)) authorNames.set(row2.id, row2.userName);
    }
  }
  return { companyNames, authorNames, memberNames };
}
function presentationOf(row2, companyNames, authorNames) {
  const source = String(row2.source || "platform");
  const companyId = row2.companyId ?? null;
  const authorId = row2.createdByMemberAccountId ?? null;
  const companyName = companyId ? companyNames.get(Number(companyId)) ?? null : null;
  const authorName = authorId ? authorNames.get(Number(authorId)) ?? null : null;
  return {
    source,
    companyId,
    createdByMemberAccountId: authorId,
    targetMode: String(row2.targetMode || "roles"),
    companyName,
    authorName,
    senderLabel: announcementSenderLabel({ source, companyName, authorName })
  };
}
function present(row2, companyMap, memberMap, companyNames, authorNames, memberNames) {
  const memberIds = memberMap.get(row2.id) ?? [];
  return {
    ...row2,
    roles: parseAnnouncementRoles(row2.roles),
    companyIds: companyMap.get(row2.id) ?? [],
    memberIds,
    memberNames: memberIds.map((id3) => memberNames.get(id3)).filter((name) => Boolean(name)),
    startsAt: toAnnouncementIsoDate(row2.startsAt),
    endsAt: toAnnouncementIsoDate(row2.endsAt),
    ...presentationOf(row2, companyNames, authorNames)
  };
}
async function listAnnouncements() {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    const rows4 = await db.select().from(platformAnnouncements).orderBy(desc5(platformAnnouncements.createdAt), desc5(platformAnnouncements.id));
    const [companyMap, memberMap] = await Promise.all([
      listAnnouncementCompanies(rows4.map((row2) => row2.id)),
      listAnnouncementMembers(rows4.map((row2) => row2.id))
    ]);
    const { companyNames, authorNames, memberNames } = await loadNameMaps(rows4, memberMap);
    return rows4.map((row2) => present(row2, companyMap, memberMap, companyNames, authorNames, memberNames));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}
async function getAnnouncement(id3) {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows4 = await db.select().from(platformAnnouncements).where(eq20(platformAnnouncements.id, id3)).limit(1);
  const row2 = rows4[0];
  if (!row2) return null;
  const [companyMap, memberMap] = await Promise.all([listAnnouncementCompanies([id3]), listAnnouncementMembers([id3])]);
  const { companyNames, authorNames, memberNames } = await loadNameMaps([row2], memberMap);
  return present(row2, companyMap, memberMap, companyNames, authorNames, memberNames);
}
function toViewer(viewer) {
  return {
    companyId: viewer.companyId,
    role: viewer.role,
    todayIso: todayIsoSP(),
    dismissedIds: viewer.dismissedIds,
    memberAccountId: viewer.memberAccountId ?? null
  };
}
async function listVisibleAnnouncementsFor(viewer) {
  const dismissedIds = viewer.memberAccountId ? await listDismissedAnnouncementIds(viewer.memberAccountId) : [];
  const rows4 = await listAnnouncements();
  const view = toViewer({ ...viewer, dismissedIds });
  return rows4.filter((row2) => announcementVisibleTo(toRecord(row2, /* @__PURE__ */ new Map([[row2.id, row2.companyIds]]), /* @__PURE__ */ new Map([[row2.id, row2.memberIds]])), view));
}
async function getVisibleAnnouncementFor(id3, viewer) {
  const row2 = await getAnnouncement(id3);
  if (!row2) return null;
  const dismissedIds = viewer.memberAccountId ? await listDismissedAnnouncementIds(viewer.memberAccountId) : [];
  const view = toViewer({ ...viewer, dismissedIds });
  if (!announcementVisibleTo(toRecord(row2, /* @__PURE__ */ new Map([[row2.id, row2.companyIds]]), /* @__PURE__ */ new Map([[row2.id, row2.memberIds]])), view)) return null;
  return row2;
}
function validateInput(input) {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  if (!title) throw new Error("Informe o t\xEDtulo do aviso.");
  if (title.length > 180) throw new Error("O t\xEDtulo pode ter no m\xE1ximo 180 caracteres.");
  if (!body) throw new Error("Informe a mensagem do aviso.");
  if (body.length > 4e3) throw new Error("A mensagem pode ter no m\xE1ximo 4000 caracteres.");
  const tone = parseAnnouncementTone(input.tone);
  const buttonLabel = normalizeText(input.buttonLabel) || null;
  const buttonUrl = normalizeText(input.buttonUrl) || null;
  if (buttonLabel && !buttonUrl) throw new Error("Informe o link do bot\xE3o.");
  if (buttonUrl && !buttonLabel) throw new Error("Informe o texto do bot\xE3o.");
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    throw new Error("O link do bot\xE3o precisa come\xE7ar com http:// ou https://.");
  }
  const roles = serializeAnnouncementRoles(input.roles);
  const startsAt = normalizeText(input.startsAt) || null;
  const endsAt = normalizeText(input.endsAt) || null;
  if (startsAt && endsAt && endsAt < startsAt) throw new Error("A data final n\xE3o pode ser anterior \xE0 data inicial.");
  const audienceScope = input.audienceScope === "selected" ? "selected" : "all";
  const companyIds = audienceScope === "selected" ? [...new Set((input.companyIds ?? []).map((id3) => Number(id3)).filter((id3) => Number.isInteger(id3) && id3 > 0))] : [];
  if (audienceScope === "selected" && !companyIds.length) throw new Error("Escolha pelo menos uma empresa.");
  return {
    title,
    body,
    tone,
    buttonLabel,
    buttonUrl,
    audienceScope,
    companyIds,
    roles,
    startsAt,
    endsAt,
    dismissable: input.dismissable !== false,
    active: input.active !== false
  };
}
async function replaceCompanies(announcementId, companyIds) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq20(platformAnnouncementCompanies.announcementId, announcementId));
  if (!companyIds.length) return;
  await db.insert(platformAnnouncementCompanies).values(companyIds.map((companyId) => ({ announcementId, companyId })));
}
async function replaceMembers(announcementId, memberIds) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    await db.delete(platformAnnouncementMembers).where(eq20(platformAnnouncementMembers.announcementId, announcementId));
    if (!memberIds.length) return;
    await db.insert(platformAnnouncementMembers).values(memberIds.map((memberAccountId) => ({ announcementId, memberAccountId })));
  } catch (error) {
    if (isMissingTable(error)) return;
    throw error;
  }
}
async function createAnnouncement(input, adminId) {
  await ensureAnnouncementTables();
  const data = validateInput(input);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const inserted = await db.insert(platformAnnouncements).values({
    title: data.title,
    body: data.body,
    tone: data.tone,
    buttonLabel: data.buttonLabel,
    buttonUrl: data.buttonUrl,
    audienceScope: data.audienceScope,
    roles: data.roles,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    dismissable: data.dismissable,
    active: data.active,
    createdByPlatformAdminId: adminId,
    updatedByPlatformAdminId: adminId,
    source: "platform",
    targetMode: "roles"
  });
  const id3 = Number(inserted[0]?.insertId);
  if (!id3) throw new Error("N\xE3o foi poss\xEDvel criar o aviso.");
  await replaceCompanies(id3, data.companyIds);
  const created = await getAnnouncement(id3);
  if (!created) throw new Error("N\xE3o foi poss\xEDvel criar o aviso.");
  return created;
}
async function updateAnnouncement(id3, input, adminId) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  if (String(existing.source || "platform") !== "platform") {
    throw new Error("Avisos da empresa s\xE3o gerenciados no painel da empresa.");
  }
  const data = validateInput(input);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    title: data.title,
    body: data.body,
    tone: data.tone,
    buttonLabel: data.buttonLabel,
    buttonUrl: data.buttonUrl,
    audienceScope: data.audienceScope,
    roles: data.roles,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    dismissable: data.dismissable,
    active: data.active,
    updatedByPlatformAdminId: adminId,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq20(platformAnnouncements.id, id3));
  await replaceCompanies(id3, data.companyIds);
  const updated = await getAnnouncement(id3);
  if (!updated) throw new Error("N\xE3o foi poss\xEDvel atualizar o aviso.");
  return updated;
}
async function setAnnouncementActive(id3, active, adminId) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  if (String(existing.source || "platform") !== "platform") {
    throw new Error("Avisos da empresa s\xE3o gerenciados no painel da empresa.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    active,
    updatedByPlatformAdminId: adminId,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq20(platformAnnouncements.id, id3));
  const updated = await getAnnouncement(id3);
  if (!updated) throw new Error("N\xE3o foi poss\xEDvel atualizar o aviso.");
  return updated;
}
async function deleteAnnouncement(id3) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  if (String(existing.source || "platform") !== "platform") {
    throw new Error("Avisos da empresa s\xE3o gerenciados no painel da empresa.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq20(platformAnnouncementCompanies.announcementId, id3));
  await db.delete(platformAnnouncementDismissals).where(eq20(platformAnnouncementDismissals.announcementId, id3));
  try {
    await db.delete(platformAnnouncementMembers).where(eq20(platformAnnouncementMembers.announcementId, id3));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  await db.delete(platformAnnouncements).where(eq20(platformAnnouncements.id, id3));
  return { success: true };
}
async function listCompanyAnnouncementRecipients(companyId) {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows4 = await db.select({
    id: memberAccounts2.id,
    userName: memberAccounts2.userName,
    role: memberAccounts2.role
  }).from(memberAccounts2).where(and19(eq20(memberAccounts2.companyId, companyId), eq20(memberAccounts2.active, true)));
  return rows4.filter((row2) => row2.role === "supervisor" || row2.role === "promoter").sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}
async function resolveCompanyTargets(companyId, input) {
  const recipients = await listCompanyAnnouncementRecipients(companyId);
  const allowed = new Map(recipients.map((row2) => [row2.id, row2]));
  if (input.targetMode === "members") {
    const memberIds = [...new Set((input.memberIds ?? []).map((id3) => Number(id3)).filter((id3) => Number.isInteger(id3) && id3 > 0))];
    if (!memberIds.length) throw new Error("Escolha pelo menos uma pessoa.");
    if (memberIds.some((id3) => !allowed.has(id3))) {
      throw new Error("S\xF3 \xE9 poss\xEDvel avisar promotores e supervisores ativos desta empresa.");
    }
    const roles2 = serializeCompanyAnnouncementRoles(memberIds.map((id3) => allowed.get(id3).role));
    return { targetMode: "members", memberIds, roles: roles2 };
  }
  const roles = serializeCompanyAnnouncementRoles(input.roles ?? []);
  return { targetMode: "roles", memberIds: [], roles };
}
function validateCompanyContent(input) {
  return validateInput({
    title: input.title,
    body: input.body,
    tone: input.tone,
    buttonLabel: input.buttonLabel,
    buttonUrl: input.buttonUrl,
    audienceScope: "selected",
    companyIds: [1],
    roles: ["promoter"],
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    dismissable: input.dismissable,
    active: input.active
  });
}
async function listCompanyAnnouncements(companyId) {
  const rows4 = await listAnnouncements();
  return rows4.filter((row2) => String(row2.source || "platform") === "company" && Number(row2.companyId) === Number(companyId));
}
function assertCanManage(actor, announcement) {
  if (!canManageCompanyAnnouncement(actor, announcement)) throw new Error(FORBIDDEN);
}
async function createCompanyAnnouncement(actor, input) {
  await ensureAnnouncementTables();
  if (actor.role !== "company_admin" && actor.role !== "supervisor") throw new Error(FORBIDDEN);
  const content = validateCompanyContent(input);
  const targets = await resolveCompanyTargets(actor.companyId, input);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const inserted = await db.insert(platformAnnouncements).values({
    title: content.title,
    body: content.body,
    tone: content.tone,
    buttonLabel: content.buttonLabel,
    buttonUrl: content.buttonUrl,
    audienceScope: "selected",
    roles: targets.roles,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    dismissable: content.dismissable,
    active: content.active,
    source: "company",
    companyId: actor.companyId,
    createdByMemberAccountId: actor.memberAccountId ?? null,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    targetMode: targets.targetMode
  });
  const id3 = Number(inserted[0]?.insertId);
  if (!id3) throw new Error("N\xE3o foi poss\xEDvel criar o aviso.");
  await replaceCompanies(id3, [actor.companyId]);
  await replaceMembers(id3, targets.memberIds);
  const created = await getAnnouncement(id3);
  if (!created) throw new Error("N\xE3o foi poss\xEDvel criar o aviso.");
  return created;
}
async function updateCompanyAnnouncement(id3, actor, input) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  assertCanManage(actor, existing);
  const content = validateCompanyContent(input);
  const targets = await resolveCompanyTargets(actor.companyId, input);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    title: content.title,
    body: content.body,
    tone: content.tone,
    buttonLabel: content.buttonLabel,
    buttonUrl: content.buttonUrl,
    audienceScope: "selected",
    roles: targets.roles,
    startsAt: content.startsAt,
    endsAt: content.endsAt,
    dismissable: content.dismissable,
    active: content.active,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    targetMode: targets.targetMode,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq20(platformAnnouncements.id, id3));
  await replaceCompanies(id3, [actor.companyId]);
  await replaceMembers(id3, targets.memberIds);
  const updated = await getAnnouncement(id3);
  if (!updated) throw new Error("N\xE3o foi poss\xEDvel atualizar o aviso.");
  return updated;
}
async function setCompanyAnnouncementActive(id3, actor, active) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  assertCanManage(actor, existing);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    active,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq20(platformAnnouncements.id, id3));
  const updated = await getAnnouncement(id3);
  if (!updated) throw new Error("N\xE3o foi poss\xEDvel atualizar o aviso.");
  return updated;
}
async function deleteCompanyAnnouncement(id3, actor) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id3);
  if (!existing) throw new Error("Aviso n\xE3o encontrado.");
  assertCanManage(actor, existing);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq20(platformAnnouncementCompanies.announcementId, id3));
  await db.delete(platformAnnouncementDismissals).where(eq20(platformAnnouncementDismissals.announcementId, id3));
  try {
    await db.delete(platformAnnouncementMembers).where(eq20(platformAnnouncementMembers.announcementId, id3));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  await db.delete(platformAnnouncements).where(eq20(platformAnnouncements.id, id3));
  return existing;
}
async function dismissAnnouncement(input) {
  const announcement = await getVisibleAnnouncementFor(input.announcementId, input);
  if (!announcement || !announcement.dismissable) throw new Error("Este aviso n\xE3o pode ser fechado.");
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    await db.insert(platformAnnouncementDismissals).values({ announcementId: input.announcementId, memberAccountId: input.memberAccountId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Duplicate|ER_DUP_ENTRY/i.test(message)) throw error;
  }
}
async function listDismissedAnnouncementIds(memberAccountId) {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) return [];
  try {
    const rows4 = await db.select({ announcementId: platformAnnouncementDismissals.announcementId }).from(platformAnnouncementDismissals).where(eq20(platformAnnouncementDismissals.memberAccountId, memberAccountId));
    return rows4.map((row2) => row2.announcementId);
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}
var FORBIDDEN, ensured2;
var init_platformAnnouncements2 = __esm({
  "server/platformAnnouncements.ts"() {
    "use strict";
    init_schema();
    init_platformAnnouncements();
    init_db();
    FORBIDDEN = "Voc\xEA n\xE3o tem permiss\xE3o para gerenciar este aviso.";
    ensured2 = false;
  }
});

// server/modules/platformAnnouncements.ts
import { z as z11 } from "zod";
import { TRPCError as TRPCError18 } from "@trpc/server";
function companyActor(ctx) {
  return {
    companyId: Number(ctx.accountId),
    role: String(ctx.user?.role || ""),
    memberAccountId: ctx.memberAccountId ?? null
  };
}
function rethrowAnnouncement(error) {
  const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel salvar o aviso.";
  if (/permissão/i.test(message)) throw new TRPCError18({ code: "FORBIDDEN", message });
  throw new TRPCError18({ code: "BAD_REQUEST", message });
}
var id2, dateStr6, payload, companyPayload, announcementsRouter;
var init_platformAnnouncements3 = __esm({
  "server/modules/platformAnnouncements.ts"() {
    "use strict";
    init_trpc();
    init_audit();
    init_platformAnnouncements();
    init_platformAnnouncements2();
    id2 = z11.number().int().positive();
    dateStr6 = z11.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
    payload = z11.object({
      title: z11.string().min(1).max(200),
      body: z11.string().min(1).max(8e3),
      tone: z11.enum(ANNOUNCEMENT_TONES),
      buttonLabel: z11.string().max(80).nullable().optional(),
      buttonUrl: z11.string().max(500).nullable().optional(),
      audienceScope: z11.enum(["all", "selected"]),
      companyIds: z11.array(id2).max(500).optional(),
      roles: z11.array(z11.enum(ANNOUNCEMENT_ROLES)).min(1),
      startsAt: dateStr6,
      endsAt: dateStr6,
      dismissable: z11.boolean(),
      active: z11.boolean().optional()
    });
    companyPayload = z11.object({
      title: z11.string().min(1).max(200),
      body: z11.string().min(1).max(8e3),
      tone: z11.enum(ANNOUNCEMENT_TONES),
      buttonLabel: z11.string().max(80).nullable().optional(),
      buttonUrl: z11.string().max(500).nullable().optional(),
      targetMode: z11.enum(["roles", "members"]),
      roles: z11.array(z11.enum(COMPANY_ANNOUNCEMENT_ROLES)).optional(),
      memberIds: z11.array(id2).max(500).optional(),
      startsAt: dateStr6,
      endsAt: dateStr6,
      dismissable: z11.boolean(),
      active: z11.boolean().optional()
    });
    announcementsRouter = router({
      list: platformProcedure.query(() => listAnnouncements()),
      get: platformProcedure.input(z11.object({ id: id2 })).query(({ input }) => getAnnouncement(input.id)),
      create: platformProcedure.input(payload).mutation(async ({ ctx, input }) => {
        const item = await createAnnouncement(input, ctx.platformAdminId ?? null);
        void auditFromCtx(ctx, {
          action: "create",
          module: "platform",
          entityType: "announcement",
          entityId: item.id,
          entityLabel: item.title,
          description: `Criou o aviso "${item.title}"`,
          newData: { id: item.id, roles: item.roles, audienceScope: item.audienceScope, companyIds: item.companyIds },
          companyId: null
        });
        return item;
      }),
      update: platformProcedure.input(payload.extend({ id: id2 })).mutation(async ({ ctx, input }) => {
        const { id: announcementId, ...data } = input;
        const item = await updateAnnouncement(announcementId, data, ctx.platformAdminId ?? null);
        void auditFromCtx(ctx, {
          action: "update",
          module: "platform",
          entityType: "announcement",
          entityId: item.id,
          entityLabel: item.title,
          description: `Atualizou o aviso "${item.title}"`,
          newData: { id: item.id, roles: item.roles, audienceScope: item.audienceScope, companyIds: item.companyIds },
          companyId: null
        });
        return item;
      }),
      setActive: platformProcedure.input(z11.object({ id: id2, active: z11.boolean() })).mutation(async ({ ctx, input }) => {
        const item = await setAnnouncementActive(input.id, input.active, ctx.platformAdminId ?? null);
        void auditFromCtx(ctx, {
          action: "update",
          module: "platform",
          entityType: "announcement",
          entityId: item.id,
          entityLabel: item.title,
          description: `${input.active ? "Ativou" : "Pausou"} o aviso "${item.title}"`,
          companyId: null
        });
        return item;
      }),
      delete: platformProcedure.input(z11.object({ id: id2 })).mutation(async ({ ctx, input }) => {
        const current = await getAnnouncement(input.id);
        if (!current) throw new TRPCError18({ code: "BAD_REQUEST", message: "Aviso n\xE3o encontrado." });
        await deleteAnnouncement(input.id);
        void auditFromCtx(ctx, {
          action: "delete",
          module: "platform",
          entityType: "announcement",
          entityId: current.id,
          entityLabel: current.title,
          description: `Excluiu o aviso "${current.title}"`,
          companyId: null
        });
        return { success: true };
      }),
      company: router({
        list: companyManagerProcedure.query(async ({ ctx }) => {
          const actor = companyActor(ctx);
          const rows4 = await listCompanyAnnouncements(actor.companyId);
          return rows4.map((item) => ({ ...item, canManage: canManageCompanyAnnouncement(actor, item) }));
        }),
        recipients: companyManagerProcedure.query(({ ctx }) => listCompanyAnnouncementRecipients(Number(ctx.accountId))),
        create: companyManagerProcedure.input(companyPayload).mutation(async ({ ctx, input }) => {
          try {
            const item = await createCompanyAnnouncement(companyActor(ctx), input);
            void auditFromCtx(ctx, {
              action: "create",
              module: "announcements",
              entityType: "announcement",
              entityId: item.id,
              entityLabel: item.title,
              description: `Criou o aviso da empresa "${item.title}"`,
              newData: { id: item.id, targetMode: item.targetMode, roles: item.roles, memberIds: item.memberIds },
              companyId: ctx.accountId
            });
            return item;
          } catch (error) {
            rethrowAnnouncement(error);
          }
        }),
        update: companyManagerProcedure.input(companyPayload.extend({ id: id2 })).mutation(async ({ ctx, input }) => {
          try {
            const { id: announcementId, ...data } = input;
            const item = await updateCompanyAnnouncement(announcementId, companyActor(ctx), data);
            void auditFromCtx(ctx, {
              action: "update",
              module: "announcements",
              entityType: "announcement",
              entityId: item.id,
              entityLabel: item.title,
              description: `Atualizou o aviso da empresa "${item.title}"`,
              newData: { id: item.id, targetMode: item.targetMode, roles: item.roles, memberIds: item.memberIds },
              companyId: ctx.accountId
            });
            return item;
          } catch (error) {
            rethrowAnnouncement(error);
          }
        }),
        setActive: companyManagerProcedure.input(z11.object({ id: id2, active: z11.boolean() })).mutation(async ({ ctx, input }) => {
          try {
            const item = await setCompanyAnnouncementActive(input.id, companyActor(ctx), input.active);
            void auditFromCtx(ctx, {
              action: "update",
              module: "announcements",
              entityType: "announcement",
              entityId: item.id,
              entityLabel: item.title,
              description: `${input.active ? "Ativou" : "Pausou"} o aviso da empresa "${item.title}"`,
              companyId: ctx.accountId
            });
            return item;
          } catch (error) {
            rethrowAnnouncement(error);
          }
        }),
        delete: companyManagerProcedure.input(z11.object({ id: id2 })).mutation(async ({ ctx, input }) => {
          try {
            const current = await deleteCompanyAnnouncement(input.id, companyActor(ctx));
            void auditFromCtx(ctx, {
              action: "delete",
              module: "announcements",
              entityType: "announcement",
              entityId: current.id,
              entityLabel: current.title,
              description: `Excluiu o aviso da empresa "${current.title}"`,
              companyId: ctx.accountId
            });
            return { success: true };
          } catch (error) {
            rethrowAnnouncement(error);
          }
        })
      }),
      mine: protectedProcedure.query(async ({ ctx }) => {
        if (ctx.user.role === "platform_admin" && !ctx.actingAsPlatform) return [];
        if (!ctx.accountId || !["company_admin", "supervisor", "promoter"].includes(String(ctx.user.role))) return [];
        return listVisibleAnnouncementsFor({
          companyId: ctx.accountId,
          role: String(ctx.user.role),
          memberAccountId: ctx.memberAccountId ?? null
        });
      }),
      dismiss: protectedProcedure.input(z11.object({ id: id2 })).mutation(async ({ ctx, input }) => {
        if (!ctx.accountId || !ctx.memberAccountId) {
          throw new TRPCError18({ code: "FORBIDDEN", message: "N\xE3o foi poss\xEDvel dispensar este aviso." });
        }
        if (!["company_admin", "supervisor", "promoter"].includes(String(ctx.user.role))) {
          throw new TRPCError18({ code: "FORBIDDEN", message: "N\xE3o foi poss\xEDvel dispensar este aviso." });
        }
        return dismissAnnouncement({
          announcementId: input.id,
          companyId: ctx.accountId,
          role: String(ctx.user.role),
          memberAccountId: ctx.memberAccountId
        });
      })
    });
  }
});

// server/backup.ts
var backup_exports = {};
__export(backup_exports, {
  BACKUP_PREFIX: () => BACKUP_PREFIX,
  backupDayPrefix: () => backupDayPrefix,
  daysToPurge: () => daysToPurge,
  ensureBackupProgressTable: () => ensureBackupProgressTable,
  purgeOldR2Backups: () => purgeOldR2Backups,
  retentionDaysFromEnv: () => retentionDaysFromEnv,
  runBackupStep: () => runBackupStep,
  runFullBackup: () => runFullBackup
});
import crypto2 from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
function backupDayPrefix(day) {
  return `${BACKUP_PREFIX}/${day}`;
}
function retentionDaysFromEnv(env2 = process.env) {
  return Math.max(1, Number(env2.BACKUP_RETENTION_DAYS || 14));
}
function daysToPurge(keys, keepDays, now = /* @__PURE__ */ new Date()) {
  const days = /* @__PURE__ */ new Set();
  const re = new RegExp(`^${BACKUP_PREFIX}/(\\d{4}-\\d{2}-\\d{2})/`);
  for (const key of keys) {
    const m = key.match(re);
    if (m) days.add(m[1]);
  }
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  cutoff.setUTCDate(cutoff.getUTCDate() - keepDays);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return [...days].filter((d) => d < cutoffStr).sort();
}
async function ensureBackupProgressTable(c) {
  await c.query(`CREATE TABLE IF NOT EXISTS backup_progress (
    day varchar(10) NOT NULL,
    tableName varchar(64) NOT NULL,
    cursorValue varchar(64) NULL,
    part int NOT NULL DEFAULT 0,
    rowsDone int NOT NULL DEFAULT 0,
    done tinyint NOT NULL DEFAULT 0,
    files text NULL,
    updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (day, tableName)
  )`);
}
async function runBackupStep(c, opts = { budgetMs: 18e3 }) {
  if (opts.skipIfNoStorage !== false && !opts.put && !isStorageConfigured()) {
    return {
      day: opts.day ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      complete: true,
      skipped: true,
      reason: "storage_not_configured",
      tables: 0,
      tablesDone: 0,
      partsWritten: 0,
      bytes: 0,
      manifestKey: null
    };
  }
  const started = Date.now();
  const storagePut2 = opts.put ?? storagePutExact;
  const day = opts.day ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const prefix = backupDayPrefix(day);
  await ensureBackupProgressTable(c);
  const [tableRows] = await c.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tableRows.map((r) => String(Object.values(r)[0])).filter((n) => !SKIP_TABLES.has(n)).sort();
  let bytes = 0, partsWritten = 0;
  const [marker] = await c.query(
    "SELECT 1 FROM backup_progress WHERE day = ? AND tableName = '_manifest' AND done = 1",
    [day]
  );
  if (marker.length) {
    return {
      day,
      complete: true,
      skipped: true,
      tables: tables.length,
      tablesDone: tables.length,
      partsWritten: 0,
      bytes: 0,
      manifestKey: null
    };
  }
  const [doneRows] = await c.query("SELECT tableName FROM backup_progress WHERE day = ? AND done = 1", [day]);
  const done = new Set(doneRows.map((r) => r.tableName));
  for (const table2 of tables) {
    if (done.has(table2)) continue;
    const [progRows] = await c.query("SELECT * FROM backup_progress WHERE day = ? AND tableName = ?", [day, table2]);
    const prog = progRows[0];
    let part = prog?.part ?? 0, rowsDone = prog?.rowsDone ?? 0, cursor = prog?.cursorValue ?? null;
    const files = prog?.files ? JSON.parse(prog.files) : [];
    const [keys] = await c.query(`SHOW KEYS FROM \`${table2}\` WHERE Key_name = 'PRIMARY'`);
    const pk = keys.length === 1 ? keys[0].Column_name : null;
    let finished = false;
    while (Date.now() - started < opts.budgetMs) {
      const [rows4] = pk ? await c.query(
        `SELECT * FROM \`${table2}\` ${cursor != null ? `WHERE \`${pk}\` > ?` : ""} ORDER BY \`${pk}\` LIMIT ${CHUNK_ROWS}`,
        cursor != null ? [cursor] : []
      ) : await c.query(`SELECT * FROM \`${table2}\` ORDER BY 1 LIMIT ${CHUNK_ROWS} OFFSET ${rowsDone}`);
      if (!rows4.length) {
        finished = true;
        break;
      }
      const body = await gzip(Buffer.from(rows4.map((r) => JSON.stringify(r, jsonReplacer)).join("\n") + "\n"));
      const key = `${prefix}/${table2}.${String(part).padStart(5, "0")}.jsonl.gz`;
      const stored = await storagePut2(key, body, "application/gzip");
      files.push({ key: stored.key, rows: rows4.length, sha256: crypto2.createHash("sha256").update(body).digest("hex") });
      bytes += body.length;
      partsWritten += 1;
      part += 1;
      rowsDone += rows4.length;
      if (pk) cursor = String(rows4[rows4.length - 1][pk]);
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,0,?)
         ON DUPLICATE KEY UPDATE cursorValue = VALUES(cursorValue), part = VALUES(part), rowsDone = VALUES(rowsDone), files = VALUES(files)`,
        [day, table2, cursor, part, rowsDone, JSON.stringify(files)]
      );
      if (rows4.length < CHUNK_ROWS) {
        finished = true;
        break;
      }
    }
    if (finished) {
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,1,?)
         ON DUPLICATE KEY UPDATE done = 1, files = VALUES(files), rowsDone = VALUES(rowsDone), part = VALUES(part)`,
        [day, table2, cursor, part, rowsDone, JSON.stringify(files)]
      );
      done.add(table2);
    } else break;
  }
  const complete = tables.every((t2) => done.has(t2));
  let manifestKey = null;
  if (complete) {
    const [all] = await c.query(
      "SELECT tableName, rowsDone, files FROM backup_progress WHERE day = ? AND tableName <> '_manifest' ORDER BY tableName",
      [day]
    );
    const ddl = [];
    for (const t2 of tables) {
      const [d] = await c.query(`SHOW CREATE TABLE \`${t2}\``);
      ddl.push(`${d[0]["Create Table"]};`);
    }
    const schema = await gzip(Buffer.from(ddl.join("\n\n")));
    await storagePut2(`${prefix}/_schema.sql.gz`, schema, "application/gzip");
    const manifest = {
      format: 2,
      day,
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tables: all.map((r) => ({ name: r.tableName, rows: r.rowsDone, files: JSON.parse(r.files || "[]") }))
    };
    const stored = await storagePut2(`${prefix}/_manifest.json`, Buffer.from(JSON.stringify(manifest)), "application/json");
    manifestKey = stored.key;
    await c.query("INSERT INTO backup_progress (day, tableName, done) VALUES (?, '_manifest', 1) ON DUPLICATE KEY UPDATE done = 1", [
      day
    ]);
  }
  return { day, complete, tables: tables.length, tablesDone: done.size, partsWritten, bytes, manifestKey };
}
async function purgeOldR2Backups(opts = {}) {
  const keepDays = opts.keepDays ?? retentionDaysFromEnv();
  const listKeys = opts.listKeys ?? storageListKeys;
  const deleteMany = opts.deleteMany ?? storageDeleteMany;
  if (!opts.listKeys && !isStorageConfigured()) {
    return { keepDays, purgedDays: [], deletedObjects: 0, skipped: true };
  }
  const keys = await listKeys(`${BACKUP_PREFIX}/`);
  const purge = daysToPurge(keys, keepDays, opts.now);
  let deletedObjects = 0;
  for (const day of purge) {
    const dayKeys = keys.filter((k) => k.startsWith(`${BACKUP_PREFIX}/${day}/`));
    deletedObjects += await deleteMany(dayKeys);
  }
  return { keepDays, purgedDays: purge, deletedObjects, skipped: false };
}
async function runFullBackup(c, opts = {}) {
  const budgetMs = opts.budgetMs ?? Number(process.env.BACKUP_BUDGET_MS || 12e4);
  const maxSteps = opts.maxSteps ?? 50;
  let last = null;
  for (let i = 0; i < maxSteps; i++) {
    last = await runBackupStep(c, { budgetMs, day: opts.day, put: opts.put });
    if (last.complete || last.reason === "storage_not_configured") break;
  }
  let retention = null;
  if (last?.complete && last.reason !== "storage_not_configured") {
    retention = await purgeOldR2Backups();
  }
  return { backup: last, retention };
}
var gzip, CHUNK_ROWS, SKIP_TABLES, BACKUP_PREFIX, jsonReplacer;
var init_backup = __esm({
  "server/backup.ts"() {
    "use strict";
    init_storage();
    gzip = promisify(zlib.gzip);
    CHUNK_ROWS = Number(process.env.BACKUP_CHUNK_ROWS || 5e3);
    SKIP_TABLES = /* @__PURE__ */ new Set(["__drizzle_migrations", "member_sessions", "platform_sessions", "backup_progress"]);
    BACKUP_PREFIX = "backups/database";
    jsonReplacer = (_k, v) => typeof v === "bigint" ? v.toString() : v;
  }
});

// shared/liveErrorCopy.ts
function haystack(input) {
  return [
    input.title,
    input.culprit,
    input.metadataType,
    input.metadataValue,
    input.transaction,
    input.level
  ].filter(Boolean).join(" \n ");
}
function isGrowing(count24h, count7d) {
  const last24 = Math.max(0, count24h);
  const week = Math.max(last24, count7d);
  if (last24 >= 3 && week <= last24) return true;
  if (last24 >= 5 && last24 * 7 > week * 1.8) return true;
  return false;
}
function formatLiveErrorWhen(value) {
  if (!value) return "data desconhecida";
  const date3 = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date3.getTime())) return "data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: LIVE_ERROR_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date3);
}
function liveErrorsHeadline(params) {
  if (params.needsFix24h <= 0) {
    return "Nenhum erro nas \xFAltimas 24h";
  }
  const problemas = `${params.needsFix24h} ${params.needsFix24h === 1 ? "problema" : "problemas"} nas \xFAltimas 24h`;
  if (params.grave24h <= 0) return problemas;
  return `${problemas}, ${params.grave24h} ${params.grave24h === 1 ? "grave" : "graves"}`;
}
function extractPlace(...parts) {
  const text4 = parts.filter(Boolean).join(" ");
  if (!text4.trim()) return "Tela n\xE3o identificada";
  for (const route of SCREEN_ROUTES) {
    if (route.pattern.test(text4)) return route.name;
  }
  const url = text4.match(/https?:\/\/[^/\s]+(\/[^?\s#]*)/i);
  if (url?.[1] && url[1] !== "/") {
    const path3 = url[1].replace(/\/$/, "") || "/";
    for (const route of SCREEN_ROUTES) {
      if (route.pattern.test(path3)) return route.name;
    }
  }
  return "Tela n\xE3o identificada";
}
function isServiceWorkerNoise(text4) {
  return /service\s*worker|serviceWorker|workbox|importScripts|Skip waiting|waiting to activate|Failed to update a ServiceWorker|InvalidStateError[\s\S]*ServiceWorker/i.test(text4);
}
function isNetwork(text4) {
  return /Failed to fetch|NetworkError|Load failed|net::ERR_|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_CONNECTION_|NS_ERROR_NET|offline|sem conexão|network request failed/i.test(text4);
}
function isCheckinPhoto(text4) {
  return /(store-photos|storePhotos|visit-photos|visitPhotos|visitCheckin|upload.*foto|foto.*upload|check-?in.*foto|foto.*check-?in)/i.test(text4);
}
function isGpsOrCamera(text4) {
  return /Geolocation|getCurrentPosition|NotAllowedError|Permission denied|PermissionDeniedError|getUserMedia|NotFoundError|NotReadableError|OverconstrainedError|câmera|camera|GPS|localiza(ção|cao) (negada|indisponível|bloqueada)/i.test(text4);
}
function isSession(text4) {
  return /\b401\b|unauthorized|sessão expirada|sessao expirada|não autenticado|nao autenticado|jwt expired|invalid token|login required|UNAUTHENTICATED/i.test(text4);
}
function isDatabase(text4) {
  return /TiDB|mysql|drizzle|ECONNREFUSED|ER_[A-Z0-9_]+|deadlock|too many connections|banco de dados|database.*(fail|error|timeout)|connection lost/i.test(text4);
}
function isChunkLoad(text4) {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|CSS_CHUNK_LOAD_ERROR/i.test(text4);
}
function isTimeout(text4) {
  return /TimeoutError|timed?\s*out|ETIMEDOUT|ESOCKETTIMEDOUT|demorou demais|aborted due to timeout/i.test(text4);
}
function detectKind(input) {
  const text4 = haystack(input);
  const metaType = String(input.metadataType || "");
  if (/chrome-extension:|moz-extension:|safari-web-extension:|safari-extension:/i.test(text4)) return "browser_extension";
  if (isServiceWorkerNoise(text4)) return "service_worker";
  if (isSession(text4)) return "session";
  if (isGpsOrCamera(text4)) return "gps_camera";
  if (/AbortError|The user aborted|aborted by the user|The operation was aborted/i.test(text4) && !isTimeout(text4)) return "user_abort";
  if (isDatabase(text4)) return "database";
  if (isTimeout(text4)) return "timeout";
  if (isCheckinPhoto(text4) && (isNetwork(text4) || /payload too large|413|upload/i.test(text4) || /failed/i.test(text4))) return "checkin_photo";
  if (isChunkLoad(text4)) return "chunk_load";
  if (isNetwork(text4) || /^TypeError:\s*Failed to fetch/i.test(input.title) || /TypeError:\s*Load failed/i.test(input.title)) return "network";
  if (/\b500\b|Internal Server Error|internal server error/i.test(text4)) return "server_500";
  if (/\b403\b|FORBIDDEN|acesso negado|forbidden/i.test(text4)) return "forbidden";
  if (/ReferenceError/i.test(metaType) || /ReferenceError/i.test(input.title)) return "reference_error";
  if (/TypeError/i.test(metaType) || /TypeError/i.test(input.title)) return "type_error";
  return "unknown";
}
function defaultAction(kind, input, growing) {
  const manyUsers = input.userCount >= 3;
  const persistentChunk = input.count24h >= 3 || input.userCount >= 2 || growing;
  switch (kind) {
    case "type_error":
      return { action: "needs_fix", reason: "\xC9 um erro de c\xF3digo (TypeError) e precisa ser corrigido no aplicativo." };
    case "reference_error":
      return { action: "needs_fix", reason: "\xC9 um erro de c\xF3digo (ReferenceError) e precisa ser corrigido no aplicativo." };
    case "server_500":
      return { action: "needs_fix", reason: "O servidor respondeu com erro interno (500), o que n\xE3o deveria acontecer no uso normal." };
    case "database":
      return { action: "needs_fix", reason: "Houve falha no banco de dados, o que indica um problema a corrigir." };
    case "chunk_load":
      if (persistentChunk) {
        return { action: "needs_fix", reason: "A p\xE1gina ou um arquivo do aplicativo deixou de carregar v\xE1rias vezes, ent\xE3o n\xE3o parece s\xF3 uma queda de sinal." };
      }
      return { action: "expected", reason: "A p\xE1gina n\xE3o terminou de carregar uma vez s\xF3, o que costuma ser instabilidade de rede." };
    case "network":
      return { action: "expected", reason: "Falha de rede ou aparelho offline, comum no uso do dia a dia." };
    case "checkin_photo":
      return { action: "expected", reason: "O envio da foto de check-in falhou, geralmente por sinal fraco no momento da foto." };
    case "gps_camera":
      return { action: "expected", reason: "A localiza\xE7\xE3o ou a c\xE2mera foi negada ou estava indispon\xEDvel no aparelho." };
    case "timeout":
      return { action: "expected", reason: "O aparelho ou a conex\xE3o estourou o tempo de espera, o que \xE9 comum em sinal fraco." };
    case "user_abort":
      return { action: "expected", reason: "A pessoa ou o aparelho cancelou a a\xE7\xE3o antes de terminar." };
    case "browser_extension":
      return { action: "expected", reason: "Uma extens\xE3o do navegador interferiu na p\xE1gina, n\xE3o \xE9 um defeito do GondUp." };
    case "service_worker":
      return { action: "expected", reason: "\xC9 ru\xEDdo da atualiza\xE7\xE3o autom\xE1tica no celular, n\xE3o um erro que precise de corre\xE7\xE3o." };
    case "session":
      return { action: "expected", reason: "A sess\xE3o expirou ou o login n\xE3o estava mais v\xE1lido, situa\xE7\xE3o normal de uso." };
    case "forbidden":
      return { action: "expected", reason: "O acesso foi recusado por permiss\xE3o ou sess\xE3o, o que pode acontecer no uso normal." };
    default: {
      if (growing || manyUsers || input.count24h >= 5) {
        return { action: "needs_fix", reason: "O erro ainda n\xE3o foi classificado e est\xE1 atingindo v\xE1rias ocorr\xEAncias ou usu\xE1rios, ent\xE3o vale corrigir." };
      }
      return { action: "needs_fix", reason: "O erro ainda n\xE3o foi classificado; vale conferir se \xE9 um defeito no c\xF3digo." };
    }
  }
}
function severityFor(kind, action, input, growing) {
  if (action === "expected") return "leve";
  const many = input.userCount >= 5 || input.count24h >= 20;
  if (kind === "server_500" || kind === "database" || many) return "grave";
  if (kind === "type_error" || kind === "reference_error") {
    return input.userCount >= 2 || input.count24h >= 5 || growing ? "grave" : "atencao";
  }
  if (growing || input.userCount >= 3 || kind === "chunk_load") return "atencao";
  return "atencao";
}
function classifyLiveError(input) {
  const kind = detectKind(input);
  const growing = isGrowing(input.count24h, input.count7d);
  const { action, reason } = defaultAction(kind, input, growing);
  const place = extractPlace(input.transaction, input.culprit, input.title, input.metadataValue);
  return {
    kind,
    title: TITLE_BY_KIND[kind],
    place,
    severity: severityFor(kind, action, input, growing),
    growing,
    action,
    actionReason: reason,
    isServiceWorkerNoise: kind === "service_worker"
  };
}
function applyLiveErrorOverride(copy, override) {
  if (!override || override === copy.action) return copy;
  if (override === "expected") {
    return {
      ...copy,
      action: "expected",
      severity: "leve",
      actionReason: "Voc\xEA marcou este erro como normal."
    };
  }
  return {
    ...copy,
    action: "needs_fix",
    severity: copy.severity === "leve" ? "atencao" : copy.severity,
    actionReason: "Voc\xEA desfez a marca\xE7\xE3o de normal; este erro volta a precisar de corre\xE7\xE3o."
  };
}
var LIVE_ERROR_ZONE, SCREEN_ROUTES, TITLE_BY_KIND;
var init_liveErrorCopy = __esm({
  "shared/liveErrorCopy.ts"() {
    "use strict";
    LIVE_ERROR_ZONE = "America/Sao_Paulo";
    SCREEN_ROUTES = [
      { pattern: /\/plataforma\/scanner\b/i, name: "Erros ao vivo" },
      { pattern: /\/plataforma\/ia\b/i, name: "Suporte com IA" },
      { pattern: /\/plataforma\/ponto\b/i, name: "Ponto eletr\xF4nico (teste)" },
      { pattern: /\/admin\/empresas\b/i, name: "Empresas" },
      { pattern: /\/admin\/avisos\b/i, name: "Avisos da plataforma" },
      { pattern: /\/admin\/usuarios\b/i, name: "Usu\xE1rios da plataforma" },
      { pattern: /\/cartao-ponto\b/i, name: "Cart\xE3o-ponto" },
      { pattern: /\/espelho-ponto\b/i, name: "Espelho de ponto" },
      { pattern: /\/banco-de-horas\b/i, name: "Banco de horas" },
      { pattern: /\/check-in-out\b/i, name: "Check-in e check-out" },
      { pattern: /\/ponto#correcoes|#correcoes/i, name: "Corre\xE7\xF5es de ponto" },
      { pattern: /\/comprovantes\b/i, name: "Meus comprovantes" },
      { pattern: /\/ponto\b/i, name: "Ponto" },
      { pattern: /\/lojas\b/i, name: "Lojas" },
      { pattern: /\/produtos\b/i, name: "Produtos" },
      { pattern: /\/ferias\b/i, name: "F\xE9rias" },
      { pattern: /\/avisos\b/i, name: "Avisos" },
      { pattern: /\/lgpd\b/i, name: "LGPD" },
      { pattern: /\/equipe\b|\/promotores\b/i, name: "Promotores e equipe" },
      { pattern: /\/roteiros\b/i, name: "Roteiros" },
      { pattern: /\/auditoria\b/i, name: "Auditoria" },
      { pattern: /\/lixeira\b/i, name: "Lixeira" },
      { pattern: /\/pagamentos\b|\/faturas\b|\/assinatura\b|\/plano\b/i, name: "Plano e pagamento" },
      { pattern: /\/termos\b/i, name: "Termos de uso" },
      { pattern: /\/privacidade\b/i, name: "Pol\xEDtica de privacidade" },
      { pattern: /\/login\b/i, name: "Login" },
      { pattern: /storePhotos|store-photos|visitPhotos|visit-photos|visitCheckin/i, name: "Foto de check-in ou da loja" },
      { pattern: /timeTracking|time-tracking|timeEvents|pontoLegal/i, name: "Ponto" },
      { pattern: /\/$/, name: "In\xEDcio" }
    ];
    TITLE_BY_KIND = {
      type_error: "O aplicativo travou por um erro no c\xF3digo",
      reference_error: "O aplicativo tentou usar algo que n\xE3o existe",
      server_500: "O servidor encontrou um erro interno",
      database: "Falha ao acessar o banco de dados",
      chunk_load: "A p\xE1gina n\xE3o carregou por completo",
      network: "Falha de conex\xE3o com a internet",
      checkin_photo: "N\xE3o foi poss\xEDvel enviar a foto do check-in",
      gps_camera: "Localiza\xE7\xE3o ou c\xE2mera indispon\xEDveis",
      timeout: "A opera\xE7\xE3o demorou demais e foi interrompida",
      user_abort: "A a\xE7\xE3o foi cancelada no aparelho",
      browser_extension: "Uma extens\xE3o do navegador interferiu no site",
      service_worker: "Ru\xEDdo da atualiza\xE7\xE3o autom\xE1tica no celular",
      session: "A sess\xE3o expirou ou o login n\xE3o est\xE1 mais v\xE1lido",
      forbidden: "O acesso a um recurso foi recusado",
      unknown: "Aconteceu um erro ainda n\xE3o classificado"
    };
  }
});

// server/liveErrorStore.ts
import { sql as sql20 } from "drizzle-orm";
async function ensureLiveErrorTables() {
  if (ready9) return ready9;
  ready9 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql20.raw(`CREATE TABLE IF NOT EXISTS live_error_overrides (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sentryIssueId VARCHAR(64) NOT NULL,
      classification VARCHAR(16) NOT NULL,
      githubIssueNumber INT NULL,
      githubIssueUrl VARCHAR(255) NULL,
      sentryIgnored TINYINT NOT NULL DEFAULT 0,
      updatedBy VARCHAR(255) NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY live_error_overrides_issue (sentryIssueId)
    )`));
    await database2.execute(sql20.raw(`CREATE TABLE IF NOT EXISTS platform_job_runs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      job VARCHAR(64) NOT NULL,
      ok TINYINT NOT NULL,
      summary VARCHAR(500) NULL,
      startedAt TIMESTAMP NOT NULL,
      finishedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY platform_job_runs_job_finished (job, finishedAt)
    )`));
  })().catch((error) => {
    ready9 = null;
    throw error;
  });
  return ready9;
}
async function queryRows2(query) {
  const database2 = await getDb();
  if (!database2) return [];
  const [rows4] = await database2.execute(query);
  return Array.isArray(rows4) ? rows4 : [];
}
async function listLiveErrorOverrides() {
  await ensureLiveErrorTables();
  const rows4 = await queryRows2(sql20`
    SELECT sentryIssueId, classification, githubIssueNumber, githubIssueUrl, sentryIgnored, updatedBy, updatedAt
    FROM live_error_overrides
  `).catch(() => []);
  return rows4.map((row2) => ({
    sentryIssueId: String(row2.sentryIssueId),
    classification: row2.classification === "needs_fix" ? "needs_fix" : "expected",
    githubIssueNumber: row2.githubIssueNumber != null ? Number(row2.githubIssueNumber) : null,
    githubIssueUrl: row2.githubIssueUrl ? String(row2.githubIssueUrl) : null,
    sentryIgnored: Number(row2.sentryIgnored) === 1,
    updatedBy: row2.updatedBy ? String(row2.updatedBy) : null,
    updatedAt: row2.updatedAt ?? null
  }));
}
async function upsertLiveErrorOverride(input) {
  await ensureLiveErrorTables();
  const database2 = await getDb();
  if (!database2) throw new Error("Banco de dados indispon\xEDvel.");
  await database2.execute(sql20`
    INSERT INTO live_error_overrides (
      sentryIssueId, classification, githubIssueNumber, githubIssueUrl, sentryIgnored, updatedBy, updatedAt
    ) VALUES (
      ${input.sentryIssueId},
      ${input.classification},
      ${input.githubIssueNumber ?? null},
      ${input.githubIssueUrl ?? null},
      ${input.sentryIgnored ? 1 : 0},
      ${input.updatedBy ?? null},
      UTC_TIMESTAMP()
    )
    ON DUPLICATE KEY UPDATE
      classification = VALUES(classification),
      githubIssueNumber = COALESCE(VALUES(githubIssueNumber), githubIssueNumber),
      githubIssueUrl = COALESCE(VALUES(githubIssueUrl), githubIssueUrl),
      sentryIgnored = VALUES(sentryIgnored),
      updatedBy = VALUES(updatedBy),
      updatedAt = UTC_TIMESTAMP()
  `);
}
async function recordPlatformJobRun(input) {
  try {
    await ensureLiveErrorTables();
    const database2 = await getDb();
    if (!database2) return;
    const summary = (input.summary || "").slice(0, 500) || null;
    const started = input.startedAt.toISOString().slice(0, 19).replace("T", " ");
    const finished = (input.finishedAt ?? /* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace("T", " ");
    await database2.execute(sql20`
      INSERT INTO platform_job_runs (job, ok, summary, startedAt, finishedAt)
      VALUES (${input.job}, ${input.ok ? 1 : 0}, ${summary}, ${started}, ${finished})
    `);
  } catch (error) {
    console.warn("[live-errors] n\xE3o foi poss\xEDvel registrar a rotina", input.job, error);
  }
}
async function listLatestPlatformJobRuns(jobs) {
  await ensureLiveErrorTables();
  if (jobs.length === 0) return [];
  const rows4 = await queryRows2(sql20`
    SELECT job, ok, summary, startedAt, finishedAt
    FROM platform_job_runs
    ORDER BY id DESC
    LIMIT 80
  `).catch(() => []);
  const wanted = new Set(jobs);
  const latest = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row2 of rows4) {
    const job = String(row2.job);
    if (!wanted.has(job) || seen.has(job)) continue;
    seen.add(job);
    latest.push({
      job,
      ok: Number(row2.ok) === 1,
      summary: row2.summary ? String(row2.summary) : null,
      startedAt: row2.startedAt,
      finishedAt: row2.finishedAt
    });
  }
  return latest;
}
async function latestCompletedBackupDay() {
  await ensureLiveErrorTables();
  const database2 = await getDb();
  if (!database2) return null;
  try {
    const [rows4] = await database2.execute(sql20.raw(
      "SELECT day FROM backup_progress WHERE tableName = '_manifest' AND done = 1 ORDER BY day DESC LIMIT 1"
    ));
    const day = rows4?.[0]?.day;
    return day ? String(day) : null;
  } catch {
    return null;
  }
}
var ready9;
var init_liveErrorStore = __esm({
  "server/liveErrorStore.ts"() {
    "use strict";
    init_db();
    ready9 = null;
  }
});

// server/liveErrors.ts
import fs2 from "node:fs";
import os from "node:os";
import { z as z12 } from "zod";
import { TRPCError as TRPCError19 } from "@trpc/server";
function sentryToken() {
  const token = process.env.SENTRY_AUTH_TOKEN?.trim();
  return token || null;
}
function githubToken() {
  const token = process.env.GITHUB_ISSUES_TOKEN?.trim();
  return token || null;
}
function actorOf(ctx) {
  return ctx.user?.email || ctx.user?.name || (ctx.platformAdminId != null ? `admin-${ctx.platformAdminId}` : "plataforma");
}
async function fetchJson(url, init2, timeoutMs = 12e3) {
  const signal = AbortSignal.timeout(timeoutMs);
  const response = await fetch(url, { ...init2, signal });
  const text4 = await response.text();
  let body = null;
  try {
    body = text4 ? JSON.parse(text4) : null;
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body, text: text4 };
}
function sumSince(buckets2, sinceMs) {
  if (!buckets2?.length) return 0;
  return buckets2.reduce((sum, [ts, count]) => {
    const ms2 = ts > 1e10 ? ts : ts * 1e3;
    return ms2 >= sinceMs ? sum + Number(count || 0) : sum;
  }, 0);
}
function issueCounts(issue, now = Date.now()) {
  const allBuckets = Object.values(issue.stats || {}).flat();
  const countAll = Number(issue.count) || 0;
  const count24h = sumSince(allBuckets, now - 24 * 60 * 60 * 1e3);
  const count7d = sumSince(allBuckets, now - 7 * 24 * 60 * 60 * 1e3);
  const lastSeen = issue.lastSeen ? new Date(issue.lastSeen).getTime() : 0;
  return {
    count24h: count24h || (lastSeen >= now - 24 * 60 * 60 * 1e3 ? countAll || 1 : 0),
    count7d: count7d || (lastSeen >= now - 7 * 24 * 60 * 60 * 1e3 ? countAll || 1 : count24h)
  };
}
async function fetchSentryIssues(query) {
  const token = sentryToken();
  if (!token) return [];
  const url = new URL(`${SENTRY_HOST}/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/`);
  url.searchParams.set("query", query);
  url.searchParams.set("statsPeriod", "14d");
  url.searchParams.set("limit", "50");
  url.searchParams.set("sort", "freq");
  const result = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  if (!result.ok || !Array.isArray(result.body)) {
    throw new Error(`Sentry HTTP ${result.status}`);
  }
  return result.body;
}
async function fetchSentryIssue(id3) {
  const token = sentryToken();
  if (!token) return null;
  const result = await fetchJson(`${SENTRY_HOST}/api/0/issues/${encodeURIComponent(id3)}/`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }
  });
  return result.ok && result.body?.id ? result.body : null;
}
async function setSentryIssueStatus(id3, status2) {
  const token = sentryToken();
  if (!token) return false;
  const result = await fetchJson(`${SENTRY_HOST}/api/0/issues/${encodeURIComponent(id3)}/`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ status: status2 })
  });
  return result.ok;
}
function technicalDetails(issue) {
  return [
    issue.title,
    issue.metadata?.type && issue.metadata?.value ? `${issue.metadata.type}: ${issue.metadata.value}` : issue.metadata?.value,
    issue.culprit ? `Origem: ${issue.culprit}` : null,
    issue.permalink
  ].filter(Boolean).join("\n");
}
function toCard(issue, override, now = Date.now()) {
  const counts = issueCounts(issue, now);
  const raw = classifyLiveError({
    title: issue.title,
    culprit: issue.culprit,
    metadataType: issue.metadata?.type,
    metadataValue: issue.metadata?.value,
    level: issue.level,
    transaction: issue.culprit,
    count24h: counts.count24h,
    count7d: counts.count7d,
    userCount: Number(issue.userCount) || 0
  });
  const copy = applyLiveErrorOverride(raw, override?.classification);
  return {
    ...copy,
    id: String(issue.id),
    sentryIds: [String(issue.id)],
    count24h: counts.count24h,
    count7d: counts.count7d,
    userCount: Number(issue.userCount) || 0,
    firstSeen: issue.firstSeen ?? null,
    lastSeen: issue.lastSeen ?? null,
    firstSeenLabel: formatLiveErrorWhen(issue.firstSeen),
    lastSeenLabel: formatLiveErrorWhen(issue.lastSeen),
    sentryUrl: issue.permalink ?? null,
    originalTitle: issue.title,
    technical: technicalDetails(issue),
    githubIssueUrl: override?.githubIssueUrl ?? null,
    githubIssueNumber: override?.githubIssueNumber ?? null,
    markedNormal: override?.classification === "expected",
    grouped: false
  };
}
function groupServiceWorkerNoise(cards) {
  const noise = cards.filter((card) => card.isServiceWorkerNoise && card.action === "expected");
  const rest = cards.filter((card) => !(card.isServiceWorkerNoise && card.action === "expected"));
  if (noise.length <= 1) return cards;
  const first = noise[0];
  const lastSeen = noise.map((card) => card.lastSeen).filter(Boolean).sort().at(-1) ?? first.lastSeen;
  const firstSeen = noise.map((card) => card.firstSeen).filter(Boolean).sort()[0] ?? first.firstSeen;
  rest.unshift({
    ...first,
    id: "sw-noise",
    sentryIds: noise.flatMap((card) => card.sentryIds),
    count24h: noise.reduce((sum, card) => sum + card.count24h, 0),
    count7d: noise.reduce((sum, card) => sum + card.count7d, 0),
    userCount: Math.max(...noise.map((card) => card.userCount)),
    firstSeen,
    lastSeen,
    firstSeenLabel: formatLiveErrorWhen(firstSeen),
    lastSeenLabel: formatLiveErrorWhen(lastSeen),
    originalTitle: noise.map((card) => card.originalTitle).join("\n"),
    technical: noise.map((card) => card.technical).join("\n\n"),
    grouped: true,
    githubIssueUrl: null,
    githubIssueNumber: null,
    markedNormal: false,
    place: "V\xE1rias telas"
  });
  return rest;
}
async function loadErrorCards() {
  const configured = Boolean(sentryToken());
  if (!configured) return { sentryConfigured: false, sentryError: null, cards: [] };
  try {
    const [unresolved, ignored, overrides] = await Promise.all([
      fetchSentryIssues("is:unresolved lastSeen:-7d"),
      fetchSentryIssues("is:ignored lastSeen:-7d").catch(() => []),
      listLiveErrorOverrides()
    ]);
    const byId = /* @__PURE__ */ new Map();
    for (const issue of [...unresolved, ...ignored]) byId.set(String(issue.id), issue);
    const overrideById = new Map(overrides.map((row2) => [row2.sentryIssueId, row2]));
    const cards = [...byId.values()].map((issue) => {
      const override = overrideById.get(String(issue.id));
      const card = toCard(issue, override);
      if (issue.status === "ignored" && !override) {
        return { ...card, action: "expected", severity: "leve", actionReason: "Este erro j\xE1 foi ignorado no Sentry.", markedNormal: true };
      }
      return card;
    });
    cards.sort((a, b) => {
      if (a.action !== b.action) return a.action === "needs_fix" ? -1 : 1;
      const sev = { grave: 0, atencao: 1, leve: 2 };
      if (sev[a.severity] !== sev[b.severity]) return sev[a.severity] - sev[b.severity];
      return b.count24h - a.count24h;
    });
    return { sentryConfigured: true, sentryError: null, cards: groupServiceWorkerNoise(cards) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "falha desconhecida";
    console.warn("[live-errors] Sentry:", message);
    return { sentryConfigured: true, sentryError: "N\xE3o foi poss\xEDvel ler os erros no Sentry agora. Tente atualizar em instantes.", cards: [] };
  }
}
function readCgroupMemory() {
  try {
    const used = Number(fs2.readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim());
    if (!Number.isFinite(used)) return null;
    const raw = fs2.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
    const limit = raw === "max" ? null : Number(raw);
    return { usedBytes: used, limitBytes: Number.isFinite(limit) ? limit : null };
  } catch {
    return null;
  }
}
function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2).toLocaleString("pt-BR")} MB`;
  return `${Math.round(bytes / 1024).toLocaleString("pt-BR")} KB`;
}
function firstExistingFile(paths) {
  for (const file of paths) {
    try {
      if (fs2.existsSync(file)) return file;
    } catch {
    }
  }
  return null;
}
function readVersion() {
  const shaFromEnv = process.env.BUILD_SHA?.trim() || process.env.VERCEL_GIT_COMMIT_SHA?.trim() || "";
  const shaFile = firstExistingFile(["/app/BUILD_SHA", "/app/runtime/deployed-sha", "/opt/gondup/.deployed-sha"]);
  let sha = shaFromEnv;
  if (!sha && shaFile) {
    try {
      sha = fs2.readFileSync(shaFile, "utf8").trim();
    } catch {
    }
  }
  const timeFromEnv = process.env.BUILD_TIME?.trim() || process.env.VERCEL_DEPLOYMENT_CREATED_AT?.trim() || "";
  let deployedAt = timeFromEnv || null;
  if (!deployedAt && shaFile) {
    try {
      deployedAt = fs2.statSync(shaFile).mtime.toISOString();
    } catch {
    }
  }
  const statusFile = firstExistingFile(["/app/runtime/deploy-status.json", "/opt/gondup/runtime/deploy-status.json"]);
  if (statusFile) {
    try {
      const status2 = JSON.parse(fs2.readFileSync(statusFile, "utf8"));
      if (!sha && status2.sha) sha = status2.sha;
      if (status2.deployedAt) deployedAt = status2.deployedAt;
    } catch {
    }
  }
  return {
    sha: sha || null,
    shortSha: sha ? sha.slice(0, 7) : null,
    deployedAt,
    deployedAtLabel: deployedAt ? formatLiveErrorWhen(deployedAt) : null,
    available: Boolean(sha)
  };
}
function readMemory() {
  const cgroup = readCgroupMemory();
  const total = cgroup?.limitBytes || os.totalmem();
  const used = cgroup?.usedBytes ?? os.totalmem() - os.freemem();
  const free = Math.max(0, total - used);
  const usedPercent = total > 0 ? Math.round(used / total * 100) : 0;
  return {
    usedBytes: used,
    totalBytes: total,
    freeBytes: free,
    usedPercent,
    usedLabel: formatBytes(used),
    totalLabel: formatBytes(total),
    source: "visto pelo aplicativo"
  };
}
function readDisk() {
  try {
    const stats = fs2.statfsSync?.("/");
    if (!stats) return { available: false, message: "N\xE3o foi poss\xEDvel ler o espa\xE7o em disco deste aplicativo." };
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bavail;
    const used = Math.max(0, total - free);
    const usedPercent = total > 0 ? Math.round(used / total * 100) : 0;
    return {
      available: true,
      usedBytes: used,
      totalBytes: total,
      freeBytes: free,
      usedPercent,
      usedLabel: formatBytes(used),
      totalLabel: formatBytes(total),
      freeLabel: formatBytes(free),
      source: "visto pelo aplicativo"
    };
  } catch {
    return { available: false, message: "N\xE3o foi poss\xEDvel ler o espa\xE7o em disco deste aplicativo." };
  }
}
async function readBackup() {
  const day = await latestCompletedBackupDay();
  let objectCount = 0;
  if (day) {
    try {
      const keys = await storageListKeys(`${BACKUP_PREFIX}/${day}`);
      objectCount = keys.length;
    } catch {
      objectCount = 0;
    }
  }
  if (!day) {
    return {
      ok: false,
      day: null,
      dayLabel: null,
      fresh: false,
      message: "Ainda n\xE3o h\xE1 um backup conclu\xEDdo registrado no aplicativo.",
      objectCount: 0
    };
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(/* @__PURE__ */ new Date());
  const yesterdayDate = new Date(Date.now() - 24 * 60 * 60 * 1e3);
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(yesterdayDate);
  const fresh = day === today || day === yesterday;
  const [year, month, rest] = day.split("-");
  const dayLabel2 = `${rest}/${month}/${year}`;
  return {
    ok: fresh,
    day,
    dayLabel: dayLabel2,
    fresh,
    objectCount,
    message: fresh ? `Backup de ${dayLabel2} conclu\xEDdo${objectCount ? ` (${objectCount} arquivos no armazenamento)` : ""}.` : `O \xFAltimo backup conclu\xEDdo \xE9 de ${dayLabel2}, fora das \xFAltimas 24 horas.`
  };
}
async function readJobs() {
  const rows4 = await listLatestPlatformJobRuns([...SCHEDULED_JOBS]);
  const byJob = new Map(rows4.map((row2) => [row2.job, row2]));
  return SCHEDULED_JOBS.map((job) => {
    const row2 = byJob.get(job);
    if (!row2) {
      return {
        job,
        label: JOB_LABEL[job],
        ok: null,
        summary: "Ainda n\xE3o h\xE1 registro neste aplicativo. A pr\xF3xima rotina da madrugada passa a aparecer aqui.",
        finishedAt: null,
        finishedAtLabel: null
      };
    }
    return {
      job,
      label: JOB_LABEL[job],
      ok: row2.ok,
      summary: row2.summary || (row2.ok ? "Conclu\xEDda com sucesso." : "A rotina falhou."),
      finishedAt: row2.finishedAt ? new Date(row2.finishedAt).toISOString() : null,
      finishedAtLabel: formatLiveErrorWhen(row2.finishedAt)
    };
  });
}
function githubHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "gondup-live-errors"
  };
}
async function findOpenGithubIssue(sentryIssueId) {
  const token = githubToken();
  if (!token) return null;
  const url = `https://api.github.com/repos/${GITHUB_REPO}/issues?state=open&labels=${encodeURIComponent(GITHUB_LABEL)}&per_page=50`;
  const result = await fetchJson(url, { headers: githubHeaders(token) });
  if (!result.ok || !Array.isArray(result.body)) return null;
  const marker = ISSUE_MARKER(sentryIssueId);
  const found = result.body.find((issue) => (issue.body || "").includes(marker));
  if (!found) return null;
  return { number: found.number, url: found.html_url };
}
async function ensureGithubLabel(token) {
  const result = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/labels/${encodeURIComponent(GITHUB_LABEL)}`, { headers: githubHeaders(token) });
  if (result.ok) return;
  await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/labels`, {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ name: GITHUB_LABEL, color: "B45309", description: "Erro ao vivo no painel do GondUp" })
  }).catch(() => void 0);
}
function issueBody(card) {
  return [
    "## Resumo",
    card.title,
    "",
    card.actionReason,
    "",
    `- Tela: ${card.place}`,
    `- Vezes nas \xFAltimas 24h: ${card.count24h}`,
    `- Vezes nos \xFAltimos 7 dias: ${card.count7d}`,
    `- Usu\xE1rios afetados: ${card.userCount}`,
    `- Primeira vez: ${card.firstSeenLabel}`,
    `- \xDAltima vez: ${card.lastSeenLabel}`,
    card.sentryUrl ? `- Sentry: ${card.sentryUrl}` : "- Sentry: link indispon\xEDvel",
    "",
    "## Detalhes t\xE9cnicos",
    "```",
    card.technical,
    "```",
    "",
    "Este chamado foi aberto pelo painel Erros ao vivo. Ele n\xE3o altera o c\xF3digo automaticamente \u2014 \xE9 s\xF3 o pedido de corre\xE7\xE3o.",
    "",
    ISSUE_MARKER(card.id)
  ].join("\n");
}
var SENTRY_HOST, SENTRY_ORG, SENTRY_PROJECT, GITHUB_REPO, GITHUB_LABEL, ISSUE_MARKER, SCHEDULED_JOBS, JOB_LABEL, liveErrorsRouter;
var init_liveErrors = __esm({
  "server/liveErrors.ts"() {
    "use strict";
    init_trpc();
    init_storage();
    init_backup();
    init_liveErrorCopy();
    init_liveErrorStore();
    SENTRY_HOST = (process.env.SENTRY_HOST || "https://sentry.io").replace(/\/$/, "");
    SENTRY_ORG = process.env.SENTRY_ORG || "ivanmh";
    SENTRY_PROJECT = process.env.SENTRY_PROJECT || "gondup";
    GITHUB_REPO = process.env.GITHUB_ISSUES_REPO || "IvanMHonemann/promotores-saas";
    GITHUB_LABEL = "erro-ao-vivo";
    ISSUE_MARKER = (id3) => `<!-- sentry-issue: ${id3} -->`;
    SCHEDULED_JOBS = ["database-backup", "database-maintenance", "archive-timesheets"];
    JOB_LABEL = {
      "database-backup": "Backup do banco",
      "database-maintenance": "Manuten\xE7\xE3o da madrugada",
      "archive-timesheets": "Arquivamento dos espelhos"
    };
    liveErrorsRouter = router({
      overview: platformProcedure.query(async () => {
        await ensureLiveErrorTables();
        const [errors, backup, jobs] = await Promise.all([loadErrorCards(), readBackup(), readJobs()]);
        const needsFix = errors.cards.filter((card) => card.action === "needs_fix");
        const expected = errors.cards.filter((card) => card.action === "expected");
        const needsFix24h = needsFix.filter((card) => card.count24h > 0).length;
        const grave24h = needsFix.filter((card) => card.count24h > 0 && card.severity === "grave").length;
        const expected24h = expected.filter((card) => card.count24h > 0).length;
        return {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          headline: liveErrorsHeadline({ needsFix24h, grave24h, expected24h }),
          needsFix24h,
          grave24h,
          expected24h,
          expectedTotal: expected.length,
          sentry: {
            configured: errors.sentryConfigured,
            error: errors.sentryError,
            pendingMessage: errors.sentryConfigured ? null : "Conex\xE3o com o Sentry pendente. Sem o token de leitura, a lista de erros dos usu\xE1rios n\xE3o aparece. O restante do painel funciona normalmente."
          },
          github: {
            configured: Boolean(githubToken()),
            pendingMessage: githubToken() ? null : "Conex\xE3o com o GitHub pendente"
          },
          needsFix,
          expected,
          health: {
            backup,
            jobs,
            version: readVersion(),
            memory: readMemory(),
            disk: readDisk(),
            logs: {
              available: false,
              message: "Os erros dos usu\xE1rios aparecem na lista acima. O arquivo de log do servidor n\xE3o est\xE1 acess\xEDvel de dentro do aplicativo."
            }
          }
        };
      }),
      requestFix: platformProcedure.input(z12.object({ sentryIssueId: z12.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
        if (input.sentryIssueId === "sw-noise") {
          throw new TRPCError19({ code: "BAD_REQUEST", message: "Este agrupamento \xE9 ru\xEDdo esperado e n\xE3o vira pedido de corre\xE7\xE3o." });
        }
        if (!githubToken()) {
          throw new TRPCError19({ code: "PRECONDITION_FAILED", message: "Conex\xE3o com o GitHub pendente." });
        }
        if (!sentryToken()) {
          throw new TRPCError19({ code: "PRECONDITION_FAILED", message: "Conex\xE3o com o Sentry pendente." });
        }
        await ensureLiveErrorTables();
        const existing = (await listLiveErrorOverrides()).find((row2) => row2.sentryIssueId === input.sentryIssueId && row2.githubIssueUrl);
        if (existing?.githubIssueUrl) {
          const open2 = await findOpenGithubIssue(input.sentryIssueId);
          if (open2 || existing.githubIssueUrl) {
            return { alreadyOpen: true, url: open2?.url || existing.githubIssueUrl, number: open2?.number || existing.githubIssueNumber };
          }
        }
        const open = await findOpenGithubIssue(input.sentryIssueId);
        if (open) {
          await upsertLiveErrorOverride({
            sentryIssueId: input.sentryIssueId,
            classification: "needs_fix",
            githubIssueNumber: open.number,
            githubIssueUrl: open.url,
            updatedBy: actorOf(ctx)
          });
          return { alreadyOpen: true, url: open.url, number: open.number };
        }
        const issue = await fetchSentryIssue(input.sentryIssueId);
        if (!issue) throw new TRPCError19({ code: "NOT_FOUND", message: "N\xE3o encontrei esse erro no Sentry." });
        const override = (await listLiveErrorOverrides()).find((row2) => row2.sentryIssueId === input.sentryIssueId);
        const card = toCard(issue, override);
        const token = githubToken();
        await ensureGithubLabel(token);
        const title = `[Erros ao vivo] ${card.title} \u2014 ${card.place}`.slice(0, 120);
        const created = await fetchJson(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
          method: "POST",
          headers: { ...githubHeaders(token), "Content-Type": "application/json" },
          body: JSON.stringify({ title, body: issueBody(card), labels: [GITHUB_LABEL] })
        });
        if (!created.ok || !created.body?.html_url) {
          throw new TRPCError19({ code: "BAD_GATEWAY", message: "N\xE3o foi poss\xEDvel criar a issue no GitHub agora." });
        }
        await upsertLiveErrorOverride({
          sentryIssueId: input.sentryIssueId,
          classification: "needs_fix",
          githubIssueNumber: created.body.number,
          githubIssueUrl: created.body.html_url,
          updatedBy: actorOf(ctx)
        });
        return { alreadyOpen: false, url: created.body.html_url, number: created.body.number };
      }),
      markNormal: platformProcedure.input(z12.object({ sentryIssueId: z12.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
        if (input.sentryIssueId === "sw-noise") {
          return { ok: true, sentryIgnored: false };
        }
        await ensureLiveErrorTables();
        const sentryIgnored = await setSentryIssueStatus(input.sentryIssueId, "ignored").catch(() => false);
        await upsertLiveErrorOverride({
          sentryIssueId: input.sentryIssueId,
          classification: "expected",
          sentryIgnored,
          updatedBy: actorOf(ctx)
        });
        return { ok: true, sentryIgnored };
      }),
      unmarkNormal: platformProcedure.input(z12.object({ sentryIssueId: z12.string().trim().min(1).max(64) })).mutation(async ({ ctx, input }) => {
        await ensureLiveErrorTables();
        const current = (await listLiveErrorOverrides()).find((row2) => row2.sentryIssueId === input.sentryIssueId);
        if (current?.sentryIgnored) {
          await setSentryIssueStatus(input.sentryIssueId, "unresolved").catch(() => false);
        }
        await upsertLiveErrorOverride({
          sentryIssueId: input.sentryIssueId,
          classification: "needs_fix",
          sentryIgnored: false,
          githubIssueNumber: current?.githubIssueNumber ?? null,
          githubIssueUrl: current?.githubIssueUrl ?? null,
          updatedBy: actorOf(ctx)
        });
        return { ok: true };
      })
    });
  }
});

// shared/facadePhotos.ts
function isFacadePhotoKey(key) {
  return typeof key === "string" && FACADE_KEY_PREFIXES.some((p) => key.startsWith(p));
}
function facadePhotoAction(key) {
  if (!isFacadePhotoKey(key)) return null;
  const m = /^(?:ci|visit)-\d+-(start|complete)-/.exec(String(key));
  return m ? m[1] : null;
}
var FACADE_KEY_PREFIXES;
var init_facadePhotos = __esm({
  "shared/facadePhotos.ts"() {
    "use strict";
    FACADE_KEY_PREFIXES = ["ci-", "visit-"];
  }
});

// server/_core/rateLimit.ts
function checkRateLimit(key, bucket = "api") {
  const limit = LIMITS[bucket] || LIMITS.api;
  const now = Date.now();
  const fullKey = `${bucket}:${key}`;
  let entry = buckets.get(fullKey);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + limit.windowMs };
    buckets.set(fullKey, entry);
  }
  entry.count++;
  if (buckets.size > 1e4) {
    for (const [k, v] of buckets) {
      if (v.resetAt < now) buckets.delete(k);
    }
  }
  return {
    ok: entry.count <= limit.max,
    remaining: Math.max(0, limit.max - entry.count),
    resetAt: entry.resetAt
  };
}
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}
var buckets, LIMITS;
var init_rateLimit = __esm({
  "server/_core/rateLimit.ts"() {
    "use strict";
    buckets = /* @__PURE__ */ new Map();
    LIMITS = {
      login: { max: 5, windowMs: 6e4 },
      // 5 tentativas por minuto
      api: { max: 100, windowMs: 6e4 },
      // 100 req/min geral
      upload: { max: 10, windowMs: 6e4 }
      // 10 uploads/min
    };
  }
});

// server/storeClients.ts
import { sql as sql21 } from "drizzle-orm";
function ensureStoreClientsSchema(db) {
  if (!ensured3) {
    ensured3 = (async () => {
      await db.execute(sql21.raw(`CREATE TABLE IF NOT EXISTS store_clients (
        id int AUTO_INCREMENT NOT NULL,
        companyId int NOT NULL,
        storeId int NOT NULL,
        name varchar(255) NOT NULL,
        contactName varchar(255) NULL,
        phone varchar(50) NULL,
        notes text NULL,
        active boolean NOT NULL DEFAULT true,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY store_clients_company_store_idx (companyId, storeId)
      )`));
      await db.execute(sql21.raw(`CREATE TABLE IF NOT EXISTS store_photos (
        id int AUTO_INCREMENT NOT NULL,
        companyId int NOT NULL,
        storeId int NOT NULL,
        promoterId int NOT NULL,
        visitId int,
        capturedAt timestamp NOT NULL,
        latitude double,
        longitude double,
        accuracy double,
        locationStatus enum('success','permission_denied','unavailable','timeout','error') DEFAULT 'unavailable',
        fileKey varchar(512) NOT NULL,
        thumbnailKey varchar(512),
        mimeType varchar(100),
        fileSize int,
        idempotencyKey varchar(64),
        uploadStatus enum('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
        expiresAt timestamp NOT NULL,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
        KEY store_photos_company_promoter_idx (companyId,promoterId),
        KEY store_photos_expires_idx (expiresAt),
        UNIQUE KEY store_photos_company_idempotency_unique (companyId,idempotencyKey)
      )`));
      const res = await db.execute(sql21`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_photos' AND COLUMN_NAME = 'storeClientId'`);
      const first = Array.isArray(res?.[0]) ? res[0][0] : Array.isArray(res) ? res[0] : res?.rows?.[0];
      if (Number(first?.n ?? 0) === 0) {
        await db.execute(sql21.raw(`ALTER TABLE store_photos ADD COLUMN storeClientId int NULL`));
        try {
          await db.execute(sql21.raw(`CREATE INDEX store_photos_client_idx ON store_photos (companyId, storeClientId)`));
        } catch {
        }
      }
    })().catch((err) => {
      ensured3 = null;
      throw err;
    });
  }
  return ensured3;
}
var ensured3;
var init_storeClients = __esm({
  "server/storeClients.ts"() {
    "use strict";
    ensured3 = null;
  }
});

// server/modules/storePhotos.ts
var storePhotos_exports = {};
__export(storePhotos_exports, {
  detectImageMime: () => detectImageMime,
  expireOldStorePhotos: () => expireOldStorePhotos,
  storePhotosRouter: () => storePhotosRouter
});
import { z as z13 } from "zod";
import { and as and20, desc as desc6, eq as eq21, gte as gte11, lte as lte7, sql as sql22 } from "drizzle-orm";
import { TRPCError as TRPCError20 } from "@trpc/server";
async function moveStorePhotosToTrash(db, accountId, photos, actor) {
  if (photos.length === 0) return;
  await ensureTrashTable();
  const storeIds = Array.from(new Set(photos.map((p) => p.storeId)));
  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(and20(eq21(stores.companyId, accountId), sql22`${stores.id} IN (${sql22.join(storeIds.map((id3) => sql22`${id3}`), sql22`, `)})`));
  const storeName = new Map(storeRows.map((r) => [r.id, r.name]));
  const clientOf = /* @__PURE__ */ new Map();
  try {
    await ensureStoreClientsSchema(db);
    const res = await db.execute(sql22`SELECT id, storeClientId FROM store_photos WHERE companyId = ${accountId} AND id IN (${sql22.join(photos.map((p) => sql22`${p.id}`), sql22`, `)})`);
    for (const r of Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? []) clientOf.set(Number(r.id), r.storeClientId == null ? null : Number(r.storeClientId));
  } catch {
  }
  const expiresAt = new Date(Date.now() + TRASH_DAYS * 24 * 60 * 60 * 1e3);
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values(
      photos.map((photo) => ({
        accountId,
        deletedByMemberId: actor?.memberId ?? null,
        deletedByName: actor?.name ?? null,
        ownerMemberId: photo.promoterId ?? null,
        itemType: "store_photo",
        originalId: photo.id,
        label: `Foto - ${storeName.get(photo.storeId || 0) || "Loja"} - ${new Date(photo.capturedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}`.slice(0, 255),
        snapshot: JSON.stringify({ ...photo, storeClientId: clientOf.get(photo.id) ?? null }),
        expiresAt
      }))
    );
    await tx.delete(storePhotos).where(and20(eq21(storePhotos.companyId, accountId), sql22`${storePhotos.id} IN (${sql22.join(photos.map((p) => sql22`${p.id}`), sql22`, `)})`));
  });
}
function ensureStorePhotosTable(db) {
  if (!storePhotosTableReady) {
    storePhotosTableReady = createStorePhotosTable(db).catch((err) => {
      storePhotosTableReady = null;
      throw err;
    });
  }
  return storePhotosTableReady;
}
async function createStorePhotosTable(db) {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS store_photos (
      id int AUTO_INCREMENT NOT NULL,
      companyId int NOT NULL,
      storeId int,
      promoterId int NOT NULL,
      visitId int,
      capturedAt timestamp NOT NULL,
      latitude double,
      longitude double,
      accuracy double,
      locationStatus enum('success','permission_denied','unavailable','timeout','error') DEFAULT 'unavailable',
      fileKey varchar(512) NOT NULL,
      thumbnailKey varchar(512),
      mimeType varchar(100),
      fileSize int,
      idempotencyKey varchar(64),
      uploadStatus enum('pending','uploaded','failed') NOT NULL DEFAULT 'pending',
      expiresAt timestamp NOT NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
      KEY store_photos_company_store_date_idx (companyId,storeId,capturedAt),
      KEY store_photos_company_promoter_idx (companyId,promoterId),
      KEY store_photos_expires_idx (expiresAt),
      UNIQUE KEY store_photos_company_idempotency_unique (companyId,idempotencyKey)
    )`);
  } catch (e) {
    console.warn("[storePhotos] ensure table", e);
  }
  try {
    await db.execute(`ALTER TABLE store_photos MODIFY storeId int NULL`);
  } catch (e) {
  }
}
async function assertStoreClient(db, companyId, storeId, storeClientId) {
  await ensureStoreClientsSchema(db);
  const res = await db.execute(sql22`SELECT id, active FROM store_clients WHERE id = ${storeClientId} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`);
  const r = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0];
  if (!r) throw new TRPCError20({ code: "BAD_REQUEST", message: "Cliente n\xE3o encontrado nesta loja." });
  if (!r.active) throw new TRPCError20({ code: "BAD_REQUEST", message: "Este cliente foi removido da loja." });
}
async function linkPhotoToClient(db, companyId, photoId, storeClientId) {
  await db.execute(sql22`UPDATE store_photos SET storeClientId = ${storeClientId} WHERE id = ${photoId} AND companyId = ${companyId}`);
}
async function expireOldStorePhotos() {
  const db = await getDb();
  if (!db) return { deleted: 0, errors: 0 };
  const now = /* @__PURE__ */ new Date();
  const expired = await db.select().from(storePhotos).where(lte7(storePhotos.expiresAt, now)).limit(200);
  if (expired.length === 0) return { deleted: 0, errors: 0 };
  const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let deleted = 0;
  let errors = 0;
  for (const photo of expired) {
    try {
      if (photo.fileKey) await guardedStorageDelete(storageDelete2, photo.fileKey, photo.companyId);
      if (photo.thumbnailKey) await guardedStorageDelete(storageDelete2, photo.thumbnailKey, photo.companyId);
      await db.delete(storePhotos).where(eq21(storePhotos.id, photo.id));
      deleted++;
    } catch {
      errors++;
    }
  }
  return { deleted, errors };
}
var RETENTION_DAYS, TRASH_DAYS, storePhotosTableReady, GALLERY_ONLY, storePhotosRouter;
var init_storePhotos = __esm({
  "server/modules/storePhotos.ts"() {
    "use strict";
    init_mediaKeys();
    init_facadePhotos();
    init_uploadLimits();
    init_schema();
    init_schema_original();
    init_db();
    init_trpc();
    init_rateLimit();
    init_audit();
    init_storeClients();
    init_storeAccess();
    RETENTION_DAYS = 60;
    TRASH_DAYS = 5;
    storePhotosTableReady = null;
    GALLERY_ONLY = sql22`(store_photos.idempotencyKey IS NULL OR (store_photos.idempotencyKey NOT LIKE 'ci-%' AND store_photos.idempotencyKey NOT LIKE 'visit-%'))`;
    storePhotosRouter = router({
      /** Lista lojas com contagem de fotos e última atividade. */
      listStoresWithStats: commercialFeatureProcedure("fieldOperations").input(z13.object({ search: z13.string().optional(), city: z13.string().optional() }).optional()).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq21(stores.companyId, ctx.accountId), eq21(stores.active, true)];
        if (memberId !== null) {
          await ensurePromoterStoreAssignmentsTable(db);
          conditions.push(storeVisibleToMember(stores.id, memberId));
        }
        const ownPhotos = memberId !== null ? sql22` AND store_photos.promoterId = ${memberId}` : sql22``;
        if (input?.search) {
          conditions.push(sql22`${stores.name} LIKE ${`%${input.search}%`}`);
        }
        if (input?.city) {
          conditions.push(eq21(stores.city, input.city));
        }
        try {
          const rows4 = await db.select({
            id: stores.id,
            name: stores.name,
            city: stores.city,
            state: stores.state,
            address: stores.address,
            latitude: stores.latitude,
            longitude: stores.longitude,
            photoCount: sql22`(SELECT COUNT(*) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND store_photos.uploadStatus = 'uploaded' AND ${GALLERY_ONLY}${ownPhotos})`,
            lastActivity: sql22`(SELECT MAX(capturedAt) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND ${GALLERY_ONLY}${ownPhotos})`
          }).from(stores).where(and20(...conditions)).orderBy(desc6(stores.updatedAt));
          return rows4;
        } catch (err) {
          if (String(err?.message || "").includes("store_photos") || err?.code === "ER_NO_SUCH_TABLE") {
            const rows4 = await db.select({ id: stores.id, name: stores.name, city: stores.city, state: stores.state, address: stores.address, latitude: stores.latitude, longitude: stores.longitude }).from(stores).where(and20(...conditions)).orderBy(desc6(stores.updatedAt));
            return rows4.map((r) => ({ ...r, photoCount: 0, lastActivity: null }));
          }
          throw err;
        }
      }),
      /** Conta fotos registradas sem loja (para o card da lista). */
      countWithoutStore: commercialFeatureProcedure("fieldOperations").query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return { count: 0, lastActivity: null };
        await ensureStorePhotosTable(db);
        const memberId = scopeMemberId(ctx);
        const own = memberId !== null ? sql22` AND promoterId = ${memberId}` : sql22``;
        const res = await db.execute(sql22`SELECT COUNT(*) AS c, MAX(capturedAt) AS lastAt FROM store_photos WHERE companyId = ${ctx.accountId} AND storeId IS NULL AND uploadStatus = 'uploaded' AND ${GALLERY_ONLY}${own}`);
        const row2 = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0] ?? {};
        return { count: Number(row2.c ?? 0), lastActivity: row2.lastAt ?? null };
      }),
      /** Lista fotos de uma loja, agrupáveis por data no cliente. */
      listByStore: commercialFeatureProcedure("fieldOperations").input(z13.object({
        storeId: z13.number().int().positive().optional().nullable(),
        from: z13.string().optional(),
        to: z13.string().optional(),
        promoterId: z13.number().int().positive().optional(),
        storeClientId: z13.number().int().positive().optional(),
        withoutClient: z13.boolean().optional()
      })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq21(storePhotos.companyId, ctx.accountId), GALLERY_ONLY];
        if (input.storeId) {
          await assertStoreAccess(db, ctx, input.storeId);
          conditions.push(eq21(storePhotos.storeId, input.storeId));
        } else {
          conditions.push(sql22`store_photos.storeId IS NULL`);
        }
        if (input.storeClientId) conditions.push(sql22`store_photos.storeClientId = ${input.storeClientId}`);
        else if (input.withoutClient) conditions.push(sql22`store_photos.storeClientId IS NULL`);
        if (memberId !== null) conditions.push(eq21(storePhotos.promoterId, memberId));
        if (input.from) conditions.push(gte11(storePhotos.capturedAt, new Date(input.from)));
        if (input.to) conditions.push(lte7(storePhotos.capturedAt, new Date(input.to)));
        if (memberId === null && input.promoterId) conditions.push(eq21(storePhotos.promoterId, input.promoterId));
        const photos = await db.select({
          id: storePhotos.id,
          companyId: storePhotos.companyId,
          storeId: storePhotos.storeId,
          promoterId: storePhotos.promoterId,
          visitId: storePhotos.visitId,
          capturedAt: storePhotos.capturedAt,
          latitude: storePhotos.latitude,
          longitude: storePhotos.longitude,
          accuracy: storePhotos.accuracy,
          locationStatus: storePhotos.locationStatus,
          fileKey: storePhotos.fileKey,
          thumbnailKey: storePhotos.thumbnailKey,
          mimeType: storePhotos.mimeType,
          fileSize: storePhotos.fileSize,
          uploadStatus: storePhotos.uploadStatus,
          expiresAt: storePhotos.expiresAt,
          storeClientId: sql22`store_photos.storeClientId`,
          clientName: sql22`(SELECT name FROM store_clients WHERE store_clients.id = store_photos.storeClientId AND store_clients.companyId = ${ctx.accountId})`,
          promoterName: sql22`(SELECT userName FROM member_accounts WHERE member_accounts.id = store_photos.promoterId AND member_accounts.companyId = ${ctx.accountId})`
        }).from(storePhotos).where(and20(...conditions)).orderBy(desc6(storePhotos.capturedAt));
        return photos;
      }),
      /** Fotos de fachada (check-in/check-out) de uma visita. Ficam só aqui, fora da galeria da loja. */
      listVisitFacade: commercialFeatureProcedure("fieldOperations").input(z13.object({ visitId: z13.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [
          eq21(storePhotos.companyId, ctx.accountId),
          // Fotos antigas (antes de 23/10) podem ter ficado sem visitId: a chave também diz a visita.
          sql22`(${storePhotos.visitId} = ${input.visitId} OR ${storePhotos.idempotencyKey} LIKE ${`ci-${input.visitId}-%`} OR ${storePhotos.idempotencyKey} LIKE ${`visit-${input.visitId}-%`})`,
          eq21(storePhotos.uploadStatus, "uploaded"),
          sql22`NOT ${GALLERY_ONLY}`
        ];
        if (memberId !== null) conditions.push(eq21(storePhotos.promoterId, memberId));
        const rows4 = await db.select({ id: storePhotos.id, visitId: storePhotos.visitId, capturedAt: storePhotos.capturedAt, idempotencyKey: storePhotos.idempotencyKey }).from(storePhotos).where(and20(...conditions)).orderBy(desc6(storePhotos.capturedAt));
        return rows4.map((r) => ({ id: r.id, visitId: r.visitId, capturedAt: r.capturedAt, action: facadePhotoAction(r.idempotencyKey) }));
      }),
      /** Cria registro de foto com idempotência. Upload do arquivo é feito separadamente. */
      create: commercialFeatureProcedure("fieldOperations").input(z13.object({
        storeId: z13.number().int().positive().optional().nullable(),
        visitId: z13.number().int().positive().optional(),
        capturedAt: z13.string(),
        latitude: z13.number().optional(),
        longitude: z13.number().optional(),
        accuracy: z13.number().optional(),
        locationStatus: z13.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        fileKey: z13.string().min(1),
        thumbnailKey: z13.string().optional(),
        mimeType: z13.string().optional(),
        fileSize: z13.number().int().optional(),
        storeClientId: z13.number().int().positive().optional(),
        idempotencyKey: z13.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError20({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        if (!isTenantMediaKey(input.fileKey, ctx.accountId) || input.thumbnailKey && !isTenantMediaKey(input.thumbnailKey, ctx.accountId)) {
          throw new TRPCError20({ code: "BAD_REQUEST", message: "Arquivo da foto inv\xE1lido." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError20({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and20(eq21(storePhotos.companyId, ctx.accountId), eq21(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
        if (existing) return existing;
        const capturedAt = new Date(input.capturedAt);
        const expiresAt = new Date(capturedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1e3);
        const [result] = await db.insert(storePhotos).values({
          companyId: ctx.accountId,
          storeId: input.storeId ?? null,
          promoterId: ctx.memberAccountId,
          visitId: input.visitId ?? null,
          capturedAt,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          accuracy: input.accuracy ?? null,
          locationStatus: input.locationStatus ?? "unavailable",
          fileKey: input.fileKey,
          thumbnailKey: input.thumbnailKey ?? null,
          mimeType: input.mimeType ?? null,
          fileSize: input.fileSize ?? null,
          idempotencyKey: input.idempotencyKey,
          uploadStatus: "uploaded",
          expiresAt
        });
        const photoId = Number(result.insertId);
        if (input.storeClientId) await linkPhotoToClient(db, ctx.accountId, photoId, input.storeClientId);
        await auditFromCtx(ctx, {
          action: "create",
          module: "store_photos",
          entityType: "store_photo",
          entityId: photoId,
          entityLabel: storeName,
          description: `Foto registrada ${input.storeId ? "na loja " + storeName : "sem loja vinculada"}`,
          newData: { storeId: input.storeId ?? null, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude) }
        });
        return { id: photoId, expiresAt };
      }),
      /** Recebe imagem em base64, faz upload no storage e cria o registro (com idempotência). */
      uploadAndCreate: commercialFeatureProcedure("fieldOperations").input(z13.object({
        storeId: z13.number().int().positive().optional().nullable(),
        visitId: z13.number().int().positive().optional(),
        capturedAt: z13.string(),
        latitude: z13.number().optional(),
        longitude: z13.number().optional(),
        accuracy: z13.number().optional(),
        locationStatus: z13.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        // Limite da Vercel: corpo de 4,5 MB; base64 de 4,2 M caracteres ≈ 3,1 MB de imagem.
        imageBase64: z13.string().min(100).max(MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE),
        mimeType: z13.string().max(100).default("image/jpeg"),
        // ignorado: o tipo real é detectado pelo conteúdo
        storeClientId: z13.number().int().positive().optional(),
        idempotencyKey: z13.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError20({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError20({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and20(eq21(storePhotos.companyId, ctx.accountId), eq21(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
        if (existing) return { id: existing.id, alreadyExists: true };
        const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const buffer = Buffer.from(input.imageBase64, "base64");
        const detectedMime = detectImageMime(buffer);
        if (!detectedMime) throw new TRPCError20({ code: "BAD_REQUEST", message: "Arquivo n\xE3o \xE9 uma imagem v\xE1lida (use JPG, PNG ou WebP)." });
        input.mimeType = detectedMime;
        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const relKey = `store-photos/${ctx.accountId}/${safeKeySegment(input.storeId, "sem-loja")}/${safeKeySegment(input.idempotencyKey)}.${ext}`;
        let fileKey;
        try {
          const uploaded = await storagePut2(relKey, buffer, input.mimeType);
          fileKey = uploaded.key;
        } catch (err) {
          throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar a imagem. Verifique a configura\xE7\xE3o de armazenamento." });
        }
        const capturedAt = new Date(input.capturedAt);
        const expiresAt = new Date(capturedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1e3);
        const [result] = await db.insert(storePhotos).values({
          companyId: ctx.accountId,
          storeId: input.storeId ?? null,
          promoterId: ctx.memberAccountId,
          visitId: input.visitId ?? null,
          capturedAt,
          latitude: input.latitude ?? null,
          longitude: input.longitude ?? null,
          accuracy: input.accuracy ?? null,
          locationStatus: input.locationStatus ?? "unavailable",
          fileKey,
          mimeType: input.mimeType,
          fileSize: buffer.length,
          idempotencyKey: input.idempotencyKey,
          uploadStatus: "uploaded",
          expiresAt
        });
        const photoId = Number(result.insertId);
        if (input.storeClientId) await linkPhotoToClient(db, ctx.accountId, photoId, input.storeClientId);
        await auditFromCtx(ctx, {
          action: "create",
          module: "store_photos",
          entityType: "store_photo",
          entityId: photoId,
          entityLabel: storeName,
          description: `Foto registrada ${input.storeId ? "na loja " + storeName : "sem loja vinculada"}`,
          newData: { storeId: input.storeId ?? null, capturedAt: input.capturedAt, hasGps: Boolean(input.latitude), fileSize: buffer.length }
        });
        return { id: photoId, expiresAt, alreadyExists: false };
      }),
      /** Retorna URL assinada temporária para visualizar uma foto. */
      getImageUrl: commercialFeatureProcedure("fieldOperations").input(z13.object({ photoId: z13.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and20(eq21(storePhotos.id, input.photoId), eq21(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError20({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        if (!isTenantMediaKey(photo.fileKey, ctx.accountId)) throw new TRPCError20({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageGetSignedUrl: storageGetSignedUrl2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const url = await storageGetSignedUrl2(photo.fileKey);
        return { url, expiresIn: 3600 };
      }),
      /** Retorna a imagem como base64 para compartilhamento sem CORS. */
      getImageData: commercialFeatureProcedure("fieldOperations").input(z13.object({ photoId: z13.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and20(eq21(storePhotos.id, input.photoId), eq21(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError20({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        if (!isTenantMediaKey(photo.fileKey, ctx.accountId)) throw new TRPCError20({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageRead: storageRead2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        try {
          const image = await storageRead2(photo.fileKey);
          return { base64: image.data.toString("base64"), mime: image.contentType || photo.mimeType || "image/jpeg" };
        } catch {
          throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel obter a imagem armazenada." });
        }
      }),
      /** Exclui uma foto (com auditoria). */
      delete: commercialFeatureProcedure("fieldOperations").input(z13.object({ photoId: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and20(eq21(storePhotos.id, input.photoId), eq21(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError20({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        if (scopeMemberId(ctx) !== null && photo.promoterId !== ctx.memberAccountId) {
          throw new TRPCError20({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        }
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, [photo], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.delete] falha ao enviar para a lixeira", error);
          throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar a foto para a lixeira." });
        }
        await auditFromCtx(ctx, {
          action: "delete",
          module: "store_photos",
          entityType: "store_photo",
          entityId: photo.id,
          entityLabel: `Foto #${photo.id}`,
          description: "Foto enviada para a lixeira",
          oldData: { storeId: photo.storeId, capturedAt: photo.capturedAt }
        });
        return { ok: true };
      }),
      /** Exclui várias fotos de uma vez. */
      bulkDelete: commercialFeatureProcedure("fieldOperations").input(z13.object({ photoIds: z13.array(z13.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const photos = await db.select().from(storePhotos).where(and20(eq21(storePhotos.companyId, ctx.accountId), sql22`${storePhotos.id} IN (${sql22.join(input.photoIds.map((id3) => sql22`${id3}`), sql22`, `)})`));
        if (photos.length === 0) return { deleted: 0 };
        const memberId = scopeMemberId(ctx);
        const allowed = photos.filter((photo) => memberId === null || photo.promoterId === memberId);
        if (allowed.length === 0) throw new TRPCError20({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, allowed, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.bulkDelete] falha ao enviar para a lixeira", error);
          throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar as fotos para a lixeira." });
        }
        const deleted = allowed.length;
        await auditFromCtx(ctx, {
          action: "delete",
          module: "store_photos",
          entityType: "store_photo",
          description: `${deleted} foto(s) enviada(s) para a lixeira em massa`,
          newData: { count: deleted }
        });
        return { deleted };
      }),
      /** Move fotos já tiradas para um cliente da mesma loja (ou tira o vínculo com `storeClientId: null`). */
      assignClient: commercialFeatureProcedure("fieldOperations").input(z13.object({
        storeId: z13.number().int().positive().optional().nullable(),
        photoIds: z13.array(z13.number().int().positive()).min(1).max(200),
        storeClientId: z13.number().int().positive().nullable()
      })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError20({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = input.storeId != null ? await assertStoreAccess(db, ctx, input.storeId) : null;
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        let clientName = "Sem cliente";
        if (input.storeClientId && input.storeId != null) {
          await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
          const res2 = await db.execute(sql22`SELECT name FROM store_clients WHERE id = ${input.storeClientId} AND companyId = ${ctx.accountId} LIMIT 1`);
          clientName = (Array.isArray(res2?.[0]) ? res2[0] : Array.isArray(res2) ? res2 : res2?.rows ?? [])[0]?.name ?? clientName;
        }
        const memberId = scopeMemberId(ctx);
        const owner = memberId !== null ? sql22` AND promoterId = ${memberId}` : sql22``;
        const ids = sql22.join(input.photoIds.map((id3) => sql22`${id3}`), sql22`, `);
        const res = await db.execute(sql22`UPDATE store_photos SET storeClientId = ${input.storeClientId} WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND id IN (${ids})${owner}`);
        const moved = Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0);
        if (moved === 0) throw new TRPCError20({ code: "FORBIDDEN", message: "Nenhuma das fotos selecionadas p\xF4de ser movida (s\xF3 \xE9 poss\xEDvel mover as suas pr\xF3prias fotos desta loja)." });
        await auditFromCtx(ctx, {
          action: "update",
          module: "store_photos",
          entityType: "store_photo",
          description: `${moved} foto(s) da loja ${store?.name || "Sem loja"} movida(s) para: ${clientName}`,
          newData: { storeId: input.storeId ?? null, storeClientId: input.storeClientId, count: moved }
        });
        return { moved };
      })
    });
  }
});

// server/modules/storeClients.ts
import { z as z14 } from "zod";
import { TRPCError as TRPCError21 } from "@trpc/server";
import { sql as sql23 } from "drizzle-orm";
async function loadClient(db, companyId, storeId, id3) {
  const r = rows3(await db.execute(sql23`SELECT * FROM store_clients WHERE id = ${id3} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`));
  if (!r[0]) throw new TRPCError21({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado nesta loja." });
  return r[0];
}
var rows3, text3, storeClientsRouter;
var init_storeClients2 = __esm({
  "server/modules/storeClients.ts"() {
    "use strict";
    init_db();
    init_trpc();
    init_audit();
    init_storeAccess();
    init_storeClients();
    rows3 = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
    text3 = (max) => z14.string().trim().max(max).optional().transform((v) => v ? v : null);
    storeClientsRouter = router({
      /** Clientes de uma loja, com a quantidade de fotos (o promotor conta só as próprias). */
      list: commercialFeatureProcedure("fieldOperations").input(z14.object({ storeId: z14.number().int().positive(), includeInactive: z14.boolean().optional() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError21({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await assertStoreAccess(db, ctx, input.storeId);
        await ensureStoreClientsSchema(db);
        const memberId = scopeMemberId(ctx);
        const own = memberId !== null ? sql23` AND p.promoterId = ${memberId}` : sql23``;
        const r = rows3(await db.execute(sql23`
        SELECT c.id, c.storeId, c.name, c.contactName, c.phone, c.notes, c.active,
          (SELECT COUNT(*) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id AND p.uploadStatus = 'uploaded'${own}) AS photoCount,
          (SELECT MAX(p.capturedAt) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id${own}) AS lastActivity
        FROM store_clients c
        WHERE c.companyId = ${ctx.accountId} AND c.storeId = ${input.storeId}${input.includeInactive ? sql23`` : sql23` AND c.active = true`}
        ORDER BY c.name ASC`));
        return r.map((c) => ({ ...c, active: Boolean(c.active), photoCount: Number(c.photoCount ?? 0) }));
      }),
      create: commercialFeatureProcedure("fieldOperations").input(z14.object({ storeId: z14.number().int().positive(), name: z14.string().trim().min(2, "Informe o nome do cliente.").max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError21({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = await assertStoreAccess(db, ctx, input.storeId);
        await ensureStoreClientsSchema(db);
        const dup = rows3(await db.execute(sql23`SELECT id FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true AND LOWER(name) = ${input.name.toLowerCase()} LIMIT 1`));
        if (dup[0]) throw new TRPCError21({ code: "CONFLICT", message: "Esta loja j\xE1 tem um cliente com esse nome." });
        const res = await db.execute(sql23`INSERT INTO store_clients (companyId, storeId, name, contactName, phone, notes) VALUES (${ctx.accountId}, ${input.storeId}, ${input.name}, ${input.contactName}, ${input.phone}, ${input.notes})`);
        const id3 = Number((Array.isArray(res) ? res[0] : res)?.insertId);
        await auditFromCtx(ctx, { action: "create", module: "store_clients", entityType: "store_client", entityId: id3, entityLabel: input.name, description: `Cliente ${input.name} cadastrado na loja ${store.name}`, newData: { storeId: input.storeId, name: input.name } });
        return { id: id3 };
      }),
      update: commercialFeatureProcedure("fieldOperations").input(z14.object({ storeId: z14.number().int().positive(), id: z14.number().int().positive(), name: z14.string().trim().min(2).max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError21({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = await assertStoreAccess(db, ctx, input.storeId);
        await ensureStoreClientsSchema(db);
        const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
        await db.execute(sql23`UPDATE store_clients SET name = ${input.name}, contactName = ${input.contactName}, phone = ${input.phone}, notes = ${input.notes} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
        await auditFromCtx(ctx, { action: "update", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: input.name, description: `Cliente ${old.name} atualizado na loja ${store.name}`, oldData: { name: old.name, phone: old.phone }, newData: { name: input.name, phone: input.phone } });
        return { id: input.id };
      }),
      /** Remover = desativar: as fotos já tiradas continuam ligadas ao cliente na galeria. */
      setActive: commercialFeatureProcedure("fieldOperations").input(z14.object({ storeId: z14.number().int().positive(), id: z14.number().int().positive(), active: z14.boolean() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError21({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = await assertStoreAccess(db, ctx, input.storeId);
        await ensureStoreClientsSchema(db);
        const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
        await db.execute(sql23`UPDATE store_clients SET active = ${input.active} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
        await auditFromCtx(ctx, { action: input.active ? "update" : "delete", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: old.name, description: `Cliente ${old.name} ${input.active ? "reativado" : "removido"} da loja ${store.name}` });
        return { id: input.id, active: input.active };
      })
    });
  }
});

// shared/products.ts
function normalizeAlertDays(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : DEFAULT_ALERT_DAYS;
}
function canManageProduct(role, memberId, createdByMemberId) {
  if (role === "company_admin" || role === "supervisor") return true;
  return memberId != null && createdByMemberId != null && Number(memberId) === Number(createdByMemberId);
}
function normalizeLot(lot) {
  const v = String(lot ?? "").trim().toUpperCase();
  return v ? v.slice(0, 64) : null;
}
function isPlausibleExpiry(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 2e3 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
function formatDateBR(iso) {
  if (!iso) return "";
  const s = typeof iso === "string" ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
}
function situationLabel2(iso, today, alertDays) {
  const st = expiryStatus(iso, today, alertDays);
  if (st === "expired") return "Vencido";
  if (st === "near") {
    const n = daysUntil(iso, today);
    return n === 0 ? "Vence hoje" : `Vence em ${n} dia(s)`;
  }
  return "Em dia";
}
function storeLabel(row2) {
  if (!row2.storeId) return "Sem loja";
  if (!row2.storeName || row2.storeActive === false) return row2.storeName ? `${row2.storeName} (loja removida)` : "Loja removida";
  return row2.storeName;
}
function productsCsv(rows4, today, alertDays) {
  const header = ["Marca/Cliente", "Loja", "C\xF3digo", "Descri\xE7\xE3o", "Lote", "Quantidade", "Validade", "Situa\xE7\xE3o", "Pre\xE7o (R$)", "Cadastrado por"];
  const lines = rows4.map((p) => {
    const iso = String(p.expirationDate).slice(0, 10);
    return [p.clientName || "Sem marca/cliente", storeLabel(p), p.productCode, p.description, p.lot || "", String(p.quantity), formatDateBR(iso), situationLabel2(iso, today, alertDays), Number(p.price).toFixed(2).replace(".", ","), p.createdByName || ""];
  });
  return "\uFEFF" + [header, ...lines].map((r) => r.map(cell).join(";")).join("\r\n");
}
var PRODUCTS_ALERT_DAYS_KEY, DEFAULT_ALERT_DAYS, PRODUCTS_PAGE_SIZE, PRODUCTS_EXPORT_LIMIT, cell;
var init_products = __esm({
  "shared/products.ts"() {
    "use strict";
    init_csv();
    init_expiry();
    PRODUCTS_ALERT_DAYS_KEY = "products_alert_days";
    DEFAULT_ALERT_DAYS = 30;
    PRODUCTS_PAGE_SIZE = 30;
    PRODUCTS_EXPORT_LIMIT = 1e4;
    cell = (v) => `"${neutralizeCsvFormula(v).replace(/"/g, '""')}"`;
  }
});

// shared/barcode.ts
function barcodeVariants(code) {
  const d = onlyDigits2(code);
  if (!d) return [];
  const set = /* @__PURE__ */ new Set([d]);
  const stripped = d.replace(/^0+/, "");
  for (const len of [8, 12, 13, 14]) if (stripped.length <= len) set.add(stripped.padStart(len, "0"));
  return [...set].filter((v) => v.length >= 8);
}
var onlyDigits2;
var init_barcode = __esm({
  "shared/barcode.ts"() {
    "use strict";
    onlyDigits2 = (code) => String(code ?? "").replace(/\D/g, "");
  }
});

// server/productLookup.ts
var productLookup_exports = {};
__export(productLookup_exports, {
  lookupProductByCode: () => lookupProductByCode
});
import { and as and21, desc as desc7, eq as eq22, inArray as inArray17 } from "drizzle-orm";
async function fetchJson2(url, init2 = {}, ms2 = 4e3) {
  const ctl = new AbortController();
  const t2 = setTimeout(() => ctl.abort(), ms2);
  try {
    const r = await fetch(url, { ...init2, signal: ctl.signal, headers: { "User-Agent": "PromotoresSaaS/1.0 (consulta de codigo de barras)", Accept: "application/json", ...init2.headers || {} } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t2);
  }
}
function describe(p) {
  const name = p?.product_name_pt || p?.product_name || p?.generic_name_pt || p?.generic_name || p?.product_name_en || "";
  if (!name) return "";
  const brand = String(p?.brands || "").split(",")[0]?.trim();
  const qty = p?.quantity ? ` ${p.quantity}` : "";
  const base = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} \u2014 ${brand}` : name;
  return `${base}${qty}`.slice(0, 500);
}
async function lookupProductByCode(companyId, rawCode) {
  const variants = barcodeVariants(rawCode);
  const code = variants[0] ?? rawCode.trim();
  const database2 = await getDb();
  if (database2) {
    await ensureInventoryProductsSchema();
    const codes = [.../* @__PURE__ */ new Set([rawCode.trim(), ...variants])];
    const rows4 = await database2.select({ description: inventoryProducts.description, price: inventoryProducts.price, productCode: inventoryProducts.productCode }).from(inventoryProducts).where(and21(eq22(inventoryProducts.companyId, companyId), inArray17(inventoryProducts.productCode, codes))).orderBy(desc7(inventoryProducts.id)).limit(1);
    if (rows4[0]) return { found: true, source: "company", description: rows4[0].description, price: String(rows4[0].price), code: rows4[0].productCode };
  }
  if (!variants.length) return { found: false, source: null, description: "", code };
  const token = process.env.COSMOS_API_TOKEN;
  if (token) {
    for (const v of variants) {
      const data = await fetchJson2(`https://api.cosmos.bluesoft.com.br/gtins/${v}.json`, { headers: { "X-Cosmos-Token": token } });
      if (data?.description) return { found: true, source: "cosmos", description: String(data.description).slice(0, 500), price: data.avg_price ? Number(data.avg_price).toFixed(2) : null, code: v };
    }
  }
  const tasks = OPEN_BASES.map(async (b) => {
    for (const v of variants) {
      const data = await fetchJson2(`https://${b.host}/api/v2/product/${encodeURIComponent(v)}?fields=product_name,product_name_pt,product_name_en,generic_name,generic_name_pt,brands,quantity`);
      const description = data?.status === 1 ? describe(data.product) : "";
      if (description) return { found: true, source: b.source, description, code: v };
    }
    return null;
  });
  const results = await Promise.all(tasks);
  const hit = results.find(Boolean);
  return hit ? { ...hit, price: null } : { found: false, source: null, description: "", code };
}
var OPEN_BASES;
var init_productLookup = __esm({
  "server/productLookup.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_barcode();
    OPEN_BASES = [
      { source: "openfoodfacts", host: "world.openfoodfacts.org" },
      { source: "openbeautyfacts", host: "world.openbeautyfacts.org" },
      { source: "openpetfoodfacts", host: "world.openpetfoodfacts.org" },
      { source: "openproductsfacts", host: "world.openproductsfacts.org" }
    ];
  }
});

// server/modules/products.ts
var products_exports = {};
__export(products_exports, {
  buildWhere: () => buildWhere,
  getProductsAlertDays: () => getProductsAlertDays,
  inventoryAlertsFor: () => inventoryAlertsFor,
  listFilters: () => listFilters,
  productsRouter: () => productsRouter,
  queryProducts: () => queryProducts
});
import { z as z15 } from "zod";
import { TRPCError as TRPCError22 } from "@trpc/server";
import { sql as sql24 } from "drizzle-orm";
async function ready10() {
  const database2 = await getDb();
  if (!database2) throw new TRPCError22({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
  await ensureInventoryProductsSchema();
  await ensureStoreClientsSchema(database2);
  await ensurePromoterStoreAssignmentsTable(database2);
  return database2;
}
async function getProductsAlertDays(companyId) {
  try {
    return normalizeAlertDays(await getSetting(PRODUCTS_ALERT_DAYS_KEY, companyId, "30"));
  } catch {
    return 30;
  }
}
function buildWhere(ctx, f, today, alertDays) {
  const parts = [sql24`ip.companyId = ${ctx.accountId}`];
  const memberId = hasFullStoreAccess(ctx) ? null : ctx.memberAccountId ?? -1;
  if (memberId !== null) parts.push(sql24`ip.createdByMemberId = ${memberId}`);
  if (f.mine && ctx.memberAccountId) parts.push(sql24`ip.createdByMemberId = ${ctx.memberAccountId}`);
  const search = f.search?.trim();
  if (search) {
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    parts.push(sql24`(LOWER(ip.productCode) LIKE ${pattern} OR LOWER(ip.description) LIKE ${pattern} OR LOWER(COALESCE(ip.lot, '')) LIKE ${pattern})`);
  }
  const limit = addDays(today, alertDays);
  if (f.expiry === "expired") parts.push(sql24`ip.expirationDate < ${today}`);
  if (f.expiry === "near") parts.push(sql24`ip.expirationDate >= ${today} AND ip.expirationDate <= ${limit}`);
  if (f.expiry === "alert") parts.push(sql24`ip.expirationDate <= ${limit}`);
  if (f.expiry === "valid") parts.push(sql24`ip.expirationDate > ${limit}`);
  if (f.storeId) parts.push(sql24`ip.storeId = ${f.storeId}`);
  if (f.storeClientId) parts.push(sql24`ip.storeClientId = ${f.storeClientId}`);
  if (f.clientName) parts.push(f.clientName === "__none__" ? sql24`c.name IS NULL` : sql24`c.name = ${f.clientName}`);
  if (f.from) parts.push(sql24`ip.expirationDate >= ${f.from}`);
  if (f.to) parts.push(sql24`ip.expirationDate <= ${f.to}`);
  return sql24.join(parts, sql24` AND `);
}
function mapRow(ctx, r) {
  return {
    ...r,
    id: Number(r.id),
    companyId: Number(r.companyId),
    quantity: Number(r.quantity ?? 0),
    price: String(r.price ?? "0.00"),
    expirationDate: isoDate(r.expirationDate),
    storeId: r.storeId == null ? null : Number(r.storeId),
    storeClientId: r.storeClientId == null ? null : Number(r.storeClientId),
    createdByMemberId: r.createdByMemberId == null ? null : Number(r.createdByMemberId),
    storeActive: r.storeActive == null ? null : Boolean(Number(r.storeActive)),
    canManage: canManageProduct(ctx.user.role, ctx.memberAccountId, r.createdByMemberId == null ? null : Number(r.createdByMemberId))
  };
}
async function queryProducts(ctx, f, opts) {
  const database2 = await ready10();
  const today = todayInZone();
  const alertDays = await getProductsAlertDays(ctx.accountId);
  const where = buildWhere(ctx, f, today, alertDays);
  const items = rowsOf(await database2.execute(sql24`SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY ip.expirationDate ASC, ip.description ASC, ip.id ASC LIMIT ${opts.limit} OFFSET ${opts.offset ?? 0}`)).map((r) => mapRow(ctx, r));
  return { items, today, alertDays, where, database: database2 };
}
async function loadOne(ctx, id3) {
  const database2 = await ready10();
  const r = rowsOf(await database2.execute(sql24`SELECT ${COLUMNS} ${FROM} WHERE ip.id = ${id3} AND ip.companyId = ${ctx.accountId} LIMIT 1`))[0];
  return r ? mapRow(ctx, r) : null;
}
async function loadManageable(ctx, id3) {
  const row2 = await loadOne(ctx, id3);
  if (!row2) throw new TRPCError22({ code: "NOT_FOUND", message: "Produto n\xE3o encontrado." });
  if (!row2.canManage) throw new TRPCError22({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode alterar ou excluir produtos que voc\xEA mesmo cadastrou." });
  return row2;
}
async function validatePlace(ctx, storeId, storeClientId) {
  const database2 = await ready10();
  if (!storeId) {
    if (storeClientId) throw new TRPCError22({ code: "BAD_REQUEST", message: "Escolha a loja antes da marca/cliente." });
    return { storeId: null, storeClientId: null };
  }
  const store = await assertStoreAccess(database2, ctx, storeId);
  if (!store.active) throw new TRPCError22({ code: "BAD_REQUEST", message: "Essa loja foi removida. Escolha outra loja." });
  if (storeClientId) {
    const c = rowsOf(await database2.execute(sql24`SELECT id FROM store_clients WHERE id = ${storeClientId} AND companyId = ${ctx.accountId} AND storeId = ${storeId} AND active = true LIMIT 1`))[0];
    if (!c) throw new TRPCError22({ code: "BAD_REQUEST", message: "Marca/cliente n\xE3o encontrada nesta loja." });
  }
  return { storeId, storeClientId: storeClientId ?? null };
}
async function uploadLabelPhoto(companyId, base64, requestId) {
  const buffer = Buffer.from(base64, "base64");
  const mime = detectImageMime(buffer);
  if (!mime) throw new TRPCError22({ code: "BAD_REQUEST", message: "A foto precisa ser uma imagem (JPG, PNG ou WebP)." });
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  try {
    const { key } = await storagePut2(`product-photos/${companyId}/${safeKeySegment(requestId)}.${ext}`, buffer, mime);
    return key;
  } catch {
    throw new TRPCError22({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel salvar a foto da etiqueta agora. Tente sem a foto ou mais tarde." });
  }
}
async function deleteLabelPhoto(companyId, key) {
  if (!key) return;
  const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  await guardedStorageDelete(storageDelete2, key, companyId).catch(() => false);
}
async function inventoryAlertsFor(ctx) {
  try {
    if (!ctx.actingAsPlatform) {
      const { assertMemberFeatureAccess: assertMemberFeatureAccess2 } = await Promise.resolve().then(() => (init_entitlements2(), entitlements_exports));
      await assertMemberFeatureAccess2({ companyId: ctx.accountId, memberAccountId: ctx.memberAccountId ?? null, role: ctx.user.role, featureKey: "products" });
    }
  } catch {
    return [];
  }
  return (await queryProducts(ctx, { expiry: "alert" }, { limit: 200 })).items;
}
var rowsOf, isoDate, listFilters, FROM, COLUMNS, productFields, nullSafe, productsRouter;
var init_products2 = __esm({
  "server/modules/products.ts"() {
    "use strict";
    init_db();
    init_trpc();
    init_audit();
    init_storeAccess();
    init_storeClients();
    init_mediaKeys();
    init_uploadLimits();
    init_expiry();
    init_products();
    rowsOf = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
    isoDate = (v) => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? "").slice(0, 10);
    listFilters = z15.object({
      search: z15.string().trim().max(100).optional(),
      expiry: z15.enum(["all", "expired", "near", "alert", "valid"]).optional(),
      storeId: z15.number().int().positive().optional(),
      storeClientId: z15.number().int().positive().optional(),
      /** Nome da indústria (agrupa a mesma indústria cadastrada em lojas diferentes). */
      clientName: z15.string().trim().max(255).optional(),
      from: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      mine: z15.boolean().optional()
    });
    FROM = sql24`FROM inventory_products ip
  LEFT JOIN stores s ON s.id = ip.storeId AND s.companyId = ip.companyId
  LEFT JOIN store_clients c ON c.id = ip.storeClientId AND c.companyId = ip.companyId
  LEFT JOIN member_accounts m ON m.id = ip.createdByMemberId AND m.companyId = ip.companyId`;
    COLUMNS = sql24`ip.id, ip.companyId, ip.productCode, ip.description, ip.quantity, ip.expirationDate, ip.price, ip.storeId, ip.storeClientId, ip.lot, ip.photoKey,
  ip.createdByMemberId, ip.createdAt, ip.updatedAt, s.name AS storeName, s.active AS storeActive, c.name AS clientName, m.userName AS createdByName`;
    productFields = {
      productCode: z15.string().trim().min(1).max(64),
      description: z15.string().trim().min(1).max(500),
      quantity: z15.number().int().min(0).max(1e6),
      expirationDate: z15.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isPlausibleExpiry, "Data de validade inv\xE1lida."),
      price: z15.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
      storeId: z15.number().int().positive().nullish(),
      storeClientId: z15.number().int().positive().nullish(),
      lot: z15.string().trim().max(64).nullish(),
      photoBase64: z15.string().min(100).max(MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE).optional()
    };
    nullSafe = (col, v) => v == null ? sql24.raw(`${col} IS NULL`) : sql24`${sql24.raw(col)} = ${v}`;
    productsRouter = router({
      settings: commercialFeatureProcedure("products").query(async ({ ctx }) => ({ alertDays: await getProductsAlertDays(ctx.accountId) })),
      setAlertDays: commercialFeatureProcedure("products").input(z15.object({ days: z15.number().int().min(1).max(180) })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "company_admin") throw new TRPCError22({ code: "FORBIDDEN", message: "Somente o administrador pode mudar o prazo de alerta." });
        await setSetting(PRODUCTS_ALERT_DAYS_KEY, String(input.days), ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "products", entityType: "settings", description: `Alerta de validade: ${input.days} dias antes`, newData: input });
        return { alertDays: input.days };
      }),
      /** Lojas ativas visíveis ao usuário (não depende do módulo de lojas/roteiros estar ligado). */
      stores: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        await ready10();
        return (await listOperationalStores(ctx.accountId, void 0, scopeMemberId(ctx))).map((s) => ({ id: s.id, name: s.name, city: s.city }));
      }),
      /** Indústrias (clientes) ativas de uma loja. */
      storeClients: commercialFeatureProcedure("products").input(z15.object({ storeId: z15.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready10();
        await assertStoreAccess(database2, ctx, input.storeId);
        return rowsOf(await database2.execute(sql24`SELECT id, name FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true ORDER BY name`)).map((r) => ({ id: Number(r.id), name: String(r.name) }));
      }),
      /** Nomes de indústria usados nos produtos visíveis (filtro e agrupamento do relatório). */
      industries: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        const database2 = await ready10();
        const where = buildWhere(ctx, {}, todayInZone(), 30);
        return rowsOf(await database2.execute(sql24`SELECT DISTINCT c.name AS name ${FROM} WHERE ${where} AND c.name IS NOT NULL ORDER BY c.name LIMIT 500`)).map((r) => String(r.name));
      }),
      lookupByCode: commercialFeatureProcedure("products").input(z15.object({ code: z15.string().trim().min(6).max(64) })).query(async ({ ctx, input }) => {
        const { lookupProductByCode: lookupProductByCode2 } = await Promise.resolve().then(() => (init_productLookup(), productLookup_exports));
        return lookupProductByCode2(ctx.accountId, input.code);
      }),
      /** Lista paginada e filtrada no servidor. */
      list: commercialFeatureProcedure("products").input(listFilters.extend({ page: z15.number().int().min(1).max(1e4).optional(), pageSize: z15.number().int().min(5).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
        const f = input ?? {};
        const pageSize = f.pageSize ?? PRODUCTS_PAGE_SIZE;
        const page = f.page ?? 1;
        const { items, alertDays, where, database: database2, today } = await queryProducts(ctx, f, { limit: pageSize, offset: (page - 1) * pageSize });
        const total = Number(rowsOf(await database2.execute(sql24`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`))[0]?.n ?? 0);
        return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), alertDays, today };
      }),
      /** Contagem do alerta: vencidos + que vencem dentro da janela da empresa. */
      summary: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        const database2 = await ready10();
        const today = todayInZone();
        const alertDays = await getProductsAlertDays(ctx.accountId);
        const where = buildWhere(ctx, {}, today, alertDays);
        const r = rowsOf(await database2.execute(sql24`SELECT
      SUM(CASE WHEN ip.expirationDate < ${today} THEN 1 ELSE 0 END) AS expired,
      SUM(CASE WHEN ip.expirationDate >= ${today} AND ip.expirationDate <= ${addDays(today, alertDays)} THEN 1 ELSE 0 END) AS near,
      COUNT(*) AS total ${FROM} WHERE ${where}`))[0] ?? {};
        return { expired: Number(r.expired ?? 0), near: Number(r.near ?? 0), total: Number(r.total ?? 0), alertDays, today };
      }),
      /** Linhas para relatório impresso / compartilhado (padrão: vencidos + a vencer). */
      report: commercialFeatureProcedure("products").input(listFilters.optional()).query(async ({ ctx, input }) => {
        const { items, alertDays, today } = await queryProducts(ctx, { expiry: "alert", ...input ?? {} }, { limit: 5e3 });
        return { items, alertDays, today, truncated: items.length >= 5e3 };
      }),
      /** CSV (até 10 mil linhas) com os mesmos filtros da tela. */
      exportCsv: commercialFeatureProcedure("products").input(listFilters.optional()).mutation(async ({ ctx, input }) => {
        const { items, alertDays, today } = await queryProducts(ctx, input ?? {}, { limit: PRODUCTS_EXPORT_LIMIT });
        void auditFromCtx(ctx, { action: "export", module: "products", entityType: "product_csv", description: `Exportou ${items.length} produto(s) em CSV`, newData: input ?? {} });
        return { filename: `produtos-validades-${today}.csv`, csv: productsCsv(items, today, alertDays), count: items.length, truncated: items.length >= PRODUCTS_EXPORT_LIMIT };
      }),
      photoUrl: commercialFeatureProcedure("products").input(z15.object({ id: z15.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready10();
        const where = buildWhere(ctx, {}, todayInZone(), 30);
        const row2 = rowsOf(await database2.execute(sql24`SELECT ip.photoKey ${FROM} WHERE ${where} AND ip.id = ${input.id} LIMIT 1`))[0];
        if (!row2?.photoKey || !isTenantMediaKey(row2.photoKey, ctx.accountId, ["product-photos"])) throw new TRPCError22({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageGetSignedUrl: storageGetSignedUrl2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        return { url: await storageGetSignedUrl2(String(row2.photoKey)) };
      }),
      /** Quantos produtos ainda apontam para a loja (aviso antes de remover a loja). */
      countByStore: commercialFeatureProcedure("products").input(z15.object({ storeId: z15.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready10();
        return { count: Number(rowsOf(await database2.execute(sql24`SELECT COUNT(*) AS n FROM inventory_products WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId}`))[0]?.n ?? 0) };
      }),
      create: commercialFeatureProcedure("products").input(z15.object({ ...productFields, clientRequestId: z15.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/) })).mutation(async ({ ctx, input }) => {
        const database2 = await ready10();
        const prior = rowsOf(await database2.execute(sql24`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
        if (prior) return { product: await loadOne(ctx, Number(prior.productId)), merged: Boolean(Number(prior.merged)), duplicate: true };
        const place = await validatePlace(ctx, input.storeId, input.storeClientId);
        const lot = normalizeLot(input.lot);
        const key = { productCode: input.productCode, expirationDate: input.expirationDate, ...place, lot };
        const photoKey = input.photoBase64 ? await uploadLabelPhoto(ctx.accountId, input.photoBase64, input.clientRequestId) : null;
        let result;
        try {
          result = await database2.transaction(async (tx) => {
            const existing = rowsOf(await tx.execute(sql24`SELECT id, quantity, price, photoKey FROM inventory_products
          WHERE companyId = ${ctx.accountId} AND productCode = ${key.productCode} AND expirationDate = ${key.expirationDate}
            AND ${nullSafe("storeId", key.storeId)} AND ${nullSafe("storeClientId", key.storeClientId)} AND ${nullSafe("lot", key.lot)}
          ORDER BY id ASC LIMIT 1 FOR UPDATE`))[0];
            let out;
            if (existing) {
              const keepPrice = Number(existing.price) > 0 ? existing.price : input.price;
              const usePhoto = photoKey && !existing.photoKey;
              await tx.execute(sql24`UPDATE inventory_products SET quantity = quantity + ${input.quantity}, price = ${keepPrice}${usePhoto ? sql24`, photoKey = ${photoKey}` : sql24``} WHERE id = ${existing.id} AND companyId = ${ctx.accountId}`);
              out = { id: Number(existing.id), merged: true, previousQuantity: Number(existing.quantity), photoUnused: Boolean(photoKey && !usePhoto) };
            } else {
              const ins = await tx.execute(sql24`INSERT INTO inventory_products (companyId, productCode, description, quantity, expirationDate, price, storeId, storeClientId, lot, photoKey, createdByMemberId)
            VALUES (${ctx.accountId}, ${key.productCode}, ${input.description}, ${input.quantity}, ${key.expirationDate}, ${input.price}, ${key.storeId}, ${key.storeClientId}, ${key.lot}, ${photoKey}, ${ctx.memberAccountId ?? null})`);
              out = { id: Number(ins?.[0]?.insertId ?? ins?.insertId), merged: false };
            }
            await tx.execute(sql24`INSERT INTO inventory_product_requests (companyId, clientRequestId, productId, merged) VALUES (${ctx.accountId}, ${input.clientRequestId}, ${out.id}, ${out.merged})`);
            return out;
          });
        } catch (error) {
          await deleteLabelPhoto(ctx.accountId, photoKey);
          if (/duplicate/i.test(String(error?.message ?? error?.cause?.message ?? ""))) {
            const p = rowsOf(await database2.execute(sql24`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
            if (p) return { product: await loadOne(ctx, Number(p.productId)), merged: Boolean(Number(p.merged)), duplicate: true };
          }
          throw error;
        }
        if (result.photoUnused) await deleteLabelPhoto(ctx.accountId, photoKey);
        const product = await loadOne(ctx, result.id);
        const { photoBase64: _omit, ...logged } = input;
        void auditFromCtx(ctx, result.merged ? { action: "update", module: "products", entityType: "product", entityId: result.id, entityLabel: input.description, description: `Somou ${input.quantity} un. ao produto: ${input.description} (antes ${result.previousQuantity})`, newData: logged } : { action: "create", module: "products", entityType: "product", entityId: result.id, entityLabel: input.description, description: `Cadastrou produto: ${input.description}`, newData: logged });
        return { product, merged: result.merged, duplicate: false };
      }),
      update: commercialFeatureProcedure("products").input(z15.object({ ...productFields, id: z15.number().int().positive(), removePhoto: z15.boolean().optional() })).mutation(async ({ ctx, input }) => {
        const before = await loadManageable(ctx, input.id);
        const sameStore = input.storeId != null && input.storeId === before.storeId && input.storeClientId === before.storeClientId;
        const place = sameStore ? { storeId: before.storeId, storeClientId: before.storeClientId } : await validatePlace(ctx, input.storeId, input.storeClientId);
        const database2 = await ready10();
        let photoKey = before.photoKey;
        if (input.photoBase64) photoKey = await uploadLabelPhoto(ctx.accountId, input.photoBase64, `${input.id}-${Date.now()}`);
        else if (input.removePhoto) photoKey = null;
        await database2.execute(sql24`UPDATE inventory_products SET productCode = ${input.productCode}, description = ${input.description}, quantity = ${input.quantity}, expirationDate = ${input.expirationDate}, price = ${input.price},
      storeId = ${place.storeId}, storeClientId = ${place.storeClientId}, lot = ${normalizeLot(input.lot)}, photoKey = ${photoKey} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
        if (before.photoKey && before.photoKey !== photoKey) await deleteLabelPhoto(ctx.accountId, before.photoKey);
        const product = await loadOne(ctx, input.id);
        const { photoBase64: _omit, ...logged } = input;
        void auditFromCtx(ctx, { action: "update", module: "products", entityType: "product", entityId: input.id, entityLabel: input.description, description: `Alterou produto: ${input.description}`, oldData: before, newData: logged });
        return product;
      }),
      deleteMany: commercialFeatureProcedure("products").input(z15.object({ ids: z15.array(z15.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
        const ids = [...new Set(input.ids)];
        for (const id3 of ids) await loadManageable(ctx, id3);
        const result = await deleteInventoryProducts(ctx.accountId, ids, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        void auditFromCtx(ctx, { action: "delete", module: "products", entityType: ids.length === 1 ? "product" : "product_bulk", entityId: ids.length === 1 ? ids[0] : void 0, entityLabel: `${result.deleted} produto(s)`, description: `Enviou ${result.deleted} produto(s) \xE0 lixeira`, newData: { productIds: ids } });
        return result;
      }),
      delete: commercialFeatureProcedure("products").input(z15.object({ id: z15.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await loadManageable(ctx, input.id);
        return deleteInventoryProducts(ctx.accountId, [input.id], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      }),
      /** Compatibilidade com telas antigas: vencidos + a vencer na janela da empresa. */
      alertsSimple: commercialFeatureProcedure("products").query(async ({ ctx }) => (await queryProducts(ctx, { expiry: "alert" }, { limit: 200 })).items)
    });
  }
});

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req, allowCrossSite = false) {
  const secure = process.env.NODE_ENV === "production" || isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    // Lax: o site e a API são da mesma origem, então o cookie nunca precisa ir em pedidos de outros sites (defesa contra CSRF).
    sameSite: "lax",
    secure
  };
}
var init_cookies = __esm({
  "server/_core/cookies.ts"() {
    "use strict";
  }
});

// server/_core/notification.ts
import { TRPCError as TRPCError23 } from "@trpc/server";
async function notifyOwner(payload2) {
  const { title, content } = validatePayload(payload2);
  const endpoint = process.env.ALERT_WEBHOOK_URL;
  if (!endpoint) return false;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify({ title, content, source: "promotores-saas", timestamp: (/* @__PURE__ */ new Date()).toISOString() })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}
var TITLE_MAX_LENGTH, CONTENT_MAX_LENGTH, trimValue, isNonEmptyString, validatePayload;
var init_notification = __esm({
  "server/_core/notification.ts"() {
    "use strict";
    TITLE_MAX_LENGTH = 1200;
    CONTENT_MAX_LENGTH = 2e4;
    trimValue = (value) => value.trim();
    isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
    validatePayload = (input) => {
      if (!isNonEmptyString(input.title)) {
        throw new TRPCError23({
          code: "BAD_REQUEST",
          message: "Notification title is required."
        });
      }
      if (!isNonEmptyString(input.content)) {
        throw new TRPCError23({
          code: "BAD_REQUEST",
          message: "Notification content is required."
        });
      }
      const title = trimValue(input.title);
      const content = trimValue(input.content);
      if (title.length > TITLE_MAX_LENGTH) {
        throw new TRPCError23({
          code: "BAD_REQUEST",
          message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
        });
      }
      if (content.length > CONTENT_MAX_LENGTH) {
        throw new TRPCError23({
          code: "BAD_REQUEST",
          message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
        });
      }
      return { title, content };
    };
  }
});

// server/_core/systemRouter.ts
import { z as z16 } from "zod";
var systemRouter;
var init_systemRouter = __esm({
  "server/_core/systemRouter.ts"() {
    "use strict";
    init_notification();
    init_trpc();
    systemRouter = router({
      health: publicProcedure.input(
        z16.object({
          timestamp: z16.number().min(0, "timestamp cannot be negative")
        })
      ).query(() => ({
        ok: true
      })),
      notifyOwner: adminProcedure.input(
        z16.object({
          title: z16.string().min(1, "title is required"),
          content: z16.string().min(1, "content is required")
        })
      ).mutation(async ({ input }) => {
        const delivered = await notifyOwner(input);
        return {
          success: delivered
        };
      })
    });
  }
});

// server/planLimits.ts
import { TRPCError as TRPCError24 } from "@trpc/server";
import { sql as sql25, eq as eq23 } from "drizzle-orm";
async function getEffectivePlan(companyId) {
  const base = await getCompanyEntitlementBase(companyId);
  const plan = base.plan;
  const features = base.companyFeatures;
  return {
    id: plan?.id == null ? null : Number(plan.id),
    name: String(plan?.name || "Sem plano"),
    maxUsers: plan ? plan.maxUsers == null ? null : Number(plan.maxUsers) : 1,
    maxClients: plan ? plan.maxClients == null ? null : Number(plan.maxClients) : 1e3,
    maxExtinguishers: plan ? plan.maxExtinguishers == null ? null : Number(plan.maxExtinguishers) : 3e3,
    featureKeys: ENTITLEMENT_KEYS.filter((key) => features[key]),
    features
  };
}
async function resolveExtraUsers(companyId) {
  const raw = await getSetting(EXTRA_USERS_KEY, companyId, "0");
  return parseExtraUsers(raw);
}
async function getStaffUsage(companyId) {
  const resolved = await resolveCompanyPlan(companyId);
  const plan = resolved.plan;
  const extraUsers = await resolveExtraUsers(companyId);
  const members = await listMemberAccounts(companyId);
  const current = countBillableStaff(Array.isArray(members) ? members : []);
  const included = plan?.maxUsers == null ? null : Number(plan.maxUsers);
  const limit = effectiveUserLimit({ maxUsers: included, extraUsers });
  const additionalUserPrice = plan?.additionalUserPrice != null ? String(plan.additionalUserPrice) : null;
  const planPrice = plan?.price != null ? String(plan.price) : null;
  return {
    current,
    extraUsers,
    included,
    limit,
    unlimited: limit == null,
    planName: plan?.name ? String(plan.name) : null,
    planPrice,
    additionalUserPrice,
    suggestedMonthlyAmount: planPrice != null ? suggestedMonthlyAmount({ planPrice, extraUsers, additionalUserPrice }) : null,
    label: staffUsageLabel(current, limit, extraUsers)
  };
}
async function assertUserLimit(companyId, role) {
  if (role != null && !staffLimitAppliesToRole(role)) return getStaffUsage(companyId);
  const usage = await getStaffUsage(companyId);
  if (usage.limit == null) return usage;
  if (usage.current >= usage.limit) {
    throw new TRPCError24({
      code: "FORBIDDEN",
      message: userLimitReachedMessage(usage.limit),
      cause: { code: "PLAN_LIMIT", resource: "users", limit: usage.limit, current: usage.current }
    });
  }
  return usage;
}
var init_planLimits = __esm({
  "server/planLimits.ts"() {
    "use strict";
    init_db();
    init_memberAuth();
    init_schema_original();
    init_entitlements();
    init_entitlements2();
    init_staffLimit();
  }
});

// server/supervisorTeam.ts
import { TRPCError as TRPCError25 } from "@trpc/server";
function assertSupervisorPromoterOnly(actorRole2, targetRole) {
  if (actorRole2 !== "supervisor") return;
  if (targetRole !== "promoter") {
    throw new TRPCError25({ code: "FORBIDDEN", message: SUPERVISOR_PROMOTER_ONLY_MESSAGE });
  }
}
var SUPERVISOR_PROMOTER_ONLY_MESSAGE;
var init_supervisorTeam = __esm({
  "server/supervisorTeam.ts"() {
    "use strict";
    SUPERVISOR_PROMOTER_ONLY_MESSAGE = "O supervisor s\xF3 pode cadastrar e editar promotores.";
  }
});

// shared/address.ts
function stateToUf(state, iso) {
  const fromIso = iso?.match(/^BR-([A-Z]{2})$/)?.[1];
  if (fromIso) return fromIso;
  return state ? UF_BY_STATE[state.trim().toLowerCase()] ?? state : void 0;
}
function formatCep2(cep) {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep?.trim() || void 0;
}
function streetFromAddress(a) {
  if (!a) return void 0;
  return a.road || a.pedestrian || a.residential || a.footway || a.path || a.cycleway || void 0;
}
function cityFromAddress(a) {
  if (!a) return void 0;
  return a.city || a.town || a.village || a.municipality || a.hamlet || void 0;
}
function bairroFromAddress(a) {
  if (!a) return void 0;
  const city = cityFromAddress(a);
  const candidates = [a.suburb, a.neighbourhood, a.neighborhood, a.quarter, a.city_district, a.district];
  for (const c of candidates) {
    const t2 = c?.trim();
    if (t2 && (!city || t2.toLowerCase() !== city.toLowerCase())) return t2;
  }
  return void 0;
}
function formatBrAddress(a, displayName) {
  if (!a) return displayName?.trim() || null;
  const street = streetFromAddress(a);
  let streetPart = street ? a.house_number ? `${street}, ${a.house_number}` : street : void 0;
  if (streetPart && a.approximateStreet) streetPart = `pr\xF3ximo a ${streetPart}`;
  const bairro = bairroFromAddress(a);
  const city = cityFromAddress(a);
  const uf = stateToUf(a.state, a["ISO3166-2-lvl4"]);
  const cityPart = city ? uf ? `${city}-${uf}` : city : uf;
  const cep = formatCep2(a.postcode);
  const head = [streetPart, bairro].filter(Boolean).join(" - ");
  const parts = [head || void 0, cityPart, cep ? `CEP ${cep}` : void 0].filter(Boolean);
  if (parts.length) return parts.join(", ");
  return displayName?.trim() || null;
}
function mergeAddressParts(base, extra) {
  const out = { ...base };
  const baseStreet = streetFromAddress(base);
  const extraStreet = streetFromAddress(extra);
  if (!baseStreet && extraStreet) {
    out.road = extra.road || extra.pedestrian || extra.residential || extra.footway || extra.path || extra.cycleway;
    if (extra.house_number && !out.house_number) out.house_number = extra.house_number;
    if (extra.approximateStreet) out.approximateStreet = true;
  } else if (baseStreet && out.approximateStreet && extraStreet && !extra.approximateStreet) {
    out.road = extra.road || extraStreet;
    out.house_number = extra.house_number || out.house_number;
    delete out.approximateStreet;
  }
  if (!bairroFromAddress(out)) {
    const b = bairroFromAddress(extra) || extra.suburb || extra.neighbourhood || extra.neighborhood || extra.quarter;
    if (b) out.suburb = b;
  }
  if (!cityFromAddress(out)) {
    const c = cityFromAddress(extra);
    if (c) out.city = c;
  }
  if (!out.state && extra.state) out.state = extra.state;
  if (!out["ISO3166-2-lvl4"] && extra["ISO3166-2-lvl4"]) out["ISO3166-2-lvl4"] = extra["ISO3166-2-lvl4"];
  if (!out.postcode && extra.postcode) out.postcode = extra.postcode;
  if (!out.house_number && extra.house_number) out.house_number = extra.house_number;
  return out;
}
var UF_BY_STATE;
var init_address = __esm({
  "shared/address.ts"() {
    "use strict";
    UF_BY_STATE = {
      "acre": "AC",
      "alagoas": "AL",
      "amap\xE1": "AP",
      "amazonas": "AM",
      "bahia": "BA",
      "cear\xE1": "CE",
      "distrito federal": "DF",
      "esp\xEDrito santo": "ES",
      "goi\xE1s": "GO",
      "maranh\xE3o": "MA",
      "mato grosso": "MT",
      "mato grosso do sul": "MS",
      "minas gerais": "MG",
      "par\xE1": "PA",
      "para\xEDba": "PB",
      "paran\xE1": "PR",
      "pernambuco": "PE",
      "piau\xED": "PI",
      "rio de janeiro": "RJ",
      "rio grande do norte": "RN",
      "rio grande do sul": "RS",
      "rond\xF4nia": "RO",
      "roraima": "RR",
      "santa catarina": "SC",
      "s\xE3o paulo": "SP",
      "sergipe": "SE",
      "tocantins": "TO"
    };
  }
});

// server/geocoding.ts
function coordinateKey(latitude, longitude) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}
function delay(ms2) {
  return new Promise((resolve) => setTimeout(resolve, ms2));
}
function enqueueRequest(request) {
  const queued = requestQueue.then(async () => {
    const waitMs = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestStartedAt));
    if (waitMs > 0) await delay(waitMs);
    lastRequestStartedAt = Date.now();
    return request();
  });
  requestQueue = queued.then(() => void 0, () => void 0);
  return queued;
}
function remember(key, address) {
  if (addressCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = addressCache.keys().next().value;
    if (oldestKey) addressCache.delete(oldestKey);
  }
  addressCache.set(key, { address, expiresAt: Date.now() + CACHE_TTL_MS });
}
async function reverseGeocodeAddress(latitude, longitude) {
  const apiKey = process.env.GEOAPIFY_API_KEY?.trim();
  if (!apiKey) return { address: null, configured: false };
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { address: null, configured: true };
  }
  const key = coordinateKey(latitude, longitude);
  const cached = addressCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    addressCache.delete(key);
    addressCache.set(key, cached);
    return { address: cached.address, configured: true };
  }
  if (cached) addressCache.delete(key);
  let request = inFlight.get(key);
  if (!request) {
    request = enqueueRequest(async () => {
      const url = new URL("https://api.geoapify.com/v1/geocode/reverse");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("apiKey", apiKey);
      url.searchParams.set("format", "json");
      url.searchParams.set("lang", "pt");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8e3)
      });
      if (!response.ok) {
        console.warn(`[geocoding] Geoapify returned HTTP ${response.status}`);
        return null;
      }
      const payload2 = await response.json();
      const result = payload2.results?.[0]?.formatted ?? payload2.features?.[0]?.properties?.formatted;
      return typeof result === "string" && result.trim() ? result.trim() : null;
    });
    inFlight.set(key, request);
  }
  try {
    const address = await request;
    remember(key, address);
    return { address, configured: true };
  } catch (error) {
    console.warn("[geocoding] Geoapify reverse lookup failed", error instanceof Error ? error.name : "unknown error");
    return { address: null, configured: true };
  } finally {
    inFlight.delete(key);
  }
}
function needsEnrichment(parts) {
  return !streetFromAddress(parts) || !bairroFromAddress(parts);
}
async function nominatimParts(latitude, longitude, fetchImpl) {
  const run = nominatimQueue.then(async () => {
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await delay(wait);
    lastNominatimAt = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&email=ivan.honemann@gmail.com`;
    const res = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": NOMINATIM_UA },
      signal: AbortSignal.timeout(6e3)
    });
    if (!res.ok) {
      console.warn(`[geocoding] Nominatim HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.address ? { ...data.address } : null;
  });
  nominatimQueue = run.then(() => void 0, () => void 0);
  return run;
}
async function photonParts(latitude, longitude, fetchImpl) {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`;
    const res = await fetchImpl(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) {
      console.warn(`[geocoding] Photon HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const p = data.features?.[0]?.properties;
    if (!p) return null;
    const road = p.street || (p.type === "street" ? p.name : void 0) || void 0;
    if (!road && !p.city && !p.postcode) return null;
    const out = {
      road,
      house_number: p.housenumber,
      suburb: p.district && p.district !== p.city ? p.district : void 0,
      city: p.city,
      state: p.state,
      postcode: p.postcode,
      approximateStreet: !!road
      // Photon = rua próxima, não necessariamente o ponto exato
    };
    if (p.countrycode === "BR" && p.state) {
    }
    return out;
  } catch (error) {
    console.warn("[geocoding] Photon falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}
async function viaCepParts(cep, fetchImpl) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro || !data.logradouro && !data.bairro && !data.localidade) return null;
    return {
      road: data.logradouro || void 0,
      suburb: data.bairro || void 0,
      city: data.localidade || void 0,
      state: data.uf || void 0,
      postcode: data.cep || formatCep2(digits),
      approximateStreet: false
    };
  } catch (error) {
    console.warn("[geocoding] ViaCEP falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}
async function brasilApiParts(cep, fetchImpl) {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const res = await fetchImpl(`https://brasilapi.com.br/api/cep/v2/${digits}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.street && !data.neighborhood && !data.city) return null;
    return {
      road: data.street || void 0,
      suburb: data.neighborhood || void 0,
      city: data.city || void 0,
      state: data.state || void 0,
      postcode: formatCep2(data.cep || digits),
      approximateStreet: false
    };
  } catch (error) {
    console.warn("[geocoding] BrasilAPI falhou", error instanceof Error ? error.name : "erro");
    return null;
  }
}
async function reverseGeocodeBr(latitude, longitude, fetchImpl = fetch) {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) {
    return null;
  }
  const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  const hit = brCache.get(key);
  if (hit && hit.expiresAt > Date.now() && hit.address) return hit.address;
  let parts = {};
  try {
    const nom = await nominatimParts(latitude, longitude, fetchImpl);
    if (nom) parts = nom;
  } catch (error) {
    console.warn("[geocoding] Nominatim falhou", error instanceof Error ? error.name : "erro");
  }
  if (needsEnrichment(parts)) {
    const photon = await photonParts(latitude, longitude, fetchImpl);
    if (photon) parts = mergeAddressParts(parts, photon);
  }
  const cep = formatCep2(parts.postcode);
  if (cep && needsEnrichment(parts)) {
    const via = await viaCepParts(cep, fetchImpl);
    if (via) parts = mergeAddressParts(parts, via);
  }
  if (cep && needsEnrichment(parts)) {
    const br = await brasilApiParts(cep, fetchImpl);
    if (br) parts = mergeAddressParts(parts, br);
  }
  let address = formatBrAddress(parts);
  if (!address || !streetFromAddress(parts)) {
    const geo = await reverseGeocodeAddress(latitude, longitude).catch(() => ({ address: null }));
    if (geo.address) address = geo.address;
  }
  if (address) {
    if (brCache.size >= MAX_CACHE_ENTRIES) {
      const k = brCache.keys().next().value;
      if (k) brCache.delete(k);
    }
    brCache.set(key, { address, expiresAt: Date.now() + BR_TTL_MS });
  }
  return address;
}
function norm(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function firstNumber(s) {
  const m = String(s ?? "").match(/\d+/);
  return m ? String(Number(m[0])) : null;
}
function splitStreetNumber(address) {
  const first = String(address ?? "").split(/\s[-–]\s/)[0].trim();
  const m = first.match(/^(.*?)(?:,\s*|\bn[º°o]\.?\s*|\s)(\d{1,5})\s*[a-z]?\s*$/i);
  if (!m) return null;
  const street = m[1].replace(/[,\s]+$/, "").trim();
  if (street.length < 3 || !/[a-zà-ú]/i.test(street)) return null;
  return { street, number: String(Number(m[2])) };
}
function matches(c, number, city) {
  return c.number === number && norm(c.city) === norm(city) && Number.isFinite(c.lat) && Number.isFinite(c.lng);
}
async function nominatimSearch(params, fetchImpl) {
  const run = nominatimQueue.then(async () => {
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await delay(wait);
    lastNominatimAt = Date.now();
    const url = new URL("https://nominatim.openstreetmap.org/search");
    for (const [k, v] of Object.entries({ ...params, format: "jsonv2", addressdetails: "1", limit: "3", countrycodes: "br", "accept-language": "pt-BR", email: "ivan.honemann@gmail.com" })) url.searchParams.set(k, v);
    const res = await fetchImpl(url.toString(), { headers: { accept: "application/json", "user-agent": NOMINATIM_UA }, signal: AbortSignal.timeout(6e3) });
    if (!res.ok) {
      console.warn(`[geocoding] Nominatim busca HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map((r) => ({
      lat: Number(r.lat),
      lng: Number(r.lon),
      number: firstNumber(r.address?.house_number),
      city: r.address?.city || r.address?.town || r.address?.municipality || r.address?.village || ""
    }));
  });
  nominatimQueue = run.then(() => void 0, () => void 0);
  return run;
}
async function photonSearch(q, fetchImpl) {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "5");
  const res = await fetchImpl(url.toString(), { headers: { accept: "application/json", "user-agent": NOMINATIM_UA }, signal: AbortSignal.timeout(5e3) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).filter((f) => String(f.properties?.countrycode || "").toUpperCase() === "BR").map((f) => ({ lat: Number(f.geometry?.coordinates?.[1]), lng: Number(f.geometry?.coordinates?.[0]), number: firstNumber(f.properties?.housenumber), city: f.properties?.city || "" }));
}
async function geocodeStoreAddress(input, fetchImpl = fetch) {
  const parts = splitStreetNumber(input.address);
  const city = String(input.city ?? "").trim();
  if (!parts || city.length < 2) return null;
  const state = String(input.state ?? "").trim();
  const key = norm(`${parts.street}|${parts.number}|${city}|${state}`);
  const hit = forwardCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const started = Date.now();
  const attempts = [
    async () => ({ source: "nominatim", list: await nominatimSearch({ street: `${parts.number} ${parts.street}`, city, ...state ? { state } : {}, country: "Brasil" }, fetchImpl) }),
    async () => ({ source: "nominatim", list: await nominatimSearch({ q: `${parts.street}, ${parts.number}, ${city}${state ? `, ${state}` : ""}, Brasil` }, fetchImpl) }),
    async () => ({ source: "photon", list: await photonSearch(`${parts.street} ${parts.number} ${city}${state ? ` ${state}` : ""}`, fetchImpl) })
  ];
  let value = null;
  let anyAnswered = false;
  for (const attempt of attempts) {
    if (Date.now() - started > FORWARD_BUDGET_MS) break;
    try {
      const { list, source } = await attempt();
      anyAnswered = true;
      const found = list.find((c) => matches(c, parts.number, city));
      if (found) {
        value = { latitude: found.lat, longitude: found.lng, source };
        break;
      }
    } catch (error) {
      console.warn("[geocoding] busca do endere\xE7o da loja falhou", error instanceof Error ? error.name : "erro");
    }
  }
  if (value || anyAnswered) forwardCache.set(key, { value, expiresAt: Date.now() + BR_TTL_MS });
  return value;
}
var CACHE_TTL_MS, MAX_CACHE_ENTRIES, MIN_REQUEST_INTERVAL_MS, addressCache, inFlight, requestQueue, lastRequestStartedAt, NOMINATIM_UA, brCache, BR_TTL_MS, lastNominatimAt, nominatimQueue, forwardCache, FORWARD_BUDGET_MS;
var init_geocoding = __esm({
  "server/geocoding.ts"() {
    "use strict";
    init_address();
    CACHE_TTL_MS = 60 * 60 * 1e3;
    MAX_CACHE_ENTRIES = 2e3;
    MIN_REQUEST_INTERVAL_MS = 250;
    addressCache = /* @__PURE__ */ new Map();
    inFlight = /* @__PURE__ */ new Map();
    requestQueue = Promise.resolve();
    lastRequestStartedAt = 0;
    NOMINATIM_UA = "GondUp/1.0 (https://gondup.com.br; ivan.honemann@gmail.com)";
    brCache = /* @__PURE__ */ new Map();
    BR_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
    lastNominatimAt = 0;
    nominatimQueue = Promise.resolve();
    forwardCache = /* @__PURE__ */ new Map();
    FORWARD_BUDGET_MS = 9e3;
  }
});

// shared/geo.ts
function isValidLatLng(lat, lng) {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}
function distanceMeters(a, b) {
  const R = 6371e3;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
var init_geo = __esm({
  "shared/geo.ts"() {
    "use strict";
  }
});

// server/aiGithubService.ts
function explainGithubError(status2, message) {
  const msg = (message || "").toLowerCase();
  if (status2 === 401) return `O GitHub recusou a chave de acesso (GITHUB_TOKEN inv\xE1lido, apagado ou vencido). Gere um novo token no GitHub e atualize a vari\xE1vel GITHUB_TOKEN na Vercel.`;
  if (status2 === 403 && msg.includes("rate limit")) return `O GitHub limitou as consultas sem chave de acesso. Configure a vari\xE1vel GITHUB_TOKEN na Vercel ou tente de novo em 1 hora.`;
  if (status2 === 403) return `A chave do GitHub (GITHUB_TOKEN) n\xE3o tem permiss\xE3o suficiente. Ela precisa de acesso ao reposit\xF3rio ${REPO_LABEL} com "Contents: Read and write" e "Pull requests: Read and write".`;
  if (status2 === 404) return `O GitHub n\xE3o encontrou o reposit\xF3rio ${REPO_LABEL} com essa chave. Confira se o token d\xE1 acesso a esse reposit\xF3rio (em "Repository access").`;
  if (status2 === 422) return `O GitHub n\xE3o aceitou a altera\xE7\xE3o (${message || "dados inv\xE1lidos"}).`;
  return `O GitHub respondeu com erro ${status2}: ${message || "erro desconhecido"}.`;
}
function hasGithubToken() {
  return Boolean(process.env.GITHUB_TOKEN);
}
async function github(path3, init2 = {}, { requireToken = true } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token && requireToken) {
    throw new GithubSetupError(`A IA ainda n\xE3o est\xE1 conectada ao GitHub: falta a vari\xE1vel GITHUB_TOKEN na Vercel. Sem ela eu consigo conversar e analisar, mas n\xE3o consigo abrir a corre\xE7\xE3o (Pull Request) no reposit\xF3rio ${REPO_LABEL}.`);
  }
  const response = await fetch(`${GITHUB_API}${path3}`, {
    ...init2,
    headers: {
      Accept: "application/vnd.github+json",
      ...token ? { Authorization: `Bearer ${token}` } : {},
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init2.headers || {}
    }
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = { message: body.slice(0, 500) };
  }
  if (!response.ok) throw new GithubSetupError(explainGithubError(response.status, parsed?.message || ""));
  return parsed;
}
function buildAiBranchName(now = /* @__PURE__ */ new Date()) {
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  return `ai/suporte-${stamp}-${Math.random().toString(36).slice(2, 7)}`;
}
function isAiEditablePath(path3) {
  if (extraEditableFiles.includes(path3)) return true;
  if (!/^(client\/src|server|shared)\//.test(path3)) return false;
  if (!/\.(tsx?|css)$/.test(path3)) return false;
  if (/\.test\.tsx?$/.test(path3)) return false;
  if (/^server\/_core\//.test(path3)) return false;
  if (/(^|\/)\.env/i.test(path3) || /secret|credential/i.test(path3)) return false;
  if (/\/_archived\//.test(path3)) return false;
  return true;
}
function asksForChange(prompt) {
  if (/\bn[ãa]o\s+(altere|mude|modifique|mexa|aplique|fa[çc]a\s+altera)/i.test(prompt)) return false;
  return /\b(altere|alterar|mude|mudar|modifique|modificar|adicione|adicionar|remova|remover|crie|criar|corrija|corrigir|conserte|consertar|arrume|arrumar|implemente|implementar|troque|trocar|aplique|aplicar|fa[çc]a|fazer|coloque|colocar|insira|inserir|inclua|incluir|disponibilize|disponibilizar|reative|reativar|restaure|restaurar|atualize|atualizar)\b/i.test(prompt);
}
function needsCode(prompt, hasAttachments) {
  return hasAttachments || asksForChange(prompt) || /\b(erros?|bugs?|c[oó]digo|varredura|escane|scan|analis|revis|layout|design|tela|p[aá]gina|arquivo|obsolet|quebrad|funcion)/i.test(prompt);
}
async function readFile(path3, ref) {
  const file = await github(`/repos/${OWNER}/${REPO}/contents/${path3.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, {}, { requireToken: false });
  return { path: path3, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
}
async function listRepoFiles(commitSha) {
  const commit = await github(`/repos/${OWNER}/${REPO}/git/commits/${commitSha}`, {}, { requireToken: false });
  const tree = await github(`/repos/${OWNER}/${REPO}/git/trees/${commit.tree.sha}?recursive=1`, {}, { requireToken: false });
  return tree.tree.filter((item) => item.type === "blob" && isAiEditablePath(item.path) && (item.size ?? 0) <= MAX_FILE_CHARS).map((item) => item.path);
}
function geminiKey() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY n\xE3o est\xE1 configurada na Vercel.");
  return apiKey;
}
async function geminiModels(apiKey) {
  if (cachedModels && Date.now() - cachedModels.at < 10 * 6e4) return cachedModels.models;
  const modelListResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const modelList = modelListResponse.ok ? await modelListResponse.json() : null;
  const preferredModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const availableModels = (modelList?.models || []).filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => String(model.name || "").replace(/^models\//, ""));
  const models = preferredModels.filter((model) => availableModels.length === 0 || availableModels.includes(model));
  const result = models.length ? models : ["gemini-3.8-flash"];
  cachedModels = { at: Date.now(), models: result };
  return result;
}
async function callGemini(requestBody) {
  const apiKey = geminiKey();
  let response = null;
  let body = null;
  let lastError = "resposta inv\xE1lida";
  for (const model of await geminiModels(apiKey)) {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });
    body = await response.json();
    if (response.ok) break;
    lastError = `${model}: ${body.error?.message || `HTTP ${response.status}`}`;
  }
  if (!response?.ok) throw new Error(`Gemini indispon\xEDvel: ${lastError}`);
  return body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}
function buildUserParts(prompt, attachments = []) {
  const parts = [{ text: prompt }];
  for (const file of attachments) {
    if (file.kind === "text") parts.push({ text: `
--- Arquivo anexado pelo usu\xE1rio: ${file.name} ---
${file.data}` });
    else parts.push({ text: `
(Anexo: ${file.name})` }, { inlineData: { mimeType: file.kind === "pdf" ? "application/pdf" : file.mimeType, data: file.data } });
  }
  return parts;
}
function historyText(history) {
  return history.slice(-12).map((message) => `${message.role === "user" ? "Usu\xE1rio" : "Assistente"}: ${message.content}`).join("\n");
}
async function pickFiles(prompt, attachments, history, repoFiles) {
  const system = `Voc\xEA ajuda a escolher arquivos de c\xF3digo do sistema GondUp (React + tRPC). Com base no pedido do usu\xE1rio, no hist\xF3rico e nos anexos (prints de tela, arquivos), escolha no m\xE1ximo ${MAX_SELECTED_FILES} arquivos da lista que precisam ser lidos para entender ou corrigir o problema. Prefira as p\xE1ginas em client/src/pages e componentes citados. Responda s\xF3 JSON {"paths":["..."]}.

Hist\xF3rico:
${historyText(history) || "(primeira mensagem)"}

Arquivos dispon\xEDveis:
${repoFiles.join("\n")}`;
  const text4 = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: buildUserParts(prompt, attachments) }],
    generationConfig: { temperature: 0, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: { type: "OBJECT", properties: { paths: { type: "ARRAY", items: { type: "STRING" } } }, required: ["paths"] } }
  });
  try {
    const parsed = JSON.parse(text4.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim());
    const set = new Set(repoFiles);
    return (Array.isArray(parsed.paths) ? parsed.paths : []).filter((p) => typeof p === "string" && set.has(p)).slice(0, MAX_SELECTED_FILES);
  } catch {
    return [];
  }
}
async function askGemini(prompt, files, history, attachments, canOpenPr, codeNote) {
  const editable = files.map((file) => file.path);
  const context = files.length ? files.map((file) => `
--- ${file.path} ---
${file.content}`).join("\n") : `(${codeNote || "nenhum arquivo precisa ser consultado para esta conversa"})`;
  const changeRules = canOpenPr && editable.length ? `Voc\xEA pode propor altera\xE7\xF5es SOMENTE nestes arquivos (os que foram carregados abaixo): ${editable.join(", ")}.
S\xF3 inclua changes quando o usu\xE1rio pedir explicitamente uma altera\xE7\xE3o. Quando for solicitada uma altera\xE7\xE3o, devolva o arquivo COMPLETO em changes, nunca um diff e nunca conte\xFAdo parcial. No m\xE1ximo 4 arquivos por vez. N\xE3o invente arquivos nem diga que publicou algo: o servidor abrir\xE1 um Pull Request para revis\xE3o humana; nada \xE9 publicado sem o merge de uma pessoa. Preserve o funcionamento existente, n\xE3o remova recursos sem pedido expl\xEDcito e mantenha o layout funcionando no celular (telas de 360 px).` : `Nesta conversa voc\xEA N\xC3O pode alterar arquivos: retorne changes vazio. Se o usu\xE1rio pedir uma altera\xE7\xE3o, explique o que mudaria e em quais arquivos.`;
  const system = `Voc\xEA \xE9 o assistente de IA e engenheiro de software do GondUp. Converse naturalmente e responda em portugu\xEAs brasileiro, sempre levando em conta exatamente o que o usu\xE1rio escreveu, os anexos (prints de tela, fotos, PDFs e arquivos) e o hist\xF3rico fornecido. Quando houver print de tela, descreva o que v\xEA e relacione com o c\xF3digo. Voc\xEA deve responder perguntas, explicar conceitos, procurar bugs, sugerir melhorias de layout e ajudar a atualizar c\xF3digo obsoleto.

${changeRules}

Retorne SOMENTE JSON v\xE1lido no formato:
{"reply":"resposta objetiva","changes":[{"path":"arquivo permitido","content":"conte\xFAdo completo","reason":"motivo"}]}

Hist\xF3rico recente da conversa:
${historyText(history) || "(primeira mensagem)"}

C\xF3digo atual:${context}`;
  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING" },
      changes: { type: "ARRAY", items: { type: "OBJECT", properties: { path: { type: "STRING" }, content: { type: "STRING" }, reason: { type: "STRING" } }, required: ["path", "content"] } }
    },
    required: ["reply", "changes"]
  };
  const text4 = await callGemini({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: buildUserParts(prompt, attachments) }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json", responseSchema }
  });
  const cleaned = text4.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
      }
    }
    if (cleaned) return {
      reply: /^an error\b/i.test(cleaned) ? "O Gemini respondeu com uma mensagem de indisponibilidade tempor\xE1ria. Tente enviar novamente em alguns segundos." : cleaned,
      changes: []
    };
    return { reply: "N\xE3o consegui interpretar a resposta do Gemini. Tente enviar a mensagem novamente.", changes: [] };
  }
}
async function loadCode(prompt, attachments, history) {
  const ref = await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`, {}, { requireToken: false });
  const repoFiles = await listRepoFiles(ref.object.sha);
  const picked = await pickFiles(prompt, attachments, history, repoFiles).catch(() => []);
  const paths = Array.from(/* @__PURE__ */ new Set([...picked, ...baseFiles])).filter((p) => repoFiles.includes(p) || extraEditableFiles.includes(p));
  const files = [];
  let total = 0;
  for (const file of await Promise.all(paths.map((path3) => readFile(path3, ref.object.sha).catch(() => null)))) {
    if (!file || file.content.length > MAX_FILE_CHARS || total + file.content.length > MAX_CONTEXT_CHARS) continue;
    total += file.content.length;
    files.push({ path: file.path, content: file.content });
  }
  return { baseSha: ref.object.sha, files };
}
async function runPersistentGemini(prompt, history = [], attachments = []) {
  const wantsChange = asksForChange(prompt);
  const canOpenPr = hasGithubToken();
  let code = null;
  let codeNote = "";
  let setupNotice = "";
  if (needsCode(prompt, attachments.length > 0)) {
    try {
      code = await loadCode(prompt, attachments, history);
    } catch (error) {
      if (!(error instanceof GithubSetupError)) throw error;
      codeNote = "n\xE3o foi poss\xEDvel ler o c\xF3digo no GitHub agora";
      setupNotice = error.message;
    }
  }
  if (wantsChange && !canOpenPr && !setupNotice) {
    setupNotice = `Para eu abrir a corre\xE7\xE3o como Pull Request, falta conectar o GitHub: configure a vari\xE1vel GITHUB_TOKEN na Vercel (token com acesso ao reposit\xF3rio ${REPO_LABEL}, "Contents" e "Pull requests" com leitura e escrita).`;
  }
  const result = await askGemini(prompt, code?.files ?? [], history, attachments, canOpenPr && Boolean(code), codeNote);
  const allowed = new Set((code?.files ?? []).map((file) => file.path));
  const changes = wantsChange ? (result.changes || []).filter((change) => allowed.has(change.path) && isAiEditablePath(change.path) && typeof change.content === "string") : [];
  const withNotice = (text4) => setupNotice ? `${text4}

\u26A0\uFE0F ${setupNotice}` : text4;
  if (!changes.length || !code || !canOpenPr) return { reply: withNotice(result.reply || "Estou aqui para responder sua mensagem. O que voc\xEA gostaria de saber?"), changed: false };
  if (changes.length > 4) return { reply: `${result.reply}

\u26A0\uFE0F A solicita\xE7\xE3o gerou arquivos demais para uma \xFAnica altera\xE7\xE3o segura. Pe\xE7a uma parte de cada vez.`, changed: false };
  for (const change of changes) {
    if (change.content.length > 3e5) return { reply: `${result.reply}

\u26A0\uFE0F O arquivo ${change.path} ficou grande demais para uma altera\xE7\xE3o segura.`, changed: false };
  }
  try {
    const baseCommitSha = code.baseSha;
    const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
    const treeEntries = [];
    for (const change of changes) {
      const blob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: change.content, encoding: "utf-8" }) });
      treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
    const summary = prompt.slice(0, 72).replace(/\n/g, " ").trim();
    const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message: `feat(ai): ${summary}`, tree: tree.sha, parents: [baseCommitSha] }) });
    const aiBranch = buildAiBranchName();
    if (aiBranch === BRANCH) throw new Error("Nome de branch inv\xE1lido para a altera\xE7\xE3o da IA.");
    await github(`/repos/${OWNER}/${REPO}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${aiBranch}`, sha: commit.sha }) });
    const pr = await github(`/repos/${OWNER}/${REPO}/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: `feat(ai): ${summary}`,
        head: aiBranch,
        base: BRANCH,
        body: `Altera\xE7\xE3o proposta pelo assistente de IA (suporte inteligente).

**Pedido:** ${prompt.slice(0, 1e3)}${attachments.length ? `

**Anexos:** ${attachments.map((a) => a.name).join(", ")}` : ""}

**Arquivos alterados:**
${changes.map((change) => `- \`${change.path}\`${change.reason ? `: ${change.reason}` : ""}`).join("\n")}

\u26A0\uFE0F Revise o c\xF3digo antes do merge. Nada \xE9 publicado at\xE9 que uma pessoa fa\xE7a o merge deste PR.`
      })
    });
    return {
      reply: `${result.reply || "Altera\xE7\xE3o preparada."}

Abri um Pull Request para revis\xE3o: ${pr.html_url}. Nada foi publicado ainda; uma pessoa precisa revisar e fazer o merge.`,
      changed: true,
      commitSha: commit.sha,
      commitUrl: `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`,
      pullRequestUrl: pr.html_url,
      branch: aiBranch,
      files: changes.map((change) => change.path)
    };
  } catch (error) {
    if (error instanceof GithubSetupError) return { reply: `${result.reply}

\u26A0\uFE0F N\xE3o consegui abrir o Pull Request: ${error.message}`, changed: false };
    throw error;
  }
}
var GITHUB_API, OWNER, REPO, BRANCH, REPO_LABEL, baseFiles, extraEditableFiles, MAX_SELECTED_FILES, MAX_FILE_CHARS, MAX_CONTEXT_CHARS, GithubSetupError, cachedModels;
var init_aiGithubService = __esm({
  "server/aiGithubService.ts"() {
    "use strict";
    GITHUB_API = "https://api.github.com";
    OWNER = process.env.GITHUB_REPO_OWNER || "IvanMHonemann";
    REPO = process.env.GITHUB_REPO_NAME || "promotores-saas";
    BRANCH = process.env.GITHUB_REPO_BRANCH || "main";
    REPO_LABEL = `${OWNER}/${REPO}`;
    baseFiles = [
      "client/src/App.tsx",
      "client/src/index.css"
    ];
    extraEditableFiles = ["package.json", "vercel.json", "client/src/components/AIChatBox.tsx"];
    MAX_SELECTED_FILES = 6;
    MAX_FILE_CHARS = 15e4;
    MAX_CONTEXT_CHARS = 6e5;
    GithubSetupError = class extends Error {
    };
    cachedModels = null;
  }
});

// shared/aiAttachments.ts
function aiAttachmentsSize(list) {
  return list.reduce((sum, item) => sum + item.data.length, 0);
}
var AI_MAX_ATTACHMENTS, AI_MAX_PICK_BYTES, AI_MAX_PDF_BYTES, AI_MAX_TEXT_CHARS, AI_MAX_TOTAL_CHARS, AI_IMAGE_TYPES;
var init_aiAttachments = __esm({
  "shared/aiAttachments.ts"() {
    "use strict";
    AI_MAX_ATTACHMENTS = 5;
    AI_MAX_PICK_BYTES = 10 * 1024 * 1024;
    AI_MAX_PDF_BYTES = 3 * 1024 * 1024;
    AI_MAX_TEXT_CHARS = 2e5;
    AI_MAX_TOTAL_CHARS = 4e6;
    AI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
  }
});

// server/routers.ts
import { z as z17 } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError as TRPCError26 } from "@trpc/server";
var companyUserRole, entitlementFeatureKey, permissionModeSchema, featurePermissionListSchema, platformTestSessions, platformTestKey, getPlatformTestSession, appRouter;
var init_routers = __esm({
  "server/routers.ts"() {
    "use strict";
    init_csv();
    init_const();
    init_timeTracking();
    init_timesheetMirror2();
    init_router();
    init_router2();
    init_timesheetArchive();
    init_vacations();
    init_platformCompanies2();
    init_platformAnnouncements3();
    init_legal();
    init_liveErrors();
    init_companyRegistry();
    init_storePhotos();
    init_storeClients2();
    init_products2();
    init_rateLimit();
    init_authThrottle();
    init_cookies();
    init_systemRouter();
    init_trpc();
    init_subscriptionAccess();
    init_planLimits();
    init_db();
    init_memberAuth();
    init_supervisorTeam();
    init_email();
    init_audit();
    init_geocoding();
    init_geo();
    init_storeAccess();
    init_entitlements();
    init_entitlements2();
    init_aiGithubService();
    init_aiAttachments();
    init_expiry();
    init_offlineSync();
    companyUserRole = z17.enum(["company_admin", "supervisor", "promoter"]);
    entitlementFeatureKey = z17.enum(ENTITLEMENT_KEYS);
    permissionModeSchema = z17.enum(["inherit", "allow", "deny"]);
    featurePermissionListSchema = z17.array(z17.object({ featureKey: entitlementFeatureKey, mode: permissionModeSchema })).max(ENTITLEMENT_KEYS.length);
    platformTestSessions = /* @__PURE__ */ new Map();
    platformTestKey = (platformAdminId, fallbackId) => platformAdminId ?? fallbackId;
    getPlatformTestSession = (key) => platformTestSessions.get(key) ?? { status: "pending", photoCount: 0, lastPhotoAt: null, lastLatitude: null, lastLongitude: null };
    appRouter = router({
      system: systemRouter,
      timeTracking: timeTrackingRouter,
      timesheetMirror: timesheetMirrorRouter,
      registry: companyRegistryRouter,
      pontoLegal: pontoLegalRouter,
      lgpd: lgpdRouter,
      timesheetArchive: timesheetArchiveRouter,
      vacations: vacationsRouter,
      platformCompanies: platformCompaniesRouter,
      announcements: announcementsRouter,
      legal: legalRouter,
      storePhotos: storePhotosRouter,
      storeClients: storeClientsRouter,
      entitlements: router({
        mine: companyBillingProcedure.query(async ({ ctx }) => {
          if (ctx.actingAsPlatform) {
            const base = await getCompanyEntitlementBase(ctx.accountId);
            const effective = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, true]));
            return {
              ...base,
              memberAccountId: 0,
              role: "company_admin",
              memberOverrides: {},
              effective,
              effectiveFeatureKeys: [...ENTITLEMENT_KEYS]
            };
          }
          if (!ctx.memberAccountId) throw new TRPCError26({ code: "FORBIDDEN", message: "Usu\xE1rio da empresa n\xE3o encontrado." });
          return getMemberEntitlementSnapshot(ctx.accountId, ctx.memberAccountId, ctx.user.role);
        })
      }),
      auth: router({
        me: publicProcedure.query(({ ctx }) => ctx.user),
        /** Cadastro público: cria empresa + admin com plano opcional (trial 14 dias). */
        signup: publicProcedure.input(z17.object({
          companyName: z17.string().min(2, "Nome da empresa \xE9 obrigat\xF3rio"),
          userName: z17.string().min(2, "Nome do respons\xE1vel \xE9 obrigat\xF3rio"),
          email: z17.string().email(),
          password: z17.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
          planId: z17.number().int().positive("Selecione um plano antes de criar a conta"),
          paymentConfirmed: z17.boolean().refine((v) => v === true, { message: "Confirme o pagamento para criar a conta." })
        })).mutation(async ({ ctx, input }) => {
          const signupKey = `signup:${getClientIp(ctx.req)}`;
          if (await isThrottled(signupKey)) {
            throw new TRPCError26({ code: "TOO_MANY_REQUESTS", message: "Muitos cadastros deste endere\xE7o. Tente novamente em alguns minutos." });
          }
          await registerThrottleFailure(signupKey);
          try {
            const created = await createCompanyWithAdmin({
              companyName: input.companyName,
              userName: input.userName,
              email: input.email,
              password: input.password,
              planId: input.planId
            });
            void (async () => {
              try {
                let planName = null;
                if (created.planId) {
                  const plans = await listSubscriptionPlans();
                  planName = plans.find((p) => p.id === created.planId)?.name ?? null;
                }
                await emailAccountCreated({
                  to: input.email,
                  userName: input.userName,
                  companyName: input.companyName,
                  email: input.email,
                  recoveryCode: created.recoveryCode,
                  planName,
                  isTrial: true
                });
                await emailAdminNewCompany({
                  companyName: input.companyName,
                  userName: input.userName,
                  email: input.email,
                  planName,
                  isTrial: true
                });
              } catch (err) {
                console.warn("[email] signup notify failed", err);
              }
            })();
            const principal = await authenticateMember(input.email, input.password);
            if (principal) {
              const session = await createSession(principal);
              ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1e3 });
            }
            return { success: true, ...created };
          } catch (error) {
            if (error?.code === "ER_DUP_ENTRY") {
              throw new TRPCError26({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
            }
            throw error;
          }
        }),
        login: publicProcedure.input(z17.object({ email: z17.string().email(), password: z17.string().min(1) })).mutation(async ({ ctx, input }) => {
          const ip = getClientIp(ctx.req);
          const limit = checkRateLimit(ip, "login");
          if (!limit.ok) {
            throw new TRPCError26({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto." });
          }
          const principal = await authenticateMember(input.email, input.password);
          if (!principal) {
            void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
            throw new TRPCError26({ code: "UNAUTHORIZED", message: "E-mail ou senha inv\xE1lidos." });
          }
          if (principal.kind === "company") {
            const company = await getCompanyById(principal.account.companyId);
            if (!company || company.active === false) {
              const reason = company ? await getSetting("blocked_reason", company.id, "") : "";
              throw new TRPCError26({ code: "FORBIDDEN", message: reason || "Acesso da empresa bloqueado. Entre em contato com o suporte." });
            }
          }
          const session = await createSession(principal);
          ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1e3 });
          const user = principal.kind === "platform" ? {
            id: principal.account.id,
            openId: `platform:${principal.account.id}`,
            name: principal.account.userName,
            email: principal.account.email,
            loginMethod: "password",
            role: "platform_admin",
            createdAt: principal.account.createdAt,
            updatedAt: principal.account.updatedAt,
            lastSignedIn: principal.account.createdAt
          } : {
            id: -principal.account.id,
            openId: `member:${principal.account.id}`,
            name: principal.account.userName,
            email: principal.account.email,
            loginMethod: "password",
            role: normalizeMemberRole(String(principal.account.role)),
            companyId: principal.account.companyId,
            createdAt: principal.account.createdAt,
            updatedAt: principal.account.updatedAt,
            lastSignedIn: principal.account.createdAt
          };
          void auditFromCtx(ctx, {
            companyId: principal.companyId ?? null,
            action: "login",
            module: "auth",
            entityType: "session",
            description: `Login realizado: ${input.email}`,
            newData: { email: input.email, kind: session.kind }
          });
          return { success: true, kind: session.kind, user, sessionToken: session.rawToken };
        }),
        recoverPassword: publicProcedure.input(z17.object({ email: z17.string().email(), recoveryCode: z17.string().min(1), newPassword: z17.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ input }) => {
          const recovered = await recoverPassword(input.email, input.recoveryCode, input.newPassword);
          if (!recovered) throw new TRPCError26({ code: "UNAUTHORIZED", message: "E-mail ou c\xF3digo de recupera\xE7\xE3o inv\xE1lido." });
          return { success: true, recoveryCode: recovered.recoveryCode };
        }),
        /** "Esqueci minha senha": resposta sempre igual (não revela se o e-mail existe). */
        requestPasswordReset: publicProcedure.input(z17.object({ email: z17.string().trim().email() })).mutation(async ({ input }) => {
          const message = "Se o e-mail estiver cadastrado, enviaremos um link para criar uma nova senha. Se n\xE3o chegar em alguns minutos, use o c\xF3digo de recupera\xE7\xE3o ou fale com o suporte.";
          if (!isPasswordResetAvailable() || !await allowPasswordResetRequest(input.email)) return { success: true, message };
          try {
            const reset = await createPasswordResetToken(input.email);
            if (reset) await emailPasswordReset({ to: input.email, userName: reset.userName, token: reset.token });
          } catch (error) {
            console.warn("[auth] password reset request failed", error);
          }
          return { success: true, message };
        }),
        resetPasswordWithToken: publicProcedure.input(z17.object({ token: z17.string().min(10).max(2e3), newPassword: z17.string().min(8, "A nova senha deve ter pelo menos 8 caracteres").max(200) })).mutation(async ({ input }) => {
          const ok = await resetPasswordWithToken(input.token, input.newPassword);
          if (!ok) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Link inv\xE1lido ou expirado. Pe\xE7a um novo link." });
          return { success: true };
        }),
        changePassword: publicProcedure.use(async (opts) => {
          if (!opts.ctx.user) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Please login (10001)" });
          return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
        }).input(z17.object({ currentPassword: z17.string().min(1), newPassword: z17.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ ctx, input }) => {
          const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
          await assertPromoterNotOnVacation2(ctx);
          const changed = ctx.user.role === "platform_admin" ? await changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword) : await changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
          if (!changed) throw new TRPCError26({ code: "UNAUTHORIZED", message: "A senha atual est\xE1 incorreta." });
          return { success: true };
        }),
        updateProfile: publicProcedure.use(async (opts) => {
          if (!opts.ctx.user) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Please login (10001)" });
          return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
        }).input(z17.object({
          userName: z17.string().min(2).optional(),
          avatarDataUrl: z17.string().max(4e5).optional().nullable()
        })).mutation(async ({ ctx, input }) => {
          const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
          await assertPromoterNotOnVacation2(ctx);
          if (ctx.user.role === "platform_admin") {
            throw new TRPCError26({ code: "BAD_REQUEST", message: "Perfil de plataforma n\xE3o usa esta rota." });
          }
          const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
          const companyId = ctx.accountId;
          if (!companyId) throw new TRPCError26({ code: "FORBIDDEN", message: "Empresa n\xE3o identificada." });
          let userName = ctx.user.name || "";
          if (input.userName) {
            const updated = await updateMemberProfile(memberId, { userName: input.userName });
            userName = updated.userName;
          }
          if (input.avatarDataUrl !== void 0) {
            const key = `member_avatar_${memberId}`;
            if (!input.avatarDataUrl) {
              await setSetting(key, "", companyId);
            } else {
              if (!input.avatarDataUrl.startsWith("data:image/")) {
                throw new TRPCError26({ code: "BAD_REQUEST", message: "Imagem de perfil inv\xE1lida." });
              }
              await setSetting(key, input.avatarDataUrl, companyId);
            }
          }
          return { success: true, userName };
        }),
        profileExtras: publicProcedure.use(async (opts) => {
          if (!opts.ctx.user) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Please login (10001)" });
          return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
        }).query(async ({ ctx }) => {
          if (ctx.user.role === "platform_admin" || !ctx.accountId) {
            return { avatarDataUrl: null, alertDays: 30 };
          }
          const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
          const avatar = await getSetting(`member_avatar_${memberId}`, ctx.accountId, "");
          const alertDays = parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30;
          return { avatarDataUrl: avatar || null, alertDays };
        }),
        regenerateRecoveryCode: publicProcedure.use(async (opts) => {
          if (!opts.ctx.user) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Please login (10001)" });
          return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
        }).input(z17.object({ currentPassword: z17.string().min(1) })).mutation(async ({ ctx, input }) => {
          const { assertPromoterNotOnVacation: assertPromoterNotOnVacation2 } = await Promise.resolve().then(() => (init_vacationLock2(), vacationLock_exports));
          await assertPromoterNotOnVacation2(ctx);
          if (ctx.user.role === "platform_admin") {
            throw new TRPCError26({ code: "BAD_REQUEST", message: "Indispon\xEDvel para admin da plataforma nesta tela." });
          }
          const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
          const ok = await verifyMemberPassword(memberId, input.currentPassword);
          if (!ok) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
          const result = await regenerateMemberRecoveryCode(memberId);
          return { success: true, recoveryCode: result.recoveryCode };
        }),
        logoutAllSessions: publicProcedure.use(async (opts) => {
          if (!opts.ctx.user) throw new TRPCError26({ code: "UNAUTHORIZED", message: "Please login (10001)" });
          return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
        }).mutation(async ({ ctx }) => {
          if (ctx.user.role === "platform_admin") return { success: true };
          const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
          await revokeAllMemberSessions(memberId);
          return { success: true };
        }),
        logout: publicProcedure.mutation(async ({ ctx }) => {
          const cookies = parseCookie(ctx.req.headers.cookie ?? "");
          void auditFromCtx(ctx, { action: "logout", module: "auth", entityType: "session", description: `Logout: ${ctx.user?.email || "sess\xE3o"}` });
          await revokeSessions(cookies[MEMBER_COOKIE_NAME] ?? "");
          const memberCookieOptions = getSessionCookieOptions(ctx.req, true);
          if (cookies[MEMBER_COOKIE_NAME]) ctx.res.clearCookie(MEMBER_COOKIE_NAME, { ...memberCookieOptions, maxAge: -1 });
          return { success: true };
        })
      }),
      offline: router({}),
      platform: router({
        liveErrors: liveErrorsRouter,
        aiSupport: router({
          chat: platformProcedure.input(z17.object({
            prompt: z17.string().trim().min(1).max(12e3),
            history: z17.array(z17.object({ role: z17.enum(["user", "assistant"]), content: z17.string().max(12e3) })).max(30).optional(),
            attachments: z17.array(z17.object({
              name: z17.string().trim().min(1).max(200),
              mimeType: z17.string().max(100),
              kind: z17.enum(["image", "pdf", "text"]),
              data: z17.string().min(1).max(AI_MAX_TOTAL_CHARS)
            })).max(AI_MAX_ATTACHMENTS).optional()
          })).mutation(async ({ input }) => {
            const attachments = input.attachments ?? [];
            if (aiAttachmentsSize(attachments) > AI_MAX_TOTAL_CHARS) throw new TRPCError26({ code: "PAYLOAD_TOO_LARGE", message: "Os anexos passaram do limite de envio (cerca de 4 MB no total). Envie menos arquivos ou arquivos menores." });
            for (const file of attachments) {
              if (file.kind === "image" && !AI_IMAGE_TYPES.includes(file.mimeType)) throw new TRPCError26({ code: "BAD_REQUEST", message: `Formato de imagem n\xE3o aceito: ${file.name}.` });
              if (file.kind === "text" && file.data.length > AI_MAX_TEXT_CHARS) throw new TRPCError26({ code: "BAD_REQUEST", message: `O arquivo ${file.name} \xE9 grande demais.` });
            }
            return runPersistentGemini(input.prompt, input.history ?? [], attachments);
          })
        }),
        plans: router({
          list: platformProcedure.query(async () => {
            await ensureSeedPlans();
            return listSubscriptionPlans();
          }),
          create: platformProcedure.input(z17.object({
            name: z17.string().min(2),
            description: z17.string().optional().nullable(),
            price: z17.string().default("0.00"),
            billingCycle: z17.enum(["monthly", "yearly"]).default("monthly"),
            maxUsers: z17.number().int().positive().optional().nullable(),
            maxClients: z17.number().int().positive().optional().nullable(),
            maxExtinguishers: z17.number().int().positive().optional().nullable(),
            featureKeys: z17.array(entitlementFeatureKey).default([]),
            availableForNew: z17.boolean().default(true)
          })).mutation(({ input }) => createSubscriptionPlan(input)),
          update: platformProcedure.input(z17.object({
            id: z17.number().int().positive(),
            name: z17.string().min(2).optional(),
            description: z17.string().optional().nullable(),
            price: z17.string().optional(),
            billingCycle: z17.enum(["monthly", "yearly"]).optional(),
            maxUsers: z17.number().int().positive().optional().nullable(),
            maxClients: z17.number().int().positive().optional().nullable(),
            maxExtinguishers: z17.number().int().positive().optional().nullable(),
            featureKeys: z17.array(entitlementFeatureKey).optional(),
            availableForNew: z17.boolean().optional(),
            active: z17.boolean().optional()
          })).mutation(async ({ input }) => {
            const { id: id3, ...data } = input;
            return updateSubscriptionPlan(id3, data);
          })
        }),
        subscriptions: router({
          list: platformProcedure.query(() => listCompanySubscriptions()),
          stats: platformProcedure.query(() => getSubscriptionStats()),
          create: platformProcedure.input(z17.object({
            companyId: z17.number().int().positive(),
            planId: z17.number().int().positive(),
            status: z17.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).default("active"),
            startsAt: z17.string().min(8),
            endsAt: z17.string().optional().nullable(),
            notes: z17.string().optional().nullable()
          })).mutation(({ input }) => createCompanySubscription(input)),
          update: platformProcedure.input(z17.object({
            id: z17.number().int().positive(),
            planId: z17.number().int().positive().optional(),
            status: z17.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).optional(),
            startsAt: z17.string().min(8).optional(),
            endsAt: z17.string().optional().nullable(),
            notes: z17.string().optional().nullable()
          })).mutation(async ({ input }) => {
            const { id: id3, ...data } = input;
            return updateCompanySubscription(id3, data);
          })
        }),
        companyFeatures: router({
          get: platformProcedure.input(z17.object({ companyId: z17.number().int().positive() })).query(({ input }) => getCompanyEntitlementBase(input.companyId)),
          set: platformProcedure.input(z17.object({
            companyId: z17.number().int().positive(),
            overrides: featurePermissionListSchema,
            reason: z17.string().max(500).optional().nullable()
          })).mutation(async ({ ctx, input }) => {
            const overrides = Object.fromEntries(input.overrides.map(({ featureKey, mode }) => [
              featureKey,
              mode === "inherit" ? null : mode === "allow"
            ]));
            await replaceCompanyFeatureOverrides({
              companyId: input.companyId,
              overrides,
              updatedByPlatformAdminId: ctx.platformAdminId ?? null,
              reason: input.reason ?? null
            });
            return { success: true };
          })
        }),
        /** Compatibilidade do painel administrativo: somente platform_admin acessa estas operações globais. */
        identity: platformProcedure.query(({ ctx }) => ({ id: ctx.platformAdminId ?? ctx.user.id, role: "platform_admin", global: true })),
        reverseGeocodePoint: platformProcedure.input(z17.object({ latitude: z17.number().min(-90).max(90), longitude: z17.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
        testing: router({
          session: platformProcedure.query(({ ctx }) => {
            const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
            const session = getPlatformTestSession(key);
            platformTestSessions.set(key, session);
            return { visitId: 1, storeId: 1, storeName: "Loja de teste do administrador geral", ...session };
          }),
          reset: platformProcedure.mutation(({ ctx }) => {
            platformTestSessions.delete(platformTestKey(ctx.platformAdminId, ctx.user.id));
            return { success: true };
          }),
          start: platformProcedure.input(z17.object({ id: z17.number().int().positive(), latitude: z17.number().optional(), longitude: z17.number().optional(), accuracy: z17.number().optional() })).mutation(({ ctx, input }) => {
            if (input.id !== 1) throw new TRPCError26({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
            const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
            const session = getPlatformTestSession(key);
            if (session.status === "completed") throw new TRPCError26({ code: "BAD_REQUEST", message: "Reinicie a sess\xE3o de sandbox para testar novamente." });
            session.status = "in_progress";
            session.lastLatitude = input.latitude ?? null;
            session.lastLongitude = input.longitude ?? null;
            platformTestSessions.set(key, session);
            return { visitId: 1, storeId: 1, storeName: "Loja de teste do administrador geral", ...session };
          }),
          complete: platformProcedure.input(z17.object({ id: z17.number().int().positive(), latitude: z17.number().optional(), longitude: z17.number().optional(), accuracy: z17.number().optional() })).mutation(({ ctx, input }) => {
            if (input.id !== 1) throw new TRPCError26({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
            const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
            const session = getPlatformTestSession(key);
            if (session.status !== "in_progress") throw new TRPCError26({ code: "BAD_REQUEST", message: "Fa\xE7a o check-in antes do check-out." });
            session.status = "completed";
            session.lastLatitude = input.latitude ?? null;
            session.lastLongitude = input.longitude ?? null;
            platformTestSessions.set(key, session);
            return { visitId: 1, storeId: 1, storeName: "Loja de teste do administrador geral", ...session };
          }),
          uploadPhoto: platformProcedure.input(z17.object({ storeId: z17.number().int().positive().optional().nullable(), visitId: z17.number().int().positive().optional(), capturedAt: z17.string(), latitude: z17.number().optional(), longitude: z17.number().optional(), accuracy: z17.number().optional(), imageBase64: z17.string().min(100).max(6e6), mimeType: z17.string().default("image/jpeg"), idempotencyKey: z17.string().min(8).max(64) })).mutation(({ ctx, input }) => {
            if (input.visitId !== void 0 && input.visitId !== 1) throw new TRPCError26({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
            const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
            const session = getPlatformTestSession(key);
            session.photoCount += 1;
            session.lastPhotoAt = input.capturedAt;
            session.lastLatitude = input.latitude ?? null;
            session.lastLongitude = input.longitude ?? null;
            platformTestSessions.set(key, session);
            return { id: session.photoCount, sandbox: true };
          })
        }),
        companies: router({
          list: platformProcedure.query(() => listCompanies()),
          create: platformProcedure.input(z17.object({ companyName: z17.string().min(2), userName: z17.string().min(2), email: z17.string().email(), password: z17.string().min(8), featureKeys: z17.array(entitlementFeatureKey).optional() })).mutation(async ({ ctx, input }) => {
            try {
              const created = await createCompanyWithAdmin(input);
              const selected = new Set(input.featureKeys ?? []);
              const overrides = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, selected.has(key)]));
              await replaceCompanyFeatureOverrides({ companyId: created.companyId, overrides, updatedByPlatformAdminId: ctx.platformAdminId ?? null, reason: "Definido na cria\xE7\xE3o da empresa" });
              return created;
            } catch (error) {
              if (error?.code === "ER_DUP_ENTRY") throw new TRPCError26({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
              throw error;
            }
          }),
          update: platformProcedure.input(z17.object({ id: z17.number().int().positive(), name: z17.string().min(2).optional(), active: z17.boolean().optional() })).mutation(async ({ input }) => {
            await updateCompany(input.id, { name: input.name, active: input.active });
            return { success: true };
          })
        }),
        users: router({
          list: platformProcedure.query(() => listMemberAccounts()),
          create: platformProcedure.input(z17.object({ companyId: z17.number().int().positive(), userName: z17.string().min(2), email: z17.string().email(), password: z17.string().min(8), role: companyUserRole })).mutation(async ({ input, ctx }) => {
            const company = await getCompanyById(input.companyId);
            if (!company) throw new TRPCError26({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
            if (!company.active) throw new TRPCError26({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel criar usu\xE1rio em uma empresa bloqueada." });
            try {
              await assertUserLimit(input.companyId, input.role);
              const created = await createCompanyUser(input);
              void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usu\xE1rio criado pelo administrador geral: ${input.userName}`, newData: { companyId: input.companyId, email: input.email, role: input.role } });
              return created;
            } catch (error) {
              if (error?.code === "ER_DUP_ENTRY") throw new TRPCError26({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
              throw error;
            }
          })
        })
      }),
      accounts: router({
        list: platformProcedure.query(() => listMemberAccounts()),
        create: platformProcedure.input(z17.object({ companyName: z17.string().min(2), userName: z17.string().min(2), email: z17.string().email(), password: z17.string().min(8) })).mutation(async ({ input }) => {
          const created = await createCompanyWithAdmin(input);
          void (async () => {
            try {
              await emailAccountCreated({
                to: input.email,
                userName: input.userName,
                companyName: input.companyName,
                email: input.email,
                password: input.password,
                recoveryCode: created.recoveryCode,
                planName: null,
                isTrial: true
              });
              await emailAdminNewCompany({
                companyName: input.companyName,
                userName: input.userName,
                email: input.email,
                planName: null,
                isTrial: true
              });
            } catch (err) {
              console.warn("[email] platform create company notify failed", err);
            }
          })();
          return created;
        }),
        setActive: platformProcedure.input(z17.object({ id: z17.number().int().positive(), active: z17.boolean() })).mutation(async ({ ctx, input }) => {
          if (input.active) {
            const members = await listMemberAccounts();
            const target = members.find((m) => m.id === input.id);
            if (target && !target.active) await assertUserLimit(target.companyId, target.role);
          }
          await setMemberActive(input.id, input.active);
          void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Administrador geral ${input.active ? "liberou" : "bloqueou"} o usu\xE1rio #${input.id}` });
          return { success: true };
        }),
        resetPassword: platformProcedure.input(z17.object({ id: z17.number().int().positive(), newPassword: z17.string().min(8) })).mutation(async ({ input }) => {
          await resetMemberPassword(input.id, input.newPassword);
          return { success: true };
        })
      }),
      companyUsers: router({
        list: companyAdminFeatureProcedure("teamManagement").query(({ ctx }) => listMemberAccounts(ctx.accountId)),
        staffUsage: companyAdminFeatureProcedure("teamManagement").query(async ({ ctx }) => {
          const usage = await getStaffUsage(ctx.accountId);
          if (ctx.user.role === "company_admin") return usage;
          const { planPrice, additionalUserPrice, suggestedMonthlyAmount: suggestedMonthlyAmount2, ...safe } = usage;
          return safe;
        }),
        permissions: companyAdminFeatureProcedure("teamManagement").input(z17.object({ id: z17.number().int().positive() })).query(async ({ ctx, input }) => {
          const members = await listMemberAccounts(ctx.accountId);
          const target = members.find((member) => member.id === input.id);
          if (!target) throw new TRPCError26({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, target.role);
          return getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
        }),
        setPermissions: companyAdminFeatureProcedure("teamManagement").input(z17.object({
          id: z17.number().int().positive(),
          permissions: featurePermissionListSchema
        })).mutation(async ({ ctx, input }) => {
          const members = await listMemberAccounts(ctx.accountId);
          const target = members.find((member) => member.id === input.id);
          if (!target) throw new TRPCError26({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, target.role);
          const modes = Object.fromEntries(input.permissions.map(({ featureKey, mode }) => [featureKey, mode]));
          if (target.role === "company_admin" && modes.teamManagement === "deny") {
            throw new TRPCError26({ code: "BAD_REQUEST", message: "A permiss\xE3o de gest\xE3o da equipe n\xE3o pode ser bloqueada individualmente para um administrador da empresa." });
          }
          const base = await getCompanyEntitlementBase(ctx.accountId);
          for (const [featureKey, mode] of Object.entries(modes)) {
            if (mode === "allow" && !base.companyFeatures[featureKey]) {
              throw new TRPCError26({ code: "BAD_REQUEST", message: `O m\xF3dulo ${featureKey} n\xE3o est\xE1 liberado para esta empresa.` });
            }
            if (mode === "allow" && !ROLE_FEATURE_CEILING[target.role].includes(featureKey)) {
              throw new TRPCError26({ code: "BAD_REQUEST", message: `O papel ${target.role} n\xE3o permite liberar o m\xF3dulo ${featureKey}.` });
            }
          }
          const before = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
          await replaceMemberFeatureModes({ memberAccountId: target.id, modes, updatedByMemberAccountId: ctx.memberAccountId ?? null });
          const after = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
          void auditFromCtx(ctx, { action: "settings_change", module: "users", entityType: "user_permissions", entityId: target.id, entityLabel: target.userName, description: `Permiss\xF5es de m\xF3dulos atualizadas para ${target.userName}`, oldData: before.effective, newData: after.effective });
          return { success: true };
        }),
        create: companyAdminFeatureProcedure("teamManagement").input(z17.object({ userName: z17.string().min(2), email: z17.string().email(), password: z17.string().min(8), role: companyUserRole, storeIds: z17.array(z17.number().int().positive()).optional(), registry: memberRegistryInput.optional() })).mutation(async ({ ctx, input }) => {
          try {
            assertSupervisorPromoterOnly(ctx.user.role, input.role);
            await assertUserLimit(ctx.accountId, input.role);
            const { storeIds, registry: _registry, ...userInput } = input;
            const created = await createCompanyUser({ ...userInput, companyId: ctx.accountId });
            if (input.role === "promoter" && storeIds && storeIds.length > 0) {
              const database2 = await getDb();
              await setPromoterStoreAssignments(database2, ctx.accountId, created.accountId, storeIds);
            }
            if (input.registry) {
              await saveMemberRegistry(ctx.accountId, created.accountId, input.registry);
            }
            void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usu\xE1rio criado: ${input.userName} (${input.role})`, newData: { userName: input.userName, email: input.email, role: input.role, id: created.accountId } });
            void (async () => {
              try {
                const company = await getCompanyById(ctx.accountId);
                await emailAccountCreated({
                  to: input.email,
                  userName: input.userName,
                  companyName: company?.name || `Empresa #${ctx.accountId}`,
                  email: input.email,
                  password: input.password,
                  recoveryCode: created.recoveryCode,
                  planName: null,
                  isTrial: false
                });
              } catch (err) {
                console.warn("[email] company user notify failed", err);
              }
            })();
            return created;
          } catch (error) {
            if (error instanceof TRPCError26) throw error;
            if (error?.code === "ER_DUP_ENTRY") throw new TRPCError26({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
            console.error("[companyUsers.create] database error", { code: error?.code, errno: error?.errno, sqlMessage: error?.sqlMessage, message: error?.message });
            if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.code === "ER_NO_REFERENCED_ROW") throw new TRPCError26({ code: "BAD_REQUEST", message: "A empresa selecionada n\xE3o existe mais. Atualize a p\xE1gina e tente novamente." });
            if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") throw new TRPCError26({ code: "INTERNAL_SERVER_ERROR", message: "O banco de dados est\xE1 com a estrutura de usu\xE1rios desatualizada. A implanta\xE7\xE3o precisa concluir a migra\xE7\xE3o." });
            throw new TRPCError26({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar o usu\xE1rio. Verifique os dados e tente novamente." });
          }
        }),
        update: companyAdminFeatureProcedure("teamManagement").input(z17.object({ id: z17.number().int().positive(), userName: z17.string().min(2).optional(), email: z17.string().email().optional(), role: companyUserRole.optional(), registry: memberRegistryInput.optional() })).mutation(async ({ ctx, input }) => {
          if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError26({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode remover o pr\xF3prio n\xEDvel administrativo." });
          const usersBefore = await listMemberAccounts(ctx.accountId);
          const beforeUser = usersBefore.find((u) => u.id === input.id) || null;
          assertSupervisorPromoterOnly(ctx.user.role, beforeUser?.role);
          if (input.role) assertSupervisorPromoterOnly(ctx.user.role, input.role);
          try {
            await updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
          } catch (error) {
            if (error?.message === "A empresa precisa manter pelo menos um administrador ativo.") throw new TRPCError26({ code: "BAD_REQUEST", message: error.message });
            throw error;
          }
          if (input.registry) {
            await saveMemberRegistry(ctx.accountId, input.id, input.registry);
          }
          const usersAfter = await listMemberAccounts(ctx.accountId);
          const afterUser = usersAfter.find((u) => u.id === input.id) || null;
          const userDiff = diffAuditData(beforeUser, afterUser);
          void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: input.id, entityLabel: afterUser?.userName || beforeUser?.userName || `#${input.id}`, description: `Usu\xE1rio atualizado: ${afterUser?.userName || input.id}`, oldData: userDiff.oldData, newData: userDiff.newData });
          return { success: true };
        }),
        getPromoterStores: companyAdminFeatureProcedure("teamManagement").input(z17.object({ id: z17.number().int().positive() })).query(async ({ ctx, input }) => {
          const users3 = await listMemberAccounts(ctx.accountId);
          const target = users3.find((member) => member.id === input.id);
          if (!target) throw new TRPCError26({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, target.role);
          const database2 = await getDb();
          return getPromoterStoreAssignments(database2, ctx.accountId, input.id);
        }),
        updatePromoterManagement: companyAdminFeatureProcedure("teamManagement").input(z17.object({
          id: z17.number().int().positive(),
          userName: z17.string().trim().min(2).max(255),
          email: z17.string().trim().email().max(320),
          employeeCode: z17.string().trim().max(50).nullable(),
          workStartTime: z17.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
          workEndTime: z17.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
          weeklyRoutes: z17.array(z17.object({ weekday: z17.number().int().min(0).max(6), storeIds: z17.array(z17.number().int().positive()).min(1) })).max(7).optional(),
          storeIds: z17.array(z17.number().int().positive()).optional(),
          registry: memberRegistryInput.optional()
        })).mutation(async ({ ctx, input }) => {
          if (input.workStartTime && input.workEndTime && input.workEndTime <= input.workStartTime) {
            throw new TRPCError26({ code: "BAD_REQUEST", message: "O fim da jornada precisa ser posterior ao in\xEDcio." });
          }
          const usersBefore = await listMemberAccounts(ctx.accountId);
          const before = usersBefore.find((member) => member.id === input.id);
          if (!before || before.role !== "promoter") throw new TRPCError26({ code: "NOT_FOUND", message: "Promotor n\xE3o encontrado nesta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, before.role);
          try {
            await updatePromoterManagement({
              companyId: ctx.accountId,
              promoterId: input.id,
              userName: input.userName,
              email: input.email,
              employeeCode: input.employeeCode,
              workStartTime: input.workStartTime,
              workEndTime: input.workEndTime,
              weeklyRoutes: input.weeklyRoutes
            });
            if (input.storeIds !== void 0) {
              const database2 = await getDb();
              await setPromoterStoreAssignments(database2, ctx.accountId, input.id, input.storeIds);
            }
            if (input.registry) {
              await saveMemberRegistry(ctx.accountId, input.id, input.registry);
            }
          } catch (error) {
            if (error?.code === "ER_DUP_ENTRY") throw new TRPCError26({ code: "CONFLICT", message: "Este e-mail ou matr\xEDcula j\xE1 est\xE1 em uso." });
            if (error?.message?.includes("n\xE3o pertence") || error?.message?.includes("inativas") || error?.message?.includes("programa\xE7\xE3o") || error?.message?.includes("dia programado")) {
              throw new TRPCError26({ code: "BAD_REQUEST", message: error.message });
            }
            throw error;
          }
          const usersAfter = await listMemberAccounts(ctx.accountId);
          const after = usersAfter.find((member) => member.id === input.id);
          void auditFromCtx(ctx, { action: "update", module: "users", entityType: "promoter_profile", entityId: input.id, entityLabel: after?.userName || before.userName, description: `Cadastro e roteiro de ${after?.userName || before.userName} atualizados`, oldData: before, newData: after });
          return { success: true };
        }),
        setActive: companyAdminFeatureProcedure("teamManagement").input(z17.object({ id: z17.number().int().positive(), active: z17.boolean() })).mutation(async ({ ctx, input }) => {
          if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError26({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode desativar a pr\xF3pria sess\xE3o." });
          const membersForGuard = await listMemberAccounts(ctx.accountId);
          const existing = membersForGuard.find((m) => m.id === input.id);
          if (!existing) throw new TRPCError26({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, existing.role);
          if (input.active) {
            const target = existing;
            if (target && !target.active) await assertUserLimit(ctx.accountId, target.role);
          }
          await setMemberActive(input.id, input.active, ctx.accountId);
          void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Usu\xE1rio ${input.active ? "ativado" : "desativado"} #${input.id}`, newData: { active: input.active } });
          return { success: true };
        }),
        resetPassword: companyAdminFeatureProcedure("teamManagement").input(z17.object({ id: z17.number().int().positive(), newPassword: z17.string().min(8) })).mutation(async ({ ctx, input }) => {
          const users3 = await listMemberAccounts(ctx.accountId);
          const target = users3.find((account) => account.id === input.id);
          if (!target) throw new TRPCError26({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
          assertSupervisorPromoterOnly(ctx.user.role, target.role);
          await resetMemberPassword(input.id, input.newPassword);
          return { success: true };
        })
      }),
      // O dashboard é a tela básica de toda conta autenticada; módulos pagos
      // continuam usando commercialFeatureProcedure normalmente.
      companyProfile: router({
        updateName: companyAdminProcedure.input(z17.object({ name: z17.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
          await updateCompany(ctx.accountId, { name: input.name.trim() });
          void auditFromCtx(ctx, {
            action: "update",
            module: "company",
            entityType: "company",
            entityId: ctx.accountId,
            entityLabel: input.name.trim(),
            description: `Nome da empresa alterado para ${input.name.trim()}`,
            newData: { name: input.name.trim() }
          });
          return { success: true };
        })
      }),
      settings: router({
        getAutoClockOut: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => await getSetting("auto_clock_out_time", ctx.accountId, "")),
        setAutoClockOut: companyAdminFeatureProcedure("timeTracking").input(z17.object({ time: z17.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
          await setSetting("auto_clock_out_time", input.time || "", ctx.accountId);
          return { success: true, time: input.time || "" };
        }),
        getAlertDays: commercialFeatureProcedure("alerts").query(async ({ ctx }) => parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
        setAlertDays: companyAdminFeatureProcedure("alerts").input(z17.object({ days: z17.number().min(1).max(365) })).mutation(async ({ ctx, input }) => {
          const prev = await getSetting("alert_days_ahead", ctx.accountId, "30");
          await setSetting("alert_days_ahead", input.days.toString(), ctx.accountId);
          void auditFromCtx(ctx, { action: "settings_change", module: "settings", entityType: "setting", entityLabel: "alert_days_ahead", description: `Anteced\xEAncia de alertas alterada: ${prev} \u2192 ${input.days} dias`, oldData: { alert_days_ahead: prev }, newData: { alert_days_ahead: String(input.days) } });
          return { success: true, days: input.days };
        })
      }),
      inventoryAlerts: protectedProcedure.input(z17.object({ daysAhead: z17.number().optional() }).optional()).query(async ({ ctx }) => {
        if (!ctx.accountId || !ctx.user || ctx.user.role === "platform_admin") return [];
        const { inventoryAlertsFor: inventoryAlertsFor2 } = await Promise.resolve().then(() => (init_products2(), products_exports));
        try {
          return await inventoryAlertsFor2(ctx);
        } catch (error) {
          console.error("[inventoryAlerts] falha ao consultar validades", error);
          throw new TRPCError26({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel consultar as validades." });
        }
      }),
      // Endereço para carimbo de foto/ponto (qualquer membro da empresa). Feito no servidor com cache.
      geo: router({
        reverse: companyBillingProcedure.input(z17.object({ latitude: z17.number().min(-90).max(90), longitude: z17.number().min(-180).max(180) })).mutation(async ({ input }) => ({ address: await reverseGeocodeBr(input.latitude, input.longitude) }))
      }),
      trash: router({
        // Qualquer usuário autenticado da empresa; não-administradores só enxergam/operam o que apagaram ou é deles.
        list: companyBillingProcedure.query(({ ctx }) => listTrash(ctx.accountId, scopeMemberId(ctx))),
        restore: companyBillingProcedure.input(z17.object({ id: z17.number().int().positive() })).mutation(async ({ ctx, input }) => {
          const item = await restoreTrashItem(input.id, ctx.accountId, scopeMemberId(ctx));
          void auditFromCtx(ctx, { action: "restore", module: "trash", entityType: item.itemType, entityId: item.originalId, entityLabel: item.label, description: `Restaurou da lixeira: ${item.label}` });
          return { success: true };
        }),
        permanentlyDelete: companyBillingProcedure.input(z17.object({ id: z17.number().int().positive() })).mutation(async ({ ctx, input }) => {
          const item = await permanentlyDeleteTrashItem(input.id, ctx.accountId, scopeMemberId(ctx));
          void auditFromCtx(ctx, { action: "permanent_delete", module: "trash", entityType: item.itemType, entityId: item.originalId, entityLabel: item.label, description: `Excluiu definitivamente: ${item.label}` });
          return { success: true };
        })
      }),
      /** Planos públicos (sem login) — página de preços e cadastro. */
      publicCatalog: router({
        plans: publicProcedure.query(async () => {
          await ensureSeedPlans();
          return listAvailablePlansForCompanies();
        })
      }),
      /**
       * Consulta pública por QR Code — sem login.
       * Dados mínimos do equipamento; isolamento por token opaco (não enumerável).
       */
      /** Planos e assinatura da empresa (acesso mesmo com bloqueio para regularização). */
      billing: router({
        access: companyBillingProcedure.query(async ({ ctx }) => ({ ...await checkSubscriptionAccess(ctx.accountId), supportMessage: MANUAL_BILLING_MESSAGE })),
        plans: companyAdminProcedure.query(async () => {
          await ensureSeedPlans();
          const all = await listSubscriptionPlans();
          return all.filter((p) => p.active !== false);
        }),
        mySubscription: companyAdminProcedure.query(async ({ ctx }) => {
          const resolved = await resolveCompanyPlan(ctx.accountId);
          const effective = await getEffectivePlan(ctx.accountId);
          const plan = resolved.plan ? { ...resolved.plan, ...effective, id: effective.id ?? resolved.plan.id, name: effective.name } : effective;
          return { ...resolved, plan, effective };
        }),
        payments: companyAdminProcedure.query(async ({ ctx }) => listPaymentsForCompany(ctx.accountId)),
        /** Aviso de vencimento + Pix para o administrador da empresa (e tela de bloqueio). */
        paymentReminder: companyAdminProcedure.query(async ({ ctx }) => {
          const { getPaymentReminder: getPaymentReminder2 } = await Promise.resolve().then(() => (init_paymentReminder(), paymentReminder_exports));
          return getPaymentReminder2(ctx.accountId);
        })
        // Cobrança MANUAL: não há ativação/renovação de plano pelo próprio cliente.
        // A única via de ativação é platformCompanies.registerPayment / markPaid (administrador da plataforma).
      }),
      products: productsRouter,
      operations: router({
        promoters: router({
          list: commercialFeatureProcedure("fieldOperations").query(async ({ ctx }) => {
            if (ctx.user.role === "promoter") throw new TRPCError26({ code: "FORBIDDEN", message: "Promotores n\xE3o podem consultar a lista da equipe." });
            return (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter" && member.active).map(({ id: id3, userName, role, active }) => ({ id: id3, userName, role, active }));
          })
        }),
        stores: router({
          list: commercialFeatureProcedure("fieldOperations").input(z17.object({ search: z17.string().optional() }).optional()).query(({ ctx, input }) => listOperationalStores(ctx.accountId, input?.search, scopeMemberId(ctx))),
          create: commercialFeatureProcedure("fieldOperations").input(z17.object({ name: z17.string().min(2), city: z17.string().min(2), address: z17.string().optional(), state: z17.string().length(2).optional(), cep: z17.string().optional(), code: z17.string().optional(), latitude: z17.number().optional(), longitude: z17.number().optional(), notes: z17.string().optional() })).mutation(async ({ ctx, input }) => {
            if (ctx.user.role === "promoter") throw new TRPCError26({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem cadastrar lojas." });
            let coords = {};
            if (!isValidLatLng(input.latitude, input.longitude) && input.address?.trim()) {
              const geo = await geocodeStoreAddress({ address: input.address, city: input.city, state: input.state }).catch(() => null);
              if (geo) coords = { latitude: geo.latitude, longitude: geo.longitude };
            }
            return createOperationalStore({ ...input, ...coords, companyId: ctx.accountId, active: true }, ctx.memberAccountId ?? null);
          }),
          update: commercialFeatureProcedure("fieldOperations").input(z17.object({ id: z17.number().int().positive(), name: z17.string().trim().min(2).max(255).optional(), city: z17.string().trim().min(2).max(255).optional(), state: z17.string().trim().length(2).optional().or(z17.literal("")), address: z17.string().trim().max(500).optional(), latitude: z17.number().min(-90).max(90).nullable().optional(), longitude: z17.number().min(-180).max(180).nullable().optional() })).mutation(async ({ ctx, input }) => {
            if (ctx.user.role === "promoter") throw new TRPCError26({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem editar lojas." });
            const { id: id3, latitude, longitude, ...rest } = input;
            const current = await getOperationalStore(ctx.accountId, id3);
            if (!current) throw new TRPCError26({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
            const patch = { ...rest, state: rest.state === void 0 ? void 0 : rest.state ? rest.state.toUpperCase() : null };
            let located = "unchanged";
            if (latitude !== void 0 || longitude !== void 0) {
              const valid2 = isValidLatLng(latitude, longitude);
              if (!valid2 && !(latitude === null && longitude === null)) throw new TRPCError26({ code: "BAD_REQUEST", message: "Localiza\xE7\xE3o inv\xE1lida. Use o formato -29.6386, -51.0047." });
              patch.latitude = valid2 ? latitude : null;
              patch.longitude = valid2 ? longitude : null;
              located = "manual";
            } else {
              const changed = (k) => patch[k] !== void 0 && String(patch[k] ?? "").trim().toLowerCase() !== String(current[k] ?? "").trim().toLowerCase();
              if (changed("address") || changed("city") || changed("state")) {
                const geo = await geocodeStoreAddress({ address: patch.address ?? current.address, city: patch.city ?? current.city, state: patch.state ?? current.state }).catch(() => null);
                patch.latitude = geo?.latitude ?? null;
                patch.longitude = geo?.longitude ?? null;
                located = geo ? "address" : "not_found";
              }
            }
            const ok = await updateOperationalStore(ctx.accountId, id3, patch);
            if (!ok) throw new TRPCError26({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
            await auditFromCtx(ctx, { action: "update", module: "stores", entityType: "store", entityId: id3, description: `Loja editada: ${rest.name ?? `#${id3}`}`, newData: patch });
            return { success: true, located, latitude: patch.latitude ?? current.latitude ?? null, longitude: patch.longitude ?? current.longitude ?? null };
          }),
          // Busca a localização pelo endereço das lojas desta empresa que ainda não têm (poucas por vez; Nominatim 1/s).
          geocodeMissing: companyManagerProcedure.mutation(async ({ ctx }) => {
            const pending = await listStoresMissingCoordinates(ctx.accountId, 8);
            let found = 0;
            for (const store of pending) {
              const geo = await geocodeStoreAddress(store).catch(() => null);
              if (!geo) continue;
              await updateOperationalStore(ctx.accountId, store.id, { latitude: geo.latitude, longitude: geo.longitude });
              found += 1;
            }
            if (found) await auditFromCtx(ctx, { action: "update", module: "stores", entityType: "store", description: `Localiza\xE7\xE3o pelo endere\xE7o encontrada para ${found} loja(s)` });
            return { checked: pending.length, found };
          }),
          archive: companyManagerProcedure.input(z17.object({ id: z17.number().int().positive() })).mutation(async ({ ctx, input }) => {
            const store = await archiveOperationalStore(ctx.accountId, input.id);
            if (!store) throw new TRPCError26({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
            await auditFromCtx(ctx, { action: "delete", module: "stores", entityType: "store", entityId: input.id, description: `Loja removida da lista: ${store.name}` });
            return { success: true };
          })
        }),
        routes: router({
          list: commercialFeatureProcedure("fieldOperations").input(z17.object({ date: z17.string().optional(), promoterId: z17.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
            const date3 = input?.date || todayInZone();
            const ownerId = scopeMemberId(ctx);
            if (ownerId !== null) {
              await materializeWeeklyRoutes(ctx.accountId, ownerId, date3);
            } else {
              const members = await listMemberAccounts(ctx.accountId);
              const promoters = members.filter((m) => m.role === "promoter" && m.active);
              for (const p of promoters) {
                await materializeWeeklyRoutes(ctx.accountId, p.id, date3);
              }
            }
            const filterDate = ownerId === null && !input?.date ? void 0 : input?.date || date3;
            return listOperationalRoutes(ctx.accountId, { date: filterDate, promoterId: ownerId ?? input?.promoterId });
          }),
          // Promotor vê só os próprios roteiros semanais; administrador e supervisor veem todos.
          weekly: commercialFeatureProcedure("fieldOperations").query(async ({ ctx }) => {
            const ownerId = scopeMemberId(ctx);
            const rows4 = await listWeeklyRouteSchedules(ctx.accountId);
            return ownerId === null ? rows4 : rows4.filter((row2) => row2.promoterId === ownerId);
          }),
          saveWeekly: companyManagerProcedure.input(z17.object({ id: z17.number().int().positive().optional(), name: z17.string().trim().min(2).max(255), weekday: z17.number().int().min(0).max(6), promoterId: z17.number().int().positive(), storeIds: z17.array(z17.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
            const members = await listMemberAccounts(ctx.accountId);
            const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
            if (!promoter) throw new TRPCError26({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
            try {
              const saved = await saveWeeklyRouteSchedule({ ...input, companyId: ctx.accountId });
              void auditFromCtx(ctx, { action: input.id ? "update" : "create", module: "routes", entityType: "weekly_route", entityId: saved?.id, entityLabel: input.name, description: `Roteiro semanal salvo: ${input.name} (${promoter.userName})`, newData: input });
              return saved;
            } catch (error) {
              if (error instanceof WeeklyRouteConflictError) throw new TRPCError26({ code: "CONFLICT", message: error.message });
              if (error?.message?.includes("n\xE3o pertencem") || error?.message?.includes("ao menos uma loja")) throw new TRPCError26({ code: "BAD_REQUEST", message: error.message });
              throw error;
            }
          }),
          deleteWeekly: companyManagerProcedure.input(z17.object({ id: z17.number().int().positive() })).mutation(async ({ ctx, input }) => {
            const result = await deleteWeeklyRouteSchedule(ctx.accountId, input.id);
            if (!result.success) throw new TRPCError26({ code: "NOT_FOUND", message: "Roteiro n\xE3o encontrado." });
            void auditFromCtx(ctx, { action: "delete", module: "routes", entityType: "weekly_route", entityId: input.id, description: `Roteiro semanal exclu\xEDdo: #${input.id}` });
            return result;
          }),
          create: commercialFeatureProcedure("fieldOperations").input(z17.object({ name: z17.string().min(2), date: z17.string().min(8), promoterId: z17.number().int().positive(), storeIds: z17.array(z17.number().int().positive()).min(1), teamId: z17.number().int().positive().optional(), notes: z17.string().optional() })).mutation(async ({ ctx, input }) => {
            if (ctx.user.role === "promoter") throw new TRPCError26({ code: "FORBIDDEN", message: "Promotores n\xE3o podem criar roteiros." });
            const members = await listMemberAccounts(ctx.accountId);
            const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
            if (!promoter) throw new TRPCError26({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
            const { storeIds, ...route } = input;
            return createOperationalRouteWithVisits({ route: { ...route, date: /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`), companyId: ctx.accountId, status: "assigned" }, storeIds });
          }),
          update: companyManagerProcedure.input(z17.object({ id: z17.number().int().positive(), name: z17.string().optional(), promoterId: z17.number().int().positive().optional(), date: z17.string().optional(), storeIds: z17.array(z17.number().int().positive()).optional() })).mutation(async ({ ctx, input }) => {
            const { id: id3, ...data } = input;
            if (data.promoterId) {
              const members = await listMemberAccounts(ctx.accountId);
              const promoter = members.find((member) => member.id === data.promoterId && member.role === "promoter" && member.active);
              if (!promoter) throw new TRPCError26({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
            }
            try {
              return await updateOperationalRoute(ctx.accountId, id3, data);
            } catch (error) {
              if (error instanceof RouteValidationError) throw new TRPCError26({ code: "BAD_REQUEST", message: error.message });
              throw error;
            }
          }),
          delete: companyManagerProcedure.input(z17.object({ id: z17.number().int().positive() })).mutation(async ({ ctx, input }) => {
            try {
              return await deleteOperationalRoute(ctx.accountId, input.id);
            } catch (error) {
              if (error instanceof RouteValidationError) throw new TRPCError26({ code: "BAD_REQUEST", message: error.message });
              throw error;
            }
          })
        }),
        visits: router({
          today: commercialFeatureProcedure("fieldOperations").input(z17.object({ date: z17.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional()).query(async ({ ctx, input }) => {
            const date3 = input?.date || todayInZone();
            const promoterId = scopeMemberId(ctx) ?? void 0;
            if (promoterId) {
              try {
                await autoCloseStaleVisits(ctx.accountId, promoterId, date3);
              } catch (e) {
                console.warn("[visits] autoClose", e);
              }
              try {
                await materializeWeeklyRoutes(ctx.accountId, promoterId, date3);
              } catch (e) {
                console.warn("[visits] materialize", e);
              }
            }
            return listOperationalVisits(ctx.accountId, { date: date3, promoterId: promoterId ?? void 0 });
          }),
          list: commercialFeatureProcedure("fieldOperations").input(z17.object({ date: z17.string().optional(), routeId: z17.number().int().positive().optional(), promoterId: z17.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listOperationalVisits(ctx.accountId, { date: input?.date, routeId: input?.routeId, promoterId: scopeMemberId(ctx) ?? input?.promoterId })),
          /** Marcas "registrado offline" (horário do aparelho x recebimento) para os relatórios do gestor. */
          offlineMarks: commercialFeatureProcedure("fieldOperations").input(z17.object({ visitIds: z17.array(z17.number().int().positive()).max(500) })).query(({ ctx, input }) => listVisitOfflineMarks(ctx.accountId, input.visitIds)),
          start: commercialFeatureProcedure("visitCheckIn").input(z17.object({ id: z17.number().int().positive(), latitude: z17.number().optional(), longitude: z17.number().optional(), accuracy: z17.number().optional(), ...offlineVisitFields })).mutation(async ({ ctx, input }) => {
            const promoterId = scopeMemberId(ctx);
            if (input.clientId) {
              const prior = await findSubmission(ctx.accountId, input.clientId);
              if (prior) {
                if (prior.kind !== "visit_start" || prior.entityId !== input.id) throw new TRPCError26({ code: "CONFLICT", message: "Chave de envio j\xE1 usada em outro registro." });
                const [again] = await listOperationalVisits(ctx.accountId, { id: input.id, promoterId: promoterId ?? void 0 });
                if (again) return again;
              }
            }
            const when = resolveOfflineTime({ deviceTime: input.deviceTime, offline: input.offline, clock: input.clock, serverNow: /* @__PURE__ */ new Date() });
            const today = todayInZone();
            if (promoterId != null) {
              await autoCloseStaleVisits(ctx.accountId, promoterId, today);
            }
            const [owned] = await listOperationalVisits(ctx.accountId, { id: input.id, promoterId: promoterId ?? void 0 });
            if (!owned) throw new TRPCError26({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
            if (promoterId !== null && owned.visit.promoterId !== ctx.memberAccountId) throw new TRPCError26({ code: "FORBIDDEN", message: "Visita n\xE3o pertence ao promotor autenticado." });
            if (owned.visit.status !== "pending") return owned;
            if (promoterId != null) {
              const todayVisits = await listOperationalVisits(ctx.accountId, { promoterId, date: today });
              const openVisit = todayVisits.find((v) => v.visit.status === "in_progress" && v.visit.id !== input.id);
              if (openVisit) {
                const storeName = openVisit.store?.name || "a loja atual";
                throw new TRPCError26({
                  code: "CONFLICT",
                  message: `N\xE3o \xE9 poss\xEDvel fazer check-in em outra loja. Realize o check-out em "${storeName}" primeiro.`
                });
              }
            }
            const storeLat = owned.store?.latitude, storeLng = owned.store?.longitude;
            const distance = isValidLatLng(storeLat, storeLng) && isValidLatLng(input.latitude, input.longitude) ? Math.round(distanceMeters({ lat: storeLat, lng: storeLng }, { lat: input.latitude, lng: input.longitude })) : void 0;
            const started = await updateOperationalVisit(ctx.accountId, input.id, { status: "in_progress", actualStart: when.effectiveTime, startLatitude: input.latitude, startLongitude: input.longitude, startAccuracy: input.accuracy, ...distance !== void 0 ? { distanceMeters: distance } : {} });
            if (input.clientId) await recordSubmission({ companyId: ctx.accountId, memberAccountId: ctx.memberAccountId ?? null, clientId: input.clientId, kind: "visit_start", entityId: input.id, deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, offline: when.offline, alert: when.clockAlert ?? when.timeNote });
            return started;
          }),
          complete: commercialFeatureProcedure("visitCheckIn").input(z17.object({ id: z17.number().int().positive(), latitude: z17.number().optional(), longitude: z17.number().optional(), accuracy: z17.number().optional(), notes: z17.string().optional(), ...offlineVisitFields })).mutation(async ({ ctx, input }) => {
            const [owned] = await listOperationalVisits(ctx.accountId, { id: input.id, promoterId: scopeMemberId(ctx) ?? void 0 });
            if (!owned) throw new TRPCError26({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
            if (input.clientId) {
              const prior = await findSubmission(ctx.accountId, input.clientId);
              if (prior && (prior.kind !== "visit_complete" || prior.entityId !== input.id)) throw new TRPCError26({ code: "CONFLICT", message: "Chave de envio j\xE1 usada em outro registro." });
              if (prior) return owned;
            }
            if (owned.visit.status === "completed") return owned;
            const when = resolveOfflineTime({ deviceTime: input.deviceTime, offline: input.offline, clock: input.clock, serverNow: /* @__PURE__ */ new Date() });
            const startMs = owned.visit.actualStart ? new Date(owned.visit.actualStart).getTime() : null;
            const endTime = startMs != null && when.effectiveTime.getTime() < startMs ? new Date(startMs) : when.effectiveTime;
            const alert = [when.clockAlert, when.timeNote, endTime !== when.effectiveTime ? "Check-out offline com hor\xE1rio anterior ao check-in; usado o hor\xE1rio do check-in." : null].filter(Boolean).join(" ") || null;
            const completed = await updateOperationalVisit(ctx.accountId, input.id, { status: "completed", actualEnd: endTime, endLatitude: input.latitude, endLongitude: input.longitude, endAccuracy: input.accuracy, notes: input.notes });
            if (input.clientId) await recordSubmission({ companyId: ctx.accountId, memberAccountId: ctx.memberAccountId ?? null, clientId: input.clientId, kind: "visit_complete", entityId: input.id, deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, offline: when.offline, alert });
            return completed;
          })
        })
      }),
      audit: router({
        promoters: companyAdminFeatureProcedure("reports").query(
          async ({ ctx }) => (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter").map(({ id: id3, userName, email, active }) => ({ id: id3, userName, email, active }))
        ),
        reverseGeocodePoint: companyAdminFeatureProcedure("reports").input(z17.object({ latitude: z17.number().min(-90).max(90), longitude: z17.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
        promoterActivity: companyAdminFeatureProcedure("reports").input(z17.object({
          page: z17.number().int().positive().optional(),
          pageSize: z17.number().int().positive().max(100).optional(),
          from: z17.string().optional(),
          to: z17.string().optional(),
          promoterId: z17.number().int().positive().optional(),
          category: z17.string().optional(),
          search: z17.string().optional()
        }).optional()).query(({ ctx, input }) => listPromoterActivities({
          companyId: ctx.accountId,
          page: input?.page,
          pageSize: input?.pageSize,
          from: input?.from,
          to: input?.to,
          promoterId: input?.promoterId,
          category: input?.category,
          search: input?.search
        })),
        promoterActivityExportCsv: companyAdminFeatureProcedure("reports").input(z17.object({
          from: z17.string().optional(),
          to: z17.string().optional(),
          promoterId: z17.number().int().positive().optional(),
          category: z17.string().optional(),
          search: z17.string().optional()
        }).optional()).mutation(async ({ ctx, input }) => {
          const result = await listPromoterActivities({ companyId: ctx.accountId, page: 1, pageSize: 1e4, ...input });
          const headers = ["Data/hora", "Promotor", "E-mail", "Atividade", "\xC1rea", "Registro", "Descri\xE7\xE3o", "Detalhes"];
          const values = result.items.map((row2) => [row2.occurredAt, row2.userName, row2.userEmail, row2.action, row2.module, row2.entityLabel, row2.description, typeof row2.details === "string" ? row2.details : JSON.stringify(row2.details ?? {})]);
          const cell2 = (value) => `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
          const csv = `\uFEFF${[headers, ...values].map((line) => line.map(cell2).join(";")).join("\r\n")}`;
          return { csv, contentType: "text/csv; charset=utf-8", filename: `atividades-promotores-${ctx.accountId}.csv` };
        }),
        list: companyAdminFeatureProcedure("reports").input(z17.object({
          page: z17.number().int().positive().optional(),
          pageSize: z17.number().int().positive().max(100).optional(),
          from: z17.string().optional(),
          to: z17.string().optional(),
          userId: z17.number().int().positive().optional(),
          module: z17.string().optional(),
          action: z17.string().optional(),
          entityType: z17.string().optional(),
          entityId: z17.number().int().positive().optional(),
          search: z17.string().optional()
        }).optional()).query(async ({ ctx, input }) => {
          return listAuditLogs({
            companyId: ctx.accountId,
            enforceTenant: true,
            page: input?.page,
            pageSize: input?.pageSize,
            from: input?.from,
            to: input?.to,
            userId: input?.userId,
            module: input?.module,
            action: input?.action,
            entityType: input?.entityType,
            entityId: input?.entityId,
            search: input?.search
          });
        }),
        byId: companyAdminFeatureProcedure("reports").input(z17.object({ id: z17.number().int().positive() })).query(async ({ ctx, input }) => {
          const row2 = await getAuditLogById(input.id, ctx.accountId);
          if (!row2) throw new TRPCError26({ code: "NOT_FOUND", message: "Registro de auditoria n\xE3o encontrado." });
          return row2;
        }),
        entityHistory: commercialFeatureProcedure("reports").input(z17.object({
          entityType: z17.string().min(1),
          entityId: z17.number().int().positive(),
          page: z17.number().int().positive().optional(),
          pageSize: z17.number().int().positive().max(100).optional()
        })).query(async ({ ctx, input }) => listEntityAuditHistory({
          companyId: ctx.accountId,
          entityType: input.entityType,
          entityId: input.entityId,
          page: input.page,
          pageSize: input.pageSize
        })),
        exportCsv: companyAdminFeatureProcedure("reports").input(z17.object({
          from: z17.string().optional(),
          to: z17.string().optional(),
          userId: z17.number().int().positive().optional(),
          module: z17.string().optional(),
          action: z17.string().optional(),
          entityType: z17.string().optional(),
          entityId: z17.number().int().positive().optional(),
          search: z17.string().optional()
        }).optional()).mutation(async ({ ctx, input }) => {
          const csv = await exportAuditLogsCsv({
            companyId: ctx.accountId,
            enforceTenant: true,
            from: input?.from,
            to: input?.to,
            userId: input?.userId,
            module: input?.module,
            action: input?.action,
            entityType: input?.entityType,
            entityId: input?.entityId,
            search: input?.search
          });
          return { csv, contentType: "text/csv; charset=utf-8", filename: `auditoria-${ctx.accountId}.csv` };
        }),
        platformList: platformProcedure.input(z17.object({
          companyId: z17.number().int().positive().optional(),
          page: z17.number().int().positive().optional(),
          pageSize: z17.number().int().positive().max(100).optional(),
          from: z17.string().optional(),
          to: z17.string().optional(),
          module: z17.string().optional(),
          action: z17.string().optional(),
          search: z17.string().optional()
        }).optional()).query(async ({ input }) => listAuditLogs({
          companyId: input?.companyId,
          page: input?.page,
          pageSize: input?.pageSize,
          from: input?.from,
          to: input?.to,
          module: input?.module,
          action: input?.action,
          search: input?.search
        }))
      }),
      platformPayments: router({
        list: platformProcedure.query(() => listAllPayments())
      })
    });
  }
});

// server/_core/context.ts
import { parse as parseCookie2 } from "cookie";
async function createContext(opts) {
  let user = null;
  let accountId;
  let memberAccountId;
  let platformAdminId;
  let isMember = false;
  let isPlatformAdmin = false;
  let actingAsPlatform = false;
  const cookies = parseCookie2(opts.req.headers.cookie ?? "");
  const headerToken = String(opts.req.headers["x-session-token"] || opts.req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") || "").trim();
  const sessionToken = cookies[MEMBER_COOKIE_NAME] || headerToken || "";
  if (!sessionToken) {
    console.log("[auth] no session token received", { hasCookie: Boolean(cookies[MEMBER_COOKIE_NAME]), hasHeader: Boolean(headerToken) });
  }
  if (sessionToken) {
    const platformAdmin = await getPlatformAdminBySessionToken(sessionToken);
    if (platformAdmin) {
      platformAdminId = platformAdmin.id;
      isPlatformAdmin = true;
      user = {
        id: platformAdmin.id,
        openId: `platform:${platformAdmin.id}`,
        name: platformAdmin.userName,
        email: platformAdmin.email,
        loginMethod: "password",
        role: "platform_admin",
        createdAt: platformAdmin.createdAt,
        updatedAt: platformAdmin.updatedAt,
        lastSignedIn: platformAdmin.createdAt
      };
      const actAs = Number(opts.req.headers["x-act-as-company"]);
      if (Number.isInteger(actAs) && actAs > 0) {
        const { getCompanyById: getCompanyById2 } = await Promise.resolve().then(() => (init_db(), db_exports));
        const company = await getCompanyById2(actAs);
        if (company) {
          actingAsPlatform = true;
          accountId = company.id;
          user = { ...user, name: `${platformAdmin.userName} (administrador da plataforma)`, role: "company_admin", companyId: company.id };
        }
      }
    } else {
      const memberAccount = await getMemberBySessionToken(sessionToken);
      if (memberAccount) {
        memberAccountId = memberAccount.id;
        accountId = memberAccount.companyId;
        isMember = true;
        user = {
          id: -memberAccount.id,
          openId: `member:${memberAccount.id}`,
          name: memberAccount.userName,
          email: memberAccount.email,
          loginMethod: "password",
          role: normalizeMemberRole(String(memberAccount.role)),
          companyId: memberAccount.companyId,
          createdAt: memberAccount.createdAt,
          updatedAt: memberAccount.updatedAt,
          lastSignedIn: memberAccount.createdAt
        };
      }
    }
  }
  return { req: opts.req, res: opts.res, user, accountId, memberAccountId, platformAdminId, isMember, isPlatformAdmin, actingAsPlatform };
}
var init_context = __esm({
  "server/_core/context.ts"() {
    "use strict";
    init_const();
    init_memberAuth();
  }
});

// server/scheduledMaintenance.ts
import mysql2 from "mysql2/promise";
async function runScheduledMaintenance() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is not configured.");
  const connection = await mysql2.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 1e4 });
  try {
    await connection.query(`CREATE TABLE IF NOT EXISTS visit_photos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      visitId INT NOT NULL,
      type ENUM('checkin', 'checkout') NOT NULL,
      fileKey VARCHAR(512) NOT NULL,
      latitude DOUBLE,
      longitude DOUBLE,
      address VARCHAR(255),
      expiresAt TIMESTAMP NOT NULL,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const { runBackupStep: runBackupStep2, purgeOldR2Backups: purgeOldR2Backups2 } = await Promise.resolve().then(() => (init_backup(), backup_exports));
    const backup = await runBackupStep2(connection, { budgetMs: Number(process.env.BACKUP_BUDGET_MS || 18e3) });
    let backupRetention = null;
    if (backup.complete && !backup.reason) {
      try {
        backupRetention = await purgeOldR2Backups2();
      } catch (e) {
        console.warn("[maintenance] backup retention failed", e);
      }
    }
    const [trash] = await connection.query("DELETE FROM trash_items WHERE expiresAt <= UTC_TIMESTAMP()");
    const [visitPhotos2] = await connection.query("DELETE FROM visit_photos WHERE expiresAt <= UTC_TIMESTAMP()");
    const [memberSessions3] = await connection.query("DELETE FROM member_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    const [platformSessions3] = await connection.query("DELETE FROM platform_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    await connection.query("DELETE FROM backup_progress WHERE day < DATE_FORMAT(DATE_SUB(UTC_DATE(), INTERVAL 30 DAY), '%Y-%m-%d')");
    const retention = await purgeOldAuditLogs(connection);
    let expiredPhotos = { deleted: 0, errors: 0 };
    try {
      const { expireOldStorePhotos: expireOldStorePhotos2 } = await Promise.resolve().then(() => (init_storePhotos(), storePhotos_exports));
      expiredPhotos = await expireOldStorePhotos2();
    } catch (e) {
      console.warn("[maintenance] expire photos failed", e);
    }
    return { backup, backupRetention, cleaned: { trash: trash.affectedRows, visitPhotos: visitPhotos2.affectedRows, memberSessions: memberSessions3.affectedRows, platformSessions: platformSessions3.affectedRows, ...retention }, expiredPhotos };
  } finally {
    await connection.end();
  }
}
function timeAuditRetentionDays() {
  const raw = Number(process.env.AUDIT_RETENTION_TIME_DAYS || 0);
  if (!raw || !Number.isFinite(raw)) return null;
  return Math.max(MIN_TIME_AUDIT_RETENTION_DAYS, raw);
}
async function purgeOldAuditLogs(connection) {
  const general = Math.max(90, Number(process.env.AUDIT_RETENTION_DAYS || 730));
  const timeDays = timeAuditRetentionDays();
  let auditLogs3 = 0;
  try {
    for (let i = 0; i < 10; i++) {
      const [r] = await connection.query(
        timeDays == null ? `DELETE FROM audit_logs WHERE module <> 'time_tracking' AND createdAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY) LIMIT 5000` : `DELETE FROM audit_logs WHERE (module <> 'time_tracking' AND createdAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) OR (module = 'time_tracking' AND createdAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) LIMIT 5000`,
        timeDays == null ? [general] : [general, timeDays]
      );
      auditLogs3 += r.affectedRows || 0;
      if ((r.affectedRows || 0) < 5e3) break;
    }
  } catch (e) {
    if (e?.code !== "ER_NO_SUCH_TABLE") throw e;
  }
  return { auditLogs: auditLogs3 };
}
async function runMissingPunchAlerts() {
  const { findMissingPunches: findMissingPunches2 } = await Promise.resolve().then(() => (init_missingPunch(), missingPunch_exports));
  const dbm = await Promise.resolve().then(() => (init_db(), db_exports));
  const database2 = await dbm.getDb();
  if (!database2) return { found: 0, notified: 0 };
  const { and: and22, eq: eq24 } = await import("drizzle-orm");
  const { memberAccounts: memberAccounts3 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
  const missing = await findMissingPunches2();
  const { getCompanyEntitlementBase: getCompanyEntitlementBase2 } = await Promise.resolve().then(() => (init_entitlements2(), entitlements_exports));
  const companyPonto = /* @__PURE__ */ new Map();
  let notified = 0;
  for (const m of missing) {
    if (!companyPonto.has(m.companyId)) {
      const base = await getCompanyEntitlementBase2(m.companyId);
      companyPonto.set(m.companyId, Boolean(base.companyFeatures.timeTracking));
    }
    if (!companyPonto.get(m.companyId)) continue;
    const key = `missing_punch_notified:${m.memberId}:${m.day}`;
    if (await dbm.getSetting(key, m.companyId, "")) continue;
    const when = new Date(m.lastTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    const detail = `\xDAltima marca\xE7\xE3o: ${m.lastLabel} em ${when}. Falta registrar: ${m.missing}.`;
    try {
      if (m.email) {
        await sendEmail2({ to: m.email, subject: "Falta de batida no cart\xE3o ponto", text: `${detail} Abra o app, v\xE1 em Cart\xE3o ponto > Corre\xE7\xF5es de ponto e solicite a corre\xE7\xE3o com a justificativa.`, html: `<p>${detail}</p><p>Abra o app, v\xE1 em <b>Cart\xE3o ponto &gt; Corre\xE7\xF5es de ponto</b> e solicite a corre\xE7\xE3o com a justificativa.</p>` });
        notified += 1;
      }
      const admins = await database2.select({ email: memberAccounts3.email }).from(memberAccounts3).where(and22(eq24(memberAccounts3.companyId, m.companyId), eq24(memberAccounts3.role, "company_admin"), eq24(memberAccounts3.active, true)));
      for (const admin of admins) {
        if (!admin.email) continue;
        await sendEmail2({ to: admin.email, subject: `Falta de batida: ${m.name}`, text: `${m.name}: ${detail}`, html: `<p><b>${m.name}</b>: ${detail}</p><p>O promotor foi avisado para solicitar a corre\xE7\xE3o; voc\xEA poder\xE1 analis\xE1-la em Cart\xE3o-ponto.</p>` });
        notified += 1;
      }
      await dbm.setSetting(key, (/* @__PURE__ */ new Date()).toISOString(), m.companyId);
    } catch (error) {
      console.warn("[missing-punch] falha ao enviar aviso", error);
    }
  }
  return { found: missing.length, notified };
}
async function runPhotoMaintenance() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) return { deleted: 0, alerted: 0 };
  const connection = await mysql2.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 1e4 });
  let deleted = 0;
  let alerted = 0;
  const PHOTO_LIMIT = Number(process.env.PHOTO_STORAGE_ALERT_COUNT || 5e3);
  try {
    const [expired] = await connection.query(
      `SELECT id, companyId, fileKey, thumbnailKey FROM store_photos WHERE expiresAt <= UTC_TIMESTAMP() LIMIT 200`
    );
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const photo of expired || []) {
      try {
        if (photo.fileKey) await guardedStorageDelete(storageDelete2, photo.fileKey, Number(photo.companyId));
        if (photo.thumbnailKey) await guardedStorageDelete(storageDelete2, photo.thumbnailKey, Number(photo.companyId));
      } catch {
      }
      await connection.query(`DELETE FROM store_photos WHERE id = ?`, [photo.id]);
      deleted += 1;
    }
    const [counts] = await connection.query(
      `SELECT companyId, COUNT(*) AS total FROM store_photos GROUP BY companyId HAVING total >= ?`,
      [PHOTO_LIMIT]
    );
    for (const row2 of counts || []) {
      const [admins] = await connection.query(
        `SELECT email FROM member_accounts WHERE companyId = ? AND role = 'company_admin' AND active = 1 AND email IS NOT NULL`,
        [row2.companyId]
      );
      for (const admin of admins || []) {
        try {
          const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
          if (sendEmail2) {
            await sendEmail2({
              to: admin.email,
              subject: "Alerta de consumo de fotos",
              text: `Sua empresa possui ${row2.total} fotos armazenadas. O limite de alerta \xE9 ${PHOTO_LIMIT}. Considere revisar ou aumentar o plano.`,
              html: `<p>Sua empresa possui ${row2.total} fotos armazenadas. O limite de alerta \xE9 ${PHOTO_LIMIT}. Considere revisar ou aumentar o plano.</p>`
            });
            alerted += 1;
          }
        } catch {
        }
      }
    }
  } finally {
    await connection.end();
  }
  return { deleted, alerted };
}
var MIN_TIME_AUDIT_RETENTION_DAYS;
var init_scheduledMaintenance = __esm({
  "server/scheduledMaintenance.ts"() {
    "use strict";
    init_mediaKeys();
    MIN_TIME_AUDIT_RETENTION_DAYS = 7 * 365;
  }
});

// server/scheduleAuth.ts
import crypto3 from "node:crypto";
function timingSafeTokenEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto3.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
function isScheduleRequestAuthorized(req, env2 = process.env) {
  const authorization = req.headers.authorization;
  const bearer = typeof authorization === "string" ? authorization.replace(/^Bearer\s+/i, "") : "";
  const header = req.headers["x-schedule-secret"];
  const supplied = bearer || (typeof header === "string" ? header : "");
  if (!supplied) return false;
  const secrets = [env2.SCHEDULE_SECRET, env2.CRON_SECRET].filter((v) => Boolean(v));
  return secrets.map((secret) => timingSafeTokenEqual(secret, supplied)).some(Boolean);
}
var init_scheduleAuth = __esm({
  "server/scheduleAuth.ts"() {
    "use strict";
  }
});

// server/sentry.ts
import * as Sentry from "@sentry/node";
function scrubValue(key, value) {
  if (SENSITIVE_KEYS.test(key)) return "[Filtered]";
  if (typeof value === "string" && /password|senha|Bearer\s+[A-Za-z0-9\-._~+/]+=*/i.test(value) && value.length > 20) {
    return "[Filtered]";
  }
  return value;
}
function scrubObject(input, depth = 0) {
  if (depth > 6 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => scrubObject(v, depth + 1));
  if (typeof input !== "object") return input;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = scrubValue(k, scrubObject(v, depth + 1));
  }
  return out;
}
function initServerSentry(env2 = process.env) {
  const dsn = (env2.SENTRY_DSN || "").trim();
  if (!dsn || initialized) return initialized;
  try {
    Sentry.init({
      dsn,
      environment: env2.SENTRY_ENVIRONMENT || env2.NODE_ENV || "production",
      tracesSampleRate: Number(env2.SENTRY_TRACES_SAMPLE_RATE || 0.05),
      // No SDK v11 o antigo "sendDefaultPii: false" foi substituído por dataCollection.
      dataCollection: { userInfo: false, cookies: false },
      beforeSend(event) {
        if (event.request) {
          if (event.request.headers) {
            event.request.headers = scrubObject(event.request.headers);
          }
          if (event.request.data) {
            event.request.data = scrubObject(event.request.data);
          }
          if (event.request.query_string && typeof event.request.query_string === "string") {
            event.request.query_string = event.request.query_string.replace(
              /(password|senha|token)=([^&]*)/gi,
              "$1=[Filtered]"
            );
          }
        }
        if (event.extra) event.extra = scrubObject(event.extra);
        if (event.user) {
          delete event.user.ip_address;
          if (event.user.email) {
            event.user.email = "[Filtered]";
          }
        }
        return event;
      }
    });
    initialized = true;
    console.log("[sentry] server monitoring enabled");
  } catch (error) {
    console.warn("[sentry] failed to init", error);
  }
  return initialized;
}
function sentryErrorHandler() {
  if (!initialized) {
    return (err, _req, _res, next) => next(err);
  }
  return (err, _req, _res, next) => {
    Sentry.captureException(err);
    next(err);
  };
}
var SENSITIVE_KEYS, initialized;
var init_sentry = __esm({
  "server/sentry.ts"() {
    "use strict";
    SENSITIVE_KEYS = /^(password|senha|token|secret|authorization|cookie|credit.?card|cpf|cnpj|ssn)$/i;
    initialized = false;
  }
});

// server/recordScheduledJob.ts
function dayLabel(day) {
  const parts = String(day || "").split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : day || "dia desconhecido";
}
function formatBackupJobSummary(backup) {
  if (!backup) return "Backup sem detalhes.";
  const day = dayLabel(backup.day);
  if (backup.complete && backup.skipped) return `Backup de ${day} j\xE1 estava conclu\xEDdo.`;
  if (backup.complete) return `Backup de ${day} conclu\xEDdo.`;
  return `Backup de ${day} em andamento (${backup.tablesDone || 0} de ${backup.tables || 0} tabelas).`;
}
function formatMaintenanceSummary(result) {
  return `Manuten\xE7\xE3o conclu\xEDda. ${formatBackupJobSummary(result?.backup)}`;
}
function formatArchiveSummary(archive) {
  const processed = Number(archive?.processed ?? 0);
  return processed === 1 ? "1 espelho processado." : `${processed} espelhos processados.`;
}
async function recordScheduledJob(job, startedAt, ok, summary) {
  await recordPlatformJobRun({ job, ok, summary, startedAt, finishedAt: /* @__PURE__ */ new Date() });
}
var init_recordScheduledJob = __esm({
  "server/recordScheduledJob.ts"() {
    "use strict";
    init_liveErrorStore();
  }
});

// server/vercel-entry.ts
var vercel_entry_exports = {};
__export(vercel_entry_exports, {
  createApp: () => createApp,
  default: () => handler
});
import express2 from "express";
import compression from "compression";
import fs4 from "fs";
import path2 from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
function securityHeaders(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
}
async function createApp() {
  const app = express2();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(compression());
  app.use(express2.json({ limit: MAX_BODY_SIZE }));
  app.use(express2.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));
  app.use((err, req, res, next) => {
    if (!isPayloadTooLargeError(err)) return next(err);
    const path3 = req.path.startsWith("/api/trpc/") ? req.path.slice("/api/trpc/".length) : void 0;
    res.status(413).json(payloadTooLargeBody(path3));
  });
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  void ensureCompanyRegistryColumns().catch((error) => console.warn("[registry] ensure columns failed", error instanceof Error ? error.message : error));
  app.all("/api/scheduled/database-maintenance", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isScheduleRequestAuthorized(req)) {
      return res.status(401).json({ error: "Schedule authentication required" });
    }
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const result = await runScheduledMaintenance();
      let missingPunch = null;
      try {
        missingPunch = await runMissingPunchAlerts();
      } catch (e) {
        console.warn("[missing-punch]", e);
      }
      let photos = null;
      try {
        photos = await runPhotoMaintenance();
      } catch (e) {
        console.warn("[photos]", e);
      }
      let clock = null;
      try {
        const { runClockCheck: runClockCheck2 } = await Promise.resolve().then(() => (init_clock(), clock_exports));
        clock = await runClockCheck2("agendado");
      } catch (e) {
        console.warn("[clock]", e);
      }
      await recordScheduledJob("database-maintenance", startedAt, true, formatMaintenanceSummary(result));
      return res.json({ ok: true, result, missingPunch, photos, clock });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await recordScheduledJob("database-maintenance", startedAt, false, "A manuten\xE7\xE3o da madrugada falhou.");
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  app.all("/api/scheduled/database-backup", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isScheduleRequestAuthorized(req)) {
      return res.status(401).json({ error: "Schedule authentication required" });
    }
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const mysql3 = (await import("mysql2/promise")).default;
      const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!url) {
        await recordScheduledJob("database-backup", startedAt, false, "Backup falhou: banco n\xE3o configurado.");
        return res.status(500).json({ error: "Database URL is not configured." });
      }
      const connection = await mysql3.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 1e4 });
      try {
        const { runBackupStep: runBackupStep2, purgeOldR2Backups: purgeOldR2Backups2 } = await Promise.resolve().then(() => (init_backup(), backup_exports));
        const backup = await runBackupStep2(connection, { budgetMs: Number(process.env.BACKUP_BUDGET_MS || 18e3) });
        let retention = null;
        if (backup.complete && !backup.reason) {
          try {
            retention = await purgeOldR2Backups2();
          } catch (e) {
            console.warn("[backup] retention failed", e);
          }
        }
        await recordScheduledJob("database-backup", startedAt, true, formatBackupJobSummary(backup));
        return res.json({ ok: true, backup, retention });
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error("[Backup] failed:", error);
      await recordScheduledJob("database-backup", startedAt, false, "O backup autom\xE1tico falhou.");
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled backup failed" });
    }
  });
  app.all("/api/scheduled/archive-timesheets", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isScheduleRequestAuthorized(req)) {
      return res.status(401).json({ error: "Schedule authentication required" });
    }
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const { runTimesheetArchiveJob: runTimesheetArchiveJob2 } = await Promise.resolve().then(() => (init_timesheetArchive(), timesheetArchive_exports));
      const archive = await runTimesheetArchiveJob2({ limitCompanies: 30 });
      await recordScheduledJob("archive-timesheets", startedAt, true, formatArchiveSummary(archive));
      return res.json({ ok: true, archive });
    } catch (error) {
      console.error("[Archive] failed:", error);
      await recordScheduledJob("archive-timesheets", startedAt, false, "O arquivamento dos espelhos falhou.");
      return res.status(500).json({ error: "Timesheet archive failed" });
    }
  });
  app.post("/api/webhooks/asaas", express2.json(), async (req, res) => {
    try {
      const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if (!configuredToken || !timingSafeTokenEqual(configuredToken, headerToken)) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }
      const body = req.body || {};
      const eventId = String(body.id || body.eventId || body.payment?.id || `${body.event || "evt"}_${Date.now()}`);
      const event = String(body.event || body.type || "UNKNOWN");
      const recorded = await (await Promise.resolve().then(() => (init_db(), db_exports))).recordPaymentEvent({
        eventId,
        event,
        paymentId: body.payment?.id ? void 0 : void 0,
        subscriptionId: void 0,
        payload: JSON.stringify(body),
        processed: true
      });
      if (recorded.duplicate) {
        return res.json({ ok: true, duplicate: true });
      }
      return res.json({ ok: true, duplicate: false });
    } catch (error) {
      console.error("[Asaas webhook]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  app.use("/api/trpc", originGuard());
  app.use("/api/trpc", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  const distPath = path2.resolve(process.cwd(), "dist", "public");
  if (fs4.existsSync(distPath)) {
    app.use(express2.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        } else if (filePath.includes(`${path2.sep}assets${path2.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else {
          res.setHeader("Cache-Control", "public, max-age=3600");
        }
        if (filePath.endsWith(`${path2.sep}manifest.json`) || filePath.endsWith("/manifest.json")) {
          res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
        }
      }
    }));
    app.use("*", (_req, res) => res.sendFile(path2.resolve(distPath, "index.html")));
  }
  app.use(sentryErrorHandler());
  return app;
}
async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req, res);
}
var appPromise;
var init_vercel_entry = __esm({
  "server/vercel-entry.ts"() {
    "use strict";
    init_forceUtc();
    init_originGuard();
    init_routers();
    init_context();
    init_scheduleAuth();
    init_scheduledMaintenance();
    init_notification();
    init_uploadLimits();
    init_sentry();
    init_recordScheduledJob();
    init_companyRegistry();
    initServerSentry();
    appPromise = null;
  }
});

// server/_core/index.ts
init_forceUtc();
init_originGuard();
init_routers();
init_context();
import "dotenv/config";
import express3 from "express";
import compression2 from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware as createExpressMiddleware2 } from "@trpc/server/adapters/express";

// server/_core/vite.ts
import express from "express";
import fs3 from "fs";
import { nanoid } from "nanoid";
import path from "path";
async function setupVite(app, server) {
  const [{ createServer: createViteServer }, { default: react }, { default: tailwindcss }] = await Promise.all([
    import("vite"),
    import("@vitejs/plugin-react"),
    import("@tailwindcss/vite")
  ]);
  const viteConfig = {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "../../client/src"),
        "@shared": path.resolve(import.meta.dirname, "../../shared"),
        "@assets": path.resolve(import.meta.dirname, "../../attached_assets")
      }
    },
    envDir: path.resolve(import.meta.dirname, "../.."),
    root: path.resolve(import.meta.dirname, "../../client"),
    publicDir: path.resolve(import.meta.dirname, "../../client/public")
  };
  const serverOptions = {
    middlewareMode: true,
    // A prévia é acessada por HTTPS público, mas o Vite tenta anunciar o
    // WebSocket interno localhost:5173 em alguns celulares. HMR não é
    // necessário para o usuário final e esse anúncio abre o painel de erro.
    hmr: false,
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: serverOptions,
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use(async (req, res, next) => {
    const pathname = req.path;
    const isViteAsset = pathname.startsWith("/src/") || pathname.startsWith("/@fs/") || pathname.startsWith("/@id/") || pathname.startsWith("/@vite/");
    if (!isViteAsset) return next();
    try {
      const transformed = await vite.transformRequest(req.originalUrl);
      if (!transformed) return next();
      const contentType = pathname.endsWith(".css") ? "text/css" : "text/javascript";
      res.status(200).set({ "Content-Type": contentType }).end(transformed.code);
    } catch (error) {
      next(error);
    }
  });
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs3.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      const pageWithoutHmr = page.replace(/<script[^>]+src="\/\@vite\/client"[^>]*><\/script>/g, "");
      res.status(200).set({ "Content-Type": "text/html" }).end(pageWithoutHmr);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}

// server/_core/index.ts
init_scheduledMaintenance();
init_notification();
init_scheduleAuth();
init_uploadLimits();
init_sentry();
init_recordScheduledJob();
import crypto4 from "node:crypto";
initServerSentry();
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}
async function findAvailablePort(startPort = 3e3) {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}
function securityHeaders2(_req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self), microphone=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  }
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
  );
  next();
}
function timingSafeTokenEqual2(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto4.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}
async function createApp2() {
  const app = express3();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders2);
  app.use(compression2());
  app.use(express3.json({ limit: MAX_BODY_SIZE }));
  app.use(express3.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));
  app.use((err, req, res, next) => {
    if (!isPayloadTooLargeError(err)) return next(err);
    const path3 = req.path.startsWith("/api/trpc/") ? req.path.slice("/api/trpc/".length) : void 0;
    res.status(413).json(payloadTooLargeBody(path3));
  });
  app.get("/healthz", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.post("/api/webhooks/asaas", express3.json(), async (req, res) => {
    try {
      const configuredToken = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if (!configuredToken || !timingSafeTokenEqual2(configuredToken, headerToken)) {
        return res.status(401).json({ error: "Invalid webhook token" });
      }
      const body = req.body || {};
      const eventId = String(body.id || body.eventId || body.payment?.id || `${body.event || "evt"}_${Date.now()}`);
      const event = String(body.event || body.type || "UNKNOWN");
      const recorded = await (await Promise.resolve().then(() => (init_db(), db_exports))).recordPaymentEvent({
        eventId,
        event,
        paymentId: body.payment?.id ? void 0 : void 0,
        subscriptionId: void 0,
        payload: JSON.stringify(body),
        processed: true
      });
      if (recorded.duplicate) {
        return res.json({ ok: true, duplicate: true });
      }
      return res.json({ ok: true, duplicate: false });
    } catch (error) {
      console.error("[Asaas webhook]", error);
      return res.status(500).json({ error: "Webhook processing failed" });
    }
  });
  app.all("/api/scheduled/database-maintenance", async (req, res) => {
    if (!isScheduleRequestAuthorized(req)) {
      return res.status(401).json({ error: "Schedule authentication required" });
    }
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const result = await runScheduledMaintenance();
      await recordScheduledJob("database-maintenance", startedAt, true, formatMaintenanceSummary(result));
      return res.json({ ok: true, result });
    } catch (error) {
      console.error("[Maintenance] Scheduled backup failed:", error);
      await recordScheduledJob("database-maintenance", startedAt, false, "A manuten\xE7\xE3o da madrugada falhou.");
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico e a limpeza programada falharam. Verifique os logs do projeto e o armazenamento persistente configurado." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  app.all("/api/scheduled/database-backup", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    if (!isScheduleRequestAuthorized(req)) {
      return res.status(401).json({ error: "Schedule authentication required" });
    }
    const startedAt = /* @__PURE__ */ new Date();
    try {
      const mysql3 = (await import("mysql2/promise")).default;
      const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!url) {
        await recordScheduledJob("database-backup", startedAt, false, "Backup falhou: banco n\xE3o configurado.");
        return res.status(500).json({ error: "Database URL is not configured." });
      }
      const connection = await mysql3.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 1e4 });
      try {
        const { runBackupStep: runBackupStep2, purgeOldR2Backups: purgeOldR2Backups2 } = await Promise.resolve().then(() => (init_backup(), backup_exports));
        const backup = await runBackupStep2(connection, { budgetMs: Number(process.env.BACKUP_BUDGET_MS || 18e3) });
        let retention = null;
        if (backup.complete && !backup.reason) {
          try {
            retention = await purgeOldR2Backups2();
          } catch (e) {
            console.warn("[backup] retention failed", e);
          }
        }
        await recordScheduledJob("database-backup", startedAt, true, formatBackupJobSummary(backup));
        return res.json({ ok: true, backup, retention });
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error("[Backup] failed:", error);
      await recordScheduledJob("database-backup", startedAt, false, "O backup autom\xE1tico falhou.");
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled backup failed" });
    }
  });
  app.use(
    "/api/trpc",
    originGuard(),
    (_req, res, next) => {
      res.setHeader("Cache-Control", "private, no-store, max-age=0, must-revalidate");
      res.setHeader("Vary", "Cookie");
      next();
    },
    createExpressMiddleware2({
      router: appRouter,
      createContext
    })
  );
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });
  app.use(sentryErrorHandler());
  return app;
}
async function startServer() {
  const useViteDevServer = process.env.NODE_ENV === "development" && process.env.VITE_DEV_SERVER === "true";
  const app = useViteDevServer ? await createApp2() : await (await Promise.resolve().then(() => (init_vercel_entry(), vercel_entry_exports))).createApp();
  const server = createServer(app);
  if (useViteDevServer) {
    await setupVite(app, server);
  }
  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
var isVercel = Boolean(process.env.VERCEL);
if (!isVercel) {
  startServer().catch(console.error);
}
export {
  createApp2 as createApp
};
