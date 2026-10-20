import { AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/** Alerta de batida faltante: ao promotor (para corrigir) e ao administrador (para acompanhar). Não cria marcações. */
export default function MissingPunchAlert() {
  const { user } = useAuth();
  const role = user?.role;
  const isAdmin = role === "company_admin";
  const isField = role === "promoter" || role === "supervisor";
  const mine = trpc.timeTracking.myMissingPunch.useQuery(undefined, { enabled: isField, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false });
  const all = trpc.timeTracking.companyMissingPunches.useQuery(undefined, { enabled: isAdmin, staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false, retry: false });
  if (isField && mine.data) {
    return <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="text-sm"><p className="font-bold">Falta uma batida no seu cartão ponto</p><p>Última marcação: {mine.data.lastLabel} em {fmt(mine.data.lastTime)}. Falta registrar: {mine.data.missing}.</p><a href="/ponto#correcoes" className="mt-1 inline-block font-semibold underline">Solicitar correção</a></div></div>;
  }
  if (isAdmin && all.data?.length) {
    return <div role="alert" className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div className="text-sm"><p className="font-bold">Falta de batida: {all.data.length} funcionário(s)</p><ul className="mt-1 space-y-0.5">{all.data.slice(0, 8).map((m) => <li key={m.memberId}>{m.name} — última: {m.lastLabel} em {fmt(m.lastTime)}; falta: {m.missing}</li>)}</ul><a href="/cartao-ponto" className="mt-1 inline-block font-semibold underline">Abrir cartão-ponto</a></div></div>;
  }
  return null;
}
