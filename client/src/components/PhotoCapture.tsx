import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, MapPin, RotateCcw, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { enqueuePhoto } from "@/lib/photoQueue";
import { isOnline } from "@/lib/offlineCache";
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

type GpsFix = { lat: number; lng: number; accuracy: number };
type GpsStatus = "pending" | "ok" | "denied";
type Shot = { dataUrl: string; capturedAt: Date; gps: GpsFix | null; gpsStatus: GpsStatus };

type Props = {
  /** Loja da foto. Omitir ou passar null para foto sem loja vinculada. */
  storeId?: number | null;
  storeName: string;
  /** Cliente da loja em que a foto está sendo tirada. */
  storeClientId?: number | null;
  clientName?: string | null;
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

export function PhotoCapture({ storeId, storeName, storeClientId, clientName, visitId, onCaptured }: Props) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const watchRef = useRef<number | null>(null);
  const gpsRef = useRef<GpsFix | null>(null);
  const sessionRef = useRef(0);
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false); // câmera ao vivo disponível (senão usa a câmera do aparelho)
  const [shot, setShot] = useState<Shot | null>(null); // foto tirada, aguardando "Manter" ou "Refazer"
  const [gps, setGps] = useState<GpsFix | null>(null);
  const [gpsStatus, setGpsStatus] = useState<GpsStatus>("pending");
  const [saved, setSaved] = useState(0);
  const [pending, setPending] = useState(0);

  const upload = trpc.storePhotos.uploadAndCreate.useMutation();

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (watchRef.current != null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
  };

  // Libera câmera e GPS se a tela for fechada com a câmera aberta.
  useEffect(() => () => stopCamera(), []);

  // Liga o stream ao <video> assim que ele aparece na tela.
  useEffect(() => {
    const v = videoRef.current;
    if (open && live && v && streamRef.current) {
      v.srcObject = streamRef.current;
      void v.play().catch(() => {});
    }
  }, [open, live]);

  // Trava a rolagem da página enquanto a câmera está aberta.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const startGps = () => {
    gpsRef.current = null;
    setGps(null);
    if (!navigator.geolocation) {
      setGpsStatus("denied");
      return;
    }
    setGpsStatus("pending");
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        gpsRef.current = fix;
        setGps(fix);
        setGpsStatus("ok");
      },
      () => { if (!gpsRef.current) setGpsStatus("denied"); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  };

  const openCamera = async () => {
    const session = ++sessionRef.current;
    setOpen(true);
    setShot(null);
    setSaved(0);
    startGps();
    if (!navigator.mediaDevices?.getUserMedia) {
      setLive(false);
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (session !== sessionRef.current) { // fechou antes de a câmera abrir
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setLive(true);
    } catch {
      if (session !== sessionRef.current) return;
      setLive(false);
      toast.info("Não foi possível abrir a câmera dentro do app. Usando a câmera do aparelho.");
      fileRef.current?.click();
    }
  };

  const closeCamera = () => {
    sessionRef.current += 1;
    stopCamera();
    setOpen(false);
    setLive(false);
    setShot(null);
    onCaptured();
  };

  /** Foto da câmera ao vivo: congela o quadro e pergunta Manter/Refazer. */
  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * scale);
    canvas.height = Math.round(v.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setShot({
      dataUrl: canvas.toDataURL("image/jpeg", 0.9),
      capturedAt: new Date(),
      gps: gpsRef.current,
      gpsStatus: gpsRef.current ? "ok" : gpsStatus,
    });
  };

  /** Plano B (sem câmera ao vivo): foto vinda da câmera do aparelho. */
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setShot({ dataUrl: reader.result as string, capturedAt: new Date(), gps: gpsRef.current, gpsStatus: gpsRef.current ? "ok" : gpsStatus });
    };
    reader.readAsDataURL(file);
  };

  const saveShot = async (s: Shot): Promise<void> => {
    const promoter = user?.name || user?.email || "Promotor";
    const location = s.gps ? await reverseGeocode(s.gps.lat, s.gps.lng) : "Local não disponível";
    const lines = [
      `Promotor: ${promoter}`,
      `Local: ${location}`,
      `Loja: ${storeName}`,
      ...(clientName ? [`Cliente: ${clientName}`] : []),
      `Data: ${s.capturedAt.toLocaleDateString("pt-BR")}  Hora: ${s.capturedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    ];
    const base64 = await applyWatermark(s.dataUrl, lines);
    // Cada foto tem a sua chave: evita o servidor tratar fotos diferentes como repetidas.
    const idempotencyKey = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const payload = {
      storeId: storeId && storeId > 0 ? storeId : undefined,
      storeClientId: storeClientId ?? undefined,
      visitId: visitId ?? undefined,
      capturedAt: s.capturedAt.toISOString(),
      latitude: s.gps?.lat,
      longitude: s.gps?.lng,
      accuracy: s.gps?.accuracy,
      locationStatus: s.gps ? ("success" as const) : s.gpsStatus === "denied" ? ("permission_denied" as const) : ("unavailable" as const),
      imageBase64: base64,
      mimeType: "image/jpeg",
      idempotencyKey,
    };
    if (!isOnline()) {
      enqueuePhoto(payload);
      toast.info("Foto salva offline. Será enviada ao voltar a conexão.");
      return;
    }
    try {
      await upload.mutateAsync(payload);
    } catch {
      // Se falhar, tenta enfileirar
      enqueuePhoto(payload);
      toast.info("Foto salva offline. Será enviada ao voltar a conexão.");
    }
  };

  /** Manter: envia em segundo plano (uma foto por vez) e já volta para a câmera ao vivo. */
  const keepShot = () => {
    if (!shot) return;
    const s = shot;
    setShot(null);
    setPending((n) => n + 1);
    queueRef.current = queueRef.current
      .then(async () => {
        await saveShot(s);
        setSaved((n) => n + 1);
        onCaptured(); // a galeria atrás da câmera já mostra a nova foto
      })
      .catch((error) => { toast.error(error instanceof Error ? error.message : "Não foi possível salvar uma das fotos."); })
      .finally(() => setPending((n) => n - 1));
    if (!live) fileRef.current?.click(); // sem câmera ao vivo: abre a câmera do aparelho de novo
  };

  const retake = () => {
    setShot(null);
    if (!live) fileRef.current?.click();
  };

  const gpsLabel =
    gpsStatus === "ok" && gps ? `GPS ±${Math.round(gps.accuracy)} m` : gpsStatus === "pending" ? "Buscando GPS..." : "Sem GPS";
  const gpsColor = gpsStatus === "ok" ? "text-teal-300" : gpsStatus === "pending" ? "text-slate-200" : "text-amber-300";

  return (
    <div className="space-y-2">
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      <Button
        type="button"
        className="h-12 w-full bg-teal-400 text-base font-bold text-slate-950 hover:bg-teal-300"
        onClick={() => void openCamera()}
      >
        <Camera className="mr-2 h-5 w-5" /> Tirar foto
      </Button>
      {!open && pending > 0 && (
        <p className="flex items-center justify-center gap-2 text-xs font-medium text-teal-200" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando {pending} foto{pending !== 1 ? "s" : ""}...
        </p>
      )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Câmera">
            <div className="relative flex-1 overflow-hidden">
              {live && (
                <video ref={videoRef} playsInline muted autoPlay className="absolute inset-0 h-full w-full object-cover" />
              )}
              {shot && <img src={shot.dataUrl} alt="Foto tirada" className="absolute inset-0 h-full w-full bg-black object-cover" />}
              {!live && !shot && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
                  <Camera className="h-12 w-12 text-slate-300" />
                  <p className="text-sm text-slate-200">Toque para abrir a câmera do aparelho.</p>
                  <Button type="button" className="h-12 bg-teal-400 px-8 text-base font-bold text-slate-950 hover:bg-teal-300" onClick={() => fileRef.current?.click()}>
                    <Camera className="mr-2 h-5 w-5" /> Tirar foto
                  </Button>
                </div>
              )}

              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
                <button type="button" onClick={closeCamera} aria-label="Fechar câmera" className="rounded-full bg-black/60 p-2.5 text-white hover:bg-black/80">
                  <X className="h-5 w-5" />
                </button>
                <div className="flex flex-col items-end gap-1.5 text-xs font-semibold">
                  <span className={`inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 ${gpsColor}`}>
                    <MapPin className="h-3.5 w-3.5" /> {gpsLabel}
                  </span>
                  {(saved > 0 || pending > 0) && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-white" role="status">
                      {pending > 0 ? <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" /> : <Check className="h-3.5 w-3.5 text-emerald-300" />}
                      {saved} salva{saved !== 1 ? "s" : ""}{pending > 0 ? " · salvando..." : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-black px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4">
              {shot ? (
                <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
                  <Button type="button" className="h-14 bg-slate-700 text-base font-bold text-white hover:bg-slate-600" onClick={retake}>
                    <RotateCcw className="mr-2 h-5 w-5" /> Refazer
                  </Button>
                  <Button type="button" className="h-14 bg-emerald-500 text-base font-bold text-white hover:bg-emerald-400" onClick={keepShot}>
                    <Check className="mr-2 h-5 w-5" /> Manter
                  </Button>
                </div>
              ) : (
                <div className="mx-auto grid max-w-md grid-cols-3 items-center">
                  <button type="button" onClick={closeCamera} className="justify-self-start rounded-lg px-2 py-2 text-sm font-semibold text-white hover:bg-white/10">
                    Concluir
                  </button>
                  {live ? (
                    <button
                      type="button"
                      onClick={takePhoto}
                      aria-label="Tirar foto"
                      className="mx-auto h-[72px] w-[72px] rounded-full border-4 border-white bg-white/90 transition-transform active:scale-90"
                    />
                  ) : (
                    <span />
                  )}
                  <span />
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
