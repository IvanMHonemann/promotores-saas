import { recordServerDate } from "./clockAnchor";

/** fetch com o token de sessão e o modo "acessar como empresa" (mesmo usado pelo tRPC). */
export function authFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers || {});
  const token = typeof localStorage !== "undefined" ? localStorage.getItem("promotores-saas-session-token") : null;
  if (token) {
    headers.set("x-session-token", token);
    headers.set("Authorization", `Bearer ${token}`);
  }
  try {
    const actAs = JSON.parse(localStorage.getItem("promotores-saas-act-as") || "null");
    if (actAs?.id) headers.set("x-act-as-company", String(actAs.id));
  } catch { /* sem modo "acessar como empresa" */ }
  return globalThis.fetch(input, { ...(init ?? {}), headers, credentials: "include" }).then((response) => {
    try { recordServerDate(response.headers.get("date")); } catch { /* ignore */ }
    return response;
  });
}
