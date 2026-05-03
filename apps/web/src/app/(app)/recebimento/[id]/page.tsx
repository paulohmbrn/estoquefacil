import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { RecebimentoClient, type ItemRow } from './recebimento-client';

export default async function RecebimentoAtivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();
  const r = await prisma.recebimento.findUnique({
    where: { id },
    include: {
      responsavel: { select: { nome: true } },
      itens: {
        include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
        orderBy: { registradoEm: 'desc' },
      },
    },
  });
  if (!r || r.lojaId !== lojaId) notFound();
  if (r.status === 'FINALIZADO') redirect(`/recebimento/${id}/sucesso`);
  if (r.status === 'CANCELADO') redirect('/recebimento');

  const itens: ItemRow[] = r.itens.map((i) => ({
    produtoId: i.produto.id,
    cdarvprod: i.produto.cdarvprod,
    nome: i.produto.nome,
    unidade: i.produto.unidade,
    quantidade: i.quantidade.toString(),
  }));

  return (
    <RecebimentoClient
      recebimentoId={r.id}
      responsavelNome={r.responsavel?.nome ?? 'Sem responsável'}
      fornecedor={r.fornecedor}
      numeroNf={r.numeroNf}
      iaConfigured={Boolean(process.env.ANTHROPIC_API_KEY)}
      itens={itens}
    />
  );
}
