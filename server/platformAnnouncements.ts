import { and, desc, eq, inArray } from "drizzle-orm";
import {
  companies,
  memberAccounts,
  platformAnnouncementCompanies,
  platformAnnouncementDismissals,
  platformAnnouncementMembers,
  platformAnnouncements,
} from "../drizzle/schema";
import {
  announcementSenderLabel,
  announcementVisibleTo,
  canManageCompanyAnnouncement,
  isHttpUrl,
  parseAnnouncementRoles,
  parseAnnouncementTone,
  parseCompanyAnnouncementRoles,
  serializeAnnouncementRoles,
  serializeCompanyAnnouncementRoles,
  toAnnouncementIsoDate,
  todayIsoSP,
  type AnnouncementRecord,
  type AnnouncementRole,
  type AnnouncementViewer,
} from "../shared/platformAnnouncements";
import { getDb } from "./db";

type AnnouncementRow = typeof platformAnnouncements.$inferSelect;

export type AnnouncementInput = {
  title: string;
  body: string;
  tone?: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  audienceScope: "all" | "selected";
  companyIds?: number[];
  roles: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  dismissable?: boolean;
  active?: boolean;
};

export type CompanyAnnouncementInput = {
  title: string;
  body: string;
  tone?: string;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  targetMode: "roles" | "members";
  roles?: string[];
  memberIds?: number[];
  startsAt?: string | null;
  endsAt?: string | null;
  dismissable?: boolean;
  active?: boolean;
};

type CompanyActor = {
  companyId: number;
  role: string;
  memberAccountId?: number | null;
};

const FORBIDDEN = "Você não tem permissão para gerenciar este aviso.";

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function isMissingTable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /doesn't exist|does not exist|Unknown table|ER_NO_SUCH_TABLE/i.test(message);
}

function isMissingColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Unknown column|ER_BAD_FIELD_ERROR/i.test(message);
}

async function addColumnIfMissing(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, table: string, column: string, ddl: string) {
  const [cols]: any = await db.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`,
  );
  if (Array.isArray(cols) && cols.length > 0) return;
  await db.execute(ddl);
}

async function addIndexIfMissing(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, table: string, indexName: string, ddl: string) {
  const [rows]: any = await db.execute(
    `SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${table}' AND INDEX_NAME = '${indexName}'`,
  );
  if (Array.isArray(rows) && rows.length > 0) return;
  await db.execute(ddl);
}

let ensured = false;

export function _resetAnnouncementTableCache() {
  ensured = false;
}

export async function ensureAnnouncementTables() {
  if (ensured) return;
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
      "ALTER TABLE platform_announcements ADD INDEX platform_announcements_source_company_idx (source, companyId)",
    );
    ensured = true;
  } catch (error) {
    console.warn("[announcements] ensureAnnouncementTables", error instanceof Error ? error.message : error);
  }
}

