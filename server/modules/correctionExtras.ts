/**
 * Extensões para solicitações de correção de ponto:
 * - justificationType (feriado, folga, atestado, normal)
 * - attachmentKey (foto de comprovante/atestado no S3)
 * Colunas criadas sob demanda para não quebrar o schema existente.
 */
import { sql } from "drizzle-orm";
import * as db from "../db";
import { storagePut } from "../storage";

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
  const key = `corrections/${companyId}/${requestId}_${Date.now()}.jpg`;
  const { key: stored } = await storagePut(key, buf, mime);
  return stored;
}
