/**
 * Aplica na tela o que ainda está na fila offline, para o promotor seguir trabalhando sem internet:
 * check-in guardado deixa a visita "em andamento", batida guardada muda o status da jornada.
 */
import type { OutboxItem } from "./outbox";

export type VisitRow = { visit: { id: number; status: string; actualStart?: any; actualEnd?: any; [k: string]: any }; store: any; [k: string]: any };

export function applyQueuedVisits<T extends VisitRow>(rows: T[], items: OutboxItem[]): Array<T & { queued?: boolean }> {
  const visitItems = items.filter((i) => i.kind === "visit" && i.status !== "failed");
  return rows.map((row) => {
    const mine = visitItems.filter((i) => i.payload.visitId === row.visit.id);
    if (!mine.length) return row;
    let visit = { ...row.visit };
    for (const i of mine) {
      if (i.payload.action === "start" && visit.status === "pending") visit = { ...visit, status: "in_progress", actualStart: i.deviceTime };
      if (i.payload.action === "complete" && visit.status !== "completed") visit = { ...visit, status: "completed", actualEnd: i.deviceTime };
    }
    return { ...row, visit, queued: true };
  });
}

export type ShiftLike = { active: boolean; status: "active" | "closed" | "clock_in_required"; lastEvent?: string | null; [k: string]: any };

export function applyQueuedPunches(shift: ShiftLike | undefined | null, items: OutboxItem[], todayKey: string, dayOf: (iso: string) => string): ShiftLike | undefined {
  const today = items.filter((i) => i.kind === "punch" && i.status !== "failed" && dayOf(i.deviceTime) === todayKey).sort((a, b) => a.seq - b.seq);
  if (!today.length) return shift ?? undefined;
  const last = today[today.length - 1].payload.eventType as string;
  const active = last !== "clock_out";
  return { ...(shift || {}), active, status: active ? "active" : "closed", lastEvent: last };
}
