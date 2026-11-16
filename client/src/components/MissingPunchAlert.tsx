import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  cartaoPontoHref,
  missingPunchNotifyMessage,
  missingPunchStaffLabel,
  missingPunchWhatsAppUrl,
} from "@shared/missingPunchNotify";

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

/** Alerta de batida faltante: ao promotor (para corrigir) e ao administrador/supervisor (para notificar). Não cria marcações. */
export default function MissingPunchAlert() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "company_admin" || role === "supervisor";
  const isField = role === "promoter"; // supervisor não bate ponto
  const entitlements = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    staleTime: 60_000,
    retry: false,
  });
  const hasTimeTracking = Boolean(entitlements.data?.effective?.timeTracking);
  const mine = trpc.timeTracking.myMissingPunch.useQuery(undefined, { enabled: isField && hasTimeTracking, staleTime: 15_000, refetchOnWindowFocus: true, retry: false });
  const all = trpc.timeTracking.companyMissingPunches.useQuery(undefined, { enabled: isAdmin && hasTimeTracking, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false });

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
          <a href={`/ponto?date=${mine.data.day}#correcoes`} className="mt-1 inline-block font-semibold underline">Solicitar correção</a>
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
      <div role="alert" className="relative mb-5 flex items-start gap-3 overflow-hidden rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 pr-14 text-amber-100">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-bold">Falta de batida: {missingPunchStaffLabel(all.data.length)}</p>
          <ul className="mt-2 space-y-3">
            {all.data.slice(0, 8).map((m) => {
              const message = missingPunchNotifyMessage({
                name: m.name,
                day: m.day,
                missing: m.missing,
                lastLabel: m.lastLabel,
                lastTime: m.lastTime,
              });
              const href = missingPunchWhatsAppUrl((m as { phone?: string | null }).phone, message);
              return (
                <li key={m.memberId} className="min-w-0">
                  <p className="break-words">
                    <a href={cartaoPontoHref(m.memberId, m.day)} className="font-semibold underline underline-offset-2 hover:text-white">
                      {m.name}
                    </a>
                    {" — "}última: {m.lastLabel} em {fmt(m.lastTime)}; falta: {m.missing}
                  </p>
                  {href ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex h-9 items-center rounded-lg bg-teal-300 px-3 text-sm font-bold text-slate-950 hover:bg-teal-200"
                    >
                      Notificar promotor
                    </a>
                  ) : (
                    <p className="mt-1">
                      <button
                        type="button"
                        disabled
                        title="Cadastre o WhatsApp do promotor"
                        className="inline-flex h-9 cursor-not-allowed items-center rounded-lg bg-white/10 px-3 text-sm font-bold text-amber-100/50"
                      >
                        Notificar promotor
                      </button>
                      <span className="mt-1 block text-xs text-amber-100/80">Cadastre o WhatsApp do promotor</span>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
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
