/** Lógica do formulário de contato em forma de chat (sem envio pelo servidor: abre o WhatsApp). */
export const DEFAULT_CONTACT_WHATSAPP = "5551991667804";

export type ContactField = "motivo" | "nome" | "empresa" | "telefone" | "promotores" | "mensagem";
export type ContactAnswers = Partial<Record<ContactField, string>>;
export type ContactStep = { field: ContactField; question: string; placeholder: string; optional?: boolean; inputMode?: "text" | "tel" | "numeric"; options?: string[] };

export const CONTACT_REASONS = ["Solicitar demonstração", "Planos e preços", "Suporte", "Outro"];
export const OTHER_REASON = "Outro";

export const CONTACT_STEPS: ContactStep[] = [
  { field: "motivo", question: "Olá! 👋 Sou o assistente do GondUp. Qual é o motivo do seu contato?", placeholder: "Descreva o motivo", options: CONTACT_REASONS },
  { field: "nome", question: "Certo! Qual é o seu nome?", placeholder: "Seu nome" },
  { field: "empresa", question: "Prazer, {nome}! Qual é o nome da sua empresa ou agência?", placeholder: "Nome da empresa" },
  { field: "telefone", question: "Qual é o seu telefone ou WhatsApp com DDD?", placeholder: "(51) 99999-9999", inputMode: "tel" },
  { field: "promotores", question: "Quantos promotores sua equipe tem hoje?", placeholder: "Ex.: 12", inputMode: "numeric" },
  { field: "mensagem", question: "Quer deixar alguma mensagem? (opcional — pode pular)", placeholder: "Sua mensagem", optional: true },
];

export function onlyDigits(v: string) { return v.replace(/\D/g, ""); }

/** Formata telefone brasileiro: (51) 99166-7804. */
export function formatPhone(v: string) {
  let d = onlyDigits(v);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return v.trim();
}

/** Retorna mensagem de erro em pt-BR, ou null se o valor é válido. */
export function validateContactField(field: ContactField, raw: string): string | null {
  const v = raw.trim();
  switch (field) {
    case "motivo":
      if (v.length < 3) return "Escolha uma opção ou descreva o motivo.";
      return v.length > 120 ? "Motivo muito longo (máximo 120 caracteres)." : null;
    case "nome":
      if (v.length < 2) return "Digite seu nome (pelo menos 2 letras).";
      if (!/\p{L}/u.test(v)) return "O nome precisa ter letras.";
      return v.length > 80 ? "Nome muito longo (máximo 80 caracteres)." : null;
    case "empresa":
      if (v.length < 2) return "Digite o nome da empresa.";
      return v.length > 100 ? "Nome muito longo (máximo 100 caracteres)." : null;
    case "telefone": {
      let d = onlyDigits(v);
      if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
      if (d.length !== 10 && d.length !== 11) return "Informe o telefone com DDD (10 ou 11 números).";
      if (d.startsWith("0")) return "O DDD não começa com 0.";
      return null;
    }
    case "promotores": {
      if (!/^\d+$/.test(v)) return "Digite só o número de promotores (ex.: 12).";
      const n = Number(v);
      return n < 1 || n > 100000 ? "Informe um número entre 1 e 100.000." : null;
    }
    case "mensagem":
      return v.length > 500 ? "Mensagem muito longa (máximo 500 caracteres)." : null;
  }
}

export function normalizeAnswer(field: ContactField, raw: string) {
  const v = raw.trim().replace(/\s+/g, " ");
  return field === "telefone" ? formatPhone(v) : field === "promotores" ? String(Number(v)) : v;
}

export function questionText(step: ContactStep, answers: ContactAnswers) {
  return step.question.replace("{nome}", (answers.nome || "").split(" ")[0]);
}

export function buildWhatsAppMessage(a: ContactAnswers) {
  const lines = [
    `*Motivo do contato:* ${a.motivo ?? ""}`,
    "",
    "Olá! Vim pelo site do GondUp.",
    "",
    `*Nome:* ${a.nome ?? ""}`,
    `*Empresa:* ${a.empresa ?? ""}`,
    `*Telefone/WhatsApp:* ${a.telefone ?? ""}`,
    `*Promotores:* ${a.promotores ?? ""}`,
  ];
  if (a.mensagem?.trim()) lines.push(`*Mensagem:* ${a.mensagem.trim()}`);
  return lines.join("\n");
}

export function contactWhatsAppNumber(envValue?: string) {
  const d = onlyDigits(envValue || "");
  return d.length >= 12 ? d : DEFAULT_CONTACT_WHATSAPP;
}

export function buildWhatsAppUrl(a: ContactAnswers, number = DEFAULT_CONTACT_WHATSAPP) {
  return `https://wa.me/${number}?text=${encodeURIComponent(buildWhatsAppMessage(a))}`;
}
