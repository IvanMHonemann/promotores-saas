/**
 * Regra do horário oficial da marcação (Portaria 671: o horário não pode depender só do relógio do celular).
 * - Sem horário do aparelho: vale o do servidor.
 * - Diferença ≤ 5 min do servidor: vale o do aparelho (tolerância de relógio).
 * - Diferença > 5 min: vale o do SERVIDOR e a marcação recebe um alerta (visível no espelho e na auditoria).
 * - Exceção: marcação feita sem internet e sincronizada depois (offline = true) mantém o horário do aparelho,
 *   desde que não esteja no futuro e tenha no máximo 7 dias; fica marcada como "offline" para conferência.
 * O horário original informado pelo aparelho nunca se perde: vai no texto do alerta (campo notes).
 */
export const PUNCH_TOLERANCE_MS = 5 * 60 * 1000;
export const PUNCH_OFFLINE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const TIME_ALERT_MARKER = "[ALERTA-HORARIO]";
export const OFFLINE_MARKER = "[MARCACAO-OFFLINE]";

export type PunchTimeDecision = {
  /** Horário oficial. Quando é o do servidor, `deviceTimeToStore` fica null (o sistema já usa deviceTime || serverTime). */
  effectiveTime: Date;
  deviceTimeToStore: Date | null;
  alert: "none" | "server_time_used" | "offline";
  diffMinutes: number;
  /** Texto para anexar às observações da marcação (inclui o horário original do aparelho). */
  note: string | null;
};

const fmt = (d: Date) => d.toISOString();

export function resolvePunchTime(input: { deviceTime?: Date | null; serverNow: Date; offline?: boolean }): PunchTimeDecision {
  const { serverNow } = input;
  const device = input.deviceTime && !Number.isNaN(input.deviceTime.getTime()) ? input.deviceTime : null;
  if (!device) return { effectiveTime: serverNow, deviceTimeToStore: null, alert: "none", diffMinutes: 0, note: null };
  const diffMs = device.getTime() - serverNow.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const age = -diffMs;
  // Marcação offline: mesmo sincronizada poucos minutos depois, fica registrada como offline (Portaria 671, Anexo IX).
  if (input.offline && diffMs <= PUNCH_TOLERANCE_MS && age <= PUNCH_OFFLINE_MAX_AGE_MS && age > 0) {
    return {
      effectiveTime: device, deviceTimeToStore: device, alert: "offline", diffMinutes,
      note: `${OFFLINE_MARKER} Marcação feita sem internet às ${fmt(device)} (horário do aparelho) e recebida pelo servidor às ${fmt(serverNow)}.`,
    };
  }
  if (Math.abs(diffMs) <= PUNCH_TOLERANCE_MS) return { effectiveTime: device, deviceTimeToStore: device, alert: "none", diffMinutes, note: null };
  if (input.offline && diffMs <= PUNCH_TOLERANCE_MS && age <= PUNCH_OFFLINE_MAX_AGE_MS) {
    return {
      effectiveTime: device, deviceTimeToStore: device, alert: "offline", diffMinutes,
      note: `${OFFLINE_MARKER} Marcação feita sem internet às ${fmt(device)} (horário do aparelho) e recebida pelo servidor às ${fmt(serverNow)}.`,
    };
  }
  return {
    effectiveTime: serverNow, deviceTimeToStore: null, alert: "server_time_used", diffMinutes,
    note: `${TIME_ALERT_MARKER} Horário do aparelho (${fmt(device)}) divergiu ${Math.abs(diffMinutes)} min do servidor (${fmt(serverNow)}); considerado o horário do servidor.`,
  };
}

/** Lê o alerta de horário gravado em notes (para espelho/auditoria). */
export function readTimeAlert(notes?: string | null): { kind: "server_time_used" | "offline"; text: string } | null {
  if (!notes) return null;
  for (const line of String(notes).split("\n")) {
    if (line.startsWith(TIME_ALERT_MARKER)) return { kind: "server_time_used", text: line.slice(TIME_ALERT_MARKER.length).trim() };
    if (line.startsWith(OFFLINE_MARKER)) return { kind: "offline", text: line.slice(OFFLINE_MARKER.length).trim() };
  }
  return null;
}

/** Decisão do Ivan (09/11/2026): depois da saída do dia não há nova entrada até o dia seguinte. */
export const JORNADA_ENCERRADA_MESSAGE = "A jornada de hoje já foi encerrada. Uma nova entrada só é liberada no próximo dia. Se trabalhou depois da saída, peça uma inclusão de marcação no Cartão ponto.";
