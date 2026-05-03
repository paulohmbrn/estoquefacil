# Estoque Fácil — Sistema de Contagem e Controle de Estoque

> Prompt-spec para construção do MVP. Use como base do `CLAUDE.md` do projeto.

---

## 1. Visão Geral

**Estoque Fácil** é um sistema multi-loja para contagem e controle de estoque das operações da Famiglia Reis Magos e Madre Pane (e demais filiais cadastradas no ERP Teknisa ZmartBI). O fluxo principal é mobile-first: o operador escaneia um QR Code de etiqueta de produto (ou de uma lista pré-cadastrada), digita a quantidade contada, e ao final do dia exporta um arquivo `.xlsx` no formato exigido pelo ZmartBI para importação automática do ajuste de inventário.

O sistema também tem um painel desktop (gestão) para cadastros, impressão de etiquetas térmicas em lote, criação das listas de contagem, gestão de funcionários por loja e relatórios.

**Identidade visual já definida** — design canvas completo entregue em `/design-reference/` (HTML + JSX + CSS + 27 telas em PDF). O visual deve seguir fielmente esse canvas: paleta Reis Magos (verde `#004125` / vermelho `#aa0000` / paper `#efe4c9`), tipografia Glitten (display serif itálico) + Manrope/Mona Sans (UI) + JetBrains Mono (códigos), aesthetic editorial-jornal.

---

## 2. Stack Técnica

### Backend / API

- **Node.js 22 + TypeScript** (ESM)
- **Express.js** ou **Fastify** (preferência por Fastify pela performance e schema validation nativa)
- **Prisma** ORM
- **PostgreSQL 16** (banco principal)
- **Redis** (cache de produtos do ZmartBI + sessão + filas)
- **BullMQ** para jobs (sync ZmartBI, export xlsx, geração de QR/etiquetas em lote)
- **Zod** para validação de schemas
- **Pino** para logs estruturados

### Frontend

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** (com tokens custom mapeados às variáveis CSS do design canvas — ver `styles/colors_and_type.css`)
- **shadcn/ui** como base de componentes (customizar com tokens Reis Magos)
- **TanStack Query** para data fetching e cache client-side
- **Zustand** para estado global (loja ativa, usuário, contagem em andamento)
- **next-auth v5 (Auth.js)** com provider Google (mesmo padrão dos outros projetos do Paulo, ex.: Table Score)
- **react-qr-reader** ou **html5-qrcode** para scan via câmera
- **qrcode** (lib npm) para geração de QR
- **xlsx** (SheetJS) para export
- **lucide-react** para ícones

### Estrutura monorepo (Turborepo)

Padrão idêntico ao Table Score:

```
estoque-facil/
├── apps/
│   ├── api/              # Fastify + Prisma
│   └── web/              # Next.js 15
├── packages/
│   ├── db/               # Prisma schema + client
│   ├── shared/           # tipos, schemas Zod, utils
│   └── ui/               # componentes compartilhados (design system)
├── docker/
│   ├── stack.yml         # Docker Swarm stack
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── turbo.json
├── package.json
└── CLAUDE.md
```

### Infraestrutura

