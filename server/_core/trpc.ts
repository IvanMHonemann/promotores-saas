import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import type { AccessLevel } from "@shared/auth";
import type { CompanyRole, EntitlementKey } from "@shared/entitlements";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});

const requireCompanyUser = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem empresa associada para acessar dados comerciais." });
  }
  const companyRoles: AccessLevel[] = ["company_admin", "supervisor", "promoter"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permissão comercial." });
  if (process.env.NODE_ENV !== "test") {
    const { checkSubscriptionAccess } = await import("../subscriptionAccess");
    const access = await checkSubscriptionAccess(opts.ctx.accountId);
    if (!access.allowed) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: access.reason || "Assinatura irregular. Regularize o plano para continuar.",
        cause: { code: "SUBSCRIPTION_BLOCKED", status: access.status },
      });
    }
  }
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

const requireCompanyAdmin = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "company_admin" || !opts.ctx.accountId) throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode executar esta operação." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

const requirePlatformAdmin = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (user.role !== "platform_admin" || !opts.ctx.isPlatformAdmin) throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  return opts.next({ ctx: { ...opts.ctx, user } });
});

export const protectedProcedure = t.procedure.use(requireUser);
const requireCompanyMemberNoBillingGate = t.middleware(async opts => {
  const user = opts.ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  if (!opts.ctx.accountId || !Number.isInteger(opts.ctx.accountId) || opts.ctx.accountId <= 0 || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Usuário sem empresa associada." });
  }
  const companyRoles: AccessLevel[] = ["company_admin", "supervisor", "promoter"];
  if (!companyRoles.includes(user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Perfil sem permissão comercial." });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: opts.ctx.accountId } });
});

export const companyBillingProcedure = t.procedure.use(requireCompanyMemberNoBillingGate);

const requireEntitlement = (featureKey: EntitlementKey) => t.middleware(async (opts) => {
  const user = opts.ctx.user;
  const companyId = opts.ctx.accountId;
  if (!user || !companyId || user.role === "platform_admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Não foi possível determinar a empresa e o perfil para validar este módulo." });
  }
  const { assertMemberFeatureAccess } = await import("../entitlements");
  await assertMemberFeatureAccess({
    companyId,
    memberAccountId: opts.ctx.memberAccountId ?? null,
    role: user.role as CompanyRole,
    featureKey,
  });
  return opts.next({ ctx: { ...opts.ctx, user, accountId: companyId } });
});

export const commercialFeatureProcedure = (featureKey: EntitlementKey) =>
  t.procedure.use(requireCompanyUser).use(requireEntitlement(featureKey));

export const companyAdminFeatureProcedure = (featureKey: EntitlementKey) =>
  t.procedure.use(requireCompanyAdmin).use(requireCompanyUser).use(requireEntitlement(featureKey));

export const companyAdminProcedure = t.procedure.use(requireCompanyAdmin);
export const adminCommercialProcedure = companyAdminProcedure;
export const platformProcedure = t.procedure.use(requirePlatformAdmin);
export const adminProcedure = platformProcedure;
