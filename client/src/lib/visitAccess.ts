/**
 * Quando o ponto eletrônico está desligado, visitas (check-in/out) não dependem de jornada aberta.
 * Com o ponto ligado, mantém a regra atual: só depois da entrada.
 */
export function canManageFieldVisits(input: {
  hasFieldOperations: boolean;
  hasTimeTracking: boolean;
  shiftActive: boolean;
  shiftLoading?: boolean;
  shiftError?: boolean;
  mutationPending?: boolean;
}): boolean {
  if (!input.hasFieldOperations || input.mutationPending) return false;
  if (!input.hasTimeTracking) return true;
  if (input.shiftLoading || input.shiftError) return false;
  return input.shiftActive === true;
}

/** Rotas de UI do módulo timeTracking (ponto). Usadas em testes de menu/gate. */
export const TIME_TRACKING_PATHS = [
  "/ponto",
  "/cartao-ponto",
  "/espelho-ponto",
  "/arquivos-historicos",
  "/meus-comprovantes",
  "/meu-espelho",
  "/ponto-legal",
  "/ferias",
  "/minhas-ferias",
] as const;
