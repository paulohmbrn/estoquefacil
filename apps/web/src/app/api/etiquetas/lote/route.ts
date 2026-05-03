// POST /api/etiquetas/lote — body: { itens: [{ produtoId, qtd, metodo, validadeDias? }] }
// Resposta: application/pdf (multipágina, 1 página por etiqueta).

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  generateEtiquetasPdf,
  etiquetaQrPayload,
  type EtiquetaItem,
  type EtiquetaFormato,
} from '@/lib/etiqueta-pdf';
import { generateEtiquetasZpl } from '@/lib/etiqueta-zpl';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  produtoId: z.string().min(1),
  qtd: z.number().int().min(1).max(200),
  metodo: z.enum(['CONGELADO', 'RESFRIADO', 'AMBIENTE']),
  validadeDias: z.number().int().min(0).max(365).optional(),
});

const bodySchema = z.object({
  itens: z.array(itemSchema).min(1).max(500),
  formato: z
    .enum(['TERMICA_60', 'TERMICA_40', 'A4_PIMACO', 'ARGOX_100X60'])
    .default('TERMICA_60'),
});

function shortId(): string {
  return randomBytes(3).toString('hex').toUpperCase(); // 6 chars
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validação', issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const produtoIds = parsed.data.itens.map((i) => i.produtoId);
    const produtos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, lojaId, ativo: true },
      include: { meta: true },
    });
    const byId = new Map(produtos.map((p) => [p.id, p]));
    const loja = await prisma.loja.findUnique({
      where: { id: lojaId },
      select: { nome: true, apelido: true, endereco: true },
    });
    if (!loja) return NextResponse.json({ error: 'Loja não encontrada' }, { status: 404 });

    const items: EtiquetaItem[] = [];
    const dbRows: Prisma.EtiquetaCreateManyInput[] = [];

    for (const it of parsed.data.itens) {
      const p = byId.get(it.produtoId);
      if (!p) continue;
      const validadeDias =
        it.validadeDias ??
        (it.metodo === 'CONGELADO'
          ? p.meta?.validadeCongelado ?? null
          : it.metodo === 'RESFRIADO'
          ? p.meta?.validadeResfriado ?? null
          : p.meta?.validadeAmbiente ?? null);
      const validadeAte = validadeDias
        ? new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000)
        : null;
      for (let i = 0; i < it.qtd; i += 1) {
        const etiquetaId = shortId();
        const qrPayload = etiquetaQrPayload({ lojaId, cdarvprod: p.cdarvprod, etiquetaId });
        items.push({
          produtoId: p.id,
          produtoNome: p.nome,
          cdarvprod: p.cdarvprod,
          unidade: p.unidade,
          metodo: it.metodo,
          loteSufixo: String(i + 1).padStart(2, '0'),
          validadeDias,
          responsavel: user.name?.split(' ')[0] ?? user.email,
          loja: { nome: loja.apelido ?? loja.nome, endereco: loja.endereco },
          etiquetaId,
          qrPayload,
        });
        dbRows.push({
          produtoId: p.id,
          lojaId,
          metodo: it.metodo,
          lote: `${p.cdarvprod}-${String(i + 1).padStart(2, '0')}`,
          responsavel: user.name ?? user.email,
          qrPayload,
          validadeAte,
          consumida: false,
        });
      }
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'Nenhuma etiqueta válida' }, { status: 400 });
    }

    const formato = parsed.data.formato;

    // Argox: gera ZPL (texto) ao invés de PDF
    if (formato === 'ARGOX_100X60') {
      const [zpl] = await Promise.all([
        Promise.resolve(generateEtiquetasZpl(items)),
        prisma.etiqueta.createMany({ data: dbRows }),
      ]);
      const filename = `etiquetas-argox-100x60-${new Date().toISOString().slice(0, 10)}-${items.length}.zpl`;
      return new Response(zpl, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const formatoPdf: EtiquetaFormato = formato;
    const [pdfBytes] = await Promise.all([
      generateEtiquetasPdf(items, formatoPdf),
      prisma.etiqueta.createMany({ data: dbRows }),
    ]);

    const tag =
      formatoPdf === 'TERMICA_60' ? 'termica60'
      : formatoPdf === 'TERMICA_40' ? 'termica40'
      : 'a4';
    const filename = `etiquetas-${tag}-${new Date().toISOString().slice(0, 10)}-${items.length}.pdf`;
    return new Response(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json(
      { error: e.message || 'Erro interno' },
      { status: 500 },
    );
  }
}
