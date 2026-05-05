-- CreateTable
CREATE TABLE "ProdutoNutricional" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "unidadeBase" TEXT NOT NULL DEFAULT 'g',
    "porcaoG" DOUBLE PRECISION,
    "porcaoMedidaCaseira" TEXT,
    "porcoesEmbalagem" DOUBLE PRECISION,
    "categoriaRDC429" TEXT NOT NULL DEFAULT 'SOLIDO',
    "valorEnergeticoKcal100" DOUBLE PRECISION,
    "carboidratosG100" DOUBLE PRECISION,
    "acucaresTotaisG100" DOUBLE PRECISION,
    "acucaresAdicionadosG100" DOUBLE PRECISION,
    "proteinasG100" DOUBLE PRECISION,
    "gordurasTotaisG100" DOUBLE PRECISION,
    "gordurasSaturadasG100" DOUBLE PRECISION,
    "gordurasTransG100" DOUBLE PRECISION,
    "fibrasG100" DOUBLE PRECISION,
    "sodioMg100" DOUBLE PRECISION,
    "ingredientes" TEXT,
    "alergicos" TEXT,
    "modoPreparo" TEXT,
    "modoConservacao" TEXT,
    "conteudoLiquidoPadrao" TEXT,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProdutoNutricional_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProdutoNutricional_produtoId_key" ON "ProdutoNutricional"("produtoId");

-- AddForeignKey
ALTER TABLE "ProdutoNutricional" ADD CONSTRAINT "ProdutoNutricional_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
