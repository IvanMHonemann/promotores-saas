import { MEMBER_COOKIE_NAME } from "@shared/const";
import { timeTrackingRouter } from "./modules/timeTracking";
import { z } from "zod";
import { parse as parseCookie } from "cookie";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, companyAdminProcedure, companyAdminFeatureProcedure, commercialFeatureProcedure, companyBillingProcedure, platformProcedure, publicProcedure, router } from "./_core/trpc";
import { checkSubscriptionAccess } from "./subscriptionAccess";
import * as planLimits from "./planLimits";
import * as asaas from "./asaas";
import * as db from "./db";
import * as memberAuth from "./memberAuth";
import * as emailService from "./email";
import { auditFromCtx, diffAuditData, exportAuditLogsCsv, getAuditLogById, listAuditLogs, listEntityAuditHistory, listPromoterActivities } from "./audit";
import { reverseGeocodeAddress } from "./geocoding";
import { ENTITLEMENT_KEYS, ROLE_FEATURE_CEILING, type CompanyRole, type EntitlementKey, type PermissionMode } from "../shared/entitlements";
import { getCompanyEntitlementBase, getMemberEntitlementSnapshot } from "./entitlements";

const emptyToNull = (value?: string) => value?.trim() || null;
const companyUserRole = z.enum(["company_admin", "supervisor", "promoter"]);
const entitlementFeatureKey = z.enum(ENTITLEMENT_KEYS);
const permissionModeSchema = z.enum(["inherit", "allow", "deny"]);
const featurePermissionListSchema = z.array(z.object({ featureKey: entitlementFeatureKey, mode: permissionModeSchema })).max(ENTITLEMENT_KEYS.length);

const clientInput = z.object({
  companyName: z.string().min(1, "Nome da empresa é obrigatório"),
  cnpj: z.string().optional(), address: z.string().optional(), city: z.string().min(1, "Cidade é obrigatória"),
  cep: z.string().optional(), phone: z.string().optional(), contactName: z.string().optional(),
  cpf: z.string().optional(), birthDate: z.string().optional(), notes: z.string().optional(),
});

