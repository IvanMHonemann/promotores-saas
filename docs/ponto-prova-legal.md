# Ponto com valor de prova (Portaria MTP 671/2021)

## O que o sistema faz
- **Marcações imutáveis**: `time_events` com `origin='original'` nunca recebem UPDATE/DELETE (teste estático em `server/ponto/repFormat.test.ts`).
  Correções aprovadas viram novas linhas (`origin='adjustment'` com `replacesEventId`, ou `origin='inclusion'`), com quem aprovou, quando e motivo.
  Relatórios usam o horário efetivo (`effectiveRows`) e mostram o original.
- **NSR por empresa + cadeia SHA-256** (`rep_ledger_state`, colunas `nsr`, `recordHash`, `prevHash`, `contentHash`). Hash do registro 7 do AFD
  conforme o leiaute oficial; `contentHash` sela também tipo, GPS, precisão, hora do aparelho e fuso. Tratamentos têm cadeia própria.
- **Comprovante** por batida (PDF A5; e-mail se Resend/webhook configurado) — `/meus-comprovantes`.
- **Espelho mensal com aceite** (data, IP, user-agent, hash do documento) — `/meu-espelho`; admin vê em `/ponto-legal`.
- **AFD e AEJ** nos leiautes oficiais (ISO-8859-1, CRLF, CRC-16/KERMIT), **sem assinatura .p7s** (pendente certificado ICP-Brasil).
- **Verificação de integridade** em `/ponto-legal`.
- **Retenção**: marcações, correções e aceites não são apagados por rotina; auditoria do ponto nunca é apagada por padrão
  (`AUDIT_RETENTION_TIME_DAYS`, se definido, mínimo 7 anos). A limpeza de fotos (60 dias) só toca `store_photos`.
- **Nova jornada no mesmo dia**: entrada após saída é aceita e sinalizada (`[NOVA-JORNADA-MESMO-DIA]`).

## Migração
- `drizzle/0026_ponto_prova_legal.sql`; também aplicado automaticamente por `ensurePunchLedger()` no primeiro uso.
- Registros antigos são **selados uma vez** (`sealedLegacy=1`) na ordem do id: o selo prova que não mudaram depois dessa data, não antes.
- Ajustes antigos (feitos por UPDATE) continuam com o texto em `notes`.
- Recomendado: `REVOKE DELETE, UPDATE ON <db>.time_events FROM <usuário da aplicação>` após a migração (o selo inicial precisa de UPDATE uma vez).

## Variáveis
`GONDUP_DEVELOPER_DOCUMENT`, `GONDUP_DEVELOPER_NAME`, `GONDUP_DEVELOPER_EMAIL`, `GONDUP_INPI_NUMBER`, `GONDUP_PTRP_VERSION`.

## Pendências fora do código
Registro no INPI; certificado ICP-Brasil e assinatura .p7s; CNPJ/CPF do empregador cadastrado; parecer de advogado trabalhista; restringir permissões do banco.

## LGPD e relógio (PR seguinte)
- **Aviso ao trabalhador** (`shared/privacyNotice.ts`): modal de um toque no primeiro acesso do promotor; registra data, IP, aparelho, versão e hash do texto (`privacy_acknowledgements`). Mudou o texto → troque `PRIVACY_NOTICE_VERSION` e o aviso reaparece. Não é consentimento (base: art. 7º, II e V).
- **Cadastro**: CNPJ/CPF da empresa e CPF do funcionário validados (dígitos verificadores); novo campo *horário contratual* (`labor_profile.schedule`) vai para o registro 04 do AEJ e para o espelho. Pendências aparecem em `/ponto-legal`.
- **Relógio**: `server/ponto/clock.ts` mede o desvio do servidor e do banco contra a.ntp.br/b/c (SNTP UDP); se o UDP estiver bloqueado (comum em serverless), usa o cabeçalho Date HTTPS de ntp.br (~1 s). Roda no cron diário, ao abrir `/ponto-legal` (se > 6 h) e sob demanda. Grava em `clock_checks` e na auditoria; mudança de estado vira "ALERTA"/"AJUSTE". Em serverless não há como ajustar o relógio da máquina: o sistema mede e alerta.
- **Direitos do titular**: promotor em `/meus-dados` (baixar cópia, abrir pedido); administrador em `/lgpd` (pedidos, ciência do aviso, exportar ZIP com `dados.json` + `resumo.pdf`, anonimizar). A anonimização troca nome/e-mail/telefone por pseudônimo, invalida senha e sessões, agenda as fotos para exclusão e apaga GPS/observações de visitas — **mantém** marcações de ponto, perfil trabalhista (CPF), correções, aceites e auditoria (LGPD art. 16, I).
- **Textos jurídicos**: rascunhos em `docs/juridico/` (DPA, Termos, Política, Aviso). As páginas `/termos` e `/privacidade` são geradas deles por `scripts/gen-legal-texts.py` com aviso de versão preliminar.
- Migração: `drizzle/0032_lgpd_relogio.sql` (também automática no primeiro uso).
