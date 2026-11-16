/** Campos cadastrais da empresa e do funcionário usados nos documentos (Portaria 671 e espelho). Todos opcionais. */
import { formatCep, formatCpfOrCnpj, onlyDigitsStr } from "./brDocs";

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type BrState = (typeof BR_STATES)[number];

export type CompanyRegistry = {
  legalName: string;
  tradeName: string;
  taxDocument: string;
  stateRegistration: string;
  establishment: string;
  addressZip: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressDistrict: string;
  addressCity: string;
  addressState: string;
  contactPhone: string;
  contactEmail: string;
};

export type MemberRegistry = {
  cpf: string;
  pis: string;
  rg: string;
  birthDate: string;
  jobTitle: string;
  admissionDate: string;
  phone: string;
};

export const emptyCompanyRegistry = (): CompanyRegistry => ({
  legalName: "",
  tradeName: "",
  taxDocument: "",
  stateRegistration: "",
  establishment: "",
  addressZip: "",
  addressStreet: "",
  addressNumber: "",
  addressComplement: "",
  addressDistrict: "",
  addressCity: "",
  addressState: "",
  contactPhone: "",
  contactEmail: "",
});

export const emptyMemberRegistry = (): MemberRegistry => ({
  cpf: "",
  pis: "",
  rg: "",
  birthDate: "",
  jobTitle: "",
  admissionDate: "",
  phone: "",
});

export function formatCompanyAddress(c: Partial<CompanyRegistry> | null | undefined): string {
  if (!c) return "";
  const line1 = [c.addressStreet, c.addressNumber, c.addressComplement].map((v) => String(v || "").trim()).filter(Boolean).join(", ");
  const line2 = [c.addressDistrict, [c.addressCity, c.addressState].filter(Boolean).join("/")].filter(Boolean).join(" — ");
  const zip = c.addressZip ? `CEP ${formatCep(c.addressZip)}` : "";
  return [line1, line2, zip].filter(Boolean).join(". ");
}

/** Campos essenciais da Portaria 671 no documento do empregador. */
export function companyRegistryMissing(c: Partial<CompanyRegistry> | null | undefined): string[] {
  const missing: string[] = [];
  if (!String(c?.legalName || "").trim()) missing.push("Razão social");
  if (!onlyDigitsStr(c?.taxDocument)) missing.push("CNPJ ou CPF");
  const hasAddress = Boolean(String(c?.addressStreet || "").trim() && String(c?.addressCity || "").trim());
  if (!hasAddress) missing.push("Endereço");
  return missing;
}

export function companyRegistryComplete(c: Partial<CompanyRegistry> | null | undefined): boolean {
  return companyRegistryMissing(c).length === 0;
}

export function toLegalSnapshot(c: Partial<CompanyRegistry> | null | undefined, fallbackName = ""): {
  legalName: string;
  document: string;
  establishment: string;
  address: string;
} {
  const legalName = String(c?.legalName || fallbackName || "").trim();
  return {
    legalName,
    document: onlyDigitsStr(c?.taxDocument) ? formatCpfOrCnpj(c?.taxDocument) : "",
    establishment: String(c?.establishment || "").trim(),
    address: formatCompanyAddress(c),
  };
}
