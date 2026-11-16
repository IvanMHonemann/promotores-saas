/**
 * Quem pode alterar dados cadastrais (CPF, PIS, RG, admissão, dados fiscais da empresa).
 * O promotor não altera esses campos — só e-mail e senha da própria conta.
 */
export type RegistryActorRole = "platform_admin" | "company_admin" | "supervisor" | "promoter" | string;

export function canEditCompanyFiscal(role: RegistryActorRole | null | undefined): boolean {
  return role === "company_admin" || role === "platform_admin";
}

/** Mesma regra já usada na equipe: admin edita todos; supervisor edita só promotores. */
export function canEditMemberRegistry(
  actorRole: RegistryActorRole | null | undefined,
  targetRole: RegistryActorRole | null | undefined,
): boolean {
  if (actorRole === "company_admin" || actorRole === "platform_admin") return true;
  if (actorRole === "supervisor") return targetRole === "promoter";
  return false;
}

export function memberRegistryDeniedMessage(
  actorRole: RegistryActorRole | null | undefined,
): string {
  if (actorRole === "promoter") {
    return "Os dados cadastrais (CPF, PIS e demais) só podem ser alterados pelo administrador da empresa. Você pode atualizar o e-mail e a senha.";
  }
  if (actorRole === "supervisor") {
    return "O supervisor só pode alterar os dados cadastrais de promotores.";
  }
  return "Você não pode alterar estes dados cadastrais.";
}

/** Admin e supervisor podem completar os próprios dados em Minha conta; o promotor, não. */
export function canEditOwnRegistry(role: RegistryActorRole | null | undefined): boolean {
  return role === "company_admin" || role === "supervisor" || role === "platform_admin";
}
