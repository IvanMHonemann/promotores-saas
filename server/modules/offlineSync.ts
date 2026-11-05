/**
 * Envios feitos sem internet (modo offline do promotor).
 *
 * - Cada item da fila do aparelho tem um UUID (clientId) que funciona como chave de idempotência: reenvios
 *   (rede caiu no meio, app fechado, toque duplo) nunca duplicam a visita/foto/batida.
 * - O horário registrado é o do aparelho (marcação) e o horário de gravação é o do servidor ao receber
 *   (Portaria 671, Anexo IX, itens 4 e 5). Relógio suspeito vira alerta para o gestor (shared/offlineClock).
 * - Batidas de ponto usam time_events (idempotencyKey + colunas offline/clientTime); visitas usam esta tabela.
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import * as db from "../db";
import { resolvePunchTime } from "../../shared/punchTime";
import { assessDeviceClock, clockAlertNote, type ClockEvidence } from "../../shared/offlineClock";

export const clockEvidenceSchema = z.object({
  anchorServerTime: z.string().datetime().nullish(),
  anchorDeviceTime: z.string().datetime().nullish(),
  monoElapsedMs: z.number().finite().nonnegative().nullish(),
}).optional();

/** Campos extras aceitos por visits.start/complete quando o envio vem da fila offline. */
export const offlineVisitFields = {
  clientId: z.string().min(8).max(64).optional(),
  deviceTime: z.string().datetime().optional(),
  offline: z.boolean().optional(),
  clock: clockEvidenceSchema,
};

export type OfflineTimeDecision = {
  /** Horário a gravar como início/fim real da visita. */
  effectiveTime: Date;
  offline: boolean;
  /** Texto do alerta de relógio (null quando está tudo certo). */
  clockAlert: string | null;
  /** Texto do alerta quando o horário do aparelho foi descartado (fora da tolerância). */
  timeNote: string | null;
};

/** Decide o horário de um check-in/check-out (mesma regra das batidas de ponto). */
export function resolveOfflineTime(input: { deviceTime?: string | null; offline?: boolean; clock?: ClockEvidence | null; serverNow: Date }): OfflineTimeDecision {
  const device = input.deviceTime ? new Date(input.deviceTime) : null;
  const decision = resolvePunchTime({ deviceTime: device, serverNow: input.serverNow, offline: input.offline });
  const isOffline = decision.alert === "offline";
  const assessment = device && input.offline ? assessDeviceClock(device, input.clock, input.serverNow) : null;
  return {
    effectiveTime: decision.effectiveTime,
    offline: isOffline,
    clockAlert: device && assessment ? clockAlertNote(device, assessment) : null,
    timeNote: decision.alert === "server_time_used" ? decision.note : null,
  };
}

let ready: Promise<void> | null = null;
export function ensureOfflineSubmissions(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS offline_submissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NULL,
      clientId VARCHAR(64) NOT NULL,
      kind VARCHAR(24) NOT NULL,
      entityId INT NULL,
      deviceTime TIMESTAMP NULL,
      receivedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      offline TINYINT(1) NOT NULL DEFAULT 0,
      alert TEXT NULL,
      UNIQUE KEY offline_submissions_client_unique (companyId, clientId),
      KEY offline_submissions_entity_idx (companyId, kind, entityId)
    )`));
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

export async function findSubmission(companyId: number, clientId: string): Promise<{ kind: string; entityId: number | null } | null> {
  await ensureOfflineSubmissions();
  const database = await db.getDb();
  if (!database) return null;
  const [rows]: any = await database.execute(sql`SELECT kind, entityId FROM offline_submissions WHERE companyId = ${companyId} AND clientId = ${clientId} LIMIT 1`);
  const r = rows?.[0];
  return r ? { kind: String(r.kind), entityId: r.entityId == null ? null : Number(r.entityId) } : null;
}

export async function recordSubmission(input: { companyId: number; memberAccountId: number | null; clientId: string; kind: string; entityId: number; deviceTime: Date | null; offline: boolean; alert: string | null }) {
  await ensureOfflineSubmissions();
  const database = await db.getDb();
  if (!database) return;
  // INSERT IGNORE: duas requisições simultâneas com a mesma chave gravam uma vez só.
  await database.execute(sql`INSERT IGNORE INTO offline_submissions (companyId, memberAccountId, clientId, kind, entityId, deviceTime, offline, alert)
    VALUES (${input.companyId}, ${input.memberAccountId}, ${input.clientId}, ${input.kind}, ${input.entityId}, ${input.deviceTime}, ${input.offline ? 1 : 0}, ${input.alert})`);
}

export type VisitOfflineMark = { visitId: number; phase: "start" | "complete"; offline: boolean; deviceTime: string | null; receivedAt: string; alert: string | null };

/** Marcas "registrado offline" das visitas (para relatórios do gestor). */
export async function listVisitOfflineMarks(companyId: number, visitIds: number[]): Promise<VisitOfflineMark[]> {
  const ids = visitIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (!ids.length) return [];
  await ensureOfflineSubmissions();
  const database = await db.getDb();
  if (!database) return [];
  const [rows]: any = await database.execute(sql`SELECT kind, entityId, offline, deviceTime, receivedAt, alert FROM offline_submissions
    WHERE companyId = ${companyId} AND kind IN ('visit_start', 'visit_complete') AND entityId IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`);
  return (rows || []).filter((r: any) => Number(r.offline) === 1 || r.alert).map((r: any) => ({
    visitId: Number(r.entityId),
    phase: r.kind === "visit_start" ? "start" : "complete",
    offline: Number(r.offline) === 1,
    deviceTime: r.deviceTime ? new Date(r.deviceTime).toISOString() : null,
    receivedAt: new Date(r.receivedAt).toISOString(),
    alert: r.alert ?? null,
  }));
}
