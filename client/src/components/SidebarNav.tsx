import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Clock3, CreditCard, LayoutDashboard, LogOut, MapPin, Menu, Package, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";
import type { EntitlementKey } from "@shared/entitlements";

const roleLabels: Record<string, string> = {
  platform_admin: "Administrador geral",
  company_admin: "Administrador da empresa",
  supervisor: "Supervisor",
  promoter: "Promotor",
};

export function SidebarNav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const entitlements = trpc.entitlements.mine.useQuery(undefined, {
    enabled: Boolean(user && user.role !== "platform_admin"),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });
  useEffect(() => {
    const openMenu = () => setOpen(true);
    window.addEventListener("promotores:open-sidebar", openMenu);
    return () => window.removeEventListener("promotores:open-sidebar", openMenu);
  }, []);
  const role = user?.role;
  const hasFeature = (key: EntitlementKey) => Boolean(entitlements.data?.effective[key]);
  const links = role === "platform_admin"
    ? [
        { href: "/", label: "Visão geral", icon: LayoutDashboard },
        { href: "/admin/usuarios", label: "Empresas e usuários", icon: UsersRound },
        { href: "/admin/assinaturas", label: "Planos e assinaturas", icon: CreditCard },
      ]
    : role === "promoter"
      ? [
          { href: "/", label: "Painel inicial", icon: LayoutDashboard },
          { href: "/produtos", label: "Produtos e validades", icon: Package },
          ...(hasFeature("timeTracking") ? [
            { href: "/ponto", label: "Bater ponto", icon: Clock3 },
            { href: "/ponto#historico", label: "Histórico e GPS", icon: CalendarDays },
            { href: "/ponto#correcoes", label: "Correções de ponto", icon: ClipboardList },
          ] : []),
          { href: "/lojas", label: "Lojas", icon: MapPin },
          { href: "/#roteiro", label: "Meu roteiro", icon: ClipboardList },
        ]
      : [
          { href: "/#inicio", label: "Visão geral", icon: LayoutDashboard },
          ...(role ? [{ href: "/produtos", label: "Produtos e validades", icon: Package }] : []),
          ...(role === "company_admin" ? [{ href: "/lojas", label: "Lojas", icon: MapPin }] : [{ href: "/lojas", label: "Lojas", icon: MapPin }]),
          { href: "/#visitas", label: "Visitas", icon: CalendarDays },
          ...(role === "company_admin" ? [{ href: "/lixeira", label: "Lixeira", icon: Trash2 }] : []),
          ...(role === "company_admin" && hasFeature("teamManagement") ? [{ href: "/admin/usuarios", label: "Promotores e equipe", icon: UsersRound }] : []),
          ...(role === "company_admin" && hasFeature("reports") ? [{ href: "/auditoria", label: "Auditoria", icon: ClipboardList }] : []),
        ];
  const close = () => setOpen(false);
  return <>
    {open && <button type="button" className="fixed inset-0 z-40 bg-slate-950/75 lg:hidden" onClick={close} aria-label="Fechar menu" />}
    <aside className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/10 bg-[#091525] p-5 shadow-2xl transition-transform lg:translate-x-0 lg:shadow-none`}>
      <div className="flex items-center justify-between"><BrandLogo height={40} /><button type="button" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:hidden" onClick={close} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
      <div className="mt-9 rounded-2xl border border-teal-300/20 bg-gradient-to-br from-teal-300/15 to-transparent p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300 font-black text-slate-950">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name || "Usuário"}</p><p className="truncate text-xs text-slate-300">{roleLabels[role || ""] || "Usuário"}</p></div></div><div className="mt-4 flex items-center gap-2 text-xs text-teal-200"><span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_12px_#5eead4]" /> Sistema operacional</div></div>
      <nav className="mt-8 space-y-1.5"><p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Navegação</p>{links.map(({ href, label, icon: Icon }) => <a key={href} href={href} onClick={close} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"><Icon className="h-[18px] w-[18px] text-teal-300" />{label}</a>)}<div className="my-4 border-t border-white/10 pt-4"><a href="/minha-conta" onClick={close} className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"><UserRound className="h-[18px] w-[18px] text-teal-300" />Minha conta</a></div></nav>
      <div className="mt-auto border-t border-white/10 pt-4"><Button variant="ghost" className="w-full justify-start text-slate-300 hover:bg-white/5 hover:text-white" onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" />Sair</Button></div>
    </aside>
  </>;
}

export function SidebarMenuButton() {
  return <button type="button" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => window.dispatchEvent(new Event("promotores:open-sidebar"))} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>;
}
