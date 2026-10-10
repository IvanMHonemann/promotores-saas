import { TRPCClientError } from "@trpc/client";

/** Detecta falha de rede / offline para cair no caminho local com segurança. */
export function isOfflineFailure(error: unknown, isOnline: boolean) {
  if (!isOnline) return true;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error && typeof error === "object" && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";

  if (/network|fetch|failed to fetch|load failed|offline|timeout|ECONN|ENOTFOUND|ERR_INTERNET|ERR_NETWORK|aborted|unavailable|Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return true;
  }
  // Qualquer falha sem código HTTP claro enquanto offline deve cair no caminho local
  if (!isOnline && message) return true;

  if (error instanceof TRPCClientError) {
    const code = (error.data as { code?: string } | undefined)?.code;
    if (code === "TIMEOUT" || code === "CLIENT_CLOSED_REQUEST") return true;
    if (/network|fetch|failed to fetch|load failed|timeout/i.test(error.message)) return true;
    // Erro de servidor/permissão NÃO é offline — senão a fila nunca conclui
    return false;
  }

  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return true;

  return false;
}
