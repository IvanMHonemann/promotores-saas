# Deploy em hospedagem tradicional (Node / Docker)

O aplicativo está preparado para rodar tanto na Vercel (serverless) quanto em qualquer hospedagem Node.js ou container Docker (ShardCloud, VPS, etc.).

## Requisitos

- Node.js 20+ (ou Docker)
- MySQL / TiDB (ou banco compatível)
- Variáveis de ambiente (veja `config/env.example`)

## Opção 1 — Docker (recomendado)

O `Dockerfile` já existe e faz build multi-stage.

```bash
docker build -t promotores-saas .
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name promotores \
  promotores-saas
```

O container escuta na porta definida por `PORT` (padrão 3000) e serve o frontend estático + API.

## Opção 2 — Node direto

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run build
pnpm start
```

O script `start` executa `node dist/index.js`.  
Em produção (`NODE_ENV=production`) o servidor serve os arquivos de `dist/public` e escuta em `process.env.PORT`.

## Variáveis obrigatórias

| Variável                  | Descrição                          |
|----------------------------|-----------------------------------|
| `EXTERNAL_DATABASE_URL`    | Conexão MySQL/TiDB               |
| `JWT_SECRET`               | Segredo das sessões               |
| `SCHEDULE_SECRET`          | Segredo do endpoint de manutenção |
| `S3_ENDPOINT`              | Endpoint do storage de fotos      |
| `S3_BUCKET`                | Bucket                            |
| `S3_ACCESS_KEY_ID`         | Access key                        |
| `S3_SECRET_ACCESS_KEY`     | Secret key                        |
| `S3_REGION`                | Região (ex: `auto` no R2)        |
| `NODE_ENV`                 | `production`                      |
| `PORT`                     | Porta (padrão 3000)               |

Opcionais importantes:
- `APP_PUBLIC_URL` — URL pública (usada em e-mails e links)
- `EMAIL_PROVIDER` — `console` (padrão), `resend` ou `webhook`
- `ASAAS_*` — deixe em mock se não for usar cobrança automática

## Healthcheck

`GET /healthz` retorna `{ "ok": true }`.

## Migração do banco

As migrações estão em `drizzle/`. No novo ambiente:

```bash
pnpm drizzle-kit migrate
```

Ou deixe o app criar tabelas sob demanda (algumas são criadas no primeiro acesso).

## ShardCloud (notas rápidas)

1. Crie um banco MySQL gerenciado.
2. Crie um app Node (ou use o Dockerfile se a plataforma suportar).
3. Configure as variáveis de ambiente acima.
4. Aponte o domínio customizado.
5. Configure um cron ou chamada periódica para `POST /api/scheduled/database-maintenance` com header `Authorization: Bearer <SCHEDULE_SECRET>` se quiser manutenção automática.

## Observações

- O código detecta `process.env.VERCEL` e só inicia o servidor HTTP quando não está na Vercel.
- Cookies e sessão já funcionam com `trust proxy`.
- Storage de fotos continua no R2/S3 (não precisa migrar arquivos se manter as mesmas credenciais).
