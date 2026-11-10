/**
 * Navegação sem recarregar a página nos links internos (<a href="/...">) do app.
 *
 * Antes, cada toque no menu lateral (e nos atalhos dos cards) recarregava o site inteiro: baixava o HTML de novo,
 * reprocessava o JavaScript e refazia todas as consultas de login/assinatura/módulos em sequência antes de
 * começar a carregar a tela. Agora o link troca só a tela, como os componentes <Link> já faziam, e os dados
 * que já estavam carregados (usuário, módulos, assinatura) aparecem na hora.
 *
 * Continua com recarga normal (comportamento antigo) quando:
 * - o link abre em outra aba, baixa arquivo, é externo ou tem Ctrl/Cmd/Shift/Alt/botão do meio;
 * - é a mesma tela (só muda ?filtros ou #seção): o navegador trata como antes;
 * - é rota especial (/reset, /clean, /api, teste de check-in da plataforma, arquivos com extensão).
 */
// /plataforma/teste-check-in-out limpa a sessão de "acessar como empresa" no carregamento (main.tsx): segue recarregando.
const NATIVE_PREFIXES = ["/api/", "/reset", "/clean", "/assets/", "/plataforma/teste-check-in-out"];

export function shouldHandleInApp(anchor: HTMLAnchorElement, event: Pick<MouseEvent, "defaultPrevented" | "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">, current: { origin: string; pathname: string }): URL | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  if ((anchor.getAttribute("rel") || "").split(/\s+/).includes("external")) return null;
  if (anchor.dataset.nativeNav !== undefined) return null;
  const raw = anchor.getAttribute("href") || "";
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  let url: URL;
  try { url = new URL(raw, current.origin); } catch { return null; }
  if (url.origin !== current.origin) return null;
  if (NATIVE_PREFIXES.some((p) => url.pathname === p.replace(/\/$/, "") || url.pathname.startsWith(p))) return null;
  if (/\.[a-z0-9]{2,5}$/i.test(url.pathname)) return null;
  // Mesma tela (só filtro/âncora mudou): deixa o navegador seguir como sempre fez.
  if (url.pathname === current.pathname) return null;
  return url;
}

/** Depois de trocar de tela com #seção, rola até a seção quando ela aparecer (até ~3 s, enquanto os dados chegam). */
export function scrollToHashWhenReady(hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (!id) return;
  const started = Date.now();
  const tick = () => {
    if (window.location.hash !== hash) return;
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if (Date.now() - started < 3000) window.setTimeout(tick, 100);
  };
  window.setTimeout(tick, 50);
}

export function installSpaNavigation(navigate: (to: string) => void): () => void {
  const onClick = (event: MouseEvent) => {
    const el = event.target as Element | null;
    const anchor = el && typeof el.closest === "function" ? (el.closest("a[href]") as HTMLAnchorElement | null) : null;
    if (!anchor) return;
    const url = shouldHandleInApp(anchor, event, { origin: window.location.origin, pathname: window.location.pathname });
    if (!url) return;
    event.preventDefault();
    navigate(url.pathname + url.search + url.hash);
    if (url.hash) scrollToHashWhenReady(url.hash);
    else window.scrollTo(0, 0);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
