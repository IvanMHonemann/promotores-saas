/**
 * Regras de chaves de arquivos no R2/S3 (bucket único, compartilhado por todas as empresas e pelo backup).
 *
 * Qualquer chave que vá para uma URL assinada, leitura ou DELETE precisa passar por aqui, para que um
 * valor adulterado no banco/entrada nunca aponte para arquivo de outra empresa nem para `backups/`.
 */

/** Prefixos de mídia por empresa. `backups/` fica de fora de propósito. */
export const TENANT_MEDIA_AREAS = ["store-photos", "corrections", "archives"] as const;
export type TenantMediaArea = (typeof TENANT_MEDIA_AREAS)[number];

const SAFE_CHARS = /^[A-Za-z0-9._\-/]+$/;

function hasTraversal(key: string) {
  return key.split("/").some((part) => part === ".." || part === "." || part === "");
}

/** Troca qualquer caractere fora de [A-Za-z0-9_-] (usado para montar chaves a partir de texto vindo do cliente). */
export function safeKeySegment(value: unknown, fallback = "x"): string {
  const cleaned = String(value ?? "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  return cleaned || fallback;
}

/** True se a chave pertence a esta empresa, dentro de uma das áreas permitidas, sem truques de caminho. */
export function isTenantMediaKey(
  key: unknown,
  companyId: number,
  areas: readonly TenantMediaArea[] = ["store-photos"],
): key is string {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  if (!Number.isInteger(companyId) || companyId <= 0) return false;
  if (!SAFE_CHARS.test(key) || hasTraversal(key)) return false;
  return areas.some((area) => key.startsWith(`${area}/${companyId}/`));
}

/**
 * Proteção para DELETE: só apaga arquivos de mídia de alguma empresa (nunca `backups/`, nunca fora dos prefixos).
 * Se `companyId` for informado, exige também que a chave seja dessa empresa.
 */
export function isDeletableMediaKey(key: unknown, companyId?: number): key is string {
  if (typeof key !== "string" || key.length === 0 || key.length > 512) return false;
  if (!SAFE_CHARS.test(key) || hasTraversal(key)) return false;
  const match = /^(store-photos|corrections|archives)\/(\d+)\//.exec(key);
  if (!match) return false;
  return companyId == null || Number(match[2]) === companyId;
}

/** Executa o delete somente se a chave for segura. Retorna false (sem apagar) quando for recusada. */
export async function guardedStorageDelete(
  storageDelete: (key: string) => Promise<boolean>,
  key: unknown,
  companyId?: number,
): Promise<boolean> {
  if (!isDeletableMediaKey(key, companyId)) {
    if (key) console.warn("[storage] exclusão recusada: chave fora das áreas permitidas", String(key).slice(0, 80));
    return false;
  }
  return storageDelete(key);
}

export function detectImageMime(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}
