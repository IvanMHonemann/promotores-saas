import { useEffect, useState } from "react";
import { Camera, Building2, ShieldAlert, Sparkles, Wallet, CalendarDays, ClipboardList, FileText, Clock3, CreditCard, LayoutDashboard, LogOut, MapPin, Menu, Package, Trash2, UserRound, UsersRound, X, Archive, ChevronDown, ChevronsLeft, Palmtree } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useInstallPrompt } from "@/pwa/hooks";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/BrandLogo";
import { trpc } from "@/lib/trpc";
import type { EntitlementKey } from "@shared/entitlements";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/sidebarState";
import { Skeleton } from "@/components/ui/skeleton";

const roleLabels: Record<string, string> = {
  platform_admin: "Administrador geral",
  company_admin: "Administrador da empresa",
  supervisor: "Supervisor",
  promoter: "Promotor",
};

type NavItem = {
  href?: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavItem[];
};

function InstallButton() {
  const { canInstall, install, isInstalling, isIosInstallable, isStandalone } = useInstallPrompt();
  if (isStandalone || (!canInstall && !isIosInstallable)) return null;
  return (
    <button
      type="button"
      disabled={isInstalling}
      onClick={() => canInstall ? void install() : alert("No iPhone: toque em Compartilhar e depois em Adicionar à Tela de Início.")}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-400 to-emerald-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-teal-500/20 transition hover:from-teal-300 hover:to-emerald-300 disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      {isInstalling ? "Instalando..." : "Instalar aplicativo"}
    </button>
  );
}

