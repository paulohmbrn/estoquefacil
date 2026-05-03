// GET /api/search/produtos?q=...
// Busca produtos da loja ativa por nome OU CDARVPROD. Retorna até 8 resultados.
// Por padrão filtra apenas SKUs de estoque (cdarvprod terminando em "00").
// Pra incluir não-SKU (preparações/receitas), passe stock=0.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';

export const runtime = 'nodejs';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const onlyStock = url.searchParams.get('stock') !== '0';
    if (q.length < 2) {
      return NextResponse.json({ produtos: [] });
    }
    const produtos = await prisma.produto.findMany({
      where: {
        lojaId,
        ativo: true,
        ...(onlyStock ? { cdarvprod: { endsWith: '00' } } : {}),
        OR: [
          { nome: { contains: q, mode: 'insensitive' } },
          { cdarvprod: { contains: q } },
          { cdProduto: { contains: q } },
        ],
      },
      take: 8,
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        cdarvprod: true,
        nome: true,
        unidade: true,
        grupo: { select: { nome: true } },
      },
    });
    return NextResponse.json({
      produtos: produtos.map((p) => ({
        id: p.id,
        cdarvprod: p.cdarvprod,
        nome: p.nome,
        unidade: p.unidade,
        grupo: p.grupo?.nome ?? null,
      })),
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
