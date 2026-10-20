import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { MEMBER_COOKIE_NAME } from "@shared/const";
import type { AuthenticatedUser } from "@shared/auth";
import { getMemberBySessionToken, getPlatformAdminBySessionToken, normalizeMemberRole } from "../memberAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  accountId?: number;
  memberAccountId?: number;
  platformAdminId?: number;
  isMember?: boolean;
  isPlatformAdmin?: boolean;
  /** Administrador da plataforma agindo dentro de uma empresa (cabeçalho x-act-as-company). */
  actingAsPlatform?: boolean;
};

/**
 * O sistema comercial usa exclusivamente a sessão própria criada por auth.login.
 * Sem o cookie próprio, a requisição é anônima.
 */
export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: AuthenticatedUser | null = null;
  let accountId: number | undefined;
  let memberAccountId: number | undefined;
  let platformAdminId: number | undefined;
  let isMember = false;
  let isPlatformAdmin = false;
  let actingAsPlatform = false;

  const cookies = parseCookie(opts.req.headers.cookie ?? "");
  const headerToken = String(opts.req.headers["x-session-token"] || opts.req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "") || "").trim();
  const queryToken = String(opts.req.query?.token || "").trim();
  const sessionToken = cookies[MEMBER_COOKIE_NAME] || headerToken || queryToken || "";
  if (!sessionToken) {
    console.log("[auth] no session token received", { hasCookie: Boolean(cookies[MEMBER_COOKIE_NAME]), hasHeader: Boolean(headerToken), hasQuery: Boolean(queryToken) });
  }
  if (sessionToken) {
    const platformAdmin = await getPlatformAdminBySessionToken(sessionToken);
    if (platformAdmin) {
      platformAdminId = platformAdmin.id;
      isPlatformAdmin = true;
      user = {
        id: platformAdmin.id,
        openId: `platform:${platformAdmin.id}`,
        name: platformAdmin.userName,
        email: platformAdmin.email,
        loginMethod: "password",
        role: "platform_admin",
        createdAt: platformAdmin.createdAt,
        updatedAt: platformAdmin.updatedAt,
        lastSignedIn: platformAdmin.createdAt,
      };
      // "Acessar como empresa": só vale para sessão de administrador da plataforma e empresa existente.
      const actAs = Number(opts.req.headers["x-act-as-company"]);
      if (Number.isInteger(actAs) && actAs > 0) {
        const { getCompanyById } = await import("../db");
        const company = await getCompanyById(actAs);
        if (company) {
          actingAsPlatform = true;
          accountId = company.id;
          user = { ...user, name: `${platformAdmin.userName} (administrador da plataforma)`, role: "company_admin", companyId: company.id };
        }
      }
    } else {
      const memberAccount = await getMemberBySessionToken(sessionToken);
      if (memberAccount) {
        memberAccountId = memberAccount.id;
        accountId = memberAccount.companyId;
        isMember = true;
        user = {
          id: -memberAccount.id,
          openId: `member:${memberAccount.id}`,
          name: memberAccount.userName,
          email: memberAccount.email,
          loginMethod: "password",
          role: normalizeMemberRole(String(memberAccount.role)),
          companyId: memberAccount.companyId,
          createdAt: memberAccount.createdAt,
          updatedAt: memberAccount.updatedAt,
          lastSignedIn: memberAccount.createdAt,
        };
      }
    }
  }

  return { req: opts.req, res: opts.res, user, accountId, memberAccountId, platformAdminId, isMember, isPlatformAdmin, actingAsPlatform };
}
