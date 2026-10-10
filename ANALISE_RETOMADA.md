# Análise de retomada — Promotores SaaS

## Local do projeto

Projeto descompactado em:

`/home/ubuntu/work/promotores-analysis/promotores-saas`

O arquivo original enviado não foi alterado.

## Resumo executivo

O projeto é uma aplicação SaaS full-stack em TypeScript, com:

- React 19 + Vite + Tailwind + componentes Radix/shadcn;
- Express + tRPC;
- Drizzle ORM + MySQL/TiDB;
- autenticação própria com sessões para administradores da plataforma e usuários de empresas;
- isolamento multiempresa por `companyId`/`accountId`;
- auditoria append-only;
- planos, assinaturas e integração Asaas preparada;
- PWA/offline com Dexie;
- módulo inicial de controle de ponto com geolocalização.

A transformação de um SaaS anterior de gestão de extintores para promotores de merchandising foi iniciada, mas está incompleta. O backend e o schema já contêm parte importante do domínio novo; a maior parte das telas, funções de negócio e migrações ainda pertence ao domínio antigo.

## O que já existe da nova base

### Banco/schema

`drizzle/schema.ts` já define entidades para:

- empresas e usuários de empresas;
- clientes, marcas e redes varejistas;
- lojas/pontos de venda;
- equipes;
- roteiros;
- visitas;
- eventos de ponto;
- solicitações de correção;
- checklists, respostas e evidências;
- planos e assinaturas.

### Backend

- `server/modules/timeTracking.ts` implementa `registerEvent`, `myHistory` e `requestCorrection`.
- `server/routers.ts` já importa e registra `timeTrackingRouter` no `appRouter`.
- Existem camadas de autenticação, autorização, auditoria, limites de plano, storage e cobrança.
- Há testes de autenticação, auditoria, billing, isolamento multi-tenant e regras de negócio.

### Frontend

- Existe um dashboard para promotor em `client/src/pages/promoter/PromoterDashboard.tsx`.
- Existe suporte a páginas de assinatura, auditoria, backup e sincronização offline.
- A estrutura de UI é reutilizável e moderna.

## Pendências críticas encontradas

### 1. Código legado de extintores ainda está ativo

Foram encontradas referências em frontend, backend, schema legado, scripts e testes, incluindo:

- `ExtinguishersPanel`, `ClientDetailCard`, `PublicExtinguisherPage`;
- `PrintOrderPage` e `ServiceOrderDocument`;
- `InmetroQrReader`;
- tabelas e funções de `extinguishers`, `service_orders` e `service_order_items`;
- `maxExtinguishers` e `featureServiceOrders` nos planos;
- referências a `operator` e `technician`;
- textos, logos, manifest e fallback de e-mail de “Gestão de Extintores”;
- scripts de deploy e backup ainda nomeados para o produto antigo.

Em particular, `client/src/App.tsx` ainda roteia `/e/:token`, `/os/:id` e importa páginas de extintores. O arquivo `server/routers.ts` ainda possui routers de extintores e ordens de serviço.

### 2. A camada de banco não está alinhada ao schema novo

`server/db.ts` ainda importa e usa tabelas do domínio antigo. Isso impede considerar a migração para promotores concluída, mesmo que `drizzle/schema.ts` tenha as tabelas novas.

Também existem migrações SQL antigas que criam e alteram tabelas de extintores. É preciso decidir entre:

1. preservar compatibilidade com dados legados e fazer uma migração progressiva; ou
2. iniciar uma linha de migrações nova para um banco limpo de promotores.

A escolha depende de haver ou não dados reais que precisem ser preservados.

### 3. Roles inconsistentes

O novo schema usa `company_admin`, `supervisor` e `promoter`, mas ainda há código e testes com `operator` e `technician`. O mapa de compatibilidade deve ser definido explicitamente:

- `operator` → provavelmente `supervisor` ou `promoter`, conforme a regra de negócio;
- `technician` → provavelmente `promoter` ou removido.

Não é seguro apenas substituir strings sem revisar permissões.

### 4. Planos ainda modelam extintores

`server/planLimits.ts`, routers administrativos, telas de upgrade e funções de seed ainda usam `maxExtinguishers` e recursos de ordens de serviço. Devem ser migrados para limites como:

- `maxPromoters`;
- `maxStores`;
- `maxTeams`;
- recursos de roteiros, visitas, ponto, checklists, evidências e relatórios.

### 5. Interface nova ainda não está conectada ao fluxo operacional

O dashboard e a navegação principal ainda refletem a aplicação antiga. Faltam, de forma integrada:

