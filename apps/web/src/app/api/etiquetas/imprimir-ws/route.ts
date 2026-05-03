// POST /api/etiquetas/imprimir-ws — body: { itens: [...] }
// Diferente do /api/etiquetas/lote (que retorna o ZPL pro browser),
// este gera ZPL E despacha pro agente local da loja via WebSocket no apps/api.
// Browser nem precisa estar na mesma rede da impressora — só precisa estar logado.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import { etiquetaQrPayload, type EtiquetaItem } from '@/lib/etiqueta-pdf';
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
const bodySchema = z.object({ itens: z.array(itemSchema).min(1).max(500) });

function shortId(): string { return randomBytes(3).toString('hex').toUpperCase(); }

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return NextResponse.json({ error: 'Validação', issues: parsed.error.flatten() }, { status: 400 });

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
      const validadeAte = validadeDias ? new Date(Date.now() + validadeDias * 24 * 60 * 60 * 1000) : null;
      for (let i = 0; i < it.qtd; i += 1) {
        const etiquetaId = shortId();
        const qrPayload = etiquetaQrPayload({ lojaId, cdarvprod: p.cdarvprod, etiquetaId });
        items.push({
          produtoId: p.id, produtoNome: p.nome, cdarvprod: p.cdarvprod, unidade: p.unidade,
          metodo: it.metodo, loteSufixo: String(i + 1).padStart(2, '0'), validadeDias,
          responsavel: user.name?.split(' ')[0] ?? user.email,
          loja: { nome: loja.apelido ?? loja.nome, endereco: loja.endereco },
          etiquetaId, qrPayload,
        });
        dbRows.push({
          produtoId: p.id, lojaId, metodo: it.metodo,
          lote: `${p.cdarvprod}-${String(i + 1).padStart(2, '0')}`,
          responsavel: user.name ?? user.email, qrPayload, validadeAte, consumida: false,
        });
      }
    }
    if (items.length === 0) return NextResponse.json({ error: 'Nenhuma etiqueta válida' }, { status: 400 });

    const zpl = generateEtiquetasZpl(items);

    // Despacha pro apps/api (que tem o WS aberto com o agente da loja)
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
      // 503 = agente offline; outros = falha real. Não persiste etiqueta nesse caso.
      return NextResponse.json(
        { ok: false, error: printBody.error ?? `api respondeu ${printRes.status}` },
        { status: printRes.status === 503 ? 503 : 502 },
      );
    }

    // Sucesso: persiste as etiquetas no banco
    await prisma.etiqueta.createMany({ data: dbRows });

    return NextResponse.json({ ok: true, total: items.length, bytes: printBody.bytes });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message ?? 'Erro interno' }, { status: 500 });
  }
}
