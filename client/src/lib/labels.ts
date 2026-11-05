/** Traduções e formatações para exibir dados técnicos de forma legível (pt-BR). */
const ACTIONS: Record<string, string> = {
  create: "criação", update: "alteração", delete: "exclusão", restore: "restauração", login: "login", logout: "saída",
  security: "segurança", approved: "aprovado", rejected: "rejeitado", pending: "pendente", export: "exportação", view: "visualização",
  clock_in: "entrada", clock_out: "saída", break_start: "início do intervalo", break_end: "fim do intervalo",
};
const MODULES: Record<string, string> = {
  products: "produtos", time_tracking: "ponto", timeTracking: "ponto", visitCheckIn: "check-in/out", fieldOperations: "lojas e roteiros", stores: "lojas", routes: "roteiros", vacations: "férias",
  team: "equipe", teamManagement: "equipe", auth: "acesso", companies: "empresas", files: "arquivos", photos: "fotos",
  billing: "cobrança", platform: "plataforma", backup: "backup", audit: "auditoria",
};
export const translateAction = (v?: string | null) => (v ? ACTIONS[v] ?? v.replace(/_/g, " ") : "—");
export const translateModule = (v?: string | null) => (v ? MODULES[v] ?? v.replace(/_/g, " ") : "—");

const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-11-07" -> "07/11/2026". */
export function brDate(value: unknown): string {
  if (!value) return "";
  const s = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const m = ISO_DATE.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value);
}

/** Troca valores técnicos (datas ISO, códigos em inglês) por texto legível, recursivamente. */
export function humanizeValue(value: unknown): unknown {
  if (typeof value === "string") {
    const dt = ISO_DATETIME.exec(value);
    if (dt) {
      const d = new Date(dt[6] ? value : `${value.replace(" ", "T")}Z`);
      if (!Number.isNaN(d.getTime())) return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    }
    if (ISO_DATE.test(value)) return brDate(value);
    return ACTIONS[value] ?? value;
  }
  if (Array.isArray(value)) return value.map(humanizeValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, humanizeValue(v)]));
  return value;
}
