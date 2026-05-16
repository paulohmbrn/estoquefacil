# Estoque Fácil — guia operacional do repo

Sistema multi-loja de contagem e controle de estoque das operações **Famiglia Reis Magos** e **Madre Pane**, com sincronização de catálogo do ERP **Teknisa ZmartBI**.

> **Para detalhes de produto e decisões:** spec canônica em `docs/PROMPT_ESTOQUE_FACIL.md` e memória durável no hub `paulo-agent-core` em `memory/projects/estoque.md`.

## GBrain (Paulo Brain)

Memória durável compartilhada via MCP `paulo_gbrain`.

Antes de mudanças não-triviais, consulte o GBrain buscando:
- `projects/estoque` (decisões, pendências, integrações)
- nome do repo remoto e integrações relacionadas
- política global de uso em `~/.claude/CLAUDE.md`

Não gravar segredos no GBrain (tokens, senhas, strings de conexão).

## Estrutura do monorepo

```
apps/
  api/      Fastify + Prisma + BullMQ (Sprint 2+: worker de sync ZmartBI)
  web/      Next.js 15 (App Router) + Auth.js v5 + Tailwind + shadcn/ui
packages/
  db/       Prisma schema + client + migrations + seed
  shared/   Constantes (FILIAIS_MVP, PREFIXOS_CDARVPROD_MVP), Zod schemas, format helpers
  ui/       Tokens TS, fontes, CSS espelhando design-reference
docker/
  docker-compose.dev.yml    postgres-estoque (5532) + redis-estoque (6479)
docs/
  PROMPT_ESTOQUE_FACIL.md   spec
  CONTAGEMFILIAL...xlsx     exemplo de export real (header CDARVPROD/DTLANCESTQ/QTTOTLANCTO)
  zmartbi-dump-*.json       dump do ZmartBI (gitignored — fixture local)
design-reference/           canvas oficial (HTML + JSX + CSS + 9 fontes + 25 mocks PNG)
```

## Setup inicial

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# editar .env e preencher GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / AUTH_SECRET

# 3. Subir banco e redis
pnpm db:up

# 4. Aplicar migrations + seed das 10 lojas
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Rodar tudo
pnpm dev
# web: http://localhost:3000
# api: http://localhost:3001
```

## Comandos do dia-a-dia

| Comando | O que faz |
|---|---|
| `pnpm dev` | sobe `apps/web` (3000) + `apps/api` (3001) em paralelo |
| `pnpm build` | build production de todos os pacotes |
| `pnpm typecheck` | tsc --noEmit em todos os packages |
| `pnpm db:up` / `db:down` | postgres + redis dev |
| `pnpm db:reset` | derruba volumes e sobe limpo |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:seed` | popula as 10 lojas MVP |
| `pnpm db:studio` | Prisma Studio |

## Decisões críticas (não derive do código — leia)

1. **ZmartBI tem lock global por webtoken.** Não chame em paralelo. Não cancele no meio. Worker do sync (Sprint 2) deve segurar lock Redis local, fazer 1 tentativa por agendamento (06:15 diário), e em erro alertar o gestor sem retry imediato.
2. **`CDARVPROD` com 11 chars são agrupadores** (categoria/nome lógico). Apenas SKUs com **13 chars** entram em contagem e export. Filtro adicional: prefixos `1`, `30105`, `915`. Regra do sufixo `00` (SKU-base vs receita) vale para `30105` e `915` em todas as lojas e para `1` fora das pizzarias. **Exceção (Paulo, 2026-05-16):** nas 9 pizzarias Reis Magos (`FILIAIS_REIS_MAGOS`) o prefixo `1` conta **sem** exigir terminar em `00` — receitas/sub-itens entram em contagem e export. FFB (`0013`) e Madre Pane (`0023`) seguem seus prefixos extras próprios.
3. **`DTLANCESTQ` é número inteiro `DDMMAAAA`** (não string `DD/MM/YYYY`). Filename do export: `CONTAGEMFILIAL{CDFILIAL:4}{DDMMAAAA}.xlsx`. Ver `packages/shared/src/format.ts`.
4. **10 filiais no MVP**: `0001` Capim Macio · `0003` Candelária · `0004` Nova Parnamirim · `0005` Lagoa Nova · `0006` Midway Mall · `0008` Petrópolis · `0016` Vila Mariana · `0017` Norte Shopping · `0019` Coophab · `0023` Madre Pane Lagoa Nova.
5. **Catálogo replicado por loja** (decisão de Paulo). Mesmo que o dump traga os mesmos 13k produtos por filial, mantém isolamento por loja para flexibilidade futura.
6. **Whitelist de e-mail** `@reismagos.com.br` para login Google (controlado por `ALLOWED_EMAIL_DOMAIN`).
7. **Etiqueta térmica 60×60mm** (define template do PDF — Sprint 3).
8. **Validade calculada** (data_impressão + dias do `produto_meta`).
9. **Domínios de produção**: web em `estoque.reismagos.com.br`, API em `api-estoque.reismagos.com.br` (Sprint 6 / Docker Swarm + Traefik). Sobrescreve as URLs `*.robosac.com` da spec original.

## Status atual (Sprint 1 ✓)

- [x] Monorepo Turborepo + pnpm
- [x] Postgres + Redis dev (`docker/docker-compose.dev.yml`)
- [x] Prisma schema completo + seed das 10 lojas
- [x] Tailwind + tokens RM + fontes Glitten/Manrope
- [x] shadcn/ui base (Button, Card, Input, Avatar, Badge, DropdownMenu)
- [x] Auth.js v5 Google + whitelist + middleware
- [x] AppShell desktop (sidebar nav, topbar com switcher de loja)
- [x] Página `/login` editorial
- [x] Home `/` autenticada (placeholder home-b)

## Sprints seguintes

- **Sprint 2** — Worker BullMQ sync ZmartBI 06:15 + telas cadastros (produtos/grupos/funcionários)
- **Sprint 3** — Etiquetas (preview + PDF lote 60×60mm) + Listas de Contagem (CRUD + QR único)
- **Sprint 4** — Fluxo de contagem mobile (scan câmera, lançamentos, finalização)
- **Sprint 5** — Export `.xlsx` (`CDARVPROD/DTLANCESTQ/QTTOTLANCTO`) + Dashboard editorial + histórico
- **Sprint 6** — Deploy Swarm + Traefik (`estoque.robosac.com` + `api-estoque.robosac.com`) + smoke tests

## Pendências para Paulo

- Lista de e-mails Google autorizados (whitelist) por loja para produção (MVP em dev usa `*@reismagos.com.br`).
- Confirmar se existe outro endpoint do ZmartBI fora do dump único (ex.: histórico de inventários enviados).
- Vincular usuários (`User` ↔ `UsuarioLoja`) — primeiro Gestor precisa ser inserido manualmente no banco até a tela de cadastros do Sprint 2.