async function listAnnouncementCompanies(ids: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (!ids.length) return map;
  const db = await getDb();
  if (!db) return map;
  try {
    const rows = await db.select().from(platformAnnouncementCompanies).where(inArray(platformAnnouncementCompanies.announcementId, ids));
    for (const row of rows) {
      const list = map.get(row.announcementId) ?? [];
      list.push(row.companyId);
      map.set(row.announcementId, list);
    }
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  return map;
}

async function listAnnouncementMembers(ids: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (!ids.length) return map;
  const db = await getDb();
  if (!db) return map;
  try {
    const rows = await db.select().from(platformAnnouncementMembers).where(inArray(platformAnnouncementMembers.announcementId, ids));
    for (const row of rows) {
      const list = map.get(row.announcementId) ?? [];
      list.push(row.memberAccountId);
      map.set(row.announcementId, list);
    }
  } catch (error) {
    if (!isMissingTable(error) && !isMissingColumn(error)) throw error;
  }
  return map;
}

function toRecord(row: AnnouncementRow, companyMap: Map<number, number[]>, memberMap: Map<number, number[]>): AnnouncementRecord {
  return {
    id: row.id,
    active: row.active,
    startsAt: toAnnouncementIsoDate(row.startsAt),
    endsAt: toAnnouncementIsoDate(row.endsAt),
    audienceScope: row.audienceScope,
    companyIds: companyMap.get(row.id) ?? [],
    roles: parseAnnouncementRoles(row.roles),
    source: (row as any).source || "platform",
    companyId: (row as any).companyId ?? null,
    targetMode: (row as any).targetMode || "roles",
    memberIds: memberMap.get(row.id) ?? [],
    createdByMemberAccountId: (row as any).createdByMemberAccountId ?? null,
  };
}

async function loadNameMaps(rows: AnnouncementRow[], memberMap: Map<number, number[]> = new Map()) {
  const companyNames = new Map<number, string>();
  const authorNames = new Map<number, string>();
  const memberNames = new Map<number, string>();
  const db = await getDb();
  if (!db) return { companyNames, authorNames, memberNames };
  const companyIds = [...new Set(rows.map((row) => Number((row as any).companyId)).filter((id) => Number.isInteger(id) && id > 0))];
  const authorIds = [...new Set(rows.map((row) => Number((row as any).createdByMemberAccountId)).filter((id) => Number.isInteger(id) && id > 0))];
  const recipientIds = [...new Set([...memberMap.values()].flat().map(Number).filter((id) => Number.isInteger(id) && id > 0))];
  const memberIds = [...new Set([...authorIds, ...recipientIds])];
  if (companyIds.length) {
    const found = await db.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, companyIds));
    for (const row of found) companyNames.set(row.id, row.name);
  }
  if (memberIds.length) {
    const found = await db.select({ id: memberAccounts.id, userName: memberAccounts.userName }).from(memberAccounts).where(inArray(memberAccounts.id, memberIds));
    for (const row of found) {
      memberNames.set(row.id, row.userName);
      if (authorIds.includes(row.id)) authorNames.set(row.id, row.userName);
    }
  }
  return { companyNames, authorNames, memberNames };
}

function presentationOf(row: AnnouncementRow, companyNames: Map<number, string>, authorNames: Map<number, string>) {
  const source = String((row as any).source || "platform");
  const companyId = (row as any).companyId ?? null;
  const authorId = (row as any).createdByMemberAccountId ?? null;
  const companyName = companyId ? companyNames.get(Number(companyId)) ?? null : null;
  const authorName = authorId ? authorNames.get(Number(authorId)) ?? null : null;
  return {
    source,
    companyId,
    createdByMemberAccountId: authorId,
    targetMode: String((row as any).targetMode || "roles"),
    companyName,
    authorName,
    senderLabel: announcementSenderLabel({ source, companyName, authorName }),
  };
}

function present(
  row: AnnouncementRow,
  companyMap: Map<number, number[]>,
  memberMap: Map<number, number[]>,
  companyNames: Map<number, string>,
  authorNames: Map<number, string>,
  memberNames: Map<number, string>,
) {
  const memberIds = memberMap.get(row.id) ?? [];
  return {
    ...row,
    roles: parseAnnouncementRoles(row.roles),
    companyIds: companyMap.get(row.id) ?? [],
    memberIds,
    memberNames: memberIds.map((id) => memberNames.get(id)).filter((name): name is string => Boolean(name)),
    startsAt: toAnnouncementIsoDate(row.startsAt),
    endsAt: toAnnouncementIsoDate(row.endsAt),
    ...presentationOf(row, companyNames, authorNames),
  };
}

