/**
 * Estado de conexão real com o servidor.
 *
 * `navigator.onLine` só diz se o aparelho tem alguma rede. Em loja com sinal
 * fraco ele continua `true` enquanto as requisições ficam penduradas. Aqui o app
 * marca o servidor como inacessível quando uma requisição falha por rede ou
 * estoura o tempo, e volta a marcar como acessível quando alguma responde.
 *
 * Mudanças disparam os eventos "online"/"offline" na window, que as telas já escutam.
 */

let serverReachable = true;
let probeTimer: number | null = null;
let dispatching = false;

function emit(type: "online" | "offline") {
  dispatching = true;
  try {
    window.dispatchEvent(new Event(type));
  } finally {
    dispatching = false;
  }
}

function startProbe() {
  if (probeTimer != null || typeof window === "undefined") return;
  probeTimer = window.setInterval(async () => {
    if (!navigator.onLine) return;
    try {
      const ctrl = new AbortController();
      const t = window.setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`/healthz?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
      window.clearTimeout(t);
      if (res.ok) markServerReachable();
    } catch {
      /* continua offline */
    }
  }, 20000);
}

function stopProbe() {
  if (probeTimer != null) window.clearInterval(probeTimer);
  probeTimer = null;
}

export function markServerReachable() {
  if (serverReachable) return;
  serverReachable = true;
  stopProbe();
  emit("online");
}

export function markServerUnreachable() {
  if (!serverReachable) return;
  serverReachable = false;
  startProbe();
  emit("offline");
}

/** true quando o aparelho tem rede E o servidor está respondendo. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine && serverReachable;
}

if (typeof window !== "undefined") {
  // Rede voltou de verdade: tenta de novo com otimismo.
  window.addEventListener("online", () => {
    if (dispatching) return;
    if (!serverReachable) { serverReachable = true; stopProbe(); }
  });
  // Outras partes do app (ex.: useAuth) disparam "offline" quando o servidor não responde.
  window.addEventListener("offline", () => {
    if (dispatching) return;
    if (navigator.onLine && serverReachable) { serverReachable = false; startProbe(); }
  });
}
