'use server';

import { revalidatePath } from 'next/cache';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

const novaListaSchema = z.object({
  nome: z.string().min(2, 'Nome obrigatório'),
  icone: z.string().optional(),
  tags: z.string().optional(),
});

function newQrToken(): string {
  // 22 chars URL-safe (≈128 bits) — colisão impossível na prática
  return randomBytes(16).toString('base64url');
}

export async function createLista(formData: FormData): Promise<ActionResult<{ id: string }>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });
    const parsed = novaListaSchema.safeParse({
      nome: formData.get('nome'),
      icone: formData.get('icone') ?? undefined,
      tags: formData.get('tags') ?? undefined,
    });
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const tags = (parsed.data.tags ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const lista = await prisma.listaContagem.create({
      data: {
        nome: parsed.data.nome,
        icone: parsed.data.icone || null,
        tags,
        lojaId,
        qrToken: newQrToken(),
      },
      select: { id: true },
    });
    revalidatePath('/listas');
    return { ok: true, data: { id: lista.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateLista(
  id: string,
  patch: { nome?: string; icone?: string | null; tags?: string[] | null; ativo?: boolean },
): Promise<ActionResult> {
  try {
    const lista = await prisma.listaContagem.findUnique({ where: { id }, select: { lojaId: true } });
    if (!lista) return { ok: false, error: 'Lista não encontrada' };
    await requireGestor({ lojaId: lista.lojaId });
    await prisma.listaContagem.update({
      where: { id },
      data: {
        ...(patch.nome !== undefined ? { nome: patch.nome } : {}),
        ...(patch.icone !== undefined ? { icone: patch.icone } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags ?? [] } : {}),
        ...(patch.ativo !== undefined ? { ativo: patch.ativo } : {}),
      },
    });
    revalidatePath('/listas');
    revalidatePath(`/listas/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteLista(id: string): Promise<ActionResult> {
  try {
    const lista = await prisma.listaContagem.findUnique({ where: { id }, select: { lojaId: true } });
    if (!lista) return { ok: false, error: 'Lista não encontrada' };
    await requireGestor({ lojaId: lista.lojaId });
    await prisma.listaContagem.delete({ where: { id } });
    revalidatePath('/listas');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function addProdutoLista(listaId: string, produtoId: string): Promise<ActionResult> {
  try {
    const lista = await prisma.listaContagem.findUnique({ where: { id: listaId }, select: { lojaId: true } });
    if (!lista) return { ok: false, error: 'Lista não encontrada' };
    await requireGestor({ lojaId: lista.lojaId });
    const last = await prisma.produtoLista.findFirst({
      where: { listaId },
      orderBy: { ordem: 'desc' },
      select: { ordem: true },
    });
    await prisma.produtoLista.upsert({
      where: { produtoId_listaId: { produtoId, listaId } },
      update: {},
      create: { produtoId, listaId, ordem: (last?.ordem ?? 0) + 1 },
    });
    revalidatePath(`/listas/${listaId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeProdutoLista(listaId: string, produtoId: string): Promise<ActionResult> {
  try {
    const lista = await prisma.listaContagem.findUnique({ where: { id: listaId }, select: { lojaId: true } });
    if (!lista) return { ok: false, error: 'Lista não encontrada' };
    await requireGestor({ lojaId: lista.lojaId });
    await prisma.produtoLista.delete({
      where: { produtoId_listaId: { produtoId, listaId } },
    });
    revalidatePath(`/listas/${listaId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
