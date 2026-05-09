// POST /api/etiquetas/contagem-realizada — body: { contagemId }
// Gera 1 etiqueta 48×40mm POR LANÇAMENTO da contagem, com responsável,
// quantidade, validade (do ProdutoMeta), produto, loja. Despacha pro
// agente Argox da loja via WS no apps/api.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  generateEtiquetasContagemZpl,
  type EtiquetaContagemItem,
} from '@/lib/etiqueta-zpl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  contagemId: z.string().min(1),
});

/** Pega a primeira validade não-nula do ProdutoMeta na ordem
 *  resfriado → congelado → ambiente. Retorna null se nenhuma cadastrada. */
function escolherValidadeDias(meta: {
  validadeResfriado: number | null;
  validadeCongelado: number | null;
  validadeAmbiente: number | null;
} | null): number | null {
  if (!meta) return null;
  if (meta.validadeResfriado && meta.validadeResfriado > 0) return meta.validadeResfriado;
  if (meta.validadeCongelado && meta.validadeCongelado > 0) return meta.validadeCongelado;
  if (meta.validadeAmbiente && meta.validadeAmbiente > 0) return meta.validadeAmbiente;
  return null;
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validação', issues: parsed.error.flatten() }, { status: 400 });
    }

    const c = await prisma.contagem.findUnique({
      where: { id: parsed.data.contagemId },
      include: {
        loja: { select: { id: true, nome: true, apelido: true } },
        responsavel: { select: { nome: true } },
        lancamentos: {
          include: {
            produto: {
              select: {
                nome: true,
                unidade: true,
                meta: {
                  select: {
                    validadeResfriado: true,
                    validadeCongelado: true,
                    validadeAmbiente: true,
                  },
                },
              },
            },
          },
          orderBy: { produto: { nome: 'asc' } },
        },
      },
    });
    if (!c || c.lojaId !== lojaId) {
      return NextResponse.json({ error: 'Contagem não encontrada' }, { status: 404 });
    }
    if (c.status !== 'FINALIZADA' && c.status !== 'EXPORTADA') {
      return NextResponse.json(
        { error: 'Apenas contagens Finalizadas/Exportadas geram etiquetas.' },
        { status: 400 },
      );
    }
    if (c.lancamentos.length === 0) {
      return NextResponse.json({ error: 'Contagem sem lançamentos.' }, { status: 400 });
    }

    const dataContagem = c.dataContagem;
    const lojaApelido = c.loja.apelido ?? c.loja.nome;
    const responsavel = c.responsavel.nome;

    const items: EtiquetaContagemItem[] = c.lancamentos.map((l) => {
      const dias = escolherValidadeDias(l.produto.meta);
      const validadeAte = dias
        ? new Date(dataContagem.getTime() + dias * 24 * 60 * 60 * 1000)
        : null;
      return {
        produtoNome: l.produto.nome,
        quantidade: Number(l.quantidade),
        unidade: l.produto.unidade,
        responsavel,
        dataContagem,
        validadeAte,
        lojaApelido,
      };
    });

    const zpl = generateEtiquetasContagemZpl(items);

    const apiUrl = process.env.INTERNAL_API_URL ?? 'http://estoque-api:3001';
    const internalToken = process.env.INTERNAL_API_TOKEN ?? '';
    const printRes = await fetch(`${apiUrl}/argox/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Internal-Token': internalToken },
      body: JSON.stringify({ lojaId, zpl }),
      cache: 'no-store',
    });
    const printBody = await printRes.json().catch(() => ({}));

    if (!printRes.ok) {
      return NextResponse.json(
        { ok: false, error: printBody.error ?? `api respondeu ${printRes.status}` },
        { status: printRes.status === 503 ? 503 : 502 },
      );
    }

    return NextResponse.json({ ok: true, total: items.length, bytes: printBody.bytes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Erro interno' }, { status: 500 });
  }
}
