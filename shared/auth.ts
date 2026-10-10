export type AccessLevel = "platform_admin" | "company_admin" | "supervisor" | "promoter" | "oauth_user";

export type AuthenticatedUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  loginMethod: string | null;
  role: AccessLevel;
  companyId?: number;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

export const isPlatformAdmin = (user: AuthenticatedUser | null | undefined) => user?.role === "platform_admin";
export const isCompanyAdmin = (user: AuthenticatedUser | null | undefined) => user?.role === "company_admin";
export const isCompanyUser = (user: AuthenticatedUser | null | undefined) => Boolean(user?.companyId && user.role !== "platform_admin");
