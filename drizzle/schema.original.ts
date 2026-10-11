import { boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/** Identidades OAuth do provedor; somente a identidade do proprietário pode ser platform_admin. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["oauth_user", "platform_admin"]).default("oauth_user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Empresas clientes; esta entidade representa o tenant dos dados comerciais. */
export const companies = mysqlTable("companies", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  activeIdx: index("companies_active_idx").on(table.active),
  nameIdx: index("companies_name_idx").on(table.name),
  planIdx: index("companies_plan_idx").on(table.planId),
  subscriptionStatusIdx: index("companies_subscription_status_idx").on(table.subscriptionStatus),
}));

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/** Administradores globais da plataforma. Nunca possuem companyId/accountId. */
export const platformAdmins = mysqlTable("platform_admins", {
  id: int("id").autoincrement().primaryKey(),
  userName: varchar("userName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  recoveryCodeHash: varchar("recoveryCodeHash", { length: 255 }),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformAdmin = typeof platformAdmins.$inferSelect;
export type InsertPlatformAdmin = typeof platformAdmins.$inferInsert;

/** Usuários que pertencem a uma empresa. O papel nunca pode ser platform_admin. */
export const memberAccounts = mysqlTable("member_accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  userName: varchar("userName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  recoveryCodeHash: varchar("recoveryCodeHash", { length: 255 }),
  role: mysqlEnum("role", ["company_admin", "supervisor", "promoter"]).default("promoter").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("member_accounts_company_idx").on(table.companyId),
  companyRoleIdx: index("member_accounts_company_role_idx").on(table.companyId, table.role),
}));

export type MemberAccount = typeof memberAccounts.$inferSelect;
export type InsertMemberAccount = typeof memberAccounts.$inferInsert;

/** Sessões de usuários de empresas. */
export const memberSessions = mysqlTable("member_sessions", {
  id: int("id").autoincrement().primaryKey(),
  memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  accountExpiryIdx: index("member_sessions_account_expiry_idx").on(table.memberAccountId, table.expiresAt),
}));

export type MemberSession = typeof memberSessions.$inferSelect;
export type InsertMemberSession = typeof memberSessions.$inferInsert;

/** Sessões do administrador da plataforma. Nunca apontam para uma empresa. */
export const platformSessions = mysqlTable("platform_sessions", {
  id: int("id").autoincrement().primaryKey(),
  platformAdminId: int("platformAdminId").notNull().references(() => platformAdmins.id, { onDelete: "cascade" }),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  adminExpiryIdx: index("platform_sessions_admin_expiry_idx").on(table.platformAdminId, table.expiresAt),
}));

export type PlatformSession = typeof platformSessions.$inferSelect;
export type InsertPlatformSession = typeof platformSessions.$inferInsert;

/** Clientes pertencem obrigatoriamente a uma empresa, nunca à plataforma. */
export const clients = mysqlTable("clients", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("clients_account_idx").on(table.accountId),
  cityIdx: index("clients_account_city_idx").on(table.accountId, table.city),
}));

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

export const extinguishers = mysqlTable("extinguishers", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("extinguishers_account_idx").on(table.accountId),
  clientIdx: index("extinguishers_client_idx").on(table.clientId),
  expirationIdx: index("extinguishers_account_expiration_idx").on(table.accountId, table.expirationDate),
  publicTokenIdx: index("extinguishers_public_token_idx").on(table.publicToken),
}));

export type Extinguisher = typeof extinguishers.$inferSelect;
export type InsertExtinguisher = typeof extinguishers.$inferInsert;

export const serviceOrders = mysqlTable("service_orders", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  orderNumber: int("orderNumber").notNull(),
  orderDate: date("orderDate").notNull(),
  createdByName: varchar("createdByName", { length: 255 }),
  createdByUserId: int("createdByUserId"),
  clientId: int("clientId").notNull().references(() => clients.id, { onDelete: "restrict" }),
  replacedAndDelivered: varchar("replacedAndDelivered", { length: 10 }).default("SIM"),
  leftReserve: varchar("leftReserve", { length: 10 }).default("NÃO"),
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountIdx: index("service_orders_account_idx").on(table.accountId),
  clientIdx: index("service_orders_client_idx").on(table.clientId),
  dateIdx: index("service_orders_account_date_idx").on(table.accountId, table.orderDate),
  numberIdx: index("service_orders_account_number_idx").on(table.accountId, table.orderNumber),
}));

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

