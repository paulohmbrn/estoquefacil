# Estoque Fácil

Sistema multi-loja de contagem e controle de estoque das operações Famiglia Reis Magos / Madre Pane, integrado ao ERP Teknisa ZmartBI.

Veja **`CLAUDE.md`** para o guia operacional completo (estrutura, comandos, decisões críticas) e **`docs/PROMPT_ESTOQUE_FACIL.md`** para a spec do produto.

## Quickstart

```bash
pnpm install
cp .env.example .env  # preencher GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / AUTH_SECRET
pnpm db:up
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## Stack

Next.js 15 · React 19 · TypeScript · Tailwind · shadcn/ui · Auth.js v5 · Fastify · Prisma · PostgreSQL 16 · Redis · Turborepo · pnpm
