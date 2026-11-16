/** Avisos do administrador geral: persistência e consulta filtrada por empresa e função. */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import {
  companies,
  platformAnnouncementCompanies,
  platformAnnouncementDismissals,
  platformAnnouncements,
} from "../drizzle/schema";
import {
  type AnnouncementRole,
  type AnnouncementTone,
  announcementVisibleTo,
  filterAnnouncementsForViewer,
  isHttpUrl,
  parseAnnouncementRoles,
  serializeAnnouncementRoles,
  toAnnouncementIsoDate,
  todayIsoSP,
} from "@shared/platformAnnouncements";

export type AnnouncementInput = {
  title: string;
  body: string;
  tone: AnnouncementTone;
  buttonLabel?: string | null;
  buttonUrl?: string | null;
  audienceScope: "all" | "selected";
  companyIds?: number[];
  roles: AnnouncementRole[];
  startsAt?: string | null;
  endsAt?: string | null;
  dismissable: boolean;
  active?: boolean;
};

async function database() {
  const conn = await db.getDb();
  if (!conn) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco indisponível." });
  return conn;
}

let ensured = false;
export async function ensurePlatformAnnouncementTables(): Promise<void> {
  if (ensured) return;
  const conn = await database();
  await conn.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS platform_announcements (
      id INT AUTO_INCREMENT NOT NULL,
      title VARCHAR(200) NOT NULL,
      body TEXT NOT NULL,
      tone ENUM('info', 'warning', 'urgent') NOT NULL DEFAULT 'info',
      buttonLabel VARCHAR(80) NULL,
      buttonUrl VARCHAR(500) NULL,
      audienceScope ENUM('all', 'selected') NOT NULL DEFAULT 'all',
      roles VARCHAR(120) NOT NULL,
      startsAt DATE NULL,
      endsAt DATE NULL,
      dismissable TINYINT(1) NOT NULL DEFAULT 1,
      active TINYINT(1) NOT NULL DEFAULT 1,
      createdByPlatformAdminId INT NULL,
      updatedByPlatformAdminId INT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY platform_announcements_active_idx (active, startsAt, endsAt)
    )
  `));
  await conn.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS platform_announcement_companies (
      id INT AUTO_INCREMENT NOT NULL,
      announcementId INT NOT NULL,
      companyId INT NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY platform_announcement_companies_unique (announcementId, companyId),
      KEY platform_announcement_companies_company_idx (companyId)
    )
  `));
  await conn.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS platform_announcement_dismissals (
      id INT AUTO_INCREMENT NOT NULL,
      announcementId INT NOT NULL,
      memberAccountId INT NOT NULL,
      dismissedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY platform_announcement_dismissals_unique (announcementId, memberAccountId),
      KEY platform_announcement_dismissals_member_idx (memberAccountId)
    )
  `));
  ensured = true;
}

/** Expõe o reset só para testes. */
export function _resetAnnouncementTableCache() {
  ensured = false;
}

function normalizeInput(input: AnnouncementInput) {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o título do aviso." });
  if (!body) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe a mensagem do aviso." });
  if (title.length > 200) throw new TRPCError({ code: "BAD_REQUEST", message: "O título pode ter no máximo 200 caracteres." });
  if (body.length > 8000) throw new TRPCError({ code: "BAD_REQUEST", message: "A mensagem pode ter no máximo 8.000 caracteres." });
  const roles = parseAnnouncementRoles(input.roles);
  if (!roles.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha pelo menos uma função." });
  const startsAt = input.startsAt?.trim() || null;
  const endsAt = input.endsAt?.trim() || null;
  if (startsAt && !/^\d{4}-\d{2}-\d{2}$/.test(startsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Data de início inválida." });
  if (endsAt && !/^\d{4}-\d{2}-\d{2}$/.test(endsAt)) throw new TRPCError({ code: "BAD_REQUEST", message: "Data de fim inválida." });
  if (startsAt && endsAt && startsAt > endsAt) throw new TRPCError({ code: "BAD_REQUEST", message: "A data de início não pode ser depois da data de fim." });
  const buttonLabel = input.buttonLabel?.trim() || null;
  const buttonUrl = input.buttonUrl?.trim() || null;
  if (buttonLabel && !buttonUrl) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o link do botão." });
  if (buttonUrl && !buttonLabel) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o texto do botão." });
  if (buttonUrl && !isHttpUrl(buttonUrl)) throw new TRPCError({ code: "BAD_REQUEST", message: "O link do botão precisa começar com http:// ou https://." });
  if (buttonLabel && buttonLabel.length > 80) throw new TRPCError({ code: "BAD_REQUEST", message: "O texto do botão pode ter no máximo 80 caracteres." });
  const audienceScope = input.audienceScope === "selected" ? "selected" : "all";
  const companyIds = audienceScope === "selected"
    ? Array.from(new Set((input.companyIds ?? []).map(Number).filter((id) => Number.isInteger(id) && id > 0)))
    : [];
  if (audienceScope === "selected" && !companyIds.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha pelo menos uma empresa, ou marque todas." });
  }
  return {
    title,
    body,
    tone: input.tone,
    buttonLabel,
    buttonUrl,
    audienceScope: audienceScope as "all" | "selected",
    companyIds,
    roles,
    rolesValue: serializeAnnouncementRoles(roles),
    startsAt,
    endsAt,
    dismissable: Boolean(input.dismissable),
    active: input.active !== false,
  };
}

async function replaceCompanies(conn: Awaited<ReturnType<typeof database>>, announcementId: number, companyIds: number[]) {
  await conn.delete(platformAnnouncementCompanies).where(eq(platformAnnouncementCompanies.announcementId, announcementId));
  if (!companyIds.length) return;
  await conn.insert(platformAnnouncementCompanies).values(companyIds.map((companyId) => ({ announcementId, companyId })));
}

async function loadCompanyIds(conn: Awaited<ReturnType<typeof database>>, ids: number[]) {
  if (!ids.length) return new Map<number, number[]>();
  const rows = await conn.select().from(platformAnnouncementCompanies).where(inArray(platformAnnouncementCompanies.announcementId, ids));
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.announcementId) ?? [];
    list.push(row.companyId);
    map.set(row.announcementId, list);
  }
  return map;
}

async function companyNameMap(conn: Awaited<ReturnType<typeof database>>, ids: number[]) {
  if (!ids.length) return new Map<number, string>();
  const rows = await conn.select({ id: companies.id, name: companies.name }).from(companies).where(inArray(companies.id, ids));
  return new Map(rows.map((row) => [row.id, row.name]));
}

function toPublic(row: typeof platformAnnouncements.$inferSelect, companyIds: number[], companyNames: string[]) {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    tone: row.tone,
    buttonLabel: row.buttonLabel,
    buttonUrl: row.buttonUrl,
    audienceScope: row.audienceScope,
    roles: parseAnnouncementRoles(row.roles),
    companyIds,
    companyNames,
    startsAt: toAnnouncementIsoDate(row.startsAt),
    endsAt: toAnnouncementIsoDate(row.endsAt),
    dismissable: Boolean(row.dismissable),
    active: Boolean(row.active),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listAnnouncements() {
  await ensurePlatformAnnouncementTables();
  const conn = await database();
  const rows = await conn.select().from(platformAnnouncements).orderBy(desc(platformAnnouncements.id));
  const companyMap = await loadCompanyIds(conn, rows.map((row) => row.id));
  const allCompanyIds = Array.from(new Set(rows.flatMap((row) => companyMap.get(row.id) ?? [])));
  const names = await companyNameMap(conn, allCompanyIds);
  return rows.map((row) => {
    const ids = companyMap.get(row.id) ?? [];
    return toPublic(row, ids, ids.map((id) => names.get(id) ?? `Empresa #${id}`));
  });
}

