var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
      expiresAt: timestamp("expiresAt").notNull()
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
      featureDashboard: boolean("featureDashboard").notNull().default(false),
      featureClients: boolean("featureClients").notNull().default(false),
      featureExtinguishers: boolean("featureExtinguishers").notNull().default(false),
      featureServiceOrders: boolean("featureServiceOrders").notNull().default(false),
      featureAlerts: boolean("featureAlerts").notNull().default(false),
      featureReports: boolean("featureReports").notNull().default(false),
      featureUsers: boolean("featureUsers").notNull().default(false),
      featureBackup: boolean("featureBackup").notNull().default(false),
      featureOfflinePwa: boolean("featureOfflinePwa").notNull().default(false),
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

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
      isProduction: process.env.NODE_ENV === "production",
      scheduleSecret: process.env.SCHEDULE_SECRET ?? "",
      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL ?? "",
      asaasEnvironment: process.env.ASAAS_ENVIRONMENT ?? "mock",
      asaasApiUrl: process.env.ASAAS_API_URL ?? "https://api.asaas.com/v3",
      resendApiKey: process.env.RESEND_API_KEY ?? "",
      emailFrom: process.env.EMAIL_FROM ?? "Extinfy <onboarding@resend.dev>",
      adminNotificationEmail: process.env.ADMIN_NOTIFICATION_EMAIL ?? "ivan.honemann@gmail.com",
      appPublicUrl: process.env.APP_PUBLIC_URL ?? "https://gestao-de-extintores-teste.vercel.app"
    };
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
  companySubscriptions: () => companySubscriptions2,
  evidences: () => evidences,
  memberAccounts: () => memberAccounts2,
  memberSessions: () => memberSessions2,
  platformAdmins: () => platformAdmins2,
  platformSessions: () => platformSessions2,
  retailChains: () => retailChains,
  routes: () => routes,
  stores: () => stores,
  subscriptionPlans: () => subscriptionPlans2,
  systemSettings: () => systemSettings2,
  teams: () => teams,
  timeCorrectionRequests: () => timeCorrectionRequests,
  timeEvents: () => timeEvents,
  users: () => users2,
  visits: () => visits
});
import { boolean as boolean2, date as date2, decimal as decimal2, index as index2, int as int2, mysqlEnum as mysqlEnum2, mysqlTable as mysqlTable2, text as text2, timestamp as timestamp2, uniqueIndex as uniqueIndex2, varchar as varchar2, double } from "drizzle-orm/mysql-core";
var users2, companies2, platformAdmins2, memberAccounts2, memberSessions2, platformSessions2, clients2, brands, retailChains, stores, teams, routes, visits, timeEvents, timeCorrectionRequests, checklists, checklistQuestions, checklistResponses, evidences, auditLogs2, subscriptionPlans2, companySubscriptions2, systemSettings2;
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
      employeeCode: varchar2("employeeCode", { length: 50 }),
      phone: varchar2("phone", { length: 50 }),
      supervisorId: int2("supervisorId"),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      companyIdx: index2("member_accounts_company_idx").on(table.companyId),
      companyRoleIdx: index2("member_accounts_company_role_idx").on(table.companyId, table.role),
      employeeCodeIdx: index2("member_accounts_employee_code_idx").on(table.companyId, table.employeeCode)
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
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      companyIdx: index2("routes_company_idx").on(table.companyId),
      promoterDateIdx: index2("routes_promoter_date_idx").on(table.promoterId, table.date),
      dateIdx: index2("routes_company_date_idx").on(table.companyId, table.date)
    }));
    visits = mysqlTable2("visits", {
      id: int2("id").autoincrement().primaryKey(),
      companyId: int2("companyId").notNull().references(() => companies2.id, { onDelete: "restrict" }),
      routeId: int2("routeId").references(() => routes.id, { onDelete: "cascade" }),
      storeId: int2("storeId").notNull().references(() => stores.id, { onDelete: "restrict" }),
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
      maxPromoters: int2("maxPromoters"),
      maxStores: int2("maxStores"),
      maxClients: int2("maxClients"),
      featureDashboard: boolean2("featureDashboard").notNull().default(true),
      featureTimeTracking: boolean2("featureTimeTracking").notNull().default(true),
      featureRoutes: boolean2("featureRoutes").notNull().default(true),
      featureChecklists: boolean2("featureChecklists").notNull().default(true),
      featureReports: boolean2("featureReports").notNull().default(true),
      featureOffline: boolean2("featureOffline").notNull().default(true),
      availableForNew: boolean2("availableForNew").notNull().default(true),
      active: boolean2("active").notNull().default(true),
      createdAt: timestamp2("createdAt").defaultNow().notNull(),
      updatedAt: timestamp2("updatedAt").defaultNow().onUpdateNow().notNull()
    }, (table) => ({
      nameIdx: index2("subscription_plans_name_idx").on(table.name),
      availableIdx: index2("subscription_plans_available_idx").on(table.availableForNew, table.active)
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
  }
});

