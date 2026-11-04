import { useEffect, useState } from "react";
import { XCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { isFullDayExcuseType } from "@shared/correctionExcuse";

const DISMISS_PREFIX = "dismissed-rejected:";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function RejectedCorrectionAlert() {
  const { user } = useAuth();
  const isField = user?.role === "promoter" || user?.role === "supervisor";
  const corrections = trpc.timeTracking.myCorrections.useQuery(undefined, {
    enabled: isField,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const next = new Set<number>();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(DISMISS_PREFIX)) next.add(Number(key.slice(DISMISS_PREFIX.length)));
      }
    } catch { /* ignore */ }
    setDismissed(next);
  }, [corrections.dataUpdatedAt]);

  if (!isField || !corrections.data?.length) return null;

  const rejected = corrections.data
    .map((row: any) => row.request)
    .filter((request: any) => request?.status === "rejected" && !dismissed.has(request.id));

  if (!rejected.length) return null;

  const groups = new Map<string, any[]>();
  for (const request of rejected) {
    const day = dayKey(request.requestedTime);
    const list = groups.get(day) || [];
    list.push(request);
    groups.set(day, list);
  }

  const dismiss = (ids: number[]) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.add(id);
        try { localStorage.setItem(`${DISMISS_PREFIX}${id}`, "1"); } catch { /* ignore */ }
      }
      return next;
    });
  };

  return (
    <div className="mb-5 space-y-3">
      {[...groups.entries()].map(([day, items]) => {
        const ids = items.map((item) => item.id);
        const note = items.find((item) => item.reviewNotes)?.reviewNotes;
        const dateLabel = new Date(items[0].requestedTime).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
        return (
          <div key={day} role="alert" className="relative flex items-start gap-3 rounded-2xl border border-rose-400/40 bg-rose-500/15 p-4 pr-14 text-rose-50">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-bold">Pedido de correção recusado</p>
              <p className="mt-1">
                {items.some((item) => isFullDayExcuseType(item.justificationType))
                  ? `O pedido de abono de ${dateLabel} foi recusado.`
                  : `${items.length} horário(s) de ${dateLabel} ${items.length > 1 ? "foram recusados" : "foi recusado"}.`}
              </p>
              {note && <p className="mt-1 text-rose-100/90">Observação: {note}</p>}
              <a href={`/ponto?date=${day}#correcoes`} className="mt-1 inline-block font-semibold underline">
                Enviar nova correção
              </a>
            </div>
            <button
              type="button"
              onClick={() => dismiss(ids)}
              aria-label="Fechar aviso"
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-rose-200/40 bg-rose-400/20 text-rose-50 transition hover:bg-rose-400/40"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
