import Dexie, { type Table } from "dexie";

export type LocalRecord = Record<string, any> & { id: number; tenantKey: string };
export type LocalOrderRow = { order: LocalRecord; client: LocalRecord; tenantKey: string };
export type OfflineMutation = {
  id?: number;
  tenantKey: string;
  entity: "client" | "extinguisher" | "order";
  action: "create" | "update" | "delete";
  payload: any;
  createdAt: string;
  state?: "pending" | "failed";
  lastError?: string;
  attempts?: number;
  lastAttemptAt?: string;
};

type OfflineSetting = { key: string; tenantKey: string; value: any };
type OfflineMeta = { key: string; tenantKey?: string; value: any };

function requireTenantKey(tenantKey: string) {
  if (!tenantKey || tenantKey === "legacy-unassigned") throw new Error("Tenant offline inválido.");
  return tenantKey;
}

function scopedKey(tenantKey: string, key: string) {
  return `${requireTenantKey(tenantKey)}:${key}`;
}

class ExtintoresOfflineDB extends Dexie {
  clients!: Table<LocalRecord, number>;
  extinguishers!: Table<LocalRecord, number>;
  orders!: Table<LocalOrderRow, number>;
  alerts!: Table<LocalRecord, number>;
  settings!: Table<OfflineSetting, string>;
  meta!: Table<OfflineMeta, string>;
  mutations!: Table<OfflineMutation, number>;

  constructor() {
    super("gestao-extintores-offline");
    this.version(1).stores({
      clients: "id, city, updatedAt",
      extinguishers: "id, clientId, expirationDate, status",
      orders: "&order.id, order.clientId, order.orderDate",
      alerts: "id, clientId, alertStatus, expirationDate",
      settings: "&key",
      meta: "&key",
      mutations: "++id, createdAt",
    });
    this.version(2).stores({
      clients: "id, tenantKey, city, updatedAt",
      extinguishers: "id, tenantKey, clientId, expirationDate, status",
      orders: "&order.id, tenantKey, order.clientId, order.orderDate",
      alerts: "id, tenantKey, clientId, alertStatus, expirationDate",
      settings: "&key, tenantKey",
      meta: "&key, tenantKey",
      mutations: "++id, tenantKey, createdAt, state",
    }).upgrade(async tx => {
      for (const tableName of ["clients", "extinguishers", "orders", "alerts"] as const) {
        const table = tx.table(tableName);
        await table.toCollection().modify((row: any) => { row.tenantKey = "legacy-unassigned"; });
      }
      await tx.table("settings").toCollection().modify((row: any) => {
        row.tenantKey = "legacy-unassigned";
        row.key = `legacy-unassigned:${row.key}`;
      });
      await tx.table("meta").toCollection().modify((row: any) => { row.tenantKey = "legacy-unassigned"; });
      await tx.table("mutations").toCollection().modify((row: any) => {
        row.tenantKey = "legacy-unassigned";
        row.state = row.state || "failed";
        row.lastError = "Operação antiga sem tenant; não será sincronizada.";
      });
    });
  }
}

export const offlineDb = new ExtintoresOfflineDB();

function withTenant<T extends Record<string, any>>(tenantKey: string, row: T): T & { tenantKey: string } {
  return { ...row, tenantKey: requireTenantKey(tenantKey) };
}

async function deleteScopedRows(table: any, tenantKey: string) {
  const rows = await table.where("tenantKey").equals(tenantKey).primaryKeys();
  if (rows.length) await table.bulkDelete(rows);
}

async function replaceScopedRows(table: any, tenantKey: string, rows: any[], getId: (row: any) => number, preserveExisting = false) {
  const pending = await offlineDb.mutations.where("tenantKey").equals(tenantKey).toArray();
  const pendingWrites = new Set(pending.filter((mutation) => mutation.action === "create" || mutation.action === "update").map((mutation) => Number(mutation.payload?.localId ?? mutation.payload?.id)).filter(Number.isFinite));
  const pendingDeletes = new Set(pending.filter((mutation) => mutation.action === "delete").map((mutation) => Number(mutation.payload?.id)).filter(Number.isFinite));
  const filteredRows = rows.filter((row) => {
    const id = Number(getId(row));
    return !pendingDeletes.has(id) && !pendingDeletes.has(Number(row.clientId ?? row.order?.clientId)) && !pendingWrites.has(id);
  });
  const remoteIds = new Set(filteredRows.map(getId).filter((id) => Number.isFinite(id)));
  const existing = await table.where("tenantKey").equals(tenantKey).toArray();
  const staleIds = existing
    .filter((row: any) => {
      const id = Number(getId(row));
      if (!Number.isFinite(id)) return false;
      if (pendingWrites.has(id) || pendingDeletes.has(id)) return false;
      if (id < 0) return !pendingWrites.has(id);
      return !remoteIds.has(id);
    })
    .map((row: any) => row.id ?? getId(row));
  if (!preserveExisting && staleIds.length) await table.bulkDelete(staleIds);
  if (filteredRows.length) await table.bulkPut(filteredRows);
}

