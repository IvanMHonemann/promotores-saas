import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

function useDismiss(key: string | null) {
  const storageKey = key ? `dismissed-alert:${key}` : null;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!storageKey) return;
    try { setDismissed(localStorage.getItem(storageKey) === "1"); } catch { /* ignore */ }
  }, [storageKey]);
  const dismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    }
  };
  return { dismissed, dismiss };
}

/** Alerta de batida faltante: ao promotor (para corrigir) e ao administrador (para acompanhar). Não cria marcações. */
export default function MissingPunchAlert() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "company_admin";
  const isField = role === "promoter" || role === "supervisor";
  const mine = trpc.timeTracking.myMissingPunch.useQuery(undefined, { enabled: isField, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false });
  const all = trpc.timeTracking.companyMissingPunches.useQuery(undefined, { enabled: isAdmin, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false });

  const fieldKey = mine.data ? `missing-punch:${mine.data.memberId}:${mine.data.lastTime}` : null;
  const adminKey = all.data?.length
    ? `missing-punch-admin:${all.data.map((m) => `${m.memberId}:${m.lastTime}`).sort().join("|")}`
    : null;
  const fieldDismiss = useDismiss(isField ? fieldKey : null);
  const adminDismiss = useDismiss(isAdmin ? adminKey : null);

  if (isField && mine.data && !fieldDismiss.dismissed) {
    return (
      <div role="alert" className="relative mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 pr-14 text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Falta uma batida no seu cartão ponto</p>
          <p>Última marcação: {mine.data.lastLabel} em {fmt(mine.data.lastTime)}. Falta registrar: {mine.data.missing}.</p>
          <a href="/ponto#correcoes" className="mt-1 inline-block font-semibold underline">Solicitar correção</a>
        </div>
        <button
          type="button"
          onClick={fieldDismiss.dismiss}
          aria-label="Fechar alerta"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-amber-200/40 bg-amber-400/20 text-amber-50 transition hover:bg-amber-400/40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }
  if (isAdmin && all.data?.length && !adminDismiss.dismissed) {
    return (
      <div role="alert" className="relative mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 pr-14 text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Falta de batida: {all.data.length} funcionário(s)</p>
          <ul className="mt-1 space-y-0.5">{all.data.slice(0, 8).map((m) => <li key={m.memberId}>{m.name} — última: {m.lastLabel} em {fmt(m.lastTime)}; falta: {m.missing}</li>)}</ul>
          <a href="/cartao-ponto" className="mt-1 inline-block font-semibold underline">Abrir cartão-ponto</a>
        </div>
        <button
          type="button"
          onClick={adminDismiss.dismiss}
          aria-label="Fechar alerta"
          className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-amber-200/40 bg-amber-400/20 text-amber-50 transition hover:bg-amber-400/40"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    );
  }
  return null;
}
