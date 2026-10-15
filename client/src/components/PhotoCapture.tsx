import { useRef, useState } from "react";
import { Camera, MapPin, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";


async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pt-BR`);
    if (!res.ok) return "Local não disponível";
    const data = await res.json();
    const addr = data.address || {};
    const parts = [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village, addr.state].filter(Boolean);
    return parts.slice(0, 3).join(", ") || data.display_name || "Local não disponível";
  } catch {
    return "Local não disponível";
  }
}

type Props = {
  storeId: number;
  storeName: string;
  visitId?: number | null;
  onCaptured: () => void;
};

function applyWatermark(
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
      const startY = height - (lineH * lines.length) - 16;
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      ctx.textBaseline = "top";
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

      resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
    };
    img.onerror = () => reject(new Error("Falha ao processar imagem"));
    img.src = dataUrl;
  });
}

export function PhotoCapture({ storeId, storeName, visitId, onCaptured }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [rawDataUrl, setRawDataUrl] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "pending" | "denied" | "ok">("idle");
  const [uploading, setUploading] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID().replace(/-/g, "").slice(0, 32));

  const upload = trpc.storePhotos.uploadAndCreate.useMutation({
    onSuccess: () => {
      toast.success("Foto salva com sucesso.");
      setPreview(null);
      setRawDataUrl(null);
      onCaptured();
    },
    onError: (err) => toast.error(err.message || "Não foi possível salvar a foto."),
  });

  const requestGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("pending");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus("ok");
      },
      () => setGpsStatus("denied"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRawDataUrl(dataUrl);
      setPreview(dataUrl);
      requestGps();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const keep = async () => {
    if (!rawDataUrl) return;
    setUploading(true);
    try {
      const now = new Date();
      const dateStr = now.toLocaleDateString("pt-BR");
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const promoter = user?.name || user?.email || "Promotor";
      const location = gps ? await reverseGeocode(gps.lat, gps.lng) : "Local não disponível";
      const lines = [
        `Promotor: ${promoter}`,
        `Local: ${location}`,
        `Loja: ${storeName}`,
        `Data: ${dateStr}  Hora: ${timeStr}`,
      ];

      const base64 = await applyWatermark(rawDataUrl, lines);
      await upload.mutateAsync({
        storeId,
        visitId: visitId ?? undefined,
        capturedAt: now.toISOString(),
        latitude: gps?.lat,
        longitude: gps?.lng,
        accuracy: gps?.accuracy,
        locationStatus: gps ? "success" : gpsStatus === "denied" ? "permission_denied" : "unavailable",
        imageBase64: base64,
        mimeType: "image/jpeg",
        idempotencyKey,
      });
    } catch {
      // toast já tratado
    } finally {
      setUploading(false);
    }
  };

  const retake = () => {
    setPreview(null);
    setRawDataUrl(null);
    setGps(null);
    setGpsStatus("idle");
    fileRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFile}
      />
      {!preview && (
        <Button
          type="button"
          className="h-12 w-full bg-teal-400 text-base font-bold text-slate-950 hover:bg-teal-300"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="mr-2 h-5 w-5" /> Tirar foto
        </Button>
      )}

      {preview && (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3">
          <img src={preview} alt="Pré-visualização" className="max-h-64 w-full rounded-lg object-contain" />
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <MapPin className="h-3.5 w-3.5" />
            {gpsStatus === "pending" && "Obtendo localização..."}
            {gpsStatus === "ok" && gps && `GPS ±${Math.round(gps.accuracy)} m`}
            {gpsStatus === "denied" && "Localização não disponível (foto será salva sem GPS)"}
            {gpsStatus === "idle" && "Aguardando GPS"}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="border-white/15" onClick={retake} disabled={uploading}>
              <RotateCcw className="mr-1 h-4 w-4" /> Refazer
            </Button>
            <Button type="button" className="bg-emerald-500 text-slate-950" onClick={keep} disabled={uploading}>
              <Check className="mr-1 h-4 w-4" /> {uploading ? "Salvando..." : "Manter foto"}
            </Button>
            <Button type="button" variant="ghost" className="text-slate-300" onClick={() => setPreview(null)} disabled={uploading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
