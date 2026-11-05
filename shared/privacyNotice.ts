/**
 * Aviso ao trabalhador (LGPD art. 9º — transparência). NÃO é pedido de consentimento:
 * o tratamento se baseia no cumprimento de obrigação legal (CLT art. 74; Portaria MTP 671) e na execução do contrato de trabalho
 * (LGPD art. 7º, II e V). Ao mudar o texto, troque PRIVACY_NOTICE_VERSION: o aviso volta a aparecer para todos.
 * RASCUNHO PARA REVISÃO DO ADVOGADO.
 */
export const PRIVACY_NOTICE_VERSION = "2026-11-05.1";

export const PRIVACY_NOTICE_TITLE = "Como seus dados são usados no ponto e nas visitas";

export const PRIVACY_NOTICE_SECTIONS: Array<{ title: string; body: string }> = [
  { title: "Quem é o responsável", body: "A empresa que te contratou (seu empregador) é a controladora dos seus dados. O GondUp é o sistema que ela usa e trata os dados só seguindo as instruções dela." },
  { title: "O que coletamos", body: "Em cada batida de ponto: data e hora (do servidor e do seu aparelho), fuso horário, localização GPS com a precisão informada pelo aparelho e dados técnicos do aparelho/navegador. Nas visitas a lojas: as fotos que você tirar e a localização no check-in/check-out. Também seu nome, e-mail, telefone e os dados do contrato informados pela empresa (CPF, cargo, admissão, horário)." },
  { title: "Para quê", body: "Registrar sua jornada como a lei exige, calcular horas e gerar o espelho de ponto, comprovar as visitas feitas e cumprir obrigações trabalhistas e fiscais. A localização é colhida só no momento da batida ou do check-in — não existe rastreamento contínuo." },
  { title: "Por que não pedimos “consentimento”", body: "O registro de ponto é uma obrigação legal do empregador (CLT art. 74) e faz parte do contrato de trabalho. Por isso a base legal é o cumprimento de obrigação legal e a execução do contrato (LGPD art. 7º, II e V). Você está sendo informado, não precisa autorizar." },
  { title: "Quem vê", body: "Os administradores e supervisores da sua empresa e, quando necessário, auditores-fiscais do trabalho, a Justiça e o contador da empresa. O GondUp usa fornecedores de infraestrutura (hospedagem, banco de dados, armazenamento de arquivos, e-mail e monitoramento de erros), alguns com servidores fora do Brasil, sob contrato com cláusulas de proteção de dados." },
  { title: "Por quanto tempo", body: "As marcações de ponto são guardadas durante o contrato e por pelo menos 5 anos depois dele, por exigência legal, e não podem ser apagadas nem alteradas — correções viram registros separados. Fotos de visitas são apagadas automaticamente após 60 dias." },
  { title: "Seus direitos", body: "Você pode pedir uma cópia dos seus dados, a correção de dados errados e a eliminação ou anonimização do que não for de guarda obrigatória. Use o botão “Meus dados (LGPD)” no menu ou fale com o administrador da sua empresa." },
];

/** Texto canônico (para hash e prova de qual versão foi exibida). */
export function privacyNoticeText(): string {
  return [PRIVACY_NOTICE_TITLE, ...PRIVACY_NOTICE_SECTIONS.map((s) => `${s.title}\n${s.body}`)].join("\n\n");
}
