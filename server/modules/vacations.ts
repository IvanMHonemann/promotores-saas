import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte, ne, inArray } from "drizzle-orm";
import { z } from "zod";
import { vacationSchedules, memberAccounts } from "../../drizzle/schema";
import { commercialFeatureProcedure, protectedProcedure, router } from "../_core/trpc";
import * as db from "../db";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function asDateStr(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

/**
 * As colunas `date` do schema são tipadas como Date, mas o MySQL aceita a data
 * no formato "AAAA-MM-DD" e o código sempre enviou texto. Este helper só ajusta
 * o tipo para o TypeScript; o valor enviado ao banco continua exatamente igual.
 */
function dbDate(value: string): Date {
  return value as unknown as Date;
}

let tableReady: Promise<void> | null = null;

export async function ensureVacationSchedulesTable(): Promise<void> {
  if (tableReady) return tableReady;
  tableReady = (async () => {
    const database = await db.getDb();
    if (!database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS vacation_schedules (
      id int AUTO_INCREMENT PRIMARY KEY,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      startDate date NOT NULL,
      endDate date NOT NULL,
      days int NOT NULL,
      status enum('scheduled','cancelled') NOT NULL DEFAULT 'scheduled',
      notes text,
      createdByMemberAccountId int NOT NULL,
      updatedByMemberAccountId int,
      cancelledByMemberAccountId int,
      cancelledAt timestamp NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY vacation_schedules_company_member_idx (companyId, memberAccountId),
      KEY vacation_schedules_company_dates_idx (companyId, startDate, endDate),
      KEY vacation_schedules_status_idx (status)
    )`);
  })().catch((e) => { tableReady = null; throw e; });
  return tableReady;
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (e < s) throw new TRPCError({ code: "BAD_REQUEST", message: "Data final não pode ser anterior à inicial." });
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

function assertManager(ctx: any) {
  if (ctx.user?.role === "promoter") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Apenas administradores e supervisores podem gerenciar férias." });
  }
}

async function assertNoOverlap(tx: any, companyId: number, memberAccountId: number, startDate: string, endDate: string, excludeId?: number) {
  const conditions = [
    eq(vacationSchedules.companyId, companyId),
    eq(vacationSchedules.memberAccountId, memberAccountId),
    eq(vacationSchedules.status, "scheduled"),
    and(lte(vacationSchedules.startDate, dbDate(endDate)), gte(vacationSchedules.endDate, dbDate(startDate))),
  ];
  if (excludeId) conditions.push(ne(vacationSchedules.id, excludeId));
  const existing = await tx.select({ id: vacationSchedules.id }).from(vacationSchedules).where(and(...conditions)).limit(1);
  if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "Já existe férias sobrepostas para este funcionário no período informado." });
}

async function teamOverlapWarning(database: any, companyId: number, memberAccountId: number, startDate: string, endDate: string): Promise<string | null> {
  const [me] = await database.select({ supervisorId: memberAccounts.supervisorId }).from(memberAccounts).where(eq(memberAccounts.id, memberAccountId)).limit(1);
  if (!me?.supervisorId) return null;
  const teammates = await database
    .select({ id: memberAccounts.id, userName: memberAccounts.userName })
    .from(memberAccounts)
    .where(and(eq(memberAccounts.companyId, companyId), eq(memberAccounts.supervisorId, me.supervisorId), ne(memberAccounts.id, memberAccountId), eq(memberAccounts.active, true)));
  if (!teammates.length) return null;
  const ids = teammates.map((t: { id: number }) => t.id);
  const overlaps = await database
    .select({ memberAccountId: vacationSchedules.memberAccountId })
    .from(vacationSchedules)
    .where(and(
      eq(vacationSchedules.companyId, companyId),
      eq(vacationSchedules.status, "scheduled"),
      inArray(vacationSchedules.memberAccountId, ids),
      and(lte(vacationSchedules.startDate, dbDate(endDate)), gte(vacationSchedules.endDate, dbDate(startDate))),
    ));
  if (!overlaps.length) return null;
  const names = teammates
    .filter((t: { id: number }) => overlaps.some((o: { memberAccountId: number }) => o.memberAccountId === t.id))
    .map((t: { userName: string }) => t.userName);
  return names.length ? `Atenção: ${names.join(", ")} da mesma equipe também estarão de férias neste período.` : null;
}

export const vacationsRouter = router({
  members: commercialFeatureProcedure("timeTracking").query(async ({ ctx }) => {
    assertManager(ctx);
    const database = await requireDb();
    return database
      .select({ id: memberAccounts.id, userName: memberAccounts.userName })
      .from(memberAccounts)
      .where(and(eq(memberAccounts.companyId, ctx.accountId), eq(memberAccounts.active, true)))
      .orderBy(memberAccounts.userName);
  }),

  list: commercialFeatureProcedure("timeTracking")
    .input(z.object({
      memberAccountId: z.number().int().positive().optional(),
      from: dateStr.optional(),
      to: dateStr.optional(),
      status: z.enum(["scheduled", "cancelled", "all"]).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      assertManager(ctx);
      await ensureVacationSchedulesTable();
      const database = await requireDb();
      const conds = [eq(vacationSchedules.companyId, ctx.accountId)];
      if (input?.memberAccountId) conds.push(eq(vacationSchedules.memberAccountId, input.memberAccountId));
      if (input?.status && input.status !== "all") conds.push(eq(vacationSchedules.status, input.status));
      if (input?.from) conds.push(gte(vacationSchedules.endDate, dbDate(input.from)));
      if (input?.to) conds.push(lte(vacationSchedules.startDate, dbDate(input.to)));
      const rows = await database
        .select({
          id: vacationSchedules.id,
          memberAccountId: vacationSchedules.memberAccountId,
          startDate: vacationSchedules.startDate,
          endDate: vacationSchedules.endDate,
          days: vacationSchedules.days,
          status: vacationSchedules.status,
          notes: vacationSchedules.notes,
          createdAt: vacationSchedules.createdAt,
          cancelledAt: vacationSchedules.cancelledAt,
          createdByMemberAccountId: vacationSchedules.createdByMemberAccountId,
          updatedByMemberAccountId: vacationSchedules.updatedByMemberAccountId,
          cancelledByMemberAccountId: vacationSchedules.cancelledByMemberAccountId,
          memberName: memberAccounts.userName,
        })
        .from(vacationSchedules)
        .innerJoin(memberAccounts, eq(memberAccounts.id, vacationSchedules.memberAccountId))
        .where(and(...conds))
        .orderBy(vacationSchedules.startDate);
      return rows.map((row) => ({ ...row, startDate: asDateStr(row.startDate), endDate: asDateStr(row.endDate) }));
    }),

  mine: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.memberAccountId || !ctx.accountId) throw new TRPCError({ code: "FORBIDDEN" });
    await ensureVacationSchedulesTable();
    const database = await requireDb();
    const rows = await database
      .select()
      .from(vacationSchedules)
      .where(and(eq(vacationSchedules.companyId, ctx.accountId), eq(vacationSchedules.memberAccountId, ctx.memberAccountId)))
      .orderBy(vacationSchedules.startDate);
    return rows.map((row) => ({ ...row, startDate: asDateStr(row.startDate), endDate: asDateStr(row.endDate) }));
  }),

  create: commercialFeatureProcedure("timeTracking")
    .input(z.object({
      memberAccountId: z.number().int().positive(),
      startDate: dateStr,
      endDate: dateStr,
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertManager(ctx);
      await ensureVacationSchedulesTable();
      const database = await requireDb();
      const [member] = await database.select({ id: memberAccounts.id, companyId: memberAccounts.companyId, active: memberAccounts.active })
        .from(memberAccounts).where(eq(memberAccounts.id, input.memberAccountId)).limit(1);
      if (!member || member.companyId !== ctx.accountId || !member.active) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Funcionário não encontrado ou inativo." });
      }
      const days = daysBetween(input.startDate, input.endDate);
      const warning = await teamOverlapWarning(database, ctx.accountId, input.memberAccountId, input.startDate, input.endDate);
      await database.transaction(async (tx) => {
        await assertNoOverlap(tx, ctx.accountId, input.memberAccountId, input.startDate, input.endDate);
        await tx.insert(vacationSchedules).values({
          companyId: ctx.accountId,
          memberAccountId: input.memberAccountId,
          startDate: dbDate(input.startDate),
          endDate: dbDate(input.endDate),
          days,
          notes: input.notes || null,
          createdByMemberAccountId: ctx.memberAccountId!,
        });
      });
      return { ok: true, warning };
    }),

  update: commercialFeatureProcedure("timeTracking")
    .input(z.object({
      id: z.number().int().positive(),
      startDate: dateStr,
      endDate: dateStr,
      notes: z.string().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertManager(ctx);
      await ensureVacationSchedulesTable();
      const database = await requireDb();
      const days = daysBetween(input.startDate, input.endDate);
      let warning: string | null = null;
      await database.transaction(async (tx) => {
        const [row] = await tx.select().from(vacationSchedules)
          .where(and(eq(vacationSchedules.id, input.id), eq(vacationSchedules.companyId, ctx.accountId))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.status === "cancelled") throw new TRPCError({ code: "BAD_REQUEST", message: "Não é possível editar férias canceladas." });
        await assertNoOverlap(tx, ctx.accountId, row.memberAccountId, input.startDate, input.endDate, input.id);
        warning = await teamOverlapWarning(tx, ctx.accountId, row.memberAccountId, input.startDate, input.endDate);
        await tx.update(vacationSchedules).set({
          startDate: dbDate(input.startDate),
          endDate: dbDate(input.endDate),
          days,
          notes: input.notes ?? row.notes,
          updatedByMemberAccountId: ctx.memberAccountId!,
        }).where(eq(vacationSchedules.id, input.id));
      });
      return { ok: true, warning };
    }),

  cancel: commercialFeatureProcedure("timeTracking")
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      assertManager(ctx);
      await ensureVacationSchedulesTable();
      const database = await requireDb();
      await database.transaction(async (tx) => {
        const [row] = await tx.select().from(vacationSchedules)
          .where(and(eq(vacationSchedules.id, input.id), eq(vacationSchedules.companyId, ctx.accountId))).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND" });
        if (row.status === "cancelled") return;
        await tx.update(vacationSchedules).set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancelledByMemberAccountId: ctx.memberAccountId!,
        }).where(eq(vacationSchedules.id, input.id));
      });
      return { ok: true };
    }),

  calendar: commercialFeatureProcedure("timeTracking")
    .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12).optional() }))
    .query(async ({ ctx, input }) => {
      assertManager(ctx);
      await ensureVacationSchedulesTable();
      const database = await requireDb();
      const from = input.month
        ? `${input.year}-${String(input.month).padStart(2, "0")}-01`
        : `${input.year}-01-01`;
      const last = new Date(input.year, input.month ?? 12, 0).getDate();
      const to = input.month
        ? `${input.year}-${String(input.month).padStart(2, "0")}-${String(last).padStart(2, "0")}`
        : `${input.year}-12-31`;
      const rows = await database
        .select({
          id: vacationSchedules.id,
          memberAccountId: vacationSchedules.memberAccountId,
          memberName: memberAccounts.userName,
          startDate: vacationSchedules.startDate,
          endDate: vacationSchedules.endDate,
          status: vacationSchedules.status,
          createdByMemberAccountId: vacationSchedules.createdByMemberAccountId,
          updatedByMemberAccountId: vacationSchedules.updatedByMemberAccountId,
          cancelledByMemberAccountId: vacationSchedules.cancelledByMemberAccountId,
        })
        .from(vacationSchedules)
        .innerJoin(memberAccounts, eq(memberAccounts.id, vacationSchedules.memberAccountId))
        .where(and(
          eq(vacationSchedules.companyId, ctx.accountId),
          eq(vacationSchedules.status, "scheduled"),
          lte(vacationSchedules.startDate, dbDate(to)),
          gte(vacationSchedules.endDate, dbDate(from)),
        ));
      return rows.map((row) => ({ ...row, startDate: asDateStr(row.startDate), endDate: asDateStr(row.endDate) }));
    }),
});

/** Banco indisponível vira erro amigável (503) em vez de 500 genérico. */
async function requireDb() {
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Banco de dados indisponível no momento. Tente novamente em instantes." });
  return database;
}
