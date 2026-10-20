import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ACT_AS_KEY = "promotores-saas-act-as";
export function readActAs(): { id: number; name: string } | null {
  try { const v = JSON.parse(localStorage.getItem(ACT_AS_KEY) || "null"); return v?.id ? v : null; } catch { return null; }
}
export function enterCompany(id: number, name: string) {
  try { localStorage.setItem(ACT_AS_KEY, JSON.stringify({ id, name })); localStorage.removeItem("promotores-saas-auth-user"); } catch { /* ignora */ }
  window.location.href = "/";
}
export function exitCompany() {
  try { localStorage.removeItem(ACT_AS_KEY); localStorage.removeItem("promotores-saas-auth-user"); } catch { /* ignora */ }
  window.location.href = "/admin/empresas";
}

/** Faixa fixa quando o administrador da plataforma está agindo dentro de uma empresa. */
export default function ActingAsBanner() {
  const act = readActAs();
  if (!act) return null;
  return <div role="status" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-400/10 p-3 text-sm text-fuchsia-100">
    <span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4" />Você está acessando <b>{act.name}</b> como administrador da plataforma. Tudo o que fizer fica registrado na auditoria.</span>
    <Button size="sm" onClick={exitCompany} className="bg-fuchsia-300 text-slate-950 hover:bg-fuchsia-200">Voltar à plataforma</Button>
  </div>;
}
