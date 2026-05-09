'use server';

import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const COOKIE = 'estoque.loja_ativa';

export async function setLojaAtiva(lojaId: string): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHORIZED');
  }
  // Super Gestor pode trocar pra qualquer loja ativa; demais usuários só
  // pra lojas em que tenham UsuarioLoja ativo.
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { superGestor: true },
  });
  if (me?.superGestor) {
    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: { ativo: true },
    });
    if (!loja?.ativo) throw new Error('FORBIDDEN');
  } else {
    const link = await prisma.usuarioLoja.findUnique({
      where: { userId_lojaId: { userId: session.user.id, lojaId } },
      select: { id: true, ativo: true },
    });
    if (!link || !link.ativo) {
      throw new Error('FORBIDDEN');
    }
  }
  const jar = await cookies();
  jar.set(COOKIE, lojaId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function getLojaAtivaId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(COOKIE)?.value ?? null;
}
