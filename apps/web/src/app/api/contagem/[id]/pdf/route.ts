// GET /api/contagem/[id]/pdf — PDF A4 humano-legível da contagem.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { generateContagemPdf, type ContagemPdfData } from '@/lib/contagem-pdf';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const { lojaId } = await requireLojaAtiva();
    const c = await prisma.contagem.findUnique({
      where: { id },
      include: {
        loja: { select: { nome: true, apelido: true, zmartbiId: true } },
        responsavel: { select: { nome: true } },
        criadaPor: { select: { name: true, email: true } },
        lista: { select: { nome: true } },
        lancamentos: {
          orderBy: { produto: { nome: 'asc' } },
          include: {
            produto: {
              select: {
                cdarvprod: true,
                nome: true,
                unidade: true,
                grupo: { select: { nome: true } },
              },
            },
          },
        },
      },
    });
    if (!c || c.lojaId !== lojaId) {
      return NextResponse.json({ error: 'Contagem não encontrada' }, { status: 404 });
    }

    const data: ContagemPdfData = {
      contagemId: c.id,
      loja: c.loja,
      responsavelNome: c.responsavel.nome,
      criadaPor: c.criadaPor?.name ?? c.criadaPor?.email ?? null,
      listaNome: c.lista?.nome ?? null,
      status: c.status,
      dataContagem: c.dataContagem,
      iniciadaEm: c.iniciadaEm,
      finalizadaEm: c.finalizadaEm,
      itens: c.lancamentos.map((l) => ({
        cdarvprod: l.produto.cdarvprod,
        nome: l.produto.nome,
        grupo: l.produto.grupo?.nome ?? null,
        unidade: l.produto.unidade,
        quantidade: Number(l.quantidade),
      })),
    };

    const pdf = await generateContagemPdf(data);
    const tag = `${c.loja.zmartbiId}-${c.dataContagem.toISOString().slice(0, 10)}`;
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contagem-${tag}-${c.id.slice(0, 8)}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
