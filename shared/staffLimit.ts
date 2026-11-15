/** Quem conta no limite de funcionários do plano. */

export const EXTRA_USERS_KEY = "extra_users";

export type StaffLike = {
  role?: string | null;
  active?: boolean | number | null;
};

export function isCompanyAdminRole(role?: string | null): boolean {
  const key = String(role ?? "").toLowerCase().trim();
  return key === "company_admin" || key === "admin";
}

export function isPlatformAdminRole(role?: string | null): boolean {
  const key = String(role ?? "").toLowerCase().trim();
  return key === "platform_admin" || key === "super_admin" || key === "platformadmin";
}

/** Só promotores/funcionários ativos entram na cota. Admin, supervisor e super-admin ficam de fora. */
export function isSupervisorRole(role?: string | null): boolean {
  return String(role ?? "").toLowerCase().trim() === "supervisor";
}

export function staffLimitAppliesToRole(role?: string | null): boolean {
  const key = String(role ?? "").toLowerCase().trim();
  return key === "promoter";
}

export function countsTowardStaffLimit(member: StaffLike): boolean {
  if (member.active === false || member.active === 0 || member.active == null) return false;
  return staffLimitAppliesToRole(member.role);
}

export function countBillableStaff(members: readonly StaffLike[]): number {
  return members.filter(countsTowardStaffLimit).length;
}

/** Limite efetivo: inclusos no plano + extras. Sem maxUsers (nulo) = sem limite. */
export function effectiveUserLimit(input: { maxUsers?: number | null; extraUsers?: number | null }): number | null {
  if (input.maxUsers == null || !Number.isFinite(Number(input.maxUsers))) return null;
  const included = Math.max(0, Math.floor(Number(input.maxUsers)));
  const extras = Math.max(0, Math.floor(Number(input.extraUsers ?? 0)));
  return included + extras;
}

export function parseExtraUsers(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

export function suggestedMonthlyAmount(input: {
  planPrice?: string | number | null;
  extraUsers?: number | null;
  additionalUserPrice?: string | number | null;
}): string {
  const base = Number(input.planPrice ?? 0);
  const extra = parseExtraUsers(input.extraUsers);
  const add = Number(input.additionalUserPrice ?? 0);
  const total = (Number.isFinite(base) ? base : 0) + extra * (Number.isFinite(add) ? add : 0);
  return total.toFixed(2);
}

export function staffUsageLabel(current: number, limit: number | null, extraUsers = 0): string {
  if (limit == null) return `${current} funcionários (sem limite)`;
  const extras = parseExtraUsers(extraUsers);
  if (extras > 0) return `${current} de ${limit} funcionários (${extras} extras)`;
  return `${current} de ${limit} funcionários`;
}

export function userLimitReachedMessage(limit: number): string {
  return `Seu plano permite até ${limit} funcionários. Fale com o suporte para liberar mais.`;
}
