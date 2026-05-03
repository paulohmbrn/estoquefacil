-- AlterTable
ALTER TABLE "Loja" ADD COLUMN "argoxBridgeToken" TEXT;

-- CreateIndex (unique)
CREATE UNIQUE INDEX "Loja_argoxBridgeToken_key" ON "Loja"("argoxBridgeToken");