export async function listAnnouncements() {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    const rows = await db.select().from(platformAnnouncements).orderBy(desc(platformAnnouncements.createdAt), desc(platformAnnouncements.id));
    const [companyMap, memberMap] = await Promise.all([
      listAnnouncementCompanies(rows.map((row) => row.id)),
      listAnnouncementMembers(rows.map((row) => row.id)),
    ]);
    const { companyNames, authorNames, memberNames } = await loadNameMaps(rows, memberMap);
    return rows.map((row) => present(row, companyMap, memberMap, companyNames, authorNames, memberNames));
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export async function getAnnouncement(id: number) {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows = await db.select().from(platformAnnouncements).where(eq(platformAnnouncements.id, id)).limit(1);
  const row = rows[0];
  if (!row) return null;
  const [companyMap, memberMap] = await Promise.all([listAnnouncementCompanies([id]), listAnnouncementMembers([id])]);
  const { companyNames, authorNames, memberNames } = await loadNameMaps([row], memberMap);
  return present(row, companyMap, memberMap, companyNames, authorNames, memberNames);
}

function toViewer(viewer: { companyId: number; role: string; memberAccountId?: number | null; dismissedIds?: number[] }): AnnouncementViewer {
  return {
    companyId: viewer.companyId,
    role: viewer.role,
    todayIso: todayIsoSP(),
    dismissedIds: viewer.dismissedIds,
    memberAccountId: viewer.memberAccountId ?? null,
  };
}

export async function listVisibleAnnouncementsFor(viewer: { companyId: number; role: string; memberAccountId?: number | null }) {
  const dismissedIds = viewer.memberAccountId ? await listDismissedAnnouncementIds(viewer.memberAccountId) : [];
  const rows = await listAnnouncements();
  const view = toViewer({ ...viewer, dismissedIds });
  return rows.filter((row) => announcementVisibleTo(toRecord(row as any, new Map([[row.id, row.companyIds]]), new Map([[row.id, row.memberIds]])), view));
}

export async function getVisibleAnnouncementFor(id: number, viewer: { companyId: number; role: string; memberAccountId?: number | null }) {
  const row = await getAnnouncement(id);
  if (!row) return null;
  const dismissedIds = viewer.memberAccountId ? await listDismissedAnnouncementIds(viewer.memberAccountId) : [];
  const view = toViewer({ ...viewer, dismissedIds });
  if (!announcementVisibleTo(toRecord(row as any, new Map([[row.id, row.companyIds]]), new Map([[row.id, row.memberIds]])), view)) return null;
  return row;
}

function validateInput(input: AnnouncementInput) {
  const title = normalizeText(input.title);
  const body = normalizeText(input.body);
  if (!title) throw new Error("Informe o título do aviso.");
  if (title.length > 180) throw new Error("O título pode ter no máximo 180 caracteres.");
  if (!body) throw new Error("Informe a mensagem do aviso.");
  if (body.length > 4000) throw new Error("A mensagem pode ter no máximo 4000 caracteres.");
  const tone = parseAnnouncementTone(input.tone);
  const buttonLabel = normalizeText(input.buttonLabel) || null;
  const buttonUrl = normalizeText(input.buttonUrl) || null;
  if (buttonLabel && !buttonUrl) throw new Error("Informe o link do botão.");
  if (buttonUrl && !buttonLabel) throw new Error("Informe o texto do botão.");
  if (buttonUrl && !isHttpUrl(buttonUrl)) {
    throw new Error("O link do botão precisa começar com http:// ou https://.");
  }
  const roles = serializeAnnouncementRoles(input.roles);
  const startsAt = normalizeText(input.startsAt) || null;
  const endsAt = normalizeText(input.endsAt) || null;
  if (startsAt && endsAt && endsAt < startsAt) throw new Error("A data final não pode ser anterior à data inicial.");
  const audienceScope: "all" | "selected" = input.audienceScope === "selected" ? "selected" : "all";
  const companyIds = audienceScope === "selected"
    ? [...new Set((input.companyIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    : [];
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
    active: input.active !== false,
  };
}

async function replaceCompanies(announcementId: number, companyIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq(platformAnnouncementCompanies.announcementId, announcementId));
  if (!companyIds.length) return;
  await db.insert(platformAnnouncementCompanies).values(companyIds.map((companyId) => ({ announcementId, companyId })));
}

async function replaceMembers(announcementId: number, memberIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    await db.delete(platformAnnouncementMembers).where(eq(platformAnnouncementMembers.announcementId, announcementId));
    if (!memberIds.length) return;
    await db.insert(platformAnnouncementMembers).values(memberIds.map((memberAccountId) => ({ announcementId, memberAccountId })));
  } catch (error) {
    if (isMissingTable(error)) return;
    throw error;
  }
}

export async function createAnnouncement(input: AnnouncementInput, adminId: number | null) {
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
    startsAt: data.startsAt as any,
    endsAt: data.endsAt as any,
    dismissable: data.dismissable,
    active: data.active,
    createdByPlatformAdminId: adminId,
    updatedByPlatformAdminId: adminId,
    source: "platform",
    targetMode: "roles",
  } as any);
  const id = Number((inserted as any)[0]?.insertId);
  if (!id) throw new Error("Não foi possível criar o aviso.");
  await replaceCompanies(id, data.companyIds);
  const created = await getAnnouncement(id);
  if (!created) throw new Error("Não foi possível criar o aviso.");
  return created;
}

