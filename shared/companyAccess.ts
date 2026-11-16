/** Quem gerencia a operação da empresa (admin e supervisor), sem ser o administrador da plataforma. */
export function isCompanyManager(role: string | null | undefined): boolean {
  return role === "company_admin" || role === "supervisor";
}
