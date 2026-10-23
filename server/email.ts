/**
 * Serviço de e-mail do GondUp (preparado para migração de hospedagem).
 *
 * Por padrão os e-mails só são registrados no log (EMAIL_PROVIDER=console).
 * Quando migrar a hospedagem, configure o provedor de e-mail de lá:
 *
 * - EMAIL_PROVIDER=console|resend|webhook
 * - ADMIN_NOTIFICATION_EMAIL=seu@email.com   (você recebe cadastros e upgrades)
 * - EMAIL_FROM="GondUp <noreply@seudominio.com>"
 * - APP_PUBLIC_URL=https://seu-dominio.com
 * - RESEND_API_KEY=...          (se usar Resend)
 * - EMAIL_WEBHOOK_URL=...       (se usar gateway/SMTP da nova hospedagem via webhook)
 *
 * Sem provedor configurado a aplicação continua normal; nada quebra.
 */

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
};

function env(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

export function getAdminNotificationEmail(): string {
  return env("ADMIN_NOTIFICATION_EMAIL", "ivan.honemann@gmail.com");
}

export function getAppPublicUrl(): string {
  return env("APP_PUBLIC_URL", "https://promotores-saas-teste.vercel.app").replace(/\/$/, "");
}

export function getEmailFrom(): string {
  return env("EMAIL_FROM", "GondUp <onboarding@resend.dev>");
}

function provider(): "resend" | "webhook" | "console" {
  const explicit = env("EMAIL_PROVIDER").toLowerCase();
  if (explicit === "console") return "console";
  if (explicit === "webhook" || env("EMAIL_WEBHOOK_URL")) return env("EMAIL_WEBHOOK_URL") ? "webhook" : "console";
  if (explicit === "resend" || env("RESEND_API_KEY")) return "resend";
  return "console";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#0a0f23;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e8ecf8;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0a0f23;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#141a2e;border:1px solid #2a334d;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:20px 24px;background:linear-gradient(135deg,#e10600,#ff2d2d);">
          <div style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-0.02em;">GondUp</div>
          <div style="font-size:12px;color:rgba(255,255,255,.9);margin-top:2px;">Gestão de operações</div>
        </td></tr>
        <tr><td style="padding:28px 24px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#fff;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 24px;border-top:1px solid #2a334d;font-size:12px;color:#8b93ad;">
          Este e-mail foi enviado automaticamente pelo GondUp. Não responda a esta mensagem se não reconhecer a atividade.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#8b93ad;font-size:13px;width:38%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#fff;font-size:14px;font-weight:600;vertical-align:top;">${escapeHtml(value)}</td>
  </tr>`;
}

function dataTable(rows: Array<[string, string]>): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:12px 0 20px;">${rows.map(([l, v]) => row(l, v)).join("")}</table>`;
}

function cta(href: string, label: string): string {
  return `<p style="margin:20px 0 8px;"><a href="${escapeHtml(href)}" style="display:inline-block;background:#e10600;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px;">${escapeHtml(label)}</a></p>`;
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const toList = (Array.isArray(input.to) ? input.to : [input.to])
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!toList.length) return { ok: false, error: "Destinatário ausente" };

  const mode = provider();
  if (mode === "console") {
    console.info("[email:console]", {
      to: toList,
      subject: input.subject,
      preview: (input.text || input.html).slice(0, 240),
    });
    return { ok: true, id: "console" };
  }

  if (mode === "webhook") {
    const endpoint = env("EMAIL_WEBHOOK_URL");
    if (!endpoint) {
      console.info("[email:webhook] EMAIL_WEBHOOK_URL ausente — log only", { to: toList, subject: input.subject });
      return { ok: true, id: "console" };
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          from: getEmailFrom(),
          to: toList,
          subject: input.subject,
          html: input.html,
          text: input.text,
          source: "extinfy",
          timestamp: new Date().toISOString(),
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        console.warn("[email:webhook] fail", res.status, detail);
        return { ok: false, error: detail || res.statusText };
      }
      return { ok: true, id: "webhook" };
    } catch (error) {
      console.warn("[email:webhook] error", error);
      return { ok: false, error: error instanceof Error ? error.message : "webhook failed" };
    }
  }

  // resend
  if (!env("RESEND_API_KEY")) {
    console.info("[email:console] RESEND_API_KEY ausente", { to: toList, subject: input.subject });
    return { ok: true, id: "console" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: getEmailFrom(),
        to: toList,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn("[email:resend] fail", res.status, body);
      return { ok: false, error: String((body as any)?.message || res.statusText) };
    }
    return { ok: true, id: String((body as any)?.id || "") };
  } catch (error) {
    console.warn("[email:resend] error", error);
    return { ok: false, error: error instanceof Error ? error.message : "send failed" };
  }
}

