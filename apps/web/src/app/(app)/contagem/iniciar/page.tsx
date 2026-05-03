import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { IniciarClient, type Funcionario } from './iniciar-client';

export default async function IniciarContagemPage({
  searchParams,
}: {
  searchParams: Promise<{ listaId?: string }>;
}) {
  const { lojaId } = await requireLojaAtiva();
  const { listaId } = await searchParams;

  const [funcionariosRaw, lista] = await Promise.all([
    prisma.funcionario.findMany({
      where: { lojaId, ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, cargo: true },
    }),
    listaId
      ? prisma.listaContagem.findUnique({
          where: { id: listaId },
          select: { id: true, nome: true, lojaId: true },
        })
      : Promise.resolve(null),
  ]);

  const funcionarios: Funcionario[] = funcionariosRaw;
  const listaValida = lista && lista.lojaId === lojaId ? lista : null;

  return (
    <div className="max-w-[860px] mx-auto">
      <PageHead
        eyebrow="Etapa 01 · Quem é você?"
        title={
          <>
            Quem fará a <em>contagem</em>
          </>
        }
        sub="Selecione o responsável que assina esta contagem. Você (logado) pode estar contando para um colega que não tem login."
      />
      <IniciarClient
        funcionarios={funcionarios}
        listaId={listaValida?.id ?? null}
        listaNome={listaValida?.nome ?? null}
      />
    </div>
  );
}