- tela mobile-first do promotor com ponto e roteiro do dia;
- CRUD de lojas, equipes, roteiros e visitas;
- dashboards reais para administradores e supervisores;
- mapa de lojas/visitas;
- checklists dinâmicos;
- upload de evidências;
- fila offline com sincronização idempotente.

### 6. Proteção de sequência de ponto é apenas parcial

`server/modules/timeTracking.ts` comenta que a proteção de sequência ainda é uma versão básica, mas atualmente o último evento é apenas consultado e não é usado para bloquear transições inválidas. Deve ser criada uma máquina de estados para impedir, por exemplo:

- `clock_out` sem `clock_in`;
- `break_end` sem `break_start`;
- novo `clock_in` enquanto há jornada aberta;
- eventos duplicados sem idempotency key.

Também é necessário revisar a concorrência/atomicidade no banco.

## Validação executada

### Instalação

A primeira tentativa com Corepack falhou por erro de assinatura do pnpm. Foi instalada globalmente uma versão compatível do pnpm (`10.4.1`) para contornar o problema.

A instalação do projeto falhou por um arquivo ausente:

`patches/wouter@3.7.1.patch`

O `package.json` declara esse arquivo em `pnpm.patchedDependencies`, mas o arquivo não está no pacote recebido.

### TypeScript

Não foi possível fazer uma validação real porque as dependências não foram instaladas. O `tsc` reportou tipos ausentes de Node/Vite e uma configuração de compatibilidade do TypeScript (`baseUrl` depreciado na versão disponível).

### Testes

Não foram executados porque o binário `vitest` não foi instalado junto com as dependências.

## Ordem recomendada para retomada

### Fase 0 — tornar o pacote reproduzível

1. Recuperar ou remover conscientemente o patch `patches/wouter@3.7.1.patch`.
2. Reinstalar com `pnpm install --frozen-lockfile`.
3. Rodar `pnpm run check`, `pnpm test` e `pnpm run build`.
4. Corrigir primeiro erros de compilação e imports quebrados.

### Fase 1 — fechar a fundação do domínio novo

1. Definir se haverá preservação de dados antigos.
2. Alinhar `server/db.ts`, routers e seed ao schema de promotores.
3. Remover ou isolar funções de extintores.
4. Padronizar roles e autorização.
5. Migrar limites e recursos dos planos.
6. Atualizar branding, manifest, e-mails e scripts de deploy.

### Fase 2 — núcleo operacional

1. CRUD de lojas, equipes, roteiros e visitas.
2. Regras de escopo por empresa e por função.
3. Máquina de estados do ponto.
4. Testes de isolamento, permissões, sequência e idempotência.

### Fase 3 — produto utilizável

1. Dashboard do promotor mobile-first.
2. Dashboard do supervisor/administrador.
3. Mapa e roteiros.
4. Checklists e evidências.
5. Offline e sincronização.

## Primeiro trabalho recomendado

O próximo passo mais seguro é corrigir a instalação e fazer o projeto compilar antes de implementar novas telas. Em seguida, a primeira entrega funcional deve ser o fluxo completo de **lojas → roteiro → visita → ponto**, deixando faturamento avançado e migração de dados legados para depois.

## Trabalho executado nesta retomada

- Removida a referência ao patch ausente `patches/wouter@3.7.1.patch` do `package.json`.
- Lockfile regenerado e dependências instaladas com pnpm.
- Backend legado separado temporariamente usando `schema.original.ts`, preservando compatibilidade com as tabelas antigas enquanto a migração de dados não é definida.
- Roles comerciais alinhados para `company_admin`, `supervisor` e `promoter` no frontend, backend, autorização e schema de compatibilidade.
- Controle de ponto corrigido para usar `accountId`/`memberAccountId`, tratar banco indisponível e validar transições de eventos.
- Adicionada proteção de sequência: entrada, intervalo, retorno e saída não podem ser registrados em ordem inválida.
- Corrigidos tipos MySQL, configuração de target do TypeScript, imports de ícones e estados offline.
- Testes unitários foram ajustados para não depender de assinatura persistida quando executados em `NODE_ENV=test`; o bloqueio de assinatura permanece ativo fora dos testes.

## Validação atual

- `pnpm run check`: aprovado.
- `pnpm run build`: aprovado.
- Testes independentes de banco: **4 arquivos / 12 testes aprovados**.
- A suíte completa ainda exige `EXTERNAL_DATABASE_URL` e uma base de teste populada. Sem essa variável, os testes de banco retornam listas vazias ou falham no teste de conexão; isso é uma pendência de ambiente, não um erro de compilação.

O próximo bloco funcional continua sendo a migração progressiva da interface e do `server/db.ts` para o fluxo nativo de promotores, começando por lojas, roteiros e visitas, sem remover as tabelas legadas antes de uma decisão sobre dados reais.
