// GERADO por scripts/gen-legal-texts.py a partir de docs/juridico. Não edite à mão.
export const LEGAL_TEXT_VERSION = "2026-11-05 (versão preliminar)";
export const LEGAL_TEXTS: Record<"termos" | "privacidade", Array<{ h: string; p: string[] }>> = {
 "termos": [
  {
   "h": "1. Partes e objeto",
   "p": [
    "Estes Termos regem o uso do GondUp, serviço online de gestão de equipes de campo (roteiros, visitas, validade de produtos e registro eletrônico de ponto), fornecido por [RAZÃO SOCIAL], CNPJ [CNPJ] (\"GondUp\"), à empresa que contrata o serviço (\"Cliente\") e aos usuários cadastrados por ela (\"Usuários\")."
   ]
  },
  {
   "h": "2. Natureza da relação",
   "p": [
    "A contratação é feita entre empresas, para uso na atividade econômica do Cliente, e se rege pelo Código Civil. O Cliente declara que contrata o serviço como insumo da sua atividade [VERIFICAR COM O ADVOGADO a aplicação do CDC a clientes de pequeno porte]."
   ]
  },
  {
   "h": "3. Contas e acesso",
   "p": [
    "As contas são criadas pelo administrador do Cliente. Cada Usuário é responsável pela confidencialidade da sua senha. O Cliente responde pelos atos praticados por seus Usuários e deve desativar o acesso de quem deixar a empresa."
   ]
  },
  {
   "h": "4. Registro de ponto",
   "p": [
    "4.1. O GondUp registra as marcações de forma imutável, com número sequencial (NSR), código de integridade (hash SHA-256), hora do servidor e do aparelho, fuso e localização, e gera comprovante, espelho e arquivos AFD/AEJ nos leiautes da Portaria MTP 671/2021.",
    "4.2. Situação regulatória: até a conclusão do registro do programa no INPI, da emissão do Atestado Técnico e da assinatura digital ICP-Brasil dos arquivos, o GondUp funciona como sistema de registro e tratamento de ponto sem o enquadramento formal de REP-P. O Cliente reconhece essa situação e é responsável pelo cumprimento das obrigações de controle de jornada perante a fiscalização. [ATUALIZAR quando o registro for concluído.]",
    "4.3. O Cliente é responsável pela veracidade dos dados cadastrais (CNPJ, CPF, cargo, horário contratual) e pelas decisões sobre correções de ponto, que ficam registradas com autor, data e motivo."
   ]
  },
  {
   "h": "5. Aceite eletrônico",
   "p": [
    "O Cliente e os Usuários reconhecem como válidas as manifestações feitas eletronicamente no sistema — ciência do aviso de privacidade, confirmação ou contestação do espelho de ponto, aprovação de correções e aceite destes Termos — comprovadas por data, hora, IP, identificação do aparelho e código de integridade do documento, como assinatura eletrônica simples ou avançada (Lei 14.063/2020; MP 2.200-2/2001, art. 10, § 2º)."
   ]
  },
  {
   "h": "6. Planos, pagamento e cancelamento",
   "p": [
    "[DEFINIR: valores, forma e data de cobrança, reajuste, inadimplência e suspensão, cancelamento, reembolso.] Em caso de cancelamento, o Cliente poderá exportar seus dados (inclusive AFD, AEJ e espelhos) por [30] dias; os registros de ponto serão mantidos ou devolvidos conforme o Contrato de Operação de Dados."
   ]
  },
  {
   "h": "7. Nível de serviço (SLA)",
   "p": [
    "7.1. Meta de disponibilidade mensal: [99,5%], excluídas manutenções programadas avisadas com [48 h] de antecedência e falhas de terceiros fora do controle do GondUp (provedores de internet, lojas de aplicativos, indisponibilidade de GPS do aparelho).",
    "7.2. Marcações feitas sem internet ficam guardadas no aparelho e são enviadas quando a conexão voltar, com a hora original e a sinalização de \"offline\".",
    "7.3. Se a meta não for cumprida, o Cliente terá crédito de [10%] da mensalidade por cada [0,5 ponto percentual] abaixo da meta, limitado a [50%] da mensalidade, como compensação única pela indisponibilidade.",
    "7.4. Backups diários, com retenção de [14] dias."
   ]
  },
  {
   "h": "8. Limitação de responsabilidade",
   "p": [
    "8.1. A responsabilidade total do GondUp por danos decorrentes destes Termos fica limitada ao valor pago pelo Cliente nos [12] meses anteriores ao fato.",
    "8.2. O GondUp não responde por lucros cessantes, perda de chance ou danos indiretos, nem por condenações trabalhistas decorrentes de jornada efetivamente praticada, de decisões do Cliente sobre correções de ponto ou de dados cadastrais incorretos.",
    "8.3. As limitações acima não se aplicam a dolo ou culpa grave, nem às obrigações de proteção de dados que a lei impõe ao operador (LGPD art. 42), que seguem o Contrato de Operação de Dados."
   ]
  },
  {
   "h": "9. Proteção de dados",
   "p": [
    "O tratamento de dados pessoais segue a Política de Privacidade e o Contrato de Operação de Dados (DPA), que fazem parte destes Termos."
   ]
  },
  {
   "h": "10. Propriedade intelectual",
   "p": [
    "O software, a marca e os materiais do GondUp pertencem a [RAZÃO SOCIAL]. Os dados inseridos pelo Cliente pertencem ao Cliente."
   ]
  },
  {
   "h": "11. Alterações",
   "p": [
    "Mudanças relevantes serão avisadas com [30] dias de antecedência no sistema ou por e-mail."
   ]
  },
  {
   "h": "12. Foro",
   "p": [
    "Fica eleito o foro da comarca de [CIDADE/UF]."
   ]
  }
 ],
 "privacidade": [
  {
   "h": "1. Quem somos",
   "p": [
    "O GondUp é um serviço online de gestão de equipes de campo (roteiros, visitas a lojas, validade de produtos e registro eletrônico de ponto), oferecido por [RAZÃO SOCIAL], CNPJ [CNPJ], com sede em [ENDEREÇO] (\"GondUp\"). Contato sobre privacidade: [E-MAIL DE PRIVACIDADE]."
   ]
  },
  {
   "h": "2. Papéis: quem decide sobre os dados",
   "p": [
    "Para os dados dos trabalhadores e das lojas cadastrados por uma empresa cliente, a empresa cliente é a controladora e o GondUp é operador: tratamos esses dados apenas para prestar o serviço e conforme as instruções do cliente, nos termos do Contrato de Operação de Dados (LGPD, arts. 5º, VI e VII, e 39). Para os dados de cadastro, cobrança e relacionamento com as empresas clientes e para os dados de navegação no site, o GondUp é controlador."
   ]
  },
  {
   "h": "3. Dados tratados",
   "p": [
    "- Conta de acesso: nome, e-mail, telefone, perfil de acesso, registros de login.",
    "- Dados do contrato de trabalho (informados pelo empregador): CPF, cargo, data de admissão, horário contratual.",
    "- Registro de ponto: data e hora de cada marcação (do servidor e do aparelho), fuso horário, localização GPS e precisão no momento da marcação, identificação técnica do aparelho/navegador, número sequencial (NSR) e código de integridade (hash).",
    "- Visitas e operação: check-in e check-out com localização, fotos de lojas e produtos, respostas de checklists, observações.",
    "- Prova de transparência e aceite: data, hora, IP e aparelho da ciência do aviso de privacidade e do aceite do espelho de ponto.",
    "- Registros de auditoria: quem fez o quê e quando no sistema.",
    "Não tratamos dados biométricos nem fazemos rastreamento contínuo de localização."
   ]
  },
  {
   "h": "4. Finalidades e bases legais",
   "p": [
    "Tratamento — Finalidade — Base legal (LGPD art. 7º)",
    "Registro de ponto, espelho, AFD/AEJ — Cumprir a obrigação de controle de jornada (CLT art. 74; Portaria MTP 671/2021) — II – cumprimento de obrigação legal",
    "GPS na marcação de ponto e nas visitas — Comprovar local e horário do trabalho externo — II – obrigação legal; V – execução do contrato",
    "Fotos de visitas e produtos — Comprovar a execução do serviço nas lojas — V – execução do contrato",
    "Conta de acesso e suporte — Permitir o uso do sistema — V – execução do contrato",
    "Auditoria e segurança — Prevenir fraudes, provar a integridade dos registros — IX – legítimo interesse; VI – exercício regular de direitos",
    "Cobrança das empresas clientes — Faturar o serviço — V – execução do contrato",
    "O tratamento dos dados dos trabalhadores não depende de consentimento, pois decorre de obrigação legal e do contrato de trabalho; o trabalhador é informado por meio do Aviso ao Trabalhador exibido no primeiro acesso."
   ]
  },
  {
   "h": "5. Compartilhamento e suboperadores",
   "p": [
    "Compartilhamos dados apenas com a empresa cliente (controladora), com autoridades quando exigido por lei ou ordem judicial e com os fornecedores de infraestrutura abaixo, contratados como suboperadores:",
    "Fornecedor — Serviço — Local de processamento",
    "Vercel Inc. — Hospedagem da aplicação — [CONFIRMAR REGIÃO — EUA/Brasil]",
    "PingCAP (TiDB Cloud) — Banco de dados — [CONFIRMAR REGIÃO]",
    "Cloudflare, Inc. (R2) — Armazenamento de fotos, arquivos e backups — [CONFIRMAR REGIÃO]",
    "Resend — Envio de e-mails transacionais — [CONFIRMAR REGIÃO — EUA]",
    "Functional Software (Sentry) — Monitoramento de erros — [CONFIRMAR REGIÃO — EUA]"
   ]
  },
  {
   "h": "6. Transferência internacional",
   "p": [
    "Quando houver processamento fora do Brasil, a transferência se apoia nas cláusulas-padrão contratuais aprovadas pela ANPD (Resolução CD/ANPD nº 19/2024), incorporadas aos contratos com os suboperadores, ou em outro mecanismo do art. 33 da LGPD. [CONFIRMAR COM O ADVOGADO.]"
   ]
  },
  {
   "h": "7. Por quanto tempo guardamos",
   "p": [
    "- Registros de ponto, correções, espelhos e aceites: durante todo o contrato de trabalho e por no mínimo 5 anos após o seu término (CF art. 7º, XXIX; prazo para ação trabalhista). Esses registros não podem ser alterados nem apagados; correções geram registros separados.",
    "- Registros de auditoria do ponto: pelo mesmo prazo.",
    "- Fotos de visitas e de lojas: apagadas automaticamente após 60 dias.",
    "- Conta de acesso: enquanto o vínculo com a empresa cliente existir; depois, anonimizada a pedido.",
    "- Backups: ciclo de [14] dias.",
    "- Ao fim do contrato com a empresa cliente, os dados são devolvidos e/ou eliminados conforme o Contrato de Operação de Dados, respeitados os prazos legais acima."
   ]
  },
  {
   "h": "8. Segurança",
   "p": [
    "Conexões criptografadas (HTTPS/TLS), senhas com hash, controle de acesso por perfil, trilha de auditoria, cadeia de integridade (hash SHA-256) nas marcações de ponto, backups diários e monitoramento de erros. Incidentes de segurança são comunicados à empresa cliente sem demora indevida, para que ela avalie a comunicação à ANPD e aos titulares (LGPD art. 48; Resolução CD/ANPD nº 15/2024)."
   ]
  },
  {
   "h": "9. Direitos do titular",
   "p": [
    "O titular pode pedir confirmação e acesso aos dados, correção, anonimização ou eliminação do que não for de guarda obrigatória, portabilidade, informação sobre compartilhamento e revisão de decisões (LGPD art. 18). O trabalhador pode fazer o pedido no próprio aplicativo, em \"Meus dados (LGPD)\", que também permite baixar uma cópia dos dados. Como o GondUp é operador, o pedido é encaminhado à empresa empregadora, que é a responsável por responder."
   ]
  },
  {
   "h": "10. Encarregado e contato",
   "p": [
    "[DEFINIR: nome do encarregado ou, se o GondUp se enquadrar como agente de pequeno porte (Resolução CD/ANPD nº 2/2022), o canal de comunicação com o titular.] E-mail: [E-MAIL DE PRIVACIDADE]."
   ]
  },
  {
   "h": "11. Alterações",
   "p": [
    "Esta política pode ser atualizada. A versão vigente fica sempre disponível no site e no aplicativo, com a data da última atualização."
   ]
  }
 ]
};
