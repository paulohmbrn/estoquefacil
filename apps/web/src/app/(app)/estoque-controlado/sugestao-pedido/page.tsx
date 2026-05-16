// /estoque-controlado/sugestao-pedido — compara saldo real (etiquetas ATIVA)
// com o estoque mínimo (ProdutoMeta.controlado + estoqueMinimo) e sugere
// quanto pedir: sugestão = mínimo − saldo (quando abaixo do mínimo).

import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function SugestaoPedidoPage() {
  const { lojaId } = await requireLojaAtiva();
  const loja = await prisma.loja.findUnique({
    where: { id: lojaId },
    select: { zmartbiId: true, apelido: true, nome: true },
  });
  if (!loja || !FILIAIS_ESTOQUE_CONTROLADO_SET.has(loja.zmartbiId)) {
    return (
      <div className="max-w-[1000px] mx-auto">
        <PageHead
          eyebrow="Estoque Controlado · Sugestão de pedido"
          title={<>Sugestão de <em>pedido</em></>}
          sub="Recurso não habilitado para esta loja."
        />
        <Card className="p-6 text-rm-mid text-[14px]">Indisponível nesta loja.</Card>
      </div>
    );
  }

  // Produtos marcados como controlados com mínimo definido.
  const produtos = await prisma.produto.findMany({
    where: { lojaId, ativo: true, meta: { controlado: true, estoqueMinimo: { not: null } } },
    select: { id: true, nome: true, cdarvprod: true, unidade: true, meta: { select: { estoqueMinimo: true } } },
    orderBy: { nome: 'asc' },
  });

  const saldoGrupos = produtos.length
    ? await prisma.etiqueta.groupBy({
        by: ['produtoId'],
        where: {
          lojaId,
          estado: 'ATIVA',
          cdarvprodEstoqueSnap: { not: null },
          produtoId: { in: produtos.map((p) => p.id) },
        },
        _count: { _all: true },
      })
    : [];
  const saldoById = new Map(saldoGrupos.map((g) => [g.produtoId, g._count._all]));

  const linhas = produtos
    .map((p) => {
      const minimo = p.meta?.estoqueMinimo ? Number(p.meta.estoqueMinimo) : 0;
      const saldo = saldoById.get(p.id) ?? 0;
      const sugestao = Math.max(0, Math.ceil(minimo) - saldo);
      return { id: p.id, nome: p.nome, cdarvprod: p.cdarvprod, unidade: p.unidade, minimo, saldo, sugestao };
    })
    .sort((a, b) => b.sugestao - a.sugestao || a.nome.localeCompare(b.nome));

  const aPedir = linhas.filter((l) => l.sugestao > 0);

  return (
    <div className="max-w-[1000px] mx-auto">
      <PageHead
        eyebrow="Estoque Controlado · Sugestão de pedido"
        title={<>Sugestão de <em>pedido</em></>}
        sub={`${loja.apelido ?? loja.nome} — saldo = etiquetas ativas. Sugestão = mínimo − saldo.`}
      />

      <div className="grid grid-cols-3 gap-3 mb-8">
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Controlados</p>
          <p className="rm-h2 mt-1">{linhas.length}</p>
        </Card>
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Abaixo do mínimo</p>
          <p className="rm-h2 mt-1">{aPedir.length}</p>
        </Card>
        <Card className="p-4">
          <p className="rm-eyebrow text-rm-gold">Itens a pedir</p>
          <p className="rm-h2 mt-1">{aPedir.reduce((s, l) => s + l.sugestao, 0)}</p>
        </Card>
      </div>

      {linhas.length === 0 ? (
        <Card className="p-6 text-rm-mid text-[14px]">
          Nenhum produto controlado com estoque mínimo definido. Marque o produto como
          “Produto controlado” e defina o mínimo em Cadastros → Produtos.
        </Card>
      ) : (
        <div className="border border-hairline rounded-xs overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-[rgba(0,65,37,.06)] text-rm-mid">
              <tr>
                <th className="text-left font-semibold px-4 py-2">Produto</th>
                <th className="text-right font-semibold px-3 py-2">Mínimo</th>
                <th className="text-right font-semibold px-3 py-2">Saldo</th>
                <th className="text-right font-semibold px-4 py-2">Sugestão</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.map((l) => (
                <tr key={l.id} className={l.sugestao > 0 ? 'bg-[rgba(170,0,0,.04)]' : ''}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-rm-ink">{l.nome}</span>
                    <span className="text-rm-mid"> · {l.cdarvprod} · {l.unidade}</span>
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{l.minimo}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{l.saldo}</td>
                  <td className="text-right px-4 py-2">
                    {l.sugestao > 0 ? (
                      <Badge variant="gold">{l.sugestao} {l.unidade}</Badge>
                    ) : (
                      <span className="text-rm-mid">ok</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