// server/db.ts
var db_exports = {};
__export(db_exports, {
  applyMockCheckout: () => applyMockCheckout,
  backfillExtinguisherPublicTokens: () => backfillExtinguisherPublicTokens,
  buildExtinguisherPublicUrl: () => buildExtinguisherPublicUrl,
  cleanupExpiredData: () => cleanupExpiredData,
  createClient: () => createClient,
  createCompany: () => createCompany,
  createCompanySubscription: () => createCompanySubscription,
  createExtinguisher: () => createExtinguisher,
  createOperationalRoute: () => createOperationalRoute,
  createOperationalRouteWithVisits: () => createOperationalRouteWithVisits,
  createOperationalStore: () => createOperationalStore,
  createPaymentRecord: () => createPaymentRecord,
  createServiceOrder: () => createServiceOrder,
  createSubscriptionPlan: () => createSubscriptionPlan,
  deleteClient: () => deleteClient,
  deleteExtinguisher: () => deleteExtinguisher,
  deleteServiceOrder: () => deleteServiceOrder,
  ensureExtinguisherPublicToken: () => ensureExtinguisherPublicToken,
  ensureOwnerScopeColumns: () => ensureOwnerScopeColumns,
  ensureSeedPlans: () => ensureSeedPlans,
  findPaymentEventByEventId: () => findPaymentEventByEventId,
  generateExtinguisherPublicToken: () => generateExtinguisherPublicToken,
  getClientById: () => getClientById,
  getClients: () => getClients,
  getClientsPage: () => getClientsPage,
  getCompanyById: () => getCompanyById,
  getDashboardStats: () => getDashboardStats,
  getDb: () => getDb,
  getDistinctCities: () => getDistinctCities,
  getExpiringExtinguishers: () => getExpiringExtinguishers,
  getExpiringExtinguishersPage: () => getExpiringExtinguishersPage,
  getExtinguisherById: () => getExtinguisherById,
  getExtinguishers: () => getExtinguishers,
  getExtinguishersByClient: () => getExtinguishersByClient,
  getExtinguishersPage: () => getExtinguishersPage,
  getLatestCompanySubscription: () => getLatestCompanySubscription,
  getNextOrderNumber: () => getNextOrderNumber,
  getOfflineSnapshot: () => getOfflineSnapshot,
  getPlatformClients: () => getPlatformClients,
  getPlatformDashboardStats: () => getPlatformDashboardStats,
  getPlatformExtinguishers: () => getPlatformExtinguishers,
  getPlatformOrders: () => getPlatformOrders,
  getPool: () => getPool,
  getPublicExtinguisherByToken: () => getPublicExtinguisherByToken,
  getServiceOrderById: () => getServiceOrderById,
  getServiceOrderHistory: () => getServiceOrderHistory,
  getServiceOrders: () => getServiceOrders,
  getServiceOrdersPage: () => getServiceOrdersPage,
  getSetting: () => getSetting,
  getSubscriptionPlanById: () => getSubscriptionPlanById,
  getSubscriptionStats: () => getSubscriptionStats,
  getUserByOpenId: () => getUserByOpenId,
  listAllPayments: () => listAllPayments,
  listAvailablePlansForCompanies: () => listAvailablePlansForCompanies,
  listCompanies: () => listCompanies,
  listCompanySubscriptions: () => listCompanySubscriptions,
  listOperationalRoutes: () => listOperationalRoutes,
  listOperationalStores: () => listOperationalStores,
  listOperationalVisits: () => listOperationalVisits,
  listPaymentsForCompany: () => listPaymentsForCompany,
  listSubscriptionPlans: () => listSubscriptionPlans,
  listTrash: () => listTrash,
  permanentlyDeleteTrashItem: () => permanentlyDeleteTrashItem,
  recordPaymentEvent: () => recordPaymentEvent,
  resolveCompanyPlan: () => resolveCompanyPlan,
  restoreTrashItem: () => restoreTrashItem,
  setSetting: () => setSetting,
  updateClient: () => updateClient,
  updateCompany: () => updateCompany,
  updateCompanySubscription: () => updateCompanySubscription,
  updateCompanySubscriptionFields: () => updateCompanySubscriptionFields,
  updateExtinguisher: () => updateExtinguisher,
  updateOperationalVisit: () => updateOperationalVisit,
  updateServiceOrder: () => updateServiceOrder,
  updateSubscriptionPlan: () => updateSubscriptionPlan,
  upsertUser: () => upsertUser
});
import { and, desc, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { nanoid } from "nanoid";
function generateExtinguisherPublicToken() {
  return nanoid(21);
}
function buildExtinguisherPublicUrl(token) {
  const base = (ENV.appPublicUrl || "").replace(/\/$/, "");
  return `${base}/e/${token}`;
}
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
  const pool = await getPool();
  if (!pool) return;
  try {
    await pool.query("ALTER TABLE `clients` ADD COLUMN `createdByUserId` int NULL").catch(() => void 0);
    await pool.query("ALTER TABLE `service_orders` ADD COLUMN `createdByUserId` int NULL").catch(() => void 0);
    await pool.query("ALTER TABLE `extinguishers` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => void 0);
    await pool.query("ALTER TABLE `clients` ADD COLUMN `stockQuantity` int NOT NULL DEFAULT 1").catch(() => void 0);
    ownerScopeReady = true;
  } catch (err) {
    console.warn("[db] ensureOwnerScopeColumns", err);
    ownerScopeReady = true;
  }
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
function pageArgs(page = 1, pageSize = 25) {
  const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize || 25)));
  const safePage = Math.max(1, Math.trunc(page || 1));
  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize };
}
function pageResult(items, total, page, pageSize) {
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
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
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function listCompanies() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(companies).orderBy(companies.name);
}
async function getPlatformDashboardStats(companyId, options = {}) {
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
    db.select({ total: sql`count(*)` }).from(clients).where(clientWhere),
    db.select({ total: sql`count(distinct ${clients.city})` }).from(clients).where(clientWhere),
    db.select({ total: sql`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(extinguisherWhere),
    db.select({ total: sql`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(extinguisherWhere, sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
    db.select({ total: sql`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(orderWhere)
  ]);
  return {
    totalClients: Number(clientCountRows[0]?.total || 0),
    totalCities: Number(cityCountRows[0]?.total || 0),
    totalExtinguishers: Number(extinguisherCountRows[0]?.total || 0),
    nearExpirationCount: Number(nearRows[0]?.total || 0),
    expiredCount: Number(expiredRows[0]?.total || 0),
    totalOrders: Number(orderCountRows[0]?.total || 0),
    alertDaysConfig: daysAhead
  };
}
async function getCompanyById(id) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result[0];
}
async function createCompany(name) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.insert(companies).values({ name: name.trim(), active: true });
  return Number(result[0].insertId);
}
async function updateCompany(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set({ ...data, name: data.name?.trim() }).where(eq(companies.id, id));
}
async function getPlatformClients(companyId) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(clients).where(eq(clients.accountId, companyId)).orderBy(desc(clients.createdAt)) : await db.select().from(clients).orderBy(desc(clients.createdAt));
}
async function getPlatformExtinguishers(companyId) {
  const db = await getDb();
  if (!db) return [];
  return companyId ? await db.select().from(extinguishers).where(eq(extinguishers.accountId, companyId)).orderBy(extinguishers.expirationDate) : await db.select().from(extinguishers).orderBy(extinguishers.expirationDate);
}
async function getPlatformOrders(companyId) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return companyId ? await query.where(eq(serviceOrders.accountId, companyId)).orderBy(desc(serviceOrders.createdAt)) : await query.orderBy(desc(serviceOrders.createdAt));
}
async function getClientsPage(accountId, options = {}) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const search = options.search?.trim();
  const conditions = [eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.ownerUserId != null) conditions.push(eq(clients.createdByUserId, options.ownerUserId));
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.cnpj, `%${search}%`), like(clients.contactName, `%${search}%`)));
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select().from(clients).where(where).orderBy(desc(clients.createdAt), desc(clients.id)).limit(pageSize).offset(offset),
    db.select({ total: sql`count(*)` }).from(clients).where(where)
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}
async function getClients(cityFilter, accountId, ownerUserId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(clients.accountId, tenant)];
  if (cityFilter && cityFilter !== "TODAS") conditions.push(eq(clients.city, cityFilter));
  if (ownerUserId != null) conditions.push(eq(clients.createdByUserId, ownerUserId));
  return await db.select().from(clients).where(and(...conditions)).orderBy(desc(clients.createdAt)).limit(500);
}
async function getClientById(id, accountId, ownerUserId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return void 0;
  const conditions = [eq(clients.id, id), eq(clients.accountId, tenant)];
  if (ownerUserId != null) conditions.push(eq(clients.createdByUserId, ownerUserId));
  const result = await db.select().from(clients).where(and(...conditions)).limit(1);
  return result[0];
}
async function createClient(data) {
  const tenant = requireAccountId(data.accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const optional = ["cnpj", "address", "cep", "phone", "contactName", "cpf", "birthDate", "notes"];
  const payload = { ...data, accountId: tenant, stockQuantity: Number(data.stockQuantity) > 0 ? Number(data.stockQuantity) : 1 };
  for (const key of optional) if (payload[key] === "") payload[key] = null;
  const result = await db.insert(clients).values(payload);
  return Number(result[0].insertId);
}
async function updateClient(id, data, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente n\xE3o encontrado ou sem permiss\xE3o");
  const { accountId: ignoredAccountId, ...safeData } = data;
  void ignoredAccountId;
  await db.update(clients).set(safeData).where(and(eq(clients.id, id), eq(clients.accountId, tenant)));
}
async function deleteClient(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const client = await getClientById(id, tenant);
  if (!client) throw new Error("Cliente n\xE3o encontrado ou sem permiss\xE3o");
  const clientOrders = await db.select().from(serviceOrders).where(and(eq(serviceOrders.clientId, id), eq(serviceOrders.accountId, tenant)));
  const orderIds = clientOrders.map((order) => order.id);
  const clientExtinguishers = await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, id), eq(extinguishers.accountId, tenant)));
  const orderItems = orderIds.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, orderIds)) : [];
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
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
async function getDistinctCities(accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ city: clients.city }).from(clients).where(eq(clients.accountId, tenant)).orderBy(clients.city);
  return result.map((row2) => row2.city).filter(Boolean);
}
async function getExtinguishersPage(accountId, options = {}) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant)];
  const search = options.search?.trim();
  if (options.clientId) conditions.push(eq(extinguishers.clientId, options.clientId));
  if (search) conditions.push(or(like(extinguishers.typeModel, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`), like(extinguishers.locationInBuilding, `%${search}%`)));
  if (options.filter === "active") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE()`);
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY)`);
  const where = and(...conditions);
  const [items, totalRows] = await Promise.all([
    db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(and(where, eq(clients.accountId, tenant))).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset),
    db.select({ total: sql`count(*)` }).from(extinguishers).where(where)
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}
async function getExtinguishers(accountId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(extinguishers).where(eq(extinguishers.accountId, tenant)).orderBy(extinguishers.expirationDate).limit(500);
}
async function getExtinguisherById(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return void 0;
  const rows = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  return rows[0];
}
async function getExtinguishersByClient(clientId, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  if (!await getClientById(clientId, tenant)) return [];
  return await db.select().from(extinguishers).where(and(eq(extinguishers.clientId, clientId), eq(extinguishers.accountId, tenant))).orderBy(extinguishers.expirationDate);
}
async function createExtinguisher(data, accountId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  if (data.accountId !== tenant || !await getClientById(data.clientId, tenant)) throw new Error("Cliente sem permiss\xE3o");
  const publicToken = data.publicToken?.trim() || generateExtinguisherPublicToken();
  const result = await db.insert(extinguishers).values({ ...data, accountId: tenant, publicToken });
  return Number(result[0].insertId);
}
async function ensureExtinguisherPublicToken(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  const row2 = rows[0];
  if (!row2) throw new Error("Extintor sem permiss\xE3o");
  if (row2.publicToken) return row2.publicToken;
  const token = generateExtinguisherPublicToken();
  await db.update(extinguishers).set({ publicToken: token }).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant), isNull(extinguishers.publicToken)));
  const after = await db.select({ publicToken: extinguishers.publicToken }).from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  return after[0]?.publicToken || token;
}
async function backfillExtinguisherPublicTokens(accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const missing = await db.select({ id: extinguishers.id }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), or(isNull(extinguishers.publicToken), eq(extinguishers.publicToken, ""))));
  let updated = 0;
  for (const row2 of missing) {
    const token = generateExtinguisherPublicToken();
    await db.update(extinguishers).set({ publicToken: token }).where(and(eq(extinguishers.id, row2.id), eq(extinguishers.accountId, tenant)));
    updated += 1;
  }
  return { updated };
}
async function getPublicExtinguisherByToken(token) {
  const clean = (token || "").trim();
  if (!clean || clean.length < 10 || clean.length > 32) return null;
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({
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
    companyName: companies.name
  }).from(extinguishers).innerJoin(clients, and(eq(clients.id, extinguishers.clientId), eq(clients.accountId, extinguishers.accountId))).innerJoin(companies, eq(companies.id, extinguishers.accountId)).where(eq(extinguishers.publicToken, clean)).limit(1);
  const row2 = rows[0];
  if (!row2) return null;
  return {
    id: row2.id,
    publicToken: row2.publicToken,
    typeModel: row2.typeModel,
    capacity: row2.capacity,
    serialNumber: row2.serialNumber,
    locationInBuilding: row2.locationInBuilding,
    expirationDate: row2.expirationDate,
    lastInspectionDate: row2.lastInspectionDate,
    status: row2.status,
    notes: row2.notes,
    clientName: row2.clientName,
    clientCity: row2.clientCity,
    companyName: row2.companyName,
    companyPhone: row2.clientPhone,
    // contato do cliente/unidade (útil para a equipe em campo)
    _internalId: row2.id,
    _accountId: row2.accountId
  };
}
async function updateExtinguisher(id, data, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permiss\xE3o");
  const { accountId: ignoredAccountId, clientId: ignoredClientId, ...safeData } = data;
  void ignoredAccountId;
  void ignoredClientId;
  await db.update(extinguishers).set(safeData).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
}
async function deleteExtinguisher(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await db.select().from(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant))).limit(1);
  if (!existing[0]) throw new Error("Extintor sem permiss\xE3o");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "extinguisher", originalId: id, label: `${existing[0].typeModel} \u2014 ${existing[0].serialNumber || "sem selo"}`, snapshot: JSON.stringify(existing[0]), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3) });
    await tx.delete(extinguishers).where(and(eq(extinguishers.id, id), eq(extinguishers.accountId, tenant)));
  });
}
async function getExpiringExtinguishers(daysAhead, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId))).where(and(eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant), sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)).orderBy(extinguishers.expirationDate).limit(300);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  return result.map((item) => {
    const expDate = new Date(item.extinguisher.expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / 864e5);
    let alertStatus = "ok";
    let alertMessage = "";
    if (diffDays < 0) {
      alertStatus = "expired";
      alertMessage = `VENCIDO h\xE1 ${Math.abs(diffDays)} dia(s)!`;
    } else if (diffDays <= 15) {
      alertStatus = "urgent";
      alertMessage = diffDays === 0 ? "VENCE HOJE!" : `Vence em ${diffDays} dia(s) (Urgente)`;
    } else if (diffDays <= daysAhead) {
      alertStatus = "warning";
      alertMessage = `Vence em ${diffDays} dia(s) (Alerta pr\xE9vio)`;
    }
    return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: diffDays <= daysAhead };
  });
}
async function getServiceOrdersPage(accountId, options = {}) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.ownerUserId != null) conditions.push(eq(serviceOrders.createdByUserId, options.ownerUserId));
  if (options.clientId) conditions.push(eq(serviceOrders.clientId, options.clientId));
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.from) conditions.push(sql`${serviceOrders.orderDate} >= ${options.from}`);
  if (options.to) conditions.push(sql`${serviceOrders.orderDate} <= ${options.to}`);
  const search = options.search?.trim();
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(sql`CAST(${serviceOrders.orderNumber} AS CHAR)`, `%${search}%`)));
  const where = and(...conditions);
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  const [items, totalRows] = await Promise.all([
    query.where(where).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt), desc(serviceOrders.id)).limit(pageSize).offset(offset),
    db.select({ total: sql`count(*)` }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(where)
  ]);
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}
async function getOfflineSnapshot(accountId, options = {}) {
  const tenant = requireAccountId(accountId);
  const page = Math.max(1, Math.trunc(options.page || 1));
  const pageSize = Math.min(100, Math.max(10, Math.trunc(options.pageSize || 50)));
  const [clientsPage, extinguishersPage, ordersPage, alertsPage] = await Promise.all([
    getClientsPage(tenant, { page, pageSize }),
    getExtinguishersPage(tenant, { page, pageSize }),
    getServiceOrdersPage(tenant, { page, pageSize }),
    getExpiringExtinguishersPage(30, tenant, { page, pageSize, filter: "all" })
  ]);
  return {
    page,
    pageSize,
    clients: clientsPage.items,
    extinguishers: extinguishersPage.items.map((row2) => row2.extinguisher),
    orders: ordersPage.items,
    alerts: alertsPage.items.map((row2) => ({ ...row2.extinguisher, ...row2 })),
    totals: { clients: clientsPage.total, extinguishers: extinguishersPage.total, orders: ordersPage.total, alerts: alertsPage.total },
    hasMore: { clients: page < clientsPage.totalPages, extinguishers: page < extinguishersPage.totalPages, orders: page < ordersPage.totalPages, alerts: page < alertsPage.totalPages }
  };
}
async function getExpiringExtinguishersPage(daysAhead, accountId, options = {}) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return pageResult([], 0, 1, 25);
  const { page, pageSize, offset } = pageArgs(options.page, options.pageSize);
  const conditions = [eq(extinguishers.accountId, tenant), eq(clients.accountId, tenant)];
  if (options.city && options.city !== "TODAS") conditions.push(eq(clients.city, options.city));
  if (options.filter === "expired") conditions.push(sql`${extinguishers.expirationDate} < CURRENT_DATE()`);
  if (options.filter === "near") conditions.push(sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  if (options.filter === "all") conditions.push(sql`${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`);
  const search = options.search?.trim();
  if (search) conditions.push(or(like(clients.companyName, `%${search}%`), like(clients.city, `%${search}%`), like(extinguishers.serialNumber, `%${search}%`)));
  const where = and(...conditions);
  const query = db.select({ extinguisher: extinguishers, client: clients }).from(extinguishers).innerJoin(clients, and(eq(extinguishers.clientId, clients.id), eq(extinguishers.accountId, clients.accountId)));
  const [rows, totalRows] = await Promise.all([query.where(where).orderBy(extinguishers.expirationDate, desc(extinguishers.id)).limit(pageSize).offset(offset), db.select({ total: sql`count(*)` }).from(extinguishers).innerJoin(clients, eq(extinguishers.clientId, clients.id)).where(where)]);
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const items = rows.map((item) => {
    const expiration = new Date(item.extinguisher.expirationDate);
    expiration.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiration.getTime() - today.getTime()) / 864e5);
    const alertStatus = diffDays < 0 ? "expired" : diffDays <= 15 ? "urgent" : "warning";
    const alertMessage = diffDays < 0 ? `VENCIDO h\xE1 ${Math.abs(diffDays)} dia(s)!` : diffDays === 0 ? "VENCE HOJE!" : diffDays <= 15 ? `Vence em ${diffDays} dia(s) (Urgente)` : `Vence em ${diffDays} dia(s) (Alerta pr\xE9vio)`;
    return { ...item, diffDays, alertStatus, alertMessage, isNearExpiration: true };
  });
  return pageResult(items, Number(totalRows[0]?.total || 0), page, pageSize);
}
async function getNextOrderNumber(accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return 1001;
  const result = await db.select({ maxNum: sql`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  return result[0]?.maxNum ? Number(result[0].maxNum) + 1 : 1001;
}
async function allocateOrderNumber(tx, tenant) {
  const maxRows = await tx.select({ maxNum: sql`MAX(${serviceOrders.orderNumber})` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant));
  const currentMax = Math.max(1e3, Number(maxRows[0]?.maxNum || 1e3));
  await tx.insert(systemSettings).values({ accountId: tenant, settingKey: "order_sequence", settingValue: String(currentMax) }).onDuplicateKeyUpdate({
    set: { updatedAt: /* @__PURE__ */ new Date() }
  });
  await tx.update(systemSettings).set({
    settingValue: sql`CAST(GREATEST(CAST(${systemSettings.settingValue} AS UNSIGNED), ${currentMax}) + 1 AS CHAR)`
  }).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence")));
  const rows = await tx.select({ value: systemSettings.settingValue }).from(systemSettings).where(and(eq(systemSettings.accountId, tenant), eq(systemSettings.settingKey, "order_sequence"))).limit(1);
  const nextNumber = Number(rows[0]?.value);
  if (!Number.isInteger(nextNumber) || nextNumber < 1001) throw new Error("N\xE3o foi poss\xEDvel reservar o n\xFAmero da OS.");
  return nextNumber;
}
function isDuplicateKeyError(error) {
  return Number(error?.code) === 1062 || String(error?.message || "").includes("Duplicate entry");
}
async function createServiceOrder(order, items, accountId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const pool = await getPool();
  const db = await getDb();
  if (!pool) throw new Error("Database not connected");
  if (!db) throw new Error("Database not connected");
  if (order.accountId !== tenant || !await getClientById(order.clientId, tenant)) throw new Error("Cliente sem permiss\xE3o");
  const requestedNumber = order.orderNumber && Number.isInteger(order.orderNumber) ? order.orderNumber : void 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await db.transaction(async (tx) => {
        const orderNumber = requestedNumber ?? await allocateOrderNumber(tx, tenant);
        const result = await tx.insert(serviceOrders).values({ ...order, accountId: tenant, orderNumber });
        const orderId = Number(result[0].insertId);
        if (items.length) await tx.insert(serviceOrderItems).values(items.map((item) => {
          const { extinguisherId: _ignored, ...row2 } = item;
          return { ...row2, serviceOrderId: orderId };
        }));
        for (const item of items) {
          const extId = Number(item.extinguisherId);
          const qty = Number(item.quantity) || 0;
          if (!extId || qty < 1) continue;
          const [rows] = await pool.query("SELECT stockQuantity FROM extinguishers WHERE id = ? AND accountId = ? LIMIT 1", [extId, tenant]);
          const current = Number(rows?.[0]?.stockQuantity ?? 1);
          if (current < qty) throw new Error("Estoque insuficiente para o extintor selecionado.");
          await pool.query("UPDATE extinguishers SET stockQuantity = stockQuantity - ? WHERE id = ? AND accountId = ?", [qty, extId, tenant]);
        }
        return { id: orderId, orderNumber };
      });
    } catch (error) {
      if (requestedNumber !== void 0 || !isDuplicateKeyError(error) || attempt === 3) throw error;
      console.warn(`[Database] OS number conflict; retrying allocation (${attempt}/3).`);
    }
  }
  throw new Error("N\xE3o foi poss\xEDvel criar a OS.");
}
async function getServiceOrderById(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return null;
  const orderResult = await db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id)).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant))).limit(1);
  if (!orderResult[0]) return null;
  const items = await db.select().from(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
  return { ...orderResult[0].order, client: orderResult[0].client, items };
}
async function getServiceOrders(clientId, accountId, ownerUserId) {
  const tenant = requireAccountId(accountId);
  await ensureOwnerScopeColumns();
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(serviceOrders.accountId, tenant), eq(clients.accountId, tenant)];
  if (ownerUserId != null) conditions.push(eq(serviceOrders.createdByUserId, ownerUserId));
  if (clientId) conditions.push(eq(serviceOrders.clientId, clientId));
  const query = db.select({ order: serviceOrders, client: clients }).from(serviceOrders).innerJoin(clients, eq(serviceOrders.clientId, clients.id));
  return await query.where(and(...conditions)).orderBy(desc(serviceOrders.orderDate), desc(serviceOrders.createdAt)).limit(clientId ? 200 : 500);
}
async function getServiceOrderHistory(clientId, accountId) {
  const orders = await getServiceOrders(clientId, accountId);
  const db = await getDb();
  if (!db) return [];
  const ids = orders.map(({ order }) => order.id);
  const items = ids.length ? await db.select().from(serviceOrderItems).where(inArray(serviceOrderItems.serviceOrderId, ids)) : [];
  return orders.map((entry) => ({ ...entry, items: items.filter((item) => item.serviceOrderId === entry.order.id) }));
}
async function updateServiceOrder(id, order, items, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const existing = await getServiceOrderById(id, tenant);
  if (!existing) throw new Error("Ordem n\xE3o encontrada ou sem permiss\xE3o");
  if (order.clientId && !await getClientById(order.clientId, tenant)) throw new Error("Cliente sem permiss\xE3o");
  const { accountId: ignoredAccountId, orderNumber: ignoredOrderNumber, ...safeOrder } = order;
  void ignoredAccountId;
  void ignoredOrderNumber;
  await db.transaction(async (tx) => {
    await tx.update(serviceOrders).set(safeOrder).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    if (items.length) await tx.insert(serviceOrderItems).values(items.map((item) => ({ ...item, serviceOrderId: id })));
  });
}
async function deleteServiceOrder(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const order = await getServiceOrderById(id, tenant);
  if (!order) throw new Error("Ordem n\xE3o encontrada ou sem permiss\xE3o");
  await db.transaction(async (tx) => {
    await tx.insert(trashItems).values({ accountId: tenant, itemType: "order", originalId: id, label: `OS #${order.orderNumber}`, snapshot: JSON.stringify({ order, items: order.items }), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1e3) });
    await tx.delete(serviceOrderItems).where(eq(serviceOrderItems.serviceOrderId, id));
    await tx.delete(serviceOrders).where(and(eq(serviceOrders.id, id), eq(serviceOrders.accountId, tenant)));
  });
}
async function listTrash(accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return [];
  await db.delete(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} <= NOW()`));
  return await db.select().from(trashItems).where(and(eq(trashItems.accountId, tenant), sql`${trashItems.expiresAt} > NOW()`)).orderBy(desc(trashItems.deletedAt));
}
async function cleanupExpiredData() {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const [trashResult, memberResult, platformResult] = await Promise.all([
    db.delete(trashItems).where(sql`${trashItems.expiresAt} <= NOW()`),
    db.delete(memberSessions).where(sql`${memberSessions.expiresAt} <= NOW()`),
    db.delete(platformSessions).where(sql`${platformSessions.expiresAt} <= NOW()`)
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
  for (const key of ["createdAt", "updatedAt"]) {
    if (restored[key] && !(restored[key] instanceof Date)) restored[key] = new Date(restored[key]);
  }
  return restored;
}
async function restoreTrashItem(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const item = (await db.select().from(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant))).limit(1))[0];
  if (!item) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
  if (new Date(item.expiresAt).getTime() <= Date.now()) {
    await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
    throw new Error("O prazo de restaura\xE7\xE3o deste item expirou.");
  }
  const snapshot = parseTrashSnapshot(item.snapshot);
  await db.transaction(async (tx) => {
    if (item.itemType === "client") {
      const clientData = snapshot.client || snapshot;
      const orders = snapshot.orders || [];
      const items = snapshot.items || [];
      const savedExtinguishers = snapshot.extinguishers || [];
      const existingClient = await tx.select({ id: clients.id }).from(clients).where(eq(clients.id, item.originalId)).limit(1);
      if (existingClient[0]) throw new Error("J\xE1 existe um cliente com o mesmo identificador. Exclua o conflito antes de restaurar.");
      await tx.insert(clients).values({ ...restoreDateFields(clientData), id: item.originalId, accountId: tenant });
      for (const extinguisher of savedExtinguishers) {
        await tx.insert(extinguishers).values({ ...restoreDateFields(extinguisher), accountId: tenant, clientId: item.originalId });
      }
      for (const savedOrder of orders) {
        const { client: _client, items: _nestedItems, ...orderData } = savedOrder;
        void _client;
        void _nestedItems;
        await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), accountId: tenant, clientId: item.originalId });
        const orderItems = items.filter((entry) => entry.serviceOrderId === savedOrder.id);
        if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry) => ({ ...restoreDateFields(entry), serviceOrderId: savedOrder.id })));
      }
    } else if (item.itemType === "order") {
      const savedOrder = snapshot.order || snapshot;
      const { client: _client, items: nestedItems, ...orderData } = savedOrder;
      void _client;
      const orderItems = snapshot.items || nestedItems || [];
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, orderData.clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado \xE0 OS n\xE3o existe mais; restaure o cliente antes.");
      await tx.insert(serviceOrders).values({ ...restoreDateFields(orderData), id: item.originalId, accountId: tenant });
      if (orderItems.length) await tx.insert(serviceOrderItems).values(orderItems.map((entry) => ({ ...restoreDateFields(entry), serviceOrderId: item.originalId })));
    } else if (item.itemType === "extinguisher") {
      const clientId = snapshot.clientId;
      const client = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.accountId, tenant))).limit(1);
      if (!client[0]) throw new Error("O cliente vinculado ao extintor n\xE3o existe mais; restaure o cliente antes.");
      await tx.insert(extinguishers).values({ ...restoreDateFields(snapshot), id: item.originalId, accountId: tenant });
    } else {
      throw new Error("Tipo de item da lixeira n\xE3o reconhecido.");
    }
    await tx.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  });
}
async function permanentlyDeleteTrashItem(id, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.delete(trashItems).where(and(eq(trashItems.id, id), eq(trashItems.accountId, tenant)));
  if (!result[0]?.affectedRows) throw new Error("Item n\xE3o encontrado na lixeira ou sem permiss\xE3o.");
}
async function getSetting(key, accountId, defaultValue = "30") {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return defaultValue;
  const result = await db.select().from(systemSettings).where(and(eq(systemSettings.settingKey, key), eq(systemSettings.accountId, tenant))).limit(1);
  return result[0]?.settingValue ?? defaultValue;
}
async function setSetting(key, value, accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.insert(systemSettings).values({ accountId: tenant, settingKey: key, settingValue: value }).onDuplicateKeyUpdate({ set: { settingValue: value } });
}
async function getDashboardStats(accountId) {
  const tenant = requireAccountId(accountId);
  const db = await getDb();
  if (!db) return { totalClients: 0, totalCities: 0, totalExtinguishers: 0, nearExpirationCount: 0, expiredCount: 0, totalOrders: 0, alertDaysConfig: 30 };
  const daysAhead = parseInt(await getSetting("alert_days_ahead", tenant, "30"), 10) || 30;
  const [clientRows, cityRows, extinguisherTotalRows, expiredRows, nearRows, orderRows] = await Promise.all([
    db.select({ total: sql`count(*)` }).from(clients).where(eq(clients.accountId, tenant)),
    db.select({ total: sql`count(distinct ${clients.city})` }).from(clients).where(and(eq(clients.accountId, tenant), sql`${clients.city} is not null AND ${clients.city} <> ''`)),
    db.select({ total: sql`count(*)` }).from(extinguishers).where(eq(extinguishers.accountId, tenant)),
    db.select({ total: sql`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} < CURRENT_DATE()`)),
    db.select({ total: sql`count(*)` }).from(extinguishers).where(and(eq(extinguishers.accountId, tenant), sql`${extinguishers.expirationDate} >= CURRENT_DATE() AND ${extinguishers.expirationDate} <= DATE_ADD(CURRENT_DATE(), INTERVAL ${daysAhead} DAY)`)),
    db.select({ total: sql`count(*)` }).from(serviceOrders).where(eq(serviceOrders.accountId, tenant))
  ]);
  return {
    totalClients: Number(clientRows[0]?.total || 0),
    totalCities: Number(cityRows[0]?.total || 0),
    totalExtinguishers: Number(extinguisherTotalRows[0]?.total || 0),
    nearExpirationCount: Number(nearRows[0]?.total || 0),
    expiredCount: Number(expiredRows[0]?.total || 0),
    totalOrders: Number(orderRows[0]?.total || 0),
    alertDaysConfig: daysAhead
  };
}
async function listSubscriptionPlans() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlans).orderBy(desc(subscriptionPlans.createdAt));
}
async function createSubscriptionPlan(data) {
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
    active: true
  });
  return { id: Number(result.insertId) };
}
async function updateSubscriptionPlan(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(subscriptionPlans).set(data).where(eq(subscriptionPlans.id, id));
  return { success: true };
}
async function listCompanySubscriptions() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
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
    featureOfflinePwa: subscriptionPlans.featureOfflinePwa
  }).from(companySubscriptions).innerJoin(companies, eq(companySubscriptions.companyId, companies.id)).innerJoin(subscriptionPlans, eq(companySubscriptions.planId, subscriptionPlans.id)).orderBy(desc(companySubscriptions.createdAt));
  return rows;
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
  }).where(eq(companies.id, data.companyId));
  return { id: Number(result.insertId) };
}
async function updateCompanySubscription(id, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companySubscriptions).set(data).where(eq(companySubscriptions.id, id));
  const rows = await db.select().from(companySubscriptions).where(eq(companySubscriptions.id, id)).limit(1);
  const sub = rows[0];
  if (sub) {
    const patch = {};
    if (data.planId !== void 0) patch.planId = data.planId;
    if (data.status !== void 0) patch.subscriptionStatus = data.status;
    if (data.endsAt !== void 0) patch.subscriptionExpiresAt = data.endsAt ? new Date(data.endsAt) : null;
    if (data.startsAt !== void 0) patch.subscriptionStartedAt = new Date(data.startsAt);
    if (Object.keys(patch).length) {
      await db.update(companies).set(patch).where(eq(companies.id, sub.companyId));
    }
  }
  return { success: true };
}
async function getSubscriptionPlanById(planId) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId)).limit(1);
  return rows[0] ?? null;
}
async function resolveCompanyPlan(companyId) {
  const db = await getDb();
  if (!db) return { company: null, subscription: null, plan: null };
  const companyRows = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  const company = companyRows[0] ?? null;
  const sub = await getLatestCompanySubscription(companyId);
  let planId = sub?.planId ?? company?.planId ?? null;
  let plan = planId ? await getSubscriptionPlanById(Number(planId)) : null;
  if (company && sub?.planId && !company.planId) {
    try {
      await db.update(companies).set({
        planId: sub.planId,
        subscriptionStatus: sub.status || company.subscriptionStatus
      }).where(eq(companies.id, companyId));
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
  const rows = await db.select().from(companySubscriptions).where(eq(companySubscriptions.companyId, companyId)).orderBy(desc(companySubscriptions.createdAt));
  if (!rows.length) return null;
  const preferred = rows.find(
    (r) => ["active", "trial", "test", "pending", "overdue"].includes(String(r.status))
  );
  return preferred ?? rows[0];
}
async function updateCompanySubscriptionFields(companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(companies).set(data).where(eq(companies.id, companyId));
  return { success: true };
}
async function listPaymentsForCompany(companyId) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(payments).where(eq(payments.companyId, companyId)).orderBy(desc(payments.createdAt));
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
  }).from(payments).innerJoin(companies, eq(payments.companyId, companies.id)).orderBy(desc(payments.createdAt)).limit(limit);
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
  const rows = await db.select().from(paymentEvents).where(eq(paymentEvents.eventId, eventId)).limit(1);
  return rows[0] ?? null;
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
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlans).where(and(eq(subscriptionPlans.active, true), eq(subscriptionPlans.availableForNew, true))).orderBy(subscriptionPlans.price);
}
async function applyMockCheckout(input) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const planRows = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, input.planId)).limit(1);
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
  }).where(eq(companies.id, input.companyId));
  return { subscriptionId, paymentId, status: subStatus };
}
async function ensureSeedPlans() {
  const db = await getDb();
  if (!db) return;
  const catalog = [
    {
      name: "Start",
      description: "Ideal para quem est\xE1 come\xE7ando",
      price: "59.90",
      billingCycle: "monthly",
      maxUsers: 1,
      maxClients: 1e3,
      maxExtinguishers: 3e3,
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
      active: true
    }
  ];
  const existing = await db.select().from(subscriptionPlans);
  const byName = new Map(existing.map((p) => [String(p.name).toLowerCase().trim(), p]));
  for (const plan of catalog) {
    const key = plan.name.toLowerCase();
    const row2 = byName.get(key);
    if (row2) {
      await db.update(subscriptionPlans).set({
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
        active: true
      }).where(eq(subscriptionPlans.id, row2.id));
    } else {
      await db.insert(subscriptionPlans).values(plan);
    }
  }
  const keep = new Set(catalog.map((p) => p.name.toLowerCase()));
  for (const row2 of existing) {
    const key = String(row2.name).toLowerCase().trim();
    if (!keep.has(key) && row2.availableForNew) {
      await db.update(subscriptionPlans).set({ availableForNew: false }).where(eq(subscriptionPlans.id, row2.id));
    }
  }
}
async function listOperationalStores(companyId, search) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(stores.companyId, requireAccountId(companyId)), eq(stores.active, true)];
  if (search?.trim()) conditions.push(like(stores.name, `%${search.trim()}%`));
  return database.select().from(stores).where(and(...conditions)).orderBy(stores.name);
}
async function createOperationalStore(input) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(stores).values(input);
  const rows = await database.select().from(stores).where(eq(stores.id, Number(result[0]?.insertId))).limit(1);
  return rows[0];
}
async function listOperationalRoutes(companyId, options = {}) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(routes.companyId, requireAccountId(companyId))];
  if (options.date) conditions.push(eq(routes.date, options.date));
  if (options.promoterId) conditions.push(eq(routes.promoterId, options.promoterId));
  return database.select().from(routes).where(and(...conditions)).orderBy(desc(routes.date), desc(routes.id));
}
async function createOperationalRoute(input) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.insert(routes).values(input);
  const rows = await database.select().from(routes).where(eq(routes.id, Number(result[0]?.insertId))).limit(1);
  return rows[0];
}
async function createOperationalRouteWithVisits(input) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const companyId = requireAccountId(input.route.companyId);
  const uniqueStoreIds = [...new Set(input.storeIds)].filter((id) => Number.isInteger(id) && id > 0);
  if (!uniqueStoreIds.length) throw new Error("Selecione ao menos uma loja para o roteiro.");
  return database.transaction(async (tx) => {
    const stores2 = await tx.select({ id: stores.id }).from(stores).where(and(inArray(stores.id, uniqueStoreIds), eq(stores.companyId, companyId), eq(stores.active, true)));
    if (stores2.length !== uniqueStoreIds.length) throw new Error("Uma ou mais lojas n\xE3o pertencem a esta empresa.");
    const result = await tx.insert(routes).values(input.route);
    const routeId = Number(result[0]?.insertId);
    await tx.insert(visits).values(stores2.map((store) => ({ companyId, routeId, storeId: store.id, promoterId: input.route.promoterId, status: "pending" })));
    const rows = await tx.select().from(routes).where(eq(routes.id, routeId)).limit(1);
    return rows[0];
  });
}
async function listOperationalVisits(companyId, options = {}) {
  const database = await getDb();
  if (!database) return [];
  const conditions = [eq(visits.companyId, requireAccountId(companyId))];
  if (options.promoterId) conditions.push(eq(visits.promoterId, options.promoterId));
  if (options.routeId) conditions.push(eq(visits.routeId, options.routeId));
  if (options.date) conditions.push(eq(routes.date, options.date));
  const rows = await database.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq(visits.storeId, stores.id)).innerJoin(routes, eq(visits.routeId, routes.id)).where(and(...conditions)).orderBy(visits.plannedStart, visits.id);
  return rows;
}
async function updateOperationalVisit(companyId, id, data) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  await database.update(visits).set(data).where(and(eq(visits.id, id), eq(visits.companyId, requireAccountId(companyId))));
  const rows = await database.select({ visit: visits, store: stores }).from(visits).innerJoin(stores, eq(visits.storeId, stores.id)).where(and(eq(visits.id, id), eq(visits.companyId, companyId))).limit(1);
  return rows[0];
}
var _db, _dbUrl, _pool, ownerScopeReady;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema_original();
    init_env();
    init_schema();
    _db = null;
    _dbUrl = null;
    _pool = null;
    ownerScopeReady = false;
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
  let status = company.subscriptionStatus || null;
  let expiresAt = parseDate(company.subscriptionExpiresAt);
  let trialEndsAt = parseDate(company.trialEndsAt);
  let graceUntil = parseDate(company.gracePeriodEndsAt);
  if (!status) {
    const sub = await getLatestCompanySubscription(companyId);
    if (!sub) {
      const created = parseDate(company.createdAt) || /* @__PURE__ */ new Date();
      const implicitTrialEnd = new Date(created.getTime() + 14 * 24 * 3600 * 1e3);
      if (/* @__PURE__ */ new Date() <= implicitTrialEnd) {
        return { allowed: true, status: "trial", expiresAt: implicitTrialEnd, reason: "Per\xEDodo de teste impl\xEDcito." };
      }
      return { allowed: false, status: "none", reason: "Nenhuma assinatura ativa. Regularize o plano." };
    }
    status = sub.status;
    expiresAt = parseDate(sub.currentPeriodEnd) || parseDate(sub.endsAt);
    trialEndsAt = parseDate(sub.trialEndsAt);
    graceUntil = parseDate(sub.gracePeriodEndsAt);
  }
  const now = /* @__PURE__ */ new Date();
  switch (status) {
    case "trial":
    case "test": {
      const end = trialEndsAt || expiresAt;
      if (end && now > end) {
        return { allowed: false, status, expiresAt: end, reason: "Per\xEDodo de teste encerrado." };
      }
      return { allowed: true, status, expiresAt: end };
    }
    case "active":
      if (expiresAt && now > expiresAt) {
        const grace = graceUntil || new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1e3);
        if (now <= grace) {
          return { allowed: true, status: "overdue", expiresAt, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
        }
        return { allowed: false, status: "overdue", expiresAt, graceUntil: grace, reason: "Assinatura vencida." };
      }
      return { allowed: true, status, expiresAt };
    case "pending":
      return { allowed: true, status, expiresAt, reason: "Pagamento pendente." };
    case "overdue": {
      const grace = graceUntil || (expiresAt ? new Date(expiresAt.getTime() + 3 * 24 * 3600 * 1e3) : null);
      if (grace && now <= grace) {
        return { allowed: true, status, expiresAt, graceUntil: grace, reason: "Per\xEDodo de toler\xE2ncia." };
      }
      return { allowed: false, status, expiresAt, graceUntil: grace, reason: "Pagamento em atraso. Regularize a assinatura." };
    }
    case "suspended":
      return { allowed: false, status, expiresAt, reason: "Assinatura suspensa." };
    case "canceled":
    case "expired":
      if (expiresAt && now <= expiresAt) {
        return { allowed: true, status, expiresAt, reason: "Acesso at\xE9 o fim do per\xEDodo j\xE1 pago." };
      }
      return { allowed: false, status, expiresAt, reason: "Assinatura cancelada ou expirada." };
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

// server/email.ts
var email_exports = {};
__export(email_exports, {
  emailAccountCreated: () => emailAccountCreated,
  emailAdminNewCompany: () => emailAdminNewCompany,
  emailAdminPlanChanged: () => emailAdminPlanChanged,
  emailExtinguisherAlerts: () => emailExtinguisherAlerts,
  emailPlanChanged: () => emailPlanChanged,
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
  return env("APP_PUBLIC_URL", "https://gestao-de-extintores-teste.vercel.app").replace(/\/$/, "");
}
function getEmailFrom() {
  return env("EMAIL_FROM", "Extinfy <onboarding@resend.dev>");
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
          <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em;">Extinfy</div>
          <div style="font-size:12px;color:rgba(255,255,255,.9);margin-top:2px;">Gest\xE3o de Extintores</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#fff;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #2a334d;font-size:12px;color:#8b93ad;">
          Este e-mail foi enviado automaticamente pelo Extinfy. N\xE3o responda a esta mensagem se n\xE3o reconhecer a atividade.
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
function dataTable(rows) {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 20px;">${rows.map(([l, v]) => row(l, v)).join("")}</table>`;
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
  const rows = [
    ["Empresa", input.companyName],
    ["Respons\xE1vel", input.userName],
    ["E-mail de acesso", input.email]
  ];
  if (input.password) rows.push(["Senha", input.password]);
  rows.push(["C\xF3digo de redefini\xE7\xE3o", input.recoveryCode]);
  rows.push(["Plano", planLine]);
  const html = layout(
    "Sua conta Extinfy foi criada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Sua conta foi criada com sucesso. Guarde estes dados em local seguro.</p>
    ${dataTable(rows)}
    <p style="margin:0 0 8px;color:#c4cae0;font-size:13px;line-height:1.5;">Use o <strong style="color:#fff;">c\xF3digo de redefini\xE7\xE3o</strong> se precisar trocar a senha na tela de recupera\xE7\xE3o.</p>
    ${cta(loginUrl, "Entrar no Extinfy")}`
  );
  return sendEmail({
    to: input.to,
    subject: "Extinfy \u2014 conta criada e dados de acesso",
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
  const rows = [
    ["Empresa", input.companyName],
    ["Plano", input.planName],
    ["Status", input.status]
  ];
  if (input.amount) rows.push(["Valor", `R$ ${input.amount}`]);
  if (input.periodEnd) rows.push(["V\xE1lido at\xE9", input.periodEnd]);
  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Registramos a altera\xE7\xE3o do plano da sua empresa.</p>
    ${dataTable(rows)}
    ${cta(`${getAppPublicUrl()}/minha-assinatura`, "Ver minha assinatura")}`
  );
  return sendEmail({
    to: input.to,
    subject: `Extinfy \u2014 ${title}: ${input.planName}`,
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
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Uma nova empresa acabou de se cadastrar no Extinfy.</p>
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
    subject: `Extinfy \u2014 nova empresa: ${input.companyName} (${planLabel})`,
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
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Um cliente alterou ou adquiriu um plano no Extinfy.</p>
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
    subject: `Extinfy \u2014 ${input.isUpgrade ? "upgrade" : "plano"}: ${input.companyName} \u2192 ${input.planName}`,
    html,
    text: `${title}
Empresa: ${input.companyName}
${input.userName} <${input.email}>
Plano: ${input.planName}
Status: ${input.status}`
  });
}
async function emailExtinguisherAlerts(input) {
  if (!input.items.length) return { ok: true, id: "empty" };
  const list = input.items.slice(0, 40).map(
    (item) => `<li style="margin:0 0 10px;color:#c4cae0;"><strong style="color:#fff;">${escapeHtml(item.clientName)}</strong> \u2014 ${escapeHtml(item.type || "Extintor")}${item.capacity ? ` (${escapeHtml(item.capacity)})` : ""}<br/><span style="color:#ff6b6b;">${escapeHtml(item.alertMessage)}</span> \xB7 validade ${escapeHtml(item.expirationDate)}</li>`
  ).join("");
  const more = input.items.length > 40 ? `<p style="color:#8b93ad;font-size:13px;">\u2026 e mais ${input.items.length - 40} item(ns). Veja o painel completo no sistema.</p>` : "";
  const html = layout(
    "Alertas de validade de extintores",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Ol\xE1, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong> (${escapeHtml(input.companyName)}). H\xE1 <strong style="color:#fff;">${input.items.length}</strong> extintor(es) vencido(s) ou pr\xF3ximos do vencimento:</p>
    <ul style="margin:0;padding-left:18px;">${list}</ul>
    ${more}
    ${cta(getAppPublicUrl() + "/", "Abrir painel Extinfy")}`
  );
  return sendEmail({
    to: input.to,
    subject: `Extinfy \u2014 ${input.items.length} alerta(s) de validade (${input.companyName})`,
    html,
    text: `Alertas de validade (${input.companyName}): ${input.items.length} item(ns). Acesse o painel.`
  });
}
var init_email = __esm({
  "server/email.ts"() {
    "use strict";
  }
});

// server/vercel-entry.ts
import express from "express";
import fs2 from "fs";
import path2 from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var MEMBER_COOKIE_NAME = "member_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/modules/timeTracking.ts
import { z } from "zod";
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({ transformer: superjson });
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});
var requireCompanyUser = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada para acessar dados comerciais." });
  }
  const companyRoles = ["company_admin", "supervisor", "promoter"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
  if (process.env.NODE_ENV !== "test") {
    const { checkSubscriptionAccess: checkSubscriptionAccess2 } = await Promise.resolve().then(() => (init_subscriptionAccess(), subscriptionAccess_exports));
    const access = await checkSubscriptionAccess2(opts.ctx.accountId);
    if (!access.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: access.reason || "Assinatura irregular. Regularize o plano para continuar.",
        cause: { code: "SUBSCRIPTION_BLOCKED", status: access.status }
      });
    }
  }
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});
var requireCompanyAdmin = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "company_admin" || !opts.ctx.accountId) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode executar esta opera\xE7\xE3o." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});
var requirePlatformAdmin = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "platform_admin" || !opts.ctx.isPlatformAdmin) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return opts.next({ ctx: { ...opts.ctx, user } });
});
var protectedProcedure = t.procedure.use(requireUser);
var requireCompanyMemberNoBillingGate = t.middleware(async (opts) => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usu\xE1rio sem empresa associada." });
  }
  const companyRoles = ["company_admin", "supervisor", "promoter"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permiss\xE3o comercial." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});
var commercialProcedure = t.procedure.use(requireCompanyUser);
var companyBillingProcedure = t.procedure.use(requireCompanyMemberNoBillingGate);
var companyAdminProcedure = t.procedure.use(requireCompanyAdmin);
var platformProcedure = t.procedure.use(requirePlatformAdmin);
var adminProcedure = platformProcedure;

// server/modules/timeTracking.ts
init_db();
init_schema();
import { eq as eq2, and as and2, desc as desc2, gte, lt } from "drizzle-orm";

// server/audit.ts
init_db();
var auditTableReady = false;
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
function toMysqlDateTime(value, endOfDay = false) {
  const raw = String(value).trim();
  const d = raw.length <= 10 ? /* @__PURE__ */ new Date(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace("T", " ");
  const pad = (n) => String(n).padStart(2, "0");
  if (raw.length <= 10) {
    return `${raw} ${endOfDay ? "23:59:59" : "00:00:00"}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
var SENSITIVE_KEY_RE = /password|passwd|pwd|token|secret|cookie|authorization|recovery|hash|credit.?card|card.?number|cvv|cvc|ssn|api.?key/i;
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
    const [rows] = await pool.query(
      `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );
    return {
      items: rows || [],
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
      const [rows] = await pool.query(
        `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset]
      );
      return { items: rows || [], total, page, pageSize };
    } catch (err2) {
      console.warn("[audit] list failed permanently", err2);
      return { items: [], total: 0, page, pageSize };
    }
  }
}
async function getAuditLogById(id, companyId) {
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return null;
  try {
    if (companyId != null) {
      const [rows2] = await pool.query(
        "SELECT * FROM `audit_logs` WHERE `id` = ? AND `companyId` = ? LIMIT 1",
        [id, companyId]
      );
      return rows2[0] || null;
    }
    const [rows] = await pool.query(
      "SELECT * FROM `audit_logs` WHERE `id` = ? LIMIT 1",
      [id]
    );
    return rows[0] || null;
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

// server/modules/timeTracking.ts
var timeEventType = z.enum(["clock_in", "break_start", "break_end", "clock_out"]);
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
  registerEvent: commercialProcedure.input(z.object({
    eventType: timeEventType,
    deviceTime: z.string().datetime().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().finite().nonnegative().max(1e4),
    locationStatus: z.literal("success"),
    locationError: z.string().optional(),
    deviceInfo: z.string().optional(),
    idempotencyKey: z.string().min(1).optional(),
    notes: z.string().optional()
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError2({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || !Number.isFinite(input.accuracy) || input.locationStatus !== "success") {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "O ponto s\xF3 pode ser registrado ap\xF3s obter uma localiza\xE7\xE3o GPS v\xE1lida." });
    }
    const database = await getDb();
    if (!database) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    if (input.idempotencyKey) {
      const existing = await database.select().from(timeEvents).where(eq2(timeEvents.idempotencyKey, input.idempotencyKey)).limit(1);
      if (existing[0]) return existing[0];
    }
    const lastEvents = await database.select().from(timeEvents).where(and2(eq2(timeEvents.memberAccountId, memberId), eq2(timeEvents.companyId, companyId))).orderBy(desc2(timeEvents.serverTime)).limit(1);
    const lastType = lastEvents[0]?.eventType;
    if (!isValidTransition(lastType, input.eventType)) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: "Sequ\xEAncia de marca\xE7\xE3o inv\xE1lida. Confira o \xFAltimo evento do ponto." });
    }
    const result = await database.insert(timeEvents).values({
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
    const insertedRows = await database.select().from(timeEvents).where(eq2(timeEvents.id, Number(result[0]?.insertId))).limit(1);
    const inserted = insertedRows[0];
    if (!inserted) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a marca\xE7\xE3o criada." });
    await auditFromCtx(ctx, {
      action: "create",
      module: "time_tracking",
      entityType: "time_event",
      entityId: inserted.id,
      description: `Marca\xE7\xE3o de ponto: ${input.eventType}`
    });
    return inserted;
  }),
  myHistory: commercialProcedure.input(z.object({ limit: z.number().min(1).max(100).default(100), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).optional()).query(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database = await getDb();
    if (!database) return [];
    const conditions = [eq2(timeEvents.memberAccountId, memberId), eq2(timeEvents.companyId, companyId)];
    if (input?.date) {
      const start = /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`);
      const end = new Date(start.getTime() + 864e5);
      conditions.push(gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end));
    }
    return database.select().from(timeEvents).where(and2(...conditions)).orderBy(desc2(timeEvents.serverTime)).limit(input?.limit || 100);
  }),
  myTimeSummary: commercialProcedure.query(async ({ ctx }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return { periodLabel: "M\xEAs atual", daysTracked: 0, workedMinutes: 0, expectedMinutes: 0, balanceMinutes: 0, openShift: false };
    const database = await getDb();
    if (!database) return { periodLabel: "M\xEAs atual", daysTracked: 0, workedMinutes: 0, expectedMinutes: 0, balanceMinutes: 0, openShift: false };
    const now = /* @__PURE__ */ new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const events = await database.select().from(timeEvents).where(and2(eq2(timeEvents.memberAccountId, memberId), eq2(timeEvents.companyId, companyId), gte(timeEvents.serverTime, start), lt(timeEvents.serverTime, end))).orderBy(timeEvents.serverTime);
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
  myCorrections: commercialProcedure.query(async ({ ctx }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) return [];
    const database = await getDb();
    if (!database) return [];
    return database.select({ request: timeCorrectionRequests, event: timeEvents }).from(timeCorrectionRequests).leftJoin(timeEvents, eq2(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and2(eq2(timeCorrectionRequests.companyId, companyId), eq2(timeCorrectionRequests.memberAccountId, memberId))).orderBy(desc2(timeCorrectionRequests.createdAt));
  }),
  requestCorrection: commercialProcedure.input(z.object({
    timeEventId: z.number().int().positive(),
    requestedType: timeEventType,
    requestedTime: z.string().datetime(),
    justification: z.string().min(10)
  })).mutation(async ({ ctx, input }) => {
    const companyId = ctx.accountId;
    const memberId = ctx.memberAccountId;
    if (!companyId || !memberId) throw new TRPCError2({ code: "FORBIDDEN", message: "Usu\xE1rio de empresa n\xE3o identificado." });
    const database = await getDb();
    if (!database) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
    const event = await database.select().from(timeEvents).where(and2(eq2(timeEvents.id, input.timeEventId), eq2(timeEvents.companyId, companyId), eq2(timeEvents.memberAccountId, memberId))).limit(1);
    if (!event[0]) throw new TRPCError2({ code: "NOT_FOUND", message: "Marca\xE7\xE3o n\xE3o encontrada para este funcion\xE1rio." });
    const result = await database.insert(timeCorrectionRequests).values({
      companyId,
      memberAccountId: memberId,
      timeEventId: input.timeEventId,
      requestedType: input.requestedType,
      requestedTime: new Date(input.requestedTime),
      justification: input.justification,
      status: "pending"
    });
    const insertedRows = await database.select().from(timeCorrectionRequests).where(eq2(timeCorrectionRequests.id, Number(result[0]?.insertId))).limit(1);
    const inserted = insertedRows[0];
    if (!inserted) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel recuperar a solicita\xE7\xE3o criada." });
    await auditFromCtx(ctx, {
      action: "create",
      module: "time_tracking",
      entityType: "correction_request",
      entityId: inserted.id,
      description: "Solicita\xE7\xE3o de corre\xE7\xE3o de ponto"
    });
    return inserted;
  }),
  correctionRequests: router({
    pending: companyAdminProcedure.query(async ({ ctx }) => {
      const database = await getDb();
      if (!database) return [];
      return database.select({ request: timeCorrectionRequests, event: timeEvents, employee: memberAccounts2 }).from(timeCorrectionRequests).innerJoin(memberAccounts2, eq2(timeCorrectionRequests.memberAccountId, memberAccounts2.id)).leftJoin(timeEvents, eq2(timeCorrectionRequests.timeEventId, timeEvents.id)).where(and2(eq2(timeCorrectionRequests.companyId, ctx.accountId), eq2(timeCorrectionRequests.status, "pending"))).orderBy(desc2(timeCorrectionRequests.createdAt));
    }),
    review: companyAdminProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), reviewNotes: z.string().max(1e3).optional() })).mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError2({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indispon\xEDvel." });
      const rows = await database.select().from(timeCorrectionRequests).where(and2(eq2(timeCorrectionRequests.id, input.id), eq2(timeCorrectionRequests.companyId, ctx.accountId))).limit(1);
      const request = rows[0];
      if (!request) throw new TRPCError2({ code: "NOT_FOUND", message: "Solicita\xE7\xE3o de corre\xE7\xE3o n\xE3o encontrada." });
      if (request.status !== "pending") throw new TRPCError2({ code: "BAD_REQUEST", message: "Esta solicita\xE7\xE3o j\xE1 foi analisada." });
      if (input.status === "approved") {
        const event = request.timeEventId ? (await database.select().from(timeEvents).where(and2(eq2(timeEvents.id, request.timeEventId), eq2(timeEvents.companyId, ctx.accountId))).limit(1))[0] : null;
        if (!event) throw new TRPCError2({ code: "NOT_FOUND", message: "A marca\xE7\xE3o original n\xE3o foi encontrada." });
        const previous = `${event.eventType} em ${(event.deviceTime || event.serverTime).toISOString()}`;
        const note = `Ajuste aprovado em ${(/* @__PURE__ */ new Date()).toISOString()} pelo administrador. Antes: ${previous}. Motivo do funcion\xE1rio: ${request.justification}`;
        await database.update(timeEvents).set({ eventType: request.requestedType, deviceTime: request.requestedTime, notes: `${event.notes ? `${event.notes}
` : ""}${note}` }).where(eq2(timeEvents.id, event.id));
      }
      await database.update(timeCorrectionRequests).set({ status: input.status, reviewedByUserId: ctx.memberAccountId, reviewedAt: /* @__PURE__ */ new Date(), reviewNotes: input.reviewNotes || null }).where(eq2(timeCorrectionRequests.id, request.id));
      await auditFromCtx(ctx, { action: input.status === "approved" ? "update" : "security", module: "time_tracking", entityType: "correction_request", entityId: request.id, description: `Solicita\xE7\xE3o de corre\xE7\xE3o ${input.status === "approved" ? "aprovada" : "rejeitada"}`, newData: { status: input.status, reviewNotes: input.reviewNotes || null } });
      return { success: true };
    })
  })
});

// server/routers.ts
import { z as z3 } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError as TRPCError5 } from "@trpc/server";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req, allowCrossSite = false) {
  return {
    httpOnly: true,
    path: "/",
    // O preview da plataforma pode abrir o site em iframe HTTPS. Nesse caso,
    // o cookie precisa aceitar contexto cross-site; no localhost mantemos Lax.
    sameSite: allowCrossSite && isSecureRequest(req) ? "none" : "lax",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z as z2 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError3({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError3({
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
      body: JSON.stringify({ title, content, source: "gestao-extintores", timestamp: (/* @__PURE__ */ new Date()).toISOString() })
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
var systemRouter = router({
  health: publicProcedure.input(
    z2.object({
      timestamp: z2.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z2.object({
      title: z2.string().min(1, "title is required"),
      content: z2.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_subscriptionAccess();

// server/planLimits.ts
init_db();
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/memberAuth.ts
init_schema_original();
init_db();
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and as and3, eq as eq3, gt, lte } from "drizzle-orm";
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
async function authenticateMember(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `login:${normalizedEmail}`;
  if (isRateLimited(key)) return null;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const platformResult = await db.select().from(platformAdmins).where(eq3(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform && platform.active && verifyPassword(password, platform.passwordHash)) {
    clearRateLimit(key);
    return { kind: "platform", account: platform };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq3(memberAccounts.email, normalizedEmail)).limit(1);
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
    await db.delete(platformSessions).where(and3(eq3(platformSessions.platformAdminId, principal.account.id), lte(platformSessions.expiresAt, /* @__PURE__ */ new Date())));
    await db.insert(platformSessions).values({ platformAdminId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
    return { rawToken, expiresAt, kind: "platform" };
  }
  await db.delete(memberSessions).where(and3(eq3(memberSessions.memberAccountId, principal.account.id), lte(memberSessions.expiresAt, /* @__PURE__ */ new Date())));
  await db.insert(memberSessions).values({ memberAccountId: principal.account.id, tokenHash: hashToken(rawToken), expiresAt });
  return { rawToken, expiresAt, kind: "company" };
}
async function getMemberBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: memberAccounts, session: memberSessions }).from(memberSessions).innerJoin(memberAccounts, eq3(memberSessions.memberAccountId, memberAccounts.id)).where(and3(eq3(memberSessions.tokenHash, hashToken(rawToken)), gt(memberSessions.expiresAt, now), eq3(memberAccounts.active, true))).limit(1);
  await db.delete(memberSessions).where(lte(memberSessions.expiresAt, now));
  return result[0]?.account ?? null;
}
async function getPlatformAdminBySessionToken(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return null;
  const now = /* @__PURE__ */ new Date();
  const result = await db.select({ account: platformAdmins, session: platformSessions }).from(platformSessions).innerJoin(platformAdmins, eq3(platformSessions.platformAdminId, platformAdmins.id)).where(and3(eq3(platformSessions.tokenHash, hashToken(rawToken)), gt(platformSessions.expiresAt, now), eq3(platformAdmins.active, true))).limit(1);
  await db.delete(platformSessions).where(lte(platformSessions.expiresAt, now));
  return result[0]?.account ?? null;
}
async function revokeSessions(rawToken) {
  const db = await getDb();
  if (!db || !rawToken) return;
  const tokenHash = hashToken(rawToken);
  await db.delete(memberSessions).where(eq3(memberSessions.tokenHash, tokenHash));
  await db.delete(platformSessions).where(eq3(platformSessions.tokenHash, tokenHash));
}
async function changeMemberPassword(memberAccountId, currentPassword, newPassword) {
  const key = `change:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(memberAccounts).where(eq3(memberAccounts.id, memberAccountId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq3(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq3(memberSessions.memberAccountId, memberAccountId));
  return true;
}
async function changePlatformPassword(platformAdminId, currentPassword, newPassword) {
  const key = `change:platform:${platformAdminId}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const result = await db.select().from(platformAdmins).where(eq3(platformAdmins.id, platformAdminId)).limit(1);
  const account = result[0];
  if (!account || !verifyPassword(currentPassword, account.passwordHash)) {
    registerFailure(key);
    return false;
  }
  clearRateLimit(key);
  await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword) }).where(eq3(platformAdmins.id, platformAdminId));
  await db.delete(platformSessions).where(eq3(platformSessions.platformAdminId, platformAdminId));
  return true;
}
async function resetMemberPassword(memberAccountId, newPassword) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword) }).where(eq3(memberAccounts.id, memberAccountId));
  await db.delete(memberSessions).where(eq3(memberSessions.memberAccountId, memberAccountId));
  clearRateLimit(`login:${memberAccountId}`);
}
async function recoverPassword(email, recoveryCode, newPassword) {
  const normalizedEmail = email.trim().toLowerCase();
  const key = `recover:${normalizedEmail}`;
  if (isRateLimited(key)) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const nextRecoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const platformResult = await db.select().from(platformAdmins).where(eq3(platformAdmins.email, normalizedEmail)).limit(1);
  const platform = platformResult[0];
  if (platform?.active && platform.recoveryCodeHash && verifyPassword(recoveryCode, platform.recoveryCodeHash)) {
    await db.update(platformAdmins).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq3(platformAdmins.id, platform.id));
    await db.delete(platformSessions).where(eq3(platformSessions.platformAdminId, platform.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "platform" };
  }
  const memberResult = await db.select().from(memberAccounts).where(eq3(memberAccounts.email, normalizedEmail)).limit(1);
  const member = memberResult[0];
  if (member?.active && member.recoveryCodeHash && verifyPassword(recoveryCode, member.recoveryCodeHash)) {
    await db.update(memberAccounts).set({ passwordHash: hashPassword(newPassword), recoveryCodeHash: hashPassword(nextRecoveryCode) }).where(eq3(memberAccounts.id, member.id));
    await db.delete(memberSessions).where(eq3(memberSessions.memberAccountId, member.id));
    clearRateLimit(key);
    return { recoveryCode: nextRecoveryCode, kind: "company" };
  }
  registerFailure(key);
  return false;
}
async function createCompanyWithAdmin(input) {
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  const normalizedEmail = input.email.trim().toLowerCase();
  return await database.transaction(async (tx) => {
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
      const planRows = await tx.select().from(subscriptionPlans).where(eq3(subscriptionPlans.id, input.planId)).limit(1);
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
  const query = db.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, userName: memberAccounts.userName, email: memberAccounts.email, role: memberAccounts.role, active: memberAccounts.active, createdAt: memberAccounts.createdAt }).from(memberAccounts);
  return companyId ? await query.where(eq3(memberAccounts.companyId, companyId)) : await query;
}
async function updateCompanyUser(accountId, companyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(memberAccounts).set({ ...data, email: data.email?.trim().toLowerCase() }).where(and3(eq3(memberAccounts.id, accountId), eq3(memberAccounts.companyId, companyId)));
}
async function setMemberActive(id, active, companyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const conditions = companyId === void 0 ? eq3(memberAccounts.id, id) : and3(eq3(memberAccounts.id, id), eq3(memberAccounts.companyId, companyId));
  const account = await db.select({ role: memberAccounts.role }).from(memberAccounts).where(conditions).limit(1);
  if (account[0]?.role === "company_admin" && !active) {
    const adminCount = await db.select({ id: memberAccounts.id }).from(memberAccounts).where(and3(eq3(memberAccounts.companyId, companyId ?? 0), eq3(memberAccounts.role, "company_admin"), eq3(memberAccounts.active, true))).limit(2);
    if (adminCount.length <= 1) throw new Error("A empresa precisa manter pelo menos um administrador ativo.");
  }
  await db.update(memberAccounts).set({ active }).where(conditions);
  if (!active) await db.delete(memberSessions).where(eq3(memberSessions.memberAccountId, id));
}
async function updateMemberProfile(memberAccountId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const name = data.userName.trim();
  if (name.length < 2) throw new Error("Nome deve ter pelo menos 2 caracteres.");
  await db.update(memberAccounts).set({ userName: name }).where(eq3(memberAccounts.id, memberAccountId));
  return { success: true, userName: name };
}
async function regenerateMemberRecoveryCode(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const recoveryCode = `EXT-${randomBytes(12).toString("base64url")}`;
  await db.update(memberAccounts).set({ recoveryCodeHash: hashPassword(recoveryCode) }).where(eq3(memberAccounts.id, memberAccountId));
  return { recoveryCode };
}
async function revokeAllMemberSessions(memberAccountId) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(memberSessions).where(eq3(memberSessions.memberAccountId, memberAccountId));
  return { success: true };
}
async function verifyMemberPassword(memberAccountId, password) {
  const key = `verify:member:${memberAccountId}`;
  if (isRateLimited(key)) return false;
  const database = await getDb();
  if (!database) throw new Error("Database not connected");
  const result = await database.select().from(memberAccounts).where(eq3(memberAccounts.id, memberAccountId)).limit(1);
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
import { sql as sql2, eq as eq4 } from "drizzle-orm";
async function getEffectivePlan(companyId) {
  const resolved = await resolveCompanyPlan(companyId);
  const plan = resolved.plan;
  if (!plan) {
    return {
      id: null,
      name: "Sem plano",
      maxUsers: 1,
      maxClients: 1e3,
      maxExtinguishers: 3e3,
      featureDashboard: true,
      featureClients: true,
      featureExtinguishers: true,
      featureServiceOrders: true,
      featureAlerts: true,
      featureReports: false,
      featureUsers: false,
      featureBackup: true,
      featureOfflinePwa: true
    };
  }
  return {
    id: Number(plan.id) || null,
    name: String(plan.name || "Plano"),
    maxUsers: plan.maxUsers == null ? null : Number(plan.maxUsers),
    maxClients: plan.maxClients == null ? null : Number(plan.maxClients),
    maxExtinguishers: plan.maxExtinguishers == null ? null : Number(plan.maxExtinguishers),
    featureDashboard: Boolean(plan.featureDashboard),
    featureClients: Boolean(plan.featureClients),
    featureExtinguishers: Boolean(plan.featureExtinguishers),
    featureServiceOrders: Boolean(plan.featureServiceOrders),
    featureAlerts: Boolean(plan.featureAlerts),
    featureReports: Boolean(plan.featureReports),
    featureUsers: Boolean(plan.featureUsers),
    featureBackup: Boolean(plan.featureBackup),
    featureOfflinePwa: Boolean(plan.featureOfflinePwa)
  };
}
async function requirePlanFeature(companyId, feature, label) {
  const plan = await getEffectivePlan(companyId);
  if (!plan[feature]) {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: label || `Seu plano (${plan.name}) n\xE3o inclui este recurso. Fa\xE7a upgrade ou fale com o suporte.`,
      cause: { code: "PLAN_FEATURE_BLOCKED", feature, planId: plan.id, planName: plan.name }
    });
  }
  return plan;
}
async function countClients(companyId) {
  const database = await getDb();
  if (!database) return 0;
  const rows = await database.select({ total: sql2`count(*)` }).from(clients).where(eq4(clients.accountId, companyId));
  return Number(rows[0]?.total || 0);
}
async function countExtinguishers(companyId) {
  const database = await getDb();
  if (!database) return 0;
  const rows = await database.select({ total: sql2`count(*)` }).from(extinguishers).where(eq4(extinguishers.accountId, companyId));
  return Number(rows[0]?.total || 0);
}
async function assertClientLimit(companyId) {
  const plan = await requirePlanFeature(companyId, "featureClients", "Cadastro de clientes n\xE3o est\xE1 dispon\xEDvel no seu plano.");
  if (plan.maxClients == null) return plan;
  const current = await countClients(companyId);
  if (current >= plan.maxClients) {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: `Limite de clientes do plano ${plan.name} atingido (${plan.maxClients}). Fa\xE7a upgrade para continuar.`,
      cause: { code: "PLAN_LIMIT", resource: "clients", limit: plan.maxClients, current }
    });
  }
  return plan;
}
async function assertExtinguisherLimit(companyId) {
  const plan = await requirePlanFeature(
    companyId,
    "featureExtinguishers",
    "Cadastro de extintores n\xE3o est\xE1 dispon\xEDvel no seu plano."
  );
  if (plan.maxExtinguishers == null) return plan;
  const current = await countExtinguishers(companyId);
  if (current >= plan.maxExtinguishers) {
    throw new TRPCError4({
      code: "FORBIDDEN",
      message: `Limite de extintores do plano ${plan.name} atingido (${plan.maxExtinguishers}). Fa\xE7a upgrade para continuar.`,
      cause: { code: "PLAN_LIMIT", resource: "extinguishers", limit: plan.maxExtinguishers, current }
    });
  }
  return plan;
}
async function assertUserLimit(companyId) {
  void companyId;
  return { id: null, name: "Opera\xE7\xE3o", maxUsers: null };
}
async function assertServiceOrderFeature(companyId) {
  return requirePlanFeature(
    companyId,
    "featureServiceOrders",
    "Ordens de servi\xE7o n\xE3o est\xE3o dispon\xEDveis no seu plano."
  );
}

// server/routers.ts
init_db();
init_email();
var emptyToNull = (value) => value?.trim() || null;
var companyUserRole = z3.enum(["company_admin", "supervisor", "promoter"]);
var clientInput = z3.object({
  companyName: z3.string().min(1, "Nome da empresa \xE9 obrigat\xF3rio"),
  cnpj: z3.string().optional(),
  address: z3.string().optional(),
  city: z3.string().min(1, "Cidade \xE9 obrigat\xF3ria"),
  cep: z3.string().optional(),
  phone: z3.string().optional(),
  contactName: z3.string().optional(),
  cpf: z3.string().optional(),
  birthDate: z3.string().optional(),
  notes: z3.string().optional()
});
var appRouter = router({
  system: systemRouter,
  timeTracking: timeTrackingRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    /** Cadastro público: cria empresa + admin com plano opcional (trial 14 dias). */
    signup: publicProcedure.input(z3.object({
      companyName: z3.string().min(2, "Nome da empresa \xE9 obrigat\xF3rio"),
      userName: z3.string().min(2, "Nome do respons\xE1vel \xE9 obrigat\xF3rio"),
      email: z3.string().email(),
      password: z3.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
      planId: z3.number().int().positive("Selecione um plano antes de criar a conta"),
      paymentConfirmed: z3.boolean().refine((v) => v === true, { message: "Confirme o pagamento para criar a conta." })
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
          throw new TRPCError5({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        }
        throw error;
      }
    }),
    login: publicProcedure.input(z3.object({ email: z3.string().email(), password: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
      const principal = await authenticateMember(input.email, input.password);
      if (!principal) {
        void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
        throw new TRPCError5({ code: "UNAUTHORIZED", message: "E-mail ou senha inv\xE1lidos." });
      }
      const session = await createSession(principal);
      ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1e3 });
      void auditFromCtx(ctx, {
        companyId: principal.companyId ?? null,
        action: "login",
        module: "auth",
        entityType: "session",
        description: `Login realizado: ${input.email}`,
        newData: { email: input.email, kind: session.kind }
      });
      return { success: true, kind: session.kind };
    }),
    recoverPassword: publicProcedure.input(z3.object({ email: z3.string().email(), recoveryCode: z3.string().min(1), newPassword: z3.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ input }) => {
      const recovered = await recoverPassword(input.email, input.recoveryCode, input.newPassword);
      if (!recovered) throw new TRPCError5({ code: "UNAUTHORIZED", message: "E-mail ou c\xF3digo de recupera\xE7\xE3o inv\xE1lido." });
      return { success: true, recoveryCode: recovered.recoveryCode };
    }),
    changePassword: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z3.object({ currentPassword: z3.string().min(1), newPassword: z3.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") })).mutation(async ({ ctx, input }) => {
      const changed = ctx.user.role === "platform_admin" ? await changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword) : await changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
      if (!changed) throw new TRPCError5({ code: "UNAUTHORIZED", message: "A senha atual est\xE1 incorreta." });
      return { success: true };
    }),
    updateProfile: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z3.object({
      userName: z3.string().min(2).optional(),
      avatarDataUrl: z3.string().max(4e5).optional().nullable()
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Perfil de plataforma n\xE3o usa esta rota." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const companyId = ctx.accountId;
      if (!companyId) throw new TRPCError5({ code: "FORBIDDEN", message: "Empresa n\xE3o identificada." });
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
            throw new TRPCError5({ code: "BAD_REQUEST", message: "Imagem de perfil inv\xE1lida." });
          }
          await setSetting(key, input.avatarDataUrl, companyId);
        }
      }
      return { success: true, userName };
    }),
    profileExtras: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Please login (10001)" });
      return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
    }).input(z3.object({ currentPassword: z3.string().min(1) })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role === "platform_admin") {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "Indispon\xEDvel para admin da plataforma nesta tela." });
      }
      const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
      const ok = await verifyMemberPassword(memberId, input.currentPassword);
      if (!ok) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
      const result = await regenerateMemberRecoveryCode(memberId);
      return { success: true, recoveryCode: result.recoveryCode };
    }),
    logoutAllSessions: publicProcedure.use(async (opts) => {
      if (!opts.ctx.user) throw new TRPCError5({ code: "UNAUTHORIZED", message: "Please login (10001)" });
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
  offline: router({
    snapshot: commercialProcedure.input(z3.object({ page: z3.number().int().positive().optional(), pageSize: z3.number().int().min(10).max(100).optional() }).optional()).query(({ ctx, input }) => getOfflineSnapshot(ctx.accountId, input))
  }),
  platform: router({
    plans: router({
      list: platformProcedure.query(() => listSubscriptionPlans()),
      create: platformProcedure.input(z3.object({
        name: z3.string().min(2),
        description: z3.string().optional().nullable(),
        price: z3.string().default("0.00"),
        billingCycle: z3.enum(["monthly", "yearly"]).default("monthly"),
        maxUsers: z3.number().int().positive().optional().nullable(),
        maxClients: z3.number().int().positive().optional().nullable(),
        maxExtinguishers: z3.number().int().positive().optional().nullable(),
        featureDashboard: z3.boolean().default(false),
        featureClients: z3.boolean().default(false),
        featureExtinguishers: z3.boolean().default(false),
        featureServiceOrders: z3.boolean().default(false),
        featureAlerts: z3.boolean().default(false),
        featureReports: z3.boolean().default(false),
        featureUsers: z3.boolean().default(false),
        featureBackup: z3.boolean().default(false),
        featureOfflinePwa: z3.boolean().default(false),
        availableForNew: z3.boolean().default(true)
      })).mutation(({ input }) => createSubscriptionPlan(input)),
      update: platformProcedure.input(z3.object({
        id: z3.number().int().positive(),
        name: z3.string().min(2).optional(),
        description: z3.string().optional().nullable(),
        price: z3.string().optional(),
        billingCycle: z3.enum(["monthly", "yearly"]).optional(),
        maxUsers: z3.number().int().positive().optional().nullable(),
        maxClients: z3.number().int().positive().optional().nullable(),
        maxExtinguishers: z3.number().int().positive().optional().nullable(),
        featureDashboard: z3.boolean().optional(),
        featureClients: z3.boolean().optional(),
        featureExtinguishers: z3.boolean().optional(),
        featureServiceOrders: z3.boolean().optional(),
        featureAlerts: z3.boolean().optional(),
        featureReports: z3.boolean().optional(),
        featureUsers: z3.boolean().optional(),
        featureBackup: z3.boolean().optional(),
        featureOfflinePwa: z3.boolean().optional(),
        availableForNew: z3.boolean().optional(),
        active: z3.boolean().optional()
      })).mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateSubscriptionPlan(id, data);
      })
    }),
    subscriptions: router({
      list: platformProcedure.query(() => listCompanySubscriptions()),
      stats: platformProcedure.query(() => getSubscriptionStats()),
      create: platformProcedure.input(z3.object({
        companyId: z3.number().int().positive(),
        planId: z3.number().int().positive(),
        status: z3.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).default("active"),
        startsAt: z3.string().min(8),
        endsAt: z3.string().optional().nullable(),
        notes: z3.string().optional().nullable()
      })).mutation(({ input }) => createCompanySubscription(input)),
      update: platformProcedure.input(z3.object({
        id: z3.number().int().positive(),
        planId: z3.number().int().positive().optional(),
        status: z3.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).optional(),
        startsAt: z3.string().min(8).optional(),
        endsAt: z3.string().optional().nullable(),
        notes: z3.string().optional().nullable()
      })).mutation(async ({ input }) => {
        const { id, ...data } = input;
        return updateCompanySubscription(id, data);
      })
    }),
    /** Compatibilidade do painel administrativo: somente platform_admin acessa estas operações globais. */
    identity: platformProcedure.query(({ ctx }) => ({ id: ctx.platformAdminId ?? ctx.user.id, role: "platform_admin", global: true })),
    companies: router({
      list: platformProcedure.query(() => listCompanies()),
      create: platformProcedure.input(z3.object({ companyName: z3.string().min(2), userName: z3.string().min(2), email: z3.string().email(), password: z3.string().min(8) })).mutation(async ({ input }) => {
        try {
          return await createCompanyWithAdmin(input);
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError5({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      }),
      update: platformProcedure.input(z3.object({ id: z3.number().int().positive(), name: z3.string().min(2).optional(), active: z3.boolean().optional() })).mutation(async ({ input }) => {
        await updateCompany(input.id, { name: input.name, active: input.active });
        return { success: true };
      })
    }),
    dashboard: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), city: z3.string().optional(), from: z3.string().optional(), to: z3.string().optional() })).query(({ input }) => getPlatformDashboardStats(input.companyId, input)),
    users: router({
      list: platformProcedure.query(() => listMemberAccounts()),
      create: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), userName: z3.string().min(2), email: z3.string().email(), password: z3.string().min(8), role: companyUserRole })).mutation(async ({ input, ctx }) => {
        const company = await getCompanyById(input.companyId);
        if (!company) throw new TRPCError5({ code: "NOT_FOUND", message: "Empresa n\xE3o encontrada." });
        if (!company.active) throw new TRPCError5({ code: "BAD_REQUEST", message: "N\xE3o \xE9 poss\xEDvel criar usu\xE1rio em uma empresa bloqueada." });
        try {
          const created = await createCompanyUser(input);
          void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usu\xE1rio criado pelo administrador geral: ${input.userName}`, newData: { companyId: input.companyId, email: input.email, role: input.role } });
          return created;
        } catch (error) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError5({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
          throw error;
        }
      })
    }),
    data: router({
      clients: platformProcedure.input(z3.object({ companyId: z3.number().int().positive().optional() }).optional()).query(({ input }) => getPlatformClients(input?.companyId)),
      clientsPage: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), city: z3.string().optional(), search: z3.string().optional() })).query(({ input }) => getClientsPage(input.companyId, input)),
      extinguishers: platformProcedure.input(z3.object({ companyId: z3.number().int().positive().optional() }).optional()).query(({ input }) => getPlatformExtinguishers(input?.companyId)),
      extinguishersPage: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), clientId: z3.number().int().positive().optional(), search: z3.string().optional(), filter: z3.enum(["all", "active", "near", "expired"]).optional() })).query(({ input }) => getExtinguishersPage(input.companyId, input)),
      orders: platformProcedure.input(z3.object({ companyId: z3.number().int().positive().optional() }).optional()).query(({ input }) => getPlatformOrders(input?.companyId)),
      ordersPage: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), clientId: z3.number().int().positive().optional(), search: z3.string().optional(), city: z3.string().optional(), from: z3.string().optional(), to: z3.string().optional() })).query(({ input }) => getServiceOrdersPage(input.companyId, input)),
      alertsPage: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), daysAhead: z3.number().optional(), filter: z3.enum(["all", "near", "expired"]).optional(), search: z3.string().optional(), city: z3.string().optional() })).query(async ({ input }) => {
        const days = input.daysAhead || parseInt(await getSetting("alert_days_ahead", input.companyId, "30"), 10) || 30;
        return getExpiringExtinguishersPage(days, input.companyId, input);
      }),
      history: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), clientId: z3.number().int().positive() })).query(({ input }) => getServiceOrderHistory(input.clientId, input.companyId)),
      createClient: platformProcedure.input(clientInput.extend({ companyId: z3.number().int().positive() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError5({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o cliente." });
        return { id: await createClient({ ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }) };
      }),
      createExtinguisher: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), clientId: z3.number(), typeModel: z3.string().min(1), capacity: z3.string().optional(), serialNumber: z3.string().optional(), locationInBuilding: z3.string().optional(), expirationDate: z3.string(), lastInspectionDate: z3.string().optional(), notes: z3.string().optional() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError5({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o extintor." });
        return { id: await createExtinguisher({ ...data, accountId: companyId, expirationDate: data.expirationDate, lastInspectionDate: data.lastInspectionDate || null, capacity: emptyToNull(data.capacity), serialNumber: emptyToNull(data.serialNumber), locationInBuilding: emptyToNull(data.locationInBuilding), notes: emptyToNull(data.notes) }, companyId) };
      }),
      createOrder: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), orderNumber: z3.number().optional(), orderDate: z3.string(), clientId: z3.number(), replacedAndDelivered: z3.string().default("SIM"), leftReserve: z3.string().default("N\xC3O"), reserveDetails: z3.string().optional(), extinguisherExpiration: z3.string().optional(), licenseExpiration: z3.string().optional(), totalAmount: z3.string().default("0.00"), paymentMethod: z3.string().default("A VISTA"), installmentsCount: z3.number().default(1), installmentDates: z3.string().optional(), responsibleName: z3.string().optional(), responsibleCpf: z3.string().optional(), responsibleBirthDate: z3.string().optional(), observations: z3.string().optional(), items: z3.array(z3.object({ description: z3.string().min(1), quantity: z3.number().min(1), unitPrice: z3.string(), totalPrice: z3.string(), extinguisherId: z3.number().optional() })) })).mutation(async ({ input, ctx }) => {
        const { companyId, items, ...orderData } = input;
        const company = await getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError5({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para criar a ordem de servi\xE7o." });
        return createServiceOrder({ ...orderData, accountId: companyId, createdByName: ctx.user.name || ctx.user.email || "Administrador geral", createdByUserId: null }, items, companyId);
      }),
      deleteOrder: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
        await deleteServiceOrder(input.id, input.companyId);
        return { success: true };
      }),
      deleteClient: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
        await deleteClient(input.id, input.companyId);
        return { success: true };
      }),
      deleteExtinguisher: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
        await deleteExtinguisher(input.id, input.companyId);
        return { success: true };
      }),
      updateClient: platformProcedure.input(clientInput.extend({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
        const { companyId, id, ...data } = input;
        await updateClient(id, { ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, companyId);
        return { success: true };
      }),
      updateOrder: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive(), orderDate: z3.string(), clientId: z3.number(), replacedAndDelivered: z3.string(), leftReserve: z3.string(), reserveDetails: z3.string().optional(), extinguisherExpiration: z3.string().optional(), licenseExpiration: z3.string().optional(), totalAmount: z3.string(), paymentMethod: z3.string(), installmentsCount: z3.number(), installmentDates: z3.string().optional(), responsibleName: z3.string().optional(), responsibleCpf: z3.string().optional(), responsibleBirthDate: z3.string().optional(), observations: z3.string().optional(), items: z3.array(z3.object({ description: z3.string().min(1), quantity: z3.number().min(1), unitPrice: z3.string(), totalPrice: z3.string(), extinguisherId: z3.number().optional() })) })).mutation(async ({ input }) => {
        const { companyId, id, items, ...orderData } = input;
        await updateServiceOrder(id, { ...orderData, accountId: companyId }, items, companyId);
        return { success: true };
      }),
      trash: router({
        list: platformProcedure.input(z3.object({ companyId: z3.number().int().positive() })).query(({ input }) => listTrash(input.companyId)),
        restore: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
          await restoreTrashItem(input.id, input.companyId);
          return { success: true };
        }),
        permanentlyDelete: platformProcedure.input(z3.object({ companyId: z3.number().int().positive(), id: z3.number().int().positive() })).mutation(async ({ input }) => {
          await permanentlyDeleteTrashItem(input.id, input.companyId);
          return { success: true };
        })
      })
    })
  }),
  accounts: router({
    list: platformProcedure.query(() => listMemberAccounts()),
    create: platformProcedure.input(z3.object({ companyName: z3.string().min(2), userName: z3.string().min(2), email: z3.string().email(), password: z3.string().min(8) })).mutation(async ({ input }) => {
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
    setActive: platformProcedure.input(z3.object({ id: z3.number().int().positive(), active: z3.boolean() })).mutation(async ({ input }) => {
      await setMemberActive(input.id, input.active);
      return { success: true };
    }),
    resetPassword: platformProcedure.input(z3.object({ id: z3.number().int().positive(), newPassword: z3.string().min(8) })).mutation(async ({ input }) => {
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  companyUsers: router({
    list: companyAdminProcedure.query(({ ctx }) => listMemberAccounts(ctx.accountId)),
    create: companyAdminProcedure.input(z3.object({ userName: z3.string().min(2), email: z3.string().email(), password: z3.string().min(8), role: companyUserRole })).mutation(async ({ ctx, input }) => {
      try {
        await assertUserLimit(ctx.accountId);
        const created = await createCompanyUser({ ...input, companyId: ctx.accountId });
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
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError5({ code: "CONFLICT", message: "Este e-mail j\xE1 est\xE1 cadastrado." });
        console.error("[companyUsers.create] database error", { code: error?.code, errno: error?.errno, sqlMessage: error?.sqlMessage, message: error?.message });
        if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.code === "ER_NO_REFERENCED_ROW") throw new TRPCError5({ code: "BAD_REQUEST", message: "A empresa selecionada n\xE3o existe mais. Atualize a p\xE1gina e tente novamente." });
        if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "O banco de dados est\xE1 com a estrutura de usu\xE1rios desatualizada. A implanta\xE7\xE3o precisa concluir a migra\xE7\xE3o." });
        throw new TRPCError5({ code: "INTERNAL_SERVER_ERROR", message: "N\xE3o foi poss\xEDvel criar o usu\xE1rio. Verifique os dados e tente novamente." });
      }
    }),
    update: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive(), userName: z3.string().min(2).optional(), email: z3.string().email().optional(), role: companyUserRole.optional() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError5({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode remover o pr\xF3prio n\xEDvel administrativo." });
      const usersBefore = await listMemberAccounts(ctx.accountId);
      const beforeUser = usersBefore.find((u) => u.id === input.id) || null;
      await updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
      const usersAfter = await listMemberAccounts(ctx.accountId);
      const afterUser = usersAfter.find((u) => u.id === input.id) || null;
      const userDiff = diffAuditData(beforeUser, afterUser);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: input.id, entityLabel: afterUser?.userName || beforeUser?.userName || `#${input.id}`, description: `Usu\xE1rio atualizado: ${afterUser?.userName || input.id}`, oldData: userDiff.oldData, newData: userDiff.newData });
      return { success: true };
    }),
    setActive: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive(), active: z3.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError5({ code: "BAD_REQUEST", message: "O administrador n\xE3o pode desativar a pr\xF3pria sess\xE3o." });
      await setMemberActive(input.id, input.active, ctx.accountId);
      void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Usu\xE1rio ${input.active ? "ativado" : "desativado"} #${input.id}`, newData: { active: input.active } });
      return { success: true };
    }),
    resetPassword: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive(), newPassword: z3.string().min(8) })).mutation(async ({ ctx, input }) => {
      const users3 = await listMemberAccounts(ctx.accountId);
      if (!users3.some((account) => account.id === input.id)) throw new TRPCError5({ code: "NOT_FOUND", message: "Usu\xE1rio n\xE3o pertence a esta empresa." });
      await resetMemberPassword(input.id, input.newPassword);
      return { success: true };
    })
  }),
  dashboard: router({ stats: commercialProcedure.query(async ({ ctx }) => getDashboardStats(ctx.accountId)) }),
  companyProfile: router({
    updateName: companyAdminProcedure.input(z3.object({ name: z3.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
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
    getAlertDays: commercialProcedure.query(async ({ ctx }) => parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
    setAlertDays: companyAdminProcedure.input(z3.object({ days: z3.number().min(1).max(365) })).mutation(async ({ ctx, input }) => {
      const prev = await getSetting("alert_days_ahead", ctx.accountId, "30");
      await setSetting("alert_days_ahead", input.days.toString(), ctx.accountId);
      void auditFromCtx(ctx, { action: "settings_change", module: "settings", entityType: "setting", entityLabel: "alert_days_ahead", description: `Anteced\xEAncia de alertas alterada: ${prev} \u2192 ${input.days} dias`, oldData: { alert_days_ahead: prev }, newData: { alert_days_ahead: String(input.days) } });
      return { success: true, days: input.days };
    })
  }),
  clients: router({
    list: commercialProcedure.input(z3.object({ city: z3.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null;
      return getClients(input?.city, ctx.accountId, ownerUserId);
    }),
    page: commercialProcedure.input(z3.object({ page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), city: z3.string().optional(), search: z3.string().optional() }).optional()).query(({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null;
      return getClientsPage(ctx.accountId, { ...input || {}, ownerUserId });
    }),
    cities: commercialProcedure.query(async ({ ctx }) => getDistinctCities(ctx.accountId)),
    byId: commercialProcedure.input(z3.object({ id: z3.number() })).query(async ({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null;
      const client = await getClientById(input.id, ctx.accountId, ownerUserId);
      if (!client) return { client: null, extinguishers: [], orders: [] };
      return {
        client,
        extinguishers: await getExtinguishersByClient(input.id, ctx.accountId),
        orders: await getServiceOrders(input.id, ctx.accountId, ownerUserId)
      };
    }),
    create: commercialProcedure.input(clientInput).mutation(async ({ ctx, input }) => {
      await assertClientLimit(ctx.accountId);
      const id = await createClient({ ...input, accountId: ctx.accountId, createdByUserId: ctx.memberAccountId ?? null, cnpj: emptyToNull(input.cnpj), address: emptyToNull(input.address), cep: emptyToNull(input.cep), phone: emptyToNull(input.phone), contactName: emptyToNull(input.contactName), cpf: emptyToNull(input.cpf), birthDate: emptyToNull(input.birthDate), notes: emptyToNull(input.notes) });
      void auditFromCtx(ctx, { action: "create", module: "clients", entityType: "client", entityId: id, entityLabel: input.companyName, description: `Cliente criado: ${input.companyName}`, newData: { ...input, id } });
      return { id };
    }),
    update: commercialProcedure.input(clientInput.extend({ id: z3.number() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const ownerUserId = ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null;
      const before = await getClientById(id, ctx.accountId, ownerUserId);
      if (!before) throw new TRPCError5({ code: "FORBIDDEN", message: "Cliente n\xE3o encontrado ou sem permiss\xE3o." });
      await updateClient(id, { ...data, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, ctx.accountId);
      const after = await getClientById(id, ctx.accountId, ownerUserId);
      const diff = diffAuditData(before, after);
      void auditFromCtx(ctx, { action: "update", module: "clients", entityType: "client", entityId: id, entityLabel: after?.companyName || before?.companyName || `#${id}`, description: `Cliente atualizado: ${after?.companyName || id}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true };
    }),
    delete: companyAdminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ ctx, input }) => {
      const before = await getClientById(input.id, ctx.accountId);
      await deleteClient(input.id, ctx.accountId);
      void auditFromCtx(ctx, { action: "delete", module: "clients", entityType: "client", entityId: input.id, entityLabel: before?.companyName || `#${input.id}`, description: `Cliente exclu\xEDdo (lixeira): ${before?.companyName || input.id}`, oldData: before });
      return { success: true };
    })
  }),
  extinguishers: router({
    list: commercialProcedure.query(({ ctx }) => getExtinguishers(ctx.accountId)),
    page: commercialProcedure.input(z3.object({ page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), clientId: z3.number().int().positive().optional(), search: z3.string().optional(), filter: z3.enum(["all", "active", "near", "expired"]).optional() }).optional()).query(({ ctx, input }) => getExtinguishersPage(ctx.accountId, input)),
    listByClient: commercialProcedure.input(z3.object({ clientId: z3.number() })).query(async ({ ctx, input }) => getExtinguishersByClient(input.clientId, ctx.accountId)),
    alerts: commercialProcedure.input(z3.object({ daysAhead: z3.number().optional() }).optional()).query(async ({ ctx, input }) => {
      const days = input?.daysAhead || parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30;
      return getExpiringExtinguishers(days, ctx.accountId);
    }),
    alertsPage: commercialProcedure.input(z3.object({ page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), daysAhead: z3.number().optional(), filter: z3.enum(["all", "near", "expired"]).optional(), search: z3.string().optional(), city: z3.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const days = input?.daysAhead || parseInt(await getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30;
      return getExpiringExtinguishersPage(days, ctx.accountId, input);
    }),
    create: commercialProcedure.input(z3.object({ clientId: z3.number(), typeModel: z3.string().min(1), capacity: z3.string().optional(), serialNumber: z3.string().optional(), locationInBuilding: z3.string().optional(), expirationDate: z3.string(), lastInspectionDate: z3.string().optional(), notes: z3.string().optional(), stockQuantity: z3.number().int().min(1).optional() })).mutation(async ({ ctx, input }) => {
      await assertExtinguisherLimit(ctx.accountId);
      const id = await createExtinguisher({ ...input, accountId: ctx.accountId, expirationDate: input.expirationDate, lastInspectionDate: input.lastInspectionDate || null, capacity: emptyToNull(input.capacity), serialNumber: emptyToNull(input.serialNumber), locationInBuilding: emptyToNull(input.locationInBuilding), notes: emptyToNull(input.notes) }, ctx.accountId);
      const label = input.serialNumber || input.typeModel || `#${id}`;
      let publicToken = null;
      try {
        publicToken = await ensureExtinguisherPublicToken(id, ctx.accountId);
      } catch {
        publicToken = null;
      }
      void auditFromCtx(ctx, { action: "create", module: "extinguishers", entityType: "extinguisher", entityId: id, entityLabel: label, description: `Extintor criado: ${label}`, newData: { ...input, id, publicToken } });
      return { id, publicToken };
    }),
    /** Garante token QR e retorna URL pública (não regenera se já existir). */
    qrInfo: commercialProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      const token = await ensureExtinguisherPublicToken(input.id, ctx.accountId);
      return { publicToken: token, url: buildExtinguisherPublicUrl(token) };
    }),
    ensurePublicToken: commercialProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const token = await ensureExtinguisherPublicToken(input.id, ctx.accountId);
      void auditFromCtx(ctx, {
        action: "update",
        module: "extinguishers",
        entityType: "extinguisher",
        entityId: input.id,
        entityLabel: `#${input.id}`,
        description: `QR Code garantido para extintor #${input.id}`,
        newData: { publicToken: token }
      });
      return { publicToken: token, url: buildExtinguisherPublicUrl(token) };
    }),
    backfillPublicTokens: companyAdminProcedure.mutation(async ({ ctx }) => {
      const result = await backfillExtinguisherPublicTokens(ctx.accountId);
      void auditFromCtx(ctx, {
        action: "update",
        module: "extinguishers",
        entityType: "extinguisher",
        entityId: null,
        description: `Backfill de QR Codes: ${result.updated} extintor(es)`,
        newData: result
      });
      return result;
    }),
    update: commercialProcedure.input(z3.object({ id: z3.number(), typeModel: z3.string().min(1), capacity: z3.string().optional(), serialNumber: z3.string().optional(), locationInBuilding: z3.string().optional(), expirationDate: z3.string(), lastInspectionDate: z3.string().optional(), notes: z3.string().optional() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const rowsBefore = await getExtinguishers(ctx.accountId);
      const before = rowsBefore.find((e) => e.id === id) || null;
      await updateExtinguisher(id, { ...data, expirationDate: data.expirationDate, lastInspectionDate: data.lastInspectionDate || null }, ctx.accountId);
      const rowsAfter = await getExtinguishers(ctx.accountId);
      const after = rowsAfter.find((e) => e.id === id) || null;
      const diff = diffAuditData(before, after);
      const label = after?.serialNumber || after?.typeModel || before?.serialNumber || `#${id}`;
      void auditFromCtx(ctx, { action: "update", module: "extinguishers", entityType: "extinguisher", entityId: id, entityLabel: label, description: `Extintor atualizado: ${label}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true };
    }),
    delete: companyAdminProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ ctx, input }) => {
      const rows = await getExtinguishers(ctx.accountId);
      const before = rows.find((e) => e.id === input.id) || null;
      await deleteExtinguisher(input.id, ctx.accountId);
      const label = before?.serialNumber || before?.typeModel || `#${input.id}`;
      void auditFromCtx(ctx, { action: "delete", module: "extinguishers", entityType: "extinguisher", entityId: input.id, entityLabel: label, description: `Extintor exclu\xEDdo (lixeira): ${label}`, oldData: before });
      return { success: true };
    })
  }),
  orders: router({
    list: commercialProcedure.input(z3.object({ clientId: z3.number().optional() }).optional()).query(async ({ ctx, input }) => getServiceOrders(input?.clientId, ctx.accountId, ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null)),
    page: commercialProcedure.input(z3.object({ page: z3.number().int().positive().optional(), pageSize: z3.number().int().positive().max(100).optional(), clientId: z3.number().int().positive().optional(), search: z3.string().optional(), city: z3.string().optional(), from: z3.string().optional(), to: z3.string().optional() }).optional()).query(({ ctx, input }) => getServiceOrdersPage(ctx.accountId, { ...input || {}, ownerUserId: ctx.user?.role === "company_admin" ? null : ctx.memberAccountId ?? null })),
    history: commercialProcedure.input(z3.object({ clientId: z3.number() })).query(async ({ ctx, input }) => getServiceOrderHistory(input.clientId, ctx.accountId)),
    nextNumber: commercialProcedure.query(async ({ ctx }) => getNextOrderNumber(ctx.accountId)),
    byId: commercialProcedure.input(z3.object({ id: z3.number() })).query(async ({ ctx, input }) => getServiceOrderById(input.id, ctx.accountId)),
    create: commercialProcedure.input(z3.object({ orderNumber: z3.number().optional(), orderDate: z3.string(), clientId: z3.number(), replacedAndDelivered: z3.string().default("SIM"), leftReserve: z3.string().default("N\xC3O"), reserveDetails: z3.string().optional(), extinguisherExpiration: z3.string().optional(), licenseExpiration: z3.string().optional(), totalAmount: z3.string().default("0.00"), paymentMethod: z3.string().default("A VISTA"), installmentsCount: z3.number().default(1), installmentDates: z3.string().optional(), responsibleName: z3.string().optional(), responsibleCpf: z3.string().optional(), responsibleBirthDate: z3.string().optional(), observations: z3.string().optional(), items: z3.array(z3.object({ description: z3.string().min(1), quantity: z3.number().min(1), unitPrice: z3.string(), totalPrice: z3.string(), extinguisherId: z3.number().optional() })) })).mutation(async ({ ctx, input }) => {
      await assertServiceOrderFeature(ctx.accountId);
      const { items, ...orderData } = input;
      const created = await createServiceOrder({ ...orderData, accountId: ctx.accountId, createdByName: ctx.user.name || ctx.user.email || "Usu\xE1rio n\xE3o identificado", createdByUserId: ctx.memberAccountId ?? null }, items, ctx.accountId);
      const orderId = typeof created === "object" && created !== null ? Number(created.id ?? created) : Number(created);
      void auditFromCtx(ctx, { action: "create", module: "orders", entityType: "order", entityId: orderId || null, entityLabel: "OS", description: "Ordem de servi\xE7o criada", newData: { ...orderData, items } });
      return created;
    }),
    update: commercialProcedure.input(z3.object({ id: z3.number(), orderDate: z3.string(), clientId: z3.number(), replacedAndDelivered: z3.string(), leftReserve: z3.string(), reserveDetails: z3.string().optional(), extinguisherExpiration: z3.string().optional(), licenseExpiration: z3.string().optional(), totalAmount: z3.string(), paymentMethod: z3.string(), installmentsCount: z3.number(), installmentDates: z3.string().optional(), responsibleName: z3.string().optional(), responsibleCpf: z3.string().optional(), responsibleBirthDate: z3.string().optional(), observations: z3.string().optional(), items: z3.array(z3.object({ description: z3.string().min(1), quantity: z3.number().min(1), unitPrice: z3.string(), totalPrice: z3.string(), extinguisherId: z3.number().optional() })) })).mutation(async ({ ctx, input }) => {
      const { id, items, ...orderData } = input;
      const before = await getServiceOrderById(id, ctx.accountId);
      if (!before) throw new TRPCError5({ code: "NOT_FOUND", message: "Ordem n\xE3o encontrada." });
      if (ctx.user?.role !== "company_admin" && before.createdByUserId != null && before.createdByUserId !== ctx.memberAccountId) {
        throw new TRPCError5({ code: "FORBIDDEN", message: "Voc\xEA s\xF3 pode editar ordens que voc\xEA criou." });
      }
      await updateServiceOrder(id, { ...orderData, accountId: ctx.accountId }, items, ctx.accountId);
      const after = await getServiceOrderById(id, ctx.accountId);
      const diff = diffAuditData(before, after);
      void auditFromCtx(ctx, { action: "update", module: "orders", entityType: "order", entityId: id, entityLabel: `OS #${after?.orderNumber || before?.orderNumber || id}`, description: `Ordem de servi\xE7o atualizada #${after?.orderNumber || id}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true };
    }),
    delete: commercialProcedure.input(z3.object({ id: z3.number() })).mutation(async ({ ctx, input }) => {
      const before = await getServiceOrderById(input.id, ctx.accountId);
      await deleteServiceOrder(input.id, ctx.accountId);
      void auditFromCtx(ctx, { action: "delete", module: "orders", entityType: "order", entityId: input.id, entityLabel: `OS #${before?.orderNumber || input.id}`, description: `Ordem de servi\xE7o exclu\xEDda (lixeira) #${before?.orderNumber || input.id}`, oldData: before });
      return { success: true };
    })
  }),
  trash: router({
    list: companyAdminProcedure.query(({ ctx }) => listTrash(ctx.accountId)),
    restore: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await restoreTrashItem(input.id, ctx.accountId);
      return { success: true };
    }),
    permanentlyDelete: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await permanentlyDeleteTrashItem(input.id, ctx.accountId);
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
  publicExtinguisher: router({
    byToken: publicProcedure.input(z3.object({ token: z3.string().min(10).max(32) })).query(async ({ ctx, input }) => {
      const data = await getPublicExtinguisherByToken(input.token);
      if (!data) throw new TRPCError5({ code: "NOT_FOUND", message: "Extintor n\xE3o encontrado." });
      const { _internalId, _accountId, ...publicFields } = data;
      const sameCompany = Boolean(ctx.accountId) && Number(ctx.accountId) === Number(_accountId) && ctx.user && ctx.user.role !== "platform_admin";
      return {
        ...publicFields,
        canManage: sameCompany,
        extinguisherId: sameCompany ? _internalId : void 0
      };
    })
  }),
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
    mockCheckout: companyAdminProcedure.input(z3.object({
      planId: z3.number().int().positive(),
      outcome: z3.enum(["approved", "pending", "overdue", "canceled"]).default("approved")
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
    mockCheckoutOpen: companyBillingProcedure.input(z3.object({
      planId: z3.number().int().positive(),
      outcome: z3.enum(["approved", "pending", "overdue", "canceled"]).default("approved")
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "company_admin") {
        throw new TRPCError5({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode assinar." });
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
  operations: router({
    stores: router({
      list: commercialProcedure.input(z3.object({ search: z3.string().optional() }).optional()).query(({ ctx, input }) => listOperationalStores(ctx.accountId, input?.search)),
      create: commercialProcedure.input(z3.object({ name: z3.string().min(2), city: z3.string().min(2), address: z3.string().optional(), state: z3.string().length(2).optional(), cep: z3.string().optional(), code: z3.string().optional(), latitude: z3.number().optional(), longitude: z3.number().optional(), notes: z3.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError5({ code: "FORBIDDEN", message: "Promotores n\xE3o podem cadastrar lojas." });
        return createOperationalStore({ ...input, companyId: ctx.accountId, active: true });
      })
    }),
    routes: router({
      list: commercialProcedure.input(z3.object({ date: z3.string().optional(), promoterId: z3.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listOperationalRoutes(ctx.accountId, { date: input?.date, promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : input?.promoterId })),
      create: commercialProcedure.input(z3.object({ name: z3.string().min(2), date: z3.string().min(8), promoterId: z3.number().int().positive(), storeIds: z3.array(z3.number().int().positive()).min(1), teamId: z3.number().int().positive().optional(), notes: z3.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError5({ code: "FORBIDDEN", message: "Promotores n\xE3o podem criar roteiros." });
        const members = await listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError5({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        const { storeIds, ...route } = input;
        return createOperationalRouteWithVisits({ route: { ...route, date: /* @__PURE__ */ new Date(`${input.date}T00:00:00.000Z`), companyId: ctx.accountId, status: "assigned" }, storeIds });
      })
    }),
    visits: router({
      today: commercialProcedure.query(({ ctx }) => listOperationalVisits(ctx.accountId, { date: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : void 0 })),
      list: commercialProcedure.input(z3.object({ date: z3.string().optional(), routeId: z3.number().int().positive().optional(), promoterId: z3.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listOperationalVisits(ctx.accountId, { date: input?.date, routeId: input?.routeId, promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : input?.promoterId })),
      start: commercialProcedure.input(z3.object({ id: z3.number().int().positive(), latitude: z3.number().optional(), longitude: z3.number().optional(), accuracy: z3.number().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await listOperationalVisits(ctx.accountId, { promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : void 0 });
        const owned = visit.find((row2) => row2.visit.id === input.id);
        if (!owned) throw new TRPCError5({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        if (ctx.user.role === "promoter" && owned.visit.promoterId !== ctx.memberAccountId) throw new TRPCError5({ code: "FORBIDDEN", message: "Visita n\xE3o pertence ao promotor autenticado." });
        return updateOperationalVisit(ctx.accountId, input.id, { status: "in_progress", actualStart: /* @__PURE__ */ new Date(), startLatitude: input.latitude, startLongitude: input.longitude, startAccuracy: input.accuracy });
      }),
      complete: commercialProcedure.input(z3.object({ id: z3.number().int().positive(), latitude: z3.number().optional(), longitude: z3.number().optional(), accuracy: z3.number().optional(), notes: z3.string().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await listOperationalVisits(ctx.accountId, { promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : void 0 });
        const owned = visit.find((row2) => row2.visit.id === input.id);
        if (!owned) throw new TRPCError5({ code: "NOT_FOUND", message: "Visita n\xE3o encontrada para esta empresa." });
        return updateOperationalVisit(ctx.accountId, input.id, { status: "completed", actualEnd: /* @__PURE__ */ new Date(), endLatitude: input.latitude, endLongitude: input.longitude, endAccuracy: input.accuracy, notes: input.notes });
      })
    })
  }),
  audit: router({
    list: companyAdminProcedure.input(z3.object({
      page: z3.number().int().positive().optional(),
      pageSize: z3.number().int().positive().max(100).optional(),
      from: z3.string().optional(),
      to: z3.string().optional(),
      userId: z3.number().int().positive().optional(),
      module: z3.string().optional(),
      action: z3.string().optional(),
      entityType: z3.string().optional(),
      entityId: z3.number().int().positive().optional(),
      search: z3.string().optional()
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
    byId: companyAdminProcedure.input(z3.object({ id: z3.number().int().positive() })).query(async ({ ctx, input }) => {
      const row2 = await getAuditLogById(input.id, ctx.accountId);
      if (!row2) throw new TRPCError5({ code: "NOT_FOUND", message: "Registro de auditoria n\xE3o encontrado." });
      return row2;
    }),
    entityHistory: commercialProcedure.input(z3.object({
      entityType: z3.string().min(1),
      entityId: z3.number().int().positive(),
      page: z3.number().int().positive().optional(),
      pageSize: z3.number().int().positive().max(100).optional()
    })).query(async ({ ctx, input }) => listEntityAuditHistory({
      companyId: ctx.accountId,
      entityType: input.entityType,
      entityId: input.entityId,
      page: input.page,
      pageSize: input.pageSize
    })),
    exportCsv: companyAdminProcedure.input(z3.object({
      from: z3.string().optional(),
      to: z3.string().optional(),
      userId: z3.number().int().positive().optional(),
      module: z3.string().optional(),
      action: z3.string().optional(),
      entityType: z3.string().optional(),
      entityId: z3.number().int().positive().optional(),
      search: z3.string().optional()
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
    platformList: platformProcedure.input(z3.object({
      companyId: z3.number().int().positive().optional(),
      page: z3.number().int().positive().optional(),
      pageSize: z3.number().int().positive().max(100).optional(),
      from: z3.string().optional(),
      to: z3.string().optional(),
      module: z3.string().optional(),
      action: z3.string().optional(),
      search: z3.string().optional()
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
import { parse as parseCookie2 } from "cookie";
async function createContext(opts) {
  let user = null;
  let accountId;
  let memberAccountId;
  let platformAdminId;
  let isMember = false;
  let isPlatformAdmin = false;
  const cookies = parseCookie2(opts.req.headers.cookie ?? "");
  const sessionToken = cookies[MEMBER_COOKIE_NAME] ?? "";
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
          role: memberAccount.role,
          companyId: memberAccount.companyId,
          createdAt: memberAccount.createdAt,
          updatedAt: memberAccount.updatedAt,
          lastSignedIn: memberAccount.createdAt
        };
      }
    }
  }
  return { req: opts.req, res: opts.res, user, accountId, memberAccountId, platformAdminId, isMember, isPlatformAdmin };
}

// server/scheduledMaintenance.ts
import crypto2 from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import mysql2 from "mysql2/promise";

// server/storage.ts
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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
  const client = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT || void 0,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
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

// server/scheduledMaintenance.ts
function backupDirectory() {
  return process.env.BACKUP_DIR || "/tmp/gestao-extintores-backups/daily";
}
async function pruneBackups(directory, retentionDays) {
  const cutoff = Date.now() - retentionDays * 864e5;
  let removed = 0;
  try {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !/^extintores-.*\.json$/.test(entry.name)) continue;
      const file = path.join(directory, entry.name);
      if ((await fs.stat(file)).mtimeMs < cutoff) {
        await fs.rm(file);
        await fs.rm(`${file}.sha256`, { force: true });
        removed += 1;
      }
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return removed;
}
async function runScheduledMaintenance() {
  const url = process.env.EXTERNAL_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("Database URL is not configured.");
  const directory = backupDirectory();
  const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 14));
  const connection = await mysql2.createConnection({ uri: url, ssl: { rejectUnauthorized: true }, connectTimeout: 1e4 });
  try {
    await fs.mkdir(directory, { recursive: true, mode: 448 });
    const [tableRows] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const tableNames = tableRows.map((row2) => Object.values(row2)[0]).filter((name) => name !== "__drizzle_migrations");
    const tables = [];
    for (const tableName of tableNames) {
      const [[definition]] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      const [rows] = await connection.query(`SELECT * FROM \`${tableName}\``);
      tables.push({ name: tableName, createSql: definition["Create Table"], rows });
    }
    const backup = { format: 1, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), database: "mysql-compatible", schemaOnly: false, tables };
    const serialized = JSON.stringify(backup, null, 2);
    const file = path.join(directory, `extintores-${(/* @__PURE__ */ new Date()).toISOString().replaceAll(/[:.]/g, "-")}.json`);
    await fs.writeFile(file, serialized, { mode: 384 });
    const checksum = crypto2.createHash("sha256").update(serialized).digest("hex");
    await fs.writeFile(`${file}.sha256`, `${checksum}  ${path.basename(file)}
`, { mode: 384 });
    const objectPrefix = `backups/database/${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    const stored = await storagePut(`${objectPrefix}/${path.basename(file)}`, serialized, "application/json");
    await storagePut(`${objectPrefix}/${path.basename(file)}.sha256`, `${checksum}  ${path.basename(file)}
`, "text/plain");
    const [trash] = await connection.query("DELETE FROM trash_items WHERE expiresAt <= UTC_TIMESTAMP()");
    const [memberSessions3] = await connection.query("DELETE FROM member_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    const [platformSessions3] = await connection.query("DELETE FROM platform_sessions WHERE expiresAt <= UTC_TIMESTAMP()");
    const removed = await pruneBackups(directory, retentionDays);
    return { file, storageKey: stored.key, tables: tables.length, checksum, removed, cleaned: { trash: trash.affectedRows, memberSessions: memberSessions3.affectedRows, platformSessions: platformSessions3.affectedRows } };
  } finally {
    await connection.end();
  }
}
async function runExpirationEmailAlerts(daysAhead = 30) {
  const { getDb: getDb3 } = await Promise.resolve().then(() => (init_db(), db_exports));
  const dbmod = await Promise.resolve().then(() => (init_db(), db_exports));
  const emailService = await Promise.resolve().then(() => (init_email(), email_exports));
  const schema = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const { eq: eq5, and: and4 } = await import("drizzle-orm");
  const database = await getDb3();
  if (!database) return { companies: 0, emails: 0 };
  const companies3 = await database.select({ id: schema.companies.id, name: schema.companies.name }).from(schema.companies).where(eq5(schema.companies.active, true));
  let emails = 0;
  for (const company of companies3) {
    const alerts = await dbmod.getExpiringExtinguishers(daysAhead, company.id);
    const actionable = alerts.filter((a) => a.alertStatus === "expired" || a.alertStatus === "urgent" || a.alertStatus === "warning");
    if (!actionable.length) continue;
    const admins = await database.select({
      email: schema.memberAccounts.email,
      userName: schema.memberAccounts.userName
    }).from(schema.memberAccounts).where(
      and4(
        eq5(schema.memberAccounts.companyId, company.id),
        eq5(schema.memberAccounts.active, true),
        eq5(schema.memberAccounts.role, "company_admin")
      )
    );
    if (!admins.length) continue;
    const items = actionable.map((a) => ({
      clientName: a.client?.companyName || "Cliente",
      type: a.extinguisher?.type || a.extinguisher?.extinguisherType || void 0,
      capacity: a.extinguisher?.capacity || void 0,
      expirationDate: String(a.extinguisher?.expirationDate || ""),
      alertMessage: a.alertMessage || ""
    }));
    for (const admin of admins) {
      if (!admin.email) continue;
      const res = await emailService.emailExtinguisherAlerts({
        to: admin.email,
        companyName: company.name,
        userName: admin.userName || admin.email,
        items
      });
      if (res.ok) emails += 1;
    }
  }
  return { companies: companies3.length, emails };
}

// server/vercel-entry.ts
import crypto3 from "node:crypto";
async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
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
      let expiry = null;
      try {
        expiry = await runExpirationEmailAlerts(30);
      } catch (e) {
        console.warn("[email] expiry alerts", e);
      }
      return res.json({ ok: true, result, expiry });
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
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));
  const distPath = path2.resolve(process.cwd(), "dist", "public");
  if (fs2.existsSync(distPath)) {
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith("index.html") || filePath.endsWith("sw.js")) {
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
        }
      }
    }));
    app.use("*", (_req, res) => res.sendFile(path2.resolve(distPath, "index.html")));
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
