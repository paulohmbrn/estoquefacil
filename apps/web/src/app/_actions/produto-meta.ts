'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor } from '@/lib/permissions';

const metodoEnum = z.enum(['congelado', 'resfriado', 'ambiente']);

const upsertSchema = z.object({
  produtoId: z.string().min(1),
  fotoUrl: z.string().url().optional().nullable(),
  validadeResfriado: z.coerce.number().int().min(0).max(365).optional().nullable(),
  validadeCongelado: z.coerce.number().int().min(0).max(365).optional().nullable(),
  validadeAmbiente: z.coerce.number().int().min(0).max(365).optional().nullable(),
  metodos: z.array(metodoEnum).default([]),
  observacoes: z.string().max(500).optional().nullable(),
});

export type ActionResult = { ok: true } | { ok: false; error: string };

function nz<T>(v: T | null | undefined): T | null {
  return v === undefined || v === null || (typeof v === 'string' && v === '')
    ? null
    : v;
}

export async function upsertProdutoMeta(input: z.infer<typeof upsertSchema>): Promise<ActionResult> {
  try {
    const parsed = upsertSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const data = parsed.data;

    const produto = await prisma.produto.findUnique({
      where: { id: data.produtoId },
      select: { id: true, lojaId: true },
    });
    if (!produto) return { ok: false, error: 'Produto não encontrado' };
    await requireGestor({ lojaId: produto.lojaId });

    await prisma.produtoMeta.upsert({
      where: { produtoId: data.produtoId },
      create: {
        produtoId: data.produtoId,
        fotoUrl: nz(data.fotoUrl),
        validadeResfriado: nz(data.validadeResfriado),
        validadeCongelado: nz(data.validadeCongelado),
        validadeAmbiente: nz(data.validadeAmbiente),
        metodos: data.metodos,
        observacoes: nz(data.observacoes),
      },
      update: {
        fotoUrl: nz(data.fotoUrl),
        validadeResfriado: nz(data.validadeResfriado),
        validadeCongelado: nz(data.validadeCongelado),
        validadeAmbiente: nz(data.validadeAmbiente),
        metodos: data.metodos,
        observacoes: nz(data.observacoes),
      },
    });

    revalidatePath('/cadastros/produtos');
    revalidatePath(`/cadastros/produtos/${data.produtoId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
