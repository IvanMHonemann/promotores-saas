import { z } from "zod";
import { companyManagerProcedure, platformProcedure, protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { auditFromCtx } from "../audit";
import { ANNOUNCEMENT_ROLES, ANNOUNCEMENT_TONES, COMPANY_ANNOUNCEMENT_ROLES, canManageCompanyAnnouncement } from "@shared/platformAnnouncements";
import * as announcements from "../platformAnnouncements";

const id = z.number().int().positive();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const payload = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  tone: z.enum(ANNOUNCEMENT_TONES),
  buttonLabel: z.string().max(80).nullable().optional(),
  buttonUrl: z.string().max(500).nullable().optional(),
  audienceScope: z.enum(["all", "selected"]),
  companyIds: z.array(id).max(500).optional(),
  roles: z.array(z.enum(ANNOUNCEMENT_ROLES)).min(1),
  startsAt: dateStr,
  endsAt: dateStr,
  dismissable: z.boolean(),
  active: z.boolean().optional(),
});

const companyPayload = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  tone: z.enum(ANNOUNCEMENT_TONES),
  buttonLabel: z.string().max(80).nullable().optional(),
  buttonUrl: z.string().max(500).nullable().optional(),
  targetMode: z.enum(["roles", "members"]),
  roles: z.array(z.enum(COMPANY_ANNOUNCEMENT_ROLES)).optional(),
  memberIds: z.array(id).max(500).optional(),
  startsAt: dateStr,
  endsAt: dateStr,
  dismissable: z.boolean(),
  active: z.boolean().optional(),
});

function companyActor(ctx: { accountId?: number | null; memberAccountId?: number | null; user?: { role?: string | null } }) {
  return {
    companyId: Number(ctx.accountId),
    role: String(ctx.user?.role || ""),
    memberAccountId: ctx.memberAccountId ?? null,
  };
}

