// GET /api/export/contagens?ids=a,b,c
// Exporta no formato ZmartBI um consolidado das contagens selecionadas (mesma loja).
// As contagens podem ser de datas diferentes — DTLANCESTQ e nome do arquivo usam a
// MENOR dataContagem do conjunto. Apenas Gestor da loja ativa.
// Marca as contagens FINALIZADAS como EXPORTADAS (idempotente).

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import { fetchContagensSelecionadas, marcarContagensComoExportadas } from '@/lib/export-data';
import { buildContagemXlsx } from '@/lib/export-xlsx';
import { cdAlmoxarifePorFilial } from '@estoque/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1)).min(1).max(50)),
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const { lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({ ids: url.searchParams.get('ids') });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const result = await fetchContagensSelecionadas({ contagensIds: parsed.data.ids, lojaId });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (result.lancamentos.length === 0) {
      return NextResponse.json({ error: 'Nenhum lançamento nas contagens selecionadas' }, { status: 400 });
    }

    const xlsx = await buildContagemXlsx(result.meta.cdFilial, result.lancamentos, {
      dataPreferida: result.meta.dataLancamento,
      cdAlmoxarife: cdAlmoxarifePorFilial(result.meta.cdFilial),
    });
    await marcarContagensComoExportadas(result.meta.contagensIds);

    return new Response(new Uint8Array(xlsx.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsx.filename}"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(xlsx.rowCount),
        'X-Contagens-Consolidadas': String(result.meta.contagensIds.length),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
