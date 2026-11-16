/**
 * Resumo em português e classificação dos erros ao vivo (painel do super-admin).
 * Regras puras, sem custo de IA — usadas no servidor e nos testes.
 */
export const LIVE_ERROR_ZONE = "America/Sao_Paulo";

export type LiveErrorKind =
  | "type_error"
  | "reference_error"
  | "server_500"
  | "database"
  | "chunk_load"
  | "network"
  | "checkin_photo"
  | "gps_camera"
  | "timeout"
  | "user_abort"
  | "browser_extension"
  | "service_worker"
  | "session"
  | "forbidden"
  | "unknown";

export type LiveErrorAction = "needs_fix" | "expected";
export type LiveErrorSeverity = "grave" | "atencao" | "leve";

export type LiveErrorInput = {
  title: string;
  culprit?: string | null;
  metadataType?: string | null;
  metadataValue?: string | null;
  level?: string | null;
  transaction?: string | null;
  count24h: number;
  count7d: number;
  userCount: number;
};

export type LiveErrorCopy = {
  kind: LiveErrorKind;
  title: string;
  place: string;
  severity: LiveErrorSeverity;
  growing: boolean;
  action: LiveErrorAction;
  actionReason: string;
  isServiceWorkerNoise: boolean;
};

const SCREEN_ROUTES: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /\/plataforma\/scanner\b/i, name: "Erros ao vivo" },
  { pattern: /\/plataforma\/ia\b/i, name: "Suporte com IA" },
  { pattern: /\/plataforma\/ponto\b/i, name: "Ponto eletrônico (teste)" },
  { pattern: /\/admin\/empresas\b/i, name: "Empresas" },
  { pattern: /\/admin\/avisos\b/i, name: "Avisos da plataforma" },
  { pattern: /\/admin\/usuarios\b/i, name: "Usuários da plataforma" },
  { pattern: /\/cartao-ponto\b/i, name: "Cartão-ponto" },
  { pattern: /\/espelho-ponto\b/i, name: "Espelho de ponto" },
  { pattern: /\/banco-de-horas\b/i, name: "Banco de horas" },
  { pattern: /\/check-in-out\b/i, name: "Check-in e check-out" },
  { pattern: /\/ponto#correcoes|#correcoes/i, name: "Correções de ponto" },
  { pattern: /\/comprovantes\b/i, name: "Meus comprovantes" },
  { pattern: /\/ponto\b/i, name: "Ponto" },
  { pattern: /\/lojas\b/i, name: "Lojas" },
  { pattern: /\/produtos\b/i, name: "Produtos" },
  { pattern: /\/ferias\b/i, name: "Férias" },
  { pattern: /\/avisos\b/i, name: "Avisos" },
  { pattern: /\/lgpd\b/i, name: "LGPD" },
  { pattern: /\/equipe\b|\/promotores\b/i, name: "Promotores e equipe" },
  { pattern: /\/roteiros\b/i, name: "Roteiros" },
  { pattern: /\/auditoria\b/i, name: "Auditoria" },
  { pattern: /\/lixeira\b/i, name: "Lixeira" },
  { pattern: /\/pagamentos\b|\/faturas\b|\/assinatura\b|\/plano\b/i, name: "Plano e pagamento" },
  { pattern: /\/termos\b/i, name: "Termos de uso" },
  { pattern: /\/privacidade\b/i, name: "Política de privacidade" },
  { pattern: /\/login\b/i, name: "Login" },
  { pattern: /storePhotos|store-photos|visitPhotos|visit-photos|visitCheckin/i, name: "Foto de check-in ou da loja" },
  { pattern: /timeTracking|time-tracking|timeEvents|pontoLegal/i, name: "Ponto" },
  { pattern: /\/$/ , name: "Início" },
];

const TITLE_BY_KIND: Record<LiveErrorKind, string> = {
  type_error: "O aplicativo travou por um erro no código",
  reference_error: "O aplicativo tentou usar algo que não existe",
  server_500: "O servidor encontrou um erro interno",
  database: "Falha ao acessar o banco de dados",
  chunk_load: "A página não carregou por completo",
  network: "Falha de conexão com a internet",
  checkin_photo: "Não foi possível enviar a foto do check-in",
  gps_camera: "Localização ou câmera indisponíveis",
  timeout: "A operação demorou demais e foi interrompida",
  user_abort: "A ação foi cancelada no aparelho",
  browser_extension: "Uma extensão do navegador interferiu no site",
  service_worker: "Ruído da atualização automática no celular",
  session: "A sessão expirou ou o login não está mais válido",
  forbidden: "O acesso a um recurso foi recusado",
  unknown: "Aconteceu um erro ainda não classificado",
};

function haystack(input: LiveErrorInput): string {
  return [
    input.title,
    input.culprit,
    input.metadataType,
    input.metadataValue,
    input.transaction,
    input.level,
  ].filter(Boolean).join(" \n ");
}

