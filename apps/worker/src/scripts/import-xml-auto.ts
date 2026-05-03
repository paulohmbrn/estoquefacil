// Import manual de XMLs com AUTO-ROTEAMENTO: cada XML é direcionado pra loja
// cujo CNPJ bate com o <dest><CNPJ>. Útil quando vc tem um zip único com NFes
// de várias filiais misturadas.
//
// Uso:
//   pnpm exec tsx src/scripts/import-xml-auto.ts <pastaDosXmls>

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prisma, Prisma } from '@estoque/db';
import { parseNfeXml } from '../sefaz/distribuicao.js';

interface ImportSummary {
  zmartbiId: string;
  nome: string;
  cnpj: string | null;
  criadas: number;
  jaExistia: number;
  erros: number;
}

async function main(): Promise<void> {
  const [dir] = process.argv.slice(2);
  if (!dir) {
    console.error('Uso: tsx import-xml-auto.ts <pastaDosXmls>');
    process.exit(2);
  }

  const lojas = await prisma.loja.findMany({
    where: { cnpj: { not: null } },
    select: { id: true, zmartbiId: true, nome: true, cnpj: true },
  });
  const lojaPorCnpj = new Map(lojas.map((l) => [l.cnpj!, l]));
  console.log(`[import] ${lojas.length} lojas com CNPJ cadastrado`);

  const files = readdirSync(dir).filter((f) => /\.xml$/i.test(f));
  console.log(`[import] ${files.length} XMLs encontrados em ${dir}\n`);

  const stats = new Map<string, ImportSummary>();
  let semLoja = 0;
  let parseErr = 0;

  for (const file of files) {
    try {
      const xml = readFileSync(join(dir, file), 'utf8');
      const { meta } = parseNfeXml(xml);
      const loja = lojaPorCnpj.get(meta.destCnpj);
      if (!loja) {
        semLoja += 1;
        console.warn(`[import] SEM LOJA: ${file} destCnpj=${meta.destCnpj}`);
        continue;
      }

      let row = stats.get(loja.zmartbiId);
      if (!row) {
        row = { zmartbiId: loja.zmartbiId, nome: loja.nome, cnpj: loja.cnpj, criadas: 0, jaExistia: 0, erros: 0 };
        stats.set(loja.zmartbiId, row);
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
          row.jaExistia += 1;
          continue;
        }
        await prisma.notaFiscalImportada.update({ where: { id: existing.id }, data });
        row.criadas += 1; // upgrade resumo→procNFe conta como nova
      } else {
        await prisma.notaFiscalImportada.create({
          data: { ...data, lojaId: loja.id, chaveAcesso: meta.chaveAcesso, status: 'PENDENTE' },
        });
        row.criadas += 1;
      }
    } catch (err) {
      parseErr += 1;
      console.error(`[import] ERRO em ${file}:`, (err as Error).message);
    }
  }

  console.log(`\n${'─'.repeat(80)}`);
  console.log(`Resumo por loja:\n`);
  console.log(`${'#'.padEnd(6)}${'Loja'.padEnd(34)}${'CNPJ'.padEnd(20)}${'Novas'.padEnd(8)}Já existia`);
  console.log('─'.repeat(80));
  for (const [, r] of [...stats.entries()].sort()) {
    console.log(`${r.zmartbiId.padEnd(6)}${r.nome.padEnd(34)}${(r.cnpj ?? '—').padEnd(20)}${String(r.criadas).padEnd(8)}${r.jaExistia}`);
  }
  console.log(`\nXMLs sem loja correspondente: ${semLoja}`);
  console.log(`XMLs com erro de parse: ${parseErr}`);
  console.log(`Total criadas: ${[...stats.values()].reduce((a, r) => a + r.criadas, 0)}`);
  console.log(`Total já existia: ${[...stats.values()].reduce((a, r) => a + r.jaExistia, 0)}`);
}

main()
  .catch((err) => { console.error('[import] FATAL:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
