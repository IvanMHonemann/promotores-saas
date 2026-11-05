/**
 * Extensões para solicitações de correção de ponto:
 * - justificationType (feriado, folga, atestado, normal)
 * - attachmentKey (foto de comprovante/atestado no S3)
 * Colunas criadas sob demanda para não quebrar o schema existente.
 */
import { detectImageMime } from "../mediaKeys";
import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import * as db from "../db";
import { timeCorrectionRequests } from "../../drizzle/schema";
import { storagePut } from "../storage";
import { excuseDay, inferFullDayExcuseType, looksLikeFullDayExcuse } from "../../shared/correctionExcuse";
import type { DayExcuseInput } from "../../shared/timesheetMirror";

let ready: Promise<void> | null = null;

export async function ensureCorrectionExtras(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database) return;
    await database.execute(sql`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS justificationType varchar(32) NULL DEFAULT 'normal'`);
    await database.execute(sql`ALTER TABLE time_correction_requests ADD COLUMN IF NOT EXISTS attachmentKey varchar(512) NULL`);
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

export async function saveCorrectionAttachment(companyId: number, requestId: number, base64: string, mime = "image/jpeg"): Promise<string | null> {
  if (!base64) return null;
  const clean = base64.replace(/^data:[^;]+;base64,/, "");
  const buf = Buffer.from(clean, "base64");
  if (buf.length > 8 * 1024 * 1024) throw new Error("Foto muito grande (máx. 8 MB).");
  // Confere o conteúdo real (não confia no tipo informado pelo cliente): só JPG, PNG ou WebP.
  const detected = detectImageMime(buf);
  if (!detected) throw new Error("O anexo precisa ser uma imagem válida (JPG, PNG ou WebP).");
  const ext = detected === "image/png" ? "png" : detected === "image/webp" ? "webp" : "jpg";
  const key = `corrections/${companyId}/${requestId}_${Date.now()}.${ext}`;
  const { key: stored } = await storagePut(key, buf, detected);
  return stored;
}

/** Abonos de dia inteiro aprovados (folga, feriado, atestado), sem batidas inventadas. */
export async function loadApprovedDayExcuses(companyId: number, memberIds: number[], from: string, to: string): Promise<Map<number, DayExcuseInput[]>> {
  const map = new Map<number, DayExcuseInput[]>();
  if (!memberIds.length) return map;
  const database = await db.getDb();
  if (!database) return map;
  await ensureCorrectionExtras();
  const start = new Date(Date.parse(`${from}T00:00:00Z`) - 15 * 3600000);
  const end = new Date(Date.parse(`${to}T00:00:00Z`) + 60 * 3600000);
  const rows = await database.select().from(timeCorrectionRequests).where(and(
    eq(timeCorrectionRequests.companyId, companyId),
    inArray(timeCorrectionRequests.memberAccountId, memberIds),
    eq(timeCorrectionRequests.status, "approved"),
    gte(timeCorrectionRequests.requestedTime, start),
    lt(timeCorrectionRequests.requestedTime, end),
  ));
  for (const row of rows) {
    if (!looksLikeFullDayExcuse(row)) continue;
    const date = excuseDay(row.requestedTime);
    if (date < from || date > to) continue;
    const type = inferFullDayExcuseType(row);
    if (!type) continue;
    const list = map.get(row.memberAccountId) || [];
    if (list.some((item) => item.date === date)) continue;
    list.push({ date, type, justification: row.justification });
    map.set(row.memberAccountId, list);
  }
  return map;
}
