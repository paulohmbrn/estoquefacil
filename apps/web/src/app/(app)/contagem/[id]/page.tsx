import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { Card } from '@/components/ui/card';
import { ContagemClient, type LancamentoRow, type ProdutoLista } from './contagem-client';

export default async function ContagemAtivaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();

  const contagem = await prisma.contagem.findUnique({
    where: { id },
    include: {
      responsavel: { select: { nome: true } },
      lista: {
        include: {
          produtos: {
            include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
            orderBy: { ordem: 'asc' },
          },
        },
      },
      lancamentos: {
        include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
        orderBy: { registradoEm: 'desc' },
      },
    },
  });

  if (!contagem || contagem.lojaId !== lojaId) notFound();
  if (contagem.status === 'FINALIZADA' || contagem.status === 'EXPORTADA') {
    redirect(`/contagem/${id}/sucesso`);
  }
  if (contagem.status === 'CANCELADA') {
    // Não usamos redirect aqui — quando o user cancela pelo client e a página
    // re-renderiza ainda dentro da transition, o `redirect()` do Server Component
    // colide com o `router.replace` do client e gera client-side exception.
    // Mostramos uma página estática e deixamos o client navegar quando puder.
    return (
      <div className="max-w-[480px] mx-auto pt-12 text-center">
        <Card className="p-8">
          <p className="rm-eyebrow text-rm-mid">Contagem cancelada</p>
          <h1 className="rm-h3 mt-3">Esta contagem foi cancelada</h1>
          <p className="rm-caption text-rm-mid mt-3">
            Os lançamentos ficaram preservados em <Link href="/relatorios/contagens" className="rm-link">Relatórios → Contagens</Link>{' '}
            (filtre por &quot;Canceladas&quot;).
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link href="/contagem" className="ef-btn ef-btn-ghost flex-1 justify-center">
              Voltar pra contagens
            </Link>
            <Link href="/contagem/iniciar" className="ef-btn ef-btn-primary flex-1 justify-center">
              Nova contagem →
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const lancamentos: LancamentoRow[] = contagem.lancamentos.map((l) => ({
    produtoId: l.produto.id,
    cdarvprod: l.produto.cdarvprod,
    nome: l.produto.nome,
    unidade: l.produto.unidade,
    quantidade: l.quantidade.toString(),
  }));

  const idsContados = new Set(lancamentos.map((l) => l.produtoId));
  const produtosListaPendentes: ProdutoLista[] = (contagem.lista?.produtos ?? [])
    .filter((pl) => !idsContados.has(pl.produto.id))
    .map((pl) => ({
      id: pl.produto.id,
      cdarvprod: pl.produto.cdarvprod,
      nome: pl.produto.nome,
      unidade: pl.produto.unidade,
    }));

  return (
    <ContagemClient
      contagemId={contagem.id}
      responsavelNome={contagem.responsavel.nome}
      listaNome={contagem.lista?.nome ?? null}
      produtosListaPendentes={produtosListaPendentes}
      lancamentos={lancamentos}
    />
  );
}
