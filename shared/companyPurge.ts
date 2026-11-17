/** Regras puras da exclusão permanente de empresa (confirmação, retenção e plano da cascata). */
import { onlyDigitsStr } from "./brDocs";

export const RETENTION_PREFIX = "retention/company-delete";

export function confirmMatchesCompany(
  company: { name: string; taxDocument?: string | null },
  confirm: string,
): boolean {
  const typed = String(confirm ?? "").trim();
  if (!typed) return false;
  if (typed === String(company.name ?? "").trim()) return true;
  const typedDigits = onlyDigitsStr(typed);
  const doc = onlyDigitsStr(company.taxDocument);
  return Boolean(doc && typedDigits.length >= 11 && typedDigits === doc);
}

/** Aviso legal exibido antes da exclusão permanente. Não bloqueia o fluxo (a cópia final é que protege a guarda). */
export function purgeLegalWarning(eventCount: number): string {
  const n = Math.max(0, Math.trunc(eventCount || 0));
  const punches = n <= 0
    ? "Esta empresa não tem marcações de ponto registradas."
    : n === 1
      ? "Esta empresa tem 1 marcação de ponto."
      : `Esta empresa tem ${n} marcações de ponto.`;
  return `${punches} As marcações de ponto têm prazo legal de guarda de cerca de 5 anos (Portaria 671 e CLT). A exclusão permanente é irreversível: apaga usuários, batidas, correções, avisos, cobranças e arquivos da empresa. Antes de apagar, o sistema gera uma cópia final (AFD, AEJ se houver, espelhos/cartão-ponto e dados da empresa e dos funcionários) e a guarda no arquivo de retenção. Se a cópia falhar, nada é apagado. Prefira “Encerrar e arquivar” se quiser só desativar a conta, mantendo os dados.`;
}

export function retentionBackupKey(companyId: number, stamp: string, fileName = "copia-final.zip"): string {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Empresa inválida.");
  const safeStamp = String(stamp || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) || "agora";
  const safeName = String(fileName || "copia-final.zip").replace(/[^A-Za-z0-9._-]/g, "_");
  return `${RETENTION_PREFIX}/${companyId}/${safeStamp}/${safeName}`;
}

export function isRetentionBackupKey(key: unknown, companyId?: number): key is string {
  if (typeof key !== "string" || key.length > 512) return false;
  if (!/^retention\/company-delete\/\d+\/[A-Za-z0-9_-]+\/[A-Za-z0-9._-]+$/.test(key)) return false;
  if (companyId != null) {
    if (!Number.isInteger(companyId) || companyId <= 0) return false;
    return key.startsWith(`${RETENTION_PREFIX}/${companyId}/`);
  }
  return true;
}

export type SchemaColumn = { t: string; c: string };

export function planCompanyCascade(columns: SchemaColumn[], memberIds: number[]) {
  const seen = new Set<string>();
  const tables: Array<{ table: string; column: string }> = [];
  for (const { t, c } of columns) {
    if (!t || !c || t === "companies") continue;
    if (!/^[A-Za-z0-9_]+$/.test(t) || !/^[A-Za-z0-9_]+$/.test(c)) continue;
    const k = `${t}.${c}`;
    if (seen.has(k)) continue;
    seen.add(k);
    tables.push({ table: t, column: c });
  }
  return { deleteSessions: memberIds.length > 0, tables, deleteCompany: true as const };
}

export type CascadeExecutor = {
  query: (sql: string, params?: unknown[]) => Promise<{ affectedRows?: number }>;
};

/** Apaga sessões dos membros, depois todas as tabelas com companyId/accountId, e por último a linha em companies. */
export async function applyCompanyCascade(
  exec: CascadeExecutor,
  companyId: number,
  columns: SchemaColumn[],
  memberIds: number[],
): Promise<Record<string, number>> {
  if (!Number.isInteger(companyId) || companyId <= 0) throw new Error("Empresa inválida.");
  const plan = planCompanyCascade(columns, memberIds);
  const deleted: Record<string, number> = {};
  if (plan.deleteSessions) {
    const r = await exec.query("DELETE FROM member_sessions WHERE memberAccountId IN (?)", [memberIds]);
    deleted.member_sessions = r.affectedRows || 0;
  }
  for (const { table, column } of plan.tables) {
    const r = await exec.query(`DELETE FROM \`${table}\` WHERE \`${column}\` = ?`, [companyId]);
    if (r.affectedRows) deleted[table] = (deleted[table] ?? 0) + r.affectedRows;
  }
  const r = await exec.query("DELETE FROM companies WHERE id = ?", [companyId]);
  deleted.companies = r.affectedRows || 0;
  return deleted;
}

export const SENSITIVE_BACKUP_KEYS = [
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
  "mfa_secret",
] as const;

export function stripSensitiveFields<T extends Record<string, unknown>>(row: T): T {
  const out = { ...row };
  for (const key of SENSITIVE_BACKUP_KEYS) {
    if (key in out) delete (out as any)[key];
  }
  return out;
}

/** Só o administrador da plataforma pode pedir exclusão permanente. */
export function canPermanentlyPurge(role: string | null | undefined): boolean {
  return role === "platform_admin";
}
