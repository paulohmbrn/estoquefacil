// GET /api/export/contagem/[id] — exporta uma única contagem como xlsx.
// Apenas Gestor da loja da contagem pode baixar.
// Marca status como EXPORTADA (idempotente — se já estiver, mantém).

import { NextResponse, type NextRequest } from 'next/server';
import { requireGestor } from '@/lib/permissions';
import { fetchContagemUnica, marcarContagensComoExportadas } from '@/lib/export-data';
import { buildContagemXlsx } from '@/lib/export-xlsx';
import { cdAlmoxarifePorFilial } from '@estoque/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  try {
    const { id } = await ctx.params;
    const data = await fetchContagemUnica(id);
    if (!data) return NextResponse.json({ error: 'Contagem não encontrada' }, { status: 404 });
    if (data.meta.status === 'CANCELADA') {
      return NextResponse.json({ error: 'Contagem cancelada não pode ser exportada' }, { status: 400 });
    }
    if (data.meta.status === 'EM_ANDAMENTO') {
      return NextResponse.json({ error: 'Finalize a contagem antes de exportar' }, { status: 400 });
    }
    await requireGestor({ lojaId: data.meta.lojaId });
    if (data.lancamentos.length === 0) {
      return NextResponse.json({ error: 'Contagem sem lançamentos' }, { status: 400 });
    }

    const result = await buildContagemXlsx(data.meta.cdFilial, data.lancamentos, {
      cdAlmoxarife: cdAlmoxarifePorFilial(data.meta.cdFilial),
    });
    if (data.meta.status === 'FINALIZADA') {
      await marcarContagensComoExportadas([data.meta.id]);
    }

    return new Response(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(result.rowCount),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
