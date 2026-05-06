// /relatorios/contagens — histórico filtrável + ações por linha (ver detalhe, exportar).

import Link from 'next/link';
import type { Prisma } from '@estoque/db';
import { prisma } from '@/lib/db';
import { requireLojaAtiva } from '@/lib/permissions';
import { PageHead } from '@/components/shell/page-head';
import { Card } from '@/components/ui/card';
import { HistoricoContagensTabela, type ContagemRow } from './historico-tabela';

const PAGE = 30;

const dtData = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeZone: 'UTC',
});

interface Search {
  status?: string;
  data?: string;
  page?: string;
}

export default async function HistoricoContagens({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const { lojaId } = await requireLojaAtiva();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1));
  const skip = (page - 1) * PAGE;

  const where: Prisma.ContagemWhereInput = {
    lojaId,
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.data
      ? (() => {
          const [y, m, d] = params.data!.split('-').map(Number);
          if (!y || !m || !d) return {};
          return { dataContagem: new Date(Date.UTC(y, m - 1, d)) };
        })()
      : {}),
  };

  const [contagens, total, datasComContagem] = await Promise.all([
    prisma.contagem.findMany({
      where,
      orderBy: [{ dataContagem: 'desc' }, { iniciadaEm: 'desc' }],
      take: PAGE,
      skip,
      include: {
        responsavel: { select: { nome: true } },
        lista: { select: { nome: true } },
        _count: { select: { lancamentos: true } },
      },
    }),
    prisma.contagem.count({ where }),
    prisma.contagem.groupBy({
      by: ['dataContagem'],
      where: { lojaId, status: { in: ['FINALIZADA', 'EXPORTADA'] } },
      _count: true,
      orderBy: { dataContagem: 'desc' },
      take: 60,
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  // Agrupa contagens por data para o botão "exportar dia consolidado"
  const datasMap = new Map<string, number>();
  for (const d of datasComContagem) {
    datasMap.set(d.dataContagem.toISOString().slice(0, 10), d._count);
  }

  // Serializa as contagens pro Client Component (datas como ISO string)
  const rows: ContagemRow[] = contagens.map((c) => ({
    id: c.id,
    status: c.status,
    dataContagem: c.dataContagem.toISOString().slice(0, 10),
    iniciadaEm: c.iniciadaEm.toISOString(),
    responsavelNome: c.responsavel.nome,
    listaNome: c.lista?.nome ?? null,
    totalLancamentos: c._count.lancamentos,
  }));

  return (
    <div className="max-w-[1240px] mx-auto pb-24">
      <PageHead
        eyebrow={
          <>
            <Link href="/relatorios" className="hover:underline">Relatórios</Link> · Contagens
          </>
        }
        title={
          <>
            Histórico de <em>contagens</em>
          </>
        }
        sub={`${total.toLocaleString('pt-BR')} contagens nesta loja. Marque na tabela e gere PDF/XLSX consolidado pro gestor.`}
      />

      <Card className="p-4 mb-5 flex flex-wrap items-center gap-3">
        <span className="rm-meta text-rm-mid">Filtros:</span>
        <FilterChip label="Todos" href="/relatorios/contagens" active={!params.status && !params.data} />
        <FilterChip label="Finalizadas" href="/relatorios/contagens?status=FINALIZADA" active={params.status === 'FINALIZADA'} />
        <FilterChip label="Exportadas" href="/relatorios/contagens?status=EXPORTADA" active={params.status === 'EXPORTADA'} />
        <FilterChip label="Em andamento" href="/relatorios/contagens?status=EM_ANDAMENTO" active={params.status === 'EM_ANDAMENTO'} />
        <FilterChip label="Canceladas" href="/relatorios/contagens?status=CANCELADA" active={params.status === 'CANCELADA'} />
      </Card>

      {datasMap.size > 0 && (
        <Card className="p-4 mb-5">
          <p className="rm-meta text-rm-mid mb-2">Exportar dia consolidado (formato ZmartBI)</p>
          <div className="flex flex-wrap gap-2">
            {[...datasMap.entries()].slice(0, 14).map(([iso, n]) => (
              <a
                key={iso}
                href={`/api/export/dia?lojaId=${lojaId}&data=${iso}`}
                className="ef-btn ef-btn-ghost ef-btn-sm"
                title={`${n} contagem${n !== 1 ? 's' : ''} em ${dtData.format(new Date(iso))}`}
              >
                {dtData.format(new Date(iso))} · {n}
              </a>
            ))}
          </div>
        </Card>
      )}

      <HistoricoContagensTabela contagens={rows} />

      {totalPages > 1 && (
        <nav className="mt-5 flex items-center justify-between text-[12px] text-rm-mid">
          <span>Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/relatorios/contagens?page=${page - 1}${params.status ? `&status=${params.status}` : ''}`} className="ef-btn ef-btn-ghost ef-btn-sm">
                Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={`/relatorios/contagens?page=${page + 1}${params.status ? `&status=${params.status}` : ''}`} className="ef-btn ef-btn-ghost ef-btn-sm">
                Próxima →
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={
        active
          ? 'px-3 py-1 rounded-xs text-[11px] uppercase tracking-[.16em] font-semibold bg-rm-green text-rm-cream'
          : 'px-3 py-1 rounded-xs text-[11px] uppercase tracking-[.16em] font-semibold border border-hairline text-rm-ink-2 hover:border-rm-green hover:text-rm-green'
      }
    >
      {label}
    </Link>
  );
}
