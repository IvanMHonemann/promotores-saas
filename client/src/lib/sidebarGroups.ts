/** Grupos do menu lateral da empresa (administrador/supervisor), testáveis sem React. */
export type GroupItem = { href: string; label: string; icon: string };
export type NavGroup = { id: string; title: string; items: GroupItem[] };

export function buildCompanyGroups(role: string | undefined, hasFeature: (key: string) => boolean): { groups: NavGroup[]; account: NavGroup } {
  const admin = role === "company_admin";
  const field = hasFeature("fieldOperations");
  const checkIn = hasFeature("visitCheckIn");
  const time = hasFeature("timeTracking");
  const groups: NavGroup[] = [
    { id: "operacao", title: "Operação", items: [
      { href: "/#inicio", label: "Visão geral", icon: "dashboard" },
      ...(field ? [{ href: "/lojas", label: "Lojas", icon: "store" }, { href: "/#roteiros", label: "Roteiros", icon: "calendar" }] : []),
      ...(field && checkIn && admin && hasFeature("reports") ? [{ href: "/check-in-out", label: "Check-in / Check-out", icon: "camera" }] : []),
      ...(role && hasFeature("products") ? [{ href: "/produtos", label: "Produtos e validades", icon: "package" }] : []),
    ] },
    { id: "equipe", title: time ? "Equipe e ponto" : "Equipe", items: [
      ...(admin && hasFeature("teamManagement") ? [{ href: "/admin/usuarios", label: "Promotores e equipe", icon: "users" }] : []),
      ...(time ? [{ href: "/cartao-ponto", label: "Cartão-ponto", icon: "clock" }] : []),
      ...(time && admin ? [{ href: "/banco-de-horas", label: "Banco de horas", icon: "clock" }] : []),
      ...(time && admin ? [{ href: "/espelho-ponto", label: "Espelho de ponto", icon: "file" }] : []),
      ...(time ? [{ href: "/ferias", label: "Férias", icon: "palm" }] : []),
    ] },
    { id: "relatorios", title: "Relatórios", items: [
      ...(admin && hasFeature("reports") ? [{ href: "/auditoria", label: "Auditoria", icon: "audit" }] : []),
      ...(admin && time ? [{ href: "/ponto-legal", label: "Ponto: prova legal", icon: "shield" }] : []),
      ...(admin && time ? [{ href: "/arquivos-historicos", label: "Arquivos históricos", icon: "archive" }] : []),
    ] },
  ];
  const account: NavGroup = { id: "conta", title: "Conta", items: [
    ...(admin ? [{ href: "/lgpd", label: "LGPD e privacidade", icon: "shield" }] : []),
    ...(admin ? [{ href: "/meus-modulos", label: "Meus módulos", icon: "card" }] : []),
    { href: "/lixeira", label: "Lixeira", icon: "trash" },
  ] };
  return { groups: groups.filter((g) => g.items.length > 0), account };
}

/** Item ativo para a rota atual (pathname + hash). */
export function isItemActive(href: string, pathname: string, hash: string): boolean {
  const [path, frag] = href.split("#");
  if (href === "/#inicio") return pathname === "/" && (hash === "" || hash === "#" || hash === "#inicio");
  if (frag) return pathname === (path || "/") && hash === `#${frag}`;
  const pathMatch = pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));
  if (!pathMatch) return false;
  // Link sem âncora não fica ativo quando a mesma tela está numa seção (#correcoes, #roteiro).
  const section = hash && hash !== "#";
  return !section;
}

export const GROUPS_STORAGE_KEY = "gondup:sidebar-groups";
export function loadGroupState(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY) || "{}"); } catch { return {}; }
}
export function saveGroupState(state: Record<string, boolean>) {
  try { localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Item do menu do promotor (com grupo opcional, ex.: Cartão ponto). */
export type PromoterNavItem = { href?: string; label: string; icon: string; children?: GroupItem[] };

/** Menu do promotor. Funções de ponto pessoal ficam no dropdown "Cartão ponto". */
export function buildPromoterNav(hasFeature: (key: string) => boolean): PromoterNavItem[] {
  return [
    { href: "/", label: "Painel inicial", icon: "dashboard" },
    ...(hasFeature("products") ? [{ href: "/produtos", label: "Produtos e validades", icon: "package" }] : []),
    ...(hasFeature("timeTracking") ? [
      {
        label: "Cartão ponto",
        icon: "clock",
        children: [
          { href: "/ponto", label: "Cartão ponto", icon: "clock" },
          { href: "/ponto#correcoes", label: "Correções de ponto", icon: "audit" },
          { href: "/meus-comprovantes", label: "Meus comprovantes", icon: "file" },
          { href: "/meu-espelho", label: "Meu espelho do mês", icon: "file" },
        ],
      },
      { href: "/minhas-ferias", label: "Minhas férias", icon: "palm" },
    ] : []),
    { href: "/meus-dados", label: "Meus dados (LGPD)", icon: "shield" },
    { href: "/lojas", label: "Lojas", icon: "store" },
    { href: "/#roteiro", label: "Meu roteiro", icon: "audit" },
    { href: "/lixeira", label: "Lixeira", icon: "trash" },
  ];
}
