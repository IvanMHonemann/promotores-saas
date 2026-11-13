#!/usr/bin/env bash
# Publica no ambiente DEFINITIVO (só depois de validar no teste)
set -euo pipefail
export VERCEL_TOKEN="${VERCEL_TOKEN:?Defina VERCEL_TOKEN}"
SCOPE="${VERCEL_SCOPE:-ivan-4bc8}"
PROJECT="gestao-de-extintores"

echo "==> Deploy PRODUÇÃO → $PROJECT"
if [ ! -d /tmp/vercel-full ]; then
  echo "Pacote /tmp/vercel-full não encontrado. Rode o build de deploy antes."
  exit 1
fi
cd /tmp/vercel-full
rm -rf .vercel
vercel link --yes --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN"
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE"
echo "==> PRODUÇÃO: https://gestao-de-extintores-ivan-4bc8.vercel.app"
