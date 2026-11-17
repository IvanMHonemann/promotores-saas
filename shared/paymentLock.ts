/**
 * Quando a assinatura passou da tolerância, o app mostra só a tela de pagamento.
 * O administrador geral em modo "acessar como esta empresa" nunca fica preso nela.
 */
export function shouldApplyPaymentLock(opts: {
  role?: string | null;
  companyId?: number | null;
  actingAs?: boolean;
  allowed?: boolean;
}): boolean {
  if (opts.actingAs) return false;
  if (!opts.role || opts.role === "platform_admin" || !opts.companyId) return false;
  return opts.allowed === false;
}
