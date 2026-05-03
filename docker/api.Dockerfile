# Estoque Fácil — Fastify API (production)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ----------------- deps -----------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ----------------- builder -----------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @estoque/db exec prisma generate
RUN pnpm --filter @estoque/api build

# ----------------- runtime -----------------
FROM node:22-alpine AS runtime
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs api

# Mantemos node_modules completo (precisamos do prisma migrate em runtime).
COPY --from=builder --chown=api:nodejs /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder --chown=api:nodejs /app/turbo.json /app/tsconfig.base.json ./
COPY --from=builder --chown=api:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=api:nodejs /app/apps/api ./apps/api
COPY --from=builder --chown=api:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=api:nodejs /app/packages/shared ./packages/shared

USER api
EXPOSE 3001
WORKDIR /app/apps/api
# tsx resolve as imports TS ESM dos workspace packages (shared, db) em runtime.
# Manter ESM puro com .js extensions no future iteration; tsx é a saída pragmática.
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
