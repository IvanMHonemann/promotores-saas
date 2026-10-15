import { useRef, useState } from "react";
import { Camera, MapPin, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

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

      // Rodapé semitransparente
      const footerH = 28 * lines.length + 16;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, height - footerH, width, footerH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px system-ui, sans-serif";
      ctx.textBaseline = "top";
      lines.forEach((line, i) => {
        ctx.fillText(line, 12, height - footerH + 10 + i * 26);
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
      const promoter = user?.name || "Promotor";
      const lines = [
        `Promotor: ${promoter}`,
        `Loja: ${storeName}`,
        `Data: ${dateStr}  Hora: ${timeStr}`,
      ];
      if (gps) lines.push("GPS registrado");

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
          className="bg-teal-500 text-slate-950"
          onClick={() => fileRef.current?.click()}
        >
          <Camera className="mr-1 h-4 w-4" /> Tirar foto
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