function rethrowAnnouncement(error: unknown): never {
  const message = error instanceof Error ? error.message : "Não foi possível salvar o aviso.";
  if (/permissão/i.test(message)) throw new TRPCError({ code: "FORBIDDEN", message });
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const announcementsRouter = router({
  list: platformProcedure.query(() => announcements.listAnnouncements()),
  get: platformProcedure.input(z.object({ id })).query(({ input }) => announcements.getAnnouncement(input.id)),
  create: platformProcedure.input(payload).mutation(async ({ ctx, input }) => {
    const item = await announcements.createAnnouncement(input, ctx.platformAdminId ?? null);
    void auditFromCtx(ctx, {
      action: "create",
      module: "platform",
      entityType: "announcement",
      entityId: item.id,
      entityLabel: item.title,
      description: `Criou o aviso "${item.title}"`,
      newData: { id: item.id, roles: item.roles, audienceScope: item.audienceScope, companyIds: item.companyIds },
      companyId: null,
    } as any);
    return item;
  }),
  update: platformProcedure.input(payload.extend({ id })).mutation(async ({ ctx, input }) => {
    const { id: announcementId, ...data } = input;
    const item = await announcements.updateAnnouncement(announcementId, data, ctx.platformAdminId ?? null);
    void auditFromCtx(ctx, {
      action: "update",
      module: "platform",
      entityType: "announcement",
      entityId: item.id,
      entityLabel: item.title,
      description: `Atualizou o aviso "${item.title}"`,
      newData: { id: item.id, roles: item.roles, audienceScope: item.audienceScope, companyIds: item.companyIds },
      companyId: null,
    } as any);
    return item;
  }),
  setActive: platformProcedure.input(z.object({ id, active: z.boolean() })).mutation(async ({ ctx, input }) => {
    const item = await announcements.setAnnouncementActive(input.id, input.active, ctx.platformAdminId ?? null);
    void auditFromCtx(ctx, {
      action: "update",
      module: "platform",
      entityType: "announcement",
      entityId: item.id,
      entityLabel: item.title,
      description: `${input.active ? "Ativou" : "Pausou"} o aviso "${item.title}"`,
      companyId: null,
    } as any);
    return item;
  }),
  delete: platformProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    const current = await announcements.getAnnouncement(input.id);
    if (!current) throw new TRPCError({ code: "BAD_REQUEST", message: "Aviso não encontrado." });
    await announcements.deleteAnnouncement(input.id);
    void auditFromCtx(ctx, {
      action: "delete",
      module: "platform",
      entityType: "announcement",
      entityId: current.id,
      entityLabel: current.title,
      description: `Excluiu o aviso "${current.title}"`,
      companyId: null,
    } as any);
    return { success: true as const };
  }),

  company: router({
    list: companyManagerProcedure.query(async ({ ctx }) => {
      const actor = companyActor(ctx);
      const rows = await announcements.listCompanyAnnouncements(actor.companyId);
      return rows.map((item) => ({ ...item, canManage: canManageCompanyAnnouncement(actor, item as any) }));
    }),
    recipients: companyManagerProcedure.query(({ ctx }) => announcements.listCompanyAnnouncementRecipients(Number(ctx.accountId))),
    create: companyManagerProcedure.input(companyPayload).mutation(async ({ ctx, input }) => {
      try {
        const item = await announcements.createCompanyAnnouncement(companyActor(ctx), input);
        void auditFromCtx(ctx, {
          action: "create",
          module: "announcements",
          entityType: "announcement",
          entityId: item!.id,
          entityLabel: item!.title,
          description: `Criou o aviso da empresa "${item!.title}"`,
          newData: { id: item!.id, targetMode: (item as any).targetMode, roles: item!.roles, memberIds: (item as any).memberIds },
          companyId: ctx.accountId,
        } as any);
        return item;
      } catch (error) {
        rethrowAnnouncement(error);
      }
    }),
    update: companyManagerProcedure.input(companyPayload.extend({ id })).mutation(async ({ ctx, input }) => {
      try {
        const { id: announcementId, ...data } = input;
        const item = await announcements.updateCompanyAnnouncement(announcementId, companyActor(ctx), data);
        void auditFromCtx(ctx, {
          action: "update",
          module: "announcements",
          entityType: "announcement",
          entityId: item!.id,
          entityLabel: item!.title,
          description: `Atualizou o aviso da empresa "${item!.title}"`,
          newData: { id: item!.id, targetMode: (item as any).targetMode, roles: item!.roles, memberIds: (item as any).memberIds },
          companyId: ctx.accountId,
        } as any);
        return item;
      } catch (error) {
        rethrowAnnouncement(error);
      }
    }),
    setActive: companyManagerProcedure.input(z.object({ id, active: z.boolean() })).mutation(async ({ ctx, input }) => {
      try {
        const item = await announcements.setCompanyAnnouncementActive(input.id, companyActor(ctx), input.active);
        void auditFromCtx(ctx, {
          action: "update",
          module: "announcements",
          entityType: "announcement",
          entityId: item!.id,
          entityLabel: item!.title,
          description: `${input.active ? "Ativou" : "Pausou"} o aviso da empresa "${item!.title}"`,
          companyId: ctx.accountId,
        } as any);
        return item;
      } catch (error) {
        rethrowAnnouncement(error);
      }
    }),
    delete: companyManagerProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
      try {
        const current = await announcements.deleteCompanyAnnouncement(input.id, companyActor(ctx));
        void auditFromCtx(ctx, {
          action: "delete",
          module: "announcements",
          entityType: "announcement",
          entityId: current.id,
          entityLabel: current.title,
          description: `Excluiu o aviso da empresa "${current.title}"`,
          companyId: ctx.accountId,
        } as any);
        return { success: true as const };
      } catch (error) {
        rethrowAnnouncement(error);
      }
    }),
  }),
  mine: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user.role === "platform_admin" && !ctx.actingAsPlatform) return [];
    if (!ctx.accountId || !["company_admin", "supervisor", "promoter"].includes(String(ctx.user.role))) return [];
    return announcements.listVisibleAnnouncementsFor({
      companyId: ctx.accountId,
      role: String(ctx.user.role),
      memberAccountId: ctx.memberAccountId ?? null,
    });
  }),
  dismiss: protectedProcedure.input(z.object({ id })).mutation(async ({ ctx, input }) => {
    if (!ctx.accountId || !ctx.memberAccountId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Não foi possível dispensar este aviso." });
    }
    if (!["company_admin", "supervisor", "promoter"].includes(String(ctx.user.role))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Não foi possível dispensar este aviso." });
    }
    return announcements.dismissAnnouncement({
      announcementId: input.id,
      companyId: ctx.accountId,
      role: String(ctx.user.role),
      memberAccountId: ctx.memberAccountId,
    });
  }),
});
