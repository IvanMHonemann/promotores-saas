FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# O build do Vite precisa de mais heap que o padrão em servidores com 2 GB (usa a swap se preciso).
ARG BUILD_MAX_OLD_SPACE=3072
RUN NODE_OPTIONS=--max-old-space-size=${BUILD_MAX_OLD_SPACE} pnpm run build

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