/** Conta criada (cadastro ou admin). */
export async function emailAccountCreated(input: {
  to: string;
  userName: string;
  companyName: string;
  email: string;
  password?: string;
  recoveryCode: string;
  planName?: string | null;
  isTrial?: boolean;
}) {
  const loginUrl = `${getAppPublicUrl()}/?login=1`;
  const planLine = input.planName
    ? `${input.planName}${input.isTrial ? " (teste grátis)" : ""}`
    : input.isTrial
      ? "Teste grátis"
      : "Não informado";
  const rows: Array<[string, string]> = [
    ["Empresa", input.companyName],
    ["Responsável", input.userName],
    ["E-mail de acesso", input.email],
  ];
  if (input.password) rows.push(["Senha", input.password]);
  rows.push(["Código de redefinição", input.recoveryCode]);
  rows.push(["Plano", planLine]);

  const html = layout(
    "Sua conta GondUp foi criada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Olá, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Sua conta foi criada com sucesso. Guarde estes dados em local seguro.</p>
    ${dataTable(rows)}
    <p style="margin:0 0 8px;color:#c4cae0;font-size:13px;line-height:1.5;">Use o <strong style="color:#fff;">código de redefinição</strong> se precisar trocar a senha na tela de recuperação.</p>
    ${cta(loginUrl, "Entrar no GondUp")}`,
  );

  return sendEmail({
    to: input.to,
    subject: "GondUp — conta criada e dados de acesso",
    html,
    text: `Conta criada\nEmpresa: ${input.companyName}\nE-mail: ${input.email}\nSenha: ${input.password || "(a definida no cadastro)"}\nCódigo de redefinição: ${input.recoveryCode}\nPlano: ${planLine}\nAcesse: ${loginUrl}`,
  });
}

/** Compra / upgrade de plano. */
export async function emailPlanChanged(input: {
  to: string;
  userName: string;
  companyName: string;
  planName: string;
  status: string;
  amount?: string | null;
  periodEnd?: string | null;
  isUpgrade?: boolean;
}) {
  const title = input.isUpgrade ? "Upgrade de plano confirmado" : "Plano adquirido";
  const rows: Array<[string, string]> = [
    ["Empresa", input.companyName],
    ["Plano", input.planName],
    ["Status", input.status],
  ];
  if (input.amount) rows.push(["Valor", `R$ ${input.amount}`]);
  if (input.periodEnd) rows.push(["Válido até", input.periodEnd]);

  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Olá, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong>. Registramos a alteração do plano da sua empresa.</p>
    ${dataTable(rows)}
    ${cta(`${getAppPublicUrl()}/minha-assinatura`, "Ver minha assinatura")}`,
  );

  return sendEmail({
    to: input.to,
    subject: `GondUp — ${title}: ${input.planName}`,
    html,
    text: `${title}\nEmpresa: ${input.companyName}\nPlano: ${input.planName}\nStatus: ${input.status}`,
  });
}

