var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
var SAFE_CHARS;
var init_mediaKeys = __esm({
  "server/mediaKeys.ts"() {
    "use strict";
    SAFE_CHARS = /^[A-Za-z0-9._\-/]+$/;
  }
});

// shared/uploadLimits.ts
function payloadTooLargeBody(path2) {
  return { error: { json: { message: BODY_TOO_LARGE_MESSAGE, code: -32600, data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413, path: path2 } } } };
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
  memberAccounts: () => memberAccounts2,
  memberFeaturePermissions: () => memberFeaturePermissions,
  memberSessions: () => memberSessions2,
  platformAdmins: () => platformAdmins2,
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
  timeEvents: () => timeEvents,
  users: () => users2,
  vacationSchedules: () => vacationSchedules,
  visitPhotos: () => visitPhotos,
  visits: () => visits,
  weeklyRouteSchedules: () => weeklyRouteSchedules
});
import { bigint, boolean as boolean2, date as date2, decimal as decimal2, index as index2, int as int2, json, mysqlEnum as mysqlEnum2, mysqlTable as mysqlTable2, text as text2, timestamp as timestamp2, uniqueIndex as uniqueIndex2, varchar as varchar2, double } from "drizzle-orm/mysql-core";
var users2, companies2, platformAdmins2, memberAccounts2, promoterProfiles, memberSessions2, platformSessions2, clients2, brands, retailChains, stores, teams, routes, weeklyRouteSchedules, inventoryProducts, visits, timeEvents, timeCorrectionRequests, checklists, checklistQuestions, checklistResponses, evidences, auditLogs2, subscriptionPlans2, subscriptionPlanFeatures, companyFeatureOverrides, memberFeaturePermissions, companySubscriptions2, systemSettings2, storePhotos, visitPhotos, vacationSchedules;
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
  const unique = [...new Set(storeIds.filter((id2) => Number.isInteger(id2) && id2 > 0))];
  await db.execute(sql`DELETE FROM promoter_store_assignments WHERE companyId = ${companyId} AND promoterId = ${promoterId}`);
  if (unique.length === 0) return;
  const valid2 = await db.execute(sql`SELECT id FROM stores WHERE companyId = ${companyId} AND active = 1 AND id IN (${sql.join(unique.map((id2) => sql`${id2}`), sql`, `)})`);
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
var ENTITLEMENT_KEYS, PLAN_FEATURES, ALL_FEATURES, SUPERVISOR_CEILING, PROMOTER_CEILING, ROLE_FEATURE_CEILING, ROLE_FEATURE_DEFAULTS;
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
    PLAN_FEATURES = {
      start: ["dashboard", "clients", "pointsOfSale", "alerts", "products"],
      profissional: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "visitCheckIn", "products", "reports", "teamManagement"],
      empresarial: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "visitCheckIn", "products", "reports", "teamManagement", "backup", "offline"]
    };
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
      supervisor: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "visitCheckIn", "products"],
      promoter: ["dashboard", "timeTracking", "fieldOperations", "visitCheckIn", "products"]
    };
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
async function getCompanyById(id2) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(companies).where(eq2(companies.id, id2)).limit(1);
  return result[0];
}
async function createCompany(name) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(companies).values({ name: name.trim(), active: true });
  return Number(result[0].insertId);
}
async function updateCompany(id2, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set({ ...data, name: data.name?.trim() }).where(eq2(companies.id, id2));
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
async function restoreTrashItem(id2, accountId, scopeMemberId2) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and2(eq2(trashItems.id, id2), trashScope(tenant, scopeMemberId2))).limit(1))[0];
  if (!item) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and2(eq2(trashItems.id, id2), eq2(trashItems.accountId, tenant)));
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
    await tx.delete(trashItems).where(and2(eq2(trashItems.id, id2), eq2(trashItems.accountId, tenant)));
  });
  return { itemType: item.itemType, label: item.label, originalId: item.originalId };
}
async function permanentlyDeleteTrashItem(id2, accountId, scopeMemberId2) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await ensureTrashTable();
  const item = (await db.select().from(trashItems).where(and2(eq2(trashItems.id, id2), trashScope(tenant, scopeMemberId2))).limit(1))[0];
  if (!item) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  const result = await db.delete(trashItems).where(and2(eq2(trashItems.id, id2), eq2(trashItems.accountId, tenant)));
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
  const id2 = Number(result.insertId);
  await replaceSubscriptionPlanFeatures(database2, id2, featureKeys);
  return { id: id2 };
}
async function updateSubscriptionPlan(id2, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const { featureKeys, ...planFields } = data;
  if (Object.keys(planFields).length) {
    await database2.update(subscriptionPlans).set(planFields).where(eq2(subscriptionPlans.id, id2));
  }
  if (featureKeys !== void 0) await replaceSubscriptionPlanFeatures(database2, id2, featureKeys);
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
async function updateCompanySubscription(id2, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companySubscriptions).set(data).where(eq2(companySubscriptions.id, id2));
  const rows4 = await db.select().from(companySubscriptions).where(eq2(companySubscriptions.id, id2)).limit(1);
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
async function listAvailablePlansForCompanies() {
  const plans = await listSubscriptionPlans();
  return plans.filter((plan) => plan.active && plan.availableForNew).sort((a, b) => Number(a.price) - Number(b.price));
}
async function ensureSeedPlans() {
  const database2 = await getDb();
  if (!database2) return;
  const catalog = [
    {
      name: "Start",
      description: "Ideal para quem est\xE1 come\xE7ando",
      price: "59.90",
      billingCycle: "monthly",
      maxUsers: 1,
      maxClients: 1e3,
      maxExtinguishers: 3e3,
      featureKeys: [...PLAN_FEATURES.start],
      availableForNew: true,
      active: true
    },
    {
      name: "Profissional",
      description: "Para equipes em opera\xE7\xE3o",
      price: "99.90",
      billingCycle: "monthly",
      maxUsers: 5,
      maxClients: null,
      maxExtinguishers: 1e4,
      featureKeys: [...PLAN_FEATURES.profissional],
      availableForNew: true,
      active: true
    },
    {
      name: "Empresarial",
      description: "Para opera\xE7\xE3o maior e crescimento",
      price: "169.90",
      billingCycle: "monthly",
      maxUsers: 10,
      maxClients: null,
      maxExtinguishers: null,
      featureKeys: [...PLAN_FEATURES.empresarial],
      availableForNew: true,
      active: true
    }
  ];
  const existing = await database2.select().from(subscriptionPlans);
  const byName = new Map(existing.map((p) => [String(p.name).toLowerCase().trim(), p]));
  for (const plan of catalog) {
    const key = plan.name.toLowerCase();
    const row2 = byName.get(key);
    if (row2) continue;
    const { featureKeys, ...planFields } = plan;
    const [result] = await database2.insert(subscriptionPlans).values(planFields);
    const id2 = Number(result.insertId);
    if (id2) {
      try {
        await replaceSubscriptionPlanFeatures(database2, id2, featureKeys);
      } catch (error) {
        if (!isMissingEntitlementsTable(error)) throw error;
      }
    }
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
async function updateOperationalStore(companyId, id2, patch) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const where = and2(eq2(stores.id, id2), eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true));
  const found = await database2.select({ id: stores.id }).from(stores).where(where).limit(1);
  if (!found[0]) return false;
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== void 0));
  if (Object.keys(clean).length) await database2.update(stores).set(clean).where(where);
  return true;
}
async function archiveOperationalStore(companyId, id2) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const where = and2(eq2(stores.id, id2), eq2(stores.companyId, requireAccountId(companyId)), eq2(stores.active, true));
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
  const storeIds = [...new Set(input.storeIds)].filter((id2) => Number.isInteger(id2) && id2 > 0);
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
async function deleteWeeklyRouteSchedule(companyId, id2) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const cid = requireAccountId(companyId);
  return database2.transaction(async (tx) => {
    const [current] = await tx.select({ id: weeklyRouteSchedules.id }).from(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, id2), eq2(weeklyRouteSchedules.companyId, cid))).limit(1);
    if (!current) return { success: false };
    await dropPendingOccurrences(tx, cid, id2, todayInZone(), false);
    await tx.delete(weeklyRouteSchedules).where(and2(eq2(weeklyRouteSchedules.id, id2), eq2(weeklyRouteSchedules.companyId, cid)));
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
    const uniqueStoreIds = data.storeIds ? [...new Set(data.storeIds)].filter((id2) => Number.isInteger(id2) && id2 > 0) : [];
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
  const uniqueStoreIds = [...new Set(input.storeIds)].filter((id2) => Number.isInteger(id2) && id2 > 0);
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
async function updateOperationalVisit(companyId, id2, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await database2.update(visits).set(data).where(and2(eq2(visits.id, id2), eq2(visits.companyId, requireAccountId(companyId))));
  const rows4 = await database2.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq2(visits.storeId, stores.id)).where(and2(eq2(visits.id, id2), eq2(visits.companyId, companyId))).limit(1);
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
async function getInventoryProduct(companyId, id2) {
  const database2 = await getDb();
  if (!database2) return null;
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id2), eq2(inventoryProducts.companyId, company))).limit(1))[0] ?? null;
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
  const id2 = Number(result[0]?.insertId);
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id2), eq2(inventoryProducts.companyId, companyId))).limit(1))[0];
}
async function updateInventoryProduct(companyId, id2, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await ensureInventoryProductsSchema();
  const company = requireAccountId(companyId);
  await database2.update(inventoryProducts).set(data).where(and2(eq2(inventoryProducts.id, id2), eq2(inventoryProducts.companyId, company)));
  return (await database2.select().from(inventoryProducts).where(and2(eq2(inventoryProducts.id, id2), eq2(inventoryProducts.companyId, company))).limit(1))[0] || null;
}
async function deleteInventoryProducts(companyId, ids, actor) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const tenant = requireAccountId(companyId);
  const uniqueIds = [...new Set(ids)].filter((id2) => Number.isInteger(id2) && id2 > 0);
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
async function deleteInventoryProduct(companyId, id2, actor) {
  return deleteInventoryProducts(companyId, [id2], actor);
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
  checkSubscriptionAccess: () => checkSubscriptionAccess
});
function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
function checkSubscriptionAccess(companyId) {
  if (process.env.NODE_ENV === "test") return loadSubscriptionAccess(companyId);
  return accessCache.get(String(companyId), () => loadSubscriptionAccess(companyId));
}
async function loadSubscriptionAccess(companyId) {
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
  const now = /* @__PURE__ */ new Date();
  switch (status2) {
    case "trial":
    case "test": {
      const end = trialEndsAt || expiresAt;
      if (end && now > end) {
        return { allowed: false, status: status2, expiresAt: end, reason: "Per\xEDodo de teste encerrado." };
      }
      return { allowed: true, status: status2, expiresAt: end };
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

// server/entitlements.ts
var entitlements_exports = {};
__export(entitlements_exports, {
  assertCompanyFeatureAccess: () => assertCompanyFeatureAccess,
  assertMemberFeatureAccess: () => assertMemberFeatureAccess,
  getCompanyEntitlementBase: () => getCompanyEntitlementBase,
  getMemberEntitlementSnapshot: () => getMemberEntitlementSnapshot
});
import { TRPCError as TRPCError2 } from "@trpc/server";
function getCompanyEntitlementBase(companyId) {
  if (process.env.NODE_ENV === "test") return loadCompanyEntitlementBase(companyId);
  return entitlementBaseCache.get(String(companyId), () => loadCompanyEntitlementBase(companyId));
}
async function loadCompanyEntitlementBase(companyId) {
  if (!productsFeatureReady) {
    productsFeatureReady = (async () => {
      try {
        await ensureProductsFeature();
      } catch (error) {
        productsFeatureReady = null;
        console.warn("[entitlements] ensureProductsFeature", error);
      }
    })();
  }
  await productsFeatureReady;
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
    throw new TRPCError2({
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
    throw new TRPCError2({
      code: "FORBIDDEN",
      message,
      cause: { code, featureKey: input.featureKey, planId: base.planId, planName: base.planName, role: input.role }
    });
  }
  return { ...base, memberOverrides, effective };
}
var entitlementBaseCache, productsFeatureReady;
var init_entitlements2 = __esm({
  "server/entitlements.ts"() {
    "use strict";
    init_ttlCache();
    init_db();
    init_entitlements();
    entitlementBaseCache = createTtlCache(3e4);
    productsFeatureReady = null;
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError3 } from "@trpc/server";
import superjson from "superjson";
var t, router, publicProcedure, requireUser, requireCompanyUser, requireCompanyAdmin, requirePlatformAdmin, protectedProcedure, requireCompanyMemberNoBillingGate, companyBillingProcedure, requireEntitlement, commercialFeatureProcedure, companyAdminFeatureProcedure, companyAdminProcedure, platformProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    t = initTRPC.context().create({ transformer: superjson });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    });
    requireCompanyUser = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada para acessar dados comerciais." });
      }
      const companyRoles = ["company_admin", "supervisor", "promoter"];
      if (!companyRoles.includes(user.role)) throw new TRPCError3({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
      if (process.env.NODE_ENV !== "test" && !opts.ctx.actingAsPlatform) {
        const { checkSubscriptionAccess: checkSubscriptionAccess2 } = await Promise.resolve().then(() => (init_subscriptionAccess(), subscriptionAccess_exports));
        const access = await checkSubscriptionAccess2(opts.ctx.accountId);
        if (!access.allowed) {
          throw new TRPCError3({
            code: "FORBIDDEN",
            message: access.reason || "Assinatura irregular. Regularize o plano para continuar.",
            cause: { code: "SUBSCRIPTION_BLOCKED", status: access.status }
          });
        }
      }
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    requireCompanyAdmin = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (user.role !== "company_admin" || !opts.ctx.accountId) throw new TRPCError3({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode executar esta opera\xE7\xE3o." });
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    requirePlatformAdmin = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (user.role !== "platform_admin" || !opts.ctx.isPlatformAdmin) throw new TRPCError3({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      return opts.next({ ctx: { ...opts.ctx, user } });
    });
    protectedProcedure = t.procedure.use(requireUser);
    requireCompanyMemberNoBillingGate = t.middleware(async (opts) => {
      const user = opts.ctx.user;
      if (!user) throw new TRPCError3({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada." });
      }
      const companyRoles = ["company_admin", "supervisor", "promoter"];
      if (!companyRoles.includes(user.role)) throw new TRPCError3({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
      return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
    });
    companyBillingProcedure = t.procedure.use(requireCompanyMemberNoBillingGate);
    requireEntitlement = (featureKey) => t.middleware(async (opts) => {
      const user = opts.ctx.user;
      const companyId = opts.ctx.accountId;
      if (!user || !companyId || user.role === "platform_admin") {
        throw new TRPCError3({ code: "FORBIDDEN", message: "N\xE3o foi poss\xEDvel determinar a empresa e o perfil para validar este m\xF3dulo." });
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
    companyAdminFeatureProcedure = (featureKey) => t.procedure.use(requireCompanyAdmin).use(requireCompanyUser).use(requireEntitlement(featureKey));
    companyAdminProcedure = t.procedure.use(requireCompanyAdmin);
    platformProcedure = t.procedure.use(requirePlatformAdmin);
    adminProcedure = platformProcedure;
  }
});

// server/audit.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
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
async function getAuditLogById(id2, companyId) {
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return null;
  try {
    if (companyId != null) {
      const [rows5] = await pool.query(
        "SELECT * FROM `audit_logs` WHERE `id` = ? AND `companyId` = ? LIMIT 1",
        [id2, companyId]
      );
      return rows5[0] || null;
    }
    const [rows4] = await pool.query(
      "SELECT * FROM `audit_logs` WHERE `id` = ? LIMIT 1",
      [id2]
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
      CONCAT('Solicita\xE7\xE3o de corre\xE7\xE3o de ponto \xB7 ', tc.status) AS description,
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
    throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel carregar as atividades dos promotores. Tente novamente em instantes." });
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
var onlyDigitsStr, isValidCpfOrCnpj;
var init_brDocs = __esm({
  "shared/brDocs.ts"() {
    "use strict";
    onlyDigitsStr = (v) => String(v ?? "").replace(/\D/g, "");
    isValidCpfOrCnpj = (v) => onlyDigitsStr(v).length === 11 ? isValidCpf(v) : isValidCnpj(v);
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
function getBrazilianHoliday(dateStr5) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr5)) return null;
  const [y] = dateStr5.split("-").map(Number);
  if (y < 2020 || y > 2035) return null;
  const fixed = FIXED.find((f) => dateStr5.endsWith(f.md) && (!f.fromYear || y >= f.fromYear));
  if (fixed) return { date: dateStr5, name: fixed.name };
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
  return movable.find((h) => h.date === dateStr5) ?? null;
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
function localParts(iso, timeZone) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}:${v.second}`, hm: `${v.hour}:${v.minute}`, minutesOfDay: Number(v.hour) * 60 + Number(v.minute) };
}
function nightOverlap(aMs, bMs, tz, start, end) {
  let n = 0;
  for (let t2 = Math.ceil(aMs / 6e4) * 6e4; t2 < bMs; t2 += 6e4) {
    const m = localParts(new Date(t2).toISOString(), tz).minutesOfDay;
    if (start > end ? m >= start || m < end : m >= start && m < end) n++;
  }
  return n;
}
function buildMirror(input) {
  const tz = input.timeZone || "America/Sao_Paulo";
  const labor = input.labor || null;
  const sorted = [...input.events].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
  const events = sorted.filter((e) => !e.disregarded);
  const disregardedByDate = /* @__PURE__ */ new Map();
  for (const e of sorted) {
    if (!e.disregarded) continue;
    const date3 = localParts(e.time, tz).date;
    disregardedByDate.set(date3, [...disregardedByDate.get(date3) || [], { type: e.type, label: MARK_LABEL[e.type], time: e.time, reason: e.disregarded.reason, by: e.disregarded.by ?? null }]);
  }
  const notes = [];
  const shifts = [];
  let cur = null;
  for (const ev of events) {
    const date3 = localParts(ev.time, tz).date;
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
  for (const s of shifts) {
    if (s.date >= input.from && s.date <= input.to) byDate.set(s.date, [...byDate.get(s.date) || [], s]);
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
    if (holiday) {
      issues.push(`Feriado nacional: ${holiday.name} \u2014 abonado automaticamente`);
    }
    if (excuse) {
      const extra = excuse.justification ? ` \u2014 ${excuse.justification}` : "";
      issues.push(`${excuse.label} \u2014 dia abonado${extra}`);
    }
    if (onVacation) issues.push(hasMarks ? "F\xE9rias programadas \u2014 h\xE1 marca\xE7\xF5es neste dia (conferir)" : "F\xE9rias \u2014 dia abonado");
    if (optionalHoliday) issues.push(`Ponto facultativo: ${optionalHoliday} \u2014 n\xE3o abonado automaticamente (a empresa pode abonar pela corre\xE7\xE3o de ponto ou ativar esse abono na configura\xE7\xE3o)`);
    if (!hasMarks && isWorkday && !excused) {
      issues.push("Sem marca\xE7\xF5es em dia previsto \u2014 verificar falta, abono ou justificativa (n\xE3o informados)");
    }
    if (!hasMarks && weekdayOf(d) === 0 && !isWorkday && !holiday && !onVacation && !excuse) {
      issues.push("DSR (descanso semanal remunerado)");
    }
    const expected = daily != null && isWorkday && !excused ? daily : daily != null && !workdays ? null : null;
    const w = Math.round(worked);
    const diff = expected != null && hasMarks ? w - expected : null;
    days.push({
      date: d,
      weekday: weekdayOf(d),
      marks,
      workedMinutes: w,
      breakMinutes: Math.round(brk),
      expectedMinutes: expected,
      diffMinutes: diff,
      overtimeMinutes: diff != null ? Math.max(0, diff) : null,
      nightMinutes: night && hasMarks ? nightMin : null,
      issues,
      holiday: holiday?.name ?? null,
      excuse,
      optionalHoliday,
      vacation: onVacation,
      timeAlerts,
      ...disregardedByDate.has(d) ? { disregarded: disregardedByDate.get(d) } : {}
    });
  }
  const marked = days.filter((x) => x.marks.length);
  const sum = (f) => marked.reduce((a, x) => a + (f(x) || 0), 0);
  const configured = daily != null && workdays != null;
  const totals = {
    daysWithMarks: marked.length,
    workedMinutes: sum((x) => x.workedMinutes),
    breakMinutes: sum((x) => x.breakMinutes),
    expectedMinutes: configured ? days.reduce((a, x) => a + (x.expectedMinutes || 0), 0) : null,
    balanceMinutes: configured ? sum((x) => x.diffMinutes) : null,
    overtimeMinutes: configured ? sum((x) => x.overtimeMinutes) : null,
    deficitMinutes: configured ? marked.reduce((a, x) => a + Math.max(0, -(x.diffMinutes || 0)), 0) : null,
    nightMinutes: night ? sum((x) => x.nightMinutes) : null,
    nightReducedMinutes: night ? Math.round(sum((x) => x.nightMinutes) * 60 / 52.5) : null,
    incompleteDays: marked.filter((x) => x.issues.some((i) => i.startsWith("Jornada incompleta") || i.includes("sem entrada") || i.includes("sem sa\xEDda") || i.includes("sem in\xEDcio") || i.includes("seguidos"))).length,
    adjustedMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "adjusted" || m.kind === "legacy_adjusted").length, 0),
    automaticMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "automatic").length, 0),
    offlineMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.offline).length, 0),
    disregardedMarks: days.reduce((a, x) => a + (x.disregarded?.length || 0), 0),
    pendingSyncMarks: marked.reduce((a, x) => a + x.marks.filter((m) => !m.synced).length, 0),
    daysWithoutMarksOnWorkday: workdays ? days.filter((x) => !x.marks.length && workdays.has(x.weekday) && !x.holiday && !x.excuse && !x.vacation).length : null
  };
  if (!daily) notes.push("Jornada contratada n\xE3o configurada para este funcion\xE1rio: horas previstas, diferen\xE7as e horas extras n\xE3o foram calculadas.");
  if (!workdays) notes.push("Dias de trabalho da semana n\xE3o configurados: faltas e dias previstos n\xE3o foram apurados.");
  if (!night) notes.push("Adicional noturno e hora reduzida n\xE3o configurados: n\xE3o calculados.");
  notes.push("Feriados nacionais (inclui 20/11 a partir de 2024) s\xE3o identificados e abonados automaticamente (falta de batida n\xE3o gera d\xE9ficit). O ponto continua liberado nesses dias.");
  notes.push(input.options?.optionalHolidaysAsHoliday ? "Carnaval e Corpus Christi (ponto facultativo) est\xE3o sendo tratados como feriado, conforme a configura\xE7\xE3o da empresa." : "Carnaval e Corpus Christi s\xE3o ponto facultativo e N\xC3O s\xE3o abonados automaticamente; a empresa pode ativar esse abono na configura\xE7\xE3o. Feriados estaduais e municipais n\xE3o s\xE3o identificados.");
  notes.push('F\xE9rias programadas (cadastro de F\xE9rias) abonam o dia inteiro como "F\xE9rias", sem criar batidas.');
  notes.push("Folga, feriado e atestado aprovados na corre\xE7\xE3o de ponto abonam o dia inteiro, sem criar batidas.");
  notes.push("Banco de horas, compens\xE7\xF5es, abonos manuais e toler\xE2ncia (CLT art. 58 \xA71\xBA) dependem de regras/conven\xE7\xE3o n\xE3o cadastradas e n\xE3o foram aplicados.");
  return { from: input.from, to: input.to, timeZone: tz, days, totals, notes };
}
function fmtMinutes(min, signed = false) {
  if (min == null) return "\u2014";
  const sign = min < 0 ? "-" : signed && min > 0 ? "+" : "";
  const a = Math.abs(Math.round(min));
  return `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}
function fmtMark(m, tz) {
  const t2 = localParts(m.time, tz);
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
  const to = localParts(m.time, tz).hm;
  const why = `Justificativa: ${m.justification}${m.reviewedBy ? ` (por ${m.reviewedBy})` : ""}`;
  if (!m.originalLabel) return `${m.label}: batida inclu\xEDda manualmente \xE0s ${to}. ${why}`;
  const from = localParts(m.originalTime, tz).hm;
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
    g.times.push(localParts(m.time, tz).hm);
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
    groups.set(why, [...groups.get(why) || [], localParts(m.time, tz).hm]);
  }
  const parts = [...groups.entries()].map(([why, times]) => `${times.sort().join(", ")} \u2014 ${why}`);
  return `${list.length > 1 ? "Batidas desconsideradas" : "Batida desconsiderada"}: ${parts.join("; ")}`;
}
function mirrorRows(report) {
  const tz = report.timeZone;
  return report.days.map((d) => {
    const pick = (t2) => d.marks.filter((m) => m.type === t2).map((m) => fmtMark(m, tz)).join(" / ") || "\u2014";
    const has = d.marks.length > 0;
    const adj = treatmentTexts(d.marks, tz);
    const dis = disregardedText(d.disregarded, tz);
    if (dis) adj.push(dis);
    const issues = [...d.issues, ...adj].join("; ") || "";
    return [
      fmtDate(d.date),
      WEEKDAYS[d.weekday],
      pick("clock_in"),
      pick("break_start"),
      pick("break_end"),
      pick("clock_out"),
      has ? fmtMinutes(d.workedMinutes) : "\u2014",
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
var MARK_LABEL, DAY, dayNum, weekdayOf, addDay, toMin, pad, fmtDate, WEEKDAYS, MIRROR_HEADERS;
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
    pad = (n) => String(n).padStart(2, "0");
    fmtDate = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "S\xE1b"];
    MIRROR_HEADERS = ["Data", "Dia", "Entrada", "In\xEDcio intervalo", "Retorno intervalo", "Sa\xEDda", "Trabalhadas", "Intervalo", "Previstas", "Diferen\xE7a", "Extras", "Adic. noturno", "Ocorr\xEAncias"];
  }
});

// server/modules/correctionExtras.ts
import { and as and3, eq as eq3, gte, inArray as inArray2, lt, sql as sql3 } from "drizzle-orm";
async function ensureCorrectionExtras() {
  if (ready) return ready;
  ready = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(sql3`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS justificationType varchar(32) NULL DEFAULT 'normal'`);
    await database2.execute(sql3`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS attachmentKey varchar(512) NULL`);
  })().catch((e) => {
    ready = null;
    throw e;
  });
  return ready;
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
  const rows4 = await database2.select().from(timeCorrectionRequests).where(and3(
    eq3(timeCorrectionRequests.companyId, companyId),
    inArray2(timeCorrectionRequests.memberAccountId, memberIds),
    eq3(timeCorrectionRequests.status, "approved"),
    gte(timeCorrectionRequests.requestedTime, start),
    lt(timeCorrectionRequests.requestedTime, end)
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
var ready;
var init_correctionExtras = __esm({
  "server/modules/correctionExtras.ts"() {
    "use strict";
    init_mediaKeys();
    init_db();
    init_schema();
    init_storage();
    init_correctionExcuse();
    ready = null;
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
function localParts2(date3, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(date3);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { y: p.year, mo: p.month, d: p.day, h: p.hour === "24" ? "00" : p.hour, mi: p.minute };
}
function formatDH(date3, timeZone) {
  const p = localParts2(date3, timeZone);
  return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:00${tzOffset(date3, timeZone)}`;
}
function formatD(date3, timeZone) {
  const p = localParts2(date3, timeZone);
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
  const payload = [
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
  return sha256(payload + (previousHash || ""));
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
import { sql as sql4, inArray as inArray3, and as and4, eq as eq4 } from "drizzle-orm";
async function ensurePunchLedger() {
  if (ready2) return ready2;
  ready2 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    for (const alter of ALTERS) await database2.execute(sql4.raw(`ALTER TABLE time_events ${alter}`));
    await database2.execute(sql4.raw("CREATE UNIQUE INDEX IF NOT EXISTS time_events_company_nsr_unique ON time_events (companyId, nsr)"));
    await database2.execute(sql4.raw("CREATE INDEX IF NOT EXISTS time_events_replaces_idx ON time_events (companyId, replacesEventId)"));
    await database2.execute(sql4.raw(`CREATE TABLE IF NOT EXISTS rep_ledger_state (
      companyId INT NOT NULL PRIMARY KEY,
      lastNsr BIGINT NOT NULL DEFAULT 0,
      lastHash VARCHAR(64) NULL,
      lastTreatmentHash VARCHAR(64) NULL,
      initializedAt TIMESTAMP NULL,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`));
    await database2.execute(sql4.raw(`CREATE TABLE IF NOT EXISTS timesheet_acceptances (
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
    ready2 = null;
    throw e;
  });
  return ready2;
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
  await tx.execute(sql4`INSERT IGNORE INTO rep_ledger_state (companyId, lastNsr) VALUES (${companyId}, 0)`);
  const [rows4] = await tx.execute(sql4`SELECT lastNsr, lastHash, lastTreatmentHash, initializedAt FROM rep_ledger_state WHERE companyId = ${companyId} FOR UPDATE`);
  const row2 = rows4?.[0] ?? {};
  let state = { lastNsr: Number(row2.lastNsr ?? 0), lastHash: row2.lastHash ?? null, lastTreatmentHash: row2.lastTreatmentHash ?? null };
  if (!row2.initializedAt) {
    state = await sealLegacy(tx, companyId, state);
    await tx.execute(sql4`UPDATE rep_ledger_state SET lastNsr = ${state.lastNsr}, lastHash = ${state.lastHash}, lastTreatmentHash = ${state.lastTreatmentHash}, initializedAt = UTC_TIMESTAMP() WHERE companyId = ${companyId}`);
  }
  return state;
}
async function sealLegacy(tx, companyId, state) {
  const [rows4] = await tx.execute(sql4`SELECT id, memberAccountId, eventType, serverTime, deviceTime, latitude, longitude, accuracy, notes FROM time_events WHERE companyId = ${companyId} AND recordHash IS NULL ORDER BY id`);
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
      await tx.execute(sql4`UPDATE time_events SET origin = 'inclusion', reason = ${reason}, recordHash = ${hash2}, prevHash = ${lastTreatmentHash}, timeZone = ${DEFAULT_TZ}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
      lastTreatmentHash = hash2;
      continue;
    }
    const nsr = lastNsr + 1;
    const p = { nsr, markedAt, recordedAt, cpf, timeZone: DEFAULT_TZ, collector: COLLECTOR_BROWSER, offline };
    const hash = punchHash(p, lastHash);
    const content = punchContentHash({ nsr, memberAccountId: memberId, eventType: r.eventType, markedAt, recordedAt, clientTime: null, latitude: r.latitude, longitude: r.longitude, accuracy: r.accuracy, timeZone: DEFAULT_TZ, cpf, offline });
    await tx.execute(sql4`UPDATE time_events SET nsr = ${nsr}, recordHash = ${hash}, prevHash = ${lastHash}, contentHash = ${content}, timeZone = ${DEFAULT_TZ}, collectorId = ${COLLECTOR_BROWSER}, offline = ${offline ? 1 : 0}, workerCpf = ${cpf}, sealedLegacy = 1 WHERE id = ${r.id} AND recordHash IS NULL`);
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
    await tx.execute(sql4`UPDATE rep_ledger_state SET lastNsr = ${nsr}, lastHash = ${hash} WHERE companyId = ${input.companyId}`);
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
  await tx.execute(sql4`UPDATE rep_ledger_state SET lastTreatmentHash = ${hash} WHERE companyId = ${input.companyId}`);
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
    const rows4 = await database2.select({ id: timeEvents.replacesEventId }).from(timeEvents).where(and4(eq4(timeEvents.companyId, companyId), inArray3(timeEvents.replacesEventId, chunk)));
    for (const r of rows4) if (r.id != null) out.add(Number(r.id));
  }
  return out;
}
async function ensureDisregardsTable() {
  if (disregardsReady) return disregardsReady;
  disregardsReady = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql4.raw(`CREATE TABLE IF NOT EXISTS time_event_disregards (
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
      const res = await database2.execute(sql4`SELECT id, timeEventId, reason, decidedByName, createdAt FROM time_event_disregards WHERE companyId = ${companyId} AND revertedAt IS NULL AND timeEventId IN (${sql4.join(chunk.map((id2) => sql4`${id2}`), sql4`, `)}) ORDER BY id`);
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
var DEFAULT_TZ, NEW_SHIFT_MARKER, truncSec, ready2, ALTERS, LEGACY_INCLUSION, disregardsReady;
var init_ledger = __esm({
  "server/ponto/ledger.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_repFormat();
    DEFAULT_TZ = "America/Sao_Paulo";
    NEW_SHIFT_MARKER = "[NOVA-JORNADA-MESMO-DIA]";
    truncSec = (d) => new Date(Math.floor(d.getTime() / 1e3) * 1e3);
    ready2 = null;
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

// server/modules/vacations.ts
var vacations_exports = {};
__export(vacations_exports, {
  ensureVacationSchedulesTable: () => ensureVacationSchedulesTable,
  vacationsRouter: () => vacationsRouter
});
import { TRPCError as TRPCError5 } from "@trpc/server";
import { and as and5, eq as eq5, gte as gte2, lte, ne, inArray as inArray4 } from "drizzle-orm";
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
  if (e < s) throw new TRPCError5({ code: "BAD_REQUEST", message: "Data final n\xE3o pode ser anterior \xE0 inicial." });
  return Math.round((e.getTime() - s.getTime()) / 864e5) + 1;
}
function assertManager(ctx) {
  if (ctx.user?.role === "promoter") {
    throw new TRPCError5({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem gerenciar f\xE9rias." });
  }
}
async function assertNoOverlap(tx, companyId, memberAccountId, startDate, endDate, excludeId) {
  const conditions = [
    eq5(vacationSchedules.companyId, companyId),
    eq5(vacationSchedules.memberAccountId, memberAccountId),
    eq5(vacationSchedules.status, "scheduled"),
    and5(lte(vacationSchedules.startDate, dbDate(endDate)), gte2(vacationSchedules.endDate, dbDate(startDate)))
  ];
  if (excludeId) conditions.push(ne(vacationSchedules.id, excludeId));
  const existing = await tx.select({ id: vacationSchedules.id }).from(vacationSchedules).where(and5(...conditions)).limit(1);
  if (existing.length) throw new TRPCError5({ code: "CONFLICT", message: "J\xE1 existe f\xE9rias sobrepostas para este funcion\xE1rio no per\xEDodo informado." });
}
async function teamOverlapWarning(database2, companyId, memberAccountId, startDate, endDate) {
  const [me] = await database2.select({ supervisorId: memberAccounts2.supervisorId }).from(memberAccounts2).where(eq5(memberAccounts2.id, memberAccountId)).limit(1);
  if (!me?.supervisorId) return null;
  const teammates = await database2.select({ id: memberAccounts2.id, userName: memberAccounts2.userName }).from(memberAccounts2).where(and5(eq5(memberAccounts2.companyId, companyId), eq5(memberAccounts2.supervisorId, me.supervisorId), ne(memberAccounts2.id, memberAccountId), eq5(memberAccounts2.active, true)));
  if (!teammates.length) return null;
  const ids = teammates.map((t2) => t2.id);
  const overlaps = await database2.select({ memberAccountId: vacationSchedules.memberAccountId }).from(vacationSchedules).where(and5(
    eq5(vacationSchedules.companyId, companyId),
    eq5(vacationSchedules.status, "scheduled"),
    inArray4(vacationSchedules.memberAccountId, ids),
    and5(lte(vacationSchedules.startDate, dbDate(endDate)), gte2(vacationSchedules.endDate, dbDate(startDate)))
  ));
  if (!overlaps.length) return null;
  const names = teammates.filter((t2) => overlaps.some((o) => o.memberAccountId === t2.id)).map((t2) => t2.userName);
  return names.length ? `Aten\xE7\xE3o: ${names.join(", ")} da mesma equipe tamb\xE9m estar\xE3o de f\xE9rias neste per\xEDodo.` : null;
}
async function requireDb() {
  const database2 = await getDb();
  if (!database2) throw new TRPCError5({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indispon\xEDvel no momento. Tente novamente em instantes." });
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
        return database2.select({ id: memberAccounts2.id, userName: memberAccounts2.userName }).from(memberAccounts2).where(and5(eq5(memberAccounts2.companyId, ctx.accountId), eq5(memberAccounts2.active, true))).orderBy(memberAccounts2.userName);
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
        const conds = [eq5(vacationSchedules.companyId, ctx.accountId)];
        if (input?.memberAccountId) conds.push(eq5(vacationSchedules.memberAccountId, input.memberAccountId));
        if (input?.status && input.status !== "all") conds.push(eq5(vacationSchedules.status, input.status));
        if (input?.from) conds.push(gte2(vacationSchedules.endDate, dbDate(input.from)));
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
        }).from(vacationSchedules).innerJoin(memberAccounts2, eq5(memberAccounts2.id, vacationSchedules.memberAccountId)).where(and5(...conds)).orderBy(vacationSchedules.startDate);
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
      }),
      mine: protectedProcedure.query(async ({ ctx }) => {
        if (!ctx.memberAccountId || !ctx.accountId) throw new TRPCError5({ code: "FORBIDDEN" });
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        const rows4 = await database2.select().from(vacationSchedules).where(and5(eq5(vacationSchedules.companyId, ctx.accountId), eq5(vacationSchedules.memberAccountId, ctx.memberAccountId))).orderBy(vacationSchedules.startDate);
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
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
        const [member] = await database2.select({ id: memberAccounts2.id, companyId: memberAccounts2.companyId, active: memberAccounts2.active }).from(memberAccounts2).where(eq5(memberAccounts2.id, input.memberAccountId)).limit(1);
        if (!member || member.companyId !== ctx.accountId || !member.active) {
          throw new TRPCError5({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado ou inativo." });
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
          const [row2] = await tx.select().from(vacationSchedules).where(and5(eq5(vacationSchedules.id, input.id), eq5(vacationSchedules.companyId, ctx.accountId))).limit(1);
          if (!row2) throw new TRPCError5({ code: "NOT_FOUND" });
          if (row2.status === "cancelled") throw new TRPCError5({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel editar f\xE9rias canceladas." });
          await assertNoOverlap(tx, ctx.accountId, row2.memberAccountId, input.startDate, input.endDate, input.id);
          warning = await teamOverlapWarning(tx, ctx.accountId, row2.memberAccountId, input.startDate, input.endDate);
          await tx.update(vacationSchedules).set({
            startDate: dbDate(input.startDate),
            endDate: dbDate(input.endDate),
            days,
            notes: input.notes ?? row2.notes,
            updatedByMemberAccountId: ctx.memberAccountId
          }).where(eq5(vacationSchedules.id, input.id));
        });
        return { ok: true, warning };
      }),
      cancel: commercialFeatureProcedure("timeTracking").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
        assertManager(ctx);
        await ensureVacationSchedulesTable();
        const database2 = await requireDb();
        await database2.transaction(async (tx) => {
          const [row2] = await tx.select().from(vacationSchedules).where(and5(eq5(vacationSchedules.id, input.id), eq5(vacationSchedules.companyId, ctx.accountId))).limit(1);
          if (!row2) throw new TRPCError5({ code: "NOT_FOUND" });
          if (row2.status === "cancelled") return;
          await tx.update(vacationSchedules).set({
            status: "cancelled",
            cancelledAt: /* @__PURE__ */ new Date(),
            cancelledByMemberAccountId: ctx.memberAccountId
          }).where(eq5(vacationSchedules.id, input.id));
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
        }).from(vacationSchedules).innerJoin(memberAccounts2, eq5(memberAccounts2.id, vacationSchedules.memberAccountId)).where(and5(
          eq5(vacationSchedules.companyId, ctx.accountId),
          eq5(vacationSchedules.status, "scheduled"),
          lte(vacationSchedules.startDate, dbDate(to)),
          gte2(vacationSchedules.endDate, dbDate(from))
        ));
        return rows4.map((row2) => ({ ...row2, startDate: asDateStr(row2.startDate), endDate: asDateStr(row2.endDate) }));
      })
    });
  }
});

// server/modules/mirrorData.ts
import { and as and6, eq as eq6, gte as gte3, inArray as inArray5, lt as lt2, sql as sql5 } from "drizzle-orm";
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
  return effectiveRows(await database2.select().from(timeEvents).where(and6(eq6(timeEvents.companyId, companyId), inArray5(timeEvents.memberAccountId, memberIds), gte3(effectiveEventTime, start), lt2(effectiveEventTime, end))).orderBy(effectiveEventTime), { keepDisregarded: true });
}
async function loadMemberVacations(companyId, memberIds, from, to) {
  const map = /* @__PURE__ */ new Map();
  if (!memberIds.length) return map;
  try {
    const { ensureVacationSchedulesTable: ensureVacationSchedulesTable2 } = await Promise.resolve().then(() => (init_vacations(), vacations_exports));
    await ensureVacationSchedulesTable2();
    const database2 = await getDb();
    if (!database2) return map;
    const rows4 = await database2.select({ memberAccountId: vacationSchedules.memberAccountId, startDate: vacationSchedules.startDate, endDate: vacationSchedules.endDate }).from(vacationSchedules).where(and6(eq6(vacationSchedules.companyId, companyId), eq6(vacationSchedules.status, "scheduled"), inArray5(vacationSchedules.memberAccountId, memberIds)));
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
    const rows4 = (await database2.execute(sql5`SELECT timeEventId, originalType, originalTime, justification, reviewedByName, createdAt FROM time_event_adjustments WHERE companyId = ${companyId} AND memberAccountId IN (${sql5.join(memberIds.map((id2) => sql5`${id2}`), sql5`, `)}) ORDER BY id`))[0];
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
    effectiveEventTime = sql5`COALESCE(${timeEvents.deviceTime}, ${timeEvents.serverTime})`;
    OPTIONAL_HOLIDAYS_SETTING = "mirror_optional_holidays_as_holiday";
  }
});

// server/modules/timesheetMirror.ts
var timesheetMirror_exports = {};
__export(timesheetMirror_exports, {
  ensureAdjustmentsTable: () => ensureAdjustmentsTable,
  recordAdjustment: () => recordAdjustment,
  timesheetMirrorRouter: () => timesheetMirrorRouter
});
import { z as z2 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
import { and as and7, eq as eq7, inArray as inArray6, sql as sql6 } from "drizzle-orm";
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
  await database2.execute(sql6`INSERT INTO time_event_adjustments
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
  if (!database2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const where = [eq7(memberAccounts2.companyId, companyId)];
  if (memberIds?.length) where.push(inArray6(memberAccounts2.id, memberIds));
  const rows4 = await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts2).leftJoin(promoterProfiles, eq7(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and7(...where));
  return rows4.filter((r) => r.role !== "company_admin");
}
var TZ, dateStr2, hm, adjustmentsReady, legalSchema, laborSchema, timesheetMirrorRouter;
var init_timesheetMirror2 = __esm({
  "server/modules/timesheetMirror.ts"() {
    "use strict";
    init_brDocs();
    init_trpc();
    init_db();
    init_schema();
    init_audit();
    init_timesheetMirror();
    init_correctionExtras();
    init_mirrorData();
    TZ = "America/Sao_Paulo";
    dateStr2 = z2.string().regex(/^\d{4}-\d{2}-\d{2}$/);
    hm = z2.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
    adjustmentsReady = null;
    legalSchema = z2.object({
      legalName: z2.string().trim().max(200).optional().default(""),
      document: z2.string().trim().max(32).optional().default("").refine((v) => !v || isValidCpfOrCnpj(v), "CNPJ/CPF inv\xE1lido: confira os n\xFAmeros."),
      // CNPJ/CPF do empregador
      establishment: z2.string().trim().max(200).optional().default(""),
      address: z2.string().trim().max(300).optional().default("")
    });
    laborSchema = z2.object({
      jobTitle: z2.string().trim().max(120).nullish(),
      admissionDate: dateStr2.nullish(),
      cpf: z2.string().trim().max(14).nullish().refine((v) => !v || isValidCpf(v), "CPF inv\xE1lido: confira os n\xFAmeros."),
      pis: z2.string().trim().max(20).nullish(),
      /** Horário contratual: pares entrada/saída, ex.: [["08:00","12:00"],["13:00","17:00"]]. */
      schedule: z2.array(z2.tuple([hm, hm])).max(4).nullish(),
      dailyMinutes: z2.number().int().min(0).max(1440).nullish(),
      intervalMinutes: z2.number().int().min(0).max(600).nullish(),
      workdays: z2.array(z2.number().int().min(0).max(6)).max(7).nullish(),
      nightEnabled: z2.boolean().optional(),
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
        const database2 = await getDb();
        const company = database2 ? (await database2.select({ name: companies2.name }).from(companies2).where(eq7(companies2.id, ctx.accountId)).limit(1))[0] : null;
        const legal = await readJson("company_legal_profile", ctx.accountId);
        return { name: company?.name ?? "", legal: legal ?? { legalName: "", document: "", establishment: "", address: "" } };
      }),
      saveCompanyProfile: companyAdminFeatureProcedure("timeTracking").input(legalSchema).mutation(async ({ ctx, input }) => {
        await setSetting("company_legal_profile", JSON.stringify(input), ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "company_legal_profile", description: "Atualizou dados de identifica\xE7\xE3o da empresa para o espelho de ponto", newData: input });
        return { success: true };
      }),
      /** Configuração do espelho: tratar Carnaval/Corpus Christi (ponto facultativo) como feriado abonado? */
      getMirrorOptions: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => loadMirrorOptions(ctx.accountId)),
      saveMirrorOptions: companyAdminFeatureProcedure("timeTracking").input(z2.object({ optionalHolidaysAsHoliday: z2.boolean() })).mutation(async ({ ctx, input }) => {
        await setSetting(OPTIONAL_HOLIDAYS_SETTING, input.optionalHolidaysAsHoliday ? "1" : "0", ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "mirror_options", description: `Carnaval/Corpus Christi ${input.optionalHolidaysAsHoliday ? "passam a ser abonados como feriado" : "deixam de ser abonados automaticamente"} no espelho de ponto`, newData: input });
        return { success: true };
      }),
      saveLaborProfile: companyAdminFeatureProcedure("timeTracking").input(z2.object({ memberId: z2.number().int().positive(), profile: laborSchema })).mutation(async ({ ctx, input }) => {
        const [member] = await companyMembers(ctx.accountId, [input.memberId]);
        if (!member) throw new TRPCError6({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado." });
        await setSetting(`labor_profile:${input.memberId}`, JSON.stringify(input.profile), ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "labor_profile", entityId: input.memberId, entityLabel: member.name, description: `Atualizou perfil trabalhista de ${member.name}`, newData: input.profile });
        return { success: true };
      }),
      /** Gera os dados do espelho. Somente leitura; registra a emissão na auditoria. */
      generate: companyAdminFeatureProcedure("timeTracking").input(z2.object({ memberIds: z2.array(z2.number().int().positive()).max(500).optional(), from: dateStr2, to: dateStr2 })).query(async ({ ctx, input }) => {
        if (input.from > input.to) throw new TRPCError6({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
        const spanDays = (Date.parse(input.to) - Date.parse(input.from)) / 864e5 + 1;
        if (spanDays > 366) throw new TRPCError6({ code: "BAD_REQUEST", message: "O per\xEDodo m\xE1ximo \xE9 de 366 dias." });
        const database2 = await getDb();
        if (!database2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
        await ensureAdjustmentsTable();
        const members = await companyMembers(ctx.accountId, input.memberIds);
        if (input.memberIds?.length && members.length !== new Set(input.memberIds).size) throw new TRPCError6({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
        const company = (await database2.select({ name: companies2.name }).from(companies2).where(eq7(companies2.id, ctx.accountId)).limit(1))[0];
        const legal = await readJson("company_legal_profile", ctx.accountId);
        const memberIds = members.map((m) => m.id);
        const eventRows = await loadMirrorEventRows(ctx.accountId, memberIds, input.from, input.to);
        const eventsByMember = /* @__PURE__ */ new Map();
        for (const r of eventRows) eventsByMember.set(r.memberAccountId, [...eventsByMember.get(r.memberAccountId) || [], r]);
        const adjByEvent = await loadAdjustmentsByEvent(ctx.accountId, memberIds);
        const laborByMember = /* @__PURE__ */ new Map();
        if (memberIds.length) {
          const laborRows = (await database2.execute(sql6`SELECT settingKey, settingValue FROM system_settings WHERE accountId = ${ctx.accountId} AND settingKey LIKE 'labor\\_profile:%'`))[0];
          for (const r of laborRows) {
            try {
              laborByMember.set(Number(String(r.settingKey).split(":")[1]), JSON.parse(r.settingValue));
            } catch {
            }
          }
        }
        const excusesByMember = await loadApprovedDayExcuses(ctx.accountId, memberIds, input.from, input.to);
        const vacationsByMember = await loadMemberVacations(ctx.accountId, memberIds, input.from, input.to);
        const options = await loadMirrorOptions(ctx.accountId);
        const results = members.map((m) => {
          const events = toMirrorEvents(eventsByMember.get(m.id) || [], adjByEvent);
          const labor = laborByMember.get(m.id) ?? null;
          return { member: { id: m.id, name: m.name, role: m.role, employeeCode: m.employeeCode ?? null }, labor: labor ? { ...labor } : null, report: buildMirror({ events, from: input.from, to: input.to, timeZone: TZ, labor, excuses: excusesByMember.get(m.id) || [], vacations: vacationsByMember.get(m.id) || [], options }) };
        });
        void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "timesheet_mirror", description: `Gerou espelho de ponto ${input.from} a ${input.to} (${results.length} funcion\xE1rio(s))`, newData: { from: input.from, to: input.to, memberIds: results.map((r) => r.member.id) } });
        return { company: { name: company?.name ?? "", legal: legal ?? null }, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), timeZone: TZ, results };
      }),
      /** Registra no log de auditoria que o espelho foi exportado/impresso/compartilhado. */
      logExport: companyAdminFeatureProcedure("timeTracking").input(z2.object({ kind: z2.enum(["pdf", "xlsx", "print", "whatsapp"]), from: dateStr2, to: dateStr2, count: z2.number().int().min(1).max(500) })).mutation(async ({ ctx, input }) => {
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
import { inArray as inArray7, sql as sql7 } from "drizzle-orm";
function local(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ2, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
async function findMissingPunches(opts = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  await ensurePunchLedger();
  const since = new Date(Date.now() - 14 * 864e5);
  const filters = [sql7`COALESCE(te.deviceTime, te.serverTime) >= ${since}`];
  if (opts.companyId) filters.push(sql7`te.companyId = ${opts.companyId}`);
  if (opts.memberId) filters.push(sql7`te.memberAccountId = ${opts.memberId}`);
  const where = sql7.join(filters, sql7` AND `);
  const [raw] = await database2.execute(sql7`
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
  const members = await database2.select({ id: memberAccounts2.id, companyId: memberAccounts2.companyId, name: memberAccounts2.userName, email: memberAccounts2.email, active: memberAccounts2.active }).from(memberAccounts2).where(inArray7(memberAccounts2.id, ids));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const profiles = await database2.select({ id: promoterProfiles.memberAccountId, end: promoterProfiles.workEndTime }).from(promoterProfiles).where(inArray7(promoterProfiles.memberAccountId, ids));
  const endByMember = new Map(profiles.map((p) => [p.id, p.end]));
  const companyIds = [...new Set(open.map((o) => o.companyId))];
  const [settingRows] = await database2.execute(sql7`SELECT accountId, settingValue FROM system_settings WHERE settingKey = 'auto_clock_out_time' AND accountId IN (${sql7.join(companyIds.map((c) => sql7`${c}`), sql7`, `)})`);
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
      if (limit && now.hm >= limit) reason = "past_end_time";
    }
    if (!reason) continue;
    out.push({ memberId: e.memberAccountId, companyId: e.companyId, name: member.name, email: member.email, lastType: e.eventType, lastLabel: LABEL[e.eventType] ?? e.eventType, missing: NEXT[e.eventType] ?? "Sa\xEDda", lastTime: e.t.toISOString(), day: lt7.date, reason });
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
import { sql as sql10 } from "drizzle-orm";
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
  await database2.execute(sql10.raw(`CREATE TABLE IF NOT EXISTS clock_checks (
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
      const [rows4] = await database2.execute(sql10`SELECT UNIX_TIMESTAMP(UTC_TIMESTAMP(3)) * 1000 AS ms`);
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
      const [prev] = await database2.execute(sql10`SELECT ok FROM clock_checks WHERE error IS NULL ORDER BY id DESC LIMIT 1`);
      previousOk = prev?.[0] ? Boolean(Number(prev[0].ok)) : null;
      await database2.execute(sql10`INSERT INTO clock_checks (source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error)
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
  const [rows4] = await database2.execute(sql10`SELECT checkedAt, source, method, precisionMs, serverOffsetMs, databaseOffsetMs, ok, error FROM clock_checks ORDER BY id DESC LIMIT ${limit}`);
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

// server/modules/timesheetArchive.ts
var timesheetArchive_exports = {};
__export(timesheetArchive_exports, {
  archiveClosedMonth: () => archiveClosedMonth,
  ensureTimesheetArchivesTable: () => ensureTimesheetArchivesTable,
  runTimesheetArchiveJob: () => runTimesheetArchiveJob,
  timesheetArchiveRouter: () => timesheetArchiveRouter
});
import { createHash as createHash2 } from "node:crypto";
import { z as z7 } from "zod";
import { TRPCError as TRPCError10 } from "@trpc/server";
import { and as and11, eq as eq11, inArray as inArray11, sql as sql13 } from "drizzle-orm";
async function ensureTimesheetArchivesTable() {
  if (ready5) return ready5;
  ready5 = (async () => {
    const database2 = await getDb();
    if (!database2) return;
    await database2.execute(sql13`CREATE TABLE IF NOT EXISTS timesheet_archives (
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
    ready5 = null;
    throw e;
  });
  return ready5;
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
  const where = [eq11(memberAccounts2.companyId, companyId)];
  if (memberIds?.length) where.push(inArray11(memberAccounts2.id, memberIds));
  const rows4 = await database2.select({
    id: memberAccounts2.id,
    name: memberAccounts2.userName,
    role: memberAccounts2.role,
    active: memberAccounts2.active,
    employeeCode: promoterProfiles.employeeCode
  }).from(memberAccounts2).leftJoin(promoterProfiles, eq11(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and11(...where));
  return rows4.filter((r) => r.role !== "company_admin");
}
async function buildPdfBuffer(opts) {
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
  doc.text(`Gerado em: ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR", { timeZone: TZ4 })}`, 150, y);
  y += 7;
  doc.setFontSize(7).setFont("helvetica", "bold").setFillColor(226, 232, 240);
  const widths = [18, 9, 22, 22, 22, 22, 16, 14, 14, 14, 14, 16];
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
  const company = (await database2.select({ name: companies2.name }).from(companies2).where(eq11(companies2.id, companyId)).limit(1))[0];
  const ids = members.map((m) => m.id);
  const eventRows = await loadMirrorEventRows(companyId, ids, from, to);
  const byMember = /* @__PURE__ */ new Map();
  for (const r of eventRows) byMember.set(r.memberAccountId, [...byMember.get(r.memberAccountId) || [], r]);
  const excusesByMember = await loadApprovedDayExcuses(companyId, ids, from, to);
  const vacationsByMember = await loadMemberVacations(companyId, ids, from, to);
  const options = await loadMirrorOptions(companyId);
  const adjByEvent = await loadAdjustmentsByEvent(companyId, ids);
  const results = [];
  for (const m of members) {
    try {
      const labor = await readJson3(`labor_profile:${m.id}`, companyId);
      const events = toMirrorEvents(byMember.get(m.id) || [], adjByEvent);
      const report = buildMirror({ events, from, to, timeZone: TZ4, labor, excuses: excusesByMember.get(m.id) || [], vacations: vacationsByMember.get(m.id) || [], options });
      const buf = await buildPdfBuffer({
        companyName: company?.name ?? "",
        memberName: m.name,
        employeeCode: m.employeeCode ?? null,
        from,
        to,
        report
      });
      const hash = createHash2("sha256").update(buf).digest("hex");
      const existing = (await database2.execute(sql13`SELECT id, version, contentHash FROM timesheet_archives WHERE companyId = ${companyId} AND memberAccountId = ${m.id} AND year = ${year} AND month = ${month} ORDER BY version DESC LIMIT 1`))[0] ?? [];
      const last = existing[0];
      if (last && last.contentHash === hash) {
        results.push({ companyId, memberId: m.id, year, month, version: last.version, skipped: true, reason: "hash igual" });
        continue;
      }
      const version = last ? Number(last.version) + 1 : 1;
      const keyBase = `archives/${companyId}/${year}/${String(month).padStart(2, "0")}/${m.id}/v${version}-espelho.pdf`;
      const uploaded = await storagePut(keyBase, buf, "application/pdf");
      await database2.execute(sql13`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, fileKey, contentHash, mimeType, sizeBytes, status, generatedAt)
        VALUES (${companyId}, ${m.id}, ${year}, ${month}, ${version}, ${uploaded.key}, ${hash}, 'application/pdf', ${buf.length}, 'ready', NOW())`);
      results.push({ companyId, memberId: m.id, year, month, version, skipped: false });
    } catch (err) {
      console.warn(`[archive] company=${companyId} member=${m.id} ${year}-${month}`, err);
      try {
        await database2.execute(sql13`INSERT INTO timesheet_archives (companyId, memberAccountId, year, month, version, status, notes, generatedAt)
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
  const companiesRows = opts?.companyId ? await database2.select({ id: companies2.id }).from(companies2).where(eq11(companies2.id, opts.companyId)).limit(1) : await database2.select({ id: companies2.id }).from(companies2).where(eq11(companies2.active, true)).limit(opts?.limitCompanies ?? 20);
  const all = [];
  for (const c of companiesRows) {
    for (const { year, month } of months) {
      const r = await archiveClosedMonth(c.id, year, month);
      all.push(...r);
    }
  }
  return { processed: companiesRows.length, results: all };
}
var TZ4, GRACE_DAYS, ready5, timesheetArchiveRouter;
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
    init_mirrorData();
    TZ4 = "America/Sao_Paulo";
    GRACE_DAYS = 5;
    ready5 = null;
    timesheetArchiveRouter = router({
      list: companyAdminFeatureProcedure("timeTracking").input(z7.object({
        memberId: z7.number().int().positive().optional(),
        year: z7.number().int().min(2020).max(2100).optional(),
        month: z7.number().int().min(1).max(12).optional()
      }).optional()).query(async ({ ctx, input }) => {
        await ensureTimesheetArchivesTable();
        const database2 = await getDb();
        if (!database2) return [];
        const conds = [sql13`a.companyId = ${ctx.accountId}`];
        if (input?.memberId) conds.push(sql13`a.memberAccountId = ${input.memberId}`);
        if (input?.year) conds.push(sql13`a.year = ${input.year}`);
        if (input?.month) conds.push(sql13`a.month = ${input.month}`);
        const rows4 = (await database2.execute(sql13`SELECT a.*, m.userName AS memberName
        FROM timesheet_archives a
        LEFT JOIN member_accounts m ON m.id = a.memberAccountId AND m.companyId = a.companyId
        WHERE ${sql13.join(conds, sql13` AND `)}
        ORDER BY a.year DESC, a.month DESC, a.memberAccountId, a.version DESC
        LIMIT 500`))[0] ?? [];
        return rows4;
      }),
      downloadUrl: companyAdminFeatureProcedure("timeTracking").input(z7.object({ id: z7.number().int().positive() })).query(async ({ ctx, input }) => {
        await ensureTimesheetArchivesTable();
        const database2 = await getDb();
        if (!database2) throw new TRPCError10({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const rows4 = (await database2.execute(sql13`SELECT fileKey, status FROM timesheet_archives WHERE id = ${input.id} AND companyId = ${ctx.accountId} LIMIT 1`))[0] ?? [];
        const row2 = rows4[0];
        if (!row2 || row2.status !== "ready" || !row2.fileKey) throw new TRPCError10({ code: "NOT_FOUND", message: "Arquivo n\xE3o encontrado ou indispon\xEDvel." });
        const url = await storageGetSignedUrl(row2.fileKey);
        return { url };
      }),
      archiveNow: companyAdminFeatureProcedure("timeTracking").input(z7.object({ year: z7.number().int().min(2020).max(2100), month: z7.number().int().min(1).max(12) })).mutation(async ({ ctx, input }) => {
        const now = /* @__PURE__ */ new Date();
        const curY = now.getUTCFullYear(), curM = now.getUTCMonth() + 1;
        if (input.year > curY || input.year === curY && input.month >= curM) {
          throw new TRPCError10({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel arquivar o m\xEAs corrente ou futuro." });
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
function tlv(id2, value) {
  const v = String(value);
  const len = String(v.length).padStart(2, "0");
  return `${id2}${len}${v}`;
}
function crc16Ccitt(payload) {
  let crc = 65535;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
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
  const desc7 = input.description ? tlv("02", sanitizePixText(input.description, 25)) : "";
  const merchantAccount = tlv("26", gui + desc7);
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
      message: `O acesso da empresa est\xE1 bloqueado por falta de pagamento. Venceu em ${dueDateLabel}. Regularize via Pix ou WhatsApp.`
    };
  }
  if (daysUntilDue < 0) {
    const left = Math.max(0, daysUntilBlock);
    return {
      ...base,
      phase: "overdue",
      show: true,
      dismissable: false,
      message: `Pagamento em atraso desde ${dueDateLabel}. O acesso ser\xE1 bloqueado em ${left} dia(s). Pague via Pix ou envie o comprovante no WhatsApp.`
    };
  }
  if (PRE_DUE_REMINDER_DAYS.includes(daysUntilDue)) {
    return {
      ...base,
      phase: "pre_due",
      show: true,
      dismissable: true,
      message: `O pagamento de ${amountLabel ?? "sua mensalidade"} vence em ${daysUntilDue} dia(s) (${dueDateLabel}).`
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
    init_subscriptionAccess();
    PRE_DUE_REMINDER_DAYS = [5, 3, 1];
    MONTHLY_AMOUNT_KEY = "monthly_amount";
    BLOCK_AFTER_OVERDUE_KEY = "block_after_overdue_days";
    BILLING_DAY_KEY = "billing_day";
    BR_TZ = "America/Sao_Paulo";
  }
});

// server/platformCompanies.ts
var platformCompanies_exports = {};
__export(platformCompanies_exports, {
  archiveCompany: () => archiveCompany,
  deletePayment: () => deletePayment,
  endOfDay: () => endOfDay,
  listCompaniesOverview: () => listCompaniesOverview,
  listCompanyPayments: () => listCompanyPayments,
  markCompanyPaid: () => markCompanyPaid,
  purgeCompany: () => purgeCompany,
  registerCompanyPayment: () => registerCompanyPayment,
  resolveGraceDays: () => resolveGraceDays,
  resolveMonthlyAmount: () => resolveMonthlyAmount,
  setCompanyBilling: () => setCompanyBilling,
  setCompanyBlocked: () => setCompanyBlocked,
  setCompanyPlan: () => setCompanyPlan,
  startOfDay: () => startOfDay
});
import { and as and12, eq as eq12, inArray as inArray12, sql as sql14 } from "drizzle-orm";
import { TRPCError as TRPCError11 } from "@trpc/server";
async function database() {
  const d = await getDb();
  if (!d) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return d;
}
async function listCompaniesOverview() {
  const d = await database();
  const [rows4, plans, pays, counts, admins, flags] = await Promise.all([
    d.select().from(companies).orderBy(companies.name),
    d.select().from(subscriptionPlans),
    d.execute(sql14`SELECT companyId, MAX(paymentDate) AS lastPayment, COUNT(*) AS n FROM payments WHERE status IN ('RECEIVED','CONFIRMED','MOCK_APPROVED') GROUP BY companyId`),
    d.execute(sql14`SELECT companyId, COUNT(*) AS total, SUM(active) AS ativos FROM member_accounts GROUP BY companyId`),
    d.execute(sql14`SELECT companyId, MIN(email) AS email, MIN(userName) AS name FROM member_accounts WHERE role = 'company_admin' GROUP BY companyId`),
    d.select().from(systemSettings).where(inArray12(systemSettings.settingKey, ["blocked_reason", "archived_at", MONTHLY_AMOUNT_KEY, BLOCK_AFTER_OVERDUE_KEY]))
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const map = (r, key = "companyId") => new Map(r[0].map((x) => [Number(x[key]), x]));
  const payBy = map(pays), countBy = map(counts), adminBy = map(admins);
  const flagBy = new Map(flags.map((f) => [`${f.accountId}:${f.settingKey}`, f.settingValue]));
  return rows4.map((c) => {
    const plan = c.planId ? planById.get(c.planId) : null;
    const monthlyAmount = flagBy.get(`${c.id}:${MONTHLY_AMOUNT_KEY}`) || (plan?.price != null ? String(plan.price) : null);
    const blockAfter = flagBy.get(`${c.id}:${BLOCK_AFTER_OVERDUE_KEY}`);
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      createdAt: c.createdAt,
      archivedAt: flagBy.get(`${c.id}:archived_at`) ?? null,
      blockedReason: flagBy.get(`${c.id}:blocked_reason`) ?? null,
      planId: c.planId ?? null,
      planName: plan?.name ?? null,
      planPrice: plan?.price ?? null,
      monthlyAmount,
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
      adminName: adminBy.get(c.id)?.name ?? null
    };
  });
}
async function setCompanyBlocked(companyId, blocked, reason) {
  const d = await database();
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  await updateCompany(companyId, { active: !blocked });
  if (blocked) await setSetting("blocked_reason", (reason || "").trim().slice(0, 300) || "Acesso bloqueado pelo administrador da plataforma.", companyId);
  else await d.delete(systemSettings).where(and12(eq12(systemSettings.accountId, companyId), eq12(systemSettings.settingKey, "blocked_reason")));
  if (blocked) {
    const ids = (await d.select({ id: memberAccounts.id }).from(memberAccounts).where(eq12(memberAccounts.companyId, companyId))).map((r) => r.id);
    if (ids.length) await d.delete(memberSessions).where(inArray12(memberSessions.memberAccountId, ids));
  }
  return company;
}
async function setCompanyPlan(input) {
  const d = await database();
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  const plan = await getSubscriptionPlanById(input.planId);
  if (!plan) throw new TRPCError11({ code: "NOT_FOUND", message: "Plano n\xE3o encontrado." });
  if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError11({ code: "BAD_REQUEST", message: "A validade final n\xE3o pode ser anterior ao in\xEDcio." });
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
    gracePeriodEndsAt: end ? addDaysDate(end, Math.max(0, input.graceDays ?? DEFAULT_OVERDUE_GRACE_DAYS)) : null
  }).where(eq12(companies.id, input.companyId));
  if (input.endsAt) await ensureBillingDay(input.companyId, input.endsAt);
  return { success: true };
}
async function registerCompanyPayment(input) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (input.periodTo < input.periodFrom) throw new TRPCError11({ code: "BAD_REQUEST", message: "O fim do per\xEDodo pago n\xE3o pode ser anterior ao in\xEDcio." });
  const planId = input.planId ?? company.planId;
  if (!planId) throw new TRPCError11({ code: "BAD_REQUEST", message: "Selecione um plano para esta empresa antes de registrar o pagamento." });
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
async function deletePayment(id2, companyId) {
  const d = await database();
  const r = await d.delete(payments).where(and12(eq12(payments.id, id2), eq12(payments.companyId, companyId)));
  if (!r[0]?.affectedRows) throw new TRPCError11({ code: "NOT_FOUND", message: "Pagamento n\xE3o encontrado." });
}
async function archiveCompany(companyId, archived) {
  const d = await database();
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (archived) {
    await setCompanyBlocked(companyId, true, "Empresa exclu\xEDda pelo administrador da plataforma.");
    await setSetting("archived_at", (/* @__PURE__ */ new Date()).toISOString(), companyId);
  } else {
    await d.delete(systemSettings).where(and12(eq12(systemSettings.accountId, companyId), eq12(systemSettings.settingKey, "archived_at")));
    await setCompanyBlocked(companyId, false);
  }
  return company;
}
async function purgeCompany(companyId, confirmName) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (company.name.trim() !== confirmName.trim()) throw new TRPCError11({ code: "BAD_REQUEST", message: "O nome digitado n\xE3o confere com o da empresa." });
  const archived = await getSetting("archived_at", companyId, "");
  if (!archived) throw new TRPCError11({ code: "PRECONDITION_FAILED", message: "Exclua (arquive) a empresa primeiro; a exclus\xE3o definitiva s\xF3 vale para empresas j\xE1 exclu\xEDdas." });
  let filesDeleted = 0;
  try {
    const d = await database();
    const [photoRows] = await d.execute(sql14`SELECT fileKey, thumbnailKey FROM store_photos WHERE companyId = ${companyId}`);
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const p of photoRows) {
      for (const k of [p.fileKey, p.thumbnailKey]) if (k) {
        try {
          if (await guardedStorageDelete(storageDelete2, k, companyId)) filesDeleted++;
        } catch {
        }
      }
    }
  } catch {
  }
  const pool = await getPool();
  if (!pool) throw new TRPCError11({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const conn = await pool.getConnection();
  const deleted = {};
  try {
    const [cols] = await conn.query(`SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('companyId','accountId')`);
    const [memberIdsRows] = await conn.query("SELECT id FROM member_accounts WHERE companyId = ?", [companyId]);
    const memberIds = memberIdsRows.map((r2) => r2.id);
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.beginTransaction();
    if (memberIds.length) {
      const [r2] = await conn.query("DELETE FROM member_sessions WHERE memberAccountId IN (?)", [memberIds]);
      deleted.member_sessions = r2.affectedRows;
    }
    const skip = /* @__PURE__ */ new Set(["companies"]);
    for (const { t: t2, c } of cols) {
      if (skip.has(t2) || !/^[A-Za-z0-9_]+$/.test(t2)) continue;
      const [r2] = await conn.query(`DELETE FROM \`${t2}\` WHERE \`${c}\` = ?`, [companyId]);
      if (r2.affectedRows) deleted[t2] = (deleted[t2] ?? 0) + r2.affectedRows;
    }
    const [r] = await conn.query("DELETE FROM companies WHERE id = ?", [companyId]);
    deleted.companies = r.affectedRows;
    await conn.commit();
  } catch (e) {
    await conn.rollback().catch(() => void 0);
    throw e;
  } finally {
    await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => void 0);
    conn.release();
  }
  return { company, deleted, filesDeleted };
}
async function setCompanyBilling(input) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError11({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (input.monthlyAmount != null && input.monthlyAmount !== "") {
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(input.monthlyAmount) || Number(input.monthlyAmount) <= 0) {
      throw new TRPCError11({ code: "BAD_REQUEST", message: "Valor mensal inv\xE1lido." });
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new TRPCError11({ code: "BAD_REQUEST", message: "Data de vencimento inv\xE1lida." });
    const grace = input.blockAfterOverdueDays != null ? Math.max(0, Math.min(60, Math.floor(input.blockAfterOverdueDays))) : await resolveGraceDays(input.companyId);
    const end = endOfDay(input.dueDate);
    await updateCompanySubscriptionFields(input.companyId, {
      subscriptionExpiresAt: end,
      gracePeriodEndsAt: addDaysDate(end, grace)
    });
    await setSetting(BILLING_DAY_KEY, String(Number(input.dueDate.slice(8, 10))), input.companyId);
  }
  return { success: true, monthlyAmount: await resolveMonthlyAmount(input.companyId), graceDays: await resolveGraceDays(input.companyId) };
}
var BR, endOfDay, startOfDay, addDaysDate;
var init_platformCompanies = __esm({
  "server/platformCompanies.ts"() {
    "use strict";
    init_mediaKeys();
    init_db();
    init_schema_original();
    init_paymentReminder();
    init_subscriptionAccess();
    BR = "-03:00";
    endOfDay = (d) => /* @__PURE__ */ new Date(`${d}T23:59:59${BR}`);
    startOfDay = (d) => /* @__PURE__ */ new Date(`${d}T00:00:00${BR}`);
    addDaysDate = (d, n) => new Date(d.getTime() + n * 864e5);
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
import { sql as sql15 } from "drizzle-orm";
function ensureStoreClientsSchema(db) {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql15.raw(`CREATE TABLE IF NOT EXISTS store_clients (
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
      await db.execute(sql15.raw(`CREATE TABLE IF NOT EXISTS store_photos (
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
      const res = await db.execute(sql15`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_photos' AND COLUMN_NAME = 'storeClientId'`);
      const first = Array.isArray(res?.[0]) ? res[0][0] : Array.isArray(res) ? res[0] : res?.rows?.[0];
      if (Number(first?.n ?? 0) === 0) {
        await db.execute(sql15.raw(`ALTER TABLE store_photos ADD COLUMN storeClientId int NULL`));
        try {
          await db.execute(sql15.raw(`CREATE INDEX store_photos_client_idx ON store_photos (companyId, storeClientId)`));
        } catch {
        }
      }
    })().catch((err) => {
      ensured = null;
      throw err;
    });
  }
  return ensured;
}
var ensured;
var init_storeClients = __esm({
  "server/storeClients.ts"() {
    "use strict";
    ensured = null;
  }
});

// server/modules/storePhotos.ts
var storePhotos_exports = {};
__export(storePhotos_exports, {
  detectImageMime: () => detectImageMime,
  expireOldStorePhotos: () => expireOldStorePhotos,
  storePhotosRouter: () => storePhotosRouter
});
import { z as z9 } from "zod";
import { and as and13, desc as desc5, eq as eq13, gte as gte8, lte as lte3, sql as sql16 } from "drizzle-orm";
import { TRPCError as TRPCError13 } from "@trpc/server";
async function moveStorePhotosToTrash(db, accountId, photos, actor) {
  if (photos.length === 0) return;
  await ensureTrashTable();
  const storeIds = Array.from(new Set(photos.map((p) => p.storeId)));
  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(and13(eq13(stores.companyId, accountId), sql16`${stores.id} IN (${sql16.join(storeIds.map((id2) => sql16`${id2}`), sql16`, `)})`));
  const storeName = new Map(storeRows.map((r) => [r.id, r.name]));
  const clientOf = /* @__PURE__ */ new Map();
  try {
    await ensureStoreClientsSchema(db);
    const res = await db.execute(sql16`SELECT id, storeClientId FROM store_photos WHERE companyId = ${accountId} AND id IN (${sql16.join(photos.map((p) => sql16`${p.id}`), sql16`, `)})`);
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
    await tx.delete(storePhotos).where(and13(eq13(storePhotos.companyId, accountId), sql16`${storePhotos.id} IN (${sql16.join(photos.map((p) => sql16`${p.id}`), sql16`, `)})`));
  });
}
async function ensureStorePhotosTable(db) {
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
  const res = await db.execute(sql16`SELECT id, active FROM store_clients WHERE id = ${storeClientId} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`);
  const r = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0];
  if (!r) throw new TRPCError13({ code: "BAD_REQUEST", message: "Cliente n\xE3o encontrado nesta loja." });
  if (!r.active) throw new TRPCError13({ code: "BAD_REQUEST", message: "Este cliente foi removido da loja." });
}
async function linkPhotoToClient(db, companyId, photoId, storeClientId) {
  await db.execute(sql16`UPDATE store_photos SET storeClientId = ${storeClientId} WHERE id = ${photoId} AND companyId = ${companyId}`);
}
async function expireOldStorePhotos() {
  const db = await getDb();
  if (!db) return { deleted: 0, errors: 0 };
  const now = /* @__PURE__ */ new Date();
  const expired = await db.select().from(storePhotos).where(lte3(storePhotos.expiresAt, now)).limit(200);
  if (expired.length === 0) return { deleted: 0, errors: 0 };
  const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let deleted = 0;
  let errors = 0;
  for (const photo of expired) {
    try {
      if (photo.fileKey) await guardedStorageDelete(storageDelete2, photo.fileKey, photo.companyId);
      if (photo.thumbnailKey) await guardedStorageDelete(storageDelete2, photo.thumbnailKey, photo.companyId);
      await db.delete(storePhotos).where(eq13(storePhotos.id, photo.id));
      deleted++;
    } catch {
      errors++;
    }
  }
  return { deleted, errors };
}
var RETENTION_DAYS, TRASH_DAYS, storePhotosRouter;
var init_storePhotos = __esm({
  "server/modules/storePhotos.ts"() {
    "use strict";
    init_mediaKeys();
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
    storePhotosRouter = router({
      /** Lista lojas com contagem de fotos e última atividade. */
      listStoresWithStats: commercialFeatureProcedure("fieldOperations").input(z9.object({ search: z9.string().optional(), city: z9.string().optional() }).optional()).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq13(stores.companyId, ctx.accountId), eq13(stores.active, true)];
        if (memberId !== null) {
          await ensurePromoterStoreAssignmentsTable(db);
          conditions.push(storeVisibleToMember(stores.id, memberId));
        }
        const ownPhotos = memberId !== null ? sql16` AND store_photos.promoterId = ${memberId}` : sql16``;
        if (input?.search) {
          conditions.push(sql16`${stores.name} LIKE ${`%${input.search}%`}`);
        }
        if (input?.city) {
          conditions.push(eq13(stores.city, input.city));
        }
        try {
          const rows4 = await db.select({
            id: stores.id,
            name: stores.name,
            city: stores.city,
            state: stores.state,
            address: stores.address,
            photoCount: sql16`(SELECT COUNT(*) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND store_photos.uploadStatus = 'uploaded'${ownPhotos})`,
            lastActivity: sql16`(SELECT MAX(capturedAt) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId}${ownPhotos})`
          }).from(stores).where(and13(...conditions)).orderBy(desc5(stores.updatedAt));
          return rows4;
        } catch (err) {
          if (String(err?.message || "").includes("store_photos") || err?.code === "ER_NO_SUCH_TABLE") {
            const rows4 = await db.select({ id: stores.id, name: stores.name, city: stores.city, state: stores.state, address: stores.address }).from(stores).where(and13(...conditions)).orderBy(desc5(stores.updatedAt));
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
        const own = memberId !== null ? sql16` AND promoterId = ${memberId}` : sql16``;
        const res = await db.execute(sql16`SELECT COUNT(*) AS c, MAX(capturedAt) AS lastAt FROM store_photos WHERE companyId = ${ctx.accountId} AND storeId IS NULL AND uploadStatus = 'uploaded'${own}`);
        const row2 = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0] ?? {};
        return { count: Number(row2.c ?? 0), lastActivity: row2.lastAt ?? null };
      }),
      /** Lista fotos de uma loja, agrupáveis por data no cliente. */
      listByStore: commercialFeatureProcedure("fieldOperations").input(z9.object({
        storeId: z9.number().int().positive().optional().nullable(),
        from: z9.string().optional(),
        to: z9.string().optional(),
        promoterId: z9.number().int().positive().optional(),
        storeClientId: z9.number().int().positive().optional(),
        withoutClient: z9.boolean().optional()
      })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq13(storePhotos.companyId, ctx.accountId)];
        if (input.storeId) {
          await assertStoreAccess(db, ctx, input.storeId);
          conditions.push(eq13(storePhotos.storeId, input.storeId));
        } else {
          conditions.push(sql16`store_photos.storeId IS NULL`);
        }
        if (input.storeClientId) conditions.push(sql16`store_photos.storeClientId = ${input.storeClientId}`);
        else if (input.withoutClient) conditions.push(sql16`store_photos.storeClientId IS NULL`);
        if (memberId !== null) conditions.push(eq13(storePhotos.promoterId, memberId));
        if (input.from) conditions.push(gte8(storePhotos.capturedAt, new Date(input.from)));
        if (input.to) conditions.push(lte3(storePhotos.capturedAt, new Date(input.to)));
        if (memberId === null && input.promoterId) conditions.push(eq13(storePhotos.promoterId, input.promoterId));
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
          storeClientId: sql16`store_photos.storeClientId`,
          clientName: sql16`(SELECT name FROM store_clients WHERE store_clients.id = store_photos.storeClientId AND store_clients.companyId = ${ctx.accountId})`,
          promoterName: sql16`(SELECT userName FROM member_accounts WHERE member_accounts.id = store_photos.promoterId AND member_accounts.companyId = ${ctx.accountId})`
        }).from(storePhotos).where(and13(...conditions)).orderBy(desc5(storePhotos.capturedAt));
        return photos;
      }),
      /** Cria registro de foto com idempotência. Upload do arquivo é feito separadamente. */
      create: commercialFeatureProcedure("fieldOperations").input(z9.object({
        storeId: z9.number().int().positive().optional().nullable(),
        visitId: z9.number().int().positive().optional(),
        capturedAt: z9.string(),
        latitude: z9.number().optional(),
        longitude: z9.number().optional(),
        accuracy: z9.number().optional(),
        locationStatus: z9.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        fileKey: z9.string().min(1),
        thumbnailKey: z9.string().optional(),
        mimeType: z9.string().optional(),
        fileSize: z9.number().int().optional(),
        storeClientId: z9.number().int().positive().optional(),
        idempotencyKey: z9.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError13({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        if (!isTenantMediaKey(input.fileKey, ctx.accountId) || input.thumbnailKey && !isTenantMediaKey(input.thumbnailKey, ctx.accountId)) {
          throw new TRPCError13({ code: "BAD_REQUEST", message: "Arquivo da foto inv\xE1lido." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError13({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and13(eq13(storePhotos.companyId, ctx.accountId), eq13(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
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
      uploadAndCreate: commercialFeatureProcedure("fieldOperations").input(z9.object({
        storeId: z9.number().int().positive().optional().nullable(),
        visitId: z9.number().int().positive().optional(),
        capturedAt: z9.string(),
        latitude: z9.number().optional(),
        longitude: z9.number().optional(),
        accuracy: z9.number().optional(),
        locationStatus: z9.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        // Limite da Vercel: corpo de 4,5 MB; base64 de 4,2 M caracteres ≈ 3,1 MB de imagem.
        imageBase64: z9.string().min(100).max(MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE),
        mimeType: z9.string().max(100).default("image/jpeg"),
        // ignorado: o tipo real é detectado pelo conteúdo
        storeClientId: z9.number().int().positive().optional(),
        idempotencyKey: z9.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError13({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError13({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and13(eq13(storePhotos.companyId, ctx.accountId), eq13(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
        if (existing) return { id: existing.id, alreadyExists: true };
        const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const buffer = Buffer.from(input.imageBase64, "base64");
        const detectedMime = detectImageMime(buffer);
        if (!detectedMime) throw new TRPCError13({ code: "BAD_REQUEST", message: "Arquivo n\xE3o \xE9 uma imagem v\xE1lida (use JPG, PNG ou WebP)." });
        input.mimeType = detectedMime;
        const ext = input.mimeType === "image/png" ? "png" : input.mimeType === "image/webp" ? "webp" : "jpg";
        const relKey = `store-photos/${ctx.accountId}/${safeKeySegment(input.storeId, "sem-loja")}/${safeKeySegment(input.idempotencyKey)}.${ext}`;
        let fileKey;
        try {
          const uploaded = await storagePut2(relKey, buffer, input.mimeType);
          fileKey = uploaded.key;
        } catch (err) {
          throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar a imagem. Verifique a configura\xE7\xE3o de armazenamento." });
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
      getImageUrl: commercialFeatureProcedure("fieldOperations").input(z9.object({ photoId: z9.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and13(eq13(storePhotos.id, input.photoId), eq13(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError13({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        if (!isTenantMediaKey(photo.fileKey, ctx.accountId)) throw new TRPCError13({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageGetSignedUrl: storageGetSignedUrl2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const url = await storageGetSignedUrl2(photo.fileKey);
        return { url, expiresIn: 3600 };
      }),
      /** Retorna a imagem como base64 para compartilhamento sem CORS. */
      getImageData: commercialFeatureProcedure("fieldOperations").input(z9.object({ photoId: z9.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and13(eq13(storePhotos.id, input.photoId), eq13(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError13({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        if (!isTenantMediaKey(photo.fileKey, ctx.accountId)) throw new TRPCError13({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageRead: storageRead2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        try {
          const image = await storageRead2(photo.fileKey);
          return { base64: image.data.toString("base64"), mime: image.contentType || photo.mimeType || "image/jpeg" };
        } catch {
          throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel obter a imagem armazenada." });
        }
      }),
      /** Exclui uma foto (com auditoria). */
      delete: commercialFeatureProcedure("fieldOperations").input(z9.object({ photoId: z9.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and13(eq13(storePhotos.id, input.photoId), eq13(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError13({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        if (scopeMemberId(ctx) !== null && photo.promoterId !== ctx.memberAccountId) {
          throw new TRPCError13({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        }
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, [photo], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.delete] falha ao enviar para a lixeira", error);
          throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar a foto para a lixeira." });
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
      bulkDelete: commercialFeatureProcedure("fieldOperations").input(z9.object({ photoIds: z9.array(z9.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const photos = await db.select().from(storePhotos).where(and13(eq13(storePhotos.companyId, ctx.accountId), sql16`${storePhotos.id} IN (${sql16.join(input.photoIds.map((id2) => sql16`${id2}`), sql16`, `)})`));
        if (photos.length === 0) return { deleted: 0 };
        const memberId = scopeMemberId(ctx);
        const allowed = photos.filter((photo) => memberId === null || photo.promoterId === memberId);
        if (allowed.length === 0) throw new TRPCError13({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, allowed, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.bulkDelete] falha ao enviar para a lixeira", error);
          throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar as fotos para a lixeira." });
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
      assignClient: commercialFeatureProcedure("fieldOperations").input(z9.object({
        storeId: z9.number().int().positive().optional().nullable(),
        photoIds: z9.array(z9.number().int().positive()).min(1).max(200),
        storeClientId: z9.number().int().positive().nullable()
      })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError13({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = input.storeId != null ? await assertStoreAccess(db, ctx, input.storeId) : null;
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        let clientName = "Sem cliente";
        if (input.storeClientId && input.storeId != null) {
          await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
          const res2 = await db.execute(sql16`SELECT name FROM store_clients WHERE id = ${input.storeClientId} AND companyId = ${ctx.accountId} LIMIT 1`);
          clientName = (Array.isArray(res2?.[0]) ? res2[0] : Array.isArray(res2) ? res2 : res2?.rows ?? [])[0]?.name ?? clientName;
        }
        const memberId = scopeMemberId(ctx);
        const owner = memberId !== null ? sql16` AND promoterId = ${memberId}` : sql16``;
        const ids = sql16.join(input.photoIds.map((id2) => sql16`${id2}`), sql16`, `);
        const res = await db.execute(sql16`UPDATE store_photos SET storeClientId = ${input.storeClientId} WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND id IN (${ids})${owner}`);
        const moved = Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0);
        if (moved === 0) throw new TRPCError13({ code: "FORBIDDEN", message: "Nenhuma das fotos selecionadas p\xF4de ser movida (s\xF3 \xE9 poss\xEDvel mover as suas pr\xF3prias fotos desta loja)." });
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
function situationLabel(iso, today, alertDays) {
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
  const header = ["Ind\xFAstria", "Loja", "C\xF3digo", "Descri\xE7\xE3o", "Lote", "Quantidade", "Validade", "Situa\xE7\xE3o", "Pre\xE7o (R$)", "Cadastrado por"];
  const lines = rows4.map((p) => {
    const iso = String(p.expirationDate).slice(0, 10);
    return [p.clientName || "Sem ind\xFAstria", storeLabel(p), p.productCode, p.description, p.lot || "", String(p.quantity), formatDateBR(iso), situationLabel(iso, today, alertDays), Number(p.price).toFixed(2).replace(".", ","), p.createdByName || ""];
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
import { and as and14, desc as desc6, eq as eq14, inArray as inArray13 } from "drizzle-orm";
async function fetchJson(url, init2 = {}, ms2 = 4e3) {
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
    const rows4 = await database2.select({ description: inventoryProducts.description, price: inventoryProducts.price, productCode: inventoryProducts.productCode }).from(inventoryProducts).where(and14(eq14(inventoryProducts.companyId, companyId), inArray13(inventoryProducts.productCode, codes))).orderBy(desc6(inventoryProducts.id)).limit(1);
    if (rows4[0]) return { found: true, source: "company", description: rows4[0].description, price: String(rows4[0].price), code: rows4[0].productCode };
  }
  if (!variants.length) return { found: false, source: null, description: "", code };
  const token = process.env.COSMOS_API_TOKEN;
  if (token) {
    for (const v of variants) {
      const data = await fetchJson(`https://api.cosmos.bluesoft.com.br/gtins/${v}.json`, { headers: { "X-Cosmos-Token": token } });
      if (data?.description) return { found: true, source: "cosmos", description: String(data.description).slice(0, 500), price: data.avg_price ? Number(data.avg_price).toFixed(2) : null, code: v };
    }
  }
  const tasks = OPEN_BASES.map(async (b) => {
    for (const v of variants) {
      const data = await fetchJson(`https://${b.host}/api/v2/product/${encodeURIComponent(v)}?fields=product_name,product_name_pt,product_name_en,generic_name,generic_name_pt,brands,quantity`);
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
import { z as z11 } from "zod";
import { TRPCError as TRPCError15 } from "@trpc/server";
import { sql as sql18 } from "drizzle-orm";
async function ready6() {
  const database2 = await getDb();
  if (!database2) throw new TRPCError15({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
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
  const parts = [sql18`ip.companyId = ${ctx.accountId}`];
  const memberId = hasFullStoreAccess(ctx) ? null : ctx.memberAccountId ?? -1;
  if (memberId !== null) parts.push(sql18`(ip.createdByMemberId = ${memberId} OR (ip.storeId IS NOT NULL AND ${storeAssignedToPromoter(sql18`ip.storeId`, memberId)}))`);
  if (f.mine && ctx.memberAccountId) parts.push(sql18`ip.createdByMemberId = ${ctx.memberAccountId}`);
  const search = f.search?.trim();
  if (search) {
    const pattern = `%${search.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    parts.push(sql18`(LOWER(ip.productCode) LIKE ${pattern} OR LOWER(ip.description) LIKE ${pattern} OR LOWER(COALESCE(ip.lot, '')) LIKE ${pattern})`);
  }
  const limit = addDays(today, alertDays);
  if (f.expiry === "expired") parts.push(sql18`ip.expirationDate < ${today}`);
  if (f.expiry === "near") parts.push(sql18`ip.expirationDate >= ${today} AND ip.expirationDate <= ${limit}`);
  if (f.expiry === "alert") parts.push(sql18`ip.expirationDate <= ${limit}`);
  if (f.expiry === "valid") parts.push(sql18`ip.expirationDate > ${limit}`);
  if (f.storeId) parts.push(sql18`ip.storeId = ${f.storeId}`);
  if (f.storeClientId) parts.push(sql18`ip.storeClientId = ${f.storeClientId}`);
  if (f.clientName) parts.push(f.clientName === "__none__" ? sql18`c.name IS NULL` : sql18`c.name = ${f.clientName}`);
  if (f.from) parts.push(sql18`ip.expirationDate >= ${f.from}`);
  if (f.to) parts.push(sql18`ip.expirationDate <= ${f.to}`);
  return sql18.join(parts, sql18` AND `);
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
  const database2 = await ready6();
  const today = todayInZone();
  const alertDays = await getProductsAlertDays(ctx.accountId);
  const where = buildWhere(ctx, f, today, alertDays);
  const items = rowsOf(await database2.execute(sql18`SELECT ${COLUMNS} ${FROM} WHERE ${where} ORDER BY ip.expirationDate ASC, ip.description ASC, ip.id ASC LIMIT ${opts.limit} OFFSET ${opts.offset ?? 0}`)).map((r) => mapRow(ctx, r));
  return { items, today, alertDays, where, database: database2 };
}
async function loadOne(ctx, id2) {
  const database2 = await ready6();
  const r = rowsOf(await database2.execute(sql18`SELECT ${COLUMNS} ${FROM} WHERE ip.id = ${id2} AND ip.companyId = ${ctx.accountId} LIMIT 1`))[0];
  return r ? mapRow(ctx, r) : null;
}
async function loadManageable(ctx, id2) {
  const row2 = await loadOne(ctx, id2);
  if (!row2) throw new TRPCError15({ code: "NOT_FOUND", message: "Produto n\xE3o encontrado." });
  if (!row2.canManage) throw new TRPCError15({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode alterar ou excluir produtos que voc\xEA mesmo cadastrou." });
  return row2;
}
async function validatePlace(ctx, storeId, storeClientId) {
  const database2 = await ready6();
  if (!storeId) {
    if (storeClientId) throw new TRPCError15({ code: "BAD_REQUEST", message: "Escolha a loja antes da ind\xFAstria." });
    return { storeId: null, storeClientId: null };
  }
  const store = await assertStoreAccess(database2, ctx, storeId);
  if (!store.active) throw new TRPCError15({ code: "BAD_REQUEST", message: "Essa loja foi removida. Escolha outra loja." });
  if (storeClientId) {
    const c = rowsOf(await database2.execute(sql18`SELECT id FROM store_clients WHERE id = ${storeClientId} AND companyId = ${ctx.accountId} AND storeId = ${storeId} AND active = true LIMIT 1`))[0];
    if (!c) throw new TRPCError15({ code: "BAD_REQUEST", message: "Ind\xFAstria n\xE3o encontrada nesta loja." });
  }
  return { storeId, storeClientId: storeClientId ?? null };
}
async function uploadLabelPhoto(companyId, base64, requestId) {
  const buffer = Buffer.from(base64, "base64");
  const mime = detectImageMime(buffer);
  if (!mime) throw new TRPCError15({ code: "BAD_REQUEST", message: "A foto precisa ser uma imagem (JPG, PNG ou WebP)." });
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  try {
    const { key } = await storagePut2(`product-photos/${companyId}/${safeKeySegment(requestId)}.${ext}`, buffer, mime);
    return key;
  } catch {
    throw new TRPCError15({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel salvar a foto da etiqueta agora. Tente sem a foto ou mais tarde." });
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
    listFilters = z11.object({
      search: z11.string().trim().max(100).optional(),
      expiry: z11.enum(["all", "expired", "near", "alert", "valid"]).optional(),
      storeId: z11.number().int().positive().optional(),
      storeClientId: z11.number().int().positive().optional(),
      /** Nome da indústria (agrupa a mesma indústria cadastrada em lojas diferentes). */
      clientName: z11.string().trim().max(255).optional(),
      from: z11.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z11.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      mine: z11.boolean().optional()
    });
    FROM = sql18`FROM inventory_products ip
  LEFT JOIN stores s ON s.id = ip.storeId AND s.companyId = ip.companyId
  LEFT JOIN store_clients c ON c.id = ip.storeClientId AND c.companyId = ip.companyId
  LEFT JOIN member_accounts m ON m.id = ip.createdByMemberId AND m.companyId = ip.companyId`;
    COLUMNS = sql18`ip.id, ip.companyId, ip.productCode, ip.description, ip.quantity, ip.expirationDate, ip.price, ip.storeId, ip.storeClientId, ip.lot, ip.photoKey,
  ip.createdByMemberId, ip.createdAt, ip.updatedAt, s.name AS storeName, s.active AS storeActive, c.name AS clientName, m.userName AS createdByName`;
    productFields = {
      productCode: z11.string().trim().min(1).max(64),
      description: z11.string().trim().min(1).max(500),
      quantity: z11.number().int().min(0).max(1e6),
      expirationDate: z11.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isPlausibleExpiry, "Data de validade inv\xE1lida."),
      price: z11.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
      storeId: z11.number().int().positive().nullish(),
      storeClientId: z11.number().int().positive().nullish(),
      lot: z11.string().trim().max(64).nullish(),
      photoBase64: z11.string().min(100).max(MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE).optional()
    };
    nullSafe = (col, v) => v == null ? sql18.raw(`${col} IS NULL`) : sql18`${sql18.raw(col)} = ${v}`;
    productsRouter = router({
      settings: commercialFeatureProcedure("products").query(async ({ ctx }) => ({ alertDays: await getProductsAlertDays(ctx.accountId) })),
      setAlertDays: commercialFeatureProcedure("products").input(z11.object({ days: z11.number().int().min(1).max(180) })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role !== "company_admin") throw new TRPCError15({ code: "FORBIDDEN", message: "Somente o administrador pode mudar o prazo de alerta." });
        await setSetting(PRODUCTS_ALERT_DAYS_KEY, String(input.days), ctx.accountId);
        void auditFromCtx(ctx, { action: "update", module: "products", entityType: "settings", description: `Alerta de validade: ${input.days} dias antes`, newData: input });
        return { alertDays: input.days };
      }),
      /** Lojas ativas visíveis ao usuário (não depende do módulo de lojas/roteiros estar ligado). */
      stores: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        await ready6();
        return (await listOperationalStores(ctx.accountId, void 0, scopeMemberId(ctx))).map((s) => ({ id: s.id, name: s.name, city: s.city }));
      }),
      /** Indústrias (clientes) ativas de uma loja. */
      storeClients: commercialFeatureProcedure("products").input(z11.object({ storeId: z11.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready6();
        await assertStoreAccess(database2, ctx, input.storeId);
        return rowsOf(await database2.execute(sql18`SELECT id, name FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true ORDER BY name`)).map((r) => ({ id: Number(r.id), name: String(r.name) }));
      }),
      /** Nomes de indústria usados nos produtos visíveis (filtro e agrupamento do relatório). */
      industries: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        const database2 = await ready6();
        const where = buildWhere(ctx, {}, todayInZone(), 30);
        return rowsOf(await database2.execute(sql18`SELECT DISTINCT c.name AS name ${FROM} WHERE ${where} AND c.name IS NOT NULL ORDER BY c.name LIMIT 500`)).map((r) => String(r.name));
      }),
      lookupByCode: commercialFeatureProcedure("products").input(z11.object({ code: z11.string().trim().min(6).max(64) })).query(async ({ ctx, input }) => {
        const { lookupProductByCode: lookupProductByCode2 } = await Promise.resolve().then(() => (init_productLookup(), productLookup_exports));
        return lookupProductByCode2(ctx.accountId, input.code);
      }),
      /** Lista paginada e filtrada no servidor. */
      list: commercialFeatureProcedure("products").input(listFilters.extend({ page: z11.number().int().min(1).max(1e4).optional(), pageSize: z11.number().int().min(5).max(100).optional() }).optional()).query(async ({ ctx, input }) => {
        const f = input ?? {};
        const pageSize = f.pageSize ?? PRODUCTS_PAGE_SIZE;
        const page = f.page ?? 1;
        const { items, alertDays, where, database: database2, today } = await queryProducts(ctx, f, { limit: pageSize, offset: (page - 1) * pageSize });
        const total = Number(rowsOf(await database2.execute(sql18`SELECT COUNT(*) AS n ${FROM} WHERE ${where}`))[0]?.n ?? 0);
        return { items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)), alertDays, today };
      }),
      /** Contagem do alerta: vencidos + que vencem dentro da janela da empresa. */
      summary: commercialFeatureProcedure("products").query(async ({ ctx }) => {
        const database2 = await ready6();
        const today = todayInZone();
        const alertDays = await getProductsAlertDays(ctx.accountId);
        const where = buildWhere(ctx, {}, today, alertDays);
        const r = rowsOf(await database2.execute(sql18`SELECT
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
      photoUrl: commercialFeatureProcedure("products").input(z11.object({ id: z11.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready6();
        const where = buildWhere(ctx, {}, todayInZone(), 30);
        const row2 = rowsOf(await database2.execute(sql18`SELECT ip.photoKey ${FROM} WHERE ${where} AND ip.id = ${input.id} LIMIT 1`))[0];
        if (!row2?.photoKey || !isTenantMediaKey(row2.photoKey, ctx.accountId, ["product-photos"])) throw new TRPCError15({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        const { storageGetSignedUrl: storageGetSignedUrl2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        return { url: await storageGetSignedUrl2(String(row2.photoKey)) };
      }),
      /** Quantos produtos ainda apontam para a loja (aviso antes de remover a loja). */
      countByStore: commercialFeatureProcedure("products").input(z11.object({ storeId: z11.number().int().positive() })).query(async ({ ctx, input }) => {
        const database2 = await ready6();
        return { count: Number(rowsOf(await database2.execute(sql18`SELECT COUNT(*) AS n FROM inventory_products WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId}`))[0]?.n ?? 0) };
      }),
      create: commercialFeatureProcedure("products").input(z11.object({ ...productFields, clientRequestId: z11.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/) })).mutation(async ({ ctx, input }) => {
        const database2 = await ready6();
        const prior = rowsOf(await database2.execute(sql18`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
        if (prior) return { product: await loadOne(ctx, Number(prior.productId)), merged: Boolean(Number(prior.merged)), duplicate: true };
        const place = await validatePlace(ctx, input.storeId, input.storeClientId);
        const lot = normalizeLot(input.lot);
        const key = { productCode: input.productCode, expirationDate: input.expirationDate, ...place, lot };
        const photoKey = input.photoBase64 ? await uploadLabelPhoto(ctx.accountId, input.photoBase64, input.clientRequestId) : null;
        let result;
        try {
          result = await database2.transaction(async (tx) => {
            const existing = rowsOf(await tx.execute(sql18`SELECT id, quantity, price, photoKey FROM inventory_products
          WHERE companyId = ${ctx.accountId} AND productCode = ${key.productCode} AND expirationDate = ${key.expirationDate}
            AND ${nullSafe("storeId", key.storeId)} AND ${nullSafe("storeClientId", key.storeClientId)} AND ${nullSafe("lot", key.lot)}
          ORDER BY id ASC LIMIT 1 FOR UPDATE`))[0];
            let out;
            if (existing) {
              const keepPrice = Number(existing.price) > 0 ? existing.price : input.price;
              const usePhoto = photoKey && !existing.photoKey;
              await tx.execute(sql18`UPDATE inventory_products SET quantity = quantity + ${input.quantity}, price = ${keepPrice}${usePhoto ? sql18`, photoKey = ${photoKey}` : sql18``} WHERE id = ${existing.id} AND companyId = ${ctx.accountId}`);
              out = { id: Number(existing.id), merged: true, previousQuantity: Number(existing.quantity), photoUnused: Boolean(photoKey && !usePhoto) };
            } else {
              const ins = await tx.execute(sql18`INSERT INTO inventory_products (companyId, productCode, description, quantity, expirationDate, price, storeId, storeClientId, lot, photoKey, createdByMemberId)
            VALUES (${ctx.accountId}, ${key.productCode}, ${input.description}, ${input.quantity}, ${key.expirationDate}, ${input.price}, ${key.storeId}, ${key.storeClientId}, ${key.lot}, ${photoKey}, ${ctx.memberAccountId ?? null})`);
              out = { id: Number(ins?.[0]?.insertId ?? ins?.insertId), merged: false };
            }
            await tx.execute(sql18`INSERT INTO inventory_product_requests (companyId, clientRequestId, productId, merged) VALUES (${ctx.accountId}, ${input.clientRequestId}, ${out.id}, ${out.merged})`);
            return out;
          });
        } catch (error) {
          await deleteLabelPhoto(ctx.accountId, photoKey);
          if (/duplicate/i.test(String(error?.message ?? error?.cause?.message ?? ""))) {
            const p = rowsOf(await database2.execute(sql18`SELECT productId, merged FROM inventory_product_requests WHERE companyId = ${ctx.accountId} AND clientRequestId = ${input.clientRequestId} LIMIT 1`))[0];
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
      update: commercialFeatureProcedure("products").input(z11.object({ ...productFields, id: z11.number().int().positive(), removePhoto: z11.boolean().optional() })).mutation(async ({ ctx, input }) => {
        const before = await loadManageable(ctx, input.id);
        const sameStore = input.storeId != null && input.storeId === before.storeId && input.storeClientId === before.storeClientId;
        const place = sameStore ? { storeId: before.storeId, storeClientId: before.storeClientId } : await validatePlace(ctx, input.storeId, input.storeClientId);
        const database2 = await ready6();
        let photoKey = before.photoKey;
        if (input.photoBase64) photoKey = await uploadLabelPhoto(ctx.accountId, input.photoBase64, `${input.id}-${Date.now()}`);
        else if (input.removePhoto) photoKey = null;
        await database2.execute(sql18`UPDATE inventory_products SET productCode = ${input.productCode}, description = ${input.description}, quantity = ${input.quantity}, expirationDate = ${input.expirationDate}, price = ${input.price},
      storeId = ${place.storeId}, storeClientId = ${place.storeClientId}, lot = ${normalizeLot(input.lot)}, photoKey = ${photoKey} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
        if (before.photoKey && before.photoKey !== photoKey) await deleteLabelPhoto(ctx.accountId, before.photoKey);
        const product = await loadOne(ctx, input.id);
        const { photoBase64: _omit, ...logged } = input;
        void auditFromCtx(ctx, { action: "update", module: "products", entityType: "product", entityId: input.id, entityLabel: input.description, description: `Alterou produto: ${input.description}`, oldData: before, newData: logged });
        return product;
      }),
      deleteMany: commercialFeatureProcedure("products").input(z11.object({ ids: z11.array(z11.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
        const ids = [...new Set(input.ids)];
        for (const id2 of ids) await loadManageable(ctx, id2);
        const result = await deleteInventoryProducts(ctx.accountId, ids, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        void auditFromCtx(ctx, { action: "delete", module: "products", entityType: ids.length === 1 ? "product" : "product_bulk", entityId: ids.length === 1 ? ids[0] : void 0, entityLabel: `${result.deleted} produto(s)`, description: `Enviou ${result.deleted} produto(s) \xE0 lixeira`, newData: { productIds: ids } });
        return result;
      }),
      delete: commercialFeatureProcedure("products").input(z11.object({ id: z11.number().int().positive() })).mutation(async ({ ctx, input }) => {
        await loadManageable(ctx, input.id);
        return deleteInventoryProducts(ctx.accountId, [input.id], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      }),
      /** Compatibilidade com telas antigas: vencidos + a vencer na janela da empresa. */
      alertsSimple: commercialFeatureProcedure("products").query(async ({ ctx }) => (await queryProducts(ctx, { expiry: "alert" }, { limit: 200 })).items)
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
import crypto3 from "node:crypto";
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
      files.push({ key: stored.key, rows: rows4.length, sha256: crypto3.createHash("sha256").update(body).digest("hex") });
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

// server/_core/originGuard.ts
var SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
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

// server/vercel-entry.ts
import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
init_csv();
init_const();

// server/modules/timeTracking.ts
init_mediaKeys();
init_uploadLimits();
init_trpc();
init_db();
init_schema();
init_audit();
init_timesheetMirror2();
init_missingPunch();
init_timesheetMirror();
init_correctionExtras();
init_storage();
init_punchTime();
init_mirrorData();
init_correctionExcuse();
import { z as z4 } from "zod";
import { TRPCError as TRPCError7 } from "@trpc/server";
import { eq as eq8, and as and8, desc as desc2, gte as gte5, lt as lt4, lte as lte2, inArray as inArray8, sql as sql9 } from "drizzle-orm";

// shared/punchOrder.ts
var PUNCH_ORDER = ["clock_in", "break_start", "break_end", "clock_out"];
var PUNCH_LABEL = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
var ms = (t2) => t2 instanceof Date ? t2.getTime() : new Date(t2).getTime();
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
    if (a < b && ot >= t2) return `${PUNCH_LABEL[change.type]} (${hhmm(t2, timeZone)}) precisa ser depois de ${PUNCH_LABEL[other.type]} (${hhmm(ot, timeZone)}). Confira o hor\xE1rio.`;
    if (a > b && ot <= t2) return `${PUNCH_LABEL[change.type]} (${hhmm(t2, timeZone)}) precisa ser antes de ${PUNCH_LABEL[other.type]} (${hhmm(ot, timeZone)}). Confira o hor\xE1rio.`;
  }
  return null;
}

// server/modules/timeTracking.ts
init_ledger();
init_mirrorData();

// server/modules/offlineSync.ts
init_db();
init_punchTime();
init_offlineClock();
import { sql as sql8 } from "drizzle-orm";
import { z as z3 } from "zod";
var clockEvidenceSchema = z3.object({
  anchorServerTime: z3.string().datetime().nullish(),
  anchorDeviceTime: z3.string().datetime().nullish(),
  monoElapsedMs: z3.number().finite().nonnegative().nullish()
}).optional();
var offlineVisitFields = {
  clientId: z3.string().min(8).max(64).optional(),
  deviceTime: z3.string().datetime().optional(),
  offline: z3.boolean().optional(),
  clock: clockEvidenceSchema
};
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
var ready3 = null;
function ensureOfflineSubmissions() {
  if (ready3) return ready3;
  ready3 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql8.raw(`CREATE TABLE IF NOT EXISTS offline_submissions (
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
    ready3 = null;
    throw error;
  });
  return ready3;
}
async function findSubmission(companyId, clientId) {
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return null;
  const [rows4] = await database2.execute(sql8`SELECT kind, entityId FROM offline_submissions WHERE companyId = ${companyId} AND clientId = ${clientId} LIMIT 1`);
  const r = rows4?.[0];
  return r ? { kind: String(r.kind), entityId: r.entityId == null ? null : Number(r.entityId) } : null;
}
async function recordSubmission(input) {
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return;
  await database2.execute(sql8`INSERT IGNORE INTO offline_submissions (companyId, memberAccountId, clientId, kind, entityId, deviceTime, offline, alert)
    VALUES (${input.companyId}, ${input.memberAccountId}, ${input.clientId}, ${input.kind}, ${input.entityId}, ${input.deviceTime}, ${input.offline ? 1 : 0}, ${input.alert})`);
}
async function listVisitOfflineMarks(companyId, visitIds) {
  const ids = visitIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (!ids.length) return [];
  await ensureOfflineSubmissions();
  const database2 = await getDb();
  if (!database2) return [];
  const [rows4] = await database2.execute(sql8`SELECT kind, entityId, offline, deviceTime, receivedAt, alert FROM offline_submissions
    WHERE companyId = ${companyId} AND kind IN ('visit_start', 'visit_complete') AND entityId IN (${sql8.join(ids.map((id2) => sql8`${id2}`), sql8`, `)})`);
  return (rows4 || []).filter((r) => Number(r.offline) === 1 || r.alert).map((r) => ({
    visitId: Number(r.entityId),
    phase: r.kind === "visit_start" ? "start" : "complete",
    offline: Number(r.offline) === 1,
    deviceTime: r.deviceTime ? new Date(r.deviceTime).toISOString() : null,
    receivedAt: new Date(r.receivedAt).toISOString(),
    alert: r.alert ?? null
  }));
}

// server/modules/timeTracking.ts
init_offlineClock();
async function safeAdjustment(data) {
  try {
    await recordAdjustment(data);
  } catch (error) {
    console.error("adjustment log failed", error);
  }
}
var inFlightCorrections = /* @__PURE__ */ new Set();
var timeEventType = z4.enum(["clock_in", "break_start", "break_end", "clock_out"]);
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
    const event = (await database2.select().from(timeEvents).where(and8(eq8(timeEvents.id, request.timeEventId), eq8(timeEvents.companyId, ctx.accountId))).limit(1))[0];
    if (!event) {
      if (opts?.skipMissing) return;
      throw new TRPCError7({ code: "NOT_FOUND", message: "A marca\xE7\xE3o original n\xE3o foi encontrada." });
    }
    const already = await database2.select({ id: timeEvents.id }).from(timeEvents).where(and8(eq8(timeEvents.companyId, ctx.accountId), eq8(timeEvents.replacesEventId, event.id))).limit(1);
    if (already[0]) {
      if (opts?.skipMissing) return;
      throw new TRPCError7({ code: "CONFLICT", message: "Esta marca\xE7\xE3o j\xE1 foi corrigida. Pe\xE7a a corre\xE7\xE3o sobre a marca\xE7\xE3o atual." });
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
var timeTrackingRouter = router({
  shiftStatus: commercialFeatureProcedure("timeTracking").input(z4.object({ timeZone: z4.string().min(1).default("UTC") }).optional()).query(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    const timeZone = input?.timeZone || "UTC";
    if (!companyId || !memberId) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
    const database2 = await getDb();
    if (!database2) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
    const today = localDay(/* @__PURE__ */ new Date(), timeZone);
    await ensurePunchLedger();
    const events = await effectiveRows(await database2.select().from(timeEvents).where(and8(eq8(timeEvents.memberAccountId, memberId), eq8(timeEvents.companyId, companyId))).orderBy(desc2(effectiveEventTime)).limit(100));
    const todayEvents = events.filter((event) => localDay(event.deviceTime || event.serverTime, timeZone) === today);
    const last = todayEvents[0];
    const active = Boolean(last && last.eventType !== "clock_out");
    return { status: active ? "active" : last?.eventType === "clock_out" ? "closed" : "clock_in_required", active, timeZone, localDate: today, lastEvent: last?.eventType || null };
  }),
  companyToday: companyAdminFeatureProcedure("timeTracking").input(z4.object({ timeZone: z4.string().min(1).max(128).default("UTC") }).optional()).query(async ({ ctx, input }) => {
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
    }).from(timeEvents).innerJoin(memberAccounts2, and8(
      eq8(timeEvents.memberAccountId, memberAccounts2.id),
      eq8(memberAccounts2.companyId, ctx.accountId)
    )).where(and8(
      eq8(timeEvents.companyId, ctx.accountId),
      eq8(memberAccounts2.role, "promoter"),
      gte5(timeEvents.serverTime, since)
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
  registerEvent: commercialFeatureProcedure("timeTracking").input(z4.object({
    eventType: timeEventType,
    deviceTime: z4.string().datetime().optional(),
    /** true quando a marcação foi guardada sem internet e está sendo sincronizada agora. */
    offline: z4.boolean().optional(),
    latitude: z4.number().min(-90).max(90),
    longitude: z4.number().min(-180).max(180),
    accuracy: z4.number().finite().nonnegative().max(1e4),
    locationStatus: z4.literal("success"),
    locationError: z4.string().optional(),
    deviceInfo: z4.string().optional(),
    idempotencyKey: z4.string().min(1).max(64).optional(),
    timeZone: z4.string().min(1),
    notes: z4.string().optional(),
    /** Evidência do relógio do aparelho (âncora com o servidor + tempo monotônico) para marcações offline. */
    clock: clockEvidenceSchema
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || !Number.isFinite(input.accuracy) || input.locationStatus !== "success") {
      throw new TRPCError7({ code: "BAD_REQUEST", message: "O ponto s\xF3 pode ser registrado ap\xF3s obter uma localiza\xE7\xE3o GPS v\xE1lida." });
    }
    const database2 = await getDb();
    if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await ensurePunchLedger();
    if (input.idempotencyKey) {
      const existing = await database2.select().from(timeEvents).where(eq8(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing[0]) {
        if (Number(existing[0].companyId) !== companyId || Number(existing[0].memberAccountId) !== memberId) {
          throw new TRPCError7({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
        }
        return existing[0];
      }
    }
    const punchTime = resolvePunchTime({ deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, serverNow: /* @__PURE__ */ new Date(), offline: input.offline });
    const today = localDay(punchTime.effectiveTime, input.timeZone);
    const recent = await effectiveRows(await database2.select().from(timeEvents).where(and8(eq8(timeEvents.memberAccountId, memberId), eq8(timeEvents.companyId, companyId))).orderBy(desc2(effectiveEventTime)).limit(100));
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
      if (input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) throw new TRPCError7({ code: "BAD_REQUEST", message: "Bata a entrada antes de registrar este evento." });
      throw new TRPCError7({ code: "BAD_REQUEST", message: "Sequ\xEAncia de marca\xE7\xE3o inv\xE1lida. Confira o \xFAltimo evento do ponto." });
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
      const existing = await database2.select().from(timeEvents).where(eq8(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing[0] && Number(existing[0].companyId) === companyId && Number(existing[0].memberAccountId) === memberId) {
        return existing[0];
      }
      throw new TRPCError7({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
    }
    const insertedRows = await database2.select().from(timeEvents).where(eq8(timeEvents.id, insertedId)).limit(1);
    const inserted = insertedRows[0];
    if (!inserted) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a marca\xE7\xE3o criada." });
    await auditFromCtx(ctx, {
      action: "create",
      module: "time_tracking",
      entityType: "time_event",
      entityId: inserted.id,
      description: `Marca\xE7\xE3o de ponto (NSR ${inserted.nsr ?? "?"}): ${input.eventType}${newShiftSameDay ? " \u2014 nova entrada ap\xF3s sa\xEDda no mesmo dia" : ""}${punchTime.alert === "server_time_used" ? ` \u2014 ALERTA: ${punchTime.note?.replace(TIME_ALERT_MARKER, "").trim()}` : punchTime.alert === "offline" ? " (feita offline)" : ""}${clockNote ? " \u2014 ALERTA: poss\xEDvel altera\xE7\xE3o do rel\xF3gio do aparelho" : ""}${offlineSequenceNote ? " \u2014 fora de sequ\xEAncia" : ""}`
    });
    return inserted;
  }),
  companyHistory: companyAdminFeatureProcedure("timeTracking").input(z4.object({ memberId: z4.number().int().positive(), month: z4.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) return [];
    const [year, mon] = input.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1));
    await ensurePunchLedger();
    return effectiveRows(await database2.select().from(timeEvents).where(and8(eq8(timeEvents.memberAccountId, input.memberId), eq8(timeEvents.companyId, ctx.accountId), gte5(effectiveEventTime, start), lt4(effectiveEventTime, end))).orderBy(effectiveEventTime), { keepDisregarded: true });
  }),
  /**
   * Desconsidera uma batida (ex.: inclusão repetida). Justificativa obrigatória. NÃO apaga nada:
   * a marcação continua no banco/AFD; só deixa de contar no espelho e no cálculo. Pode ser revertida.
   */
  disregardEvent: companyAdminFeatureProcedure("timeTracking").input(z4.object({ eventId: z4.number().int().positive(), reason: z4.string().trim().min(5, "Escreva pelo menos 5 caracteres na justificativa.").max(500) })).mutation(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await ensurePunchLedger();
    await ensureDisregardsTable();
    const event = (await database2.select().from(timeEvents).where(and8(eq8(timeEvents.id, input.eventId), eq8(timeEvents.companyId, ctx.accountId))).limit(1))[0];
    if (!event) throw new TRPCError7({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada nesta empresa." });
    if ((await supersededIds(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError7({ code: "BAD_REQUEST", message: "Esta marca\xE7\xE3o j\xE1 foi substitu\xEDda por um ajuste. Desconsidere a marca\xE7\xE3o atual." });
    if ((await activeDisregards(ctx.accountId, [event.id])).has(event.id)) throw new TRPCError7({ code: "CONFLICT", message: "Esta batida j\xE1 est\xE1 desconsiderada." });
    const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
    await database2.execute(sql9`INSERT INTO time_event_disregards (companyId, memberAccountId, timeEventId, reason, decidedByMemberId, decidedByName)
        VALUES (${ctx.accountId}, ${event.memberAccountId}, ${event.id}, ${input.reason}, ${ctx.memberAccountId ?? null}, ${by})`);
    const markedAt = (event.deviceTime || event.serverTime).toISOString();
    await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: event.id, description: `Batida desconsiderada (${event.eventType} em ${markedAt}). Motivo: ${input.reason}`, newData: { eventId: event.id, memberAccountId: event.memberAccountId, eventType: event.eventType, markedAt, reason: input.reason, disregarded: true } });
    return { success: true };
  }),
  /** Reverte a desconsideração: a batida volta a contar. O registro da desconsideração fica no histórico (revertedAt). */
  reconsiderEvent: companyAdminFeatureProcedure("timeTracking").input(z4.object({ eventId: z4.number().int().positive(), reason: z4.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await ensureDisregardsTable();
    const active = (await activeDisregards(ctx.accountId, [input.eventId])).get(input.eventId);
    if (!active) throw new TRPCError7({ code: "NOT_FOUND", message: "Esta batida n\xE3o est\xE1 desconsiderada." });
    const by = ctx.user?.name || `Administrador #${ctx.memberAccountId ?? "?"}`;
    await database2.execute(sql9`UPDATE time_event_disregards SET revertedAt = CURRENT_TIMESTAMP, revertedByMemberId = ${ctx.memberAccountId ?? null}, revertedByName = ${by}, revertReason = ${input.reason || null}
        WHERE id = ${active.id} AND companyId = ${ctx.accountId} AND revertedAt IS NULL`);
    await auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "time_event", entityId: input.eventId, description: `Batida reconsiderada (volta a contar no espelho)${input.reason ? `. Motivo: ${input.reason}` : ""}`, oldData: { disregardReason: active.reason, disregardedBy: active.decidedByName }, newData: { eventId: input.eventId, disregarded: false, reason: input.reason || null } });
    return { success: true };
  }),
  companyApprovedExcuses: companyAdminFeatureProcedure("timeTracking").input(z4.object({ memberId: z4.number().int().positive(), month: z4.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const from = `${input.month}-01`;
    const [year, mon] = input.month.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const to = `${input.month}-${String(lastDay).padStart(2, "0")}`;
    const map = await loadApprovedDayExcuses(ctx.accountId, [input.memberId], from, to);
    return map.get(input.memberId) || [];
  }),
  myMissingPunch: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    if (!ctx.accountId || !ctx.memberAccountId) return null;
    const found = (await findMissingPunches({ companyId: ctx.accountId, memberId: ctx.memberAccountId }))[0];
    if (!found) return null;
    const database2 = await getDb();
    if (!database2) return found;
    const pending = await database2.select({
      id: timeCorrectionRequests.id,
      status: timeCorrectionRequests.status,
      requestedTime: timeCorrectionRequests.requestedTime
    }).from(timeCorrectionRequests).where(and8(
      eq8(timeCorrectionRequests.companyId, ctx.accountId),
      eq8(timeCorrectionRequests.memberAccountId, ctx.memberAccountId),
      sql9`${timeCorrectionRequests.status} IN ('pending', 'approved')`
    )).orderBy(desc2(timeCorrectionRequests.createdAt)).limit(20);
    const covered = pending.some((row2) => {
      const day = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(row2.requestedTime));
      return day === found.day;
    });
    return covered ? null : found;
  }),
  companyMissingPunches: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const found = await findMissingPunches({ companyId: ctx.accountId });
    if (!found.length) return found;
    const database2 = await getDb();
    if (!database2) return found;
    const memberIds = [...new Set(found.map((m) => m.memberId))];
    const rows4 = await database2.select({
      memberAccountId: timeCorrectionRequests.memberAccountId,
      requestedTime: timeCorrectionRequests.requestedTime
    }).from(timeCorrectionRequests).where(and8(
      eq8(timeCorrectionRequests.companyId, ctx.accountId),
      inArray8(timeCorrectionRequests.memberAccountId, memberIds),
      sql9`${timeCorrectionRequests.status} IN ('pending', 'approved')`
    )).orderBy(desc2(timeCorrectionRequests.createdAt)).limit(500);
    const covered = /* @__PURE__ */ new Set();
    for (const row2 of rows4) {
      const day = excuseDay(row2.requestedTime);
      covered.add(`${row2.memberAccountId}:${day}`);
    }
    return found.filter((m) => !covered.has(`${m.memberId}:${m.day}`));
  }),
  myHistory: commercialFeatureProcedure("timeTracking").input(z4.object({ limit: z4.number().min(1).max(100).default(100), date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), includeDisregarded: z4.boolean().optional() }).optional()).query(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database2 = await getDb();
    if (!database2) return [];
    const conditions = [eq8(timeEvents.memberAccountId, memberId), eq8(timeEvents.companyId, companyId)];
    if (input?.date) {
      const start = /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 864e5);
      conditions.push(gte5(effectiveEventTime, start), lt4(effectiveEventTime, end));
    }
    await ensurePunchLedger();
    const rows4 = await database2.select().from(timeEvents).where(and8(...conditions)).orderBy(desc2(effectiveEventTime)).limit(input?.limit || 100);
    if (input?.includeDisregarded) return effectiveRows(rows4, { keepDisregarded: true });
    return (await effectiveRows(rows4)).map((r) => ({ ...r, disregard: null }));
  }),
  myTimeSummary: commercialFeatureProcedure("timeTracking").input(z4.object({ timeZone: z4.string().min(1).max(128).optional() }).optional()).query(async ({ ctx, input }) => {
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
    const rows4 = await loadMirrorEventRows(companyId, [memberId], from, to);
    const events = rows4.map((row2) => ({
      id: row2.id,
      type: row2.eventType,
      time: (row2.deviceTime || row2.serverTime).toISOString(),
      receivedAt: row2.serverTime.toISOString(),
      synced: row2.synced,
      notes: row2.notes,
      timeAlert: readTimeAlert(row2.notes),
      offline: Boolean(row2.offline),
      clockAlert: readClockAlert(row2.notes),
      disregarded: row2.disregard ? { reason: row2.disregard.reason, by: row2.disregard.decidedByName, at: row2.disregard.createdAt } : null
    }));
    let labor = null;
    try {
      const raw = await getSetting(`labor_profile:${memberId}`, companyId, "");
      if (raw) labor = JSON.parse(raw);
    } catch {
      labor = null;
    }
    const excusesByMember = await loadApprovedDayExcuses(companyId, [memberId], from, to);
    const vacationsByMember = await loadMemberVacations(companyId, [memberId], from, to);
    const options = await loadMirrorOptions(companyId);
    const report = buildMirror({ events, from, to, timeZone, labor, excuses: excusesByMember.get(memberId) || [], vacations: vacationsByMember.get(memberId) || [], options });
    const configured = Boolean(labor?.dailyMinutes && labor.dailyMinutes > 0 && labor.workdays?.length);
    const openToday = report.days.find((day) => day.date === today && day.issues.some((issue) => issue.startsWith("Jornada incompleta")));
    let workedMinutes = report.totals.workedMinutes;
    let expectedMinutes = report.totals.expectedMinutes ?? 0;
    let overtimeMinutes = report.totals.overtimeMinutes ?? 0;
    let deficitMinutes = report.totals.deficitMinutes ?? 0;
    let balanceMinutes = report.totals.balanceMinutes ?? 0;
    if (openToday) {
      const todayWorked = openToday.workedMinutes;
      const todayExpected = openToday.expectedMinutes ?? 0;
      const todayDiff = openToday.diffMinutes ?? 0;
      workedMinutes = Math.max(0, workedMinutes - todayWorked);
      expectedMinutes = Math.max(0, expectedMinutes - todayExpected);
      if (todayDiff > 0) overtimeMinutes = Math.max(0, overtimeMinutes - todayDiff);
      if (todayDiff < 0) deficitMinutes = Math.max(0, deficitMinutes + todayDiff);
      balanceMinutes -= todayDiff;
    }
    const periodLabel = (/* @__PURE__ */ new Date(`${from}T12:00:00Z`)).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone });
    return {
      periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1),
      daysTracked: report.totals.daysWithMarks,
      workedMinutes,
      expectedMinutes: configured ? expectedMinutes : 0,
      balanceMinutes: configured ? balanceMinutes : 0,
      overtimeMinutes: configured ? overtimeMinutes : 0,
      deficitMinutes: configured ? deficitMinutes : 0,
      openShift: Boolean(openToday),
      configured
    };
  }),
  myCorrections: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database2 = await getDb();
    if (!database2) return [];
    return database2.select({ request: timeCorrectionRequests, event: timeEvents }).from(timeCorrectionRequests).leftJoin(timeEvents, eq8(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and8(eq8(timeCorrectionRequests.companyId, companyId), eq8(timeCorrectionRequests.memberAccountId, memberId))).orderBy(desc2(timeCorrectionRequests.createdAt));
  }),
  requestCorrection: commercialFeatureProcedure("timeTracking").input(z4.object({
    timeEventId: z4.number().int().positive().optional().nullable(),
    requestedType: timeEventType.optional(),
    requestedTime: z4.string().datetime().optional(),
    date: z4.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    justification: z4.string().max(2e3).optional(),
    justificationType: z4.enum(["normal", "holiday", "day_off", "medical_certificate", "other"]).optional(),
    attachmentBase64: z4.string().max(MAX_PHOTO_BASE64_CHARS + 100, PHOTO_TOO_LARGE_MESSAGE).optional()
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError7({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    const database2 = await getDb();
    if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const jType = input.justificationType || "normal";
    const fullDay = isFullDayExcuseType(jType);
    const reason = (input.justification || "").trim() || (fullDay ? fullDayExcuseLabel(jType) : "");
    if (!fullDay && reason.length < 5) throw new TRPCError7({ code: "BAD_REQUEST", message: "Escreva pelo menos 5 caracteres na justificativa." });
    if (!fullDay && !input.requestedType) throw new TRPCError7({ code: "BAD_REQUEST", message: "Informe o tipo de marca\xE7\xE3o." });
    await ensureCorrectionExtras();
    let timeEventId = null;
    if (fullDay) {
      timeEventId = null;
    } else if (input.timeEventId) {
      await ensurePunchLedger();
      const event = await database2.select().from(timeEvents).where(and8(eq8(timeEvents.id, input.timeEventId), eq8(timeEvents.companyId, companyId), eq8(timeEvents.memberAccountId, memberId))).limit(1);
      if (!event[0]) throw new TRPCError7({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada para este funcion\xE1rio." });
      timeEventId = input.timeEventId;
    }
    let requestedTime;
    if (fullDay) {
      const day = input.date || (input.requestedTime ? excuseDay(input.requestedTime) : "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TRPCError7({ code: "BAD_REQUEST", message: "Informe a data do abono." });
      requestedTime = noonInSaoPaulo(day);
    } else {
      if (!input.requestedTime) throw new TRPCError7({ code: "BAD_REQUEST", message: "Informe o hor\xE1rio da corre\xE7\xE3o." });
      requestedTime = new Date(input.requestedTime);
    }
    if (!fullDay && input.requestedType) {
      const day = excuseDay(requestedTime);
      const start = /* @__PURE__ */ new Date(`${day}T00:00:00-03:00`), end = /* @__PURE__ */ new Date(`${day}T23:59:59.999-03:00`);
      await ensurePunchLedger();
      const dayRows = await effectiveRows(await database2.select({ id: timeEvents.id, companyId: timeEvents.companyId, type: timeEvents.eventType, deviceTime: timeEvents.deviceTime, serverTime: timeEvents.serverTime }).from(timeEvents).where(and8(eq8(timeEvents.companyId, companyId), eq8(timeEvents.memberAccountId, memberId), gte5(effectiveEventTime, start), lte2(effectiveEventTime, end))));
      const dayEvents = dayRows.map((r) => ({ id: r.id, type: r.type, time: r.deviceTime || r.serverTime }));
      const orderError = punchOrderError(dayEvents, { type: input.requestedType, time: requestedTime, replaceId: timeEventId });
      if (orderError) throw new TRPCError7({ code: "BAD_REQUEST", message: orderError });
    }
    const lockKey = `${companyId}:${memberId}:${excuseDay(requestedTime)}:${fullDay ? "day" : input.requestedType}:${timeEventId ?? ""}`;
    if (inFlightCorrections.has(lockKey)) throw new TRPCError7({ code: "CONFLICT", message: "Este pedido j\xE1 est\xE1 sendo enviado. Aguarde." });
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
      }).from(timeCorrectionRequests).where(and8(
        eq8(timeCorrectionRequests.companyId, companyId),
        eq8(timeCorrectionRequests.memberAccountId, memberId),
        sql9`${timeCorrectionRequests.status} IN ('pending', 'approved')`
      )).orderBy(desc2(timeCorrectionRequests.createdAt)).limit(100);
      if (input.attachmentBase64) {
        const head = Buffer.from(input.attachmentBase64.replace(/^data:[^;]+;base64,/, "").slice(0, 64), "base64");
        if (!detectImageMime(head)) throw new TRPCError7({ code: "BAD_REQUEST", message: "O anexo precisa ser uma imagem v\xE1lida (JPG, PNG ou WebP)." });
      }
      if (fullDay) {
        const day = excuseDay(requestedTime);
        if (existing.some((row2) => looksLikeFullDayExcuse(row2) && excuseDay(row2.requestedTime) === day)) {
          throw new TRPCError7({ code: "CONFLICT", message: "J\xE1 existe um abono pendente ou aprovado para este dia." });
        }
      } else {
        const day = excuseDay(requestedTime);
        const samePunch = existing.some(
          (row2) => !looksLikeFullDayExcuse(row2) && excuseDay(row2.requestedTime) === day && row2.requestedType === input.requestedType && (row2.timeEventId ?? null) === (timeEventId ?? null)
        );
        if (samePunch) {
          throw new TRPCError7({ code: "CONFLICT", message: "J\xE1 existe um pedido pendente ou aprovado para esta batida neste dia." });
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
      const insertedRows = await database2.select().from(timeCorrectionRequests).where(eq8(timeCorrectionRequests.id, Number(result[0]?.insertId))).limit(1);
      const inserted = insertedRows[0];
      if (!inserted) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a solicita\xE7\xE3o criada." });
      let attachmentKey = null;
      try {
        if (input.attachmentBase64) {
          attachmentKey = await saveCorrectionAttachment(companyId, inserted.id, input.attachmentBase64);
        }
        if (attachmentKey) {
          await database2.execute(sql9`UPDATE time_correction_requests SET justificationType = ${jType}, attachmentKey = ${attachmentKey} WHERE id = ${inserted.id}`);
        } else {
          await database2.execute(sql9`UPDATE time_correction_requests SET justificationType = ${jType} WHERE id = ${inserted.id}`);
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
      }).from(timeCorrectionRequests).innerJoin(memberAccounts2, eq8(timeCorrectionRequests.memberAccountId, memberAccounts2.id)).leftJoin(timeEvents, eq8(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and8(eq8(timeCorrectionRequests.companyId, ctx.accountId), eq8(timeCorrectionRequests.status, "pending"))).orderBy(desc2(timeCorrectionRequests.createdAt));
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
    review: companyAdminFeatureProcedure("timeTracking").input(z4.object({ id: z4.number().int().positive(), status: z4.enum(["approved", "rejected"]), reviewNotes: z4.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
      const database2 = await getDb();
      if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      const rows4 = await database2.select().from(timeCorrectionRequests).where(and8(eq8(timeCorrectionRequests.id, input.id), eq8(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
      const request = rows4[0];
      if (!request) throw new TRPCError7({ code: "NOT_FOUND", message: "Solicita\xE7\xE3o de corre\xE7\xE3o n\xE3o encontrada." });
      if (request.status !== "pending") throw new TRPCError7({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
      await database2.transaction(async (tx) => {
        const claimed = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(and8(eq8(timeCorrectionRequests.id, request.id), eq8(timeCorrectionRequests.status, "pending")));
        if (Number(claimed?.[0]?.affectedRows ?? 1) === 0) throw new TRPCError7({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
        if (input.status === "approved") await applyApprovedCorrection(tx, request, ctx);
      });
      const excuse = isFullDayExcuseType(request.justificationType);
      await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicita\xE7\xE3o de corre\xE7\xE3o ${input.status === "approved" ? "aprovada" : "rejeitada"}${excuse ? ` (abono ${fullDayExcuseLabel(request.justificationType)})` : !request.timeEventId ? " (inclus\xE3o de batida)" : ""}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
      return { success: true };
    }),
    reviewMany: companyAdminFeatureProcedure("timeTracking").input(z4.object({ ids: z4.array(z4.number().int().positive()).min(1).max(20), status: z4.enum(["approved", "rejected"]), reviewNotes: z4.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
      const database2 = await getDb();
      if (!database2) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      let done = 0;
      for (const id2 of input.ids) {
        const rows4 = await database2.select().from(timeCorrectionRequests).where(and8(eq8(timeCorrectionRequests.id, id2), eq8(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
        const request = rows4[0];
        if (!request || request.status !== "pending") continue;
        const applied = await database2.transaction(async (tx) => {
          const claimed = await tx.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(and8(eq8(timeCorrectionRequests.id, request.id), eq8(timeCorrectionRequests.status, "pending")));
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

// server/routers.ts
init_timesheetMirror2();

// server/ponto/router.ts
init_brDocs();
init_trpc();
init_db();
init_schema();
init_audit();
init_timesheetMirror();
init_correctionExtras();
init_mirrorData();
init_ledger();
init_repFormat();
import { z as z5 } from "zod";
import { TRPCError as TRPCError8 } from "@trpc/server";
import { and as and9, asc, desc as desc3, eq as eq9, gte as gte6, inArray as inArray9, lt as lt5, sql as sql11 } from "drizzle-orm";

// server/ponto/receipt.ts
init_repFormat();
var LABEL2 = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
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
  if (!input.employer.document) pendingNotes.push("CNPJ/CPF da empresa ainda n\xE3o cadastrado \u2014 pe\xE7a ao administrador para completar em Espelho de ponto \u2192 Dados da empresa.");
  if (!e.workerCpf) pendingNotes.push("Seu CPF ainda n\xE3o est\xE1 no cadastro \u2014 pe\xE7a ao administrador para completar.");
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

// server/ponto/router.ts
init_email();
init_clock();
var TZ3 = DEFAULT_TZ;
var monthStr = z5.string().regex(/^\d{4}-\d{2}$/);
var dateStr3 = z5.string().regex(/^\d{4}-\d{2}-\d{2}$/);
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
  const database2 = await getDb();
  const company = database2 ? (await database2.select({ name: companies2.name }).from(companies2).where(eq9(companies2.id, companyId)).limit(1))[0] : null;
  const legal = await readJson2("company_legal_profile", companyId);
  const document = onlyDigits(legal?.document) || null;
  return { name: (legal?.legalName || company?.name || "").trim(), document, workplace: (legal?.establishment || legal?.address || "").trim() || null };
}
var isAdminRole = (ctx) => ["company_admin", "supervisor"].includes(String(ctx.user?.role || ""));
async function loadReceipt(ctx, eventId) {
  await ensurePunchLedger();
  const database2 = await getDb();
  if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const row2 = (await database2.select().from(timeEvents).where(and9(eq9(timeEvents.id, eventId), eq9(timeEvents.companyId, ctx.accountId))).limit(1))[0];
  if (!row2) throw new TRPCError8({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada." });
  if (row2.memberAccountId !== ctx.memberAccountId && !isAdminRole(ctx)) throw new TRPCError8({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode ver os seus comprovantes." });
  const member = (await database2.select({ name: memberAccounts2.userName, email: memberAccounts2.email }).from(memberAccounts2).where(eq9(memberAccounts2.id, row2.memberAccountId)).limit(1))[0];
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
  if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const member = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts2).leftJoin(promoterProfiles, eq9(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and9(eq9(memberAccounts2.id, memberId), eq9(memberAccounts2.companyId, companyId))).limit(1))[0];
  if (!member) throw new TRPCError8({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado." });
  const rows4 = await loadMirrorEventRows(companyId, [memberId], from, to);
  const adj = await loadAdjustmentsByEvent(companyId, [memberId]);
  const labor = await readJson2(`labor_profile:${memberId}`, companyId);
  const excuses = (await loadApprovedDayExcuses(companyId, [memberId], from, to)).get(memberId) || [];
  const vacations = (await loadMemberVacations(companyId, [memberId], from, to)).get(memberId) || [];
  const options = await loadMirrorOptions(companyId);
  const report = buildMirror({ events: toMirrorEvents(rows4, adj), from, to, timeZone: TZ3, labor, excuses, vacations, options });
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
  const filter = memberIds?.length ? sql11` AND memberAccountId IN (${sql11.join(memberIds.map((id2) => sql11`${id2}`), sql11`, `)})` : sql11``;
  const [rows4] = await database2.execute(sql11`SELECT id, memberAccountId, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND month = ${month}${filter} ORDER BY id DESC`);
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
  const legal = await readJson2("company_legal_profile", companyId);
  const company = [];
  if (!(legal?.legalName || "").trim()) company.push("Raz\xE3o social");
  const doc = onlyDigits(legal?.document);
  if (!doc) company.push("CNPJ/CPF");
  else if (!isValidCpfOrCnpj(doc)) company.push("CNPJ/CPF v\xE1lido (o cadastrado n\xE3o confere)");
  if (!(legal?.address || "").trim()) company.push("Endere\xE7o");
  const database2 = await getDb();
  const members = database2 ? (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq9(memberAccounts2.companyId, companyId))).filter((m) => m.role !== "company_admin" && m.active) : [];
  const people = [];
  for (const m of members) {
    const l = await readJson2(`labor_profile:${m.id}`, companyId);
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
var pontoLegalRouter = router({
  /** Situação para a empresa cliente: só o que ela pode cadastrar (sem pendências do dono da plataforma). */
  status: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const employer = await employerOf(ctx.accountId);
    const database2 = await getDb();
    let workersMissingCpf = 0;
    let workersMissingSchedule = 0;
    if (database2) {
      const members = await database2.select({ id: memberAccounts2.id, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq9(memberAccounts2.companyId, ctx.accountId));
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
  myReceipts: commercialFeatureProcedure("timeTracking").input(z5.object({ days: z5.number().int().min(1).max(90).default(30) }).optional()).query(async ({ ctx, input }) => {
    if (!ctx.accountId || !ctx.memberAccountId) return [];
    await ensurePunchLedger();
    const database2 = await getDb();
    if (!database2) return [];
    const since = new Date(Date.now() - (input?.days ?? 30) * 864e5);
    const rows4 = await database2.select({ id: timeEvents.id, nsr: timeEvents.nsr, eventType: timeEvents.eventType, serverTime: timeEvents.serverTime, deviceTime: timeEvents.deviceTime, recordHash: timeEvents.recordHash, origin: timeEvents.origin, timeZone: timeEvents.timeZone, offline: timeEvents.offline }).from(timeEvents).where(and9(eq9(timeEvents.companyId, ctx.accountId), eq9(timeEvents.memberAccountId, ctx.memberAccountId), gte6(timeEvents.serverTime, since))).orderBy(desc3(timeEvents.serverTime)).limit(500);
    const gone = await supersededIds(ctx.accountId, rows4.map((r) => r.id));
    return rows4.map((r) => ({ ...r, markedAt: r.deviceTime || r.serverTime, superseded: gone.has(r.id) }));
  }),
  receipt: commercialFeatureProcedure("timeTracking").input(z5.object({ eventId: z5.number().int().positive() })).query(async ({ ctx, input }) => (await loadReceipt(ctx, input.eventId)).data),
  receiptPdf: commercialFeatureProcedure("timeTracking").input(z5.object({ eventId: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { data } = await loadReceipt(ctx, input.eventId);
    const pdf = await buildReceiptPdf(data);
    void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Baixou comprovante de ponto (NSR ${data.nsr ?? "-"})` });
    return { fileName: `comprovante-ponto-NSR${String(data.nsr ?? input.eventId).padStart(9, "0")}.pdf`, base64: pdf.toString("base64") };
  }),
  emailReceipt: commercialFeatureProcedure("timeTracking").input(z5.object({ eventId: z5.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const { data, memberEmail } = await loadReceipt(ctx, input.eventId);
    if (!memberEmail) return { sent: false, message: "Seu cadastro n\xE3o tem e-mail. Pe\xE7a ao administrador para incluir." };
    if (!process.env.RESEND_API_KEY && !process.env.EMAIL_WEBHOOK_URL) return { sent: false, message: "Envio de e-mail n\xE3o est\xE1 ativado neste ambiente. Baixe o PDF." };
    const result = await sendEmail({ to: memberEmail, subject: `Comprovante de ponto \u2014 ${data.eventLabel} ${data.markedLocal}`, html: receiptEmailHtml(data) });
    void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "punch_receipt", entityId: input.eventId, description: `Comprovante de ponto enviado por e-mail (NSR ${data.nsr ?? "-"})${result.ok ? "" : " \u2014 falhou"}` });
    return result.ok ? { sent: true, message: `Comprovante enviado para ${memberEmail}.` } : { sent: false, message: "N\xE3o foi poss\xEDvel enviar o e-mail agora. Baixe o PDF." };
  }),
  // ------------------------------------------------------------------ aceite do espelho
  myMirror: commercialFeatureProcedure("timeTracking").input(z5.object({ month: monthStr })).query(async ({ ctx, input }) => {
    if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError8({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
    const acc = (await latestAcceptances(ctx.accountId, input.month, [ctx.memberAccountId])).get(ctx.memberAccountId) ?? null;
    return {
      month: input.month,
      from: m.from,
      to: m.to,
      timeZone: TZ3,
      report: m.report,
      documentHash: m.documentHash,
      employer: m.employer,
      member: { id: m.member.id, name: m.member.name, employeeCode: m.member.employeeCode ?? null },
      labor: m.labor,
      worker: { name: m.member.name, cpf: m.labor?.cpf ?? null, jobTitle: m.labor?.jobTitle ?? null, admissionDate: m.labor?.admissionDate ?? null },
      acceptance: acc ? { decision: acc.decision, acceptedAt: acc.acceptedAt, documentHash: acc.documentHash, comment: acc.comment, stillValid: acc.documentHash === m.documentHash } : null
    };
  }),
  acceptMirror: commercialFeatureProcedure("timeTracking").input(z5.object({ month: monthStr, documentHash: z5.string().regex(/^[a-f0-9]{64}$/), decision: z5.enum(["accepted", "contested"]), comment: z5.string().trim().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
    if (!ctx.accountId || !ctx.memberAccountId) throw new TRPCError8({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    if (input.decision === "contested" && (input.comment || "").length < 5) throw new TRPCError8({ code: "BAD_REQUEST", message: "Explique o que est\xE1 errado (pelo menos 5 caracteres)." });
    const m = await memberMonthMirror(ctx.accountId, ctx.memberAccountId, input.month);
    if (m.documentHash !== input.documentHash) throw new TRPCError8({ code: "CONFLICT", message: "O espelho mudou enquanto voc\xEA lia (nova marca\xE7\xE3o ou corre\xE7\xE3o). Confira de novo antes de confirmar." });
    const meta = requestMeta(ctx);
    const database2 = await getDb();
    if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const summary = JSON.stringify({ totals: m.report.totals, days: m.report.days.length });
    await database2.execute(sql11`INSERT INTO timesheet_acceptances (companyId, memberAccountId, month, decision, documentHash, summary, comment, ipAddress, userAgent, acceptedAt)
        VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.month}, ${input.decision}, ${m.documentHash}, ${summary}, ${input.comment || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
    void auditFromCtx(ctx, { action: input.decision === "accepted" ? "update" : "security", module: "time_tracking", entityType: "timesheet_acceptance", entityId: ctx.memberAccountId, description: `${input.decision === "accepted" ? "Funcion\xE1rio confirmou" : "Funcion\xE1rio contestou"} o espelho de ${input.month} (hash ${m.documentHash.slice(0, 12)}\u2026)`, newData: { month: input.month, documentHash: m.documentHash, comment: input.comment || null } });
    return { success: true, documentHash: m.documentHash };
  }),
  mirrorAcceptances: companyAdminFeatureProcedure("timeTracking").input(z5.object({ month: monthStr })).query(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) return [];
    const members = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active }).from(memberAccounts2).where(eq9(memberAccounts2.companyId, ctx.accountId))).filter((m) => m.role !== "company_admin");
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
    if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const rows4 = await database2.select().from(timeEvents).where(eq9(timeEvents.companyId, ctx.accountId)).orderBy(asc(timeEvents.id));
    const result = verifyLedger(rows4.map(toLedgerRow));
    const [stateRows] = await database2.execute(sql11`SELECT lastNsr, lastHash, initializedAt FROM rep_ledger_state WHERE companyId = ${ctx.accountId}`);
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
  exportAfd: companyAdminFeatureProcedure("timeTracking").input(z5.object({ from: dateStr3, to: dateStr3 })).mutation(async ({ ctx, input }) => {
    if (input.from > input.to) throw new TRPCError8({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
    await ensurePunchLedger();
    const database2 = await getDb();
    if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const { start, end } = rangeUtc(input.from, input.to);
    const rows4 = (await database2.select().from(timeEvents).where(and9(eq9(timeEvents.companyId, ctx.accountId), eq9(timeEvents.origin, "original"), gte6(effectiveEventTime, start), lt5(effectiveEventTime, end))).orderBy(asc(timeEvents.nsr))).filter((r) => r.nsr != null && r.recordHash).filter((r) => {
      const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ3);
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
      timeZone: TZ3,
      punches: rows4.map((r) => ({ nsr: Number(r.nsr), markedAt: r.deviceTime || r.serverTime, recordedAt: r.serverTime, cpf: r.workerCpf, timeZone: r.timeZone || TZ3, collector: r.collectorId || "02", offline: Boolean(r.offline), hash: r.recordHash }))
    });
    const warnings = [
      ...!employer.document ? ["Falta o CNPJ (ou CPF) da empresa. Cadastre em Espelho de ponto \u2192 Dados da empresa."] : [],
      ...rows4.some((r) => !r.workerCpf) ? [`${rows4.filter((r) => !r.workerCpf).length} batida(s) sem CPF do funcion\xE1rio. Complete o cadastro no Espelho de ponto (vale para as pr\xF3ximas batidas).`] : []
    ];
    void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "afd", description: `Gerou AFD ${input.from} a ${input.to} (${rows4.length} marca\xE7\xF5es)`, newData: { from: input.from, to: input.to, count: rows4.length } });
    return { ...fileResponse(afd.content, afd.fileName), count: rows4.length, warnings };
  }),
  exportAej: companyAdminFeatureProcedure("timeTracking").input(z5.object({ from: dateStr3, to: dateStr3 })).mutation(async ({ ctx, input }) => {
    if (input.from > input.to) throw new TRPCError8({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
    await ensurePunchLedger();
    const database2 = await getDb();
    if (!database2) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const members = (await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role }).from(memberAccounts2).where(eq9(memberAccounts2.companyId, ctx.accountId))).filter((m) => m.role !== "company_admin");
    const ids = members.map((m) => m.id);
    const { start, end } = rangeUtc(input.from, input.to);
    const all = ids.length ? await database2.select().from(timeEvents).where(and9(eq9(timeEvents.companyId, ctx.accountId), inArray9(timeEvents.memberAccountId, ids), gte6(effectiveEventTime, start), lt5(effectiveEventTime, end))).orderBy(asc(effectiveEventTime)) : [];
    const inPeriod = all.filter((r) => {
      const d = formatD(r.deviceTime || r.serverTime, r.timeZone || TZ3);
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
        const d = formatD(r.deviceTime || r.serverTime, TZ3);
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
      timeZone: TZ3,
      ptrp: { version: dev.version, developerDocument: dev.document, developerName: dev.name, developerEmail: dev.email },
      workers
    });
    const warnings = [
      ...!employer.document ? ["Falta o CNPJ (ou CPF) da empresa. Cadastre em Espelho de ponto \u2192 Dados da empresa."] : [],
      ...missingCpf.length ? [`Sem CPF no cadastro: ${missingCpf.slice(0, 10).join(", ")}${missingCpf.length > 10 ? "\u2026" : ""}. Complete no Espelho de ponto.`] : [],
      ...workers.some((w) => !w.contract) ? ["H\xE1 funcion\xE1rio sem hor\xE1rio de trabalho cadastrado. Preencha a jornada no Espelho de ponto."] : [],
      ...missingSchedule.length ? [`Sem hor\xE1rio de entrada e sa\xEDda cadastrado: ${missingSchedule.slice(0, 10).join(", ")}${missingSchedule.length > 10 ? "\u2026" : ""}. Complete no Espelho de ponto.`] : []
    ];
    void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "aej", description: `Gerou AEJ ${input.from} a ${input.to} (${workers.length} funcion\xE1rio(s))`, newData: { from: input.from, to: input.to } });
    return { ...fileResponse(aej.content, aej.fileName), count: workers.length, warnings };
  })
});

// server/lgpd/router.ts
init_trpc();
init_db();
init_schema();
init_audit();
import { randomBytes } from "node:crypto";
import { z as z6 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
import { and as and10, eq as eq10, inArray as inArray10, sql as sql12 } from "drizzle-orm";
import { zipSync, strToU8 } from "fflate";

// shared/privacyNotice.ts
var PRIVACY_NOTICE_VERSION = "2026-11-05.1";
var PRIVACY_NOTICE_TITLE = "Como seus dados s\xE3o usados no ponto e nas visitas";
var PRIVACY_NOTICE_SECTIONS = [
  { title: "Quem \xE9 o respons\xE1vel", body: "A empresa que te contratou (seu empregador) \xE9 a controladora dos seus dados. O GondUp \xE9 o sistema que ela usa e trata os dados s\xF3 seguindo as instru\xE7\xF5es dela." },
  { title: "O que coletamos", body: "Em cada batida de ponto: data e hora (do servidor e do seu aparelho), fuso hor\xE1rio, localiza\xE7\xE3o GPS com a precis\xE3o informada pelo aparelho e dados t\xE9cnicos do aparelho/navegador. Nas visitas a lojas: as fotos que voc\xEA tirar e a localiza\xE7\xE3o no check-in/check-out. Tamb\xE9m seu nome, e-mail, telefone e os dados do contrato informados pela empresa (CPF, cargo, admiss\xE3o, hor\xE1rio)." },
  { title: "Para qu\xEA", body: "Registrar sua jornada como a lei exige, calcular horas e gerar o espelho de ponto, comprovar as visitas feitas e cumprir obriga\xE7\xF5es trabalhistas e fiscais. A localiza\xE7\xE3o \xE9 colhida s\xF3 no momento da batida ou do check-in \u2014 n\xE3o existe rastreamento cont\xEDnuo." },
  { title: "Por que n\xE3o pedimos \u201Cconsentimento\u201D", body: "O registro de ponto \xE9 uma obriga\xE7\xE3o legal do empregador (CLT art. 74) e faz parte do contrato de trabalho. Por isso a base legal \xE9 o cumprimento de obriga\xE7\xE3o legal e a execu\xE7\xE3o do contrato (LGPD art. 7\xBA, II e V). Voc\xEA est\xE1 sendo informado, n\xE3o precisa autorizar." },
  { title: "Quem v\xEA", body: "Os administradores e supervisores da sua empresa e, quando necess\xE1rio, auditores-fiscais do trabalho, a Justi\xE7a e o contador da empresa. O GondUp usa fornecedores de infraestrutura (hospedagem, banco de dados, armazenamento de arquivos, e-mail e monitoramento de erros), alguns com servidores fora do Brasil, sob contrato com cl\xE1usulas de prote\xE7\xE3o de dados." },
  { title: "Por quanto tempo", body: "As marca\xE7\xF5es de ponto s\xE3o guardadas durante o contrato e por pelo menos 5 anos depois dele, por exig\xEAncia legal, e n\xE3o podem ser apagadas nem alteradas \u2014 corre\xE7\xF5es viram registros separados. Fotos de visitas s\xE3o apagadas automaticamente ap\xF3s 60 dias." },
  { title: "Seus direitos", body: "Voc\xEA pode pedir uma c\xF3pia dos seus dados, a corre\xE7\xE3o de dados errados e a elimina\xE7\xE3o ou anonimiza\xE7\xE3o do que n\xE3o for de guarda obrigat\xF3ria. Use o bot\xE3o \u201CMeus dados (LGPD)\u201D no menu ou fale com o administrador da sua empresa." }
];
function privacyNoticeText() {
  return [PRIVACY_NOTICE_TITLE, ...PRIVACY_NOTICE_SECTIONS.map((s) => `${s.title}
${s.body}`)].join("\n\n");
}

// server/lgpd/router.ts
init_repFormat();
var ready4 = null;
async function ensureLgpdTables() {
  if (ready4) return ready4;
  ready4 = (async () => {
    const database2 = await getDb();
    if (!database2 || typeof database2.execute !== "function") return;
    await database2.execute(sql12.raw(`CREATE TABLE IF NOT EXISTS privacy_acknowledgements (
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
    await database2.execute(sql12.raw(`CREATE TABLE IF NOT EXISTS lgpd_requests (
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
    ready4 = null;
    throw e;
  });
  return ready4;
}
var noticeHash = () => sha256(privacyNoticeText());
var KIND_LABEL = { export: "C\xF3pia dos meus dados", correction: "Corre\xE7\xE3o de dados", anonymize: "Elimina\xE7\xE3o/anonimiza\xE7\xE3o", info: "D\xFAvida sobre meus dados" };
async function rows(query) {
  const database2 = await getDb();
  if (!database2) return [];
  const [r] = await database2.execute(query);
  return r || [];
}
async function collectSubjectData(companyId, memberId) {
  await ensureLgpdTables();
  const database2 = await getDb();
  if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const [account] = await database2.select({ id: memberAccounts2.id, nome: memberAccounts2.userName, email: memberAccounts2.email, telefone: memberAccounts2.phone, perfil: memberAccounts2.role, ativo: memberAccounts2.active, criadoEm: memberAccounts2.createdAt, atualizadoEm: memberAccounts2.updatedAt }).from(memberAccounts2).where(and10(eq10(memberAccounts2.id, memberId), eq10(memberAccounts2.companyId, companyId))).limit(1);
  if (!account) throw new TRPCError9({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
  const laborRaw = await getSetting(`labor_profile:${memberId}`, companyId, "");
  const myVisits = await database2.select().from(visits).where(and10(eq10(visits.companyId, companyId), eq10(visits.promoterId, memberId)));
  const visitIds = myVisits.map((v) => v.id);
  return {
    geradoEm: (/* @__PURE__ */ new Date()).toISOString(),
    observacao: "Exporta\xE7\xE3o dos dados pessoais do titular (LGPD art. 18, II e V). Senhas e tokens de sess\xE3o n\xE3o s\xE3o exportados.",
    conta: account,
    perfilPromotor: (await database2.select().from(promoterProfiles).where(eq10(promoterProfiles.memberAccountId, memberId)))[0] ?? null,
    perfilTrabalhista: laborRaw ? JSON.parse(laborRaw) : null,
    marcacoesDePonto: await database2.select().from(timeEvents).where(and10(eq10(timeEvents.companyId, companyId), eq10(timeEvents.memberAccountId, memberId))),
    pedidosDeCorrecao: await database2.select().from(timeCorrectionRequests).where(and10(eq10(timeCorrectionRequests.companyId, companyId), eq10(timeCorrectionRequests.memberAccountId, memberId))),
    aceitesDoEspelho: await rows(sql12`SELECT month, decision, documentHash, comment, ipAddress, userAgent, acceptedAt FROM timesheet_acceptances WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`).catch(() => []),
    cienciasDoAviso: await rows(sql12`SELECT noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    pedidosLgpd: await rows(sql12`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${companyId} AND memberAccountId = ${memberId}`),
    ferias: await database2.select().from(vacationSchedules).where(and10(eq10(vacationSchedules.companyId, companyId), eq10(vacationSchedules.memberAccountId, memberId))),
    visitas: myVisits,
    fotosDeVisita: visitIds.length ? await database2.select().from(visitPhotos).where(and10(eq10(visitPhotos.companyId, companyId), inArray10(visitPhotos.visitId, visitIds))) : [],
    fotosDeLoja: await database2.select().from(storePhotos).where(and10(eq10(storePhotos.companyId, companyId), eq10(storePhotos.promoterId, memberId))),
    evidencias: await database2.select().from(evidences).where(and10(eq10(evidences.companyId, companyId), eq10(evidences.promoterId, memberId))),
    checklists: await database2.select().from(checklistResponses).where(and10(eq10(checklistResponses.companyId, companyId), eq10(checklistResponses.promoterId, memberId))),
    registrosDeAuditoria: await rows(sql12`SELECT action, module, entityType, description, ipAddress, userAgent, createdAt FROM audit_logs WHERE companyId = ${companyId} AND userId = ${memberId} ORDER BY id DESC LIMIT 5000`).catch(() => [])
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
  const [company] = database2 ? await rows(sql12`SELECT name FROM companies WHERE id = ${companyId}`) : [];
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
var ANONYMIZE_PLAN = {
  apaga: ["Nome, e-mail e telefone da conta (substitu\xEDdos por pseud\xF4nimo)", "Senha, c\xF3digo de recupera\xE7\xE3o e sess\xF5es (a conta fica inutiliz\xE1vel)", "C\xF3digo de funcion\xE1rio", "Fotos de visita e de loja (apagadas na pr\xF3xima limpeza autom\xE1tica)", "Coordenadas GPS de visitas e evid\xEAncias", "Observa\xE7\xF5es de visitas e legendas de evid\xEAncias"],
  mantem: ["Marca\xE7\xF5es de ponto completas (hora, GPS, NSR, hash) \u2014 guarda obrigat\xF3ria por lei e protegidas contra altera\xE7\xE3o", "Perfil trabalhista (CPF, cargo, admiss\xE3o, hor\xE1rio) \u2014 necess\xE1rio para AFD/AEJ e espelho durante o prazo legal", "Pedidos de corre\xE7\xE3o, aceites do espelho, f\xE9rias e auditoria \u2014 prova trabalhista"]
};
async function anonymizeSubject(companyId, memberId) {
  const database2 = await getDb();
  if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const [m] = await database2.select({ id: memberAccounts2.id, role: memberAccounts2.role }).from(memberAccounts2).where(and10(eq10(memberAccounts2.id, memberId), eq10(memberAccounts2.companyId, companyId))).limit(1);
  if (!m) throw new TRPCError9({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
  if (m.role === "company_admin") throw new TRPCError9({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel anonimizar um administrador da empresa." });
  const pseudonym = `Titular anonimizado #${memberId}`;
  await database2.update(memberAccounts2).set({
    userName: pseudonym,
    email: `anonimizado+${companyId}-${memberId}@invalid.gondup`,
    phone: null,
    active: false,
    passwordHash: `!anonimizado:${randomBytes(24).toString("hex")}`,
    recoveryCodeHash: null
  }).where(and10(eq10(memberAccounts2.id, memberId), eq10(memberAccounts2.companyId, companyId)));
  await database2.delete(memberSessions2).where(eq10(memberSessions2.memberAccountId, memberId));
  await database2.update(promoterProfiles).set({ employeeCode: null }).where(eq10(promoterProfiles.memberAccountId, memberId));
  const now = /* @__PURE__ */ new Date();
  await database2.update(storePhotos).set({ expiresAt: now }).where(and10(eq10(storePhotos.companyId, companyId), eq10(storePhotos.promoterId, memberId)));
  const myVisits = await database2.select({ id: visits.id }).from(visits).where(and10(eq10(visits.companyId, companyId), eq10(visits.promoterId, memberId)));
  if (myVisits.length) {
    const ids = myVisits.map((v) => v.id);
    await database2.update(visitPhotos).set({ expiresAt: now }).where(and10(eq10(visitPhotos.companyId, companyId), inArray10(visitPhotos.visitId, ids)));
    await database2.update(visits).set({ startLatitude: null, startLongitude: null, endLatitude: null, endLongitude: null, notes: null }).where(and10(eq10(visits.companyId, companyId), inArray10(visits.id, ids)));
  }
  await database2.update(evidences).set({ latitude: null, longitude: null, caption: null }).where(and10(eq10(evidences.companyId, companyId), eq10(evidences.promoterId, memberId)));
  return { pseudonym };
}
var kindSchema = z6.enum(["export", "correction", "anonymize", "info"]);
var lgpdRouter = router({
  /** Aviso ao trabalhador: precisa mostrar? (só para promotores) */
  noticeStatus: companyBillingProcedure.query(async ({ ctx }) => {
    const base = { version: PRIVACY_NOTICE_VERSION, required: false, acknowledgedAt: null };
    if (ctx.user?.role !== "promoter" || !ctx.memberAccountId || ctx.actingAsPlatform) return base;
    await ensureLgpdTables();
    const r = await rows(sql12`SELECT acknowledgedAt FROM privacy_acknowledgements WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} AND noticeVersion = ${PRIVACY_NOTICE_VERSION} ORDER BY id DESC LIMIT 1`);
    return { ...base, required: !r.length, acknowledgedAt: r[0]?.acknowledgedAt ?? null };
  }),
  acknowledgeNotice: companyBillingProcedure.input(z6.object({ version: z6.string().max(32) })).mutation(async ({ ctx, input }) => {
    if (!ctx.memberAccountId) throw new TRPCError9({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    if (input.version !== PRIVACY_NOTICE_VERSION) throw new TRPCError9({ code: "CONFLICT", message: "O aviso foi atualizado. Recarregue a p\xE1gina para ler a vers\xE3o nova." });
    await ensureLgpdTables();
    const meta = requestMeta(ctx);
    const hash = noticeHash();
    const database2 = await getDb();
    if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await database2.execute(sql12`INSERT INTO privacy_acknowledgements (companyId, memberAccountId, noticeVersion, textHash, ipAddress, userAgent, acknowledgedAt)
      VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${PRIVACY_NOTICE_VERSION}, ${hash}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null}, UTC_TIMESTAMP())`);
    void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "privacy_notice", entityId: ctx.memberAccountId, description: `Ci\xEAncia do aviso de privacidade vers\xE3o ${PRIVACY_NOTICE_VERSION} (hash ${hash.slice(0, 12)}\u2026)`, newData: { version: PRIVACY_NOTICE_VERSION, textHash: hash } });
    return { success: true };
  }),
  /** Titular: abrir pedido (art. 18). */
  createRequest: companyBillingProcedure.input(z6.object({ kind: kindSchema, message: z6.string().trim().max(2e3).optional() })).mutation(async ({ ctx, input }) => {
    if (!ctx.memberAccountId) throw new TRPCError9({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    await ensureLgpdTables();
    const meta = requestMeta(ctx);
    const database2 = await getDb();
    if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await database2.execute(sql12`INSERT INTO lgpd_requests (companyId, memberAccountId, kind, message, ipAddress, userAgent) VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${input.kind}, ${input.message || null}, ${meta.ipAddress?.slice(0, 64) ?? null}, ${meta.userAgent?.slice(0, 512) ?? null})`);
    void auditFromCtx(ctx, { action: "create", module: "lgpd", entityType: "lgpd_request", entityId: ctx.memberAccountId, description: `Pedido do titular (LGPD): ${KIND_LABEL[input.kind]}` });
    return { success: true };
  }),
  myRequests: companyBillingProcedure.query(async ({ ctx }) => {
    if (!ctx.memberAccountId) return [];
    await ensureLgpdTables();
    return rows(sql12`SELECT id, kind, message, status, createdAt, resolvedAt, resolution FROM lgpd_requests WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId} ORDER BY id DESC LIMIT 50`);
  }),
  /** Titular baixa a própria cópia (mesmo pacote do administrador). */
  exportMine: companyBillingProcedure.mutation(async ({ ctx }) => {
    if (!ctx.memberAccountId) throw new TRPCError9({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    const z14 = await buildSubjectExportZip(ctx.accountId, ctx.memberAccountId);
    void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: ctx.memberAccountId, description: "Titular baixou c\xF3pia dos pr\xF3prios dados (LGPD art. 18)" });
    return { fileName: z14.fileName, base64: z14.buffer.toString("base64") };
  }),
  // ------------------------------------------------------------- administrador
  requests: companyAdminProcedure.input(z6.object({ status: z6.enum(["open", "all"]).default("open") }).optional()).query(async ({ ctx, input }) => {
    await ensureLgpdTables();
    const companyId = Number(ctx.accountId);
    return rows(sql12`SELECT r.id, r.memberAccountId, m.userName AS name, r.kind, r.message, r.status, r.createdAt, r.resolvedAt, r.resolvedBy, r.resolution
      FROM lgpd_requests r LEFT JOIN member_accounts m ON m.id = r.memberAccountId WHERE r.companyId = ${companyId} ${input?.status === "all" ? sql12`` : sql12`AND r.status = 'open'`} ORDER BY r.id DESC LIMIT 200`);
  }),
  acknowledgements: companyAdminProcedure.query(async ({ ctx }) => {
    await ensureLgpdTables();
    return rows(sql12`SELECT m.id AS memberId, m.userName AS name, m.active, MAX(CASE WHEN a.noticeVersion = ${PRIVACY_NOTICE_VERSION} THEN a.acknowledgedAt END) AS acknowledgedAt
      FROM member_accounts m LEFT JOIN privacy_acknowledgements a ON a.memberAccountId = m.id AND a.companyId = m.companyId
      WHERE m.companyId = ${Number(ctx.accountId)} AND m.role = 'promoter' GROUP BY m.id, m.userName, m.active ORDER BY m.userName`);
  }),
  plan: companyAdminProcedure.query(() => ANONYMIZE_PLAN),
  exportMember: companyAdminProcedure.input(z6.object({ memberId: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const companyId = Number(ctx.accountId);
    const z14 = await buildSubjectExportZip(companyId, input.memberId);
    void auditFromCtx(ctx, { action: "export", module: "lgpd", entityType: "subject_export", entityId: input.memberId, description: "Exportou todos os dados pessoais de um titular (LGPD art. 18)" });
    return { fileName: z14.fileName, base64: z14.buffer.toString("base64"), summary: z14.summary };
  }),
  anonymizeMember: companyAdminProcedure.input(z6.object({ memberId: z6.number().int().positive(), confirm: z6.literal("ANONIMIZAR"), requestId: z6.number().int().positive().optional(), reason: z6.string().trim().min(5).max(500) })).mutation(async ({ ctx, input }) => {
    const companyId = Number(ctx.accountId);
    await ensureLgpdTables();
    const { pseudonym } = await anonymizeSubject(companyId, input.memberId);
    if (input.requestId) {
      const database2 = await getDb();
      await database2?.execute(sql12`UPDATE lgpd_requests SET status = 'done', resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${`Anonimizado: ${input.reason}`} WHERE id = ${input.requestId} AND companyId = ${companyId}`);
    }
    void auditFromCtx(ctx, { action: "delete", module: "lgpd", entityType: "subject_anonymization", entityId: input.memberId, entityLabel: pseudonym, description: `Anonimizou dados pessoais do titular #${input.memberId} (ponto preservado por obriga\xE7\xE3o legal). Motivo: ${input.reason}`, newData: { plan: ANONYMIZE_PLAN, requestId: input.requestId ?? null } });
    return { success: true, pseudonym };
  }),
  resolveRequest: companyAdminProcedure.input(z6.object({ id: z6.number().int().positive(), status: z6.enum(["done", "rejected"]), resolution: z6.string().trim().min(3).max(2e3) })).mutation(async ({ ctx, input }) => {
    await ensureLgpdTables();
    const database2 = await getDb();
    if (!database2) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await database2.execute(sql12`UPDATE lgpd_requests SET status = ${input.status}, resolvedAt = UTC_TIMESTAMP(), resolvedBy = ${ctx.user?.name ?? null}, resolution = ${input.resolution} WHERE id = ${input.id} AND companyId = ${Number(ctx.accountId)}`);
    void auditFromCtx(ctx, { action: "update", module: "lgpd", entityType: "lgpd_request", entityId: input.id, description: `Pedido LGPD #${input.id} ${input.status === "done" ? "atendido" : "recusado"}: ${input.resolution}` });
    return { success: true };
  })
});

// server/routers.ts
init_timesheetArchive();
init_vacations();

// server/modules/platformCompanies.ts
init_trpc();
init_db();
init_audit();
init_platformCompanies();
import { z as z8 } from "zod";
import { TRPCError as TRPCError12 } from "@trpc/server";
var dateStr4 = z8.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var status = z8.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]);
var id = z8.number().int().positive();
var log = (ctx, companyId, action, description, data) => void auditFromCtx(ctx, { action, module: "platform", entityType: "company", entityId: companyId, entityLabel: String(companyId), description, newData: data, companyId: null });
var platformCompaniesRouter = router({
  overview: platformProcedure.query(() => listCompaniesOverview()),
  /** Registra na auditoria (da plataforma e da própria empresa) que o administrador geral entrou como esta empresa. */
  enterAs: platformProcedure.input(z8.object({ companyId: id })).mutation(async ({ ctx, input }) => {
    const company = await getCompanyById(input.companyId);
    if (!company) throw new TRPCError12({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
    void auditFromCtx(ctx, { action: "security", module: "platform", entityType: "company", entityId: company.id, entityLabel: company.name, description: `Administrador da plataforma acessou a empresa ${company.name}`, companyId: company.id });
    return { success: true };
  }),
  rename: platformProcedure.input(z8.object({ companyId: id, name: z8.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    await updateCompany(input.companyId, { name: input.name });
    log(ctx, input.companyId, "update", `Renomeou empresa #${input.companyId} para ${input.name}`);
    return { success: true };
  }),
  setBlocked: platformProcedure.input(z8.object({ companyId: id, blocked: z8.boolean(), reason: z8.string().max(300).optional() })).mutation(async ({ ctx, input }) => {
    const c = await setCompanyBlocked(input.companyId, input.blocked, input.reason);
    log(ctx, input.companyId, input.blocked ? "block" : "unblock", `${input.blocked ? "Bloqueou" : "Desbloqueou"} a empresa ${c.name}${input.reason ? `: ${input.reason}` : ""}`);
    return { success: true };
  }),
  setPlan: platformProcedure.input(z8.object({ companyId: id, planId: id, status, startsAt: dateStr4, endsAt: dateStr4.nullish(), graceDays: z8.number().int().min(0).max(60).optional(), notes: z8.string().max(500).nullish() })).mutation(async ({ ctx, input }) => {
    await setCompanyPlan(input);
    log(ctx, input.companyId, "update", `Definiu plano/validade da empresa #${input.companyId}: plano ${input.planId}, ${input.status}, ${input.startsAt} a ${input.endsAt ?? "sem fim"}`, input);
    return { success: true };
  }),
  payments: platformProcedure.input(z8.object({ companyId: id })).query(({ input }) => listCompanyPayments(input.companyId)),
  registerPayment: platformProcedure.input(z8.object({
    companyId: id,
    amount: z8.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
    paymentDate: dateStr4,
    periodFrom: dateStr4,
    periodTo: dateStr4,
    billingType: z8.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]).default("PIX"),
    planId: id.nullish(),
    graceDays: z8.number().int().min(0).max(60).optional(),
    note: z8.string().max(500).nullish()
  })).mutation(async ({ ctx, input }) => {
    const r = await registerCompanyPayment(input);
    log(ctx, input.companyId, "payment", `Registrou pagamento de R$ ${input.amount} em ${input.paymentDate}; plano v\xE1lido de ${input.periodFrom} a ${input.periodTo}`, input);
    return r;
  }),
  setBilling: platformProcedure.input(z8.object({
    companyId: id,
    monthlyAmount: z8.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullish(),
    blockAfterOverdueDays: z8.number().int().min(0).max(60).nullish(),
    dueDate: dateStr4.nullish()
  })).mutation(async ({ ctx, input }) => {
    const r = await setCompanyBilling(input);
    log(ctx, input.companyId, "update", `Atualizou cobran\xE7a da empresa #${input.companyId}`, input);
    return r;
  }),
  /** Um clique: registra Pix recebido e avança a validade em 1 mês. */
  markPaid: platformProcedure.input(z8.object({
    companyId: id,
    amount: z8.string().regex(/^\d{1,10}(\.\d{1,2})?$/).nullish(),
    paymentDate: dateStr4.optional(),
    graceDays: z8.number().int().min(0).max(60).optional(),
    note: z8.string().max(500).nullish()
  })).mutation(async ({ ctx, input }) => {
    const r = await markCompanyPaid(input);
    log(ctx, input.companyId, "payment", `Marcou como pago a empresa #${input.companyId}`, input);
    return r;
  }),
  deletePayment: platformProcedure.input(z8.object({ companyId: id, paymentId: id })).mutation(async ({ ctx, input }) => {
    await deletePayment(input.paymentId, input.companyId);
    log(ctx, input.companyId, "delete", `Excluiu o pagamento #${input.paymentId} da empresa #${input.companyId}`);
    return { success: true };
  }),
  /** "Excluir": arquiva e bloqueia (reversível). */
  archive: platformProcedure.input(z8.object({ companyId: id, archived: z8.boolean() })).mutation(async ({ ctx, input }) => {
    const c = await archiveCompany(input.companyId, input.archived);
    log(ctx, input.companyId, input.archived ? "delete" : "restore", `${input.archived ? "Excluiu (arquivou)" : "Restaurou"} a empresa ${c.name}`);
    return { success: true };
  }),
  /** Exclusão definitiva e irreversível; exige o nome da empresa e que ela já esteja excluída. */
  purge: platformProcedure.input(z8.object({ companyId: id, confirmName: z8.string().min(1) })).mutation(async ({ ctx, input }) => {
    const r = await purgeCompany(input.companyId, input.confirmName);
    log(ctx, input.companyId, "permanent_delete", `Excluiu DEFINITIVAMENTE a empresa ${r.company.name} (#${input.companyId})`, { deleted: r.deleted, filesDeleted: r.filesDeleted });
    return { success: true, deleted: r.deleted };
  })
});

// server/routers.ts
init_storePhotos();

// server/modules/storeClients.ts
init_db();
init_trpc();
init_audit();
init_storeAccess();
init_storeClients();
import { z as z10 } from "zod";
import { TRPCError as TRPCError14 } from "@trpc/server";
import { sql as sql17 } from "drizzle-orm";
var rows2 = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
var text3 = (max) => z10.string().trim().max(max).optional().transform((v) => v ? v : null);
async function loadClient(db, companyId, storeId, id2) {
  const r = rows2(await db.execute(sql17`SELECT * FROM store_clients WHERE id = ${id2} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`));
  if (!r[0]) throw new TRPCError14({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado nesta loja." });
  return r[0];
}
var storeClientsRouter = router({
  /** Clientes de uma loja, com a quantidade de fotos (o promotor conta só as próprias). */
  list: commercialFeatureProcedure("fieldOperations").input(z10.object({ storeId: z10.number().int().positive(), includeInactive: z10.boolean().optional() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const memberId = scopeMemberId(ctx);
    const own = memberId !== null ? sql17` AND p.promoterId = ${memberId}` : sql17``;
    const r = rows2(await db.execute(sql17`
        SELECT c.id, c.storeId, c.name, c.contactName, c.phone, c.notes, c.active,
          (SELECT COUNT(*) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id AND p.uploadStatus = 'uploaded'${own}) AS photoCount,
          (SELECT MAX(p.capturedAt) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id${own}) AS lastActivity
        FROM store_clients c
        WHERE c.companyId = ${ctx.accountId} AND c.storeId = ${input.storeId}${input.includeInactive ? sql17`` : sql17` AND c.active = true`}
        ORDER BY c.name ASC`));
    return r.map((c) => ({ ...c, active: Boolean(c.active), photoCount: Number(c.photoCount ?? 0) }));
  }),
  create: commercialFeatureProcedure("fieldOperations").input(z10.object({ storeId: z10.number().int().positive(), name: z10.string().trim().min(2, "Informe o nome do cliente.").max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const dup = rows2(await db.execute(sql17`SELECT id FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true AND LOWER(name) = ${input.name.toLowerCase()} LIMIT 1`));
    if (dup[0]) throw new TRPCError14({ code: "CONFLICT", message: "Esta loja j\xE1 tem um cliente com esse nome." });
    const res = await db.execute(sql17`INSERT INTO store_clients (companyId, storeId, name, contactName, phone, notes) VALUES (${ctx.accountId}, ${input.storeId}, ${input.name}, ${input.contactName}, ${input.phone}, ${input.notes})`);
    const id2 = Number((Array.isArray(res) ? res[0] : res)?.insertId);
    await auditFromCtx(ctx, { action: "create", module: "store_clients", entityType: "store_client", entityId: id2, entityLabel: input.name, description: `Cliente ${input.name} cadastrado na loja ${store.name}`, newData: { storeId: input.storeId, name: input.name } });
    return { id: id2 };
  }),
  update: commercialFeatureProcedure("fieldOperations").input(z10.object({ storeId: z10.number().int().positive(), id: z10.number().int().positive(), name: z10.string().trim().min(2).max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
    await db.execute(sql17`UPDATE store_clients SET name = ${input.name}, contactName = ${input.contactName}, phone = ${input.phone}, notes = ${input.notes} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
    await auditFromCtx(ctx, { action: "update", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: input.name, description: `Cliente ${old.name} atualizado na loja ${store.name}`, oldData: { name: old.name, phone: old.phone }, newData: { name: input.name, phone: input.phone } });
    return { id: input.id };
  }),
  /** Remover = desativar: as fotos já tiradas continuam ligadas ao cliente na galeria. */
  setActive: commercialFeatureProcedure("fieldOperations").input(z10.object({ storeId: z10.number().int().positive(), id: z10.number().int().positive(), active: z10.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError14({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
    await db.execute(sql17`UPDATE store_clients SET active = ${input.active} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
    await auditFromCtx(ctx, { action: input.active ? "update" : "delete", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: old.name, description: `Cliente ${old.name} ${input.active ? "reativado" : "removido"} da loja ${store.name}` });
    return { id: input.id, active: input.active };
  })
});

// server/routers.ts
init_products2();
init_rateLimit();
import { z as z13 } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError as TRPCError18 } from "@trpc/server";

// server/authThrottle.ts
import { createHash as createHash3 } from "node:crypto";
import { sql as sql19 } from "drizzle-orm";
var THROTTLE_LIMIT = 5;
var THROTTLE_WINDOW_MS = 15 * 60 * 1e3;
var THROTTLE_BLOCK_MS = 15 * 60 * 1e3;
var memory = /* @__PURE__ */ new Map();
function throttleKeyHash(key) {
  return createHash3("sha256").update(key).digest("hex");
}
function nextEntryAfterFailure(current, now, limit = THROTTLE_LIMIT) {
  const entry = !current || now - current.windowStartedAt >= THROTTLE_WINDOW_MS ? { failures: 1, windowStartedAt: now, blockedUntil: 0 } : { ...current, failures: current.failures + 1 };
  if (entry.failures >= limit) entry.blockedUntil = now + THROTTLE_BLOCK_MS;
  return entry;
}
var ensured2 = null;
var dbGetter = async () => null;
function configureThrottleDb(getter) {
  dbGetter = getter;
  ensured2 = null;
}
var rows3 = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
async function table() {
  const db = await dbGetter();
  if (!db) return null;
  if (!ensured2) {
    ensured2 = db.execute(sql19.raw(`CREATE TABLE IF NOT EXISTS auth_throttle (
      keyHash char(64) NOT NULL,
      failures int NOT NULL DEFAULT 0,
      windowStartedAt bigint NOT NULL,
      blockedUntil bigint NOT NULL DEFAULT 0,
      PRIMARY KEY (keyHash)
    )`)).then(() => void 0).catch((err) => {
      ensured2 = null;
      throw err;
    });
  }
  await ensured2;
  return db;
}
async function isThrottled(key) {
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && mem.blockedUntil > now) return true;
  try {
    const db = await table();
    if (!db) return false;
    const found = rows3(await db.execute(sql19`SELECT blockedUntil FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)} LIMIT 1`));
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
    const found = rows3(await db.execute(sql19`SELECT failures, windowStartedAt, blockedUntil FROM auth_throttle WHERE keyHash = ${hash} LIMIT 1`));
    const current = found[0] ? { failures: Number(found[0].failures), windowStartedAt: Number(found[0].windowStartedAt), blockedUntil: Number(found[0].blockedUntil) } : void 0;
    const next = nextEntryAfterFailure(current, now);
    await db.execute(sql19`INSERT INTO auth_throttle (keyHash, failures, windowStartedAt, blockedUntil)
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
    if (db) await db.execute(sql19`DELETE FROM auth_throttle WHERE keyHash = ${throttleKeyHash(key)}`);
  } catch {
  }
}

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

// server/_core/systemRouter.ts
import { z as z12 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError16 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError16({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError16({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError16({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError16({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
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

// server/_core/systemRouter.ts
init_trpc();
var systemRouter = router({
  health: publicProcedure.input(
    z12.object({
      timestamp: z12.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z12.object({
      title: z12.string().min(1, "title is required"),
      content: z12.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_trpc();
init_subscriptionAccess();

// server/planLimits.ts
init_db();
import { TRPCError as TRPCError17 } from "@trpc/server";

// server/memberAuth.ts
init_ttlCache();
init_schema_original();
init_schema();
init_db();
import { createHash as createHash4, createHmac, randomBytes as randomBytes2, scryptSync, timingSafeEqual } from "node:crypto";
import { and as and15, eq as eq15, gt, inArray as inArray14, lte as lte4 } from "drizzle-orm";
var SESSION_DAYS = 30;
configureThrottleDb(() => getDb());
var isRateLimited = isThrottled;
var registerFailure = registerThrottleFailure;
var clearRateLimit = clearThrottle;
function hashPassword(password) {
  const salt = randomBytes2(16).toString("hex");
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
  return createHash4("sha256").update(token).digest("hex");
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
  const platformResult = await db.select().from(platformAdmins).where(eq15(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    await clearRateLimit(key);
    return { kind: "platform", account: platform };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq15(memberAccounts.email, normalizedEmail)).limit(1);
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
  const rawToken = randomBytes2(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3);
  if (principal.kind === "platform") {
    await db.delete(platformSessions).where(and15(eq15(platformSessions.platformAdminId, principal.account.id), lte4(platformSessions.expiresAt, /* @__PURE__ */ new Date())));
    await db.insert(platformSessions).values({ platformAdminId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
    return { rawToken, expiresAt, kind: "platform" };
  }
  await db.delete(memberSessions).where(and15(eq15(memberSessions.memberAccountId, principal.account.id), lte4(memberSessions.expiresAt, /* @__PURE__ */ new Date())));
  await db.insert(memberSessions).values({ memberAccountId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt, kind: "company" };
}
var SESSION_CACHE_MS = 2e4;
var memberSessionCache = createTtlCache(SESSION_CACHE_MS);
var platformSessionCache = createTtlCache(SESSION_CACHE_MS);
function dropSessionCaches() {
  memberSessionCache.clear();
  platformSessionCache.clear();
}
var lastSessionCleanup = 0;
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
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions).innerJoin(memberAccounts, eq15(memberSessions.memberAccountId, memberAccounts.id)).innerJoin(companies, eq15(memberAccounts.companyId, companies.id)).where(and15(eq15(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq15(memberAccounts.active, true), eq15(companies.active, true))).limit(1);
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
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions).innerJoin(platformAdmins, eq15(platformSessions.platformAdminId, platformAdmins.id)).where(and15(eq15(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq15(platformAdmins.active, true))).limit(1);
  cleanupExpiredSessions(db);
  return result[0]?.account ?? null;
}
async function revokeSessions(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  memberSessionCache.delete(tokenHash);
  platformSessionCache.delete(tokenHash);
  await db.delete(memberSessions).where(eq15(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq15(platformSessions.tokenHash, tokenHash));
}
async function changeMemberPassword(memberAccountId, currentPassword, newPassword) {
  const key = `change:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq15(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq15(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return true;
}
async function changePlatformPassword(platformAdminId, currentPassword, newPassword) {
  const key = `change:platform:${platformAdminId}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq15(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq15(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq15(platformSessions.platformAdminId, platformAdminId));
  dropSessionCaches();
  return true;
}
async function resetMemberPassword(memberAccountId, newPassword) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq15(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  const [acc] = await db.select({ email: memberAccounts.email }).from(memberAccounts).where(eq15(memberAccounts.id, memberAccountId)).limit(1);
  if (acc?.email) await clearRateLimit(`login:${acc.email.trim().toLowerCase()}`);
}
async function recoverPassword(email, recoveryCode, newPassword) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (await isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes2(12).toString("base64url")}`;
  const platformResult = await db.select().from(platformAdmins).where(eq15(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq15(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq15(platformSessions.platformAdminId, platform.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq15(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq15(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, member.id));
    await clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" };
  }
  await registerFailure(key);
  return false;
}
var RESET_TOKEN_TTL_MS = 60 * 60 * 1e3;
function resetSecret() {
  return process.env.JWT_SECRET || "";
}
function signResetToken(kind, id2, exp, passwordHash) {
  const payload = Buffer.from(JSON.stringify({ k: kind, id: id2, exp })).toString("base64url");
  const mac = createHmac("sha256", resetSecret()).update(`${payload}.${passwordHash.slice(-24)}`).digest("base64url");
  return `${payload}.${mac}`;
}
function parseResetToken(token) {
  const [payload, mac] = String(token || "").split(".");
  if (!payload || !mac) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.k !== "platform" && data.k !== "company" || !Number.isInteger(data.id) || typeof data.exp !== "number") return null;
    return { ...data, payload, mac };
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
  const platform = (await db.select().from(platformAdmins).where(eq15(platformAdmins.email, normalizedEmail)).limit(1))[0];
  if (platform?.active) return { token: signResetToken("platform", platform.id, exp, platform.passwordHash), userName: platform.userName || normalizedEmail };
  const member = (await db.select().from(memberAccounts).where(eq15(memberAccounts.email, normalizedEmail)).limit(1))[0];
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
  const account = parsed.k === "platform" ? (await db.select().from(platformAdmins).where(eq15(platformAdmins.id, parsed.id)).limit(1))[0] : (await db.select().from(memberAccounts).where(eq15(memberAccounts.id, parsed.id)).limit(1))[0];
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
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq15(platformAdmins.id, parsed.id));
    await db.delete(platformSessions).where(eq15(platformSessions.platformAdminId, parsed.id));
  } else {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq15(memberAccounts.id, parsed.id));
    await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, parsed.id));
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
  const recoveryCode = `EXT-${randomBytes2(12).toString("base64url")}`;
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
      const planRows = await tx.select().from(subscriptionPlans).where(eq15(subscriptionPlans.id, input.planId)).limit(1);
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
  const recoveryCode = `EXT-${randomBytes2(12).toString("base64url")}`;
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
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt, employeeCode: promoterProfiles.employeeCode, workStartTime: promoterProfiles.workStartTime, workEndTime: promoterProfiles.workEndTime }).from(memberAccounts).leftJoin(promoterProfiles, and15(eq15(promoterProfiles.memberAccountId, memberAccounts.id), eq15(promoterProfiles.companyId, memberAccounts.companyId)));
  const rows4 = companyId ? await query.where(eq15(memberAccounts.companyId, companyId)) : await query;
  return rows4.map((row2) => ({ ...row2, role: normalizeMemberRole(String(row2.role)) }));
}
async function updateCompanyUser(accountId, companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.role && data.role !== "company_admin") {
    const [target] = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(and15(eq15(memberAccounts.id, accountId), eq15(memberAccounts.companyId, companyId))).limit(1);
    if (target && normalizeMemberRole(String(target.role)) === "company_admin") {
      const admins = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and15(eq15(memberAccounts.companyId, companyId), eq15(memberAccounts.active, true), inArray14(memberAccounts.role, ["company_admin", "admin"]))).limit(2);
      if (admins.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
    }
  }
  await db.update(memberAccounts).set({ ...data, email: data.email?.trim().toLowerCase() }).where(and15(eq15(memberAccounts.id, accountId), eq15(memberAccounts.companyId, companyId)));
}
async function setMemberActive(id2, active, companyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const conditions = companyId === void 0 ? eq15(memberAccounts.id, id2) : and15(eq15(memberAccounts.id, id2), eq15(memberAccounts.companyId, companyId));
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(conditions).limit(1);
  if (account[0]?.role === "company_admin" && !active) {
    const adminCount = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and15(eq15(memberAccounts.companyId, companyId ?? 0), eq15(memberAccounts.role, "company_admin"), eq15(memberAccounts.active, true))).limit(2);
    if (adminCount.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
  }
  await db.update(memberAccounts).set({ active }).where(conditions);
  if (!active) {
    await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, id2));
    dropSessionCaches();
  }
}
async function updateMemberProfile(memberAccountId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const name = data.userName.trim();
  if (name.length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres.");
  await db.update(memberAccounts).set({ userName: name }).where(eq15(memberAccounts.id, memberAccountId));
  return { success: true, userName: name };
}
async function regenerateMemberRecoveryCode(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes2(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq15(memberAccounts.id, memberAccountId));
  return { recoveryCode };
}
async function revokeAllMemberSessions(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(eq15(memberSessions.memberAccountId, memberAccountId));
  dropSessionCaches();
  return { success: true };
}
async function verifyMemberPassword(memberAccountId, password) {
  const key = `verify:member:${memberAccountId}`;
  if (await isRateLimited(key)) return false;
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.select().from(memberAccounts).where(eq15(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    await registerFailure(key);
    return false;
  }
  await clearRateLimit(key);
  return true;
}

// server/planLimits.ts
init_schema_original();
init_entitlements();
init_entitlements2();
import { sql as sql20, eq as eq16 } from "drizzle-orm";
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
async function countUsers(companyId) {
  const list = await listMemberAccounts(companyId);
  return Array.isArray(list) ? list.length : 0;
}
async function assertUserLimit(companyId) {
  const plan = await getEffectivePlan(companyId);
  if (plan.maxUsers == null) return plan;
  const current = await countUsers(companyId);
  if (current >= plan.maxUsers) {
    throw new TRPCError17({
      code: "FORBIDDEN",
      message: `Limite de usu\xE1rios do plano ${plan.name} atingido (${plan.maxUsers}). Fa\xE7a upgrade para adicionar outro usu\xE1rio.`,
      cause: { code: "PLAN_LIMIT", resource: "users", limit: plan.maxUsers, current }
    });
  }
  return plan;
}

// server/routers.ts
init_db();
init_email();
init_audit();

// shared/address.ts
var UF_BY_STATE = {
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
function stateToUf(state, iso) {
  const fromIso = iso?.match(/^BR-([A-Z]{2})$/)?.[1];
  if (fromIso) return fromIso;
  return state ? UF_BY_STATE[state.trim().toLowerCase()] ?? state : void 0;
}
function formatCep(cep) {
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
  const cep = formatCep(a.postcode);
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

// server/geocoding.ts
var CACHE_TTL_MS = 60 * 60 * 1e3;
var MAX_CACHE_ENTRIES = 2e3;
var MIN_REQUEST_INTERVAL_MS = 250;
var addressCache = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
var requestQueue = Promise.resolve();
var lastRequestStartedAt = 0;
var NOMINATIM_UA = "GondUp/1.0 (https://gondup.com.br; contato@gondup.com.br)";
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
      const payload = await response.json();
      const result = payload.results?.[0]?.formatted ?? payload.features?.[0]?.properties?.formatted;
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
var brCache = /* @__PURE__ */ new Map();
var BR_TTL_MS = 7 * 24 * 60 * 60 * 1e3;
var lastNominatimAt = 0;
var nominatimQueue = Promise.resolve();
function needsEnrichment(parts) {
  return !streetFromAddress(parts) || !bairroFromAddress(parts);
}
async function nominatimParts(latitude, longitude, fetchImpl) {
  const run = nominatimQueue.then(async () => {
    const wait = 1100 - (Date.now() - lastNominatimAt);
    if (wait > 0) await delay(wait);
    lastNominatimAt = Date.now();
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=jsonv2&zoom=18&addressdetails=1&accept-language=pt-BR&email=contato@gondup.com.br`;
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
      postcode: data.cep || formatCep(digits),
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
      postcode: formatCep(data.cep || digits),
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
  const cep = formatCep(parts.postcode);
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

// server/routers.ts
init_storeAccess();
init_entitlements();
init_entitlements2();

// server/aiGithubService.ts
var GITHUB_API = "https://api.github.com";
var OWNER = process.env.GITHUB_REPO_OWNER || "IvanMHonemann";
var REPO = process.env.GITHUB_REPO_NAME || "promotores-saas";
var BRANCH = process.env.GITHUB_REPO_BRANCH || "main";
var REPO_LABEL = `${OWNER}/${REPO}`;
var baseFiles = [
  "client/src/App.tsx",
  "client/src/index.css"
];
var extraEditableFiles = ["package.json", "vercel.json", "client/src/components/AIChatBox.tsx"];
var MAX_SELECTED_FILES = 6;
var MAX_FILE_CHARS = 15e4;
var MAX_CONTEXT_CHARS = 6e5;
var GithubSetupError = class extends Error {
};
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
async function github(path2, init2 = {}, { requireToken = true } = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token && requireToken) {
    throw new GithubSetupError(`A IA ainda n\xE3o est\xE1 conectada ao GitHub: falta a vari\xE1vel GITHUB_TOKEN na Vercel. Sem ela eu consigo conversar e analisar, mas n\xE3o consigo abrir a corre\xE7\xE3o (Pull Request) no reposit\xF3rio ${REPO_LABEL}.`);
  }
  const response = await fetch(`${GITHUB_API}${path2}`, {
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
function isAiEditablePath(path2) {
  if (extraEditableFiles.includes(path2)) return true;
  if (!/^(client\/src|server|shared)\//.test(path2)) return false;
  if (!/\.(tsx?|css)$/.test(path2)) return false;
  if (/\.test\.tsx?$/.test(path2)) return false;
  if (/^server\/_core\//.test(path2)) return false;
  if (/(^|\/)\.env/i.test(path2) || /secret|credential/i.test(path2)) return false;
  if (/\/_archived\//.test(path2)) return false;
  return true;
}
function asksForChange(prompt) {
  if (/\bn[ãa]o\s+(altere|mude|modifique|mexa|aplique|fa[çc]a\s+altera)/i.test(prompt)) return false;
  return /\b(altere|alterar|mude|mudar|modifique|modificar|adicione|adicionar|remova|remover|crie|criar|corrija|corrigir|conserte|consertar|arrume|arrumar|implemente|implementar|troque|trocar|aplique|aplicar|fa[çc]a|fazer|coloque|colocar|insira|inserir|inclua|incluir|disponibilize|disponibilizar|reative|reativar|restaure|restaurar|atualize|atualizar)\b/i.test(prompt);
}
function needsCode(prompt, hasAttachments) {
  return hasAttachments || asksForChange(prompt) || /\b(erros?|bugs?|c[oó]digo|varredura|escane|scan|analis|revis|layout|design|tela|p[aá]gina|arquivo|obsolet|quebrad|funcion)/i.test(prompt);
}
async function readFile(path2, ref) {
  const file = await github(`/repos/${OWNER}/${REPO}/contents/${path2.split("/").map(encodeURIComponent).join("/")}?ref=${encodeURIComponent(ref)}`, {}, { requireToken: false });
  return { path: path2, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
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
var cachedModels = null;
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
  for (const file of await Promise.all(paths.map((path2) => readFile(path2, ref.object.sha).catch(() => null)))) {
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

// shared/aiAttachments.ts
var AI_MAX_ATTACHMENTS = 5;
var AI_MAX_PICK_BYTES = 10 * 1024 * 1024;
var AI_MAX_PDF_BYTES = 3 * 1024 * 1024;
var AI_MAX_TEXT_CHARS = 2e5;
var AI_MAX_TOTAL_CHARS = 4e6;
var AI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
function aiAttachmentsSize(list) {
  return list.reduce((sum, item) => sum + item.data.length, 0);
}

// server/routers.ts
init_expiry();
var companyUserRole = z13.enum(["company_admin", "supervisor", "promoter"]);
var entitlementFeatureKey = z13.enum(ENTITLEMENT_KEYS);
var permissionModeSchema = z13.enum(["inherit", "allow", "deny"]);
var featurePermissionListSchema = z13.array(z13.object({ featureKey: entitlementFeatureKey, mode: permissionModeSchema })).max(ENTITLEMENT_KEYS.length);
var platformTestSessions = /* @__PURE__ */ new Map();
var platformTestKey = (platformAdminId, fallbackId) => platformAdminId ?? fallbackId;
var getPlatformTestSession = (key) => platformTestSessions.get(key) ?? { status: "pending", photoCount: 0, lastPhotoAt: null, lastLatitude: null, lastLongitude: null };
var appRouter = router({
  system: systemRouter,
  timeTracking: timeTrackingRouter,
  timesheetMirror: timesheetMirrorRouter,
  pontoLegal: pontoLegalRouter,
  lgpd: lgpdRouter,
  timesheetArchive: timesheetArchiveRouter,
  vacations: vacationsRouter,
  platformCompanies: platformCompaniesRouter,
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
      if (!ctx.memberAccountId) throw new TRPCError18({ code: "FORBIDDEN", message: "Usu\xE1rio da empresa n\xE3o encontrado." });
      return getMemberEntitlementSnapshot(ctx.accountId, ctx.memberAccountId, ctx.user.role);
    })
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    /** Cadastro público: cria empresa + admin com plano opcional (trial 14 dias). */
    signup: publicProcedure.input(z13.object({
      companyName: z13.string().min(2, "Nome da empresa \xE9 obrigat\xF3rio"),
      userName: z13.string().min(2, "Nome do respons\xE1vel \xE9 obrigat\xF3rio"),
      email: z13.string().email(),
      password: z13.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      planId: z13.number().int().positive("Selecione um plano antes de criar a conta"),
      paymentConfirmed: z13.boolean().refine((v) => v === true, { message: "Confirme o pagamento para criar a conta." })
    })).mutation(async ({ ctx, input }) => {
      const signupKey = `signup:${getClientIp(ctx.req)}`;
      if (await isThrottled(signupKey)) {
        throw new TRPCError18({ code: "TOO_MANY_REQUESTS", message: "Muitos cadastros deste endere\xE7o. Tente novamente em alguns minutos." });
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
          throw new TRPCError18({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        }
        throw error;
      }
    }),
    login: publicProcedure.input(z13.object({ email: z13.string().email(), password: z13.string().min(1) })).mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const limit = checkRateLimit(ip, "login");
      if (!limit.ok) {
        throw new TRPCError18({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto." });
      }
      const principal = await authenticateMember(input.email, input.password);
      if (!principal) {
        void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
        throw new TRPCError18({ code: "UNAUTHORIZED", message: "E-mail ou senha inv\xE1lidos." });
      }
      if (principal.kind === "company") {
        const company = await getCompanyById(principal.account.companyId);
        if (!company || company.active === false) {
          const reason = company ? await getSetting("blocked_reason", company.id, "") : "";
          throw new TRPCError18({ code: "FORBIDDEN", message: reason || "Acesso da empresa bloqueado. Entre em contato com o suporte." });
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
    recoverPassword: publicProcedure.input(z13.object({ email: z13.string().email(), recoveryCode: z13.string().min(1), newPassword: z13.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ input }) => {
      const recovered = await recoverPassword(input.email, input.recoveryCode, input.newPassword);
      if (!recovered) throw new TRPCError18({ code: "UNAUTHORIZED", message: "E-mail ou c\xF3digo de recupera\xE7\xE3o inv\xE1lido." });
      return { success: true, recoveryCode: recovered.recoveryCode };
    }),
    /** "Esqueci minha senha": resposta sempre igual (não revela se o e-mail existe). */
    requestPasswordReset: publicProcedure.input(z13.object({ email: z13.string().trim().email() })).mutation(async ({ input }) => {
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
    resetPasswordWithToken: publicProcedure.input(z13.object({ token: z13.string().min(10).max(2e3), newPassword: z13.string().min(8, "A nova senha deve ter pelo menos 8 caracteres").max(200) })).mutation(async ({ input }) => {
      const ok = await resetPasswordWithToken(input.token, input.newPassword);
      if (!ok) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Link inv\xE1lido ou expirado. Pe\xE7a um novo link." });
      return { success: true };
    }),
    changePassword: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z13.object({ currentPassword: z13.string().min(1), newPassword: z13.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ ctx, input }) => {
      const changed = ctx.user.role === "platform_admin" ? await changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword) : await changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
      if (!changed) throw new TRPCError18({ code: "UNAUTHORIZED", message: "A senha atual est\xE1 incorreta." });
      return { success: true };
    }),
    updateProfile: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z13.object({
      userName: z13.string().min(2).optional(),
      avatarDataUrl: z13.string().max(4e5).optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError18({ code: "BAD_REQUEST", message: "Perfil de plataforma n\xE3o usa esta rota." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const companyId = ctx.accountId;
      if (!companyId) throw new TRPCError18({ code: "FORBIDDEN", message: "Empresa n\xE3o identificada." });
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
            throw new TRPCError18({ code: "BAD_REQUEST", message: "Imagem de perfil inv\xE1lida." });
          }
          await setSetting(key, input.avatarDataUrl, companyId);
        }
      }
      return { success: true, userName };
    }),
    profileExtras: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
      if (!opts.ctx.user) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z13.object({ currentPassword: z13.string().min(1) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError18({ code: "BAD_REQUEST", message: "Indispon\xEDvel para admin da plataforma nesta tela." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const ok = await verifyMemberPassword(memberId, input.currentPassword);
      if (!ok) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      const result = await regenerateMemberRecoveryCode(memberId);
      return { success: true, recoveryCode: result.recoveryCode };
    }),
    logoutAllSessions: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError18({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
    aiSupport: router({
      chat: platformProcedure.input(z13.object({
        prompt: z13.string().trim().min(1).max(12e3),
        history: z13.array(z13.object({ role: z13.enum(["user", "assistant"]), content: z13.string().max(12e3) })).max(30).optional(),
        attachments: z13.array(z13.object({
          name: z13.string().trim().min(1).max(200),
          mimeType: z13.string().max(100),
          kind: z13.enum(["image", "pdf", "text"]),
          data: z13.string().min(1).max(AI_MAX_TOTAL_CHARS)
        })).max(AI_MAX_ATTACHMENTS).optional()
      })).mutation(async ({ input }) => {
        const attachments = input.attachments ?? [];
        if (aiAttachmentsSize(attachments) > AI_MAX_TOTAL_CHARS) throw new TRPCError18({ code: "PAYLOAD_TOO_LARGE", message: "Os anexos passaram do limite de envio (cerca de 4 MB no total). Envie menos arquivos ou arquivos menores." });
        for (const file of attachments) {
          if (file.kind === "image" && !AI_IMAGE_TYPES.includes(file.mimeType)) throw new TRPCError18({ code: "BAD_REQUEST", message: `Formato de imagem n\xE3o aceito: ${file.name}.` });
          if (file.kind === "text" && file.data.length > AI_MAX_TEXT_CHARS) throw new TRPCError18({ code: "BAD_REQUEST", message: `O arquivo ${file.name} \xE9 grande demais.` });
        }
        return runPersistentGemini(input.prompt, input.history ?? [], attachments);
      })
    }),
    plans: router({
      list: platformProcedure.query(() => listSubscriptionPlans()),
      create: platformProcedure.input(z13.object({
        name: z13.string().min(2),
        description: z13.string().optional().nullable(),
        price: z13.string().default("0.00"),
        billingCycle: z13.enum(["monthly", "yearly"]).default("monthly"),
        maxUsers: z13.number().int().positive().optional().nullable(),
        maxClients: z13.number().int().positive().optional().nullable(),
        maxExtinguishers: z13.number().int().positive().optional().nullable(),
        featureKeys: z13.array(entitlementFeatureKey).default([]),
        availableForNew: z13.boolean().default(true)
      })).mutation(({ input }) => createSubscriptionPlan(input)),
      update: platformProcedure.input(z13.object({
        id: z13.number().int().positive(),
        name: z13.string().min(2).optional(),
        description: z13.string().optional().nullable(),
        price: z13.string().optional(),
        billingCycle: z13.enum(["monthly", "yearly"]).optional(),
        maxUsers: z13.number().int().positive().optional().nullable(),
        maxClients: z13.number().int().positive().optional().nullable(),
        maxExtinguishers: z13.number().int().positive().optional().nullable(),
        featureKeys: z13.array(entitlementFeatureKey).optional(),
        availableForNew: z13.boolean().optional(),
        active: z13.boolean().optional()
      })).mutation(async ({ input }) => {
        const { id: id2, ...data } = input;
        return updateSubscriptionPlan(id2, data);
      })
    }),
    subscriptions: router({
      list: platformProcedure.query(() => listCompanySubscriptions()),
      stats: platformProcedure.query(() => getSubscriptionStats()),
      create: platformProcedure.input(z13.object({
        companyId: z13.number().int().positive(),
        planId: z13.number().int().positive(),
        status: z13.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).default("active"),
        startsAt: z13.string().min(8),
        endsAt: z13.string().optional().nullable(),
        notes: z13.string().optional().nullable()
      })).mutation(({ input }) => createCompanySubscription(input)),
      update: platformProcedure.input(z13.object({
        id: z13.number().int().positive(),
        planId: z13.number().int().positive().optional(),
        status: z13.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).optional(),
        startsAt: z13.string().min(8).optional(),
        endsAt: z13.string().optional().nullable(),
        notes: z13.string().optional().nullable()
      })).mutation(async ({ input }) => {
        const { id: id2, ...data } = input;
        return updateCompanySubscription(id2, data);
      })
    }),
    companyFeatures: router({
      get: platformProcedure.input(z13.object({ companyId: z13.number().int().positive() })).query(({ input }) => getCompanyEntitlementBase(input.companyId)),
      set: platformProcedure.input(z13.object({
        companyId: z13.number().int().positive(),
        overrides: featurePermissionListSchema,
        reason: z13.string().max(500).optional().nullable()
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
    reverseGeocodePoint: platformProcedure.input(z13.object({ latitude: z13.number().min(-90).max(90), longitude: z13.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
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
      start: platformProcedure.input(z13.object({ id: z13.number().int().positive(), latitude: z13.number().optional(), longitude: z13.number().optional(), accuracy: z13.number().optional() })).mutation(({ ctx, input }) => {
        if (input.id !== 1) throw new TRPCError18({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
        const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
        const session = getPlatformTestSession(key);
        if (session.status === "completed") throw new TRPCError18({ code: "BAD_REQUEST", message: "Reinicie a sess\xE3o de sandbox para testar novamente." });
        session.status = "in_progress";
        session.lastLatitude = input.latitude ?? null;
        session.lastLongitude = input.longitude ?? null;
        platformTestSessions.set(key, session);
        return { visitId: 1, storeId: 1, storeName: "Loja de teste do administrador geral", ...session };
      }),
      complete: platformProcedure.input(z13.object({ id: z13.number().int().positive(), latitude: z13.number().optional(), longitude: z13.number().optional(), accuracy: z13.number().optional() })).mutation(({ ctx, input }) => {
        if (input.id !== 1) throw new TRPCError18({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
        const key = platformTestKey(ctx.platformAdminId, ctx.user.id);
        const session = getPlatformTestSession(key);
        if (session.status !== "in_progress") throw new TRPCError18({ code: "BAD_REQUEST", message: "Fa\xE7a o check-in antes do check-out." });
        session.status = "completed";
        session.lastLatitude = input.latitude ?? null;
        session.lastLongitude = input.longitude ?? null;
        platformTestSessions.set(key, session);
        return { visitId: 1, storeId: 1, storeName: "Loja de teste do administrador geral", ...session };
      }),
      uploadPhoto: platformProcedure.input(z13.object({ storeId: z13.number().int().positive().optional().nullable(), visitId: z13.number().int().positive().optional(), capturedAt: z13.string(), latitude: z13.number().optional(), longitude: z13.number().optional(), accuracy: z13.number().optional(), imageBase64: z13.string().min(100).max(6e6), mimeType: z13.string().default("image/jpeg"), idempotencyKey: z13.string().min(8).max(64) })).mutation(({ ctx, input }) => {
        if (input.visitId !== void 0 && input.visitId !== 1) throw new TRPCError18({ code: "NOT_FOUND", message: "Sess\xE3o de sandbox n\xE3o encontrada." });
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
      create: platformProcedure.input(z13.object({ companyName: z13.string().min(2), userName: z13.string().min(2), email: z13.string().email(), password: z13.string().min(8), featureKeys: z13.array(entitlementFeatureKey).optional() })).mutation(async ({ ctx, input }) => {
        try {
          const created = await createCompanyWithAdmin(input);
          const selected = new Set(input.featureKeys ?? []);
          const overrides = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, selected.has(key)]));
          await replaceCompanyFeatureOverrides({ companyId: created.companyId, overrides, updatedByPlatformAdminId: ctx.platformAdminId ?? null, reason: "Definido na cria\xE7\xE3o da empresa" });
          return created;
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError18({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      }),
      update: platformProcedure.input(z13.object({ id: z13.number().int().positive(), name: z13.string().min(2).optional(), active: z13.boolean().optional() })).mutation(async ({ input }) => {
        await updateCompany(input.id, { name: input.name, active: input.active });
        return { success: true };
      })
    }),
    users: router({
      list: platformProcedure.query(() => listMemberAccounts()),
      create: platformProcedure.input(z13.object({ companyId: z13.number().int().positive(), userName: z13.string().min(2), email: z13.string().email(), password: z13.string().min(8), role: companyUserRole })).mutation(async ({ input, ctx }) => {
        const company = await getCompanyById(input.companyId);
        if (!company) throw new TRPCError18({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
        if (!company.active) throw new TRPCError18({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel criar usu\xE1rio em uma empresa bloqueada." });
        try {
          const created = await createCompanyUser(input);
          void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usu\xE1rio criado pelo administrador geral: ${input.userName}`, newData: { companyId: input.companyId, email: input.email, role: input.role } });
          return created;
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError18({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      })
    })
  }),
  accounts: router({
    list: platformProcedure.query(() => listMemberAccounts()),
    create: platformProcedure.input(z13.object({ companyName: z13.string().min(2), userName: z13.string().min(2), email: z13.string().email(), password: z13.string().min(8) })).mutation(async ({ input }) => {
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
    setActive: platformProcedure.input(z13.object({ id: z13.number().int().positive(), active: z13.boolean() })).mutation(async ({ ctx, input }) => {
      await setMemberActive(input.id, input.active);
      void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Administrador geral ${input.active ? "liberou" : "bloqueou"} o usu\xE1rio #${input.id}` });
      return { success: true };
    }),
    resetPassword: platformProcedure.input(z13.object({ id: z13.number().int().positive(), newPassword: z13.string().min(8) })).mutation(async ({ input }) => {
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  companyUsers: router({
    list: companyAdminFeatureProcedure("teamManagement").query(({ ctx }) => listMemberAccounts(ctx.accountId)),
    permissions: companyAdminFeatureProcedure("teamManagement").input(z13.object({ id: z13.number().int().positive() })).query(async ({ ctx, input }) => {
      const members = await listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError18({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      return getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
    }),
    setPermissions: companyAdminFeatureProcedure("teamManagement").input(z13.object({
      id: z13.number().int().positive(),
      permissions: featurePermissionListSchema
    })).mutation(async ({ ctx, input }) => {
      const members = await listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError18({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      const modes = Object.fromEntries(input.permissions.map(({ featureKey, mode }) => [featureKey, mode]));
      if (target.role === "company_admin" && modes.teamManagement === "deny") {
        throw new TRPCError18({ code: "BAD_REQUEST", message: "A permiss\xE3o de gest\xE3o da equipe n\xE3o pode ser bloqueada individualmente para um administrador da empresa." });
      }
      const base = await getCompanyEntitlementBase(ctx.accountId);
      for (const [featureKey, mode] of Object.entries(modes)) {
        if (mode === "allow" && !base.companyFeatures[featureKey]) {
          throw new TRPCError18({ code: "BAD_REQUEST", message: `O m\xF3dulo ${featureKey} n\xE3o est\xE1 liberado para esta empresa.` });
        }
        if (mode === "allow" && !ROLE_FEATURE_CEILING[target.role].includes(featureKey)) {
          throw new TRPCError18({ code: "BAD_REQUEST", message: `O papel ${target.role} n\xE3o permite liberar o m\xF3dulo ${featureKey}.` });
        }
      }
      const before = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
      await replaceMemberFeatureModes({ memberAccountId: target.id, modes, updatedByMemberAccountId: ctx.memberAccountId ?? null });
      const after = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
      void auditFromCtx(ctx, { action: "settings_change", module: "users", entityType: "user_permissions", entityId: target.id, entityLabel: target.userName, description: `Permiss\xF5es de m\xF3dulos atualizadas para ${target.userName}`, oldData: before.effective, newData: after.effective });
      return { success: true };
    }),
    create: companyAdminFeatureProcedure("teamManagement").input(z13.object({ userName: z13.string().min(2), email: z13.string().email(), password: z13.string().min(8), role: companyUserRole, storeIds: z13.array(z13.number().int().positive()).optional() })).mutation(async ({ ctx, input }) => {
      try {
        await assertUserLimit(ctx.accountId);
        const { storeIds, ...userInput } = input;
        const created = await createCompanyUser({ ...userInput, companyId: ctx.accountId });
        if (input.role === "promoter" && storeIds && storeIds.length > 0) {
          const database2 = await getDb();
          await setPromoterStoreAssignments(database2, ctx.accountId, created.accountId, storeIds);
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
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError18({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        console.error("[companyUsers.create] database error", { code: error?.code, errno: error?.errno, sqlMessage: error?.sqlMessage, message: error?.message });
        if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.code === "ER_NO_REFERENCED_ROW") throw new TRPCError18({ code: "BAD_REQUEST", message: "A empresa selecionada n\xE3o existe mais. Atualize a p\xE1gina e tente novamente." });
        if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") throw new TRPCError18({ code: "INTERNAL_SERVER_ERROR", message: "O banco de dados est\xE1 com a estrutura de usu\xE1rios desatualizada. A implanta\xE7\xE3o precisa concluir a migra\xE7\xE3o." });
        throw new TRPCError18({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar o usu\xE1rio. Verifique os dados e tente novamente." });
      }
    }),
    update: companyAdminFeatureProcedure("teamManagement").input(z13.object({ id: z13.number().int().positive(), userName: z13.string().min(2).optional(), email: z13.string().email().optional(), role: companyUserRole.optional() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError18({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode remover o pr\xF3prio n\xEDvel administrativo." });
      const usersBefore = await listMemberAccounts(ctx.accountId);
      const beforeUser = usersBefore.find((u) => u.id === input.id) || null;
      try {
        await updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
      } catch (error) {
        if (error?.message === "A empresa precisa manter pelo menos um administrador ativo.") throw new TRPCError18({ code: "BAD_REQUEST", message: error.message });
        throw error;
      }
      const usersAfter = await listMemberAccounts(ctx.accountId);
      const afterUser = usersAfter.find((u) => u.id === input.id) || null;
      const userDiff = diffAuditData(beforeUser, afterUser);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: input.id, entityLabel: afterUser?.userName || beforeUser?.userName || `#${input.id}`, description: `Usu\xE1rio atualizado: ${afterUser?.userName || input.id}`, oldData: userDiff.oldData, newData: userDiff.newData });
      return { success: true };
    }),
    getPromoterStores: companyAdminFeatureProcedure("teamManagement").input(z13.object({ id: z13.number().int().positive() })).query(async ({ ctx, input }) => {
      const database2 = await getDb();
      return getPromoterStoreAssignments(database2, ctx.accountId, input.id);
    }),
    updatePromoterManagement: companyAdminFeatureProcedure("teamManagement").input(z13.object({
      id: z13.number().int().positive(),
      userName: z13.string().trim().min(2).max(255),
      email: z13.string().trim().email().max(320),
      employeeCode: z13.string().trim().max(50).nullable(),
      workStartTime: z13.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      workEndTime: z13.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      weeklyRoutes: z13.array(z13.object({ weekday: z13.number().int().min(0).max(6), storeIds: z13.array(z13.number().int().positive()).min(1) })).max(7).optional(),
      storeIds: z13.array(z13.number().int().positive()).optional()
    })).mutation(async ({ ctx, input }) => {
      if (input.workStartTime && input.workEndTime && input.workEndTime <= input.workStartTime) {
        throw new TRPCError18({ code: "BAD_REQUEST", message: "O fim da jornada precisa ser posterior ao in\xEDcio." });
      }
      const usersBefore = await listMemberAccounts(ctx.accountId);
      const before = usersBefore.find((member) => member.id === input.id);
      if (!before || before.role !== "promoter") throw new TRPCError18({ code: "NOT_FOUND", message: "Promotor n\xE3o encontrado nesta empresa." });
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
      } catch (error) {
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError18({ code: "CONFLICT", message: "Este e-mail ou matr\xEDcula j\xE1 est\xE1 em uso." });
        if (error?.message?.includes("n\xE3o pertence") || error?.message?.includes("inativas") || error?.message?.includes("programa\xE7\xE3o") || error?.message?.includes("dia programado")) {
          throw new TRPCError18({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
      const usersAfter = await listMemberAccounts(ctx.accountId);
      const after = usersAfter.find((member) => member.id === input.id);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "promoter_profile", entityId: input.id, entityLabel: after?.userName || before.userName, description: `Cadastro e roteiro de ${after?.userName || before.userName} atualizados`, oldData: before, newData: after });
      return { success: true };
    }),
    setActive: companyAdminFeatureProcedure("teamManagement").input(z13.object({ id: z13.number().int().positive(), active: z13.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError18({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode desativar a pr\xF3pria sess\xE3o." });
      await setMemberActive(input.id, input.active, ctx.accountId);
      void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Usu\xE1rio ${input.active ? "ativado" : "desativado"} #${input.id}`, newData: { active: input.active } });
      return { success: true };
    }),
    resetPassword: companyAdminFeatureProcedure("teamManagement").input(z13.object({ id: z13.number().int().positive(), newPassword: z13.string().min(8) })).mutation(async ({ ctx, input }) => {
      const users3 = await listMemberAccounts(ctx.accountId);
      if (!users3.some((account) => account.id === input.id)) throw new TRPCError18({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  // O dashboard é a tela básica de toda conta autenticada; módulos pagos
  // continuam usando commercialFeatureProcedure normalmente.
  companyProfile: router({
    updateName: companyAdminProcedure.input(z13.object({ name: z13.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
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
    setAutoClockOut: companyAdminFeatureProcedure("timeTracking").input(z13.object({ time: z13.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
      await setSetting("auto_clock_out_time", input.time || "", ctx.accountId);
      return { success: true, time: input.time || "" };
    }),
    getAlertDays: commercialFeatureProcedure("alerts").query(async ({ ctx }) => parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
    setAlertDays: companyAdminFeatureProcedure("alerts").input(z13.object({ days: z13.number().min(1).max(365) })).mutation(async ({ ctx, input }) => {
      const prev = await getSetting("alert_days_ahead", ctx.accountId, "30");
      await setSetting("alert_days_ahead", input.days.toString(), ctx.accountId);
      void auditFromCtx(ctx, { action: "settings_change", module: "settings", entityType: "setting", entityLabel: "alert_days_ahead", description: `Anteced\xEAncia de alertas alterada: ${prev} \u2192 ${input.days} dias`, oldData: { alert_days_ahead: prev }, newData: { alert_days_ahead: String(input.days) } });
      return { success: true, days: input.days };
    })
  }),
  inventoryAlerts: protectedProcedure.input(z13.object({ daysAhead: z13.number().optional() }).optional()).query(async ({ ctx }) => {
    if (!ctx.accountId || !ctx.user || ctx.user.role === "platform_admin") return [];
    const { inventoryAlertsFor: inventoryAlertsFor2 } = await Promise.resolve().then(() => (init_products2(), products_exports));
    try {
      return await inventoryAlertsFor2(ctx);
    } catch (error) {
      console.error("[inventoryAlerts] falha ao consultar validades", error);
      throw new TRPCError18({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel consultar as validades." });
    }
  }),
  // Endereço para carimbo de foto/ponto (qualquer membro da empresa). Feito no servidor com cache.
  geo: router({
    reverse: companyBillingProcedure.input(z13.object({ latitude: z13.number().min(-90).max(90), longitude: z13.number().min(-180).max(180) })).mutation(async ({ input }) => ({ address: await reverseGeocodeBr(input.latitude, input.longitude) }))
  }),
  trash: router({
    // Qualquer usuário autenticado da empresa; não-administradores só enxergam/operam o que apagaram ou é deles.
    list: companyBillingProcedure.query(({ ctx }) => listTrash(ctx.accountId, scopeMemberId(ctx))),
    restore: companyBillingProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const item = await restoreTrashItem(input.id, ctx.accountId, scopeMemberId(ctx));
      void auditFromCtx(ctx, { action: "restore", module: "trash", entityType: item.itemType, entityId: item.originalId, entityLabel: item.label, description: `Restaurou da lixeira: ${item.label}` });
      return { success: true };
    }),
    permanentlyDelete: companyBillingProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
    plans: companyBillingProcedure.query(async () => {
      await ensureSeedPlans();
      const all = await listSubscriptionPlans();
      return all.filter((p) => p.active !== false);
    }),
    mySubscription: companyBillingProcedure.query(async ({ ctx }) => {
      const resolved = await resolveCompanyPlan(ctx.accountId);
      const effective = await getEffectivePlan(ctx.accountId);
      const plan = resolved.plan ? { ...resolved.plan, ...effective, id: effective.id ?? resolved.plan.id, name: effective.name } : effective;
      return { ...resolved, plan, effective };
    }),
    payments: companyBillingProcedure.query(async ({ ctx }) => listPaymentsForCompany(ctx.accountId)),
    /** Aviso de vencimento + Pix para o administrador da empresa (e tela de bloqueio). */
    paymentReminder: companyBillingProcedure.query(async ({ ctx }) => {
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
        if (ctx.user.role === "promoter") throw new TRPCError18({ code: "FORBIDDEN", message: "Promotores n\xE3o podem consultar a lista da equipe." });
        return (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter" && member.active).map(({ id: id2, userName, role, active }) => ({ id: id2, userName, role, active }));
      })
    }),
    stores: router({
      list: commercialFeatureProcedure("fieldOperations").input(z13.object({ search: z13.string().optional() }).optional()).query(({ ctx, input }) => listOperationalStores(ctx.accountId, input?.search, scopeMemberId(ctx))),
      create: commercialFeatureProcedure("fieldOperations").input(z13.object({ name: z13.string().min(2), city: z13.string().min(2), address: z13.string().optional(), state: z13.string().length(2).optional(), cep: z13.string().optional(), code: z13.string().optional(), latitude: z13.number().optional(), longitude: z13.number().optional(), notes: z13.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError18({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem cadastrar lojas." });
        return createOperationalStore({ ...input, companyId: ctx.accountId, active: true }, ctx.memberAccountId ?? null);
      }),
      update: commercialFeatureProcedure("fieldOperations").input(z13.object({ id: z13.number().int().positive(), name: z13.string().trim().min(2).max(255).optional(), city: z13.string().trim().min(2).max(255).optional(), state: z13.string().trim().length(2).optional().or(z13.literal("")), address: z13.string().trim().max(500).optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError18({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem editar lojas." });
        const { id: id2, ...patch } = input;
        const ok = await updateOperationalStore(ctx.accountId, id2, { ...patch, state: patch.state === void 0 ? void 0 : patch.state ? patch.state.toUpperCase() : null });
        if (!ok) throw new TRPCError18({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
        await auditFromCtx(ctx, { action: "update", module: "stores", entityType: "store", entityId: id2, description: `Loja editada: ${patch.name ?? `#${id2}`}`, newData: patch });
        return { success: true };
      }),
      archive: companyAdminProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const store = await archiveOperationalStore(ctx.accountId, input.id);
        if (!store) throw new TRPCError18({ code: "NOT_FOUND", message: "Loja n\xE3o encontrada." });
        await auditFromCtx(ctx, { action: "delete", module: "stores", entityType: "store", entityId: input.id, description: `Loja removida da lista: ${store.name}` });
        return { success: true };
      })
    }),
    routes: router({
      list: commercialFeatureProcedure("fieldOperations").input(z13.object({ date: z13.string().optional(), promoterId: z13.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
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
      saveWeekly: companyAdminProcedure.input(z13.object({ id: z13.number().int().positive().optional(), name: z13.string().trim().min(2).max(255), weekday: z13.number().int().min(0).max(6), promoterId: z13.number().int().positive(), storeIds: z13.array(z13.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
        const members = await listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError18({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        try {
          const saved = await saveWeeklyRouteSchedule({ ...input, companyId: ctx.accountId });
          void auditFromCtx(ctx, { action: input.id ? "update" : "create", module: "routes", entityType: "weekly_route", entityId: saved?.id, entityLabel: input.name, description: `Roteiro semanal salvo: ${input.name} (${promoter.userName})`, newData: input });
          return saved;
        } catch (error) {
          if (error instanceof WeeklyRouteConflictError) throw new TRPCError18({ code: "CONFLICT", message: error.message });
          if (error?.message?.includes("n\xE3o pertencem") || error?.message?.includes("ao menos uma loja")) throw new TRPCError18({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      }),
      deleteWeekly: companyAdminProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const result = await deleteWeeklyRouteSchedule(ctx.accountId, input.id);
        if (!result.success) throw new TRPCError18({ code: "NOT_FOUND", message: "Roteiro n\xE3o encontrado." });
        void auditFromCtx(ctx, { action: "delete", module: "routes", entityType: "weekly_route", entityId: input.id, description: `Roteiro semanal exclu\xEDdo: #${input.id}` });
        return result;
      }),
      create: commercialFeatureProcedure("fieldOperations").input(z13.object({ name: z13.string().min(2), date: z13.string().min(8), promoterId: z13.number().int().positive(), storeIds: z13.array(z13.number().int().positive()).min(1), teamId: z13.number().int().positive().optional(), notes: z13.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError18({ code: "FORBIDDEN", message: "Promotores n\xE3o podem criar roteiros." });
        const members = await listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError18({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        const { storeIds, ...route } = input;
        return createOperationalRouteWithVisits({ route: { ...route, date: /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`), companyId: ctx.accountId, status: "assigned" }, storeIds });
      }),
      update: companyAdminProcedure.input(z13.object({ id: z13.number().int().positive(), name: z13.string().optional(), promoterId: z13.number().int().positive().optional(), date: z13.string().optional(), storeIds: z13.array(z13.number().int().positive()).optional() })).mutation(async ({ ctx, input }) => {
        const { id: id2, ...data } = input;
        if (data.promoterId) {
          const members = await listMemberAccounts(ctx.accountId);
          const promoter = members.find((member) => member.id === data.promoterId && member.role === "promoter" && member.active);
          if (!promoter) throw new TRPCError18({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        }
        try {
          return await updateOperationalRoute(ctx.accountId, id2, data);
        } catch (error) {
          if (error instanceof RouteValidationError) throw new TRPCError18({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      }),
      delete: companyAdminProcedure.input(z13.object({ id: z13.number().int().positive() })).mutation(async ({ ctx, input }) => {
        try {
          return await deleteOperationalRoute(ctx.accountId, input.id);
        } catch (error) {
          if (error instanceof RouteValidationError) throw new TRPCError18({ code: "BAD_REQUEST", message: error.message });
          throw error;
        }
      })
    }),
    visits: router({
      today: commercialFeatureProcedure("fieldOperations").input(z13.object({ date: z13.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional()).query(async ({ ctx, input }) => {
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
      list: commercialFeatureProcedure("fieldOperations").input(z13.object({ date: z13.string().optional(), routeId: z13.number().int().positive().optional(), promoterId: z13.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listOperationalVisits(ctx.accountId, { date: input?.date, routeId: input?.routeId, promoterId: scopeMemberId(ctx) ?? input?.promoterId })),
      /** Marcas "registrado offline" (horário do aparelho x recebimento) para os relatórios do gestor. */
      offlineMarks: commercialFeatureProcedure("fieldOperations").input(z13.object({ visitIds: z13.array(z13.number().int().positive()).max(500) })).query(({ ctx, input }) => listVisitOfflineMarks(ctx.accountId, input.visitIds)),
      start: commercialFeatureProcedure("visitCheckIn").input(z13.object({ id: z13.number().int().positive(), latitude: z13.number().optional(), longitude: z13.number().optional(), accuracy: z13.number().optional(), ...offlineVisitFields })).mutation(async ({ ctx, input }) => {
        const promoterId = scopeMemberId(ctx);
        if (input.clientId) {
          const prior = await findSubmission(ctx.accountId, input.clientId);
          if (prior) {
            if (prior.kind !== "visit_start" || prior.entityId !== input.id) throw new TRPCError18({ code: "CONFLICT", message: "Chave de envio j\xE1 usada em outro registro." });
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
        if (!owned) throw new TRPCError18({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        if (promoterId !== null && owned.visit.promoterId !== ctx.memberAccountId) throw new TRPCError18({ code: "FORBIDDEN", message: "Visita n\xE3o pertence ao promotor autenticado." });
        if (owned.visit.status !== "pending") return owned;
        if (promoterId != null) {
          const todayVisits = await listOperationalVisits(ctx.accountId, { promoterId, date: today });
          const openVisit = todayVisits.find((v) => v.visit.status === "in_progress" && v.visit.id !== input.id);
          if (openVisit) {
            const storeName = openVisit.store?.name || "a loja atual";
            throw new TRPCError18({
              code: "CONFLICT",
              message: `N\xE3o \xE9 poss\xEDvel fazer check-in em outra loja. Realize o check-out em "${storeName}" primeiro.`
            });
          }
        }
        const started = await updateOperationalVisit(ctx.accountId, input.id, { status: "in_progress", actualStart: when.effectiveTime, startLatitude: input.latitude, startLongitude: input.longitude, startAccuracy: input.accuracy });
        if (input.clientId) await recordSubmission({ companyId: ctx.accountId, memberAccountId: ctx.memberAccountId ?? null, clientId: input.clientId, kind: "visit_start", entityId: input.id, deviceTime: input.deviceTime ? new Date(input.deviceTime) : null, offline: when.offline, alert: when.clockAlert ?? when.timeNote });
        return started;
      }),
      complete: commercialFeatureProcedure("visitCheckIn").input(z13.object({ id: z13.number().int().positive(), latitude: z13.number().optional(), longitude: z13.number().optional(), accuracy: z13.number().optional(), notes: z13.string().optional(), ...offlineVisitFields })).mutation(async ({ ctx, input }) => {
        const [owned] = await listOperationalVisits(ctx.accountId, { id: input.id, promoterId: scopeMemberId(ctx) ?? void 0 });
        if (!owned) throw new TRPCError18({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        if (input.clientId) {
          const prior = await findSubmission(ctx.accountId, input.clientId);
          if (prior && (prior.kind !== "visit_complete" || prior.entityId !== input.id)) throw new TRPCError18({ code: "CONFLICT", message: "Chave de envio j\xE1 usada em outro registro." });
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
      async ({ ctx }) => (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter").map(({ id: id2, userName, email, active }) => ({ id: id2, userName, email, active }))
    ),
    reverseGeocodePoint: companyAdminFeatureProcedure("reports").input(z13.object({ latitude: z13.number().min(-90).max(90), longitude: z13.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
    promoterActivity: companyAdminFeatureProcedure("reports").input(z13.object({
      page: z13.number().int().positive().optional(),
      pageSize: z13.number().int().positive().max(100).optional(),
      from: z13.string().optional(),
      to: z13.string().optional(),
      promoterId: z13.number().int().positive().optional(),
      category: z13.string().optional(),
      search: z13.string().optional()
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
    promoterActivityExportCsv: companyAdminFeatureProcedure("reports").input(z13.object({
      from: z13.string().optional(),
      to: z13.string().optional(),
      promoterId: z13.number().int().positive().optional(),
      category: z13.string().optional(),
      search: z13.string().optional()
    }).optional()).mutation(async ({ ctx, input }) => {
      const result = await listPromoterActivities({ companyId: ctx.accountId, page: 1, pageSize: 1e4, ...input });
      const headers = ["Data/hora", "Promotor", "E-mail", "Atividade", "\xC1rea", "Registro", "Descri\xE7\xE3o", "Detalhes"];
      const values = result.items.map((row2) => [row2.occurredAt, row2.userName, row2.userEmail, row2.action, row2.module, row2.entityLabel, row2.description, typeof row2.details === "string" ? row2.details : JSON.stringify(row2.details ?? {})]);
      const cell2 = (value) => `"${neutralizeCsvFormula(value).replace(/"/g, '""')}"`;
      const csv = `\uFEFF${[headers, ...values].map((line) => line.map(cell2).join(";")).join("\r\n")}`;
      return { csv, contentType: "text/csv; charset=utf-8", filename: `atividades-promotores-${ctx.accountId}.csv` };
    }),
    list: companyAdminFeatureProcedure("reports").input(z13.object({
      page: z13.number().int().positive().optional(),
      pageSize: z13.number().int().positive().max(100).optional(),
      from: z13.string().optional(),
      to: z13.string().optional(),
      userId: z13.number().int().positive().optional(),
      module: z13.string().optional(),
      action: z13.string().optional(),
      entityType: z13.string().optional(),
      entityId: z13.number().int().positive().optional(),
      search: z13.string().optional()
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
    byId: companyAdminFeatureProcedure("reports").input(z13.object({ id: z13.number().int().positive() })).query(async ({ ctx, input }) => {
      const row2 = await getAuditLogById(input.id, ctx.accountId);
      if (!row2) throw new TRPCError18({ code: "NOT_FOUND", message: "Registro de auditoria n\xE3o encontrado." });
      return row2;
    }),
    entityHistory: commercialFeatureProcedure("reports").input(z13.object({
      entityType: z13.string().min(1),
      entityId: z13.number().int().positive(),
      page: z13.number().int().positive().optional(),
      pageSize: z13.number().int().positive().max(100).optional()
    })).query(async ({ ctx, input }) => listEntityAuditHistory({
      companyId: ctx.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      page: input.page,
      pageSize: input.pageSize
    })),
    exportCsv: companyAdminFeatureProcedure("reports").input(z13.object({
      from: z13.string().optional(),
      to: z13.string().optional(),
      userId: z13.number().int().positive().optional(),
      module: z13.string().optional(),
      action: z13.string().optional(),
      entityType: z13.string().optional(),
      entityId: z13.number().int().positive().optional(),
      search: z13.string().optional()
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
    platformList: platformProcedure.input(z13.object({
      companyId: z13.number().int().positive().optional(),
      page: z13.number().int().positive().optional(),
      pageSize: z13.number().int().positive().max(100).optional(),
      from: z13.string().optional(),
      to: z13.string().optional(),
      module: z13.string().optional(),
      action: z13.string().optional(),
      search: z13.string().optional()
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

// server/_core/context.ts
init_const();
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

// server/scheduleAuth.ts
import crypto2 from "node:crypto";
function timingSafeTokenEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || a.length === 0) return false;
  try {
    return crypto2.timingSafeEqual(Buffer.from(a), Buffer.from(b));
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

// server/scheduledMaintenance.ts
init_mediaKeys();
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
var MIN_TIME_AUDIT_RETENTION_DAYS = 7 * 365;
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
  const { and: and16, eq: eq17 } = await import("drizzle-orm");
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
      const admins = await database2.select({ email: memberAccounts3.email }).from(memberAccounts3).where(and16(eq17(memberAccounts3.companyId, m.companyId), eq17(memberAccounts3.role, "company_admin"), eq17(memberAccounts3.active, true)));
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

// server/vercel-entry.ts
init_uploadLimits();

// server/sentry.ts
import * as Sentry from "@sentry/node";
var SENSITIVE_KEYS = /^(password|senha|token|secret|authorization|cookie|credit.?card|cpf|cnpj|ssn)$/i;
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
var initialized = false;
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

// server/vercel-entry.ts
initServerSentry();
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
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(compression());
  app.use(express.json({ limit: MAX_BODY_SIZE }));
  app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));
  app.use((err, req, res, next) => {
    if (!isPayloadTooLargeError(err)) return next(err);
    const path2 = req.path.startsWith("/api/trpc/") ? req.path.slice("/api/trpc/".length) : void 0;
    res.status(413).json(payloadTooLargeBody(path2));
  });
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.all("/api/scheduled/database-maintenance", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      if (!isScheduleRequestAuthorized(req)) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
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
      return res.json({ ok: true, result, missingPunch, photos, clock });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  app.all("/api/scheduled/database-backup", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      if (!isScheduleRequestAuthorized(req)) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const mysql3 = (await import("mysql2/promise")).default;
      const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
      if (!url) return res.status(500).json({ error: "Database URL is not configured." });
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
        return res.json({ ok: true, backup, retention });
      } finally {
        await connection.end();
      }
    } catch (error) {
      console.error("[Backup] failed:", error);
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled backup failed" });
    }
  });
  app.all("/api/scheduled/archive-timesheets", async (req, res) => {
    if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    try {
      if (!isScheduleRequestAuthorized(req)) {
        return res.status(401).json({ error: "Schedule authentication required" });
      }
      const { runTimesheetArchiveJob: runTimesheetArchiveJob2 } = await Promise.resolve().then(() => (init_timesheetArchive(), timesheetArchive_exports));
      const archive = await runTimesheetArchiveJob2({ limitCompanies: 30 });
      return res.json({ ok: true, archive });
    } catch (error) {
      console.error("[Archive] failed:", error);
      return res.status(500).json({ error: "Timesheet archive failed" });
    }
  });
  app.post("/api/webhooks/asaas", express.json(), async (req, res) => {
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
  const distPath = path.resolve(process.cwd(), "dist", "public");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, {
      maxAge: "1y",
      immutable: true,
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
      }
    }));
    app.use("*", (_req, res) => res.sendFile(path.resolve(distPath, "index.html")));
  }
  app.use(sentryErrorHandler());
  return app;
}
var appPromise = null;
async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
