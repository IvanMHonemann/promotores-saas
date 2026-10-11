import { boolean, date, decimal, index, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar, double } from "drizzle-orm/mysql-core";

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

/** Empresas contratantes (agências de promotores); tenant principal. */
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

/** Administradores globais da plataforma. Nunca possuem companyId. */
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

/** Usuários de empresas: company_admin, supervisor, promoter. */
export const memberAccounts = mysqlTable("member_accounts", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  userName: varchar("userName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  recoveryCodeHash: varchar("recoveryCodeHash", { length: 255 }),
  role: mysqlEnum("role", ["company_admin", "supervisor", "promoter"]).default("promoter").notNull(),
  active: boolean("active").default(true).notNull(),
  employeeCode: varchar("employeeCode", { length: 50 }),
  phone: varchar("phone", { length: 50 }),
  supervisorId: int("supervisorId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("member_accounts_company_idx").on(table.companyId),
  companyRoleIdx: index("member_accounts_company_role_idx").on(table.companyId, table.role),
  employeeCodeIdx: index("member_accounts_employee_code_idx").on(table.companyId, table.employeeCode),
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

/** Sessões do administrador da plataforma. */
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

/** Clientes atendidos pela agência (marcas / indústrias). */
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  cnpj: varchar("cnpj", { length: 30 }),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("clients_company_idx").on(table.companyId),
  nameIdx: index("clients_company_name_idx").on(table.companyId, table.name),
}));

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

/** Marcas / indústrias associadas a clientes. */
export const brands = mysqlTable("brands", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("brands_company_idx").on(table.companyId),
  clientIdx: index("brands_client_idx").on(table.clientId),
}));

export type Brand = typeof brands.$inferSelect;
export type InsertBrand = typeof brands.$inferInsert;

/** Redes varejistas. */
export const retailChains = mysqlTable("retail_chains", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("retail_chains_company_idx").on(table.companyId),
}));

export type RetailChain = typeof retailChains.$inferSelect;
export type InsertRetailChain = typeof retailChains.$inferInsert;

/** Lojas / pontos de venda. */
export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
  brandId: int("brandId").references(() => brands.id, { onDelete: "set null" }),
  retailChainId: int("retailChainId").references(() => retailChains.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 50 }),
  address: text("address"),
  city: varchar("city", { length: 120 }).notNull(),
  state: varchar("state", { length: 2 }),
  cep: varchar("cep", { length: 20 }),
  latitude: double("latitude"),
  longitude: double("longitude"),
  contactName: varchar("contactName", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  expectedVisitFrequency: varchar("expectedVisitFrequency", { length: 50 }),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("stores_company_idx").on(table.companyId),
  clientIdx: index("stores_client_idx").on(table.clientId),
  cityIdx: index("stores_company_city_idx").on(table.companyId, table.city),
  geoIdx: index("stores_geo_idx").on(table.latitude, table.longitude),
}));

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

/** Equipes. */
export const teams = mysqlTable("teams", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  supervisorId: int("supervisorId"),
  notes: text("notes"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("teams_company_idx").on(table.companyId),
}));

export type Team = typeof teams.$inferSelect;
export type InsertTeam = typeof teams.$inferInsert;

/** Roteiros de visitas. */
export const routes = mysqlTable("routes", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  date: date("date").notNull(),
  promoterId: int("promoterId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  teamId: int("teamId").references(() => teams.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["draft", "assigned", "in_progress", "completed", "cancelled"]).default("assigned").notNull(),
  notes: text("notes"),
  createdByUserId: int("createdByUserId"),
  weeklyScheduleId: int("weeklyScheduleId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("routes_company_idx").on(table.companyId),
  promoterDateIdx: index("routes_promoter_date_idx").on(table.promoterId, table.date),
  dateIdx: index("routes_company_date_idx").on(table.companyId, table.date),
  weeklyOccurrenceUnique: uniqueIndex("routes_weekly_occurrence_unique").on(table.weeklyScheduleId, table.date),
}));

export type Route = typeof routes.$inferSelect;
export type InsertRoute = typeof routes.$inferInsert;
/** Modelos semanais recorrentes; storeIds conserva a ordem definida pela gestão. */
export const weeklyRouteSchedules = mysqlTable("weekly_route_schedules", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  promoterId: int("promoterId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  weekday: int("weekday").notNull(), // 0 = domingo, 6 = sábado
  name: varchar("name", { length: 255 }).notNull(),
  storeIds: json("storeIds").$type<number[]>().notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("weekly_route_schedules_company_idx").on(table.companyId),
  promoterDayUnique: uniqueIndex("weekly_route_schedules_promoter_day_unique").on(table.companyId, table.promoterId, table.weekday),
}));
export type WeeklyRouteSchedule = typeof weeklyRouteSchedules.$inferSelect;
export type InsertWeeklyRouteSchedule = typeof weeklyRouteSchedules.$inferInsert;

