'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const startSchema = z.object({
  responsavelId: z.string().min(1),
  listaId: z.string().optional().nullable(),
});

/** Cria uma Contagem nova (status EM_ANDAMENTO) com a data de hoje na timezone Brasília. */
export async function startContagem(input: z.infer<typeof startSchema>): Promise<ActionResult<{ id: string }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    const parsed = startSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

    const responsavel = await prisma.funcionario.findUnique({
      where: { id: parsed.data.responsavelId },
      select: { id: true, lojaId: true, ativo: true },
    });
    if (!responsavel || responsavel.lojaId !== lojaId || !responsavel.ativo) {
      return { ok: false, error: 'Responsável inválido para esta loja' };
    }
    if (parsed.data.listaId) {
      const lista = await prisma.listaContagem.findUnique({
        where: { id: parsed.data.listaId },
        select: { lojaId: true },
      });
      if (!lista || lista.lojaId !== lojaId) {
        return { ok: false, error: 'Lista inválida para esta loja' };
      }
    }

    const dataContagem = todayInSaoPaulo();
    const c = await prisma.contagem.create({
      data: {
        lojaId,
        responsavelId: parsed.data.responsavelId,
        criadaPorId: user.id,
        listaId: parsed.data.listaId ?? null,
        dataContagem,
        status: 'EM_ANDAMENTO',
      },
      select: { id: true },
    });
    revalidatePath('/contagem');
    return { ok: true, data: { id: c.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const lancamentoSchema = z.object({
  contagemId: z.string().min(1),
  produtoId: z.string().min(1),
  /** delta a somar; default +1 (modo bipe). Use setQuantidade pra valor absoluto. */
  delta: z.number().default(1),
});

export async function addLancamento(input: z.infer<typeof lancamentoSchema>): Promise<ActionResult<{ quantidade: string }>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const parsed = lancamentoSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

    const guard = await ensureContagemAberta(parsed.data.contagemId, lojaId);
    if (!guard.ok) return guard;

    const produto = await prisma.produto.findUnique({
      where: { id: parsed.data.produtoId },
      select: { id: true, lojaId: true, ativo: true },
    });
    if (!produto || produto.lojaId !== lojaId || !produto.ativo) {
      return { ok: false, error: 'Produto não pertence à loja ativa ou está inativo' };
    }

    const updated = await prisma.lancamento.upsert({
      where: { contagemId_produtoId: { contagemId: parsed.data.contagemId, produtoId: parsed.data.produtoId } },
      create: {
        contagemId: parsed.data.contagemId,
        produtoId: parsed.data.produtoId,
        quantidade: new Prisma.Decimal(Math.max(0, parsed.data.delta)),
      },
      update: {
        quantidade: { increment: new Prisma.Decimal(parsed.data.delta) },
      },
      select: { quantidade: true },
    });
    revalidatePath(`/contagem/${parsed.data.contagemId}`);
    return { ok: true, data: { quantidade: updated.quantidade.toString() } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const setQtySchema = z.object({
  contagemId: z.string().min(1),
  produtoId: z.string().min(1),
  quantidade: z.number().min(0).max(999999),
});

export async function setQuantidade(input: z.infer<typeof setQtySchema>): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const parsed = setQtySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
    const guard = await ensureContagemAberta(parsed.data.contagemId, lojaId);
    if (!guard.ok) return guard;
    const produto = await prisma.produto.findUnique({
      where: { id: parsed.data.produtoId },
      select: { id: true, lojaId: true, ativo: true },
    });
    if (!produto || produto.lojaId !== lojaId || !produto.ativo) {
      return { ok: false, error: 'Produto não pertence à loja ativa ou está inativo' };
    }
    await prisma.lancamento.upsert({
      where: { contagemId_produtoId: { contagemId: parsed.data.contagemId, produtoId: parsed.data.produtoId } },
      create: {
        contagemId: parsed.data.contagemId,
        produtoId: parsed.data.produtoId,
        quantidade: new Prisma.Decimal(parsed.data.quantidade),
      },
      update: {
        quantidade: new Prisma.Decimal(parsed.data.quantidade),
      },
    });
    revalidatePath(`/contagem/${parsed.data.contagemId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeLancamento(contagemId: string, produtoId: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureContagemAberta(contagemId, lojaId);
    if (!guard.ok) return guard;
    await prisma.lancamento.deleteMany({ where: { contagemId, produtoId } });
    revalidatePath(`/contagem/${contagemId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function finalizarContagem(contagemId: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureContagemAberta(contagemId, lojaId);
    if (!guard.ok) return guard;
    await prisma.contagem.update({
      where: { id: contagemId },
      data: { status: 'FINALIZADA', finalizadaEm: new Date() },
    });
    revalidatePath('/contagem');
    revalidatePath(`/contagem/${contagemId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function cancelarContagem(contagemId: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureContagemAberta(contagemId, lojaId);
    if (!guard.ok) return guard;
    await prisma.contagem.update({
      where: { id: contagemId },
      data: { status: 'CANCELADA', finalizadaEm: new Date() },
    });
    revalidatePath('/contagem');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Apenas identifica o produto e devolve a quantidade já lançada (se houver).
 * NÃO incrementa — o client abre um modal pra digitar a quantidade exata
 * (com 3 casas decimais) e depois chama setQuantidade. */
export async function identificarProdutoPorScan(contagemId: string, scanned: string): Promise<ActionResult<{
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  quantidadeAtual: string;
}>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureContagemAberta(contagemId, lojaId);
    if (!guard.ok) return guard;

    const cleaned = scanned.trim();
    let cdarvprod: string | null = null;
    let etiquetaId: string | null = null;
    const etiquetaMatch = cleaned.match(/\/l\/e\/([A-Za-z0-9]{6,})$/);
    if (etiquetaMatch && etiquetaMatch[1]) etiquetaId = etiquetaMatch[1];
    if (!etiquetaId && /^\d{13}$/.test(cleaned)) cdarvprod = cleaned;

    if (etiquetaId) {
      const e = await prisma.etiqueta.findFirst({
        where: { lojaId, qrPayload: { contains: etiquetaId } },
        include: { produto: { select: { cdarvprod: true } } },
      });
      if (e) {
        cdarvprod = e.produto.cdarvprod;
        await prisma.etiqueta.update({ where: { id: e.id }, data: { consumida: true } }).catch(() => undefined);
      }
    }

    if (!cdarvprod) {
      return { ok: false, error: 'QR não reconhecido. Tente digitar o CDARVPROD (13 dígitos).' };
    }

    const produto = await prisma.produto.findFirst({
      where: { lojaId, cdarvprod, ativo: true },
      select: { id: true, cdarvprod: true, nome: true, unidade: true },
    });
    if (!produto) {
      return { ok: false, error: `Produto ${cdarvprod} não está no catálogo desta loja.` };
    }
    const lanc = await prisma.lancamento.findUnique({
      where: { contagemId_produtoId: { contagemId, produtoId: produto.id } },
      select: { quantidade: true },
    });
    return {
      ok: true,
      data: {
        produtoId: produto.id,
        cdarvprod: produto.cdarvprod,
        nome: produto.nome,
        unidade: produto.unidade,
        quantidadeAtual: lanc ? lanc.quantidade.toString() : '0',
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Resolve um QR escaneado; pode ser URL completa ou apenas um código.
 * Reconhece dois formatos:
 *   1. Etiqueta:  https://estoque.reismagos.com.br/l/e/<etiquetaId>
 *   2. CDARVPROD literal (13 dígitos) — fallback de digitação manual */
export async function resolverScan(contagemId: string, scanned: string): Promise<ActionResult<{
  produtoId: string;
  cdarvprod: string;
  nome: string;
  unidade: string;
  novaQuantidade: string;
}>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const guard = await ensureContagemAberta(contagemId, lojaId);
    if (!guard.ok) return guard;

    const cleaned = scanned.trim();
    let cdarvprod: string | null = null;
    let etiquetaId: string | null = null;

    // Caso 1: URL de etiqueta
    const etiquetaMatch = cleaned.match(/\/l\/e\/([A-Za-z0-9]{6,})$/);
    if (etiquetaMatch && etiquetaMatch[1]) {
      etiquetaId = etiquetaMatch[1];
    }
    // Caso 2: CDARVPROD literal
    if (!etiquetaId && /^\d{13}$/.test(cleaned)) {
      cdarvprod = cleaned;
    }

    if (etiquetaId) {
      const et = await prisma.etiqueta.findFirst({
        where: { lojaId },
        // Pega pela ID curta gerada (não temos campo dedicado; matchamos pelo qrPayload).
        // Como o id curto vai no payload, o primeiro hit é por payload contendo o id.
        // Para performance futura, poderíamos persistir um campo idCurto.
      });
      // Fallback: busca por payload contendo o id curto
      const e2 = await prisma.etiqueta.findFirst({
        where: { lojaId, qrPayload: { contains: etiquetaId } },
        include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
      });
      if (e2) {
        cdarvprod = e2.produto.cdarvprod;
        // Marca a etiqueta como consumida
        await prisma.etiqueta.update({ where: { id: e2.id }, data: { consumida: true } }).catch(() => {});
      }
      void et;
    }

    if (!cdarvprod) {
      return { ok: false, error: 'QR não reconhecido. Tente digitar o CDARVPROD (13 dígitos).' };
    }

    const produto = await prisma.produto.findFirst({
      where: { lojaId, cdarvprod, ativo: true },
      select: { id: true, cdarvprod: true, nome: true, unidade: true },
    });
    if (!produto) {
      return { ok: false, error: `Produto ${cdarvprod} não está no catálogo desta loja.` };
    }

    const updated = await prisma.lancamento.upsert({
      where: { contagemId_produtoId: { contagemId, produtoId: produto.id } },
      create: {
        contagemId, produtoId: produto.id,
        quantidade: new Prisma.Decimal(1),
      },
      update: { quantidade: { increment: new Prisma.Decimal(1) } },
      select: { quantidade: true },
    });
    revalidatePath(`/contagem/${contagemId}`);
    return {
      ok: true,
      data: {
        produtoId: produto.id,
        cdarvprod: produto.cdarvprod,
        nome: produto.nome,
        unidade: produto.unidade,
        novaQuantidade: updated.quantidade.toString(),
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// ---------- helpers ----------

async function ensureContagemAberta(
  contagemId: string,
  lojaId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const c = await prisma.contagem.findUnique({
    where: { id: contagemId },
    select: { id: true, lojaId: true, status: true },
  });
  if (!c || c.lojaId !== lojaId) return { ok: false, error: 'Contagem não encontrada para esta loja.' };
  if (c.status !== 'EM_ANDAMENTO') return { ok: false, error: `Contagem está ${c.status.toLowerCase()}.` };
  return { ok: true };
}

function todayInSaoPaulo(): Date {
  // Retorna Date com horário 00:00 UTC representando a data civil em São Paulo.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y!, (m! - 1), d!));
}