export async function updateAnnouncement(id: number, input: AnnouncementInput, adminId: number | null) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  if (String((existing as any).source || "platform") !== "platform") {
    throw new Error("Avisos da empresa são gerenciados no painel da empresa.");
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
    startsAt: data.startsAt as any,
    endsAt: data.endsAt as any,
    dismissable: data.dismissable,
    active: data.active,
    updatedByPlatformAdminId: adminId,
    updatedAt: new Date(),
  }).where(eq(platformAnnouncements.id, id));
  await replaceCompanies(id, data.companyIds);
  const updated = await getAnnouncement(id);
  if (!updated) throw new Error("Não foi possível atualizar o aviso.");
  return updated;
}

export async function setAnnouncementActive(id: number, active: boolean, adminId: number | null) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  if (String((existing as any).source || "platform") !== "platform") {
    throw new Error("Avisos da empresa são gerenciados no painel da empresa.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    active,
    updatedByPlatformAdminId: adminId,
    updatedAt: new Date(),
  }).where(eq(platformAnnouncements.id, id));
  const updated = await getAnnouncement(id);
  if (!updated) throw new Error("Não foi possível atualizar o aviso.");
  return updated;
}

export async function deleteAnnouncement(id: number) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  if (String((existing as any).source || "platform") !== "platform") {
    throw new Error("Avisos da empresa são gerenciados no painel da empresa.");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq(platformAnnouncementCompanies.announcementId, id));
  await db.delete(platformAnnouncementDismissals).where(eq(platformAnnouncementDismissals.announcementId, id));
  try {
    await db.delete(platformAnnouncementMembers).where(eq(platformAnnouncementMembers.announcementId, id));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  await db.delete(platformAnnouncements).where(eq(platformAnnouncements.id, id));
  return { success: true as const };
}

export async function listCompanyAnnouncementRecipients(companyId: number) {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  const rows = await db
    .select({
      id: memberAccounts.id,
      userName: memberAccounts.userName,
      role: memberAccounts.role,
    })
    .from(memberAccounts)
    .where(and(eq(memberAccounts.companyId, companyId), eq(memberAccounts.active, true)));
  return rows
    .filter((row) => row.role === "supervisor" || row.role === "promoter")
    .sort((a, b) => a.userName.localeCompare(b.userName, "pt-BR"));
}

async function resolveCompanyTargets(companyId: number, input: CompanyAnnouncementInput) {
  const recipients = await listCompanyAnnouncementRecipients(companyId);
  const allowed = new Map(recipients.map((row) => [row.id, row]));
  if (input.targetMode === "members") {
    const memberIds = [...new Set((input.memberIds ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
    if (!memberIds.length) throw new Error("Escolha pelo menos uma pessoa.");
    if (memberIds.some((id) => !allowed.has(id))) {
      throw new Error("Só é possível avisar promotores e supervisores ativos desta empresa.");
    }
    const roles = serializeCompanyAnnouncementRoles(memberIds.map((id) => allowed.get(id)!.role));
    return { targetMode: "members" as const, memberIds, roles };
  }
  const roles = serializeCompanyAnnouncementRoles(input.roles ?? []);
  return { targetMode: "roles" as const, memberIds: [] as number[], roles };
}

function validateCompanyContent(input: CompanyAnnouncementInput) {
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
    active: input.active,
  });
}

export async function listCompanyAnnouncements(companyId: number) {
  const rows = await listAnnouncements();
  return rows.filter((row) => String((row as any).source || "platform") === "company" && Number((row as any).companyId) === Number(companyId));
}

function assertCanManage(actor: CompanyActor, announcement: { source?: string | null; companyId?: number | null; createdByMemberAccountId?: number | null }) {
  if (!canManageCompanyAnnouncement(actor, announcement)) throw new Error(FORBIDDEN);
}

export async function createCompanyAnnouncement(actor: CompanyActor, input: CompanyAnnouncementInput) {
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
    startsAt: content.startsAt as any,
    endsAt: content.endsAt as any,
    dismissable: content.dismissable,
    active: content.active,
    source: "company",
    companyId: actor.companyId,
    createdByMemberAccountId: actor.memberAccountId ?? null,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    targetMode: targets.targetMode,
  } as any);
  const id = Number((inserted as any)[0]?.insertId);
  if (!id) throw new Error("Não foi possível criar o aviso.");
  await replaceCompanies(id, [actor.companyId]);
  await replaceMembers(id, targets.memberIds);
  const created = await getAnnouncement(id);
  if (!created) throw new Error("Não foi possível criar o aviso.");
  return created;
}

