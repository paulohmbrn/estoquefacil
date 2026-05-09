// GET /api/listas/[id]/qr-pdf — gera PDF do QR de uma Lista de Contagem
// (cartão A5 dentro de uma página A4). Apenas Gestor da loja.

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import { generateListaQrPdf } from '@/lib/lista-qr-pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const lista = await prisma.listaContagem.findUnique({
      where: { id },
      include: {
        loja: { select: { nome: true, apelido: true } },
      },
    });
    if (!lista || lista.lojaId !== lojaId) {
      return NextResponse.json({ error: 'Lista não encontrada' }, { status: 404 });
    }

    const pdf = await generateListaQrPdf({
      listaNome: lista.nome,
      lojaNome: lista.loja.apelido ?? lista.loja.nome,
      qrToken: lista.qrToken,
      responsavelImpressao: user.name ?? user.email,
    });

    const safeNome = lista.nome.replace(/[^\w]+/g, '_');
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="QR_Lista_${safeNome}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
