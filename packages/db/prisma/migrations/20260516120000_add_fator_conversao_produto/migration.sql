-- Fator de conversão (ZmartBI): liga "produto de compra" ao "produto de
-- estoque" base. ESTOQUE = unidade base (fator 1); COMPRA = embalagem.
ALTER TABLE "Produto" ADD COLUMN "fatorConversao" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "Produto" ADD COLUMN "cdarvprodEstoque" TEXT;
ALTER TABLE "Produto" ADD COLUMN "tipoEstoque" TEXT NOT NULL DEFAULT 'ESTOQUE';

-- Backfill: todo produto existente é seu próprio produto de estoque base.
UPDATE "Produto" SET "cdarvprodEstoque" = "cdarvprod" WHERE "cdarvprodEstoque" IS NULL;

CREATE INDEX "Produto_lojaId_cdarvprodEstoque_idx" ON "Produto"("lojaId", "cdarvprodEstoque");
