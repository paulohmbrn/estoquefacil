// GET /api/relatorios/consolidado?formato=pdf|xlsx&ids=a,b,c
// Gera relatório consolidado HUMANO (não pra ZmartBI) das contagens selecionadas.
// Apenas Gestor da loja. Validações: mesma loja, mesma data, status FINALIZADA/EXPORTADA.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  fetchConsolidado,
  generateConsolidadoPdf,
  buildConsolidadoXlsx,
} from '@/lib/relatorio-consolidado';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  formato: z.enum(['pdf', 'xlsx']),
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
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      formato: url.searchParams.get('formato'),
      ids: url.searchParams.get('ids'),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const result = await fetchConsolidado({
      contagensIds: parsed.data.ids,
      lojaId,
      exportadoPor: user.name ?? user.email,
    });
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (parsed.data.formato === 'pdf') {
      const pdf = await generateConsolidadoPdf(result.data);
      return new Response(new Uint8Array(pdf.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${pdf.filename}"`,
          'Cache-Control': 'no-store',
          'X-Row-Count': String(pdf.rowCount),
        },
      });
    }

    const xlsx = await buildConsolidadoXlsx(result.data);
    return new Response(new Uint8Array(xlsx.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${xlsx.filename}"`,
        'Cache-Control': 'no-store',
        'X-Row-Count': String(xlsx.rowCount),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
