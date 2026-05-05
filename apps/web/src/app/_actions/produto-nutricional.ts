'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor } from '@/lib/permissions';

const numField = z
  .union([z.coerce.number().min(0).max(99999), z.literal('').transform(() => null), z.null()])
  .optional()
  .nullable();

const upsertSchema = z.object({
  produtoId: z.string().min(1),
  unidadeBase: z.enum(['g', 'ml']).default('g'),
  porcaoG: numField,
  porcaoMedidaCaseira: z.string().max(80).optional().nullable(),
  porcoesEmbalagem: numField,
  categoriaRDC429: z.enum(['SOLIDO', 'LIQUIDO', 'REFEICAO_PRONTA']).default('SOLIDO'),

  valorEnergeticoKcal100: numField,
  carboidratosG100: numField,
  acucaresTotaisG100: numField,
  acucaresAdicionadosG100: numField,
  proteinasG100: numField,
  gordurasTotaisG100: numField,
  gordurasSaturadasG100: numField,
  gordurasTransG100: numField,
  fibrasG100: numField,
  sodioMg100: numField,

  ingredientes: z.string().max(2000).optional().nullable(),
  alergicos: z.string().max(500).optional().nullable(),
  modoPreparo: z.string().max(1000).optional().nullable(),
  modoConservacao: z.string().max(500).optional().nullable(),
  conteudoLiquidoPadrao: z.string().max(60).optional().nullable(),
});

export type UpsertNutricionalInput = z.infer<typeof upsertSchema>;
export type ActionResult = { ok: true } | { ok: false; error: string };

function nz<T>(v: T | null | undefined): T | null {
  return v === undefined || v === null || (typeof v === 'string' && v === '') ? null : v;
}

export async function upsertProdutoNutricional(input: UpsertNutricionalInput): Promise<ActionResult> {
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

    const payload = {
      unidadeBase: data.unidadeBase,
      porcaoG: nz(data.porcaoG) as number | null,
      porcaoMedidaCaseira: nz(data.porcaoMedidaCaseira),
      porcoesEmbalagem: nz(data.porcoesEmbalagem) as number | null,
      categoriaRDC429: data.categoriaRDC429,

      valorEnergeticoKcal100: nz(data.valorEnergeticoKcal100) as number | null,
      carboidratosG100: nz(data.carboidratosG100) as number | null,
      acucaresTotaisG100: nz(data.acucaresTotaisG100) as number | null,
      acucaresAdicionadosG100: nz(data.acucaresAdicionadosG100) as number | null,
      proteinasG100: nz(data.proteinasG100) as number | null,
      gordurasTotaisG100: nz(data.gordurasTotaisG100) as number | null,
      gordurasSaturadasG100: nz(data.gordurasSaturadasG100) as number | null,
      gordurasTransG100: nz(data.gordurasTransG100) as number | null,
      fibrasG100: nz(data.fibrasG100) as number | null,
      sodioMg100: nz(data.sodioMg100) as number | null,

      ingredientes: nz(data.ingredientes),
      alergicos: nz(data.alergicos),
      modoPreparo: nz(data.modoPreparo),
      modoConservacao: nz(data.modoConservacao),
      conteudoLiquidoPadrao: nz(data.conteudoLiquidoPadrao),
    };

    await prisma.produtoNutricional.upsert({
      where: { produtoId: data.produtoId },
      create: { produtoId: data.produtoId, ...payload },
      update: payload,
    });

    revalidatePath('/cadastros/produtos');
    revalidatePath(`/cadastros/produtos/${data.produtoId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