export const appRouter = router({
  system: systemRouter,
  timeTracking: timeTrackingRouter,
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
        const principal = await memberAuth.authenticateMember(input.email, input.password);
        if (!principal) {
          void auditFromCtx(ctx, { action: "login_failed", module: "auth", entityType: "session", description: `Tentativa de login falhou para ${input.email}`, newData: { email: input.email } });
          throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos." });
        }
        const session = await memberAuth.createSession(principal);
        ctx.res.cookie(MEMBER_COOKIE_NAME, session.rawToken, { ...getSessionCookieOptions(ctx.req, true), maxAge: 30 * 24 * 60 * 60 * 1000 });
        void auditFromCtx(ctx, {
          companyId: (principal as any).companyId ?? null,
          action: "login",
          module: "auth",
          entityType: "session",
          description: `Login realizado: ${input.email}`,
          newData: { email: input.email, kind: session.kind },
        });
        return { success: true, kind: session.kind } as const;
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
    snapshot: commercialFeatureProcedure("offline").input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().min(10).max(100).optional() }).optional()).query(({ ctx, input }) => db.getOfflineSnapshot(ctx.accountId, input)),
  }),

  platform: router({
    aiChat: platformProcedure
      .input(z.object({
        messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(12000) })).min(1).max(30),
      }))
      .mutation(async ({ input }) => {
        const apiKey = process.env.OPENAI_API_KEY || process.env.promotores;
        if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "A IA ainda não está configurada no ambiente de produção." });
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            temperature: 0.2,
            messages: [
              { role: "system", content: "Você é a IA de suporte do Promotores SaaS. Responda em português brasileiro, seja objetiva e explique claramente o que deve ser alterado. Você pode diagnosticar a aplicação e propor mudanças, mas não invente que alterou arquivos se não tiver executado uma ferramenta." },
              ...input.messages,
            ],
          }),
        });
        if (!response.ok) throw new TRPCError({ code: "BAD_GATEWAY", message: "O provedor de IA não respondeu corretamente." });
        const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
        return { content: payload.choices?.[0]?.message?.content?.trim() || "A IA não retornou conteúdo." };
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
        active: z.boolean().optional(),
      })).mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateSubscriptionPlan(id, data);
      }),
    }),

    subscriptions: router({
      list: platformProcedure.query(() => db.listCompanySubscriptions()),
      stats: platformProcedure.query(() => db.getSubscriptionStats()),
      create: platformProcedure.input(z.object({
        companyId: z.number().int().positive(),
        planId: z.number().int().positive(),
        status: z.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).default("active"),
        startsAt: z.string().min(8),
        endsAt: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })).mutation(({ input }) => db.createCompanySubscription(input)),
      update: platformProcedure.input(z.object({
        id: z.number().int().positive(),
        planId: z.number().int().positive().optional(),
        status: z.enum(["trial", "active", "pending", "overdue", "suspended", "canceled", "test", "expired"]).optional(),
        startsAt: z.string().min(8).optional(),
        endsAt: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })).mutation(async ({ input }) => {
        const { id, ...data } = input;
        return db.updateCompanySubscription(id, data);
      }),
    }),

    companyFeatures: router({
      get: platformProcedure.input(z.object({ companyId: z.number().int().positive() })).query(({ input }) => getCompanyEntitlementBase(input.companyId)),
      set: platformProcedure.input(z.object({
        companyId: z.number().int().positive(),
        overrides: featurePermissionListSchema,
        reason: z.string().max(500).optional().nullable(),
      })).mutation(async ({ ctx, input }) => {
        const overrides = Object.fromEntries(input.overrides.map(({ featureKey, mode }) => [
          featureKey,
          mode === "inherit" ? null : mode === "allow",
        ])) as Partial<Record<EntitlementKey, boolean | null>>;
        await db.replaceCompanyFeatureOverrides({
          companyId: input.companyId,
          overrides,
          updatedByPlatformAdminId: ctx.platformAdminId ?? null,
          reason: input.reason ?? null,
        });
        return { success: true as const };
      }),
    }),

    /** Compatibilidade do painel administrativo: somente platform_admin acessa estas operações globais. */
    identity: platformProcedure.query(({ ctx }) => ({ id: ctx.platformAdminId ?? ctx.user.id, role: "platform_admin" as const, global: true })),
    reverseGeocodePoint: platformProcedure
      .input(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }))
      .mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
    companies: router({
      list: platformProcedure.query(() => db.listCompanies()),
      create: platformProcedure.input(z.object({ companyName: z.string().min(2), userName: z.string().min(2), email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => {
        try { return await memberAuth.createCompanyWithAdmin(input); }
        catch (error: any) { if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." }); throw error; }
      }),
      update: platformProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().min(2).optional(), active: z.boolean().optional() })).mutation(async ({ input }) => { await db.updateCompany(input.id, { name: input.name, active: input.active }); return { success: true } as const; }),
    }),
    dashboard: platformProcedure.input(z.object({ companyId: z.number().int().positive(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() })).query(({ input }) => db.getPlatformDashboardStats(input.companyId, input)),
    users: router({
      list: platformProcedure.query(() => memberAuth.listMemberAccounts()),
      create: platformProcedure.input(z.object({ companyId: z.number().int().positive(), userName: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: companyUserRole })).mutation(async ({ input, ctx }) => {
        const company = await db.getCompanyById(input.companyId);
        if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada." });
        if (!company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível criar usuário em uma empresa bloqueada." });
        try {
          const created = await memberAuth.createCompanyUser(input);
          void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usuário criado pelo administrador geral: ${input.userName}`, newData: { companyId: input.companyId, email: input.email, role: input.role } });
          return created;
        } catch (error: any) {
          if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
          throw error;
        }
      }),
    }),
    data: router({
      clients: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformClients(input?.companyId)),
      clientsPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), city: z.string().optional(), search: z.string().optional() })).query(({ input }) => db.getClientsPage(input.companyId, input)),
      extinguishers: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformExtinguishers(input?.companyId)),
      extinguishersPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), filter: z.enum(["all", "active", "near", "expired"]).optional() })).query(({ input }) => db.getExtinguishersPage(input.companyId, input)),
      orders: platformProcedure.input(z.object({ companyId: z.number().int().positive().optional() }).optional()).query(({ input }) => db.getPlatformOrders(input?.companyId)),
      ordersPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() })).query(({ input }) => db.getServiceOrdersPage(input.companyId, input)),
      alertsPage: platformProcedure.input(z.object({ companyId: z.number().int().positive(), page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), daysAhead: z.number().optional(), filter: z.enum(["all", "near", "expired"]).optional(), search: z.string().optional(), city: z.string().optional() })).query(async ({ input }) => { const days = input.daysAhead || parseInt(await db.getSetting("alert_days_ahead", input.companyId, "30"), 10) || 30; return db.getExpiringExtinguishersPage(days, input.companyId, input); }),
      history: platformProcedure.input(z.object({ companyId: z.number().int().positive(), clientId: z.number().int().positive() })).query(({ input }) => db.getServiceOrderHistory(input.clientId, input.companyId)),
      createClient: platformProcedure.input(clientInput.extend({ companyId: z.number().int().positive() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o cliente." });
        return { id: await db.createClient({ ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }) };
      }),
      createExtinguisher: platformProcedure.input(z.object({ companyId: z.number().int().positive(), clientId: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ input }) => {
        const { companyId, ...data } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para cadastrar o extintor." });
        return { id: await db.createExtinguisher({ ...data, accountId: companyId, expirationDate: data.expirationDate as any, lastInspectionDate: (data.lastInspectionDate || null) as any, capacity: emptyToNull(data.capacity), serialNumber: emptyToNull(data.serialNumber), locationInBuilding: emptyToNull(data.locationInBuilding), notes: emptyToNull(data.notes) }, companyId) };
      }),
      createOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), orderNumber: z.number().optional(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string().default("SIM"), leftReserve: z.string().default("NÃO"), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string().default("0.00"), paymentMethod: z.string().default("A VISTA"), installmentsCount: z.number().default(1), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string(), extinguisherId: z.number().optional() })) })).mutation(async ({ input, ctx }) => {
        const { companyId, items, ...orderData } = input;
        const company = await db.getCompanyById(companyId);
        if (!company || !company.active) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione uma empresa ativa para criar a ordem de serviço." });
        return db.createServiceOrder({ ...orderData, accountId: companyId, createdByName: ctx.user.name || ctx.user.email || "Administrador geral", createdByUserId: null } as any, items as any, companyId);
      }),
      deleteOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteServiceOrder(input.id, input.companyId); return { success: true } as const; }),
      deleteClient: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteClient(input.id, input.companyId); return { success: true } as const; }),
      deleteExtinguisher: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.deleteExtinguisher(input.id, input.companyId); return { success: true } as const; }),
      updateClient: platformProcedure.input(clientInput.extend({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { const { companyId, id, ...data } = input; await db.updateClient(id, { ...data, accountId: companyId, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, companyId); return { success: true } as const; }),
      updateOrder: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string(), leftReserve: z.string(), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string(), paymentMethod: z.string(), installmentsCount: z.number(), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string(), extinguisherId: z.number().optional() })) })).mutation(async ({ input }) => { const { companyId, id, items, ...orderData } = input; await db.updateServiceOrder(id, { ...orderData, accountId: companyId } as any, items as any, companyId); return { success: true } as const; }),
      trash: router({
        list: platformProcedure.input(z.object({ companyId: z.number().int().positive() })).query(({ input }) => db.listTrash(input.companyId)),
        restore: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.restoreTrashItem(input.id, input.companyId); return { success: true } as const; }),
        permanentlyDelete: platformProcedure.input(z.object({ companyId: z.number().int().positive(), id: z.number().int().positive() })).mutation(async ({ input }) => { await db.permanentlyDeleteTrashItem(input.id, input.companyId); return { success: true } as const; }),
      }),
    }),
  }),



  accounts: router({
    list: platformProcedure.query(() => memberAuth.listMemberAccounts()),
    create: platformProcedure.input(z.object({ companyName: z.string().min(2), userName: z.string().min(2), email: z.string().email(), password: z.string().min(8) })).mutation(async ({ input }) => {
        const created = await memberAuth.createCompanyWithAdmin(input);
        void (async () => {
          try {
            await emailService.emailAccountCreated({
              to: input.email,
              userName: input.userName,
              companyName: input.companyName,
              email: input.email,
              password: input.password,
              recoveryCode: created.recoveryCode,
              planName: null,
              isTrial: true,
            });
            await emailService.emailAdminNewCompany({
              companyName: input.companyName,
              userName: input.userName,
              email: input.email,
              planName: null,
              isTrial: true,
            });
          } catch (err) {
            console.warn("[email] platform create company notify failed", err);
          }
        })();
        return created;
      }),
    setActive: platformProcedure.input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ input }) => { await memberAuth.setMemberActive(input.id, input.active); return { success: true } as const; }),
    resetPassword: platformProcedure.input(z.object({ id: z.number().int().positive(), newPassword: z.string().min(8) })).mutation(async ({ input }) => { await memberAuth.resetMemberPassword(input.id, input.newPassword); return { success: true } as const; }),
  }),

  companyUsers: router({
    list: companyAdminFeatureProcedure("teamManagement").query(({ ctx }) => memberAuth.listMemberAccounts(ctx.accountId)),
    permissions: companyAdminFeatureProcedure("teamManagement").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const members = await memberAuth.listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não pertence a esta empresa." });
      return getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role as "company_admin" | "supervisor" | "promoter");
    }),
    setPermissions: companyAdminFeatureProcedure("teamManagement").input(z.object({
      id: z.number().int().positive(),
      permissions: featurePermissionListSchema,
    })).mutation(async ({ ctx, input }) => {
      const members = await memberAuth.listMemberAccounts(ctx.accountId);
      const target = members.find((member) => member.id === input.id);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não pertence a esta empresa." });
      const modes = Object.fromEntries(input.permissions.map(({ featureKey, mode }) => [featureKey, mode])) as Partial<Record<EntitlementKey, PermissionMode>>;
      if (target.role === "company_admin" && modes.teamManagement === "deny") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A permissão de gestão da equipe não pode ser bloqueada individualmente para um administrador da empresa." });
      }
      const base = await getCompanyEntitlementBase(ctx.accountId);
      for (const [featureKey, mode] of Object.entries(modes) as [EntitlementKey, PermissionMode][]) {
        if (mode === "allow" && !base.companyFeatures[featureKey]) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `O módulo ${featureKey} não está liberado para esta empresa.` });
        }
        if (mode === "allow" && !ROLE_FEATURE_CEILING[target.role as keyof typeof ROLE_FEATURE_CEILING].includes(featureKey)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `O papel ${target.role} não permite liberar o módulo ${featureKey}.` });
        }
      }
      const before = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role as "company_admin" | "supervisor" | "promoter");
      await db.replaceMemberFeatureModes({ memberAccountId: target.id, modes, updatedByMemberAccountId: ctx.memberAccountId ?? null });
      const after = await getMemberEntitlementSnapshot(ctx.accountId, target.id, target.role as "company_admin" | "supervisor" | "promoter");
      void auditFromCtx(ctx, { action: "settings_change", module: "users", entityType: "user_permissions", entityId: target.id, entityLabel: target.userName, description: `Permissões de módulos atualizadas para ${target.userName}`, oldData: before.effective, newData: after.effective });
      return { success: true as const };
    }),
    create: companyAdminFeatureProcedure("teamManagement").input(z.object({ userName: z.string().min(2), email: z.string().email(), password: z.string().min(8), role: companyUserRole })).mutation(async ({ ctx, input }) => {
      try {
        await planLimits.assertUserLimit(ctx.accountId);
        const created = await memberAuth.createCompanyUser({ ...input, companyId: ctx.accountId });
        void auditFromCtx(ctx, { action: "create", module: "users", entityType: "user", entityId: created.accountId, entityLabel: input.userName, description: `Usuário criado: ${input.userName} (${input.role})`, newData: { userName: input.userName, email: input.email, role: input.role, id: created.accountId } });
        void (async () => {
          try {
            const company = await db.getCompanyById(ctx.accountId);
            await emailService.emailAccountCreated({
              to: input.email,
              userName: input.userName,
              companyName: company?.name || `Empresa #${ctx.accountId}`,
              email: input.email,
              password: input.password,
              recoveryCode: created.recoveryCode,
              planName: null,
              isTrial: false,
            });
          } catch (err) {
            console.warn("[email] company user notify failed", err);
          }
        })();
        return created;
      }
      catch (error: any) { if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." }); console.error("[companyUsers.create] database error", { code: error?.code, errno: error?.errno, sqlMessage: error?.sqlMessage, message: error?.message }); if (error?.code === "ER_NO_REFERENCED_ROW_2" || error?.code === "ER_NO_REFERENCED_ROW") throw new TRPCError({ code: "BAD_REQUEST", message: "A empresa selecionada não existe mais. Atualize a página e tente novamente." }); if (error?.code === "ER_BAD_FIELD_ERROR" || error?.code === "ER_NO_SUCH_TABLE") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O banco de dados está com a estrutura de usuários desatualizada. A implantação precisa concluir a migração." }); throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível criar o usuário. Verifique os dados e tente novamente." }); }
    }),
    update: companyAdminFeatureProcedure("teamManagement").input(z.object({ id: z.number().int().positive(), userName: z.string().min(2).optional(), email: z.string().email().optional(), role: companyUserRole.optional() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && input.role && input.role !== "company_admin") throw new TRPCError({ code: "BAD_REQUEST", message: "O administrador não pode remover o próprio nível administrativo." });
      const usersBefore = await memberAuth.listMemberAccounts(ctx.accountId);
      const beforeUser = usersBefore.find((u) => u.id === input.id) || null;
      await memberAuth.updateCompanyUser(input.id, ctx.accountId, { userName: input.userName, email: input.email, role: input.role });
      const usersAfter = await memberAuth.listMemberAccounts(ctx.accountId);
      const afterUser = usersAfter.find((u) => u.id === input.id) || null;
      const userDiff = diffAuditData(beforeUser, afterUser);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: input.id, entityLabel: afterUser?.userName || beforeUser?.userName || `#${input.id}`, description: `Usuário atualizado: ${afterUser?.userName || input.id}`, oldData: userDiff.oldData, newData: userDiff.newData });
      return { success: true } as const;
    }),
    updatePromoterManagement: companyAdminFeatureProcedure("teamManagement").input(z.object({
      id: z.number().int().positive(),
      userName: z.string().trim().min(2).max(255),
      email: z.string().trim().email().max(320),
      employeeCode: z.string().trim().max(50).nullable(),
      workStartTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      workEndTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
      weeklyRoutes: z.array(z.object({ weekday: z.number().int().min(0).max(6), storeIds: z.array(z.number().int().positive()).min(1) })).max(7).optional(),
    })).mutation(async ({ ctx, input }) => {
      if (input.workStartTime && input.workEndTime && input.workEndTime <= input.workStartTime) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "O fim da jornada precisa ser posterior ao início." });
      }
      const usersBefore = await memberAuth.listMemberAccounts(ctx.accountId);
      const before = usersBefore.find((member) => member.id === input.id);
      if (!before || before.role !== "promoter") throw new TRPCError({ code: "NOT_FOUND", message: "Promotor não encontrado nesta empresa." });
      try {
        await db.updatePromoterManagement({
          companyId: ctx.accountId,
          promoterId: input.id,
          userName: input.userName,
          email: input.email,
          employeeCode: input.employeeCode,
          workStartTime: input.workStartTime,
          workEndTime: input.workEndTime,
          weeklyRoutes: input.weeklyRoutes,
        });
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail ou matrícula já está em uso." });
        if (error?.message?.includes("não pertence") || error?.message?.includes("inativas") || error?.message?.includes("programação") || error?.message?.includes("dia programado")) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
      const usersAfter = await memberAuth.listMemberAccounts(ctx.accountId);
      const after = usersAfter.find((member) => member.id === input.id);
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "promoter_profile", entityId: input.id, entityLabel: after?.userName || before.userName, description: `Cadastro e roteiro de ${after?.userName || before.userName} atualizados`, oldData: before, newData: after });
      return { success: true as const };
    }),
    setActive: companyAdminFeatureProcedure("teamManagement").input(z.object({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => {
      if (input.id === ctx.memberAccountId && !input.active) throw new TRPCError({ code: "BAD_REQUEST", message: "O administrador não pode desativar a própria sessão." });
      await memberAuth.setMemberActive(input.id, input.active, ctx.accountId);
      void auditFromCtx(ctx, { action: input.active ? "activate" : "deactivate", module: "users", entityType: "user", entityId: input.id, description: `Usuário ${input.active ? "ativado" : "desativado"} #${input.id}`, newData: { active: input.active } });
      return { success: true } as const;
    }),
    resetPassword: companyAdminFeatureProcedure("teamManagement").input(z.object({ id: z.number().int().positive(), newPassword: z.string().min(8) })).mutation(async ({ ctx, input }) => { const users = await memberAuth.listMemberAccounts(ctx.accountId); if (!users.some(account => account.id === input.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não pertence a esta empresa." }); await memberAuth.resetMemberPassword(input.id, input.newPassword); return { success: true } as const; }),
  }),

  dashboard: router({ stats: commercialFeatureProcedure("dashboard").query(async ({ ctx }) => { if (ctx.user.role === "promoter") throw new TRPCError({ code: "FORBIDDEN", message: "Este painel não está disponível para promotores." }); return db.getDashboardStats(ctx.accountId); }) }),

  companyProfile: router({
    updateName: companyAdminProcedure.input(z.object({ name: z.string().min(2).max(255) })).mutation(async ({ ctx, input }) => {
      await db.updateCompany(ctx.accountId, { name: input.name.trim() });
      void auditFromCtx(ctx, {
        action: "update",
        module: "company",
        entityType: "company",
        entityId: ctx.accountId,
        entityLabel: input.name.trim(),
        description: `Nome da empresa alterado para ${input.name.trim()}`,
        newData: { name: input.name.trim() },
      });
      return { success: true as const };
    }),
  }),

  settings: router({
    getAlertDays: commercialFeatureProcedure("alerts").query(async ({ ctx }) => parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30),
    setAlertDays: companyAdminFeatureProcedure("alerts").input(z.object({ days: z.number().min(1).max(365) })).mutation(async ({ ctx, input }) => {
      const prev = await db.getSetting("alert_days_ahead", ctx.accountId, "30");
      await db.setSetting("alert_days_ahead", input.days.toString(), ctx.accountId);
      void auditFromCtx(ctx, { action: "settings_change", module: "settings", entityType: "setting", entityLabel: "alert_days_ahead", description: `Antecedência de alertas alterada: ${prev} → ${input.days} dias`, oldData: { alert_days_ahead: prev }, newData: { alert_days_ahead: String(input.days) } });
      return { success: true, days: input.days } as const;
    }),
  }),

  clients: router({
    list: commercialFeatureProcedure("clients").input(z.object({ city: z.string().optional() }).optional()).query(async ({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null);
      return db.getClients(input?.city, ctx.accountId, ownerUserId);
    }),
    page: commercialFeatureProcedure("clients").input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), city: z.string().optional(), search: z.string().optional() }).optional()).query(({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null);
      return db.getClientsPage(ctx.accountId, { ...(input || {}), ownerUserId });
    }),
    cities: commercialFeatureProcedure("clients").query(async ({ ctx }) => db.getDistinctCities(ctx.accountId)),
    byId: commercialFeatureProcedure("clients").input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      const ownerUserId = ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null);
      const client = await db.getClientById(input.id, ctx.accountId, ownerUserId);
      if (!client) return { client: null, extinguishers: [], orders: [] };
      return {
        client,
        extinguishers: await db.getExtinguishersByClient(input.id, ctx.accountId),
        orders: await db.getServiceOrders(input.id, ctx.accountId, ownerUserId),
      };
    }),
    create: commercialFeatureProcedure("clients").input(clientInput).mutation(async ({ ctx, input }) => {
      await planLimits.assertClientLimit(ctx.accountId);
      const id = await db.createClient({ ...input, accountId: ctx.accountId, createdByUserId: ctx.memberAccountId ?? null, cnpj: emptyToNull(input.cnpj), address: emptyToNull(input.address), cep: emptyToNull(input.cep), phone: emptyToNull(input.phone), contactName: emptyToNull(input.contactName), cpf: emptyToNull(input.cpf), birthDate: emptyToNull(input.birthDate), notes: emptyToNull(input.notes) } as any);
      void auditFromCtx(ctx, { action: "create", module: "clients", entityType: "client", entityId: id, entityLabel: input.companyName, description: `Cliente criado: ${input.companyName}`, newData: { ...input, id } });
      return { id };
    }),
    update: commercialFeatureProcedure("clients").input(clientInput.extend({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const ownerUserId = ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null);
      const before = await db.getClientById(id, ctx.accountId, ownerUserId);
      if (!before) throw new TRPCError({ code: "FORBIDDEN", message: "Cliente não encontrado ou sem permissão." });
      await db.updateClient(id, { ...data, cnpj: emptyToNull(data.cnpj), address: emptyToNull(data.address), cep: emptyToNull(data.cep), phone: emptyToNull(data.phone), contactName: emptyToNull(data.contactName), cpf: emptyToNull(data.cpf), birthDate: emptyToNull(data.birthDate), notes: emptyToNull(data.notes) }, ctx.accountId);
      const after = await db.getClientById(id, ctx.accountId, ownerUserId);
      const diff = diffAuditData(before, after);
      void auditFromCtx(ctx, { action: "update", module: "clients", entityType: "client", entityId: id, entityLabel: after?.companyName || before?.companyName || `#${id}`, description: `Cliente atualizado: ${after?.companyName || id}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true } as const;
    }),
    delete: companyAdminFeatureProcedure("clients").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const before = await db.getClientById(input.id, ctx.accountId);
      await db.deleteClient(input.id, ctx.accountId);
      void auditFromCtx(ctx, { action: "delete", module: "clients", entityType: "client", entityId: input.id, entityLabel: before?.companyName || `#${input.id}`, description: `Cliente excluído (lixeira): ${before?.companyName || input.id}`, oldData: before });
      return { success: true } as const;
    }),
  }),

  extinguishers: router({
    list: commercialFeatureProcedure("pointsOfSale").query(({ ctx }) => db.getExtinguishers(ctx.accountId)),
    page: commercialFeatureProcedure("pointsOfSale").input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), filter: z.enum(["all", "active", "near", "expired"]).optional() }).optional()).query(({ ctx, input }) => db.getExtinguishersPage(ctx.accountId, input)),
    listByClient: commercialFeatureProcedure("pointsOfSale").input(z.object({ clientId: z.number() })).query(async ({ ctx, input }) => db.getExtinguishersByClient(input.clientId, ctx.accountId)),
    alerts: commercialFeatureProcedure("alerts").input(z.object({ daysAhead: z.number().optional() }).optional()).query(async ({ ctx, input }) => { const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30; return db.getExpiringExtinguishers(days, ctx.accountId); }),
    alertsPage: commercialFeatureProcedure("alerts").input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), daysAhead: z.number().optional(), filter: z.enum(["all", "near", "expired"]).optional(), search: z.string().optional(), city: z.string().optional() }).optional()).query(async ({ ctx, input }) => { const days = input?.daysAhead || parseInt(await db.getSetting("alert_days_ahead", ctx.accountId, "30"), 10) || 30; return db.getExpiringExtinguishersPage(days, ctx.accountId, input); }),
    create: commercialFeatureProcedure("pointsOfSale").input(z.object({ clientId: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional(), stockQuantity: z.number().int().min(1).optional() })).mutation(async ({ ctx, input }) => {
      await planLimits.assertExtinguisherLimit(ctx.accountId);
      const id = await db.createExtinguisher({ ...input, accountId: ctx.accountId, expirationDate: input.expirationDate as any, lastInspectionDate: (input.lastInspectionDate || null) as any, capacity: emptyToNull(input.capacity), serialNumber: emptyToNull(input.serialNumber), locationInBuilding: emptyToNull(input.locationInBuilding), notes: emptyToNull(input.notes) }, ctx.accountId);
      const label = input.serialNumber || input.typeModel || `#${id}`;
      let publicToken: string | null = null;
      try {
        publicToken = await db.ensureExtinguisherPublicToken(id, ctx.accountId);
      } catch {
        publicToken = null;
      }
      void auditFromCtx(ctx, { action: "create", module: "extinguishers", entityType: "extinguisher", entityId: id, entityLabel: label, description: `Extintor criado: ${label}`, newData: { ...input, id, publicToken } });
      return { id, publicToken };
    }),
    /** Garante token QR e retorna URL pública (não regenera se já existir). */
    qrInfo: commercialFeatureProcedure("pointsOfSale").input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const token = await db.ensureExtinguisherPublicToken(input.id, ctx.accountId);
      return { publicToken: token, url: db.buildExtinguisherPublicUrl(token) };
    }),
    ensurePublicToken: commercialFeatureProcedure("pointsOfSale").input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const token = await db.ensureExtinguisherPublicToken(input.id, ctx.accountId);
      void auditFromCtx(ctx, {
        action: "update",
        module: "extinguishers",
        entityType: "extinguisher",
        entityId: input.id,
        entityLabel: `#${input.id}`,
        description: `QR Code garantido para extintor #${input.id}`,
        newData: { publicToken: token },
      });
      return { publicToken: token, url: db.buildExtinguisherPublicUrl(token) };
    }),
    backfillPublicTokens: companyAdminFeatureProcedure("pointsOfSale").mutation(async ({ ctx }) => {
      const result = await db.backfillExtinguisherPublicTokens(ctx.accountId);
      void auditFromCtx(ctx, {
        action: "update",
        module: "extinguishers",
        entityType: "extinguisher",
        entityId: null,
        description: `Backfill de QR Codes: ${result.updated} extintor(es)`,
        newData: result,
      });
      return result;
    }),
    update: commercialFeatureProcedure("pointsOfSale").input(z.object({ id: z.number(), typeModel: z.string().min(1), capacity: z.string().optional(), serialNumber: z.string().optional(), locationInBuilding: z.string().optional(), expirationDate: z.string(), lastInspectionDate: z.string().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const rowsBefore = await db.getExtinguishers(ctx.accountId);
      const before = (rowsBefore as any[]).find((e: any) => e.id === id) || null;
      await db.updateExtinguisher(id, { ...data, expirationDate: data.expirationDate as any, lastInspectionDate: (data.lastInspectionDate || null) as any }, ctx.accountId);
      const rowsAfter = await db.getExtinguishers(ctx.accountId);
      const after = (rowsAfter as any[]).find((e: any) => e.id === id) || null;
      const diff = diffAuditData(before, after);
      const label = after?.serialNumber || after?.typeModel || before?.serialNumber || `#${id}`;
      void auditFromCtx(ctx, { action: "update", module: "extinguishers", entityType: "extinguisher", entityId: id, entityLabel: label, description: `Extintor atualizado: ${label}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true } as const;
    }),
    delete: companyAdminFeatureProcedure("pointsOfSale").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const rows = await db.getExtinguishers(ctx.accountId);
      const before = (rows as any[]).find((e: any) => e.id === input.id) || null;
      await db.deleteExtinguisher(input.id, ctx.accountId);
      const label = before?.serialNumber || before?.typeModel || `#${input.id}`;
      void auditFromCtx(ctx, { action: "delete", module: "extinguishers", entityType: "extinguisher", entityId: input.id, entityLabel: label, description: `Extintor excluído (lixeira): ${label}`, oldData: before });
      return { success: true } as const;
    }),
  }),

  orders: router({
    list: commercialFeatureProcedure("serviceOrders").input(z.object({ clientId: z.number().optional() }).optional()).query(async ({ ctx, input }) => db.getServiceOrders(input?.clientId, ctx.accountId, ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null))),
    page: commercialFeatureProcedure("serviceOrders").input(z.object({ page: z.number().int().positive().optional(), pageSize: z.number().int().positive().max(100).optional(), clientId: z.number().int().positive().optional(), search: z.string().optional(), city: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional()).query(({ ctx, input }) => db.getServiceOrdersPage(ctx.accountId, { ...(input || {}), ownerUserId: ctx.user?.role === "company_admin" ? null : (ctx.memberAccountId ?? null) })),
    history: commercialFeatureProcedure("serviceOrders").input(z.object({ clientId: z.number() })).query(async ({ ctx, input }) => db.getServiceOrderHistory(input.clientId, ctx.accountId)),
    nextNumber: commercialFeatureProcedure("serviceOrders").query(async ({ ctx }) => db.getNextOrderNumber(ctx.accountId)),
    byId: commercialFeatureProcedure("serviceOrders").input(z.object({ id: z.number() })).query(async ({ ctx, input }) => db.getServiceOrderById(input.id, ctx.accountId)),
    create: commercialFeatureProcedure("serviceOrders").input(z.object({ orderNumber: z.number().optional(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string().default("SIM"), leftReserve: z.string().default("NÃO"), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string().default("0.00"), paymentMethod: z.string().default("A VISTA"), installmentsCount: z.number().default(1), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string(), extinguisherId: z.number().optional() })) })).mutation(async ({ ctx, input }) => {
      await planLimits.assertServiceOrderFeature(ctx.accountId);
      const { items, ...orderData } = input;
      const created = await db.createServiceOrder({ ...orderData, accountId: ctx.accountId, createdByName: ctx.user.name || ctx.user.email || "Usuário não identificado", createdByUserId: ctx.memberAccountId ?? null } as any, items as any, ctx.accountId);
      const orderId = typeof created === "object" && created !== null ? Number((created as any).id ?? created) : Number(created);
      void auditFromCtx(ctx, { action: "create", module: "orders", entityType: "order", entityId: orderId || null, entityLabel: "OS", description: "Ordem de serviço criada", newData: { ...orderData, items } });
      return created;
    }),
    update: commercialFeatureProcedure("serviceOrders").input(z.object({ id: z.number(), orderDate: z.string(), clientId: z.number(), replacedAndDelivered: z.string(), leftReserve: z.string(), reserveDetails: z.string().optional(), extinguisherExpiration: z.string().optional(), licenseExpiration: z.string().optional(), totalAmount: z.string(), paymentMethod: z.string(), installmentsCount: z.number(), installmentDates: z.string().optional(), responsibleName: z.string().optional(), responsibleCpf: z.string().optional(), responsibleBirthDate: z.string().optional(), observations: z.string().optional(), items: z.array(z.object({ description: z.string().min(1), quantity: z.number().min(1), unitPrice: z.string(), totalPrice: z.string(), extinguisherId: z.number().optional() })) })).mutation(async ({ ctx, input }) => {
      const { id, items, ...orderData } = input;
      const before = await db.getServiceOrderById(id, ctx.accountId);
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Ordem não encontrada." });
      if (ctx.user?.role !== "company_admin" && before.createdByUserId != null && before.createdByUserId !== ctx.memberAccountId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Você só pode editar ordens que você criou." });
      }
      await db.updateServiceOrder(id, { ...orderData, accountId: ctx.accountId } as any, items as any, ctx.accountId);
      const after = await db.getServiceOrderById(id, ctx.accountId);
      const diff = diffAuditData(before, after);
      void auditFromCtx(ctx, { action: "update", module: "orders", entityType: "order", entityId: id, entityLabel: `OS #${(after as any)?.orderNumber || (before as any)?.orderNumber || id}`, description: `Ordem de serviço atualizada #${(after as any)?.orderNumber || id}`, oldData: diff.oldData, newData: diff.newData });
      return { success: true } as const;
    }),
    delete: commercialFeatureProcedure("serviceOrders").input(z.object({ id: z.number() })).mutation(async ({ ctx, input }) => {
      const before = await db.getServiceOrderById(input.id, ctx.accountId);
      await db.deleteServiceOrder(input.id, ctx.accountId);
      void auditFromCtx(ctx, { action: "delete", module: "orders", entityType: "order", entityId: input.id, entityLabel: `OS #${(before as any)?.orderNumber || input.id}`, description: `Ordem de serviço excluída (lixeira) #${(before as any)?.orderNumber || input.id}`, oldData: before });
      return { success: true } as const;
    }),
  }),

  trash: router({
    list: companyAdminProcedure.query(({ ctx }) => db.listTrash(ctx.accountId)),
    restore: companyAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await db.restoreTrashItem(input.id, ctx.accountId); return { success: true } as const; }),
    permanentlyDelete: companyAdminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await db.permanentlyDeleteTrashItem(input.id, ctx.accountId); return { success: true } as const; }),
  }),
  /** Planos públicos (sem login) — página de preços e cadastro. */
  publicCatalog: router({
    plans: publicProcedure.query(async () => {
      await db.ensureSeedPlans();
      return db.listAvailablePlansForCompanies();
    }),
  }),

  /**
   * Consulta pública por QR Code — sem login.
   * Dados mínimos do equipamento; isolamento por token opaco (não enumerável).
   */
  publicExtinguisher: router({
    byToken: publicProcedure.input(z.object({ token: z.string().min(10).max(32) })).query(async ({ ctx, input }) => {
      const data = await db.getPublicExtinguisherByToken(input.token);
      if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Extintor não encontrado." });
      const { _internalId, _accountId, ...publicFields } = data;
      // Se o visitante estiver logado na mesma empresa, sinaliza acesso interno
      const sameCompany =
        Boolean(ctx.accountId) &&
        Number(ctx.accountId) === Number(_accountId) &&
        ctx.user &&
        ctx.user.role !== "platform_admin";
      return {
        ...publicFields,
        canManage: sameCompany,
        extinguisherId: sameCompany ? _internalId : undefined,
      };
    }),
  }),

    /** Planos e assinatura da empresa (acesso mesmo com bloqueio para regularização). */
  billing: router({
    access: companyBillingProcedure.query(async ({ ctx }) => checkSubscriptionAccess(ctx.accountId)),
    plans: companyBillingProcedure.query(async () => {
      await db.ensureSeedPlans();
      // Upgrade: lista planos ativos (inclui o atual, mesmo se não estiver "availableForNew")
      const all = await db.listSubscriptionPlans();
      return all.filter((p: any) => p.active !== false);
    }),
    mySubscription: companyBillingProcedure.query(async ({ ctx }) => {
      const resolved = await db.resolveCompanyPlan(ctx.accountId);
      const effective = await planLimits.getEffectivePlan(ctx.accountId);
      // Garante módulos/limites efetivos (inclui fallback quando não há planId)
      const plan = resolved.plan
        ? { ...resolved.plan, ...effective, id: effective.id ?? (resolved.plan as any).id, name: effective.name }
        : effective;
      return { ...resolved, plan, effective };
    }),
    payments: companyBillingProcedure.query(async ({ ctx }) => db.listPaymentsForCompany(ctx.accountId)),
    mockCheckout: companyAdminProcedure.input(z.object({
      planId: z.number().int().positive(),
      outcome: z.enum(["approved", "pending", "overdue", "canceled"]).default("approved"),
    })).mutation(async ({ ctx, input }) => {
      const result = await db.applyMockCheckout({ companyId: ctx.accountId, planId: input.planId, outcome: input.outcome });
      if (input.outcome === "approved" && ctx.user.email) {
        void (async () => {
          try {
            const plans = await db.listSubscriptionPlans();
            const plan = plans.find((p: any) => p.id === input.planId);
            const company = await db.getCompanyById(ctx.accountId);
            const companyName = company?.name || `Empresa #${ctx.accountId}`;
            const planName = plan?.name || `Plano #${input.planId}`;
            const amount = plan?.price != null ? String(plan.price) : null;
            await emailService.emailPlanChanged({
              to: ctx.user.email!,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              companyName,
              planName,
              status: "active",
              amount,
              periodEnd: (result as any)?.periodEnd || null,
              isUpgrade: true,
            });
            await emailService.emailAdminPlanChanged({
              companyName,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              email: ctx.user.email!,
              planName,
              status: "active",
              amount,
              isUpgrade: true,
            });
          } catch (err) {
            console.warn("[email] upgrade notify failed", err);
          }
        })();
      }
      return result;
    }),
    mockCheckoutOpen: companyBillingProcedure.input(z.object({
      planId: z.number().int().positive(),
      outcome: z.enum(["approved", "pending", "overdue", "canceled"]).default("approved"),
    })).mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "company_admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode assinar." });
      }
      const result = await db.applyMockCheckout({ companyId: ctx.accountId, planId: input.planId, outcome: input.outcome });
      if (input.outcome === "approved" && ctx.user.email) {
        void (async () => {
          try {
            const plans = await db.listSubscriptionPlans();
            const plan = plans.find((p: any) => p.id === input.planId);
            const planName = plan?.name || `Plano #${input.planId}`;
            const amount = plan?.price != null ? String(plan.price) : null;
            const companyName = `Empresa #${ctx.accountId}`;
            await emailService.emailPlanChanged({
              to: ctx.user.email!,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              companyName,
              planName,
              status: "active",
              amount,
              isUpgrade: true,
            });
            await emailService.emailAdminPlanChanged({
              companyName,
              userName: ctx.user.name || ctx.user.email || "Cliente",
              email: ctx.user.email!,
              planName,
              status: "active",
              amount,
              isUpgrade: true,
            });
          } catch (err) {
            console.warn("[email] upgrade open notify failed", err);
          }
        })();
      }
      return result;
    }),
  }),


  products: router({
    list: companyBillingProcedure.input(z.object({ search: z.string().optional(), expiry: z.enum(["all", "expired", "near"]).optional() }).optional()).query(({ ctx, input }) => db.listInventoryProducts(ctx.accountId, input?.search, input?.expiry)),
    create: companyBillingProcedure.input(z.object({ productCode: z.string().trim().min(1).max(64), description: z.string().trim().min(1).max(500), quantity: z.number().int().min(0).max(2147483647), expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/) })).mutation(async ({ ctx, input }) => {
      const product = await db.createInventoryProduct({ ...input, companyId: ctx.accountId, createdByMemberId: ctx.memberAccountId ?? null, expirationDate: input.expirationDate as any, price: input.price });
      void auditFromCtx(ctx, { action: "create", module: "products", entityType: "product", entityId: product?.id, entityLabel: input.description, description: `Cadastrou produto: ${input.description}`, newData: input });
      return product;
    }),
    update: companyBillingProcedure.input(z.object({ id: z.number().int().positive(), productCode: z.string().trim().min(1).max(64), description: z.string().trim().min(1).max(500), quantity: z.number().int().min(0).max(2147483647), expirationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), price: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/) })).mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const before = (await db.listInventoryProducts(ctx.accountId)).find((row: any) => row.id === id);
      const product = await db.updateInventoryProduct(ctx.accountId, id, { ...data, expirationDate: data.expirationDate as any });
      if (product) void auditFromCtx(ctx, { action: "update", module: "products", entityType: "product", entityId: id, entityLabel: product.description, description: `Alterou produto: ${product.description}`, oldData: before, newData: product });
      return product;
    }),
    delete: companyBillingProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const before = (await db.listInventoryProducts(ctx.accountId)).find((row: any) => row.id === input.id);
      const result = await db.deleteInventoryProduct(ctx.accountId, input.id);
      if (before) void auditFromCtx(ctx, { action: "delete", module: "products", entityType: "product", entityId: input.id, entityLabel: before.description, description: `Enviou produto à lixeira: ${before.description}`, oldData: before });
      return result;
    }),
    deleteMany: companyBillingProcedure.input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
      const result = await db.deleteInventoryProducts(ctx.accountId, input.ids);
      void auditFromCtx(ctx, { action: "delete", module: "products", entityType: "product_bulk", entityLabel: `${result.deleted} produtos`, description: `Enviou ${result.deleted} produto(s) à lixeira`, newData: { productIds: input.ids, count: result.deleted } });
      return result;
    }),
  }),
  operations: router({
    promoters: router({
      list: commercialFeatureProcedure("fieldOperations").query(async ({ ctx }) => {
        if (ctx.user.role === "promoter") throw new TRPCError({ code: "FORBIDDEN", message: "Promotores não podem consultar a lista da equipe." });
        return (await memberAuth.listMemberAccounts(ctx.accountId))
          .filter((member) => member.role === "promoter" && member.active)
          .map(({ id, userName, role, active }) => ({ id, userName, role, active }));
      }),
    }),
    stores: router({
      list: commercialFeatureProcedure("fieldOperations").input(z.object({ search: z.string().optional() }).optional()).query(({ ctx, input }) => db.listOperationalStores(ctx.accountId, input?.search)),
      create: commercialFeatureProcedure("fieldOperations").input(z.object({ name: z.string().min(2), city: z.string().min(2), address: z.string().optional(), state: z.string().length(2).optional(), cep: z.string().optional(), code: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError({ code: "FORBIDDEN", message: "Promotores não podem cadastrar lojas." });
        return db.createOperationalStore({ ...input, companyId: ctx.accountId, active: true });
      }),
    }),
    routes: router({
      list: commercialFeatureProcedure("fieldOperations").input(z.object({ date: z.string().optional(), promoterId: z.number().int().positive().optional() }).optional()).query(async ({ ctx, input }) => {
        const date = input?.date || new Date().toISOString().slice(0, 10);
        if (ctx.user.role === "promoter") await db.materializeWeeklyRoutes(ctx.accountId, ctx.memberAccountId!, date);
        return db.listOperationalRoutes(ctx.accountId, { date: input?.date, promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : input?.promoterId });
      }),
      weekly: commercialFeatureProcedure("fieldOperations").query(({ ctx }) => db.listWeeklyRouteSchedules(ctx.accountId)),
      saveWeekly: companyAdminProcedure.input(z.object({ name: z.string().min(2).max(255), weekday: z.number().int().min(0).max(6), promoterId: z.number().int().positive(), storeIds: z.array(z.number().int().positive()).min(1) })).mutation(async ({ ctx, input }) => {
        const members = await memberAuth.listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        return db.saveWeeklyRouteSchedule({ ...input, companyId: ctx.accountId });
      }),
      create: commercialFeatureProcedure("fieldOperations").input(z.object({ name: z.string().min(2), date: z.string().min(8), promoterId: z.number().int().positive(), storeIds: z.array(z.number().int().positive()).min(1), teamId: z.number().int().positive().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
        if (ctx.user.role === "promoter") throw new TRPCError({ code: "FORBIDDEN", message: "Promotores não podem criar roteiros." });
        const members = await memberAuth.listMemberAccounts(ctx.accountId);
        const promoter = members.find((member) => member.id === input.promoterId && member.role === "promoter" && member.active);
        if (!promoter) throw new TRPCError({ code: "BAD_REQUEST", message: "Selecione um promotor ativo da sua empresa." });
        const { storeIds, ...route } = input;
        return db.createOperationalRouteWithVisits({ route: { ...route, date: new Date(`${input.date}T00:00:00.000Z`), companyId: ctx.accountId, status: "assigned" }, storeIds });
      }),
    }),
    visits: router({
      today: commercialFeatureProcedure("fieldOperations").input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).optional()).query(async ({ ctx, input }) => {
        const date = input?.date || new Date().toISOString().slice(0, 10);
        const promoterId = ctx.user.role === "promoter" ? ctx.memberAccountId : undefined;
        if (promoterId) await db.materializeWeeklyRoutes(ctx.accountId, promoterId, date);
        return db.listOperationalVisits(ctx.accountId, { date, promoterId: promoterId ?? undefined });
      }),
      list: commercialFeatureProcedure("fieldOperations").input(z.object({ date: z.string().optional(), routeId: z.number().int().positive().optional(), promoterId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => db.listOperationalVisits(ctx.accountId, { date: input?.date, routeId: input?.routeId, promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : input?.promoterId })),
      start: commercialFeatureProcedure("fieldOperations").input(z.object({ id: z.number().int().positive(), latitude: z.number().optional(), longitude: z.number().optional(), accuracy: z.number().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await db.listOperationalVisits(ctx.accountId, { promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : undefined });
        const owned = visit.find((row) => row.visit.id === input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Visita não encontrada para esta empresa." });
        if (ctx.user.role === "promoter" && owned.visit.promoterId !== ctx.memberAccountId) throw new TRPCError({ code: "FORBIDDEN", message: "Visita não pertence ao promotor autenticado." });
        return db.updateOperationalVisit(ctx.accountId, input.id, { status: "in_progress", actualStart: new Date(), startLatitude: input.latitude, startLongitude: input.longitude, startAccuracy: input.accuracy });
      }),
      complete: commercialFeatureProcedure("fieldOperations").input(z.object({ id: z.number().int().positive(), latitude: z.number().optional(), longitude: z.number().optional(), accuracy: z.number().optional(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
        const visit = await db.listOperationalVisits(ctx.accountId, { promoterId: ctx.user.role === "promoter" ? ctx.memberAccountId : undefined });
        const owned = visit.find((row) => row.visit.id === input.id);
        if (!owned) throw new TRPCError({ code: "NOT_FOUND", message: "Visita não encontrada para esta empresa." });
        return db.updateOperationalVisit(ctx.accountId, input.id, { status: "completed", actualEnd: new Date(), endLatitude: input.latitude, endLongitude: input.longitude, endAccuracy: input.accuracy, notes: input.notes });
      }),
    }),
  }),

  audit: router({
    promoters: companyAdminFeatureProcedure("reports").query(async ({ ctx }) =>
      (await memberAuth.listMemberAccounts(ctx.accountId))
        .filter((member) => member.role === "promoter")
        .map(({ id, userName, email, active }) => ({ id, userName, email, active })),
    ),
    reverseGeocodePoint: companyAdminFeatureProcedure("reports")
      .input(z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }))
      .mutation(({ input }) => reverseGeocodeAddress(input.latitude, input.longitude)),
    promoterActivity: companyAdminFeatureProcedure("reports")
      .input(z.object({
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        promoterId: z.number().int().positive().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .query(({ ctx, input }) => listPromoterActivities({
        companyId: ctx.accountId,
        page: input?.page,
        pageSize: input?.pageSize,
        from: input?.from,
        to: input?.to,
        promoterId: input?.promoterId,
        category: input?.category,
        search: input?.search,
      })),
    promoterActivityExportCsv: companyAdminFeatureProcedure("reports")
      .input(z.object({
        from: z.string().optional(),
        to: z.string().optional(),
        promoterId: z.number().int().positive().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const result = await listPromoterActivities({ companyId: ctx.accountId, page: 1, pageSize: 10_000, ...input });
        const headers = ["Data/hora", "Promotor", "E-mail", "Atividade", "Área", "Registro", "Descrição", "Detalhes"];
        const values = result.items.map((row: any) => [row.occurredAt, row.userName, row.userEmail, row.action, row.module, row.entityLabel, row.description, typeof row.details === "string" ? row.details : JSON.stringify(row.details ?? {})]);
        const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
        const csv = `\uFEFF${[headers, ...values].map((line) => line.map(cell).join(";")).join("\r\n")}`;
        return { csv, contentType: "text/csv; charset=utf-8", filename: `atividades-promotores-${ctx.accountId}.csv` } as const;
      }),
    list: companyAdminFeatureProcedure("reports")
      .input(z.object({
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        userId: z.number().int().positive().optional(),
        module: z.string().optional(),
        action: z.string().optional(),
        entityType: z.string().optional(),
        entityId: z.number().int().positive().optional(),
        search: z.string().optional(),
      }).optional())
      .query(async ({ ctx, input }) => {
        return listAuditLogs({
          companyId: ctx.accountId,
          enforceTenant: true,
          page: input?.page,
          pageSize: input?.pageSize,
          from: input?.from,
          to: input?.to,
          userId: input?.userId,
          module: input?.module,
          action: input?.action,
          entityType: input?.entityType,
          entityId: input?.entityId,
          search: input?.search,
        });
      }),
    byId: companyAdminFeatureProcedure("reports")
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const row = await getAuditLogById(input.id, ctx.accountId);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Registro de auditoria não encontrado." });
        return row;
      }),
    entityHistory: commercialFeatureProcedure("reports")
      .input(z.object({
        entityType: z.string().min(1),
        entityId: z.number().int().positive(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
      }))
      .query(async ({ ctx, input }) => listEntityAuditHistory({
        companyId: ctx.accountId, entityType: input.entityType, entityId: input.entityId,
        page: input.page, pageSize: input.pageSize,
      })),
    exportCsv: companyAdminFeatureProcedure("reports")
      .input(z.object({
        from: z.string().optional(), to: z.string().optional(),
        userId: z.number().int().positive().optional(),
        module: z.string().optional(), action: z.string().optional(),
        entityType: z.string().optional(), entityId: z.number().int().positive().optional(),
        search: z.string().optional(),
      }).optional())
      .mutation(async ({ ctx, input }) => {
        const csv = await exportAuditLogsCsv({
          companyId: ctx.accountId, enforceTenant: true,
          from: input?.from, to: input?.to, userId: input?.userId,
          module: input?.module, action: input?.action,
          entityType: input?.entityType, entityId: input?.entityId, search: input?.search,
        });
        return { csv, contentType: "text/csv; charset=utf-8", filename: `auditoria-${ctx.accountId}.csv` } as const;
      }),
    platformList: platformProcedure
      .input(z.object({
        companyId: z.number().int().positive().optional(),
        page: z.number().int().positive().optional(),
        pageSize: z.number().int().positive().max(100).optional(),
        from: z.string().optional(), to: z.string().optional(),
        module: z.string().optional(), action: z.string().optional(), search: z.string().optional(),
      }).optional())
      .query(async ({ input }) => listAuditLogs({
        companyId: input?.companyId, page: input?.page, pageSize: input?.pageSize,
        from: input?.from, to: input?.to, module: input?.module, action: input?.action, search: input?.search,
      })),
  }),

  platformPayments: router({
    list: platformProcedure.query(() => db.listAllPayments()),
  }),
});

export type AppRouter = typeof appRouter;
