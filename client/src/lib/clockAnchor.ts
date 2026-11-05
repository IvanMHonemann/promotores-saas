/**
 * Âncora de relógio: a cada resposta do servidor guardamos a hora do servidor (cabeçalho Date), a hora do aparelho
 * e o relógio monotônico do navegador. Na marcação offline isso permite ao servidor detectar relógio alterado
 * (ver shared/offlineClock.ts).
 */
import type { ClockEvidence } from "@shared/offlineClock";

const KEY = "gondup:clock-anchor";
type Anchor = { serverMs: number; deviceMs: number; perfMs: number; timeOrigin: number };

let memory: Anchor | null = null;

function load(): Anchor | null {
  if (memory) return memory;
  try { memory = JSON.parse(localStorage.getItem(KEY) || "null"); } catch { memory = null; }
  return memory;
}

/** Chamado pelo fetch do tRPC com o cabeçalho Date da resposta. */
export function recordServerDate(dateHeader: string | null) {
  if (!dateHeader) return;
  const serverMs = Date.parse(dateHeader);
  if (!Number.isFinite(serverMs)) return;
  // Date tem precisão de 1 s: usa o meio do segundo.
  const a: Anchor = { serverMs: serverMs + 500, deviceMs: Date.now(), perfMs: performance.now(), timeOrigin: Math.round(performance.timeOrigin) };
  memory = a;
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

/** Evidência para anexar a uma marcação feita agora. */
export function captureClockEvidence(): ClockEvidence {
  const a = load();
  if (!a) return {};
  const sameSession = a.timeOrigin === Math.round(performance.timeOrigin);
  return {
    anchorServerTime: new Date(a.serverMs).toISOString(),
    anchorDeviceTime: new Date(a.deviceMs).toISOString(),
    monoElapsedMs: sameSession ? Math.max(0, Math.round(performance.now() - a.perfMs)) : null,
  };
}
