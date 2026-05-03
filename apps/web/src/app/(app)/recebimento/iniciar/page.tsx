import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { IniciarRecebimentoClient, type Funcionario } from './iniciar-client';

export default async function IniciarRecebimentoPage() {
  const { lojaId } = await requireLojaAtiva();
  const funcionarios: Funcionario[] = await prisma.funcionario.findMany({
    where: { lojaId, ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, cargo: true },
  });

  return (
    <div className="max-w-[720px] mx-auto">
      <PageHead
        eyebrow="Recebimento · novo"
        title={
          <>
            Quem vai <em>receber</em>
          </>
        }
        sub="Selecione o responsável, fornecedor e número da NF (opcionais)."
      />
      <IniciarRecebimentoClient funcionarios={funcionarios} />
    </div>
  );
}
