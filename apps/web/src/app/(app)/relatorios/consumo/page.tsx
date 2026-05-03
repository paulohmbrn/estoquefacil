// /relatorios/consumo — relatório de consumo real
// Fórmula: contagem_anterior + recebimentos_no_intervalo - contagem_atual = consumo
// Onde "anterior" = última contagem FINALIZADA/EXPORTADA antes da data atual.

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';

const dtData = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' });

interface Search {
  data?: string; // yyyy-mm-dd
}

function todayInSp(): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const [y, m, d] = fmt.format(new Date()).split('-').map(Number);
  return new Date(Date.UTC(y!, (m! - 1), d!));
}

export default async function ConsumoPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { lojaId } = await requireLojaAtiva();
  const params = await searchParams;
  const dataAtual = params.data
    ? (() => {
        const [y, m, d] = params.data.split('-').map(Number);
        return new Date(Date.UTC(y!, (m! - 1), d!));
      })()
    : todayInSp();

  // Encontra a última contagem (FINALIZADA ou EXPORTADA) ANTES de dataAtual
  // — pode ser ontem, semana passada, etc (não importa a distância)
  const contagemAnterior = await prisma.contagem.findFirst({
    where: {
      lojaId,
      status: { in: ['FINALIZADA', 'EXPORTADA'] },
      dataContagem: { lt: dataAtual },
    },
    orderBy: { dataContagem: 'desc' },
    include: {
      lancamentos: {
        include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
      },
    },
  });

  // Contagens DA data atual (pode ter mais de uma — agrega)
  const contagensAtuais = await prisma.contagem.findMany({
    where: {
      lojaId,
      status: { in: ['FINALIZADA', 'EXPORTADA'] },
      dataContagem: dataAtual,
    },
    include: {
      lancamentos: {
        include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
      },
    },
  });

  // Recebimentos no intervalo (anterior < dt <= atual)
  const dataAnterior = contagemAnterior?.dataContagem ?? new Date(Date.UTC(2000, 0, 1));
  const recebimentos = await prisma.recebimentoItem.findMany({
    where: {
      recebimento: {
        lojaId,
        status: 'FINALIZADO',
        dataRecebimento: { gt: dataAnterior, lte: dataAtual },
      },
    },
    include: { produto: { select: { id: true, cdarvprod: true, nome: true, unidade: true } } },
  });

  // Construção da matriz de consumo
  type Linha = {
    produtoId: string;
    cdarvprod: string;
    nome: string;
    unidade: string;
    anterior: number;
    recebimento: number;
    atual: number;
    consumo: number;
  };
  const map = new Map<string, Linha>();
  function ensure(p: { id: string; cdarvprod: string; nome: string; unidade: string }): Linha {
    let row = map.get(p.id);
    if (!row) {
      row = {
        produtoId: p.id, cdarvprod: p.cdarvprod, nome: p.nome, unidade: p.unidade,
        anterior: 0, recebimento: 0, atual: 0, consumo: 0,
      };
      map.set(p.id, row);
    }
    return row;
  }
  for (const l of contagemAnterior?.lancamentos ?? []) {
    ensure(l.produto).anterior += Number(l.quantidade);
  }
  for (const r of recebimentos) ensure(r.produto).recebimento += Number(r.quantidade);
  for (const c of contagensAtuais) {
    for (const l of c.lancamentos) ensure(l.produto).atual += Number(l.quantidade);
  }
  for (const row of map.values()) {
    row.consumo = row.anterior + row.recebimento - row.atual;
  }
  const linhas = [...map.values()].sort((a, b) => b.consumo - a.consumo);

  const isoData = dataAtual.toISOString().slice(0, 10);

  return (
    <div className="max-w-[1100px] mx-auto">
      <PageHead
        eyebrow={
          <>
            <Link href="/relatorios" className="hover:underline">Relatórios</Link> · Consumo
          </>
        }
        title={
          <>
            Consumo <em>real</em>
          </>
        }
        sub="Anterior + Recebimentos − Atual = Consumo. Use pra detectar perda/quebra."
      />

      <Card className="p-4 mb-5">
        <form className="flex items-end gap-3 flex-wrap">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[.18em] text-rm-mid mb-1">
              Data atual
            </span>
            <input
              type="date"
              name="data"
              defaultValue={isoData}
              className="bg-white border border-hairline px-3 py-2 rounded-xs text-[13px]"
            />
          </label>
          <button type="submit" className="ef-btn ef-btn-primary">Calcular</button>
        </form>
        <p className="text-[11px] text-rm-mid mt-3">
          {contagemAnterior
            ? `Contagem anterior: ${dtData.format(contagemAnterior.dataContagem)}`
            : 'Sem contagem anterior — só recebimentos contam.'}
          {' · '}
          {contagensAtuais.length === 0
            ? 'Nenhuma contagem nesta data.'
            : `${contagensAtuais.length} contagem${contagensAtuais.length > 1 ? 's' : ''} em ${dtData.format(dataAtual)}`}
          {' · '}
          {recebimentos.length} item(s) de recebimento no intervalo.
        </p>
      </Card>

      {linhas.length === 0 ? (
        <Card className="p-10 text-center text-rm-mid text-[13px]">
          Sem dados pra calcular consumo nesta data. É preciso ao menos uma contagem ou recebimento.
        </Card>
      ) : (
        <>
          <Card className="hidden sm:block overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left border-b border-hairline bg-[#fafaf7]">
                  <Th>Produto</Th>
                  <Th className="text-right">Anterior</Th>
                  <Th className="text-right">+ Recebimento</Th>
                  <Th className="text-right">− Atual</Th>
                  <Th className="text-right">= Consumo</Th>
                  <Th className="text-center">Un</Th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((r) => (
                  <tr key={r.produtoId} className="border-b border-hairline">
                    <td className="px-4 py-2">
                      <p className="font-medium">{r.nome}</p>
                      <p className="rm-mono text-[10px] text-rm-mid">{r.cdarvprod}</p>
                    </td>
                    <td className="px-4 py-2 text-right rm-mono">{fmtNum(r.anterior)}</td>
                    <td className="px-4 py-2 text-right rm-mono text-rm-green">{fmtNum(r.recebimento)}</td>
                    <td className="px-4 py-2 text-right rm-mono">{fmtNum(r.atual)}</td>
                    <td className={
                      r.consumo < 0
                        ? 'px-4 py-2 text-right rm-mono font-bold text-rm-red'
                        : 'px-4 py-2 text-right rm-mono font-bold text-rm-ink'
                    }>
                      {fmtNum(r.consumo)}
                    </td>
                    <td className="px-4 py-2 text-center text-rm-mid">{r.unidade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile: cards */}
          <ul className="sm:hidden space-y-2">
            {linhas.map((r) => (
              <li key={r.produtoId} className="bg-white border border-hairline rounded-xs p-3">
                <p className="font-medium text-[13px]">{r.nome}</p>
                <p className="rm-mono text-[10px] text-rm-mid">{r.cdarvprod} · {r.unidade}</p>
                <div className="grid grid-cols-4 gap-1 mt-2 text-[11px] text-center">
                  <Cell label="Ant.">{fmtNum(r.anterior)}</Cell>
                  <Cell label="+ Rec." color="green">{fmtNum(r.recebimento)}</Cell>
                  <Cell label="− Atual">{fmtNum(r.atual)}</Cell>
                  <Cell
                    label="Consumo"
                    color={r.consumo < 0 ? 'red' : 'bold'}
                  >
                    {fmtNum(r.consumo)}
                  </Cell>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <th className={`px-4 py-3 font-semibold text-rm-mid uppercase tracking-[.16em] text-[10px] ${className ?? ''}`}>
      {children}
    </th>
  );
}

function Cell({ label, children, color }: { label: string; children: React.ReactNode; color?: 'green' | 'red' | 'bold' }) {
  const cls =
    color === 'green' ? 'text-rm-green'
    : color === 'red' ? 'text-rm-red font-bold'
    : color === 'bold' ? 'text-rm-ink font-bold'
    : 'text-rm-ink-2';
  return (
    <div>
      <p className="text-[9px] tracking-[.14em] uppercase text-rm-mid">{label}</p>
      <p className={`rm-mono mt-1 ${cls}`}>{children}</p>
    </div>
  );
}

function fmtNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}
