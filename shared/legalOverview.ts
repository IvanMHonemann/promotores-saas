import { LEGAL_TEXT_VERSION } from "./legalTexts";

export type LegalAcceptanceRow = {
  companyId: number;
  version: string;
  acceptedAt: Date | string | null;
  acceptedByName: string | null;
};

export type TermsAcceptanceSummary = {
  termsAcceptedVersion: string | null;
  termsAcceptedAt: Date | string | null;
  termsAcceptedByName: string | null;
  termsAcceptedCurrent: boolean;
};

/** Fica com o aceite mais recente de cada empresa. */
export function latestAcceptanceByCompany(rows: LegalAcceptanceRow[]): Map<number, LegalAcceptanceRow> {
  const map = new Map<number, LegalAcceptanceRow>();
  for (const row of rows) {
    const prev = map.get(row.companyId);
    if (!prev) {
      map.set(row.companyId, row);
      continue;
    }
    const prevTime = new Date(prev.acceptedAt ?? 0).getTime();
    const nextTime = new Date(row.acceptedAt ?? 0).getTime();
    if (nextTime >= prevTime) map.set(row.companyId, row);
  }
  return map;
}

export function termsAcceptanceSummary(
  row: LegalAcceptanceRow | undefined,
  currentVersion = LEGAL_TEXT_VERSION,
): TermsAcceptanceSummary {
  if (!row) {
    return { termsAcceptedVersion: null, termsAcceptedAt: null, termsAcceptedByName: null, termsAcceptedCurrent: false };
  }
  return {
    termsAcceptedVersion: row.version,
    termsAcceptedAt: row.acceptedAt,
    termsAcceptedByName: row.acceptedByName,
    termsAcceptedCurrent: row.version === currentVersion,
  };
}

export function termsAcceptanceLabel(
  summary: TermsAcceptanceSummary,
  formatDate: (value: unknown) => string,
): string {
  if (!summary.termsAcceptedVersion) return "Termos pendentes";
  const when = formatDate(summary.termsAcceptedAt);
  const who = summary.termsAcceptedByName ? ` por ${summary.termsAcceptedByName}` : "";
  if (summary.termsAcceptedCurrent) return `Termos ${summary.termsAcceptedVersion} aceitos em ${when}${who}`;
  return `Termos desatualizados (aceitou ${summary.termsAcceptedVersion} em ${when}${who})`;
}