export function isGrowing(count24h: number, count7d: number): boolean {
  const last24 = Math.max(0, count24h);
  const week = Math.max(last24, count7d);
  if (last24 >= 3 && week <= last24) return true;
  if (last24 >= 5 && last24 * 7 > week * 1.8) return true;
  return false;
}

export function formatLiveErrorWhen(value: string | Date | null | undefined): string {
  if (!value) return "data desconhecida";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "data desconhecida";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: LIVE_ERROR_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function liveErrorsHeadline(params: { needsFix24h: number; grave24h: number; expected24h: number }): string {
  if (params.needsFix24h <= 0) {
    return "Nenhum erro nas últimas 24h";
  }
  const problemas = `${params.needsFix24h} ${params.needsFix24h === 1 ? "problema" : "problemas"} nas últimas 24h`;
  if (params.grave24h <= 0) return problemas;
  return `${problemas}, ${params.grave24h} ${params.grave24h === 1 ? "grave" : "graves"}`;
}

export function extractPlace(...parts: Array<string | null | undefined>): string {
  const text = parts.filter(Boolean).join(" ");
  if (!text.trim()) return "Tela não identificada";
  for (const route of SCREEN_ROUTES) {
    if (route.pattern.test(text)) return route.name;
  }
  const url = text.match(/https?:\/\/[^/\s]+(\/[^?\s#]*)/i);
  if (url?.[1] && url[1] !== "/") {
    const path = url[1].replace(/\/$/, "") || "/";
    for (const route of SCREEN_ROUTES) {
      if (route.pattern.test(path)) return route.name;
    }
  }
  return "Tela não identificada";
}

function isServiceWorkerNoise(text: string): boolean {
  return /service\s*worker|serviceWorker|workbox|importScripts|Skip waiting|waiting to activate|Failed to update a ServiceWorker|InvalidStateError[\s\S]*ServiceWorker/i.test(text);
}

function isNetwork(text: string): boolean {
  return /Failed to fetch|NetworkError|Load failed|net::ERR_|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|ERR_CONNECTION_|NS_ERROR_NET|offline|sem conexão|network request failed/i.test(text);
}

function isCheckinPhoto(text: string): boolean {
  return /(store-photos|storePhotos|visit-photos|visitPhotos|visitCheckin|upload.*foto|foto.*upload|check-?in.*foto|foto.*check-?in)/i.test(text);
}

function isGpsOrCamera(text: string): boolean {
  return /Geolocation|getCurrentPosition|NotAllowedError|Permission denied|PermissionDeniedError|getUserMedia|NotFoundError|NotReadableError|OverconstrainedError|câmera|camera|GPS|localiza(ção|cao) (negada|indisponível|bloqueada)/i.test(text);
}

function isSession(text: string): boolean {
  return /\b401\b|unauthorized|sessão expirada|sessao expirada|não autenticado|nao autenticado|jwt expired|invalid token|login required|UNAUTHENTICATED/i.test(text);
}

function isDatabase(text: string): boolean {
  return /TiDB|mysql|drizzle|ECONNREFUSED|ER_[A-Z0-9_]+|deadlock|too many connections|banco de dados|database.*(fail|error|timeout)|connection lost/i.test(text);
}

function isChunkLoad(text: string): boolean {
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|CSS_CHUNK_LOAD_ERROR/i.test(text);
}

function isTimeout(text: string): boolean {
  return /TimeoutError|timed?\s*out|ETIMEDOUT|ESOCKETTIMEDOUT|demorou demais|aborted due to timeout/i.test(text);
}

function detectKind(input: LiveErrorInput): LiveErrorKind {
  const text = haystack(input);
  const metaType = String(input.metadataType || "");

  if (/chrome-extension:|moz-extension:|safari-web-extension:|safari-extension:/i.test(text)) return "browser_extension";
  if (isServiceWorkerNoise(text)) return "service_worker";
  if (isSession(text)) return "session";
  if (isGpsOrCamera(text)) return "gps_camera";
  if (/AbortError|The user aborted|aborted by the user|The operation was aborted/i.test(text) && !isTimeout(text)) return "user_abort";
  if (isDatabase(text)) return "database";
  if (isTimeout(text)) return "timeout";
  if (isCheckinPhoto(text) && (isNetwork(text) || /payload too large|413|upload/i.test(text) || /failed/i.test(text))) return "checkin_photo";
  if (isChunkLoad(text)) return "chunk_load";
  if (isNetwork(text) || /^TypeError:\s*Failed to fetch/i.test(input.title) || /TypeError:\s*Load failed/i.test(input.title)) return "network";
  if (/\b500\b|Internal Server Error|internal server error/i.test(text)) return "server_500";
  if (/\b403\b|FORBIDDEN|acesso negado|forbidden/i.test(text)) return "forbidden";
  if (/ReferenceError/i.test(metaType) || /ReferenceError/i.test(input.title)) return "reference_error";
  if (/TypeError/i.test(metaType) || /TypeError/i.test(input.title)) return "type_error";
  return "unknown";
}

function defaultAction(kind: LiveErrorKind, input: LiveErrorInput, growing: boolean): { action: LiveErrorAction; reason: string } {
  const manyUsers = input.userCount >= 3;
  const persistentChunk = input.count24h >= 3 || input.userCount >= 2 || growing;

  switch (kind) {
    case "type_error":
      return { action: "needs_fix", reason: "É um erro de código (TypeError) e precisa ser corrigido no aplicativo." };
    case "reference_error":
      return { action: "needs_fix", reason: "É um erro de código (ReferenceError) e precisa ser corrigido no aplicativo." };
    case "server_500":
      return { action: "needs_fix", reason: "O servidor respondeu com erro interno (500), o que não deveria acontecer no uso normal." };
    case "database":
      return { action: "needs_fix", reason: "Houve falha no banco de dados, o que indica um problema a corrigir." };
    case "chunk_load":
      if (persistentChunk) {
        return { action: "needs_fix", reason: "A página ou um arquivo do aplicativo deixou de carregar várias vezes, então não parece só uma queda de sinal." };
      }
      return { action: "expected", reason: "A página não terminou de carregar uma vez só, o que costuma ser instabilidade de rede." };
    case "network":
      return { action: "expected", reason: "Falha de rede ou aparelho offline, comum no uso do dia a dia." };
    case "checkin_photo":
      return { action: "expected", reason: "O envio da foto de check-in falhou, geralmente por sinal fraco no momento da foto." };
    case "gps_camera":
      return { action: "expected", reason: "A localização ou a câmera foi negada ou estava indisponível no aparelho." };
    case "timeout":
      return { action: "expected", reason: "O aparelho ou a conexão estourou o tempo de espera, o que é comum em sinal fraco." };
    case "user_abort":
      return { action: "expected", reason: "A pessoa ou o aparelho cancelou a ação antes de terminar." };
    case "browser_extension":
      return { action: "expected", reason: "Uma extensão do navegador interferiu na página, não é um defeito do GondUp." };
    case "service_worker":
      return { action: "expected", reason: "É ruído da atualização automática no celular, não um erro que precise de correção." };
    case "session":
      return { action: "expected", reason: "A sessão expirou ou o login não estava mais válido, situação normal de uso." };
    case "forbidden":
      return { action: "expected", reason: "O acesso foi recusado por permissão ou sessão, o que pode acontecer no uso normal." };
    default: {
      if (growing || manyUsers || input.count24h >= 5) {
        return { action: "needs_fix", reason: "O erro ainda não foi classificado e está atingindo várias ocorrências ou usuários, então vale corrigir." };
      }
      return { action: "needs_fix", reason: "O erro ainda não foi classificado; vale conferir se é um defeito no código." };
    }
  }
}

function severityFor(kind: LiveErrorKind, action: LiveErrorAction, input: LiveErrorInput, growing: boolean): LiveErrorSeverity {
  if (action === "expected") return "leve";
  const many = input.userCount >= 5 || input.count24h >= 20;
  if (kind === "server_500" || kind === "database" || many) return "grave";
  if (kind === "type_error" || kind === "reference_error") {
    return input.userCount >= 2 || input.count24h >= 5 || growing ? "grave" : "atencao";
  }
  if (growing || input.userCount >= 3 || kind === "chunk_load") return "atencao";
  return "atencao";
}

export function classifyLiveError(input: LiveErrorInput): LiveErrorCopy {
  const kind = detectKind(input);
  const growing = isGrowing(input.count24h, input.count7d);
  const { action, reason } = defaultAction(kind, input, growing);
  const place = extractPlace(input.transaction, input.culprit, input.title, input.metadataValue);
  return {
    kind,
    title: TITLE_BY_KIND[kind],
    place,
    severity: severityFor(kind, action, input, growing),
    growing,
    action,
    actionReason: reason,
    isServiceWorkerNoise: kind === "service_worker",
  };
}

export function applyLiveErrorOverride(
  copy: LiveErrorCopy,
  override: "expected" | "needs_fix" | null | undefined,
): LiveErrorCopy {
  if (!override || override === copy.action) return copy;
  if (override === "expected") {
    return {
      ...copy,
      action: "expected",
      severity: "leve",
      actionReason: "Você marcou este erro como normal.",
    };
  }
  return {
    ...copy,
    action: "needs_fix",
    severity: copy.severity === "leve" ? "atencao" : copy.severity,
    actionReason: "Você desfez a marcação de normal; este erro volta a precisar de correção.",
  };
}
