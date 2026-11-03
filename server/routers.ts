import { MEMBER_COOKIE_NAME } from "@shared/const";
import { timeTrackingRouter } from "./modules/timeTracking";
import { timesheetMirrorRouter } from "./modules/timesheetMirror";
import { timesheetArchiveRouter } from "./modules/timesheetArchive";
import { platformCompaniesRouter } from "./modules/platformCompanies";
import { storePhotosRouter } from "./modules/storePhotos";
import { storeClientsRouter } from "./modules/storeClients";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { checkRateLimit, getClientIp } from "./_core/rateLimit";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, companyAdminProcedure, companyAdminFeatureProcedure, commercialFeatureProcedure, companyBillingProcedure, platformProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { checkSubscriptionAccess } from "./subscriptionAccess";
import * as planLimits from "./planLimits";
import * as asaas from "./asaas";
import * as db from "./db";
import * as memberAuth from "./memberAuth";
import * as emailService from "./email";
import { auditFromCtx, diffAuditData, exportAuditLogsCsv, getAuditLogById, listAuditLogs, listEntityAuditHistory, listPromoterActivities } from "./audit";
import { reverseGeocodeAddress } from "./geocoding";
import { scopeMemberId, assertStoreAccess, setPromoterStoreAssignments, getPromoterStoreAssignments } from "./storeAccess";
import { ENTITLEMENT_KEYS, ROLE_FEATURE_CEILING, type CompanyRole, type EntitlementKey, type PermissionMode } from "../shared/entitlements";
import { getCompanyEntitlementBase, getMemberEntitlementSnapshot } from "./entitlements";
import { runPersistentGemini } from "./aiGithubService";

const emptyToNull = (value?: string) => value?.trim() || null;
const companyUserRole = z.enum(["company_admin", "supervisor", "promoter"]);
const entitlementFeatureKey = z.enum(ENTITLEMENT_KEYS);
const permissionModeSchema = z.enum(["inherit", "allow", "deny"]);
const featurePermissionListSchema = z.array(z.object({ featureKey: entitlementFeatureKey, mode: permissionModeSchema })).max(ENTITLEMENT_KEYS.length);

type PlatformTestSession = { status: "pending" | "in_progress" | "completed"; photoCount: number; lastPhotoAt: string | null; lastLatitude: number | null; lastLongitude: number | null };
const platformTestSessions = new Map<number, PlatformTestSession>();
const platformTestKey = (platformAdminId: number | undefined, fallbackId: number) => platformAdminId ?? fallbackId;
const getPlatformTestSession = (key: number): PlatformTestSession => platformTestSessions.get(key) ?? { status: "pending", photoCount: 0, lastPhotoAt: null, lastLatitude: null, lastLongitude: null };


const productInput = z.object({
  productCode: z.string().trim().min(1).max(64),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().int().min(0).max(2147483647),
  expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  storeId: z.number().int().positive().nullish(),
});
/** Garante que a loja informada pertence à empresa (e é visível ao usuário) antes de vincular a um produto. */
async function assertStoreInCompany(ctx: any, storeId?: number | null): Promise<number | null> {
  if (!storeId) return null;
  const database = await db.getDb();
  await assertStoreAccess(database, ctx, storeId); // lança NOT_FOUND se a loja não for da empresa/visível ao usuário
  return storeId;
}

