import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ExternalLink, Loader2, ScanLine, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openInmetroConsultation, parseInmetroQrPayload, type InmetroQrParseResult } from "@/lib/inmetroQr";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extintor opcional para associar a consulta (somente id/label). */
  extinguisher?: { id: number; label: string } | null;
  /** Callback após leitura válida do Inmetro (para auditoria/associação). */
  onInmetroRead?: (result: Extract<InmetroQrParseResult, { ok: true }>) => void | Promise<void>;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector(): (new (opts?: { formats: string[] }) => BarcodeDetectorLike) | null {
  if (typeof window === "undefined") return null;
  return (window as any).BarcodeDetector || null;
}

export function InmetroQrReaderDialog({ open, onOpenChange, extinguisher, onInmetroRead }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const handledRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<InmetroQrParseResult | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [recording, setRecording] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  }, []);

  const handleDecoded = useCallback(
    async (raw: string) => {
      if (handledRef.current) return;
      const parsed = parseInmetroQrPayload(raw);
      handledRef.current = true;
      stopCamera();
      setResult(parsed);
      // Abrir consulta oficial imediatamente (objetivo principal da leitura)
      if (parsed.ok) {
        try {
          openInmetroConsultation(parsed);
        } catch {
          /* popup bloqueado — botão na UI permanece disponível */
        }
      }
      if (parsed.ok && onInmetroRead) {
        try {
          setRecording(true);
          await onInmetroRead(parsed);
        } finally {
          setRecording(false);
        }
      }
    },
    [onInmetroRead, stopCamera],
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setResult(null);
    setStarting(true);
    handledRef.current = false;
    stopCamera();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este dispositivo/navegador não disponibiliza acesso à câmera.");
      }

      const Detector = getBarcodeDetector();
      if (!Detector) {
        throw new Error(
          "Leitura automática de QR não é suportada neste navegador. Use Chrome/Edge atualizado no Android ou digite/cole o link do Inmetro abaixo.",
        );
      }

      detectorRef.current = new Detector({ formats: ["qr_code"] });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Elemento de vídeo indisponível.");
      video.srcObject = stream;
      await video.play();
      setScanning(true);

      const tick = async () => {
        if (!videoRef.current || !detectorRef.current || handledRef.current) return;
        try {
          if (videoRef.current.readyState >= 2) {
            const codes = await detectorRef.current.detect(videoRef.current);
            const raw = codes?.[0]?.rawValue;
            if (raw) {
              await handleDecoded(raw);
              return;
            }
          }
        } catch {
          /* frame sem QR — continua */
        }
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      };
      rafRef.current = requestAnimationFrame(() => {
        void tick();
      });
    } catch (err) {
      stopCamera();
      const msg =
        err instanceof Error
          ? /NotAllowedError|Permission/i.test(err.name) || /permission|denied|NotAllowed/i.test(err.message)
            ? "Permissão de câmera negada. Habilite o acesso à câmera nas configurações do navegador e tente novamente."
            : err.message
          : "Não foi possível iniciar a câmera.";
      setCameraError(msg);
    } finally {
      setStarting(false);
    }
  }, [handleDecoded, stopCamera]);

  useEffect(() => {
    if (open) {
      void startCamera();
    } else {
      stopCamera();
      setResult(null);
      setCameraError(null);
      setManualValue("");
      handledRef.current = false;
    }
    return () => stopCamera();
  }, [open, startCamera, stopCamera]);

  const applyManual = () => {
    const parsed = parseInmetroQrPayload(manualValue);
    handledRef.current = true;
    stopCamera();
    setResult(parsed);
    if (parsed.ok) {
      try {
        openInmetroConsultation(parsed);
      } catch {
        /* popup bloqueado */
      }
    }
    if (parsed.ok && onInmetroRead) {
      void (async () => {
        try {
          setRecording(true);
          await onInmetroRead(parsed);
        } finally {
          setRecording(false);
        }
      })();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ScanLine className="h-5 w-5 text-red-600" />
            Ler QR Code do Inmetro
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-xs text-slate-600">
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 leading-relaxed">
            Aponte a câmera para o <strong>QR Code oficial do selo Inmetro</strong> no extintor.
            Esta função apenas <strong>lê</strong> o QR existente — o sistema não gera QR Code próprio.
          </p>
          {extinguisher && (
            <p className="text-[11px] text-slate-500">
              Extintor vinculado à consulta: <strong className="text-slate-800">{extinguisher.label}</strong>
            </p>
          )}

          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video ref={videoRef} className="aspect-[3/4] w-full object-cover" playsInline muted />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/90 p-4 text-center text-slate-200">
                {starting ? (
                  <>
                    <Loader2 className="h-7 w-7 animate-spin text-red-400" />
                    <span>Iniciando câmera…</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-7 w-7 text-slate-400" />
                    <span>Câmera parada</span>
                  </>
                )}
              </div>
            )}
            {scanning && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-40 rounded-xl border-2 border-red-500/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            )}
          </div>

          {cameraError && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">{cameraError}</div>
          )}

          {result && (
            <div
              className={`rounded-lg border p-3 ${
                result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
              }`}
            >
              {result.ok ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <ShieldCheck className="h-4 w-4" /> Selo / QR Code do Inmetro reconhecido
                  </p>
                  {result.code && (
                    <p className="text-[11px]">
                      Identificador: <strong className="font-mono text-slate-900">{result.code}</strong>
                    </p>
                  )}
                  {result.isUrl && result.url && (
                    <p className="break-all font-mono text-[10px] text-slate-600">{result.url}</p>
                  )}
                  {!result.isUrl && result.raw && (
                    <p className="break-all font-mono text-[10px] text-slate-600">{result.raw}</p>
                  )}
                  <Button
                    size="sm"
                    className="w-full gap-1.5 bg-red-600 font-semibold hover:bg-red-700"
                    onClick={() => {
                      try {
                        openInmetroConsultation(result);
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <ExternalLink className="h-4 w-4" /> Abrir consulta oficial do Inmetro
                  </Button>
                  <p className="text-[10px] leading-relaxed text-emerald-800">
                    A consulta oficial abre em uma nova aba do navegador. Se nada abriu, toque no botão acima
                    (alguns celulares bloqueiam abertura automática).
                  </p>
                  {recording && <p className="text-[11px] text-emerald-700">Registrando consulta na auditoria…</p>}
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold">{result.reason}</p>
                  {result.raw && <p className="break-all font-mono text-[11px] opacity-80">{result.raw}</p>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5 border-t border-slate-100 pt-3">
            <label className="font-semibold text-slate-700">Colar link do Inmetro (alternativa)</label>
            <input
              className="h-9 w-full rounded-md border border-slate-200 px-2 text-sm"
              placeholder="https://…inmetro.gov.br/…"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
            />
            <Button size="sm" variant="outline" className="w-full" disabled={!manualValue.trim()} onClick={applyManual}>
              Validar conteúdo
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => {
              stopCamera();
              onOpenChange(false);
            }}
          >
            <X className="mr-1 h-4 w-4" /> Fechar
          </Button>
          <Button className="bg-red-600 hover:bg-red-700" onClick={() => void startCamera()} disabled={starting}>
            <Camera className="mr-1 h-4 w-4" /> {scanning ? "Reiniciar câmera" : "Abrir câmera"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
