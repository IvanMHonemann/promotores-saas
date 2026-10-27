var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
    }, (table) => ({
      activeIdx: index("companies_active_idx").on(table.active),
      nameIdx: index("companies_name_idx").on(table.name),
      planIdx: index("companies_plan_idx").on(table.planId),
      subscriptionStatusIdx: index("companies_subscription_status_idx").on(table.subscriptionStatus)
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
    }, (table) => ({
      companyIdx: index("member_accounts_company_idx").on(table.companyId),
      companyRoleIdx: index("member_accounts_company_role_idx").on(table.companyId, table.role)
    }));
    memberSessions = mysqlTable("member_sessions", {
      id: int("id").autoincrement().primaryKey(),
      memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "cascade" }),
      tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => ({
      accountExpiryIdx: index("member_sessions_account_expiry_idx").on(table.memberAccountId, table.expiresAt)
    }));
    platformSessions = mysqlTable("platform_sessions", {
      id: int("id").autoincrement().primaryKey(),
      platformAdminId: int("platformAdminId").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
      tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => ({
      adminExpiryIdx: index("platform_sessions_admin_expiry_idx").on(table.platformAdminId, table.expiresAt)
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
    }, (table) => ({
      accountIdx: index("clients_account_idx").on(table.accountId),
      cityIdx: index("clients_account_city_idx").on(table.accountId, table.city)
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
    }, (table) => ({
      accountIdx: index("extinguishers_account_idx").on(table.accountId),
      clientIdx: index("extinguishers_client_idx").on(table.clientId),
      expirationIdx: index("extinguishers_account_expiration_idx").on(table.accountId, table.expirationDate),
      publicTokenIdx: index("extinguishers_public_token_idx").on(table.publicToken)
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
    }, (table) => ({
      accountIdx: index("service_orders_account_idx").on(table.accountId),
      clientIdx: index("service_orders_client_idx").on(table.clientId),
      dateIdx: index("service_orders_account_date_idx").on(table.accountId, table.orderDate),
      numberIdx: index("service_orders_account_number_idx").on(table.accountId, table.orderNumber)
    }));
    serviceOrderItems = mysqlTable("service_order_items", {
      id: int("id").autoincrement().primaryKey(),
      serviceOrderId: int("serviceOrderId").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
      description: varchar("description", { length: 255 }).notNull(),
      quantity: int("quantity").notNull().default(1),
      unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
      totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (table) => ({
      orderIdx: index("service_order_items_order_idx").on(table.serviceOrderId)
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
    }, (table) => ({
      accountExpiryIdx: index("trash_items_account_expiry_idx").on(table.accountId, table.expiresAt),
      accountDeletedIdx: index("trash_items_account_deleted_idx").on(table.accountId, table.deletedAt)
    }));
    systemSettings = mysqlTable("system_settings", {
      id: int("id").autoincrement().primaryKey(),
      accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "cascade" }),
      settingKey: varchar("settingKey", { length: 100 }).notNull(),
      settingValue: text("settingValue").notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      accountKeyUnique: uniqueIndex("system_settings_account_key_unique").on(table.accountId, table.settingKey),
      accountIdx: index("system_settings_account_idx").on(table.accountId)
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
    }, (table) => ({
      nameIdx: index("subscription_plans_name_idx").on(table.name),
      availableIdx: index("subscription_plans_available_idx").on(table.availableForNew, table.active)
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
    }, (table) => ({
      companyIdx: index("company_subscriptions_company_idx").on(table.companyId),
      planIdx: index("company_subscriptions_plan_idx").on(table.planId),
      statusIdx: index("company_subscriptions_status_idx").on(table.status),
      endsAtIdx: index("company_subscriptions_ends_at_idx").on(table.endsAt),
      asaasSubIdx: index("company_subscriptions_asaas_sub_idx").on(table.asaasSubscriptionId)
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
    }, (table) => ({
      companyIdx: index("payments_company_idx").on(table.companyId),
      subscriptionIdx: index("payments_subscription_idx").on(table.subscriptionId),
      asaasPaymentIdx: index("payments_asaas_payment_idx").on(table.asaasPaymentId),
      statusIdx: index("payments_status_idx").on(table.status)
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
    }, (table) => ({
      processedIdx: index("payment_events_processed_idx").on(table.processed)
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
    }, (table) => ({
      companyIdx: index("audit_logs_company_idx").on(table.companyId),
      companyCreatedIdx: index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
      userIdx: index("audit_logs_user_idx").on(table.userId),
      entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
      actionIdx: index("audit_logs_action_idx").on(table.action),
      moduleIdx: index("audit_logs_module_idx").on(table.module),
      createdIdx: index("audit_logs_created_idx").on(table.createdAt)
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
  visitPhotos: () => visitPhotos,
  visits: () => visits,
  weeklyRouteSchedules: () => weeklyRouteSchedules
});
import { boolean as boolean2, date as date2, decimal as decimal2, index as index2, int as int2, json, mysqlEnum as mysqlEnum2, mysqlTable as mysqlTable2, text as text2, timestamp as timestamp2, uniqueIndex as uniqueIndex2, varchar as varchar2, double } from "drizzle-orm/mysql-core";
var users2, companies2, platformAdmins2, memberAccounts2, promoterProfiles, memberSessions2, platformSessions2, clients2, brands, retailChains, stores, teams, routes, weeklyRouteSchedules, inventoryProducts, visits, timeEvents, timeCorrectionRequests, checklists, checklistQuestions, checklistResponses, evidences, auditLogs2, subscriptionPlans2, subscriptionPlanFeatures, companyFeatureOverrides, memberFeaturePermissions, companySubscriptions2, systemSettings2, storePhotos, visitPhotos;
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
    }, (table) => ({
      activeIdx: index2("companies_active_idx").on(table.active),
      nameIdx: index2("companies_name_idx").on(table.name),
      planIdx: index2("companies_plan_idx").on(table.planId),
      subscriptionStatusIdx: index2("companies_subscription_status_idx").on(table.subscriptionStatus)
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
    }, (table) => ({
      companyIdx: index2("member_accounts_company_idx").on(table.companyId),
      companyRoleIdx: index2("member_accounts_company_role_idx").on(table.companyId, table.role)
    }));
    promoterProfiles = mysqlTable2("promoter_profiles", {
      memberAccountId: int2("memberAccountId").primaryKey().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      employeeCode: varchar2("employeeCode", { length: 50 }),
      workStartTime: varchar2("workStartTime", { length: 5 }),
      workEndTime: varchar2("workEndTime", { length: 5 }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      companyIdx: index2("promoter_profiles_company_idx").on(table.companyId),
      companyEmployeeCodeUnique: uniqueIndex2("promoter_profiles_company_employee_code_unique").on(table.companyId, table.employeeCode)
    }));
    memberSessions2 = mysqlTable2("member_sessions", {
      id: int2("id").autoincrement().primaryKey(),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      tokenHash: varchar2("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table) => ({
      accountExpiryIdx: index2("member_sessions_account_expiry_idx").on(table.memberAccountId, table.expiresAt)
    }));
    platformSessions2 = mysqlTable2("platform_sessions", {
      id: int2("id").autoincrement().primaryKey(),
      platformAdminId: int2("platformAdminId").notNull().references(() => platformAdmins2.id, { onDelete: "cascade" }),
      tokenHash: varchar2("tokenHash", { length: 128 }).notNull().unique(),
      expiresAt: timestamp2("expiresAt").notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table) => ({
      adminExpiryIdx: index2("platform_sessions_admin_expiry_idx").on(table.platformAdminId, table.expiresAt)
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
    }, (table) => ({
      companyIdx: index2("clients_company_idx").on(table.companyId),
      nameIdx: index2("clients_company_name_idx").on(table.companyId, table.name)
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
    }, (table) => ({
      companyIdx: index2("brands_company_idx").on(table.companyId),
      clientIdx: index2("brands_client_idx").on(table.clientId)
    }));
    retailChains = mysqlTable2("retail_chains", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      name: varchar2("name", { length: 255 }).notNull(),
      notes: text2("notes"),
      active: boolean2("active").default(true).notNull(),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      companyIdx: index2("retail_chains_company_idx").on(table.companyId)
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
    }, (table) => ({
      companyIdx: index2("stores_company_idx").on(table.companyId),
      clientIdx: index2("stores_client_idx").on(table.clientId),
      cityIdx: index2("stores_company_city_idx").on(table.companyId, table.city),
      geoIdx: index2("stores_geo_idx").on(table.latitude, table.longitude)
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
    }, (table) => ({
      companyIdx: index2("teams_company_idx").on(table.companyId)
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
    }, (table) => ({
      companyIdx: index2("routes_company_idx").on(table.companyId),
      promoterDateIdx: index2("routes_promoter_date_idx").on(table.promoterId, table.date),
      dateIdx: index2("routes_company_date_idx").on(table.companyId, table.date),
      weeklyOccurrenceUnique: uniqueIndex2("routes_weekly_occurrence_unique").on(table.weeklyScheduleId, table.date)
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
    }, (table) => ({
      companyIdx: index2("weekly_route_schedules_company_idx").on(table.companyId),
      promoterDayUnique: uniqueIndex2("weekly_route_schedules_promoter_day_unique").on(table.companyId, table.promoterId, table.weekday)
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
      createdByMemberId: int2("createdByMemberId"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      companyIdx: index2("inventory_products_company_idx").on(table.companyId),
      codeIdx: index2("inventory_products_company_code_idx").on(table.companyId, table.productCode),
      expiryIdx: index2("inventory_products_expiration_idx").on(table.companyId, table.expirationDate)
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
    }, (table) => ({
      companyIdx: index2("visits_company_idx").on(table.companyId),
      routeIdx: index2("visits_route_idx").on(table.routeId),
      storeIdx: index2("visits_store_idx").on(table.storeId),
      promoterIdx: index2("visits_promoter_idx").on(table.promoterId),
      statusIdx: index2("visits_status_idx").on(table.companyId, table.status)
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
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table) => ({
      companyIdx: index2("time_events_company_idx").on(table.companyId),
      memberIdx: index2("time_events_member_idx").on(table.memberAccountId),
      memberTimeIdx: index2("time_events_member_time_idx").on(table.memberAccountId, table.serverTime),
      idempotencyIdx: uniqueIndex2("time_events_idempotency_unique").on(table.idempotencyKey)
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
      createdAt: timestamp2("createdAt").defaultNow().notNull()
    }, (table) => ({
      companyIdx: index2("time_corrections_company_idx").on(table.companyId),
      memberIdx: index2("time_corrections_member_idx").on(table.memberAccountId),
      statusIdx: index2("time_corrections_status_idx").on(table.companyId, table.status)
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
    }, (table) => ({
      companyIdx: index2("checklists_company_idx").on(table.companyId)
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
    }, (table) => ({
      checklistIdx: index2("checklist_questions_checklist_idx").on(table.checklistId)
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
    }, (table) => ({
      visitIdx: index2("checklist_responses_visit_idx").on(table.visitId),
      companyIdx: index2("checklist_responses_company_idx").on(table.companyId)
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
    }, (table) => ({
      companyIdx: index2("evidences_company_idx").on(table.companyId),
      visitIdx: index2("evidences_visit_idx").on(table.visitId)
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
    }, (table) => ({
      companyIdx: index2("audit_logs_company_idx").on(table.companyId),
      companyCreatedIdx: index2("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
      userIdx: index2("audit_logs_user_idx").on(table.userId),
      entityIdx: index2("audit_logs_entity_idx").on(table.entityType, table.entityId),
      actionIdx: index2("audit_logs_action_idx").on(table.action),
      moduleIdx: index2("audit_logs_module_idx").on(table.module),
      createdIdx: index2("audit_logs_created_idx").on(table.createdAt)
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
    }, (table) => ({
      nameIdx: index2("subscription_plans_name_idx").on(table.name),
      availableIdx: index2("subscription_plans_available_idx").on(table.availableForNew, table.active)
    }));
    subscriptionPlanFeatures = mysqlTable2("subscription_plan_features", {
      id: int2("id").autoincrement().primaryKey(),
      planId: int2("planId").notNull().references(() => subscriptionPlans2.id, { onDelete: "cascade" }),
      featureKey: varchar2("featureKey", { length: 64 }).notNull(),
      enabled: boolean2("enabled").notNull().default(false),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      planFeatureUnique: uniqueIndex2("subscription_plan_features_plan_feature_unique").on(table.planId, table.featureKey),
      planIdx: index2("subscription_plan_features_plan_idx").on(table.planId)
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
    }, (table) => ({
      companyFeatureUnique: uniqueIndex2("company_feature_overrides_company_feature_unique").on(table.companyId, table.featureKey),
      companyIdx: index2("company_feature_overrides_company_idx").on(table.companyId)
    }));
    memberFeaturePermissions = mysqlTable2("member_feature_permissions", {
      id: int2("id").autoincrement().primaryKey(),
      memberAccountId: int2("memberAccountId").notNull().references(() => memberAccounts2.id, { onDelete: "cascade" }),
      featureKey: varchar2("featureKey", { length: 64 }).notNull(),
      mode: mysqlEnum2("mode", ["allow", "deny"]).notNull(),
      updatedByMemberAccountId: int2("updatedByMemberAccountId").references(() => memberAccounts2.id, { onDelete: "set null" }),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      memberFeatureUnique: uniqueIndex2("member_feature_permissions_member_feature_unique").on(table.memberAccountId, table.featureKey),
      memberIdx: index2("member_feature_permissions_member_idx").on(table.memberAccountId)
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
    }, (table) => ({
      companyIdx: index2("company_subscriptions_company_idx").on(table.companyId)
    }));
    systemSettings2 = mysqlTable2("system_settings", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "cascade" }),
      settingKey: varchar2("settingKey", { length: 100 }).notNull(),
      settingValue: text2("settingValue").notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      accountKeyUnique: uniqueIndex2("system_settings_company_key_unique").on(table.companyId, table.settingKey),
      companyIdx: index2("system_settings_company_idx").on(table.companyId)
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
    }, (table) => ({
      companyStoreDateIdx: index2("store_photos_company_store_date_idx").on(table.companyId, table.storeId, table.capturedAt),
      companyPromoterIdx: index2("store_photos_company_promoter_idx").on(table.companyId, table.promoterId),
      expiresIdx: index2("store_photos_expires_idx").on(table.expiresAt),
      companyIdempotencyUnique: uniqueIndex2("store_photos_company_idempotency_unique").on(table.companyId, table.idempotencyKey)
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
    }, (table) => ({
      visitIdx: index2("visit_photos_visit_idx").on(table.visitId),
      expiresIdx: index2("visit_photos_expires_idx").on(table.expiresAt)
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
  const valid = await db.execute(sql`SELECT id FROM stores WHERE companyId = ${companyId} AND active = 1 AND id IN (${sql.join(unique.map((id2) => sql`${id2}`), sql`, `)})`);
  const validIds = (Array.isArray(valid?.[0]) ? valid[0] : Array.isArray(valid) ? valid : valid?.rows ?? []).map((r) => Number(r.id));
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
  const rows2 = Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [];
  return rows2.map((r) => Number(r.storeId));
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
var init_expiry = __esm({
  "shared/expiry.ts"() {
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
      "reports",
      "teamManagement",
      "backup",
      "offline"
    ];
    PLAN_FEATURES = {
      start: ["dashboard", "clients", "pointsOfSale", "alerts"],
      profissional: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "reports", "teamManagement"],
      empresarial: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "reports", "teamManagement", "backup", "offline"]
    };
    ALL_FEATURES = [...ENTITLEMENT_KEYS];
    SUPERVISOR_CEILING = [
      "dashboard",
      "clients",
      "pointsOfSale",
      "alerts",
      "timeTracking",
      "fieldOperations",
      "reports",
      "offline"
    ];
    PROMOTER_CEILING = ["dashboard", "timeTracking", "fieldOperations"];
    ROLE_FEATURE_CEILING = {
      company_admin: ALL_FEATURES,
      supervisor: SUPERVISOR_CEILING,
      promoter: PROMOTER_CEILING
    };
    ROLE_FEATURE_DEFAULTS = {
      company_admin: ALL_FEATURES,
      supervisor: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations"],
      promoter: ["dashboard", "timeTracking", "fieldOperations"]
    };
  }
});

// server/storage.ts
var storage_exports = {};
__export(storage_exports, {
  storageDelete: () => storageDelete,
  storageGet: () => storageGet,
  storageGetSignedUrl: () => storageGetSignedUrl,
  storagePut: () => storagePut,
  storageRead: () => storageRead
});
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: key, Body: body, ContentType: contentType }));
  const url = s3.publicBaseUrl ? `${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}` : await getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
  return { key, url };
}
async function storageGet(relKey) {
  const key = normalizeKey(relKey);
  return { key, url: await storageGetSignedUrl(key) };
}
async function storageGetSignedUrl(relKey) {
  const key = normalizeKey(relKey);
  const s3 = getS3Client();
  if (!s3) throw new Error("Storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.");
  if (s3.publicBaseUrl) return `${s3.publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
  return getSignedUrl(s3.client, new GetObjectCommand({ Bucket: s3.bucket, Key: key }), { expiresIn: 3600 });
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
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  applyMockCheckout: () => applyMockCheckout,
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
  ensureInventoryProductsSchema: () => ensureInventoryProductsSchema,
  ensureOwnerScopeColumns: () => ensureOwnerScopeColumns,
  ensureSeedPlans: () => ensureSeedPlans,
  ensureTrashTable: () => ensureTrashTable,
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
        maxIdle: 2
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
  const expiredPhotos = await database2.select().from(trashItems).where(and2(eq2(trashItems.itemType, "store_photo"), expiredWhere));
  if (expiredPhotos.length) {
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const item of expiredPhotos) await deletePhotoFiles(item.snapshot, storageDelete2);
  }
  return database2.delete(trashItems).where(expiredWhere);
}
async function deletePhotoFiles(snapshot, storageDelete2) {
  try {
    const photo = JSON.parse(snapshot);
    if (photo?.fileKey) await storageDelete2(photo.fileKey);
    if (photo?.thumbnailKey) await storageDelete2(photo.thumbnailKey);
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
      await tx.insert(inventoryProducts).values({ ...restoreDateFields(snapshot), id: item.originalId, companyId: tenant });
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
  if (item?.itemType === "store_photo") {
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    await deletePhotoFiles(item.snapshot, storageDelete2);
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
  const rows2 = ENTITLEMENT_KEYS.map((featureKey) => ({ planId, featureKey, enabled: enabled.has(featureKey) }));
  await database2.transaction(async (tx) => {
    await tx.delete(subscriptionPlanFeatures).where(eq2(subscriptionPlanFeatures.planId, planId));
    await tx.insert(subscriptionPlanFeatures).values(rows2);
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
    const rows2 = await database2.select({ featureKey: companyFeatureOverrides.featureKey, enabled: companyFeatureOverrides.enabled }).from(companyFeatureOverrides).where(eq2(companyFeatureOverrides.companyId, companyId));
    return Object.fromEntries(rows2.filter((row2) => ENTITLEMENT_KEYS.includes(row2.featureKey)).map((row2) => [row2.featureKey, Boolean(row2.enabled)]));
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
    const rows2 = await database2.select({ featureKey: memberFeaturePermissions.featureKey, mode: memberFeaturePermissions.mode }).from(memberFeaturePermissions).where(eq2(memberFeaturePermissions.memberAccountId, memberAccountId));
    return Object.fromEntries(rows2.filter((row2) => ENTITLEMENT_KEYS.includes(row2.featureKey)).map((row2) => [row2.featureKey, row2.mode]));
  } catch (error) {
    if (isMissingEntitlementsTable(error)) return {};
    throw error;
  }
}
async function replaceCompanyFeatureOverrides(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const rows2 = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const enabled = input.overrides[featureKey];
    return enabled == null ? [] : [{ companyId: input.companyId, featureKey, enabled, reason: input.reason ?? null, updatedByPlatformAdminId: input.updatedByPlatformAdminId }];
  });
  await database2.transaction(async (tx) => {
    await tx.delete(companyFeatureOverrides).where(eq2(companyFeatureOverrides.companyId, input.companyId));
    if (rows2.length) await tx.insert(companyFeatureOverrides).values(rows2);
  });
  return { success: true };
}
async function replaceMemberFeatureModes(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const rows2 = ENTITLEMENT_KEYS.flatMap((featureKey) => {
    const mode = input.modes[featureKey];
    return !mode || mode === "inherit" ? [] : [{ memberAccountId: input.memberAccountId, featureKey, mode, updatedByMemberAccountId: input.updatedByMemberAccountId }];
  });
  await database2.transaction(async (tx) => {
    await tx.delete(memberFeaturePermissions).where(eq2(memberFeaturePermissions.memberAccountId, input.memberAccountId));
    if (rows2.length) await tx.insert(memberFeaturePermissions).values(rows2);
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
  const rows2 = await db.select({
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
  return rows2;
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
  const rows2 = await db.select().from(companySubscriptions).where(eq2(companySubscriptions.id, id2)).limit(1);
  const sub = rows2[0];
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
  const rows2 = await database2.select().from(subscriptionPlans).where(eq2(subscriptionPlans.id, planId)).limit(1);
  return (await attachPlanFeatureKeys(database2, rows2))[0] ?? null;
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
  const rows2 = await db.select().from(companySubscriptions).where(eq2(companySubscriptions.companyId, companyId)).orderBy(desc(companySubscriptions.createdAt));
  if (!rows2.length) return null;
  const preferred = rows2.find(
    (r) => ["active", "trial", "test", "pending", "overdue"].includes(String(r.status))
  );
  return preferred ?? rows2[0];
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
  const rows2 = await db.select().from(paymentEvents).where(eq2(paymentEvents.eventId, eventId)).limit(1);
  return rows2[0] ?? null;
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
async function applyMockCheckout(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const planRows = await db.select().from(subscriptionPlans).where(eq2(subscriptionPlans.id, input.planId)).limit(1);
  const plan = planRows[0];
  if (!plan) throw new Error("Plano n\xE3o encontrado");
  const today = /* @__PURE__ */ new Date();
  const ymd = today.toISOString().slice(0, 10);
  const periodDays = plan.billingCycle === "yearly" ? 365 : 30;
  const periodEnd = new Date(today.getTime() + periodDays * 24 * 3600 * 1e3);
  const periodEndYmd = periodEnd.toISOString().slice(0, 10);
  const grace = new Date(periodEnd.getTime() + 3 * 24 * 3600 * 1e3);
  const statusMap = {
    approved: "active",
    pending: "pending",
    overdue: "overdue",
    canceled: "canceled"
  };
  const payStatusMap = {
    approved: "CONFIRMED",
    pending: "PENDING",
    overdue: "OVERDUE",
    canceled: "DELETED"
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
    notes: `Mock checkout: ${input.outcome}`
  });
  const subscriptionId = Number(subResult.insertId);
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
      bankSlipUrl: null
    });
    paymentId = Number(payResult.insertId) || 0;
  } catch (payErr) {
    console.warn("[mockCheckout] payment insert skipped:", payErr);
  }
  await db.update(companies).set({
    planId: input.planId,
    subscriptionStatus: subStatus,
    asaasCustomerId: `cus_mock_${input.companyId}`,
    asaasSubscriptionId: `sub_mock_${input.companyId}`,
    subscriptionStartedAt: today,
    subscriptionExpiresAt: periodEnd,
    gracePeriodEndsAt: grace
  }).where(eq2(companies.id, input.companyId));
  return { subscriptionId, paymentId, status: subStatus };
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
  const rows2 = await database2.select().from(stores).where(eq2(stores.id, storeId)).limit(1);
  return rows2[0];
}
async function listOperationalRoutes(companyId, options = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  const conditions = [eq2(routes.companyId, requireAccountId(companyId))];
  if (options.date) conditions.push(eq2(routes.date, options.date));
  if (options.promoterId) conditions.push(eq2(routes.promoterId, options.promoterId));
  return database2.select().from(routes).where(and2(...conditions)).orderBy(desc(routes.date), desc(routes.id));
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
async function saveWeeklyRouteSchedule(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await ensureWeeklyRouteSchedulesTable(database2);
  const companyId = requireAccountId(input.companyId);
  const storeIds = [...new Set(input.storeIds)].filter((id2) => Number.isInteger(id2) && id2 > 0);
  if (!storeIds.length) throw new Error("Selecione ao menos uma loja.");
  return database2.transaction(async (tx) => {
    const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(inArray(stores.id, storeIds), eq2(stores.companyId, companyId), eq2(stores.active, true)));
    if (stores2.length !== storeIds.length) throw new Error("Uma ou mais lojas n\xE3o pertencem a esta empresa.");
    await tx.insert(weeklyRouteSchedules).values({ ...input, companyId, storeIds, active: true }).onDuplicateKeyUpdate({ set: { name: input.name, storeIds, active: true } });
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const weekday = (/* @__PURE__ */ new Date(`${today}T00:00:00Z`)).getUTCDay();
    if (weekday === input.weekday) {
      const existing = await tx.select({ id: routes.id }).from(routes).where(and2(
        eq2(routes.companyId, companyId),
        eq2(routes.promoterId, input.promoterId),
        eq2(routes.date, today)
      ));
      for (const route of existing) {
        await tx.delete(visits).where(eq2(visits.routeId, route.id));
        await tx.delete(routes).where(eq2(routes.id, route.id));
      }
    }
    return (await tx.select().from(weeklyRouteSchedules).where(and2(
      eq2(weeklyRouteSchedules.companyId, companyId),
      eq2(weeklyRouteSchedules.promoterId, input.promoterId),
      eq2(weeklyRouteSchedules.weekday, input.weekday)
    )).limit(1))[0];
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
  for (const schedule of schedules) {
    try {
      await database2.transaction(async (tx) => {
        const existing = await tx.select({ id: routes.id }).from(routes).where(and2(
          eq2(routes.companyId, company),
          eq2(routes.promoterId, promoterId),
          eq2(routes.date, dateString)
        )).limit(1);
        if (existing.length) return;
        const storeIds = Array.isArray(schedule.storeIds) ? schedule.storeIds : [];
        if (!storeIds.length) return;
        const stores2 = await tx.select({ id: stores.id }).from(stores).where(and2(
          inArray(stores.id, storeIds),
          eq2(stores.companyId, company),
          eq2(stores.active, true)
        ));
        if (!stores2.length) return;
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
      if (error?.code !== "ER_DUP_ENTRY") throw error;
    }
  }
  return listOperationalRoutes(company, { date: dateString, promoterId });
}
async function createOperationalRoute(input) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.insert(routes).values(input);
  const rows2 = await database2.select().from(routes).where(eq2(routes.id, Number(result[0]?.insertId))).limit(1);
  return rows2[0];
}
async function updateOperationalRoute(companyId, routeId, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not available");
  const updates = {};
  if (data.name) updates.name = data.name;
  if (data.promoterId) updates.promoterId = data.promoterId;
  if (data.date) updates.date = data.date.slice(0, 10);
  if (Object.keys(updates).length) {
    await database2.update(routes).set(updates).where(and2(eq2(routes.id, routeId), eq2(routes.companyId, requireAccountId(companyId))));
  }
  if (data.promoterId) {
    await database2.update(visits).set({ promoterId: data.promoterId }).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, requireAccountId(companyId))));
  }
  if (data.storeIds && data.storeIds.length) {
    await database2.delete(visits).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, requireAccountId(companyId))));
    for (const storeId of data.storeIds) {
      await database2.insert(visits).values({ companyId: requireAccountId(companyId), routeId, storeId, promoterId: data.promoterId || 0, status: "pending" });
    }
  }
  return { success: true };
}
async function deleteOperationalRoute(companyId, routeId) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not available");
  await database2.delete(visits).where(and2(eq2(visits.routeId, routeId), eq2(visits.companyId, companyId)));
  await database2.delete(routes).where(and2(eq2(routes.id, routeId), eq2(routes.companyId, companyId)));
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
    await tx.insert(visits).values(stores2.map((store) => ({ companyId, routeId, storeId: store.id, promoterId: input.route.promoterId, status: "pending" })));
    const rows2 = await tx.select().from(routes).where(eq2(routes.id, routeId)).limit(1);
    return rows2[0];
  });
}
async function listOperationalVisits(companyId, options = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  const conditions = [eq2(visits.companyId, requireAccountId(companyId))];
  if (options.promoterId) conditions.push(eq2(visits.promoterId, options.promoterId));
  if (options.routeId) conditions.push(eq2(visits.routeId, options.routeId));
  if (options.date) conditions.push(eq2(routes.date, options.date));
  const rows2 = await database2.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq2(visits.storeId, stores.id)).innerJoin(routes, eq2(visits.routeId, routes.id)).where(and2(...conditions)).orderBy(visits.plannedStart, visits.id);
  return rows2;
}
async function updateOperationalVisit(companyId, id2, data) {
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  await database2.update(visits).set(data).where(and2(eq2(visits.id, id2), eq2(visits.companyId, requireAccountId(companyId))));
  const rows2 = await database2.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq2(visits.storeId, stores.id)).where(and2(eq2(visits.id, id2), eq2(visits.companyId, companyId))).limit(1);
  return rows2[0];
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
  if (search) conditions.push(or(like(inventoryProducts.productCode, `%${search}%`), like(inventoryProducts.description, `%${search}%`)));
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
    const rows2 = await tx.select().from(inventoryProducts).where(and2(inArray(inventoryProducts.id, uniqueIds), eq2(inventoryProducts.companyId, tenant)));
    if (rows2.length !== uniqueIds.length) throw new Error("Um ou mais produtos n\xE3o existem ou n\xE3o pertencem \xE0 sua empresa.");
    const expiresAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1e3);
    await tx.insert(trashItems).values(rows2.map((product) => ({ accountId: tenant, deletedByMemberId: actor?.memberId ?? null, deletedByName: actor?.name ?? null, ownerMemberId: product.createdByMemberId ?? null, itemType: "product", originalId: product.id, label: `${product.description} (${product.productCode})`.slice(0, 255), snapshot: JSON.stringify(product), expiresAt })));
    await tx.delete(inventoryProducts).where(and2(inArray(inventoryProducts.id, uniqueIds), eq2(inventoryProducts.companyId, tenant)));
    return { deleted: rows2.length };
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
var _db, _dbUrl, _pool, ownerScopeReady, ownerScopePromise, _trashTableReady, _inventoryReady;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema_original();
    init_schema();
    init_storeAccess();
    init_expiry();
    init_entitlements();
    init_schema();
    _db = null;
    _dbUrl = null;
    _pool = null;
    ownerScopeReady = false;
    ownerScopePromise = null;
    _trashTableReady = null;
    _inventoryReady = null;
  }
});

// server/subscriptionAccess.ts
var subscriptionAccess_exports = {};
__export(subscriptionAccess_exports, {
  checkSubscriptionAccess: () => checkSubscriptionAccess
});
function parseDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}
async function checkSubscriptionAccess(companyId) {
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
        const grace = graceUntil || new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1e3);
        if (now <= grace) {
          return { allowed: true, status: "overdue", expiresAt, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
        }
        return { allowed: false, status: "overdue", expiresAt, graceUntil: grace, reason: "Assinatura vencida." };
      }
      return { allowed: true, status: status2, expiresAt };
    case "pending":
      return { allowed: true, status: status2, expiresAt, reason: "Pagamento pendente." };
    case "overdue": {
      const grace = graceUntil || (expiresAt ? new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1e3) : null);
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
var init_subscriptionAccess = __esm({
  "server/subscriptionAccess.ts"() {
    "use strict";
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
import { TRPCError as TRPCError2 } from "@trpc/server";
async function getCompanyEntitlementBase(companyId) {
  const resolved = await resolveCompanyPlan(companyId);
  const plan = resolved.plan ?? null;
  const rawKeys = Array.isArray(plan?.featureKeys) ? plan.featureKeys.filter((key) => ENTITLEMENT_KEYS.includes(key)) : [];
  const companyOverrides = await getCompanyFeatureOverrides(companyId);
  const planSet = new Set(rawKeys);
  const companyFeatures = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, companyOverrides[key] ?? planSet.has(key)]));
  return {
    companyId,
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
var init_entitlements2 = __esm({
  "server/entitlements.ts"() {
    "use strict";
    init_db();
    init_entitlements();
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
  const pad = (n) => String(n).padStart(2, "0");
  if (raw.length <= 10) {
    return `${raw} ${endOfDay2 ? "23:59:59" : "00:00:00"}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
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
    const [rows2] = await pool.query(
      `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return {
      items: rows2 || [],
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
      const [rows2] = await pool.query(
        `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      return { items: rows2 || [], total, page, pageSize };
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
      const [rows3] = await pool.query(
        "SELECT * FROM `audit_logs` WHERE `id` = ? AND `companyId` = ? LIMIT 1",
        [id2, companyId]
      );
      return rows3[0] || null;
    }
    const [rows2] = await pool.query(
      "SELECT * FROM `audit_logs` WHERE `id` = ? LIMIT 1",
      [id2]
    );
    return rows2[0] || null;
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
    const s = v == null ? "" : String(v);
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
      CONCAT('Registro de ponto: ', CASE te.eventType WHEN 'clock_in' THEN 'entrada' WHEN 'break_start' THEN 'in\xEDcio de intervalo' WHEN 'break_end' THEN 'fim de intervalo' WHEN 'clock_out' THEN 'sa\xEDda' ELSE te.eventType END) AS description,
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
    const [rows2] = await pool.query(`SELECT activity.* ${tableSql} ORDER BY activity.occurredAt DESC, activity.activityId DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    return { items: rows2 || [], total, page, pageSize };
  } catch (err) {
    console.warn("[audit] promoter activity query failed", err);
    throw new TRPCError4({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel carregar as atividades dos promotores. Tente novamente em instantes." });
  }
}
var auditTableReady, SENSITIVE_KEY_RE;
var init_audit = __esm({
  "server/audit.ts"() {
    "use strict";
    init_db();
    auditTableReady = false;
    SENSITIVE_KEY_RE = /password|passwd|pwd|token|secret|cookie|authorization|recovery|hash|credit.?card|card.?number|cvv|cvc|ssn|api.?key/i;
  }
});

// server/missingPunch.ts
var missingPunch_exports = {};
__export(missingPunch_exports, {
  findMissingPunches: () => findMissingPunches
});
import { inArray as inArray3, sql as sql4 } from "drizzle-orm";
function local(d) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ2, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}` };
}
async function findMissingPunches(opts = {}) {
  const database2 = await getDb();
  if (!database2) return [];
  const since = new Date(Date.now() - 14 * 864e5);
  const filters = [sql4`te.serverTime >= ${since}`];
  if (opts.companyId) filters.push(sql4`te.companyId = ${opts.companyId}`);
  if (opts.memberId) filters.push(sql4`te.memberAccountId = ${opts.memberId}`);
  const where = sql4.join(filters, sql4` AND `);
  const [raw] = await database2.execute(sql4`
    SELECT te.id, te.companyId, te.memberAccountId, te.eventType, te.serverTime, te.deviceTime
    FROM time_events te
    JOIN (SELECT memberAccountId, MAX(id) AS maxId FROM time_events te WHERE ${where} GROUP BY memberAccountId) lastev ON lastev.maxId = te.id
    WHERE te.eventType <> 'clock_out'`);
  const open = raw.map((r) => ({ companyId: Number(r.companyId), memberAccountId: Number(r.memberAccountId), eventType: String(r.eventType), t: new Date(r.deviceTime || r.serverTime) }));
  if (!open.length) return [];
  const ids = open.map((o) => o.memberAccountId);
  const members = await database2.select({ id: memberAccounts2.id, companyId: memberAccounts2.companyId, name: memberAccounts2.userName, email: memberAccounts2.email, active: memberAccounts2.active }).from(memberAccounts2).where(inArray3(memberAccounts2.id, ids));
  const memberById = new Map(members.map((m) => [m.id, m]));
  const profiles = await database2.select({ id: promoterProfiles.memberAccountId, end: promoterProfiles.workEndTime }).from(promoterProfiles).where(inArray3(promoterProfiles.memberAccountId, ids));
  const endByMember = new Map(profiles.map((p) => [p.id, p.end]));
  const companyIds = [...new Set(open.map((o) => o.companyId))];
  const [settingRows] = await database2.execute(sql4`SELECT accountId, settingValue FROM system_settings WHERE settingKey = 'auto_clock_out_time' AND accountId IN (${sql4.join(companyIds.map((c) => sql4`${c}`), sql4`, `)})`);
  const limitByCompany = new Map(settingRows.map((r) => [Number(r.accountId), String(r.settingValue)]));
  const now = local(/* @__PURE__ */ new Date());
  const out = [];
  for (const e of open) {
    const member = memberById.get(e.memberAccountId);
    if (!member?.active || member.companyId !== e.companyId) continue;
    const lt3 = local(e.t);
    let reason = null;
    if (lt3.date < now.date) reason = "previous_day";
    else {
      const limit = endByMember.get(e.memberAccountId) || limitByCompany.get(e.companyId) || "";
      if (limit && now.hm >= limit) reason = "past_end_time";
    }
    if (!reason) continue;
    out.push({ memberId: e.memberAccountId, companyId: e.companyId, name: member.name, email: member.email, lastType: e.eventType, lastLabel: LABEL[e.eventType] ?? e.eventType, missing: NEXT[e.eventType] ?? "Sa\xEDda", lastTime: e.t.toISOString(), day: lt3.date, reason });
  }
  return out;
}
var TZ2, LABEL, NEXT;
var init_missingPunch = __esm({
  "server/missingPunch.ts"() {
    "use strict";
    init_db();
    init_schema();
    TZ2 = "America/Sao_Paulo";
    LABEL = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo" };
    NEXT = { clock_in: "Sa\xEDda (ou intervalo)", break_start: "Retorno do intervalo e Sa\xEDda", break_end: "Sa\xEDda" };
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
import { sql as sql6 } from "drizzle-orm";
function ensureStoreClientsSchema(db) {
  if (!ensured) {
    ensured = (async () => {
      await db.execute(sql6.raw(`CREATE TABLE IF NOT EXISTS store_clients (
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
      await db.execute(sql6.raw(`CREATE TABLE IF NOT EXISTS store_photos (
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
      const res = await db.execute(sql6`SELECT COUNT(*) AS n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_photos' AND COLUMN_NAME = 'storeClientId'`);
      const first = Array.isArray(res?.[0]) ? res[0][0] : Array.isArray(res) ? res[0] : res?.rows?.[0];
      if (Number(first?.n ?? 0) === 0) {
        await db.execute(sql6.raw(`ALTER TABLE store_photos ADD COLUMN storeClientId int NULL`));
        try {
          await db.execute(sql6.raw(`CREATE INDEX store_photos_client_idx ON store_photos (companyId, storeClientId)`));
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
  expireOldStorePhotos: () => expireOldStorePhotos,
  storePhotosRouter: () => storePhotosRouter
});
import { z as z4 } from "zod";
import { and as and6, desc as desc4, eq as eq6, gte as gte3, lte, sql as sql7 } from "drizzle-orm";
import { TRPCError as TRPCError8 } from "@trpc/server";
async function moveStorePhotosToTrash(db, accountId, photos, actor) {
  if (photos.length === 0) return;
  await ensureTrashTable();
  const storeIds = Array.from(new Set(photos.map((p) => p.storeId)));
  const storeRows = await db.select({ id: stores.id, name: stores.name }).from(stores).where(and6(eq6(stores.companyId, accountId), sql7`${stores.id} IN (${sql7.join(storeIds.map((id2) => sql7`${id2}`), sql7`, `)})`));
  const storeName = new Map(storeRows.map((r) => [r.id, r.name]));
  const clientOf = /* @__PURE__ */ new Map();
  try {
    await ensureStoreClientsSchema(db);
    const res = await db.execute(sql7`SELECT id, storeClientId FROM store_photos WHERE companyId = ${accountId} AND id IN (${sql7.join(photos.map((p) => sql7`${p.id}`), sql7`, `)})`);
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
    await tx.delete(storePhotos).where(and6(eq6(storePhotos.companyId, accountId), sql7`${storePhotos.id} IN (${sql7.join(photos.map((p) => sql7`${p.id}`), sql7`, `)})`));
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
  const res = await db.execute(sql7`SELECT id, active FROM store_clients WHERE id = ${storeClientId} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`);
  const r = (Array.isArray(res?.[0]) ? res[0] : Array.isArray(res) ? res : res?.rows ?? [])[0];
  if (!r) throw new TRPCError8({ code: "BAD_REQUEST", message: "Cliente n\xE3o encontrado nesta loja." });
  if (!r.active) throw new TRPCError8({ code: "BAD_REQUEST", message: "Este cliente foi removido da loja." });
}
async function linkPhotoToClient(db, companyId, photoId, storeClientId) {
  await db.execute(sql7`UPDATE store_photos SET storeClientId = ${storeClientId} WHERE id = ${photoId} AND companyId = ${companyId}`);
}
async function expireOldStorePhotos() {
  const db = await getDb();
  if (!db) return { deleted: 0, errors: 0 };
  const now = /* @__PURE__ */ new Date();
  const expired = await db.select().from(storePhotos).where(lte(storePhotos.expiresAt, now)).limit(200);
  if (expired.length === 0) return { deleted: 0, errors: 0 };
  const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
  let deleted = 0;
  let errors = 0;
  for (const photo of expired) {
    try {
      if (photo.fileKey) await storageDelete2(photo.fileKey);
      if (photo.thumbnailKey) await storageDelete2(photo.thumbnailKey);
      await db.delete(storePhotos).where(eq6(storePhotos.id, photo.id));
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
      listStoresWithStats: commercialFeatureProcedure("fieldOperations").input(z4.object({ search: z4.string().optional(), city: z4.string().optional() }).optional()).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq6(stores.companyId, ctx.accountId), eq6(stores.active, true)];
        if (memberId !== null) {
          await ensurePromoterStoreAssignmentsTable(db);
          conditions.push(storeVisibleToMember(stores.id, memberId));
        }
        const ownPhotos = memberId !== null ? sql7` AND store_photos.promoterId = ${memberId}` : sql7``;
        if (input?.search) {
          conditions.push(sql7`${stores.name} LIKE ${`%${input.search}%`}`);
        }
        if (input?.city) {
          conditions.push(eq6(stores.city, input.city));
        }
        try {
          const rows2 = await db.select({
            id: stores.id,
            name: stores.name,
            city: stores.city,
            state: stores.state,
            address: stores.address,
            photoCount: sql7`(SELECT COUNT(*) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId} AND store_photos.uploadStatus = 'uploaded'${ownPhotos})`,
            lastActivity: sql7`(SELECT MAX(capturedAt) FROM store_photos WHERE store_photos.storeId = stores.id AND store_photos.companyId = ${ctx.accountId}${ownPhotos})`
          }).from(stores).where(and6(...conditions)).orderBy(desc4(stores.updatedAt));
          return rows2;
        } catch (err) {
          if (String(err?.message || "").includes("store_photos") || err?.code === "ER_NO_SUCH_TABLE") {
            const rows2 = await db.select({ id: stores.id, name: stores.name, city: stores.city, state: stores.state, address: stores.address }).from(stores).where(and6(...conditions)).orderBy(desc4(stores.updatedAt));
            return rows2.map((r) => ({ ...r, photoCount: 0, lastActivity: null }));
          }
          throw err;
        }
      }),
      /** Lista fotos de uma loja, agrupáveis por data no cliente. */
      listByStore: commercialFeatureProcedure("fieldOperations").input(z4.object({
        storeId: z4.number().int().positive().optional().nullable(),
        from: z4.string().optional(),
        to: z4.string().optional(),
        promoterId: z4.number().int().positive().optional(),
        storeClientId: z4.number().int().positive().optional(),
        withoutClient: z4.boolean().optional()
      })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        const memberId = scopeMemberId(ctx);
        const conditions = [eq6(storePhotos.companyId, ctx.accountId)];
        if (input.storeId) {
          await assertStoreAccess(db, ctx, input.storeId);
          conditions.push(eq6(storePhotos.storeId, input.storeId));
        } else {
          conditions.push(sql7`store_photos.storeId IS NULL`);
        }
        if (input.storeClientId) conditions.push(sql7`store_photos.storeClientId = ${input.storeClientId}`);
        else if (input.withoutClient) conditions.push(sql7`store_photos.storeClientId IS NULL`);
        if (memberId !== null) conditions.push(eq6(storePhotos.promoterId, memberId));
        if (input.from) conditions.push(gte3(storePhotos.capturedAt, new Date(input.from)));
        if (input.to) conditions.push(lte(storePhotos.capturedAt, new Date(input.to)));
        if (memberId === null && input.promoterId) conditions.push(eq6(storePhotos.promoterId, input.promoterId));
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
          storeClientId: sql7`store_photos.storeClientId`,
          clientName: sql7`(SELECT name FROM store_clients WHERE store_clients.id = store_photos.storeClientId AND store_clients.companyId = ${ctx.accountId})`,
          promoterName: sql7`(SELECT userName FROM member_accounts WHERE member_accounts.id = store_photos.promoterId AND member_accounts.companyId = ${ctx.accountId})`
        }).from(storePhotos).where(and6(...conditions)).orderBy(desc4(storePhotos.capturedAt));
        return photos;
      }),
      /** Cria registro de foto com idempotência. Upload do arquivo é feito separadamente. */
      create: commercialFeatureProcedure("fieldOperations").input(z4.object({
        storeId: z4.number().int().positive().optional().nullable(),
        visitId: z4.number().int().positive().optional(),
        capturedAt: z4.string(),
        latitude: z4.number().optional(),
        longitude: z4.number().optional(),
        accuracy: z4.number().optional(),
        locationStatus: z4.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        fileKey: z4.string().min(1),
        thumbnailKey: z4.string().optional(),
        mimeType: z4.string().optional(),
        fileSize: z4.number().int().optional(),
        storeClientId: z4.number().int().positive().optional(),
        idempotencyKey: z4.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError8({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError8({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and6(eq6(storePhotos.companyId, ctx.accountId), eq6(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
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
      uploadAndCreate: commercialFeatureProcedure("fieldOperations").input(z4.object({
        storeId: z4.number().int().positive().optional().nullable(),
        visitId: z4.number().int().positive().optional(),
        capturedAt: z4.string(),
        latitude: z4.number().optional(),
        longitude: z4.number().optional(),
        accuracy: z4.number().optional(),
        locationStatus: z4.enum(["success", "permission_denied", "unavailable", "timeout", "error"]).optional(),
        imageBase64: z4.string().min(100),
        mimeType: z4.string().default("image/jpeg"),
        storeClientId: z4.number().int().positive().optional(),
        idempotencyKey: z4.string().min(8).max(64)
      })).mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(`${ctx.accountId}:${ip}`, "upload");
        if (!limit.ok) {
          throw new TRPCError8({ code: "TOO_MANY_REQUESTS", message: "Muitos uploads. Aguarde um minuto." });
        }
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        let storeName = "Sem loja vinculada";
        if (input.storeId) {
          const store = await assertStoreAccess(db, ctx, input.storeId);
          storeName = store.name;
          if (input.storeClientId) await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
        } else if (input.storeClientId) {
          throw new TRPCError8({ code: "BAD_REQUEST", message: "Cliente s\xF3 pode ser vinculado quando h\xE1 loja selecionada." });
        }
        const [existing] = await db.select().from(storePhotos).where(and6(eq6(storePhotos.companyId, ctx.accountId), eq6(storePhotos.idempotencyKey, input.idempotencyKey))).limit(1);
        if (existing) return { id: existing.id, alreadyExists: true };
        const { storagePut: storagePut2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const buffer = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : "jpg";
        const relKey = `store-photos/${ctx.accountId}/${input.storeId}/${input.idempotencyKey}.${ext}`;
        let fileKey;
        try {
          const uploaded = await storagePut2(relKey, buffer, input.mimeType);
          fileKey = uploaded.key;
        } catch (err) {
          throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Falha ao salvar a imagem. Verifique a configura\xE7\xE3o de armazenamento." });
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
      getImageUrl: commercialFeatureProcedure("fieldOperations").input(z4.object({ photoId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and6(eq6(storePhotos.id, input.photoId), eq6(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError8({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        const { storageGetSignedUrl: storageGetSignedUrl2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        const url = await storageGetSignedUrl2(photo.fileKey);
        return { url, expiresIn: 3600 };
      }),
      /** Retorna a imagem como base64 para compartilhamento sem CORS. */
      getImageData: commercialFeatureProcedure("fieldOperations").input(z4.object({ photoId: z4.number().int().positive() })).query(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and6(eq6(storePhotos.id, input.photoId), eq6(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError8({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        assertPhotoAccess(ctx, photo);
        const { storageRead: storageRead2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
        try {
          const image = await storageRead2(photo.fileKey);
          return { base64: image.data.toString("base64"), mime: image.contentType || photo.mimeType || "image/jpeg" };
        } catch {
          throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel obter a imagem armazenada." });
        }
      }),
      /** Exclui uma foto (com auditoria). */
      delete: commercialFeatureProcedure("fieldOperations").input(z4.object({ photoId: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const [photo] = await db.select().from(storePhotos).where(and6(eq6(storePhotos.id, input.photoId), eq6(storePhotos.companyId, ctx.accountId))).limit(1);
        if (!photo) throw new TRPCError8({ code: "NOT_FOUND", message: "Foto n\xE3o encontrada." });
        if (scopeMemberId(ctx) !== null && photo.promoterId !== ctx.memberAccountId) {
          throw new TRPCError8({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        }
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, [photo], { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.delete] falha ao enviar para a lixeira", error);
          throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar a foto para a lixeira." });
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
      bulkDelete: commercialFeatureProcedure("fieldOperations").input(z4.object({ photoIds: z4.array(z4.number().int().positive()).min(1).max(100) })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const photos = await db.select().from(storePhotos).where(and6(eq6(storePhotos.companyId, ctx.accountId), sql7`${storePhotos.id} IN (${sql7.join(input.photoIds.map((id2) => sql7`${id2}`), sql7`, `)})`));
        if (photos.length === 0) return { deleted: 0 };
        const memberId = scopeMemberId(ctx);
        const allowed = photos.filter((photo) => memberId === null || photo.promoterId === memberId);
        if (allowed.length === 0) throw new TRPCError8({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode excluir suas pr\xF3prias fotos." });
        try {
          await moveStorePhotosToTrash(db, ctx.accountId, allowed, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
        } catch (error) {
          console.error("[storePhotos.bulkDelete] falha ao enviar para a lixeira", error);
          throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel enviar as fotos para a lixeira." });
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
      assignClient: commercialFeatureProcedure("fieldOperations").input(z4.object({
        storeId: z4.number().int().positive().optional().nullable(),
        photoIds: z4.array(z4.number().int().positive()).min(1).max(200),
        storeClientId: z4.number().int().positive().nullable()
      })).mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError8({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
        const store = input.storeId != null ? await assertStoreAccess(db, ctx, input.storeId) : null;
        await ensureStorePhotosTable(db);
        await ensureStoreClientsSchema(db);
        let clientName = "Sem cliente";
        if (input.storeClientId && input.storeId != null) {
          await assertStoreClient(db, ctx.accountId, input.storeId, input.storeClientId);
          const res2 = await db.execute(sql7`SELECT name FROM store_clients WHERE id = ${input.storeClientId} AND companyId = ${ctx.accountId} LIMIT 1`);
          clientName = (Array.isArray(res2?.[0]) ? res2[0] : Array.isArray(res2) ? res2 : res2?.rows ?? [])[0]?.name ?? clientName;
        }
        const memberId = scopeMemberId(ctx);
        const owner = memberId !== null ? sql7` AND promoterId = ${memberId}` : sql7``;
        const ids = sql7.join(input.photoIds.map((id2) => sql7`${id2}`), sql7`, `);
        const res = await db.execute(sql7`UPDATE store_photos SET storeClientId = ${input.storeClientId} WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND id IN (${ids})${owner}`);
        const moved = Number((Array.isArray(res) ? res[0] : res)?.affectedRows ?? 0);
        if (moved === 0) throw new TRPCError8({ code: "FORBIDDEN", message: "Nenhuma das fotos selecionadas p\xF4de ser movida (s\xF3 \xE9 poss\xEDvel mover as suas pr\xF3prias fotos desta loja)." });
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

// server/email.ts
var email_exports = {};
__export(email_exports, {
  emailAccountCreated: () => emailAccountCreated,
  emailAdminNewCompany: () => emailAdminNewCompany,
  emailAdminPlanChanged: () => emailAdminPlanChanged,
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
function dataTable(rows2) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 20px;">${rows2.map(([l, v]) => row(l, v)).join("")}</table>`;
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
  const rows2 = [
    ["Empresa", input.companyName],
    ["Respons\xE1vel", input.userName],
    ["E-mail de acesso", input.email]
  ];
  if (input.password) rows2.push(["Senha", input.password]);
  rows2.push(["C\xF3digo de redefini\xE7\xE3o", input.recoveryCode]);
  rows2.push(["Plano", planLine]);
  const html = layout(
    "Sua conta GondUp foi criada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Sua conta foi criada com sucesso. Guarde estes dados em local seguro.</p>
    ${dataTable(rows2)}
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
async function emailPlanChanged(input) {
  const title = input.isUpgrade ? "Upgrade de plano confirmado" : "Plano adquirido";
  const rows2 = [
    ["Empresa", input.companyName],
    ["Plano", input.planName],
    ["Status", input.status]
  ];
  if (input.amount) rows2.push(["Valor", `R$ ${input.amount}`]);
  if (input.periodEnd) rows2.push(["V\xE1lido at\xE9", input.periodEnd]);
  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Registramos a altera\xE7\xE3o do plano da sua empresa.</p>
    ${dataTable(rows2)}
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

// shared/barcode.ts
function barcodeVariants(code) {
  const d = onlyDigits(code);
  if (!d) return [];
  const set = /* @__PURE__ */ new Set([d]);
  const stripped = d.replace(/^0+/, "");
  for (const len of [8, 12, 13, 14]) if (stripped.length <= len) set.add(stripped.padStart(len, "0"));
  return [...set].filter((v) => v.length >= 8);
}
var onlyDigits;
var init_barcode = __esm({
  "shared/barcode.ts"() {
    "use strict";
    onlyDigits = (code) => String(code ?? "").replace(/\D/g, "");
  }
});

// server/productLookup.ts
var productLookup_exports = {};
__export(productLookup_exports, {
  lookupProductByCode: () => lookupProductByCode
});
import { and as and8, desc as desc5, eq as eq9, inArray as inArray5 } from "drizzle-orm";
async function fetchJson(url, init = {}, ms = 4e3) {
  const ctl = new AbortController();
  const t2 = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": "PromotoresSaaS/1.0 (consulta de codigo de barras)", Accept: "application/json", ...init.headers || {} } });
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
    const rows2 = await database2.select({ description: inventoryProducts.description, price: inventoryProducts.price, productCode: inventoryProducts.productCode }).from(inventoryProducts).where(and8(eq9(inventoryProducts.companyId, companyId), inArray5(inventoryProducts.productCode, codes))).orderBy(desc5(inventoryProducts.id)).limit(1);
    if (rows2[0]) return { found: true, source: "company", description: rows2[0].description, price: String(rows2[0].price), code: rows2[0].productCode };
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

// server/backup.ts
var backup_exports = {};
__export(backup_exports, {
  ensureBackupProgressTable: () => ensureBackupProgressTable,
  runBackupStep: () => runBackupStep
});
import crypto2 from "node:crypto";
import zlib from "node:zlib";
import { promisify } from "node:util";
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
async function runBackupStep(c, opts) {
  const started = Date.now();
  const storagePut2 = opts.put ?? storagePut;
  const day = opts.day ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const prefix = `backups/database/${day}`;
  await ensureBackupProgressTable(c);
  const [tableRows] = await c.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const tables = tableRows.map((r) => String(Object.values(r)[0])).filter((n) => !SKIP_TABLES.has(n)).sort();
  let bytes = 0, partsWritten = 0;
  const [marker] = await c.query("SELECT 1 FROM backup_progress WHERE day = ? AND tableName = '_manifest' AND done = 1", [day]);
  if (marker.length) return { day, complete: true, skipped: true, tables: tables.length, tablesDone: tables.length, partsWritten: 0, bytes: 0, manifestKey: null };
  const [doneRows] = await c.query("SELECT tableName FROM backup_progress WHERE day = ? AND done = 1", [day]);
  const done = new Set(doneRows.map((r) => r.tableName));
  for (const table of tables) {
    if (done.has(table)) continue;
    const [progRows] = await c.query("SELECT * FROM backup_progress WHERE day = ? AND tableName = ?", [day, table]);
    const prog = progRows[0];
    let part = prog?.part ?? 0, rowsDone = prog?.rowsDone ?? 0, cursor = prog?.cursorValue ?? null;
    const files = prog?.files ? JSON.parse(prog.files) : [];
    const [keys] = await c.query(`SHOW KEYS FROM \`${table}\` WHERE Key_name = 'PRIMARY'`);
    const pk = keys.length === 1 ? keys[0].Column_name : null;
    let finished = false;
    while (Date.now() - started < opts.budgetMs) {
      const [rows2] = pk ? await c.query(`SELECT * FROM \`${table}\` ${cursor != null ? `WHERE \`${pk}\` > ?` : ""} ORDER BY \`${pk}\` LIMIT ${CHUNK_ROWS}`, cursor != null ? [cursor] : []) : await c.query(`SELECT * FROM \`${table}\` ORDER BY 1 LIMIT ${CHUNK_ROWS} OFFSET ${rowsDone}`);
      if (!rows2.length) {
        finished = true;
        break;
      }
      const body = await gzip(Buffer.from(rows2.map((r) => JSON.stringify(r, jsonReplacer)).join("\n") + "\n"));
      const key = `${prefix}/${table}.${String(part).padStart(5, "0")}.jsonl.gz`;
      await storagePut2(key, body, "application/gzip");
      files.push({ key, rows: rows2.length, sha256: crypto2.createHash("sha256").update(body).digest("hex") });
      bytes += body.length;
      partsWritten += 1;
      part += 1;
      rowsDone += rows2.length;
      if (pk) cursor = String(rows2[rows2.length - 1][pk]);
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,0,?)
         ON DUPLICATE KEY UPDATE cursorValue = VALUES(cursorValue), part = VALUES(part), rowsDone = VALUES(rowsDone), files = VALUES(files)`,
        [day, table, cursor, part, rowsDone, JSON.stringify(files)]
      );
      if (rows2.length < CHUNK_ROWS) {
        finished = true;
        break;
      }
    }
    if (finished) {
      await c.query(
        `INSERT INTO backup_progress (day, tableName, cursorValue, part, rowsDone, done, files) VALUES (?,?,?,?,?,1,?)
         ON DUPLICATE KEY UPDATE done = 1, files = VALUES(files), rowsDone = VALUES(rowsDone), part = VALUES(part)`,
        [day, table, cursor, part, rowsDone, JSON.stringify(files)]
      );
      done.add(table);
    } else break;
  }
  const complete = tables.every((t2) => done.has(t2));
  let manifestKey = null;
  if (complete) {
    const [all] = await c.query("SELECT tableName, rowsDone, files FROM backup_progress WHERE day = ? AND tableName <> '_manifest' ORDER BY tableName", [day]);
    const ddl = [];
    for (const t2 of tables) {
      const [d] = await c.query(`SHOW CREATE TABLE \`${t2}\``);
      ddl.push(`${d[0]["Create Table"]};`);
    }
    const schema = await gzip(Buffer.from(ddl.join("\n\n")));
    await storagePut2(`${prefix}/_schema.sql.gz`, schema, "application/gzip");
    const manifest = { format: 2, day, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), tables: all.map((r) => ({ name: r.tableName, rows: r.rowsDone, files: JSON.parse(r.files || "[]") })) };
    const stored = await storagePut2(`${prefix}/_manifest.json`, Buffer.from(JSON.stringify(manifest)), "application/json");
    manifestKey = stored.key;
    await c.query("INSERT INTO backup_progress (day, tableName, done) VALUES (?, '_manifest', 1) ON DUPLICATE KEY UPDATE done = 1", [day]);
  }
  return { day, complete, tables: tables.length, tablesDone: done.size, partsWritten, bytes, manifestKey };
}
var gzip, CHUNK_ROWS, SKIP_TABLES, jsonReplacer;
var init_backup = __esm({
  "server/backup.ts"() {
    "use strict";
    init_storage();
    gzip = promisify(zlib.gzip);
    CHUNK_ROWS = Number(process.env.BACKUP_CHUNK_ROWS || 5e3);
    SKIP_TABLES = /* @__PURE__ */ new Set(["__drizzle_migrations", "member_sessions", "platform_sessions", "backup_progress"]);
    jsonReplacer = (_k, v) => typeof v === "bigint" ? v.toString() : v;
  }
});

// server/vercel-entry.ts
import express from "express";
import compression from "compression";
import fs from "fs";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
init_const();

// server/modules/timeTracking.ts
init_trpc();
init_db();
init_schema();
init_audit();
import { z as z2 } from "zod";
import { TRPCError as TRPCError6 } from "@trpc/server";
import { eq as eq4, and as and4, desc as desc2, gte as gte2, lt as lt2 } from "drizzle-orm";

// server/modules/timesheetMirror.ts
init_trpc();
init_db();
init_schema();
init_audit();
import { z } from "zod";
import { TRPCError as TRPCError5 } from "@trpc/server";
import { and as and3, eq as eq3, gte, lt, inArray as inArray2, sql as sql3 } from "drizzle-orm";

// shared/timesheetMirror.ts
var MARK_LABEL = { clock_in: "Entrada", break_start: "In\xEDcio do intervalo", break_end: "Retorno do intervalo", clock_out: "Sa\xEDda" };
var DAY = 864e5;
function localParts(iso, timeZone) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const v = Object.fromEntries(f.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return { date: `${v.year}-${v.month}-${v.day}`, time: `${v.hour}:${v.minute}:${v.second}`, hm: `${v.hour}:${v.minute}`, minutesOfDay: Number(v.hour) * 60 + Number(v.minute) };
}
var dayNum = (d) => {
  const [y, m, dd] = d.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, dd) / DAY);
};
var weekdayOf = (d) => new Date(dayNum(d) * DAY).getUTCDay();
var addDay = (d, n) => new Date((dayNum(d) + n) * DAY).toISOString().slice(0, 10);
var toMin = (hm2) => {
  const [h, m] = hm2.split(":").map(Number);
  return h * 60 + m;
};
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
  const events = [...input.events].sort((a, b) => a.time.localeCompare(b.time) || a.id - b.id);
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
  const days = [];
  for (let d = input.from; d <= input.to; d = addDay(d, 1)) {
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
          if (openIn == null) issues.push("In\xEDcio de intervalo sem entrada");
          else {
            worked += (t2 - openIn) / 6e4;
            if (night) nightMin += nightOverlap(openIn, t2, tz, night.s, night.e);
            openIn = null;
          }
          openBreak = t2;
        } else if (ev.type === "break_end") {
          if (openBreak == null) issues.push("Retorno de intervalo sem in\xEDcio");
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
      if (openIn != null || openBreak != null) issues.push("Jornada incompleta: falta marca\xE7\xE3o de sa\xEDda ou retorno");
    }
    if (marks.some((m) => !m.synced)) issues.push("Marca\xE7\xE3o com sincroniza\xE7\xE3o pendente");
    if (marks.some((m) => m.kind === "automatic")) issues.push("Sa\xEDda autom\xE1tica do sistema (n\xE3o marcada pelo funcion\xE1rio)");
    if (marks.some((m) => m.kind === "legacy_adjusted")) issues.push("Ajuste antigo sem registro estruturado do valor original (ver observa\xE7\xF5es da marca\xE7\xE3o)");
    const isWorkday = workdays ? workdays.has(weekdayOf(d)) : null;
    if (!marks.length && isWorkday) issues.push("Sem marca\xE7\xF5es em dia previsto \u2014 verificar falta, abono ou justificativa (n\xE3o informados)");
    const expected = daily != null && isWorkday ? daily : daily != null && !workdays ? null : null;
    const w = Math.round(worked);
    const hasMarks = marks.length > 0;
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
      issues
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
    // Hora noturna reduzida (CLT art. 73 §1º): 52min30s = 1h → minutos noturnos × 60/52,5
    nightReducedMinutes: night ? Math.round(sum((x) => x.nightMinutes) * 60 / 52.5) : null,
    incompleteDays: marked.filter((x) => x.issues.some((i) => i.startsWith("Jornada incompleta") || i.includes("sem entrada") || i.includes("sem sa\xEDda") || i.includes("sem in\xEDcio"))).length,
    adjustedMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "adjusted" || m.kind === "legacy_adjusted").length, 0),
    automaticMarks: marked.reduce((a, x) => a + x.marks.filter((m) => m.kind === "automatic").length, 0),
    pendingSyncMarks: marked.reduce((a, x) => a + x.marks.filter((m) => !m.synced).length, 0),
    daysWithoutMarksOnWorkday: workdays ? days.filter((x) => !x.marks.length && workdays.has(x.weekday)).length : null
  };
  if (!daily) notes.push("Jornada contratada n\xE3o configurada para este funcion\xE1rio: horas previstas, diferen\xE7as e horas extras n\xE3o foram calculadas.");
  if (!workdays) notes.push("Dias de trabalho da semana n\xE3o configurados: faltas e dias previstos n\xE3o foram apurados.");
  if (!night) notes.push("Adicional noturno e hora reduzida n\xE3o configurados: n\xE3o calculados.");
  notes.push("Banco de horas, feriados, compensa\xE7\xF5es, abonos e toler\xE2ncia (CLT art. 58 \xA71\xBA) dependem de regras/conven\xE7\xE3o n\xE3o cadastradas e n\xE3o foram aplicados.");
  return { from: input.from, to: input.to, timeZone: tz, days, totals, notes };
}

// server/modules/timesheetMirror.ts
var TZ = "America/Sao_Paulo";
var dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
var adjustmentsReady = null;
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
  await database2.execute(sql3`INSERT INTO time_event_adjustments
    (companyId, timeEventId, correctionRequestId, memberAccountId, originalType, originalTime, correctedType, correctedTime, justification, reviewedByMemberId, reviewedByName)
    VALUES (${a.companyId}, ${a.timeEventId}, ${a.correctionRequestId}, ${a.memberAccountId}, ${a.originalType}, ${a.originalTime}, ${a.correctedType}, ${a.correctedTime}, ${a.justification}, ${a.reviewedByMemberId ?? null}, ${a.reviewedByName ?? null})`);
}
var legalSchema = z.object({
  legalName: z.string().trim().max(200).optional().default(""),
  document: z.string().trim().max(32).optional().default(""),
  // CNPJ/CPF do empregador
  establishment: z.string().trim().max(200).optional().default(""),
  address: z.string().trim().max(300).optional().default("")
});
var laborSchema = z.object({
  jobTitle: z.string().trim().max(120).nullish(),
  admissionDate: dateStr.nullish(),
  cpf: z.string().trim().max(14).nullish(),
  dailyMinutes: z.number().int().min(0).max(1440).nullish(),
  intervalMinutes: z.number().int().min(0).max(600).nullish(),
  workdays: z.array(z.number().int().min(0).max(6)).max(7).nullish(),
  nightEnabled: z.boolean().optional(),
  nightStart: hm.optional(),
  nightEnd: hm.optional()
});
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
  if (!database2) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  const where = [eq3(memberAccounts2.companyId, companyId)];
  if (memberIds?.length) where.push(inArray2(memberAccounts2.id, memberIds));
  const rows2 = await database2.select({ id: memberAccounts2.id, name: memberAccounts2.userName, role: memberAccounts2.role, active: memberAccounts2.active, employeeCode: promoterProfiles.employeeCode }).from(memberAccounts2).leftJoin(promoterProfiles, eq3(promoterProfiles.memberAccountId, memberAccounts2.id)).where(and3(...where));
  return rows2.filter((r) => r.role !== "company_admin");
}
var timesheetMirrorRouter = router({
  /** Promotores da empresa + perfil trabalhista configurado (ou null). */
  promoters: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const members = await companyMembers(ctx.accountId);
    const out = [];
    for (const m of members) out.push({ ...m, labor: await readJson(`labor_profile:${m.id}`, ctx.accountId) });
    return out;
  }),
  getCompanyProfile: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const database2 = await getDb();
    const company = database2 ? (await database2.select({ name: companies2.name }).from(companies2).where(eq3(companies2.id, ctx.accountId)).limit(1))[0] : null;
    const legal = await readJson("company_legal_profile", ctx.accountId);
    return { name: company?.name ?? "", legal: legal ?? { legalName: "", document: "", establishment: "", address: "" } };
  }),
  saveCompanyProfile: companyAdminFeatureProcedure("timeTracking").input(legalSchema).mutation(async ({ ctx, input }) => {
    await setSetting("company_legal_profile", JSON.stringify(input), ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "company_legal_profile", description: "Atualizou dados de identifica\xE7\xE3o da empresa para o espelho de ponto", newData: input });
    return { success: true };
  }),
  saveLaborProfile: companyAdminFeatureProcedure("timeTracking").input(z.object({ memberId: z.number().int().positive(), profile: laborSchema })).mutation(async ({ ctx, input }) => {
    const [member] = await companyMembers(ctx.accountId, [input.memberId]);
    if (!member) throw new TRPCError5({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado." });
    await setSetting(`labor_profile:${input.memberId}`, JSON.stringify(input.profile), ctx.accountId);
    void auditFromCtx(ctx, { action: "update", module: "time_tracking", entityType: "labor_profile", entityId: input.memberId, entityLabel: member.name, description: `Atualizou perfil trabalhista de ${member.name}`, newData: input.profile });
    return { success: true };
  }),
  /** Gera os dados do espelho. Somente leitura; registra a emissão na auditoria. */
  generate: companyAdminFeatureProcedure("timeTracking").input(z.object({ memberIds: z.array(z.number().int().positive()).max(500).optional(), from: dateStr, to: dateStr })).query(async ({ ctx, input }) => {
    if (input.from > input.to) throw new TRPCError5({ code: "BAD_REQUEST", message: "A data inicial deve ser anterior ou igual \xE0 final." });
    const spanDays = (Date.parse(input.to) - Date.parse(input.from)) / 864e5 + 1;
    if (spanDays > 366) throw new TRPCError5({ code: "BAD_REQUEST", message: "O per\xEDodo m\xE1ximo \xE9 de 366 dias." });
    const database2 = await getDb();
    if (!database2) throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    await ensureAdjustmentsTable();
    const members = await companyMembers(ctx.accountId, input.memberIds);
    if (input.memberIds?.length && members.length !== new Set(input.memberIds).size) throw new TRPCError5({ code: "NOT_FOUND", message: "Funcion\xE1rio n\xE3o encontrado nesta empresa." });
    const start = new Date(Date.parse(`${input.from}T00:00:00Z`) - 15 * 36e5);
    const end = new Date(Date.parse(`${input.to}T00:00:00Z`) + 60 * 36e5);
    const company = (await database2.select({ name: companies2.name }).from(companies2).where(eq3(companies2.id, ctx.accountId)).limit(1))[0];
    const legal = await readJson("company_legal_profile", ctx.accountId);
    const memberIds = members.map((m) => m.id);
    const eventRows = memberIds.length ? await database2.select().from(timeEvents).where(and3(eq3(timeEvents.companyId, ctx.accountId), inArray2(timeEvents.memberAccountId, memberIds), gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end))).orderBy(timeEvents.serverTime) : [];
    const eventsByMember = /* @__PURE__ */ new Map();
    for (const r of eventRows) eventsByMember.set(r.memberAccountId, [...eventsByMember.get(r.memberAccountId) || [], r]);
    const evIds = eventRows.map((r) => r.id);
    const adjByEvent = /* @__PURE__ */ new Map();
    if (evIds.length) {
      const adjRows = (await database2.execute(sql3`SELECT timeEventId, originalType, originalTime, justification, reviewedByName, createdAt FROM time_event_adjustments WHERE companyId = ${ctx.accountId} AND memberAccountId IN (${sql3.join(memberIds.map((id2) => sql3`${id2}`), sql3`, `)}) ORDER BY id`))[0];
      for (const a of adjRows) if (!adjByEvent.has(Number(a.timeEventId))) adjByEvent.set(Number(a.timeEventId), a);
    }
    const laborByMember = /* @__PURE__ */ new Map();
    if (memberIds.length) {
      const laborRows = (await database2.execute(sql3`SELECT settingKey, settingValue FROM system_settings WHERE accountId = ${ctx.accountId} AND settingKey LIKE 'labor\\_profile:%'`))[0];
      for (const r of laborRows) {
        try {
          laborByMember.set(Number(String(r.settingKey).split(":")[1]), JSON.parse(r.settingValue));
        } catch {
        }
      }
    }
    const results = members.map((m) => {
      const events = (eventsByMember.get(m.id) || []).map((r) => {
        const a = adjByEvent.get(r.id);
        const notes = r.notes || "";
        return {
          id: r.id,
          type: r.eventType,
          time: (r.deviceTime || r.serverTime).toISOString(),
          receivedAt: r.serverTime.toISOString(),
          synced: r.synced,
          notes,
          automatic: /automática/i.test(notes) && /^auto-clock-out:/.test(r.idempotencyKey || ""),
          adjustment: a ? { originalType: a.originalType, originalTime: new Date(a.originalTime).toISOString(), justification: a.justification, reviewedBy: a.reviewedByName, reviewedAt: a.createdAt ? new Date(a.createdAt).toISOString() : null } : null,
          legacyAdjustment: !a && /Ajuste aprovado em/.test(notes)
        };
      });
      const labor = laborByMember.get(m.id) ?? null;
      return { member: { id: m.id, name: m.name, role: m.role, employeeCode: m.employeeCode ?? null }, labor: labor ? { ...labor } : null, report: buildMirror({ events, from: input.from, to: input.to, timeZone: TZ, labor }) };
    });
    void auditFromCtx(ctx, { action: "read", module: "time_tracking", entityType: "timesheet_mirror", description: `Gerou espelho de ponto ${input.from} a ${input.to} (${results.length} funcion\xE1rio(s))`, newData: { from: input.from, to: input.to, memberIds: results.map((r) => r.member.id) } });
    return { company: { name: company?.name ?? "", legal: legal ?? null }, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), timeZone: TZ, results };
  }),
  /** Registra no log de auditoria que o espelho foi exportado/impresso/compartilhado. */
  logExport: companyAdminFeatureProcedure("timeTracking").input(z.object({ kind: z.enum(["pdf", "xlsx", "print", "whatsapp"]), from: dateStr, to: dateStr, count: z.number().int().min(1).max(500) })).mutation(async ({ ctx, input }) => {
    void auditFromCtx(ctx, { action: "export", module: "time_tracking", entityType: "timesheet_mirror", description: `Exportou espelho de ponto (${input.kind}) ${input.from} a ${input.to}, ${input.count} funcion\xE1rio(s)`, newData: input });
    return { success: true };
  })
});

// server/modules/timeTracking.ts
init_missingPunch();
var timeEventType = z2.enum(["clock_in", "break_start", "break_end", "clock_out"]);
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
var timeTrackingRouter = router({
  shiftStatus: commercialFeatureProcedure("timeTracking").input(z2.object({ timeZone: z2.string().min(1).default("UTC") }).optional()).query(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    const timeZone = input?.timeZone || "UTC";
    if (!companyId || !memberId) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
    const database2 = await getDb();
    if (!database2) return { status: "clock_in_required", active: false, timeZone, localDate: localDay(/* @__PURE__ */ new Date(), timeZone) };
    const today = localDay(/* @__PURE__ */ new Date(), timeZone);
    const events = await database2.select().from(timeEvents).where(and4(eq4(timeEvents.memberAccountId, memberId), eq4(timeEvents.companyId, companyId))).orderBy(desc2(timeEvents.serverTime)).limit(100);
    const todayEvents = events.filter((event) => localDay(event.deviceTime || event.serverTime, timeZone) === today);
    const last = todayEvents[0];
    const active = Boolean(last && last.eventType !== "clock_out");
    return { status: active ? "active" : last?.eventType === "clock_out" ? "closed" : "clock_in_required", active, timeZone, localDate: today, lastEvent: last?.eventType || null };
  }),
  companyToday: companyAdminFeatureProcedure("timeTracking").input(z2.object({ timeZone: z2.string().min(1).max(128).default("UTC") }).optional()).query(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) return [];
    const timeZone = input?.timeZone || "UTC";
    const today = localDay(/* @__PURE__ */ new Date(), timeZone);
    const since = new Date(Date.now() - 36 * 60 * 60 * 1e3);
    const rows2 = await database2.select({
      promoterId: memberAccounts2.id,
      promoterName: memberAccounts2.userName,
      eventType: timeEvents.eventType,
      serverTime: timeEvents.serverTime,
      deviceTime: timeEvents.deviceTime,
      latitude: timeEvents.latitude,
      longitude: timeEvents.longitude,
      accuracy: timeEvents.accuracy
    }).from(timeEvents).innerJoin(memberAccounts2, and4(
      eq4(timeEvents.memberAccountId, memberAccounts2.id),
      eq4(memberAccounts2.companyId, ctx.accountId)
    )).where(and4(
      eq4(timeEvents.companyId, ctx.accountId),
      eq4(memberAccounts2.role, "promoter"),
      gte2(timeEvents.serverTime, since)
    )).orderBy(desc2(timeEvents.serverTime)).limit(5e3);
    const eventsByPromoter = /* @__PURE__ */ new Map();
    for (const row2 of rows2) {
      if (localDay(row2.deviceTime || row2.serverTime, timeZone) !== today) continue;
      const promoterEvents = eventsByPromoter.get(row2.promoterId) || [];
      promoterEvents.push(row2);
      eventsByPromoter.set(row2.promoterId, promoterEvents);
    }
    const presence = [];
    for (const [promoterId, promoterEvents] of eventsByPromoter) {
      const chronological = [...promoterEvents].sort((a, b) => a.serverTime.getTime() - b.serverTime.getTime());
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
  registerEvent: commercialFeatureProcedure("timeTracking").input(z2.object({
    eventType: timeEventType,
    deviceTime: z2.string().datetime().optional(),
    latitude: z2.number().min(-90).max(90),
    longitude: z2.number().min(-180).max(180),
    accuracy: z2.number().finite().nonnegative().max(1e4),
    locationStatus: z2.literal("success"),
    locationError: z2.string().optional(),
    deviceInfo: z2.string().optional(),
    idempotencyKey: z2.string().min(1).max(64).optional(),
    timeZone: z2.string().min(1),
    notes: z2.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || !Number.isFinite(input.accuracy) || input.locationStatus !== "success") {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "O ponto s\xF3 pode ser registrado ap\xF3s obter uma localiza\xE7\xE3o GPS v\xE1lida." });
    }
    const database2 = await getDb();
    if (!database2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    if (input.idempotencyKey) {
      const existing = await database2.select().from(timeEvents).where(eq4(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing[0]) {
        if (Number(existing[0].companyId) !== companyId || Number(existing[0].memberAccountId) !== memberId) {
          throw new TRPCError6({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
        }
        return existing[0];
      }
    }
    const today = localDay(/* @__PURE__ */ new Date(), input.timeZone);
    const recent = await database2.select().from(timeEvents).where(and4(eq4(timeEvents.memberAccountId, memberId), eq4(timeEvents.companyId, companyId))).orderBy(desc2(timeEvents.serverTime)).limit(100);
    const todayEvents = recent.filter((event) => localDay(event.deviceTime || event.serverTime, input.timeZone) === today);
    const lastToday = todayEvents[0]?.eventType;
    if (input.eventType === "clock_in" && lastToday === "clock_out") throw new TRPCError6({ code: "BAD_REQUEST", message: "A jornada de hoje j\xE1 foi encerrada. O pr\xF3ximo acesso ser\xE1 liberado no pr\xF3ximo dia." });
    if (input.eventType !== "clock_in" && (!lastToday || lastToday === "clock_out")) throw new TRPCError6({ code: "BAD_REQUEST", message: "Bata a entrada antes de registrar este evento." });
    if (!isValidTransition(lastToday, input.eventType)) {
      throw new TRPCError6({ code: "BAD_REQUEST", message: "Sequ\xEAncia de marca\xE7\xE3o inv\xE1lida. Confira o \xFAltimo evento do ponto." });
    }
    let result;
    try {
      result = await database2.insert(timeEvents).values({
        companyId,
        memberAccountId: memberId,
        eventType: input.eventType,
        deviceTime: input.deviceTime ? new Date(input.deviceTime) : null,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracy: input.accuracy,
        locationStatus: input.locationStatus || "success",
        locationError: input.locationError,
        deviceInfo: input.deviceInfo,
        idempotencyKey: input.idempotencyKey,
        notes: input.notes,
        synced: true
      });
    } catch (error) {
      const duplicate = error?.code === "ER_DUP_ENTRY" || /duplicate entry/i.test(String(error?.message ?? ""));
      if (!duplicate || !input.idempotencyKey) throw error;
      const existing = await database2.select().from(timeEvents).where(eq4(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing[0] && Number(existing[0].companyId) === companyId && Number(existing[0].memberAccountId) === memberId) {
        return existing[0];
      }
      throw new TRPCError6({ code: "CONFLICT", message: "Esta chave de idempot\xEAncia n\xE3o pode ser reutilizada nesta sess\xE3o." });
    }
    const insertedRows = await database2.select().from(timeEvents).where(eq4(timeEvents.id, Number(result[0]?.insertId))).limit(1);
    const inserted = insertedRows[0];
    if (!inserted) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a marca\xE7\xE3o criada." });
    await auditFromCtx(ctx, {
      action: "create",
      module: "time_tracking",
      entityType: "time_event",
      entityId: inserted.id,
      description: `Marca\xE7\xE3o de ponto: ${input.eventType}`
    });
    return inserted;
  }),
  companyHistory: companyAdminFeatureProcedure("timeTracking").input(z2.object({ memberId: z2.number().int().positive(), month: z2.string().regex(/^\d{4}-\d{2}$/) })).query(async ({ ctx, input }) => {
    const database2 = await getDb();
    if (!database2) return [];
    const [year, mon] = input.month.split("-").map(Number);
    const start = new Date(Date.UTC(year, mon - 1, 1));
    const end = new Date(Date.UTC(year, mon, 1));
    return database2.select().from(timeEvents).where(and4(eq4(timeEvents.memberAccountId, input.memberId), eq4(timeEvents.companyId, ctx.accountId), gte2(timeEvents.serverTime, start), lt2(timeEvents.serverTime, end))).orderBy(timeEvents.serverTime);
  }),
  myMissingPunch: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    if (!ctx.accountId || !ctx.memberAccountId) return null;
    return (await findMissingPunches({ companyId: ctx.accountId, memberId: ctx.memberAccountId }))[0] ?? null;
  }),
  companyMissingPunches: companyAdminFeatureProcedure("timeTracking").query(({ ctx }) => findMissingPunches({ companyId: ctx.accountId })),
  myHistory: commercialFeatureProcedure("timeTracking").input(z2.object({ limit: z2.number().min(1).max(100).default(100), date: z2.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).query(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database2 = await getDb();
    if (!database2) return [];
    const conditions = [eq4(timeEvents.memberAccountId, memberId), eq4(timeEvents.companyId, companyId)];
    if (input?.date) {
      const start = /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 864e5);
      conditions.push(gte2(timeEvents.serverTime, start), lt2(timeEvents.serverTime, end));
    }
    return database2.select().from(timeEvents).where(and4(...conditions)).orderBy(desc2(timeEvents.serverTime)).limit(input?.limit || 100);
  }),
  myTimeSummary: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return { periodLabel: "M\xEAs atual", daysTracked: 0, workedMinutes: 0, expectedMinutes: 0, balanceMinutes: 0, openShift: false };
    const database2 = await getDb();
    if (!database2) return { periodLabel: "M\xEAs atual", daysTracked: 0, workedMinutes: 0, expectedMinutes: 0, balanceMinutes: 0, openShift: false };
    const now = /* @__PURE__ */ new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const events = await database2.select().from(timeEvents).where(and4(eq4(timeEvents.memberAccountId, memberId), eq4(timeEvents.companyId, companyId), gte2(timeEvents.serverTime, start), lt2(timeEvents.serverTime, end))).orderBy(timeEvents.serverTime);
    const byDay = /* @__PURE__ */ new Map();
    for (const event of events) {
      const timestamp3 = event.deviceTime || event.serverTime;
      const day = timestamp3.toISOString().slice(0, 10);
      const list = byDay.get(day) || [];
      list.push(event);
      byDay.set(day, list);
    }
    let workedMinutes = 0;
    let openShift = false;
    for (const dayEvents of byDay.values()) {
      let sessionStart = null;
      for (const event of dayEvents) {
        const timestamp3 = event.deviceTime || event.serverTime;
        if (event.eventType === "clock_in" || event.eventType === "break_end") sessionStart = timestamp3;
        if ((event.eventType === "break_start" || event.eventType === "clock_out") && sessionStart) {
          workedMinutes += Math.max(0, Math.round((timestamp3.getTime() - sessionStart.getTime()) / 6e4));
          sessionStart = null;
        }
      }
      if (sessionStart) {
        workedMinutes += Math.max(0, Math.round((Math.min(Date.now(), sessionStart.getTime() + 24 * 60 * 6e4) - sessionStart.getTime()) / 6e4));
        openShift = true;
      }
    }
    const expectedMinutes = byDay.size * 8 * 60;
    const periodLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    return { periodLabel: periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1), daysTracked: byDay.size, workedMinutes, expectedMinutes, balanceMinutes: workedMinutes - expectedMinutes, openShift };
  }),
  myCorrections: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database2 = await getDb();
    if (!database2) return [];
    return database2.select({ request: timeCorrectionRequests, event: timeEvents }).from(timeCorrectionRequests).leftJoin(timeEvents, eq4(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and4(eq4(timeCorrectionRequests.companyId, companyId), eq4(timeCorrectionRequests.memberAccountId, memberId))).orderBy(desc2(timeCorrectionRequests.createdAt));
  }),
  requestCorrection: commercialFeatureProcedure("timeTracking").input(z2.object({
    timeEventId: z2.number().int().positive().optional().nullable(),
    requestedType: timeEventType,
    requestedTime: z2.string().datetime(),
    justification: z2.string().min(5)
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError6({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    const database2 = await getDb();
    if (!database2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    let timeEventId = null;
    if (input.timeEventId) {
      const event = await database2.select().from(timeEvents).where(and4(eq4(timeEvents.id, input.timeEventId), eq4(timeEvents.companyId, companyId), eq4(timeEvents.memberAccountId, memberId))).limit(1);
      if (!event[0]) throw new TRPCError6({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada para este funcion\xE1rio." });
      timeEventId = input.timeEventId;
    }
    const result = await database2.insert(timeCorrectionRequests).values({
      companyId,
      memberAccountId: memberId,
      timeEventId,
      requestedType: input.requestedType,
      requestedTime: new Date(input.requestedTime),
      justification: input.justification,
      status: "pending"
    });
    const insertedRows = await database2.select().from(timeCorrectionRequests).where(eq4(timeCorrectionRequests.id, Number(result[0]?.insertId))).limit(1);
    const inserted = insertedRows[0];
    if (!inserted) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a solicita\xE7\xE3o criada." });
    await auditFromCtx(ctx, {
      action: "create",
      module: "time_tracking",
      entityType: "correction_request",
      entityId: inserted.id,
      description: timeEventId ? "Solicita\xE7\xE3o de corre\xE7\xE3o de ponto" : "Solicita\xE7\xE3o de inclus\xE3o de batida faltante"
    });
    return inserted;
  }),
  correctionRequests: router({
    pending: companyAdminFeatureProcedure("timeTracking").query(async ({ ctx }) => {
      const database2 = await getDb();
      if (!database2) return [];
      return database2.select({
        request: timeCorrectionRequests,
        event: timeEvents,
        employee: { userName: memberAccounts2.userName }
      }).from(timeCorrectionRequests).innerJoin(memberAccounts2, eq4(timeCorrectionRequests.memberAccountId, memberAccounts2.id)).leftJoin(timeEvents, eq4(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and4(eq4(timeCorrectionRequests.companyId, ctx.accountId), eq4(timeCorrectionRequests.status, "pending"))).orderBy(desc2(timeCorrectionRequests.createdAt));
    }),
    review: companyAdminFeatureProcedure("timeTracking").input(z2.object({ id: z2.number().int().positive(), status: z2.enum(["approved", "rejected"]), reviewNotes: z2.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
      const database2 = await getDb();
      if (!database2) throw new TRPCError6({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      const rows2 = await database2.select().from(timeCorrectionRequests).where(and4(eq4(timeCorrectionRequests.id, input.id), eq4(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
      const request = rows2[0];
      if (!request) throw new TRPCError6({ code: "NOT_FOUND", message: "Solicita\xE7\xE3o de corre\xE7\xE3o n\xE3o encontrada." });
      if (request.status !== "pending") throw new TRPCError6({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
      if (input.status === "approved") {
        if (request.timeEventId) {
          const event = (await database2.select().from(timeEvents).where(and4(eq4(timeEvents.id, request.timeEventId), eq4(timeEvents.companyId, ctx.accountId))).limit(1))[0];
          if (!event) throw new TRPCError6({ code: "NOT_FOUND", message: "A marca\xE7\xE3o original n\xE3o foi encontrada." });
          const previous = `${event.eventType} em ${(event.deviceTime || event.serverTime).toISOString()}`;
          const note = `Ajuste aprovado em ${(/* @__PURE__ */ new Date()).toISOString()} pelo administrador. Antes: ${previous}. Motivo do funcion\xE1rio: ${request.justification}`;
          await recordAdjustment({ companyId: ctx.accountId, timeEventId: event.id, correctionRequestId: request.id, memberAccountId: event.memberAccountId, originalType: event.eventType, originalTime: event.deviceTime || event.serverTime, correctedType: request.requestedType, correctedTime: request.requestedTime, justification: request.justification, reviewedByMemberId: ctx.memberAccountId ?? null, reviewedByName: ctx.user?.name ?? null });
          await database2.update(timeEvents).set({ eventType: request.requestedType, deviceTime: request.requestedTime, notes: `${event.notes ? `${event.notes}
` : ""}${note}` }).where(eq4(timeEvents.id, event.id));
        } else {
          const note = `Batida inclu\xEDda via solicita\xE7\xE3o aprovada em ${(/* @__PURE__ */ new Date()).toISOString()}. Motivo: ${request.justification}`;
          const insertResult = await database2.insert(timeEvents).values({
            companyId: request.companyId,
            memberAccountId: request.memberAccountId,
            eventType: request.requestedType,
            deviceTime: request.requestedTime,
            serverTime: /* @__PURE__ */ new Date(),
            notes: note,
            synced: true,
            locationStatus: "unavailable"
          });
          const newEventId = Number(insertResult[0]?.insertId);
          if (newEventId) {
            await recordAdjustment({
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
      }
      await database2.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(eq4(timeCorrectionRequests.id, request.id));
      await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicita\xE7\xE3o de corre\xE7\xE3o ${input.status === "approved" ? "aprovada" : "rejeitada"}${!request.timeEventId ? " (inclus\xE3o de batida)" : ""}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
      return { success: true };
    })
  })
});

// server/modules/platformCompanies.ts
init_trpc();
init_db();
init_audit();
import { z as z3 } from "zod";

// server/platformCompanies.ts
init_db();
init_schema_original();
import { and as and5, eq as eq5, inArray as inArray4, sql as sql5 } from "drizzle-orm";
import { TRPCError as TRPCError7 } from "@trpc/server";
var BR = "-03:00";
var endOfDay = (d) => /* @__PURE__ */ new Date(`${d}T23:59:59${BR}`);
var startOfDay = (d) => /* @__PURE__ */ new Date(`${d}T00:00:00${BR}`);
var addDaysDate = (d, n) => new Date(d.getTime() + n * 864e5);
async function database() {
  const d = await getDb();
  if (!d) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
  return d;
}
async function listCompaniesOverview() {
  const d = await database();
  const [rows2, plans, pays, counts, admins, flags] = await Promise.all([
    d.select().from(companies).orderBy(companies.name),
    d.select().from(subscriptionPlans),
    d.execute(sql5`SELECT companyId, MAX(paymentDate) AS lastPayment, COUNT(*) AS n FROM payments WHERE status IN ('RECEIVED','CONFIRMED','MOCK_APPROVED') GROUP BY companyId`),
    d.execute(sql5`SELECT companyId, COUNT(*) AS total, SUM(active) AS ativos FROM member_accounts GROUP BY companyId`),
    d.execute(sql5`SELECT companyId, MIN(email) AS email, MIN(userName) AS name FROM member_accounts WHERE role = 'company_admin' GROUP BY companyId`),
    d.select().from(systemSettings).where(inArray4(systemSettings.settingKey, ["blocked_reason", "archived_at"]))
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const map = (r, key = "companyId") => new Map(r[0].map((x) => [Number(x[key]), x]));
  const payBy = map(pays), countBy = map(counts), adminBy = map(admins);
  const flagBy = new Map(flags.map((f) => [`${f.accountId}:${f.settingKey}`, f.settingValue]));
  return rows2.map((c) => {
    const plan = c.planId ? planById.get(c.planId) : null;
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
  if (!company) throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  await updateCompany(companyId, { active: !blocked });
  if (blocked) await setSetting("blocked_reason", (reason || "").trim().slice(0, 300) || "Acesso bloqueado pelo administrador da plataforma.", companyId);
  else await d.delete(systemSettings).where(and5(eq5(systemSettings.accountId, companyId), eq5(systemSettings.settingKey, "blocked_reason")));
  if (blocked) {
    const ids = (await d.select({ id: memberAccounts.id }).from(memberAccounts).where(eq5(memberAccounts.companyId, companyId))).map((r) => r.id);
    if (ids.length) await d.delete(memberSessions).where(inArray4(memberSessions.memberAccountId, ids));
  }
  return company;
}
async function setCompanyPlan(input) {
  const d = await database();
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  const plan = await getSubscriptionPlanById(input.planId);
  if (!plan) throw new TRPCError7({ code: "NOT_FOUND", message: "Plano n\xE3o encontrado." });
  if (input.endsAt && input.endsAt < input.startsAt) throw new TRPCError7({ code: "BAD_REQUEST", message: "A validade final n\xE3o pode ser anterior ao in\xEDcio." });
  const latest = await getLatestCompanySubscription(input.companyId);
  if (latest) await updateCompanySubscription(latest.id, { planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? latest.notes ?? null });
  else await createCompanySubscription({ companyId: input.companyId, planId: input.planId, status: input.status, startsAt: input.startsAt, endsAt: input.endsAt ?? null, notes: input.notes ?? null });
  const end = input.endsAt ? endOfDay(input.endsAt) : null;
  await d.update(companies).set({
    planId: input.planId,
    subscriptionStatus: input.status,
    subscriptionStartedAt: startOfDay(input.startsAt),
    subscriptionExpiresAt: end,
    // tolerância explícita (padrão 0 dia): acesso até o fim do dia de validade + graceDays
    gracePeriodEndsAt: end ? addDaysDate(end, Math.max(0, input.graceDays ?? 0)) : null
  }).where(eq5(companies.id, input.companyId));
  return { success: true };
}
async function registerCompanyPayment(input) {
  const company = await getCompanyById(input.companyId);
  if (!company) throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (input.periodTo < input.periodFrom) throw new TRPCError7({ code: "BAD_REQUEST", message: "O fim do per\xEDodo pago n\xE3o pode ser anterior ao in\xEDcio." });
  const planId = input.planId ?? company.planId;
  if (!planId) throw new TRPCError7({ code: "BAD_REQUEST", message: "Selecione um plano para esta empresa antes de registrar o pagamento." });
  const latest = await getLatestCompanySubscription(input.companyId);
  await setCompanyPlan({ companyId: input.companyId, planId, status: "active", startsAt: input.periodFrom, endsAt: input.periodTo, graceDays: input.graceDays ?? 0, notes: input.note ?? latest?.notes ?? null });
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
  const r = await d.delete(payments).where(and5(eq5(payments.id, id2), eq5(payments.companyId, companyId)));
  if (!r[0]?.affectedRows) throw new TRPCError7({ code: "NOT_FOUND", message: "Pagamento n\xE3o encontrado." });
}
async function archiveCompany(companyId, archived) {
  const d = await database();
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (archived) {
    await setCompanyBlocked(companyId, true, "Empresa exclu\xEDda pelo administrador da plataforma.");
    await setSetting("archived_at", (/* @__PURE__ */ new Date()).toISOString(), companyId);
  } else {
    await d.delete(systemSettings).where(and5(eq5(systemSettings.accountId, companyId), eq5(systemSettings.settingKey, "archived_at")));
    await setCompanyBlocked(companyId, false);
  }
  return company;
}
async function purgeCompany(companyId, confirmName) {
  const company = await getCompanyById(companyId);
  if (!company) throw new TRPCError7({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
  if (company.name.trim() !== confirmName.trim()) throw new TRPCError7({ code: "BAD_REQUEST", message: "O nome digitado n\xE3o confere com o da empresa." });
  const archived = await getSetting("archived_at", companyId, "");
  if (!archived) throw new TRPCError7({ code: "PRECONDITION_FAILED", message: "Exclua (arquive) a empresa primeiro; a exclus\xE3o definitiva s\xF3 vale para empresas j\xE1 exclu\xEDdas." });
  let filesDeleted = 0;
  try {
    const d = await database();
    const [photoRows] = await d.execute(sql5`SELECT fileKey, thumbnailKey FROM store_photos WHERE companyId = ${companyId}`);
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const p of photoRows) {
      for (const k of [p.fileKey, p.thumbnailKey]) if (k) {
        try {
          await storageDelete2(k);
          filesDeleted++;
        } catch {
        }
      }
    }
  } catch {
  }
  const pool = await getPool();
  if (!pool) throw new TRPCError7({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
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

// server/modules/platformCompanies.ts
var dateStr2 = z3.string().regex(/^\d{4}-\d{2}-\d{2}$/);
var status = z3.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]);
var id = z3.number().int().positive();
var log = (ctx, companyId, action, description, data) => void auditFromCtx(ctx, { action, module: "platform", entityType: "company", entityId: companyId, entityLabel: String(companyId), description, newData: data, companyId: null });
var platformCompaniesRouter = router({
  overview: platformProcedure.query(() => listCompaniesOverview()),
  rename: platformProcedure.input(z3.object({ companyId: id, name: z3.string().trim().min(2).max(255) })).mutation(async ({ ctx, input }) => {
    await updateCompany(input.companyId, { name: input.name });
    log(ctx, input.companyId, "update", `Renomeou empresa #${input.companyId} para ${input.name}`);
    return { success: true };
  }),
  setBlocked: platformProcedure.input(z3.object({ companyId: id, blocked: z3.boolean(), reason: z3.string().max(300).optional() })).mutation(async ({ ctx, input }) => {
    const c = await setCompanyBlocked(input.companyId, input.blocked, input.reason);
    log(ctx, input.companyId, input.blocked ? "block" : "unblock", `${input.blocked ? "Bloqueou" : "Desbloqueou"} a empresa ${c.name}${input.reason ? `: ${input.reason}` : ""}`);
    return { success: true };
  }),
  setPlan: platformProcedure.input(z3.object({ companyId: id, planId: id, status, startsAt: dateStr2, endsAt: dateStr2.nullish(), graceDays: z3.number().int().min(0).max(60).optional(), notes: z3.string().max(500).nullish() })).mutation(async ({ ctx, input }) => {
    await setCompanyPlan(input);
    log(ctx, input.companyId, "update", `Definiu plano/validade da empresa #${input.companyId}: plano ${input.planId}, ${input.status}, ${input.startsAt} a ${input.endsAt ?? "sem fim"}`, input);
    return { success: true };
  }),
  payments: platformProcedure.input(z3.object({ companyId: id })).query(({ input }) => listCompanyPayments(input.companyId)),
  registerPayment: platformProcedure.input(z3.object({
    companyId: id,
    amount: z3.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
    paymentDate: dateStr2,
    periodFrom: dateStr2,
    periodTo: dateStr2,
    billingType: z3.enum(["BOLETO", "CREDIT_CARD", "PIX", "UNDEFINED"]).default("PIX"),
    planId: id.nullish(),
    graceDays: z3.number().int().min(0).max(60).optional(),
    note: z3.string().max(500).nullish()
  })).mutation(async ({ ctx, input }) => {
    const r = await registerCompanyPayment(input);
    log(ctx, input.companyId, "payment", `Registrou pagamento de R$ ${input.amount} em ${input.paymentDate}; plano v\xE1lido de ${input.periodFrom} a ${input.periodTo}`, input);
    return r;
  }),
  deletePayment: platformProcedure.input(z3.object({ companyId: id, paymentId: id })).mutation(async ({ ctx, input }) => {
    await deletePayment(input.paymentId, input.companyId);
    log(ctx, input.companyId, "delete", `Excluiu o pagamento #${input.paymentId} da empresa #${input.companyId}`);
    return { success: true };
  }),
  /** "Excluir": arquiva e bloqueia (reversível). */
  archive: platformProcedure.input(z3.object({ companyId: id, archived: z3.boolean() })).mutation(async ({ ctx, input }) => {
    const c = await archiveCompany(input.companyId, input.archived);
    log(ctx, input.companyId, input.archived ? "delete" : "restore", `${input.archived ? "Excluiu (arquivou)" : "Restaurou"} a empresa ${c.name}`);
    return { success: true };
  }),
  /** Exclusão definitiva e irreversível; exige o nome da empresa e que ela já esteja excluída. */
  purge: platformProcedure.input(z3.object({ companyId: id, confirmName: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
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
import { z as z5 } from "zod";
import { TRPCError as TRPCError9 } from "@trpc/server";
import { sql as sql8 } from "drizzle-orm";
var rows = (r) => Array.isArray(r?.[0]) ? r[0] : Array.isArray(r) ? r : r?.rows ?? [];
var text3 = (max) => z5.string().trim().max(max).optional().transform((v) => v ? v : null);
async function loadClient(db, companyId, storeId, id2) {
  const r = rows(await db.execute(sql8`SELECT * FROM store_clients WHERE id = ${id2} AND companyId = ${companyId} AND storeId = ${storeId} LIMIT 1`));
  if (!r[0]) throw new TRPCError9({ code: "NOT_FOUND", message: "Cliente n\xE3o encontrado nesta loja." });
  return r[0];
}
var storeClientsRouter = router({
  /** Clientes de uma loja, com a quantidade de fotos (o promotor conta só as próprias). */
  list: commercialFeatureProcedure("fieldOperations").input(z5.object({ storeId: z5.number().int().positive(), includeInactive: z5.boolean().optional() })).query(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const memberId = scopeMemberId(ctx);
    const own = memberId !== null ? sql8` AND p.promoterId = ${memberId}` : sql8``;
    const r = rows(await db.execute(sql8`
        SELECT c.id, c.storeId, c.name, c.contactName, c.phone, c.notes, c.active,
          (SELECT COUNT(*) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id AND p.uploadStatus = 'uploaded'${own}) AS photoCount,
          (SELECT MAX(p.capturedAt) FROM store_photos p WHERE p.companyId = c.companyId AND p.storeClientId = c.id${own}) AS lastActivity
        FROM store_clients c
        WHERE c.companyId = ${ctx.accountId} AND c.storeId = ${input.storeId}${input.includeInactive ? sql8`` : sql8` AND c.active = true`}
        ORDER BY c.name ASC`));
    return r.map((c) => ({ ...c, active: Boolean(c.active), photoCount: Number(c.photoCount ?? 0) }));
  }),
  create: commercialFeatureProcedure("fieldOperations").input(z5.object({ storeId: z5.number().int().positive(), name: z5.string().trim().min(2, "Informe o nome do cliente.").max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const dup = rows(await db.execute(sql8`SELECT id FROM store_clients WHERE companyId = ${ctx.accountId} AND storeId = ${input.storeId} AND active = true AND LOWER(name) = ${input.name.toLowerCase()} LIMIT 1`));
    if (dup[0]) throw new TRPCError9({ code: "CONFLICT", message: "Esta loja j\xE1 tem um cliente com esse nome." });
    const res = await db.execute(sql8`INSERT INTO store_clients (companyId, storeId, name, contactName, phone, notes) VALUES (${ctx.accountId}, ${input.storeId}, ${input.name}, ${input.contactName}, ${input.phone}, ${input.notes})`);
    const id2 = Number((Array.isArray(res) ? res[0] : res)?.insertId);
    await auditFromCtx(ctx, { action: "create", module: "store_clients", entityType: "store_client", entityId: id2, entityLabel: input.name, description: `Cliente ${input.name} cadastrado na loja ${store.name}`, newData: { storeId: input.storeId, name: input.name } });
    return { id: id2 };
  }),
  update: commercialFeatureProcedure("fieldOperations").input(z5.object({ storeId: z5.number().int().positive(), id: z5.number().int().positive(), name: z5.string().trim().min(2).max(255), contactName: text3(255), phone: text3(50), notes: text3(2e3) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
    await db.execute(sql8`UPDATE store_clients SET name = ${input.name}, contactName = ${input.contactName}, phone = ${input.phone}, notes = ${input.notes} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
    await auditFromCtx(ctx, { action: "update", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: input.name, description: `Cliente ${old.name} atualizado na loja ${store.name}`, oldData: { name: old.name, phone: old.phone }, newData: { name: input.name, phone: input.phone } });
    return { id: input.id };
  }),
  /** Remover = desativar: as fotos já tiradas continuam ligadas ao cliente na galeria. */
  setActive: commercialFeatureProcedure("fieldOperations").input(z5.object({ storeId: z5.number().int().positive(), id: z5.number().int().positive(), active: z5.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new TRPCError9({ code: "INTERNAL_SERVER_ERROR", message: "Banco indispon\xEDvel." });
    const store = await assertStoreAccess(db, ctx, input.storeId);
    await ensureStoreClientsSchema(db);
    const old = await loadClient(db, ctx.accountId, input.storeId, input.id);
    await db.execute(sql8`UPDATE store_clients SET active = ${input.active} WHERE id = ${input.id} AND companyId = ${ctx.accountId}`);
    await auditFromCtx(ctx, { action: input.active ? "update" : "delete", module: "store_clients", entityType: "store_client", entityId: input.id, entityLabel: old.name, description: `Cliente ${old.name} ${input.active ? "reativado" : "removido"} da loja ${store.name}` });
    return { id: input.id, active: input.active };
  })
});

// server/routers.ts
init_rateLimit();
import { z as z7 } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError as TRPCError12 } from "@trpc/server";

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
    sameSite: secure ? "none" : "lax",
    secure
  };
}

// server/_core/systemRouter.ts
import { z as z6 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError10 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError10({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError10({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError10({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError10({
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
    z6.object({
      timestamp: z6.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z6.object({
      title: z6.string().min(1, "title is required"),
      content: z6.string().min(1, "content is required")
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
import { TRPCError as TRPCError11 } from "@trpc/server";

// server/memberAuth.ts
init_schema_original();
init_schema();
init_db();
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and as and7, eq as eq7, gt, lte as lte2 } from "drizzle-orm";
var SESSION_DAYS = 30;
var RATE_WINDOW_MS = 15 * 60 * 1e3;
var RATE_LIMIT = 5;
var BLOCK_MS = 15 * 60 * 1e3;
var authRate = /* @__PURE__ */ new Map();
function isRateLimited(key) {
  const now = Date.now();
  const current = authRate.get(key);
  if (!current) return false;
  if (current.blockedUntil > now) return true;
  if (now - current.windowStartedAt >= RATE_WINDOW_MS) authRate.delete(key);
  return false;
}
function registerFailure(key) {
  const now = Date.now();
  const current = authRate.get(key);
  const entry = !current || now - current.windowStartedAt >= RATE_WINDOW_MS ? { failures: 1, windowStartedAt: now, blockedUntil: 0 } : { ...current, failures: current.failures + 1 };
  if (entry.failures >= RATE_LIMIT) entry.blockedUntil = now + BLOCK_MS;
  authRate.set(key, entry);
}
function clearRateLimit(key) {
  authRate.delete(key);
}
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
  return createHash("sha256").update(token).digest("hex");
}
function normalizeMemberRole(role) {
  if (role === "admin" || role === "company_admin") return "company_admin";
  if (role === "supervisor") return "supervisor";
  return "promoter";
}
async function authenticateMember(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const platformResult = await db.select().from(platformAdmins).where(eq7(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    clearRateLimit(key);
    return { kind: "platform", account: platform };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq7(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member && member.active && verifyPassword(password, member.passwordHash)) {
    clearRateLimit(key);
    return { kind: "company", account: member };
  }
  registerFailure(key);
  return null;
}
async function createSession(principal) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1e3);
  if (principal.kind === "platform") {
    await db.delete(platformSessions).where(and7(eq7(platformSessions.platformAdminId, principal.account.id), lte2(platformSessions.expiresAt, /* @__PURE__ */ new Date())));
    await db.insert(platformSessions).values({ platformAdminId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
    return { rawToken, expiresAt, kind: "platform" };
  }
  await db.delete(memberSessions).where(and7(eq7(memberSessions.memberAccountId, principal.account.id), lte2(memberSessions.expiresAt, /* @__PURE__ */ new Date())));
  await db.insert(memberSessions).values({ memberAccountId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt, kind: "company" };
}
async function getMemberBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions).innerJoin(memberAccounts, eq7(memberSessions.memberAccountId, memberAccounts.id)).innerJoin(companies, eq7(memberAccounts.companyId, companies.id)).where(and7(eq7(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq7(memberAccounts.active, true), eq7(companies.active, true))).limit(1);
  await db.delete(memberSessions).where(lte2(memberSessions.expiresAt, now));
  return result[0]?.account ?? null;
}
async function getPlatformAdminBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions).innerJoin(platformAdmins, eq7(platformSessions.platformAdminId, platformAdmins.id)).where(and7(eq7(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq7(platformAdmins.active, true))).limit(1);
  await db.delete(platformSessions).where(lte2(platformSessions.expiresAt, now));
  return result[0]?.account ?? null;
}
async function revokeSessions(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(memberSessions).where(eq7(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq7(platformSessions.tokenHash, tokenHash));
}
async function changeMemberPassword(memberAccountId, currentPassword, newPassword) {
  const key = `change:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq7(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq7(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq7(memberSessions.memberAccountId, memberAccountId));
  return true;
}
async function changePlatformPassword(platformAdminId, currentPassword, newPassword) {
  const key = `change:platform:${platformAdminId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq7(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq7(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq7(platformSessions.platformAdminId, platformAdminId));
  return true;
}
async function resetMemberPassword(memberAccountId, newPassword) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq7(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq7(memberSessions.memberAccountId, memberAccountId));
  clearRateLimit(`login:${memberAccountId}`);
}
async function recoverPassword(email, recoveryCode, newPassword) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const platformResult = await db.select().from(platformAdmins).where(eq7(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq7(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq7(platformSessions.platformAdminId, platform.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq7(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq7(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq7(memberSessions.memberAccountId, member.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" };
  }
  registerFailure(key);
  return false;
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
      const planRows = await tx.select().from(subscriptionPlans).where(eq7(subscriptionPlans.id, input.planId)).limit(1);
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
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt, employeeCode: promoterProfiles.employeeCode, workStartTime: promoterProfiles.workStartTime, workEndTime: promoterProfiles.workEndTime }).from(memberAccounts).leftJoin(promoterProfiles, and7(eq7(promoterProfiles.memberAccountId, memberAccounts.id), eq7(promoterProfiles.companyId, memberAccounts.companyId)));
  const rows2 = companyId ? await query.where(eq7(memberAccounts.companyId, companyId)) : await query;
  return rows2.map((row2) => ({ ...row2, role: normalizeMemberRole(String(row2.role)) }));
}
async function updateCompanyUser(accountId, companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ ...data, email: data.email?.trim().toLowerCase() }).where(and7(eq7(memberAccounts.id, accountId), eq7(memberAccounts.companyId, companyId)));
}
async function setMemberActive(id2, active, companyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const conditions = companyId === void 0 ? eq7(memberAccounts.id, id2) : and7(eq7(memberAccounts.id, id2), eq7(memberAccounts.companyId, companyId));
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(conditions).limit(1);
  if (account[0]?.role === "company_admin" && !active) {
    const adminCount = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and7(eq7(memberAccounts.companyId, companyId ?? 0), eq7(memberAccounts.role, "company_admin"), eq7(memberAccounts.active, true))).limit(2);
    if (adminCount.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
  }
  await db.update(memberAccounts).set({ active }).where(conditions);
  if (!active) await db.delete(memberSessions).where(eq7(memberSessions.memberAccountId, id2));
}
async function updateMemberProfile(memberAccountId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const name = data.userName.trim();
  if (name.length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres.");
  await db.update(memberAccounts).set({ userName: name }).where(eq7(memberAccounts.id, memberAccountId));
  return { success: true, userName: name };
}
async function regenerateMemberRecoveryCode(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq7(memberAccounts.id, memberAccountId));
  return { recoveryCode };
}
async function revokeAllMemberSessions(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(eq7(memberSessions.memberAccountId, memberAccountId));
  return { success: true };
}
async function verifyMemberPassword(memberAccountId, password) {
  const key = `verify:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const database2 = await getDb();
  if (!database2) throw new Error("Database not connected");
  const result = await database2.select().from(memberAccounts).where(eq7(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(password, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  return true;
}

// server/planLimits.ts
init_schema_original();
init_entitlements();
init_entitlements2();
import { sql as sql9, eq as eq8 } from "drizzle-orm";
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
    throw new TRPCError11({
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

// server/geocoding.ts
var CACHE_TTL_MS = 60 * 60 * 1e3;
var MAX_CACHE_ENTRIES = 2e3;
var MIN_REQUEST_INTERVAL_MS = 250;
var addressCache = /* @__PURE__ */ new Map();
var inFlight = /* @__PURE__ */ new Map();
var requestQueue = Promise.resolve();
var lastRequestStartedAt = 0;
function coordinateKey(latitude, longitude) {
  return `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

// server/routers.ts
init_storeAccess();
init_entitlements();
init_entitlements2();

// server/aiGithubService.ts
var GITHUB_API = "https://api.github.com";
var OWNER = process.env.GITHUB_REPO_OWNER || "IvanMHonemann";
var REPO = process.env.GITHUB_REPO_NAME || "promotores-saas";
var BRANCH = process.env.GITHUB_REPO_BRANCH || "main";
var editableFiles = [
  "client/src/pages/platform/PlatformDashboard.tsx",
  "client/src/App.tsx",
  "client/src/index.css",
  "client/src/components/AIChatBox.tsx",
  "package.json",
  "vercel.json"
];
async function github(path2, init = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN n\xE3o est\xE1 configurado na Vercel.");
  const response = await fetch(`${GITHUB_API}${path2}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...init.headers || {}
    }
  });
  const body = await response.text();
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = { message: body.slice(0, 500) };
  }
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${parsed.message || "erro desconhecido"}`);
  return parsed;
}
async function readFile(path2, ref) {
  const file = await github(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path2)}?ref=${encodeURIComponent(ref)}`);
  return { path: path2, sha: file.sha, content: Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") };
}
async function askGemini(prompt, files, history = []) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY n\xE3o est\xE1 configurada na Vercel.");
  const context = files.length ? files.map((file) => `
--- ${file.path} ---
${file.content}`).join("\n") : "(nenhum arquivo precisa ser consultado para esta conversa)";
  const conversation = history.slice(-12).map((message) => `${message.role === "user" ? "Usu\xE1rio" : "Assistente"}: ${message.content}`).join("\n");
  const system = `Voc\xEA \xE9 o assistente de IA e engenheiro de software do GondUp. Converse naturalmente e responda em portugu\xEAs brasileiro, sempre levando em conta exatamente o que o usu\xE1rio escreveu e o hist\xF3rico fornecido. Voc\xEA deve responder perguntas, explicar conceitos, sugerir ideias e ajudar o usu\xE1rio mesmo quando ele n\xE3o pedir nenhuma altera\xE7\xE3o no c\xF3digo.

Voc\xEA pode alterar SOMENTE estes arquivos: ${editableFiles.join(", ")}.
Se o usu\xE1rio estiver apenas conversando ou fazendo uma pergunta, retorne changes vazio e responda diretamente, sem dizer que alguma altera\xE7\xE3o foi feita. S\xF3 inclua changes quando o usu\xE1rio pedir explicitamente uma altera\xE7\xE3o no site ou no c\xF3digo. Quando for solicitada uma altera\xE7\xE3o, devolva o arquivo COMPLETO em changes, nunca um diff e nunca conte\xFAdo parcial. N\xE3o invente arquivos nem diga que publicou algo: o servidor criar\xE1 um commit real depois de validar sua resposta. Preserve o funcionamento existente e n\xE3o remova recursos sem pedido expl\xEDcito.

Retorne SOMENTE JSON v\xE1lido no formato:
{"reply":"resposta objetiva","changes":[{"path":"arquivo permitido","content":"conte\xFAdo completo","reason":"motivo"}]}

Hist\xF3rico recente da conversa:
${conversation || "(primeira mensagem)"}

C\xF3digo atual:${context}`;
  const responseSchema = {
    type: "OBJECT",
    properties: {
      reply: { type: "STRING" },
      changes: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            path: { type: "STRING" },
            content: { type: "STRING" },
            reason: { type: "STRING" }
          },
          required: ["path", "content"]
        }
      }
    },
    required: ["reply", "changes"]
  };
  const requestBody = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json", responseSchema }
  };
  let response = null;
  let body = null;
  let lastError = "resposta inv\xE1lida";
  const modelListResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  const modelList = modelListResponse.ok ? await modelListResponse.json() : null;
  const preferredModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
  const availableModels = (modelList?.models || []).filter((model) => model.supportedGenerationMethods?.includes("generateContent")).map((model) => String(model.name || "").replace(/^models\//, ""));
  const models = preferredModels.filter((model) => availableModels.length === 0 || availableModels.includes(model));
  for (const model of models.length ? models : ["gemini-3.8-flash"]) {
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
  const text4 = body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
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
async function runPersistentGemini(prompt, history = []) {
  const asksForChange = /\b(altere|alterar|mude|mudar|modifique|modificar|adicione|adicionar|remova|remover|crie|criar|corrija|corrigir|implemente|implementar|troque|trocar|aplique|aplicar|faça|fazer|coloque|colocar|insira|inserir|inclua|incluir|disponibilize|disponibilizar|leve|levar|reative|reativar|restaure|restaurar)\b/i.test(prompt);
  const ref = asksForChange ? await github(`/repos/${OWNER}/${REPO}/git/ref/heads/${encodeURIComponent(BRANCH)}`) : null;
  const files = asksForChange ? await Promise.all(editableFiles.map((path2) => readFile(path2, BRANCH))) : [];
  const result = await askGemini(prompt, files, history);
  const changes = (result.changes || []).filter((change) => editableFiles.includes(change.path) && typeof change.content === "string");
  if (!changes.length) return { reply: result.reply || "Estou aqui para responder sua mensagem. O que voc\xEA gostaria de saber?", changed: false };
  if (changes.length > 4) throw new Error("A solicita\xE7\xE3o gerou arquivos demais para uma \xFAnica altera\xE7\xE3o segura.");
  for (const change of changes) {
    if (change.content.length > 3e5) throw new Error(`O arquivo ${change.path} excede o limite seguro.`);
  }
  if (!ref) throw new Error("N\xE3o foi poss\xEDvel preparar a altera\xE7\xE3o. Envie o pedido de mudan\xE7a novamente.");
  const baseCommitSha = ref.object.sha;
  const baseCommit = await github(`/repos/${OWNER}/${REPO}/git/commits/${baseCommitSha}`);
  const treeEntries = [];
  for (const change of changes) {
    const blob = await github(`/repos/${OWNER}/${REPO}/git/blobs`, { method: "POST", body: JSON.stringify({ content: change.content, encoding: "utf-8" }) });
    treeEntries.push({ path: change.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await github(`/repos/${OWNER}/${REPO}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }) });
  const commit = await github(`/repos/${OWNER}/${REPO}/git/commits`, { method: "POST", body: JSON.stringify({ message: `feat(ai): ${prompt.slice(0, 72).replace(/\n/g, " ")}`, tree: tree.sha, parents: [baseCommitSha] }) });
  await github(`/repos/${OWNER}/${REPO}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha, force: false }) });
  return {
    reply: `${result.reply || "Altera\xE7\xE3o preparada."}

Commit criado com sucesso. A Vercel foi acionada para publicar a nova vers\xE3o; confirme o resultado no site ap\xF3s o deployment concluir.`,
    changed: true,
    commitSha: commit.sha,
    commitUrl: `https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`,
    files: changes.map((change) => change.path)
  };
}

// server/routers.ts
var companyUserRole = z7.enum(["company_admin", "supervisor", "promoter"]);
var entitlementFeatureKey = z7.enum(ENTITLEMENT_KEYS);
var permissionModeSchema = z7.enum(["inherit", "allow", "deny"]);
var featurePermissionListSchema = z7.array(z7.object({ featureKey: entitlementFeatureKey, mode: permissionModeSchema })).max(ENTITLEMENT_KEYS.length);
var productInput = z7.object({
  productCode: z7.string().trim().min(1).max(64),
  description: z7.string().trim().min(1).max(500),
  quantity: z7.number().int().min(0).max(2147483647),
  expirationDate: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z7.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  storeId: z7.number().int().positive().nullish()
});
async function assertStoreInCompany(ctx, storeId) {
  if (!storeId) return null;
  const database2 = await getDb();
  await assertStoreAccess(database2, ctx, storeId);
  return storeId;
}
var appRouter = router({
  system: systemRouter,
  timeTracking: timeTrackingRouter,
  timesheetMirror: timesheetMirrorRouter,
  platformCompanies: platformCompaniesRouter,
  storePhotos: storePhotosRouter,
  storeClients: storeClientsRouter,
  entitlements: router({
    mine: companyBillingProcedure.query(({ ctx }) => {
      if (!ctx.memberAccountId) throw new TRPCError12({ code: "FORBIDDEN", message: "Usu\xE1rio da empresa n\xE3o encontrado." });
      return getMemberEntitlementSnapshot(ctx.accountId, ctx.memberAccountId, ctx.user.role);
    })
  }),
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    /** Cadastro público: cria empresa + admin com plano opcional (trial 14 dias). */
    signup: publicProcedure.input(z7.object({
      companyName: z7.string().min(2, "Nome da empresa \xE9 obrigat\xF3rio"),
      userName: z7.string().min(2, "Nome do respons\xE1vel \xE9 obrigat\xF3rio"),
      email: z7.string().email(),
      password: z7.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      planId: z7.number().int().positive("Selecione um plano antes de criar a conta"),
      paymentConfirmed: z7.boolean().refine((v) => v === true, { message: "Confirme o pagamento para criar a conta." })
    })).mutation(async ({ ctx, input }) => {
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
              password: input.password,
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
          throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        }
        throw error;
      }
    }),
    login: publicProcedure.input(z7.object({ email: z7.string().email(), password: z7.string().min(1) })).mutation(async ({ ctx, input }) => {
      const ip = getClientIp(ctx.req);
      const limit = checkRateLimit(ip, "login");
      if (!limit.ok) {
        throw new TRPCError12({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto." });
      }
      const principal = await authenticateMember(input.email, input.password);
      if (!principal) {
        void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
        throw new TRPCError12({ code: "UNAUTHORIZED", message: "E-mail ou senha inv\xE1lidos." });
      }
      if (principal.kind === "company") {
        const company = await getCompanyById(principal.account.companyId);
        if (!company || company.active === false) {
          const reason = company ? await getSetting("blocked_reason", company.id, "") : "";
          throw new TRPCError12({ code: "FORBIDDEN", message: reason || "Acesso da empresa bloqueado. Entre em contato com o suporte." });
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
    recoverPassword: publicProcedure.input(z7.object({ email: z7.string().email(), recoveryCode: z7.string().min(1), newPassword: z7.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ input }) => {
      const recovered = await recoverPassword(input.email, input.recoveryCode, input.newPassword);
      if (!recovered) throw new TRPCError12({ code: "UNAUTHORIZED", message: "E-mail ou c\xF3digo de recupera\xE7\xE3o inv\xE1lido." });
      return { success: true, recoveryCode: recovered.recoveryCode };
    }),
    changePassword: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z7.object({ currentPassword: z7.string().min(1), newPassword: z7.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ ctx, input }) => {
      const changed = ctx.user.role === "platform_admin" ? await changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword) : await changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
      if (!changed) throw new TRPCError12({ code: "UNAUTHORIZED", message: "A senha atual est\xE1 incorreta." });
      return { success: true };
    }),
    updateProfile: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z7.object({
      userName: z7.string().min(2).optional(),
      avatarDataUrl: z7.string().max(4e5).optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Perfil de plataforma n\xE3o usa esta rota." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const companyId = ctx.accountId;
      if (!companyId) throw new TRPCError12({ code: "FORBIDDEN", message: "Empresa n\xE3o identificada." });
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
            throw new TRPCError12({ code: "BAD_REQUEST", message: "Imagem de perfil inv\xE1lida." });
          }
          await setSetting(key, input.avatarDataUrl, companyId);
        }
      }
      return { success: true, userName };
    }),
    profileExtras: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
      if (!opts.ctx.user) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z7.object({ currentPassword: z7.string().min(1) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "Indispon\xEDvel para admin da plataforma nesta tela." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const ok = await verifyMemberPassword(memberId, input.currentPassword);
      if (!ok) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      const result = await regenerateMemberRecoveryCode(memberId);
      return { success: true, recoveryCode: result.recoveryCode };
    }),
    logoutAllSessions: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError12({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
      chat: platformProcedure.input(z7.object({
        prompt: z7.string().trim().min(1).max(12e3),
        history: z7.array(z7.object({ role: z7.enum(["user", "assistant"]), content: z7.string().max(12e3) })).max(30).optional()
      })).mutation(async ({ input }) => runPersistentGemini(input.prompt, input.history ?? []))
    }),
    plans: router({
      list: platformProcedure.query(() => listSubscriptionPlans()),
      create: platformProcedure.input(z7.object({
        name: z7.string().min(2),
        description: z7.string().optional().nullable(),
        price: z7.string().default("0.00"),
        billingCycle: z7.enum(["monthly", "yearly"]).default("monthly"),
        maxUsers: z7.number().int().positive().optional().nullable(),
        maxClients: z7.number().int().positive().optional().nullable(),
        maxExtinguishers: z7.number().int().positive().optional().nullable(),
        featureKeys: z7.array(entitlementFeatureKey).default([]),
        availableForNew: z7.boolean().default(true)
      })).mutation(({ input }) => createSubscriptionPlan(input)),
      update: platformProcedure.input(z7.object({
        id: z7.number().int().positive(),
        name: z7.string().min(2).optional(),
        description: z7.string().optional().nullable(),
        price: z7.string().optional(),
        billingCycle: z7.enum(["monthly", "yearly"]).optional(),
        maxUsers: z7.number().int().positive().optional().nullable(),
        maxClients: z7.number().int().positive().optional().nullable(),
        maxExtinguishers: z7.number().int().positive().optional().nullable(),
        featureKeys: z7.array(entitlementFeatureKey).optional(),
        availableForNew: z7.boolean().optional(),
        active: z7.boolean().optional()
      })).mutation(async ({ input }) => {
        const { id: id2, ...data } = input;
        return updateSubscriptionPlan(id2, data);
      })
    }),
    subscriptions: router({
      list: platformProcedure.query(() => listCompanySubscriptions()),
      stats: platformProcedure.query(() => getSubscriptionStats()),
      create: platformProcedure.input(z7.object({
        companyId: z7.number().int().positive(),
        planId: z7.number().int().positive(),
        status: z7.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).default("active"),
        startsAt: z7.string().min(8),
        endsAt: z7.string().optional().nullable(),
        notes: z7.string().optional().nullable()
      })).mutation(({ input }) => createCompanySubscription(input)),
      update: platformProcedure.input(z7.object({
        id: z7.number().int().positive(),
        planId: z7.number().int().positive().optional(),
        status: z7.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).optional(),
        startsAt: z7.string().min(8).optional(),
        endsAt: z7.string().optional().nullable(),
        notes: z7.string().optional().nullable()
      })).mutation(async ({ input }) => {
        const { id: id2, ...data } = input;
        return updateCompanySubscription(id2, data);
      })
    }),
    companyFeatures: router({
      get: platformProcedure.input(z7.object({ companyId: z7.number().int().positive() })).query(({ input }) => getCompanyEntitlementBase(input.companyId)),
      set: platformProcedure.input(z7.object({
        companyId: z7.number().int().positive(),
        overrides: featurePermissionListSchema,
        reason: z7.string().max(500).optional().nullable()
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
    reverseGeocodePoint: platformProcedure.input(z7.object({ latitude: z7.number().min(-90).max(90), longitude: z7.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
    companies: router({
      list: platformProcedure.query(() => listCompanies()),
      create: platformProcedure.input(z7.object({ companyName: z7.string().min(2), userName: z7.string().min(2), email: z7.string().email(), password: z7.string().min(8) })).mutation(async ({ input }) => {
        try {
          return await createCompanyWithAdmin(input);
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      }),
      update: platformProcedure.input(z7.object({ id: z7.number().int().positive(), name: z7.string().min(2).optional(), active: z7.boolean().optional() })).mutation(async ({ input }) => {
        await updateCompany(input.id, { name: input.name, active: input.active });
        return { success: true };
      })
    }),
    users: router({
      list: platformProcedure.query(() => listMemberAccounts()),
      create: platformProcedure.input(z7.object({ companyId: z7.number().int().positive(), userName: z7.string().min(2), email: z7.string().email(), password: z7.string().min(8), role: companyUserRole })).mutation(async ({ input, ctx }) => {
        const company = await getCompanyById(input.companyId);
        if (!company) throw new TRPCError12({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
        if (!company.active) throw new TRPCError12({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel criar usu\xE1rio em uma empresa bloqueada." });
        try {
          const created = await createCompanyUser(input);
          void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usu\xE1rio criado pelo administrador geral: ${input.userName}`, newData: { companyId: input.companyId, email: input.email, role: input.role } });
          return created;
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      })
    })
  }),
  accounts: router({
    list: platformProcedure.query(() => listMemberAccounts()),
    create: platformProcedure.input(z7.object({ companyName: z7.string().min(2), userName: z7.string().min(2), email: z7.string().email(), password: z7.string().min(8) })).mutation(async ({ input }) => {
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
    setActive: platformProcedure.input(z7.object({ id: z7.number().int().positive(), active: z7.boolean() })).mutation(async ({ input }) => {
      await setMemberActive(input.id, input.active);
      return { success: true };
    }),
    resetPassword: platformProcedure.input(z7.object({ id: z7.number().int().positive(), newPassword: z7.string().min(8) })).mutation(async ({ input }) => {
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  companyUsers: router({
    list: companyAdminFeatureProcedure("teamManagement").query(({ ctx }) => listMemberAccounts(ctx.accountId)),
    permissions: companyAdminFeatureProcedure("teamManagement").input(z7.object({ id: z7.number().int().positive() })).query(async ({ ctx, input }) => {
      const members = await listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError12({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      return getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
    }),
    setPermissions: companyAdminFeatureProcedure("teamManagement").input(z7.object({
      id: z7.number().int().positive(),
      permissions: featurePermissionListSchema
    })).mutation(async ({ ctx, input }) => {
      const members = await listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError12({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      const modes = Object.fromEntries(input.permissions.map(({ featureKey, mode }) => [featureKey, mode]));
      if (target.role === "company_admin" && modes.teamManagement === "deny") {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "A permiss\xE3o de gest\xE3o da equipe n\xE3o pode ser bloqueada individualmente para um administrador da empresa." });
      }
      const base = await getCompanyEntitlementBase(ctx.accountId);
      for (const [featureKey, mode] of Object.entries(modes)) {
        if (mode === "allow" && !base.companyFeatures[featureKey]) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: `O m\xF3dulo ${featureKey} n\xE3o est\xE1 liberado para esta empresa.` });
        }
        if (mode === "allow" && !ROLE_FEATURE_CEILING[target.role].includes(featureKey)) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: `O papel ${target.role} n\xE3o permite liberar o m\xF3dulo ${featureKey}.` });
        }
      }
      const before = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
      await replaceMemberFeatureModes({ memberAccountId: target.id, modes, updatedByMemberAccountId: ctx.memberAccountId ?? null });
      const after = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role);
      void auditFromCtx(ctx, { action: "settings_change", module: "users", entityType: "user_permissions", entityId: target.id, entityLabel: target.userName, description: `Permiss\xF5es de m\xF3dulos atualizadas para ${target.userName}`, oldData: before.effective, newData: after.effective });
      return { success: true };
    }),
    create: companyAdminFeatureProcedure("teamManagement").input(z7.object({ userName: z7.string().min(2), email: z7.string().email(), password: z7.string().min(8), role: companyUserRole, storeIds: z7.array(z7.number().int().positive()).optional() })).mutation(async ({ ctx, input }) => {
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
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        console.error("[companyUsers.create] database error", { code: error?.code, errno: error?.errno, sqlMessage: error?.sqlMessage, message: error?.message });
        if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.code === "ER_NO_REFERENCED_ROW") throw new TRPCError12({ code: "BAD_REQUEST", message: "A empresa selecionada n\xE3o existe mais. Atualize a p\xE1gina e tente novamente." });
        if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "O banco de dados est\xE1 com a estrutura de usu\xE1rios desatualizada. A implanta\xE7\xE3o precisa concluir a migra\xE7\xE3o." });
        throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar o usu\xE1rio. Verifique os dados e tente novamente." });
      }
    }),
    update: companyAdminFeatureProcedure("teamManagement").input(z7.object({ id: z7.number().int().positive(), userName: z7.string().min(2).optional(), email: z7.string().email().optional(), role: companyUserRole.optional() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError12({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode remover o pr\xF3prio n\xEDvel administrativo." });
      const usersBefore = await listMemberAccounts(ctx.accountId);
      const beforeUser = usersBefore.find((u) => u.id === input.id) || null;
      await updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
      const usersAfter = await listMemberAccounts(ctx.accountId);
      const afterUser = usersAfter.find((u) => u.id === input.id) || null;
      const userDiff = diffAuditData(beforeUser, afterUser);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: input.id, entityLabel: afterUser?.userName || beforeUser?.userName || `#${input.id}`, description: `Usu\xE1rio atualizado: ${afterUser?.userName || input.id}`, oldData: userDiff.oldData, newData: userDiff.newData });
      return { success: true };
    }),
    getPromoterStores: companyAdminFeatureProcedure("teamManagement").input(z7.object({ id: z7.number().int().positive() })).query(async ({ ctx, input }) => {
      const database2 = await getDb();
      return getPromoterStoreAssignments(database2, ctx.accountId, input.id);
    }),
    updatePromoterManagement: companyAdminFeatureProcedure("teamManagement").input(z7.object({
      id: z7.number().int().positive(),
      userName: z7.string().trim().min(2).max(255),
      email: z7.string().trim().email().max(320),
      employeeCode: z7.string().trim().max(50).nullable(),
      workStartTime: z7.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      workEndTime: z7.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      weeklyRoutes: z7.array(z7.object({ weekday: z7.number().int().min(0).max(6), storeIds: z7.array(z7.number().int().positive()).min(1) })).max(7).optional(),
      storeIds: z7.array(z7.number().int().positive()).optional()
    })).mutation(async ({ ctx, input }) => {
      if (input.workStartTime && input.workEndTime && input.workEndTime <= input.workStartTime) {
        throw new TRPCError12({ code: "BAD_REQUEST", message: "O fim da jornada precisa ser posterior ao in\xEDcio." });
      }
      const usersBefore = await listMemberAccounts(ctx.accountId);
      const before = usersBefore.find((member) => member.id === input.id);
      if (!before || before.role !== "promoter") throw new TRPCError12({ code: "NOT_FOUND", message: "Promotor n\xE3o encontrado nesta empresa." });
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
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError12({ code: "CONFLICT", message: "Este e-mail ou matr\xEDcula j\xE1 est\xE1 em uso." });
        if (error?.message?.includes("n\xE3o pertence") || error?.message?.includes("inativas") || error?.message?.includes("programa\xE7\xE3o") || error?.message?.includes("dia programado")) {
          throw new TRPCError12({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
      const usersAfter = await listMemberAccounts(ctx.accountId);
      const after = usersAfter.find((member) => member.id === input.id);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "promoter_profile", entityId: input.id, entityLabel: after?.userName || before.userName, description: `Cadastro e roteiro de ${after?.userName || before.userName} atualizados`, oldData: before, newData: after });
      return { success: true };
    }),
    setActive: companyAdminFeatureProcedure("teamManagement").input(z7.object({ id: z7.number().int().positive(), active: z7.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError12({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode desativar a pr\xF3pria sess\xE3o." });
      await setMemberActive(input.id, input.active, ctx.accountId);
      void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Usu\xE1rio ${input.active ? "ativado" : "desativado"} #${input.id}`, newData: { active: input.active } });
      return { success: true };
    }),
    resetPassword: companyAdminFeatureProcedure("teamManagement").input(z7.object({ id: z7.number().int().positive(), newPassword: z7.string().min(8) })).mutation(async ({ ctx, input }) => {
      const users3 = await listMemberAccounts(ctx.accountId);
      if (!users3.some((account) => account.id === input.id)) throw new TRPCError12({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  // O dashboard é a tela básica de toda conta autenticada; módulos pagos
  // continuam usando commercialFeatureProcedure normalmente.
  companyProfile: router({
    updateName: companyAdminProcedure.input(z7.object({ name: z7.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
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
    setAutoClockOut: companyAdminFeatureProcedure("timeTracking").input(z7.object({ time: z7.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ ctx, input }) => {
      await setSetting("auto_clock_out_time", input.time || "", ctx.accountId);
      return { success: true, time: input.time || "" };
    }),
    getAlertDays: commercialFeatureProcedure("alerts").query(async ({ ctx }) => parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
    setAlertDays: companyAdminFeatureProcedure("alerts").input(z7.object({ days: z7.number().min(1).max(365) })).mutation(async ({ ctx, input }) => {
      const prev = await getSetting("alert_days_ahead", ctx.accountId, "30");
      await setSetting("alert_days_ahead", input.days.toString(), ctx.accountId);
      void auditFromCtx(ctx, { action: "settings_change", module: "settings", entityType: "setting", entityLabel: "alert_days_ahead", description: `Anteced\xEAncia de alertas alterada: ${prev} \u2192 ${input.days} dias`, oldData: { alert_days_ahead: prev }, newData: { alert_days_ahead: String(input.days) } });
      return { success: true, days: input.days };
    })
  }),
  inventoryAlerts: protectedProcedure.input(z7.object({ daysAhead: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
    if (!ctx.accountId) return [];
    const days = input?.daysAhead || 30;
    try {
      return await getExpiringInventoryProducts(ctx.accountId, days);
    } catch (error) {
      console.error("[inventoryAlerts] falha ao consultar validades", error);
      throw new TRPCError12({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel consultar as validades." });
    }
  }),
  trash: router({
    // Qualquer usuário autenticado da empresa; não-administradores só enxergam/operam o que apagaram ou é deles.
    list: companyBillingProcedure.query(({ ctx }) => listTrash(ctx.accountId, scopeMemberId(ctx))),
    restore: companyBillingProcedure.input(z7.object({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const item = await restoreTrashItem(input.id, ctx.accountId, scopeMemberId(ctx));
      void auditFromCtx(ctx, { action: "restore", module: "trash", entityType: item.itemType, entityId: item.originalId, entityLabel: item.label, description: `Restaurou da lixeira: ${item.label}` });
      return { success: true };
    }),
    permanentlyDelete: companyBillingProcedure.input(z7.object({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
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
    access: companyBillingProcedure.query(async ({ ctx }) => checkSubscriptionAccess(ctx.accountId)),
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
    mockCheckout: companyAdminProcedure.input(z7.object({
      planId: z7.number().int().positive(),
      outcome: z7.enum(["approved", "pending", "overdue", "canceled"]).default("approved")
    })).mutation(async ({ ctx, input }) => {
      const result = await applyMockCheckout({ companyId: ctx.accountId, planId: input.planId, outcome: input.outcome });
      if (input.outcome === "approved" && ctx.user.email) {
        void (async () => {
          try {
            const plans = await listSubscriptionPlans();
            const plan = plans.find((p) => p.id === input.planId);
            const company = await getCompanyById(ctx.accountId);
            const companyName = company?.name || `Empresa #${ctx.accountId}`;
            const planName = plan?.name || `Plano #${input.planId}`;
            const amount = plan?.price != null ? String(plan.price) : null;
            await emailPlanChanged({
              to: ctx.user.email,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              companyName,
              planName,
              status: "active",
              amount,
              periodEnd: result?.periodEnd || null,
              isUpgrade: true
            });
            await emailAdminPlanChanged({
              companyName,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              email: ctx.user.email,
              planName,
              status: "active",
              amount,
              isUpgrade: true
            });
          } catch (err) {
            console.warn("[email] upgrade notify failed", err);
          }
        })();
      }
      return result;
    }),
    mockCheckoutOpen: companyBillingProcedure.input(z7.object({
      planId: z7.number().int().positive(),
      outcome: z7.enum(["approved", "pending", "overdue", "canceled"]).default("approved")
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "company_admin") {
        throw new TRPCError12({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode assinar." });
      }
      const result = await applyMockCheckout({ companyId: ctx.accountId, planId: input.planId, outcome: input.outcome });
      if (input.outcome === "approved" && ctx.user.email) {
        void (async () => {
          try {
            const plans = await listSubscriptionPlans();
            const plan = plans.find((p) => p.id === input.planId);
            const planName = plan?.name || `Plano #${input.planId}`;
            const amount = plan?.price != null ? String(plan.price) : null;
            const companyName = `Empresa #${ctx.accountId}`;
            await emailPlanChanged({
              to: ctx.user.email,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              companyName,
              planName,
              status: "active",
              amount,
              isUpgrade: true
            });
            await emailAdminPlanChanged({
              companyName,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              email: ctx.user.email,
              planName,
              status: "active",
              amount,
              isUpgrade: true
            });
          } catch (err) {
            console.warn("[email] upgrade open notify failed", err);
          }
        })();
      }
      return result;
    })
  }),
  products: router({
    alertsSimple: protectedProcedure.input(z7.object({ daysAhead: z7.number().optional() }).optional()).query(async ({ ctx, input }) => {
      if (!ctx.accountId) return [];
      const days = input?.daysAhead || 30;
      try {
        return await getExpiringInventoryProducts(ctx.accountId, days);
      } catch {
        return [];
      }
    }),
    /** Descobre a descrição pelo código de barras: 1º produtos já cadastrados pela empresa, 2º bases abertas (e Cosmos, se houver token). */
    lookupByCode: companyBillingProcedure.input(z7.object({ code: z7.string().trim().min(6).max(64) })).query(async ({ ctx, input }) => {
      const { lookupProductByCode: lookupProductByCode2 } = await Promise.resolve().then(() => (init_productLookup(), productLookup_exports));
      return lookupProductByCode2(ctx.accountId, input.code);
    }),
    list: companyBillingProcedure.input(z7.object({
      search: z7.string().max(100).optional(),
      expiry: z7.enum(["all", "expired", "near", "valid"]).optional(),
      storeId: z7.number().int().positive().optional(),
      from: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
    }).optional()).query(({ ctx, input }) => listInventoryProducts(ctx.accountId, input ?? {})),
    create: companyBillingProcedure.input(productInput).mutation(async ({ ctx, input }) => {
      const storeId = await assertStoreInCompany(ctx, input.storeId);
      const product = await createInventoryProduct({ ...input, storeId, companyId: ctx.accountId, createdByMemberId: ctx.memberAccountId ?? null, expirationDate: input.expirationDate, price: input.price });
      void auditFromCtx(ctx, { action: "create", module: "products", entityType: "product", entityId: product?.id, entityLabel: input.description, description: `Cadastrou produto: ${input.description}`, newData: input });
      return product;
    }),
    update: companyBillingProcedure.input(productInput.extend({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const { id: id2, ...data } = input;
      const before = await getInventoryProduct(ctx.accountId, id2);
      if (!before) throw new TRPCError12({ code: "NOT_FOUND", message: "Produto n\xE3o encontrado." });
      const storeId = await assertStoreInCompany(ctx, data.storeId);
      const product = await updateInventoryProduct(ctx.accountId, id2, { ...data, storeId, expirationDate: data.expirationDate });
      if (product) void auditFromCtx(ctx, { action: "update", module: "products", entityType: "product", entityId: id2, entityLabel: product.description, description: `Alterou produto: ${product.description}`, oldData: before, newData: product });
      return product;
    }),
    delete: companyBillingProcedure.input(z7.object({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const before = await getInventoryProduct(ctx.accountId, input.id);
      const result = await deleteInventoryProduct(ctx.accountId, input.id, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      if (before) void auditFromCtx(ctx, { action: "delete", module: "products", entityType: "product", entityId: input.id, entityLabel: before.description, description: `Enviou produto \xE0 lixeira: ${before.description}`, oldData: before });
      return result;
    }),
    deleteMany: companyBillingProcedure.input(z7.object({ ids: z7.array(z7.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const result = await deleteInventoryProducts(ctx.accountId, input.ids, { memberId: ctx.memberAccountId ?? null, name: ctx.user?.name ?? null });
      void auditFromCtx(ctx, { action: "delete", module: "products", entityType: "product_bulk", entityLabel: `${result.deleted} produtos`, description: `Enviou ${result.deleted} produto(s) \xE0 lixeira`, newData: { productIds: input.ids, count: result.deleted } });
      return result;
    })
  }),
  operations: router({
    promoters: router({
      list: commercialFeatureProcedure("fieldOperations").query(async ({ ctx }) => {
        if (ctx.user.role === "promoter") throw new TRPCError12({ code: "FORBIDDEN", message: "Promotores n\xE3o podem consultar a lista da equipe." });
        return (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter" && member.active).map(({ id: id2, userName, role, active }) => ({ id: id2, userName, role, active }));
      })
    }),
    stores: router({
      list: commercialFeatureProcedure("fieldOperations").input(z7.object({ search: z7.string().optional() }).optional()).query(({ ctx, input }) => listOperationalStores(ctx.accountId, input?.search, scopeMemberId(ctx))),
      create: commercialFeatureProcedure("fieldOperations").input(z7.object({ name: z7.string().min(2), city: z7.string().min(2), address: z7.string().optional(), state: z7.string().length(2).optional(), cep: z7.string().optional(), code: z7.string().optional(), latitude: z7.number().optional(), longitude: z7.number().optional(), notes: z7.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError12({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem cadastrar lojas." });
        return createOperationalStore({ ...input, companyId: ctx.accountId, active: true }, ctx.memberAccountId ?? null);
      })
    }),
    routes: router({
      list: commercialFeatureProcedure("fieldOperations").input(z7.object({ date: z7.string().optional(), promoterId: z7.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        const date3 = input?.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
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
      weekly: commercialFeatureProcedure("fieldOperations").query(({ ctx }) => listWeeklyRouteSchedules(ctx.accountId)),
      saveWeekly: companyAdminProcedure.input(z7.object({ name: z7.string().min(2).max(255), weekday: z7.number().int().min(0).max(6), promoterId: z7.number().int().positive(), storeIds: z7.array(z7.number().int().positive()).min(1) })).mutation(async ({ ctx, input }) => {
        const members = await listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError12({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        return saveWeeklyRouteSchedule({ ...input, companyId: ctx.accountId });
      }),
      create: commercialFeatureProcedure("fieldOperations").input(z7.object({ name: z7.string().min(2), date: z7.string().min(8), promoterId: z7.number().int().positive(), storeIds: z7.array(z7.number().int().positive()).min(1), teamId: z7.number().int().positive().optional(), notes: z7.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError12({ code: "FORBIDDEN", message: "Promotores n\xE3o podem criar roteiros." });
        const members = await listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError12({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        const { storeIds, ...route } = input;
        return createOperationalRouteWithVisits({ route: { ...route, date: /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`), companyId: ctx.accountId, status: "assigned" }, storeIds });
      }),
      update: companyAdminProcedure.input(z7.object({ id: z7.number().int().positive(), name: z7.string().optional(), promoterId: z7.number().int().positive().optional(), date: z7.string().optional(), storeIds: z7.array(z7.number().int().positive()).optional() })).mutation(async ({ ctx, input }) => {
        const { id: id2, ...data } = input;
        return updateOperationalRoute(ctx.accountId, id2, data);
      }),
      delete: companyAdminProcedure.input(z7.object({ id: z7.number().int().positive() })).mutation(async ({ ctx, input }) => {
        return deleteOperationalRoute(ctx.accountId, input.id);
      })
    }),
    visits: router({
      today: commercialFeatureProcedure("fieldOperations").input(z7.object({ date: z7.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional()).query(async ({ ctx, input }) => {
        const date3 = input?.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
        const promoterId = scopeMemberId(ctx) ?? void 0;
        if (promoterId) await materializeWeeklyRoutes(ctx.accountId, promoterId, date3);
        return listOperationalVisits(ctx.accountId, { date: date3, promoterId: promoterId ?? void 0 });
      }),
      list: commercialFeatureProcedure("fieldOperations").input(z7.object({ date: z7.string().optional(), routeId: z7.number().int().positive().optional(), promoterId: z7.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listOperationalVisits(ctx.accountId, { date: input?.date, routeId: input?.routeId, promoterId: scopeMemberId(ctx) ?? input?.promoterId })),
      start: commercialFeatureProcedure("fieldOperations").input(z7.object({ id: z7.number().int().positive(), latitude: z7.number().optional(), longitude: z7.number().optional(), accuracy: z7.number().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await listOperationalVisits(ctx.accountId, { promoterId: scopeMemberId(ctx) ?? void 0 });
        const owned = visit.find((row2) => row2.visit.id === input.id);
        if (!owned) throw new TRPCError12({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        if (scopeMemberId(ctx) !== null && owned.visit.promoterId !== ctx.memberAccountId) throw new TRPCError12({ code: "FORBIDDEN", message: "Visita n\xE3o pertence ao promotor autenticado." });
        return updateOperationalVisit(ctx.accountId, input.id, { status: "in_progress", actualStart: /* @__PURE__ */ new Date(), startLatitude: input.latitude, startLongitude: input.longitude, startAccuracy: input.accuracy });
      }),
      complete: commercialFeatureProcedure("fieldOperations").input(z7.object({ id: z7.number().int().positive(), latitude: z7.number().optional(), longitude: z7.number().optional(), accuracy: z7.number().optional(), notes: z7.string().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await listOperationalVisits(ctx.accountId, { promoterId: scopeMemberId(ctx) ?? void 0 });
        const owned = visit.find((row2) => row2.visit.id === input.id);
        if (!owned) throw new TRPCError12({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        return updateOperationalVisit(ctx.accountId, input.id, { status: "completed", actualEnd: /* @__PURE__ */ new Date(), endLatitude: input.latitude, endLongitude: input.longitude, endAccuracy: input.accuracy, notes: input.notes });
      })
    })
  }),
  audit: router({
    promoters: companyAdminFeatureProcedure("reports").query(
      async ({ ctx }) => (await listMemberAccounts(ctx.accountId)).filter((member) => member.role === "promoter").map(({ id: id2, userName, email, active }) => ({ id: id2, userName, email, active }))
    ),
    reverseGeocodePoint: companyAdminFeatureProcedure("reports").input(z7.object({ latitude: z7.number().min(-90).max(90), longitude: z7.number().min(-180).max(180) })).mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
    promoterActivity: companyAdminFeatureProcedure("reports").input(z7.object({
      page: z7.number().int().positive().optional(),
      pageSize: z7.number().int().positive().max(100).optional(),
      from: z7.string().optional(),
      to: z7.string().optional(),
      promoterId: z7.number().int().positive().optional(),
      category: z7.string().optional(),
      search: z7.string().optional()
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
    promoterActivityExportCsv: companyAdminFeatureProcedure("reports").input(z7.object({
      from: z7.string().optional(),
      to: z7.string().optional(),
      promoterId: z7.number().int().positive().optional(),
      category: z7.string().optional(),
      search: z7.string().optional()
    }).optional()).mutation(async ({ ctx, input }) => {
      const result = await listPromoterActivities({ companyId: ctx.accountId, page: 1, pageSize: 1e4, ...input });
      const headers = ["Data/hora", "Promotor", "E-mail", "Atividade", "\xC1rea", "Registro", "Descri\xE7\xE3o", "Detalhes"];
      const values = result.items.map((row2) => [row2.occurredAt, row2.userName, row2.userEmail, row2.action, row2.module, row2.entityLabel, row2.description, typeof row2.details === "string" ? row2.details : JSON.stringify(row2.details ?? {})]);
      const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
      const csv = `\uFEFF${[headers, ...values].map((line) => line.map(cell).join(";")).join("\r\n")}`;
      return { csv, contentType: "text/csv; charset=utf-8", filename: `atividades-promotores-${ctx.accountId}.csv` };
    }),
    list: companyAdminFeatureProcedure("reports").input(z7.object({
      page: z7.number().int().positive().optional(),
      pageSize: z7.number().int().positive().max(100).optional(),
      from: z7.string().optional(),
      to: z7.string().optional(),
      userId: z7.number().int().positive().optional(),
      module: z7.string().optional(),
      action: z7.string().optional(),
      entityType: z7.string().optional(),
      entityId: z7.number().int().positive().optional(),
      search: z7.string().optional()
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
    byId: companyAdminFeatureProcedure("reports").input(z7.object({ id: z7.number().int().positive() })).query(async ({ ctx, input }) => {
      const row2 = await getAuditLogById(input.id, ctx.accountId);
      if (!row2) throw new TRPCError12({ code: "NOT_FOUND", message: "Registro de auditoria n\xE3o encontrado." });
      return row2;
    }),
    entityHistory: commercialFeatureProcedure("reports").input(z7.object({
      entityType: z7.string().min(1),
      entityId: z7.number().int().positive(),
      page: z7.number().int().positive().optional(),
      pageSize: z7.number().int().positive().max(100).optional()
    })).query(async ({ ctx, input }) => listEntityAuditHistory({
      companyId: ctx.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      page: input.page,
      pageSize: input.pageSize
    })),
    exportCsv: companyAdminFeatureProcedure("reports").input(z7.object({
      from: z7.string().optional(),
      to: z7.string().optional(),
      userId: z7.number().int().positive().optional(),
      module: z7.string().optional(),
      action: z7.string().optional(),
      entityType: z7.string().optional(),
      entityId: z7.number().int().positive().optional(),
      search: z7.string().optional()
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
    platformList: platformProcedure.input(z7.object({
      companyId: z7.number().int().positive().optional(),
      page: z7.number().int().positive().optional(),
      pageSize: z7.number().int().positive().max(100).optional(),
      from: z7.string().optional(),
      to: z7.string().optional(),
      module: z7.string().optional(),
      action: z7.string().optional(),
      search: z7.string().optional()
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
  const queryToken = String(opts.req.query?.token || "").trim();
  const sessionToken = cookies[MEMBER_COOKIE_NAME] || headerToken || queryToken || "";
  if (!sessionToken) {
    console.log("[auth] no session token received", { hasCookie: Boolean(cookies[MEMBER_COOKIE_NAME]), hasHeader: Boolean(headerToken), hasQuery: Boolean(queryToken) });
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
    const { runBackupStep: runBackupStep2 } = await Promise.resolve().then(() => (init_backup(), backup_exports));
    const backup = await runBackupStep2(connection, { budgetMs: Number(process.env.BACKUP_BUDGET_MS || 18e3) });
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
    return { backup, cleaned: { trash: trash.affectedRows, visitPhotos: visitPhotos2.affectedRows, memberSessions: memberSessions3.affectedRows, platformSessions: platformSessions3.affectedRows, ...retention }, expiredPhotos };
  } finally {
    await connection.end();
  }
}
async function purgeOldAuditLogs(connection) {
  const general = Math.max(90, Number(process.env.AUDIT_RETENTION_DAYS || 730));
  const timeDays = Math.max(general, Number(process.env.AUDIT_RETENTION_TIME_DAYS || 1825));
  let auditLogs3 = 0;
  try {
    for (let i = 0; i < 10; i++) {
      const [r] = await connection.query(
        `DELETE FROM audit_logs WHERE (module <> 'time_tracking' AND createdAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) OR (module = 'time_tracking' AND createdAt < DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)) LIMIT 5000`,
        [general, timeDays]
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
  const { and: and9, eq: eq10 } = await import("drizzle-orm");
  const { memberAccounts: memberAccounts3 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const { sendEmail: sendEmail2 } = await Promise.resolve().then(() => (init_email(), email_exports));
  const missing = await findMissingPunches2();
  let notified = 0;
  for (const m of missing) {
    const key = `missing_punch_notified:${m.memberId}:${m.day}`;
    if (await dbm.getSetting(key, m.companyId, "")) continue;
    const when = new Date(m.lastTime).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
    const detail = `\xDAltima marca\xE7\xE3o: ${m.lastLabel} em ${when}. Falta registrar: ${m.missing}.`;
    try {
      if (m.email) {
        await sendEmail2({ to: m.email, subject: "Falta de batida no cart\xE3o ponto", text: `${detail} Abra o app, v\xE1 em Cart\xE3o ponto > Corre\xE7\xF5es de ponto e solicite a corre\xE7\xE3o com a justificativa.`, html: `<p>${detail}</p><p>Abra o app, v\xE1 em <b>Cart\xE3o ponto &gt; Corre\xE7\xF5es de ponto</b> e solicite a corre\xE7\xE3o com a justificativa.</p>` });
        notified += 1;
      }
      const admins = await database2.select({ email: memberAccounts3.email }).from(memberAccounts3).where(and9(eq10(memberAccounts3.companyId, m.companyId), eq10(memberAccounts3.role, "company_admin"), eq10(memberAccounts3.active, true)));
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
      `SELECT id, fileKey, thumbnailKey FROM store_photos WHERE expiresAt <= UTC_TIMESTAMP() LIMIT 200`
    );
    const { storageDelete: storageDelete2 } = await Promise.resolve().then(() => (init_storage(), storage_exports));
    for (const photo of expired || []) {
      try {
        if (photo.fileKey) await storageDelete2(photo.fileKey);
        if (photo.thumbnailKey) await storageDelete2(photo.thumbnailKey);
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
import crypto3 from "node:crypto";
async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(compression());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/scheduled/database-maintenance", async (req, res) => {
    try {
      const configuredSecret = process.env.SCHEDULE_SECRET;
      const suppliedSecret = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-schedule-secret"];
      if (!configuredSecret || typeof suppliedSecret !== "string" || suppliedSecret.length !== configuredSecret.length || !crypto3.timingSafeEqual(Buffer.from(suppliedSecret), Buffer.from(configuredSecret))) {
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
      return res.json({ ok: true, result, missingPunch, photos });
    } catch (error) {
      console.error("[Maintenance] failed:", error);
      await notifyOwner({ title: "Falha no backup di\xE1rio", content: "O backup autom\xE1tico falhou." }).catch(() => void 0);
      return res.status(500).json({ error: "Scheduled maintenance failed" });
    }
  });
  app.post("/api/webhooks/asaas", express.json(), async (req, res) => {
    try {
      const token = process.env.ASAAS_WEBHOOK_TOKEN || "";
      const headerToken = String(req.headers["asaas-access-token"] || req.headers["x-asaas-token"] || "");
      if (token && headerToken && token !== headerToken) {
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
