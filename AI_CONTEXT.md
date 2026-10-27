# AI_CONTEXT.md

Contexto técnico conciso para continuidade do desenvolvimento.  
Última atualização: 2026-10-27. Base: `main` (`06c3630`).

## Visão geral

SaaS multiempresa (produto GondUp / Promotores SaaS) para gestão de promotores de merchandising: ponto eletrônico, roteiros, visitas, fotos de loja, clientes de loja, produtos/validades e gestão de equipe.

Origem: plataforma anterior de gestão de extintores. O domínio de promotores é o foco atual; resquícios legados ainda existem em schema e alguns limites de plano.

## Stack

- Frontend: React 19, Vite, Tailwind, shadcn/Radix, Wouter, TanStack Query, tRPC
- Backend: Express + tRPC, Drizzle ORM, MySQL/TiDB (`mysql2`)
- Auth: sessões próprias (member + platform admin); cookie + header `x-session-token` / `Authorization: Bearer`
- Storage: S3-compatible (Cloudflare R2 em uso)
- Offline/PWA: service worker + filas em IndexedDB (Dexie e filas custom)
- Deploy: Vercel (`vercel.json` → `api/index.js` serverless, `dist/public`)
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
- Fotos: promotor vê as próprias; admin/supervisor vêem as da empresa. `storeId` nullable (“Sem loja vinculada”).
- Algumas tabelas são criadas sob demanda (`ensure*Table`) para compatibilidade com bancos já existentes.
- Build: `vite build` + esbuild do server e do entry Vercel.

### Principais tabelas (`drizzle/schema.ts`)

`companies`, `memberAccounts`, `promoterProfiles`, `clients`, `brands`, `retailChains`, `stores`, `teams`, `routes`, `weeklyRouteSchedules`, `visits`, `timeEvents`, `timeCorrectionRequests`, `storePhotos`, `visitPhotos`, `inventoryProducts`, `checklists` (+ questions/responses), `evidences`, `auditLogs`, planos/assinaturas/entitlements.

Tabelas auxiliares (criadas em runtime quando necessário): `store_owners`, `promoter_store_assignments`, entre outras.

### Módulos / routers relevantes

- `server/modules/timeTracking.ts` — ponto
- `server/modules/storePhotos.ts` — fotos de loja
- `server/modules/storeClients.ts` — clientes de loja
- `server/modules/timesheetMirror.ts` — espelho de ponto
- `server/storeAccess.ts` — visibilidade e atribuição de lojas
- `server/entitlements.ts` / `shared/entitlements.ts`
- `server/routers.ts` — `appRouter` (auth, operations, platform, etc.)

## Funcionalidades implementadas

- Auth: signup (empresa + admin, trial), login, recuperação, avatar, menu de conta unificado, sessão por cookie + token.
- Planos e entitlements (catálogo único, overrides, autorização no servidor e UI).
- Ponto: sequência do dia, saída automática de jornadas de dias anteriores, solicitação/inclusão de batidas esquecidas, espelho, alertas de batida faltante (dismiss persistido).
- Lojas, clientes de loja, roteiros semanais, visitas, check-in/out com foto de fachada.
- Fotos de loja: captura com marca d’água (nome, endereço, loja, data/hora), galeria, seleção em massa, compartilhamento, exclusão, expiração (~60 dias), relatório PDF. Suporte a foto sem loja.
- Vínculo promotor ↔ lojas (opcional) na criação e na edição do promotor; alterações refletem imediatamente no acesso.
- Offline: cadastro de lojas/clientes, sincronização de visitas, fila de fotos (IndexedDB), cache de roteiro do dia.
- Produtos e validades (com lixeira).
- Auditoria append-only.
- PWA / service worker com fallback offline.
- Performance: code-splitting por rota, compressão gzip, `staleTime` no QueryClient, cache de assets.

## Decisões importantes

- Isolamento multi-tenant rigoroso no backend (não confiar só no frontend).
- Sessão via cookie + header para compatibilidade com Vercel e clientes PWA.
- `storeId` nullable em fotos para não bloquear captura.
- Atribuição de lojas ao promotor é opcional e gerenciável a qualquer momento (sem recriar o usuário).
- Asaas permanece em mock até integração real.
- Schema legado de extintores preservado (`schema.original.ts` e algumas colunas/limites) para não quebrar dados antigos.
- Tabelas auxiliares criadas sob demanda para reduzir dependência de migrações manuais em ambientes já em produção.

## Problemas conhecidos e pendências

- Resquícios do domínio de extintores ainda existem (schema original, alguns limites como `maxExtinguishers`, referências residuais).
- Conformidade do ponto com a Portaria MTP 671/2021 (REP) não foi validada juridicamente; o módulo é base técnica.
- Asaas ainda em modo mock; e-mail em modo console por padrão.
- Criação sob demanda de algumas tabelas pode adicionar latência no primeiro acesso.
- Checklists dinâmicos e evidências genéricas estão modelados no schema, mas o fluxo completo de produto ainda é parcial.
- Google Maps é opcional (`VITE_GOOGLE_MAPS_API_KEY`).
- Testes de banco exigem `EXTERNAL_DATABASE_URL`; a suíte completa não roda sem ambiente configurado.

## Deploy e ambientes

- Repositório: `IvanMHonemann/promotores-saas`
- Projetos Vercel conhecidos: `promotores-saas` (oficial, Git), `promotores-saas-teste` / `promotores-saas-teste-git`
- Variáveis principais: `EXTERNAL_DATABASE_URL`, `JWT_SECRET`, `SCHEDULE_SECRET`, `S3_*`
- Healthcheck: `/healthz`

## Como manter este arquivo

Atualizar somente quando houver mudança relevante de arquitetura, funcionalidade, decisão ou pendência. Preservar informações anteriores que continuem válidas. Não incluir segredos, tokens, senhas ou trechos longos de conversa.
