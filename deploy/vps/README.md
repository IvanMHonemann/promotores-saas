# Deploy na VPS (cópia dos scripts de /opt/gondup)

Fluxo desde 10/11/2026:

1. Merge na `main` → GitHub Actions (`.github/workflows/build-producao.yml`) compila com o mesmo `Dockerfile`
   (estágio `artifact`) e publica os arquivos prontos na branch `build/main`, com `BUILD_SHA` = commit de origem.
2. Na VPS, `gondup-autodeploy.timer` (a cada 2 min) roda `auto-deploy.sh`: quando `BUILD_SHA` == `origin/main`,
   chama `deploy.sh main prebuilt`, que monta a imagem com `Dockerfile.prebuilt` (só `pnpm install --prod`, em cache
   enquanto o lockfile não muda) e reinicia com healthcheck e rollback como antes.
3. Se o build do GitHub não chegar em 25 min (Actions fora do ar, falha), compila na VPS como antes (`deploy.sh main`).

Por quê: compilar na VPS (2 GB de RAM) levava 12–16 min, usava a swap e deixava o site lento para todos
durante cada atualização (healthz de 1–4 s, pedidos de 10–28 s no log do Caddy).

Para instalar uma nova versão destes scripts: copiar para `/opt/gondup/` (guardar o anterior como `.bak-AAAAMMDDHHMM`).
