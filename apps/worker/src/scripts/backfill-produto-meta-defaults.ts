// Back-fill one-shot: pra cada Produto ativo SEM ProdutoMeta, aplica os defaults
// de método/validade baseados no grupo/subgrupo (mesma regra do sync ZmartBI).
// É idempotente: produtos com meta já existente NUNCA são tocados (preserva edições manuais).
//
// Uso (dentro do container worker):
//   pnpm exec tsx src/scripts/backfill-produto-meta-defaults.ts

import { prisma } from '@estoque/db';
import { inferProdutoMetaDefaults } from '@estoque/shared';

async function main(): Promise<void> {
  const startedAt = Date.now();

  // Pega produtos sem meta (left join via meta is null)
  const produtos = await prisma.produto.findMany({
    where: { ativo: true, meta: { is: null } },
    select: {
      id: true,
      grupo: { select: { nome: true } },
      subgrupo: { select: { nome: true } },
    },
  });

  console.log(`[backfill] ${produtos.length} produtos sem ProdutoMeta encontrados`);

  let aplicados = 0;
  let semRegra = 0;
  const batchSize = 1000;
  const buffer: { produtoId: string; metodos: string[]; validadeResfriado: number | null; validadeCongelado: number | null; validadeAmbiente: number | null; observacoes: string | null }[] = [];

  for (const p of produtos) {
    const defaults = inferProdutoMetaDefaults({
      grupoNome: p.grupo?.nome,
      subgrupoNome: p.subgrupo?.nome,
    });
    if (!defaults) {
      semRegra += 1;
      continue;
    }
    buffer.push({
      produtoId: p.id,
      metodos: defaults.metodos,
      validadeResfriado: defaults.validadeResfriado,
      validadeCongelado: defaults.validadeCongelado,
      validadeAmbiente: defaults.validadeAmbiente,
      observacoes: defaults.observacoes,
    });

    if (buffer.length >= batchSize) {
      const { count } = await prisma.produtoMeta.createMany({ data: buffer.splice(0), skipDuplicates: true });
      aplicados += count;
      console.log(`[backfill] +${count} (total ${aplicados})`);
    }
  }
  if (buffer.length > 0) {
    const { count } = await prisma.produtoMeta.createMany({ data: buffer, skipDuplicates: true });
    aplicados += count;
  }

  console.log(`[backfill] DONE — aplicados=${aplicados}, sem regra=${semRegra}, duração=${Date.now() - startedAt}ms`);
}

main()
  .catch((err) => {
    console.error('[backfill] erro:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
