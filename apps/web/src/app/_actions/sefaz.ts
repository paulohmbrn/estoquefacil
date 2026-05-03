'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireGestor, requireLojaAtiva } from '@/lib/permissions';
import { sefazQueue } from '@/lib/queue';
import { parseNfeXml } from './sefaz-nfe-parse';

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

export async function dispatchSefazSync(): Promise<ActionResult<{ jobId: string }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    await requireGestor({ lojaId });
    const job = await sefazQueue.add(
      'sefaz-sync-manual',
      { kind: 'manual', userId: user.id },
      {
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 50 },
        deduplication: { id: `sefaz-${user.id}`, ttl: 60_000 },
      },
    );
    revalidatePath('/recebimento');
    revalidatePath('/recebimento/nfs-pendentes');
    return { ok: true, data: { jobId: String(job.id) } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Cria um Recebimento a partir de uma NotaFiscalImportada já baixada,
 *  fazendo auto-match dos itens pra Produto da loja. */
export async function criarRecebimentoFromNf(
  notaId: string,
  responsavelId: string,
): Promise<ActionResult<{ recebimentoId: string; itensMatched: number; itensNaoMatched: number }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    const nota = await prisma.notaFiscalImportada.findUnique({
      where: { id: notaId },
    });
    if (!nota || nota.lojaId !== lojaId) return { ok: false, error: 'NF não encontrada' };
    if (nota.status !== 'PENDENTE') return { ok: false, error: `NF está ${nota.status}` };
    if (nota.schemaTipo !== 'procNFe') {
      return { ok: false, error: 'NF ainda não tem XML completo (só resumo). Aguarde próximo sync.' };
    }
    const responsavel = await prisma.funcionario.findUnique({
      where: { id: responsavelId },
      select: { lojaId: true, ativo: true },
    });
    if (!responsavel || responsavel.lojaId !== lojaId || !responsavel.ativo) {
      return { ok: false, error: 'Responsável inválido' };
    }

    const { itens } = parseNfeXml(nota.xmlOriginal);

    // Match estratégia:
    // 1. cEAN (GTIN) → Produto.cdarvprod direto se bater (raro, mas tenta)
    // 2. cProd → ProdutoFornecedorMap (descricaoNf=cProd, fornecedor=cnpj)
    // 3. xProd → ProdutoFornecedorMap (descricaoNf normalizada)
    // 4. xProd → fuzzy ILIKE (palavras significativas)
    let matched = 0;
    let naoMatched = 0;

    const itensRows: Prisma.RecebimentoItemCreateManyInput[] = [];
    const fornecedorNorm = (nota.emissorCnpj ?? '').toLowerCase().trim();

    for (const it of itens) {
      let produtoId: string | null = null;

      // 1) Mapeamento prévio por descrição da NF (xProd)
      if (fornecedorNorm) {
        const map = await prisma.produtoFornecedorMap.findUnique({
          where: {
            lojaId_fornecedor_descricaoNf: {
              lojaId,
              fornecedor: fornecedorNorm,
              descricaoNf: it.xProd.toLowerCase().trim(),
            },
          },
          select: { produtoId: true },
        });
        if (map) produtoId = map.produtoId;
      }

      // 2) cProd como mapeamento alternativo
      if (!produtoId && fornecedorNorm && it.cProd) {
        const map = await prisma.produtoFornecedorMap.findUnique({
          where: {
            lojaId_fornecedor_descricaoNf: {
              lojaId,
              fornecedor: fornecedorNorm,
              descricaoNf: `cprod:${it.cProd}`,
            },
          },
          select: { produtoId: true },
        });
        if (map) produtoId = map.produtoId;
      }

      // 3) Match exato por cdarvprod (raro)
      if (!produtoId && /^\d{13}$/.test(it.cProd)) {
        const p = await prisma.produto.findFirst({
          where: { lojaId, cdarvprod: it.cProd, ativo: true },
          select: { id: true },
        });
        if (p) produtoId = p.id;
      }

      if (produtoId) {
        itensRows.push({
          recebimentoId: '__placeholder__', // substitui no createMany abaixo
          produtoId,
          quantidade: new Prisma.Decimal(it.qCom),
          descricaoNf: it.xProd,
        });
        matched += 1;
      } else {
        naoMatched += 1;
      }
    }

    const recebimento = await prisma.recebimento.create({
      data: {
        lojaId,
        responsavelId,
        criadaPorId: user.id,
        dataRecebimento: nota.dataEmissao ?? new Date(),
        fornecedor: nota.emissorNome,
        numeroNf: nota.numeroNf,
        status: 'EM_ANDAMENTO',
        observacoes: `Importado da NFe ${nota.chaveAcesso}. ${matched} matched, ${naoMatched} sem match.`,
      },
      select: { id: true },
    });

    if (itensRows.length > 0) {
      await prisma.recebimentoItem.createMany({
        data: itensRows.map((r) => ({ ...r, recebimentoId: recebimento.id })),
      });
    }

    await prisma.notaFiscalImportada.update({
      where: { id: notaId },
      data: { status: 'RECEBIDA', recebimentoId: recebimento.id, processadoEm: new Date() },
    });

    revalidatePath('/recebimento');
    revalidatePath('/recebimento/nfs-pendentes');
    return {
      ok: true,
      data: { recebimentoId: recebimento.id, itensMatched: matched, itensNaoMatched: naoMatched },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Preview pra tela de preparação: lista TODOS os itens da NF com sugestão de match. */
export type PreviewItem = {
  cProd: string;
  xProd: string;
  cEAN: string | null;
  uCom: string;
  qCom: number;
  vProd: number;
  sugestaoProdutoId: string | null;
  sugestaoSource: 'map' | 'map-cprod' | 'cdarvprod' | null;
  // Fator de conversão NF → estoque vindo do mapa anterior (1 quando não há mapa).
  // Usado pra pré-preencher a quantidade no estoque: qtdEstoque = qCom × fator.
  sugestaoFator: number;
};

export type PreviewNota = {
  id: string;
  chaveAcesso: string;
  numeroNf: string | null;
  serieNf: string | null;
  emissorNome: string | null;
  emissorCnpj: string | null;
  dataEmissao: string | null;
  valorTotal: number | null;
  qtdItens: number | null;
};

export async function previewRecebimentoFromNf(
  notaId: string,
): Promise<ActionResult<{ nota: PreviewNota; itens: PreviewItem[] }>> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const nota = await prisma.notaFiscalImportada.findUnique({ where: { id: notaId } });
    if (!nota || nota.lojaId !== lojaId) return { ok: false, error: 'NF não encontrada' };
    if (nota.schemaTipo !== 'procNFe') {
      return { ok: false, error: 'NF ainda não tem XML completo (só resumo). Aguarde próximo sync.' };
    }

    const { itens } = parseNfeXml(nota.xmlOriginal);
    const fornecedorNorm = (nota.emissorCnpj ?? '').toLowerCase().trim();

    const previewItens: PreviewItem[] = [];
    for (const it of itens) {
      let sugestaoProdutoId: string | null = null;
      let source: PreviewItem['sugestaoSource'] = null;
      let sugestaoFator = 1;

      if (fornecedorNorm) {
        const map = await prisma.produtoFornecedorMap.findUnique({
          where: {
            lojaId_fornecedor_descricaoNf: {
              lojaId,
              fornecedor: fornecedorNorm,
              descricaoNf: it.xProd.toLowerCase().trim(),
            },
          },
          select: { produtoId: true, fatorConversao: true },
        });
        if (map) { sugestaoProdutoId = map.produtoId; source = 'map'; sugestaoFator = Number(map.fatorConversao); }
      }
      if (!sugestaoProdutoId && fornecedorNorm && it.cProd) {
        const map = await prisma.produtoFornecedorMap.findUnique({
          where: {
            lojaId_fornecedor_descricaoNf: {
              lojaId,
              fornecedor: fornecedorNorm,
              descricaoNf: `cprod:${it.cProd}`,
            },
          },
          select: { produtoId: true, fatorConversao: true },
        });
        if (map) { sugestaoProdutoId = map.produtoId; source = 'map-cprod'; sugestaoFator = Number(map.fatorConversao); }
      }
      // Match exato por cdarvprod, restrito a SKU de estoque (terminando em "00")
      if (!sugestaoProdutoId && /^\d{13}$/.test(it.cProd) && it.cProd.endsWith('00')) {
        const p = await prisma.produto.findFirst({
          where: { lojaId, cdarvprod: it.cProd, ativo: true },
          select: { id: true },
        });
        if (p) { sugestaoProdutoId = p.id; source = 'cdarvprod'; }
      }

      previewItens.push({
        cProd: it.cProd,
        xProd: it.xProd,
        cEAN: it.cEAN ?? null,
        uCom: it.uCom,
        qCom: it.qCom,
        vProd: it.vProd,
        sugestaoProdutoId,
        sugestaoSource: source,
        sugestaoFator: sugestaoFator > 0 ? sugestaoFator : 1,
      });
    }

    return {
      ok: true,
      data: {
        nota: {
          id: nota.id,
          chaveAcesso: nota.chaveAcesso,
          numeroNf: nota.numeroNf,
          serieNf: nota.serieNf,
          emissorNome: nota.emissorNome,
          emissorCnpj: nota.emissorCnpj,
          dataEmissao: nota.dataEmissao?.toISOString() ?? null,
          valorTotal: nota.valorTotal ? Number(nota.valorTotal) : null,
          qtdItens: nota.qtdItens,
        },
        itens: previewItens,
      },
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

/** Confirma o recebimento com mapeamento explícito. Cria/atualiza ProdutoFornecedorMap
 *  pros itens marcados com `salvarMapeamento`. Itens com `produtoId=null` (não mapeados
 *  e não ignorados explicitamente) entram no recebimento sem produtoId associado —
 *  isso ainda não é suportado pelo schema, então são tratados como "ignorados". */
export async function confirmarRecebimentoFromNfManual(input: {
  notaId: string;
  responsavelId: string;
  itens: Array<{
    cProd: string;
    xProd: string;
    /** Quantidade original da NF (uCom do fornecedor). Usada pra calcular o fator persistido. */
    qComNf: number;
    /** Quantidade final que vai pro estoque (na unidade do produto da loja). */
    qCom: number;
    produtoId: string | null;
    salvarMapeamento: boolean;
    ignorar: boolean;
  }>;
}): Promise<ActionResult<{ recebimentoId: string; mapeados: number; ignorados: number; mapeamentosSalvos: number }>> {
  try {
    const { user, lojaId } = await requireLojaAtiva();
    const nota = await prisma.notaFiscalImportada.findUnique({
      where: { id: input.notaId },
    });
    if (!nota || nota.lojaId !== lojaId) return { ok: false, error: 'NF não encontrada' };
    if (nota.status !== 'PENDENTE') return { ok: false, error: `NF está ${nota.status}` };

    const responsavel = await prisma.funcionario.findUnique({
      where: { id: input.responsavelId },
      select: { lojaId: true, ativo: true },
    });
    if (!responsavel || responsavel.lojaId !== lojaId || !responsavel.ativo) {
      return { ok: false, error: 'Responsável inválido' };
    }

    let mapeados = 0;
    let ignorados = 0;
    let mapeamentosSalvos = 0;
    const fornecedorNorm = (nota.emissorCnpj ?? '').toLowerCase().trim();

    const itensRows: Prisma.RecebimentoItemCreateManyInput[] = [];
    for (const it of input.itens) {
      if (it.ignorar || !it.produtoId) {
        ignorados += 1;
        continue;
      }
      itensRows.push({
        recebimentoId: '__placeholder__',
        produtoId: it.produtoId,
        quantidade: new Prisma.Decimal(it.qCom),
        descricaoNf: it.xProd,
      });
      mapeados += 1;
    }

    const recebimento = await prisma.recebimento.create({
      data: {
        lojaId,
        responsavelId: input.responsavelId,
        criadaPorId: user.id,
        dataRecebimento: nota.dataEmissao ?? new Date(),
        fornecedor: nota.emissorNome,
        numeroNf: nota.numeroNf,
        status: 'EM_ANDAMENTO',
        observacoes: `Importado da NFe ${nota.chaveAcesso}. ${mapeados} mapeados, ${ignorados} ignorados.`,
      },
      select: { id: true },
    });

    if (itensRows.length > 0) {
      await prisma.recebimentoItem.createMany({
        data: itensRows.map((r) => ({ ...r, recebimentoId: recebimento.id })),
      });
    }

    // Persiste novos mapeamentos pra futuros recebimentos do mesmo fornecedor.
    // Inclui o fator de conversão NF→estoque (qCom_estoque / qCom_NF) pra próxima
    // NF do mesmo fornecedor + descrição já cair com a quantidade ajustada.
    if (fornecedorNorm) {
      for (const it of input.itens) {
        if (!it.salvarMapeamento || !it.produtoId || it.ignorar) continue;
        const descricaoNf = it.xProd.toLowerCase().trim();
        const fator = it.qComNf > 0 ? it.qCom / it.qComNf : 1;
        const fatorSeguro = Number.isFinite(fator) && fator > 0 ? fator : 1;
        await prisma.produtoFornecedorMap.upsert({
          where: {
            lojaId_fornecedor_descricaoNf: { lojaId, fornecedor: fornecedorNorm, descricaoNf },
          },
          create: {
            lojaId, fornecedor: fornecedorNorm, descricaoNf,
            produtoId: it.produtoId,
            fatorConversao: new Prisma.Decimal(fatorSeguro),
          },
          update: {
            produtoId: it.produtoId,
            fatorConversao: new Prisma.Decimal(fatorSeguro),
          },
        });
        mapeamentosSalvos += 1;
      }
    }

    await prisma.notaFiscalImportada.update({
      where: { id: input.notaId },
      data: { status: 'RECEBIDA', recebimentoId: recebimento.id, processadoEm: new Date() },
    });

    revalidatePath('/recebimento');
    revalidatePath('/recebimento/nfs-pendentes');
    return { ok: true, data: { recebimentoId: recebimento.id, mapeados, ignorados, mapeamentosSalvos } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function ignorarNf(notaId: string, motivo?: string): Promise<ActionResult> {
  try {
    const { lojaId } = await requireLojaAtiva();
    const nota = await prisma.notaFiscalImportada.findUnique({ where: { id: notaId }, select: { lojaId: true, status: true } });
    if (!nota || nota.lojaId !== lojaId) return { ok: false, error: 'NF não encontrada' };
    if (nota.status !== 'PENDENTE') return { ok: false, error: `NF está ${nota.status}` };
    await prisma.notaFiscalImportada.update({
      where: { id: notaId },
      data: { status: 'IGNORADA', ignoradoMotivo: motivo ?? null, processadoEm: new Date() },
    });
    revalidatePath('/recebimento/nfs-pendentes');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
