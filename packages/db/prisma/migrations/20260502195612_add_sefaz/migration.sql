-- CreateEnum
CREATE TYPE "NfStatus" AS ENUM ('PENDENTE', 'RECEBIDA', 'IGNORADA', 'ERRO');

-- CreateEnum
CREATE TYPE "SefazSyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED', 'NO_CERT');

-- CreateTable
CREATE TABLE "NotaFiscalImportada" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "chaveAcesso" TEXT NOT NULL,
    "nsu" TEXT NOT NULL,
    "schemaTipo" TEXT NOT NULL,
    "numeroNf" TEXT,
    "serieNf" TEXT,
    "modelo" TEXT,
    "emissorCnpj" TEXT,
    "emissorNome" TEXT,
    "destCnpj" TEXT,
    "dataEmissao" TIMESTAMP(3),
    "dataAutorizacao" TIMESTAMP(3),
    "valorTotal" DECIMAL(14,2),
    "qtdItens" INTEGER,
    "xmlOriginal" TEXT NOT NULL,
    "xmlSchema" TEXT NOT NULL,
    "status" "NfStatus" NOT NULL DEFAULT 'PENDENTE',
    "recebimentoId" TEXT,
    "ignoradoMotivo" TEXT,
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "NotaFiscalImportada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SefazSync" (
    "id" TEXT NOT NULL,
    "lojaId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "status" "SefazSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "ultimoNsu" TEXT,
    "totalNfes" INTEGER NOT NULL DEFAULT 0,
    "totalEventos" INTEGER NOT NULL DEFAULT 0,
    "totalErros" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SefazSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalImportada_chaveAcesso_key" ON "NotaFiscalImportada"("chaveAcesso");

-- CreateIndex
CREATE UNIQUE INDEX "NotaFiscalImportada_recebimentoId_key" ON "NotaFiscalImportada"("recebimentoId");

-- CreateIndex
CREATE INDEX "NotaFiscalImportada_lojaId_status_idx" ON "NotaFiscalImportada"("lojaId", "status");

-- CreateIndex
CREATE INDEX "NotaFiscalImportada_lojaId_importadoEm_idx" ON "NotaFiscalImportada"("lojaId", "importadoEm");

-- CreateIndex
CREATE INDEX "NotaFiscalImportada_emissorCnpj_idx" ON "NotaFiscalImportada"("emissorCnpj");

-- CreateIndex
CREATE INDEX "SefazSync_lojaId_startedAt_idx" ON "SefazSync"("lojaId", "startedAt");

-- CreateIndex
CREATE INDEX "SefazSync_status_idx" ON "SefazSync"("status");

-- AddForeignKey
ALTER TABLE "NotaFiscalImportada" ADD CONSTRAINT "NotaFiscalImportada_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotaFiscalImportada" ADD CONSTRAINT "NotaFiscalImportada_recebimentoId_fkey" FOREIGN KEY ("recebimentoId") REFERENCES "Recebimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SefazSync" ADD CONSTRAINT "SefazSync_lojaId_fkey" FOREIGN KEY ("lojaId") REFERENCES "Loja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
