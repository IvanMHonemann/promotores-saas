import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

const LOCAL_SESSION_KEY = "promotores-saas-auth-user";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function readCachedUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!raw || raw === "null") return null;
    const user = JSON.parse(raw);
    if (!user || typeof user.id !== "number" || typeof user.role !== "string") return null;
    if (user.role === "admin") user.role = "company_admin";
    if (["user", "operator", "technician"].includes(user.role)) user.role = "promoter";
    if (!["platform_admin", "company_admin", "supervisor", "promoter"].includes(user.role)) { localStorage.removeItem(LOCAL_SESSION_KEY); return null; }
    return user;
  } catch {
    return null;
  }
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [cachedUser, setCachedUser] = useState(readCachedUser);

  useEffect(() => {
    const handleOnline = () => {
      setCachedUser(readCachedUser());
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
      setCachedUser(readCachedUser());
    };
    const handleAuthLogout = () => setCachedUser(null);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("promotores-saas:logout", handleAuthLogout);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("promotores-saas:logout", handleAuthLogout);
    };
  }, []);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !isOffline,
    retry: 2,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (meQuery.data) {
      localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(meQuery.data));
      setCachedUser(meQuery.data);
    }
    // Se o servidor rejeitar a sessão (UNAUTHORIZED) e estivermos online,
    // limpa o cache local e força novo login. Isso corrige o caso em que
    // o cookie não é reconhecido na Vercel.
    const code = meQuery.error instanceof TRPCClientError ? meQuery.error.data?.code : undefined;
    const msg = String(meQuery.error?.message || "").toLowerCase();
    if (!isOffline && meQuery.error && (code === "UNAUTHORIZED" || msg.includes("please login") || msg.includes("10001"))) {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setCachedUser(null);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.replace("/login");
      }
      return;
    }
    if (!isOffline && cachedUser && meQuery.error && code !== "UNAUTHORIZED") {
      setIsOffline(true);
      window.dispatchEvent(new Event("offline"));
    }
  }, [cachedUser, isOffline, meQuery.data, meQuery.error, meQuery.isFetched]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.setData(undefined, null),
  });

  const logout = useCallback(async () => {
    try {
      if (!isOffline) await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (!(error instanceof TRPCClientError) || error.data?.code !== "UNAUTHORIZED") throw error;
    } finally {
      localStorage.removeItem(LOCAL_SESSION_KEY);
      setCachedUser(null);
      utils.auth.me.setData(undefined, null);
      window.dispatchEvent(new Event("promotores-saas:logout"));
      if (!isOffline) await utils.auth.me.invalidate();
      // Volta para a landing (login no modal da página inicial)
      if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    }
  }, [isOffline, logoutMutation, utils]);

  const state = useMemo(() => {
    // O cache é a identidade imediata enquanto auth.me confirma a sessão.
    // Isso evita a piscada online e mantém o acesso quando a rede caiu, mesmo
    // que navigator.onLine ainda esteja true.
    // Quando o logout atualiza o cache tRPC para null, esse valor explícito
    // deve prevalecer sobre o usuário local antigo em todas as instâncias do
    // hook. Em modo offline, auth.me fica undefined e o cache local continua
    // sendo usado normalmente.
    const user = meQuery.data ?? cachedUser;
    // A sessão própria em cache é suficiente para abrir a aplicação enquanto
    // a confirmação online ocorre em segundo plano. Isso evita tela vazia ou
    // spinner prolongado em previews móveis e mantém o acesso offline-first.
    const authReady = isOffline || Boolean(cachedUser) || meQuery.isFetched;
    return {
      user,
      // Mesmo com usuário em cache, não mostre LoginPage enquanto a sessão
      // própria online ainda está sendo confirmada. Isso evita a piscada no
      // primeiro carregamento e ao atualizar a página.
      loading: !authReady || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(user),
    };
  }, [cachedUser, isOffline, logoutMutation.error, logoutMutation.isPending, meQuery.data, meQuery.error, meQuery.isFetched]);

  useEffect(() => {
    if (!redirectOnUnauthenticated || isOffline || state.loading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    window.location.href = redirectPath || "/";
  }, [redirectOnUnauthenticated, isOffline, redirectPath, state.loading, state.user]);

  return { ...state, refresh: () => meQuery.refetch(), logout };
}
