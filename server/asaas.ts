/**
 * Camada de abstração Asaas.
 * ASAAS_ENVIRONMENT=mock (padrão) → sem chamadas externas.
 * Em produção futura: ASAAS_ENVIRONMENT=production + ASAAS_API_KEY + ASAAS_API_URL.
 */

export type AsaasEnvironment = "mock" | "sandbox" | "production";

export function getAsaasConfig() {
  const environment = (process.env.ASAAS_ENVIRONMENT || "mock").toLowerCase() as AsaasEnvironment;
  return {
    environment: (environment === "sandbox" || environment === "production" ? environment : "mock") as AsaasEnvironment,
    apiKey: process.env.ASAAS_API_KEY || "",
    apiUrl: process.env.ASAAS_API_URL || "https://api.asaas.com/v3",
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN || "",
  };
}

export function isMockMode() {
  return getAsaasConfig().environment === "mock" || !getAsaasConfig().apiKey;
}

function mockId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  status: string;
  nextDueDate?: string;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate?: string;
  paymentDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

export type AsaasCheckout = {
  id: string;
  url: string;
  status: "MOCK_READY";
};

async function realRequest<T>(_path: string, _init?: RequestInit): Promise<T> {
  const cfg = getAsaasConfig();
  if (isMockMode()) throw new Error("Asaas real API disabled in mock mode");
  // Placeholder for future real integration
  const res = await fetch(`${cfg.apiUrl}${_path}`, {
    ..._init,
    headers: {
      "Content-Type": "application/json",
      access_token: cfg.apiKey,
      ...(_init?.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Asaas API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function createCustomer(input: { name: string; email?: string; cpfCnpj?: string }): Promise<AsaasCustomer> {
  if (isMockMode()) {
    return { id: mockId("cus_mock"), name: input.name, email: input.email, cpfCnpj: input.cpfCnpj };
  }
  return realRequest<AsaasCustomer>("/customers", { method: "POST", body: JSON.stringify(input) });
}

export async function createSubscription(input: {
  customer: string;
  billingType: string;
  value: number;
  cycle: "MONTHLY" | "YEARLY";
  nextDueDate?: string;
}): Promise<AsaasSubscription> {
  if (isMockMode()) {
    return {
      id: mockId("sub_mock"),
      customer: input.customer,
      billingType: input.billingType,
      value: input.value,
      cycle: input.cycle,
      status: "ACTIVE",
      nextDueDate: input.nextDueDate,
    };
  }
  return realRequest<AsaasSubscription>("/subscriptions", { method: "POST", body: JSON.stringify(input) });
}

export async function getSubscription(id: string): Promise<AsaasSubscription> {
  if (isMockMode()) {
    return { id, customer: "cus_mock", billingType: "MOCK", value: 0, cycle: "MONTHLY", status: "ACTIVE" };
  }
  return realRequest<AsaasSubscription>(`/subscriptions/${id}`);
}

export async function cancelSubscription(id: string): Promise<AsaasSubscription> {
  if (isMockMode()) {
    return { id, customer: "cus_mock", billingType: "MOCK", value: 0, cycle: "MONTHLY", status: "CANCELED" };
  }
  return realRequest<AsaasSubscription>(`/subscriptions/${id}`, { method: "DELETE" });
}

export async function updateSubscription(id: string, input: Record<string, unknown>): Promise<AsaasSubscription> {
  if (isMockMode()) {
    return { id, customer: "cus_mock", billingType: "MOCK", value: Number(input.value || 0), cycle: "MONTHLY", status: "ACTIVE" };
  }
  return realRequest<AsaasSubscription>(`/subscriptions/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export async function createCheckout(input: {
  customer: string;
  value: number;
  billingType?: string;
  description?: string;
}): Promise<AsaasCheckout> {
  if (isMockMode()) {
    return { id: mockId("chk_mock"), url: `/checkout/mock?ref=${mockId("ref")}`, status: "MOCK_READY" };
  }
  return realRequest<AsaasCheckout>("/payments", { method: "POST", body: JSON.stringify(input) });
}

export async function getPayment(id: string): Promise<AsaasPayment> {
  if (isMockMode()) {
    return {
      id,
      customer: "cus_mock",
      value: 0,
      billingType: "MOCK",
      status: "CONFIRMED",
    };
  }
  return realRequest<AsaasPayment>(`/payments/${id}`);
}

export async function createPayment(input: {
  customer: string;
  subscription?: string;
  value: number;
  billingType?: string;
  dueDate?: string;
}): Promise<AsaasPayment> {
  if (isMockMode()) {
    return {
      id: mockId("pay_mock"),
      customer: input.customer,
      subscription: input.subscription,
      value: input.value,
      netValue: input.value,
      billingType: input.billingType || "MOCK",
      status: "PENDING",
      dueDate: input.dueDate,
      invoiceUrl: `https://mock.local/invoice/${mockId("inv")}`,
      bankSlipUrl: `https://mock.local/boleto/${mockId("bol")}`,
    };
  }
  return realRequest<AsaasPayment>("/payments", { method: "POST", body: JSON.stringify(input) });
}
