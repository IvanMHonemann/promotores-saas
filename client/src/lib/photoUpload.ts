/**
 * Utilitários do fluxo de foto de check-in/check-out:
 * - redimensiona/comprime a foto uma única vez, logo após a captura;
 * - lê o GPS sem bloquear a confirmação;
 * - separa falha de rede (vale enfileirar offline) de rejeição do servidor (mostrar o erro);
 * - sinaliza envio em andamento para que o recarregamento automático do PWA espere.
 */

import { compressImageFile } from "./imageCompress";

export type PreparedPhoto = {
  /** JPEG já comprimido. */
  blob: Blob;
  /** Base64 puro (sem prefixo data:) para a API. */
  base64: string;
  /** URL temporária e leve para pré-visualização. Deve ser liberada com URL.revokeObjectURL. */
  previewUrl: string;
};

/** Usa a compressão única do site (ver imageCompress.ts). Nunca devolve a imagem original. */
export async function prepareCheckInPhoto(file: Blob): Promise<PreparedPhoto> {
  const { blob, base64 } = await compressImageFile(file);
  return { blob, base64, previewUrl: URL.createObjectURL(blob) };
}

export type GpsFix = { lat: number; lng: number; accuracy: number };

/** Inicia a leitura do GPS (sem rejeitar). Chame ao abrir a tela e aguarde com `waitFor` ao confirmar. */
export function startGpsLookup(): Promise<GpsFix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  });
}

export function waitFor<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

/**
 * Falha que vale a pena repetir depois (sem conexão, timeout, 5xx, 408/429).
 * Rejeições do servidor (400/401/403/404...) NÃO são repetíveis: o usuário precisa ver o motivo.
 */
export function isRetryableError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const status = (error as any)?.data?.httpStatus;
  if (typeof status !== "number") return true; // sem resposta do servidor: rede, abort, gateway não-JSON
  return status >= 500 || status === 408 || status === 429;
}

export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as any)?.message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

/** Executa uma chamada com tempo máximo; ao estourar, cancela a requisição (AbortController). */
export async function withTimeout<T>(ms: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/* Enquanto houver envio em andamento, o PWA não recarrega a página (ver main.tsx). */
export function markUploading(delta: 1 | -1) {
  const w = window as any;
  w.__gondupUploading = Math.max(0, (w.__gondupUploading || 0) + delta);
}
