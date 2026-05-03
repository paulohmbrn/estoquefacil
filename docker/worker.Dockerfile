# Estoque Fácil — BullMQ worker (sync ZmartBI + SEFAZ)

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ----------------- deps -----------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/worker/package.json apps/worker/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

# ----------------- builder -----------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @estoque/db exec prisma generate

# ----------------- runtime -----------------
FROM base AS runtime
ENV NODE_ENV=production
ENV RUNTIME_USER=worker
ENV RUNTIME_UID=1001
ENV RUNTIME_GID=1001
RUN apk add --no-cache su-exec
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs worker

COPY --from=builder --chown=worker:nodejs /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder --chown=worker:nodejs /app/turbo.json /app/tsconfig.base.json ./
COPY --from=builder --chown=worker:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=worker:nodejs /app/apps/worker ./apps/worker
COPY --from=builder --chown=worker:nodejs /app/packages/db ./packages/db
COPY --from=builder --chown=worker:nodejs /app/packages/shared ./packages/shared

# Entrypoint roda como root, faz chown do /secrets e cai pra user worker via su-exec.
COPY docker/entrypoint-secrets.sh /usr/local/bin/entrypoint-secrets.sh
RUN chmod +x /usr/local/bin/entrypoint-secrets.sh

WORKDIR /app/apps/worker
ENTRYPOINT ["/usr/local/bin/entrypoint-secrets.sh"]
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
