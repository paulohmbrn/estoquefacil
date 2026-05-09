// /cadastros/gestores — administração de Super Gestores e atribuição de lojas.
// Visível APENAS pra quem é Super Gestor. Carrega todos os Users + vínculos.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireSuperGestor } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { GestoresClient, type GestorRow, type LojaOpt } from './gestores-client';

export default async function GestoresPage() {
  const me = await requireSuperGestor();

  const [users, lojas] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ superGestor: 'desc' }, { name: 'asc' }],
      include: {
        usuarioLojas: {
          include: { loja: { select: { id: true, zmartbiId: true, nome: true, apelido: true } } },
          orderBy: { loja: { zmartbiId: 'asc' } },
        },
      },
    }),
    prisma.loja.findMany({
      where: { ativo: true },
      orderBy: { zmartbiId: 'asc' },
      select: { id: true, zmartbiId: true, nome: true, apelido: true },
    }),
  ]);

  const rows: GestorRow[] = users.map((u) => ({
    id: u.id,
    name: u.name ?? '—',
    email: u.email,
    superGestor: u.superGestor,
    isMe: u.id === me.id,
    vinculos: u.usuarioLojas.map((v) => ({
      id: v.id,
      lojaId: v.lojaId,
      lojaApelido: v.loja.apelido ?? v.loja.nome,
      lojaZmartbiId: v.loja.zmartbiId,
      papel: v.papel,
      ativo: v.ativo,
    })),
  }));

  const lojaOpts: LojaOpt[] = lojas.map((l) => ({
    id: l.id,
    zmartbiId: l.zmartbiId,
    apelido: l.apelido ?? l.nome,
  }));

  return (
    <div className="max-w-[1200px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/cadastros/produtos" className="hover:underline">Cadastros</Link> · Gestores
          </>
        }
        title={
          <>
            Gestão de <em>acessos</em>
          </>
        }
        sub="Promova outro gestor a Super Gestor (acesso a tudo) ou atribua lojas pontuais. Apenas você (Super Gestor) vê esta tela."
      />

      <Card className="p-0 overflow-hidden">
        <GestoresClient users={rows} lojas={lojaOpts} />
      </Card>
    </div>
  );
}
