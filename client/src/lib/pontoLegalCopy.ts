/** Textos simples (pt-BR) da tela de ponto para a empresa — sem jargão técnico. */

export function simplifyIntegrityProblem(p: { nsr?: number | null; kind?: string; message?: string }): string {
  const n = p.nsr != null ? `nº ${p.nsr}` : null;
  switch (p.kind) {
    case "hash":
      return n
        ? `A batida ${n} parece ter sido alterada depois de gravada.`
        : "Um registro de correção parece ter sido alterado depois de gravado.";
    case "chain":
      return n
        ? `O lacre de segurança da batida ${n} não confere com a anterior.`
        : "O lacre de segurança de uma correção não confere com a anterior.";
    case "gap":
      return n
        ? `Falta batida na sequência perto do número ${p.nsr}.`
        : "Falta batida na sequência numerada.";
    case "duplicate":
      return n ? `O número da batida ${n} aparece mais de uma vez.` : "Há número de batida repetido.";
    case "unsealed":
      return "Há batida ainda sem o lacre de segurança (registre de novo ou peça suporte).";
    default:
      return (p.message || "Problema nos registros.").replace(/\bNSR\b/gi, "nº").replace(/\bhash\b/gi, "lacre");
  }
}

/** Avisos de AFD/AEJ que a empresa pode resolver (sem pendências da plataforma). */
export function isCompanyActionableWarning(w: string): boolean {
  const t = w.toLowerCase();
  if (/inpi|icp-?brasil|\.p7s|desenvolvedor|gondup_|rep-p|portaria|certificado digital|assinatura digital/.test(t)) return false;
  return true;
}

export function simplifyExportWarning(w: string): string {
  if (/cnpj|cpf da empresa|empregador/i.test(w)) return "Falta o CNPJ (ou CPF) da empresa. Cadastre em Espelho de ponto → Dados da empresa.";
  if (/cpf.*funcion|perfil trabalhista/i.test(w)) return w.replace(/perfil trabalhista/gi, "cadastro do funcionário (Espelho de ponto)").replace(/marcação\(ões\)/gi, "batida(s)");
  if (/jornada contratual|registro 04/i.test(w)) return "Há funcionário sem horário de trabalho cadastrado. Preencha a jornada no Espelho de ponto → Dados da empresa / funcionário.";
  if (/horário contratual|entrada\/saída previstos/i.test(w)) return "O arquivo usa só a carga horária diária; os horários previstos de entrada e saída ainda não são cadastrados no sistema.";
  return w;
}