/** Visitas previstas / executadas. */
export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  routeId: int("routeId").references(() => routes.id, { onDelete: "cascade" }),
  storeId: int("storeId").notNull().references(() => stores.id, { onDelete: "restrict" }),
  promoterId: int("promoterId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  plannedStart: timestamp("plannedStart"),
  plannedEnd: timestamp("plannedEnd"),
  actualStart: timestamp("actualStart"),
  actualEnd: timestamp("actualEnd"),
  status: mysqlEnum("status", ["pending", "in_progress", "completed", "not_done", "cancelled"]).default("pending").notNull(),
  startLatitude: double("startLatitude"),
  startLongitude: double("startLongitude"),
  startAccuracy: double("startAccuracy"),
  endLatitude: double("endLatitude"),
  endLongitude: double("endLongitude"),
  endAccuracy: double("endAccuracy"),
  distanceMeters: double("distanceMeters"),
  justification: text("justification"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("visits_company_idx").on(table.companyId),
  routeIdx: index("visits_route_idx").on(table.routeId),
  storeIdx: index("visits_store_idx").on(table.storeId),
  promoterIdx: index("visits_promoter_idx").on(table.promoterId),
  statusIdx: index("visits_status_idx").on(table.companyId, table.status),
}));

export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;

/** Eventos de ponto (marcações). */
export const timeEvents = mysqlTable("time_events", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  eventType: mysqlEnum("eventType", ["clock_in", "break_start", "break_end", "clock_out"]).notNull(),
  serverTime: timestamp("serverTime").defaultNow().notNull(),
  deviceTime: timestamp("deviceTime"),
  latitude: double("latitude"),
  longitude: double("longitude"),
  accuracy: double("accuracy"),
  locationStatus: mysqlEnum("locationStatus", ["success", "permission_denied", "unavailable", "timeout", "error"]).default("success"),
  locationError: text("locationError"),
  deviceInfo: text("deviceInfo"),
  idempotencyKey: varchar("idempotencyKey", { length: 64 }),
  synced: boolean("synced").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("time_events_company_idx").on(table.companyId),
  memberIdx: index("time_events_member_idx").on(table.memberAccountId),
  memberTimeIdx: index("time_events_member_time_idx").on(table.memberAccountId, table.serverTime),
  idempotencyIdx: uniqueIndex("time_events_idempotency_unique").on(table.idempotencyKey),
}));

export type TimeEvent = typeof timeEvents.$inferSelect;
export type InsertTimeEvent = typeof timeEvents.$inferInsert;

/** Solicitações de correção de ponto. */
export const timeCorrectionRequests = mysqlTable("time_correction_requests", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  timeEventId: int("timeEventId").references(() => timeEvents.id, { onDelete: "set null" }),
  requestedType: mysqlEnum("requestedType", ["clock_in", "break_start", "break_end", "clock_out"]).notNull(),
  requestedTime: timestamp("requestedTime").notNull(),
  justification: text("justification").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reviewedByUserId: int("reviewedByUserId"),
  reviewNotes: text("reviewNotes"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("time_corrections_company_idx").on(table.companyId),
  memberIdx: index("time_corrections_member_idx").on(table.memberAccountId),
  statusIdx: index("time_corrections_status_idx").on(table.companyId, table.status),
}));

export type TimeCorrectionRequest = typeof timeCorrectionRequests.$inferSelect;
export type InsertTimeCorrectionRequest = typeof timeCorrectionRequests.$inferInsert;

/** Checklists / formulários. */
export const checklists = mysqlTable("checklists", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  name: varchar("name", { length: 255 }).notNull(),
  clientId: int("clientId").references(() => clients.id, { onDelete: "set null" }),
  brandId: int("brandId").references(() => brands.id, { onDelete: "set null" }),
  description: text("description"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("checklists_company_idx").on(table.companyId),
}));

export type Checklist = typeof checklists.$inferSelect;
export type InsertChecklist = typeof checklists.$inferInsert;

/** Perguntas do checklist. */
export const checklistQuestions = mysqlTable("checklist_questions", {
  id: int("id").autoincrement().primaryKey(),
  checklistId: int("checklistId").notNull().references(() => checklists.id, { onDelete: "cascade" }),
  order: int("order").notNull().default(0),
  questionText: text("questionText").notNull(),
  questionType: mysqlEnum("questionType", ["text", "yes_no", "select", "number", "photo", "observation"]).notNull(),
  required: boolean("required").default(false).notNull(),
  options: text("options"), // JSON for select options
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  checklistIdx: index("checklist_questions_checklist_idx").on(table.checklistId),
}));

export type ChecklistQuestion = typeof checklistQuestions.$inferSelect;
export type InsertChecklistQuestion = typeof checklistQuestions.$inferInsert;

