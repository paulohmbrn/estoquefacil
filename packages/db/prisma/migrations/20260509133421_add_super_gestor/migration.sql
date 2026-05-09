-- AlterTable
ALTER TABLE "User" ADD COLUMN     "superGestor" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "User_superGestor_idx" ON "User"("superGestor");
