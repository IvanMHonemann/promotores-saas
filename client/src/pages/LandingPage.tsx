import { useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Marketing entry: documento HTML estático independente (sem iframe).
 * O SPA React só carrega de verdade no painel autenticado e rotas /planos, /cadastro etc.
 */
export default function LandingPage() {
  useEffect(() => {
    const qs = typeof window !== "undefined" ? window.location.search : "";
    const extra = qs && qs !== "?" ? "&" + qs.slice(1) : "";
    const target = `/landing-site.html?v=landing-auditoria-20261007${extra}`;
    window.location.replace(target);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#060918] text-white">
      <Loader2 className="h-7 w-7 animate-spin text-red-500" />
      <p className="text-sm text-slate-400">Carregando Extinfy…</p>
    </div>
  );
}
