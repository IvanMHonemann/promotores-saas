import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Building2, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function storageKey() {
  return `gondup-registry-banner:${todayKey()}`;
}

/** Lembrete discreto só para o administrador, dispensável no dia, nunca em /dados-empresa. */
export default function CompanyRegistryBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const isAdmin = user?.role === "company_admin";
  const hiddenPage = location.startsWith("/dados-empresa");
  const status = trpc.registry.status.useQuery(undefined, { enabled: isAdmin && !hiddenPage, staleTime: 60_000 });
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try { setDismissed(localStorage.getItem(storageKey()) === "1"); } catch { /* ignore */ }
  }, []);
  if (!isAdmin || hiddenPage || dismissed || !status.data || status.data.complete) return null;
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(storageKey(), "1"); } catch { /* ignore */ }
  };
  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-xl border border-teal-400/30 bg-teal-500/10 px-3 py-2 text-sm text-teal-50 sm:mx-6" role="status">
      <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
      <p className="flex-1">
        Complete os dados da empresa ({status.data.missing.join(", ")}) para os documentos saírem preenchidos.{" "}
        <a href="/dados-empresa" className="font-bold text-teal-200 underline">Abrir Dados da empresa</a>
      </p>
      <button type="button" onClick={dismiss} className="rounded-md p-1 text-teal-100 hover:bg-white/10" aria-label="Dispensar hoje">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