export async function getAnnouncement(id: number) {
  const items = await listAnnouncements();
  const found = items.find((item) => item.id === id);
  if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "Aviso não encontrado." });
  return found;
}

export async function createAnnouncement(input: AnnouncementInput, platformAdminId?: number | null) {
  await ensurePlatformAnnouncementTables();
  const data = normalizeInput(input);
  const conn = await database();
  if (data.companyIds.length) {
    const existing = await conn.select({ id: companies.id }).from(companies).where(inArray(companies.id, data.companyIds));
    if (existing.length !== data.companyIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Uma das empresas escolhidas não existe." });
    }
  }
  const [result] = await conn.insert(platformAnnouncements).values({
    title: data.title,
    body: data.body,
    tone: data.tone,
    buttonLabel: data.buttonLabel,
    buttonUrl: data.buttonUrl,
    audienceScope: data.audienceScope,
    roles: data.rolesValue,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    dismissable: data.dismissable,
    active: data.active,
    createdByPlatformAdminId: platformAdminId ?? null,
    updatedByPlatformAdminId: platformAdminId ?? null,
  } as any);
  const id = Number((result as any).insertId);
  if (!id) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o aviso." });
  if (data.audienceScope === "selected") await replaceCompanies(conn, id, data.companyIds);
  return getAnnouncement(id);
}

export async function updateAnnouncement(id: number, input: AnnouncementInput, platformAdminId?: number | null) {
  await ensurePlatformAnnouncementTables();
  const data = normalizeInput(input);
  const conn = await database();
  const current = await conn.select({ id: platformAnnouncements.id }).from(platformAnnouncements).where(eq(platformAnnouncements.id, id)).limit(1);
  if (!current.length) throw new TRPCError({ code: "NOT_FOUND", message: "Aviso não encontrado." });
  if (data.companyIds.length) {
    const existing = await conn.select({ id: companies.id }).from(companies).where(inArray(companies.id, data.companyIds));
    if (existing.length !== data.companyIds.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Uma das empresas escolhidas não existe." });
    }
  }
  await conn.update(platformAnnouncements).set({
    title: data.title,
    body: data.body,
    tone: data.tone,
    buttonLabel: data.buttonLabel,
    buttonUrl: data.buttonUrl,
    audienceScope: data.audienceScope,
    roles: data.rolesValue,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    dismissable: data.dismissable,
    active: data.active,
    updatedByPlatformAdminId: platformAdminId ?? null,
  } as any).where(eq(platformAnnouncements.id, id));
  await replaceCompanies(conn, id, data.audienceScope === "selected" ? data.companyIds : []);
  return getAnnouncement(id);
}

