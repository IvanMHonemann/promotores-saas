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

  // Nunca reexibir módulos removidos do produto antigo, mesmo em chamadas
  // antigas ou filtros salvos no navegador.
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


export type PromoterActivityFilters = {
  companyId: number;
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  promoterId?: number;
  category?: string;
  search?: string;
};

/**
 * Timeline unificada baseada nos registros atuais de operação, ponto, checklists,
 * evidências, correções de ponto e audit_logs. Todo braço da união filtra a empresa
 * na origem; os eventos históricos são reconstruídos apenas a partir de dados persistidos.
 */
export async function listPromoterActivities(filters: PromoterActivityFilters) {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(10_000, Math.max(1, filters.pageSize || 50));
  const offset = (page - 1) * pageSize;
  await ensureAuditLogsTable();
  const pool = await getPool();
  if (!pool) return { items: [], total: 0, page, pageSize };

  const unionSql = `
    SELECT CONCAT('point-', te.id) AS activityId, te.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, te.serverTime AS occurredAt,
      'time_tracking' AS module, te.eventType AS action, 'time_event' AS entityType,
      'Ponto eletrônico' AS entityLabel,
      CONCAT('Registro de ponto: ', CASE te.eventType WHEN 'clock_in' THEN 'entrada' WHEN 'break_start' THEN 'início de intervalo' WHEN 'break_end' THEN 'fim de intervalo' WHEN 'clock_out' THEN 'saída' ELSE te.eventType END) AS description,
      JSON_OBJECT('tipo', te.eventType, 'horário do servidor', te.serverTime, 'horário do dispositivo', te.deviceTime, 'situação da localização', te.locationStatus, 'latitude', te.latitude, 'longitude', te.longitude, 'precisão GPS (m)', te.accuracy, 'observações', te.notes, 'dispositivo', te.deviceInfo) AS details
    FROM time_events te INNER JOIN member_accounts ma ON ma.id = te.memberAccountId AND ma.companyId = te.companyId
    WHERE te.companyId = ? AND ma.role = 'promoter'
    UNION ALL
    SELECT CONCAT('visit-', v.id) AS activityId, v.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, COALESCE(v.actualEnd, v.actualStart, v.plannedStart, v.createdAt) AS occurredAt,
      'visits' AS module, v.status AS action, 'visit' AS entityType,
      COALESCE(s.name, CONCAT('Loja #', v.storeId)) AS entityLabel,
      CONCAT(CASE v.status WHEN 'completed' THEN 'Visita concluída' WHEN 'in_progress' THEN 'Visita iniciada' WHEN 'not_done' THEN 'Visita não realizada' WHEN 'cancelled' THEN 'Visita cancelada' ELSE 'Tarefa atribuída' END, ' · ', COALESCE(s.name, CONCAT('Loja #', v.storeId))) AS description,
      JSON_OBJECT('loja', s.name, 'endereço', s.address, 'cidade', s.city, 'roteiro', r.name, 'situação', v.status, 'início previsto', v.plannedStart, 'fim previsto', v.plannedEnd, 'início real', v.actualStart, 'fim real', v.actualEnd, 'observações', v.notes, 'justificativa', v.justification, 'latitude inicial', v.startLatitude, 'longitude inicial', v.startLongitude, 'precisão GPS inicial (m)', v.startAccuracy, 'latitude final', v.endLatitude, 'longitude final', v.endLongitude, 'precisão GPS final (m)', v.endAccuracy, 'distância registrada (m)', v.distanceMeters) AS details
    FROM visits v INNER JOIN member_accounts ma ON ma.id = v.promoterId AND ma.companyId = v.companyId
      LEFT JOIN stores s ON s.id = v.storeId AND s.companyId = v.companyId
      LEFT JOIN routes r ON r.id = v.routeId AND r.companyId = v.companyId
    WHERE v.companyId = ? AND ma.role = 'promoter'
    UNION ALL
    SELECT CONCAT('checklist-', cr.id) AS activityId, cr.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, cr.completedAt AS occurredAt,
      'checklists' AS module, 'submitted' AS action, 'checklist_response' AS entityType,
      COALESCE(c.name, CONCAT('Checklist #', cr.checklistId)) AS entityLabel,
      CONCAT('Checklist preenchido · ', COALESCE(c.name, CONCAT('Checklist #', cr.checklistId))) AS description,
      JSON_OBJECT('checklist', c.name, 'loja', s.name, 'visita', cr.visitId, 'respostas', cr.responses, 'concluído em', cr.completedAt) AS details
    FROM checklist_responses cr INNER JOIN member_accounts ma ON ma.id = cr.promoterId AND ma.companyId = cr.companyId
      LEFT JOIN checklists c ON c.id = cr.checklistId AND c.companyId = cr.companyId
      LEFT JOIN visits v ON v.id = cr.visitId AND v.companyId = cr.companyId
      LEFT JOIN stores s ON s.id = v.storeId AND s.companyId = cr.companyId
    WHERE cr.companyId = ? AND ma.role = 'promoter'
    UNION ALL
    SELECT CONCAT('evidence-', e.id) AS activityId, e.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, e.createdAt AS occurredAt,
      'evidences' AS module, 'upload' AS action, 'evidence' AS entityType,
      COALESCE(e.fileName, CONCAT('Evidência #', e.id)) AS entityLabel,
      CONCAT('Evidência enviada', CASE WHEN e.caption IS NULL OR e.caption = '' THEN '' ELSE CONCAT(' · ', e.caption) END) AS description,
      JSON_OBJECT('arquivo', e.fileName, 'tipo de arquivo', e.mimeType, 'tamanho (bytes)', e.sizeBytes, 'legenda', e.caption, 'visita', e.visitId, 'resposta de checklist', e.checklistResponseId, 'latitude', e.latitude, 'longitude', e.longitude, 'arquivoUrl', e.fileUrl, 'enviado em', e.createdAt) AS details
    FROM evidences e INNER JOIN member_accounts ma ON ma.id = e.promoterId AND ma.companyId = e.companyId
    WHERE e.companyId = ? AND ma.role = 'promoter'
    UNION ALL
    SELECT CONCAT('correction-', tc.id) AS activityId, tc.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, COALESCE(tc.reviewedAt, tc.createdAt) AS occurredAt,
      'corrections' AS module, tc.status AS action, 'time_correction' AS entityType,
      CONCAT('Solicitação #', tc.id) AS entityLabel,
      CONCAT('Solicitação de correção de ponto · ', tc.status) AS description,
      JSON_OBJECT('marcação solicitada', tc.requestedType, 'horário solicitado', tc.requestedTime, 'justificativa', tc.justification, 'situação', tc.status, 'observações da revisão', tc.reviewNotes, 'solicitado em', tc.createdAt, 'revisado em', tc.reviewedAt, 'revisor (ID)', tc.reviewedByUserId) AS details
    FROM time_correction_requests tc INNER JOIN member_accounts ma ON ma.id = tc.memberAccountId AND ma.companyId = tc.companyId
    WHERE tc.companyId = ? AND ma.role = 'promoter'
    UNION ALL
    SELECT CONCAT('product-', ip.id) AS activityId, ip.companyId, ma.id AS promoterId,
      ma.userName, ma.email AS userEmail, ip.createdAt AS occurredAt,
      'products' AS module, 'create' AS action, 'product' AS entityType,
      ip.description AS entityLabel,
      CONCAT('Produto cadastrado · ', ip.description) AS description,
      JSON_OBJECT('código', ip.productCode, 'descrição', ip.description, 'quantidade', ip.quantity, 'validade', ip.expirationDate, 'preço', ip.price, 'cadastrado em', ip.createdAt) AS details
    FROM inventory_products ip INNER JOIN member_accounts ma ON ma.id = ip.createdByMemberId AND ma.companyId = ip.companyId
    WHERE ip.companyId = ? AND ma.role = 'promoter'
      AND NOT EXISTS (SELECT 1 FROM audit_logs existing WHERE existing.companyId = ip.companyId AND existing.entityType = 'product' AND existing.entityId = ip.id AND existing.action = 'create')
    UNION ALL
    SELECT CONCAT('audit-', al.id) AS activityId, al.companyId, ma.id AS promoterId,
      COALESCE(al.userName, ma.userName) AS userName, COALESCE(al.userEmail, ma.email) AS userEmail,
      al.createdAt AS occurredAt, al.module, al.action, al.entityType,
      COALESCE(al.entityLabel, al.description) AS entityLabel, al.description,
      JSON_OBJECT('registro', al.entityLabel, 'dados anteriores', al.oldData, 'dados novos', al.newData, 'IP', al.ipAddress, 'navegador/dispositivo', al.userAgent) AS details
    FROM audit_logs al INNER JOIN member_accounts ma ON ma.id = al.userId AND ma.companyId = al.companyId
    WHERE al.companyId = ? AND ma.role = 'promoter'
  `;
  const where: string[] = [];
  const params: any[] = [filters.companyId, filters.companyId, filters.companyId, filters.companyId, filters.companyId, filters.companyId, filters.companyId];
  if (filters.from) { where.push("activity.occurredAt >= ?"); params.push(toMysqlDateTime(filters.from)); }
  if (filters.to) { where.push("activity.occurredAt <= ?"); params.push(toMysqlDateTime(filters.to, true)); }
  if (filters.promoterId != null) { where.push("activity.promoterId = ?"); params.push(filters.promoterId); }
  if (filters.category === "other") {
    where.push("activity.module NOT IN ('visits', 'time_tracking', 'checklists', 'evidences', 'corrections', 'products')");
  } else if (filters.category) { where.push("activity.module = ?"); params.push(filters.category); }
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim().slice(0, 100)}%`;
    where.push("(activity.userName LIKE ? OR activity.userEmail LIKE ? OR activity.description LIKE ? OR activity.entityLabel LIKE ?)");
    params.push(q, q, q, q);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tableSql = `FROM (${unionSql}) AS activity ${whereSql}`;
  try {
    const [countRows] = await pool.query(`SELECT COUNT(*) AS value ${tableSql}`, params);
    const total = Number((countRows as any[])[0]?.value || 0);
    const [rows] = await pool.query(`SELECT activity.* ${tableSql} ORDER BY activity.occurredAt DESC, activity.activityId DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
    return { items: (rows as any[]) || [], total, page, pageSize };
  } catch (err) {
    console.warn("[audit] promoter activity query failed", err);
    return { items: [], total: 0, page, pageSize };
  }
}
