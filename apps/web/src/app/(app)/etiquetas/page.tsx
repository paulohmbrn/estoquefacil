import Link from 'next/link';
import { lojaPodeRotular } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { EtiquetasClient, type ProdutoEtiqueta, type GrupoOpt } from './etiquetas-client';

export default async function EtiquetasPage() {
  const { lojaId, papel } = await requireLojaAtiva();
  if (papel !== 'GESTOR') {
    return (
      <Card className="p-12 text-center">
        <p className="rm-eyebrow">Acesso restrito</p>
        <h2 className="rm-h3 mt-3">Apenas Gestor pode imprimir etiquetas</h2>
        <p className="rm-caption text-rm-mid mt-3">
          Fale com o Gestor da sua loja para gerar o lote de etiquetas térmicas.
        </p>
      </Card>
    );
  }

  const [produtos, grupos, lojaInfo] = await Promise.all([
    prisma.produto.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        cdarvprod: true,
        nome: true,
        unidade: true,
        grupoId: true,
        grupo: { select: { nome: true } },
        nutricional: { select: { id: true, conteudoLiquidoPadrao: true } },
      },
    }),
    prisma.grupo.findMany({
      where: { produtos: { some: { lojaId, ativo: true } } },
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        _count: { select: { produtos: { where: { lojaId, ativo: true } } } },
      },
    }),
    prisma.loja.findUnique({
      where: { id: lojaId },
      select: { argoxBridgeUrl: true, argoxBridgeToken: true, zmartbiId: true },
    }),
  ]);

  const podeRotular = lojaPodeRotular(lojaInfo?.zmartbiId);
  const produtosClient: ProdutoEtiqueta[] = produtos.map((p) => ({
    id: p.id,
    cdarvprod: p.cdarvprod,
    nome: p.nome,
    unidade: p.unidade,
    grupoId: p.grupoId,
    grupoNome: p.grupo?.nome ?? null,
    temNutricional: Boolean(p.nutricional?.id),
    conteudoLiquidoPadrao: p.nutricional?.conteudoLiquidoPadrao ?? null,
  }));
  const gruposClient: GrupoOpt[] = grupos.map((g) => ({
    id: g.id,
    nome: g.nome,
    total: g._count.produtos,
  }));

  return (
    <div className="max-w-[1400px] mx-auto">
      <PageHead
        eyebrow="Etiquetas · Impressão"
        title={
          <>
            Imprima várias <em>de uma vez</em>
          </>
        }
        sub={`${produtos.length.toLocaleString('pt-BR')} produtos. Térmica 60/40mm (Elgin L42 Pro) ou A4 PIMACO A4360.`}
      />

      {/* Tabs de modo */}
      <div className="flex gap-2 mb-5 border-b border-hairline">
        <span className="px-4 py-2 text-[12px] tracking-[.18em] uppercase font-semibold text-rm-green border-b-2 border-rm-green -mb-px">
          Por produto (avulso)
        </span>
        <Link
          href="/etiquetas/lista"
          className="px-4 py-2 text-[12px] tracking-[.18em] uppercase font-semibold text-rm-mid hover:text-rm-green border-b-2 border-transparent hover:border-rm-green -mb-px transition-colors"
        >
          Por lista de contagem →
        </Link>
      </div>

      {produtos.length === 0 ? (
        <Card className="p-12 text-center text-rm-mid">
          Nenhum produto sincronizado ainda — rode o sync em <Link href="/sincronizacao" className="rm-link">sincronização</Link>.
        </Card>
      ) : (
        <EtiquetasClient
          produtos={produtosClient}
          grupos={gruposClient}
          argoxBridgeUrl={lojaInfo?.argoxBridgeUrl ?? null}
          argoxCloudReady={Boolean(lojaInfo?.argoxBridgeToken)}
          podeRotular={podeRotular}
        />
      )}
    </div>
  );
}
