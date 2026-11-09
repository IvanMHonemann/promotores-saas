/** Regras puras do módulo "Produtos e validades" (usadas no servidor, no app e nos testes). */
import { neutralizeCsvFormula } from "./csv";
import { daysUntil, expiryStatus } from "./expiry";

export const PRODUCTS_ALERT_DAYS_KEY = "products_alert_days";
export const DEFAULT_ALERT_DAYS = 30;
export const ALERT_DAY_OPTIONS = [7, 15, 30, 45, 60, 90] as const;
export const PRODUCTS_PAGE_SIZE = 30;
export const PRODUCTS_EXPORT_LIMIT = 10_000;

/** Janela de alerta válida (1 a 180 dias); qualquer valor estranho volta ao padrão de 30. */
export function normalizeAlertDays(value: unknown): number {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) && n >= 1 && n <= 180 ? n : DEFAULT_ALERT_DAYS;
}

export type ProductRole = "company_admin" | "supervisor" | "promoter" | string;

/** Administrador e supervisor mexem em tudo; o promotor só no que ele mesmo cadastrou. */
export function canManageProduct(role: ProductRole, memberId: number | null | undefined, createdByMemberId: number | null | undefined): boolean {
  if (role === "company_admin" || role === "supervisor") return true;
  return memberId != null && createdByMemberId != null && Number(memberId) === Number(createdByMemberId);
}

/** Campos que identificam "o mesmo produto no mesmo lugar": só soma a quantidade se todos baterem. */
export type MergeKey = { productCode: string; expirationDate: string; storeId: number | null; storeClientId: number | null; lot: string | null };
export function normalizeLot(lot: unknown): string | null {
  const v = String(lot ?? "").trim().toUpperCase();
  return v ? v.slice(0, 64) : null;
}

/** Validade de calendário plausível (evita 0202-11-05 por erro de digitação). */
export function isPlausibleExpiry(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && y <= 2100 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isPastDate(iso: string, today: string): boolean {
  return daysUntil(iso, today) < 0;
}

/** dd/mm/aaaa sem passar por fuso (a validade é data de calendário). */
export function formatDateBR(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const s = typeof iso === "string" ? iso.slice(0, 10) : iso.toISOString().slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : s;
}

export function situationLabel(iso: string, today: string, alertDays: number): string {
  const st = expiryStatus(iso, today, alertDays);
  if (st === "expired") return "Vencido";
  if (st === "near") {
    const n = daysUntil(iso, today);
    return n === 0 ? "Vence hoje" : `Vence em ${n} dia(s)`;
  }
  return "Em dia";
}

export type ProductCsvRow = {
  productCode: string; description: string; quantity: number; expirationDate: string; price: string | number;
  lot?: string | null; storeName?: string | null; storeActive?: boolean | null; storeId?: number | null; clientName?: string | null; createdByName?: string | null;
};

export function storeLabel(row: { storeId?: number | null; storeName?: string | null; storeActive?: boolean | null }): string {
  if (!row.storeId) return "Sem loja";
  if (!row.storeName || row.storeActive === false) return row.storeName ? `${row.storeName} (loja removida)` : "Loja removida";
  return row.storeName;
}

const cell = (v: unknown) => `"${neutralizeCsvFormula(v as any).replace(/"/g, '""')}"`;
/** CSV em ; (Excel pt-BR), com BOM e neutralização de fórmulas (=, +, -, @) em texto digitado. */
export function productsCsv(rows: ProductCsvRow[], today: string, alertDays: number): string {
  const header = ["Marca/Cliente", "Loja", "Código", "Descrição", "Lote", "Quantidade", "Validade", "Situação", "Preço (R$)", "Cadastrado por"];
  const lines = rows.map((p) => {
    const iso = String(p.expirationDate).slice(0, 10);
    return [p.clientName || "Sem marca/cliente", storeLabel(p), p.productCode, p.description, p.lot || "", String(p.quantity), formatDateBR(iso), situationLabel(iso, today, alertDays), Number(p.price).toFixed(2).replace(".", ","), p.createdByName || ""];
  });
  return "\uFEFF" + [header, ...lines].map((r) => r.map(cell).join(";")).join("\r\n");
}

/** Agrupa por indústria (ordem alfabética, "Sem indústria" por último). */
export function groupByIndustry<T extends { clientName?: string | null }>(rows: T[]): Array<{ name: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const r of rows) { const k = r.clientName?.trim() || "Sem marca/cliente"; map.set(k, [...(map.get(k) ?? []), r]); }
  return [...map.entries()].sort(([a], [b]) => a === "Sem marca/cliente" ? 1 : b === "Sem marca/cliente" ? -1 : a.localeCompare(b, "pt-BR")).map(([name, items]) => ({ name, items }));
}
