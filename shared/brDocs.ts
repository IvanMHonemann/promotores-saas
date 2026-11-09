/** Validação de CPF e CNPJ (dígitos verificadores). Aceita com ou sem pontuação. */
export const onlyDigitsStr = (v: unknown) => String(v ?? "").replace(/\D/g, "");

export function isValidCpf(value: unknown): boolean {
  const d = onlyDigitsStr(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export function isValidCnpj(value: unknown): boolean {
  const d = onlyDigitsStr(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const w = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * w[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

export const isValidCpfOrCnpj = (v: unknown) => (onlyDigitsStr(v).length === 11 ? isValidCpf(v) : isValidCnpj(v));

/** "08:00-12:00, 13:00-17:00" -> [["08:00","12:00"],["13:00","17:00"]]; null se inválido. */
export function parseSchedule(text: string): Array<[string, string]> | null {
  const t = text.trim();
  if (!t) return [];
  const out: Array<[string, string]> = [];
  for (const part of t.split(/[,;]/)) {
    const m = part.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*[-–a]\s*([01]\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    out.push([`${m[1]}:${m[2]}`, `${m[3]}:${m[4]}`]);
  }
  return out.length <= 4 ? out : null;
}
export const formatSchedule = (s: Array<[string, string]> | null | undefined) => (s || []).map(([a, b]) => `${a}-${b}`).join(", ");
