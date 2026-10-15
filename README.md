# Promotores SaaS

Sistema multiempresa para controle de ponto, visitas, fotos de loja e gestão de promotores de merchandising.

## Requisitos

- Node.js 20+
- pnpm
- MySQL ou TiDB (compatível com MySQL)

## Instalação

```bash
git clone https://github.com/IvanMHonemann/promotores-saas.git
cd promotores-saas
corepack enable
pnpm install --frozen-lockfile
cp config/env.example .env
# Edite o .env com suas credenciais
pnpm run build
pnpm start
```

## Variáveis obrigatórias

Veja `config/env.example`. As principais:

- `EXTERNAL_DATABASE_URL` — conexão MySQL/TiDB
- `JWT_SECRET` — segredo das sessões
- `SCHEDULE_SECRET` — segredo do cron de manutenção
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` — storage de fotos (R2/S3)

## Banco de dados

As migrações estão em `drizzle/`. Para aplicar:

```bash
pnpm drizzle-kit migrate
```

## Deploy

O `vercel.json` está configurado. Conecte o repositório na Vercel e defina as variáveis de ambiente.

## Estrutura

- `client/` — frontend React
- `server/` — API tRPC e Express
- `drizzle/` — schema e migrações
- `shared/` — tipos e constantes compartilhados
