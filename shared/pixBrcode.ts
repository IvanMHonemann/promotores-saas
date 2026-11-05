/**
 * Payload Pix estático (BR Code / EMV) com valor — sem gateway.
 * Nome até 25 caracteres, cidade até 15; sem acentos (padrão Bacen).
 */

export type PixBrcodeInput = {
  key: string;
  name: string;
  city: string;
  amount: number | string;
  /** Identificador do TX (até 25). Padrão: *** */
  txid?: string;
  /** Descrição opcional no campo 02 do merchant account (até 25). */
  description?: string;
};

const DEFAULTS = {
  key: "ivanhonemann09@gmail.com",
  name: "IVAN MATEUS HONEMANN",
  city: "SAPIRANGA",
} as const;

/** Remove acentos e força A-Z 0-9 espaço (BR Code). */
export function sanitizePixText(value: string, max: number): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function tlv(id: string, value: string): string {
  const v = String(value);
  const len = String(v.length).padStart(2, "0");
  return `${id}${len}${v}`;
}

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) — exigido pelo BR Code. */
export function crc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatAmount(amount: number | string): string {
  const n = typeof amount === "number" ? amount : Number(String(amount).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) throw new Error("Valor Pix inválido.");
  return n.toFixed(2);
}

/**
 * Monta o payload EMV Pix estático com valor (copia e cola).
 * GUI: br.gov.bcb.pix | Merchant Category 0000 | Moeda 986 (BRL) | País BR.
 */
export function buildPixBrcode(input: Partial<PixBrcodeInput> & { amount: number | string }): string {
  const key = String(input.key ?? DEFAULTS.key).trim();
  if (!key) throw new Error("Chave Pix obrigatória.");
  const name = sanitizePixText(input.name ?? DEFAULTS.name, 25) || DEFAULTS.name;
  const city = sanitizePixText(input.city ?? DEFAULTS.city, 15) || DEFAULTS.city;
  const amount = formatAmount(input.amount);
  const txid = sanitizePixText(input.txid ?? "***", 25) || "***";

  const gui = tlv("00", "br.gov.bcb.pix") + tlv("01", key);
  const desc = input.description ? tlv("02", sanitizePixText(input.description, 25)) : "";
  const merchantAccount = tlv("26", gui + desc);

  const additional = tlv("62", tlv("05", txid));

  // 63 = CRC; valor "04" + placeholder 0000 para o cálculo incluir o próprio campo.
  const body =
    tlv("00", "01") +
    tlv("01", "11") + // estático
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", amount) +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    additional +
    "6304";

  return body + crc16Ccitt(body);
}

export function getDefaultPixConfig() {
  return {
    key: (typeof process !== "undefined" && process.env?.PIX_KEY?.trim()) || DEFAULTS.key,
    name: sanitizePixText(
      (typeof process !== "undefined" && process.env?.PIX_MERCHANT_NAME) || DEFAULTS.name,
      25,
    ) || DEFAULTS.name,
    city: sanitizePixText(
      (typeof process !== "undefined" && process.env?.PIX_MERCHANT_CITY) || DEFAULTS.city,
      15,
    ) || DEFAULTS.city,
    whatsapp:
      (typeof process !== "undefined" && process.env?.PIX_WHATSAPP?.replace(/\D/g, "")) ||
      "5551991667804",
  };
}
