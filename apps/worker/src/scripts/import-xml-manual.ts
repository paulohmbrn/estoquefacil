// Import manual de XMLs de NFe (procNFe v4.00) pra uma loja específica.
// Útil quando o sync SEFAZ não trouxe (porque outro sistema já consumiu o NSU)
// e o usuário tem os XMLs originais em mão.
//
// Uso (dentro do container worker):
//   pnpm exec tsx src/scripts/import-xml-manual.ts <zmartbiId> <pastaDosXmls>
// Ex:
//   pnpm exec tsx src/scripts/import-xml-manual.ts 0001 /tmp/xmls-0001

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma, Prisma } from '@estoque/db';
import { parseNfeXml } from '../sefaz/distribuicao.js';

async function main(): Promise<void> {
  const [zmartbiId, dir] = process.argv.slice(2);
  if (!zmartbiId || !dir) {
    console.error('Uso: tsx import-xml-manual.ts <zmartbiId> <pastaDosXmls>');
    process.exit(2);
  }

  const loja = await prisma.loja.findUnique({
    where: { zmartbiId },
    select: { id: true, nome: true, cnpj: true },
  });
  if (!loja) {
    console.error(`Loja com zmartbiId=${zmartbiId} não encontrada`);
    process.exit(2);
  }
  console.log(`[import] Loja: ${loja.nome} (CNPJ ${loja.cnpj ?? '—'})`);

  const files = readdirSync(dir).filter((f) => /\.xml$/i.test(f));
  console.log(`[import] ${files.length} XMLs encontrados em ${dir}`);

  let criadas = 0;
  let atualizadas = 0;
  let cnpjMismatch = 0;
  let erros = 0;
  let jaExistia = 0;

  for (const file of files) {
    const path = join(dir, file);
    try {
      const xml = readFileSync(path, 'utf8');
      const { meta } = parseNfeXml(xml);

      // Sanity: confere se a NF é de fato pra essa loja
      if (loja.cnpj && meta.destCnpj && meta.destCnpj !== loja.cnpj) {
        cnpjMismatch += 1;
        console.warn(`[import] SKIP ${file}: destCnpj=${meta.destCnpj} ≠ loja.cnpj=${loja.cnpj}`);
        continue;
      }

      const existing = await prisma.notaFiscalImportada.findUnique({
        where: { chaveAcesso: meta.chaveAcesso },
        select: { id: true, schemaTipo: true },
      });

      const data = {
        nsu: 'manual',
        schemaTipo: 'procNFe',
        xmlSchema: 'procNFe_v4.00',
        xmlOriginal: xml,
        numeroNf: meta.numeroNf,
        serieNf: meta.serieNf,
        modelo: meta.modelo,
        emissorCnpj: meta.emissorCnpj,
        emissorNome: meta.emissorNome,
        destCnpj: meta.destCnpj,
        dataEmissao: meta.dataEmissao,
        dataAutorizacao: meta.dataAutorizacao,
        valorTotal: new Prisma.Decimal(meta.valorTotal),
        qtdItens: meta.qtdItens,
      };

      if (existing) {
        if (existing.schemaTipo === 'procNFe') {
          jaExistia += 1;
          console.log(`[import] já existia (procNFe): ${file} chave=${meta.chaveAcesso}`);
          continue;
        }
        await prisma.notaFiscalImportada.update({
          where: { id: existing.id },
          data,
        });
        atualizadas += 1;
        console.log(`[import] atualizada (era resumo): ${file}`);
      } else {
        await prisma.notaFiscalImportada.create({
          data: { ...data, lojaId: loja.id, chaveAcesso: meta.chaveAcesso, status: 'PENDENTE' },
        });
        criadas += 1;
        console.log(`[import] criada: ${file} (${meta.emissorNome} | nº ${meta.numeroNf} | R$ ${meta.valorTotal} | ${meta.qtdItens} itens)`);
      }
    } catch (err) {
      erros += 1;
      console.error(`[import] erro em ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n[import] DONE — criadas=${criadas}, atualizadas=${atualizadas}, jaExistia=${jaExistia}, cnpjMismatch=${cnpjMismatch}, erros=${erros}`);
}

main()
  .catch((err) => {
    console.error('[import] FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
