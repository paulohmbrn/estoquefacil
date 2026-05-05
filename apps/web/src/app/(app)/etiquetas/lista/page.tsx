// /etiquetas/lista — escolhe uma Lista de Contagem e gera etiquetas pra todos
// os produtos dela de uma vez.

import { lojaPodeRotular } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { EtiquetasListaClient, type ListaOption } from './etiquetas-lista-client';
import Link from 'next/link';

export default async function EtiquetasListaPage() {
  const { lojaId, papel } = await requireLojaAtiva();
  if (papel !== 'GESTOR') {
    return (
      <Card className="p-12 text-center">
        <p className="rm-eyebrow">Acesso restrito</p>
        <h2 className="rm-h3 mt-3">Apenas Gestor pode imprimir etiquetas</h2>
      </Card>
    );
  }

  const [listas, lojaInfo] = await Promise.all([
    prisma.listaContagem.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      include: {
        produtos: {
          include: {
            produto: {
              select: {
                id: true, cdarvprod: true, nome: true, unidade: true,
                nutricional: { select: { id: true, conteudoLiquidoPadrao: true } },
              },
            },
          },
          orderBy: { ordem: 'asc' },
        },
      },
    }),
    prisma.loja.findUnique({
      where: { id: lojaId },
      select: { argoxBridgeUrl: true, argoxBridgeToken: true, zmartbiId: true },
    }),
  ]);

  const podeRotular = lojaPodeRotular(lojaInfo?.zmartbiId);
  const opts: ListaOption[] = listas.map((l) => ({
    id: l.id,
    nome: l.nome,
    produtos: l.produtos.map((pl) => ({
      id: pl.produto.id,
      cdarvprod: pl.produto.cdarvprod,
      nome: pl.produto.nome,
      unidade: pl.produto.unidade,
      temNutricional: Boolean(pl.produto.nutricional?.id),
      conteudoLiquidoPadrao: pl.produto.nutricional?.conteudoLiquidoPadrao ?? null,
    })),
  }));

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Etiquetas · Por lista"
        title={
          <>
            Etiquetas <em>de uma lista</em>
          </>
        }
        sub="Escolha uma lista de contagem e gere etiquetas para todos os produtos dela em um lote."
      />

      {/* Tabs (mesmas da /etiquetas) */}
      <div className="flex gap-2 mb-5 border-b border-hairline">
        <Link
          href="/etiquetas"
          className="px-4 py-2 text-[12px] tracking-[.18em] uppercase font-semibold text-rm-mid hover:text-rm-green border-b-2 border-transparent hover:border-rm-green -mb-px transition-colors"
        >
          ← Por produto (avulso)
        </Link>
        <span className="px-4 py-2 text-[12px] tracking-[.18em] uppercase font-semibold text-rm-green border-b-2 border-rm-green -mb-px">
          Por lista de contagem
        </span>
      </div>

      {opts.length === 0 ? (
        <Card className="p-10 text-center text-rm-mid text-[13px]">
          Nenhuma lista cadastrada nesta loja. Vá em{' '}
          <Link href="/listas" className="rm-link">Listas</Link> para criar.
        </Card>
      ) : (
        <EtiquetasListaClient
          listas={opts}
          argoxBridgeUrl={lojaInfo?.argoxBridgeUrl ?? null}
          argoxCloudReady={Boolean(lojaInfo?.argoxBridgeToken)}
          podeRotular={podeRotular}
        />
      )}
    </div>
  );
}
