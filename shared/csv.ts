/**
 * Evita "injeção de fórmula" em planilhas: texto digitado por promotores (descrição de produto, justificativa,
 * nome de loja...) que comece com = + - @ vira fórmula quando o administrador abre o CSV no Excel/Sheets.
 * O apóstrofo inicial faz a planilha tratar a célula como texto.
 */
export function neutralizeCsvFormula(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
