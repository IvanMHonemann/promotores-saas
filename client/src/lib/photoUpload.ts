/**
 * Utilitários do fluxo de foto de check-in/check-out:
 * - redimensiona/comprime a foto uma única vez, logo após a captura;
 * - lê o GPS sem bloquear a confirmação;
 * - separa falha de rede (vale enfileirar offline) de rejeição do servidor (mostrar o erro);
 * - sinaliza envio em andamento para que o recarregamento automático do PWA espere.
 */

export type PreparedPhoto = {
  /** JPEG já comprimido. */
  blob: Blob;
  /** Base64 puro (sem prefixo data:) para a API. */
  base64: string;
  /** URL temporária e leve para pré-visualização. Deve ser liberada com URL.revokeObjectURL. */
  previewUrl: string;
};

const ATTEMPTS: Array<{ maxSide: number; quality: number }> = [
  { maxSide: 1280, quality: 0.72 }, // mesmo padrão usado até aqui
  { maxSide: 1024, quality: 0.6 }, // só se a primeira passada ficar grande demais
];
const MAX_BLOB_BYTES = 1_500_000;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      /* cai para <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("Formato de imagem não suportado. Tire a foto novamente.");
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível comprimir a foto."))), "image/jpeg", quality);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
    reader.readAsDataURL(blob);
  });
}

/** Nunca devolve a imagem original: se não for possível processar, lança erro (evita enviar multi-MB). */
export async function prepareCheckInPhoto(file: Blob): Promise<PreparedPhoto> {
  const decoded = await decode(file);
  try {
    if (!decoded.width || !decoded.height) throw new Error("Imagem inválida. Tire a foto novamente.");
    let blob: Blob | null = null;
    for (const attempt of ATTEMPTS) {
      const scale = Math.min(1, attempt.maxSide / Math.max(decoded.width, decoded.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(decoded.width * scale));
      canvas.height = Math.max(1, Math.round(decoded.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível processar a foto neste aparelho.");
      ctx.imageSmoothingQuality = "high"; // reduz serrilhado ao diminuir 12MP -> 1280px (e o tamanho do JPEG)
      ctx.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
      blob = await canvasToBlob(canvas, attempt.quality);
      // libera a memória do canvas antes da próxima tentativa
      canvas.width = 0;
      canvas.height = 0;
      if (blob.size <= MAX_BLOB_BYTES) break;
    }
    if (!blob) throw new Error("Não foi possível comprimir a foto.");
    const base64 = await blobToBase64(blob);
    return { blob, base64, previewUrl: URL.createObjectURL(blob) };
  } finally {
    decoded.release();
  }
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
