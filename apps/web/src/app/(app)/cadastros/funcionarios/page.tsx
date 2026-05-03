import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { FuncionariosClient } from './funcionarios-client';
import { selfBootstrapGestor } from '@/app/_actions/funcionarios';

export default async function FuncionariosPage() {
  const { user, lojaId, papel } = await requireLojaAtiva();
  const isGestor = papel === 'GESTOR';

  const [funcionarios, loja, totalGestoresLoja, eusouGestor] = await Promise.all([
    prisma.funcionario.findMany({
      where: { lojaId },
      orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      select: {
        id: true, nome: true, email: true, telefone: true, cargo: true,
        permissao: true, ativo: true, userId: true,
      },
    }),
    prisma.loja.findUnique({ where: { id: lojaId }, select: { apelido: true, nome: true } }),
    prisma.usuarioLoja.count({ where: { lojaId, papel: 'GESTOR', ativo: true } }),
    prisma.usuarioLoja.findFirst({
      where: { userId: user.id, lojaId, papel: 'GESTOR', ativo: true },
      select: { id: true },
    }),
  ]);

  // Self-bootstrap aparece se o user logado AINDA NÃO é Gestor desta loja.
  // Múltiplos gestores são permitidos — um não bloqueia o outro.
  const showBootstrap = !eusouGestor;

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow={`Cadastros · Funcionários · ${loja?.apelido ?? loja?.nome ?? ''}`}
        title={
          <>
            Equipe da <em>loja</em>
          </>
        }
        sub={`${funcionarios.filter((f) => f.ativo).length} ativos de ${funcionarios.length}. ${totalGestoresLoja} ${totalGestoresLoja === 1 ? 'Gestor cadastrado' : 'Gestores cadastrados'}. ${
          isGestor
            ? 'Gestor pode cadastrar, vincular logins Google e desativar.'
            : 'Apenas Gestor pode editar — fale com um gestor da loja.'
        }`}
      />

      {showBootstrap && (
        <BootstrapCard
          lojaId={lojaId}
          email={user.email}
          totalGestores={totalGestoresLoja}
        />
      )}

      <FuncionariosClient
        funcionarios={funcionarios}
        lojaId={lojaId}
        isGestor={isGestor}
      />
    </div>
  );
}

function BootstrapCard({
  lojaId,
  email,
  totalGestores,
}: {
  lojaId: string;
  email: string;
  totalGestores: number;
}) {
  return (
    <Card className="p-6 mb-6 border-l-4 border-rm-gold bg-[#fdf7e3]">
      <p className="rm-eyebrow text-rm-gold">Você ainda não é Gestor desta loja</p>
      <h3 className="rm-h4 mt-2">
        {totalGestores === 0
          ? 'Esta loja ainda não tem Gestor cadastrado.'
          : `Esta loja já tem ${totalGestores} ${totalGestores === 1 ? 'Gestor' : 'Gestores'} — você pode entrar como mais um.`}
      </h3>
      <p className="rm-caption text-rm-ink-2 mt-2 max-w-[60ch]">
        Múltiplos Gestores por loja são permitidos. Reclame seu papel agora se você
        gerencia esta filial.
      </p>
      <form
        className="mt-4"
        action={async () => {
          'use server';
          await selfBootstrapGestor(lojaId);
        }}
      >
        <button type="submit" className="ef-btn ef-btn-primary">
          Sou Gestor desta loja ({email})
        </button>
      </form>
    </Card>
  );
}
