/** Monta um endereço brasileiro legível a partir do retorno do Nominatim (OpenStreetMap). */
export type NominatimAddress = Partial<Record<
  "road" | "pedestrian" | "footway" | "residential" | "house_number" | "suburb" | "neighbourhood" | "quarter" | "city_district" | "district" |
  "city" | "town" | "village" | "municipality" | "hamlet" | "state" | "postcode" | "ISO3166-2-lvl4" | "shop" | "amenity" | "building",
  string
>>;

const UF_BY_STATE: Record<string, string> = {
  "acre": "AC", "alagoas": "AL", "amapá": "AP", "amazonas": "AM", "bahia": "BA", "ceará": "CE", "distrito federal": "DF", "espírito santo": "ES",
  "goiás": "GO", "maranhão": "MA", "mato grosso": "MT", "mato grosso do sul": "MS", "minas gerais": "MG", "pará": "PA", "paraíba": "PB", "paraná": "PR",
  "pernambuco": "PE", "piauí": "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN", "rio grande do sul": "RS", "rondônia": "RO", "roraima": "RR",
  "santa catarina": "SC", "são paulo": "SP", "sergipe": "SE", "tocantins": "TO",
};

export function stateToUf(state?: string, iso?: string): string | undefined {
  const fromIso = iso?.match(/^BR-([A-Z]{2})$/)?.[1];
  if (fromIso) return fromIso;
  return state ? UF_BY_STATE[state.trim().toLowerCase()] ?? state : undefined;
}

function formatCep(cep?: string) {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep?.trim() || undefined;
}

/** Ex.: "Av. Ipiranga, 1234 - Partenon, Porto Alegre-RS, CEP 90610-000". */
export function formatBrAddress(a: NominatimAddress | null | undefined, displayName?: string): string | null {
  if (!a) return displayName?.trim() || null;
  const street = a.road || a.pedestrian || a.residential || a.footway;
  const streetPart = street ? (a.house_number ? `${street}, ${a.house_number}` : street) : undefined;
  const bairro = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.district;
  const city = a.city || a.town || a.village || a.municipality || a.hamlet;
  const uf = stateToUf(a.state, a["ISO3166-2-lvl4"]);
  const cityPart = city ? (uf ? `${city}-${uf}` : city) : uf;
  const cep = formatCep(a.postcode);
  const head = [streetPart, bairro && bairro !== city ? bairro : undefined].filter(Boolean).join(" - ");
  const parts = [head || undefined, cityPart, cep ? `CEP ${cep}` : undefined].filter(Boolean);
  return parts.length ? parts.join(", ") : displayName?.trim() || null;
}

/** Quebra o texto em linhas que caibam na largura (measure devolve a largura em px). */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w;
    if (measure(candidate) <= maxWidth || !line) line = candidate;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}
