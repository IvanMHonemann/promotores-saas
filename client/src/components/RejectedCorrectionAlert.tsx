import { useEffect, useState } from "react";
import { XCircle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { looksLikeFullDayExcuse } from "@shared/correctionExcuse";

const DISMISS_PREFIX = "dismissed-rejected:";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export default function RejectedCorrectionAlert() {
  const { user } = useAuth();
  const [location] = useLocation();
  // Só no Início e no Cartão ponto: nas outras telas o aviso atrapalhava o trabalho.
  const visibleHere = location === "/" || location === "/ponto";
  const isField = user?.role === "promoter" || user?.role === "supervisor";
  const corrections = trpc.timeTracking.myCorrections.useQuery(undefined, {
    enabled: isField && visibleHere,
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

  if (!isField || !visibleHere || !corrections.data?.length) return null;

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

  const entries = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  return (
    <section role="alert" className="mb-5 rounded-2xl border border-rose-400/40 bg-rose-500/10 p-3 text-rose-50">
      <div className="flex items-center gap-2">
        <XCircle className="h-5 w-5 shrink-0 text-rose-300" />
        <p className="flex-1 text-sm font-bold">{entries.length > 1 ? `${entries.length} pedidos de correção recusados` : "Pedido de correção recusado"}</p>
        {entries.length > 1 && <button type="button" onClick={() => dismiss(entries.flatMap(([, items]) => items.map((i) => i.id)))} className="h-11 rounded-lg px-3 text-sm font-semibold text-rose-100 hover:bg-rose-400/20">Fechar todos</button>}
      </div>
      <ul className="mt-1 divide-y divide-rose-300/15">
        {entries.map(([day, items]) => {
          const ids = items.map((item) => item.id);
          const note = items.find((item) => item.reviewNotes)?.reviewNotes;
          const dateLabel = new Date(items[0].requestedTime).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
          const what = items.some((item) => looksLikeFullDayExcuse(item)) ? `Abono de ${dateLabel}` : `${items.length} horário(s) de ${dateLabel}`;
          return (
            <li key={day} className="flex items-center gap-2 py-1.5 text-sm">
              <div className="min-w-0 flex-1">
                <p>{what}</p>
                {note && <p className="text-rose-100/80">Observação: {note}</p>}
              </div>
              <a href={`/ponto?date=${day}#correcoes`} className="inline-flex h-11 shrink-0 items-center rounded-lg px-2 font-semibold underline">Corrigir</a>
              <button type="button" onClick={() => dismiss(ids)} aria-label={`Fechar aviso de ${dateLabel}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-rose-100 hover:bg-rose-400/20"><X className="h-5 w-5" /></button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