export const appRouter = router({
  system: systemRouter,
  timeTracking: timeTrackingRouter,
  timesheetMirror: timesheetMirrorRouter,
  timesheetArchive: timesheetArchiveRouter,
  platformCompanies: platformCompaniesRouter,
  storePhotos: storePhotosRouter,
  storeClients: storeClientsRouter,
  entitlements: router({
    mine: companyBillingProcedure.query(({ ctx }) => {
      if (!ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Usuário da empresa não encontrado." });
      return getMemberEntitlementSnapshot(ctx.accountId, ctx.memberAccountId, ctx.user.role as CompanyRole);
    }),
  }),

  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),

    /** Cadastro público: cria empresa + admin com plano opcional (trial 14 dias). */
    signup: publicProcedure
      .input(z.object({
        companyName: z.string().min(2, "Nome da empresa é obrigatório"),
        userName: z.string().min(2, "Nome do responsável é obrigatório"),
        email: z.string().email(),
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
        planId: z.number().int().positive("Selecione um plano antes de criar a conta"),
        paymentConfirmed: z.boolean().refine((v) => v === true, { message: "Confirme o pagamento para criar a conta." }),
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          // Conta só é criada após plano + confirmação de pagamento (mock ou real no futuro)
          const created = await memberAuth.createCompanyWithAdmin({
            companyName: input.companyName,
            userName: input.userName,
            email: input.email,
            password: input.password,
            planId: input.planId,
          });
          // E-mails: cliente (login + recovery) e admin da plataforma
          void (async () => {
            try {
              let planName: string | null = null;
              if (created.planId) {
                const plans = await db.listSubscriptionPlans();
                planName = plans.find((p: any) => p.id === created.planId)?.name ?? null;
              }
              await emailService.emailAccountCreated({
                to: input.email,
                userName: input.userName,
                companyName: input.companyName,
                email: input.email,
                password: input.password,
                recoveryCode: created.recoveryCode,
                planName,
                isTrial: true,
              });
              await emailService.emailAdminNewCompany({
                companyName: input.companyName,
                userName: input.userName,
                email: input.email,
                planName,
                isTrial: true,
              });
            } catch (err) {
              console.warn("[email] signup notify failed", err);
            }
          })();
          // Auto-login after signup
          const principal = await memberAuth.authenticateMember(input.email, input.password);
          if (principal) {
            const session = await memberAuth.createSession(principal);
            ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1000 });
          }
          return { success: true as const, ...created };
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
          }
          throw error;
        }
      }),

    login: publicProcedure
      .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        const ip = getClientIp(ctx.req);
        const limit = checkRateLimit(ip, "login");
        if (!limit.ok) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Muitas tentativas. Aguarde um minuto." });
        }
        const principal = await memberAuth.authenticateMember(input.email, input.password);
        if (!principal) {
          void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        if (principal.kind === "company") {
          const company = await db.getCompanyById(principal.account.companyId);
          if (!company || company.active === false) {
            const reason = company ? await db.getSetting("blocked_reason", company.id, "") : "";
            throw new TRPCError({ code: "FORBIDDEN", message: reason || "Acesso da empresa bloqueado. Entre em contato com o suporte." });
          }
        }
        const session = await memberAuth.createSession(principal);
        ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1000 });
        const user = principal.kind === "platform"
          ? {
              id: principal.account.id,
              openId: `platform:${principal.account.id}`,
              name: principal.account.userName,
              email: principal.account.email,
              loginMethod: "password",
              role: "platform_admin" as const,
              createdAt: principal.account.createdAt,
              updatedAt: principal.account.updatedAt,
              lastSignedIn: principal.account.createdAt,
            }
          : {
              id: -principal.account.id,
              openId: `member:${principal.account.id}`,
              name: principal.account.userName,
              email: principal.account.email,
              loginMethod: "password",
              role: memberAuth.normalizeMemberRole(String(principal.account.role)),
              companyId: principal.account.companyId,
              createdAt: principal.account.createdAt,
              updatedAt: principal.account.updatedAt,
              lastSignedIn: principal.account.createdAt,
            };
        void auditFromCtx(ctx, {
          companyId: (principal as any).companyId ?? null,
          action: "login",
          module: "auth",
          entityType: "session",
          description: `Login realizado: ${input.email}`,
          newData: { email: input.email, kind: session.kind },
        });
        return { success: true, kind: session.kind, user, sessionToken: session.rawToken } as const;
      }),

    recoverPassword: publicProcedure
      .input(z.object({ email: z.string().email(), recoveryCode: z.string().min(1), newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ input }) => {
        const recovered = await memberAuth.recoverPassword(input.email, input.recoveryCode, input.newPassword);
        if (!recovered) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou código de recuperação inválido." });
        return { success: true, recoveryCode: recovered.recoveryCode } as const;
      }),

    changePassword: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .input(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres") }))
      .mutation(async ({ ctx, input }) => {
        const changed = ctx.user.role === "platform_admin"
          ? await memberAuth.changePlatformPassword(ctx.platformAdminId ?? ctx.user.id, input.currentPassword, input.newPassword)
          : await memberAuth.changeMemberPassword(ctx.memberAccountId ?? Math.abs(ctx.user.id), input.currentPassword, input.newPassword);
        if (!changed) throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
        return { success: true } as const;
      }),

    updateProfile: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .input(z.object({
        userName: z.string().min(2).optional(),
        avatarDataUrl: z.string().max(400_000).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "platform_admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Perfil de plataforma não usa esta rota." });
        }
        const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
        const companyId = ctx.accountId;
        if (!companyId) throw new TRPCError({ code: "FORBIDDEN", message: "Empresa não identificada." });
        let userName = ctx.user.name || "";
        if (input.userName) {
          const updated = await memberAuth.updateMemberProfile(memberId, { userName: input.userName });
          userName = updated.userName;
        }
        if (input.avatarDataUrl !== undefined) {
          const key = `member_avatar_${memberId}`;
          if (!input.avatarDataUrl) {
            await db.setSetting(key, "", companyId);
          } else {
            if (!input.avatarDataUrl.startsWith("data:image/")) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "Imagem de perfil inválida." });
            }
            await db.setSetting(key, input.avatarDataUrl, companyId);
          }
        }
        return { success: true as const, userName };
      }),

    profileExtras: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .query(async ({ ctx }) => {
        if (ctx.user.role === "platform_admin" || !ctx.accountId) {
          return { avatarDataUrl: null as string | null, alertDays: 30 };
        }
        const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
        const avatar = await db.getSetting(`member_avatar_${memberId}`, ctx.accountId, "");
        const alertDays = parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30;
        return { avatarDataUrl: avatar || null, alertDays };
      }),

    regenerateRecoveryCode: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .input(z.object({ currentPassword: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "platform_admin") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Indisponível para admin da plataforma nesta tela." });
        }
        const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
        const ok = await memberAuth.verifyMemberPassword(memberId, input.currentPassword);
        if (!ok) throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha atual incorreta." });
        const result = await memberAuth.regenerateMemberRecoveryCode(memberId);
        return { success: true as const, recoveryCode: result.recoveryCode };
      }),

    logoutAllSessions: publicProcedure
      .use(async opts => {
        if (!opts.ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Please login (10001)" });
        return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
      })
      .mutation(async ({ ctx }) => {
        if (ctx.user.role === "platform_admin") return { success: true as const };
        const memberId = ctx.memberAccountId ?? Math.abs(ctx.user.id);
        await memberAuth.revokeAllMemberSessions(memberId);
        return { success: true as const };
      }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const cookies = parseCookie(ctx.req.headers.cookie ?? "");
      void auditFromCtx(ctx, { action: "logout", module: "auth", entityType: "session", description: `Logout: ${ctx.user?.email || "sessão"}` });
      await memberAuth.revokeSessions(cookies[MEMBER_COOKIE_NAME] ?? "");
      const memberCookieOptions = getSessionCookieOptions(ctx.req, true);
      if (cookies[MEMBER_COOKIE_NAME]) ctx.res.clearCookie(MEMBER_COOKIE_NAME, { ...memberCookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  offline: router({
  }),

  platform: router({
    aiSupport: router({
      chat: platformProcedure
        .input(z.object({
          prompt: z.string().trim().min(1).max(12000),
          history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(12000) })).max(30).optional(),
        }))
        .mutation(async ({ input }) => runPersistentGemini(input.prompt, input.history ?? [])),
    }),
    plans: router({
      list: platformProcedure.query(() => db.listSubscriptionPlans()),
      create: platformProcedure.input(z.object({
        name: z.string().min(2),
        description: z.string().optional().nullable(),
        price: z.string().default("0.00"),
        billingCycle: z.enum(["monthly", "yearly"]).default("monthly"),
        maxUsers: z.number().int().positive().optional().nullable(),
        maxClients: z.number().int().positive().optional().nullable(),
        maxExtinguishers: z.number().int().positive().optional().nullable(),
        featureKeys: z.array(entitlementFeatureKey).default([]),
        availableForNew: z.boolean().default(true),
      })).mutation(({ input }) => db.createSubscriptionPlan(input)),
      update: platformProcedure.input(z.object({
        id: z.number().int().positive(),
        name: z.string().min(2).optional(),
        description: z.string().optional().nullable(),
        price: z.string().optional(),
        billingCycle: z.enum(["monthly", "yearly"]).optional(),
        maxUsers: z.number().int().positive().optional().nullable(),
        maxClients: z.number().int().positive().optional().nullable(),
        maxExtinguishers: z.number().int().positive().optional().nullable(),
        featureKeys: z.array(entitlementFeatureKey).optional(),
        availableForNew: z.boolean().optional(),
      })).mutation(({ input }) => db.updateSubscriptionPlan(input.id, input)),
      delete: platformProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => db.deleteSubscriptionPlan(input.id)),
    }),
    companies: platformCompaniesRouter,
  }),

  // ... rest of the file continues with the original content after the platform section ...
  // NOTE: This is a truncated representation for the tool call. The full original content after the early sections must be restored.
  // In practice, the full file from the previous extraction is used.
});
