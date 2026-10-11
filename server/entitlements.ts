import { TRPCError } from "@trpc/server";
import * as db from "./db";
import {
  ENTITLEMENT_KEYS,
  type CompanyRole,
  type EntitlementKey,
  type PermissionMode,
  resolveEntitlements,
} from "../shared/entitlements";

export type CompanyEntitlementBase = {
  companyId: number;
  planId: number | null;
  planName: string;
  planFeatureKeys: EntitlementKey[];
  companyOverrides: Partial<Record<EntitlementKey, boolean>>;
  companyFeatures: Record<EntitlementKey, boolean>;
  plan: Record<string, unknown> | null;
};

export async function getCompanyEntitlementBase(companyId: number): Promise<CompanyEntitlementBase> {
  const resolved = await db.resolveCompanyPlan(companyId);
  const plan = (resolved.plan as Record<string, unknown> | null) ?? null;
  const rawKeys = Array.isArray(plan?.featureKeys)
    ? plan.featureKeys.filter((key): key is EntitlementKey => (ENTITLEMENT_KEYS as readonly unknown[]).includes(key))
    : [];
  const companyOverrides = await db.getCompanyFeatureOverrides(companyId);
  const planSet = new Set(rawKeys);
  const companyFeatures = Object.fromEntries(ENTITLEMENT_KEYS.map((key) => [key, companyOverrides[key] ?? planSet.has(key)])) as Record<EntitlementKey, boolean>;
  return {
    companyId,
    planId: plan?.id == null ? null : Number(plan.id),
    planName: String(plan?.name ?? "Sem plano"),
    planFeatureKeys: rawKeys,
    companyOverrides,
    companyFeatures,
    plan,
  };
}

export async function getMemberEntitlementSnapshot(companyId: number, memberAccountId: number, role: CompanyRole) {
  const base = await getCompanyEntitlementBase(companyId);
  const memberOverrides = await db.getMemberFeatureModes(memberAccountId, companyId);
  const effective = resolveEntitlements({
    planFeatures: base.planFeatureKeys,
    companyOverrides: base.companyOverrides,
    role,
    memberOverrides,
  });
  return {
    ...base,
    memberAccountId,
    role,
    memberOverrides,
    effective,
    effectiveFeatureKeys: ENTITLEMENT_KEYS.filter((key) => effective[key]),
  };
}

export async function assertCompanyFeatureAccess(companyId: number, featureKey: EntitlementKey) {
  const base = await getCompanyEntitlementBase(companyId);
  if (!base.companyFeatures[featureKey]) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `O módulo “${featureKey}” não está habilitado para esta empresa.`,
      cause: { code: "PLAN_FEATURE_BLOCKED", featureKey, planId: base.planId, planName: base.planName },
    });
  }
  return base;
}

export async function assertMemberFeatureAccess(input: {
  companyId: number;
  memberAccountId: number | null;
  role: CompanyRole;
  featureKey: EntitlementKey;
}) {
  const memberOverrides: Partial<Record<EntitlementKey, PermissionMode>> = input.memberAccountId
    ? await db.getMemberFeatureModes(input.memberAccountId, input.companyId)
    : {};
  const base = await getCompanyEntitlementBase(input.companyId);
  const effective = resolveEntitlements({
    planFeatures: base.planFeatureKeys,
    companyOverrides: base.companyOverrides,
    role: input.role,
    memberOverrides,
  });
  if (!effective[input.featureKey]) {
    let message = "Este módulo não está liberado para seu usuário. Peça ao administrador da empresa para revisar o acesso.";
    let code = "MEMBER_FEATURE_BLOCKED";
    if (base.companyOverrides[input.featureKey] === false) {
      message = "Este módulo foi bloqueado para a empresa pelo administrador da plataforma.";
      code = "COMPANY_FEATURE_BLOCKED";
    } else if (!base.companyFeatures[input.featureKey]) {
      message = `O plano ${base.planName} não inclui este módulo. Faça upgrade ou solicite uma exceção ao administrador da plataforma.`;
      code = "PLAN_FEATURE_BLOCKED";
    } else if (memberOverrides[input.featureKey] === "deny") {
      message = "O administrador da empresa bloqueou este módulo para seu usuário.";
    } else if (!base.planFeatureKeys.includes(input.featureKey) && base.companyOverrides[input.featureKey] === true) {
      // Exceção da empresa libera o módulo, mas ainda respeita o teto do papel.
      message = "Seu perfil não tem permissão para usar este módulo.";
      code = "ROLE_FEATURE_BLOCKED";
    }
    throw new TRPCError({
      code: "FORBIDDEN",
      message,
      cause: { code, featureKey: input.featureKey, planId: base.planId, planName: base.planName, role: input.role },
    });
  }
  return { ...base, memberOverrides, effective };
}