export function SidebarNav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const collapsed = useSidebarCollapsed();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
  // Enquanto os módulos não carregam, mostramos um carregamento no lugar do menu (evita o menu reduzido no primeiro acesso).
  const loadingModules = role !== "platform_admin" && Boolean(user) && entitlements.isLoading && !entitlements.data;
  const hasFeature = (key: EntitlementKey) => Boolean(entitlements.data?.effective?.[key]);
  const toggle = (label: string) => setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

  const links: NavItem[] = role === "platform_admin"
    ? [
        { href: "/", label: "Visão geral", icon: LayoutDashboard },
        { href: "/admin/empresas", label: "Empresas", icon: Building2 },
        { href: "/admin/usuarios", label: "Usuários", icon: UsersRound },
        { href: "/admin/auditoria", label: "Auditoria geral", icon: ClipboardList },
        { href: "/plataforma/ponto", label: "Ponto eletrônico (teste)", icon: Clock3 },
        { href: "/plataforma/teste-check-in-out", label: "Testar check-in / check-out", icon: Camera },
        { href: "/plataforma/scanner", label: "Scanner e erros", icon: ShieldAlert },
        { href: "/plataforma/ia", label: "Suporte com IA", icon: Sparkles },
      ]
    : role === "promoter"
      ? [
          { href: "/", label: "Painel inicial", icon: LayoutDashboard },
          { href: "/produtos", label: "Produtos e validades", icon: Package },
          ...(hasFeature("timeTracking") ? [
            { href: "/ponto", label: "Cartão ponto", icon: Clock3 },
            { href: "/ponto#correcoes", label: "Correções de ponto", icon: ClipboardList },
            { href: "/minhas-ferias", label: "Minhas férias", icon: Palmtree },
          ] : []),
          { href: "/lojas", label: "Lojas", icon: MapPin },
          { href: "/#roteiro", label: "Meu roteiro", icon: ClipboardList },
          { href: "/lixeira", label: "Lixeira", icon: Trash2 },
        ]
      : [
          { href: "/#inicio", label: "Visão geral", icon: LayoutDashboard },
          ...(role ? [{ href: "/produtos", label: "Produtos e validades", icon: Package }] : []),
          ...(hasFeature("fieldOperations") ? [
            { href: "/lojas", label: "Lojas", icon: MapPin },
            {
              label: "Roteiros",
              icon: CalendarDays,
              children: [
                { href: "/#roteiros", label: "Ver / editar roteiros", icon: CalendarDays },
                ...(role === "company_admin" && hasFeature("reports") ? [{ href: "/check-in-out", label: "Check-in / Check-out", icon: Camera }] : []),
              ],
            },
          ] : []),
          ...(hasFeature("timeTracking") ? [{
            label: "Cartão-ponto",
            icon: Clock3,
            children: [
              { href: "/cartao-ponto", label: "Visualizar ponto", icon: Clock3 },
              ...(role === "company_admin" && hasFeature("timeTracking") ? [{ href: "/espelho-ponto", label: "Espelho de ponto", icon: FileText }] : []),
              { href: "/ferias", label: "Férias", icon: Palmtree },
            ],
          }] : []),
          ...(role === "company_admin" && hasFeature("timeTracking") ? [{ href: "/arquivos-historicos", label: "Arquivos históricos", icon: Archive }] : []),
          { href: "/lixeira", label: "Lixeira", icon: Trash2 },
          ...(role === "company_admin" && hasFeature("teamManagement") ? [{ href: "/admin/usuarios", label: "Promotores e equipe", icon: UsersRound }] : []),
          ...(role === "company_admin" && hasFeature("reports") ? [{ href: "/auditoria", label: "Auditoria", icon: ClipboardList }] : []),
          ...(role === "company_admin" ? [{ href: "/meus-modulos", label: "Meus módulos", icon: CreditCard }] : []),
        ];

  const close = () => setOpen(false);

  return <>
    {open && <button type="button" className={`fixed inset-0 z-40 bg-slate-950/75 ${collapsed ? "" : "lg:hidden"}`} onClick={close} aria-label="Fechar menu" />}
    <aside className={`${open ? "translate-x-0" : collapsed ? "-translate-x-full" : "-translate-x-full lg:translate-x-0"} fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col overflow-y-auto border-r border-white/10 bg-[#091525] p-5 shadow-2xl transition-transform ${collapsed ? "" : "lg:shadow-none"}`}>
      <div className="flex items-center justify-between"><BrandLogo height={40} /><div className="flex items-center gap-1">{!collapsed && <button type="button" className="hidden rounded-lg p-2 text-slate-300 hover:bg-white/10 lg:block" onClick={() => setSidebarCollapsed(true)} aria-label="Recolher menu" title="Recolher menu"><ChevronsLeft className="h-5 w-5" /></button>}<button type="button" className={`rounded-lg p-2 text-slate-300 hover:bg-white/10 ${collapsed ? "" : "lg:hidden"}`} onClick={close} aria-label="Fechar menu"><X className="h-5 w-5" /></button></div></div>
      <div className="mt-9 rounded-2xl border border-teal-300/20 bg-gradient-to-br from-teal-300/15 to-transparent p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-teal-300 font-black text-slate-950">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{user?.name || "Usuário"}</p><p className="truncate text-xs text-slate-300">{roleLabels[role || ""] || "Usuário"}</p></div></div><div className="mt-4 flex items-center gap-2 text-xs text-teal-200"><span className="h-2 w-2 rounded-full bg-teal-300 shadow-[0_0_12px_#5eead4]" /> Sistema operacional</div></div>
      <nav className="mt-8 space-y-1.5">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">Navegação</p>
        {loadingModules && <div role="status" aria-label="Carregando menu" className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 w-full rounded-xl bg-white/10" />)}</div>}
        {!loadingModules && links.map((item) => {
          if (item.children && item.children.length > 0) {
            const isOpen = !!expanded[item.label];
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggle(item.label)}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"
                >
                  <Icon className="h-[18px] w-[18px] text-teal-300" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="ml-8 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <a
                          key={child.href || child.label}
                          href={child.href}
                          onClick={close}
                          className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"
                        >
                          {ChildIcon && <ChildIcon className="h-4 w-4 text-teal-300" />}
                          {child.label}
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }
          const Icon = item.icon;
          return (
            <a
              key={item.href}
              href={item.href}
              onClick={close}
              className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/[.06] hover:text-white"
            >
              <Icon className="h-[18px] w-[18px] text-teal-300" />
              {item.label}
            </a>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-white/10 pt-4">
        <InstallButton />
      </div>
    </aside>
  </>;
}

export function SidebarMenuButton() {
  const collapsed = useSidebarCollapsed();
  const onClick = () => {
    // Em tela larga com o menu recolhido, o botão restaura o menu fixo; nas demais, abre o menu sobreposto.
    if (collapsed && window.matchMedia("(min-width: 1024px)").matches) setSidebarCollapsed(false);
    else window.dispatchEvent(new Event("promotores:open-sidebar"));
  };
  return <button type="button" className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/10 hover:text-white ${collapsed ? "" : "lg:hidden"}`} onClick={onClick} aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>;
}
