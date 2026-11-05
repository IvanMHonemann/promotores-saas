/** Compartilhamento de arquivos pelo sistema (Web Share API com arquivos: abre WhatsApp etc. no celular). */
export function canShareFiles(files: File[]): boolean {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return false;
  if (typeof navigator.canShare !== "function") return false; // sem canShare não há suporte a arquivos
  try { return navigator.canShare({ files }); } catch { return false; }
}

/** Divide em lotes (alguns aparelhos limitam a quantidade de arquivos por envio). */
export function splitShareBatches<T>(items: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
