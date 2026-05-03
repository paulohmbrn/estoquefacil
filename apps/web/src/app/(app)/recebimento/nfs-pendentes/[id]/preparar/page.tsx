// /recebimento/nfs-pendentes/[id]/preparar — tela onde o recebedor
// confirma o de-para entre os itens da NF e os produtos da loja antes
// de criar o Recebimento.

import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { previewRecebimentoFromNf } from '@/app/_actions/sefaz';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { PrepararClient, type ProdutoOpt } from './preparar-client';

export default async function PrepararPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { lojaId } = await requireLojaAtiva();

  const preview = await previewRecebimentoFromNf(id);
  if (!preview.ok) {
    return (
      <div className="max-w-[720px] mx-auto">
        <PageHead
          eyebrow={
            <Link href="/recebimento/nfs-pendentes" className="hover:underline">
              ← NFs pendentes
            </Link>
          }
          title={<>Preparar recebimento</>}
        />
        <Card className="p-6 text-center">
          <p className="text-rm-red">{preview.error}</p>
        </Card>
      </div>
    );
  }
  const { nota, itens } = preview.data!;

  const sugestaoIds = Array.from(
    new Set(itens.map((i) => i.sugestaoProdutoId).filter((x): x is string => Boolean(x))),
  );

  const [produtosSugeridosRaw, funcionariosRaw, recebimentoExistente] = await Promise.all([
    sugestaoIds.length > 0
      ? prisma.produto.findMany({
          where: { id: { in: sugestaoIds } },
          select: { id: true, cdarvprod: true, nome: true, unidade: true, grupo: { select: { nome: true } } },
        })
      : Promise.resolve([]),
    prisma.funcionario.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
    // Se a NF já virou recebimento, redireciona direto
    prisma.notaFiscalImportada.findUnique({
      where: { id },
      select: { status: true, recebimentoId: true },
    }),
  ]);

  if (recebimentoExistente?.status === 'RECEBIDA' && recebimentoExistente.recebimentoId) {
    redirect(`/recebimento/${recebimentoExistente.recebimentoId}`);
  }
  if (recebimentoExistente?.status === 'IGNORADA') notFound();

  const produtosSugeridos: ProdutoOpt[] = produtosSugeridosRaw.map((p) => ({
    id: p.id,
    cdarvprod: p.cdarvprod,
    nome: p.nome,
    unidade: p.unidade,
    grupo: p.grupo?.nome ?? null,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHead
        eyebrow={
          <Link href="/recebimento/nfs-pendentes" className="hover:underline">
            ← NFs pendentes
          </Link>
        }
        title={
          <>
            Preparar <em>recebimento</em>
          </>
        }
        sub="Confira cada item da NF e relacione com o produto da loja. Quando confirmar, vira um Recebimento em andamento."
      />

      <PrepararClient
        nota={nota}
        itens={itens}
        produtosSugeridos={produtosSugeridos}
        funcionarios={funcionariosRaw}
      />
    </div>
  );
}
