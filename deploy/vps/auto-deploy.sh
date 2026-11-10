#!/usr/bin/env bash
# Verifica se origin/main avançou e dispara deploy.sh (sem sobreposição).
set -euo pipefail

LOG=/var/log/gondup-autodeploy.log
LOCK=/var/lock/gondup-deploy.lock
DEPLOYED=/opt/gondup/.deployed-sha
FAILED=/opt/gondup/.failed-deploy
APP=/opt/gondup/app
BRANCH=main

exec >>"$LOG" 2>&1

ts() { date '+%F %T'; }

# flock -n: se já há deploy rodando, sai quieto.
exec 9>"$LOCK"
if ! flock -n 9; then
  echo "$(ts) skip: deploy já em andamento"
  exit 0
fi

cd /opt/gondup
git -C "$APP" fetch --quiet origin "$BRANCH"
REMOTE_SHA="$(git -C "$APP" rev-parse "origin/$BRANCH")"

if [[ -f "$DEPLOYED" ]]; then
  LOCAL_SHA="$(tr -d '[:space:]' < "$DEPLOYED")"
else
  LOCAL_SHA="$(git -C "$APP" rev-parse HEAD)"
  echo "$LOCAL_SHA" > "$DEPLOYED"
fi

if [[ "$REMOTE_SHA" == "$LOCAL_SHA" ]]; then
  # Nada a fazer (silencioso na maior parte; loga só a cada ~hora via timer quiet).
  exit 0
fi

echo "$(ts) novo commit detectado: $LOCAL_SHA -> $REMOTE_SHA"

# Evita re-tentar o mesmo sha que falhou há menos de 1h.
if [[ -f "$FAILED" ]]; then
  FAIL_SHA="$(awk 'NR==1{print $1}' "$FAILED")"
  FAIL_TS="$(awk 'NR==1{print $2}' "$FAILED")"
  NOW="$(date +%s)"
  if [[ "$FAIL_SHA" == "$REMOTE_SHA" && -n "$FAIL_TS" ]]; then
    AGE=$(( NOW - FAIL_TS ))
    if (( AGE < 3600 )); then
      echo "$(ts) skip: sha $REMOTE_SHA falhou há ${AGE}s (<1h); próxima tentativa depois"
      exit 0
    fi
  fi
fi

# Build pronto no GitHub Actions (branch build/main) para este commit? Então só instala, sem compilar aqui
# (compilar na VPS de 2 GB levava 12–16 min e deixava o site lento). Espera até 25 min por ele; depois compila aqui.
MODE=local
WAIT_FILE=/opt/gondup/.waiting-build
PREBUILT_SHA=""
if git -C "$APP" fetch --quiet origin +refs/heads/build/main:refs/remotes/origin/build/main 2>/dev/null; then
  PREBUILT_SHA="$(git -C "$APP" show origin/build/main:BUILD_SHA 2>/dev/null | tr -d '[:space:]' || true)"
fi
if [[ "$PREBUILT_SHA" == "$REMOTE_SHA" ]]; then
  MODE=prebuilt
else
  NOW="$(date +%s)"
  FIRST="$(awk -v s="$REMOTE_SHA" '$1==s{print $2}' "$WAIT_FILE" 2>/dev/null || true)"
  if [[ -z "$FIRST" ]]; then echo "$REMOTE_SHA $NOW" > "$WAIT_FILE"; FIRST="$NOW"; fi
  if (( NOW - FIRST < 1500 )); then
    echo "$(ts) aguardando build do GitHub para $REMOTE_SHA ($(( NOW - FIRST ))s)"
    exit 0
  fi
  echo "$(ts) build do GitHub não chegou em 25 min para $REMOTE_SHA: compilando aqui"
fi
rm -f "$WAIT_FILE"

echo "$(ts) iniciando deploy de $REMOTE_SHA (modo $MODE)"
if /opt/gondup/deploy.sh "$BRANCH" "$MODE"; then
  rm -f "$FAILED"
  echo "$(ts) auto-deploy OK ($REMOTE_SHA)"
  exit 0
else
  echo "$REMOTE_SHA $(date +%s)" > "$FAILED"
  echo "$(ts) auto-deploy FALHOU ($REMOTE_SHA); marcado em $FAILED"
  exit 1
fi
