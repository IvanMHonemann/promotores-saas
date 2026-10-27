export const ENTITLEMENT_KEYS = [
  "dashboard",
  "clients",
  "pointsOfSale",
  "alerts",
  "timeTracking",
  "fieldOperations",
  "reports",
  "teamManagement",
  "backup",
  "offline",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];
export type CompanyRole = "company_admin" | "supervisor" | "promoter";
export type PermissionMode = "inherit" | "allow" | "deny";

export const ENTITLEMENT_CATALOG: ReadonlyArray<{
  key: EntitlementKey;
  label: string;
  description: string;
}> = [
  { key: "dashboard", label: "Painel e indicadores", description: "Resumo da operação da empresa ou do promotor." },
  { key: "clients", label: "Clientes", description: "Cadastro e consulta de clientes." },
  { key: "pointsOfSale", label: "Pontos de venda", description: "Gestão e limites de lojas e pontos de venda cadastrados." },
  { key: "alerts", label: "Alertas", description: "Alertas operacionais e de vencimento." },
  { key: "timeTracking", label: "Ponto eletrônico com GPS", description: "Marcações de jornada, localização e histórico." },
  { key: "fieldOperations", label: "Lojas, roteiros e visitas", description: "Cadastro de lojas, planejamento de roteiros e visitas em campo." },
  { key: "reports", label: "Relatórios e auditoria", description: "Histórico, relatórios e trilha de auditoria." },
  { key: "teamManagement", label: "Gestão da equipe", description: "Cadastro de usuários e permissões individuais." },
  { key: "backup", label: "Backup e restauração", description: "Recursos de backup e recuperação da empresa." },
  { key: "offline", label: "Operação offline / PWA", description: "Acesso aos recursos offline disponíveis no aplicativo." },
];

export const PLAN_FEATURES: Readonly<Record<"start" | "profissional" | "empresarial", readonly EntitlementKey[]>> = {
  start: ["dashboard", "clients", "pointsOfSale", "alerts"],
  profissional: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "reports", "teamManagement"],
  empresarial: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "reports", "teamManagement", "backup", "offline"],
};

const ALL_FEATURES = [...ENTITLEMENT_KEYS];
const SUPERVISOR_CEILING: EntitlementKey[] = [
  "dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations", "reports", "offline",
];
const PROMOTER_CEILING: EntitlementKey[] = ["dashboard", "timeTracking", "fieldOperations"];

export const ROLE_FEATURE_CEILING: Readonly<Record<CompanyRole, readonly EntitlementKey[]>> = {
  company_admin: ALL_FEATURES,
  supervisor: SUPERVISOR_CEILING,
  promoter: PROMOTER_CEILING,
};

export const ROLE_FEATURE_DEFAULTS: Readonly<Record<CompanyRole, readonly EntitlementKey[]>> = {
  company_admin: ALL_FEATURES,
  supervisor: ["dashboard", "clients", "pointsOfSale", "alerts", "timeTracking", "fieldOperations"],
  promoter: ["dashboard", "timeTracking", "fieldOperations"],
};

export function resolveEntitlements(input: {
  planFeatures: readonly EntitlementKey[];
  companyOverrides?: Partial<Record<EntitlementKey, boolean>>;
  role: CompanyRole;
  memberOverrides?: Partial<Record<EntitlementKey, PermissionMode>>;
}): Record<EntitlementKey, boolean> {
  const plan = new Set(input.planFeatures);
  const roleCeiling = new Set(ROLE_FEATURE_CEILING[input.role]);
  const roleDefaults = new Set(ROLE_FEATURE_DEFAULTS[input.role]);
  return Object.fromEntries(ENTITLEMENT_KEYS.map((key) => {
    // O dashboard básico é a porta de entrada de toda conta válida; somente
    // os módulos comerciais adicionais ficam sujeitos ao plano da empresa.
    const companyEnabled = key === "dashboard" ? true : (input.companyOverrides?.[key] ?? plan.has(key));
    const mode = input.memberOverrides?.[key] ?? "inherit";
    const requested = mode === "allow" ? true : mode === "deny" ? false : roleDefaults.has(key);
    return [key, Boolean(companyEnabled && roleCeiling.has(key) && requested)];
  })) as Record<EntitlementKey, boolean>;
}

export function featureKeysFromMap(map: Partial<Record<EntitlementKey, boolean>>): EntitlementKey[] {
  return ENTITLEMENT_KEYS.filter((key) => Boolean(map[key]));
}
