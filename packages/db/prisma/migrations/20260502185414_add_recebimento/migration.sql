-- CreateEnum
CREATE TYPE "StatusRecebimento" AS ENUM ('EM_ANDAMENTO', 'FINALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "Recebimento" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "responsavelId" TEXT,
    "criadaPorId" TEXT,
    "dataRecebimento" DATE NOT NULL,
    "fornecedor" TEXT,
    "numeroNf" TEXT,
    "observacoes" TEXT,
    "status" "StatusRecebimento" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),
    "fotoNfUrl" TEXT,
    "iaProcessadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recebimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecebimentoItem" (
    "id" TEXT NOT NULL,
    "recebimentoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "descricaoNf" TEXT,
    "registradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecebimentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProdutoFornecedorMap" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "fornecedor" TEXT NOT NULL,
    "descricaoNf" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "vezesUsado" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProdutoFornecedorMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recebimento_lojaId_dataRecebimento_idx" ON "Recebimento"("lojaId", "dataRecebimento");

-- CreateIndex
CREATE INDEX "Recebimento_lojaId_status_idx" ON "Recebimento"("lojaId", "status");

-- CreateIndex
CREATE INDEX "RecebimentoItem_produtoId_idx" ON "RecebimentoItem"("produtoId");

-- CreateIndex
CREATE UNIQUE INDEX "RecebimentoItem_recebimentoId_produtoId_key" ON "RecebimentoItem"("recebimentoId", "produtoId");

-- CreateIndex
CREATE INDEX "ProdutoFornecedorMap_lojaId_fornecedor_idx" ON "ProdutoFornecedorMap"("lojaId", "fornecedor");

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoFornecedorMap_lojaId_fornecedor_descricaoNf_key" ON "ProdutoFornecedorMap"("lojaId", "fornecedor", "descricaoNf");

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_responsavelId_fkey" FOREIGN KEY ("responsavelId") REFERENCES "Funcionario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recebimento" ADD CONSTRAINT "Recebimento_criadaPorId_fkey" FOREIGN KEY ("criadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecebimentoItem" ADD CONSTRAINT "RecebimentoItem_recebimentoId_fkey" FOREIGN KEY ("recebimentoId") REFERENCES "Recebimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecebimentoItem" ADD CONSTRAINT "RecebimentoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedorMap" ADD CONSTRAINT "ProdutoFornecedorMap_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProdutoFornecedorMap" ADD CONSTRAINT "ProdutoFornecedorMap_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
