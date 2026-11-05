/**
 * Check-in/out de visita:
 * - exige fieldOperations (lojas/roteiro) e visitCheckIn (módulo de execução);
 * - se o ponto eletrônico estiver ligado, só libera com jornada aberta;
 * - se o ponto estiver desligado, não exige jornada (cliente só de roteiro/fotos+check-in).
 */
export function canManageFieldVisits(input: {
  hasFieldOperations: boolean;
  hasVisitCheckIn: boolean;
  hasTimeTracking: boolean;
  shiftActive: boolean;
  shiftLoading?: boolean;
  shiftError?: boolean;
  mutationPending?: boolean;
}): boolean {
  if (!input.hasFieldOperations || !input.hasVisitCheckIn || input.mutationPending) return false;
  if (!input.hasTimeTracking) return true;
  if (input.shiftLoading || input.shiftError) return false;
  return input.shiftActive === true;
}

/** Rotas de UI do módulo timeTracking (ponto). */
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

/** Rotas de UI do módulo visitCheckIn. */
export const VISIT_CHECKIN_PATHS = ["/check-in-out"] as const;
