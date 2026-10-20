/** Utilidades de código de barras (GTIN/EAN/UPC): normalização, validação do dígito verificador e variantes de busca. */
export const onlyDigits = (code: string) => String(code ?? "").replace(/\D/g, "");

/** Dígito verificador GTIN (comprimentos 8, 12, 13 e 14). */
export function isValidGtin(code: string): boolean {
  const d = onlyDigits(code);
  if (![8, 12, 13, 14].includes(d.length) || d !== code.trim()) return false;
  const nums = d.split("").map(Number);
  const check = nums.pop()!;
  let sum = 0;
  nums.reverse().forEach((n, i) => { sum += n * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

/** Código numérico de produto (não confundir com Code128 alfanumérico de uso interno). */
export const looksNumeric = (code: string) => /^\d+$/.test(code.trim());

/** Variantes para consulta: com/sem zeros à esquerda (UPC-A 12 ↔ EAN-13 13 ↔ GTIN-14). */
export function barcodeVariants(code: string): string[] {
  const d = onlyDigits(code);
  if (!d) return [];
  const set = new Set<string>([d]);
  const stripped = d.replace(/^0+/, "");
  for (const len of [8, 12, 13, 14]) if (stripped.length <= len) set.add(stripped.padStart(len, "0"));
  return [...set].filter((v) => v.length >= 8);
}
