/**
 * Fotos de fachada do check-in/check-out ficam só com a visita: NUNCA aparecem na galeria da loja.
 * O VisitCheckIn grava com chave "ci-<visita>-<start|complete>-..." (até 28/10/2026: "visit-<visita>-<ação>-...").
 * As fotos da galeria (PhotoCapture) usam chave hexadecimal, que nunca começa com esses prefixos.
 * Se mudar o formato da chave no VisitCheckIn, atualize aqui e o filtro SQL em server/modules/storePhotos.ts.
 */
export const FACADE_KEY_PREFIXES = ["ci-", "visit-"] as const;

export function facadePhotoKey(visitId: number, action: "start" | "complete", random: string): string {
  return `ci-${visitId}-${action}-${random}`.slice(0, 64);
}

export function isFacadePhotoKey(key: string | null | undefined): boolean {
  return typeof key === "string" && FACADE_KEY_PREFIXES.some((p) => key.startsWith(p));
}

export function facadePhotoAction(key: string | null | undefined): "start" | "complete" | null {
  if (!isFacadePhotoKey(key)) return null;
  const m = /^(?:ci|visit)-\d+-(start|complete)-/.exec(String(key));
  return m ? (m[1] as "start" | "complete") : null;
}