export async function saveOnlineSnapshot(snapshot: {
  tenantKey: string;
  clients?: LocalRecord[];
  extinguishers?: LocalRecord[];
  orders?: LocalOrderRow[];
  alerts?: LocalRecord[];
  alertDays?: number;
  preserveExisting?: boolean;
}) {
  const tenantKey = requireTenantKey(snapshot.tenantKey);
  await offlineDb.transaction("rw", [offlineDb.clients, offlineDb.extinguishers, offlineDb.orders, offlineDb.alerts, offlineDb.settings, offlineDb.meta, offlineDb.mutations], async () => {
    if (snapshot.clients) {
      const rows = snapshot.clients.map(row => withTenant(tenantKey, row));
      await replaceScopedRows(offlineDb.clients, tenantKey, rows, row => row.id, snapshot.preserveExisting ?? false);
    }
    if (snapshot.extinguishers) {
      const rows = snapshot.extinguishers.map(row => withTenant(tenantKey, row));
      await replaceScopedRows(offlineDb.extinguishers, tenantKey, rows, row => row.id, snapshot.preserveExisting ?? false);
    }
    if (snapshot.orders) {
      const rows = snapshot.orders.map(row => ({
        ...row,
        tenantKey,
        order: withTenant(tenantKey, row.order),
        client: withTenant(tenantKey, row.client),
      }));
      await replaceScopedRows(offlineDb.orders, tenantKey, rows, row => row.order.id, snapshot.preserveExisting ?? false);
    }
    if (snapshot.alerts) {
      const rows = snapshot.alerts.map((row: any) => withTenant(tenantKey, {
        ...row,
        id: row.id ?? row.extinguisher?.id,
        clientId: row.clientId ?? row.extinguisher?.clientId,
        expirationDate: row.expirationDate ?? row.extinguisher?.expirationDate,
      }));
      await replaceScopedRows(offlineDb.alerts, tenantKey, rows, row => row.id, snapshot.preserveExisting ?? false);
    }
    if (snapshot.alertDays !== undefined) await offlineDb.settings.put({ key: scopedKey(tenantKey, "alertDays"), tenantKey, value: snapshot.alertDays });
    await offlineDb.meta.put({ key: scopedKey(tenantKey, "lastOnlineSync"), tenantKey, value: new Date().toISOString() });
  });
}

export async function exportOfflineBackup(tenantKey: string) {
  const tenant = requireTenantKey(tenantKey);
  return {
    format: "gestao-extintores-offline-backup",
    version: 2,
    tenantKey: tenant,
    exportedAt: new Date().toISOString(),
    clients: await offlineDb.clients.where("tenantKey").equals(tenant).toArray(),
    extinguishers: await offlineDb.extinguishers.where("tenantKey").equals(tenant).toArray(),
    orders: await offlineDb.orders.where("tenantKey").equals(tenant).toArray(),
    alerts: await offlineDb.alerts.where("tenantKey").equals(tenant).toArray(),
    settings: await offlineDb.settings.where("tenantKey").equals(tenant).toArray(),
    mutations: await offlineDb.mutations.where("tenantKey").equals(tenant).toArray(),
  };
}

function textValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function appendTextSection(lines: string[], title: string, rows: any[], fields: string[]) {
  lines.push("", "=".repeat(78), title, "=".repeat(78));
  if (!rows.length) {
    lines.push("Nenhum registro encontrado.");
    return;
  }
  rows.forEach((row, index) => {
    lines.push("", `Registro ${index + 1}`);
    fields.forEach(field => lines.push(`${field}: ${textValue(row[field])}`));
  });
}

