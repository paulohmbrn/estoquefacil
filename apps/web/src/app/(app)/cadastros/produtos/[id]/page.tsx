// /cadastros/produtos/[id] — drill-down read-only do produto + editor de ProdutoMeta.

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProdutoMetaForm } from './produto-meta-form';

export default async function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId, papel } = await requireLojaAtiva();

  const produto = await prisma.produto.findUnique({
    where: { id },
    include: {
      grupo: { select: { nome: true } },
      subgrupo: { select: { nome: true } },
      meta: true,
    },
  });
  if (!produto || produto.lojaId !== lojaId) notFound();

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
