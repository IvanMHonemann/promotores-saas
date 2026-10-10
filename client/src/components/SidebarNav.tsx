import { useState } from "react";
import { CalendarDays, ClipboardList, Clock3, LayoutDashboard, LogOut, Menu, UserRound, UsersRound, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";

const roleLabels: Record<string, string> = {
  platform_admin: "Administrador geral",
  company_admin: "Administrador da empresa",
  supervisor: "Supervisor",
  promoter: "Promotor",
};

export function SidebarNav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const isPromoter = user?.role === "promoter";
  const isAdmin = user?.role === "company_admin";
  const links = isPromoter
    ? [
        { href: "/#ponto", label: "Ponto eletrônico", icon: Clock3 },
        { href: "/#inicio", label: "Visão geral", icon: LayoutDashboard },
        { href: "/#historico", label: "Histórico e GPS", icon: CalendarDays },
        { href: "/#roteiro", label: "Meu roteiro", icon: ClipboardList },
        { href: "/#correcoes", label: "Correções de ponto", icon: ClipboardList },
      ]
    : [
        { href: "/#inicio", label: "Visão geral", icon: LayoutDashboard },
        { href: "/#roteiros", label: "Roteiros", icon: ClipboardList },
        { href: "/#visitas", label: "Visitas", icon: CalendarDays },
        ...(isAdmin ? [{ href: "/admin/usuarios", label: "Equipe e usuários", icon: UsersRound }] : []),
        ...(isAdmin ? [{ href: "/auditoria", label: "Auditoria", icon: ClipboardList }] : []),
      ];
  const close = () => setOpen(false);
  return <>
    <div className="flex h-14 items-center px-4 lg:hidden"><button type="button" className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/10 hover:text-white" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button><span className="ml-3 text-sm font-semibold text-slate-300">Menu da operação</span></div>
    {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/75 lg:hidden" onClick={close} aria-label="Fechar menu" />}
    <aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#091525] p-5 shadow-2xl transition-transform lg:translate-x-0`}>
      <div className="flex items-center justify-between"><div><p className="text-sm font-black tracking-wide text-teal-200">PROMOTORES</p><p className="text-xs font-semibold tracking-[.25em] text-slate-400">SaaS</p></div><button type="button" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={close} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <div className="mt-8 rounded-2xl border border-teal-300/20 bg-teal-300/10 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300 text-lg font-black text-slate-950">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name || "Usuário"}</p><p className="truncate text-xs text-slate-300">{roleLabels[user?.role || ""] || "Usuário"}</p></div></div></div>
      <nav className="mt-7 space-y-1.5">{links.map(({ href, label, icon: Icon }) => <a key={href} href={href} onClick={close} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.08] hover:text-white"><Icon className="h-[18px] w-[18px] text-teal-300" />{label}</a>)}<a href="/minha-conta" onClick={close} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.08] hover:text-white"><UserRound className="h-[18px] w-[18px] text-teal-300" />Minha conta</a></nav>
      <div className="mt-auto border-t border-white/10 pt-4"><Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div>
    </aside>
  </>;
}
