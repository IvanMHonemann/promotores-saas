/**
 * Valor e texto do Pix gerado pelo administrador da plataforma,
 * a partir do plano, dos extras e do valor negociado da empresa.
 */
import { parseExtraUsers, suggestedMonthlyAmount } from "./staffLimit";

export type PixChargeInputs = {
  companyName: string;
  planName: string | null;
  planPrice: string | number | null;
  extraUsers: number | null;
  additionalUserPrice: string | number | null;
  negotiatedAmount: string | number | null;
  dueDate: string | null;
};

export type PixChargeLine = { label: string; amount: string | null };

export type PixChargeQuote = {
  companyName: string;
  planName: string | null;
  planPrice: string | null;
  extraUsers: number;
  additionalUserPrice: string | null;
  extrasTotal: string | null;
  suggestedAmount: string | null;
  negotiatedAmount: string | null;
  defaultAmount: string | null;
  dueDate: string | null;
  dueDateLabel: string | null;
  monthRef: string | null;
  usedNegotiated: boolean;
  lines: PixChargeLine[];
};

function asMoney(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

export function moneyLabelBr(amount: string | number): string {
  return Number(amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dueDateLabelBr(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return new Date(`${iso.slice(0, 10)}T12:00:00-03:00`).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

export function monthRefLabel(iso: string | null | undefined): string | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const [y, m] = iso.slice(0, 10).split("-").map(Number);
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${names[(m || 1) - 1]}/${y}`;
}

export function quotePixCharge(input: PixChargeInputs): PixChargeQuote {
  const planPrice = asMoney(input.planPrice);
  const additionalUserPrice = asMoney(input.additionalUserPrice);
  const extraUsers = parseExtraUsers(input.extraUsers);
  const extrasTotal = extraUsers > 0 && additionalUserPrice
    ? (extraUsers * Number(additionalUserPrice)).toFixed(2)
    : extraUsers > 0 ? "0.00" : null;
  const suggestedAmount = planPrice
    ? suggestedMonthlyAmount({ planPrice, extraUsers, additionalUserPrice })
    : null;
  const negotiatedAmount = asMoney(input.negotiatedAmount);
  const defaultAmount = negotiatedAmount || suggestedAmount;
  const usedNegotiated = Boolean(negotiatedAmount);
  const lines: PixChargeLine[] = [];
  if (planPrice) {
    lines.push({ label: input.planName ? `Preço do plano (${input.planName})` : "Preço do plano", amount: planPrice });
  }
  if (extraUsers > 0) {
    const unit = additionalUserPrice ? moneyLabelBr(additionalUserPrice) : "sem valor adicional";
    lines.push({
      label: extraUsers === 1
        ? `1 funcionário extra × ${unit}`
        : `${extraUsers} funcionários extras × ${unit}`,
      amount: extrasTotal,
    });
  }
  if (suggestedAmount && extraUsers > 0) {
    lines.push({ label: "Valor sugerido (plano + extras)", amount: suggestedAmount });
  }
  if (negotiatedAmount) {
    lines.push({ label: "Valor mensal negociado", amount: negotiatedAmount });
  }
  return {
    companyName: input.companyName,
    planName: input.planName,
    planPrice,
    extraUsers,
    additionalUserPrice,
    extrasTotal,
    suggestedAmount,
    negotiatedAmount,
    defaultAmount,
    dueDate: input.dueDate && /^\d{4}-\d{2}-\d{2}/.test(input.dueDate) ? input.dueDate.slice(0, 10) : null,
    dueDateLabel: dueDateLabelBr(input.dueDate),
    monthRef: monthRefLabel(input.dueDate),
    usedNegotiated,
    lines,
  };
}

/** Mensagem pronta para o super-admin enviar o Pix à empresa. Sem número: o WhatsApp pede o contato. */
export function pixChargeWhatsAppMessage(input: {
  companyName: string;
  monthRef: string | null;
  dueDateLabel: string | null;
  amountLabel: string;
  pixPayload?: string | null;
}): string {
  const lines = [
    "Olá! Segue o Pix da mensalidade GondUp.",
    "",
    `Empresa: ${input.companyName}`,
  ];
  if (input.monthRef) lines.push(`Referência: ${input.monthRef}`);
  if (input.dueDateLabel) lines.push(`Vencimento: ${input.dueDateLabel}`);
  lines.push(`Valor: ${input.amountLabel}`);
  if (input.pixPayload) {
    lines.push("", "Pix copia e cola:", input.pixPayload);
  }
  return lines.join("\n");
}

export function pixChargeWhatsAppUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