- **Docker Swarm** no VPS existente (`robosac.com`)
- **Traefik** como reverse proxy + SSL automático (Let's Encrypt) — labels já no padrão dos outros stacks
- **Portainer** para deploy e gestão
- **Domínio**: `estoque.robosac.com` (web) e `api-estoque.robosac.com` (API)
- **PostgreSQL** e **Redis** podem ser containers dedicados do stack OU compartilhar com o postgres-master existente — a definir conforme infra atual
- Network externa `network_public` (Traefik)

---

## 3. Integração ZmartBI / Teknisa

**Fonte de dados primária — todos os produtos vêm daqui.**

- **Base URL**: `https://api-zmartbi.teknisa.com`
- **Webtoken**: `NjllZTI0MTVlMzc3ZjEyNWJhMjUxMmQ5XzExNDg=`
- O webtoken é enviado em todas as requisições (header ou query param — confirmar formato exato no primeiro teste de chamada).

### O que precisa ser sincronizado do ZmartBI

1. **Filiais (lojas)** — cada loja terá seus responsáveis e contagens isoladas.
2. **Grupos e Subgrupos** de produtos.
3. **Produtos** — com no mínimo:
   - `CDARVPROD` (código do produto — chave primária do export)
   - Nome
   - Marca / fornecedor (quando disponível)
   - Unidade de medida (`UN`, `KG`, `L`, etc.)
   - Grupo / Subgrupo
   - Filial à qual pertence (multi-loja)

### Estratégia de sync

- **Worker BullMQ agendado** a cada 6h (configurável) faz pull do ZmartBI e atualiza o Postgres local.
- **Endpoint manual `POST /api/sync/zmartbi`** (apenas Gestor) força resync imediato.
- Mantemos uma `cache` Redis com TTL de 1h dos produtos por loja para reduzir queries.
- **Estoque atual NUNCA é puxado do ZmartBI no fluxo de contagem** — a contagem é exatamente o que o operador digita. O ZmartBI é fonte apenas do *catálogo*.

### Formato de export para o ZmartBI

Esse é o formato exato que o ZmartBI consome para importação de ajuste de inventário:

| Coluna | Significado | Exemplo |
|---|---|---|
| `CDARVPROD` | Código do produto (do ZmartBI) | `1010101501500` |
| `DTLANCESTQ` | Data do lançamento de estoque (`DD/MM/YYYY`) | `01/05/2026` |
| `QTTOTLANCTO` | Quantidade total contada | `4.367` |

Arquivo de saída: **`.xlsx`** com essas três colunas exatas (cabeçalho idêntico, em maiúsculas, sem acento). Uma linha por produto contado. Decimais com ponto (`.`) e até 3 casas.

---

## 4. Funcionalidades

### 4.1. Autenticação (Login)

- **Login via Google OAuth** (next-auth) — apenas e-mails autorizados (whitelist por loja).
- Cada usuário tem um perfil:
  - **Gestor** — acesso total (todas as lojas que ele gerencia, cadastros, relatórios, exports).
  - **Com login** — operador que pode iniciar/finalizar contagem, scanear, ver listas.
  - **Sem login** — funcionário que aparece nos cadastros mas não autentica (ex.: pizzaiolo que só assina contagem feita por outro).
- Após login, se o usuário é Gestor de >1 loja, ele escolhe a **loja ativa** (vai pra um seletor na sidebar/topbar). Operadores com 1 loja vão direto.
- A "etapa 01 — Quem é você?" do design canvas (página `cad-func` / `login-1` no canvas) é o seletor de operador *após* o login Google — usado pra registrar quem assina cada contagem dentro do app já aberto, mesmo que o login Google da máquina seja de outra pessoa (ex.: tablet compartilhado).

### 4.2. Multi-loja

- Toda entidade (produtos sincronizados, listas de contagem, contagens, etiquetas impressas) é **scopada por `lojaId`**.
- Sidebar mostra a loja ativa em destaque (badge `CAPIM MACIO` no header como no canvas).
- Switcher de loja no topo (apenas para usuários com acesso a múltiplas filiais).

### 4.3. Cadastros

#### Produtos
- Listagem com busca, filtro por grupo, paginação.
- Campos: código (`CDARVPROD`), nome, marca, grupo, subgrupo, unidade, validade (resfriado/congelado — opcional, para etiquetas).
- **Não permitir criar/excluir manualmente produtos** — fonte de verdade é o ZmartBI. Apenas botão "Sincronizar agora".
- Permitir **editar metadados visuais** local (foto de referência, validades, métodos disponíveis — congelado/resfriado/ambiente) — esses dados ficam em tabela `produto_meta` separada para não conflitar com sync.
- Botão "Exportar" — exporta lista atual filtrada como `.xlsx`.

#### Grupos / Subgrupos
- Vêm do ZmartBI (read-only) — apenas exibidos para filtragem e organização.
- Tela "Famílias de produtos" do canvas (cards com ícones e contagem por grupo).

#### Funcionários
- CRUD local (nome, telefone, cargo, permissão: `sem-login` / `com-login` / `gestor`, status ativo/inativo).
- Permite vincular um e-mail Google para os com-login/gestor.

#### Métodos
- Lista simples: `Congelado`, `Resfriado`, `Ambiente` (e os customizados que o usuário criar — ex.: "Manipulado", "Em produção").
- Usado nas etiquetas e como categorização opcional.

### 4.4. Listas de Contagem

- Listas pré-cadastradas que agrupam produtos para uma contagem específica.
- Exemplos do canvas: `Proteínas` (14 produtos), `Peixes e Frutos do Mar` (3), `Queijos` (6), `Hortifruti` (8), `Massas e Molhos` (7).
- CRUD: nome, ícone, tags (subgrupos), seleção de produtos.
- **Cada lista gera um QR Code único** que, ao ser escaneado pelo app, carrega todos os produtos da lista para contagem em sequência.

### 4.5. Impressão de Etiquetas (desktop)

Tela "Imprima várias de uma vez" do canvas:

- Filtro por grupo (chips: Proteínas, Queijos, FLV, etc.).
- Tabela de produtos com checkbox de seleção, métodos (Congelado/Resfriado), e quantidade de etiquetas a imprimir (input numérico com `+`/`-`).
- **Pré-visualização ao vivo** da etiqueta térmica à direita (formato 80×40mm aprox., template idêntico ao do canvas).
- Cada etiqueta contém:
  - Nome do produto (grande, em CAPS para nomes curtos)
  - Método (RESFRIADO / CONGELADO)
  - Validade original, manipulação, validade calculada (auto a partir da data de impressão)
  - Marca/fornecedor, SIF, lote
  - Responsável (operador logado)
  - Endereço da loja
  - **QR Code** com payload `{ "lojaId", "produtoCdarvprod", "lote", "etiquetaId" }`
  - ID da etiqueta (`#XXXXXX`) para fallback de digitação manual
- Saída: gera um único job de impressão que envia para impressora térmica USB local. Para o MVP, exportamos um **PDF multi-página** (uma página por etiqueta no tamanho da impressora térmica) que o navegador imprime — driver USB direto fica para v2.
- Botão "Imprimir N etiquetas" mostra a contagem total agregada (qtd × itens selecionados).

### 4.6. Fluxo de Contagem (mobile-first)

Sequência de telas (ver canvas seções `mobile-cont`):

1. **Listas de contagem** — operador vê listas disponíveis da loja, busca, filtra por tag.
2. **Quem fará a contagem** — seleção do responsável (cards com iniciais dos funcionários da loja). Pode ser o próprio operador logado ou outro (ex.: gestor logando para registrar contagem do pizzaiolo).
3. **Como contar (instruções QR)** — onboarding de 4 passos com ilustração de QR.
4. **Scan QR (câmera)** — abre câmera, scaneia etiqueta. Mostra peek-card no rodapé com produto identificado, progresso (`18 de 74`), método, e botões `Contar por ID` (digitar manualmente) / `Ver lista`. Cada bipe consome **1 etiqueta** da contagem (qtd contada = total de etiquetas bipadas para aquele produto, somando os pesos individuais quando aplicável).
5. **Lista de produtos** (vista alternativa) — para listas pré-cadastradas, mostra todos os produtos da lista com status `OK` (contado) / `⚠` (pendente) / `⚠ erro` (divergência), com botão `Editar` ou `Contar`. Botão fixo no rodapé: **`Finalizar contagem`**.
6. **Sucesso** — tela "Parabéns Ana Rita! Contagem concluída com sucesso" com resumo: lista, responsável, data, etiquetas contadas, conformidade %.

#### Regras críticas da contagem

- **Data da contagem** é definida **no início da primeira contagem do dia** para aquela loja, e todos os itens lançados naquele dia compartilham a mesma data (`DTLANCESTQ`). A data só muda quando o operador inicia uma **nova contagem** (botão explícito) ou no dia seguinte.
- Cada lançamento individual (bipe ou digitação) vira um registro `Lancamento` com timestamp completo, mas o `DTLANCESTQ` agregado para o export é a data da contagem.
- Ao terminar, o operador clica **"Enviar contagem"** → o sistema marca a contagem como `FINALIZADA` e ela passa a estar disponível para export.
- Contagens não enviadas ficam em rascunho (`EM_ANDAMENTO`) e podem ser retomadas.
- Múltiplas contagens podem coexistir no mesmo dia (ex.: contagem matutina de proteínas + contagem noturna de bebidas). No export, agregamos `QTTOTLANCTO` por (`CDARVPROD`, `DTLANCESTQ`).

### 4.7. Recebimento NF-e (mobile)

Tela `mr-1` do canvas (escopo v1.5 — pode ficar para depois do MVP):

- Operador da doca recebe a NF-e (digitada ou importada via XML).
- App lista os itens da NF e o operador bipa cada item conferindo: marca, peso, e **temperatura** (campos `RESFRIADO 4°C`, `AMBIENTE`, `CONGELADO -18°C`).
- Botão "Bipar próximo item" — fluxo guiado.
- Conformidade fica registrada para auditoria.

### 4.8. Relatórios e Export

- **Histórico de contagens** — filtro por loja, período, responsável, lista. Lista todas as contagens com data, hora, responsável, total de itens, status.
- **Detalhe de contagem** — drill-down mostra cada item contado.
- **Export `.xlsx` por dia** — botão `Exportar contagem do dia` gera arquivo com colunas `CDARVPROD`, `DTLANCESTQ`, `QTTOTLANCTO`. Permite escolher se exporta uma contagem específica ou todas as contagens do dia consolidadas.
- **Dashboard** (página inicial) — variantes A/B/C do canvas; usar a `B — Editorial 'jornal'` como padrão. Exibe:
  - Saudação personalizada com nome do operador
  - Validades vencendo nas próximas 48h (cards à direita)
  - Tarefas do turno (etiquetas a imprimir, contagens pendentes, recebimentos previstos)
  - Card "Forno · Agora" (temperatura, massa, levedura) — dado externo opcional, pode ser placeholder no MVP.

---

## 5. Modelo de Dados (Prisma)

```prisma
model Loja {
  id            String   @id @default(cuid())
  zmartbiId     String   @unique
  nome          String
  endereco      String?
  ativo         Boolean  @default(true)
  produtos      Produto[]
  funcionarios  Funcionario[]
  contagens     Contagem[]
  listas        ListaContagem[]
  etiquetas     Etiqueta[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

model Funcionario {
  id          String   @id @default(cuid())
  nome        String
  email       String?  @unique
  telefone    String?
  cargo       String?
  permissao   Permissao @default(SEM_LOGIN)
  ativo       Boolean  @default(true)
  loja        Loja     @relation(fields: [lojaId], references: [id])
  lojaId      String
  contagens   Contagem[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum Permissao {
  SEM_LOGIN
  COM_LOGIN
  GESTOR
}

model Grupo {
  id        String     @id @default(cuid())
  zmartbiId String     @unique
  nome      String
  icone     String?
  cor       String?
  produtos  Produto[]
  subgrupos Subgrupo[]
}

model Subgrupo {
  id        String    @id @default(cuid())
  zmartbiId String    @unique
  nome      String
  grupo     Grupo     @relation(fields: [grupoId], references: [id])
  grupoId   String
  produtos  Produto[]
}

model Produto {
  id              String     @id @default(cuid())
  cdarvprod       String     // CHAVE PRIMÁRIA DO ZMARTBI — usada no export
  nome            String
  marca           String?
  unidade         String     // KG, UN, L, etc.
  loja            Loja       @relation(fields: [lojaId], references: [id])
  lojaId          String
  grupo           Grupo?     @relation(fields: [grupoId], references: [id])
  grupoId         String?
  subgrupo        Subgrupo?  @relation(fields: [subgrupoId], references: [id])
  subgrupoId      String?
  meta            ProdutoMeta?
  lancamentos     Lancamento[]
  etiquetas       Etiqueta[]
  produtosListas  ProdutoLista[]
  ativo           Boolean    @default(true)
  syncedAt        DateTime   @default(now())

  @@unique([lojaId, cdarvprod])
  @@index([lojaId, grupoId])
}

model ProdutoMeta {
  id                 String   @id @default(cuid())
  produto            Produto  @relation(fields: [produtoId], references: [id], onDelete: Cascade)
  produtoId          String   @unique
  fotoUrl            String?
  validadeResfriado  String?  // ex: "3 dias"
  validadeCongelado  String?
  metodos            String[] // ["congelado", "resfriado"]
  observacoes        String?
}

model ListaContagem {
  id          String          @id @default(cuid())
  nome        String
  icone       String?
  tags        String[]
  loja        Loja            @relation(fields: [lojaId], references: [id])
  lojaId      String
  produtos    ProdutoLista[]
  qrToken     String          @unique // payload do QR
  contagens   Contagem[]
  ativo       Boolean         @default(true)
  createdAt   DateTime        @default(now())
}

model ProdutoLista {
  produto     Produto       @relation(fields: [produtoId], references: [id])
  produtoId   String
  lista       ListaContagem @relation(fields: [listaId], references: [id], onDelete: Cascade)
  listaId     String

  @@id([produtoId, listaId])
}

model Contagem {
  id              String          @id @default(cuid())
  loja            Loja            @relation(fields: [lojaId], references: [id])
  lojaId          String
  responsavel     Funcionario     @relation(fields: [responsavelId], references: [id])
  responsavelId   String
  lista           ListaContagem?  @relation(fields: [listaId], references: [id])
  listaId         String?
  dataContagem    DateTime        // <- DTLANCESTQ (truncada para a data, sem hora)
  status          StatusContagem  @default(EM_ANDAMENTO)
  iniciadaEm      DateTime        @default(now())
  finalizadaEm    DateTime?
  lancamentos     Lancamento[]
  observacoes     String?

  @@index([lojaId, dataContagem])
}

enum StatusContagem {
  EM_ANDAMENTO
  FINALIZADA
  EXPORTADA
  CANCELADA
}

model Lancamento {
  id          String    @id @default(cuid())
  contagem    Contagem  @relation(fields: [contagemId], references: [id], onDelete: Cascade)
  contagemId  String
  produto     Produto   @relation(fields: [produtoId], references: [id])
  produtoId   String
  quantidade  Decimal   @db.Decimal(12, 3)
  metodo      String?   // congelado/resfriado/ambiente
  etiquetaId  String?   // se foi via scan, referencia a etiqueta
  registradoEm DateTime @default(now())

  @@index([contagemId])
  @@index([produtoId])
}

model Etiqueta {
  id           String    @id @default(cuid())
  produto      Produto   @relation(fields: [produtoId], references: [id])
  produtoId    String
  loja         Loja      @relation(fields: [lojaId], references: [id])
  lojaId       String
  metodo       String
  lote         String?
  responsavel  String?
  qrPayload    String    // JSON serializado
  validadeAte  DateTime?
  impressaEm   DateTime  @default(now())
  consumida    Boolean   @default(false)
}
```

---

## 6. Endpoints da API (resumo)

```
# Auth
POST   /auth/google                  # callback OAuth (next-auth gerencia)
GET    /me                           # usuário + lojas

# Sync
POST   /sync/zmartbi                 # força sync (Gestor)
GET    /sync/status                  # último sync, próxima execução

# Catálogo
GET    /lojas
GET    /grupos?lojaId=
GET    /produtos?lojaId=&grupoId=&q=
PATCH  /produtos/:id/meta            # editar fotoUrl, validades, métodos

# Funcionários
GET    /funcionarios?lojaId=
POST   /funcionarios
PATCH  /funcionarios/:id
DELETE /funcionarios/:id             # soft-delete

# Listas
GET    /listas?lojaId=
POST   /listas
PATCH  /listas/:id
DELETE /listas/:id
GET    /listas/qr/:qrToken           # resolve QR -> lista + produtos

# Contagem
POST   /contagens                    # inicia (lojaId, responsavelId, listaId?, dataContagem)
GET    /contagens?lojaId=&data=&status=
GET    /contagens/:id
POST   /contagens/:id/lancamentos    # adiciona/atualiza lançamento (produtoId, quantidade)
POST   /contagens/:id/finalizar
DELETE /contagens/:id

# Etiquetas
POST   /etiquetas/lote               # body: { itens: [{ produtoId, qtd, metodo }] } -> retorna PDF
GET    /etiquetas/qr/:id             # resolve QR de etiqueta -> produto

# Export
GET    /export/contagem/:id.xlsx     # uma contagem
GET    /export/dia.xlsx?lojaId=&data=  # consolidado do dia
```

---

## 7. Design / UX

### 7.1. Fonte da verdade visual

Os arquivos abaixo são o **design canvas oficial** e devem ser usados como referência pixel-a-pixel para a implementação:

```
design-reference/
├── Estoque Facil.html           # canvas executável (abrir no browser)
├── design-canvas.jsx            # framework de canvas
├── tweaks-panel.jsx             # painel de ajustes
├── src/
│   ├── data.jsx                 # PRODUCTS, FUNCIONARIOS, GRUPOS, LISTAS
│   ├── icons.jsx                # ícones SVG inline
│   ├── shell.jsx                # AppShell desktop + mobile
│   ├── screens-desktop.jsx      # 17 artboards desktop
│   └── screens-mobile.jsx       # 8 artboards mobile (380x760)
├── styles/
│   ├── colors_and_type.css      # tokens (cores + Glitten/Manrope)
│   ├── app.css                  # componentes do design system
│   └── fonts/                   # Glitten, Glitten Caps, Manrope
├── assets/
│   ├── logo-rm.svg
│   └── crest.svg
├── produtos.json                # 345 produtos reais Capim Macio
└── EstoqueFacil.pdf             # snapshot impresso de todas as 27 telas
```

**A implementação Tailwind/shadcn deve mapear os tokens CSS variables do `colors_and_type.css`** para os tokens do Tailwind (em `tailwind.config.ts`), garantindo paridade visual:

```ts
// tailwind.config.ts (excerto)
theme: {
  extend: {
    colors: {
      'rm-green':    'var(--rm-green)',     // #004125
      'rm-green-2':  'var(--rm-green-2)',
      'rm-red':      'var(--rm-red)',       // #aa0000
      'rm-gold':     'var(--rm-gold)',
      'rm-paper':    'var(--rm-paper)',     // #efe4c9
      'rm-cream':    'var(--rm-cream)',
      'rm-ink':      'var(--rm-ink)',
      // ...
    },
    fontFamily: {
      display: ['Glitten', 'Playfair Display', 'serif'],
      sans:    ['Manrope', 'system-ui', 'sans-serif'],
      mono:    ['JetBrains Mono', 'ui-monospace', 'monospace'],
    },
  }
}
```

### 7.2. Telas (mapa de páginas)

| Rota | Tela canvas | Plataforma |
|---|---|---|
| `/login` | `login-1` | Desktop + Mobile |
| `/` | `home-b` (Editorial) | Ambos |
| `/cadastros/produtos` | `cad-prod` | Desktop |
| `/cadastros/grupos` | `cad-grup` | Desktop |
| `/cadastros/funcionarios` | `cad-func` | Desktop |
| `/cadastros/funcionarios/novo` | `cf-a` (Modal clássico) | Desktop |
| `/etiquetas` | `et-1` | Desktop |
| `/contagem` | `mc-1` (Listas) | Mobile |
| `/contagem/:id/responsavel` | `mc-2` | Mobile |
| `/contagem/:id/instrucoes` | `mc-3` | Mobile |
| `/contagem/:id/scan` | `mc-4` | Mobile |
| `/contagem/:id/lista` | `mc-5` | Mobile |
| `/contagem/:id/sucesso` | `mc-6` | Mobile |
| `/recebimento` | `mr-1` | Mobile (v1.5) |

### 7.3. Princípios de UI

- **Hierarquia editorial** — headlines grandes em Glitten itálico (h1 56px), corpo em Manrope, monospaced para códigos/IDs/SIF.
- **Paper background** (`#efe4c9`) é a textura padrão; cards em branco puro ou cream.
- **Eyebrows em CAPS** com letter-spacing alto (`.22em`) e cor verde, como rótulos de seção.
- **Linhas hairline** (`1px solid rgba(10,26,16,.16)`) ao invés de bordas pesadas.
- **Botões primários** verdes (`--rm-green`) com texto branco, secundários ghost com borda hairline.
- **Mobile**: viewport 380px de largura, status bar fake "14:32 ••• 4G 🔋", header sticky com hamburguer + logo + avatar do usuário com cargo.
- **Confirmações sutis** — badges `OK` verdes, `⚠` vermelhos, sem alerts modais agressivos.

---

## 8. Deploy (Docker Swarm)

### `docker/stack.yml` (esqueleto)

```yaml
version: '3.8'

services:
  estoque-api:
    image: ${REGISTRY}/estoque-facil-api:${TAG:-latest}
    environment:
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: ${REDIS_URL}
      ZMARTBI_BASE_URL: https://api-zmartbi.teknisa.com
      ZMARTBI_TOKEN: ${ZMARTBI_TOKEN}
      AUTH_SECRET: ${AUTH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    networks:
      - network_public
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.estoque-api.rule=Host(`api-estoque.robosac.com`)"
        - "traefik.http.routers.estoque-api.entrypoints=websecure"
        - "traefik.http.routers.estoque-api.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.estoque-api.loadbalancer.server.port=3001"

  estoque-web:
    image: ${REGISTRY}/estoque-facil-web:${TAG:-latest}
    environment:
      NEXT_PUBLIC_API_URL: https://api-estoque.robosac.com
      AUTH_URL: https://estoque.robosac.com
      AUTH_SECRET: ${AUTH_SECRET}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
    networks:
      - network_public
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.estoque-web.rule=Host(`estoque.robosac.com`)"
        - "traefik.http.routers.estoque-web.entrypoints=websecure"
        - "traefik.http.routers.estoque-web.tls.certresolver=letsencryptresolver"
        - "traefik.http.services.estoque-web.loadbalancer.server.port=3000"

networks:
  network_public:
    external: true
```

### Variáveis de ambiente necessárias (Portainer secrets / .env)

```
DATABASE_URL=postgresql://estoque:senha@postgres:5432/estoque_facil
REDIS_URL=redis://redis:6379
ZMARTBI_TOKEN=NjllZTI0MTVlMzc3ZjEyNWJhMjUxMmQ5XzExNDg=
AUTH_SECRET=<gerar com openssl rand -base64 32>
GOOGLE_CLIENT_ID=<console.cloud.google.com>
GOOGLE_CLIENT_SECRET=<console.cloud.google.com>
```

### CI / Build

Padrão GitHub Actions: build com Turbo, push para registry privado, deploy via Portainer API (script `deploy.sh` no padrão dos outros projetos). Cache `pnpm` e Docker BuildKit habilitados.

---

## 9. Roadmap MVP

### Sprint 1 — Fundação (3-5 dias)
- [ ] Setup monorepo Turborepo + Prisma + tipos compartilhados
- [ ] Schema completo + migrações iniciais
- [ ] Tailwind config com tokens Reis Magos + setup de fontes
- [ ] Login Google + página `/login` (canvas `login-1`)
- [ ] AppShell desktop e mobile (`shell.jsx` portado para Next.js)

### Sprint 2 — Sync ZmartBI + Cadastros (3-4 dias)
- [ ] Worker BullMQ de sync ZmartBI (lojas, grupos, produtos)
- [ ] Telas `/cadastros/produtos`, `/cadastros/grupos`, `/cadastros/funcionarios`
- [ ] CRUD de funcionários

### Sprint 3 — Etiquetas (3 dias)
- [ ] Tela `/etiquetas` com seleção e preview
- [ ] Geração de QR + PDF multi-página de etiquetas (lib `pdf-lib` ou `puppeteer`)
- [ ] Listas de Contagem (CRUD + QR único por lista)

### Sprint 4 — Fluxo de Contagem (5 dias)
- [ ] Telas mobile `/contagem/*`
- [ ] Câmera + scan QR (`html5-qrcode`)
- [ ] Lançamentos em tempo real (debounced PATCH)
- [ ] Tela de sucesso + finalização

### Sprint 5 — Export + Dashboard (3 dias)
- [ ] Endpoint export `.xlsx` (`CDARVPROD` / `DTLANCESTQ` / `QTTOTLANCTO`)
- [ ] Dashboard editorial (`home-b`)
- [ ] Histórico de contagens

### Sprint 6 — Polimento + Deploy (2-3 dias)
- [ ] Stack Docker Swarm + Traefik
- [ ] Deploy `estoque.robosac.com` + `api-estoque.robosac.com`
- [ ] Smoke tests E2E (Playwright)
- [ ] CLAUDE.md final + documentação operacional

**Estimativa total**: ~3-4 semanas para MVP funcional em produção.

---

## 10. Critérios de aceite do MVP

1. ✅ Operador entra com Google, escolhe loja e está em <30s pronto para contar.
2. ✅ Scan de QR de etiqueta identifica produto e adiciona lançamento em <1s.
3. ✅ Scan de QR de lista carrega todos os produtos da lista para contagem em sequência.
4. ✅ Impressão em lote gera PDF de N etiquetas térmicas com QR válido.
5. ✅ Export `.xlsx` da contagem do dia abre no Excel/LibreOffice e importa sem erros no ZmartBI.
6. ✅ Multi-loja funcionando: gestor da Famiglia vê apenas suas lojas; operador da Madre Pane não vê nada da Famiglia.
7. ✅ Aplicação rodando em `estoque.robosac.com` com SSL automático via Traefik.
8. ✅ Visual idêntico ao design canvas (validação lado-a-lado com o PDF).

---

## 11. Não escopo (v2+)

- Driver direto de impressora térmica USB (v1 usa PDF + impressão do navegador).
- Recebimento NF-e completo com leitura de XML SEFAZ (escopo v1.5).
- App nativo iOS/Android (PWA cobre o caso mobile no MVP).
- Integração com Chatwoot/Evolution para alertas de validade vencendo.
- Relatórios analíticos avançados (variação contagem vs ZmartBI, perdas).
- Modo offline (PWA com IndexedDB + sync).

---

## 12. Decisões pendentes (perguntar ao Paulo antes de codar)

1. **Formato exato do webtoken ZmartBI** — vai como header `X-Webtoken`, query `?token=`, ou Bearer? Confirmar no primeiro `curl`.
2. **Endpoints específicos do ZmartBI** para listar lojas / produtos — quais paths usar? Existe documentação ou precisamos fazer engenharia reversa?
3. **Postgres compartilhado ou dedicado** no Swarm? (Reaproveitar `postgres-master` existente vs container novo).
4. **Quem tem acesso a quais lojas** — vai existir uma tabela `UsuarioLoja` para o Gestor que cuida de várias filiais? (sugestão: sim, criar logo).
5. **Validade calculada** das etiquetas — regra é `data_impressao + dias_resfriado` ou `data_manipulacao + dias`? Confirmar com a operação.
6. **Impressora térmica** — modelo/marca em uso? Largura do papel (40mm, 58mm, 80mm)? Isso define o template do PDF.
