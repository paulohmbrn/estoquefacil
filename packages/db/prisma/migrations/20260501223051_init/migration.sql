-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('GESTOR', 'OPERADOR');

-- CreateEnum
CREATE TYPE "Permissao" AS ENUM ('SEM_LOGIN', 'COM_LOGIN', 'GESTOR');

-- CreateEnum
CREATE TYPE "StatusContagem" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA', 'EXPORTADA', 'CANCELADA');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Loja" (
    "id" TEXT NOT NULL,
    "zmartbiId" TEXT NOT NULL,
    "nrOrg" INTEGER NOT NULL,
    "cdEmpresa" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "apelido" TEXT,
    "endereco" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioLoja" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'OPERADOR',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsuarioLoja_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funcionario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "cargo" TEXT,
    "permissao" "Permissao" NOT NULL DEFAULT 'SEM_LOGIN',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "lojaId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funcionario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grupo" (
    "id" TEXT NOT NULL,
    "zmartbiId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "icone" TEXT,
    "cor" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subgrupo" (
    "id" TEXT NOT NULL,
    "zmartbiId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "grupoId" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subgrupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "cdarvprod" TEXT NOT NULL,
    "cdProduto" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "tipoProduto" TEXT NOT NULL,
    "vrPrecoVenda" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'S',
    "compoeCmv" BOOLEAN NOT NULL DEFAULT true,
    "dtCadastro" TIMESTAMP(3) NOT NULL,
    "dtAlteracao" TIMESTAMP(3) NOT NULL,
    "lojaId" TEXT NOT NULL,
    "grupoId" TEXT,
    "subgrupoId" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoMeta" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "fotoUrl" TEXT,
    "validadeResfriado" INTEGER,
    "validadeCongelado" INTEGER,
    "validadeAmbiente" INTEGER,
    "metodos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "observacoes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaContagem" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "icone" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lojaId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListaContagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoLista" (
    "produtoId" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProdutoLista_pkey" PRIMARY KEY ("produtoId","listaId")
);

-- CreateTable
CREATE TABLE "Contagem" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "responsavelId" TEXT NOT NULL,
    "criadaPorId" TEXT,
    "listaId" TEXT,
    "dataContagem" DATE NOT NULL,
    "status" "StatusContagem" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),
    "exportadaEm" TIMESTAMP(3),
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "contagemId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "metodo" TEXT,
    "observacoes" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Etiqueta" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "metodo" TEXT NOT NULL,
    "lote" TEXT,
    "responsavel" TEXT,
    "qrPayload" TEXT NOT NULL,
    "validadeAte" TIMESTAMP(3),
    "impressaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumida" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Etiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Loja_zmartbiId_key" ON "Loja"("zmartbiId");

-- CreateIndex
CREATE INDEX "Loja_ativo_idx" ON "Loja"("ativo");

-- CreateIndex
CREATE INDEX "UsuarioLoja_userId_idx" ON "UsuarioLoja"("userId");

-- CreateIndex
CREATE INDEX "UsuarioLoja_lojaId_idx" ON "UsuarioLoja"("lojaId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioLoja_userId_lojaId_key" ON "UsuarioLoja"("userId", "lojaId");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_email_key" ON "Funcionario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Funcionario_userId_key" ON "Funcionario"("userId");

-- CreateIndex
CREATE INDEX "Funcionario_lojaId_ativo_idx" ON "Funcionario"("lojaId", "ativo");

-- CreateIndex
CREATE UNIQUE INDEX "Grupo_zmartbiId_key" ON "Grupo"("zmartbiId");

-- CreateIndex
CREATE UNIQUE INDEX "Subgrupo_zmartbiId_key" ON "Subgrupo"("zmartbiId");

-- CreateIndex
CREATE INDEX "Subgrupo_grupoId_idx" ON "Subgrupo"("grupoId");

-- CreateIndex
CREATE INDEX "Produto_lojaId_grupoId_idx" ON "Produto"("lojaId", "grupoId");

-- CreateIndex
CREATE INDEX "Produto_lojaId_ativo_idx" ON "Produto"("lojaId", "ativo");

-- CreateIndex
CREATE INDEX "Produto_cdarvprod_idx" ON "Produto"("cdarvprod");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_lojaId_cdarvprod_key" ON "Produto"("lojaId", "cdarvprod");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoMeta_produtoId_key" ON "ProdutoMeta"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "ListaContagem_qrToken_key" ON "ListaContagem"("qrToken");

-- CreateIndex
CREATE INDEX "ListaContagem_lojaId_ativo_idx" ON "ListaContagem"("lojaId", "ativo");

-- CreateIndex
CREATE INDEX "ProdutoLista_listaId_ordem_idx" ON "ProdutoLista"("listaId", "ordem");

-- CreateIndex
CREATE INDEX "Contagem_lojaId_dataContagem_idx" ON "Contagem"("lojaId", "dataContagem");

-- CreateIndex
CREATE INDEX "Contagem_lojaId_status_idx" ON "Contagem"("lojaId", "status");

-- CreateIndex
CREATE INDEX "Lancamento_produtoId_idx" ON "Lancamento"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "Lancamento_contagemId_produtoId_key" ON "Lancamento"("contagemId", "produtoId");

-- CreateIndex
CREATE INDEX "Etiqueta_lojaId_impressaEm_idx" ON "Etiqueta"("lojaId", "impressaEm");

-- CreateIndex
CREATE INDEX "Etiqueta_produtoId_idx" ON "Etiqueta"("produtoId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioLoja" ADD CONSTRAINT "UsuarioLoja_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioLoja" ADD CONSTRAINT "UsuarioLoja_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funcionario" ADD CONSTRAINT "Funcionario_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subgrupo" ADD CONSTRAINT "Subgrupo_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_grupoId_fkey" FOREIGN KEY ("grupoId") REFERENCES "Grupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_subgrupoId_fkey" FOREIGN KEY ("subgrupoId") REFERENCES "Subgrupo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoMeta" ADD CONSTRAINT "ProdutoMeta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaContagem" ADD CONSTRAINT "ListaContagem_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoLista" ADD CONSTRAINT "ProdutoLista_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoLista" ADD CONSTRAINT "ProdutoLista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaContagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Funcionario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contagem" ADD CONSTRAINT "Contagem_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "ListaContagem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_contagemId_fkey" FOREIGN KEY ("contagemId") REFERENCES "Contagem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
