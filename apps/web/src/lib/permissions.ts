// Helpers para checagem de sessão e papel — usados em Server Components e Server Actions.

import { redirect } from 'next/navigation';
import { auth } from './auth';
import { prisma } from './db';
import { getLojaAtivaId } from '@/app/_actions/loja-ativa';

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

export class UnauthorizedError extends Error {
  constructor() {
    super('UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}
export class ForbiddenError extends Error {
  constructor(reason = 'FORBIDDEN') {
    super(reason);
    this.name = 'ForbiddenError';
  }
}

export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    redirect('/login');
  }
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
  };
}

/** Garante que o user tem o papel `GESTOR` em ao menos uma loja (ou na loja ativa, se passada). */
export async function requireGestor(opts?: { lojaId?: string }): Promise<SessionUser> {
  const user = await requireUser();
  const where = opts?.lojaId
    ? { userId: user.id, lojaId: opts.lojaId, papel: 'GESTOR' as const, ativo: true }
    : { userId: user.id, papel: 'GESTOR' as const, ativo: true };
  const link = await prisma.usuarioLoja.findFirst({ where });
  if (!link) {
    throw new ForbiddenError('Apenas Gestor pode realizar essa ação.');
  }
  return user;
}

/** Resolve a loja ativa do user (cookie + fallback pra primeira loja vinculada).
 * Se o user ainda não tem nenhum vínculo, redireciona pra `/` (que renderiza
 * a UI de bootstrap para reclamar Gestor de uma loja sem dono). */
export async function requireLojaAtiva(): Promise<{ user: SessionUser; lojaId: string; papel: 'GESTOR' | 'OPERADOR' }> {
  const user = await requireUser();
  const cookieId = await getLojaAtivaId();
  const links = await prisma.usuarioLoja.findMany({
    where: { userId: user.id, ativo: true, loja: { ativo: true } },
    orderBy: { loja: { zmartbiId: 'asc' } },
    select: { lojaId: true, papel: true },
  });
  if (links.length === 0) {
    redirect('/');
  }
  const ativa = links.find((l) => l.lojaId === cookieId) ?? links[0]!;
  return { user, lojaId: ativa.lojaId, papel: ativa.papel };
}
