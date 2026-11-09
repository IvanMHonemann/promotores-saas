/**
 * Anexos do chat "Suporte com IA" (administrador geral).
 * A Vercel recusa requisições acima de 4,5 MB, então:
 *  - fotos são comprimidas no navegador (JPEG ~500 KB) antes de enviar;
 *  - PDFs vão inteiros, até 3 MB;
 *  - arquivos de texto/código vão como texto, cortados em 200 mil caracteres.
 */
export const AI_MAX_ATTACHMENTS = 5;
/** Tamanho máximo do arquivo escolhido (antes da compressão/corte). */
export const AI_MAX_PICK_BYTES = 10 * 1024 * 1024;
export const AI_MAX_PDF_BYTES = 3 * 1024 * 1024;
export const AI_MAX_TEXT_CHARS = 200_000;
/** Soma de todos os anexos já codificados (base64/texto), abaixo do limite de 4,5 MB da Vercel. */
export const AI_MAX_TOTAL_CHARS = 4_000_000;

export type AiAttachmentKind = "image" | "pdf" | "text";
export type AiAttachment = { name: string; mimeType: string; kind: AiAttachmentKind; data: string };

export const AI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/gif"];
const TEXT_EXTENSIONS = /\.(txt|md|csv|json|log|tsx?|jsx?|mjs|cjs|css|scss|html?|xml|ya?ml|sql|env\.example|sh|py)$/i;

/** Decide como um arquivo escolhido será enviado à IA; null quando o tipo não é aceito. */
export function classifyAiFile(name: string, mimeType: string): AiAttachmentKind | null {
  const type = (mimeType || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || /\.pdf$/i.test(name)) return "pdf";
  if (type.startsWith("text/") || type === "application/json" || type === "application/xml" || TEXT_EXTENSIONS.test(name)) return "text";
  return null;
}

export function aiAttachmentsSize(list: Array<{ data: string }>) {
  return list.reduce((sum, item) => sum + item.data.length, 0);
}

export const AI_ACCEPT_ATTR = "image/*,application/pdf,text/*,.txt,.md,.csv,.json,.log,.ts,.tsx,.js,.jsx,.css,.html,.xml,.yml,.yaml,.sql";