/** Respostas de checklist vinculadas a visitas. */
export const checklistResponses = mysqlTable("checklist_responses", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  visitId: int("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
  checklistId: int("checklistId").notNull().references(() => checklists.id, { onDelete: "restrict" }),
  promoterId: int("promoterId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  responses: text("responses").notNull(), // JSON
  completedAt: timestamp("completedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  visitIdx: index("checklist_responses_visit_idx").on(table.visitId),
  companyIdx: index("checklist_responses_company_idx").on(table.companyId),
}));

export type ChecklistResponse = typeof checklistResponses.$inferSelect;
export type InsertChecklistResponse = typeof checklistResponses.$inferInsert;

/** Evidências / fotos. */
export const evidences = mysqlTable("evidences", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "restrict" }),
  visitId: int("visitId").references(() => visits.id, { onDelete: "cascade" }),
  checklistResponseId: int("checklistResponseId").references(() => checklistResponses.id, { onDelete: "cascade" }),
  promoterId: int("promoterId").notNull().references(() => memberAccounts.id, { onDelete: "restrict" }),
  fileUrl: text("fileUrl").notNull(),
  fileName: varchar("fileName", { length: 255 }),
  mimeType: varchar("mimeType", { length: 100 }),
  sizeBytes: int("sizeBytes"),
  caption: text("caption"),
  latitude: double("latitude"),
  longitude: double("longitude"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  companyIdx: index("evidences_company_idx").on(table.companyId),
  visitIdx: index("evidences_visit_idx").on(table.visitId),
}));

export type Evidence = typeof evidences.$inferSelect;
export type InsertEvidence = typeof evidences.$inferInsert;

/** Auditoria (reutilizada e adaptada). */
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

/** Planos comerciais; os módulos são normalizados em subscription_plan_features. */
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

/** Recursos habilitados por plano; mantém o catálogo independente de colunas legadas. */
export const subscriptionPlanFeatures = mysqlTable("subscription_plan_features", {
  id: int("id").autoincrement().primaryKey(),
  planId: int("planId").notNull().references(() => subscriptionPlans.id, { onDelete: "cascade" }),
  featureKey: varchar("featureKey", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  planFeatureUnique: uniqueIndex("subscription_plan_features_plan_feature_unique").on(table.planId, table.featureKey),
  planIdx: index("subscription_plan_features_plan_idx").on(table.planId),
}));

export type SubscriptionPlanFeature = typeof subscriptionPlanFeatures.$inferSelect;

/** Exceções no nível da empresa; só o administrador da plataforma pode alterá-las. */
export const companyFeatureOverrides = mysqlTable("company_feature_overrides", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  featureKey: varchar("featureKey", { length: 64 }).notNull(),
  enabled: boolean("enabled").notNull(),
  reason: text("reason"),
  updatedByPlatformAdminId: int("updatedByPlatformAdminId").references(() => platformAdmins.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyFeatureUnique: uniqueIndex("company_feature_overrides_company_feature_unique").on(table.companyId, table.featureKey),
  companyIdx: index("company_feature_overrides_company_idx").on(table.companyId),
}));

export type CompanyFeatureOverride = typeof companyFeatureOverrides.$inferSelect;

/** Permissões explícitas por membro; ausência de linha significa herdar do papel. */
export const memberFeaturePermissions = mysqlTable("member_feature_permissions", {
  id: int("id").autoincrement().primaryKey(),
  memberAccountId: int("memberAccountId").notNull().references(() => memberAccounts.id, { onDelete: "cascade" }),
  featureKey: varchar("featureKey", { length: 64 }).notNull(),
  mode: mysqlEnum("mode", ["allow", "deny"]).notNull(),
  updatedByMemberAccountId: int("updatedByMemberAccountId").references(() => memberAccounts.id, { onDelete: "set null" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  memberFeatureUnique: uniqueIndex("member_feature_permissions_member_feature_unique").on(table.memberAccountId, table.featureKey),
  memberIdx: index("member_feature_permissions_member_idx").on(table.memberAccountId),
}));

export type MemberFeaturePermission = typeof memberFeaturePermissions.$inferSelect;

/** Assinaturas (estrutura preparada, reutilizando Asaas quando configurado). */
export const companySubscriptions = mysqlTable("company_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  planId: int("planId").notNull().references(() => subscriptionPlans.id, { onDelete: "restrict" }),
  status: mysqlEnum("status", ["trial", "active", "pending", "overdue", "suspended", "canceled", "expired"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  asaasSubscriptionId: varchar("asaasSubscriptionId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  companyIdx: index("company_subscriptions_company_idx").on(table.companyId),
}));

export type CompanySubscription = typeof companySubscriptions.$inferSelect;
export type InsertCompanySubscription = typeof companySubscriptions.$inferInsert;

/** Configurações do sistema por empresa. */
export const systemSettings = mysqlTable("system_settings", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull().references(() => companies.id, { onDelete: "cascade" }),
  settingKey: varchar("settingKey", { length: 100 }).notNull(),
  settingValue: text("settingValue").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  accountKeyUnique: uniqueIndex("system_settings_company_key_unique").on(table.companyId, table.settingKey),
  companyIdx: index("system_settings_company_idx").on(table.companyId),
}));

export type SystemSetting = typeof systemSettings.$inferSelect;
export type InsertSystemSetting = typeof systemSettings.$inferInsert;

// Note: payment-related tables from original (payments, paymentEvents) can be re-added from Asaas module if needed.
// Trash and other utility tables can be extended as required.
