// Cálculo do estoque atual estimado (opção B):
//   estoqueAtual = quantidade da última contagem FINALIZADA/EXPORTADA
//                + Σ recebimentos FINALIZADOS posteriores à data daquela contagem
//
// Sem suporte a saídas/consumo — vai descalibrando entre contagens. Recomendado
// rodar contagem ao menos 1×/semana pros itens controlados.

import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';

export interface EstoqueAtualItem {
  produtoId: string;
  /** Quantidade estimada hoje, na unidade do produto. */
  estoqueAtual: number;
  /** Quantidade da última contagem (referência). */
  ultimaContagem: number | null;
  /** Data da contagem usada como base. null = nunca contado. */
  ultimaContagemEm: Date | null;
  /** Soma dos recebimentos posteriores à última contagem. */
  recebidoDesdeContagem: number;
}

/** Calcula o estoque atual estimado dos produtos passados (filtrado por loja). */
export async function calcularEstoqueAtual(args: {
  lojaId: string;
  produtoIds: string[];
}): Promise<Map<string, EstoqueAtualItem>> {
  const { lojaId, produtoIds } = args;
  if (produtoIds.length === 0) return new Map();

  // Última contagem FINALIZADA/EXPORTADA por produto (raw SQL pra `DISTINCT ON` eficiente).
  type LastRow = { produtoId: string; quantidade: Prisma.Decimal; dataContagem: Date };
  const ultimas = await prisma.$queryRaw<LastRow[]>`
    SELECT DISTINCT ON (l."produtoId")
      l."produtoId",
      l."quantidade",
      c."dataContagem"
    FROM "Lancamento" l
    JOIN "Contagem" c ON c.id = l."contagemId"
    WHERE l."produtoId" = ANY(${produtoIds}::text[])
      AND c."lojaId" = ${lojaId}
      AND c."status" IN ('FINALIZADA', 'EXPORTADA')
    ORDER BY l."produtoId", c."dataContagem" DESC, c."finalizadaEm" DESC NULLS LAST
  `;
  const ultimaPor = new Map<string, { qtd: number; em: Date }>();
  for (const r of ultimas) {
    ultimaPor.set(r.produtoId, { qtd: Number(r.quantidade), em: new Date(r.dataContagem) });
  }

  // Recebimentos FINALIZADOS posteriores à última contagem.
  // Pra produtos sem contagem, pega TODOS os recebimentos finalizados (estoque atual = só recebido).
  type RecRow = { produtoId: string; soma: Prisma.Decimal };
  const recebimentos = await prisma.$queryRaw<RecRow[]>`
    SELECT
      ri."produtoId",
      SUM(ri."quantidade") AS soma
    FROM "RecebimentoItem" ri
    JOIN "Recebimento" r ON r.id = ri."recebimentoId"
    LEFT JOIN LATERAL (
      SELECT MAX(c."dataContagem") AS data_ultima
      FROM "Lancamento" l
      JOIN "Contagem" c ON c.id = l."contagemId"
      WHERE l."produtoId" = ri."produtoId"
        AND c."lojaId" = ${lojaId}
        AND c."status" IN ('FINALIZADA', 'EXPORTADA')
    ) uc ON true
    WHERE ri."produtoId" = ANY(${produtoIds}::text[])
      AND r."lojaId" = ${lojaId}
      AND r."status" = 'FINALIZADO'
      AND (uc.data_ultima IS NULL OR r."dataRecebimento" > uc.data_ultima)
    GROUP BY ri."produtoId"
  `;
  const recebidoPor = new Map<string, number>();
  for (const r of recebimentos) recebidoPor.set(r.produtoId, Number(r.soma));

  const out = new Map<string, EstoqueAtualItem>();
  for (const pid of produtoIds) {
    const ult = ultimaPor.get(pid);
    const rec = recebidoPor.get(pid) ?? 0;
    out.set(pid, {
      produtoId: pid,
      estoqueAtual: (ult?.qtd ?? 0) + rec,
      ultimaContagem: ult?.qtd ?? null,
      ultimaContagemEm: ult?.em ?? null,
      recebidoDesdeContagem: rec,
    });
  }
  return out;
}

export type StatusReposicao = 'ok' | 'atencao' | 'repor' | 'sem_dado';

/** OK >120% mínimo · atenção 100-120% · repor ≤100% · sem_dado se nunca contou e nunca recebeu */
export function statusReposicao(
  estoqueAtual: number,
  estoqueMinimo: number,
  ultimaContagemEm: Date | null,
  recebidoDesdeContagem: number,
): StatusReposicao {
  if (ultimaContagemEm === null && recebidoDesdeContagem === 0) return 'sem_dado';
  if (estoqueMinimo <= 0) return 'ok';
  const ratio = estoqueAtual / estoqueMinimo;
  if (ratio <= 1) return 'repor';
  if (ratio <= 1.2) return 'atencao';
  return 'ok';
}
