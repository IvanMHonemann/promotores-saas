/**
 * Compressão única de fotos do site (check-in, fotos de loja, anexos de ponto).
 * - corrige a orientação EXIF (createImageBitmap "from-image" / navegador);
 * - limita o maior lado a ~1600 px;
 * - JPEG começando em qualidade 0,75 e reduzindo até ficar entre ~300 e 500 KB;
 * - nunca devolve o original sem processar.
 * Obs.: o canvas remove o EXIF. Data, hora e GPS vão em campos próprios da API
 * (capturedAt/latitude/longitude) e no carimbo desenhado na foto, então nada se perde.
 */
import { MAX_PHOTO_BASE64_CHARS, PHOTO_TOO_LARGE_MESSAGE } from "@shared/uploadLimits";

export const IMAGE_MAX_SIDE = 1600;
export const IMAGE_TARGET_BYTES = 500 * 1024;
export const IMAGE_MIN_GOOD_BYTES = 300 * 1024;
export const IMAGE_START_QUALITY = 0.75;

export type EncodeFn = (maxSide: number, quality: number) => Promise<Blob>;

/** Plano de tentativas (puro, testável): baixa a qualidade e depois o tamanho até caber no alvo. */
export const COMPRESSION_PLAN: Array<{ maxSide: number; quality: number }> = [
  { maxSide: IMAGE_MAX_SIDE, quality: IMAGE_START_QUALITY },
  { maxSide: IMAGE_MAX_SIDE, quality: 0.65 },
  { maxSide: IMAGE_MAX_SIDE, quality: 0.55 },
  { maxSide: 1280, quality: 0.6 },
  { maxSide: 1024, quality: 0.55 },
  { maxSide: 800, quality: 0.5 },
];

export async function compressToTarget(encode: EncodeFn, targetBytes = IMAGE_TARGET_BYTES): Promise<Blob> {
  let best: Blob | null = null;
  for (const step of COMPRESSION_PLAN) {
    const blob = await encode(step.maxSide, step.quality);
    if (!best || blob.size < best.size) best = blob;
    if (blob.size <= targetBytes) return blob;
  }
  return best!;
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

export async function decodeImage(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch { /* cai para <img>, que também respeita o EXIF nos navegadores atuais */ }
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
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Não foi possível comprimir a foto."))), "image/jpeg", quality);
  });
}

/** Desenha a fonte reduzida e codifica em JPEG. */
function encoderFor(source: CanvasImageSource, width: number, height: number): EncodeFn {
  return async (maxSide, quality) => {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a foto neste aparelho.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    try { return await canvasToBlob(canvas, quality); } finally { canvas.width = 0; canvas.height = 0; }
  };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const r = String(reader.result || ""); const i = r.indexOf(","); resolve(i >= 0 ? r.slice(i + 1) : r); };
    reader.onerror = () => reject(new Error("Não foi possível ler a foto."));
    reader.readAsDataURL(blob);
  });
}

/** Garante o limite do servidor (verificação final, com mensagem em pt-BR). */
export function assertPhotoSize(base64: string) {
  if (base64.length > MAX_PHOTO_BASE64_CHARS) throw new Error(PHOTO_TOO_LARGE_MESSAGE);
}

export type CompressedImage = { blob: Blob; base64: string; dataUrl: string };

async function finish(blob: Blob): Promise<CompressedImage> {
  const base64 = await blobToBase64(blob);
  assertPhotoSize(base64);
  return { blob, base64, dataUrl: `data:image/jpeg;base64,${base64}` };
}

/** Arquivo/Blob de imagem (câmera do aparelho, galeria) -> JPEG comprimido. */
export async function compressImageFile(file: Blob): Promise<CompressedImage> {
  const d = await decodeImage(file);
  try {
    if (!d.width || !d.height) throw new Error("Imagem inválida. Tire a foto novamente.");
    return await finish(await compressToTarget(encoderFor(d.source, d.width, d.height)));
  } finally { d.release(); }
}

/** Canvas já pronto (ex.: foto com carimbo de data/hora/GPS) -> JPEG comprimido. */
export async function compressCanvas(canvas: HTMLCanvasElement): Promise<CompressedImage> {
  return finish(await compressToTarget(encoderFor(canvas, canvas.width, canvas.height)));
}