export const serviceOrderItems = mysqlTable("service_order_items", {
  id: int("id").autoincrement().primaryKey(),
  serviceOrderId: int("serviceOrderId").notNull().references(() => serviceOrders.id, { onDelete: "cascade" }),
  description: varchar("description", { length: 255 }).notNull(),
  quantity: int("quantity").notNull().default(1),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  totalPrice: decimal("totalPrice", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  orderIdx: index("service_order_items_order_idx").on(table.serviceOrderId),
}));

export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect;
export type InsertServiceOrderItem = typeof serviceOrderItems.$inferInsert;

/** Lixeira de segurança: mantém um snapshot por 24 horas antes da expiração. */
export const trashItems = mysqlTable("trash_items", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  itemType: varchar("itemType", { length: 40 }).notNull(),
  originalId: int("originalId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  snapshot: text("snapshot").notNull(),
  deletedAt: timestamp("deletedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, (table) => ({
  accountExpiryIdx: index("trash_items_account_expiry_idx").on(table.accountId, table.expiresAt),
  accountDeletedIdx: index("trash_items_account_deleted_idx").on(table.accountId, table.deletedAt),
}));

export type TrashItem = typeof trashItems.$inferSelect;
export type InsertTrashItem = typeof trashItems.$inferInsert;

export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  accountId: int("accountId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  settingKey: varchar("settingKey", { length: 100 }).notNull(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountKeyUnique: uniqueIndex("system_settings_account_key_unique").on(table.accountId, table.settingKey),
  accountIdx: index("system_settings_account_idx").on(table.accountId),
}));


/** Planos comerciais da plataforma (preço e limites); módulos ficam no catálogo normalizado. */
export const subscriptionPlans = mysqlTable("subscription_plans", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nameIdx: index("subscription_plans_name_idx").on(table.name),
  availableIdx: index("subscription_plans_available_idx").on(table.availableForNew, table.active),
}));

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;

/** Assinatura de uma empresa a um plano. */
export const companySubscriptions = mysqlTable("company_subscriptions", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("company_subscriptions_company_idx").on(table.companyId),
  planIdx: index("company_subscriptions_plan_idx").on(table.planId),
  statusIdx: index("company_subscriptions_status_idx").on(table.status),
  endsAtIdx: index("company_subscriptions_ends_at_idx").on(table.endsAt),
  asaasSubIdx: index("company_subscriptions_asaas_sub_idx").on(table.asaasSubscriptionId),
}));

export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = typeof companySubscriptions.$inferInsert;

/** Cobranças/pagamentos (Asaas ou mock). */
export const payments = mysqlTable("payments", {
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("payments_company_idx").on(table.companyId),
  subscriptionIdx: index("payments_subscription_idx").on(table.subscriptionId),
  asaasPaymentIdx: index("payments_asaas_payment_idx").on(table.asaasPaymentId),
  statusIdx: index("payments_status_idx").on(table.status),
}));

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/** Eventos de webhook (idempotência por eventId). */
export const paymentEvents = mysqlTable("payment_events", {
  id: int("id").autoincrement().primaryKey(),
  eventId: varchar("eventId", { length: 128 }).notNull().unique(),
  event: varchar("event", { length: 120 }).notNull(),
  paymentId: int("paymentId"),
  subscriptionId: int("subscriptionId"),
  payload: text("payload").notNull(),
  processed: boolean("processed").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  processedIdx: index("payment_events_processed_idx").on(table.processed),
}));

export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type InsertPaymentEvent = typeof paymentEvents.$inferInsert;

/**
 * Registro imutável de auditoria (append-only).
 * companyId isola o tenant; platform admin consulta com companyId opcional.
 * Nunca armazenar senhas, tokens ou dados sensíveis em oldData/newData.
 */
export const auditLogs = mysqlTable("audit_logs", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("audit_logs_company_idx").on(table.companyId),
  companyCreatedIdx: index("audit_logs_company_created_idx").on(table.companyId, table.createdAt),
  userIdx: index("audit_logs_user_idx").on(table.userId),
  entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  actionIdx: index("audit_logs_action_idx").on(table.action),
  moduleIdx: index("audit_logs_module_idx").on(table.module),
  createdIdx: index("audit_logs_created_idx").on(table.createdAt),
}));

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
