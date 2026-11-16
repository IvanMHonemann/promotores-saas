/**
 * Quem tem ponto PESSOAL (bate ponto, banco de horas próprio, espelho próprio, pedidos de correção).
 * O administrador da empresa e o supervisor não batem ponto: só administram o ponto da equipe.
 */
export const ADMIN_NO_PUNCH_MESSAGE = "O administrador da empresa e o supervisor não registram ponto. Use as telas de ponto da equipe.";

export function hasPersonalTimeClock(role: string | null | undefined): boolean {
  return Boolean(role) && role !== "company_admin" && role !== "supervisor" && role !== "platform_admin";
}