export async function updateCompanyAnnouncement(id: number, actor: CompanyActor, input: CompanyAnnouncementInput) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  assertCanManage(actor, existing as any);
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
    startsAt: content.startsAt as any,
    endsAt: content.endsAt as any,
    dismissable: content.dismissable,
    active: content.active,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    targetMode: targets.targetMode,
    updatedAt: new Date(),
  } as any).where(eq(platformAnnouncements.id, id));
  await replaceCompanies(id, [actor.companyId]);
  await replaceMembers(id, targets.memberIds);
  const updated = await getAnnouncement(id);
  if (!updated) throw new Error("Não foi possível atualizar o aviso.");
  return updated;
}

export async function setCompanyAnnouncementActive(id: number, actor: CompanyActor, active: boolean) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  assertCanManage(actor, existing as any);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.update(platformAnnouncements).set({
    active,
    updatedByMemberAccountId: actor.memberAccountId ?? null,
    updatedAt: new Date(),
  } as any).where(eq(platformAnnouncements.id, id));
  const updated = await getAnnouncement(id);
  if (!updated) throw new Error("Não foi possível atualizar o aviso.");
  return updated;
}

export async function deleteCompanyAnnouncement(id: number, actor: CompanyActor) {
  await ensureAnnouncementTables();
  const existing = await getAnnouncement(id);
  if (!existing) throw new Error("Aviso não encontrado.");
  assertCanManage(actor, existing as any);
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  await db.delete(platformAnnouncementCompanies).where(eq(platformAnnouncementCompanies.announcementId, id));
  await db.delete(platformAnnouncementDismissals).where(eq(platformAnnouncementDismissals.announcementId, id));
  try {
    await db.delete(platformAnnouncementMembers).where(eq(platformAnnouncementMembers.announcementId, id));
  } catch (error) {
    if (!isMissingTable(error)) throw error;
  }
  await db.delete(platformAnnouncements).where(eq(platformAnnouncements.id, id));
  return existing;
}

export async function dismissAnnouncement(input: { announcementId: number; companyId: number; role: string; memberAccountId: number }) {
  const announcement = await getVisibleAnnouncementFor(input.announcementId, input);
  if (!announcement || !announcement.dismissable) throw new Error("Este aviso não pode ser fechado.");
  const db = await getDb();
  if (!db) throw new Error("Database not connected");
  try {
    await db.insert(platformAnnouncementDismissals).values({ announcementId: input.announcementId, memberAccountId: input.memberAccountId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Duplicate|ER_DUP_ENTRY/i.test(message)) throw error;
  }
}

export async function listDismissedAnnouncementIds(memberAccountId: number): Promise<number[]> {
  await ensureAnnouncementTables();
  const db = await getDb();
  if (!db) return [];
  try {
    const rows = await db
      .select({ announcementId: platformAnnouncementDismissals.announcementId })
      .from(platformAnnouncementDismissals)
      .where(eq(platformAnnouncementDismissals.memberAccountId, memberAccountId));
    return rows.map((row) => row.announcementId);
  } catch (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
}

export type { AnnouncementRole };

export const getAnnouncementById = getAnnouncement;
