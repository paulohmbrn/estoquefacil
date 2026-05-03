-- AlterTable
ALTER TABLE "Loja" ADD COLUMN     "certificadoNome" TEXT,
ADD COLUMN     "certificadoPath" TEXT,
ADD COLUMN     "certificadoSenhaEnc" TEXT,
ADD COLUMN     "certificadoUploadedAt" TIMESTAMP(3),
ADD COLUMN     "certificadoValidoAte" TIMESTAMP(3),
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "inscricaoEstadual" TEXT,
ADD COLUMN     "ufFiscal" TEXT,
ADD COLUMN     "ultimoNsuSefaz" TEXT DEFAULT '0';
