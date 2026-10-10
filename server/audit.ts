/**
 * Serviço central de auditoria (append-only).
 * Sempre use companyId da sessão (ctx.accountId), nunca do body do cliente.
 * Não registra senhas, tokens ou credenciais.
 */
import { and, count, desc, eq, gte, like, lte, or, sql, type SQL } from "drizzle-orm";
import { auditLogs, type InsertAuditLog } from "../drizzle/schema";
import { getDb, getPool } from "./db";
import type { TrpcContext } from "./_core/context";

let auditTableReady = false;

/** Garante a tabela no TiDB (CREATE IF NOT EXISTS) — evita falha se a migration 0009 não rodou. */
async function ensureAuditLogsTable(): Promise<void> {
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

function toMysqlDateTime(value: string, endOfDay = false): string {
  // Aceita YYYY-MM-DD ou ISO; devolve "YYYY-MM-DD HH:MM:SS" (sem ms) para TiDB.
  const raw = String(value).trim();
  const d = raw.length <= 10 ? new Date(`${raw}T${endOfDay ? "23:59:59" : "00:00:00"}`) : new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19).replace("T", " ");
  const pad = (n: number) => String(n).padStart(2, "0");
  // Usa componentes UTC do slice ISO para evitar deslocamento estranho em filtros de dia
  if (raw.length <= 10) {
    return `${raw} ${endOfDay ? "23:59:59" : "00:00:00"}`;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}


const SENSITIVE_KEY_RE =
  /password|passwd|pwd|token|secret|cookie|authorization|recovery|hash|credit.?card|card.?number|cvv|cvc|ssn|api.?key/i;

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "restore"
  | "activate"
  | "deactivate"
  | "login"
  | "logout"
  | "login_failed"
  | "settings_change"
  | "security";

export type AuditModule =
  | "clients"
  | "extinguishers"
  | "orders"
  | "users"
  | "settings"
  | "auth"
  | "trash"
  | "billing"
  | "system";

export type AuditEntityType =
  | "client"
  | "extinguisher"
  | "order"
  | "user"
  | "setting"
  | "session"
  | "company";

export type WriteAuditInput = {
  companyId?: number | null;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  action: AuditAction | string;
  module: AuditModule | string;
  entityType: AuditEntityType | string;
  entityId?: number | null;
  entityLabel?: string | null;
  description: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/** Remove chaves sensíveis de objetos antes de persistir. */
export function sanitizeAuditData(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitizeAuditData);
  if (typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_RE.test(k)) continue;
    out[k] = sanitizeAuditData(v);
  }
  return out;
}

/** Diff superficial: só campos que mudaram (após sanitização). */
export function diffAuditData(before: unknown, after: unknown): { oldData: Record<string, unknown> | null; newData: Record<string, unknown> | null } {
  const a = sanitizeAuditData(before) as Record<string, unknown> | null;
  const b = sanitizeAuditData(after) as Record<string, unknown> | null;
  if (!a && !b) return { oldData: null, newData: null };
  if (!a) return { oldData: null, newData: (b as Record<string, unknown>) || null };
  if (!b) return { oldData: (a as Record<string, unknown>) || null, newData: null };
  const oldPart: Record<string, unknown> = {};
  const newPart: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const av = a[key];
    const bv = b[key];
    const as = av === undefined ? null : typeof av === "object" ? JSON.stringify(av) : String(av ?? "");
    const bs = bv === undefined ? null : typeof bv === "object" ? JSON.stringify(bv) : String(bv ?? "");
    if (as !== bs) {
      if (av !== undefined) oldPart[key] = av;
      if (bv !== undefined) newPart[key] = bv;
    }
  }
  return {
    oldData: Object.keys(oldPart).length ? oldPart : null,
    newData: Object.keys(newPart).length ? newPart : null,
  };
}

export function requestMeta(ctx: Pick<TrpcContext, "req">): { ipAddress: string | null; userAgent: string | null } {
  const req = ctx.req as { headers?: Record<string, string | string[] | undefined>; ip?: string; socket?: { remoteAddress?: string } };
  const xf = req.headers?.["x-forwarded-for"];
  const forwarded = Array.isArray(xf) ? xf[0] : xf;
  const ip =
    (typeof forwarded === "string" && forwarded.split(",")[0]?.trim()) ||
    (typeof req.headers?.["x-real-ip"] === "string" ? req.headers["x-real-ip"] : null) ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;
  const uaRaw = req.headers?.["user-agent"];
  const userAgent = (Array.isArray(uaRaw) ? uaRaw[0] : uaRaw) || null;
  return {
    ipAddress: ip ? String(ip).slice(0, 64) : null,
    userAgent: userAgent ? String(userAgent).slice(0, 512) : null,
  };
}

