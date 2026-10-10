/** Gera URL de imagem de QR Code (sem dependência local). */
export function qrCodeImageUrl(data: string, size = 280): string {
  const encoded = encodeURIComponent(data);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&data=${encoded}`;
}

export async function downloadQrCodePng(data: string, filename: string, size = 512): Promise<void> {
  const url = qrCodeImageUrl(data, size);
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export function openPrintQrLabel(opts: { url: string; label: string; subtitle?: string }) {
  const img = qrCodeImageUrl(opts.url, 320);
  const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=560");
  if (!w) return;
  const safeLabel = opts.label.replace(/</g, "&lt;");
  const safeSub = opts.subtitle ? opts.subtitle.replace(/</g, "&lt;") : "";
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Etiqueta QR — ${safeLabel}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: system-ui, sans-serif; text-align: center; padding: 24px; color: #0f172a; }
  img { width: 240px; height: 240px; }
  h1 { font-size: 18px; margin: 16px 0 4px; font-family: ui-monospace, monospace; }
  p { font-size: 12px; color: #64748b; margin: 4px 0; }
  .hint { margin-top: 12px; font-size: 11px; }
</style></head><body>
  <img src="${img}" alt="QR Code" />
  <h1>${safeLabel}</h1>
  ${safeSub ? `<p>${safeSub}</p>` : ""}
  <p class="hint">Escaneie para consultar este extintor</p>
  <script>window.onload=function(){setTimeout(function(){window.print()},200)}</script>
</body></html>`);
  w.document.close();
}
