import { pickStampLocation, wrapText } from "@shared/address";
import { reverseGeocode } from "@/lib/geocode";
import { compressCanvas } from "@/lib/imageCompress";

/** Endereço completo para o carimbo; se o GPS vier só com cidade/CEP, usa o endereço cadastrado da loja. */
export async function stampLocation(lat: number, lng: number, storeAddress?: string | null): Promise<string> {
  const geocoded = await reverseGeocode(lat, lng);
  return pickStampLocation({
    geocoded,
    storeAddress,
    coordsFallback: `GPS ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
  });
}

export function applyWatermark(
  dataUrl: string,
  lines: string[],
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 1600;
      let { width, height } = img;
      if (width > maxSide || height > maxSide) {
        const scale = maxSide / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas indisponível"));
      ctx.drawImage(img, 0, 0, width, height);

      // Fundo só atrás de cada linha de texto
      const fontSize = Math.max(16, Math.round(width / 42));
      const lineH = fontSize + 10;
      const padX = 8;
      const padY = 4;
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
      // Quebra linhas longas (ex.: endereço completo) para caberem na foto.
      const maxTextW = width - 24 - padX * 2;
      lines = lines.flatMap(l => wrapText(l, maxTextW, t => ctx.measureText(t).width));
      const startY = height - (lineH * lines.length) - 16;
      lines.forEach((line, i) => {
        const y = startY + i * lineH;
        const metrics = ctx.measureText(line);
        const textW = metrics.width;
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.beginPath();
        ctx.roundRect(12, y - padY, textW + padX * 2, fontSize + padY * 2, 4);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.fillText(line, 12 + padX, y);
      });

      compressCanvas(canvas).then(r => resolve(r.base64), reject);
    };
    img.onerror = () => reject(new Error("Falha ao processar imagem"));
    img.src = dataUrl;
  });
}


/** Linhas padrão do carimbo (promotor, local, loja, cliente, data e hora). */
export function stampLines(o: { promoter: string; location: string; storeName: string; clientName?: string | null; capturedAt: Date }): string[] {
  return [
    `Promotor: ${o.promoter}`,
    `Local: ${o.location}`,
    `Loja: ${o.storeName}`,
    ...(o.clientName ? [`Cliente: ${o.clientName}`] : []),
    `Data: ${o.capturedAt.toLocaleDateString("pt-BR")}  Hora: ${o.capturedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  ];
}
