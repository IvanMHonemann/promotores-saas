FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# O build do Vite precisa de mais heap que o padrão em servidores com 2 GB (usa a swap se preciso).
ARG BUILD_MAX_OLD_SPACE=3072
# Sentry no navegador (opcional): a chave pública (DSN) entra no JS no momento do build.
# Vazio = Sentry do navegador desligado (Vercel/testes continuam iguais).
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_ENVIRONMENT=""
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}
ENV VITE_SENTRY_ENVIRONMENT=${VITE_SENTRY_ENVIRONMENT}
RUN NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE} pnpm run build

# Só os arquivos prontos do build. O GitHub Actions extrai este estágio (--target artifact) e publica na
# branch build/main; o servidor só instala e reinicia (Dockerfile.prebuilt), sem compilar na VPS.
FROM scratch AS artifact
COPY --from=build /app/dist /dist
COPY --from=build /app/drizzle /drizzle
COPY --from=build /app/scripts /scripts
COPY --from=build /app/package.json /app/pnpm-lock.yaml /

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
EXPOSE 3000
CMD ["pnpm", "start"]
