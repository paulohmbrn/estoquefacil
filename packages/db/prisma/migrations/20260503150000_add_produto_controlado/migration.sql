-- AlterTable
ALTER TABLE "ProdutoMeta"
  ADD COLUMN "controlado" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "estoqueMinimo" DECIMAL(14,3);

-- CreateIndex
CREATE INDEX "ProdutoMeta_controlado_idx" ON "ProdutoMeta"("controlado");
