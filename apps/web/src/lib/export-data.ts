// Helpers de query usados pelo route handler de export.

import { FILIAIS_ESTOQUE_CONTROLADO_SET } from '@estoque/shared';
import { prisma } from '@/lib/db';
import type { LancamentoExport } from './export-xlsx';

/**
 * Consolida lançamentos pro ZmartBI nas lojas de Estoque Controlado:
 *  1. cada CDARVPROD vira o produto de estoque base (`cdarvprodEstoque`), com
 *     quantidade × `fatorConversao` (unidade base);
 *  2. soma o saldo do Estoque Controlado (etiquetas ATIVA com snapshot) — cada
 *     etiqueta = 1 unidade física × `fatorConversaoSnap`, no `cdarvprodEstoqueSnap`.
 * O `buildContagemXlsx` então agrega por (base, data) → 1 linha por família.
 *
 * Lojas fora de `FILIAIS_ESTOQUE_CONTROLADO` (ex.: FFB 0013) mantêm o
 * comportamento legado: lançamentos crus, sem fator e sem saldo controlado.
 */
async function consolidarParaZmartbi(args: {
  lojaId: string;
  cdFilial: string;
  lancamentos: LancamentoExport[];
  dataLancamento: Date;
  // Saldo do Estoque Controlado é um agregado do dia — só entra nas exportações
  // consolidadas (dia/seleção), nunca numa contagem isolada (evita duplicar o
  // saldo se o gestor exporta várias contagens avulsas no mesmo dia).
  incluirSaldoControlado: boolean;
}): Promise<LancamentoExport[]> {
  if (!FILIAIS_ESTOQUE_CONTROLADO_SET.has(args.cdFilial)) return args.lancamentos;

  const codes = [...new Set(args.lancamentos.map((l) => l.cdarvprod))];
  const prods = codes.length
    ? await prisma.produto.findMany({
        where: { lojaId: args.lojaId, cdarvprod: { in: codes } },
        select: { cdarvprod: true, fatorConversao: true, cdarvprodEstoque: true },
      })
    : [];
  const map = new Map(prods.map((p) => [p.cdarvprod, p]));

  const out: LancamentoExport[] = [];
  for (const l of args.lancamentos) {
    const p = map.get(l.cdarvprod);
    const fator = p ? Number(p.fatorConversao) : 1;
    const base = p?.cdarvprodEstoque ?? l.cdarvprod;
    out.push({ cdarvprod: base, quantidade: l.quantidade * fator, dataContagem: l.dataContagem });
  }

  if (!args.incluirSaldoControlado) return out;

  // Saldo do Estoque Controlado: só etiquetas com snapshot (gerarEtiquetasControladas).
  // Etiquetas de manipulação (lote/imprimir-ws) têm cdarvprodEstoqueSnap = null e
  // não entram aqui.
  const grupos = await prisma.etiqueta.groupBy({
    by: ['cdarvprodEstoqueSnap', 'fatorConversaoSnap'],
    where: { lojaId: args.lojaId, estado: 'ATIVA', cdarvprodEstoqueSnap: { not: null } },
    _count: { _all: true },
  });
  for (const g of grupos) {
    if (!g.cdarvprodEstoqueSnap) continue;
    out.push({
      cdarvprod: g.cdarvprodEstoqueSnap,
      quantidade: g._count._all * Number(g.fatorConversaoSnap),
      dataContagem: args.dataLancamento,
    });
  }
  return out;
}

export type ContagemMeta = {
  id: string;
  lojaId: string;
  cdFilial: string;
  status: string;
  dataContagem: Date;
};

export async function fetchContagemUnica(contagemId: string): Promise<{
  meta: ContagemMeta;
  lancamentos: LancamentoExport[];
} | null> {
  const c = await prisma.contagem.findUnique({
    where: { id: contagemId },
    include: {
      loja: { select: { zmartbiId: true } },
      lancamentos: {
        select: {
          quantidade: true,
          produto: { select: { cdarvprod: true } },
        },
      },
    },
  });
  if (!c) return null;
  const lancamentosCrus = c.lancamentos.map((l) => ({
    cdarvprod: l.produto.cdarvprod,
    quantidade: Number(l.quantidade),
    dataContagem: c.dataContagem,
  }));
  return {
    meta: {
      id: c.id,
      lojaId: c.lojaId,
      cdFilial: c.loja.zmartbiId,
      status: c.status,
      dataContagem: c.dataContagem,
    },
    lancamentos: await consolidarParaZmartbi({
      lojaId: c.lojaId,
      cdFilial: c.loja.zmartbiId,
      lancamentos: lancamentosCrus,
      dataLancamento: c.dataContagem,
      incluirSaldoControlado: false, // contagem isolada não carrega o saldo do dia
    }),
  };
}

