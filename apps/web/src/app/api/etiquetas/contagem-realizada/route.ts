// POST /api/etiquetas/contagem-realizada — body: { contagemId }
// Gera 1 etiqueta 48×40mm POR LANÇAMENTO da contagem, com responsável,
// quantidade, validade (do ProdutoMeta), produto, loja. Despacha pro
// agente Argox da loja via WS no apps/api.

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import {
  generateEtiquetasContagemZpl,
  type EtiquetaContagem100Item,
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
} | null): { dias: number; metodo: 'RESFRIADO' | 'CONGELADO' | 'AMBIENTE' } | null {
  if (!meta) return null;
  if (meta.validadeResfriado && meta.validadeResfriado > 0)
    return { dias: meta.validadeResfriado, metodo: 'RESFRIADO' };
  if (meta.validadeCongelado && meta.validadeCongelado > 0)
    return { dias: meta.validadeCongelado, metodo: 'CONGELADO' };
  if (meta.validadeAmbiente && meta.validadeAmbiente > 0)
    return { dias: meta.validadeAmbiente, metodo: 'AMBIENTE' };
  return null;
}

function shortId(): string {
  return randomBytes(3).toString('hex').toUpperCase();
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
                cdarvprod: true,
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
    // Hora real da contagem (formato 24h, fuso de SP). Usa finalizadaEm
    // se disponível, senão iniciadaEm — único valor pra todas as etiquetas
    // do mesmo lote, mesmo as do mesmo produto contadas em momentos diferentes.
    const horaRef = c.finalizadaEm ?? c.iniciadaEm;
    const horaContagem = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'America/Sao_Paulo',
    }).format(horaRef);

    const items: EtiquetaContagem100Item[] = c.lancamentos.map((l, idx) => {
      const escolha = escolherValidadeDias(l.produto.meta);
      const validadeAte = escolha
        ? new Date(dataContagem.getTime() + escolha.dias * 24 * 60 * 60 * 1000)
        : null;
      const etiquetaId = shortId();
      return {
        produtoNome: l.produto.nome,
        cdarvprod: l.produto.cdarvprod,
        quantidade: Number(l.quantidade),
        unidade: l.produto.unidade,
        responsavel,
        dataContagem,
        horaContagem,
        validadeAte,
        lojaApelido,
        metodo: escolha?.metodo ?? 'AMBIENTE',
        etiquetaId,
        // QR contém o CDARVPROD direto (13 dígitos) — formato que o scanner
        // de contagem já reconhece nativamente. Permite bipar a etiqueta numa
        // contagem futura como atalho pra encontrar o produto.
        qrPayload: l.produto.cdarvprod,
        loteSufixo: String(idx + 1).padStart(2, '0'),
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
