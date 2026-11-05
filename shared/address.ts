/** Monta um endereço brasileiro legível a partir do retorno do Nominatim (OpenStreetMap) e fontes complementares. */
export type NominatimAddress = Partial<Record<
  "road" | "pedestrian" | "footway" | "path" | "cycleway" | "residential" | "house_number" |
  "suburb" | "neighbourhood" | "neighborhood" | "quarter" | "city_district" | "district" |
  "city" | "town" | "village" | "municipality" | "hamlet" | "state" | "postcode" | "ISO3166-2-lvl4" |
  "shop" | "amenity" | "building",
  string
>> & {
  /** Rua veio de fonte aproximada (ex.: Photon); formatamos como "próximo a …". */
  approximateStreet?: boolean;
};

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

export function formatCep(cep?: string) {
  const d = (cep || "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep?.trim() || undefined;
}

export function streetFromAddress(a: NominatimAddress | null | undefined): string | undefined {
  if (!a) return undefined;
  return a.road || a.pedestrian || a.residential || a.footway || a.path || a.cycleway || undefined;
}

export function cityFromAddress(a: NominatimAddress | null | undefined): string | undefined {
  if (!a) return undefined;
  return a.city || a.town || a.village || a.municipality || a.hamlet || undefined;
}

/** Bairro real: ignora city_district/district quando é só o nome da cidade. */
export function bairroFromAddress(a: NominatimAddress | null | undefined): string | undefined {
  if (!a) return undefined;
  const city = cityFromAddress(a);
  const candidates = [a.suburb, a.neighbourhood, a.neighborhood, a.quarter, a.city_district, a.district];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && (!city || t.toLowerCase() !== city.toLowerCase())) return t;
  }
  return undefined;
}

/** True se o texto formatado já traz rua (não só cidade/CEP). */
export function addressHasStreet(formatted: string | null | undefined): boolean {
  if (!formatted) return false;
  const t = formatted.trim();
  // "Sapiranga-RS, CEP 93819-700" ou "GPS -29.64, -51.00" → incompleto
  if (/^GPS\s/i.test(t)) return false;
  if (/^próximo a\s+/i.test(t)) return true;
  // Tem trecho de rua típico antes da cidade-UF
  if (/,?\s*[A-Z]{2},?\s*CEP\s*\d/i.test(t) && !/(rua|r\.|av\.|avenida|travessa|alameda|estrada|rodovia|praça|largo|viela|próximo a)/i.test(t)) {
    // cidade-UF, CEP sem logradouro
    const withoutCep = t.replace(/,?\s*CEP\s*[\d.-]+/ig, "").trim();
    // só "Cidade-UF" ou "Bairro, Cidade-UF"
    if (/^[^,]+-[A-Z]{2}$/.test(withoutCep)) return false;
  }
  return /(rua|r\.|av\.|avenida|travessa|alameda|estrada|rodovia|praça|largo|viela|próximo a)/i.test(t)
    || /^[^,]+,\s*\d+/.test(t); // "Algo, 123"
}

/** Ex.: "Av. Ipiranga, 1234 - Partenon, Porto Alegre-RS, CEP 90610-000". */
export function formatBrAddress(a: NominatimAddress | null | undefined, displayName?: string): string | null {
  if (!a) return displayName?.trim() || null;
  const street = streetFromAddress(a);
  let streetPart = street
    ? (a.house_number ? `${street}, ${a.house_number}` : street)
    : undefined;
  if (streetPart && a.approximateStreet) streetPart = `próximo a ${streetPart}`;
  const bairro = bairroFromAddress(a);
  const city = cityFromAddress(a);
  const uf = stateToUf(a.state, a["ISO3166-2-lvl4"]);
  const cityPart = city ? (uf ? `${city}-${uf}` : city) : uf;
  const cep = formatCep(a.postcode);
  const head = [streetPart, bairro].filter(Boolean).join(" - ");
  const parts = [head || undefined, cityPart, cep ? `CEP ${cep}` : undefined].filter(Boolean);
  if (parts.length) return parts.join(", ");
  // display_name do Nominatim costuma ser longo demais e em inglês/OSM; só usa se não houver nada estruturado
  return displayName?.trim() || null;
}

/** Une partes de várias fontes sem sobrescrever o que já é bom. */
export function mergeAddressParts(base: NominatimAddress, extra: NominatimAddress): NominatimAddress {
  const out: NominatimAddress = { ...base };
  const baseStreet = streetFromAddress(base);
  const extraStreet = streetFromAddress(extra);
  if (!baseStreet && extraStreet) {
    out.road = extra.road || extra.pedestrian || extra.residential || extra.footway || extra.path || extra.cycleway;
    if (extra.house_number && !out.house_number) out.house_number = extra.house_number;
    if (extra.approximateStreet) out.approximateStreet = true;
  } else if (baseStreet && out.approximateStreet && extraStreet && !extra.approximateStreet) {
    // CEP/oficial substitui rua aproximada
    out.road = extra.road || extraStreet;
    out.house_number = extra.house_number || out.house_number;
    delete out.approximateStreet;
  }
  if (!bairroFromAddress(out)) {
    const b = bairroFromAddress(extra) || extra.suburb || extra.neighbourhood || extra.neighborhood || extra.quarter;
    if (b) out.suburb = b;
  }
  if (!cityFromAddress(out)) {
    const c = cityFromAddress(extra);
    if (c) out.city = c;
  }
  if (!out.state && extra.state) out.state = extra.state;
  if (!out["ISO3166-2-lvl4"] && extra["ISO3166-2-lvl4"]) out["ISO3166-2-lvl4"] = extra["ISO3166-2-lvl4"];
  if (!out.postcode && extra.postcode) out.postcode = extra.postcode;
  if (!out.house_number && extra.house_number) out.house_number = extra.house_number;
  return out;
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

/**
 * Escolhe o melhor texto para o carimbo: GPS completo, senão endereço da loja,
 * senão GPS parcial, senão coordenadas.
 */
export function pickStampLocation(opts: {
  geocoded: string | null | undefined;
  storeAddress?: string | null;
  coordsFallback: string;
}): string {
  const geo = opts.geocoded?.trim() || null;
  const store = opts.storeAddress?.trim() || null;
  if (geo && addressHasStreet(geo)) return geo;
  if (store) {
    // Se o GPS trouxe só cidade/CEP, ainda assim preferimos o endereço cadastrado da loja.
    return store;
  }
  return geo || opts.coordsFallback;
}
