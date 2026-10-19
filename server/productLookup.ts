import { and, desc, eq, inArray } from "drizzle-orm";
import * as db from "./db";
import { inventoryProducts } from "../drizzle/schema";
import { barcodeVariants } from "../shared/barcode";

export type LookupResult = { found: boolean; source: "company" | "openfoodfacts" | "openbeautyfacts" | "openpetfoodfacts" | "openproductsfacts" | "cosmos" | null; description: string; price?: string | null; code: string };

const OPEN_BASES: Array<{ source: LookupResult["source"]; host: string }> = [
  { source: "openfoodfacts", host: "world.openfoodfacts.org" },
  { source: "openbeautyfacts", host: "world.openbeautyfacts.org" },
  { source: "openpetfoodfacts", host: "world.openpetfoodfacts.org" },
  { source: "openproductsfacts", host: "world.openproductsfacts.org" },
];

async function fetchJson(url: string, init: RequestInit = {}, ms = 4000): Promise<any | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, headers: { "User-Agent": "PromotoresSaaS/1.0 (consulta de codigo de barras)", Accept: "application/json", ...(init.headers || {}) } });
    return r.ok ? await r.json() : null;
  } catch { return null; } finally { clearTimeout(t); }
}

function describe(p: any): string {
  const name = p?.product_name_pt || p?.product_name || p?.generic_name_pt || p?.generic_name || p?.product_name_en || "";
  if (!name) return "";
  const brand = String(p?.brands || "").split(",")[0]?.trim();
  const qty = p?.quantity ? ` ${p.quantity}` : "";
  const base = brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} — ${brand}` : name;
  return `${base}${qty}`.slice(0, 500);
}

export async function lookupProductByCode(companyId: number, rawCode: string): Promise<LookupResult> {
  const variants = barcodeVariants(rawCode);
  const code = variants[0] ?? rawCode.trim();
  // 1) Produtos que a própria empresa já cadastrou (mais recente primeiro)
  const database = await db.getDb();
  if (database) {
    await db.ensureInventoryProductsSchema();
    const codes = [...new Set([rawCode.trim(), ...variants])];
    const rows = await database.select({ description: inventoryProducts.description, price: inventoryProducts.price, productCode: inventoryProducts.productCode })
      .from(inventoryProducts).where(and(eq(inventoryProducts.companyId, companyId), inArray(inventoryProducts.productCode, codes))).orderBy(desc(inventoryProducts.id)).limit(1);
    if (rows[0]) return { found: true, source: "company", description: rows[0].description, price: String(rows[0].price), code: rows[0].productCode };
  }
  if (!variants.length) return { found: false, source: null, description: "", code };
  // 2) Cosmos (Bluesoft), opcional: configure COSMOS_API_TOKEN
  const token = process.env.COSMOS_API_TOKEN;
  if (token) {
    for (const v of variants) {
      const data = await fetchJson(`https://api.cosmos.bluesoft.com.br/gtins/${v}.json`, { headers: { "X-Cosmos-Token": token } });
      if (data?.description) return { found: true, source: "cosmos", description: String(data.description).slice(0, 500), price: data.avg_price ? Number(data.avg_price).toFixed(2) : null, code: v };
    }
  }
  // 3) Bases abertas, em paralelo (cada variante de código em cada base); a primeira com nome vence pela ordem das bases
  const tasks = OPEN_BASES.map(async (b) => {
    for (const v of variants) {
      const data = await fetchJson(`https://${b.host}/api/v2/product/${encodeURIComponent(v)}?fields=product_name,product_name_pt,product_name_en,generic_name,generic_name_pt,brands,quantity`);
      const description = data?.status === 1 ? describe(data.product) : "";
      if (description) return { found: true as const, source: b.source, description, code: v };
    }
    return null;
  });
  const results = await Promise.all(tasks);
  const hit = results.find(Boolean);
  return hit ? { ...hit, price: null } : { found: false, source: null, description: "", code };
}
