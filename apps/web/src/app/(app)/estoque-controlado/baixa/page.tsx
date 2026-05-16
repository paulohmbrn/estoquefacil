// /estoque-controlado/baixa — fluxo do estoquista no tablet: bipa as etiquetas
// que estão saindo, escolhe o setor solicitante e o responsável, e baixa.

import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { BaixaClient } from './baixa-client';

export default async function BaixaPage() {
  const { lojaId } = await requireLojaAtiva();
  const loja = await prisma.loja.findUnique({
    where: { id: lojaId },
    select: { zmartbiId: true },
  });

  if (!loja || !FILIAIS_ESTOQUE_CONTROLADO_SET.has(loja.zmartbiId)) {
    return (
      <div className="max-w-[920px] mx-auto">
        <PageHead
          eyebrow="Estoque Controlado · Baixa"
          title={<>Baixa por <em>scan</em></>}
          sub="Recurso não habilitado para esta loja."
        />
        <Card className="p-6 text-rm-mid text-[14px]">
          Estoque Controlado indisponível nesta loja.
        </Card>
      </div>
    );
  }

  const funcionarios = await prisma.funcionario.findMany({
    where: { lojaId, ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  });

  return <BaixaClient funcionarios={funcionarios} />;
}
