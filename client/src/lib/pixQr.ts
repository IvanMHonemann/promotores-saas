/** Gera data-URL PNG do QR Code Pix no navegador. */
export async function pixQrDataUrl(payload: string, size = 220): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: size,
    color: { dark: "#0f172a", light: "#ffffff" },
  });
}
