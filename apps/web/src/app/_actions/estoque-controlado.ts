'use server';

import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  generateEtiquetasControladasZpl,
  type EtiquetaControladaItem,
} from '@/lib/etiqueta-zpl';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

/** Serial único e scaneável (QR da unidade). 16 hex = 64-bit. */
function gerarSerial(): string {
  return randomBytes(8).toString('hex').toUpperCase();
}

function validadeDiasPorMetodo(
  meta: { validadeCongelado: number | null; validadeResfriado: number | null; validadeAmbiente: number | null } | null,
  metodo: 'CONGELADO' | 'RESFRIADO' | 'AMBIENTE',
): number | null {
  if (!meta) return null;
  if (metodo === 'CONGELADO') return meta.validadeCongelado ?? null;
  if (metodo === 'RESFRIADO') return meta.validadeResfriado ?? null;
  return meta.validadeAmbiente ?? null;
}

async function despacharImpressao(lojaId: string, zpl: string): Promise<{ ok: true; bytes?: number } | { ok: false; status: number; error: string }> {
  const apiUrl = process.env.INTERNAL_API_URL ?? 'http://estoque-api:3001';
  const internalToken = process.env.INTERNAL_API_TOKEN ?? '';
  const res = await fetch(`${apiUrl}/argox/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
    body: JSON.stringify({ lojaId, zpl }),
    cache: 'no-store',
  });
  const body = (await res.json().catch(() => ({}))) as { bytes?: number; error?: string };
  if (!res.ok) return { ok: false, status: res.status, error: body.error ?? `api respondeu ${res.status}` };
  return { ok: true, bytes: body.bytes };
}

const gerarSchema = z.object({
  produtoId: z.string().min(1),
  qtd: z.number().int().min(1).max(500),
  metodo: z.enum(['CONGELADO', 'RESFRIADO', 'AMBIENTE']),
  origem: z.enum(['RECEBIMENTO', 'AVULSO']).default('AVULSO'),
  recebimentoItemId: z.string().min(1).optional(),
});

/**
 * Gera N etiquetas de estoque controlado (1 por unidade física), imprime via
 * Argox e só persiste se a impressão não falhar (mesmo padrão do imprimir-ws).
 */
export async function gerarEtiquetasControladas(
  input: z.infer<typeof gerarSchema>,
): Promise<ActionResult<{ total: number; bytes?: number }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });
    const parsed = gerarSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Validação inválida' };

    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: { zmartbiId: true, nome: true, razaoSocial: true, cnpj: true },
    });
    if (!loja) return { ok: false, error: 'Loja não encontrada' };
    if (!FILIAIS_ESTOQUE_CONTROLADO_SET.has(loja.zmartbiId)) {
      return { ok: false, error: 'Estoque Controlado não habilitado para esta loja' };
    }

    const produto = await prisma.produto.findFirst({
      where: { id: parsed.data.produtoId, lojaId, ativo: true },
      include: { meta: true },
    });
    if (!produto) return { ok: false, error: 'Produto não encontrado nesta loja' };

    const validadeDias = validadeDiasPorMetodo(produto.meta, parsed.data.metodo);
    const validadeAte = validadeDias ? new Date(Date.now() + validadeDias * 86_400_000) : null;
    const responsavel = user.name?.split(' ')[0] ?? user.email ?? '—';

    const seriais: string[] = [];
    const itens: EtiquetaControladaItem[] = [];
    for (let i = 0; i < parsed.data.qtd; i += 1) {
      const serial = gerarSerial();
      seriais.push(serial);
      itens.push({
        serial,
        produtoNome: produto.nome,
        cdarvprod: produto.cdarvprod,
        unidade: produto.unidade,
        metodo: parsed.data.metodo,
        validadeDias,
        responsavel,
        empresa: { razaoSocial: loja.razaoSocial, cnpj: loja.cnpj, nome: loja.nome },
      });
    }

    const zpl = generateEtiquetasControladasZpl(itens);
    const print = await despacharImpressao(lojaId, zpl);
    if (!print.ok) return { ok: false, error: print.error };

    const rows: Prisma.EtiquetaCreateManyInput[] = itens.map((it) => ({
      produtoId: produto.id,
      lojaId,
      metodo: it.metodo,
      lote: produto.cdarvprod,
      responsavel: user.name ?? user.email,
      qrPayload: it.serial,
      validadeAte,
      serial: it.serial,
      estado: 'ATIVA',
      origem: parsed.data.origem,
      recebimentoItemId: parsed.data.recebimentoItemId ?? null,
      fatorConversaoSnap: produto.fatorConversao,
      cdarvprodEstoqueSnap: produto.cdarvprodEstoque,
    }));
    await prisma.etiqueta.createMany({ data: rows });

    revalidatePath('/estoque-controlado');
    return { ok: true, data: { total: rows.length, bytes: print.bytes } };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? 'Erro interno' };
  }
}

const baixaSchema = z.object({
  seriais: z.array(z.string().min(1)).min(1).max(500),
  setorSolicitante: z.string().min(1).max(60),
  responsavelId: z.string().min(1).optional(),
  obs: z.string().max(280).optional(),
});

/**
 * Baixa (retira) etiquetas do estoque controlado. Idempotente: serial que não
 * está ATIVA é ignorado (não erra). Retorna quantas foram efetivamente baixadas.
 */
export async function baixarEtiquetas(
  input: z.infer<typeof baixaSchema>,
): Promise<ActionResult<{ baixadas: number; ignoradas: number }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    const parsed = baixaSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Validação inválida' };

    const res = await prisma.etiqueta.updateMany({
      where: { lojaId, serial: { in: parsed.data.seriais }, estado: 'ATIVA' },
      data: {
        estado: 'BAIXADA',
        baixadaEm: new Date(),
        baixadaPorId: user.id,
        setorSolicitante: parsed.data.setorSolicitante,
        baixaObs: parsed.data.obs ?? null,
      },
    });
    revalidatePath('/estoque-controlado');
    return {
      ok: true,
      data: { baixadas: res.count, ignoradas: parsed.data.seriais.length - res.count },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? 'Erro interno' };
  }
}

/** Saldo do estoque controlado: nº de etiquetas ATIVAS por produto na loja ativa. */
export async function saldoControlado(): Promise<
  ActionResult<{ produtoId: string; nome: string; cdarvprod: string; unidade: string; ativas: number }[]>
> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const grupos = await prisma.etiqueta.groupBy({
      by: ['produtoId'],
      // cdarvprodEstoqueSnap só é setado por gerarEtiquetasControladas —
      // exclui etiquetas de manipulação (lote/imprimir-ws).
      where: { lojaId, estado: 'ATIVA', cdarvprodEstoqueSnap: { not: null } },
      _count: { _all: true },
    });
    if (grupos.length === 0) return { ok: true, data: [] };
    const produtos = await prisma.produto.findMany({
      where: { id: { in: grupos.map((g) => g.produtoId) } },
      select: { id: true, nome: true, cdarvprod: true, unidade: true },
    });
    const byId = new Map(produtos.map((p) => [p.id, p]));
    const data = grupos
      .map((g) => {
        const p = byId.get(g.produtoId);
        return p
          ? { produtoId: g.produtoId, nome: p.nome, cdarvprod: p.cdarvprod, unidade: p.unidade, ativas: g._count._all }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.nome.localeCompare(b.nome));
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: (err as Error).message ?? 'Erro interno' };
  }
}
