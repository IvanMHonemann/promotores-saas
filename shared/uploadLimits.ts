/** Limites de envio. A Vercel recusa corpos acima de 4,5 MB (erro 413), então ficamos abaixo disso. */
export const MAX_BODY_SIZE = "4500kb";
/** Máximo de caracteres base64 por foto (~3,1 MB de imagem). */
export const MAX_PHOTO_BASE64_CHARS = 4_200_000;
export const PHOTO_TOO_LARGE_MESSAGE = "Imagem grande demais para enviar. Tire a foto novamente ou use uma resolução menor.";
export const BODY_TOO_LARGE_MESSAGE = "Arquivo grande demais para enviar (máximo de 4,5 MB). Tente uma foto ou arquivo menor.";

/** Resposta no formato de erro do tRPC para corpo grande demais (em vez do 413 cru do Express). */
export function payloadTooLargeBody(path?: string) {
  return { error: { json: { message: BODY_TOO_LARGE_MESSAGE, code: -32600, data: { code: "PAYLOAD_TOO_LARGE", httpStatus: 413, path } } } };
}

export function isPayloadTooLargeError(err: unknown) {
  const e = err as { type?: string; status?: number } | null;
  return Boolean(e && (e.type === "entity.too.large" || e.status === 413));
}
