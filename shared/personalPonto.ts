/**
 * Quem tem ponto PESSOAL (bate ponto, banco de horas próprio, espelho próprio, pedidos de correção).
 * O administrador da empresa não bate ponto: só administra o ponto da equipe.
 * Supervisor e promotor continuam como sempre.
 */
export const ADMIN_NO_PUNCH_MESSAGE = "O administrador da empresa não registra ponto. Use as telas de ponto da equipe.";

export function hasPersonalTimeClock(role: string | null | undefined): boolean {
  return Boolean(role) && role !== "company_admin" && role !== "platform_admin";
}
