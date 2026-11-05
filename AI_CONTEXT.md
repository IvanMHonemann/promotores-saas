# AI_CONTEXT.md

Contexto técnico conciso para continuidade do desenvolvimento.  
Última atualização: 2026-11-04. Base: `main` + branch `feat/vacation-schedules`.

## Visão geral

SaaS multiempresa (produto GondUp / Promotores SaaS) para gestão de promotores de merchandising: ponto eletrônico, roteiros, visitas, fotos de loja, clientes de loja, produtos/validades e gestão de equipe.

Origem: plataforma anterior de gestão de extintores. O domínio de promotores é o foco atual; resquícios legados ainda existem em schema e alguns limites de plano.

## Stack

- Frontend: React 19, Vite, Tailwind, shadcn/Radix, Wouter, TanStack Query, tRPC
- Backend: Express + tRPC, Drizzle ORM, MySQL/TiDB (`mysql2`)
- Auth: sessões próprias (member + platform admin); cookie + header `x-session-token` / `Authorization: Bearer`
- Storage: S3-compatible (Cloudflare R2 em uso)
- Offline/PWA: service worker + filas em IndexedDB (Dexie e filas custom)
- Deploy: dual — Vercel (serverless via `vercel.json` / `api/index.js`) **e** Node tradicional / Docker (`Dockerfile` + `pnpm start` → `node dist/index.js`). Ver `DEPLOY.md`.
- Billing: Asaas preparado (mock por padrão)
- E-mail: provider `console` por padrão (Resend/webhook opcionais)

## Arquitetura

- Multi-tenant por `companyId` / `accountId` (isolamento no backend).
- Papéis: `platform_admin`, `company_admin`, `supervisor`, `promoter`.
- Entitlements: plano da empresa + override de empresa + permissão por membro (`inherit` / `allow` / `deny`). Teto por papel.
- Acesso a lojas (`server/storeAccess.ts`):
  - Admin e supervisor: todas as lojas da empresa.
  - Promotor: somente lojas em `promoter_store_assignments`.
  - Cadastro de lojas: apenas admin e supervisor.
- Fotos: promotor vê as próprias; admin/supervisor veem as da empresa. `storeId` nullable (“Sem loja vinculada”).
- Algumas tabelas são criadas sob demanda (`ensure*Table`) para compatibilidade com bancos já existentes.
- Build: `vite build` (saída em `dist/public`) + esbuild do server (`dist/index.js`) e do entry Vercel.

### Principais tabelas (`drizzle/schema.ts`)

`companies`, `memberAccounts`, `promoterProfiles`, `clients`, `brands`, `retailChains`, `stores`, `teams`, `routes`, `weeklyRouteSchedules`, `visits`, `timeEvents`, `timeCorrectionRequests`, `storePhotos`, `visitPhotos`, `inventoryProducts`, `checklists` (+ questions/responses), `evidences`, `auditLogs`, `vacationSchedules`, planos/assinaturas/entitlements.

Tabelas auxiliares (criadas em runtime quando necessário): `store_owners`, `promoter_store_assignments`, entre outras.

### Módulos / routers relevantes

- `server/modules/timeTracking.ts` — ponto
- `server/modules/timesheetMirror.ts` — espelho de ponto
- `server/modules/timesheetArchive.ts` — arquivamento histórico de espelhos (PDF + R2)
- `server/modules/correctionExtras.ts` — tipo de justificativa e anexo em correções
- `server/modules/vacations.ts` — programação de férias
- `server/modules/storePhotos.ts` — fotos de loja
- `server/modules/storeClients.ts` — clientes de loja
- `server/modules/platformCompanies.ts` — empresas da plataforma
- `shared/holidays.ts` — feriados nacionais (espelho e abono)
- `server/storeAccess.ts` — visibilidade e atribuição de lojas
- `server/storage.ts` — S3/R2 (o `S3Client` é reaproveitado entre chamadas na mesma instância)
- `server/entitlements.ts` / `shared/entitlements.ts`
- `server/routers.ts` — `appRouter` (auth, operations, platform, etc.)

## Funcionalidades implementadas

