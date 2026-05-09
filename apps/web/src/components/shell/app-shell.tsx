// Server Component que carrega lojas + loja ativa do user e monta a casca.
// Layout responsivo:
//  - mobile (<lg): MobileChrome (header fixo top simples) + main full-width + tab bar bottom
//  - desktop (>=lg): Sidebar fixa 240px + Topbar + main

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getLojaAtivaId } from '@/app/_actions/loja-ativa';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';
import { MobileChrome } from './mobile-chrome';
import type { LojaSwitcherItem } from './loja-switcher';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const userId = session.user.id;

  // Super Gestor vê TODAS as lojas ativas como GESTOR; Gestor/Operador comum
  // vê só os vínculos próprios.
  const userInfo2 = await prisma.user.findUnique({
    where: { id: userId },
    select: { superGestor: true },
  });
  const isSuper = Boolean(userInfo2?.superGestor);

  let lojas: LojaSwitcherItem[];
  let papelAtivo: 'GESTOR' | 'OPERADOR' | null = null;

  if (isSuper) {
    const todas = await prisma.loja.findMany({
      where: { ativo: true },
      orderBy: { zmartbiId: 'asc' },
      select: { id: true, zmartbiId: true, nome: true, apelido: true },
    });
    lojas = todas.map((l) => ({
      id: l.id,
      zmartbiId: l.zmartbiId,
      nome: l.nome,
      apelido: l.apelido,
      papel: 'GESTOR',
    }));
  } else {
    const vinculos = await prisma.usuarioLoja.findMany({
      where: { userId, ativo: true, loja: { ativo: true } },
      include: {
        loja: { select: { id: true, zmartbiId: true, nome: true, apelido: true } },
      },
      orderBy: { loja: { zmartbiId: 'asc' } },
    });
    lojas = vinculos.map((v) => ({
      id: v.loja.id,
      zmartbiId: v.loja.zmartbiId,
      nome: v.loja.nome,
      apelido: v.loja.apelido,
      papel: v.papel,
    }));
  }

  const cookieAtiva = await getLojaAtivaId();
  const ativa = lojas.find((l) => l.id === cookieAtiva) ?? lojas[0] ?? null;
  if (ativa) papelAtivo = ativa.papel;

  const userInfo = {
    name: session.user.name ?? null,
    email: session.user.email ?? null,
    image: session.user.image ?? null,
  };

  return (
    <div className="min-h-screen bg-white text-rm-ink">
      {/* Mobile chrome (header simples) — apenas <lg.
         Switcher só pra Super Gestor; Gestor comum só vê a loja fixa. */}
      <MobileChrome
        user={userInfo}
        apelidoLoja={ativa?.apelido ?? null}
        lojas={isSuper ? lojas : ativa ? [ativa] : []}
        lojaAtivaId={ativa?.id ?? null}
      />

      {/* Desktop layout — apenas lg+ */}
      <div className="hidden lg:grid lg:grid-cols-[240px_1fr] lg:min-h-screen">
        <Sidebar apelidoLoja={ativa?.apelido ?? null} isSuperGestor={isSuper} />
        <div className="flex flex-col min-w-0 overflow-hidden">
          <Topbar
            user={userInfo}
            papel={papelAtivo}
            lojas={isSuper ? lojas : ativa ? [ativa] : []}
            lojaAtivaId={ativa?.id ?? null}
          />
          <main className="flex-1 overflow-auto p-10">{children}</main>
        </div>
      </div>

      {/* Mobile main — apenas <lg */}
      <main className="lg:hidden p-4 pb-24">{children}</main>
    </div>
  );
}
