-- AlterTable
ALTER TABLE "Produto" ADD COLUMN "cdBarra" TEXT;

-- CreateIndex
CREATE INDEX "Produto_lojaId_cdBarra_idx" ON "Produto"("lojaId", "cdBarra");
