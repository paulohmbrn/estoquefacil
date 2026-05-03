// /onboarding/lojas — picker de bootstrap acessível mesmo após o user já ter vínculos.
// Útil para Gestor multi-loja completar a reclamação das demais filiais.

import { FILIAIS_MVP } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/permissions';
import { BootstrapPicker, type LojaBootstrap } from '../../_components/bootstrap-gestor';

export default async function OnboardingLojasPage() {
  const user = await requireUser();

  const todasLojas = await prisma.loja.findMany({
    where: { ativo: true, zmartbiId: { in: [...FILIAIS_MVP] } },
    orderBy: { zmartbiId: 'asc' },
    select: {
      id: true,
      zmartbiId: true,
      nome: true,
      apelido: true,
      usuarioLojas: {
        where: { ativo: true, papel: 'GESTOR' },
        select: { userId: true },
      },
    },
  });

  const lojas: LojaBootstrap[] = todasLojas.map((l) => ({
    id: l.id,
    zmartbiId: l.zmartbiId,
    nome: l.nome,
    apelido: l.apelido,
    gestoresExistentes: l.usuarioLojas.length,
    jaSouVinculado: l.usuarioLojas.some((u) => u.userId === user.id),
  }));

  return <BootstrapPicker email={user.email} lojas={lojas} />;
}
