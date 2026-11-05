/**
 * Fila offline única (IndexedDB) de batidas de ponto, check-in/check-out de visitas e fotos.
 *
 * - Cada item tem um UUID (id) que vai ao servidor como chave de idempotência: reenviar nunca duplica.
 * - Guarda a hora do aparelho e a evidência de relógio (clockAnchor) no momento do registro.
 * - Fotos ficam como Blob (já comprimidas), não como texto base64, para caber mais no aparelho.
 * - A foto do check-in depende do check-in (dependsOn): só sobe depois que ele for aceito.
 * - Batidas sobem na ordem em que foram feitas; se uma falhar por rede, as seguintes esperam.
 *
 * O motor (runOutbox) é puro e recebe a "store" por parâmetro para ser testado sem navegador.
 */
import type { ClockEvidence } from "@shared/offlineClock";

export type OutboxKind = "punch" | "visit" | "photo";
export type OutboxStatus = "pending" | "sending" | "error" | "failed";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  /** Ordem de criação (ms do aparelho + contador) para manter a sequência. */
  seq: number;
  createdAt: string;
  /** Usuário que registrou (evita enviar a fila de outra pessoa que logou no mesmo aparelho). */
  ownerId: number | null;
  /** Texto curto para a lista de pendências ("Entrada 08:01", "Foto · Loja X"). */
  label: string;
  status: OutboxStatus;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string | null;
  dependsOn?: string | null;
  deviceTime: string;
  clock: ClockEvidence;
  payload: Record<string, any>;
  blob?: Blob | null;
};

export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
}

/** Espera entre tentativas: 5 s, 10 s, 20 s ... até 5 min (com ±20% de variação). */
export function backoffMs(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.8 + random() * 0.4));
}

export type SendErrorKind = "network" | "transient" | "permanent" | "auth";

/** Classifica o erro do envio: rede (para tudo), temporário (tenta de novo), definitivo (precisa de atenção). */
export function classifyError(error: any): SendErrorKind {
  const code = error?.data?.code ?? error?.shape?.data?.code ?? error?.code;
  const httpStatus = error?.data?.httpStatus ?? error?.status;
  const msg = String(error?.message ?? "").toLowerCase();
  if (code === "UNAUTHORIZED" || httpStatus === 401) return "auth";
  if (["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "PAYLOAD_TOO_LARGE", "UNPROCESSABLE_CONTENT", "PRECONDITION_FAILED"].includes(code)) return "permanent";
  if (code === "TOO_MANY_REQUESTS" || code === "INTERNAL_SERVER_ERROR" || code === "TIMEOUT" || (httpStatus && httpStatus >= 500)) return "transient";
  if (error?.name === "TypeError" || error?.name === "AbortError" || /failed to fetch|network|load failed|fetch failed|timeout|offline/.test(msg)) return "network";
  return "transient";
}

export type Handlers = Partial<Record<OutboxKind, (item: OutboxItem) => Promise<void>>>;
export type RunResult = { sent: number; failed: number; remaining: number; stoppedBy: SendErrorKind | null };

export async function runOutbox(store: OutboxStore, handlers: Handlers, opts: { now?: () => number; ownerId?: number | null; onChange?: () => void } = {}): Promise<RunResult> {
  const now = opts.now ?? Date.now;
  const items = (await store.all()).sort((a, b) => a.seq - b.seq);
  const pendingIds = new Set(items.map((i) => i.id));
  const result: RunResult = { sent: 0, failed: 0, remaining: 0, stoppedBy: null };
  let punchBlocked = false;

  for (const item of items) {
    if (opts.ownerId !== undefined && item.ownerId != null && opts.ownerId != null && item.ownerId !== opts.ownerId) continue;
    if (item.status === "failed") { if (item.kind === "punch") punchBlocked = true; continue; }
    if (item.dependsOn && pendingIds.has(item.dependsOn)) continue;
    if (item.kind === "punch" && punchBlocked) continue;
    if (item.nextAttemptAt > now()) { if (item.kind === "punch") punchBlocked = true; continue; }
    const handler = handlers[item.kind];
    if (!handler) continue;

    await store.put({ ...item, status: "sending" });
    opts.onChange?.();
    try {
      await handler(item);
      await store.remove(item.id);
      pendingIds.delete(item.id);
      result.sent++;
    } catch (error: any) {
      const kind = classifyError(error);
      const message = String(error?.message || "Falha ao enviar").slice(0, 300);
      if (kind === "permanent") {
        await store.put({ ...item, status: "failed", attempts: item.attempts + 1, lastError: message });
        result.failed++;
        if (item.kind === "punch") punchBlocked = true;
      } else {
        const attempts = item.attempts + 1;
        await store.put({ ...item, status: "error", attempts, nextAttemptAt: now() + backoffMs(attempts), lastError: kind === "network" ? "Sem conexão" : kind === "auth" ? "Sessão expirada: entre de novo para enviar" : message });
        if (kind === "network" || kind === "auth") { result.stoppedBy = kind; opts.onChange?.(); break; }
        if (item.kind === "punch") punchBlocked = true;
      }
    }
    opts.onChange?.();
  }
  result.remaining = (await store.all()).length;
  return result;
}

/** Ao abrir o app: item que estava "enviando" quando o app fechou volta para a fila. */
export async function recoverInterrupted(store: OutboxStore) {
  for (const item of await store.all()) if (item.status === "sending") await store.put({ ...item, status: "pending" });
}

export function memoryStore(initial: OutboxItem[] = []): OutboxStore & { items: Map<string, OutboxItem> } {
  const items = new Map(initial.map((i) => [i.id, i]));
  return {
    items,
    async all() { return [...items.values()].map((i) => ({ ...i })); },
    async put(item) { items.set(item.id, { ...item }); },
    async remove(id) { items.delete(id); },
  };
}

let seqCounter = 0;
export function nextSeq(): number {
  seqCounter = (seqCounter + 1) % 1000;
  return Date.now() * 1000 + seqCounter;
}

export function newItem(fields: Pick<OutboxItem, "kind" | "label" | "payload" | "deviceTime" | "clock"> & Partial<OutboxItem>): OutboxItem {
  const defined = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<OutboxItem>;
  return {
    seq: nextSeq(),
    createdAt: new Date().toISOString(),
    ownerId: null,
    status: "pending",
    attempts: 0,
    nextAttemptAt: 0,
    lastError: null,
    dependsOn: null,
    blob: null,
    ...defined,
    id: fields.id || crypto.randomUUID(),
  } as OutboxItem;
}
