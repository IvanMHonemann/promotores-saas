#!/usr/bin/env bash
# Publica no ambiente de TESTES (sempre use este primeiro)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export VERCEL_TOKEN="${VERCEL_TOKEN:?Defina VERCEL_TOKEN}"
SCOPE="${VERCEL_SCOPE:-ivan-4bc8}"
PROJECT="gestao-de-extintores-teste"

echo "==> Deploy TESTE → $PROJECT"
cd "$ROOT"
# Build local package if needed — or deploy source folder used for last package
if [ ! -d /tmp/vercel-full ]; then
  echo "Pacote /tmp/vercel-full não encontrado. Rode o build de deploy antes."
  exit 1
fi
cd /tmp/vercel-full
rm -rf .vercel
vercel link --yes --project "$PROJECT" --scope "$SCOPE" --token "$VERCEL_TOKEN"
vercel deploy --prod --yes --token "$VERCEL_TOKEN" --scope "$SCOPE"
echo "==> TESTE: https://gestao-de-extintores-teste.vercel.app"
