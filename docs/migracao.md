# Migração do GondUp (Vercel → hospedagem Node, ex.: ShardCloud)

Guia curto em português. Ative os recursos abaixo **só depois** de configurar as variáveis — sem elas o app continua funcionando, mas backup/e-mail/Sentry ficam inativos (no-op).

## 1. Variáveis obrigatórias

| Variável | Para quê |
|----------|----------|
| `EXTERNAL_DATABASE_URL` | Conexão MySQL/TiDB |
| `JWT_SECRET` | Sessões (gere um valor longo e aleatório) |
| `NODE_ENV=production` | Modo produção |
| `PORT` | Porta HTTP (padrão `3000`) |
| `APP_PUBLIC_URL` | URL pública (links de e-mail) |

## 2. Storage de fotos e backups (Cloudflare R2)

| Variável | Para quê |
|----------|----------|
| `S3_ENDPOINT` | Endpoint do R2 |
| `S3_BUCKET` | Nome do bucket |
| `S3_ACCESS_KEY_ID` | Access key |
| `S3_SECRET_ACCESS_KEY` | Secret key |
| `S3_REGION` | Use `auto` no R2 |
| `S3_FORCE_PATH_STYLE` | `true` no R2 |
| `S3_PUBLIC_BASE_URL` | URL pública das fotos (opcional) |

Sem essas variáveis o **backup diário não roda** (não quebra o site) e o upload de fotos falha.

## 3. Cron / manutenção e backup

| Variável | Para quê |
|----------|----------|
| `CRON_SECRET` **ou** `SCHEDULE_SECRET` | Protege os endpoints agendados |
| `BACKUP_RETENTION_DAYS` | Dias de backup no R2 (padrão `14`) |
| `BACKUP_BUDGET_MS` | Orçamento de tempo por chamada (padrão `18000` na Vercel; na ShardCloud pode ser `120000`) |

### Endpoints (chame com `Authorization: Bearer <CRON_SECRET>`)

- `GET|POST /api/scheduled/database-maintenance` — backup em partes + limpeza (lixeira, sessões, fotos expiradas, alertas).
- `GET|POST /api/scheduled/database-backup` — só o backup (+ retenção de 14 dias ao concluir).
- `GET|POST /api/scheduled/archive-timesheets` — arquiva espelhos de ponto fechados.

### Como agendar na nova hospedagem

Na ShardCloud (ou qualquer cron externo), configure **pelo menos 2–3 chamadas por dia** ao endpoint de manutenção (o backup é retomável e pode precisar de mais de uma execução se o banco for grande):

```bash
curl -X POST "https://SEU_DOMINIO/api/scheduled/database-maintenance" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Sugestão de horários (America/Sao_Paulo): `05:00`, `07:00` e `09:00`.

### Rodar na mão

```bash
pnpm backup:r2          # backup completo no R2 + retenção
pnpm backup:db          # cópia JSON local (formato 1)
pnpm restore:r2 -- --day=YYYY-MM-DD --replace   # restaurar do R2 (exige ALLOW_DESTRUCTIVE_RESTORE=true)
pnpm restore:db -- --input=backups/arquivo.json --replace
```

Detalhes de restauração: `docs/restore.md`.

## 4. E-mail (recuperação de senha / alertas)

| Variável | Para quê |
|----------|----------|
| `EMAIL_PROVIDER` | `console` (só log), `resend` ou `webhook` |
| `RESEND_API_KEY` | Se usar Resend |
| `EMAIL_FROM` | Remetente |
| `ADMIN_NOTIFICATION_EMAIL` | Avisos para você |

Sem `RESEND_API_KEY` / webhook, e-mails não saem (ficam no log).

## 5. Monitoramento de erros (Sentry) — opcional

| Variável | Para quê |
|----------|----------|
| `SENTRY_DSN` | Ativa Sentry no **servidor** |
| `VITE_SENTRY_DSN` | Ativa Sentry no **navegador** (precisa rebuild) |
| `SENTRY_ENVIRONMENT` | Ex.: `production` |
| `SENTRY_TRACES_SAMPLE_RATE` | Padrão `0.05` |

Sem DSN, nada é enviado. Senhas e tokens são filtrados antes do envio.

## 6. Checklist pós-migração

1. `GET /healthz` → `{ "ok": true }`
2. Login admin e promotor de teste
3. Upload de uma foto de visita
4. Disparar o cron de backup e conferir no R2 a pasta `backups/database/YYYY-MM-DD/`
5. Criar projeto no Sentry e colar os DSNs
6. Testar “esqueci minha senha” com Resend ativo