export async function setAnnouncementActive(id: number, active: boolean, platformAdminId?: number | null) {
  await ensurePlatformAnnouncementTables();
  const conn = await database();
  const current = await conn.select({ id: platformAnnouncements.id }).from(platformAnnouncements).where(eq(platformAnnouncements.id, id)).limit(1);
  if (!current.length) throw new TRPCError({ code: "NOT_FOUND", message: "Aviso não encontrado." });
  await conn.update(platformAnnouncements).set({
    active,
    updatedByPlatformAdminId: platformAdminId ?? null,
  }).where(eq(platformAnnouncements.id, id));
  return getAnnouncement(id);
}

export async function deleteAnnouncement(id: number) {
  await ensurePlatformAnnouncementTables();
  const conn = await database();
  const current = await conn.select({ id: platformAnnouncements.id }).from(platformAnnouncements).where(eq(platformAnnouncements.id, id)).limit(1);
  if (!current.length) throw new TRPCError({ code: "NOT_FOUND", message: "Aviso não encontrado." });
  await conn.delete(platformAnnouncementDismissals).where(eq(platformAnnouncementDismissals.announcementId, id));
  await conn.delete(platformAnnouncementCompanies).where(eq(platformAnnouncementCompanies.announcementId, id));
  await conn.delete(platformAnnouncements).where(eq(platformAnnouncements.id, id));
  return { success: true as const };
}

export async function listVisibleAnnouncementsFor(input: {
  companyId: number;
  role: string;
  memberAccountId?: number | null;
}) {
  await ensurePlatformAnnouncementTables();
  const conn = await database();
  const today = todayIsoSP();
  const rows = await conn.select().from(platformAnnouncements).where(eq(platformAnnouncements.active, true));
  if (!rows.length) return [];
  const companyMap = await loadCompanyIds(conn, rows.map((row) => row.id));
  let dismissedIds: number[] = [];
  if (input.memberAccountId) {
    const dismissed = await conn.select({ announcementId: platformAnnouncementDismissals.announcementId })
      .from(platformAnnouncementDismissals)
      .where(and(
        eq(platformAnnouncementDismissals.memberAccountId, input.memberAccountId),
        inArray(platformAnnouncementDismissals.announcementId, rows.map((row) => row.id)),
      ));
    dismissedIds = dismissed.map((row) => row.announcementId);
  }
  const records = rows.map((row) => ({
    ...toPublic(row, companyMap.get(row.id) ?? [], []),
    companyIds: companyMap.get(row.id) ?? [],
  }));
  return filterAnnouncementsForViewer(records, {
    companyId: input.companyId,
    role: input.role,
    todayIso: today,
    dismissedIds,
  }).map(({ companyIds, companyNames, createdAt, updatedAt, active, ...rest }) => rest);
}

export async function dismissAnnouncement(input: {
  announcementId: number;
  companyId: number;
  role: string;
  memberAccountId: number;
}) {
  await ensurePlatformAnnouncementTables();
  const conn = await database();
  const rows = await conn.select().from(platformAnnouncements).where(eq(platformAnnouncements.id, input.announcementId)).limit(1);
  if (!rows.length) throw new TRPCError({ code: "NOT_FOUND", message: "Aviso não encontrado." });
  const row = rows[0];
  if (!row.dismissable) throw new TRPCError({ code: "BAD_REQUEST", message: "Este aviso não pode ser fechado." });
  const companyMap = await loadCompanyIds(conn, [row.id]);
  const visible = announcementVisibleTo({
    id: row.id,
    active: row.active,
    startsAt: toAnnouncementIsoDate(row.startsAt),
    endsAt: toAnnouncementIsoDate(row.endsAt),
    audienceScope: row.audienceScope,
    companyIds: companyMap.get(row.id) ?? [],
    roles: parseAnnouncementRoles(row.roles),
  }, { companyId: input.companyId, role: input.role, todayIso: todayIsoSP() });
  if (!visible) throw new TRPCError({ code: "FORBIDDEN", message: "Este aviso não se aplica à sua conta." });
  await conn.insert(platformAnnouncementDismissals).values({
    announcementId: row.id,
    memberAccountId: input.memberAccountId,
  }).onDuplicateKeyUpdate({ set: { dismissedAt: sql`CURRENT_TIMESTAMP` } });
  return { success: true as const };
}
