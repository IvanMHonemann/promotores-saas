# Restaurar backup do GondUp

Há dois formatos:

| Formato | Origem | Comando |
|--------|--------|---------|
| **1** | JSON local (`pnpm backup:db`) | `pnpm restore:db -- --input=arquivo.json --replace` |
| **2** | R2 (`backups/database/YYYY-MM-DD/`, gerado pelo cron / `pnpm backup:r2`) | `pnpm restore:r2 -- --day=YYYY-MM-DD --replace` |

## Avisos

- Restauração com `--replace` **apaga e recria** tabelas. Exige `ALLOW_DESTRUCTIVE_RESTORE=true`.
- Prefira restaurar em um banco vazio ou de homologação antes de apontar produção.
- Sessões (`member_sessions`, `platform_sessions`) e a tabela `backup_progress` **não** entram no backup formato 2.

## Formato 2 a partir de pasta baixada

1. Baixe do R2 o prefixo `backups/database/2026-11-05/` (manifesto, schema e `.jsonl.gz`).
2. Rode:

```bash
ALLOW_DESTRUCTIVE_RESTORE=true pnpm restore:r2 -- --dir=./backups/database/2026-11-05 --replace
```

## Formato 1 (JSON único)

```bash
ALLOW_DESTRUCTIVE_RESTORE=true pnpm restore:db -- --input=backups/daily/extintores-....json --replace
```
