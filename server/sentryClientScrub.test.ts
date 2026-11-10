import { describe, expect, it } from "vitest";
import { scrubBreadcrumb, scrubClientEvent } from "../client/src/sentryScrub";

describe("Sentry do navegador: sem dados pessoais", () => {
  it("filtra cabeçalhos, corpo, usuário e query string", () => {
    const e = scrubClientEvent({
      request: { url: "https://gondup.com/api/trpc/auth.login?batch=1&input=%7B%22password%22%3A%22x%22%7D", headers: { Authorization: "Bearer abc", "x-session-token": "t", Accept: "json" }, data: { email: "a@b.c", password: "123", cpf: "111", nome: "ok" }, cookies: "member_session_id=1" },
      user: { id: 7, email: "a@b.c", ip_address: "1.2.3.4" },
      extra: { token: "t", nested: { senha: "s", ok: 1 } },
    });
    expect(e.request.url).toBe("https://gondup.com/api/trpc/auth.login?[Filtered]");
    expect(e.request.headers).toEqual({ Authorization: "[Filtered]", "x-session-token": "[Filtered]", Accept: "json" });
    expect(e.request.data).toEqual({ email: "[Filtered]", password: "[Filtered]", cpf: "[Filtered]", nome: "ok" });
    expect(e.request.cookies).toBe("[Filtered]");
    expect(e.user).toEqual({ id: 7 });
    expect(e.extra).toEqual({ token: "[Filtered]", nested: { senha: "[Filtered]", ok: 1 } });
  });
  it("breadcrumbs de fetch/navegação sem query string", () => {
    const b = scrubBreadcrumb({ category: "fetch", data: { url: "/api/trpc/x?input=%7B%22cpf%22%7D", method: "GET", status_code: 200 } });
    expect(b.data).toEqual({ url: "/api/trpc/x?[Filtered]", method: "GET", status_code: 200 });
    const n = scrubBreadcrumb({ category: "navigation", data: { from: "/login?email=a@b.c", to: "/" } });
    expect(n.data).toEqual({ from: "/login?[Filtered]", to: "/" });
    expect(scrubBreadcrumb(null)).toBeNull();
  });
});
