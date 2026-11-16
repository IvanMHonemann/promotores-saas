/**
 * Aceite dos Termos de Uso e da Política de Privacidade pelo administrador da empresa.
 * Separado da ciência do aviso ao trabalhador (privacy_acknowledgements).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";
import { companyAdminProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { auditFromCtx, requestMeta } from "./audit";
import { LEGAL_TEXT_VERSION } from "../shared/legalTexts";
import { needsLegalAcceptance } from "../shared/legalAcceptance";
import type { LegalAcceptanceRow } from "../shared/legalOverview";

let ready: Promise<void> | null = null;

export async function ensureLegalAcceptancesTable(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    await database.execute(sql.raw(`CREATE TABLE IF NOT EXISTS legal_acceptances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      companyId INT NOT NULL,
      memberAccountId INT NOT NULL,
      version VARCHAR(32) NOT NULL,
      acceptedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ipAddress VARCHAR(64) NULL,
      userAgent VARCHAR(512) NULL,
      UNIQUE KEY legal_acceptances_unique (companyId, memberAccountId, version),
      KEY legal_acceptances_company_version_idx (companyId, version)
    )`));
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

async function queryRows(query: ReturnType<typeof sql>): Promise<any[]> {
  const database = await db.getDb();
  if (!database) return [];
  const [rows]: any = await database.execute(query);
  return rows || [];
}

export async function listLatestLegalAcceptances(): Promise<LegalAcceptanceRow[]> {
  await ensureLegalAcceptancesTable();
  return queryRows(sql`
    SELECT la.companyId, la.version, la.acceptedAt, ma.userName AS acceptedByName
    FROM legal_acceptances la
    LEFT JOIN member_accounts ma ON ma.id = la.memberAccountId
  `).catch(() => []);
}

export const legalRouter = router({
  status: companyAdminProcedure.query(async ({ ctx }) => {
    const base = { version: LEGAL_TEXT_VERSION, required: false, acceptedAt: null as string | null, acceptedVersion: null as string | null };
    if (ctx.actingAsPlatform || ctx.user?.role !== "company_admin" || !ctx.memberAccountId || !ctx.accountId) return base;
    await ensureLegalAcceptancesTable();
    const rows = await queryRows(sql`
      SELECT version, acceptedAt
      FROM legal_acceptances
      WHERE companyId = ${ctx.accountId} AND memberAccountId = ${ctx.memberAccountId}
      ORDER BY acceptedAt DESC, id DESC
      LIMIT 1
    `);
    const acceptedVersion = rows[0]?.version ?? null;
    const acceptedAt = rows[0]?.acceptedAt ?? null;
    return { ...base, required: needsLegalAcceptance(acceptedVersion), acceptedAt, acceptedVersion };
  }),

  accept: companyAdminProcedure.input(z.object({ version: z.string().max(32) })).mutation(async ({ ctx, input }) => {
    if (ctx.actingAsPlatform) throw new TRPCError({ code: "FORBIDDEN", message: "O aceite deve ser feito pelo administrador da empresa, não pela sessão da plataforma." });
    if (!ctx.memberAccountId || !ctx.accountId) throw new TRPCError({ code: "FORBIDDEN", message: "Administrador da empresa não identificado." });
    if (input.version !== LEGAL_TEXT_VERSION) throw new TRPCError({ code: "CONFLICT", message: "Os termos foram atualizados. Recarregue a página para ler a versão nova." });
    await ensureLegalAcceptancesTable();
    const database = await db.getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
    const meta = requestMeta(ctx);
    await database.execute(sql`
      INSERT INTO legal_acceptances (companyId, memberAccountId, version, ipAddress, userAgent, acceptedAt)
      VALUES (${ctx.accountId}, ${ctx.memberAccountId}, ${LEGAL_TEXT_VERSION}, ${meta.ipAddress}, ${meta.userAgent}, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE acceptedAt = acceptedAt, ipAddress = ipAddress, userAgent = userAgent
    `);
    void auditFromCtx(ctx, {
      action: "update",
      module: "legal",
      entityType: "legal_acceptance",
      entityId: ctx.memberAccountId,
      description: `Aceite dos Termos de Uso e da Política de Privacidade, versão ${LEGAL_TEXT_VERSION}`,
      newData: { version: LEGAL_TEXT_VERSION },
    } as any);
    return { success: true as const, version: LEGAL_TEXT_VERSION };
  }),
});
