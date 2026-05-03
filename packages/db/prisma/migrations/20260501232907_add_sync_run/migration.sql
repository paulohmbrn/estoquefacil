-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'ABORTED', 'LOCKED');

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'zmartbi',
    "status" "SyncStatus" NOT NULL DEFAULT 'RUNNING',
    "triggeredBy" TEXT NOT NULL,
    "triggeredByUserId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "bytesBaixados" BIGINT,
    "itensRecebidos" INTEGER NOT NULL DEFAULT 0,
    "itensIgnorados" INTEGER NOT NULL DEFAULT 0,
    "itensProcessados" INTEGER NOT NULL DEFAULT 0,
    "produtosCriados" INTEGER NOT NULL DEFAULT 0,
    "produtosAtualizados" INTEGER NOT NULL DEFAULT 0,
    "produtosDesativados" INTEGER NOT NULL DEFAULT 0,
    "gruposCriados" INTEGER NOT NULL DEFAULT 0,
    "subgruposCriados" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "errorStack" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");

-- CreateIndex
CREATE INDEX "SyncRun_status_idx" ON "SyncRun"("status");
