// /cadastros/produtos/[id] — drill-down read-only do produto + editor de ProdutoMeta.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { lojaPodeRotular } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProdutoMetaForm } from './produto-meta-form';
import { ProdutoNutricionalForm } from './produto-nutricional-form';

export default async function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId, papel } = await requireLojaAtiva();

  const produto = await prisma.produto.findUnique({
    where: { id },
    include: {
      grupo: { select: { nome: true } },
      subgrupo: { select: { nome: true } },
      meta: true,
      nutricional: true,
      loja: { select: { zmartbiId: true } },
    },
  });
  if (!produto || produto.lojaId !== lojaId) notFound();

  const podeRotular = lojaPodeRotular(produto.loja.zmartbiId);

  return (
    <div className="max-w-[920px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/cadastros/produtos" className="hover:underline">Produtos</Link> · {produto.cdarvprod}
          </>
        }
        title={produto.nome}
        sub={`${produto.grupo?.nome ?? '—'} · ${produto.subgrupo?.nome ?? '—'} · ${produto.unidade}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-[13px]">
            <Field label="CDARVPROD"><span className="rm-mono">{produto.cdarvprod}</span></Field>
            <Field label="CD Produto"><span className="rm-mono">{produto.cdProduto}</span></Field>
            <Field label="Tipo">{produto.tipoProduto}</Field>
            <Field label="Status"><Badge variant={produto.status === 'S' ? 'green' : 'red'}>{produto.status}</Badge></Field>
            <Field label="DT Cadastro">{produto.dtCadastro.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</Field>
            <Field label="DT Alteração">{produto.dtAlteracao.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</Field>
            <Field label="Sincronizado em">{produto.syncedAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</Field>
            <Field label="Composição CMV">
              <Badge variant={produto.compoeCmv ? 'green' : 'neutral'}>
                {produto.compoeCmv ? 'Compõe' : 'Não compõe'}
              </Badge>
            </Field>
          </div>

          {papel === 'GESTOR' ? (
            <div className="pt-4 mt-4 border-t border-dashed border-hairline">
              <p className="rm-eyebrow text-rm-mid mb-3">Metadados editáveis (não vêm do ZmartBI)</p>
              <ProdutoMetaForm
                produtoId={produto.id}
                unidade={produto.unidade}
                initial={{
                  fotoUrl: produto.meta?.fotoUrl ?? '',
                  validadeResfriado: produto.meta?.validadeResfriado ?? null,
                  validadeCongelado: produto.meta?.validadeCongelado ?? null,
                  validadeAmbiente: produto.meta?.validadeAmbiente ?? null,
                  metodos: (produto.meta?.metodos ?? []) as ('congelado' | 'resfriado' | 'ambiente')[],
                  observacoes: produto.meta?.observacoes ?? '',
                  controlado: produto.meta?.controlado ?? false,
                  estoqueMinimo: produto.meta?.estoqueMinimo ? Number(produto.meta.estoqueMinimo) : null,
                }}
              />
            </div>
          ) : (
            <p className="text-rm-mid text-[12px] pt-3 border-t border-dashed border-hairline">
              Apenas Gestor pode editar metadados.
            </p>
          )}

          {/* Rótulo regulamentado RDC 429 — apenas FFB e Madre Pane (lojas com produção própria) */}
          {podeRotular && papel === 'GESTOR' && (
            <div className="pt-4 mt-4 border-t border-dashed border-hairline">
              <p className="rm-eyebrow text-rm-mid mb-1">Informação nutricional & rótulo regulamentado</p>
              <p className="text-[12px] text-rm-mid mb-4">
                RDC 429/2020 + IN 75/2020. Os valores são declarados por 100 {produto.nutricional?.unidadeBase ?? 'g'};
                a porção e o %VD aparecem calculados na etiqueta. Os selos &quot;ALTO EM…&quot; são gerados automaticamente
                conforme os limites da norma.
              </p>
              <ProdutoNutricionalForm
                produtoId={produto.id}
                initial={{
                  unidadeBase: (produto.nutricional?.unidadeBase as 'g' | 'ml') ?? 'g',
                  porcaoG: produto.nutricional?.porcaoG ?? null,
                  porcaoMedidaCaseira: produto.nutricional?.porcaoMedidaCaseira ?? null,
                  porcoesEmbalagem: produto.nutricional?.porcoesEmbalagem ?? null,
                  categoriaRDC429:
                    (produto.nutricional?.categoriaRDC429 as 'SOLIDO' | 'LIQUIDO' | 'REFEICAO_PRONTA') ?? 'SOLIDO',
                  valorEnergeticoKcal100: produto.nutricional?.valorEnergeticoKcal100 ?? null,
                  carboidratosG100: produto.nutricional?.carboidratosG100 ?? null,
                  acucaresTotaisG100: produto.nutricional?.acucaresTotaisG100 ?? null,
                  acucaresAdicionadosG100: produto.nutricional?.acucaresAdicionadosG100 ?? null,
                  proteinasG100: produto.nutricional?.proteinasG100 ?? null,
                  gordurasTotaisG100: produto.nutricional?.gordurasTotaisG100 ?? null,
                  gordurasSaturadasG100: produto.nutricional?.gordurasSaturadasG100 ?? null,
                  gordurasTransG100: produto.nutricional?.gordurasTransG100 ?? null,
                  fibrasG100: produto.nutricional?.fibrasG100 ?? null,
                  sodioMg100: produto.nutricional?.sodioMg100 ?? null,
                  ingredientes: produto.nutricional?.ingredientes ?? null,
                  alergicos: produto.nutricional?.alergicos ?? null,
                  modoPreparo: produto.nutricional?.modoPreparo ?? null,
                  modoConservacao: produto.nutricional?.modoConservacao ?? null,
                  conteudoLiquidoPadrao: produto.nutricional?.conteudoLiquidoPadrao ?? null,
                }}
              />
            </div>
          )}
        </Card>

        <aside>
          {produto.meta?.fotoUrl ? (
            <Card className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={produto.meta.fotoUrl} alt={produto.nome} className="w-full h-auto" />
            </Card>
          ) : (
            <Card className="p-10 text-center text-rm-mid text-[13px]">
              Sem foto cadastrada.
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="rm-eyebrow text-rm-mid">{label}</p>
      <div className="mt-[2px] text-rm-ink-2 font-medium">{children}</div>
    </div>
  );
}
