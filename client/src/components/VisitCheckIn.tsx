import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { enqueueVisit } from "@/lib/visitQueue";
import { enqueuePhoto } from "@/lib/photoQueue";
import { trpc } from "@/lib/trpc";
import {
  errorMessage,
  isRetryableError,
  markUploading,
  prepareCheckInPhoto,
  startGpsLookup,
  waitFor,
  withTimeout,
  type GpsFix,
  type PreparedPhoto,
} from "@/lib/photoUpload";

type Props = {
  action: "start" | "complete";
  visitId: number;
  storeId: number;
  storeName: string;
  onDone: () => void;
  onCancel: () => void;
};

type Shot = PreparedPhoto & { capturedAt: string; idempotencyKey: string };

const VISIT_TIMEOUT_MS = 20_000;
const PHOTO_TIMEOUT_MS = 28_000; // a função serverless da Vercel encerra em 30 s
const GPS_WAIT_MS = 3_000; // antes esperava até 10 s a cada confirmação

export function VisitCheckIn({
  action,
  visitId,
  storeId,
  storeName,
  onDone,
  onCancel,
}: Props) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false); // trava síncrona contra toque duplo
  const gpsRef = useRef<Promise<GpsFix | null> | null>(null);
  const shotRef = useRef<Shot | null>(null);
  const { client } = trpc.useUtils();

  // O GPS começa a ser lido ao abrir a tela, enquanto o promotor tira a foto.
  useEffect(() => {
    gpsRef.current = startGpsLookup();
    return () => {
      if (shotRef.current) URL.revokeObjectURL(shotRef.current.previewUrl);
    };
  }, []);

  const replaceShot = (next: Shot | null) => {
    if (shotRef.current) URL.revokeObjectURL(shotRef.current.previewUrl);
    shotRef.current = next;
    setShot(next);
  };

  const capture = () => {
    if (busy || processing) return;
    inputRef.current?.click();
  };

  // Redimensiona/comprime já na captura para agilizar o envio e evitar excesso de memória com fotos de 12 MP+.
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const prepared = await prepareCheckInPhoto(file);
      const nextShot = {
        ...prepared,
        capturedAt: new Date().toISOString(),
        // nova foto = nova chave; retentativas da MESMA foto reutilizam a chave e não duplicam no servidor
        idempotencyKey:
          `ci-${visitId}-${action}-${crypto.randomUUID().replace(/-/g, "")}`.slice(
            0,
            64
          ),
      };
      replaceShot(nextShot);
      // A câmera nativa já confirmou a escolha "Manter" antes de disparar onFile.
      // Portanto, não exibimos uma segunda tela de confirmação no aplicativo.
      await confirm(nextShot);
    } catch (err) {
      replaceShot(null);
      setError(
        errorMessage(err, "Não foi possível processar a foto. Tire novamente.")
      );
    } finally {
      setProcessing(false);
    }
  };

  const confirm = async (selectedShot: Shot | null = shotRef.current) => {
    if (submittingRef.current) return;
    const current = selectedShot;
    if (!current) {
      toast.error("Tire a foto da fachada para continuar.");
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    setError(null);
    markUploading(1);
    try {
      setStep("Obtendo localização...");
      const position = gpsRef.current
        ? await waitFor(gpsRef.current, GPS_WAIT_MS, null)
        : null;

      const visitInput = {
        id: visitId,
        latitude: position?.lat,
        longitude: position?.lng,
        accuracy: position?.accuracy,
      };
      const photoInput = {
        storeId,
        visitId,
        capturedAt: current.capturedAt,
        latitude: position?.lat,
        longitude: position?.lng,
        accuracy: position?.accuracy,
        locationStatus: position
          ? ("success" as const)
          : ("unavailable" as const),
        imageBase64: current.base64,
        mimeType: "image/jpeg",
        idempotencyKey: current.idempotencyKey,
      };

      setStep(
        action === "start"
          ? "Registrando check-in e enviando foto..."
          : "Registrando check-out e enviando foto..."
      );
      // Em paralelo: antes eram duas esperas em sequência.
      const [visitResult, photoResult] = await Promise.allSettled([
        withTimeout(VISIT_TIMEOUT_MS, signal =>
          action === "start"
            ? client.operations.visits.start.mutate(visitInput, { signal })
            : client.operations.visits.complete.mutate(visitInput, { signal })
        ),
        withTimeout(PHOTO_TIMEOUT_MS, signal =>
          client.storePhotos.uploadAndCreate.mutate(photoInput, { signal })
        ),
      ]);

      const label = action === "start" ? "Check-in" : "Check-out";

      if (visitResult.status === "rejected") {
        if (!isRetryableError(visitResult.reason)) {
          // O servidor recusou (permissão, visita inexistente...). Não é falta de internet: mostra o motivo e deixa tentar de novo.
          setError(
            errorMessage(
              visitResult.reason,
              `Não foi possível registrar o ${label.toLowerCase()}.`
            )
          );
          return;
        }
        // Sem conexão/timeout: guarda tudo (com a mesma chave da foto) para sincronizar depois.
        enqueueVisit({
          action,
          visitId,
          storeId,
          storeName,
          photoBase64: current.base64,
          mimeType: "image/jpeg",
          latitude: position?.lat,
          longitude: position?.lng,
          accuracy: position?.accuracy,
          idempotencyKey: current.idempotencyKey,
          capturedAt: current.capturedAt,
        });
        toast.info("Salvo offline. Será sincronizado ao voltar a conexão.");
        onDone();
        return;
      }

      if (photoResult.status === "rejected") {
        // Check-in já está salvo; a foto não pode se perder.
        enqueuePhoto({
          storeId,
          visitId,
          capturedAt: current.capturedAt,
          latitude: position?.lat,
          longitude: position?.lng,
          accuracy: position?.accuracy,
          locationStatus: photoInput.locationStatus,
          imageBase64: current.base64,
          mimeType: "image/jpeg",
          idempotencyKey: current.idempotencyKey,
        });
        toast.success(`${label} realizado.`);
        toast.info("A foto será enviada assim que possível.");
        onDone();
        return;
      }

      toast.success(`${label} realizado.`);
      onDone();
    } catch (err) {
      // Qualquer falha inesperada vira mensagem na tela, nunca tela em branco.
      console.error("Falha no check-in/check-out", err);
      setError(
        errorMessage(err, "Algo deu errado. Tente confirmar novamente.")
      );
    } finally {
      markUploading(-1);
      submittingRef.current = false;
      setBusy(false);
      setStep("");
    }
  };

  const accent =
    action === "start"
      ? "bg-teal-500 hover:bg-teal-400"
      : "bg-amber-500 hover:bg-amber-400";
  const locked = busy || processing;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-busy={locked}
    >
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-5">
        <h2 className="text-lg font-bold text-white">
          {action === "start" ? "Check-in" : "Check-out"} — {storeName}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Tire uma foto da fachada da loja para confirmar.
        </p>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={onFile}
        />

        {processing ? (
          <div
            className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/60 p-6 text-sm text-slate-200"
            role="status"
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Processando foto...
          </div>
        ) : !shot ? (
          <Button
            onClick={capture}
            className={`mt-4 w-full gap-2 text-slate-950 ${accent}`}
          >
            <Camera className="h-5 w-5" /> Tirar foto da fachada
          </Button>
        ) : (
          <div className="mt-4">
            <img
              src={shot.previewUrl}
              alt="Fachada"
              className="max-h-[50vh] w-full rounded-xl bg-black object-contain"
            />
            {busy && (
              <p className="mt-3 text-center text-sm text-slate-300">
                Enviando foto e registrando o{" "}
                {action === "start" ? "check-in" : "check-out"}...
              </p>
            )}
            {error && !busy && (
              <div className="mt-3 flex gap-2">
                <Button
                  onClick={capture}
                  variant="outline"
                  className="flex-1"
                  disabled={locked}
                >
                  Tirar outra
                </Button>
                <Button
                  onClick={() => void confirm()}
                  disabled={locked}
                  className={`flex-1 gap-2 text-slate-950 ${accent}`}
                >
                  <Loader2 className="h-4 w-4" /> Tentar envio
                </Button>
              </div>
            )}
          </div>
        )}

        {busy && step && (
          <p
            className="mt-3 flex items-center justify-center gap-2 text-xs font-medium text-teal-200"
            role="status"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {step}
          </p>
        )}

        {error && !busy && (
          <p
            className="mt-3 flex items-start gap-2 rounded-lg border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </p>
        )}

        <Button
          onClick={onCancel}
          variant="ghost"
          className="mt-3 w-full text-slate-400"
          disabled={busy}
        >
          <X className="mr-2 h-4 w-4" /> Cancelar
        </Button>
      </div>
    </div>
  );
}
