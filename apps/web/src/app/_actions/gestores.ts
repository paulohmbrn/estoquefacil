'use server';

// Server actions usadas em /cadastros/gestores. Apenas Super Gestor.
// Operações:
//   - togglarSuperGestor: promove/rebaixa um User pra/de Super Gestor.
//   - atribuirLoja: cria UsuarioLoja como GESTOR pra um User numa loja.
//   - removerLoja: deleta UsuarioLoja (perde acesso à loja).
//   - alterarPapel: muda papel (GESTOR <-> OPERADOR) num vínculo existente.

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireSuperGestor } from '@/lib/permissions';

export type ActionResult = { ok: true } | { ok: false; error: string };

const toggleSchema = z.object({
  userId: z.string().min(1),
  superGestor: z.boolean(),
});

export async function toggleSuperGestor(input: z.infer<typeof toggleSchema>): Promise<ActionResult> {
  try {
    const me = await requireSuperGestor();
    const data = toggleSchema.parse(input);
    if (data.userId === me.id && data.superGestor === false) {
      return { ok: false, error: 'Você não pode rebaixar a si mesmo. Peça pra outro Super Gestor.' };
    }
    await prisma.user.update({
      where: { id: data.userId },
      data: { superGestor: data.superGestor },
    });
    revalidatePath('/cadastros/gestores');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const atribuirSchema = z.object({
  userId: z.string().min(1),
  lojaId: z.string().min(1),
  papel: z.enum(['GESTOR', 'OPERADOR']),
});

export async function atribuirLoja(input: z.infer<typeof atribuirSchema>): Promise<ActionResult> {
  try {
    await requireSuperGestor();
    const data = atribuirSchema.parse(input);
    await prisma.usuarioLoja.upsert({
      where: { userId_lojaId: { userId: data.userId, lojaId: data.lojaId } },
      create: { userId: data.userId, lojaId: data.lojaId, papel: data.papel, ativo: true },
      update: { papel: data.papel, ativo: true },
    });
    revalidatePath('/cadastros/gestores');
    return { ok: true };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      return { ok: false, error: 'Loja ou usuário não existe' };
    }
    return { ok: false, error: (err as Error).message };
  }
}

const removerSchema = z.object({
  vinculoId: z.string().min(1),
});

export async function removerLoja(input: z.infer<typeof removerSchema>): Promise<ActionResult> {
  try {
    await requireSuperGestor();
    const data = removerSchema.parse(input);
    await prisma.usuarioLoja.delete({ where: { id: data.vinculoId } });
    revalidatePath('/cadastros/gestores');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const papelSchema = z.object({
  vinculoId: z.string().min(1),
  papel: z.enum(['GESTOR', 'OPERADOR']),
});

export async function alterarPapel(input: z.infer<typeof papelSchema>): Promise<ActionResult> {
  try {
    await requireSuperGestor();
    const data = papelSchema.parse(input);
    await prisma.usuarioLoja.update({
      where: { id: data.vinculoId },
      data: { papel: data.papel },
    });
    revalidatePath('/cadastros/gestores');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
