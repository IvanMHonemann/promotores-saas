/**
 * Detecção de relógio do aparelho alterado em marcações feitas sem internet.
 *
 * O app guarda uma "âncora" a cada resposta do servidor: a hora do servidor (cabeçalho Date), a hora do aparelho
 * naquele momento e o relógio monotônico do navegador (performance.now, que não muda quando a pessoa mexe no
 * relógio do celular). Na marcação offline, o app envia a âncora e o tempo monotônico decorrido desde ela.
 * O servidor estima a hora real = hora do servidor na âncora + tempo decorrido e compara com a hora do aparelho.
 *
 * Limitação: o relógio monotônico zera quando o app é fechado/recarregado. Nesse caso só dá para detectar o relógio
 * que "voltou" em relação à âncora ou que já estava errado na âncora.
 */
export type ClockEvidence = {
  /** Hora do servidor na última resposta recebida (ISO). */
  anchorServerTime?: string | null;
  /** Hora do aparelho no mesmo instante (ISO). */
  anchorDeviceTime?: string | null;
  /** ms decorridos (performance.now) desde a âncora, se o app não foi reiniciado entre a âncora e a marcação. */
  monoElapsedMs?: number | null;
};

export const CLOCK_DRIFT_LIMIT_MS = 2 * 60 * 1000;
export const CLOCK_ALERT_MARKER = "[ALERTA-RELOGIO]";

export type ClockAssessment = {
  suspect: boolean;
  /** Hora estimada pelo servidor (null quando não há evidência suficiente). */
  estimatedTime: Date | null;
  /** deviceTime − estimativa, em ms (positivo = aparelho adiantado). */
  driftMs: number | null;
  reasons: string[];
};

const valid = (s?: string | null) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

export function assessDeviceClock(deviceTime: Date, clock: ClockEvidence | null | undefined, serverNow: Date): ClockAssessment {
  const reasons: string[] = [];
  const anchorServer = valid(clock?.anchorServerTime);
  const anchorDevice = valid(clock?.anchorDeviceTime);
  if (deviceTime.getTime() > serverNow.getTime() + CLOCK_DRIFT_LIMIT_MS) reasons.push("horário do aparelho está no futuro em relação ao servidor");
  if (!anchorServer || !anchorDevice) return { suspect: reasons.length > 0, estimatedTime: null, driftMs: null, reasons };

  const anchorSkew = anchorDevice.getTime() - anchorServer.getTime();
  if (Math.abs(anchorSkew) > CLOCK_DRIFT_LIMIT_MS) reasons.push(`relógio do aparelho já estava ${Math.round(Math.abs(anchorSkew) / 60000)} min ${anchorSkew > 0 ? "adiantado" : "atrasado"} na última conexão`);
  const deviceDelta = deviceTime.getTime() - anchorDevice.getTime();
  if (deviceDelta < -CLOCK_DRIFT_LIMIT_MS) reasons.push("relógio do aparelho voltou para antes da última conexão");

  let estimated: Date | null = null;
  let drift: number | null = null;
  const mono = clock?.monoElapsedMs;
  if (typeof mono === "number" && Number.isFinite(mono) && mono >= 0) {
    estimated = new Date(anchorServer.getTime() + mono);
    drift = deviceTime.getTime() - estimated.getTime();
    if (Math.abs(drift) > CLOCK_DRIFT_LIMIT_MS) reasons.push(`relógio do aparelho divergiu ${Math.round(Math.abs(drift) / 60000)} min do tempo decorrido medido pelo app`);
  } else {
    // Sem relógio monotônico: corrige pelo desvio conhecido na âncora.
    estimated = new Date(deviceTime.getTime() - anchorSkew);
    drift = anchorSkew;
  }
  if (estimated && estimated.getTime() > serverNow.getTime() + CLOCK_DRIFT_LIMIT_MS) reasons.push("hora estimada da marcação é posterior ao recebimento");
  return { suspect: reasons.length > 0, estimatedTime: estimated, driftMs: drift, reasons };
}

export function clockAlertNote(deviceTime: Date, a: ClockAssessment): string | null {
  if (!a.suspect) return null;
  return `${CLOCK_ALERT_MARKER} Possível alteração do relógio do aparelho: ${a.reasons.join("; ")}. Horário do aparelho ${deviceTime.toISOString()}${a.estimatedTime ? `, estimado pelo sistema ${a.estimatedTime.toISOString()}` : ""}. Conferir com o funcionário.`;
}

export function readClockAlert(notes?: string | null): string | null {
  if (!notes) return null;
  const line = String(notes).split("\n").find((l) => l.startsWith(CLOCK_ALERT_MARKER));
  return line ? line.slice(CLOCK_ALERT_MARKER.length).trim() : null;
}

export const OFFLINE_SEQUENCE_MARKER = "[SEQUENCIA-OFFLINE]";
