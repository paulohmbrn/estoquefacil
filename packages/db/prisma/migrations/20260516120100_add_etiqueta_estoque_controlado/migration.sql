-- Estoque controlado: ciclo de vida + auditoria por unidade na Etiqueta.
CREATE TYPE "EstadoEtiqueta" AS ENUM ('ATIVA', 'BAIXADA', 'CANCELADA');
CREATE TYPE "OrigemEtiqueta" AS ENUM ('RECEBIMENTO', 'AVULSO');

ALTER TABLE "Etiqueta" ADD COLUMN "serial" TEXT;
ALTER TABLE "Etiqueta" ADD COLUMN "estado" "EstadoEtiqueta" NOT NULL DEFAULT 'ATIVA';
ALTER TABLE "Etiqueta" ADD COLUMN "origem" "OrigemEtiqueta" NOT NULL DEFAULT 'AVULSO';
ALTER TABLE "Etiqueta" ADD COLUMN "recebimentoItemId" TEXT;
ALTER TABLE "Etiqueta" ADD COLUMN "baixadaEm" TIMESTAMP(3);
ALTER TABLE "Etiqueta" ADD COLUMN "baixadaPorId" TEXT;
ALTER TABLE "Etiqueta" ADD COLUMN "setorSolicitante" TEXT;
ALTER TABLE "Etiqueta" ADD COLUMN "baixaObs" TEXT;
ALTER TABLE "Etiqueta" ADD COLUMN "fatorConversaoSnap" DECIMAL(18,6) NOT NULL DEFAULT 1;
ALTER TABLE "Etiqueta" ADD COLUMN "cdarvprodEstoqueSnap" TEXT;

-- Backfill: estado a partir do antigo flag consumida; serial = id (único).
UPDATE "Etiqueta" SET "estado" = 'BAIXADA' WHERE "consumida" = true;
UPDATE "Etiqueta" SET "serial" = "id" WHERE "serial" IS NULL;

ALTER TABLE "Etiqueta" ALTER COLUMN "serial" SET NOT NULL;
ALTER TABLE "Etiqueta" DROP COLUMN "consumida";

CREATE UNIQUE INDEX "Etiqueta_serial_key" ON "Etiqueta"("serial");
CREATE INDEX "Etiqueta_lojaId_estado_produtoId_idx" ON "Etiqueta"("lojaId", "estado", "produtoId");
CREATE INDEX "Etiqueta_recebimentoItemId_idx" ON "Etiqueta"("recebimentoItemId");

ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_recebimentoItemId_fkey" FOREIGN KEY ("recebimentoItemId") REFERENCES "RecebimentoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Etiqueta" ADD CONSTRAINT "Etiqueta_baixadaPorId_fkey" FOREIGN KEY ("baixadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
