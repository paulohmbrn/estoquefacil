// GET /api/export/dia?lojaId=...&data=YYYY-MM-DD&incluirEmAndamento=0|1
// Exporta consolidado de TODAS as contagens da loja+data informada.
// Agrega QTTOTLANCTO por (CDARVPROD, DTLANCESTQ).

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireGestor } from '@/lib/permissions';
import {
  fetchContagensDoDia,
  marcarContagensComoExportadas,
} from '@/lib/export-data';
import { buildContagemXlsx } from '@/lib/export-xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  lojaId: z.string().min(1),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  incluirEmAndamento: z.enum(['0', '1']).optional().default('0'),
});

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'parametros inválidos' }, { status: 400 });
    }
    const { lojaId, data, incluirEmAndamento } = parsed.data;
    await requireGestor({ lojaId });

    const [y, m, d] = data.split('-').map(Number);
    const dataContagem = new Date(Date.UTC(y!, (m! - 1), d!));

    const result = await fetchContagensDoDia({
      lojaId,
      dataContagem,
      incluirEmAndamento: incluirEmAndamento === '1',
    });
    if (!result) {
      return NextResponse.json({ error: 'Sem contagens nesta data pra esta loja' }, { status: 404 });
    }
    if (result.lancamentos.length === 0) {
      return NextResponse.json({ error: 'Sem lançamentos na data' }, { status: 400 });
    }

    const xlsx = await buildContagemXlsx(result.meta.cdFilial, result.lancamentos, {
      dataPreferida: dataContagem,
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