/** Aviso ao administrador da plataforma. */
export async function emailAdminNewCompany(input: {
  companyName: string;
  userName: string;
  email: string;
  planName?: string | null;
  isTrial?: boolean;
}) {
  const admin = getAdminNotificationEmail();
  if (!admin) return { ok: false, error: "ADMIN_NOTIFICATION_EMAIL vazio" };

  const planLabel = input.planName
    ? `${input.planName}${input.isTrial ? " — teste grátis" : ""}`
    : input.isTrial
      ? "Teste grátis (plano não informado)"
      : "Não informado";

  const html = layout(
    "Nova empresa cadastrada",
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Uma nova empresa acabou de se cadastrar no GondUp.</p>
    ${dataTable([
      ["Empresa", input.companyName],
      ["Responsável", input.userName],
      ["E-mail", input.email],
      ["Plano / modo", planLabel],
      ["Quando", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ])}`,
  );

  return sendEmail({
    to: admin,
    subject: `GondUp — nova empresa: ${input.companyName} (${planLabel})`,
    html,
    text: `Nova empresa\n${input.companyName}\n${input.userName} <${input.email}>\nPlano: ${planLabel}`,
  });
}

/** Alertas de vencimento de extintores. */

/** Aviso ao administrador da plataforma: upgrade / mudança de plano. */
export async function emailAdminPlanChanged(input: {
  companyName: string;
  userName: string;
  email: string;
  planName: string;
  status: string;
  amount?: string | null;
  isUpgrade?: boolean;
}) {
  const admin = getAdminNotificationEmail();
  if (!admin) return { ok: false, error: "ADMIN_NOTIFICATION_EMAIL vazio" };

  const title = input.isUpgrade ? "Upgrade de plano na plataforma" : "Plano adquirido na plataforma";
  const html = layout(
    title,
    `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Um cliente alterou ou adquiriu um plano no GondUp.</p>
    ${dataTable([
      ["Empresa", input.companyName],
      ["Responsável", input.userName],
      ["E-mail", input.email],
      ["Plano", input.planName],
      ["Status", input.status],
      ["Valor", input.amount ? `R$ ${input.amount}` : "—"],
      ["Quando", new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })],
    ])}`,
  );

  return sendEmail({
    to: admin,
    subject: `GondUp — ${input.isUpgrade ? "upgrade" : "plano"}: ${input.companyName} → ${input.planName}`,
    html,
    text: `${title}\nEmpresa: ${input.companyName}\n${input.userName} <${input.email}>\nPlano: ${input.planName}\nStatus: ${input.status}`,
  });
}

/** Alertas de validade do inventário de produtos cadastrados pela empresa. */
export async function emailProductExpirationAlerts(input: {
  to: string; companyName: string; userName: string;
  items: Array<{ productCode: string; description: string; quantity: number; expirationDate: string; price: string | number; }>;
}) {
  if (!input.items.length) return { ok: true, id: "empty" };
  const list = input.items.slice(0, 50).map((item) => `<li style="margin:0 0 12px;color:#c4cae0;"><strong style="color:#fff;">${escapeHtml(item.description)}</strong><br/>Código: ${escapeHtml(item.productCode)} · Quantidade: ${item.quantity} · Preço: R$ ${escapeHtml(String(item.price))}<br/><span style="color:#fbbf24;">Validade: ${escapeHtml(item.expirationDate)}</span></li>`).join("");
  const more = input.items.length > 50 ? `<p style="color:#8b93ad;font-size:13px;">… e mais ${input.items.length - 50} produto(s).</p>` : "";
  const html = layout("Produtos próximos do vencimento", `<p style="margin:0 0 12px;color:#c4cae0;line-height:1.5;">Olá, <strong style="color:#fff;">${escapeHtml(input.userName)}</strong> (${escapeHtml(input.companyName)}). Estes produtos vencem nos próximos 30 dias:</p><ul style="margin:0;padding-left:18px;">${list}</ul>${more}${cta(getAppPublicUrl() + "/produtos", "Ver produtos e validades")}`);
  return sendEmail({ to: input.to, subject: `GondUp — ${input.items.length} produto(s) vencem em até 30 dias (${input.companyName})`, html, text: `Produtos com validade nos próximos 30 dias: ${input.items.map(i => `${i.description} (${i.productCode}), quantidade ${i.quantity}, validade ${i.expirationDate}, preço R$ ${i.price}`).join("; ")}. Acesse /produtos.` });
}
