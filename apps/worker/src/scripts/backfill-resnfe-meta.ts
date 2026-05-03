// Back-fill: pra cada NotaFiscalImportada com schemaTipo='resNFe' e campos vazios,
// re-parseia o xmlOriginal e popula emissorCnpj, emissorNome, dataEmissao, valorTotal.
// Idempotente: pula linhas que já estão completas.

import { prisma, Prisma } from '@estoque/db';
import { parseResNfeXml } from '../sefaz/distribuicao.js';

async function main(): Promise<void> {
  const todos = await prisma.notaFiscalImportada.findMany({
    where: { schemaTipo: 'resNFe', emissorNome: null },
    select: { id: true, xmlOriginal: true },
  });
  console.log(`[backfill] ${todos.length} resNFe sem metadados`);

  let ok = 0; let fail = 0;
  for (const n of todos) {
    const res = parseResNfeXml(n.xmlOriginal);
    if (!res) { fail += 1; continue; }
    await prisma.notaFiscalImportada.update({
      where: { id: n.id },
      data: {
        emissorCnpj: res.emissorCnpj,
        emissorNome: res.emissorNome,
        dataEmissao: res.dataEmissao,
        valorTotal: new Prisma.Decimal(res.valorTotal),
      },
    });
    ok += 1;
  }
  console.log(`[backfill] DONE — atualizadas=${ok}, sem parse=${fail}`);
}

main()
  .catch((e) => { console.error('[backfill] FATAL:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
