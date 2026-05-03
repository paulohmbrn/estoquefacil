'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const startSchema = z.object({
  responsavelId: z.string().min(1),
  fornecedor: z.string().optional(),
  numeroNf: z.string().optional(),
  observacoes: z.string().optional(),
});

function todayInSaoPaulo(): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y!, (m! - 1), d!));
}

export async function startRecebimento(input: z.infer<typeof startSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const responsavel = await prisma.funcionario.findUnique({
      where: { id: parsed.data.responsavelId },
      select: { lojaId: true, ativo: true },
    });
    if (!responsavel || responsavel.lojaId !== lojaId || !responsavel.ativo) {
      return { ok: false, error: 'Responsável inválido' };
    }
    const r = await prisma.recebimento.create({
      data: {
        lojaId,
        responsavelId: parsed.data.responsavelId,
        criadaPorId: user.id,
        dataRecebimento: todayInSaoPaulo(),
        fornecedor: parsed.data.fornecedor?.trim() || null,
        numeroNf: parsed.data.numeroNf?.trim() || null,
        observacoes: parsed.data.observacoes?.trim() || null,
        status: 'EM_ANDAMENTO',
      },
      select: { id: true },
    });
    revalidatePath('/recebimento');
    return { ok: true, data: { id: r.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

async function ensureRecebimentoAberto(id: string, lojaId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await prisma.recebimento.findUnique({ where: { id }, select: { lojaId: true, status: true } });
  if (!r || r.lojaId !== lojaId) return { ok: false, error: 'Recebimento não encontrado' };
  if (r.status !== 'EM_ANDAMENTO') return { ok: false, error: `Recebimento está ${r.status.toLowerCase()}` };
  return { ok: true };
}

export async function setItemQuantidade(
  recebimentoId: string,
  produtoId: string,
  quantidade: number,
  descricaoNf?: string,
): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(recebimentoId, lojaId);
    if (!guard.ok) return guard;
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { lojaId: true, ativo: true },
    });
    if (!produto || produto.lojaId !== lojaId || !produto.ativo) {
      return { ok: false, error: 'Produto inválido' };
    }
    if (quantidade <= 0) {
      await prisma.recebimentoItem.deleteMany({ where: { recebimentoId, produtoId } });
    } else {
      await prisma.recebimentoItem.upsert({
        where: { recebimentoId_produtoId: { recebimentoId, produtoId } },
        create: {
          recebimentoId,
          produtoId,
          quantidade: new Prisma.Decimal(quantidade),
          descricaoNf: descricaoNf ?? null,
        },
        update: {
          quantidade: new Prisma.Decimal(quantidade),
          ...(descricaoNf ? { descricaoNf } : {}),
        },
      });
    }
    revalidatePath(`/recebimento/${recebimentoId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function identificarProdutoRecebimento(
  recebimentoId: string,
  scanned: string,
): Promise<ActionResult<{
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  quantidadeAtual: string;
}>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(recebimentoId, lojaId);
    if (!guard.ok) return guard;
    const cleaned = scanned.trim();
    let cdarvprod: string | null = null;
    if (/^\d{13}$/.test(cleaned)) cdarvprod = cleaned;
    const etMatch = cleaned.match(/\/l\/e\/([A-Za-z0-9]{6,})$/);
    if (!cdarvprod && etMatch && etMatch[1]) {
      const e = await prisma.etiqueta.findFirst({
        where: { lojaId, qrPayload: { contains: etMatch[1] } },
        include: { produto: { select: { cdarvprod: true } } },
      });
      if (e) cdarvprod = e.produto.cdarvprod;
    }
    if (!cdarvprod) return { ok: false, error: 'QR não reconhecido. Tente o CDARVPROD (13 dígitos).' };
    const produto = await prisma.produto.findFirst({
      where: { lojaId, cdarvprod, ativo: true },
      select: { id: true, cdarvprod: true, nome: true, unidade: true },
    });
    if (!produto) return { ok: false, error: `Produto ${cdarvprod} não está no catálogo desta loja.` };
    const item = await prisma.recebimentoItem.findUnique({
      where: { recebimentoId_produtoId: { recebimentoId, produtoId: produto.id } },
      select: { quantidade: true },
    });
    return {
      ok: true,
      data: {
        produtoId: produto.id,
        cdarvprod: produto.cdarvprod,
        nome: produto.nome,
        unidade: produto.unidade,
        quantidadeAtual: item ? item.quantidade.toString() : '0',
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function finalizarRecebimento(id: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(id, lojaId);
    if (!guard.ok) return guard;
    await prisma.recebimento.update({
      where: { id },
      data: { status: 'FINALIZADO', finalizadaEm: new Date() },
    });
    revalidatePath('/recebimento');
    revalidatePath(`/recebimento/${id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cancelarRecebimento(id: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(id, lojaId);
    if (!guard.ok) return guard;
    await prisma.recebimento.update({
      where: { id },
      data: { status: 'CANCELADO', finalizadaEm: new Date() },
    });
    revalidatePath('/recebimento');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ============================================================
// IA - leitura de NF via foto (Anthropic Vision)
// ============================================================
//
// Espera ANTHROPIC_API_KEY no env. Se não tiver, retorna 'AI_NOT_CONFIGURED'.
// Recebe a imagem como base64 (data URL), envia pra Claude com prompt JSON-only,
// parseia resposta e tenta dar match com produtos da loja:
//   1. ProdutoFornecedorMap (descrição+fornecedor já mapeada antes)
//   2. Match exato por CDARVPROD (raro vir na NF)
//   3. Match fuzzy por nome (similaridade Postgres ILIKE com palavras)
// Retorna lista de itens — alguns com produtoId resolvido, outros com options[]
// pro user resolver manualmente.

export type IaItemResultado = {
  descricaoNf: string;
  quantidade: number;
  unidadeNf: string | null;
  // Se resolvido:
  produtoId?: string;
  produtoNome?: string;
  produtoUnidade?: string;
  // Se ambíguo:
  candidatos: Array<{ id: string; cdarvprod: string; nome: string; unidade: string }>;
};

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } };

type AnthropicResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
};

const aiSchema = z.object({
  itens: z.array(
    z.object({
      descricao: z.string(),
      quantidade: z.number().nullable().optional(),
      unidade: z.string().nullable().optional(),
    }),
  ),
});

export async function processarNfComIa(
  recebimentoId: string,
  imageBase64DataUrl: string,
): Promise<ActionResult<{ items: IaItemResultado[]; rawCount: number }>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(recebimentoId, lojaId);
    if (!guard.ok) return guard;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: 'AI_NOT_CONFIGURED' };
    }

    const m = imageBase64DataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!m) return { ok: false, error: 'Imagem inválida (esperado data URL base64).' };
    const mediaType = m[1]!;
    const base64 = m[2]!;

    const recebimento = await prisma.recebimento.findUnique({
      where: { id: recebimentoId },
      select: { fornecedor: true },
    });
    const fornecedor = (recebimento?.fornecedor ?? '').toLowerCase().trim();

    const content: AnthropicContent[] = [
      {
        type: 'image',
        source: { type: 'base64', media_type: mediaType, data: base64 },
      },
      {
        type: 'text',
        text: [
          'Esta é a imagem de uma nota fiscal de fornecedor de alimentos.',
          'Extraia TODOS os itens da NF e devolva APENAS um JSON válido neste formato exato (sem markdown, sem comentários):',
          '{ "itens": [ { "descricao": "string", "quantidade": número, "unidade": "KG|UN|CX|..." } ] }',
          'Regras:',
          '- "descricao" é o nome do produto como aparece na NF (sem cortar).',
          '- "quantidade" é número (use ponto pra decimal). Se não souber, null.',
          '- "unidade" deve ser uma sigla curta (KG, UN, CX, LT, PC, etc). Se não souber, null.',
          '- Ignore impostos, descontos, totais — só itens.',
        ].join(' '),
      },
    ];

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        messages: [{ role: 'user', content }],
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`Anthropic HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as AnthropicResponse;
    const text = json.content?.find((c) => c.type === 'text')?.text ?? '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Resposta da IA sem JSON.');
    const parsed = aiSchema.safeParse(JSON.parse(jsonMatch[0]));
    if (!parsed.success) throw new Error('JSON da IA inválido: ' + parsed.error.message);

    // Match para cada item
    const out: IaItemResultado[] = [];
    for (const it of parsed.data.itens) {
      const descNorm = it.descricao.toLowerCase().trim();
      const qty = typeof it.quantidade === 'number' ? it.quantidade : 0;
      const item: IaItemResultado = {
        descricaoNf: it.descricao,
        quantidade: qty,
        unidadeNf: it.unidade ?? null,
        candidatos: [],
      };

      // 1) Mapeamento prévio
      if (fornecedor) {
        const mapped = await prisma.produtoFornecedorMap.findUnique({
          where: {
            lojaId_fornecedor_descricaoNf: {
              lojaId,
              fornecedor,
              descricaoNf: descNorm,
            },
          },
          include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
        });
        if (mapped) {
          item.produtoId = mapped.produto.id;
          item.produtoNome = mapped.produto.nome;
          item.produtoUnidade = mapped.produto.unidade;
          out.push(item);
          continue;
        }
      }

      // 2) Match fuzzy: pega palavras significativas e busca por contains
      const palavras = descNorm
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^\d/.test(w));
      const candidatos = await prisma.produto.findMany({
        where: {
          lojaId,
          ativo: true,
          OR: palavras.length > 0
            ? palavras.slice(0, 3).map((p) => ({ nome: { contains: p, mode: 'insensitive' as const } }))
            : [{ nome: { contains: descNorm, mode: 'insensitive' as const } }],
        },
        take: 6,
        orderBy: { nome: 'asc' },
        select: { id: true, cdarvprod: true, nome: true, unidade: true },
      });
      item.candidatos = candidatos;
      // Match único de alta confiança = todas palavras dão match
      if (candidatos.length === 1 && palavras.length >= 2) {
        const nome = candidatos[0]!.nome.toLowerCase();
        const allMatch = palavras.every((p) => nome.includes(p));
        if (allMatch) {
          item.produtoId = candidatos[0]!.id;
          item.produtoNome = candidatos[0]!.nome;
          item.produtoUnidade = candidatos[0]!.unidade;
        }
      }
      out.push(item);
    }

    await prisma.recebimento.update({
      where: { id: recebimentoId },
      data: { iaProcessadoEm: new Date() },
    });
    return { ok: true, data: { items: out, rawCount: parsed.data.itens.length } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function aplicarMapeamentoFornecedor(
  recebimentoId: string,
  descricaoNf: string,
  produtoId: string,
): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureRecebimentoAberto(recebimentoId, lojaId);
    if (!guard.ok) return guard;
    const recebimento = await prisma.recebimento.findUnique({
      where: { id: recebimentoId },
      select: { fornecedor: true },
    });
    const fornecedor = (recebimento?.fornecedor ?? '').toLowerCase().trim();
    if (!fornecedor) {
      return { ok: false, error: 'Recebimento sem fornecedor — não dá pra mapear.' };
    }
    await prisma.produtoFornecedorMap.upsert({
      where: {
        lojaId_fornecedor_descricaoNf: {
          lojaId,
          fornecedor,
          descricaoNf: descricaoNf.toLowerCase().trim(),
        },
      },
      create: {
        lojaId,
        fornecedor,
        descricaoNf: descricaoNf.toLowerCase().trim(),
        produtoId,
      },
      update: {
        produtoId,
        vezesUsado: { increment: 1 },
      },
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
