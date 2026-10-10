# Diagnóstico Técnico e Plano de Transformação
## De SaaS de Gestão de Extintores para Plataforma de Gestão de Promotores de Merchandising

### 1. Diagnóstico da Arquitetura Original

**Stack tecnológica:**
- Frontend: React 19 + Vite + Tailwind CSS + shadcn/ui (Radix) + Wouter + TanStack Query + tRPC
- Backend: Express + tRPC + Drizzle ORM + MySQL (pool mysql2)
- Autenticação: Própria com sessões hasheadas (platform admins separados de member accounts)
- Offline: PWA + Dexie (IndexedDB)
- Billing: Preparado para Asaas (mock por padrão)
- Auditoria: Tabela append-only com isolamento por companyId
- Multi-tenancy: Isolamento rigoroso por companyId / accountId
- Deploy: Docker, Vercel-ready, healthchecks

**Pontos fortes reaproveitáveis:**
- Autenticação multi-nível (platform_admin vs company users)
- Isolamento multiempresa no backend (verificado em testes)
- Sistema de planos, limites e assinaturas
- Auditoria imutável
- Estrutura offline/PWA
- Componentes de UI modernos e responsivos
- Integração S3-compatible para storage
- Testes de isolamento e auth

**Componentes exclusivos de extintores (a remover/substituir):**
- Tabelas: clients (como clientes de extintores), extinguishers, serviceOrders, serviceOrderItems
- Páginas: PublicExtinguisherPage, PrintOrderPage, ExtinguishersPanel, ServiceOrderDocument, InmetroQrReader
- Lógica de vencimentos Inmetro, inspeções, ordens de serviço de equipamentos
- Referências visuais e textuais a extintores

**Riscos identificados:**
- Migração de schema exige estratégia (não há dados reais no ambiente de desenvolvimento)
- Roles antigos (operator, technician) precisam ser mapeados para supervisor/promoter
- Limites de planos (maxExtinguishers) precisam ser adaptados
- Funcionalidades offline atuais são específicas de extintores; precisam ser adaptadas para roteiros e eventos de ponto

### 2. Plano de Migração e Transformação (MVP Priorizado)

**Etapa 1 - Fundação (concluída nesta entrega):**
- Novo schema Drizzle com entidades de merchandising
- Roles atualizados: company_admin, supervisor, promoter
- Tabelas: clients, brands, retailChains, stores, teams, routes, visits, timeEvents, timeCorrectionRequests, checklists, checklistQuestions, checklistResponses, evidences
- Planos adaptados com maxPromoters, maxStores, featureTimeTracking, etc.
- Módulo inicial de time tracking (registerEvent, myHistory, requestCorrection)

**Etapa 2 - Núcleo operacional (próximos passos):**
- Integrar timeTrackingRouter no appRouter
- Procedimentos CRUD para stores, routes, visits, employees
- Validação de sequência de ponto no servidor
- Isolamento e testes de permissão

**Etapa 3 - Interface e experiência:**
- Nova identidade visual (cores, logo, textos)
- Painel simplificado para promotores (mobile-first): ponto + roteiro do dia
- Dashboards de gestores com dados reais
- Mapa de lojas e visitas

**Etapa 4 - Execução em campo:**
- Checklists dinâmicos
- Upload de evidências (S3)
- Funcionamento offline para eventos de ponto e roteiros (fila de sync com idempotencyKey)

**Etapa 5 - Comercialização e validação:**
- Adaptar limites de planos no backend
- Testes automatizados de isolamento, ponto e permissões
- Documentação de implantação

### 3. Requisitos Legais e Técnicos Pendentes (Controle de Ponto - Brasil)

O módulo de ponto implementado é uma base técnica. Antes da comercialização como sistema de registro eletrônico de ponto, é necessário validar:

- Conformidade com Portaria MTP 671/2021 (REP-P, REP-A, REP-C)
- Requisitos de integridade, disponibilidade, autenticidade e confidencialidade
- Possível necessidade de certificação ou documentação específica
- Armazenamento de logs e backups adequados
- Transparência com o funcionário sobre coleta de localização
- Não implementação de rastreamento contínuo oculto

Recomenda-se consulta jurídica e técnica especializada antes de colocar o módulo de ponto em produção comercial.

### 4. Estado Atual da Entrega

- Schema novo implementado em `drizzle/schema.ts`
- Módulo de ponto inicial em `server/modules/timeTracking.ts`
- Branding básico atualizado
- Projeto original preservado com schema.original.ts
- Pronto para continuidade do desenvolvimento sobre a nova base

Próximos comandos sugeridos:
```bash
# Após configurar .env com EXTERNAL_DATABASE_URL
pnpm install
# Gerar e aplicar migrações (recomendado criar novas migrações controladas)
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```
