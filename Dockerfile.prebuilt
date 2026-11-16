# Imagem de produção a partir do build pronto (branch build/main, gerada pelo GitHub Actions).
# Mesmas instruções do estágio "runtime" do Dockerfile: o servidor não compila nada, só instala as
# dependências de produção (em cache enquanto o pnpm-lock.yaml não muda) e copia os arquivos prontos.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY dist ./dist
COPY drizzle ./drizzle
COPY scripts ./scripts
# Código da versão publicado pelo GitHub Actions (usado no painel Erros ao vivo).
COPY BUILD_SHA ./BUILD_SHA
ARG BUILD_SHA=""
ARG BUILD_TIME=""
ENV BUILD_SHA=${BUILD_SHA}
ENV BUILD_TIME=${BUILD_TIME}
EXPOSE 3000
CMD ["pnpm", "start"]
