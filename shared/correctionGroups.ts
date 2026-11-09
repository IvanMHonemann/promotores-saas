/**
 * Agrupa pedidos de correção/inclusão para UI (promotor e admin).
 * Chave: membro + dia (America/Sao_Paulo) + status + tipo (abono | inclusão | correção).
 * Cada batida continua sendo um registro separado no banco (espelho/AEJ intactos).
 */

export type CorrectionKind = "excuse" | "inclusion" | "correction";

export const CORRECTION_EVENT_LABELS: Record<string, string> = {
  clock_in: "Entrada",
  break_start: "Início do intervalo",
  break_end: "Fim do intervalo",
  clock_out: "Saída",
};

export function correctionDayKey(iso: string | Date, timeZone = "America/Sao_Paulo") {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone });
}

export function correctionKindOf(request: {
  timeEventId?: number | null;
  justificationType?: string | null;
  justification?: string | null;
}, isExcuse: (r: any) => boolean): CorrectionKind {
  if (isExcuse(request)) return "excuse";
  if (request.timeEventId == null) return "inclusion";
  return "correction";
}

export function groupCorrectionItems<T extends { request: {
  id: number;
  memberAccountId?: number | null;
  requestedTime: string | Date;
  requestedType?: string | null;
  timeEventId?: number | null;
  status: string;
  justificationType?: string | null;
  justification?: string | null;
} }>(
  items: T[],
  opts: {
    isExcuse: (r: any) => boolean;
    /** Promotor: todos do mesmo usuário — omitir memberAccountId na chave. */
    includeMember?: boolean;
    timeZone?: string;
  },
): T[][] {
  const tz = opts.timeZone || "America/Sao_Paulo";
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const req = item.request;
    const kind = correctionKindOf(req, opts.isExcuse);
    const member = opts.includeMember === false ? "self" : String(req.memberAccountId ?? "");
    const key = `${member}:${correctionDayKey(req.requestedTime, tz)}:${req.status}:${kind}`;
    const list = groups.get(key) || [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.values()].map((list) =>
    list.slice().sort((a, b) => new Date(a.request.requestedTime).getTime() - new Date(b.request.requestedTime).getTime()),
  );
}

/** Título curto do cartão agrupado, ex.: "02/11/2026 — Entrada 07:00, Saída 17:00 (inclusão)". */
export function formatGroupedCorrectionTitle(
  items: Array<{ request: { requestedTime: string | Date; requestedType?: string | null; timeEventId?: number | null; justificationType?: string | null; justification?: string | null } }>,
  opts: {
    isExcuse: (r: { justificationType?: string | null; justification?: string | null }) => boolean;
    excuseLabel: (r: { justificationType?: string | null; justification?: string | null }) => string;
    timeZone?: string;
  },
): string {
  const first = items[0]?.request;
  if (!first) return "";
  const tz = opts.timeZone || "America/Sao_Paulo";
  const day = new Date(first.requestedTime).toLocaleDateString("pt-BR", { timeZone: tz });
  if (opts.isExcuse(first)) {
    return `${day} — ${opts.excuseLabel(first)} (dia inteiro)`;
  }
  const parts = items.map((item) => {
    const label = CORRECTION_EVENT_LABELS[item.request.requestedType || ""] || "Batida";
    const hhmm = new Date(item.request.requestedTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: tz });
    return `${label} ${hhmm}`;
  });
  const kind = first.timeEventId == null ? "inclusão" : "correção";
  return `${day} — ${parts.join(", ")} (${kind})`;
}

/** Justificativa padrão quando o usuário escolheu uma opção e não escreveu observação. */
export function defaultCorrectionJustification(input: {
  justificationType: string;
  timeEventId?: number | null;
  fullDay?: boolean;
  fullDayLabel?: string;
}): string {
  if (input.fullDay) return input.fullDayLabel || "Abono";
  if (input.justificationType === "other") return "";
  if (input.justificationType === "holiday") return "Feriado";
  if (input.justificationType === "day_off") return "Folga";
  if (input.justificationType === "medical_certificate") return "Atestado médico";
  // normal
  return input.timeEventId ? "Horário incorreto" : "Esquecimento";
}

export function justificationRequiresText(justificationType: string | null | undefined) {
  return (justificationType || "normal") === "other";
}