/** Consolida TODAS as contagens FINALIZADAS (e EM_ANDAMENTO se incluirEmAndamento) da loja na data civil dada. */
export async function fetchContagensDoDia(args: {
  lojaId: string;
  dataContagem: Date;       // já truncada para a data civil em UTC midnight
  incluirEmAndamento?: boolean;
}): Promise<{
  meta: { lojaId: string; cdFilial: string; dataContagem: Date; contagensIds: string[] };
  lancamentos: LancamentoExport[];
} | null> {
  const loja = await prisma.loja.findUnique({
    where: { id: args.lojaId },
    select: { zmartbiId: true },
  });
  if (!loja) return null;

  const statusList: ('EM_ANDAMENTO' | 'FINALIZADA' | 'EXPORTADA')[] = args.incluirEmAndamento
    ? ['EM_ANDAMENTO', 'FINALIZADA', 'EXPORTADA']
    : ['FINALIZADA', 'EXPORTADA'];

  const contagens = await prisma.contagem.findMany({
    where: {
      lojaId: args.lojaId,
      dataContagem: args.dataContagem,
      status: { in: statusList },
    },
    include: {
      lancamentos: {
        select: {
          quantidade: true,
          produto: { select: { cdarvprod: true } },
        },
      },
    },
  });

  if (contagens.length === 0) return null;

  const lancamentos: LancamentoExport[] = [];
  for (const c of contagens) {
    for (const l of c.lancamentos) {
      lancamentos.push({
        cdarvprod: l.produto.cdarvprod,
        quantidade: Number(l.quantidade),
        dataContagem: c.dataContagem,
      });
    }
  }
  return {
    meta: {
      lojaId: args.lojaId,
      cdFilial: loja.zmartbiId,
      dataContagem: args.dataContagem,
      contagensIds: contagens.map((c) => c.id),
    },
    lancamentos: await consolidarParaZmartbi({
      lojaId: args.lojaId,
      cdFilial: loja.zmartbiId,
      lancamentos,
      dataLancamento: args.dataContagem,
      incluirSaldoControlado: true,
    }),
  };
}

/**
 * Consolida N contagens selecionadas (mesma loja, status FINALIZADA/EXPORTADA) num
 * único conjunto de lançamentos no formato ZmartBI. Como as contagens podem ser de
 * datas diferentes, a data de lançamento (DTLANCESTQ e nome do arquivo) é a MENOR
 * `dataContagem` do conjunto — todos os lançamentos passam a usá-la, então o XLSX
 * fica com uma linha por (CDARVPROD, dataLancamento). Retorna `{ error }` se a
 * validação falhar.
 */
export async function fetchContagensSelecionadas(args: {
  contagensIds: string[];
  lojaId: string;
}): Promise<
  | {
      meta: { lojaId: string; cdFilial: string; dataLancamento: Date; contagensIds: string[] };
      lancamentos: LancamentoExport[];
    }
  | { error: string }
> {
  if (args.contagensIds.length === 0) return { error: 'Nenhuma contagem selecionada' };

  const contagens = await prisma.contagem.findMany({
    where: { id: { in: args.contagensIds }, lojaId: args.lojaId },
    include: {
      loja: { select: { zmartbiId: true } },
      lancamentos: {
        select: {
          quantidade: true,
          produto: { select: { cdarvprod: true } },
        },
      },
    },
  });

  if (contagens.length === 0) return { error: 'Contagens não encontradas' };
  if (contagens.length !== args.contagensIds.length) {
    return { error: 'Algumas contagens não pertencem a esta loja' };
  }
  for (const c of contagens) {
    if (c.status !== 'FINALIZADA' && c.status !== 'EXPORTADA') {
      return { error: 'Apenas contagens Finalizadas ou Exportadas podem ser exportadas' };
    }
  }

  // Data de lançamento = a MENOR dataContagem entre as contagens selecionadas.
  const dataLancamento = contagens.reduce(
    (min, c) => (c.dataContagem < min ? c.dataContagem : min),
    contagens[0]!.dataContagem,
  );

  const lancamentos: LancamentoExport[] = [];
  for (const c of contagens) {
    for (const l of c.lancamentos) {
      lancamentos.push({
        cdarvprod: l.produto.cdarvprod,
        quantidade: Number(l.quantidade),
        dataContagem: dataLancamento, // colapsa todas as datas na menor
      });
    }
  }

  return {
    meta: {
      lojaId: args.lojaId,
      cdFilial: contagens[0]!.loja.zmartbiId,
      dataLancamento,
      contagensIds: contagens.map((c) => c.id),
    },
    lancamentos: await consolidarParaZmartbi({
      lojaId: args.lojaId,
      cdFilial: contagens[0]!.loja.zmartbiId,
      lancamentos,
      dataLancamento,
      incluirSaldoControlado: true,
    }),
  };
}

export async function marcarContagensComoExportadas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.contagem.updateMany({
    where: { id: { in: ids }, status: 'FINALIZADA' },
    data: { status: 'EXPORTADA', exportadaEm: new Date() },
  });
}
