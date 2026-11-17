/**
 * Cadastro da empresa e dos funcionários (dados da Portaria 671 / espelho).
 * Colunas opcionais; valores antigos em system_settings são aproveitados.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { companies, memberAccounts } from "../drizzle/schema";
import {
  isValidCep,
  isValidCnpj,
  isValidCpf,
  isValidCpfOrCnpj,
  isValidPis,
  onlyDigitsStr,
} from "../shared/brDocs";
import {
  BR_STATES,
  companyRegistryComplete,
  companyRegistryMissing,
  emptyCompanyRegistry,
  emptyMemberRegistry,
  formatCompanyAddress,
  toLegalSnapshot,
  type CompanyRegistry,
  type MemberRegistry,
} from "../shared/registryFields";
import { canEditCompanyFiscal, canEditMemberRegistry, canEditOwnRegistry, memberRegistryDeniedMessage } from "../shared/registryPermissions";
import * as db from "./db";
import { auditFromCtx } from "./audit";
import { companyAdminProcedure, companyManagerProcedure, platformProcedure, protectedProcedure, router } from "./_core/trpc";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").or(z.literal(""));

function blank(value: unknown): string {
  return String(value ?? "").trim();
}
function orNull(value: string): string | null {
  return value ? value : null;
}

let ready: Promise<void> | null = null;
export async function ensureCompanyRegistryColumns(): Promise<void> {
  if (ready) return ready;
  ready = (async () => {
    const database = await db.getDb();
    if (!database || typeof (database as any).execute !== "function") return;
    const alters = [
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS legalName VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tradeName VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS taxDocument VARCHAR(14) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS stateRegistration VARCHAR(30) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS establishment VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressZip VARCHAR(8) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressStreet VARCHAR(200) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressNumber VARCHAR(20) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressComplement VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressDistrict VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressCity VARCHAR(120) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS addressState VARCHAR(2) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contactPhone VARCHAR(50) NULL",
      "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contactEmail VARCHAR(320) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS cpf VARCHAR(11) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS pis VARCHAR(11) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS rg VARCHAR(20) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS birthDate VARCHAR(10) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS jobTitle VARCHAR(120) NULL",
      "ALTER TABLE member_accounts ADD COLUMN IF NOT EXISTS admissionDate VARCHAR(10) NULL",
    ];
    for (const stmt of alters) {
      await database.execute(sql.raw(stmt));
    }
  })().catch((error) => { ready = null; throw error; });
  return ready;
}

export const companyRegistryInput = z.object({
  legalName: z.string().trim().max(200).optional().default(""),
  tradeName: z.string().trim().max(200).optional().default(""),
  taxDocument: z.string().trim().max(32).optional().default("").refine((v) => !v || isValidCpfOrCnpj(v), "CNPJ ou CPF inválido: confira os números."),
  stateRegistration: z.string().trim().max(30).optional().default(""),
  establishment: z.string().trim().max(200).optional().default(""),
  addressZip: z.string().trim().max(16).optional().default("").refine((v) => !v || isValidCep(v), "CEP inválido."),
  addressStreet: z.string().trim().max(200).optional().default(""),
  addressNumber: z.string().trim().max(20).optional().default(""),
  addressComplement: z.string().trim().max(120).optional().default(""),
  addressDistrict: z.string().trim().max(120).optional().default(""),
  addressCity: z.string().trim().max(120).optional().default(""),
  addressState: z.string().trim().max(2).optional().default("").refine((v) => !v || BR_STATES.includes(v as any), "Informe a UF com duas letras."),
  contactPhone: z.string().trim().max(50).optional().default(""),
  contactEmail: z.string().trim().max(320).optional().default("").refine((v) => !v || z.string().email().safeParse(v).success, "E-mail de contato inválido."),
});

export const memberRegistryInput = z.object({
  cpf: z.string().trim().max(14).optional().default("").refine((v) => !v || isValidCpf(v), "CPF inválido: confira os números."),
  pis: z.string().trim().max(20).optional().default("").refine((v) => !v || isValidPis(v), "PIS/NIS inválido: confira os números."),
  rg: z.string().trim().max(20).optional().default(""),
  birthDate: dateStr.optional().default(""),
  jobTitle: z.string().trim().max(120).optional().default(""),
  admissionDate: dateStr.optional().default(""),
  phone: z.string().trim().max(50).optional().default(""),
});

function rowToCompany(row: any, fallbackName = ""): CompanyRegistry {
  const base = emptyCompanyRegistry();
  if (!row) return { ...base, legalName: fallbackName };
  return {
    legalName: blank(row.legalName) || fallbackName,
    tradeName: blank(row.tradeName),
    taxDocument: onlyDigitsStr(row.taxDocument),
    stateRegistration: blank(row.stateRegistration),
    establishment: blank(row.establishment),
    addressZip: onlyDigitsStr(row.addressZip),
    addressStreet: blank(row.addressStreet),
    addressNumber: blank(row.addressNumber),
    addressComplement: blank(row.addressComplement),
    addressDistrict: blank(row.addressDistrict),
    addressCity: blank(row.addressCity),
    addressState: blank(row.addressState).toUpperCase(),
    contactPhone: blank(row.contactPhone),
    contactEmail: blank(row.contactEmail),
  };
}

function parseLegacyLegal(raw: string): Partial<CompanyRegistry> {
  if (!raw) return {};
  try {
    const json = JSON.parse(raw) as { legalName?: string; document?: string; establishment?: string; address?: string };
    const address = blank(json.address);
    return {
      legalName: blank(json.legalName),
      taxDocument: onlyDigitsStr(json.document),
      establishment: blank(json.establishment),
      addressStreet: address && !address.includes("CEP") ? address : address,
    };
  } catch {
    return {};
  }
}

function mergeCompany(row: CompanyRegistry, legacy: Partial<CompanyRegistry>): CompanyRegistry {
  const out = { ...row };
  if (!out.legalName && legacy.legalName) out.legalName = legacy.legalName;
  if (!out.taxDocument && legacy.taxDocument) out.taxDocument = legacy.taxDocument;
  if (!out.establishment && legacy.establishment) out.establishment = legacy.establishment;
  if (!out.addressStreet && legacy.addressStreet) out.addressStreet = legacy.addressStreet;
  return out;
}

function parseLegacyLabor(raw: string): Partial<MemberRegistry> {
  if (!raw) return {};
  try {
    const json = JSON.parse(raw) as { cpf?: string; pis?: string; jobTitle?: string; admissionDate?: string };
    return {
      cpf: onlyDigitsStr(json.cpf),
      pis: onlyDigitsStr(json.pis),
      jobTitle: blank(json.jobTitle),
      admissionDate: blank(json.admissionDate),
    };
  } catch {
    return {};
  }
}

function rowToMember(row: any, legacy: Partial<MemberRegistry> = {}): MemberRegistry {
  const base = emptyMemberRegistry();
  if (!row) return { ...base, ...legacy, cpf: onlyDigitsStr(legacy.cpf), pis: onlyDigitsStr(legacy.pis) };
  return {
    cpf: onlyDigitsStr(row.cpf) || onlyDigitsStr(legacy.cpf),
    pis: onlyDigitsStr(row.pis) || onlyDigitsStr(legacy.pis),
    rg: blank(row.rg),
    birthDate: blank(row.birthDate),
    jobTitle: blank(row.jobTitle) || blank(legacy.jobTitle),
    admissionDate: blank(row.admissionDate) || blank(legacy.admissionDate),
    phone: blank(row.phone),
  };
}

export async function getCompanyRegistry(companyId: number): Promise<{ name: string; registry: CompanyRegistry; complete: boolean; missing: string[]; canEdit: boolean }> {
  await ensureCompanyRegistryColumns();
  const database = await db.getDb();
  const row = database
    ? (await database.select().from(companies).where(eq(companies.id, companyId)).limit(1))[0]
    : null;
  const legacy = parseLegacyLegal(await db.getSetting("company_legal_profile", companyId, ""));
  const registry = mergeCompany(rowToCompany(row, blank(row?.name)), legacy);
  const missing = companyRegistryMissing(registry);
  return { name: blank(row?.name), registry, complete: missing.length === 0, missing, canEdit: false };
}

export async function saveCompanyRegistry(companyId: number, input: CompanyRegistry): Promise<CompanyRegistry> {
  await ensureCompanyRegistryColumns();
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const taxDocument = onlyDigitsStr(input.taxDocument) || null;
  const addressZip = onlyDigitsStr(input.addressZip) || null;
  await database.update(companies).set({
    legalName: orNull(blank(input.legalName)),
    tradeName: orNull(blank(input.tradeName)),
    taxDocument,
    stateRegistration: orNull(blank(input.stateRegistration)),
    establishment: orNull(blank(input.establishment)),
    addressZip,
    addressStreet: orNull(blank(input.addressStreet)),
    addressNumber: orNull(blank(input.addressNumber)),
    addressComplement: orNull(blank(input.addressComplement)),
    addressDistrict: orNull(blank(input.addressDistrict)),
    addressCity: orNull(blank(input.addressCity)),
    addressState: orNull(blank(input.addressState).toUpperCase()),
    contactPhone: orNull(blank(input.contactPhone)),
    contactEmail: orNull(blank(input.contactEmail)),
  } as any).where(eq(companies.id, companyId));
  const snapshot = toLegalSnapshot({ ...input, taxDocument: taxDocument || "", addressZip: addressZip || "" }, input.legalName);
  await db.setSetting("company_legal_profile", JSON.stringify({
    legalName: snapshot.legalName,
    document: snapshot.document,
    establishment: snapshot.establishment,
    address: snapshot.address,
  }), companyId);
  return (await getCompanyRegistry(companyId)).registry;
}

export async function getMemberRegistry(companyId: number, memberId: number): Promise<{ id: number; name: string; email: string; role: string; registry: MemberRegistry } | null> {
  await ensureCompanyRegistryColumns();
  const database = await db.getDb();
  if (!database) return null;
  const row = (await database.select().from(memberAccounts).where(eq(memberAccounts.id, memberId)).limit(1))[0];
  if (!row || Number(row.companyId) !== Number(companyId)) return null;
  const legacy = parseLegacyLabor(await db.getSetting(`labor_profile:${memberId}`, companyId, ""));
  return {
    id: row.id,
    name: row.userName,
    email: row.email,
    role: String(row.role),
    registry: rowToMember(row, legacy),
  };
}

export async function saveMemberRegistry(companyId: number, memberId: number, input: MemberRegistry): Promise<MemberRegistry> {
  await ensureCompanyRegistryColumns();
  const database = await db.getDb();
  if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
  const cpf = onlyDigitsStr(input.cpf) || null;
  const pis = onlyDigitsStr(input.pis) || null;
  await database.update(memberAccounts).set({
    cpf,
    pis,
    rg: orNull(blank(input.rg)),
    birthDate: orNull(blank(input.birthDate)),
    jobTitle: orNull(blank(input.jobTitle)),
    admissionDate: orNull(blank(input.admissionDate)),
    phone: orNull(blank(input.phone)),
  } as any).where(eq(memberAccounts.id, memberId));
  const raw = await db.getSetting(`labor_profile:${memberId}`, companyId, "");
  let labor: Record<string, unknown> = {};
  try { labor = raw ? JSON.parse(raw) : {}; } catch { labor = {}; }
  labor = {
    ...labor,
    cpf: cpf || "",
    pis: pis || "",
    jobTitle: blank(input.jobTitle) || null,
    admissionDate: blank(input.admissionDate) || null,
  };
  await db.setSetting(`labor_profile:${memberId}`, JSON.stringify(labor), companyId);
  const saved = await getMemberRegistry(companyId, memberId);
  return saved?.registry ?? emptyMemberRegistry();
}

export async function getLegalSnapshotForCompany(companyId: number): Promise<{ name: string; legal: ReturnType<typeof toLegalSnapshot> }> {
  const data = await getCompanyRegistry(companyId);
  return { name: data.name, legal: toLegalSnapshot(data.registry, data.name) };
}

export async function getLaborIdentity(companyId: number, memberId: number): Promise<{ cpf: string | null; pis: string | null; jobTitle: string | null; admissionDate: string | null; phone: string | null; rg: string | null; birthDate: string | null }> {
  const data = await getMemberRegistry(companyId, memberId);
  const r = data?.registry ?? emptyMemberRegistry();
  return {
    cpf: r.cpf || null,
    pis: r.pis || null,
    jobTitle: r.jobTitle || null,
    admissionDate: r.admissionDate || null,
    phone: r.phone || null,
    rg: r.rg || null,
    birthDate: r.birthDate || null,
  };
}

function actorRole(ctx: { user?: { role?: string } | null; actingAsPlatform?: boolean }): string {
  if (ctx.actingAsPlatform) return "platform_admin";
  return ctx.user?.role || "";
}

export const changeMyEmailInput = z.object({
  email: z.string().trim().email("Informe um e-mail válido.").max(320),
  currentPassword: z.string().min(1, "Informe a senha atual."),
});
export const PROMOTER_FORBIDDEN_REGISTRY_KEYS = ["cpf", "pis", "rg", "birthDate", "jobTitle", "admissionDate", "phone"] as const;

export const companyRegistryRouter = router({
  company: companyManagerProcedure.query(async ({ ctx }) => {
    const data = await getCompanyRegistry(ctx.accountId);
    return { ...data, canEdit: canEditCompanyFiscal(actorRole(ctx)), addressLabel: formatCompanyAddress(data.registry) };
  }),

  status: companyAdminProcedure.query(async ({ ctx }) => {
    const data = await getCompanyRegistry(ctx.accountId);
    return { complete: data.complete, missing: data.missing };
  }),

  saveCompany: companyAdminProcedure.input(companyRegistryInput).mutation(async ({ ctx, input }) => {
    if (!canEditCompanyFiscal(actorRole(ctx))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Somente o administrador da empresa pode alterar os dados fiscais." });
    }
    const registry = await saveCompanyRegistry(ctx.accountId, input);
    void auditFromCtx(ctx, { action: "update", module: "users", entityType: "company_registry", entityId: ctx.accountId, description: "Atualizou os dados cadastrais da empresa", newData: { legalName: registry.legalName, taxDocument: registry.taxDocument } });
    return { success: true as const, registry, complete: companyRegistryComplete(registry), missing: companyRegistryMissing(registry) };
  }),

  member: companyManagerProcedure.input(z.object({ memberId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    const data = await getMemberRegistry(ctx.accountId, input.memberId);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado nesta empresa." });
    return { ...data, canEdit: canEditMemberRegistry(actorRole(ctx), data.role) };
  }),

  saveMember: companyManagerProcedure.input(z.object({ memberId: z.number().int().positive(), profile: memberRegistryInput })).mutation(async ({ ctx, input }) => {
    const data = await getMemberRegistry(ctx.accountId, input.memberId);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado nesta empresa." });
    if (!canEditMemberRegistry(actorRole(ctx), data.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: memberRegistryDeniedMessage(actorRole(ctx)) });
    }
    const registry = await saveMemberRegistry(ctx.accountId, input.memberId, input.profile);
    void auditFromCtx(ctx, { action: "update", module: "users", entityType: "member_registry", entityId: input.memberId, entityLabel: data.name, description: `Atualizou dados cadastrais de ${data.name}`, newData: { cpf: registry.cpf ? "informado" : "", jobTitle: registry.jobTitle } });
    return { success: true as const, registry };
  }),

  myProfile: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
      return { kind: "platform" as const, canEditRegistry: false, registry: emptyMemberRegistry(), email: ctx.user?.email || "", name: ctx.user?.name || "", role: ctx.user?.role || "" };
    }
    const data = await getMemberRegistry(ctx.accountId, ctx.memberAccountId);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });
    return {
      kind: "member" as const,
      ...data,
      canEditRegistry: canEditOwnRegistry(data.role),
      canEditEmail: true,
    };
  }),

  /** Promotor e demais papéis podem trocar o próprio e-mail; dados cadastrais não entram nesta rota. */
  changeMyEmail: protectedProcedure
    .input(changeMyEmailInput)
    .mutation(async ({ ctx, input }) => {
      const { assertPromoterNotOnVacation } = await import("./vacationLock");
      await assertPromoterNotOnVacation(ctx);
      if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A conta da plataforma não usa este e-mail." });
      }
      const database = await db.getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível." });
      const { verifyPassword } = await import("./memberAuth");
      const row = (await database.select().from(memberAccounts).where(eq(memberAccounts.id, ctx.memberAccountId)).limit(1))[0];
      if (!row || !verifyPassword(input.currentPassword, row.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "A senha atual está incorreta." });
      }
      const email = input.email.trim().toLowerCase();
      try {
        await database.update(memberAccounts).set({ email }).where(eq(memberAccounts.id, ctx.memberAccountId));
      } catch (error: any) {
        if (error?.code === "ER_DUP_ENTRY") throw new TRPCError({ code: "CONFLICT", message: "Este e-mail já está cadastrado." });
        throw error;
      }
      void auditFromCtx(ctx, { action: "update", module: "users", entityType: "user", entityId: ctx.memberAccountId, description: "Atualizou o e-mail da própria conta" });
      return { success: true as const, email };
    }),

  /** Só admin/supervisor (não promotor) editam os próprios dados cadastrais. Promotor é recusado. */
  saveMyIdentity: protectedProcedure.input(memberRegistryInput).mutation(async ({ ctx, input }) => {
    const { assertPromoterNotOnVacation } = await import("./vacationLock");
    await assertPromoterNotOnVacation(ctx);
    if (ctx.user?.role === "platform_admin" || !ctx.memberAccountId || !ctx.accountId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A conta da plataforma não tem estes dados." });
    }
    const role = actorRole(ctx);
    if (!canEditOwnRegistry(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: memberRegistryDeniedMessage("promoter") });
    }
    const registry = await saveMemberRegistry(ctx.accountId, ctx.memberAccountId, input);
    void auditFromCtx(ctx, { action: "update", module: "users", entityType: "member_registry", entityId: ctx.memberAccountId, description: "Atualizou os próprios dados cadastrais" });
    return { success: true as const, registry };
  }),

  platformGet: platformProcedure.input(z.object({ companyId: z.number().int().positive() })).query(async ({ input }) => {
    const data = await getCompanyRegistry(input.companyId);
    return { ...data, addressLabel: formatCompanyAddress(data.registry) };
  }),
});
