import { LEGAL_EFFECTIVE_DATE, LEGAL_TEXT_VERSION } from "./legalTexts";

export const LEGAL_ACCEPTANCE_VERSION = LEGAL_TEXT_VERSION;

export function legalEffectiveDateLabel(iso = LEGAL_EFFECTIVE_DATE): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function legalVersionHeadline(): string {
  return `Versão ${LEGAL_TEXT_VERSION} — vigente desde ${legalEffectiveDateLabel()}`;
}

export function needsLegalAcceptance(acceptedVersion: string | null | undefined, currentVersion = LEGAL_ACCEPTANCE_VERSION): boolean {
  return !acceptedVersion || acceptedVersion !== currentVersion;
}

export const TERMS_SESSION_DISMISS_KEY = `gondup-terms-dismissed:${LEGAL_ACCEPTANCE_VERSION}`;
