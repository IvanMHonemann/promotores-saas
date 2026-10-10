import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import { MEMBER_COOKIE_NAME } from "@shared/const";
import type { AuthenticatedUser } from "@shared/auth";
import { getMemberBySessionToken, getPlatformAdminBySessionToken } from "../memberAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  accountId?: number;
  memberAccountId?: number;
  platformAdminId?: number;
  isMember?: boolean;
  isPlatformAdmin?: boolean;
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

  const cookies = parseCookie(opts.req.headers.cookie ?? "");
  const sessionToken = cookies[MEMBER_COOKIE_NAME] ?? "";
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
          role: memberAccount.role,
          companyId: memberAccount.companyId,
          createdAt: memberAccount.createdAt,
          updatedAt: memberAccount.updatedAt,
          lastSignedIn: memberAccount.createdAt,
        };
      }
    }
  }

  return { req: opts.req, res: opts.res, user, accountId, memberAccountId, platformAdminId, isMember, isPlatformAdmin };
}
