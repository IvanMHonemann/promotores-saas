#!/usr/bin/env bash
# Atualiza o GondUp a partir do GitHub (branch main), reconstrói a imagem e reinicia.
# Em falha de healthcheck, faz rollback para a imagem anterior.
set -euo pipefail
cd /opt/gondup
BRANCH="${1:-main}"
# MODE=prebuilt: usa o build pronto do GitHub (branch build/main), sem compilar aqui. MODE=local: compila na VPS (antigo).
MODE="${2:-local}"
PREV_TAG="gondup-app:previous"
NEW_TAG="gondup-app:latest"
LOCK_NOTE=""

exec > >(tee -a /var/log/gondup-deploy.log) 2>&1
echo "=== deploy $(date '+%F %T') branch=$BRANCH modo=$MODE ==="

git -C app fetch --quiet origin "$BRANCH"
git -C app checkout --quiet "$BRANCH"
git -C app reset --quiet --hard "origin/$BRANCH"
NEW_SHA="$(git -C app rev-parse HEAD)"
echo "commit: $(git -C app log --oneline -1) ($NEW_SHA)"

# Guarda a imagem atual como previous (se existir) para rollback.
if docker image inspect "$NEW_TAG" >/dev/null 2>&1; then
  docker tag "$NEW_TAG" "$PREV_TAG"
  echo "imagem anterior marcada como $PREV_TAG"
fi

build_local() { docker compose build app; }
if [[ "$MODE" == "prebuilt" ]]; then
  PRE=/opt/gondup/prebuilt
  rm -rf "$PRE" && mkdir -p "$PRE"
  git -C app fetch --quiet origin +refs/heads/build/main:refs/remotes/origin/build/main
  git -C app archive origin/build/main | tar -x -C "$PRE"
  PRE_SHA="$(tr -d '[:space:]' < "$PRE/BUILD_SHA" 2>/dev/null || true)"
  if [[ "$PRE_SHA" == "$NEW_SHA" && -s "$PRE/dist/index.js" && -s "$PRE/Dockerfile" ]]; then
    echo "build pronto do GitHub ($PRE_SHA): só instalando"
    if ! docker build -t "$NEW_TAG" "$PRE"; then
      echo "AVISO: imagem do build pronto falhou; compilando aqui"
      build_local
    fi
  else
    echo "AVISO: build/main ($PRE_SHA) não corresponde a $NEW_SHA; compilando aqui"
    build_local
  fi
else
  build_local
fi
docker compose up -d --force-recreate app

ok=0
for i in $(seq 1 30); do
  if curl -fsS -o /dev/null http://127.0.0.1:3000/healthz; then
    echo "OK: app respondendo"
    ok=1
    break
  fi
  sleep 2
done

if [[ "$ok" -ne 1 ]]; then
  echo "ERRO: app não respondeu em 60s — iniciando rollback"
  docker compose logs --tail=50 app || true
  if docker image inspect "$PREV_TAG" >/dev/null 2>&1; then
    docker tag "$PREV_TAG" "$NEW_TAG"
    docker compose up -d --force-recreate app
    for i in $(seq 1 30); do
      if curl -fsS -o /dev/null http://127.0.0.1:3000/healthz; then
        echo "ROLLBACK OK: app anterior respondendo"
        exit 1
      fi
      sleep 2
    done
    echo "ERRO CRÍTICO: rollback também falhou"
  else
    echo "ERRO: sem imagem previous para rollback"
  fi
  exit 1
fi

# Sucesso: grava sha implantado e limpa imagens/cache antigos.
echo "$NEW_SHA" > /opt/gondup/.deployed-sha
chmod 644 /opt/gondup/.deployed-sha
docker image prune -f >/dev/null || true
# Remove dangling build cache excessivo, mas mantém previous + latest.
docker builder prune -f --filter until=168h >/dev/null 2>&1 || true
echo "deployed-sha=$NEW_SHA"
echo "=== deploy OK $(date '+%F %T') ==="
