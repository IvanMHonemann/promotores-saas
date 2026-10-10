# Plataforma SaaS de Gestão de Promotores de Merchandising

Sistema multiempresa para controle de ponto com geolocalização, roteirização, visitas, checklists e gestão de equipes de merchandising.

## Stack

- Node.js 22, Express e tRPC
- React 19, Vite, Tailwind e PWA
- MySQL com Drizzle ORM
- Autenticação própria com sessões hasheadas (platform admin separado)
- Auditoria append-only
- Preparado para Asaas e storage S3-compatible
- Offline com Dexie

## Funcionalidades Principais (Base Implementada)

- Multi-tenancy rigoroso
- Roles: platform_admin, company_admin, supervisor, promoter
- Registro de ponto com GPS (server time + device time + accuracy)
- Solicitações de correção rastreáveis
- Schema completo para clientes, marcas, lojas, roteiros, visitas, checklists e evidências
- Planos e limites adaptados
- Auditoria

## Executar

```bash
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
# Configure EXTERNAL_DATABASE_URL, JWT_SECRET, SCHEDULE_SECRET
pnpm run check
pnpm run build
pnpm start
```

## Banco de Dados

O schema novo está em `drizzle/schema.ts`. Gere migrações controladas:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## Avisos Importantes

- O módulo de ponto é uma base técnica. Valide requisitos legais brasileiros (Portaria 671 e correlatas) antes da comercialização.
- Código legado de extintores foi parcialmente substituído; limpeza completa e testes devem ser continuados.
- Consulte `DIAGNOSTICO_E_PLANO.md` para detalhes da transformação.

## Variáveis de Ambiente Principais

Veja `config/env.example`. Nunca versione segredos.