export function formatOfflineBackupAsText(backup: Awaited<ReturnType<typeof exportOfflineBackup>>) {
  const lines = [
    "GESTÃO DE EXTINTORES — EXPORTAÇÃO DE DADOS",
    "=".repeat(78),
    `Empresa/tenant offline: ${backup.tenantKey}`,
    `Arquivo gerado em: ${new Date(backup.exportedAt).toLocaleString("pt-BR")}`,
    "",
    "Este arquivo é uma cópia legível dos dados locais desta empresa.",
    "Guarde-o em local seguro. Para restauração automática, mantenha também o arquivo JSON.",
    "",
    `Resumo: ${backup.clients.length} cliente(s), ${backup.extinguishers.length} extintor(es), ${backup.orders.length} ordem(ns) de serviço, ${backup.alerts.length} alerta(s), ${backup.mutations.length} operação(ões) pendente(s).`,
  ];

  appendTextSection(lines, "CLIENTES", backup.clients, ["id", "companyName", "cnpj", "address", "city", "cep", "phone", "contactName", "cpf", "birthDate", "notes", "createdAt", "updatedAt"]);
  appendTextSection(lines, "EXTINTORES", backup.extinguishers, ["id", "clientId", "typeModel", "capacity", "serialNumber", "locationInBuilding", "expirationDate", "lastInspectionDate", "status", "notes", "createdAt", "updatedAt"]);

  lines.push("", "=".repeat(78), "ORDENS DE SERVIÇO", "=".repeat(78));
  if (!backup.orders.length) lines.push("Nenhuma ordem de serviço encontrada.");
  backup.orders.forEach((row, index) => {
    lines.push("", `Ordem ${index + 1}`);
    ["id", "orderNumber", "orderDate", "clientId", "replacedAndDelivered", "leftReserve", "reserveDetails", "extinguisherExpiration", "licenseExpiration", "totalAmount", "paymentMethod", "installmentsCount", "installmentDates", "responsibleName", "responsibleCpf", "responsibleBirthDate", "observations", "createdAt", "updatedAt"].forEach(field => lines.push(`${field}: ${textValue(row.order?.[field])}`));
    lines.push("Cliente vinculado:");
    ["id", "companyName", "cnpj", "address", "city", "phone", "contactName"].forEach(field => lines.push(`  ${field}: ${textValue(row.client?.[field])}`));
    if (Array.isArray((row as any).items)) {
      lines.push("Itens da ordem:");
      (row as any).items.forEach((item: any, itemIndex: number) => lines.push(`  ${itemIndex + 1}. ${textValue(item.description)} | quantidade: ${textValue(item.quantity)} | unitário: ${textValue(item.unitPrice)} | total: ${textValue(item.totalPrice)}`));
    }
  });

  appendTextSection(lines, "ALERTAS DE VALIDADE", backup.alerts, ["id", "clientId", "expirationDate", "alertStatus", "diffDays", "alertMessage", "createdAt", "updatedAt"]);
  appendTextSection(lines, "CONFIGURAÇÕES", backup.settings, ["key", "value"]);
  appendTextSection(lines, "OPERAÇÕES OFFLINE PENDENTES", backup.mutations, ["id", "entity", "action", "state", "createdAt", "lastError", "payload"]);
  lines.push("", "=".repeat(78), "FIM DA EXPORTAÇÃO", "=".repeat(78), "");
  return lines.join("\n");
}

function validateRows(payload: any, tenantKey: string) {
  const arrays = ["clients", "extinguishers", "orders", "alerts", "settings", "mutations"];
  for (const key of arrays) {
    if (payload[key] !== undefined && !Array.isArray(payload[key])) throw new Error(`Backup inválido: ${key} não é uma lista.`);
    for (const row of payload[key] || []) {
      if (!row || row.tenantKey !== tenantKey) throw new Error("Backup pertence a outra empresa ou não possui tenant válido.");
    }
  }
}