- Auth: signup (empresa + admin, trial), login, recuperação, avatar, menu de conta unificado, sessão por cookie + token.
- Planos e entitlements (catálogo único, overrides, autorização no servidor e UI).
- Ponto: sequência do dia, saída automática de jornadas de dias anteriores, solicitação/inclusão de batidas esquecidas, espelho, alertas de batida faltante (dismiss persistido). Feriados nacionais identificados automaticamente (`shared/holidays.ts`): falta de batida em feriado é abonada e o ponto continua liberado. Correções/inclusões aceitam tipo de justificativa (`normal` / `feriado` / `folga` / `atestado`) e anexo de foto. Abono de dia inteiro (folga/feriado/atestado). Alerta de batida faltante do admin some quando há correção ou abono cobrindo o dia. Correções da mesma data podem ser aprovadas/recusadas juntas. Promotor vê aviso de correção recusada. Espelhos podem ser arquivados (PDF + hash + R2) em `/arquivos-historicos`.
- Menu do admin/supervisor: dropdowns Roteiros (ver/editar + check-in/out) e Cartão-ponto (visualizar + espelho + férias). Arquivos históricos e Meus módulos só para company_admin quando aplicável.
- Programação de férias (v1): administradores e supervisores cadastram, editam e cancelam períodos dos funcionários ativos (vários períodos por pessoa). Dias corridos calculados (início e fim inclusos). Impede sobreposição do mesmo funcionário (verificação em transação). Alerta (sem bloquear) se outros da mesma equipe (`supervisorId`) estiverem de férias no mesmo período. Histórico de quem criou/editou/cancelou. Calendário mensal/anual (agrupa meses mesmo cruzando o ano) e lista com filtros. Promotor consulta somente as próprias férias (`/minhas-ferias`), sem edição. Menu “Férias” no dropdown Cartão-ponto. Tabela `vacation_schedules` (migração `0025`). Sem solicitação/aprovação pelo funcionário, sem saldo legal nem pagamento nesta versão.
- Lojas, clientes de loja, roteiros semanais, visitas, check-in/out com foto de fachada. Visitas `in_progress` de dias anteriores são fechadas automaticamente; o bloqueio de check-in em outra loja considera só a visita aberta do mesmo dia. Lista de lojas compacta, com item “Fotos sem loja”.
- Fotos de loja: captura com marca d’água (nome, endereço, loja, data/hora), galeria, seleção em massa, compartilhamento, exclusão, expiração (~60 dias), relatório PDF. Suporte a foto sem loja. Botão Tirar foto permanece visível mesmo sem loja/cliente.
- Vínculo promotor ↔ lojas (opcional) na criação e na edição do promotor; alterações refletem imediatamente no acesso.
- Páginas de planos, upgrade, pagamentos e cadastro público arquivadas em `client/src/pages/_archived/`. Dono da empresa vê módulos liberados em `/meus-modulos`. Platform admin escolhe `featureKeys` na criação da empresa e edita módulos em `CompanyFeaturesCard`.
- Dashboards da Central (OperationsDashboard): lojas, fotos totais, produtos a vencer, visitas pendentes e alertas de validade (top 5), sem ranking de promotores.
- Check-in/check-out com foto da fachada (`client/src/components/VisitCheckIn.tsx` + `client/src/lib/photoUpload.ts`): a foto é redimensionada/comprimida (JPEG, lado maior 1280 px, q 0,72) logo após a captura, com preview via blob URL; GPS é lido ao abrir a tela (espera máx. 3 s ao confirmar); check-in/out e upload da foto rodam em paralelo com timeout (AbortController); etapa de progresso visível; botões travados durante o envio + trava síncrona contra toque duplo; erro do servidor (4xx) aparece na tela e permite "Tentar novamente" sem ir para a fila; só falha de rede/timeout/5xx/408/429 vai para a fila offline. A foto nunca é enviada sem compressão (imagem inválida => erro na tela).
- Idempotência da foto de check-in: chave `ci-<visita>-<ação>-<uuid>` gerada por captura e reaproveitada em retentativas e na fila (`QueuedVisit.idempotencyKey/capturedAt`); `visits.start` ignora visita que não está `pending` e `visits.complete` ignora visita já `completed` (reenvio não reinicia horários).
- Offline: cadastro de lojas/clientes, sincronização de visitas, fila de fotos (IndexedDB), cache de roteiro do dia.
- Produtos e validades (com lixeira).
- Auditoria append-only.
- PWA / service worker com fallback offline.
- Performance: code-splitting por rota, compressão gzip, `staleTime` no QueryClient, cache de assets.

