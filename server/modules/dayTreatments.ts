/**
 * Decisões do administrador sobre falta ou justificativa:
 * abonar o dia (saldo zero) ou lançar no banco de horas devendo.
 * Não altera marcações originais. Cálculo entra no buildMirror (leitura).
 */
import { and, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { timeDayTreatments } from "../../drizzle/schema";
import * as db from "../db";
import type { DayTreatmentInput } from "../../shared/timesheetMirror";

let ready: Promise<void> | null = null;

export async function ensureDayTreatmentsTable(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database) return;
    await database.execute(`CREATE TABLE IF NOT EXISTS time_day_treatments (
      id int NOT NULL AUTO_INCREMENT,
      companyId int NOT NULL,
      memberAccountId int NOT NULL,
      day varchar(10) NOT NULL,
      decision varchar(32) NOT NULL,
      notes text NULL,
      decidedByUserId int NULL,
      decidedByName varchar(255) NULL,
      decidedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      reversedAt timestamp NULL,
      reversedByUserId int NULL,
      reversedByName varchar(255) NULL,
      createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY time_day_treatments_member_day (companyId, memberAccountId, day),
      KEY time_day_treatments_company (companyId)
    )`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export function toTreatmentInput(row: {
  day: string;
  decision: string;
  notes?: string | null;
  decidedByName?: string | null;
  decidedAt?: Date | string | null;
}): DayTreatmentInput {
  return {
    date: row.day,
    decision: row.decision === "time_bank" ? "time_bank" : "excuse",
    notes: row.notes ?? null,
    by: row.decidedByName ?? null,
    at: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
  };
}

/** Só decisões ativas (não revertidas) no período. */
export async function loadDayTreatments(
  companyId: number,
  memberIds: number[],
  from: string,
  to: string,
): Promise<Map<number, DayTreatmentInput[]>> {
  const map = new Map<number, DayTreatmentInput[]>();
  if (!memberIds.length) return map;
  await ensureDayTreatmentsTable();
  const database = await db.getDb();
  if (!database) return map;
  const rows = await database.select().from(timeDayTreatments).where(and(
    eq(timeDayTreatments.companyId, companyId),
    inArray(timeDayTreatments.memberAccountId, memberIds),
    isNull(timeDayTreatments.reversedAt),
    gte(timeDayTreatments.day, from),
    lte(timeDayTreatments.day, to),
  ));
  for (const row of rows) {
    const list = map.get(row.memberAccountId) || [];
    list.push(toTreatmentInput(row));
    map.set(row.memberAccountId, list);
  }
  return map;
}

export async function getActiveTreatment(companyId: number, memberId: number, day: string) {
  await ensureDayTreatmentsTable();
  const database = await db.getDb();
  if (!database) return null;
  const rows = await database.select().from(timeDayTreatments).where(and(
    eq(timeDayTreatments.companyId, companyId),
    eq(timeDayTreatments.memberAccountId, memberId),
    eq(timeDayTreatments.day, day),
    isNull(timeDayTreatments.reversedAt),
  )).limit(1);
  return rows[0] || null;
}

export async function saveDayTreatment(opts: {
  companyId: number;
  memberId: number;
  day: string;
  decision: "excuse" | "time_bank";
  notes?: string | null;
  decidedByUserId?: number | null;
  decidedByName?: string | null;
}) {
  await ensureDayTreatmentsTable();
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const now = new Date();
  const current = await getActiveTreatment(opts.companyId, opts.memberId, opts.day);
  if (current) {
    await database.update(timeDayTreatments).set({
      reversedAt: now,
      reversedByUserId: opts.decidedByUserId ?? null,
      reversedByName: opts.decidedByName ?? null,
    }).where(eq(timeDayTreatments.id, current.id));
  }
  await database.insert(timeDayTreatments).values({
    companyId: opts.companyId,
    memberAccountId: opts.memberId,
    day: opts.day,
    decision: opts.decision,
    notes: opts.notes || null,
    decidedByUserId: opts.decidedByUserId ?? null,
    decidedByName: opts.decidedByName ?? null,
    decidedAt: now,
  });
}

export async function reverseDayTreatment(opts: {
  companyId: number;
  memberId: number;
  day: string;
  reversedByUserId?: number | null;
  reversedByName?: string | null;
  notes?: string | null;
}) {
  const current = await getActiveTreatment(opts.companyId, opts.memberId, opts.day);
  if (!current) return false;
  const database = await db.getDb();
  if (!database) throw new Error("Banco de dados indisponível.");
  const notes = [current.notes, opts.notes ? `Reversão: ${opts.notes}` : null].filter(Boolean).join(" | ");
  await database.update(timeDayTreatments).set({
    reversedAt: new Date(),
    reversedByUserId: opts.reversedByUserId ?? null,
    reversedByName: opts.reversedByName ?? null,
    notes: notes || current.notes,
  }).where(eq(timeDayTreatments.id, current.id));
  return true;
}