export async function importOfflineBackup(payload: any, tenantKey: string, options: { replaceExisting: boolean }) {
  const tenant = requireTenantKey(tenantKey);
  if (!payload || payload.format !== "gestao-extintores-offline-backup" || payload.version !== 2) throw new Error("Arquivo de backup incompatível. Exporte um backup novo.");
  if (payload.tenantKey !== tenant) throw new Error("Este backup pertence a outra empresa e foi bloqueado.");
  validateRows(payload, tenant);
  if (!options.replaceExisting) throw new Error("A restauração exige confirmação explícita para substituir dados locais.");

  await offlineDb.transaction("rw", [offlineDb.clients, offlineDb.extinguishers, offlineDb.orders, offlineDb.alerts, offlineDb.settings, offlineDb.meta, offlineDb.mutations], async () => {
    await deleteScopedRows(offlineDb.clients, tenant);
    await deleteScopedRows(offlineDb.extinguishers, tenant);
    await deleteScopedRows(offlineDb.orders, tenant);
    await deleteScopedRows(offlineDb.alerts, tenant);
    await deleteScopedRows(offlineDb.settings, tenant);
    await deleteScopedRows(offlineDb.mutations, tenant);
    if (Array.isArray(payload.clients)) await offlineDb.clients.bulkPut(payload.clients);
    if (Array.isArray(payload.extinguishers)) await offlineDb.extinguishers.bulkPut(payload.extinguishers);
    if (Array.isArray(payload.orders)) await offlineDb.orders.bulkPut(payload.orders);
    if (Array.isArray(payload.alerts)) await offlineDb.alerts.bulkPut(payload.alerts);
    if (Array.isArray(payload.settings)) await offlineDb.settings.bulkPut(payload.settings);
    if (Array.isArray(payload.mutations)) await offlineDb.mutations.bulkPut(payload.mutations);
    await offlineDb.meta.put({ key: scopedKey(tenant, "lastBackupImport"), tenantKey: tenant, value: new Date().toISOString() });
  });
}

export async function clearOfflineData(tenantKey: string) {
  const tenant = requireTenantKey(tenantKey);
  await offlineDb.transaction("rw", [offlineDb.clients, offlineDb.extinguishers, offlineDb.orders, offlineDb.alerts, offlineDb.settings, offlineDb.mutations], async () => {
    await deleteScopedRows(offlineDb.clients, tenant);
    await deleteScopedRows(offlineDb.extinguishers, tenant);
    await deleteScopedRows(offlineDb.orders, tenant);
    await deleteScopedRows(offlineDb.alerts, tenant);
    await deleteScopedRows(offlineDb.settings, tenant);
    await deleteScopedRows(offlineDb.mutations, tenant);
  });
}

export async function queueOfflineMutation(mutation: Omit<OfflineMutation, "createdAt" | "state">) {
  const tenantKey = requireTenantKey(mutation.tenantKey);
  await offlineDb.mutations.add({ ...mutation, tenantKey, state: "pending", attempts: 0, createdAt: new Date().toISOString() });
}

export async function retryOfflineMutation(id: number, tenantKey: string) {
  const tenant = requireTenantKey(tenantKey);
  const mutation = await offlineDb.mutations.get(id);
  if (!mutation || mutation.tenantKey !== tenant) throw new Error("Operação offline não encontrada.");
  await offlineDb.mutations.update(id, { state: "pending", lastError: undefined, lastAttemptAt: undefined });
}

export async function discardOfflineMutation(id: number, tenantKey: string) {
  const tenant = requireTenantKey(tenantKey);
  const mutation = await offlineDb.mutations.get(id);
  if (!mutation || mutation.tenantKey !== tenant) throw new Error("Operação offline não encontrada.");
  await offlineDb.mutations.delete(id);
}

export async function markOfflineMutationFailed(id: number, tenantKey: string, error: string) {
  const tenant = requireTenantKey(tenantKey);
  const mutation = await offlineDb.mutations.get(id);
  if (!mutation || mutation.tenantKey !== tenant) return;
  await offlineDb.mutations.update(id, { state: "failed", lastError: error, attempts: (mutation.attempts || 0) + 1, lastAttemptAt: new Date().toISOString() });
}

export async function pruneOfflineMutations(tenantKey: string, failedAfterDays = 30, pendingAfterDays = 90) {
  const tenant = requireTenantKey(tenantKey);
  const now = Date.now();
  const failedCutoff = now - failedAfterDays * 86400000;
  const pendingCutoff = now - pendingAfterDays * 86400000;
  const rows = await offlineDb.mutations.where("tenantKey").equals(tenant).toArray();
  const expired = rows.filter((row) => {
    const timestamp = new Date(row.createdAt).getTime();
    return (row.state === "failed" && timestamp < failedCutoff) || ((row.state || "pending") === "pending" && timestamp < pendingCutoff);
  }).map((row) => row.id).filter((id): id is number => typeof id === "number");
  if (expired.length) await offlineDb.mutations.bulkDelete(expired);
  return expired.length;
}
