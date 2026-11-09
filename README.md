# Promotores SaaS

Sistema multiempresa para controle de ponto, visitas, fotos de loja e gestão de promotores de merchandising.

## Requisitos

- Node.js 20+
- pnpm
- MySQL ou TiDB (compatível com MySQL)

## Instalação local

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

### Produção — VPS Locaweb (`gondup.com`)

Produção roda no VPS Locaweb. Um timer no servidor verifica a branch `main` a cada ~2 minutos; se houver commit novo, reconstrói a imagem Docker e reinicia o app (~10 min de build). O site continua no ar durante o build; se o healthcheck falhar, faz rollback para a imagem anterior.

- **Automático:** push/merge em `main` → o VPS detecta em até ~2 min e faz deploy sozinho.
- **Manual:** `ssh gondup /opt/gondup/deploy.sh`
- **Logs:** `/var/log/gondup-autodeploy.log` (detecção) e `/var/log/gondup-deploy.log` (build/restart)
- **Health:** `https://gondup.com/healthz`

### Vercel (somente testes)

O `vercel.json` ainda está configurado. A Vercel continua publicando `main` automaticamente, mas serve só para testes — o domínio principal é o VPS. Atenção: por enquanto a Vercel usa o mesmo banco da produção.

### Hospedagem tradicional / Docker

Veja o guia completo em **[DEPLOY.md](./DEPLOY.md)**.

Resumo rápido:

```bash
docker build -t promotores-saas .
docker run -d -p 3000:3000 --env-file .env promotores-saas
```

Ou diretamente:

```bash
pnpm install --frozen-lockfile && pnpm run build && pnpm start
```

O app escuta em `PORT` (padrão 3000) e serve frontend + API no mesmo processo.

## Estrutura

- `client/` — frontend React
- `server/` — API tRPC e Express
- `drizzle/` — schema e migrações
- `shared/` — tipos e constantes compartilhados
- `DEPLOY.md` — instruções de deploy em Node/Docker
