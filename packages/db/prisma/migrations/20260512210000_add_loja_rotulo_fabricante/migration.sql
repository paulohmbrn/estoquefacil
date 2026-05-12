-- Identificação do fabricante para o rótulo regulamentado (RDC 429/2020 + IN 75/2020).
ALTER TABLE "Loja" ADD COLUMN "razaoSocial" TEXT;
ALTER TABLE "Loja" ADD COLUMN "logradouro" TEXT;
ALTER TABLE "Loja" ADD COLUMN "numero" TEXT;
ALTER TABLE "Loja" ADD COLUMN "complemento" TEXT;
ALTER TABLE "Loja" ADD COLUMN "bairro" TEXT;
ALTER TABLE "Loja" ADD COLUMN "municipio" TEXT;
ALTER TABLE "Loja" ADD COLUMN "cep" TEXT;
ALTER TABLE "Loja" ADD COLUMN "telefone" TEXT;