export function actorFromCtx(ctx: TrpcContext): {
  companyId: number | null;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
} {
  const companyId = ctx.accountId && Number.isInteger(ctx.accountId) && ctx.accountId > 0 ? ctx.accountId : null;
  const userId =
    ctx.memberAccountId ??
    (ctx.platformAdminId != null ? ctx.platformAdminId : null) ??
    (ctx.user?.id != null ? Math.abs(ctx.user.id) : null);
  return {
    companyId,
    userId: userId != null ? Number(userId) : null,
    userName: ctx.user?.name || null,
    userEmail: ctx.user?.email || null,
  };
}

function serializeJson(value: unknown): string | null {
  if (value == null) return null;
  try {
    return JSON.stringify(sanitizeAuditData(value));
  } catch {
    return null;
  }
}

/** Grava um evento de auditoria. Falhas são logadas e não quebram a operação principal. */
export async function writeAuditLog(input: WriteAuditInput): Promise<number | null> {
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
        String(input.description).slice(0, 4000),
        serializeJson(input.oldData),
        serializeJson(input.newData),
        input.ipAddress ? String(input.ipAddress).slice(0, 64) : null,
        input.userAgent ? String(input.userAgent).slice(0, 512) : null,
      ],
    );
    return Number((result as any)?.insertId || 0) || null;
  } catch (err) {
    console.warn("[audit] failed to write log", err);
    return null;
  }
}

/** Atalho: monta ator + IP a partir do ctx e grava. */
export async function auditFromCtx(
  ctx: TrpcContext,
  partial: Omit<WriteAuditInput, "companyId" | "userId" | "userName" | "userEmail" | "ipAddress" | "userAgent"> & {
    companyId?: number | null;
  },
): Promise<number | null> {
  const actor = actorFromCtx(ctx);
  const meta = requestMeta(ctx);
  return writeAuditLog({
    ...partial,
    companyId: partial.companyId !== undefined ? partial.companyId : actor.companyId,
    userId: actor.userId,
    userName: actor.userName,
    userEmail: actor.userEmail,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

export type AuditListFilters = {
  companyId?: number | null;
  /** Se true e companyId definido, força filtro de tenant. */
  enforceTenant?: boolean;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  userId?: number;
  module?: string;
  action?: string;
  entityType?: string;
  entityId?: number;
  search?: string;
};

export async function listAuditLogs(filters: AuditListFilters = {}) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;

  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return { items: [], total: 0, page, pageSize };

  const where: string[] = [];
  const params: any[] = [];

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
      params,
    );
    const total = Number((countRows as any[])[0]?.value || 0);

    const [rows] = await pool.query(
      `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    return {
      items: (rows as any[]) || [],
      total,
      page,
      pageSize,
    };
  } catch (err) {
    console.warn("[audit] list failed", err);
    // Última tentativa: recriar tabela e retornar vazio sem quebrar a UI
    auditTableReady = false;
    await ensureAuditLogsTable();
    try {
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS value FROM \`audit_logs\` ${whereSql}`,
        params,
      );
      const total = Number((countRows as any[])[0]?.value || 0);
      const [rows] = await pool.query(
        `SELECT * FROM \`audit_logs\` ${whereSql} ORDER BY \`createdAt\` DESC, \`id\` DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );
      return { items: (rows as any[]) || [], total, page, pageSize };
    } catch (err2) {
      console.warn("[audit] list failed permanently", err2);
      return { items: [], total: 0, page, pageSize };
    }
  }
}

export async function getAuditLogById(id: number, companyId?: number | null) {
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return null;
  try {
    if (companyId != null) {
      const [rows] = await pool.query(
        "SELECT * FROM `audit_logs` WHERE `id` = ? AND `companyId` = ? LIMIT 1",
        [id, companyId],
      );
      return ((rows as any[])[0] as any) || null;
    }
    const [rows] = await pool.query(
      "SELECT * FROM `audit_logs` WHERE `id` = ? LIMIT 1",
      [id],
    );
    return ((rows as any[])[0] as any) || null;
  } catch (err) {
    console.warn("[audit] getById failed", err);
    return null;
  }
}

/** Histórico de uma entidade (ex.: extintor). Sempre filtrado por companyId quando informado. */
export async function listEntityAuditHistory(params: {
  companyId: number;
  entityType: string;
  entityId: number;
  page?: number;
  pageSize?: number;
}) {
  return listAuditLogs({
    companyId: params.companyId,
    enforceTenant: true,
    entityType: params.entityType,
    entityId: params.entityId,
    page: params.page || 1,
    pageSize: params.pageSize || 50,
  });
}

/** Exportação CSV respeitando os mesmos filtros (máx. 5000 linhas). */
export async function exportAuditLogsCsv(filters: AuditListFilters): Promise<string> {
  const result = await listAuditLogs({ ...filters, page: 1, pageSize: 5000 });
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
    "ipAddress",
  ];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.join(",")];
  for (const row of result.items) {
    lines.push(
      [
        row.id,
        row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
        row.companyId,
        row.userName,
        row.userEmail,
        row.action,
        row.module,
        row.entityType,
        row.entityId,
        row.entityLabel,
        row.description,
        row.oldData,
        row.newData,
        row.ipAddress,
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}
