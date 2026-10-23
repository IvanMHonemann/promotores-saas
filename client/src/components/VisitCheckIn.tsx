import { useRef, useState } from "react";
import { Camera, Check, X, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enqueueVisit } from "@/lib/visitQueue";
import { isOnline } from "@/lib/offlineCache";
import { trpc } from "@/lib/trpc";

type Props = {
  action: "start" | "complete";
  visitId: number;
  storeId: number;
  storeName: string;
  onDone: () => void;
  onCancel: () => void;
};

function toBase64(dataUrl: string): string {
  const idx = dataUrl.indexOf(",");
  return idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
}

/** Resize and compress a data-URL image so the upload is fast on mobile. */
async function compressImage(dataUrl: string, maxWidth = 1280, quality = 0.72): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function VisitCheckIn({ action, visitId, storeId, storeName, onDone, onCancel }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startVisit = trpc.operations.visits.start.useMutation();
  const uploadPhoto = trpc.storePhotos.uploadAndCreate.useMutation();
  const completeVisit = trpc.operations.visits.complete.useMutation();

  const capture = () => inputRef.current?.click();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const getGps = async () => {
    return new Promise<{ lat: number; lng: number; accuracy: number } | null>((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  };

  const confirm = async () => {
    if (!photo) return toast.error("Tire a foto da fachada para continuar.");
    setBusy(true);
    const position = gps || await getGps();
    // Compress before upload — full camera images are multi-MB and slow on mobile
    const compressed = await compressImage(photo);
    const base64 = toBase64(compressed);
    const payload = {
      visitId,
      storeId,
      storeName,
      photoBase64: base64,
      latitude: position?.lat,
      longitude: position?.lng,
      accuracy: position?.accuracy,
    };

    try {
      if (action === "start") {
        await startVisit.mutateAsync({ id: visitId, latitude: position?.lat, longitude: position?.lng, accuracy: position?.accuracy });
      } else {
        await completeVisit.mutateAsync({ id: visitId, latitude: position?.lat, longitude: position?.lng, accuracy: position?.accuracy });
      }
      // Salva foto da fachada vinculada à visita
      try {
        await uploadPhoto.mutateAsync({
          storeId,
          visitId,
          capturedAt: new Date().toISOString(),
          latitude: position?.lat,
          longitude: position?.lng,
          accuracy: position?.accuracy,
          locationStatus: position ? "success" : "unavailable",
          imageBase64: base64,
          mimeType: "image/jpeg",
          idempotencyKey: `visit-${visitId}-${action}-${Date.now()}`.slice(0, 64),
        });
      } catch (photoErr) {
        console.warn("Foto não enviada", photoErr);
      }
      toast.success(`${action === "start" ? "Check-in" : "Check-out"} realizado.`);
      onDone();
    } catch (e) {
      enqueueVisit({ action, ...payload });
      toast.info("Salvo offline. Será sincronizado ao voltar a conexão.");
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-bold text-white">{action === "start" ? "Check-in" : "Check-out"} — {storeName}</h2>
        <p className="mt-1 text-sm text-slate-400">Tire uma foto da fachada da loja para confirmar.</p>

        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

        {!photo ? (
          <Button onClick={capture} className={`mt-4 w-full gap-2 text-slate-950 ${action === "start" ? "bg-teal-500 hover:bg-teal-400" : "bg-amber-500 hover:bg-amber-400"}`}>
            <Camera className="h-5 w-5" /> Tirar foto da fachada
          </Button>
        ) : (
          <div className="mt-4">
            <img src={photo} alt="Fachada" className="w-full rounded-xl" />
            <div className="mt-3 flex gap-2">
              <Button onClick={capture} variant="outline" className="flex-1">Refazer</Button>
              <Button onClick={confirm} disabled={busy} className={`flex-1 gap-2 text-slate-950 ${action === "start" ? "bg-teal-500 hover:bg-teal-400" : "bg-amber-500 hover:bg-amber-400"}`}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}

        <Button onClick={onCancel} variant="ghost" className="mt-3 w-full text-slate-400">
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
