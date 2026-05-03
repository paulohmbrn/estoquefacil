import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { ListasClient, type ListaRow } from './listas-client';

export default async function ListasPage() {
  const { lojaId, papel } = await requireLojaAtiva();

  const listasDb = await prisma.listaContagem.findMany({
    where: { lojaId, ativo: true },
    orderBy: { nome: 'asc' },
    include: {
      _count: { select: { produtos: true, contagens: true } },
    },
  });

  const listas: ListaRow[] = listasDb.map((l) => ({
    id: l.id,
    nome: l.nome,
    icone: l.icone,
    tags: l.tags,
    ativo: l.ativo,
    totalProdutos: l._count.produtos,
    totalContagens: l._count.contagens,
  }));

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow="Contagem · Listas"
        title={
          <>
            Listas de <em>contagem</em>
          </>
        }
        sub={`${listas.length} listas ativas. Cada lista gera um QR único: o operador escaneia e o app carrega todos os produtos para contagem em sequência.`}
      />
      <ListasClient listas={listas} isGestor={papel === 'GESTOR'} />
    </div>
  );
}