## Decisões importantes

- Isolamento multi-tenant rigoroso no backend (não confiar só no frontend).
- Hooks de sync (`useVisitSync`, `usePhotoSync`): `useMutation()` muda de identidade a cada render; não usá-lo como dependência de `useEffect`. O efeito roda uma vez, usa ref para as mutations e tem trava `running` (antes disparava dezenas de envios duplicados). Esse padrão ainda pode existir em `useStoreSync`/`useClientSync` (não verificado).
- Filas offline (`visitQueue`, `photoQueue`) agora lançam erro quando o localStorage está cheio, em vez de perder o item em silêncio; quem enfileira deve tratar.
- Recarregamento automático do PWA (`controllerchange` em `main.tsx`) espera `window.__gondupUploading` zerar (máx. ~35 s) para não derrubar um envio em andamento.
- Sessão via cookie + header para compatibilidade com Vercel e clientes PWA.
- `storeId` nullable em fotos para não bloquear captura.
- Atribuição de lojas ao promotor é opcional e gerenciável a qualquer momento (sem recriar o usuário).
- Asaas permanece em mock até integração real.
- Schema legado de extintores preservado (`schema.original.ts` e algumas colunas/limites) para não quebrar dados antigos.
- Tabelas auxiliares criadas sob demanda para reduzir dependência de migrações manuais em ambientes já em produção.
- Servidor inicia HTTP apenas quando não detecta `process.env.VERCEL` (suporte dual serverless / processo tradicional).
- Férias v1 é apenas programação operacional: não altera cartão-ponto, não calcula saldo legal e não gera pagamento. Isolamento por `companyId` e permissões (admin/supervisor gerenciam; promotor só lê o próprio).
- Páginas comerciais de planos/pagamentos foram arquivadas; liberação de módulos é por entitlements/overrides, não por fluxo de checkout nesta fase.
- Espelho de ponto usa dia local `America/Sao_Paulo` e perfil trabalhista; jornada aberta de hoje não entra no saldo.

## Problemas conhecidos e pendências

- Resquícios do domínio de extintores ainda existem (schema original, alguns limites como `maxExtinguishers`, referências residuais).
- Conformidade do ponto com a Portaria MTP 671/2021 (REP) não foi validada juridicamente; o módulo é base técnica.
- Asaas ainda em modo mock; e-mail em modo console por padrão.
- `store_photos.idempotencyKey` não tem índice único: a deduplicação no servidor é select-then-insert (sujeita a corrida se duas requisições com a mesma chave chegarem juntas). Mitigado no cliente (trava + chave estável); índice único exigiria migração.
- Limite de corpo de requisição da Vercel (~4,5 MB): `uploadAndCreate` agora recusa `imageBase64` > 6 MB; fotos de check-in ficam em ~80–250 KB.
- Criação sob demanda de algumas tabelas pode adicionar latência no primeiro acesso.
- Checklists dinâmicos e evidências genéricas estão modelados no schema, mas o fluxo completo de produto ainda é parcial.
- Google Maps é opcional (`VITE_GOOGLE_MAPS_API_KEY`).
- Testes de banco exigem `EXTERNAL_DATABASE_URL`; a suíte completa não roda sem ambiente configurado.
- Sobreposição de férias é check-then-act dentro de transação, sem `SELECT FOR UPDATE` nem constraint de intervalo: concorrência alta ainda pode gerar períodos sobrepostos no mesmo funcionário.

## Deploy e ambientes

- Repositório: `IvanMHonemann/promotores-saas`
- Vercel: projetos conhecidos `promotores-saas` (oficial), `promotores-saas-teste` / `promotores-saas-teste-git`
- Tradicional / Docker / ShardCloud: use `Dockerfile` ou `pnpm start`. Guia em `DEPLOY.md`.
- Variáveis principais: `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET`, `S3_*`, `PORT`, `NODE_ENV=production`
- Healthcheck: `/healthz`
- Storage de fotos permanece no R2/S3 (não precisa migrar arquivos se manter as mesmas credenciais).

## Como manter este arquivo

Atualizar somente quando houver mudança relevante de arquitetura, funcionalidade, decisão ou pendência. Preservar informações anteriores que continuem válidas. Não incluir segredos, tokens, senhas ou trechos longos de conversa.
