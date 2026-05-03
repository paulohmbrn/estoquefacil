// Helpers de query usados pelo route handler de export.

import { prisma } from '@/lib/db';
import type { LancamentoExport } from './export-xlsx';

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
  return {
    meta: {
      id: c.id,
      lojaId: c.lojaId,
      cdFilial: c.loja.zmartbiId,
      status: c.status,
      dataContagem: c.dataContagem,
    },
    lancamentos: c.lancamentos.map((l) => ({
      cdarvprod: l.produto.cdarvprod,
      quantidade: Number(l.quantidade),
      dataContagem: c.dataContagem,
    })),
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
    lancamentos,
  };
}

export async function marcarContagensComoExportadas(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await prisma.contagem.updateMany({
    where: { id: { in: ids }, status: 'FINALIZADA' },
    data: { status: 'EXPORTADA', exportadaEm: new Date() },
  });
}
