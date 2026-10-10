/** Domínios e padrões do Selo digital Inmetro / Casa da Moeda. */
const INMETRO_HOST_SUFFIXES = [
  "inmetro.gov.br",
  "inmetro.org.br",
  "casadamoeda.gov.br",
  "casadamoeda.com.br",
  // Rastreio do selo digital (Casa da Moeda / Inmetro na Palma da Mão)
  "c-id.io",
  "in.c-id.io",
];

/** Hosts gov.br genéricos só aceitos se path/query indicar Inmetro/selo. */
const GOV_BR_HINT = /inmetro|selo|conformidade|certific|napalmadamao|produto/i;

/** Código alfanumérico típico do selo Casa da Moeda / Inmetro (ex.: ZZVM15K8W). */
const SEAL_CODE_RE = /^[A-Z0-9]{6,16}$/i;

/** Path típico do redirecionador do selo digital (ex.: /IN2/019BG8R...). */
const SEAL_PATH_RE = /^\/IN\d+\//i;

export type InmetroQrParseResult =
  | {
      ok: true;
      raw: string;
      isUrl: boolean;
      url?: string;
      host?: string;
      code?: string;
      isInmetro: true;
      kind: "url" | "code" | "text";
    }
  | {
      ok: false;
      raw: string;
      isUrl: boolean;
      url?: string;
      host?: string;
      isInmetro: false;
      reason: string;
    };

function normalizeRaw(raw: string): string {
  return String(raw || "").trim();
}

function tryParseUrl(raw: string): URL | null {
  // Selos costumam vir em maiúsculas e às vezes com espaços (HTTP://IN.C-ID.IO/...)
  const value = normalizeRaw(raw).replace(/\s+/g, "");
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value);
    if (/^[a-z0-9.-]+\.[a-z]{2,}([/:?]|$)/i.test(value)) {
      return new URL(`https://${value}`);
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isInmetroHost(host: string | undefined | null): boolean {
  if (!host) return false;
  const h = host.toLowerCase().replace(/\.$/, "");
  return INMETRO_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

function isAllowedGovBr(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  if (h !== "gov.br" && !h.endsWith(".gov.br")) return false;
  if (isInmetroHost(h)) return true;
  const blob = `${url.pathname} ${url.search} ${url.hash}`;
  return GOV_BR_HINT.test(blob) || GOV_BR_HINT.test(h);
}

function isSealRedirect(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  if (h === "c-id.io" || h.endsWith(".c-id.io")) return true;
  if (SEAL_PATH_RE.test(url.pathname)) return true;
  return false;
}

function extractSealCodes(raw: string): string[] {
  const tokens = raw
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => SEAL_CODE_RE.test(t));
  return Array.from(new Set(tokens));
}

/** Analisa o conteúdo lido de um QR e classifica se é do Inmetro / selo oficial. */
export function parseInmetroQrPayload(rawInput: string): InmetroQrParseResult {
  const raw = normalizeRaw(rawInput);
  if (!raw) {
    return { ok: false, raw: "", isUrl: false, isInmetro: false, reason: "Conteúdo vazio." };
  }

  const urlObj = tryParseUrl(raw);
  if (urlObj) {
    const host = urlObj.hostname.toLowerCase();
    if (isInmetroHost(host) || isAllowedGovBr(urlObj) || isSealRedirect(urlObj)) {
      const codes = extractSealCodes(raw);
      // Último segmento do path costuma ser o id do selo (019BG8RF095Q4RRNCQHOWI)
      const pathParts = urlObj.pathname.split("/").filter(Boolean);
      const pathId = pathParts.length ? pathParts[pathParts.length - 1] : undefined;
      return {
        ok: true,
        raw,
        isUrl: true,
        url: urlObj.toString(),
        host,
        code: pathId || codes[0],
        isInmetro: true,
        kind: "url",
      };
    }
    return {
      ok: false,
      raw,
      isUrl: true,
      url: urlObj.toString(),
      host,
      isInmetro: false,
      reason: "Este QR Code não foi reconhecido como um QR Code do Inmetro.",
    };
  }

  if (SEAL_CODE_RE.test(raw.replace(/\s+/g, ""))) {
    const code = raw.replace(/\s+/g, "").toUpperCase();
    return {
      ok: true,
      raw: code,
      isUrl: false,
      code,
      isInmetro: true,
      kind: "code",
    };
  }

  const codes = extractSealCodes(raw);
  if (codes.length && /inmetro|selo|casa\s*da\s*moeda/i.test(raw)) {
    return {
      ok: true,
      raw,
      isUrl: false,
      code: codes[0],
      isInmetro: true,
      kind: "text",
    };
  }

  if (/inmetro/i.test(raw)) {
    return {
      ok: true,
      raw,
      isUrl: false,
      isInmetro: true,
      kind: "text",
    };
  }

  return {
    ok: false,
    raw,
    isUrl: false,
    isInmetro: false,
    reason: "Este QR Code não foi reconhecido como um QR Code do Inmetro.",
  };
}

/**
 * Abre consulta oficial de forma segura.
 * - URL Inmetro/CMB/c-id.io autorizada → abre direto
 * - Código de selo → portal Inmetro na Palma da Mão
 */
export function openInmetroConsultation(result: Extract<InmetroQrParseResult, { ok: true }>) {
  if (result.isUrl && result.url) {
    const parsed = tryParseUrl(result.url);
    if (!parsed) throw new Error("URL inválida.");
    if (!(isInmetroHost(parsed.hostname) || isAllowedGovBr(parsed) || isSealRedirect(parsed))) {
      throw new Error("URL não autorizada para abertura automática.");
    }
    // Preferir https quando o selo vier em http://
    if (parsed.protocol === "http:") {
      parsed.protocol = "https:";
    }
    window.open(parsed.toString(), "_blank", "noopener,noreferrer");
    return;
  }

  const portal = "https://napalmadamao.inmetro.gov.br/";
  window.open(portal, "_blank", "noopener,noreferrer");
}
