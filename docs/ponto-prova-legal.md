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
